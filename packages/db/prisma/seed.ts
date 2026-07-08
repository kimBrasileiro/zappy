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
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
