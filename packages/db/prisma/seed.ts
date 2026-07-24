import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.upsert({
    where: { slug: 'acme-demo' },
    update: {},
    create: {
      name: 'Acme Demo',
      slug: 'acme-demo',
      plan: 'starter',
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@acme-demo.test' },
    update: {},
    create: {
      companyId: company.id,
      email: 'admin@acme-demo.test',
      name: 'Admin Demo',
      role: 'admin',
    },
  });

  // Zappigo's own dogfooding account (company + its Demo service + FAQs) is
  // seeded by migrations/20260722010000_seed_zappy_company instead of here
  // — that institutional chat needs to work on every environment that ran
  // migrations (staging/production included), not only wherever someone
  // remembered to also run `pnpm db:seed`.
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
