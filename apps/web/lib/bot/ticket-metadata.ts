// Ticket.metadata (packages/db/prisma/schema/ticket.prisma) is an untyped
// Json column with no other consumer today — this is the single place that
// gives it a shape, so future keys (e.g. a CRM deal id) can be added here
// without touching bookingDraft.
export interface TicketMetadata {
  // Set by orchestrator.ts whenever check_availability resolves a real
  // service+date, read back into the next turn's system prompt, and cleared
  // on a successful create_booking. Exists because tool call/result content
  // is never persisted to conversation history (see loadHistory in
  // conversation.ts) — only this survives across turns, deterministically,
  // instead of relying on the model having restated it in its own prose.
  bookingDraft?: { serviceName: string; date: string }; // date: YYYY-MM-DD
}
