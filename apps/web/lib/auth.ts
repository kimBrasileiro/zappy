import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { prisma } from '@chat-ia/db';

export const auth = betterAuth({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  database: prismaAdapter(prisma, { provider: 'postgresql' }),

  emailAndPassword: {
    enabled: true,
    // No RESEND_API_KEY configured yet — email verification/reset would have
    // nowhere to send to. Revisit once transactional email is wired up.
    requireEmailVerification: false,
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },

  user: {
    modelName: 'User',
    fields: {
      // Better Auth's canonical "image" field reuses our existing avatarUrl
      // column rather than adding a duplicate.
      image: 'avatarUrl',
    },
    additionalFields: {
      // Nullable until onboarding completes (see apps/web/app/onboarding) —
      // Google sign-in creates the User before a Company exists.
      companyId: { type: 'string', required: false, input: true },
      role: { type: 'string', required: false, defaultValue: 'agent', input: true },
      // input: false — status is only ever changed by an admin directly via
      // Prisma (apps/web/app/admin/users/actions.ts), never through Better
      // Auth's own signup/update-user calls.
      status: { type: 'string', required: false, defaultValue: 'active', input: false },
    },
  },
  session: { modelName: 'Session' },
  account: { modelName: 'Account' },
  verification: { modelName: 'Verification' },

  // Every id column in this schema is Postgres `uuid` (@db.Uuid) — without
  // this, Better Auth generates its own non-UUID string ids and Prisma
  // rejects them at insert time.
  advanced: { database: { generateId: 'uuid' } },

  // Required for Server Actions (e.g. the signup flow) to set the session
  // cookie correctly under Next.js's App Router — must be the last plugin.
  plugins: [nextCookies()],
});
