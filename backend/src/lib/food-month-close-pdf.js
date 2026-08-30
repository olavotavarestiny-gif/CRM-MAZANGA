'use strict';

const path = require('path');
const PDFDocument = require('pdfkit');

const FONT_BASE = path.join(__dirname, '..', '..', 'node_modules', '@expo-google-fonts', 'inter');
const FONTS = {
  regular: path.join(FONT_BASE, '400Regular', 'Inter_400Regular.ttf'),
  medium: path.join(FONT_BASE, '500Medium', 'Inter_500Medium.ttf'),
  semibold: path.join(FONT_BASE, '600SemiBold', 'Inter_600SemiBold.ttf'),
  bold: path.join(FONT_BASE, '700Bold', 'Inter_700Bold.ttf'),
};

const PAGE = { width: 595.28, height: 841.89, margin: 42, footerTop: 780 };
const CONTENT_WIDTH = PAGE.width - (PAGE.margin * 2);
const COLORS = {
  ink: '#111827', muted: '#64748B', line: '#E2E8F0', panel: '#F8FAFC', white: '#FFFFFF',
  primary: '#0F766E', primarySoft: '#F0FDFA', green: '#047857', amber: '#B45309', red: '#B91C1C',
};

function text(value, fallback = '-') {
  const normalized = value == null ? '' : String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
  return normalized || fallback;
}

function amount(value, currency = 'AOA') {
  const number = Number(value || 0);
  const formatted = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number);
  return String(currency || 'AOA').toUpperCase() === 'AOA' ? `${formatted} Kz` : `${text(currency, 'AOA')} ${formatted}`;
}

function dateTime(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Africa/Luanda' }).format(new Date(value));
}

function monthLabel(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})/);
  if (!match) return text(value);
  return new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${match[1]}-${match[2]}-01T00:00:00.000Z`));
}

function safeColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : COLORS.primary;
}

function registerFonts(doc) {
  doc.registerFont('R', FONTS.regular);
  doc.registerFont('M', FONTS.medium);
  doc.registerFont('SB', FONTS.semibold);
  doc.registerFont('B', FONTS.bold);
}

function createLayout(doc, close, settings) {
  const brand = safeColor(settings.primaryColor);
  const restaurant = text(settings.restaurantName, 'KukuGest Food');
  const revisionLabel = close.revisionNumber ? `Revisão ${close.revisionNumber}` : 'Snapshot original';
  const state = { doc, close, settings, brand, restaurant, revisionLabel, y: PAGE.margin };

  state.drawHeader = () => {
    doc.rect(0, 0, PAGE.width, 7).fill(brand);
    doc.font('B').fontSize(9).fillColor(brand).text('KUKUGEST FOOD', PAGE.margin, 32, { characterSpacing: 0.6 });
    doc.font('SB').fontSize(9).fillColor(COLORS.muted).text(restaurant, PAGE.margin, 47, { width: CONTENT_WIDTH * 0.55 });
    doc.font('SB').fontSize(8).fillColor(COLORS.muted).text(revisionLabel, PAGE.width - PAGE.margin - 150, 36, { width: 150, align: 'right' });
    doc.moveTo(PAGE.margin, 69).lineTo(PAGE.width - PAGE.margin, 69).lineWidth(0.7).strokeColor(COLORS.line).stroke();
    state.y = 84;
  };

  state.newPage = () => {
    doc.addPage();
    state.drawHeader();
  };

  state.ensure = (height) => {
    if (state.y + height > PAGE.footerTop - 18) state.newPage();
  };

  state.heading = (title, subtitle) => {
    state.ensure(subtitle ? 48 : 33);
    doc.font('B').fontSize(13).fillColor(COLORS.ink).text(title, PAGE.margin, state.y);
    state.y += 19;
    if (subtitle) {
      doc.font('R').fontSize(7.5).fillColor(COLORS.muted).text(subtitle, PAGE.margin, state.y, { width: CONTENT_WIDTH });
      state.y += 19;
    } else state.y += 8;
  };

  state.drawHeader();
  return state;
}

function drawTitle(state) {
  const { doc, close, brand } = state;
  doc.font('B').fontSize(25).fillColor(COLORS.ink).text('Fecho mensal', PAGE.margin, state.y);
  doc.font('M').fontSize(10).fillColor(COLORS.muted).text(monthLabel(close.month), PAGE.margin, state.y + 33);
  const badgeWidth = 112;
  doc.roundedRect(PAGE.width - PAGE.margin - badgeWidth, state.y + 4, badgeWidth, 27, 5).fill(brand);
  doc.font('SB').fontSize(8).fillColor(COLORS.white).text(state.revisionLabel, PAGE.width - PAGE.margin - badgeWidth + 8, state.y + 13, { width: badgeWidth - 16, align: 'center' });
  state.y += 73;

  const meta = [
    ['Âmbito', close.branch?.name || (close.scopeKey === 'all' ? 'Organização' : close.scopeKey)],
    ['Fechado em', dateTime(close.closedAt)],
    ['Versão do agregado', close.version],
    ['Responsável', close.closedByUserId],
  ];
  const cellWidth = CONTENT_WIDTH / 2;
  meta.forEach(([label, value], index) => {
    const x = PAGE.margin + ((index % 2) * cellWidth);
    const y = state.y + (Math.floor(index / 2) * 38);
    doc.font('SB').fontSize(7).fillColor(COLORS.muted).text(label.toUpperCase(), x, y);
    doc.font('M').fontSize(9).fillColor(COLORS.ink).text(text(value), x, y + 12, { width: cellWidth - 15 });
  });
  state.y += 86;
  if (close.reason) {
    doc.roundedRect(PAGE.margin, state.y, CONTENT_WIDTH, 38, 5).fill(COLORS.primarySoft);
    doc.font('SB').fontSize(7).fillColor(brand).text('MOTIVO DA REVISÃO', PAGE.margin + 12, state.y + 8);
    doc.font('R').fontSize(8).fillColor(COLORS.ink).text(text(close.reason), PAGE.margin + 12, state.y + 20, { width: CONTENT_WIDTH - 24, ellipsis: true });
    state.y += 54;
  }
}

function drawMetrics(state, snapshot, currency) {
  state.heading('Resumo executivo', 'Valores registados no snapshot e não recalculados no momento do download.');
  const values = [
    ['Pedidos', snapshot.summary?.orders ?? 0, false],
    ['Valor dos pedidos', snapshot.summary?.orderValue ?? 0, true],
    ['Recebido', snapshot.summary?.received ?? 0, true],
    ['Reconciliado', snapshot.summary?.reconciled ?? 0, true],
    ['Por receber', snapshot.summary?.outstanding ?? 0, true],
    ['Ticket médio', snapshot.summary?.averageTicket ?? 0, true],
  ];
  const gap = 8;
  const width = (CONTENT_WIDTH - (gap * 2)) / 3;
  values.forEach(([label, value, monetary], index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = PAGE.margin + (column * (width + gap));
    const y = state.y + (row * 65);
    state.doc.roundedRect(x, y, width, 56, 5).fillAndStroke(COLORS.panel, COLORS.line);
    state.doc.font('SB').fontSize(7).fillColor(COLORS.muted).text(label.toUpperCase(), x + 10, y + 10, { width: width - 20 });
    state.doc.font('B').fontSize(13).fillColor(COLORS.ink).text(monetary ? amount(value, currency) : text(value), x + 10, y + 28, { width: width - 20, ellipsis: true });
  });
  state.y += 138;

  const controls = [
    ['Com entregadores', amount(snapshot.summary?.heldByCouriers, currency)],
    ['Diferença de Caixa', amount(snapshot.summary?.cashDifference, currency)],
    ['Descontos', amount(snapshot.summary?.discounts, currency)],
    ['Cancelamentos', `${Number(snapshot.summary?.cancellationRate || 0).toFixed(1)}%`],
  ];
  state.doc.roundedRect(PAGE.margin, state.y, CONTENT_WIDTH, 46, 5).fill(COLORS.primarySoft);
  controls.forEach(([label, value], index) => {
    const width = CONTENT_WIDTH / controls.length;
    const x = PAGE.margin + (index * width);
    state.doc.font('SB').fontSize(6.6).fillColor(state.brand).text(label.toUpperCase(), x + 10, state.y + 9, { width: width - 20 });
    state.doc.font('B').fontSize(9).fillColor(COLORS.ink).text(value, x + 10, state.y + 25, { width: width - 20, ellipsis: true });
  });
  state.y += 64;
}

function drawTable(state, title, subtitle, columns, rows, emptyLabel) {
  state.heading(title, subtitle);
  if (!rows.length) {
    state.doc.roundedRect(PAGE.margin, state.y, CONTENT_WIDTH, 35, 5).fillAndStroke(COLORS.panel, COLORS.line);
    state.doc.font('R').fontSize(8).fillColor(COLORS.muted).text(emptyLabel, PAGE.margin + 12, state.y + 12);
    state.y += 50;
    return;
  }

  const drawTableHeader = () => {
    state.ensure(42);
    state.doc.rect(PAGE.margin, state.y, CONTENT_WIDTH, 25).fill(state.brand);
    let x = PAGE.margin;
    columns.forEach((column) => {
      state.doc.font('SB').fontSize(6.7).fillColor(COLORS.white).text(column.label, x + 7, state.y + 9, { width: column.width - 14, align: column.align || 'left', ellipsis: true });
      x += column.width;
    });
    state.y += 25;
  };

  drawTableHeader();
  rows.forEach((row, rowIndex) => {
    const values = columns.map((column) => text(column.value(row)));
    const heights = values.map((value, index) => state.doc.font('R').fontSize(7.3).heightOfString(value, { width: columns[index].width - 14 }));
    const height = Math.max(25, Math.min(48, Math.max(...heights) + 11));
    if (state.y + height > PAGE.footerTop - 18) {
      state.newPage();
      drawTableHeader();
    }
    if (rowIndex % 2 === 1) state.doc.rect(PAGE.margin, state.y, CONTENT_WIDTH, height).fill(COLORS.panel);
    let x = PAGE.margin;
    values.forEach((value, index) => {
      const column = columns[index];
      state.doc.font(index === 0 ? 'M' : 'R').fontSize(7.3).fillColor(COLORS.ink).text(value, x + 7, state.y + 7, { width: column.width - 14, align: column.align || 'left', height: height - 9, ellipsis: true });
      x += column.width;
    });
    state.doc.moveTo(PAGE.margin, state.y + height).lineTo(PAGE.width - PAGE.margin, state.y + height).lineWidth(0.4).strokeColor(COLORS.line).stroke();
    state.y += height;
  });
  state.y += 18;
}

function addFooters(doc, close) {
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    doc.moveTo(PAGE.margin, PAGE.footerTop).lineTo(PAGE.width - PAGE.margin, PAGE.footerTop).lineWidth(0.5).strokeColor(COLORS.line).stroke();
    doc.font('R').fontSize(6.5).fillColor(COLORS.muted).text('Snapshot imutável gerado pelo KukuGest Food', PAGE.margin, PAGE.footerTop + 10, { width: 300, lineBreak: false });
    doc.text(`${String(close.month || '').slice(0, 7)}  |  Página ${index - range.start + 1} de ${range.count}`, PAGE.width - PAGE.margin - 180, PAGE.footerTop + 10, { width: 180, align: 'right', lineBreak: false });
  }
}

function buildFoodMonthlyClosePdf(close, settings = {}) {
  return new Promise((resolve, reject) => {
    const snapshot = close?.snapshot && typeof close.snapshot === 'object' ? close.snapshot : {};
    const validation = close?.validationSnapshot && typeof close.validationSnapshot === 'object' ? close.validationSnapshot : {};
    const currency = settings.currency || snapshot.currency || 'AOA';
    const doc = new PDFDocument({ size: 'A4', margin: PAGE.margin, bufferPages: true, info: { Title: `Fecho mensal Food ${String(close?.month || '').slice(0, 7)}`, Author: settings.restaurantName || 'KukuGest Food', Creator: 'KukuGest Food' } });
    registerFonts(doc);
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const state = createLayout(doc, close || {}, settings);
    drawTitle(state);
    drawMetrics(state, snapshot, currency);
    drawTable(state, 'Métodos de pagamento', 'Recebimentos e valores já reconciliados.', [
      { label: 'Método', width: 170, value: (row) => row.method },
      { label: 'Operações', width: 90, align: 'right', value: (row) => row.count },
      { label: 'Recebido', width: 125, align: 'right', value: (row) => amount(row.received, currency) },
      { label: 'Reconciliado', width: CONTENT_WIDTH - 385, align: 'right', value: (row) => amount(row.reconciled, currency) },
    ], Array.isArray(snapshot.byMethod) ? snapshot.byMethod : [], 'Sem pagamentos registados neste snapshot.');
    drawTable(state, 'Unidades', 'Comparação operacional incluída no âmbito do fecho.', [
      { label: 'Unidade', width: 175, value: (row) => row.branchName },
      { label: 'Pedidos', width: 70, align: 'right', value: (row) => row.orders },
      { label: 'Valor', width: 133, align: 'right', value: (row) => amount(row.orderValue, currency) },
      { label: 'Recebido', width: CONTENT_WIDTH - 378, align: 'right', value: (row) => amount(row.received, currency) },
    ], Array.isArray(snapshot.byBranch) ? snapshot.byBranch : [], 'Sem unidades com movimento neste snapshot.');
    drawTable(state, 'Validação do fecho', 'Estado das verificações no momento exato em que o snapshot foi criado.', [
      { label: 'Verificação', width: 240, value: (row) => row.label },
      { label: 'Estado', width: 85, value: (row) => ({ ok: 'OK', warning: 'Aviso', blocked: 'Bloqueio' }[row.status] || row.status) },
      { label: 'Registos', width: 75, align: 'right', value: (row) => row.count },
      { label: 'Valor', width: CONTENT_WIDTH - 400, align: 'right', value: (row) => amount(row.amount, currency) },
    ], Array.isArray(validation.checks) ? validation.checks : [], 'Sem verificações guardadas.');
    drawTable(state, 'Histórico diário', 'Movimento consolidado por dia dentro do período fechado.', [
      { label: 'Data', width: 95, value: (row) => String(row.date || '').slice(0, 10) },
      { label: 'Pedidos', width: 70, align: 'right', value: (row) => row.orders },
      { label: 'Valor', width: 115, align: 'right', value: (row) => amount(row.orderValue, currency) },
      { label: 'Recebido', width: 115, align: 'right', value: (row) => amount(row.received, currency) },
      { label: 'Reconciliado', width: CONTENT_WIDTH - 395, align: 'right', value: (row) => amount(row.reconciled, currency) },
    ], Array.isArray(snapshot.daily) ? snapshot.daily : [], 'Sem histórico diário neste snapshot.');
    addFooters(doc, close || {});
    doc.end();
  });
}

function monthlyClosePdfFilename(close) {
  const month = String(close?.month || '').slice(0, 7) || 'mes';
  const scope = String(close?.branch?.name || close?.scopeKey || 'organizacao').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'organizacao';
  const revision = Number(close?.revisionNumber) > 1 ? `-revisao-${Number(close.revisionNumber)}` : '';
  return `kukugest-food-fecho-${month}-${scope}${revision}.pdf`;
}

module.exports = { amount, buildFoodMonthlyClosePdf, monthlyClosePdfFilename };
