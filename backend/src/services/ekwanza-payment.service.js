/**
 * Serviço de pagamentos E+ Kwanza (gateway AppyPay).
 *
 * Fluxo validado:
 *  1. Autenticação OAuth2 (client_credentials) no tenant de produção.
 *  2. POST /v2.0/charges para criar uma cobrança:
 *       - GPO  -> Multicaixa Express (envia pedido de aprovação ao telemóvel, síncrono ~60s)
 *       - REF  -> Referência EMIS (gera referência para pagamento posterior)
 *  3. Callback/webhook assíncrono confirma o pagamento (validado por HMAC-SHA256).
 *
 * Notas aprendidas em testes reais:
 *  - merchantTransactionId: máximo 15 caracteres, apenas alfanuméricos.
 *  - O token OAuth expira em ~3600s; é cacheado em memória.
 *  - GPO responde de forma síncrona com o resultado final da aprovação.
 */

const axios = require('axios');
const crypto = require('crypto');

const DEFAULT_TIMEOUT_MS = 90_000; // GPO espera a aprovação do cliente (até ~60s)
const TOKEN_SAFETY_WINDOW_MS = 60_000; // renova o token 60s antes de expirar

class EkwanzaPaymentError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'EkwanzaPaymentError';
    this.code = details.code || 'EKWANZA_REQUEST_FAILED';
    this.status = details.status || 500;
    this.gatewayCode = details.gatewayCode || null;
    this.data = details.data || null;
  }
}

// ---------------------------------------------------------------------------
// Configuração (via variáveis de ambiente)
// ---------------------------------------------------------------------------

function getConfig() {
  const cfg = {
    tokenUrl:
      process.env.EKWANZA_TOKEN_URL ||
      'https://login.microsoftonline.com/auth.appypay.co.ao/oauth2/token',
    baseUrl: (process.env.EKWANZA_BASE_URL || 'https://gwy-api.appypay.co.ao').replace(/\/+$/, ''),
    clientId: process.env.EKWANZA_CLIENT_ID,
    clientSecret: process.env.EKWANZA_CLIENT_SECRET,
    resource: process.env.EKWANZA_RESOURCE,
    merchantIdentifier: process.env.EKWANZA_MERCHANT_IDENTIFIER,
    apiKey: process.env.EKWANZA_API_KEY,
    paymentMethodGPO: process.env.EKWANZA_PAYMENT_METHOD_GPO, // GUID sem prefixo
    paymentMethodREF: process.env.EKWANZA_PAYMENT_METHOD_REF, // GUID sem prefixo
    notificationToken: process.env.EKWANZA_NOTIFICATION_TOKEN, // para validar callback
    merchantRegistrationNo: process.env.EKWANZA_MERCHANT_REGISTRATION_NO, // nº de conta/registo
  };
  return cfg;
}

function assertConfigured(fields) {
  const cfg = getConfig();
  const missing = fields.filter((f) => !cfg[f]);
  if (missing.length) {
    throw new EkwanzaPaymentError(
      `Configuração E+ Kwanza em falta: ${missing.join(', ')}`,
      { code: 'EKWANZA_NOT_CONFIGURED', status: 503 }
    );
  }
  return cfg;
}

// ---------------------------------------------------------------------------
// Autenticação (com cache em memória)
// ---------------------------------------------------------------------------

let cachedToken = null; // { accessToken, expiresAt }

async function getAccessToken({ forceRefresh = false } = {}) {
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.accessToken;
  }

  const cfg = assertConfigured(['clientId', 'clientSecret', 'resource']);

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    resource: cfg.resource,
  });

  try {
    const { data } = await axios.post(cfg.tokenUrl, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 20_000,
    });

    const expiresInMs = (Number(data.expires_in) || 3600) * 1000;
    cachedToken = {
      accessToken: data.access_token,
      expiresAt: Date.now() + expiresInMs - TOKEN_SAFETY_WINDOW_MS,
    };
    return cachedToken.accessToken;
  } catch (error) {
    const payload = error.response?.data || {};
    throw new EkwanzaPaymentError(
      payload.error_description || payload.error || 'Falha na autenticação E+ Kwanza',
      {
        code: payload.error || 'EKWANZA_AUTH_FAILED',
        status: error.response?.status || 500,
        data: payload,
      }
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Gera um merchantTransactionId válido: máximo 15 caracteres alfanuméricos.
 * Formato: <prefixo><base36(timestamp)> truncado a 15.
 */
function generateMerchantTransactionId(prefix = 'MZG') {
  const safePrefix = prefix.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5) || 'MZG';
  const stamp = Date.now().toString(36).toUpperCase();
  return `${safePrefix}${stamp}`.slice(0, 15);
}

function normalizeAoaPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  // Aceita 9XXXXXXXX (local) ou 244XXXXXXXXX (com indicativo)
  if (digits.length === 9) return `244${digits}`;
  if (digits.startsWith('244')) return digits;
  return digits;
}

// ---------------------------------------------------------------------------
// Criação de cobrança
// ---------------------------------------------------------------------------

/**
 * Cria uma cobrança no gateway.
 *
 * @param {Object} params
 * @param {number} params.amount            Valor (ex: 10)
 * @param {'GPO'|'REF'} params.method       Método de pagamento
 * @param {string} [params.description]     Descrição (opcional)
 * @param {string} [params.phoneNumber]     Telemóvel do cliente (obrigatório para GPO)
 * @param {string} [params.merchantTransactionId] Id único (gerado se omisso)
 * @param {string} [params.currency='AOA']
 * @returns {Promise<{ raw, successful, gatewayCode, message, providerTransactionId, reference, merchantTransactionId }>}
 */
async function createCharge(params) {
  const {
    amount,
    method,
    description = 'Pagamento',
    phoneNumber,
    currency = 'AOA',
  } = params;

  if (!amount || Number(amount) <= 0) {
    throw new EkwanzaPaymentError('Montante inválido', { code: 'INVALID_AMOUNT', status: 400 });
  }
  if (!['GPO', 'REF'].includes(method)) {
    throw new EkwanzaPaymentError('Método inválido (use GPO ou REF)', {
      code: 'INVALID_METHOD',
      status: 400,
    });
  }

  const cfg = assertConfigured(['merchantIdentifier', 'apiKey']);
  const methodGuid = method === 'GPO' ? cfg.paymentMethodGPO : cfg.paymentMethodREF;
  if (!methodGuid) {
    throw new EkwanzaPaymentError(`paymentMethod ${method} não configurado`, {
      code: 'EKWANZA_NOT_CONFIGURED',
      status: 503,
    });
  }

  const merchantTransactionId =
    params.merchantTransactionId || generateMerchantTransactionId();

  const payload = {
    amount: Number(amount),
    currency,
    description,
    merchantTransactionId,
    paymentMethod: `${method}_${methodGuid}`,
    options: {
      MerchantIdentifier: cfg.merchantIdentifier,
      ApiKey: cfg.apiKey,
    },
  };

  if (method === 'GPO') {
    const phone = normalizeAoaPhone(phoneNumber);
    if (!phone) {
      throw new EkwanzaPaymentError('Telemóvel obrigatório para Multicaixa Express (GPO)', {
        code: 'PHONE_REQUIRED',
        status: 400,
      });
    }
    payload.paymentInfo = { phoneNumber: phone };
  }

  const accessToken = await getAccessToken();

  let response;
  try {
    response = await axios.post(`${cfg.baseUrl}/v2.0/charges`, payload, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      timeout: DEFAULT_TIMEOUT_MS,
      // o gateway devolve 200 mesmo em falhas de negócio (responseStatus.successful=false)
      validateStatus: (s) => s >= 200 && s < 500,
    });
  } catch (error) {
    throw new EkwanzaPaymentError(error.message || 'Falha ao criar cobrança', {
      code: 'EKWANZA_CHARGE_FAILED',
      status: error.response?.status || 500,
      data: error.response?.data || null,
    });
  }

  const data = response.data || {};
  const rs = data.responseStatus || {};

  return {
    raw: data,
    merchantTransactionId,
    successful: rs.successful === true,
    gatewayCode: rs.code ?? null,
    status: rs.status || null,
    message: rs.message || null,
    providerTransactionId: data.gpo?.providerTransactionId || null,
    reference: data.reference || null,
  };
}

// ---------------------------------------------------------------------------
// Validação do callback (webhook)
// ---------------------------------------------------------------------------

/**
 * Valida a assinatura HMAC-SHA256 do callback nativo e-kwanza (/Ticket).
 * Concatena: code + operationCode + nº registo + token de notificação,
 * cifrado com a API Key. Comparação resistente a timing.
 */
function verifyCallbackSignature({ code, operationCode, signature }) {
  const cfg = getConfig();
  if (!cfg.apiKey || !cfg.notificationToken || !cfg.merchantRegistrationNo) {
    return false;
  }
  const base = `${code}${operationCode}${cfg.merchantRegistrationNo}${cfg.notificationToken}`;
  const expected = crypto
    .createHmac('sha256', cfg.apiKey)
    .update(base)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(String(signature || ''))
    );
  } catch {
    return false;
  }
}

module.exports = {
  EkwanzaPaymentError,
  getConfig,
  getAccessToken,
  generateMerchantTransactionId,
  normalizeAoaPhone,
  createCharge,
  verifyCallbackSignature,
};
