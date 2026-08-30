require('dotenv').config();

const crypto = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');

const prisma = new PrismaClient();

const DEMO_USERS = [
  { key: 'admin', name: 'Olavo Administrador', email: 'admin.gestao@demo.kukugest.com', role: 'admin' },
  { key: 'marketing', name: 'Marta Marketing', email: 'marketing.gestao@demo.kukugest.com', role: 'marketing' },
  { key: 'commercial', name: 'Carlos Comercial', email: 'comercial.gestao@demo.kukugest.com', role: 'commercial' },
  { key: 'designer', name: 'Diana Designer', email: 'designer.gestao@demo.kukugest.com', role: 'designer' },
  { key: 'editor', name: 'Edson Editor', email: 'editor.gestao@demo.kukugest.com', role: 'editor' },
];

function stableUuid(value) {
  const bytes = Buffer.from(crypto.createHash('sha256').update(`kukugest-management:${value}`).digest().subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function day(value = 0, hour = 10) {
  const current = new Date();
  return new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate() + value, hour));
}

function month(value = 0) {
  const current = new Date();
  return new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + value, 1, 10));
}

async function findSupabaseUser(admin, email) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 1000) return null;
  }
  throw new Error(`Não foi possível concluir a pesquisa do utilizador ${email} no Supabase.`);
}

async function ensureSupabaseUser(admin, definition, password) {
  const existing = await findSupabaseUser(admin, definition.email);
  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      user_metadata: { name: definition.name, demo_workspace: 'gestao_kpi' },
    });
    if (error) throw error;
    return data.user;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: definition.email,
    password,
    email_confirm: true,
    user_metadata: { name: definition.name, demo_workspace: 'gestao_kpi' },
  });
  if (error) throw error;
  return data.user;
}

async function setContext(tx, key, value) {
  await tx.$queryRawUnsafe('SELECT set_config($1, $2, true)', key, String(value ?? ''));
}

async function upsertRows(rows, handler) {
  for (const [index, row] of rows.entries()) await handler(row, index);
}

async function main() {
  const password = process.env.DEMO_SEED_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error('Defina DEMO_SEED_PASSWORD com pelo menos 8 caracteres antes de executar o seed.');
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias para criar os utilizadores de demonstração.');
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const authUsers = new Map();
  for (const definition of DEMO_USERS) {
    authUsers.set(definition.key, await ensureSupabaseUser(supabase, definition, password));
  }

  const ownerDefinition = DEMO_USERS[0];
  const ownerAuth = authUsers.get('admin');
  const owner = await prisma.user.upsert({
    where: { email: ownerDefinition.email },
    create: {
      name: ownerDefinition.name,
      email: ownerDefinition.email,
      passwordHash: 'SUPABASE_AUTH',
      supabaseUid: ownerAuth.id,
      role: 'admin',
      active: true,
      workspaceMode: 'gestao_kpi',
      plan: 'enterprise',
      billingType: 'paid',
      accountStatus: 'active',
    },
    update: {
      name: ownerDefinition.name,
      supabaseUid: ownerAuth.id,
      role: 'admin',
      active: true,
      accountOwnerId: null,
      workspaceMode: 'gestao_kpi',
      plan: 'enterprise',
      billingType: 'paid',
      accountStatus: 'active',
    },
  });

  const members = new Map([['admin', owner]]);
  for (const definition of DEMO_USERS.slice(1)) {
    const authUser = authUsers.get(definition.key);
    const user = await prisma.user.upsert({
      where: { email: definition.email },
      create: {
        name: definition.name,
        email: definition.email,
        passwordHash: 'SUPABASE_AUTH',
        supabaseUid: authUser.id,
        role: definition.role,
        active: true,
        accountOwnerId: owner.id,
        workspaceMode: 'gestao_kpi',
        plan: 'enterprise',
        billingType: 'paid',
        accountStatus: 'active',
      },
      update: {
        name: definition.name,
        supabaseUid: authUser.id,
        role: definition.role,
        active: true,
        accountOwnerId: owner.id,
        workspaceMode: 'gestao_kpi',
      },
    });
    members.set(definition.key, user);
  }

  await prisma.$transaction(async (tx) => {
    await setContext(tx, 'app.management_user_id', owner.id);
    const provisioned = await tx.$queryRawUnsafe(
      'SELECT * FROM provision_management_workspace($1::integer, $2, $3::uuid, $4)',
      owner.id,
      'KukuGest — Gestão e KPI (Demonstração)',
      ownerAuth.id,
      owner.name
    );
    const organizationId = provisioned[0].organization_id;
    const adminProfileId = provisioned[0].profile_id;

    await setContext(tx, 'app.management_organization_id', organizationId);
    await setContext(tx, 'app.management_profile_id', adminProfileId);
    await setContext(tx, 'app.management_role', 'admin');
    await setContext(tx, 'app.management_system', '');

    const profiles = new Map();
    profiles.set('admin', await tx.managementProfile.findUnique({ where: { userId: owner.id } }));
    for (const definition of DEMO_USERS.slice(1)) {
      const user = members.get(definition.key);
      const authUser = authUsers.get(definition.key);
      const profile = await tx.managementProfile.upsert({
        where: { userId: user.id },
        create: {
          id: stableUuid(`profile:${definition.key}`),
          organizationId,
          userId: user.id,
          authUserId: authUser.id,
          fullName: definition.name,
          role: definition.role,
          active: true,
          createdBy: adminProfileId,
        },
        update: {
          organizationId,
          authUserId: authUser.id,
          fullName: definition.name,
          role: definition.role,
          active: true,
        },
      });
      profiles.set(definition.key, profile);
    }

    const clientDefinitions = [
      ['Atlântico Logística', 'Ana Manuel', 'Gestão de marketing', 650000, 7800000, 'ativo', 'indicacao'],
      ['Kwanza Tech', 'Paulo Domingos', 'Website', 450000, 2700000, 'ativo', 'website'],
      ['Nzoji Imobiliária', 'Teresa Mateus', 'Design e vídeo', 520000, 6240000, 'ativo', 'meta_ads'],
      ['Semba Foods', 'Jorge Mário', 'Produção audiovisual', 380000, 2280000, 'pausado', 'evento'],
      ['Mussulo Experience', 'Helena Costa', 'Consultoria', 300000, 1800000, 'cancelado', 'prospeccao'],
    ];
    const clients = [];
    await upsertRows(clientDefinitions, async (item, index) => {
      const [companyName, contactName, contractedService, monthlyValue, totalContractValue, status, source] = item;
      const id = stableUuid(`client:${index + 1}`);
      const data = {
        organizationId,
        companyName,
        contactName,
        phone: `+244 923 000 10${index}`,
        email: `contacto${index + 1}@demo.kukugest.com`,
        contractedService,
        monthlyValue,
        totalContractValue,
        startDate: month(-index - 1),
        expectedEndDate: month(8 - index),
        contractDurationMonths: 12,
        commercialResponsibleId: profiles.get('commercial').id,
        operationalResponsibleId: index % 2 === 0 ? profiles.get('designer').id : profiles.get('editor').id,
        status,
        source,
        notes: 'Registo de demonstração Gestão e KPI.',
        cancellationDate: status === 'cancelado' ? day(-20) : null,
        cancellationReason: status === 'cancelado' ? 'Mudança de prioridade do cliente' : null,
        createdBy: adminProfileId,
      };
      const client = await tx.managementClient.upsert({ where: { id }, create: { id, ...data }, update: data });
      clients.push(client);
    });

    const campaignDefinitions = [
      ['Leads Q3', 'meta_ads', 'leads', -50, 500000, 180000, 115000, 5200, 160, 72, 28, 9, 3600000],
      ['Pesquisa Website', 'google_ads', 'vendas', -42, 380000, 90000, 64000, 4100, 110, 55, 21, 7, 2950000],
      ['Conteúdo Executivo', 'linkedin', 'reunioes', -35, 160000, 52000, 33000, 1900, 58, 30, 15, 4, 1500000],
      ['Open Day Luanda', 'evento', 'reconhecimento', -25, 220000, 30000, 24000, 860, 45, 24, 12, 3, 980000],
      ['Prospecção Estratégica', 'prospeccao', 'vendas', -18, 90000, 8500, 7200, 430, 32, 18, 10, 2, 760000],
    ];
    const campaigns = [];
    await upsertRows(campaignDefinitions, async (item, index) => {
      const [name, channel, objective, startOffset, investment, impressions, reach, clicks, leads, qualifiedLeads, meetingsGenerated, clientsWon, attributedRevenue] = item;
      const id = stableUuid(`campaign:${index + 1}`);
      const data = {
        organizationId,
        name,
        channel,
        objective,
        startDate: day(startOffset),
        endDate: index < 2 ? day(35) : day(index * 3),
        status: index < 2 ? 'ativa' : 'concluida',
        responsibleUserId: profiles.get('marketing').id,
        investment,
        impressions,
        reach,
        clicks,
        leads,
        qualifiedLeads,
        meetingsGenerated,
        clientsWon,
        attributedRevenue,
        notes: 'Campanha de demonstração com dados inseridos manualmente.',
        createdBy: adminProfileId,
      };
      const campaign = await tx.managementCampaign.upsert({ where: { id }, create: { id, ...data }, update: data });
      campaigns.push(campaign);
    });

    const stages = ['lead_recebido', 'primeiro_contacto', 'lead_qualificado', 'reuniao_agendada', 'reuniao_realizada', 'proposta_enviada', 'negociacao', 'ganho', 'perdido'];
    const probabilities = { lead_recebido: 10, primeiro_contacto: 15, lead_qualificado: 25, reuniao_agendada: 35, reuniao_realizada: 45, proposta_enviada: 60, negociacao: 80, ganho: 100, perdido: 0 };
    const opportunities = [];
    for (let index = 0; index < 15; index += 1) {
      const stage = stages[index % stages.length];
      const id = stableUuid(`opportunity:${index + 1}`);
      const closed = ['ganho', 'perdido'].includes(stage);
      const data = {
        organizationId,
        clientId: index < clients.length ? clients[index].id : null,
        campaignId: campaigns[index % campaigns.length].id,
        companyName: index < clients.length ? clients[index].companyName : `Empresa Potencial ${index + 1}`,
        contactName: `Contacto Comercial ${index + 1}`,
        phone: `+244 924 100 ${String(index).padStart(3, '0')}`,
        email: `oportunidade${index + 1}@demo.kukugest.com`,
        leadSource: campaigns[index % campaigns.length].channel,
        responsibleUserId: profiles.get('commercial').id,
        entryDate: day(-45 + index * 2),
        firstContactDate: stage === 'lead_recebido' ? null : day(-44 + index * 2),
        lastInteractionDate: day(-Math.max(1, 14 - index)),
        nextInteractionDate: closed ? null : day(index % 7 + 1),
        stage,
        estimatedValue: 450000 + index * 175000,
        closeProbability: probabilities[stage],
        meetingDate: stages.indexOf(stage) >= 3 ? day(-10 + index) : null,
        proposalDate: stages.indexOf(stage) >= 5 ? day(-5 + index) : null,
        expectedCloseDate: day(20 + index),
        actualCloseDate: closed ? day(-index) : null,
        result: stage === 'ganho' ? 'ganho' : stage === 'perdido' ? 'perdido' : null,
        lossReason: stage === 'perdido' ? 'Orçamento adiado' : null,
        notes: 'Oportunidade de demonstração.',
        stageChangedAt: day(-Math.max(1, 10 - index)),
        createdBy: profiles.get('commercial').id,
      };
      opportunities.push(await tx.managementOpportunity.upsert({ where: { id }, create: { id, ...data }, update: data }));
    }

    await setContext(tx, 'app.management_profile_id', profiles.get('commercial').id);
    await setContext(tx, 'app.management_role', 'commercial');
    await tx.managementOpportunityStageHistory.createMany({
      data: opportunities.map((opportunity, index) => ({
        id: stableUuid(`history:${index + 1}`),
        organizationId,
        opportunityId: opportunity.id,
        userId: profiles.get('commercial').id,
        previousStage: index % stages.length === 0 ? null : stages[Math.max(0, (index % stages.length) - 1)],
        newStage: opportunity.stage,
        notes: 'Etapa carregada pelo seed de demonstração.',
        changedAt: day(-Math.max(1, 10 - index)),
      })),
      skipDuplicates: true,
    });
    await setContext(tx, 'app.management_profile_id', adminProfileId);
    await setContext(tx, 'app.management_role', 'admin');

    const workTypes = ['flyer', 'carrossel', 'identidade_visual', 'apresentacao', 'website', 'video_curto', 'video_longo', 'reels', 'captacao', 'animacao'];
    const taskStatuses = ['concluido', 'concluido', 'aprovado', 'em_producao', 'revisao_interna', 'enviado_cliente', 'revisao_cliente', 'atrasado', 'pendente', 'concluido'];
    for (let index = 0; index < 20; index += 1) {
      const id = stableUuid(`task:${index + 1}`);
      const status = taskStatuses[index % taskStatuses.length];
      const isCompleted = status === 'concluido';
      const requestDate = day(-30 + index);
      const deadline = status === 'atrasado' ? day(-4 - (index % 3)) : day(-6 + index);
      const completionDate = isCompleted ? day(-8 + index) : null;
      const data = {
        organizationId,
        clientId: clients[index % clients.length].id,
        project: `Projeto ${1 + (index % 6)}`,
        workType: workTypes[index % workTypes.length],
        title: `Entrega criativa ${index + 1}`,
        description: 'Trabalho operacional de demonstração.',
        responsibleUserId: index % 2 === 0 ? profiles.get('designer').id : profiles.get('editor').id,
        requestDate,
        startDate: day(-28 + index),
        deadline,
        completionDate,
        priority: ['baixa', 'normal', 'alta', 'urgente'][index % 4],
        status,
        estimatedHours: 3 + (index % 8),
        actualHours: 2 + (index % 10),
        revisionCount: index % 4,
        deliveredOnTime: isCompleted ? completionDate <= deadline : null,
        clientApproved: ['aprovado', 'concluido'].includes(status),
        delayReason: status === 'atrasado' ? 'Feedback do cliente recebido depois do previsto' : null,
        notes: 'Dados de demonstração para operação.',
        createdBy: adminProfileId,
      };
      await tx.managementOperationalTask.upsert({ where: { id }, create: { id, ...data }, update: data });
    }

    const revenueCategories = ['mensalidade', 'projeto', 'website', 'gestao_marketing', 'producao_audiovisual'];
    const expenseCategories = ['salarios', 'freelancers', 'publicidade', 'software', 'producao'];
    for (let index = 0; index < 20; index += 1) {
      const id = stableUuid(`transaction:${index + 1}`);
      const isRevenue = index % 2 === 0;
      const settled = index % 4 !== 3;
      const expectedValue = isRevenue ? 280000 + index * 45000 : 90000 + index * 18000;
      const data = {
        organizationId,
        clientId: isRevenue ? clients[index % clients.length].id : index % 3 === 0 ? clients[index % clients.length].id : null,
        date: day(-55 + index * 3),
        type: isRevenue ? 'receita' : 'despesa',
        category: isRevenue ? revenueCategories[index % revenueCategories.length] : expenseCategories[index % expenseCategories.length],
        subcategory: null,
        project: `Projeto ${1 + (index % 6)}`,
        description: `${isRevenue ? 'Receita' : 'Despesa'} de demonstração ${index + 1}`,
        expectedValue,
        actualValue: settled ? expectedValue - (index % 3) * 10000 : null,
        dueDate: day(-20 + index * 2),
        paymentDate: settled ? day(-18 + index * 2) : null,
        status: settled ? (isRevenue ? 'recebido' : 'pago') : (index % 5 === 0 ? 'em_atraso' : 'pendente'),
        paymentMethod: settled ? (index % 2 === 0 ? 'transferencia' : 'multicaixa') : null,
        notes: 'Movimento financeiro de demonstração.',
        createdBy: adminProfileId,
      };
      await tx.managementFinancialTransaction.upsert({ where: { id }, create: { id, ...data }, update: data });
    }

    const current = new Date();
    const goalDefinitions = [
      ['empresa', 'revenueReceived', 4_500_000, 'kz'],
      ['financeiro', 'profit', 2_000_000, 'kz'],
      ['financeiro', 'profitMargin', 45, 'percentagem'],
      ['financeiro', 'mrr', 1_700_000, 'kz'],
      ['marketing', 'leads', 180, 'quantidade'],
      ['marketing', 'qualifiedLeads', 80, 'quantidade'],
      ['comercial', 'meetings', 15, 'quantidade'],
      ['comercial', 'won', 5, 'quantidade'],
      ['operacional', 'completedTasks', 12, 'quantidade'],
      ['operacional', 'onTimeRate', 90, 'percentagem'],
    ];
    for (let index = 0; index < goalDefinitions.length; index += 1) {
      const [area, kpi, targetValue, unit] = goalDefinitions[index];
      const id = stableUuid(`goal:${index + 1}`);
      const data = {
        organizationId,
        month: current.getUTCMonth() + 1,
        year: current.getUTCFullYear(),
        area,
        kpi,
        targetValue,
        actualValue: null,
        unit,
        responsibleUserId: area === 'marketing' ? profiles.get('marketing').id : area === 'comercial' ? profiles.get('commercial').id : null,
        notes: 'Meta mensal de demonstração.',
        calculatedAt: null,
        createdBy: adminProfileId,
      };
      await tx.managementGoal.upsert({ where: { id }, create: { id, ...data }, update: data });
    }

    await tx.managementActivityLog.createMany({
      data: [
        ['cliente_criado', 'clientes', clients[0].id, 'Cliente de demonstração criado.'],
        ['campanha_atualizada', 'marketing', campaigns[0].id, 'Campanha de demonstração atualizada.'],
        ['lead_criado', 'comercial', opportunities[0].id, 'Lead de demonstração criado.'],
        ['etapa_alterada', 'comercial', opportunities[6].id, 'Oportunidade movida para negociação.'],
      ].map(([actionType, module, relatedRecordId, description], index) => ({
        id: stableUuid(`activity:${index + 1}`),
        organizationId,
        userId: adminProfileId,
        actionType,
        module,
        relatedRecordId,
        description,
        metadata: { demo: true },
      })),
      skipDuplicates: true,
    });
  }, { timeout: 120_000 });

  console.log('Seed Gestão e KPI concluído: 5 utilizadores, 5 clientes, 5 campanhas, 15 oportunidades, 20 trabalhos, 20 movimentos e 10 metas.');
  console.log(`Login administrador: ${ownerDefinition.email}`);
}

main()
  .catch((error) => {
    console.error('Falha no seed Gestão e KPI:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
