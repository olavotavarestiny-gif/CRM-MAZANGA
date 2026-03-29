function normalizeText(value = '') {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP_WORDS = new Set([
  'LOJA',
  'SHOP',
  'FILIAL',
  'UNIDADE',
  'PONTO',
  'VENDA',
  'VENDAS',
  'LDA',
  'LIMITADA',
  'STORE',
  'EMPRESA',
  'COMERCIAL',
  'COMERCIO',
  'COMERCIOE',
  'DE',
  'DA',
  'DO',
  'DOS',
  'DAS',
  'E',
  'AO',
  'A',
  'O',
]);

function tokenize(value = '') {
  return normalizeText(value)
    .split(/[\s,-]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !STOP_WORDS.has(token));
}

function deriveBaseSeriesCode({ nome = '', morada = '' }) {
  const primaryTokens = tokenize(nome);
  const fallbackTokens = tokenize(morada);
  const candidateToken = [...primaryTokens, ...fallbackTokens].find((token) => token.length >= 3);

  if (candidateToken) {
    return candidateToken.slice(0, 3);
  }

  const sourceTokens = primaryTokens.length > 0 ? primaryTokens : fallbackTokens;
  if (sourceTokens.length > 0) {
    const initials = sourceTokens.slice(0, 3).map((token) => token[0]).join('');
    if (initials.length >= 2) {
      return initials;
    }
  }

  const compact = normalizeText(nome || morada).replace(/[^A-Z0-9]/g, '');
  if (compact.length >= 3) {
    return compact.slice(0, 3);
  }

  if (compact.length > 0) {
    return compact.padEnd(3, 'X').slice(0, 3);
  }

  return 'SER';
}

async function generateUniqueSeriesCode(prismaLike, userId, { nome = '', morada = '', documentType = 'FT', year }) {
  const seriesYear = Number(year) || new Date().getFullYear();
  const baseCode = deriveBaseSeriesCode({ nome, morada });

  const existingSeries = await prismaLike.serie.findMany({
    where: {
      userId,
      seriesYear,
      documentType,
      seriesCode: {
        startsWith: baseCode,
      },
    },
    select: { seriesCode: true },
  });

  const existingCodes = new Set(existingSeries.map((serie) => serie.seriesCode));
  if (!existingCodes.has(baseCode)) {
    return baseCode;
  }

  for (let suffix = 1; suffix < 100; suffix += 1) {
    const candidate = `${baseCode}-${String(suffix).padStart(2, '0')}`;
    if (!existingCodes.has(candidate)) {
      return candidate;
    }
  }

  return `${baseCode}-${Date.now().toString().slice(-4)}`;
}

module.exports = {
  normalizeText,
  deriveBaseSeriesCode,
  generateUniqueSeriesCode,
};
