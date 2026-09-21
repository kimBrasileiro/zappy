// Fixed vocabularies for the sports-court modality. Stored verbatim in
// SportClass.sport/level and CustomerSportLevel.sport/level; labels here are
// the pt-BR display strings used by the bot and the public form.
export const SPORTS = ['beach_tennis', 'futevolei', 'volei'] as const;
export type Sport = (typeof SPORTS)[number];

export const SPORT_LABELS: Record<Sport, string> = {
  beach_tennis: 'Beach Tennis',
  futevolei: 'Futevôlei',
  volei: 'Vôlei',
};

export const LEVELS = ['iniciante', 'intermediario', 'avancado'] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_LABELS: Record<Level, string> = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
};

export function isSport(value: string): value is Sport {
  return (SPORTS as readonly string[]).includes(value);
}

export function isLevel(value: string): value is Level {
  return (LEVELS as readonly string[]).includes(value);
}

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Free text from a customer or an LLM tool argument ("Futevôlei", "beach
// tennis", "vôlei", "voleibol") → canonical key, accent/case-insensitive.
// futevolei is checked before volei on purpose: "futevolei" contains "volei".
export function resolveSport(text: string): Sport | null {
  const t = fold(text);
  if (!t) return null;
  if (t.includes('beach') || t.includes('tenis') || t.includes('tennis')) return 'beach_tennis';
  if (t.includes('futevolei') || t.includes('futvolei') || t.includes('fute volei')) return 'futevolei';
  if (t.includes('volei')) return 'volei';
  return null;
}

export function resolveLevel(text: string): Level | null {
  const t = fold(text);
  if (!t) return null;
  if (t.includes('inicia') || t.includes('basico') || t.includes('comecando') || t.includes('nunca')) return 'iniciante';
  if (t.includes('intermed') || t.includes('medio')) return 'intermediario';
  if (t.includes('avanc') || t.includes('experiente') || t.includes('competi')) return 'avancado';
  return null;
}
