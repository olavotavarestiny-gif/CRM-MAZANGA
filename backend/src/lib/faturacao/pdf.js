'use strict';

const PDFDocument = require('pdfkit');
const path        = require('path');

// ── Fontes Inter (suporte completo a caracteres portugueses) ──
const FONT_BASE     = path.join(__dirname, '..', '..', '..', 'node_modules', '@expo-google-fonts', 'inter');
const FONT_REGULAR  = path.join(FONT_BASE, '400Regular',  'Inter_400Regular.ttf');
const FONT_MEDIUM   = path.join(FONT_BASE, '500Medium',   'Inter_500Medium.ttf');
const FONT_SEMIBOLD = path.join(FONT_BASE, '600SemiBold', 'Inter_600SemiBold.ttf');
const FONT_BOLD     = path.join(FONT_BASE, '700Bold',     'Inter_700Bold.ttf');

// ── Paleta de cores ──────────────────────────────────────────
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

function fmtAmount(n, currencyCode = 'AOA') {
  const sym = { AOA: 'Kz', USD: 'USD ', EUR: '€ ', GBP: '£ ', CHF: 'Fr ', CNY: '¥ ' }[currencyCode] ?? (currencyCode + ' ');
  if (currencyCode === 'AOA') return fmtNum(n) + ' Kz';
  return sym + fmtNum(n);
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function docTypeLabel(t) {
  return {
    FT: 'Factura', FR: 'Factura/Recibo', ND: 'Nota de Débito',
    NC: 'Nota de Crédito', FA: 'Factura Simplificada',
  }[t] || t;
}

function agtStatusLabel(s) {
  return { P: 'Pendente AGT', V: 'Válida', I: 'Inválida', A: 'Anulada' }[s] || s;
}

/** Detecta se o logoUrl é um formato suportado pelo PDFKit (PNG / JPEG / WebP) */
function isSupportedImage(logoUrl) {
  if (!logoUrl || !logoUrl.startsWith('data:image')) return false;
  const mime = logoUrl.split(';')[0].replace('data:', '').toLowerCase();
  return ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(mime);
}

// ── Gerador principal ─────────────────────────────────────────
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

    // Registar fontes
    doc.registerFont('R',  FONT_REGULAR);
    doc.registerFont('M',  FONT_MEDIUM);
    doc.registerFont('SB', FONT_SEMIBOLD);
    doc.registerFont('B',  FONT_BOLD);

    const chunks = [];
    doc.on('data',  c => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const lines    = Array.isArray(factura.lines) ? factura.lines : JSON.parse(factura.lines || '[]');
    const ibans    = (() => { try { return config.iban ? JSON.parse(config.iban) : []; } catch { return config.iban ? [{ label: 'Principal', iban: config.iban }] : []; } })();
    const currency = factura.currencyCode || 'AOA';

    // ═══════════════════════════════════════════════════════════
    // BARRA DE TOPO (accent strip)
    // ═══════════════════════════════════════════════════════════
    doc.rect(0, 0, PAGE_W, 5).fill(NAVY);

    // ═══════════════════════════════════════════════════════════
    // CABEÇALHO  (y=20 … ~130)
    // ═══════════════════════════════════════════════════════════
    let y = 20;

    // — Logo (canto esquerdo) —
    const logoMaxW = 90;
    const logoMaxH = 60;
    let logoBottomX = MARGIN; // X após o logo
    if (isSupportedImage(config.logoUrl)) {
      try {
        const commaIdx = config.logoUrl.indexOf(',');
        const imgBuf   = Buffer.from(config.logoUrl.slice(commaIdx + 1), 'base64');
        doc.image(imgBuf, MARGIN, y, { fit: [logoMaxW, logoMaxH], align: 'left', valign: 'center' });
        logoBottomX = MARGIN + logoMaxW + 14;
      } catch { /* logo corrompido — ignorar */ }
    }

    // — Dados da empresa (ao lado do logo) —
    const companyX = logoBottomX;
    const companyW = INNER_W * 0.52 - logoMaxW;
    doc.font('B').fontSize(14).fillColor(NAVY)
       .text(config.nomeEmpresa || 'Empresa', companyX, y + 4, { width: companyW, lineBreak: false });
    doc.font('R').fontSize(8.5).fillColor(GRAY)
       .text(`NIF: ${config.nifEmpresa || '—'}`, companyX, y + 23, { width: companyW });
    if (config.moradaEmpresa) {
      doc.font('R').fontSize(8.5).fillColor(GRAY)
         .text(config.moradaEmpresa, companyX, y + 35, { width: companyW });
    }

    // — Tipo de documento + número (canto direito) —
    const rightBlockW = 185;
    const rightX      = PAGE_W - MARGIN - rightBlockW;
    doc.font('B').fontSize(22).fillColor(NAVY)
       .text(docTypeLabel(factura.documentType).toUpperCase(), rightX, y + 2, { width: rightBlockW, align: 'right' });
    doc.font('SB').fontSize(11).fillColor(INDIGO)
       .text(factura.documentNo, rightX, y + 30, { width: rightBlockW, align: 'right' });
    doc.font('R').fontSize(8.5).fillColor(GRAY)
       .text(`Data: ${fmtDate(factura.documentDate)}`, rightX, y + 46, { width: rightBlockW, align: 'right' });
    if (factura.paymentDue) {
      doc.font('R').fontSize(8.5).fillColor(GRAY)
         .text(`Vencimento: ${fmtDate(factura.paymentDue)}`, rightX, y + 58, { width: rightBlockW, align: 'right' });
    }
    if (factura.paymentMethod) {
      doc.font('R').fontSize(8.5).fillColor(GRAY)
         .text(factura.paymentMethod, rightX, y + 70, { width: rightBlockW, align: 'right' });
    }

    y = 130;
    // Linha separadora
    doc.moveTo(MARGIN, y).lineTo(MARGIN + INNER_W, y).lineWidth(0.5).strokeColor(BORDER).stroke();
    y += 14;

    // ═══════════════════════════════════════════════════════════
    // EMITENTE / CLIENTE  (dois cartões lado a lado)
    // ═══════════════════════════════════════════════════════════
    const boxW  = (INNER_W - 10) / 2;
    const boxH  = 80;
    const pad   = 12;

    // Emitente
    doc.rect(MARGIN, y, boxW, boxH).fillAndStroke(LIGHT, BORDER);
    doc.font('SB').fontSize(6.5).fillColor(INDIGO)
       .text('EMITENTE', MARGIN + pad, y + pad);
    doc.font('SB').fontSize(9.5).fillColor(NAVY)
       .text(factura.estabelecimento?.nome || config.nomeEmpresa || '—', MARGIN + pad, y + pad + 13, { width: boxW - pad * 2 });
    doc.font('R').fontSize(8).fillColor(GRAY)
       .text(`NIF: ${factura.estabelecimento?.nif || config.nifEmpresa || '—'}`, MARGIN + pad, y + pad + 28, { width: boxW - pad * 2 });
    if (config.moradaEmpresa) {
      doc.font('R').fontSize(7.5).fillColor(GRAY)
         .text(config.moradaEmpresa, MARGIN + pad, y + pad + 40, { width: boxW - pad * 2 });
    }

    // Cliente
    const cxBox = MARGIN + boxW + 10;
    doc.rect(cxBox, y, boxW, boxH).fillAndStroke(LIGHT, BORDER);
    doc.font('SB').fontSize(6.5).fillColor(INDIGO)
       .text('CLIENTE', cxBox + pad, y + pad);
    doc.font('SB').fontSize(9.5).fillColor(NAVY)
       .text(factura.customerName || '—', cxBox + pad, y + pad + 13, { width: boxW - pad * 2 });
    doc.font('R').fontSize(8).fillColor(GRAY)
       .text(`NIF: ${factura.customerTaxID || '—'}`, cxBox + pad, y + pad + 28, { width: boxW - pad * 2 });
    if (factura.customerAddress) {
      doc.font('R').fontSize(7.5).fillColor(GRAY)
         .text(factura.customerAddress, cxBox + pad, y + pad + 40, { width: boxW - pad * 2 });
    }

    y += boxH + 16;

    // ═══════════════════════════════════════════════════════════
    // TABELA DE ARTIGOS
    // ═══════════════════════════════════════════════════════════
    const tableX = MARGIN;
    const tableW = INNER_W;
    const hdrH   = 24;
    const rowH   = 22;

    // Definição das colunas
    const cols = [
      { label: 'Nº',              w: 22,   align: 'center' },
      { label: 'Descrição',       w: null, align: 'left'   },
      { label: 'Qtd.',            w: 40,   align: 'right'  },
      { label: 'Preço Unit.',     w: 75,   align: 'right'  },
      { label: 'IVA',             w: 36,   align: 'right'  },
      { label: 'Total',           w: 78,   align: 'right'  },
    ];
    const fixedW = cols.reduce((s, c) => s + (c.w || 0), 0);
    cols[1].w = tableW - fixedW;

    // Cabeçalho da tabela
    doc.rect(tableX, y, tableW, hdrH).fill(NAVY);
    let cx = tableX;
    doc.font('SB').fontSize(7.5).fillColor(WHITE);
    for (const col of cols) {
      doc.text(col.label, cx + 5, y + 7, { width: col.w - 10, align: col.align, lineBreak: false });
      cx += col.w;
    }
    y += hdrH;

    // Linhas de artigos
    lines.forEach((line, idx) => {
      const qty  = Number(line.quantity)  || 0;
      const uprc = Number(line.unitPrice) || 0;
      const sub  = qty * uprc;
      const tax  = line.taxes?.[0]?.taxPercentage ?? 14;
      const tot  = sub * (1 + tax / 100);

      // Nova página se necessário
      if (y > PAGE_H - 200) {
        doc.addPage();
        y = MARGIN;
      }

      // Fundo alternado
      const bg = idx % 2 === 0 ? WHITE : LIGHT;
      doc.rect(tableX, y, tableW, rowH).fill(bg);

      // Linha separadora inferior subtil
      doc.moveTo(tableX, y + rowH).lineTo(tableX + tableW, y + rowH)
         .lineWidth(0.4).strokeColor(BORDER).stroke();

      cx = tableX;
      const vals = [
        { v: String(line.lineNumber ?? idx + 1), align: 'center' },
        null, // descrição tratada em separado
        { v: fmtNum(qty),   align: 'right' },
        { v: fmtNum(uprc),  align: 'right' },
        { v: `${tax}%`,     align: 'right' },
        { v: fmtNum(tot),   align: 'right' },
      ];

      vals.forEach((val, ci) => {
        const col = cols[ci];
        if (ci === 1) {
          // Descrição com código em linha inferior
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
    doc.moveTo(tableX, y).lineTo(tableX + tableW, y)
       .lineWidth(1).strokeColor(NAVY).stroke();

    y += 14;

    // ═══════════════════════════════════════════════════════════
    // TOTAIS (coluna direita)
    // ═══════════════════════════════════════════════════════════
    const totW  = 215;
    const totX  = PAGE_W - MARGIN - totW;
    const totPad = 10;

    const drawTotRow = (label, value, opts = {}) => {
      const { bold = false, highlight = false, size = 9 } = opts;
      if (highlight) {
        doc.rect(totX, y, totW, 24).fill('#EEF2FF');
      }
      const rowY = y + (highlight ? 6 : 4);
      doc.font(bold ? 'SB' : 'R').fontSize(size)
         .fillColor(highlight ? INDIGO : GRAY)
         .text(label, totX + totPad, rowY, { width: 115, align: 'left', lineBreak: false });
      doc.font(bold ? 'B' : 'R').fontSize(bold ? size + 1 : size)
         .fillColor(highlight ? INDIGO : NAVY)
         .text(value, totX + totPad + 115, rowY, { width: totW - totPad * 2 - 115, align: 'right', lineBreak: false });
      y += highlight ? 24 : 20;
    };

    doc.moveTo(totX, y).lineTo(totX + totW, y).lineWidth(0.5).strokeColor(BORDER).stroke();
    y += 8;
    drawTotRow('Subtotal (sem IVA)', fmtAmount(factura.netTotal, currency));
    drawTotRow('IVA', fmtAmount(factura.taxPayable, currency));
    doc.moveTo(totX, y).lineTo(totX + totW, y).lineWidth(0.5).strokeColor(BORDER).stroke();
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
    // DADOS DE PAGAMENTO (coluna esquerda)
    // ═══════════════════════════════════════════════════════════
    if (ibans.length > 0 || factura.paymentMethod) {
      const payY0 = y - (ibans.length * 15 + (factura.paymentMethod ? 30 : 14));
      let py = payY0;
      doc.font('SB').fontSize(7).fillColor(INDIGO)
         .text('DADOS DE PAGAMENTO', MARGIN, py);
      py += 13;
      if (factura.paymentMethod) {
        doc.font('R').fontSize(8.5).fillColor(GRAY)
           .text(`Método: `, MARGIN, py, { continued: true, lineBreak: false })
           .font('SB').fillColor(NAVY)
           .text(factura.paymentMethod);
        py += 14;
      }
      ibans.forEach(entry => {
        doc.font('R').fontSize(7.5).fillColor(GRAY)
           .text((entry.label || 'IBAN') + ': ', MARGIN, py, { continued: true, lineBreak: false })
           .font('M').fillColor(NAVY)
           .text(entry.iban);
        py += 13;
      });
    }

    // ═══════════════════════════════════════════════════════════
    // MARCA DE ÁGUA "ANULADA"
    // ═══════════════════════════════════════════════════════════
    if (factura.documentStatus === 'A') {
      doc.save();
      doc.rotate(-35, { origin: [PAGE_W / 2, PAGE_H / 2] });
      doc.font('B').fontSize(90).fillColor(RED).opacity(0.08)
         .text('ANULADA', 60, PAGE_H / 2 - 50, { width: PAGE_W - 120, align: 'center' });
      doc.restore().opacity(1);
    }

    // ═══════════════════════════════════════════════════════════
    // RODAPÉ — AGT + QR CODE
    // ═══════════════════════════════════════════════════════════
    const footerY  = PAGE_H - MARGIN - 115;
    doc.moveTo(MARGIN, footerY).lineTo(MARGIN + INNER_W, footerY)
       .lineWidth(0.5).strokeColor(BORDER).stroke();

    // QR Code (direita)
    const qrSize = 82;
    const qrX    = PAGE_W - MARGIN - qrSize;
    const qrY    = footerY + 10;
    if (factura.qrCodeImage) {
      try {
        const ci    = factura.qrCodeImage.indexOf(',');
        const qrBuf = Buffer.from(ci >= 0 ? factura.qrCodeImage.slice(ci + 1) : factura.qrCodeImage, 'base64');
        doc.image(qrBuf, qrX, qrY, { fit: [qrSize, qrSize] });
        doc.font('R').fontSize(6).fillColor(GRAY)
           .text('Consultar em AGT', qrX, qrY + qrSize + 3, { width: qrSize, align: 'center' });
      } catch { /* qr inválido */ }
    }

    // Informações AGT (esquerda do rodapé)
    const agtW = INNER_W - qrSize - 16;
    let ay     = footerY + 12;

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
         .text(`Assinatura: ${factura.jwsSignature.substring(0, 48)}...`, MARGIN, ay, { width: agtW });
    }

    // ── Rodapé legal ─────────────────────────────────────────
    const legalY = PAGE_H - MARGIN - 14;
    doc.moveTo(0, legalY - 6).lineTo(PAGE_W, legalY - 6)
       .lineWidth(0.4).strokeColor(BORDER).stroke();
    doc.font('R').fontSize(6.5).fillColor(GRAY)
       .text(
         `Documento processado por programa informático certificado · Nº Certificado: ${config.agtCertNumber || 'PENDENTE'} · ${config.nomeEmpresa || ''} · NIF: ${config.nifEmpresa || ''}`,
         MARGIN, legalY,
         { width: INNER_W, align: 'center' }
       );

    doc.end();
  });
}

module.exports = { generateFacturaPDF };
