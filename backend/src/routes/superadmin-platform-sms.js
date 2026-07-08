const express = require('express');
const platformSms = require('../services/platform-sms.service');
const platformAutomation = require('../services/platform-automation.service');

const router = express.Router();

function handleRouteError(res, error) {
  const formatted = platformSms.formatError(error);
  return res.status(formatted.status).json(formatted.body);
}

// Segmentos disponíveis (para o seletor da UI)
router.get('/segments', (req, res) => {
  res.json({ segments: platformSms.listSegments() });
});

// Pré-visualizar destinatários de um segmento antes de enviar
router.post('/campaigns/preview', async (req, res) => {
  try {
    return res.json(await platformSms.previewCampaign(req.body));
  } catch (error) {
    return handleRouteError(res, error);
  }
});

// Criar e enviar campanha interna
router.post('/campaigns', async (req, res) => {
  try {
    return res.status(201).json(await platformSms.createAndSendCampaign(req.user, req.body));
  } catch (error) {
    return handleRouteError(res, error);
  }
});

// Listar campanhas
router.get('/campaigns', async (req, res) => {
  try {
    return res.json(await platformSms.listCampaigns(req.query));
  } catch (error) {
    return handleRouteError(res, error);
  }
});

// Detalhe de campanha + mensagens
router.get('/campaigns/:id', async (req, res) => {
  try {
    return res.json(await platformSms.getCampaignDetail(req.params.id, req.query));
  } catch (error) {
    return handleRouteError(res, error);
  }
});

// Sincronizar estados das mensagens de uma campanha interna
router.post('/campaigns/:id/sync', async (req, res) => {
  try {
    return res.json(await platformSms.syncCampaign(req.user, req.params.id));
  } catch (error) {
    return handleRouteError(res, error);
  }
});

// Histórico de SMS internos
router.get('/messages', async (req, res) => {
  try {
    return res.json(await platformSms.listMessages(req.query));
  } catch (error) {
    return handleRouteError(res, error);
  }
});

// Sincronizar uma mensagem interna pelo providerMessageId
router.post('/messages/:id/sync', async (req, res) => {
  try {
    return res.json(await platformSms.syncMessage(req.user, req.params.id));
  } catch (error) {
    return handleRouteError(res, error);
  }
});

// Estatísticas
router.get('/stats', async (req, res) => {
  try {
    return res.json(await platformSms.getStats());
  } catch (error) {
    return handleRouteError(res, error);
  }
});

// ── Automações internas ───────────────────────────────────────────────

// Listar automações (garante as 8 defaults)
router.get('/automations', async (req, res) => {
  try {
    return res.json({ rules: await platformAutomation.listRules() });
  } catch (error) {
    return handleRouteError(res, error);
  }
});

// Editar / ativar / desativar automação
router.patch('/automations/:id', async (req, res) => {
  try {
    return res.json(await platformAutomation.updateRule(req.params.id, req.body));
  } catch (error) {
    return handleRouteError(res, error);
  }
});

// Correr automação manualmente. Body: { dryRun?, isTest? } (isTest default true = só allowlist)
router.post('/automations/:id/run', async (req, res) => {
  try {
    const dryRun = Boolean(req.body?.dryRun);
    const isTest = req.body?.isTest === undefined ? true : Boolean(req.body.isTest);
    const result = await platformAutomation.runRuleById(req.params.id, { dryRun, isTest, actorUserId: req.user?.id || null });
    return res.json(result);
  } catch (error) {
    return handleRouteError(res, error);
  }
});

// Logs recentes de uma automação
router.get('/automations/:id/logs', async (req, res) => {
  try {
    return res.json(await platformAutomation.listRuleLogs(req.params.id, req.query));
  } catch (error) {
    return handleRouteError(res, error);
  }
});

module.exports = router;
