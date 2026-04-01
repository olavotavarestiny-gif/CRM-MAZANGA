import type { Factura } from '@/lib/types';
import type { FaturacaoConfig } from '@/lib/types';

function fmtKz(v: number): string {
  return v.toLocaleString('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Kz';
}

function fmtDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('pt-AO'),
    time: d.toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' }),
  };
}

const DOC_LABELS: Record<string, string> = {
  FT: 'FACTURA',
  FR: 'FACTURA-RECIBO',
  FA: 'FACT. SIMPLIFICADA',
  ND: 'NOTA DE DÉBITO',
  NC: 'NOTA DE CRÉDITO',
  PF: 'PROFORMA',
};

const PAY_LABELS: Record<string, string> = {
  CASH: 'Numerário',
  Numerário: 'Numerário',
  MULTICAIXA: 'Multicaixa',
  Multicaixa: 'Multicaixa',
  TPA: 'TPA',
  'Transferência Bancária': 'Transf. Bancária',
};

type LineItem = {
  productCode: string;
  productDescription: string;
  quantity: number;
  unitPrice: number;
  taxes?: Array<{ taxPercentage: number; taxAmount?: number }>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FacturaWithRelations = Factura & { estabelecimento?: any; user?: any };

function buildReciboHtml(factura: FacturaWithRelations, config: FaturacaoConfig): string {
  const rawLines = factura.lines as unknown;
  const lines: LineItem[] =
    typeof rawLines === 'string' ? JSON.parse(rawLines) : (rawLines as LineItem[]);

  const dt = fmtDateTime(factura.documentDate || factura.createdAt);
  const docLabel = DOC_LABELS[factura.documentType] ?? factura.documentType;
  const payLabel = PAY_LABELS[factura.paymentMethod] ?? factura.paymentMethod;
  const isConsumidorFinal = !factura.customerTaxID || factura.customerTaxID === '000000000';

  const itemsHtml = lines
    .map(
      (l) => `
    <tr>
      <td class="desc">${escHtml(l.productDescription)}<br/><span class="small grey">${escHtml(l.productCode)}</span></td>
      <td class="qty">${l.quantity}</td>
      <td class="right">${fmtKz(l.unitPrice)}</td>
      <td class="right">${fmtKz(l.quantity * l.unitPrice)}</td>
    </tr>`,
    )
    .join('');

  // Group tax lines by percentage
  const taxMap: Record<number, number> = {};
  for (const l of lines) {
    const pct = l.taxes?.[0]?.taxPercentage ?? 14;
    const lineTotal = l.quantity * l.unitPrice;
    // Tax is already included in unitPrice (IVA incluído)
    const taxAmt = lineTotal - lineTotal / (1 + pct / 100);
    taxMap[pct] = (taxMap[pct] ?? 0) + taxAmt;
  }
  const taxLinesHtml = Object.entries(taxMap)
    .map(([pct, amt]) => `<tr><td>IVA ${pct}%</td><td class="right">${fmtKz(amt)}</td></tr>`)
    .join('');

  const telefone = factura.estabelecimento?.telefone ?? '';
  const estabelecimentoNome = factura.estabelecimento?.nome ?? '';
  const operatorName = factura.user?.name ?? '';

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8"/>
<title>${escHtml(docLabel)} ${escHtml(factura.documentNo)}</title>
<style>
  @page {
    size: 80mm auto;
    margin: 4mm 3mm;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 10px;
    line-height: 1.5;
    color: #000;
    background: #fff;
    width: 74mm;
  }
  .center  { text-align: center; }
  .right   { text-align: right; }
  .bold    { font-weight: bold; }
  .large   { font-size: 13px; }
  .small   { font-size: 8px; }
  .grey    { color: #444; }
  .dash    { border-top: 1px dashed #000; margin: 2.5mm 0; }
  .solid   { border-top: 1px solid #000; margin: 2.5mm 0; }
  table    { width: 100%; border-collapse: collapse; }
  th       { font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 1mm; font-size: 9px; }
  td       { padding: 0.6mm 0; vertical-align: top; }
  .desc    { width: 50%; }
  .qty     { width: 8%; text-align: center; }
  .totals td { padding: 0.5mm 0; }
  .totals .grand td {
    font-weight: bold;
    font-size: 12px;
    border-top: 1px solid #000;
    padding-top: 1.5mm;
  }
  .qr-wrap { text-align: center; margin: 3mm 0; }
  .qr-wrap img { width: 28mm; height: 28mm; }
  @media print { body { width: 100%; } }
</style>
</head>
<body>

<!-- Cabeçalho empresa -->
<div class="center bold large">${escHtml(config.nomeEmpresa || 'KukuGest')}</div>
${config.nifEmpresa ? `<div class="center small">NIF: ${escHtml(config.nifEmpresa)}</div>` : ''}
${config.moradaEmpresa ? `<div class="center small">${escHtml(config.moradaEmpresa)}</div>` : ''}
${telefone ? `<div class="center small">Tel: ${escHtml(telefone)}</div>` : ''}

<div class="dash"></div>

<!-- Tipo e número do documento -->
<div class="center bold large">${escHtml(docLabel)}</div>
<div class="center bold">${escHtml(factura.documentNo)}</div>
<div class="center small">${escHtml(dt.date)} ${escHtml(dt.time)}</div>

<div class="dash"></div>

<!-- Ponto de venda e operador -->
${estabelecimentoNome ? `<div class="small">PV: ${escHtml(estabelecimentoNome)}</div>` : ''}
${operatorName ? `<div class="small">Op: ${escHtml(operatorName)}</div>` : ''}

${
  !isConsumidorFinal
    ? `
<div class="dash"></div>
<div class="small">Cliente: ${escHtml(factura.customerName)}</div>
<div class="small">NIF: ${escHtml(factura.customerTaxID)}</div>
${factura.customerAddress ? `<div class="small">${escHtml(factura.customerAddress)}</div>` : ''}
`
    : ''
}

<div class="dash"></div>

<!-- Tabela de artigos -->
<table>
  <thead>
    <tr>
      <th class="desc">Artigo</th>
      <th class="qty">Qty</th>
      <th style="text-align:right;width:21%">P.Unit</th>
      <th style="text-align:right;width:21%">Total</th>
    </tr>
  </thead>
  <tbody>${itemsHtml}</tbody>
</table>

<div class="solid"></div>

<!-- Totais -->
<table class="totals">
  <tr><td>Subtotal (s/IVA)</td><td class="right">${fmtKz(factura.netTotal)}</td></tr>
  ${taxLinesHtml}
  <tr class="grand"><td>TOTAL A PAGAR</td><td class="right">${fmtKz(factura.grossTotal)}</td></tr>
</table>

<div class="solid"></div>

<!-- Pagamento -->
<div class="small">Pagamento: <strong>${escHtml(payLabel)}</strong></div>
${
  factura.currencyCode && factura.currencyCode !== 'AOA'
    ? `<div class="small">Câmbio: ${escHtml(factura.currencyCode)} ${factura.exchangeRate}</div>`
    : ''
}

${
  factura.qrCodeImage
    ? `
<div class="dash"></div>
<div class="qr-wrap">
  <img src="${factura.qrCodeImage}" alt="QR AGT"/>
  <div class="small">Verificar em portal AGT</div>
</div>`
    : ''
}

<div class="dash"></div>
<div class="center small">Processado por KukuGest${config.nifEmpresa ? ' · ' + escHtml(config.nifEmpresa) : ''}</div>
<div class="center small">${escHtml(factura.documentNo)} · ${escHtml(dt.date)}</div>

</body>
</html>`;
}

function escHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Abre uma janela de impressão térmica (80mm) com o recibo da venda.
 * Retorna `true` se a janela foi aberta com sucesso, `false` se popups estiverem bloqueados.
 */
export function printThermalRecibo(factura: Factura, config: FaturacaoConfig): boolean {
  const html = buildReciboHtml(factura as FacturaWithRelations, config);
  const win = window.open('', '_blank', 'width=420,height=720,scrollbars=yes');
  if (!win) return false;

  win.document.write(html);
  win.document.close();
  win.focus();
  win.onafterprint = () => win.close();

  // Pequeno delay para garantir que as imagens (QR code base64) carregam antes de imprimir
  setTimeout(() => win.print(), 300);
  return true;
}
