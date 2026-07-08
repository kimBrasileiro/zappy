import { NextResponse } from 'next/server';

// Consumed by the ALB target group health check (infra/lib/ecs-stack.ts).
export function GET() {
  return NextResponse.json({ status: 'ok' });
}
