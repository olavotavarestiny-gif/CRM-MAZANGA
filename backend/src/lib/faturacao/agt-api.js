/**
 * Cliente API AGT — 7 Serviços REST Oficiais
 * Endpoints: https://sifphml.minfin.gov.ao/sigt/fe/v1 (homologação)
 *            https://sifp.minfin.gov.ao/sigt/fe/v1    (produção)
 *
 * AGT_MOCK_MODE=true → respostas simuladas (default)
 * AGT_MOCK_MODE=false → chamadas reais (requer credenciais AGT)
 */

const AGT_API_URL = process.env.AGT_API_URL || 'https://sifphml.minfin.gov.ao/sigt/fe/v1';
const isMock = () => process.env.AGT_MOCK_MODE !== 'false';

function softwareInfo() {
  return {
    softwareInfoDetail: {
      productId: process.env.SOFTWARE_PRODUCT_ID || 'ULU Gestão',
      productVersion: process.env.SOFTWARE_VERSION || '1.0.0',
      softwareValidationNumber: process.env.AGT_CERT_NUMBER || 'PENDING',
    },
    jwsSoftwareSignature: 'PLACEHOLDER', // TODO: assinar com chave RSA quando disponível
  };
}

function basePayload(extra = {}) {
  return {
    schemaVersion: '1.0',
    taxRegistrationNumber: process.env.NIF_EMPRESA || '',
    submissionTimeStamp: new Date().toISOString(),
    softwareInfo: softwareInfo(),
    jwsSignature: 'PLACEHOLDER',
    ...extra,
  };
}

async function agtPost(endpoint, payload) {
  const response = await fetch(`${AGT_API_URL}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(handleAGTError(error, response.status));
  }
  return response.json();
}

// ============================================
// SERVIÇO 1: solicitarSerie
// ============================================
async function solicitarSerie(seriesCode, seriesYear, documentType, establishmentNumber, firstDocumentNumber = 1) {
  if (isMock()) return { resultCode: 1, message: 'Série criada (MOCK)' };
  return agtPost('solicitarSerie', basePayload({ seriesCode, seriesYear, documentType, establishmentNumber, firstDocumentNumber }));
}

// ============================================
// SERVIÇO 2: listarSeries
// ============================================
async function listarSeries(params = {}) {
  if (isMock()) return { resultCode: '1', seriesResultCount: '0', seriesInfo: [] };
  return agtPost('listarSeries', basePayload(params));
}

// ============================================
// SERVIÇO 3: registarFatura (máx 30 por chamada)
// ============================================
async function registarFatura(facturas) {
  if (isMock()) {
    return {
      requestID: `MOCK-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      resultCode: 0,
      message: 'Sucesso (MOCK)',
    };
  }
  if (facturas.length > 30) throw new Error('Máximo 30 facturas por chamada AGT');
  return agtPost('registarFatura', {
    ...basePayload(),
    submissionGUID: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    numberOfEntries: facturas.length,
    documents: facturas,
  });
}

// ============================================
// SERVIÇO 4: consultarEstado
// ============================================
async function consultarEstado(requestID) {
  if (isMock()) return { requestID, resultCode: 0, documentStatusList: [] };
  return agtPost('consultarEstado', basePayload({ requestID }));
}

// ============================================
// SERVIÇO 5: consultarFatura
// ============================================
async function consultarFatura(documentNo) {
  if (isMock()) return { statusFEResult: { documentNo, validationStatus: 'V', documents: [] } };
  return agtPost('consultarFatura', basePayload({ documentNo }));
}

// ============================================
// SERVIÇO 6: listarFaturas
// ============================================
async function listarFaturas(queryStartDate, queryEndDate) {
  if (isMock()) return { documentListResult: { documentResultCount: 0, documentResultList: [] } };
  return agtPost('listarFaturas', basePayload({ queryStartDate, queryEndDate }));
}

// ============================================
// SERVIÇO 7: validarDocumento
// ============================================
async function validarDocumento(documentNo, action, deductibleVATPercentage) {
  if (isMock()) return { statusFEResult: { documentNo, validationStatus: action === 'C' ? 'V' : 'R' } };
  const extra = { documentNo, action };
  if (deductibleVATPercentage !== undefined) extra.deductibleVATPercentage = deductibleVATPercentage;
  return agtPost('validarDocumento', basePayload(extra));
}

// ============================================
// HELPER: Tratamento de Erros AGT
// ============================================
function handleAGTError(error, statusCode) {
  const codes = {
    E08: 'Assinatura de software inválida',
    E39: 'Dados do software divergem da certificação',
    E40: 'Assinatura da chamada inválida',
    E94: 'NIF diferente do registado',
    E96: 'Erro na estrutura da solicitação',
    E98: 'Demasiadas solicitações (rate limit)',
  };
  if (statusCode === 400) return codes.E96;
  if (statusCode === 422) return codes.E94;
  if (statusCode === 429) return codes.E98;
  const code = error?.errorCode;
  return (code && codes[code]) || error?.descriptionError || `Erro AGT (HTTP ${statusCode})`;
}

module.exports = {
  solicitarSerie,
  listarSeries,
  registarFatura,
  consultarEstado,
  consultarFatura,
  listarFaturas,
  validarDocumento,
  handleAGTError,
  isMock,
};
