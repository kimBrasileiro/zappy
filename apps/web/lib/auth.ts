import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { prisma } from '@zappigo/db';
import { sendEmail } from './email/resend';

export const auth = betterAuth({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  database: prismaAdapter(prisma, { provider: 'postgresql' }),

  emailAndPassword: {
    enabled: true,
    // Proves the address is real/reachable before the dashboard is usable —
    // sign-up itself still succeeds either way (see (auth)/signup/actions.ts,
    // which checks the response for a session rather than assuming one).
    // Only affects the email/password flow: Google sign-in already comes
    // with emailVerified=true from the OAuth provider itself, so
    // onboarding/actions.ts is unaffected.
    requireEmailVerification: true,
    // Defense in depth — the real character-class/blocklist checks live in
    // signup/actions.ts#validatePassword (better-auth itself has no concept
    // of "must contain a digit"), but this is the actual floor Better Auth
    // enforces regardless of what calls it, so it can't drift out of sync
    // with that check.
    minPasswordLength: 10,
    // Enables /api/auth/request-password-reset + /reset-password (both
    // exposed automatically by the [...all] catch-all route the moment this
    // is set — see api/routes/password.mjs in better-auth's own source,
    // which throws RESET_PASSWORD_DISABLED without it). `url` already
    // carries the callback redirect (forgot-password/page.tsx passes
    // redirectTo: '/reset-password') plus the token as a query param by the
    // time this fires — reset-password/page.tsx reads it straight off
    // searchParams, no extra wiring needed on our side.
    sendResetPassword: async ({ user, url }) => {
      await sendEmail(
        user.email,
        'Redefinir senha — Zappigo',
        `<p>Recebemos um pedido pra redefinir sua senha na Zappigo.</p><p><a href="${url}">Criar nova senha</a></p><p>Se você não pediu isso, pode ignorar este email — sua senha continua a mesma.</p>`,
      );
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    // Clicking the emailed link logs the user straight in instead of
    // dumping them on /login to type their password again right after
    // typing it at signup.
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail(
        user.email,
        'Confirme seu email — Zappigo',
        `<p>Falta só confirmar seu email pra acessar o dashboard da Zappigo.</p><p><a href="${url}">Confirmar email</a></p><p>Se você não criou essa conta, pode ignorar este email.</p>`,
      );
    },
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
