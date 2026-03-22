const prisma = require('../prisma');

/**
 * Obtém o próximo número de documento para uma série.
 * Usa transação para garantir atomicidade e evitar duplicados.
 * @param {string} serieId
 * @returns {Promise<{ documentNo: string, serie: object }>}
 */
async function getNextDocumentNumber(serieId) {
  return prisma.$transaction(async (tx) => {
    const serie = await tx.serie.findUnique({
      where: { id: serieId },
    });

    if (!serie) throw new Error('Série não encontrada');
    if (serie.seriesStatus === 'F') throw new Error('Série está fechada');

    const nextNumber = (serie.lastDocumentNumber ?? serie.firstDocumentNumber - 1) + 1;

    const updated = await tx.serie.update({
      where: { id: serieId },
      data: {
        lastDocumentNumber: nextNumber,
        seriesStatus: 'U',
      },
    });

    // Formato: "CODIGO ANO/NUMERO" — ex: "25 2026/1"
    const documentNo = `${updated.seriesCode} ${updated.seriesYear}/${nextNumber}`;

    return { documentNo, serie: updated, nextNumber };
  });
}

module.exports = { getNextDocumentNumber };
