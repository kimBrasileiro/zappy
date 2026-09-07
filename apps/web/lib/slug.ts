import { prisma } from '@zappigo/db';

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

// Two companies with the same (or accent/case-equivalent) name break
// lib/bot/conversation.ts#matchCompanyByNameInText on the shared WhatsApp
// number — a customer just saying the business's name in their first
// message becomes ambiguous (2+ matches = null = "needs code" fallback)
// instead of routing straight there. Not a DB-level unique constraint:
// slugify() already does the same accent/case folding this needs, so
// reusing it here keeps one definition of "same name" instead of a second,
// possibly-drifting one in a raw SQL index. Fetches the small company table
// and compares in JS — same tradeoff matchCompanyByNameInText itself
// already makes, fine at this company count.
export async function isCompanyNameTaken(name: string): Promise<boolean> {
  const target = slugify(name);
  if (!target) return false;
  const companies = await prisma.company.findMany({ where: { status: 'active' }, select: { name: true } });
  return companies.some((c) => slugify(c.name) === target);
}
