import { NextResponse } from 'next/server';
import { prisma } from '@zappy/db';
import { checkOrigin, isHumanHandling } from '../../../../lib/bot/guardrails';

// Lets the widget pick up agent replies sent from the dashboard without the
// customer having to send another message first — the only kind of message
// that never arrives through the synchronous POST /api/chat response.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const companySlug = searchParams.get('companyId');
  const conversationId = searchParams.get('conversationId');
  const after = searchParams.get('after');

  if (!companySlug || !conversationId) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400, headers: CORS_HEADERS });
  }

  const company = await prisma.company.findUnique({ where: { slug: companySlug } });
  if (!company) return NextResponse.json({ messages: [] }, { headers: CORS_HEADERS });

  if (!checkOrigin(company, request.headers.get('origin')).allowed) {
    return NextResponse.json({ error: 'origin_not_allowed' }, { status: 403, headers: CORS_HEADERS });
  }

  const customer = await prisma.customer.findFirst({
    where: { companyId: company.id, externalId: conversationId },
  });
  if (!customer) return NextResponse.json({ messages: [] }, { headers: CORS_HEADERS });

  const ticket = await prisma.ticket.findFirst({
    where: { companyId: company.id, customerId: customer.id, channel: 'site_chat' },
    orderBy: { createdAt: 'desc' },
  });
  if (!ticket) return NextResponse.json({ messages: [] }, { headers: CORS_HEADERS });

  // Only 'agent' messages — 'bot' replies already arrive via the streamed
  // POST response the customer's own message triggered, so re-sending them
  // here would just duplicate them in the widget.
  const messages = await prisma.message.findMany({
    where: {
      ticketId: ticket.id,
      senderType: 'agent',
      isInternal: false,
      ...(after ? { createdAt: { gt: new Date(after) } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: 20,
  });

  return NextResponse.json(
    {
      messages: messages.map((m) => ({ id: m.id, content: m.content, createdAt: m.createdAt.toISOString() })),
      // Lets the widget re-derive the "aguardando atendente" flag (see
      // api/chat/route.ts's `escalated` field) after a page reload, when
      // there's no in-flight streamed response to carry it — polling is
      // already happening for agent messages, this just rides along.
      escalated: isHumanHandling(ticket),
    },
    { headers: CORS_HEADERS },
  );
}
