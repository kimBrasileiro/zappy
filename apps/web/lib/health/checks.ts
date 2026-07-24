import OpenAI from 'openai';
import { prisma } from '@zappy/db';
import { PRIMARY_GEMINI_MODEL, FALLBACK_GEMINI_MODEL } from '../ai/gemini';
import { isStripeConfigured } from '../stripe/client';

export interface HealthCheckResult {
  name: string;
  status: 'ok' | 'error' | 'not_configured';
  latencyMs?: number;
  detail?: string;
}

async function timed(name: string, fn: () => Promise<string | void>): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const detail = (await fn()) ?? undefined;
    return { name, status: 'ok', latencyMs: Date.now() - start, detail };
  } catch (err) {
    return {
      name,
      status: 'error',
      latencyMs: Date.now() - start,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkDatabase(): Promise<HealthCheckResult> {
  return timed('Banco de dados (Postgres)', async () => {
    const count = await prisma.company.count();
    return `${count} empresas cadastradas`;
  });
}

// Real live pings (small max_tokens, no streaming) rather than just checking
// GEMINI_API_KEY is set — a present-but-revoked/expired key, or a model name
// that no longer exists, only shows up by actually calling the API.
async function checkGeminiModel(model: string): Promise<HealthCheckResult> {
  if (!process.env.GEMINI_API_KEY) {
    return { name: `Gemini (${model})`, status: 'not_configured', detail: 'GEMINI_API_KEY não configurada' };
  }
  return timed(`Gemini (${model})`, async () => {
    const client = new OpenAI({
      apiKey: process.env.GEMINI_API_KEY,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    });
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 5,
      stream: false,
      reasoning_effort: 'none',
    } as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);
    if (!response.choices[0]) throw new Error('resposta sem choices');
    return 'respondeu normalmente';
  });
}

async function checkResend(): Promise<HealthCheckResult> {
  if (!process.env.RESEND_API_KEY) {
    return { name: 'Resend (email)', status: 'not_configured', detail: 'RESEND_API_KEY não configurada' };
  }
  return timed('Resend (email)', async () => {
    // Resend's sending-only API keys (the kind this project uses) 401 on
    // read endpoints like /domains — they only have permission to send.
    // POSTing to /emails with an intentionally incomplete body still proves
    // the key authenticates (Resend rejects with 422 for bad payload, only
    // AFTER checking auth) without actually sending anything.
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (response.status === 401 || response.status === 403) throw new Error(`HTTP ${response.status} — chave inválida`);
    return 'chave válida';
  });
}

async function checkWhatsApp(): Promise<HealthCheckResult> {
  const token = process.env.WHATSAPP_CLOUD_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_CLOUD_API_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    return { name: 'WhatsApp Cloud API', status: 'not_configured', detail: 'token ou phone number id ausente' };
  }
  return timed('WhatsApp Cloud API', async () => {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}?fields=verified_name,quality_rating`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const body = (await response.json()) as { verified_name?: string; quality_rating?: string; error?: { message?: string } };
    if (!response.ok) throw new Error(body.error?.message ?? `HTTP ${response.status}`);
    return `${body.verified_name ?? 'número'} — qualidade: ${body.quality_rating ?? '—'}`;
  });
}

async function checkStripe(): Promise<HealthCheckResult> {
  if (!isStripeConfigured()) {
    return { name: 'Stripe', status: 'not_configured', detail: 'grátis no lançamento — Stripe desativado (FREE_TIER_MODE)' };
  }
  return timed('Stripe', async () => {
    const response = await fetch('https://api.stripe.com/v1/balance', {
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return 'chave válida';
  });
}

export async function runHealthChecks(): Promise<HealthCheckResult[]> {
  return Promise.all([
    checkDatabase(),
    checkGeminiModel(PRIMARY_GEMINI_MODEL),
    checkGeminiModel(FALLBACK_GEMINI_MODEL),
    checkResend(),
    checkWhatsApp(),
    checkStripe(),
  ]);
}
