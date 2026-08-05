import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// AES-256-GCM: authenticated encryption, so a tampered ciphertext fails to
// decrypt instead of silently returning garbage. First real use was the
// Google Calendar refresh token (Company.googleCalendarRefreshTokenEncrypted);
// now also backs Company.whatsappTokenEncrypted (see lib/whatsapp/client.ts
// #resolveWhatsAppCredentials) — each caller names its own env var holding
// the key, rather than this module assuming a single global secret, since a
// key belongs to whichever feature owns the column it protects.
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit, the size GCM is designed for
const AUTH_TAG_LENGTH = 16;

function getKey(keyEnvVar: string): Buffer {
  const key = process.env[keyEnvVar];
  if (!key) throw new Error(`${keyEnvVar} is not set`);
  const buf = Buffer.from(key, 'base64');
  if (buf.length !== 32) {
    throw new Error(`${keyEnvVar} must be a base64-encoded 32-byte key`);
  }
  return buf;
}

// Output layout: iv (12 bytes) + authTag (16 bytes) + ciphertext, all
// base64'd together — self-contained, nothing else needs to be stored
// alongside it in the database column.
export function encrypt(plaintext: string, keyEnvVar: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(keyEnvVar), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}

export function decrypt(ciphertext: string, keyEnvVar: string): string {
  const data = Buffer.from(ciphertext, 'base64');
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, getKey(keyEnvVar), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
