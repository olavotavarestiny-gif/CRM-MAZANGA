'use strict';

const PDFDocument = require('pdfkit');

// ── Cores & constantes ────────────────────────────────────────
const NAVY   = '#0A2540';
const VIOLET = '#7C3AED';
const GRAY   = '#6B7280';
const LIGHT  = '#F3F4F6';
const WHITE  = '#FFFFFF';
const RED    = '#DC2626';

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 45;
const COL_W  = (PAGE_W - MARGIN * 2) / 2; // largura de cada metade

// ── Helpers ───────────────────────────────────────────────────
function fmtNum(n, decimals = 2) {
  if (typeof n !== 'number' || isNaN(n)) return '0.00';
  return n.toLocaleString('pt-PT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtAmount(n, currencyCode = 'AOA') {
  const SYMBOLS = { AOA: 'Kz', USD: '$', EUR: '€', GBP: '£', CHF: 'Fr', CNY: '¥' };
  const sym = SYMBOLS[currencyCode] ?? currencyCode;
  if (currencyCode === 'AOA') return fmtNum(n) + ' Kz';
  return sym + ' ' + fmtNum(n);
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function agtStatusLabel(s) {
  return { P: 'Pendente AGT', V: 'Válida', I: 'Inválida', A: 'Anulada' }[s] || s;
}

function docTypeLabel(t) {
  return { FT: 'Factura', FR: 'Factura/Recibo', ND: 'Nota de Débito', NC: 'Nota de Crédito', FA: 'Factura Simplificada' }[t] || t;
}

// ── Gerador principal ─────────────────────────────────────────
async function generateFacturaPDF(factura, config) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      info: {
        Title: `Factura ${factura.documentNo}`,
        Author: config.nomeEmpresa || 'Mazanga CRM',
        Creator: 'Mazanga CRM',
      },
    });

    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const lines = Array.isArray(factura.lines) ? factura.lines : JSON.parse(factura.lines || '[]');
    const ibans = (() => { try { return config.iban ? JSON.parse(config.iban) : []; } catch { return config.iban ? [{ label: 'Principal', iban: config.iban }] : []; } })();
    const currency = factura.currencyCode || 'AOA';

    // ── HEADER ──────────────────────────────────────────────────
    const headerTop = MARGIN;
    const headerHeight = 90;

    // Fundo do header
    doc.rect(0, 0, PAGE_W, headerTop + headerHeight + 10).fill(NAVY);

    // Logo (esquerda)
    let logoEndX = MARGIN;
    if (config.logoUrl && config.logoUrl.startsWith('data:image')) {
      try {
        const commaIdx = config.logoUrl.indexOf(',');
        const imgData = Buffer.from(config.logoUrl.slice(commaIdx + 1), 'base64');
        doc.image(imgData, MARGIN, headerTop + 8, { fit: [70, 50], align: 'left', valign: 'center' });
        logoEndX = MARGIN + 80;
      } catch {
        // logo inválido — ignorar
      }
    }

    // Nome empresa + NIF (centro-esquerda)
    doc.fillColor(WHITE)
       .font('Helvetica-Bold').fontSize(13)
       .text(config.nomeEmpresa || 'Empresa', logoEndX, headerTop + 12, { width: COL_W - 20 });
    doc.font('Helvetica').fontSize(9).fillColor('#C7D2E0')
       .text(`NIF: ${config.nifEmpresa || '—'}`, logoEndX, headerTop + 30, { width: COL_W - 20 });
    if (config.moradaEmpresa) {
      doc.text(config.moradaEmpresa, logoEndX, headerTop + 43, { width: COL_W - 20 });
    }

    // Tipo doc + número (direita)
    const rightX = PAGE_W - MARGIN - 160;
    doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(18)
       .text(docTypeLabel(factura.documentType), rightX, headerTop + 10, { width: 160, align: 'right' });
    doc.font('Helvetica').fontSize(11).fillColor('#C7D2E0')
       .text(factura.documentNo, rightX, headerTop + 34, { width: 160, align: 'right' });
    doc.fontSize(9)
       .text(fmtDate(factura.documentDate), rightX, headerTop + 51, { width: 160, align: 'right' });
    if (factura.paymentMethod) {
      doc.text(factura.paymentMethod, rightX, headerTop + 64, { width: 160, align: 'right' });
    }

    // Status ANULADA
    if (factura.documentStatus === 'A') {
      doc.save();
      doc.rotate(-30, { origin: [PAGE_W / 2, PAGE_H / 2] });
      doc.fillColor(RED).opacity(0.15)
         .font('Helvetica-Bold').fontSize(80)
         .text('ANULADA', 100, PAGE_H / 2 - 40, { width: PAGE_W - 200, align: 'center' });
      doc.restore().opacity(1);
    }

    let y = headerTop + headerHeight + 20;

    // ── EMITENTE / CLIENTE ────────────────────────────────────
    const boxH = 85;
    doc.rect(MARGIN, y, COL_W - 6, boxH).fillAndStroke('#F8FAFC', '#E5E7EB');
    doc.rect(MARGIN + COL_W + 6, y, COL_W - 6, boxH).fillAndStroke('#F8FAFC', '#E5E7EB');

    // Emitente
    doc.fillColor(GRAY).font('Helvetica-Bold').fontSize(7.5)
       .text('EMITENTE', MARGIN + 10, y + 8);
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(10)
       .text(factura.estabelecimento?.nome || config.nomeEmpresa || '—', MARGIN + 10, y + 20, { width: COL_W - 26 });
    doc.fillColor(GRAY).font('Helvetica').fontSize(8.5)
       .text(`NIF: ${factura.estabelecimento?.nif || config.nifEmpresa || '—'}`, MARGIN + 10, y + 35, { width: COL_W - 26 });
    if (config.moradaEmpresa) {
      doc.text(config.moradaEmpresa, MARGIN + 10, y + 47, { width: COL_W - 26 });
    }

    // Cliente
    const cx = MARGIN + COL_W + 16;
    doc.fillColor(GRAY).font('Helvetica-Bold').fontSize(7.5)
       .text('CLIENTE', cx, y + 8);
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(10)
       .text(factura.customerName || '—', cx, y + 20, { width: COL_W - 26 });
    doc.fillColor(GRAY).font('Helvetica').fontSize(8.5)
       .text(`NIF: ${factura.customerTaxID || '—'}`, cx, y + 35, { width: COL_W - 26 });
    if (factura.customerAddress) {
      doc.text(factura.customerAddress, cx, y + 47, { width: COL_W - 26 });
    }

    y += boxH + 18;

    // ── TABELA DE ARTIGOS ─────────────────────────────────────
    const tableX = MARGIN;
    const tableW = PAGE_W - MARGIN * 2;

    // Colunas: nº, descrição, qtd, preço unit, iva%, total
    const cols = [
      { label: 'Nº',         w: 25,  align: 'right'  },
      { label: 'Descrição',  w: null, align: 'left'   }, // fill restante
      { label: 'Qtd.',       w: 42,  align: 'right'  },
      { label: 'Preço Unit.',w: 72,  align: 'right'  },
      { label: 'IVA%',       w: 38,  align: 'right'  },
      { label: 'Total',      w: 75,  align: 'right'  },
    ];
    const fixedW = cols.reduce((s, c) => s + (c.w || 0), 0);
    cols[1].w = tableW - fixedW;

    // Header da tabela
    const rowH = 22;
    doc.rect(tableX, y, tableW, rowH).fill(NAVY);
    let cx2 = tableX;
    doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(8);
    for (const col of cols) {
      doc.text(col.label, cx2 + 4, y + 7, { width: col.w - 8, align: col.align });
      cx2 += col.w;
    }
    y += rowH;

    // Linhas
    doc.font('Helvetica').fontSize(8.5);
    lines.forEach((line, idx) => {
      const sub = Number(line.quantity) * Number(line.unitPrice);
      const tax = line.taxes?.[0]?.taxPercentage ?? 14;
      const total = sub * (1 + tax / 100);

      if (y > PAGE_H - 180) {
        doc.addPage();
        y = MARGIN;
      }

      const bg = idx % 2 === 0 ? WHITE : LIGHT;
      doc.rect(tableX, y, tableW, rowH).fill(bg);

      cx2 = tableX;
      const vals = [
        { v: String(line.lineNumber ?? idx + 1),         align: 'right'  },
        { v: `${line.productDescription}\n${line.productCode ? line.productCode : ''}`, align: 'left' },
        { v: fmtNum(line.quantity),                       align: 'right'  },
        { v: fmtNum(line.unitPrice),                      align: 'right'  },
        { v: `${tax}%`,                                   align: 'right'  },
        { v: fmtNum(total),                               align: 'right'  },
      ];

      doc.fillColor(NAVY);
      vals.forEach((val, ci) => {
        const col = cols[ci];
        if (ci === 1) {
          // descrição — duas linhas se tiver código
          doc.fontSize(8.5).font('Helvetica-Bold')
             .text(line.productDescription, cx2 + 4, y + 5, { width: col.w - 8, lineBreak: false });
          if (line.productCode) {
            doc.fontSize(7).font('Helvetica').fillColor(GRAY)
               .text(line.productCode, cx2 + 4, y + 14, { width: col.w - 8, lineBreak: false });
            doc.fillColor(NAVY).fontSize(8.5).font('Helvetica');
          }
        } else {
          doc.fontSize(8.5).font('Helvetica')
             .text(val.v, cx2 + 4, y + 7, { width: col.w - 8, align: val.align, lineBreak: false });
        }
        cx2 += col.w;
      });

      // linha separadora subtil
      doc.moveTo(tableX, y + rowH).lineTo(tableX + tableW, y + rowH).stroke('#E5E7EB');
      y += rowH;
    });

    y += 8;

    // ── TOTAIS ───────────────────────────────────────────────
    const totalsX = PAGE_W - MARGIN - 230;
    const totalsW = 230;

    const drawTotalRow = (label, value, bold = false, color = NAVY, bg = null) => {
      if (bg) doc.rect(totalsX, y, totalsW, 20).fill(bg);
      doc.fillColor(GRAY).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9)
         .text(label, totalsX + 8, y + 5, { width: 130, align: 'left' });
      doc.fillColor(color).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 10 : 9)
         .text(value, totalsX + 140, y + 5, { width: totalsW - 150, align: 'right' });
      y += 20;
    };

    doc.rect(totalsX - 1, y, totalsW + 2, 1).fill('#E5E7EB');
    y += 6;
    drawTotalRow('Total sem IVA', fmtAmount(factura.netTotal, currency));
    drawTotalRow('IVA', fmtAmount(factura.taxPayable, currency));
    doc.rect(totalsX, y, totalsW, 1).fill('#E5E7EB'); y += 5;
    drawTotalRow('TOTAL COM IVA', fmtAmount(factura.grossTotal, currency), true, VIOLET, '#F5F3FF');

    if (currency !== 'AOA' && factura.exchangeRate) {
      y += 4;
      drawTotalRow(
        `Equiv. AOA (taxa ${factura.exchangeRate})`,
        fmtNum(factura.grossTotal * factura.exchangeRate) + ' Kz',
        false, GRAY
      );
    }

    y += 16;

    // ── PAGAMENTO & IBANs ────────────────────────────────────
    if (factura.paymentMethod || ibans.length > 0) {
      doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, 1).fill('#E5E7EB');
      y += 10;
      doc.fillColor(GRAY).font('Helvetica-Bold').fontSize(8)
         .text('DADOS DE PAGAMENTO', MARGIN, y);
      y += 13;
      if (factura.paymentMethod) {
        doc.fillColor(NAVY).font('Helvetica').fontSize(9)
           .text(`Método: ${factura.paymentMethod}`, MARGIN, y);
        y += 13;
      }
      ibans.forEach(entry => {
        doc.fillColor(GRAY).font('Helvetica').fontSize(8.5)
           .text(entry.label ? `${entry.label}: ` : 'IBAN: ', MARGIN, y, { continued: true })
           .fillColor(NAVY).font('Helvetica-Bold')
           .text(entry.iban);
        y += 13;
      });
      y += 6;
    }

    // ── RODAPÉ AGT + QR CODE ─────────────────────────────────
    const footerY = PAGE_H - MARGIN - 110;
    doc.rect(MARGIN, footerY, PAGE_W - MARGIN * 2, 1).fill('#E5E7EB');

    // QR Code (direita)
    const qrSize = 85;
    const qrX = PAGE_W - MARGIN - qrSize;
    const qrY = footerY + 8;
    if (factura.qrCodeImage) {
      try {
        const commaIdx = factura.qrCodeImage.indexOf(',');
        const imgData = Buffer.from(
          commaIdx >= 0 ? factura.qrCodeImage.slice(commaIdx + 1) : factura.qrCodeImage,
          'base64'
        );
        doc.image(imgData, qrX, qrY, { fit: [qrSize, qrSize] });
      } catch { /* qr inválido */ }
    }

    // Info AGT (esquerda do rodapé)
    const agtInfoW = PAGE_W - MARGIN * 2 - qrSize - 15;
    let ay = footerY + 10;
    doc.fillColor(GRAY).font('Helvetica-Bold').fontSize(7.5).text('INFORMAÇÕES AGT', MARGIN, ay);
    ay += 12;
    doc.fillColor(NAVY).font('Helvetica').fontSize(8);

    if (factura.serie) {
      doc.text(`Série: ${factura.serie.seriesCode}/${factura.serie.seriesYear}  ·  Tipo: ${factura.documentType}`, MARGIN, ay, { width: agtInfoW });
      ay += 12;
    }
    doc.text(`Estado AGT: ${agtStatusLabel(factura.agtValidationStatus)}${config.agtMockMode ? ' (MOCK)' : ''}`, MARGIN, ay, { width: agtInfoW });
    ay += 12;
    if (factura.agtRequestId) {
      doc.text(`Request ID: ${factura.agtRequestId}`, MARGIN, ay, { width: agtInfoW });
      ay += 12;
    }
    if (factura.jwsSignature && factura.jwsSignature !== 'PLACEHOLDER') {
      doc.fillColor(GRAY).fontSize(7)
         .text(`JWS: ${factura.jwsSignature.substring(0, 40)}...`, MARGIN, ay, { width: agtInfoW });
      ay += 11;
    }

    // Texto legal (base da página)
    const legalY = PAGE_H - MARGIN - 18;
    doc.rect(0, legalY - 6, PAGE_W, 1).fill('#E5E7EB');
    doc.fillColor(GRAY).font('Helvetica').fontSize(7)
       .text(
         `Documento processado por programa informático certificado — Nº Certificado: ${config.agtCertNumber || 'PENDING'}  ·  ${config.nomeEmpresa || ''}  ·  NIF: ${config.nifEmpresa || ''}`,
         MARGIN, legalY,
         { width: PAGE_W - MARGIN * 2, align: 'center' }
       );

    doc.end();
  });
}

module.exports = { generateFacturaPDF };
