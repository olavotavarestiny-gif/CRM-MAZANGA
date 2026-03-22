/**
 * Valida os dados de uma factura antes de criar.
 */
function validateFactura(data) {
  const errors = [];

  if (!data.documentType) errors.push('Tipo de documento obrigatório');
  if (!data.serieId) errors.push('Série obrigatória');
  if (!data.estabelecimentoId) errors.push('Estabelecimento obrigatório');
  if (!data.customerTaxID?.trim()) errors.push('NIF do cliente obrigatório');
  if (!data.customerName?.trim()) errors.push('Nome do cliente obrigatório');
  if (!data.lines || !Array.isArray(data.lines) || data.lines.length === 0) {
    errors.push('Factura precisa ter pelo menos 1 linha');
  }

  const VALID_TYPES = ['FT', 'FR', 'ND', 'NC', 'FA'];
  if (data.documentType && !VALID_TYPES.includes(data.documentType)) {
    errors.push(`Tipo de documento inválido. Use: ${VALID_TYPES.join(', ')}`);
  }

  if (Array.isArray(data.lines)) {
    data.lines.forEach((line, idx) => {
      const n = idx + 1;
      if (!line.productCode?.trim()) errors.push(`Linha ${n}: Código de produto obrigatório`);
      if (!line.productDescription?.trim()) errors.push(`Linha ${n}: Descrição obrigatória`);
      if (!line.quantity || line.quantity <= 0) errors.push(`Linha ${n}: Quantidade inválida`);
      if (line.unitPrice === undefined || line.unitPrice < 0) errors.push(`Linha ${n}: Preço inválido`);
    });
  }

  if (data.netTotal !== undefined && data.netTotal < 0) errors.push('Total sem IVA inválido');
  if (data.grossTotal !== undefined && data.grossTotal < 0) errors.push('Total com IVA inválido');

  return { valid: errors.length === 0, errors };
}

module.exports = { validateFactura };
