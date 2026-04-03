'use strict';

function cleanNumericValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).replace(/[^\d]/g, '');
}

/**
 * Permissive NIF validation:
 * accepts any non-empty numeric sequence after removing spaces and punctuation.
 */
function validateNIF(nif) {
  if (nif === null || nif === undefined || String(nif).trim() === '') {
    return { valid: false, reason: 'NIF em falta' };
  }

  const cleaned = cleanNumericValue(nif);
  if (!cleaned) {
    return { valid: false, reason: 'NIF deve conter pelo menos um dígito numérico' };
  }

  return { valid: true };
}

function isValidNIF(nif) {
  return validateNIF(nif).valid;
}

/**
 * Kept for compatibility with older code paths, but no longer blocks values.
 */
function looksLikePhone() {
  return false;
}

module.exports = { validateNIF, isValidNIF, looksLikePhone, cleanNumericValue };
