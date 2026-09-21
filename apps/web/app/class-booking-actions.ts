'use server';

import { headers } from 'next/headers';
import { prisma } from '@zappigo/db';
import { checkCompanyActive } from '../lib/bot/guardrails';
import { checkRateLimit } from '../lib/bot/rate-limit';
import { isSportsCompany } from '../lib/modality';
import { addDaysIso, enrollInClass, getPlayerLevels, listClassSessions, todayIso, type ClassSession } from '../lib/sports/classes';
import { getCourtFreeSlots, reserveCourt } from '../lib/sports/courts';
import { saveCustomerContact } from '../lib/sports/customers';
import { submitEventRequest } from '../lib/sports/events';
import { isLevel, isSport, type Level, type Sport } from '../lib/sports/constants';
import { normalizePhone } from '../lib/bot/services';

// Same public-form guardrails as booking-actions.ts: active company check +
// the per-IP rate limit the chat endpoint uses — plus the sports-modality
// gate, so these actions are inert for barbearia/pet shop companies.

async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
}

async function resolveSportsCompany(companySlug: string) {
  const company = await prisma.company.findUnique({ where: { slug: companySlug } });
  if (!company || !checkCompanyActive(company).allowed || !isSportsCompany(company)) return null;
  return company;
}

async function guard(companySlug: string) {
  const company = await resolveSportsCompany(companySlug);
  if (!company) return { error: 'company_not_found' as const };
  const ip = await clientIp();
  if (!checkRateLimit(company.id, ip ?? 'unknown', ip).allowed) return { error: 'rate_limited' as const };
  return { company };
}

export type PublicSession = Pick<
  ClassSession,
  'classId' | 'date' | 'startTime' | 'endTime' | 'courtName' | 'sport' | 'sportLabel' | 'level' | 'levelLabel' | 'seatsLeft' | 'capacity' | 'priceCents' | 'instructorName' | 'matchesPlayerLevel'
>;

function toPublic(s: ClassSession): PublicSession {
  return {
    classId: s.classId,
    date: s.date,
    startTime: s.startTime,
    endTime: s.endTime,
    courtName: s.courtName,
    sport: s.sport,
    sportLabel: s.sportLabel,
    level: s.level,
    levelLabel: s.levelLabel,
    seatsLeft: s.seatsLeft,
    capacity: s.capacity,
    priceCents: s.priceCents,
    instructorName: s.instructorName,
    matchesPlayerLevel: s.matchesPlayerLevel,
  };
}

async function customerIdByPhone(companyId: string, rawPhone: string | undefined): Promise<string | null> {
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  if (!phone) return null;
  const row = await prisma.customer.findFirst({ where: { companyId, phone }, select: { id: true } });
  return row?.id ?? null;
}

// Levels this phone already declared — lets the form pre-select the level and
// badge the classes that match, same as the chat does for a returning player.
export async function getKnownLevels(companySlug: string, phone: string) {
  const g = await guard(companySlug);
  if ('error' in g) return { error: g.error };
  const customerId = await customerIdByPhone(g.company.id, phone);
  return { levels: await getPlayerLevels(g.company.id, customerId) };
}

export async function getPublicClassSessions(companySlug: string, input: { sport: string; level?: string; phone?: string }) {
  const g = await guard(companySlug);
  if ('error' in g) return { error: g.error };
  if (!isSport(input.sport)) return { error: 'invalid_sport' as const };

  const from = todayIso();
  const { sessions } = await listClassSessions({
    companyId: g.company.id,
    fromDate: from,
    toDate: addDaysIso(from, 14),
    sport: input.sport,
    level: input.level && isLevel(input.level) ? input.level : undefined,
    customerId: await customerIdByPhone(g.company.id, input.phone),
    limit: 60,
  });
  return { sessions: sessions.filter((s) => s.seatsLeft > 0).map(toPublic) };
}

export async function submitClassEnrollment(
  companySlug: string,
  input: { classId: string; date: string; name: string; phone: string; email?: string; playerLevel?: string },
) {
  const g = await guard(companySlug);
  if ('error' in g) return { error: g.error };

  const result = await enrollInClass(g.company.id, null, {
    classId: input.classId,
    date: input.date,
    customerName: input.name,
    customerPhone: input.phone,
    playerLevel: input.playerLevel && isLevel(input.playerLevel) ? (input.playerLevel as Level) : undefined,
  });
  if ('error' in result) {
    return { error: result.error, alternatives: result.alternatives?.map(toPublic) };
  }
  if (input.email?.trim()) await saveCustomerContact(g.company.id, null, { name: input.name, phone: input.phone, email: input.email });
  return { success: true as const, session: toPublic(result.session) };
}

export async function getPublicCourtSlots(companySlug: string, date: string, durationMinutes: number) {
  const g = await guard(companySlug);
  if ('error' in g) return { error: g.error };
  const result = await getCourtFreeSlots(g.company.id, date, { durationMinutes });
  if ('error' in result) return { error: result.error };
  return { closed: !!result.closed, courts: result.courts.map((c) => ({ courtName: c.courtName, slots: c.slots })) };
}

export async function submitCourtReservation(
  companySlug: string,
  input: { date: string; startTime: string; durationMinutes: number; courtName?: string; participants?: number; name: string; phone: string; email?: string; notes?: string },
) {
  const g = await guard(companySlug);
  if ('error' in g) return { error: g.error };

  const result = await reserveCourt(g.company.id, null, {
    date: input.date,
    startTime: input.startTime,
    durationMinutes: input.durationMinutes,
    courtName: input.courtName || undefined,
    participants: input.participants,
    customerName: input.name,
    customerPhone: input.phone,
    notes: input.notes,
  });
  if ('error' in result) return { error: result.error };
  if (input.email?.trim()) await saveCustomerContact(g.company.id, null, { name: input.name, phone: input.phone, email: input.email });
  return {
    success: true as const,
    courtName: result.courtName,
    date: result.date,
    startTime: result.startTime,
    endTime: result.endTime,
  };
}

export async function submitEventForm(
  companySlug: string,
  input: { eventType: string; dateHint?: string; participants?: number; notes?: string; name: string; phone: string; email?: string },
) {
  const g = await guard(companySlug);
  if ('error' in g) return { error: g.error };

  const result = await submitEventRequest(
    g.company.id,
    { ticketId: null, customerId: null },
    { eventType: input.eventType, dateHint: input.dateHint, participants: input.participants, notes: input.notes, contactName: input.name, contactPhone: input.phone },
  );
  if ('error' in result) return { error: result.error };
  if (input.email?.trim()) await saveCustomerContact(g.company.id, null, { name: input.name, phone: input.phone, email: input.email });
  return { success: true as const };
}

export type { Sport };
