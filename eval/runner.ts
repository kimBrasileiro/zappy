import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import OpenAI from 'openai';
import { prisma } from '@zappy/db';
import { orchestrate, OrchestratorBlockedError } from '@zappy/web/lib/bot/orchestrator';

interface SeedBooking {
  scheduledAtOffsetHours: number;
  staffName?: string;
  customerPhone?: string;
  // true: the seeded booking belongs to the SAME customer the scripted
  // conversation talks as (simulates "this customer already has a booking
  // from before" — needed for reschedule scenarios, where create_booking's
  // own cancel-the-prior-booking logic is scoped by customerId+serviceId).
  // false/omitted: a distinct, unrelated customer (simulates someone else's
  // booking occupying a slot — for conflict/auto-allocation scenarios).
  sameCustomer?: boolean;
}

interface ScenarioTurn {
  message: string;
  // Only set on a turn expected to throw OrchestratorBlockedError before any
  // reply is generated (e.g. a guardrail) — checked instead of the
  // contains/ticket assertions below, which all assume a normal reply.
  expectBlocked?: string;
  expectContains?: string[];
  expectNotContains?: string[];
  expectTicketStatus?: string;
}

interface Scenario {
  name: string;
  description: string;
  service?: {
    name: string;
    durationMinutes: number;
    priceCents: number;
    is24h?: boolean;
    staffNames?: string[];
    cancellationNoticeHours?: number;
    cancellationFeeCents?: number;
  };
  faqs?: { question: string; answer: string }[];
  seedBooking?: SeedBooking;
  turns: ScenarioTurn[];
  expectBookingCount?: number;
  expectBookingStaff?: string;
  // Graded by the Gemini judge against the full transcript. "N/A..." skips
  // the judge call entirely — for scenarios fully covered by expectBlocked.
  successCriteria: string;
}

const SCENARIOS_DIR = join(__dirname, 'scenarios');
// Fixed rather than per-turn/per-scenario — every scenario in this suite is
// a single, isolated conversation in its own ephemeral company, so there's
// never a collision to worry about.
const CONVERSATION_ID = 'eval-conversation';

function loadScenarios(): Scenario[] {
  const files = readdirSync(SCENARIOS_DIR).filter((f) => f.endsWith('.json'));
  const scenarios: Scenario[] = [];
  for (const file of files) {
    const parsed = JSON.parse(readFileSync(join(SCENARIOS_DIR, file), 'utf8')) as Scenario[];
    scenarios.push(...parsed);
  }
  return scenarios;
}

let judgeClient: OpenAI | null = null;
function getJudgeClient(): OpenAI {
  if (!judgeClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
    // Same Gemini-via-OpenAI-compat setup as apps/web/lib/ai/gemini.ts — the
    // project has no Anthropic key configured, so "Claude-as-judge" (the
    // original phase-1 plan in this directory's README) isn't available;
    // Gemini grading its own bot's output is a real limitation (less
    // adversarial than an independent model) but still catches concrete,
    // objective failures — wrong price, false confirmation, wrong policy.
    judgeClient = new OpenAI({ apiKey, baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/' });
  }
  return judgeClient;
}

async function judge(transcript: string, successCriteria: string): Promise<{ pass: boolean; reason: string }> {
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const todayIso = new Date().toISOString().slice(0, 10);
  const response = await getJudgeClient().chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content:
          `Você avalia se a transcrição de uma conversa entre um cliente e um assistente de atendimento atende aos critérios de sucesso descritos. Hoje é ${todayIso} — não estranhe nem penalize datas relativas ("amanhã", "depois de amanhã") resolvidas para esse ano ou os anos seguintes, isso é o comportamento correto, não um erro. Seja rigoroso quanto ao que os critérios realmente pedem, mas não invente critérios extras que não foram descritos. Responda APENAS com um JSON no formato {"pass": boolean, "reason": "explicação curta"}, sem markdown, sem texto fora do JSON.`,
      },
      { role: 'user', content: `Critérios de sucesso:\n${successCriteria}\n\nTranscrição:\n${transcript}` },
    ],
    stream: false,
    reasoning_effort: 'none',
  } as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);

  const raw = response.choices[0]?.message?.content?.trim() ?? '{}';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  try {
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw) as { pass?: boolean; reason?: string };
    return { pass: !!parsed.pass, reason: parsed.reason ?? '(sem explicação)' };
  } catch {
    return { pass: false, reason: `judge returned unparseable output: ${raw.slice(0, 200)}` };
  }
}

async function collect(input: Parameters<typeof orchestrate>[0]) {
  const gen = orchestrate(input);
  let full = '';
  for (;;) {
    const next = await gen.next();
    if (next.done) return { text: full, ...next.value };
    full += next.value;
  }
}

async function setupScenario(scenario: Scenario) {
  const company = await prisma.company.create({
    data: {
      name: `Eval ${scenario.name}`,
      slug: `eval-${scenario.name}-${Date.now()}`,
      plan: 'starter',
      status: 'active',
    },
  });

  let service: { id: string } | null = null;
  if (scenario.service) {
    service = await prisma.service.create({
      data: {
        companyId: company.id,
        name: scenario.service.name,
        durationMinutes: scenario.service.durationMinutes,
        priceCents: scenario.service.priceCents,
        is24h: scenario.service.is24h ?? false,
        staffNames: scenario.service.staffNames ?? [],
        cancellationNoticeHours: scenario.service.cancellationNoticeHours ?? 0,
        cancellationFeeCents: scenario.service.cancellationFeeCents ?? 0,
      },
    });
  }

  if (scenario.faqs?.length) {
    await prisma.faq.createMany({
      data: scenario.faqs.map((f) => ({ companyId: company.id, question: f.question, answer: f.answer, active: true })),
    });
  }

  if (scenario.seedBooking && service) {
    const phone = scenario.seedBooking.customerPhone ?? '11900000000';
    const customer = await prisma.customer.create({
      data: scenario.seedBooking.sameCustomer
        ? { companyId: company.id, externalId: CONVERSATION_ID, phone, name: 'Seed Customer' }
        : { companyId: company.id, phone, name: 'Outro Cliente' },
    });
    await prisma.booking.create({
      data: {
        companyId: company.id,
        serviceId: service.id,
        customerId: customer.id,
        scheduledAt: new Date(Date.now() + scenario.seedBooking.scheduledAtOffsetHours * 60 * 60_000),
        durationMinutes: scenario.service!.durationMinutes,
        priceCents: scenario.service!.priceCents,
        staffName: scenario.seedBooking.staffName ?? null,
        notes: 'seed booking for eval',
      },
    });
  }

  return company;
}

async function cleanupScenario(companyId: string) {
  await prisma.message.deleteMany({ where: { companyId } });
  await prisma.booking.deleteMany({ where: { companyId } });
  await prisma.ticket.deleteMany({ where: { companyId } });
  await prisma.customer.deleteMany({ where: { companyId } });
  await prisma.faq.deleteMany({ where: { companyId } });
  await prisma.service.deleteMany({ where: { companyId } });
  await prisma.company.delete({ where: { id: companyId } });
}

async function runScenario(scenario: Scenario): Promise<{ name: string; passed: boolean; details: string[] }> {
  const company = await setupScenario(scenario);
  const details: string[] = [];
  let allPassed = true;
  const transcriptLines: string[] = [];

  try {
    for (const [i, turn] of scenario.turns.entries()) {
      transcriptLines.push(`Cliente: ${turn.message}`);

      if (turn.expectBlocked) {
        try {
          await collect({
            companySlug: company.slug,
            channel: 'site_chat',
            conversationId: CONVERSATION_ID,
            message: turn.message,
          });
          allPassed = false;
          details.push(`✗ turn ${i + 1}: expected blocked (${turn.expectBlocked}) but orchestrate() completed normally`);
        } catch (err) {
          if (err instanceof OrchestratorBlockedError && err.reason === turn.expectBlocked) {
            details.push(`✓ turn ${i + 1}: blocked as expected (${turn.expectBlocked})`);
          } else {
            allPassed = false;
            const reason = err instanceof OrchestratorBlockedError ? err.reason : String(err);
            details.push(`✗ turn ${i + 1}: expected blocked (${turn.expectBlocked}), got (${reason})`);
          }
        }
        continue;
      }

      const result = await collect({
        companySlug: company.slug,
        channel: 'site_chat',
        conversationId: CONVERSATION_ID,
        message: turn.message,
      });
      transcriptLines.push(`Assistente: ${result.text}`);
      const lower = result.text.toLowerCase();

      for (const needle of turn.expectContains ?? []) {
        const ok = lower.includes(needle.toLowerCase());
        if (!ok) allPassed = false;
        details.push(`${ok ? '✓' : '✗'} turn ${i + 1}: contains "${needle}"`);
      }
      for (const needle of turn.expectNotContains ?? []) {
        const ok = !lower.includes(needle.toLowerCase());
        if (!ok) allPassed = false;
        details.push(`${ok ? '✓' : '✗'} turn ${i + 1}: does not contain "${needle}"`);
      }

      if (turn.expectTicketStatus) {
        const customer = await prisma.customer.findFirst({
          where: { companyId: company.id, externalId: CONVERSATION_ID },
        });
        const ticket = customer
          ? await prisma.ticket.findFirst({
              where: { companyId: company.id, customerId: customer.id },
              orderBy: { createdAt: 'desc' },
            })
          : null;
        const ok = ticket?.status === turn.expectTicketStatus;
        if (!ok) allPassed = false;
        details.push(
          `${ok ? '✓' : '✗'} turn ${i + 1}: ticket status is "${turn.expectTicketStatus}" (actual: ${ticket?.status ?? 'none'})`,
        );
      }
    }

    if (scenario.expectBookingCount !== undefined) {
      const bookings = await prisma.booking.findMany({ where: { companyId: company.id, status: 'confirmed' } });
      const ok = bookings.length === scenario.expectBookingCount;
      if (!ok) allPassed = false;
      details.push(`${ok ? '✓' : '✗'} confirmed bookings: ${bookings.length} (expected ${scenario.expectBookingCount})`);

      if (ok && scenario.expectBookingStaff && bookings.length === 1) {
        const staffOk = bookings[0]!.staffName === scenario.expectBookingStaff;
        if (!staffOk) allPassed = false;
        details.push(`${staffOk ? '✓' : '✗'} booking staff: ${bookings[0]!.staffName} (expected ${scenario.expectBookingStaff})`);
      }
    }

    if (scenario.successCriteria && !scenario.successCriteria.startsWith('N/A')) {
      const verdict = await judge(transcriptLines.join('\n'), scenario.successCriteria);
      if (!verdict.pass) allPassed = false;
      details.push(`${verdict.pass ? '✓' : '✗'} judge: ${verdict.reason}`);
    }
  } finally {
    await cleanupScenario(company.id);
  }

  return { name: scenario.name, passed: allPassed, details };
}

async function main() {
  // Optional substring filter, e.g. `pnpm eval booking` runs only scenarios
  // whose name contains "booking".
  const filterArg = process.argv[2];
  const scenarios = loadScenarios().filter((s) => !filterArg || s.name.includes(filterArg));

  console.log(`Running ${scenarios.length} eval scenario(s)...\n`);

  const results: { name: string; passed: boolean; details: string[] }[] = [];
  for (const scenario of scenarios) {
    process.stdout.write(`▶ ${scenario.name}... `);
    const result = await runScenario(scenario);
    console.log(result.passed ? 'PASS' : 'FAIL');
    for (const line of result.details) console.log(`    ${line}`);
    results.push(result);
  }

  const passed = results.filter((r) => r.passed).length;
  console.log(`\n${passed}/${results.length} scenarios passed.`);

  if (passed < results.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
