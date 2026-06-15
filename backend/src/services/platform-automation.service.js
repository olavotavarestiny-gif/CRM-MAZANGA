const prisma = require('../lib/prisma');
const { sendSms } = require('./sms.service');
const platformSms = require('./platform-sms.service');

/**
 * Motor de automações internas de SMS da plataforma (Fase 4).
 *
 * Reutiliza:
 *  - platformSms.resolveSegmentRecipients (elegibilidade por segmento)
 *  - platformSms.baseOwnerWhere / renderTemplate / addDays (helpers)
 *  - sms.service.sendSms (envio padronizado)
 *
 * Cada execução: verifica elegíveis → evita duplicação no período (cooldown) →
 * envia SMS → grava PlatformSmsMessage + PlatformAutomationLog → atualiza lastRunAt.
 */

const DEFAULT_COOLDOWN_DAYS = 7;
const MAX_RECIPIENTS_PER_RUN = 1000; // limite de segurança

// Definições das 8 automações. `segment` mapeia para platformSms.resolveSegmentRecipients
// quando aplicável; null = resolver dedicado neste serviço.
const AUTOMATIONS = [
  {
    triggerType: 'inactivity_7d',
    name: 'Utilizador sem login há 7 dias',
    segment: 'inactive_7_days',
    message: 'Olá {{nome}}, sentimos a sua falta no KukuGest. Entre hoje e veja os seus contactos, tarefas e oportunidades em aberto.',
  },
  {
    triggerType: 'no_first_action',
    name: 'Conta criada sem primeira ação',
    segment: null,
    message: 'Olá {{nome}}, a sua conta KukuGest já está pronta. Comece criando o seu primeiro contacto, cliente ou tarefa.',
  },
  {
    triggerType: 'onboarding_incomplete',
    name: 'Onboarding incompleto',
    segment: 'onboarding_incomplete',
    message: 'Olá {{nome}}, falta pouco para concluir a configuração do KukuGest. Entre na plataforma e finalize os próximos passos.',
  },
  {
    triggerType: 'trial_ending',
    name: 'Trial a terminar',
    segment: 'trial_ending',
    message: 'Olá {{nome}}, o seu período de teste no KukuGest termina em breve. Regularize o seu plano para continuar sem interrupções.',
  },
  {
    triggerType: 'trial_expired',
    name: 'Trial expirado',
    segment: 'trial_expired',
    message: 'Olá {{nome}}, o seu período de teste terminou. Para continuar a usar o KukuGest, escolha o plano ideal para a sua empresa.',
  },
  {
    triggerType: 'payment_due_soon',
    name: 'Pagamento próximo',
    segment: 'payment_due_soon',
    message: 'Olá {{nome}}, lembramos que a renovação do seu plano KukuGest aproxima-se. Evite interrupções no acesso.',
  },
  {
    triggerType: 'payment_overdue',
    name: 'Pagamento vencido',
    segment: 'payment_overdue',
    message: 'Olá {{nome}}, o seu plano KukuGest encontra-se pendente. Regularize para manter o acesso ativo.',
  },
  {
    triggerType: 'usage_drop',
    name: 'Queda de utilização',
    segment: null,
    message: 'Olá {{nome}}, notámos uma queda na utilização da sua conta. Precisa de ajuda para configurar melhor o KukuGest?',
  },
];

const AUTOMATION_MAP = Object.fromEntries(AUTOMATIONS.map((a) => [a.triggerType, a]));

// Garante que as 8 regras default existem (criadas inativas — superadmin opta por ativar).
async function ensureDefaultRules() {
  for (const def of AUTOMATIONS) {
    const existing = await prisma.platformAutomationRule.findFirst({ where: { triggerType: def.triggerType } });
    if (!existing) {
      await prisma.platformAutomationRule.create({
        data: { triggerType: def.triggerType, name: def.name, messageTemplate: def.message, isActive: false },
      });
    }
  }
}

function mapRecipient(owner) {
  return { userId: owner.id, accountOwnerId: owner.id, name: owner.name, phone: owner.phone.trim() };
}

function hasUsablePhone(phone) {
  return typeof phone === 'string' && phone.trim().length > 0;
}

// Resolver dedicado: conta criada recentemente e sem qualquer contacto (não começou a usar).
async function resolveNoFirstAction(conditions = {}) {
  const days = Number(conditions.days) > 0 ? Number(conditions.days) : 30;
  const since = platformSms.addDays(new Date(), -days);
  const owners = await prisma.user.findMany({
    where: platformSms.baseOwnerWhere({ createdAt: { gte: since } }),
    select: { id: true, name: true, phone: true, accountMembers: { select: { id: true } } },
  });
  const ids = [];
  owners.forEach((o) => { ids.push(o.id); o.accountMembers.forEach((m) => ids.push(m.id)); });
  const withContacts = ids.length
    ? await prisma.contact.findMany({ where: { userId: { in: ids } }, select: { userId: true }, distinct: ['userId'] })
    : [];
  const hasContact = new Set(withContacts.map((c) => c.userId));
  return owners
    .filter((o) => {
      const memberIds = [o.id, ...o.accountMembers.map((m) => m.id)];
      return !memberIds.some((id) => hasContact.has(id));
    })
    .filter((o) => hasUsablePhone(o.phone))
    .map(mapRecipient);
}

// Resolver dedicado: tinha atividade na janela anterior mas parou nos últimos 7 dias.
async function resolveUsageDrop(conditions = {}) {
  const now = new Date();
  const recentDays = Number(conditions.recentDays) > 0 ? Number(conditions.recentDays) : 7;
  const priorDays = Number(conditions.priorDays) > 0 ? Number(conditions.priorDays) : 21;
  const recentCut = platformSms.addDays(now, -recentDays);
  const priorStart = platformSms.addDays(now, -priorDays);
  const owners = await prisma.user.findMany({
    where: platformSms.baseOwnerWhere(),
    select: { id: true, name: true, phone: true, accountMembers: { select: { id: true } } },
  });
  const ids = [];
  owners.forEach((o) => { ids.push(o.id); o.accountMembers.forEach((m) => ids.push(m.id)); });
  if (!ids.length) return [];
  const logs = await prisma.loginLog.findMany({
    where: { userId: { in: ids }, createdAt: { gte: priorStart } },
    select: { userId: true, createdAt: true },
  });
  return owners
    .filter((o) => {
      const memberIds = new Set([o.id, ...o.accountMembers.map((m) => m.id)]);
      let priorActive = false;
      let recentActive = false;
      logs.forEach((l) => {
        if (memberIds.has(l.userId)) {
          if (l.createdAt >= recentCut) recentActive = true;
          else priorActive = true;
        }
      });
      return priorActive && !recentActive;
    })
    .filter((o) => hasUsablePhone(o.phone))
    .map(mapRecipient);
}

async function resolveEligible(triggerType, conditions = {}) {
  const def = AUTOMATION_MAP[triggerType];
  if (!def) return [];
  if (def.segment) {
    const { recipients } = await platformSms.resolveSegmentRecipients(def.segment, conditions);
    return recipients;
  }
  if (triggerType === 'no_first_action') return resolveNoFirstAction(conditions);
  if (triggerType === 'usage_drop') return resolveUsageDrop(conditions);
  return [];
}

/**
 * Executa uma regra. dryRun=true só devolve os elegíveis (não envia).
 * isTest=true aplica a allowlist de teste no envio (default seguro para execução manual).
 */
async function runRule(rule, { isTest = true, dryRun = false, actorUserId = null } = {}) {
  const conditions = rule.conditionsJson && typeof rule.conditionsJson === 'object' ? rule.conditionsJson : {};
  const cooldownDays = Number(conditions.cooldownDays) > 0 ? Number(conditions.cooldownDays) : DEFAULT_COOLDOWN_DAYS;

  let recipients = await resolveEligible(rule.triggerType, conditions);
  const result = {
    ruleId: rule.id,
    triggerType: rule.triggerType,
    eligible: recipients.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    cappedAt: null,
  };

  if (dryRun) {
    result.sample = recipients.slice(0, 50).map((r) => ({ name: r.name, phone: r.phone }));
    return result;
  }

  if (recipients.length > MAX_RECIPIENTS_PER_RUN) {
    result.cappedAt = MAX_RECIPIENTS_PER_RUN;
    recipients = recipients.slice(0, MAX_RECIPIENTS_PER_RUN);
    console.warn(`[platform-automations] ${rule.triggerType}: ${result.eligible} elegíveis, limitado a ${MAX_RECIPIENTS_PER_RUN}.`);
  }

  const cooldownSince = platformSms.addDays(new Date(), -cooldownDays);

  for (const r of recipients) {
    // dedup por período: salta se já houve envio com sucesso desta regra para este utilizador dentro do cooldown
    const recent = await prisma.platformAutomationLog.findFirst({
      where: { ruleId: rule.id, targetUserId: r.userId, status: 'sent', executedAt: { gte: cooldownSince } },
      select: { id: true },
    });
    if (recent) {
      result.skipped += 1;
      continue;
    }

    const content = platformSms.renderTemplate(rule.messageTemplate, r);
    const sms = await sendSms({
      phone: r.phone,
      message: content,
      senderName: rule.senderName,
      isTest,
      metadata: { automationRuleId: rule.id, targetUserId: r.userId },
    });

    const smsMessage = await prisma.platformSmsMessage.create({
      data: {
        targetUserId: r.userId,
        targetAccountOwnerId: r.accountOwnerId,
        phone: sms.phoneNormalized || r.phone,
        recipientName: r.name,
        message: content,
        senderName: rule.senderName,
        status: sms.success ? 'sent' : 'failed',
        providerMessageId: sms.providerMessageId || null,
        providerStatus: sms.providerStatus || null,
        errorCode: sms.errorCode || null,
        errorMessage: sms.errorMessage || null,
        triggerSource: 'AUTOMATION',
        automationRuleId: rule.id,
        isTest,
        rawResponseJson: sms.raw || undefined,
        sentAt: sms.success ? new Date() : null,
        createdByUserId: actorUserId,
      },
    });

    await prisma.platformAutomationLog.create({
      data: {
        ruleId: rule.id,
        targetUserId: r.userId,
        status: sms.success ? 'sent' : 'failed',
        message: content,
        errorMessage: sms.errorMessage || null,
        smsMessageId: smsMessage.id,
      },
    });

    if (sms.success) result.sent += 1;
    else result.failed += 1;
  }

  await prisma.platformAutomationRule.update({ where: { id: rule.id }, data: { lastRunAt: new Date() } });
  return result;
}

// Listar regras (garante defaults) com contagem de envios por regra.
async function listRules() {
  await ensureDefaultRules();
  const rules = await prisma.platformAutomationRule.findMany({ orderBy: { createdAt: 'asc' } });
  const counts = await prisma.platformSmsMessage.groupBy({
    by: ['automationRuleId', 'status'],
    where: { automationRuleId: { not: null } },
    _count: { _all: true },
  });
  const sentByRule = {};
  counts.forEach((c) => {
    if (c.status === 'sent') sentByRule[c.automationRuleId] = (sentByRule[c.automationRuleId] || 0) + c._count._all;
  });
  return rules.map((r) => ({ ...r, sentCount: sentByRule[r.id] || 0 }));
}

const EDITABLE_FIELDS = ['name', 'messageTemplate', 'senderName', 'isActive', 'conditionsJson'];

async function updateRule(id, body = {}) {
  const data = {};
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.messageTemplate !== undefined) {
    const msg = String(body.messageTemplate).trim();
    if (!msg) throw new platformSms.PlatformSmsError('A mensagem não pode ficar vazia.', { code: 'INVALID_MESSAGE' });
    data.messageTemplate = msg;
  }
  if (body.senderName !== undefined) data.senderName = body.senderName ? String(body.senderName).trim() : null;
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.conditionsJson !== undefined) {
    data.conditionsJson = body.conditionsJson && typeof body.conditionsJson === 'object' ? body.conditionsJson : undefined;
  }
  if (Object.keys(data).length === 0) {
    throw new platformSms.PlatformSmsError('Nada para atualizar.', { code: 'NOTHING_TO_UPDATE' });
  }
  try {
    return await prisma.platformAutomationRule.update({ where: { id }, data });
  } catch (error) {
    if (error.code === 'P2025') throw new platformSms.PlatformSmsError('Automação não encontrada.', { status: 404, code: 'NOT_FOUND' });
    throw error;
  }
}

async function runRuleById(id, options = {}) {
  const rule = await prisma.platformAutomationRule.findUnique({ where: { id } });
  if (!rule) throw new platformSms.PlatformSmsError('Automação não encontrada.', { status: 404, code: 'NOT_FOUND' });
  return runRule(rule, options);
}

// Executa todas as regras ativas (usado pelo scheduler). isTest=false → envio real.
async function runAllActiveRules({ actorUserId = null } = {}) {
  await ensureDefaultRules();
  const rules = await prisma.platformAutomationRule.findMany({ where: { isActive: true } });
  const results = [];
  for (const rule of rules) {
    try {
      results.push(await runRule(rule, { isTest: false, dryRun: false, actorUserId }));
    } catch (error) {
      console.error(`[platform-automations] erro na regra ${rule.triggerType}:`, error.message);
      results.push({ ruleId: rule.id, triggerType: rule.triggerType, error: error.message });
    }
  }
  return results;
}

async function listRuleLogs(id, query = {}) {
  const take = Math.min(Math.max(parseInt(query.pageSize, 10) || 30, 1), 100);
  const logs = await prisma.platformAutomationLog.findMany({
    where: { ruleId: id },
    orderBy: { executedAt: 'desc' },
    take,
  });
  return { logs };
}

module.exports = {
  AUTOMATIONS,
  ensureDefaultRules,
  resolveEligible,
  runRule,
  runRuleById,
  runAllActiveRules,
  listRules,
  updateRule,
  listRuleLogs,
};
