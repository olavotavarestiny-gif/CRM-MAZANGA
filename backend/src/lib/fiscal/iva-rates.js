/**
 * Taxas de IVA Angola (conforme legislação AGT)
 * Referência: Código do Imposto sobre o Valor Acrescentado (CIVA) Angola
 */

'use strict';

const IVA_RATES = {
  /** IVA Normal — taxa padrão para a maioria dos bens e serviços */
  NOR: { code: 'NOR', rate: 14, label: 'IVA Normal 14%' },
  /** IVA Reduzido — bens de primeira necessidade, saúde, educação */
  RED: { code: 'RED', rate: 5,  label: 'IVA Reduzido 5%' },
  /** Isento — operações isentas por lei */
  ISE: { code: 'ISE', rate: 0,  label: 'Isento 0%' },
  /** Taxa Zero — exportações e operações equiparadas */
  OUT: { code: 'OUT', rate: 0,  label: 'Taxa Zero 0%' },
};

/** Percentagens válidas (para validação server-side) */
const VALID_PERCENTAGES = new Set([0, 5, 14]);

/** Mapeia percentagem → código AGT */
const PERCENTAGE_TO_CODE = {
  14: 'NOR',
  5:  'RED',
  0:  'ISE',
};

/**
 * Devolve o código AGT correcto para uma dada percentagem de IVA.
 * @param {number} percentage
 * @param {boolean} [isIsento=false] - Se true, usa 'ISE'; se false e percentage=0, usa 'OUT'
 * @returns {string} código AGT
 */
function getTaxCode(percentage, isIsento = true) {
  if (percentage === 14) return 'NOR';
  if (percentage === 5)  return 'RED';
  if (percentage === 0)  return isIsento ? 'ISE' : 'OUT';
  return 'NOR'; // fallback seguro
}

/**
 * Valida se uma percentagem de IVA é válida para Angola.
 * @param {number} percentage
 * @returns {boolean}
 */
function isValidRate(percentage) {
  return VALID_PERCENTAGES.has(Number(percentage));
}

module.exports = { IVA_RATES, VALID_PERCENTAGES, PERCENTAGE_TO_CODE, getTaxCode, isValidRate };
