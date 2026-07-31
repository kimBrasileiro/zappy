// A handful of the most common trivial passwords/patterns — not a real
// breached-password check (that'd mean an external API call, e.g. Have I
// Been Pwned, at every signup), just enough to block the laziest possible
// input ("12345678", "aaaaaaaaaa") that pure length+character-class rules
// alone let through.
const BLOCKLIST = new Set([
  'password',
  'password1',
  'password123',
  '1234567890',
  '12345678',
  '123456789',
  'qwertyuiop',
  'senha1234',
  'senha123456',
  'aaaaaaaaaa',
]);

// Mirrors lib/auth.ts's minPasswordLength — that one is the floor Better
// Auth itself enforces regardless of caller; this is the fuller check
// (character classes, blocklist) applied in signup/actions.ts before
// Better Auth ever sees the password.
export const MIN_PASSWORD_LENGTH = 10;

export interface PasswordValidationMessages {
  tooShort: string;
  needsLetterAndNumber: string;
  tooCommon: string;
}

const DEFAULT_MESSAGES: PasswordValidationMessages = {
  tooShort: `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
  needsLetterAndNumber: 'A senha precisa ter pelo menos uma letra e um número.',
  tooCommon: 'Essa senha é fácil demais de adivinhar — escolhe outra.',
};

export function validatePassword(
  password: string,
  email: string,
  messages: PasswordValidationMessages = DEFAULT_MESSAGES,
): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return messages.tooShort;
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return messages.needsLetterAndNumber;
  }
  const normalized = password.toLowerCase();
  if (BLOCKLIST.has(normalized) || normalized === email.toLowerCase().split('@')[0]) {
    return messages.tooCommon;
  }
  return null;
}
