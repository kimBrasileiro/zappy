const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,3}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}/g;
const CPF_RE = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g;

// G1 — never write raw customer PII to logs. The message content itself
// still goes to the database untouched (ticket history needs it); this only
// scrubs text before it's passed to console.log/console.error.
export function scrubForLog(text: string): string {
  return text
    .replace(EMAIL_RE, '[email]')
    .replace(CPF_RE, '[cpf]')
    .replace(PHONE_RE, '[telefone]');
}
