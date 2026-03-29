/**
 * Cadeia de Hash AGT — KukuGest
 *
 * Angola SAF-T (AO 1.01_01) exige que cada documento tenha um hash
 * calculado a partir dos seus dados + hash do documento anterior da mesma série.
 *
 * Especificação AGT (adaptado de SAF-T PT para Angola):
 *   Campos: InvoiceDate + SystemEntryDate + InvoiceNo + GrossTotal + PreviousHash
 *   Algoritmo completo: SHA1 → assinar com RSA-2048 PKCS#1 + chave privada certificada AGT → Base64
 *
 * MODO ACTUAL (desenvolvimento/mock):
 *   Usa SHA256 sem assinatura RSA.
 *   Quando o certificado AGT estiver disponível, substituir `computeHash` por
 *   `computeHashWithRSA(fields, privateKeyPem)` que assina com a chave privada da empresa.
 *
 * O campo `hashControl` indica:
 *   "1" → primeiro documento da série (sem documento anterior)
 *   "0" → documento encadeado com anterior
 */

'use strict';

const crypto = require('crypto');

/**
 * Formata um Date para o formato usado no hash AGT: "YYYY-MM-DD"
 * @param {Date|string} date
 * @returns {string}
 */
function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().split('T')[0];
}

/**
 * Formata grossTotal para string com 2 casas decimais e ponto decimal.
 * @param {number} grossTotal
 * @returns {string}
 */
function formatAmount(grossTotal) {
  return Number(grossTotal).toFixed(2);
}

/**
 * Calcula o hash de um documento (modo SHA256 — desenvolvimento).
 * Substitua por RSA quando o certificado AGT estiver disponível.
 *
 * @param {object} params
 * @param {Date|string}  params.invoiceDate       — data do documento
 * @param {Date|string}  params.systemEntryDate   — data de criação no sistema
 * @param {string}       params.invoiceNo          — número do documento (ex: "FT 2026/1")
 * @param {number}       params.grossTotal         — total com IVA
 * @param {string|null}  params.previousHash       — hash do documento anterior na série, ou null
 * @returns {string} hash em Base64
 */
function computeHash({ invoiceDate, systemEntryDate, invoiceNo, grossTotal, previousHash }) {
  const fields = [
    formatDate(invoiceDate),
    formatDate(systemEntryDate),
    invoiceNo,
    formatAmount(grossTotal),
    previousHash || '',
  ].join(';');

  return crypto.createHash('sha256').update(fields, 'utf8').digest('base64');
}

/**
 * Obtém o hash do documento anterior na mesma série do mesmo utilizador.
 * Se não existir documento anterior, retorna null.
 *
 * @param {object} prisma — cliente Prisma
 * @param {number} userId
 * @param {string} serieId
 * @param {string} currentDocumentId — ID do documento actual (para excluir)
 * @returns {Promise<string|null>}
 */
async function getPreviousHash(prisma, userId, serieId, currentDocumentId) {
  const previous = await prisma.factura.findFirst({
    where: {
      userId,
      serieId,
      documentStatus: 'N',
      NOT: { id: currentDocumentId },
    },
    orderBy: { createdAt: 'desc' },
    select: { hashCode: true },
  });
  return previous?.hashCode ?? null;
}

/**
 * Computa e devolve o hash e hashControl para um novo documento.
 * Consulta a base de dados para obter o hash anterior da série.
 *
 * @param {object} prisma
 * @param {object} params
 * @param {number}       params.userId
 * @param {string}       params.serieId
 * @param {string}       params.invoiceNo
 * @param {Date}         params.invoiceDate
 * @param {Date}         params.systemEntryDate
 * @param {number}       params.grossTotal
 * @returns {Promise<{ hashCode: string, hashControl: string }>}
 */
async function computeDocumentHash(prisma, { userId, serieId, invoiceNo, invoiceDate, systemEntryDate, grossTotal }) {
  const previousHash = await getPreviousHash(prisma, userId, serieId, '__new__');
  const hashCode = computeHash({ invoiceDate, systemEntryDate, invoiceNo, grossTotal, previousHash });
  const hashControl = previousHash ? '0' : '1';
  return { hashCode, hashControl };
}

module.exports = { computeHash, computeDocumentHash, getPreviousHash, formatDate, formatAmount };
