const express = require('express');
const messagingService = require('../services/messaging-admin.service');

const router = express.Router();

function handleRouteError(res, error) {
  const formatted = messagingService.formatMessagingError(error);
  return res.status(formatted.status).json(formatted.body);
}

router.post('/campaigns/validate', async (req, res) => {
  try {
    const result = await messagingService.validateBatchCampaign(req.body);
    return res.json(result);
  } catch (error) {
    return handleRouteError(res, error);
  }
});

router.post('/campaigns/send', async (req, res) => {
  try {
    const result = await messagingService.sendBatchCampaign(req.user, req.body);
    return res.status(201).json(result);
  } catch (error) {
    return handleRouteError(res, error);
  }
});

router.get('/campaigns', async (req, res) => {
  try {
    const result = await messagingService.listCampaigns(req.query);
    return res.json(result);
  } catch (error) {
    return handleRouteError(res, error);
  }
});

router.get('/campaigns/:id', async (req, res) => {
  try {
    const result = await messagingService.getCampaignDetail(req.params.id, req.query);
    return res.json(result);
  } catch (error) {
    return handleRouteError(res, error);
  }
});

router.post('/campaigns/:id/sync', async (req, res) => {
  try {
    const result = await messagingService.syncCampaign(req.user, req.params.id);
    return res.json(result);
  } catch (error) {
    return handleRouteError(res, error);
  }
});

router.get('/messages', async (req, res) => {
  try {
    const result = await messagingService.listMessages(req.query);
    return res.json(result);
  } catch (error) {
    return handleRouteError(res, error);
  }
});

router.get('/messages/:id', async (req, res) => {
  try {
    const result = await messagingService.getMessageDetail(req.params.id);
    return res.json(result);
  } catch (error) {
    return handleRouteError(res, error);
  }
});

router.post('/messages/:id/sync', async (req, res) => {
  try {
    const result = await messagingService.syncMessage(req.user, req.params.id);
    return res.json(result);
  } catch (error) {
    return handleRouteError(res, error);
  }
});

router.post('/test/send-single', async (req, res) => {
  try {
    const result = await messagingService.sendSingleTestMessage(req.user, req.body);
    return res.status(201).json(result);
  } catch (error) {
    return handleRouteError(res, error);
  }
});

module.exports = router;
