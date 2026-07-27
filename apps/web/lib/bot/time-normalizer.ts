// Rewrites the most common informal Portuguese time phrasings into the
// "HH:MM" format the model already treats as an exact quick-reply tap —
// deliberately narrow (no attempt at "3 da tarde" or other free-form
// phrasing, that stays the model's job) so an unmatched phrase just falls
// through unchanged rather than risking a false match.
export function normalizeTimePhrases(text: string): string {
  let out = text.replace(/meio[\s-]?dia/gi, '12:00');
  out = out.replace(/meia[\s-]?noite/gi, '00:00');
  out = out.replace(/\b(\d{1,2})h(\d{2})?\b/gi, (_, h: string, m: string | undefined) => `${h.padStart(2, '0')}:${m ?? '00'}`);
  return out;
}
