import { NextResponse } from 'next/server';
import { prisma } from '@zappigo/db';

// Consumed by the GCP Uptime Check (infra/modules/zappy/monitoring.tf) and
// Cloud Run's own container health probes. A bare 200-always stub would
// never catch the most common real failure mode — the app process is up
// but Cloud SQL is unreachable (connection limit hit, instance down,
// credentials rotated) — so this does one cheap real query rather than
// just returning a static body.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    console.error('[health] database check failed', err);
    return NextResponse.json({ status: 'error', database: 'unreachable' }, { status: 503 });
  }
  return NextResponse.json({ status: 'ok' });
}
