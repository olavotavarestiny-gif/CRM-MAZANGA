/**
 * Validação de NIF Angolano (Número de Identificação Fiscal)
 * Formato: 10 dígitos
 *   - Pessoas singulares: começa em 1
 *   - Empresas / pessoas colectivas: começa em 5
 *   - Dígito verificador: posição 10 (módulo 11)
 */

'use strict';

const NIF_REGEX = /^\d{10}$/;

/**
 * Pesos usados no cálculo do dígito verificador AGT.
 * Aplicados da esquerda para a direita sobre os 9 primeiros dígitos.
 */
const WEIGHTS = [9, 8, 7, 6, 5, 4, 3, 2];

/**
 * Calcula o dígito verificador esperado para os 9 primeiros dígitos de um NIF.
 * @param {string} nineDigits - Primeiros 9 dígitos do NIF
 * @returns {number} dígito verificador (0-9) ou -1 se inválido (resto 10)
 */
function computeCheckDigit(nineDigits) {
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(nineDigits[i], 10) * WEIGHTS[i];
  }
  const remainder = sum % 11;
  if (remainder === 0) return 0;
  if (remainder === 1) return -1; // NIF inválido — resto 1 não tem dígito verificador válido
  return 11 - remainder;
}

/**
 * Valida um NIF angolano.
 * @param {string|null|undefined} nif
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateNIF(nif) {
  if (!nif || typeof nif !== 'string') {
    return { valid: false, reason: 'NIF em falta' };
  }

  const cleaned = nif.replace(/[\s\-\.]/g, '');

  if (!NIF_REGEX.test(cleaned)) {
    return { valid: false, reason: 'NIF deve ter exactamente 10 dígitos numéricos' };
  }

  const firstDigit = cleaned[0];
  if (firstDigit !== '1' && firstDigit !== '5') {
    return { valid: false, reason: 'NIF deve começar em 1 (pessoa singular) ou 5 (pessoa colectiva)' };
  }

  const checkDigit = computeCheckDigit(cleaned.slice(0, 9));
  if (checkDigit === -1) {
    return { valid: false, reason: 'NIF inválido (dígito verificador incalculável)' };
  }

  const provided = parseInt(cleaned[9], 10);
  if (provided !== checkDigit) {
    return { valid: false, reason: `NIF inválido (dígito verificador incorrecto: esperado ${checkDigit}, recebido ${provided})` };
  }

  return { valid: true };
}

/**
 * Retorna true se o NIF for válido, false caso contrário.
 * Conveniente para usar em condições simples.
 * @param {string|null|undefined} nif
 * @returns {boolean}
 */
function isValidNIF(nif) {
  return validateNIF(nif).valid;
}

/**
 * Detecta se uma string parece ser um número de telefone angolano
 * em vez de um NIF — para rejeitar fallbacks indevidos.
 * Padrões comuns: 9XX XXX XXX (começa em 9), +244..., 244...
 * @param {string} value
 * @returns {boolean}
 */
function looksLikePhone(value) {
  if (!value) return false;
  const cleaned = value.replace(/[\s\-\+\.]/g, '');
  // Número angolano móvel: começa em 9 com 9 dígitos, ou 244 + 9 dígitos, ou +244...
  return (
    /^9\d{8}$/.test(cleaned) ||       // 9XXXXXXXX (9 dígitos, começa em 9)
    /^244\d{9}$/.test(cleaned) ||      // 244 + 9 dígitos
    /^\+?244/.test(value.trim())       // prefixo internacional
  );
}

module.exports = { validateNIF, isValidNIF, looksLikePhone };
