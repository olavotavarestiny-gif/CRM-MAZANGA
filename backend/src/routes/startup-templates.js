const express = require('express');
const prisma = require('../lib/prisma');
const requireAuth = require('../middleware/auth');
const { getPlanContext } = require('../lib/plan-limits');
const { TEMPLATE_VERSION, getStartupTemplate, listStartupTemplates } = require('../lib/startup-templates');

const router = express.Router();

function serializeApplication(application) {
  if (!application) return { applied: false };
  return {
    applied: true,
    templateKey: application.templateKey,
    workspaceMode: application.workspaceMode,
    appliedAt: application.appliedAt,
    goals: application.metadata?.goals || [],
  };
}

async function getWorkspaceMode(orgId) {
  const context = await getPlanContext(orgId);
  return context.workspaceMode === 'comercio' ? 'comercio' : 'servicos';
}

function buildTaskData(template, orgId, userId) {
  return template.tasks.map((title, index) => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + index + 1);
    return {
      userId: orgId,
      assignedToUserId: userId,
      title,
      notes: `Modelo Inteligente de Arranque: ${template.label}`,
      dueDate,
      priority: index === 0 ? 'Alta' : 'Media',
      done: false,
    };
  });
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const workspaceMode = await getWorkspaceMode(req.user.effectiveUserId);
    return res.json({
      title: 'Modelos Inteligentes de Arranque',
      version: TEMPLATE_VERSION,
      workspaceMode,
      templates: listStartupTemplates(workspaceMode),
    });
  } catch (error) {
    console.error('[startup-templates] list error:', error);
    return res.status(500).json({ error: 'Erro ao carregar modelos de arranque' });
  }
});

router.get('/status', requireAuth, async (req, res) => {
  try {
    const application = await prisma.startupTemplateApplication.findUnique({
      where: { organizationId: req.user.effectiveUserId },
    });
    return res.json(serializeApplication(application));
  } catch (error) {
    console.error('[startup-templates] status error:', error);
    return res.status(500).json({ error: 'Erro ao carregar estado do modelo' });
  }
});

router.post('/apply', requireAuth, async (req, res) => {
  try {
    if (!(req.user.isSuperAdmin || req.user.isAccountOwner || req.user.role === 'admin')) {
      return res.status(403).json({ error: 'Apenas owner ou administrador pode escolher um modelo de arranque' });
    }

    const template = getStartupTemplate(req.body?.templateKey);
    if (!template) {
      return res.status(400).json({ error: 'Modelo de arranque inválido' });
    }

    const orgId = req.user.effectiveUserId;
    const workspaceMode = await getWorkspaceMode(orgId);
    if (template.workspaceMode !== workspaceMode && template.key !== 'retail_store') {
      return res.status(400).json({ error: 'Modelo incompatível com o workspace da conta' });
    }
    if (template.key === 'retail_store' && workspaceMode !== 'comercio') {
      return res.status(400).json({ error: 'Modelo Loja / Comércio requer workspace Comércio' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.startupTemplateApplication.findUnique({
        where: { organizationId: orgId },
      });
      if (existing) return { alreadyApplied: true, application: existing };

      const stageCount = await tx.pipelineStage.count({ where: { userId: orgId } });
      if (stageCount === 0 && template.pipelineStages.length > 0) {
        await tx.pipelineStage.createMany({
          data: template.pipelineStages.map((name, index) => ({
            userId: orgId,
            name,
            order: index,
            color: ['#2563eb', '#0ea5e9', '#f59e0b', '#8b5cf6', '#16a34a'][index] || '#6b7e9a',
          })),
          skipDuplicates: true,
        });
      }

      const existingTaskTitles = await tx.task.findMany({
        where: {
          userId: orgId,
          title: { in: template.tasks },
        },
        select: { title: true },
      });
      const existingTitles = new Set(existingTaskTitles.map((task) => task.title));
      const tasksToCreate = buildTaskData(template, orgId, req.user.id).filter((task) => !existingTitles.has(task.title));
      if (tasksToCreate.length > 0) {
        await tx.task.createMany({ data: tasksToCreate });
      }

      const application = await tx.startupTemplateApplication.create({
        data: {
          organizationId: orgId,
          templateKey: template.key,
          workspaceMode,
          appliedByUserId: req.user.id,
          metadata: {
            version: TEMPLATE_VERSION,
            label: template.label,
            goals: template.goals,
            financialCategories: template.financialCategories,
          },
        },
      });

      return { alreadyApplied: false, application };
    });

    return res.status(result.alreadyApplied ? 200 : 201).json({
      ...serializeApplication(result.application),
      alreadyApplied: result.alreadyApplied,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      const existing = await prisma.startupTemplateApplication.findUnique({
        where: { organizationId: req.user.effectiveUserId },
      });
      return res.json({ ...serializeApplication(existing), alreadyApplied: true });
    }
    console.error('[startup-templates] apply error:', error);
    return res.status(500).json({ error: 'Erro ao aplicar modelo de arranque' });
  }
});

module.exports = router;
