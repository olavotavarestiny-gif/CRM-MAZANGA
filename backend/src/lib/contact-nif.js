'use strict';

const { validateNIF } = require('./fiscal/nif-validator');

const NIF_CUSTOM_FIELD_KEYS = new Set([
  'nif',
  'taxid',
  'tax_id',
  'taxnumber',
  'tax_number',
  'numerofiscal',
  'numero_fiscal',
  'numerodeidentificacaofiscal',
  'numero_de_identificacao_fiscal',
  'numeroidentificacaofiscal',
  'numero_identificacao_fiscal',
]);

function normaliseFieldKey(key) {
  return String(key || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function parseCustomFields(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw;
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function cleanNifValue(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function extractNifFromCustomFields(rawCustomFields) {
  const customFields = parseCustomFields(rawCustomFields);

  for (const [key, value] of Object.entries(customFields)) {
    if (!NIF_CUSTOM_FIELD_KEYS.has(normaliseFieldKey(key))) {
      continue;
    }

    const resolved = cleanNifValue(value);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

function stripNifKeysFromCustomFields(rawCustomFields) {
  const customFields = parseCustomFields(rawCustomFields);
  const cleaned = {};

  for (const [key, value] of Object.entries(customFields)) {
    if (NIF_CUSTOM_FIELD_KEYS.has(normaliseFieldKey(key))) {
      continue;
    }

    cleaned[key] = value;
  }

  return cleaned;
}

function resolveContactNif(contact) {
  return cleanNifValue(contact?.nif) || extractNifFromCustomFields(contact?.customFields);
}

function getPersistableContactNif(contact) {
  const nif = resolveContactNif(contact);
  if (!nif) {
    return null;
  }

  return validateNIF(nif).valid ? nif : null;
}

module.exports = {
  cleanNifValue,
  extractNifFromCustomFields,
  getPersistableContactNif,
  parseCustomFields,
  resolveContactNif,
  stripNifKeysFromCustomFields,
};
