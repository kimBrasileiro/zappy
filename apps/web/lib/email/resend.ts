const RESEND_API_URL = 'https://api.resend.com/emails';

// Raw fetch rather than the `resend` SDK — same choice already made for
// lib/whatsapp/client.ts, keeps this a plain REST call with no extra
// dependency. Best-effort: a missing/misconfigured key should never crash
// the caller (a booking or escalation must still succeed either way), it
// just means the notification never actually goes out — loudly logged
// instead of thrown.
export async function sendEmail(to: string | string[], subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? 'Zappigo <onboarding@resend.dev>';

  if (!apiKey) {
    const recipients = Array.isArray(to) ? to.join(', ') : to;
    console.warn(`[email] credenciais ausentes — não enviado para ${recipients}: "${subject}"`);
    return;
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!response.ok) {
      console.error(`[email] send failed (${response.status}): ${await response.text()}`);
    }
  } catch (err) {
    console.error('[email] send threw', err);
  }
}
