const axios = require('axios');

const DEFAULT_TIMEOUT_MS = 20_000;

class ZiettApiError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ZiettApiError';
    this.code = details.code || 'ZIETT_REQUEST_FAILED';
    this.status = details.status || 500;
    this.traceId = details.traceId || null;
    this.fields = details.fields || null;
    this.data = details.data || null;
  }
}

function getBaseUrl() {
  return (process.env.ZIETT_BASE_URL || 'https://api.ziett.co').replace(/\/+$/, '');
}

function getApiKey() {
  const apiKey = process.env.ZIETT_API_KEY;
  if (!apiKey) {
    throw new ZiettApiError('ZIETT_API_KEY não configurada', {
      code: 'ZIETT_NOT_CONFIGURED',
      status: 503,
    });
  }
  return apiKey;
}

function buildClient() {
  return axios.create({
    baseURL: `${getBaseUrl()}/c/v1`,
    timeout: DEFAULT_TIMEOUT_MS,
    headers: {
      'X-API-KEY': getApiKey(),
      'Content-Type': 'application/json',
    },
  });
}

function normalizeZiettError(error) {
  if (error instanceof ZiettApiError) {
    return error;
  }

  const payload = error.response?.data || {};
  const message = payload.message || error.message || 'Falha ao comunicar com a Ziett';

  return new ZiettApiError(message, {
    code: payload.code || 'ZIETT_REQUEST_FAILED',
    status: payload.status || error.response?.status || 500,
    traceId: payload.trace_id || payload.traceId || null,
    fields: payload.fields || null,
    data: payload,
  });
}

function compactQuery(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
}

async function request(config) {
  const client = buildClient();

  try {
    const response = await client.request(config);
    return response.data;
  } catch (error) {
    throw normalizeZiettError(error);
  }
}

async function sendSingleMessage(payload) {
  return request({
    method: 'POST',
    url: '/messages',
    data: payload,
  });
}

async function sendBatchCampaign(payload) {
  return request({
    method: 'POST',
    url: '/campaigns/batch',
    data: payload,
  });
}

async function listCampaigns(params) {
  return request({
    method: 'GET',
    url: '/campaigns',
    params: compactQuery(params),
  });
}

async function getCampaignById(campaignId) {
  return request({
    method: 'GET',
    url: `/campaigns/${campaignId}`,
  });
}

async function listMessages(params) {
  return request({
    method: 'GET',
    url: '/messages',
    params: compactQuery(params),
  });
}

async function getMessageById(messageId) {
  return request({
    method: 'GET',
    url: `/messages/${messageId}`,
  });
}

module.exports = {
  ZiettApiError,
  normalizeZiettError,
  sendSingleMessage,
  sendBatchCampaign,
  listCampaigns,
  getCampaignById,
  listMessages,
  getMessageById,
};
