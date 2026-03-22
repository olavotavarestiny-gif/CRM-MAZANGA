const QRCode = require('qrcode');
const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');

/**
 * Gera QR Code com logo AGT (se disponível).
 * Retorna base64 PNG "data:image/png;base64,..."
 */
async function generateQRCode(documentNo) {
  try {
    const url = `https://portaldocontribuinte.minfin.gov.ao/consultar-fe?documentNo=${encodeURIComponent(documentNo)}`;

    // Gerar QR Code base em buffer
    const qrBuffer = await QRCode.toBuffer(url, {
      errorCorrectionLevel: 'M',
      type: 'png',
      width: 350,
      margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' },
    });

    // Tentar adicionar logo AGT se existir
    const logoPath = path.join(process.cwd(), 'public', 'assets', 'agt-logo.png');
    if (fs.existsSync(logoPath)) {
      const qrImage = await Jimp.read(qrBuffer);
      const logo = await Jimp.read(logoPath);
      const logoSize = 70; // 20% de 350
      logo.resize(logoSize, logoSize);
      const x = Math.floor((350 - logoSize) / 2);
      const y = Math.floor((350 - logoSize) / 2);
      qrImage.composite(logo, x, y);
      const base64 = await qrImage.getBase64Async(Jimp.MIME_PNG);
      return base64;
    }

    // Sem logo: retornar QR simples em base64
    const base64 = `data:image/png;base64,${qrBuffer.toString('base64')}`;
    return base64;
  } catch (err) {
    console.error('Erro ao gerar QR Code:', err);
    return null;
  }
}

/**
 * Gera URL do QR Code para uma factura.
 */
function getQRCodeUrl(documentNo) {
  return `https://portaldocontribuinte.minfin.gov.ao/consultar-fe?documentNo=${encodeURIComponent(documentNo)}`;
}

module.exports = { generateQRCode, getQRCodeUrl };
