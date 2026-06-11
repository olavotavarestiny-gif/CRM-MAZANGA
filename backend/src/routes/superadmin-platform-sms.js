const express = require('express');
const platformSms = require('../services/platform-sms.service');

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

// Histórico de SMS internos
router.get('/messages', async (req, res) => {
  try {
    return res.json(await platformSms.listMessages(req.query));
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

module.exports = router;
