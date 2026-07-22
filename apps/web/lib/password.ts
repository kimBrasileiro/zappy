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

export function validatePassword(password: string, email: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'A senha precisa ter pelo menos uma letra e um número.';
  }
  const normalized = password.toLowerCase();
  if (BLOCKLIST.has(normalized) || normalized === email.toLowerCase().split('@')[0]) {
    return 'Essa senha é fácil demais de adivinhar — escolhe outra.';
  }
  return null;
}
