'use server';

import { headers } from 'next/headers';
import { prisma } from '@zappigo/db';
import { checkCompanyActive } from '../lib/bot/guardrails';
import { checkRateLimit } from '../lib/bot/rate-limit';
import { checkAvailability, createBooking, normalizePhone } from '../lib/bot/services';
import { findOrCreateCustomerByPhone } from '../lib/bot/conversation';

// Same header Cloud Run's load balancer sets for every other public,
// unauthenticated endpoint in this app (see api/chat/route.ts) — the only
// signal available here to rate-limit an anonymous page visitor by.
async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
}

async function resolveActiveCompany(companySlug: string) {
  const company = await prisma.company.findUnique({ where: { slug: companySlug } });
  if (!company || !checkCompanyActive(company).allowed) return null;
  return company;
}

export async function getPublicAvailability(companySlug: string, serviceName: string, date: string, staffName?: string) {
  const company = await resolveActiveCompany(companySlug);
  if (!company) return { error: 'company_not_found' as const };

  const ip = await clientIp();
  // Reuses the same per-IP backstop /api/chat relies on — there's no
  // per-conversation concept on this form, so the IP key doubles as both.
  if (!checkRateLimit(company.id, ip ?? 'unknown', ip).allowed) {
    return { error: 'rate_limited' as const };
  }

  // Uncapped-in-practice (vs. the bot's default of 3, sized for chat
  // quick-reply buttons) — this is a real date/time picker, so a visitor
  // should see every open slot in the day, not just the first few.
  return checkAvailability(company.id, serviceName, date, staffName, undefined, 24);
}

export async function submitPublicBooking(
  companySlug: string,
  input: {
    serviceName: string;
    scheduledAt: string;
    staffName?: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
  },
) {
  const company = await resolveActiveCompany(companySlug);
  if (!company) return { error: 'company_not_found' as const };

  const ip = await clientIp();
  if (!checkRateLimit(company.id, ip ?? 'unknown', ip).allowed) {
    return { error: 'rate_limited' as const };
  }

  const normalizedPhone = normalizePhone(input.customerPhone);
  if (!normalizedPhone) {
    return { error: 'invalid_customer_phone' as const };
  }

  // Matched by the same normalized phone createBooking itself writes back
  // onto the customer row below — keeps this booking attached to the same
  // Customer a prior (or future) WhatsApp/chat conversation with this same
  // number would resolve to, instead of creating a disconnected duplicate.
  const customer = await findOrCreateCustomerByPhone(company.id, normalizedPhone);
  if (input.customerEmail?.trim()) {
    try {
      await prisma.customer.update({ where: { id: customer.id }, data: { email: input.customerEmail.trim() } });
    } catch (err) {
      // (company_id, email) unique constraint — another customer already
      // owns that email. Non-fatal: the booking itself only needs
      // name+phone, email is a nice-to-have on the customer record.
      if ((err as { code?: string }).code !== 'P2002') throw err;
    }
  }

  return createBooking(company.id, null, customer.id, {
    serviceName: input.serviceName,
    scheduledAt: input.scheduledAt,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    staffName: input.staffName,
  });
}
