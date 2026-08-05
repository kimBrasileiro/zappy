#!/usr/bin/env node
// GTM tooling — NOT part of the deployed app. Takes the CSV produced by
// find-leads.mjs and enriches it with a ready-to-copy, per-business WhatsApp
// opener and a generic email draft, plus outreach-tracking columns. This
// script only PREPARES text — it never sends anything. Sending stays
// manual, one at a time, from a real person's own WhatsApp/email: cold
// bulk-messaging this list via any WhatsApp number (Zappigo's shared
// Business API number or a personal one, scripted) would be unsolicited
// business-initiated messaging with no opt-in, which risks that number's
// standing with Meta and/or triggers WhatsApp's own anti-automation
// detection on a personal number — exactly what this project's moderation
// work exists to prevent, not cause.
//
// Usage:
//   node scripts/prep-outreach.mjs --in leads-vila-mariana.csv --out leads-vila-mariana-prepped.csv

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--in') args.in = argv[++i];
    else if (argv[i] === '--out') args.out = argv[++i];
  }
  return args;
}

// Minimal RFC4180-ish CSV parser matching find-leads.mjs's own quoting
// (double-quote-wrapped fields, "" as an escaped quote) — good enough since
// this only ever reads a file this same toolchain produced.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const headers = rows.shift();
  return rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
}

function toCsv(rows, headers) {
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map((h) => escape(row[h])).join(','));
  return lines.join('\n');
}

// Category -> the same pain-point framing already live on the marketing
// site's "Feito pro seu tipo de negócio" section (see messages/pt.json
// marketing.niches) — keeps outreach copy consistent with what the
// business owner will actually see if they click through to sign up.
function painPointFor(category) {
  const c = category.toLowerCase();
  if (c.includes('pet')) {
    return 'pra quem tá com as mãos ocupadas com banho e tosa o dia inteiro, ele cuida do agendamento sozinho';
  }
  if (c.includes('estétic') || c.includes('massage') || c.includes('massag')) {
    return 'sua cliente marca, remarca e confirma sozinha, sem vocês trocarem mensagem pra achar horário';
  }
  // salão de beleza / barbearia and anything else defaults here
  return 'enquanto vocês estão atendendo quem já tá na cadeira, ele responde e marca os próximos horários sozinho';
}

function whatsappDraftFor(row) {
  return (
    `Oi, tudo bem? Vi o ${row.name} aqui perto. Eu criei a Zappigo, um sistema que responde e agenda ` +
    `direto no WhatsApp da empresa com IA — ${painPointFor(row.category)}. Tá gratuito agora no ` +
    `lançamento, sem cartão. Posso configurar em uns 10 minutos pra vocês testarem essa semana?`
  );
}

const EMAIL_SUBJECT = 'Agendamento automático pelo WhatsApp, grátis no lançamento';

function emailBodyFor(row) {
  return (
    `Olá, tudo bem?\n\n` +
    `Meu nome é [seu nome], sou fundador da Zappigo — um sistema que responde e agenda automaticamente ` +
    `pelo WhatsApp usando IA, pensado pra negócios como o ${row.name}. ${painPointFor(row.category)}.\n\n` +
    `Estamos no lançamento e é gratuito, sem cartão de crédito, e fica pronto em minutos. Posso configurar ` +
    `com vocês essa semana pra testarem sem compromisso?\n\n` +
    `Abraço,\n[seu nome]`
  );
}

const TRACKING_HEADERS = ['status', 'contacted_at', 'response', 'notes'];

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.in) {
    console.error('Usage: node scripts/prep-outreach.mjs --in leads.csv [--out leads-prepped.csv]');
    process.exit(1);
  }
  const inPath = path.isAbsolute(args.in) ? args.in : path.join(process.cwd(), args.in);
  const outPath = args.out
    ? (path.isAbsolute(args.out) ? args.out : path.join(process.cwd(), args.out))
    : inPath.replace(/\.csv$/i, '-prepped.csv');

  const leads = parseCsv(readFileSync(inPath, 'utf8'));

  const enriched = leads.map((row) => ({
    ...row,
    whatsapp_draft: whatsappDraftFor(row),
    email_subject: EMAIL_SUBJECT,
    email_body: emailBodyFor(row),
    status: 'not_contacted',
    contacted_at: '',
    response: '',
    notes: '',
  }));

  const baseHeaders = Object.keys(leads[0] ?? {});
  const headers = [...baseHeaders, 'whatsapp_draft', 'email_subject', 'email_body', ...TRACKING_HEADERS];

  writeFileSync(outPath, toCsv(enriched, headers), 'utf8');
  console.log(`${enriched.length} contatos preparados. Salvo em: ${outPath}`);
  console.log('Abra no Excel/Sheets, copie o "whatsapp_draft" pra mandar manualmente, e atualize "status" conforme for contatando.');
}

main();
