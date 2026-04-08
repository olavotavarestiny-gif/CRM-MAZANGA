export type PasswordRequirementStatus = {
  label: string;
  met: boolean;
};

const PASSWORD_MIN_LENGTH = 6;
const UPPERCASE_REGEX = /[A-Z]/;
const LOWERCASE_REGEX = /[a-z]/;
const NUMBER_REGEX = /\d/;
const SYMBOL_REGEX = /[^A-Za-z0-9]/;

export const PASSWORD_REQUIREMENT_LABELS = [
  `Pelo menos ${PASSWORD_MIN_LENGTH} caracteres`,
  'Pelo menos 1 letra maiúscula',
  'Pelo menos 1 letra minúscula',
  'Pelo menos 1 número',
  'Pelo menos 1 símbolo especial',
] as const;

export function getPasswordRequirementStatus(password: string): PasswordRequirementStatus[] {
  return [
    {
      label: PASSWORD_REQUIREMENT_LABELS[0],
      met: password.length >= PASSWORD_MIN_LENGTH,
    },
    {
      label: PASSWORD_REQUIREMENT_LABELS[1],
      met: UPPERCASE_REGEX.test(password),
    },
    {
      label: PASSWORD_REQUIREMENT_LABELS[2],
      met: LOWERCASE_REGEX.test(password),
    },
    {
      label: PASSWORD_REQUIREMENT_LABELS[3],
      met: NUMBER_REGEX.test(password),
    },
    {
      label: PASSWORD_REQUIREMENT_LABELS[4],
      met: SYMBOL_REGEX.test(password),
    },
  ];
}

export function getPasswordValidationError(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `A password deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }

  if (!UPPERCASE_REGEX.test(password)) {
    return 'A password deve conter pelo menos uma letra maiúscula.';
  }

  if (!LOWERCASE_REGEX.test(password)) {
    return 'A password deve conter pelo menos uma letra minúscula.';
  }

  if (!NUMBER_REGEX.test(password)) {
    return 'A password deve conter pelo menos um número.';
  }

  if (!SYMBOL_REGEX.test(password)) {
    return 'A password deve conter pelo menos um símbolo especial (ex: @, #, !).';
  }

  return null;
}

export function formatPasswordProviderError(rawMessage: string | null | undefined): string {
  const raw = (rawMessage || '').toLowerCase();

  if (!raw) {
    return 'Não foi possível alterar a password. Tente novamente.';
  }

  if (raw.includes('at least') || raw.includes('characters') || raw.includes('length')) {
    return `A password deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }

  if (raw.includes('weak') || raw.includes('strong') || raw.includes('strength')) {
    return 'A password é demasiado fraca. Use letras maiúsculas, minúsculas, números e símbolos.';
  }

  if (raw.includes('number') || raw.includes('digit')) {
    return 'A password deve conter pelo menos um número.';
  }

  if (raw.includes('uppercase')) {
    return 'A password deve conter pelo menos uma letra maiúscula.';
  }

  if (raw.includes('lower')) {
    return 'A password deve conter pelo menos uma letra minúscula.';
  }

  if (raw.includes('special') || raw.includes('symbol')) {
    return 'A password deve conter pelo menos um símbolo especial (ex: @, #, !).';
  }

  if (raw.includes('same') || raw.includes('different') || raw.includes('previous')) {
    return 'A nova password não pode ser igual à anterior.';
  }

  return rawMessage || 'Não foi possível alterar a password. Tente novamente.';
}
