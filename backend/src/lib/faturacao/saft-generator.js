const { create } = require('xmlbuilder2');
const prisma = require('../prisma');

/**
 * Gera ficheiro SAF-T (XML) para um período.
 * @param {number} userId
 * @param {string} periodo — formato "YYYY-MM"
 * @returns {Promise<string>} XML como string
 */
async function generateSAFT(userId, periodo) {
  const [year, month] = periodo.split('-');
  const startDate = new Date(`${year}-${month}-01T00:00:00.000Z`);
  const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59); // último dia do mês

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

  const nif = config?.nifEmpresa || process.env.NIF_EMPRESA || '';
  const companyName = config?.nomeEmpresa || process.env.COMPANY_NAME || '';

  const root = create({ version: '1.0', encoding: 'UTF-8' }).ele('AuditFile', {
    xmlns: 'urn:OECD:StandardAuditFile-Tax:AO_1.01_01',
  });

  // ---- Header ----
  const header = root.ele('Header');
  header.ele('AuditFileVersion').txt('1.01_01');
  header.ele('CompanyID').txt(nif);
  header.ele('TaxRegistrationNumber').txt(nif);
  header.ele('TaxAccountingBasis').txt('F');
  header.ele('CompanyName').txt(companyName);
  header.ele('FiscalYear').txt(year);
  header.ele('StartDate').txt(startDate.toISOString().split('T')[0]);
  header.ele('EndDate').txt(endDate.toISOString().split('T')[0]);
  header.ele('CurrencyCode').txt('AOA');
  header.ele('DateCreated').txt(new Date().toISOString().split('T')[0]);
  header.ele('ProductID').txt('ULU Gestão');
  header.ele('ProductVersion').txt('1.0.0');
  header.ele('SoftwareValidationNumber').txt(config?.agtCertNumber || 'PENDING');

  // ---- MasterFiles (clientes únicos do período) ----
  const masterFiles = root.ele('MasterFiles');
  const uniqueCustomers = [...new Map(facturas.map((f) => [f.customerTaxID, f])).values()];
  uniqueCustomers.forEach((f) => {
    const customer = masterFiles.ele('Customer');
    customer.ele('CustomerID').txt(f.customerTaxID);
    customer.ele('AccountID').txt('Desconhecido');
    customer.ele('CustomerTaxID').txt(f.customerTaxID);
    customer.ele('CompanyName').txt(f.customerName);
    const address = customer.ele('BillingAddress');
    address.ele('AddressDetail').txt(f.customerAddress || 'N/A');
    address.ele('City').txt('Luanda');
    address.ele('PostalCode').txt('0000');
    address.ele('Country').txt('AO');
    customer.ele('SelfBillingIndicator').txt('0');
  });

  // ---- SourceDocuments ----
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

    invoice.ele('Hash').txt(factura.jwsSignature || 'PLACEHOLDER');
    invoice.ele('HashControl').txt('1');
    invoice.ele('Period').txt(String(factura.documentDate.getMonth() + 1));
    invoice.ele('InvoiceDate').txt(factura.documentDate.toISOString().split('T')[0]);
    invoice.ele('InvoiceType').txt(factura.documentType);
    invoice.ele('SpecialRegimes').ele('SelfBillingIndicator').txt('0');
    invoice.ele('SourceID').txt('SISTEMA');
    invoice.ele('EACCode').txt('62010');
    invoice.ele('SystemEntryDate').txt(factura.createdAt.toISOString().replace('T', ' ').slice(0, 19));
    invoice.ele('CustomerID').txt(factura.customerTaxID);

    lines.forEach((line, idx) => {
      const lineElem = invoice.ele('Line');
      lineElem.ele('LineNumber').txt(String(idx + 1));
      lineElem.ele('ProductCode').txt(line.productCode || 'N/A');
      lineElem.ele('ProductDescription').txt(line.productDescription || 'N/A');
      lineElem.ele('Quantity').txt(String(line.quantity || 1));
      lineElem.ele('UnitOfMeasure').txt(line.unitOfMeasure || 'UN');
      lineElem.ele('UnitPrice').txt(String(line.unitPrice || 0));
      lineElem.ele('TaxPointDate').txt(factura.documentDate.toISOString().split('T')[0]);
      lineElem.ele('Description').txt(line.productDescription || 'N/A');

      const creditAmount = line.settlementAmount || (line.quantity * line.unitPrice) || 0;
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

  return root.end({ prettyPrint: true });
}

module.exports = { generateSAFT };
