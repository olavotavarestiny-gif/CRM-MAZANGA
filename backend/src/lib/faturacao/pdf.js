'use strict';

const PDFDocument = require('pdfkit');
const path = require('path');
const {
  DISPLAY_MODES,
  resolveBaseCurrency,
  resolveDisplayCurrency,
  resolveStoredDisplayMode,
} = require('./currency');

const FONT_BASE = path.join(__dirname, '..', '..', '..', 'node_modules', '@expo-google-fonts', 'inter');
const FONT_REGULAR = path.join(FONT_BASE, '400Regular', 'Inter_400Regular.ttf');
const FONT_MEDIUM = path.join(FONT_BASE, '500Medium', 'Inter_500Medium.ttf');
const FONT_SEMIBOLD = path.join(FONT_BASE, '600SemiBold', 'Inter_600SemiBold.ttf');
const FONT_BOLD = path.join(FONT_BASE, '700Bold', 'Inter_700Bold.ttf');

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 42;
const CONTENT_W = PAGE_W - (MARGIN * 2);
const PAGE_FOOTER_RULE_Y = PAGE_H - MARGIN - 20;
const PAGE_FOOTER_TEXT_Y = PAGE_FOOTER_RULE_Y + 6;
const LEGAL_FOOTER_RULE_Y = PAGE_H - MARGIN - 44;
const LEGAL_FOOTER_TEXT_Y = LEGAL_FOOTER_RULE_Y + 6;

const COLORS = {
  ink: '#0F172A',
  primary: '#0A2540',
  accent: '#2563EB',
  accentSoft: '#EFF6FF',
  muted: '#64748B',
  mutedLight: '#94A3B8',
  line: '#E2E8F0',
  panel: '#F8FAFC',
  white: '#FFFFFF',
  green: '#047857',
  greenSoft: '#ECFDF5',
  amber: '#B45309',
  amberSoft: '#FFFBEB',
  red: '#B91C1C',
  redSoft: '#FEF2F2',
};

function fmtNum(n, decimals = 2) {
  if (!Number.isFinite(Number(n))) return '0,00';
  return Number(n).toLocaleString('pt-PT', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtAmount(n, currency = 'AOA') {
  const code = (currency || 'AOA').toUpperCase();
  if (code === 'AOA') return `${fmtNum(n)} Kz`;
  const symbol = {
    USD: 'USD',
    EUR: 'EUR',
    GBP: 'GBP',
    CHF: 'CHF',
    CNY: 'CNY',
  }[code] || code;

  return `${symbol} ${fmtNum(n)}`;
}

function fmtDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function fmtDateTime(date) {
  if (!date) return '—';
  return new Date(date).toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function measureTextHeight(doc, text, width, font = 'R', size = 8.5) {
  doc.font(font).fontSize(size);
  return doc.heightOfString(text || '', { width });
}

function docTypeLabel(type) {
  return {
    FT: 'Factura',
    FR: 'Factura-Recibo',
    ND: 'Nota de Débito',
    NC: 'Nota de Crédito',
    FA: 'Factura Simplificada',
    PF: 'Proforma',
  }[type] || type;
}

function agtStatusLabel(status) {
  return {
    P: 'Pendente AGT',
    V: 'Válida',
    I: 'Inválida',
    A: 'Anulada',
    NA: 'Não fiscal',
  }[status] || status;
}

function statusLabel(status) {
  return {
    N: 'Normal',
    A: 'Anulada',
  }[status] || status;
}

function statusTone(status) {
  if (status === 'A') return { fill: COLORS.redSoft, text: COLORS.red };
  return { fill: COLORS.panel, text: COLORS.primary };
}

function isSupportedImage(url) {
  if (!url || !url.startsWith('data:image')) return false;
  const mime = url.split(';')[0].replace('data:', '').toLowerCase();
  return ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(mime);
}

function isValidImageBuffer(buf, mimeType) {
  if (!buf || buf.length < 12) return false;
  if (mimeType === 'image/png') return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
  if (mimeType === 'image/webp') return buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP';
  return false;
}

function parseImage(url) {
  if (!isSupportedImage(url)) return null;
  try {
    const mime = url.split(';')[0].replace('data:', '').toLowerCase();
    const commaIndex = url.indexOf(',');
    const buf = Buffer.from(url.slice(commaIndex + 1), 'base64');
    return isValidImageBuffer(buf, mime) ? buf : null;
  } catch {
    return null;
  }
}

function parseIbans(config) {
  try {
    if (!config.iban) return [];
    const parsed = JSON.parse(config.iban);
    if (Array.isArray(parsed)) return parsed.filter((entry) => entry?.iban);
  } catch {
    if (config.iban) return [{ label: 'Principal', iban: config.iban }];
  }

  return config.iban ? [{ label: 'Principal', iban: config.iban }] : [];
}

function companyInitials(name) {
  if (!name) return 'KG';
  const letters = String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
  return letters || 'KG';
}

function buildModel(factura, config) {
  const displayCurrency = resolveDisplayCurrency(factura);
  const baseCurrency = resolveBaseCurrency(factura);
  const displayMode = resolveStoredDisplayMode(factura);
  const showBaseReference = (
    displayCurrency !== baseCurrency &&
    displayMode === DISPLAY_MODES.DOCUMENT_PLUS_INTERNAL &&
    Number(factura.exchangeRate || 0) > 0
  );
  const isProforma = factura.documentType === 'PF';
  const issuerName = config.nomeEmpresa?.trim() || factura.estabelecimento?.nome || 'Empresa';
  const issuerTaxId = config.nifEmpresa?.trim() || factura.estabelecimento?.nif || '—';
  const issuerAddress = config.moradaEmpresa?.trim() || factura.estabelecimento?.morada || '';
  const issuerPhone = config.telefoneEmpresa?.trim() || factura.estabelecimento?.telefone || '';
  const issuerEmail = config.emailEmpresa?.trim() || factura.estabelecimento?.email || '';
  const issuerWebsite = config.websiteEmpresa?.trim() || '';
  const customerIsFinal = !factura.customerTaxID || factura.customerTaxID === '000000000';
  const customerName = factura.customerName || 'Consumidor Final';
  const customerTaxId = customerIsFinal ? 'Consumidor Final' : factura.customerTaxID;
  const customerAddress = factura.customerAddress || factura.clienteFaturacao?.customerAddress || '';
  const customerPhone = factura.clienteFaturacao?.customerPhone || '';
  const customerEmail = factura.clienteFaturacao?.customerEmail || '';
  const logoBuffer = parseImage(config.logoUrl);
  const ibans = parseIbans(config);
  const lines = Array.isArray(factura.lines) ? factura.lines : JSON.parse(factura.lines || '[]');
  const supportRows = [
    { label: 'Pagamento', value: factura.paymentMethod || '—' },
    { label: 'Moeda do documento', value: displayCurrency },
  ];

  if (displayCurrency !== baseCurrency) {
    supportRows.push({ label: 'Moeda base interna', value: baseCurrency });
    supportRows.push({
      label: 'Taxa usada',
      value: factura.exchangeRate
        ? `1 ${displayCurrency} = ${fmtAmount(factura.exchangeRate, baseCurrency)}`
        : '—',
    });
    supportRows.push({
      label: 'Data da taxa',
      value: factura.exchangeRateDate ? fmtDateTime(factura.exchangeRateDate) : '—',
    });
  }

  ibans.forEach((entry) => {
    supportRows.push({
      label: entry.label || 'IBAN',
      value: entry.iban,
    });
  });

  if (factura.documentCancelReason) {
    supportRows.push({
      label: 'Motivo de anulação',
      value: factura.documentCancelReason,
    });
  }

  return {
    invoice: factura,
    lines,
    displayCurrency,
    baseCurrency,
    displayMode,
    showBaseReference,
    isProforma,
    logoBuffer,
    ibans,
    issuer: {
      name: issuerName,
      taxId: issuerTaxId,
      address: issuerAddress,
      phone: issuerPhone,
      email: issuerEmail,
      website: issuerWebsite,
    },
    customer: {
      name: customerName,
      taxId: customerTaxId,
      address: customerAddress,
      phone: customerPhone,
      email: customerEmail,
    },
    supportRows,
  };
}

function registerFonts(doc) {
  doc.registerFont('R', FONT_REGULAR);
  doc.registerFont('M', FONT_MEDIUM);
  doc.registerFont('SB', FONT_SEMIBOLD);
  doc.registerFont('B', FONT_BOLD);
}

function drawPill(doc, x, y, label, colors) {
  const width = doc.widthOfString(label, { font: 'SB', size: 7 }) + 18;
  doc.roundedRect(x, y, width, 18, 9).fill(colors.fill);
  doc.font('SB').fontSize(7).fillColor(colors.text).text(label, x + 9, y + 5, {
    width: width - 18,
    align: 'center',
    lineBreak: false,
  });
  return width;
}

function drawPageFrame(state) {
  const { doc, pageNumber, model } = state;
  doc.save();
  doc.rect(0, 0, PAGE_W, 6).fill(COLORS.primary);
  doc.restore();

  if (model.invoice.documentStatus === 'A') {
    doc.save();
    doc.rotate(-32, { origin: [PAGE_W / 2, PAGE_H / 2] });
    doc.font('B').fontSize(84).fillColor(COLORS.red).opacity(0.06)
      .text('ANULADA', 48, PAGE_H / 2 - 46, { width: PAGE_W - 96, align: 'center' });
    doc.restore().opacity(1);
  } else if (model.isProforma) {
    doc.save();
    doc.rotate(-32, { origin: [PAGE_W / 2, PAGE_H / 2] });
    doc.font('B').fontSize(74).fillColor(COLORS.amber).opacity(0.08)
      .text('PROFORMA', 48, PAGE_H / 2 - 38, { width: PAGE_W - 96, align: 'center' });
    doc.restore().opacity(1);
  }

  doc.moveTo(MARGIN, PAGE_FOOTER_RULE_Y).lineTo(PAGE_W - MARGIN, PAGE_FOOTER_RULE_Y)
    .lineWidth(0.5).strokeColor(COLORS.line).stroke();
  doc.font('M').fontSize(7).fillColor(COLORS.muted)
    .text(`Documento gerado no KukuGest`, MARGIN, PAGE_FOOTER_TEXT_Y, { width: 180, lineBreak: false });
  doc.font('M').fontSize(7).fillColor(COLORS.muted)
    .text(`Página ${pageNumber}`, PAGE_W - MARGIN - 60, PAGE_FOOTER_TEXT_Y, { width: 60, align: 'right', lineBreak: false });
}

function addPage(state) {
  state.doc.addPage();
  state.pageNumber += 1;
  state.cursorY = MARGIN;
  drawPageFrame(state);
}

function ensureSpace(state, height) {
  if (state.cursorY + height <= PAGE_H - 56) return;
  addPage(state);
}

function drawCompanyIdentity(doc, model, x, y, width) {
  const markSize = 56;
  if (model.logoBuffer) {
    doc.image(model.logoBuffer, x, y, { fit: [markSize, markSize], align: 'left', valign: 'top' });
  } else {
    doc.roundedRect(x, y, markSize, markSize, 16).fill(COLORS.accentSoft);
    doc.font('B').fontSize(18).fillColor(COLORS.accent)
      .text(companyInitials(model.issuer.name), x, y + 18, { width: markSize, align: 'center', lineBreak: false });
  }

  const textX = x + markSize + 14;
  const textW = width - markSize - 14;
  let cursor = y + 2;

  doc.font('M').fontSize(8).fillColor(COLORS.accent)
    .text('Emitido com KukuGest', textX, cursor, { width: textW });
  cursor += 14;

  doc.font('B').fontSize(16).fillColor(COLORS.primary);
  const companyNameHeight = measureTextHeight(doc, model.issuer.name, textW, 'B', 16);
  doc.text(model.issuer.name, textX, cursor, { width: textW });
  cursor += companyNameHeight + 4;

  doc.font('M').fontSize(9).fillColor(COLORS.ink)
    .text(`NIF: ${model.issuer.taxId}`, textX, cursor, { width: textW });
  cursor += 14;

  const secondaryLines = [
    model.issuer.address,
    [model.issuer.phone, model.issuer.email].filter(Boolean).join(' · '),
    model.issuer.website,
  ].filter(Boolean);

  secondaryLines.forEach((line) => {
    const height = measureTextHeight(doc, line, textW, 'R', 8.5);
    doc.font('R').fontSize(8.5).fillColor(COLORS.muted)
      .text(line, textX, cursor, { width: textW });
    cursor += height + 3;
  });

  return Math.max(markSize, cursor - y);
}

function drawDocumentHeader(state) {
  const { doc, model } = state;
  const leftX = MARGIN;
  const rightW = 214;
  const gap = 24;
  const rightX = PAGE_W - MARGIN - rightW;
  const leftW = rightX - leftX - gap;
  const topY = MARGIN + 6;

  const leftHeight = drawCompanyIdentity(doc, model, leftX, topY + 6, leftW);

  doc.roundedRect(rightX, topY, rightW, 148, 18).fillAndStroke(COLORS.panel, COLORS.line);
  doc.roundedRect(rightX, topY, 6, 148, 18).fill(COLORS.accent);
  doc.font('M').fontSize(8).fillColor(COLORS.muted)
    .text('Documento Fiscal', rightX + 18, topY + 14, { width: rightW - 32 });
  doc.font('B').fontSize(21).fillColor(COLORS.primary)
    .text(docTypeLabel(model.invoice.documentType).toUpperCase(), rightX + 18, topY + 28, { width: rightW - 32 });
  doc.font('SB').fontSize(11).fillColor(COLORS.accent)
    .text(model.invoice.documentNo, rightX + 18, topY + 56, { width: rightW - 32 });

  let pillX = rightX + 18;
  const statusWidth = drawPill(doc, pillX, topY + 76, statusLabel(model.invoice.documentStatus), statusTone(model.invoice.documentStatus));
  pillX += statusWidth + 8;
  drawPill(doc, pillX, topY + 76, agtStatusLabel(model.invoice.agtValidationStatus), {
    fill: model.invoice.agtValidationStatus === 'V' ? COLORS.greenSoft : COLORS.accentSoft,
    text: model.invoice.agtValidationStatus === 'V' ? COLORS.green : COLORS.accent,
  });

  const metaRows = [
    { label: 'Emissão', value: fmtDate(model.invoice.documentDate) },
    { label: 'Série', value: model.invoice.serie ? `${model.invoice.serie.seriesCode}/${model.invoice.serie.seriesYear}` : '—' },
    { label: 'Ponto de venda', value: model.invoice.estabelecimento?.nome || '—' },
    { label: 'Moeda', value: model.displayCurrency },
    { label: 'Pagamento', value: model.invoice.paymentMethod || '—' },
    { label: 'Vencimento', value: model.invoice.paymentDue ? fmtDate(model.invoice.paymentDue) : '—' },
  ];

  let metaY = topY + 103;
  metaRows.forEach((row) => {
    doc.font('M').fontSize(7).fillColor(COLORS.mutedLight)
      .text(row.label.toUpperCase(), rightX + 18, metaY, { width: 70, lineBreak: false });
    doc.font('SB').fontSize(8).fillColor(COLORS.ink)
      .text(row.value, rightX + 94, metaY - 1, { width: rightW - 112, align: 'right', lineBreak: false });
    metaY += 13;
  });

  const headerBottom = Math.max(topY + leftHeight + 6, topY + 148) + 18;
  doc.moveTo(MARGIN, headerBottom).lineTo(PAGE_W - MARGIN, headerBottom)
    .lineWidth(0.8).strokeColor(COLORS.line).stroke();
  state.cursorY = headerBottom + 18;
}

function measureCardHeight(doc, width, lines) {
  const innerW = width - 32;
  let height = 52;

  lines.forEach((line) => {
    const size = line.size || (line.emphasis ? 10 : 8.5);
    const lineHeight = measureTextHeight(doc, line.text, innerW, line.emphasis ? 'SB' : 'R', size);
    height += lineHeight + (line.tight ? 1 : 4);
  });

  return Math.max(height + 10, 122);
}

function drawInfoCard(doc, x, y, width, title, lines) {
  const height = measureCardHeight(doc, width, lines);
  const innerW = width - 32;
  let cursor = y + 16;

  doc.roundedRect(x, y, width, height, 18).fillAndStroke(COLORS.white, COLORS.line);
  doc.font('M').fontSize(8).fillColor(COLORS.accent)
    .text(title.toUpperCase(), x + 16, cursor, { width: innerW, lineBreak: false });
  cursor += 18;

  lines.forEach((line) => {
    const font = line.emphasis ? 'SB' : 'R';
    const size = line.size || (line.emphasis ? 10 : 8.5);
    const color = line.color || (line.emphasis ? COLORS.ink : COLORS.muted);
    const lineHeight = measureTextHeight(doc, line.text, innerW, font, size);
    doc.font(font).fontSize(size).fillColor(color)
      .text(line.text, x + 16, cursor, { width: innerW });
    cursor += lineHeight + (line.tight ? 1 : 4);
  });

  return height;
}

function drawParties(state) {
  const { doc, model } = state;
  ensureSpace(state, 160);

  const leftLines = [
    { text: model.issuer.name, emphasis: true, size: 11 },
    { text: `NIF: ${model.issuer.taxId}` },
    ...(model.issuer.address ? [{ text: model.issuer.address }] : []),
    ...(model.issuer.phone ? [{ text: `Telefone: ${model.issuer.phone}` }] : []),
    ...(model.issuer.email ? [{ text: `Email: ${model.issuer.email}` }] : []),
    ...(model.issuer.website ? [{ text: model.issuer.website, color: COLORS.accent }] : []),
  ];

  const rightLines = [
    { text: model.customer.name, emphasis: true, size: 11 },
    { text: `NIF: ${model.customer.taxId}` },
    ...(model.customer.address ? [{ text: model.customer.address }] : []),
    ...(model.customer.phone ? [{ text: `Telefone: ${model.customer.phone}` }] : []),
    ...(model.customer.email ? [{ text: `Email: ${model.customer.email}` }] : []),
  ];

  const boxW = (CONTENT_W - 18) / 2;
  const leftH = drawInfoCard(doc, MARGIN, state.cursorY, boxW, 'Emitente', leftLines);
  const rightH = drawInfoCard(doc, MARGIN + boxW + 18, state.cursorY, boxW, 'Cliente / Faturado a', rightLines);
  state.cursorY += Math.max(leftH, rightH) + 18;
}

function getTableColumns() {
  return [
    { key: 'description', label: 'Descrição', width: 246, align: 'left' },
    { key: 'qty', label: 'Qtd.', width: 48, align: 'right' },
    { key: 'unitPrice', label: 'Preço Unit.', width: 84, align: 'right' },
    { key: 'tax', label: 'IVA', width: 48, align: 'right' },
    { key: 'total', label: 'Total', width: 85.28, align: 'right' },
  ];
}

function drawTableHeader(state, continuation = false) {
  const { doc, model } = state;
  const headerY = state.cursorY;
  const columns = getTableColumns();

  if (continuation) {
    doc.font('M').fontSize(7.5).fillColor(COLORS.muted)
      .text(`Continuação · ${docTypeLabel(model.invoice.documentType)} ${model.invoice.documentNo}`, MARGIN, headerY, {
        width: CONTENT_W,
      });
    state.cursorY += 15;
  }

  doc.roundedRect(MARGIN, state.cursorY, CONTENT_W, 24, 12).fill(COLORS.primary);
  let x = MARGIN;
  columns.forEach((column) => {
    doc.font('SB').fontSize(7.5).fillColor(COLORS.white)
      .text(column.label, x + 8, state.cursorY + 8, {
        width: column.width - 16,
        align: column.align,
        lineBreak: false,
      });
    x += column.width;
  });

  state.cursorY += 30;
}

function addTablePage(state) {
  addPage(state);
  drawTableHeader(state, true);
}

function drawItemRows(state) {
  const { doc, model } = state;
  drawTableHeader(state, false);
  const columns = getTableColumns();

  model.lines.forEach((line, index) => {
    const displayDescription = line.productDescription || '—';
    const lineCode = line.productCode ? `Código: ${line.productCode}` : '';
    const descriptionHeight = measureTextHeight(doc, displayDescription, columns[0].width - 16, 'SB', 9);
    const codeHeight = lineCode
      ? measureTextHeight(doc, lineCode, columns[0].width - 16, 'R', 7.5)
      : 0;
    const rowHeight = Math.max(34, descriptionHeight + codeHeight + 18);
    if (state.cursorY + rowHeight > PAGE_H - 72) {
      addTablePage(state);
    }

    const qty = Number(line.quantity || 0);
    const unitPrice = Number(line.unitPrice || 0);
    const tax = line.taxes?.[0]?.taxPercentage ?? 14;
    const total = line.isIncluded ? 0 : (qty * unitPrice * (1 + (tax / 100)));
    const rowBg = line.isIncluded
      ? COLORS.greenSoft
      : index % 2 === 0
        ? COLORS.white
        : COLORS.panel;

    doc.rect(MARGIN, state.cursorY, CONTENT_W, rowHeight).fill(rowBg);
    doc.moveTo(MARGIN, state.cursorY + rowHeight).lineTo(PAGE_W - MARGIN, state.cursorY + rowHeight)
      .lineWidth(0.5).strokeColor(COLORS.line).stroke();

    let x = MARGIN;
    columns.forEach((column) => {
      const valueX = x + 8;
      const width = column.width - 16;

      if (column.key === 'description') {
        doc.font('SB').fontSize(9).fillColor(line.isIncluded ? COLORS.green : COLORS.ink)
          .text(displayDescription, valueX, state.cursorY + 7, { width });
        if (lineCode) {
          doc.font('R').fontSize(7.5).fillColor(COLORS.muted)
            .text(lineCode, valueX, state.cursorY + 11 + descriptionHeight, { width });
        }
      } else if (column.key === 'qty') {
        doc.font('R').fontSize(8.5).fillColor(COLORS.ink)
          .text(fmtNum(qty), valueX, state.cursorY + 8, { width, align: 'right', lineBreak: false });
      } else if (column.key === 'unitPrice') {
        doc.font(line.isIncluded ? 'SB' : 'R').fontSize(8.5).fillColor(line.isIncluded ? COLORS.green : COLORS.ink)
          .text(
            line.isIncluded ? 'Incluído' : fmtAmount(unitPrice, model.displayCurrency),
            valueX,
            state.cursorY + 8,
            { width, align: 'right', lineBreak: false }
          );
      } else if (column.key === 'tax') {
        doc.font('R').fontSize(8.5).fillColor(COLORS.muted)
          .text(line.isIncluded ? '—' : `${fmtNum(tax, 0)}%`, valueX, state.cursorY + 8, { width, align: 'right', lineBreak: false });
      } else if (column.key === 'total') {
        doc.font('SB').fontSize(8.5).fillColor(line.isIncluded ? COLORS.green : COLORS.ink)
          .text(
            line.isIncluded ? 'Incluído' : fmtAmount(total, model.displayCurrency),
            valueX,
            state.cursorY + 8,
            { width, align: 'right', lineBreak: false }
          );
      }

      x += column.width;
    });

    state.cursorY += rowHeight;
  });

  doc.moveTo(MARGIN, state.cursorY).lineTo(PAGE_W - MARGIN, state.cursorY)
    .lineWidth(1).strokeColor(COLORS.primary).stroke();
  state.cursorY += 18;
}

function estimateSupportHeight(doc, rows, width) {
  const valueWidth = width - 126;
  let height = 56;
  rows.forEach((row) => {
    const valueHeight = measureTextHeight(doc, row.value || '—', valueWidth, 'R', 8.5);
    height += Math.max(12, valueHeight) + 8;
  });
  return Math.max(height + 10, 136);
}

function drawSupportCard(doc, model, x, y, width, height) {
  doc.roundedRect(x, y, width, height, 18).fillAndStroke(COLORS.white, COLORS.line);
  doc.font('M').fontSize(8).fillColor(COLORS.accent)
    .text('Pagamento e referências'.toUpperCase(), x + 16, y + 16, { width: width - 32 });

  let cursor = y + 36;
  const labelWidth = 94;
  const valueWidth = width - 32 - labelWidth;
  model.supportRows.forEach((row) => {
    const value = row.value || '—';
    const valueHeight = measureTextHeight(doc, value, valueWidth, 'R', 8.5);
    doc.font('M').fontSize(7.5).fillColor(COLORS.mutedLight)
      .text(row.label.toUpperCase(), x + 16, cursor + 1, { width: labelWidth - 8 });
    doc.font('R').fontSize(8.5).fillColor(COLORS.ink)
      .text(value, x + 16 + labelWidth, cursor, { width: valueWidth });
    cursor += Math.max(13, valueHeight) + 8;
  });

  if (model.isProforma) {
    doc.font('M').fontSize(8).fillColor(COLORS.amber)
      .text('Documento proforma sem validade fiscal.', x + 16, y + height - 22, { width: width - 32 });
  }
}

function drawTotalsCard(doc, model, x, y, width) {
  const rows = [
    { label: 'Subtotal', value: fmtAmount(model.invoice.netTotal, model.displayCurrency) },
    { label: 'IVA', value: fmtAmount(model.invoice.taxPayable, model.displayCurrency) },
  ];
  let height = 132;
  if (model.showBaseReference) height += 32;

  doc.roundedRect(x, y, width, height, 20).fillAndStroke(COLORS.primary, COLORS.primary);
  doc.font('M').fontSize(8).fillColor('#BFDBFE')
    .text('Resumo financeiro'.toUpperCase(), x + 18, y + 16, { width: width - 36 });

  let cursor = y + 38;
  rows.forEach((row) => {
    doc.font('M').fontSize(9).fillColor('#CBD5E1')
      .text(row.label, x + 18, cursor, { width: 100, lineBreak: false });
    doc.font('SB').fontSize(9).fillColor(COLORS.white)
      .text(row.value, x + 118, cursor - 1, { width: width - 136, align: 'right', lineBreak: false });
    cursor += 20;
  });

  doc.moveTo(x + 18, cursor + 4).lineTo(x + width - 18, cursor + 4)
    .lineWidth(0.7).strokeColor('#33507A').stroke();
  cursor += 16;

  doc.font('M').fontSize(9).fillColor('#BFDBFE')
    .text('Total do documento', x + 18, cursor, { width: 118, lineBreak: false });
  doc.font('B').fontSize(15).fillColor(COLORS.white)
    .text(fmtAmount(model.invoice.grossTotal, model.displayCurrency), x + 126, cursor - 3, {
      width: width - 144,
      align: 'right',
      lineBreak: false,
    });

  if (model.showBaseReference) {
    cursor += 30;
    doc.roundedRect(x + 16, cursor - 6, width - 32, 28, 12).fill('#173659');
    doc.font('M').fontSize(7.5).fillColor('#CBD5E1')
      .text(`Equivalente interno ${model.baseCurrency}`, x + 28, cursor + 2, {
        width: width - 56,
      });
    doc.font('SB').fontSize(8.5).fillColor(COLORS.white)
      .text(
        fmtAmount(model.invoice.grossTotal * Number(model.invoice.exchangeRate || 1), model.baseCurrency),
        x + 28,
        cursor + 13,
        { width: width - 56, align: 'left', lineBreak: false }
      );
  }

  return height;
}

function drawSummary(state) {
  const { doc, model } = state;
  const leftW = 262;
  const gap = 18;
  const rightW = CONTENT_W - leftW - gap;
  const supportHeight = estimateSupportHeight(doc, model.supportRows, leftW);
  const totalsHeight = model.showBaseReference ? 164 : 132;
  const footerHeight = 130;

  ensureSpace(state, Math.max(supportHeight, totalsHeight) + footerHeight + 18);

  const y = state.cursorY;
  drawSupportCard(doc, model, MARGIN, y, leftW, supportHeight);
  drawTotalsCard(doc, model, MARGIN + leftW + gap, y, rightW);

  state.cursorY += Math.max(supportHeight, totalsHeight) + 18;
}

function drawComplianceFooter(state) {
  const { doc, model } = state;
  const footerTop = state.cursorY;
  const qrSize = 78;
  const qrX = PAGE_W - MARGIN - qrSize;
  const qrY = footerTop + 18;
  const infoWidth = CONTENT_W - qrSize - 20;

  doc.moveTo(MARGIN, footerTop).lineTo(PAGE_W - MARGIN, footerTop)
    .lineWidth(0.8).strokeColor(COLORS.line).stroke();

  doc.font('M').fontSize(8).fillColor(COLORS.accent)
    .text('Rodapé documental'.toUpperCase(), MARGIN, footerTop + 14, { width: infoWidth });

  let cursor = footerTop + 32;
  const issuerFooterLines = [
    [model.issuer.website, model.issuer.email].filter(Boolean).join(' · '),
    model.issuer.phone ? `Contacto: ${model.issuer.phone}` : '',
    'Obrigado pela sua preferência.',
  ].filter(Boolean);

  issuerFooterLines.forEach((line) => {
    const height = measureTextHeight(doc, line, 214, 'R', 8.5);
    doc.font('R').fontSize(8.5).fillColor(COLORS.muted)
      .text(line, MARGIN, cursor, { width: 214 });
    cursor += height + 4;
  });

  let agtY = footerTop + 32;
  const agtX = MARGIN + 236;
  const agtW = infoWidth - 236;
  doc.font('M').fontSize(7.5).fillColor(COLORS.mutedLight)
    .text('INFORMAÇÃO TÉCNICA', agtX, agtY, { width: agtW });
  agtY += 14;

  [
    model.invoice.serie ? `Série: ${model.invoice.serie.seriesCode}/${model.invoice.serie.seriesYear}` : '',
    `Estado AGT: ${agtStatusLabel(model.invoice.agtValidationStatus)}${model.isProforma ? ' · Proforma' : ''}`,
    model.invoice.agtRequestId ? `Request ID: ${model.invoice.agtRequestId}` : '',
    model.invoice.jwsSignature && model.invoice.jwsSignature !== 'PLACEHOLDER'
      ? `Assinatura: ${String(model.invoice.jwsSignature).slice(0, 34)}...`
      : '',
  ].filter(Boolean).forEach((line) => {
    const height = measureTextHeight(doc, line, agtW, 'R', 7.5);
    doc.font('R').fontSize(7.5).fillColor(COLORS.ink)
      .text(line, agtX, agtY, { width: agtW });
    agtY += height + 4;
  });

  if (!model.isProforma && model.invoice.qrCodeImage) {
    const qrBuffer = parseImage(model.invoice.qrCodeImage);
    if (qrBuffer) {
      doc.roundedRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 30, 16).fillAndStroke(COLORS.white, COLORS.line);
      doc.image(qrBuffer, qrX, qrY, { fit: [qrSize, qrSize] });
      doc.font('M').fontSize(6.5).fillColor(COLORS.muted)
        .text('Consulta fiscal AGT', qrX - 8, qrY + qrSize + 8, {
          width: qrSize + 16,
          align: 'center',
          lineBreak: false,
        });
    }
  }

  const legalText = model.isProforma
    ? `Documento proforma emitido por ${model.issuer.name} · NIF ${model.issuer.taxId} · Sem efeito fiscal.`
    : `Documento processado por programa informático certificado · Nº Cert.: ${model.invoice.agtValidationStatus === 'NA' ? 'N/A' : (state.config.agtCertNumber || 'PENDENTE')} · ${model.issuer.name} · NIF ${model.issuer.taxId}.`;

  doc.moveTo(MARGIN, LEGAL_FOOTER_RULE_Y).lineTo(PAGE_W - MARGIN, LEGAL_FOOTER_RULE_Y)
    .lineWidth(0.5).strokeColor(COLORS.line).stroke();
  doc.font('R').fontSize(6.8).fillColor(COLORS.muted)
    .text(legalText, MARGIN, LEGAL_FOOTER_TEXT_Y, { width: CONTENT_W, align: 'center' });
}

async function generateFacturaPDF(factura, config = {}) {
  return new Promise((resolve, reject) => {
    const model = buildModel(factura, config);
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      info: {
        Title: `${docTypeLabel(factura.documentType)} ${factura.documentNo}`,
        Author: model.issuer.name || 'KukuGest',
        Creator: 'KukuGest',
      },
    });

    registerFonts(doc);

    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const state = {
      doc,
      model,
      config,
      pageNumber: 1,
      cursorY: MARGIN,
    };

    drawPageFrame(state);
    drawDocumentHeader(state);
    drawParties(state);
    drawItemRows(state);
    drawSummary(state);
    drawComplianceFooter(state);

    doc.end();
  });
}

module.exports = { generateFacturaPDF };
