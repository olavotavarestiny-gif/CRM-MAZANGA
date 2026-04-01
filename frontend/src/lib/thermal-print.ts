import type { Factura } from '@/lib/types';
import type { FaturacaoConfig } from '@/lib/types';

// ─── Formatters ────────────────────────────────────────────────────────────────

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

// ─── Label maps ────────────────────────────────────────────────────────────────

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

// ─── Types ─────────────────────────────────────────────────────────────────────

type LineItem = {
  productCode: string;
  productDescription: string;
  quantity: number;
  unitPrice: number;
  taxes?: Array<{ taxPercentage: number; taxAmount?: number }>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FacturaWithRelations = Factura & { estabelecimento?: any; user?: any };

export type ThermalWidth = 58 | 80;

// ─── CSS ───────────────────────────────────────────────────────────────────────
// Critical rules for thermal printing:
//   @page margin: 0  → the printer driver controls physical margins, not the browser
//   body width in mm  → forces the browser to lay out at thermal paper width
//   font-size in pt   → more reliable than px across thermal driver rendering engines
//   no wide tables    → items rendered as vertical blocks to avoid horizontal overflow

function buildCss(width: ThermalWidth): string {
  const w = `${width}mm`;
  // Inner content padding (keeps text away from paper edge)
  const pad = width === 58 ? '2mm' : '3mm';
  // Normal body font: 8pt ≈ readable on térmica; headers 10pt
  return `
    @page {
      size: ${w} auto;
      margin: 0;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html, body {
      width: ${w};
      max-width: ${w};
      margin: 0 auto;
      padding: ${pad};
      font-family: 'Courier New', Courier, monospace;
      font-size: 8pt;
      line-height: 1.35;
      color: #000;
      background: #fff;
    }

    /* ── Utilities ── */
    .c  { text-align: center; }
    .r  { text-align: right; }
    .b  { font-weight: bold; }
    .sm { font-size: 7pt; }
    .lg { font-size: 11pt; }
    .xl { font-size: 13pt; }

    /* ── Separators ── */
    .sep-dash  { border: none; border-top: 1px dashed #000; margin: 1.5mm 0; }
    .sep-solid { border: none; border-top: 1px solid  #000; margin: 1.5mm 0; }
    .sep-space { height: 1mm; }

    /* ── Header block ── */
    .header { margin-bottom: 1mm; }

    /* ── Item block (vertical layout — avoids wide tables) ── */
    .item { margin: 1mm 0; }
    .item-name { font-size: 8pt; word-break: break-word; }
    .item-code { font-size: 7pt; color: #444; }
    .item-calc {
      display: flex;
      justify-content: space-between;
      font-size: 8pt;
    }

    /* ── Totals rows (flex rows, no tables) ── */
    .row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-size: 8pt;
      margin: 0.5mm 0;
    }
    .row-total {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-size: 11pt;
      font-weight: bold;
      margin: 1mm 0 0.5mm;
      padding-top: 1mm;
      border-top: 1px solid #000;
    }

    /* ── QR code ── */
    .qr-wrap { text-align: center; margin: 2mm 0 1mm; }
    .qr-wrap img {
      width: ${width === 58 ? '22mm' : '28mm'};
      height: ${width === 58 ? '22mm' : '28mm'};
      display: block;
      margin: 0 auto 1mm;
    }

    /* ── Footer ── */
    .footer { font-size: 7pt; text-align: center; margin-top: 1mm; }

    /* ── Print overrides ── */
    @media print {
      html, body {
        width: 100%;
        padding: 0;
      }
      .no-print { display: none !important; }
      /* Prevent page breaks inside critical blocks */
      .item, .row, .row-total, .qr-wrap { page-break-inside: avoid; }
    }

    /* ── Screen preview button ── */
    .print-btn {
      display: block;
      width: 100%;
      margin-top: 4mm;
      padding: 2mm;
      background: #000;
      color: #fff;
      border: none;
      font-family: inherit;
      font-size: 9pt;
      cursor: pointer;
      text-align: center;
    }
  `;
}

// ─── HTML builder ──────────────────────────────────────────────────────────────

function buildReciboHtml(
  factura: FacturaWithRelations,
  config: FaturacaoConfig,
  width: ThermalWidth,
): string {
  const rawLines = factura.lines as unknown;
  const lines: LineItem[] =
    typeof rawLines === 'string' ? JSON.parse(rawLines) : (rawLines as LineItem[]);

  const dt      = fmtDateTime(factura.documentDate || factura.createdAt);
  const docLabel = DOC_LABELS[factura.documentType] ?? factura.documentType;
  const rawMethod = factura.paymentMethod ?? '';
  const payLabel  = PAY_LABELS[rawMethod] ?? (rawMethod || 'Numerário');
  const isConsumidorFinal = !factura.customerTaxID || factura.customerTaxID === '000000000';

  const telefone          = factura.estabelecimento?.telefone ?? '';
  const estabelecimentoNome = factura.estabelecimento?.nome ?? '';
  const operatorName      = factura.user?.name ?? '';

  // ── Items HTML (vertical layout — one block per item) ──────────────────────
  const itemsHtml = lines.map((l) => {
    const lineTotal = l.quantity * l.unitPrice;
    return `<div class="item">
  <div class="item-name b">${escHtml(l.productDescription)}</div>
  <div class="item-code">${escHtml(l.productCode)}</div>
  <div class="item-calc">
    <span>${l.quantity} × ${fmtKz(l.unitPrice)}</span>
    <span class="b">${fmtKz(lineTotal)}</span>
  </div>
</div>`;
  }).join('<hr class="sep-dash"/>');

  // ── Tax summary rows ────────────────────────────────────────────────────────
  const taxMap: Record<number, number> = {};
  for (const l of lines) {
    const pct      = l.taxes?.[0]?.taxPercentage ?? 14;
    const lineTotal = l.quantity * l.unitPrice;
    // IVA already included in unitPrice
    const taxAmt   = lineTotal - lineTotal / (1 + pct / 100);
    taxMap[pct]    = (taxMap[pct] ?? 0) + taxAmt;
  }
  const taxRowsHtml = Object.entries(taxMap)
    .map(([pct, amt]) => `<div class="row"><span>IVA ${pct}%</span><span>${fmtKz(amt)}</span></div>`)
    .join('');

  // ── Customer block ──────────────────────────────────────────────────────────
  const clienteHtml = !isConsumidorFinal
    ? `<hr class="sep-dash"/>
<div class="sm">Cliente: ${escHtml(factura.customerName)}</div>
<div class="sm">NIF: ${escHtml(factura.customerTaxID)}</div>
${factura.customerAddress ? `<div class="sm">${escHtml(factura.customerAddress)}</div>` : ''}`
    : '';

  // ── Currency note ───────────────────────────────────────────────────────────
  const cambioHtml = (factura.currencyCode && factura.currencyCode !== 'AOA')
    ? `<div class="sm">Câmbio: ${escHtml(factura.currencyCode)} ${factura.exchangeRate}</div>`
    : '';

  // ── QR code ─────────────────────────────────────────────────────────────────
  const qrHtml = factura.qrCodeImage
    ? `<hr class="sep-dash"/>
<div class="qr-wrap">
  <img src="${factura.qrCodeImage}" alt="QR AGT"/>
  <div class="sm">Verificar em portal AGT</div>
</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${escHtml(docLabel)} ${escHtml(factura.documentNo)}</title>
<style>${buildCss(width)}</style>
</head>
<body>

<!-- ── CABEÇALHO EMPRESA ─────────────────────────────────────────── -->
<div class="header">
  <div class="c b xl">${escHtml(config.nomeEmpresa || 'KukuGest')}</div>
  ${config.nifEmpresa    ? `<div class="c sm">NIF: ${escHtml(config.nifEmpresa)}</div>` : ''}
  ${config.moradaEmpresa ? `<div class="c sm">${escHtml(config.moradaEmpresa)}</div>` : ''}
  ${telefone             ? `<div class="c sm">Tel: ${escHtml(telefone)}</div>` : ''}
</div>

<hr class="sep-dash"/>

<!-- ── TIPO E NÚMERO DO DOCUMENTO ────────────────────────────────── -->
<div class="c b lg">${escHtml(docLabel)}</div>
<div class="c b">${escHtml(factura.documentNo)}</div>
<div class="c sm">${escHtml(dt.date)} ${escHtml(dt.time)}</div>

<hr class="sep-dash"/>

<!-- ── PONTO DE VENDA / OPERADOR ─────────────────────────────────── -->
${estabelecimentoNome ? `<div class="sm">PV: ${escHtml(estabelecimentoNome)}</div>` : ''}
${operatorName        ? `<div class="sm">Op: ${escHtml(operatorName)}</div>` : ''}

<!-- ── CLIENTE (só se não for Consumidor Final) ───────────────────── -->
${clienteHtml}

<hr class="sep-dash"/>

<!-- ── ARTIGOS (layout vertical) ─────────────────────────────────── -->
${itemsHtml}

<hr class="sep-solid"/>

<!-- ── TOTAIS ────────────────────────────────────────────────────── -->
<div class="row"><span>Subtotal (s/IVA)</span><span>${fmtKz(factura.netTotal)}</span></div>
${taxRowsHtml}
<div class="row-total"><span>TOTAL A PAGAR</span><span>${fmtKz(factura.grossTotal)}</span></div>

<hr class="sep-solid"/>

<!-- ── PAGAMENTO ─────────────────────────────────────────────────── -->
<div class="row"><span>Pagamento</span><span class="b">${escHtml(payLabel)}</span></div>
${cambioHtml}

<!-- ── QR CODE ───────────────────────────────────────────────────── -->
${qrHtml}

<hr class="sep-dash"/>

<!-- ── RODAPÉ ────────────────────────────────────────────────────── -->
<div class="footer">Processado por KukuGest</div>
${config.nifEmpresa ? `<div class="footer">${escHtml(factura.documentNo)} · ${escHtml(dt.date)}</div>` : ''}
<div class="sep-space"></div>

<!-- ── BOTÃO IMPRIMIR (escondido ao imprimir) ────────────────────── -->
<button class="print-btn no-print" onclick="window.print()">Imprimir</button>

</body>
</html>`;
}

// ─── Escape helper ─────────────────────────────────────────────────────────────

function escHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Abre uma janela de impressão térmica com o recibo da venda.
 *
 * @param factura       - Documento fiscal emitido
 * @param config        - Configuração da empresa (nome, NIF, morada)
 * @param width         - Largura do papel: 80 (padrão) ou 58mm
 *
 * @returns `true` se a janela abriu com sucesso, `false` se popups bloqueados.
 */
export function printThermalRecibo(
  factura: Factura,
  config: FaturacaoConfig,
  width: ThermalWidth = 80,
): boolean {
  const html = buildReciboHtml(factura as FacturaWithRelations, config, width);

  // Window dimensions: slightly wider than paper for screen preview
  const winW = width === 58 ? 340 : 420;
  const win  = window.open('', '_blank', `width=${winW},height=720,scrollbars=yes`);
  if (!win) return false;

  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();

  // Close window automatically after print dialog is dismissed
  win.onafterprint = () => win.close();

  // Delay ensures base64 QR image is fully decoded before print rasterisation
  setTimeout(() => win.print(), 400);

  return true;
}
