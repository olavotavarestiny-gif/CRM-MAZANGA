'use strict';

const PDFDocument = require('pdfkit');
const path        = require('path');

// ── Fontes Inter ──────────────────────────────────────────────
const FONT_BASE     = path.join(__dirname, '..', '..', '..', 'node_modules', '@expo-google-fonts', 'inter');
const FONT_REGULAR  = path.join(FONT_BASE, '400Regular',  'Inter_400Regular.ttf');
const FONT_MEDIUM   = path.join(FONT_BASE, '500Medium',   'Inter_500Medium.ttf');
const FONT_SEMIBOLD = path.join(FONT_BASE, '600SemiBold', 'Inter_600SemiBold.ttf');
const FONT_BOLD     = path.join(FONT_BASE, '700Bold',     'Inter_700Bold.ttf');

// ── Paleta ───────────────────────────────────────────────────
const NAVY   = '#0A2540';
const INDIGO = '#4F46E5';
const GRAY   = '#64748B';
const LIGHT  = '#F8FAFC';
const BORDER = '#E2E8F0';
const WHITE  = '#FFFFFF';
const RED    = '#DC2626';

// ── Dimensões A4 ─────────────────────────────────────────────
const PAGE_W  = 595.28;
const PAGE_H  = 841.89;
const MARGIN  = 50;
const INNER_W = PAGE_W - MARGIN * 2;   // 495.28

// ── Helpers ───────────────────────────────────────────────────
function fmtNum(n, decimals = 2) {
  if (typeof n !== 'number' || isNaN(n)) return '0,00';
  return n.toLocaleString('pt-PT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtAmount(n, cur = 'AOA') {
  if (cur === 'AOA') return fmtNum(n) + ' Kz';
  const sym = { USD: 'USD ', EUR: '€ ', GBP: '£ ' }[cur] ?? (cur + ' ');
  return sym + fmtNum(n);
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function docTypeLabel(t) {
  return { FT: 'Factura', FR: 'Factura/Recibo', ND: 'Nota de Débito', NC: 'Nota de Crédito', FA: 'Factura Simpl.', PF: 'Proforma' }[t] || t;
}
function agtStatusLabel(s) {
  return { P: 'Pendente AGT', V: 'Válida', I: 'Inválida', A: 'Anulada' }[s] || s;
}

/** Apenas PNG / JPEG / WebP são suportados pelo PDFKit */
function isSupportedImage(url) {
  if (!url || !url.startsWith('data:image')) return false;
  const mime = url.split(';')[0].replace('data:', '').toLowerCase();
  return ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(mime);
}

/** Valida os magic bytes do buffer antes de passar ao PDFKit */
function isValidImageBuffer(buf, mimeType) {
  if (!buf || buf.length < 12) return false;
  if (mimeType === 'image/png')
    return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg')
    return buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
  if (mimeType === 'image/webp')
    return buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP';
  return false;
}

// ── Gerador ───────────────────────────────────────────────────
async function generateFacturaPDF(factura, config) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      info: {
        Title:   `${docTypeLabel(factura.documentType)} ${factura.documentNo}`,
        Author:  config.nomeEmpresa || 'KukuGest',
        Creator: 'KukuGest',
      },
    });

    doc.registerFont('R',  FONT_REGULAR);
    doc.registerFont('M',  FONT_MEDIUM);
    doc.registerFont('SB', FONT_SEMIBOLD);
    doc.registerFont('B',  FONT_BOLD);

    const chunks = [];
    doc.on('data',  c => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const lines    = Array.isArray(factura.lines) ? factura.lines : JSON.parse(factura.lines || '[]');
    const ibans    = (() => {
      try { return config.iban ? JSON.parse(config.iban) : []; }
      catch { return config.iban ? [{ label: 'Principal', iban: config.iban }] : []; }
    })();
    const currency = factura.currencyCode || 'AOA';

    // ═══════════════════════════════════════════════════════════
    // BARRA DE TOPO
    // ═══════════════════════════════════════════════════════════
    doc.rect(0, 0, PAGE_W, 5).fill(NAVY);

    // ═══════════════════════════════════════════════════════════
    // CABEÇALHO — 2 colunas independentes, altura dinâmica
    // ═══════════════════════════════════════════════════════════
    const LOGO_MAX_W = 72;
    const LOGO_MAX_H = 52;
    const RIGHT_W    = 190;
    const rightX     = PAGE_W - MARGIN - RIGHT_W;   // 355.28
    const LEFT_W     = rightX - MARGIN - 15;         // 290.28  (gap de 15pt)

    let leftY  = 18;
    let rightY = 18;

    // ── Coluna esquerda: logo + dados empresa ─────────────────
    let textX = MARGIN;
    let textW = LEFT_W;

    if (isSupportedImage(config.logoUrl)) {
      try {
        const mime   = config.logoUrl.split(';')[0].replace('data:', '').toLowerCase();
        const ci     = config.logoUrl.indexOf(',');
        const imgBuf = Buffer.from(config.logoUrl.slice(ci + 1), 'base64');
        if (isValidImageBuffer(imgBuf, mime)) {
          doc.image(imgBuf, MARGIN, leftY, { fit: [LOGO_MAX_W, LOGO_MAX_H] });
          textX = MARGIN + LOGO_MAX_W + 12;
          textW = LEFT_W - LOGO_MAX_W - 12;
        }
      } catch { /* logo corrompido — usar texto normal */ }
    }

    // Nome da empresa (pode fazer wrap dentro de textW)
    doc.font('B').fontSize(13).fillColor(NAVY);
    const nameH = doc.heightOfString(config.nomeEmpresa || 'Empresa', { width: textW });
    doc.text(config.nomeEmpresa || 'Empresa', textX, leftY + 4, { width: textW });
    leftY += 4 + nameH + 3;

    // NIF
    doc.font('R').fontSize(8.5).fillColor(GRAY)
       .text(`NIF: ${config.nifEmpresa || '—'}`, textX, leftY, { width: textW });
    leftY += 13;

    // Morada (pode fazer wrap)
    if (config.moradaEmpresa) {
      doc.font('R').fontSize(8.5).fillColor(GRAY);
      const moradaH = doc.heightOfString(config.moradaEmpresa, { width: textW });
      doc.text(config.moradaEmpresa, textX, leftY, { width: textW });
      leftY += moradaH + 3;
    }

    // ── Coluna direita: tipo doc + número + data ───────────────
    doc.font('B').fontSize(20).fillColor(NAVY)
       .text(docTypeLabel(factura.documentType).toUpperCase(), rightX, rightY, { width: RIGHT_W, align: 'right', lineBreak: false });
    rightY += 27;

    doc.font('SB').fontSize(11).fillColor(INDIGO)
       .text(factura.documentNo, rightX, rightY, { width: RIGHT_W, align: 'right', lineBreak: false });
    rightY += 17;

    doc.font('R').fontSize(8.5).fillColor(GRAY)
       .text(`Data: ${fmtDate(factura.documentDate)}`, rightX, rightY, { width: RIGHT_W, align: 'right', lineBreak: false });
    rightY += 13;

    if (factura.paymentDue) {
      doc.font('R').fontSize(8.5).fillColor(GRAY)
         .text(`Venc.: ${fmtDate(factura.paymentDue)}`, rightX, rightY, { width: RIGHT_W, align: 'right', lineBreak: false });
      rightY += 13;
    }
    if (factura.paymentMethod) {
      doc.font('R').fontSize(8).fillColor(GRAY)
         .text(factura.paymentMethod, rightX, rightY, { width: RIGHT_W, align: 'right', lineBreak: false });
      rightY += 13;
    }

    // Separador abaixo do conteúdo mais alto
    const minLogoBottom = isSupportedImage(config.logoUrl) ? 18 + LOGO_MAX_H + 4 : 0;
    const headerBottom  = Math.max(leftY, rightY, minLogoBottom) + 12;

    doc.moveTo(MARGIN, headerBottom)
       .lineTo(MARGIN + INNER_W, headerBottom)
       .lineWidth(0.5).strokeColor(BORDER).stroke();

    let y = headerBottom + 14;

    // ═══════════════════════════════════════════════════════════
    // EMITENTE / CLIENTE
    // ═══════════════════════════════════════════════════════════
    const boxW = (INNER_W - 10) / 2;
    const boxH = 80;
    const pad  = 12;

    doc.rect(MARGIN, y, boxW, boxH).fillAndStroke(LIGHT, BORDER);
    doc.font('SB').fontSize(6.5).fillColor(INDIGO)
       .text('EMITENTE', MARGIN + pad, y + pad);
    doc.font('SB').fontSize(9.5).fillColor(NAVY)
       .text(factura.estabelecimento?.nome || config.nomeEmpresa || '—', MARGIN + pad, y + pad + 13, { width: boxW - pad * 2 });
    doc.font('R').fontSize(8).fillColor(GRAY)
       .text(`NIF: ${factura.estabelecimento?.nif || config.nifEmpresa || '—'}`, MARGIN + pad, y + pad + 29, { width: boxW - pad * 2 });
    if (config.moradaEmpresa) {
      doc.font('R').fontSize(7.5).fillColor(GRAY)
         .text(config.moradaEmpresa, MARGIN + pad, y + pad + 42, { width: boxW - pad * 2 });
    }

    const cxBox = MARGIN + boxW + 10;
    doc.rect(cxBox, y, boxW, boxH).fillAndStroke(LIGHT, BORDER);
    doc.font('SB').fontSize(6.5).fillColor(INDIGO)
       .text('CLIENTE', cxBox + pad, y + pad);
    doc.font('SB').fontSize(9.5).fillColor(NAVY)
       .text(factura.customerName || '—', cxBox + pad, y + pad + 13, { width: boxW - pad * 2 });
    doc.font('R').fontSize(8).fillColor(GRAY)
       .text(`NIF: ${factura.customerTaxID || '—'}`, cxBox + pad, y + pad + 29, { width: boxW - pad * 2 });
    if (factura.customerAddress) {
      doc.font('R').fontSize(7.5).fillColor(GRAY)
         .text(factura.customerAddress, cxBox + pad, y + pad + 42, { width: boxW - pad * 2 });
    }

    y += boxH + 16;

    // ═══════════════════════════════════════════════════════════
    // TABELA DE ARTIGOS
    // ═══════════════════════════════════════════════════════════
    const tableW = INNER_W;
    const hdrH   = 24;
    const rowH   = 22;

    const cols = [
      { label: 'Nº',          w: 22,   align: 'center' },
      { label: 'Descrição',   w: null, align: 'left'   },
      { label: 'Qtd.',        w: 40,   align: 'right'  },
      { label: 'Preço Unit.', w: 76,   align: 'right'  },
      { label: 'IVA',         w: 36,   align: 'right'  },
      { label: 'Total',       w: 78,   align: 'right'  },
    ];
    const fixedW = cols.reduce((s, c) => s + (c.w || 0), 0);
    cols[1].w = tableW - fixedW;

    doc.rect(MARGIN, y, tableW, hdrH).fill(NAVY);
    let cx = MARGIN;
    doc.font('SB').fontSize(7.5).fillColor(WHITE);
    for (const col of cols) {
      doc.text(col.label, cx + 5, y + 8, { width: col.w - 10, align: col.align, lineBreak: false });
      cx += col.w;
    }
    y += hdrH;

    lines.forEach((line, idx) => {
      const qty  = Number(line.quantity)  || 0;
      const uprc = Number(line.unitPrice) || 0;
      const sub  = qty * uprc;
      const tax  = line.taxes?.[0]?.taxPercentage ?? 14;
      const tot  = sub * (1 + tax / 100);

      if (y > PAGE_H - 200) { doc.addPage(); y = MARGIN; }

      doc.rect(MARGIN, y, tableW, rowH).fill(idx % 2 === 0 ? WHITE : LIGHT);
      doc.moveTo(MARGIN, y + rowH).lineTo(MARGIN + tableW, y + rowH)
         .lineWidth(0.4).strokeColor(BORDER).stroke();

      cx = MARGIN;
      [
        { v: String(line.lineNumber ?? idx + 1), align: 'center' },
        null,
        { v: fmtNum(qty),  align: 'right' },
        { v: fmtNum(uprc), align: 'right' },
        { v: `${tax}%`,    align: 'right' },
        { v: fmtNum(tot),  align: 'right' },
      ].forEach((val, ci) => {
        const col = cols[ci];
        if (ci === 1) {
          doc.font('SB').fontSize(8.5).fillColor(NAVY)
             .text(line.productDescription || '—', cx + 5, y + 5, { width: col.w - 10, lineBreak: false });
          if (line.productCode) {
            doc.font('R').fontSize(7).fillColor(GRAY)
               .text(line.productCode, cx + 5, y + 15, { width: col.w - 10, lineBreak: false });
          }
        } else if (val) {
          doc.font('R').fontSize(8.5).fillColor(NAVY)
             .text(val.v, cx + 5, y + 7, { width: col.w - 10, align: val.align, lineBreak: false });
        }
        cx += col.w;
      });
      y += rowH;
    });

    // Borda inferior da tabela
    doc.moveTo(MARGIN, y).lineTo(MARGIN + tableW, y).lineWidth(1).strokeColor(NAVY).stroke();
    y += 16;

    // ═══════════════════════════════════════════════════════════
    // TOTAIS
    // ═══════════════════════════════════════════════════════════
    const TOT_W = 215;
    const totX  = PAGE_W - MARGIN - TOT_W;
    const totPad = 10;

    const drawTotRow = (label, value, opts = {}) => {
      const { bold = false, highlight = false, size = 9 } = opts;
      if (highlight) doc.rect(totX, y, TOT_W, 24).fill('#EEF2FF');
      const ty = y + (highlight ? 6 : 4);
      doc.font(bold ? 'SB' : 'R').fontSize(size)
         .fillColor(highlight ? INDIGO : GRAY)
         .text(label, totX + totPad, ty, { width: 118, align: 'left', lineBreak: false });
      doc.font(bold ? 'B' : 'R').fontSize(bold ? size + 1 : size)
         .fillColor(highlight ? INDIGO : NAVY)
         .text(value, totX + totPad + 118, ty, { width: TOT_W - totPad * 2 - 118, align: 'right', lineBreak: false });
      y += highlight ? 24 : 20;
    };

    doc.moveTo(totX, y).lineTo(totX + TOT_W, y).lineWidth(0.5).strokeColor(BORDER).stroke();
    y += 8;
    drawTotRow('Subtotal (sem IVA)', fmtAmount(factura.netTotal, currency));
    drawTotRow('IVA', fmtAmount(factura.taxPayable, currency));
    doc.moveTo(totX, y).lineTo(totX + TOT_W, y).lineWidth(0.5).strokeColor(BORDER).stroke();
    y += 6;
    drawTotRow('TOTAL A PAGAR', fmtAmount(factura.grossTotal, currency), { bold: true, highlight: true, size: 10 });
    if (currency !== 'AOA' && factura.exchangeRate) {
      drawTotRow(
        `Equiv. AOA (câmbio ${factura.exchangeRate})`,
        fmtNum(factura.grossTotal * factura.exchangeRate) + ' Kz',
        { size: 8 }
      );
    }

    y += 12;

    // ═══════════════════════════════════════════════════════════
    // DADOS DE PAGAMENTO
    // ═══════════════════════════════════════════════════════════
    if (ibans.length > 0 || factura.paymentMethod) {
      doc.moveTo(MARGIN, y).lineTo(MARGIN + INNER_W, y).lineWidth(0.4).strokeColor(BORDER).stroke();
      y += 12;
      doc.font('SB').fontSize(7).fillColor(INDIGO).text('DADOS DE PAGAMENTO', MARGIN, y);
      y += 13;
      if (factura.paymentMethod) {
        doc.font('R').fontSize(8.5).fillColor(GRAY)
           .text('Método: ', MARGIN, y, { continued: true, lineBreak: false })
           .font('SB').fillColor(NAVY).text(factura.paymentMethod);
        y += 14;
      }
      ibans.forEach(entry => {
        doc.font('R').fontSize(7.5).fillColor(GRAY)
           .text((entry.label || 'IBAN') + ': ', MARGIN, y, { continued: true, lineBreak: false })
           .font('M').fillColor(NAVY).text(entry.iban);
        y += 13;
      });
    }

    // ═══════════════════════════════════════════════════════════
    // MARCA DE ÁGUA ANULADA / PROFORMA
    // ═══════════════════════════════════════════════════════════
    if (factura.documentStatus === 'A') {
      doc.save();
      doc.rotate(-35, { origin: [PAGE_W / 2, PAGE_H / 2] });
      doc.font('B').fontSize(90).fillColor(RED).opacity(0.07)
         .text('ANULADA', 60, PAGE_H / 2 - 50, { width: PAGE_W - 120, align: 'center' });
      doc.restore().opacity(1);
    }
    if (factura.documentType === 'PF') {
      doc.save();
      doc.rotate(-35, { origin: [PAGE_W / 2, PAGE_H / 2] });
      doc.font('B').fontSize(72).fillColor('#F59E0B').opacity(0.08)
         .text('PROFORMA', 40, PAGE_H / 2 - 40, { width: PAGE_W - 80, align: 'center' });
      doc.restore().opacity(1);
    }

    // ═══════════════════════════════════════════════════════════
    // RODAPÉ — QR CODE + AGT
    // ═══════════════════════════════════════════════════════════
    const footerY = PAGE_H - MARGIN - 118;
    doc.moveTo(MARGIN, footerY).lineTo(MARGIN + INNER_W, footerY)
       .lineWidth(0.5).strokeColor(BORDER).stroke();

    const isProforma = factura.documentType === 'PF';

    if (isProforma) {
      // Rodapé simplificado para Proforma — sem QR nem AGT
      let ay = footerY + 12;
      doc.font('SB').fontSize(8).fillColor('#F59E0B')
         .text('DOCUMENTO PROFORMA — SEM VALIDADE FISCAL', MARGIN, ay, { width: INNER_W, align: 'center' });
      ay += 14;
      doc.font('R').fontSize(7.5).fillColor(GRAY)
         .text('Este documento é uma proposta comercial. Não substitui factura nem tem qualquer efeito fiscal ou legal.', MARGIN, ay, { width: INNER_W, align: 'center' });
      ay += 12;
      if (factura.serie) {
        doc.font('R').fontSize(7.5).fillColor(GRAY)
           .text(`Série: ${factura.serie.seriesCode}/${factura.serie.seriesYear}   ·   Emitido em: ${fmtDate(factura.documentDate)}   ·   ${config.nomeEmpresa || ''} · NIF: ${config.nifEmpresa || ''}`, MARGIN, ay, { width: INNER_W, align: 'center' });
      }
    } else {
      const qrSize = 80;
      const qrX    = PAGE_W - MARGIN - qrSize;
      const qrY    = footerY + 10;

      if (factura.qrCodeImage) {
        try {
          const ci    = factura.qrCodeImage.indexOf(',');
          const qrBuf = Buffer.from(ci >= 0 ? factura.qrCodeImage.slice(ci + 1) : factura.qrCodeImage, 'base64');
          if (isValidImageBuffer(qrBuf, 'image/png')) {
            doc.image(qrBuf, qrX, qrY, { fit: [qrSize, qrSize] });
            doc.font('R').fontSize(6).fillColor(GRAY)
               .text('Consultar em AGT', qrX, qrY + qrSize + 3, { width: qrSize, align: 'center' });
          }
        } catch { /* qr inválido */ }
      }

      const agtW = INNER_W - qrSize - 16;
      let ay = footerY + 12;
      doc.font('SB').fontSize(7).fillColor(INDIGO).text('INFORMAÇÕES AGT', MARGIN, ay);
      ay += 13;
      doc.font('R').fontSize(8).fillColor(NAVY);
      if (factura.serie) {
        doc.text(
          `Série: ${factura.serie.seriesCode}/${factura.serie.seriesYear}   ·   Tipo: ${docTypeLabel(factura.documentType)}`,
          MARGIN, ay, { width: agtW }
        );
        ay += 12;
      }
      doc.text(
        `Estado AGT: ${agtStatusLabel(factura.agtValidationStatus)}${config.agtMockMode ? '  (modo MOCK)' : ''}`,
        MARGIN, ay, { width: agtW }
      );
      ay += 12;
      if (factura.agtRequestId) {
        doc.font('R').fontSize(7.5).fillColor(GRAY)
           .text(`Request ID: ${factura.agtRequestId}`, MARGIN, ay, { width: agtW });
        ay += 11;
      }
      if (factura.jwsSignature && factura.jwsSignature !== 'PLACEHOLDER') {
        doc.font('R').fontSize(6.5).fillColor(GRAY)
           .text(`Assinatura: ${factura.jwsSignature.substring(0, 50)}...`, MARGIN, ay, { width: agtW });
      }
    }

    // Rodapé legal
    const legalY = PAGE_H - MARGIN - 14;
    doc.moveTo(0, legalY - 6).lineTo(PAGE_W, legalY - 6)
       .lineWidth(0.4).strokeColor(BORDER).stroke();
    doc.font('R').fontSize(6.5).fillColor(GRAY)
       .text(
         isProforma
           ? `Proposta comercial emitida por ${config.nomeEmpresa || ''} · NIF: ${config.nifEmpresa || ''} · Documento sem efeito fiscal`
           : `Documento processado por programa informático certificado · Nº Cert.: ${config.agtCertNumber || 'PENDENTE'} · ${config.nomeEmpresa || ''} · NIF: ${config.nifEmpresa || ''}`,
         MARGIN, legalY, { width: INNER_W, align: 'center' }
       );

    doc.end();
  });
}

module.exports = { generateFacturaPDF };
