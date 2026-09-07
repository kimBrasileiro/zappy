import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@zappigo/db';
import { auth } from './auth';
import { IMPERSONATE_COOKIE, isSuperAdminEmail } from './admin-auth';
import { isBillingActive } from './stripe/client';
import { FREE_TIER_MODE } from './stripe/plans';

export interface RequireSessionResult {
  userId: string;
  email: string;
  companyId: string;
  role: string;
  // True only for the hardcoded super-admin email (see admin-auth.ts) —
  // gates the company switcher in dashboard/layout.tsx and the impersonate
  // server actions. isSuperAdmin never changes companyId by itself; that
  // only happens below, via the IMPERSONATE_COOKIE.
  isSuperAdmin: boolean;
  // The signed-in user's own company — same as companyId unless a super
  // admin is currently impersonating a different one.
  actualCompanyId: string;
}

// Every dashboard Server Component/Server Action calls this first — no
// exceptions — so tenant scoping never depends on remembering to add a
// `where: { companyId }` in one specific place. Also, by default, the ONLY
// place the billing gate below is enforced — so a suspended/never-paid
// company can't reach a single dashboard route or server action without
// that route explicitly opting out via allowInactiveBilling.
export async function requireSession(opts?: { allowInactiveBilling?: boolean }): Promise<RequireSessionResult> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect('/login');
  }

  const user = session.user as typeof session.user & {
    companyId: string | null;
    role: string;
    status: string;
  };

  // Soft-deleted by an admin (apps/web/app/admin/users/actions.ts) — the
  // session cookie may still be technically valid, but every protected
  // route re-checks this, so a deactivated account can't do anything.
  if (user.status !== 'active') {
    redirect('/login');
  }

  if (!user.companyId) {
    redirect('/onboarding');
  }

  const isSuperAdmin = isSuperAdminEmail(user.email);
  let companyId = user.companyId;

  if (isSuperAdmin) {
    const impersonating = (await cookies()).get(IMPERSONATE_COOKIE)?.value;
    if (impersonating) {
      // A stale/tampered cookie value (deleted company, bad id) silently
      // falls back to the real company rather than ever handing back a
      // companyId that doesn't resolve to anything.
      const exists = await prisma.company.findUnique({ where: { id: impersonating }, select: { id: true } });
      if (exists) companyId = impersonating;
    }
  }

  // Real signup incident (Sep/2026): a transient hiccup in startTrialSubscription
  // (signup/actions.ts) left a company created and fully usable with no Stripe
  // subscription ever created — the dashboard had no gate of its own checking
  // billing state, only the customer-facing bot did (guardrails.ts#
  // checkCompanyActive). This closes that gap at the source every dashboard
  // route shares, rather than trusting signup to always succeed at collecting
  // payment. Exemptions, deliberately narrow:
  //  - isSuperAdmin: the platform's own operator must always be able to get
  //    in, including to *investigate* a company stuck exactly like this one.
  //  - plan === 'starter': the free-tier-era plan key (see signup/actions.ts)
  //    for companies that signed up before Stripe was ever configured on this
  //    deployment — grandfathered in, not silently locked out by turning
  //    billing on later.
  //  - FREE_TIER_MODE: this deployment isn't charging anyone at all right now.
  if (!opts?.allowInactiveBilling && !isSuperAdmin && !FREE_TIER_MODE) {
    const billing = await prisma.company.findUnique({
      where: { id: companyId },
      select: { plan: true, subscriptionStatus: true, hasPaymentMethod: true },
    });
    if (billing && billing.plan !== 'starter' && !isBillingActive(billing.subscriptionStatus, billing.hasPaymentMethod)) {
      redirect('/dashboard/billing');
    }
  }

  return { userId: user.id, email: user.email, companyId, role: user.role, isSuperAdmin, actualCompanyId: user.companyId };
}
