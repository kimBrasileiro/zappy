#!/usr/bin/env node
// One-off platform setup, NOT part of the deployed app — submits this
// deployment's WhatsApp message templates to Meta for approval. Run once
// per deployment (or again if a template's copy ever needs to change,
// which requires a NEW template name — Meta doesn't let you edit an
// approved one in place). See lib/whatsapp/client.ts#sendWhatsAppTemplate,
// which sends by exactly these names.
//
// Usage:
//   WHATSAPP_BUSINESS_ACCOUNT_ID=... WHATSAPP_CLOUD_API_TOKEN=... node scripts/submit-whatsapp-templates.mjs

const GRAPH_API_VERSION = 'v21.0';

const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const token = process.env.WHATSAPP_CLOUD_API_TOKEN;
if (!wabaId || !token) {
  console.error('Set WHATSAPP_BUSINESS_ACCOUNT_ID and WHATSAPP_CLOUD_API_TOKEN first.');
  process.exit(1);
}

// UTILITY, not MARKETING — both are transactional (an existing booking's
// own details), Meta's documented use case for this category, and it
// avoids the marketing-consent requirements a MARKETING template would need.
const TEMPLATES = [
  {
    name: 'booking_reminder',
    language: 'pt_BR',
    category: 'UTILITY',
    components: [
      {
        type: 'BODY',
        text: 'Olá {{1}}! Lembrete: seu agendamento de {{2}} é {{3}}, dia {{4}} às {{5}}. Alguma dúvida, é só responder aqui.',
        example: { body_text: [['Maria', 'Corte de cabelo', 'amanhã', '24/05', '15:00']] },
      },
    ],
  },
  {
    name: 'booking_cancelled',
    language: 'pt_BR',
    category: 'UTILITY',
    components: [
      {
        type: 'BODY',
        text: 'Olá {{1}}, seu agendamento de {{2}} em {{3}} às {{4}} foi cancelado. Quer reagendar? É só responder por aqui.',
        example: { body_text: [['Maria', 'Corte de cabelo', '24/05', '15:00']] },
      },
    ],
  },
];

async function submitTemplate(template) {
  const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/message_templates`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(template),
  });
  const body = await response.json();
  if (!response.ok) {
    console.error(`✗ ${template.name}: ${response.status} ${JSON.stringify(body)}`);
    return;
  }
  console.log(`✓ ${template.name}: id=${body.id} status=${body.status ?? 'PENDING'}`);
}

for (const template of TEMPLATES) {
  await submitTemplate(template);
}

console.log('\nCheck approval status any time with:');
console.log(`  curl "https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/message_templates?access_token=$WHATSAPP_CLOUD_API_TOKEN"`);
