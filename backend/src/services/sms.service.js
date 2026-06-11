const ziettService = require('./ziett.service');
const { normalizePhoneToE164 } = require('../lib/phone-normalization');

/**
 * Serviço central de SMS da KukuGest.
 *
 * Primitivo fino e reutilizável por cima de `ziett.service.js` (o provider) e de
 * `phone-normalization.js`. NÃO duplica a chamada ao provider e NÃO altera os
 * fluxos existentes de mensagens para contactos (messaging-admin.service.js).
 *
 * Pensado para o SMS interno da plataforma (comunicação com utilizadores), mas
 * genérico o suficiente para reutilização futura.
 *
 * Nota sobre o remetente: a Ziett não usa nome legível — usa `remitter_id`
 * (UUID v7). O parâmetro `senderName` é tratado como override opcional desse
 * remitter, com fallback para `ZIETT_DEFAULT_REMITTER_ID` (remetente padrão KukuGest).
 */

function isSmsEnabled() {
  return String(process.env.ZIETT_ENABLE || '').trim().toLowerCase() === 'true';
}

function getDefaultRemitterId() {
  const value = process.env.ZIETT_DEFAULT_REMITTER_ID;
  return value && String(value).trim() ? String(value).trim() : null;
}

function getDefaultChannel() {
  return process.env.ZIETT_DEFAULT_CHANNEL || 'SMS';
}

function getDefaultCountry() {
  return process.env.ZIETT_DEFAULT_COUNTRY || 'AO';
}

function getTestAllowedRecipients() {
  return String(process.env.ZIETT_TEST_ALLOWED_RECIPIENTS || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildFailure(errorCode, errorMessage, extra = {}) {
  return {
    success: false,
    status: 'failed',
    phoneNormalized: extra.phoneNormalized ?? null,
    providerMessageId: null,
    providerStatus: null,
    errorCode,
    errorMessage,
    raw: extra.raw ?? null,
  };
}

/**
 * Envia um único SMS de forma padronizada. Nunca lança — devolve sempre um
 * objeto de resultado para que a operação principal (campanha/automação) decida
 * o que fazer.
 *
 * @param {Object}  params
 * @param {string}  params.phone        Número (formato local AO ou E.164).
 * @param {string}  params.message      Conteúdo do SMS.
 * @param {string} [params.senderName]  Override opcional do remitter_id (default: ZIETT_DEFAULT_REMITTER_ID).
 * @param {Object} [params.metadata]    Contexto adicional (ex.: { countryAlpha2 }).
 * @param {boolean}[params.isTest]      Se true, aplica a allowlist de teste.
 * @returns {Promise<{ success:boolean, status:string, phoneNormalized:string|null,
 *                      providerMessageId:string|null, providerStatus:string|null,
 *                      errorCode:string|null, errorMessage:string|null, raw:any }>}
 */
async function sendSms({ phone, message, senderName, metadata = {}, isTest = false } = {}) {
  const country = (metadata && metadata.countryAlpha2) || getDefaultCountry();
  const phoneNormalized = normalizePhoneToE164(phone, country);

  // Validação de conteúdo
  if (!message || !String(message).trim()) {
    return buildFailure('INVALID_MESSAGE', 'A mensagem está vazia.', { phoneNormalized });
  }

  // Validação de telefone
  if (!phoneNormalized) {
    return buildFailure('INVALID_PHONE', 'O número não está num formato SMS válido para Angola.', {
      phoneNormalized: null,
    });
  }

  // Remetente padrão KukuGest (ou override)
  const remitterId = (senderName && String(senderName).trim()) || getDefaultRemitterId();
  if (!remitterId) {
    return buildFailure('NO_REMITTER', 'Remetente padrão não configurado (ZIETT_DEFAULT_REMITTER_ID).', {
      phoneNormalized,
    });
  }

  // Limite de segurança: kill-switch global
  if (!isSmsEnabled()) {
    return buildFailure('SMS_DISABLED', 'Envio de SMS desativado (ZIETT_ENABLE).', { phoneNormalized });
  }

  // Limite de segurança: allowlist em modo de teste
  if (isTest) {
    const allowlist = getTestAllowedRecipients();
    if (allowlist.length > 0 && !allowlist.includes(phoneNormalized)) {
      return buildFailure('NOT_IN_TEST_ALLOWLIST', 'O número não faz parte da allowlist de teste.', {
        phoneNormalized,
      });
    }
  }

  const payload = {
    remitter_id: remitterId,
    channel_type: getDefaultChannel(),
    target_e164: phoneNormalized,
    content: String(message),
  };

  try {
    const response = await ziettService.sendSingleMessage(payload);
    return {
      success: true,
      status: response?.status || 'sent',
      phoneNormalized,
      providerMessageId: response?.message_id || response?.id || null,
      providerStatus: response?.status || null,
      errorCode: null,
      errorMessage: null,
      raw: response ?? null,
    };
  } catch (error) {
    return buildFailure(
      error?.code || 'ZIETT_REQUEST_FAILED',
      error?.message || 'Falha ao enviar SMS.',
      { phoneNormalized, raw: error?.data || null }
    );
  }
}

module.exports = {
  sendSms,
  isSmsEnabled,
  getDefaultRemitterId,
};
