const LEGACY_CONTACT_FIELD_KEYS = new Set(['name', 'phone', 'email', 'company', 'sector', 'revenue', 'location', 'birthDate']);

const INFERRED_CONTACT_FIELD_PATTERNS = {
  name: [/^nome$/i, /^nome completo$/i, /^contacto$/i],
  phone: [/telefone/i, /telemovel/i, /telemóvel/i, /numero/i, /n[uú]mero/i, /celular/i, /whatsapp/i],
  email: [/e-?mail/i, /^email$/i, /correio/i],
  company: [/empresa/i, /companhia/i, /neg[oó]cio/i, /organiz/i],
  sector: [/setor/i, /sector/i, /ramo/i, /ind[uú]stria/i, /area/i, /área/i],
  revenue: [/fatura[cç][aã]o/i, /receita/i, /or[cç]amento/i, /volume/i, /revenue/i],
  location: [/local/i, /morada/i, /endere[cç]o/i, /prov[ií]ncia/i, /cidade/i],
  birthDate: [/anivers/i, /nascimento/i, /data de nascimento/i],
};

function normalizeBinding(contactField) {
  if (!contactField) return null;
  const raw = String(contactField).trim();
  if (!raw || raw === 'none') return null;
  if (raw.startsWith('standard:') || raw.startsWith('custom:')) return raw;
  if (LEGACY_CONTACT_FIELD_KEYS.has(raw)) return `standard:${raw}`;
  return raw;
}

function normaliseText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normaliseSubmittedValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function inferContactField(field, submittedValue = '') {
  const binding = normalizeBinding(field?.contactField);
  if (binding?.startsWith('standard:') || binding?.startsWith('custom:')) {
    return binding;
  }

  const normalisedLabel = normaliseText(field?.label);
  for (const [contactField, patterns] of Object.entries(INFERRED_CONTACT_FIELD_PATTERNS)) {
    if (patterns.some((pattern) => pattern.test(normalisedLabel))) {
      return `standard:${contactField}`;
    }
  }

  const normalisedValue = normaliseSubmittedValue(submittedValue);
  if (normalisedValue.includes('@')) {
    return 'standard:email';
  }

  if (/^[\d\s\+\-\(\)]{7,20}$/.test(normalisedValue)) {
    return 'standard:phone';
  }

  return null;
}

function serialiseSubmissionAnswer(answer) {
  const fieldLabel = answer.fieldLabel || answer.field?.label || 'Campo removido';

  return {
    id: answer.id,
    fieldId: answer.fieldId,
    value: answer.value,
    fieldLabel,
    contactField: answer.contactField || inferContactField({
      label: fieldLabel,
      contactField: answer.contactField,
    }, answer.value),
  };
}

function serialiseSubmission(submission) {
  return {
    id: submission.id,
    formId: submission.formId,
    contactId: submission.contactId,
    contactSyncStatus: submission.contactSyncStatus,
    submittedAt: submission.submittedAt,
    form: submission.form ? {
      id: submission.form.id,
      title: submission.form.title,
    } : undefined,
    contact: submission.contact,
    answers: (submission.answers || []).map(serialiseSubmissionAnswer),
  };
}

module.exports = {
  serialiseSubmission,
};
