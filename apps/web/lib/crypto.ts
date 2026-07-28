import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// AES-256-GCM: authenticated encryption, so a tampered ciphertext fails to
// decrypt instead of silently returning garbage. First real use is the
// Google Calendar refresh token (Company.googleCalendarRefreshTokenEncrypted)
// — generic on purpose so it can also eventually back the
// whatsappTokenEncrypted column, which already exists in the schema but has
// never had a real encrypt/decrypt path.
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit, the size GCM is designed for
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY;
  if (!key) throw new Error('GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY is not set');
  const buf = Buffer.from(key, 'base64');
  if (buf.length !== 32) {
    throw new Error('GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  }
  return buf;
}

// Output layout: iv (12 bytes) + authTag (16 bytes) + ciphertext, all
// base64'd together — self-contained, nothing else needs to be stored
// alongside it in the database column.
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}

export function decrypt(ciphertext: string): string {
  const data = Buffer.from(ciphertext, 'base64');
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
