function sanitizePhone(phone) {
  if (phone === undefined || phone === null) return '';

  return String(phone)
    .trim()
    .replace(/[\s\-()]/g, '');
}

function normalizePhoneToE164(phone, defaultCountry = 'AO') {
  const sanitized = sanitizePhone(phone);
  if (!sanitized) return null;

  const normalizedCountry = String(defaultCountry || 'AO').toUpperCase();
  if (normalizedCountry !== 'AO') return null;

  const hasPlus = sanitized.startsWith('+');
  const digits = sanitized.replace(/[^\d]/g, '');

  if (!digits) return null;

  if (hasPlus) {
    if (/^2449\d{8}$/.test(digits)) {
      return `+${digits}`;
    }
    return null;
  }

  if (/^2449\d{8}$/.test(digits)) {
    return `+${digits}`;
  }

  if (/^9\d{8}$/.test(digits)) {
    return `+244${digits}`;
  }

  return null;
}

function isValidSmsPhone(phone, defaultCountry = 'AO') {
  return !!normalizePhoneToE164(phone, defaultCountry);
}

function normalizePhonesBulk(list, defaultCountry = 'AO') {
  const valid = [];
  const invalid = [];
  const duplicates = [];
  const seen = new Set();

  for (const [index, item] of (Array.isArray(list) ? list : []).entries()) {
    const original = typeof item === 'string' ? item : String(item ?? '');
    const normalized = normalizePhoneToE164(original, defaultCountry);

    if (!normalized) {
      invalid.push({ index, original, reason: 'invalid_phone' });
      continue;
    }

    if (seen.has(normalized)) {
      duplicates.push({ index, original, normalized, reason: 'duplicate_phone' });
      continue;
    }

    seen.add(normalized);
    valid.push({ index, original, normalized });
  }

  return {
    valid,
    invalid,
    duplicates,
  };
}

module.exports = {
  normalizePhoneToE164,
  normalizePhonesBulk,
  isValidSmsPhone,
};
