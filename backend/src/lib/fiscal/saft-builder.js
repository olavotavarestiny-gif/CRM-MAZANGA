/**
 * SAF-T Angola Builder — KukuGest
 *
 * Gera ficheiro SAF-T AO (Standard Audit File for Tax — Angola)
 * conforme especificação AGT versão 1.01_01.
 *
 * Diferenças face ao saft-generator.js original:
 *  - Validação de completude antes de gerar (função `validateSaftReadiness`)
 *  - Hash dos documentos via hashCode (não jwsSignature)
 *  - ProductID corrigido para 'KukuGest'
 *  - Secção Products em MasterFiles (anteriormente ausente)
 *  - taxCode 'RED' (5%) suportado
 *  - Totais de débito/crédito calculados correctamente
 */

'use strict';

const { create } = require('xmlbuilder2');
const prisma = require('../prisma');

/**
 * Valida se os dados estão completos para gerar um SAF-T válido.
 * Retorna lista de erros. Lista vazia = pronto para gerar.
 *
 * @param {number} userId
 * @param {string} periodo — "YYYY-MM"
 * @returns {Promise<string[]>} lista de erros
 */
async function validateSaftReadiness(userId, periodo) {
  const errors = [];
  const [year, month] = periodo.split('-').map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  // Verificar configuração da empresa
  const config = await prisma.configuracaoFaturacao.findUnique({ where: { userId } });
  if (!config) {
    errors.push('Configuração de faturação não encontrada. Configure a empresa em Vendas > Configurações.');
    return errors; // sem config, resto dos checks não faz sentido
  }
  if (!config.nifEmpresa?.trim()) errors.push('NIF da empresa não configurado (obrigatório para SAF-T).');
  if (!config.nomeEmpresa?.trim()) errors.push('Nome da empresa não configurado (obrigatório para SAF-T).');
  if (!config.moradaEmpresa?.trim()) errors.push('Morada da empresa não configurada (obrigatório para SAF-T).');

  // Verificar faturas do período
  const facturas = await prisma.factura.findMany({
    where: { userId, documentDate: { gte: startDate, lte: endDate }, documentStatus: 'N' },
    select: {
      id: true, documentNo: true, customerTaxID: true, customerName: true,
      lines: true, hashCode: true, grossTotal: true,
    },
  });

  if (facturas.length === 0) {
    errors.push(`Nenhuma fatura activa encontrada para o período ${periodo}.`);
    return errors;
  }

  let docsWithoutHash = 0;
  let docsWithInvalidCustomer = 0;
  let linesWithoutProductType = 0;

  facturas.forEach((f) => {
    if (!f.hashCode) docsWithoutHash++;
    if (!f.customerTaxID?.trim() || f.customerTaxID === 'UNKNOWN') docsWithInvalidCustomer++;

    const lines = typeof f.lines === 'string' ? JSON.parse(f.lines) : f.lines;
    (lines || []).forEach((line) => {
      if (!line.productCode?.trim()) linesWithoutProductType++;
    });
  });

  if (docsWithoutHash > 0) {
    errors.push(`${docsWithoutHash} fatura(s) sem hash de integridade. As faturas recentes terão hash automático; as antigas precisam de ser recalculadas.`);
  }
  if (docsWithInvalidCustomer > 0) {
    errors.push(`${docsWithInvalidCustomer} fatura(s) com NIF de cliente em falta ou inválido.`);
  }
  if (linesWithoutProductType > 0) {
    errors.push(`${linesWithoutProductType} linha(s) sem código de produto. Verifique o catálogo de produtos.`);
  }

  return errors;
}

/**
 * Gera o ficheiro SAF-T AO em XML.
 *
 * @param {number} userId
 * @param {string} periodo — "YYYY-MM"
 * @returns {Promise<{ xml: string, totalFacturas: number, warnings: string[] }>}
 */
async function buildSAFT(userId, periodo) {
  const [year, month] = periodo.split('-');
  const startDate = new Date(`${year}-${month}-01T00:00:00.000Z`);
  const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59);

  const facturas = await prisma.factura.findMany({
    where: {
      userId,
      documentDate: { gte: startDate, lte: endDate },
      documentStatus: 'N',
    },
    include: { serie: true, estabelecimento: true },
    orderBy: { documentDate: 'asc' },
  });

  const config = await prisma.configuracaoFaturacao.findUnique({ where: { userId } });

  const nif = config?.nifEmpresa || '';
  const companyName = config?.nomeEmpresa || '';
  const companyAddress = config?.moradaEmpresa || '';
  const certNumber = config?.agtCertNumber || 'PENDING';

  const warnings = [];

  // ── Root ──────────────────────────────────────────────────────────────
  const root = create({ version: '1.0', encoding: 'UTF-8' }).ele('AuditFile', {
    xmlns: 'urn:OECD:StandardAuditFile-Tax:AO_1.01_01',
  });

  // ── Header ────────────────────────────────────────────────────────────
  const header = root.ele('Header');
  header.ele('AuditFileVersion').txt('1.01_01');
  header.ele('CompanyID').txt(nif);
  header.ele('TaxRegistrationNumber').txt(nif);
  header.ele('TaxAccountingBasis').txt('F');
  header.ele('CompanyName').txt(companyName);
  const addr = header.ele('CompanyAddress');
  addr.ele('AddressDetail').txt(companyAddress || 'N/D');
  addr.ele('City').txt(config?.municipio || 'Luanda');
  addr.ele('PostalCode').txt('0000');
  addr.ele('Country').txt('AO');
  header.ele('FiscalYear').txt(year);
  header.ele('StartDate').txt(startDate.toISOString().split('T')[0]);
  header.ele('EndDate').txt(endDate.toISOString().split('T')[0]);
  header.ele('CurrencyCode').txt('AOA');
  header.ele('DateCreated').txt(new Date().toISOString().split('T')[0]);
  header.ele('ProductID').txt('KukuGest');
  header.ele('ProductVersion').txt('1.0.0');
  header.ele('SoftwareValidationNumber').txt(certNumber);
  header.ele('HeaderComment').txt(`Gerado por KukuGest — Período ${periodo}`);

  // ── MasterFiles ───────────────────────────────────────────────────────
  const masterFiles = root.ele('MasterFiles');

  // Clientes únicos do período
  const uniqueCustomers = [...new Map(facturas.map((f) => [f.customerTaxID, f])).values()];
  uniqueCustomers.forEach((f) => {
    if (!f.customerTaxID?.trim()) {
      warnings.push(`Fatura ${f.documentNo}: cliente sem NIF — omitido de MasterFiles.`);
      return;
    }
    const customer = masterFiles.ele('Customer');
    customer.ele('CustomerID').txt(f.customerTaxID);
    customer.ele('AccountID').txt('Desconhecido');
    customer.ele('CustomerTaxID').txt(f.customerTaxID);
    customer.ele('CompanyName').txt(f.customerName || 'N/D');
    const billingAddress = customer.ele('BillingAddress');
    billingAddress.ele('AddressDetail').txt(f.customerAddress || 'N/D');
    billingAddress.ele('City').txt('Luanda');
    billingAddress.ele('PostalCode').txt('0000');
    billingAddress.ele('Country').txt('AO');
    customer.ele('SelfBillingIndicator').txt('0');
  });

  // Produtos únicos do período (campo Products obrigatório em SAF-T AO)
  const allLines = facturas.flatMap((f) => {
    const lines = typeof f.lines === 'string' ? JSON.parse(f.lines) : f.lines;
    return (lines || []).map((l) => ({ ...l, documentType: f.documentType }));
  });
  const uniqueProducts = [...new Map(allLines.map((l) => [l.productCode, l])).values()];
  uniqueProducts.forEach((line) => {
    if (!line.productCode?.trim()) return;
    const product = masterFiles.ele('Product');
    product.ele('ProductType').txt(line.productType || 'S'); // S=serviço, P=produto
    product.ele('ProductCode').txt(line.productCode);
    product.ele('ProductGroup').txt(line.productGroup || 'GERAL');
    product.ele('ProductDescription').txt(line.productDescription || line.productCode);
    product.ele('ProductNumberCode').txt(line.productCode);
  });

  // ── SourceDocuments ───────────────────────────────────────────────────
  const sourceDocuments = root.ele('SourceDocuments');
  const salesInvoices = sourceDocuments.ele('SalesInvoices');
  salesInvoices.ele('NumberOfEntries').txt(String(facturas.length));

  let totalDebit = 0;
  let totalCredit = 0;

  facturas.forEach((factura) => {
    const lines = typeof factura.lines === 'string' ? JSON.parse(factura.lines) : factura.lines;

    const invoice = salesInvoices.ele('Invoice');
    invoice.ele('InvoiceNo').txt(factura.documentNo);

    const docStatus = invoice.ele('DocumentStatus');
    docStatus.ele('InvoiceStatus').txt(factura.documentStatus === 'A' ? 'A' : 'N');
    docStatus.ele('InvoiceStatusDate').txt(factura.documentDate.toISOString().split('T')[0]);
    docStatus.ele('SourceID').txt('SISTEMA');
    docStatus.ele('SourceBilling').txt('P');

    // Hash de integridade: usar hashCode (não jwsSignature que é o token AGT)
    const hashValue = factura.hashCode || 'PENDING';
    if (!factura.hashCode) {
      warnings.push(`Fatura ${factura.documentNo}: hash em falta — marcada como PENDING no SAF-T.`);
    }
    invoice.ele('Hash').txt(hashValue);
    invoice.ele('HashControl').txt(factura.hashControl || '1');

    invoice.ele('Period').txt(String(factura.documentDate.getMonth() + 1));
    invoice.ele('InvoiceDate').txt(factura.documentDate.toISOString().split('T')[0]);
    invoice.ele('InvoiceType').txt(factura.documentType);
    invoice.ele('SpecialRegimes').ele('SelfBillingIndicator').txt('0');
    invoice.ele('SourceID').txt('SISTEMA');
    invoice.ele('EACCode').txt('62010');
    invoice.ele('SystemEntryDate').txt(factura.createdAt.toISOString().replace('T', ' ').slice(0, 19));
    invoice.ele('CustomerID').txt(factura.customerTaxID || 'UNKNOWN');

    (lines || []).forEach((line, idx) => {
      const lineElem = invoice.ele('Line');
      lineElem.ele('LineNumber').txt(String(idx + 1));
      lineElem.ele('ProductCode').txt(line.productCode || 'N/D');
      lineElem.ele('ProductDescription').txt(line.productDescription || 'N/D');
      lineElem.ele('Quantity').txt(String(line.quantity || 1));
      lineElem.ele('UnitOfMeasure').txt(line.unitOfMeasure || 'UN');
      lineElem.ele('UnitPrice').txt(String((line.unitPrice || 0).toFixed(2)));
      lineElem.ele('TaxPointDate').txt(factura.documentDate.toISOString().split('T')[0]);
      lineElem.ele('Description').txt(line.productDescription || 'N/D');

      const creditAmount = line.settlementAmount ?? (line.quantity * line.unitPrice) ?? 0;
      lineElem.ele('CreditAmount').txt(creditAmount.toFixed(2));
      totalCredit += creditAmount;

      if (line.taxes && line.taxes.length > 0) {
        line.taxes.forEach((tax) => {
          const taxElem = lineElem.ele('Tax');
          taxElem.ele('TaxType').txt(tax.taxType || 'IVA');
          taxElem.ele('TaxCountryRegion').txt('AO');
          taxElem.ele('TaxCode').txt(tax.taxCode || 'NOR');
          taxElem.ele('TaxPercentage').txt(String(tax.taxPercentage ?? 14));
        });
      }

      lineElem.ele('SettlementAmount').txt(creditAmount.toFixed(2));
    });

    const totals = invoice.ele('DocumentTotals');
    totals.ele('TaxPayable').txt(factura.taxPayable.toFixed(2));
    totals.ele('NetTotal').txt(factura.netTotal.toFixed(2));
    totals.ele('GrossTotal').txt(factura.grossTotal.toFixed(2));
  });

  salesInvoices.ele('TotalDebit').txt(totalDebit.toFixed(2));
  salesInvoices.ele('TotalCredit').txt(totalCredit.toFixed(2));

  return {
    xml: root.end({ prettyPrint: true }),
    totalFacturas: facturas.length,
    warnings,
  };
}

module.exports = { buildSAFT, validateSaftReadiness };
