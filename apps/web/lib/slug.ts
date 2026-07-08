import { prisma } from '@chat-ia/db';

const ACCENT_MARKS = /[̀-ͯ]/g;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(ACCENT_MARKS, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export async function generateUniqueSlug(companyName: string): Promise<string> {
  const base = slugify(companyName) || 'empresa';
  let candidate = base;
  let suffix = 2;

  while (await prisma.company.findUnique({ where: { slug: candidate } })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}
