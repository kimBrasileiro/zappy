const AVATAR_COLOR_COUNT = 6;

function hashToIndex(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % AVATAR_COLOR_COUNT;
}

function initialsFor(name: string | null | undefined): string {
  const trimmed = name?.trim();
  if (!trimmed) return '?';
  const words = trimmed.split(/\s+/).slice(0, 2);
  return words.map((w) => w[0]!.toUpperCase()).join('');
}

// Initials avatar with a color deterministically derived from the person's
// name (or the id, when there's no name — an anonymous customer still gets
// a consistent color across the Inbox list and the conversation thread,
// not a random one on every render).
export function Avatar({
  name,
  seed,
  size = 32,
  className = '',
}: {
  name: string | null | undefined;
  seed?: string;
  size?: number;
  className?: string;
}) {
  const colorIndex = hashToIndex(seed || name || '?') + 1;
  return (
    <span
      className={`dash-avatar ${className}`}
      style={{
        width: size,
        height: size,
        background: `var(--dash-avatar-${colorIndex})`,
        color: `var(--dash-avatar-${colorIndex}-fg)`,
      }}
      aria-hidden="true"
    >
      {initialsFor(name)}
    </span>
  );
}
