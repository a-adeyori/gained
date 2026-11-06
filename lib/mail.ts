// Outgoing email. With BREVO_API_KEY set, sends through Brevo's HTTP API; otherwise with
// RESEND_API_KEY set, through Resend's. With neither (local development), prints each email to
// the server console so its links can be clicked. Never throws: a lost email must not break a
// booking, a quiz or a payment. Server-only.

export type Email = { to: string; subject: string; text: string };

/** Absolute link into the app, for emails. */
export function appUrl(path = '') {
  const base = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}${path}`;
}

/** Splits MAIL_FROM ("Gained <hello@example.com>" or a bare address) into name and address. */
export function parseSender(from: string): { name?: string; email: string } {
  const match = from.match(/^\s*(.*?)\s*<\s*([^>\s]+)\s*>\s*$/);
  if (!match) return { email: from.trim() };
  const name = match[1].replace(/^"(.*)"$/, '$1').trim();
  return name ? { name, email: match[2] } : { email: match[2] };
}

export async function sendEmail(email: Email): Promise<boolean> {
  const brevoKey = process.env.BREVO_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!brevoKey && !resendKey) {
    if (process.env.NODE_ENV === 'production') console.warn(`No BREVO_API_KEY or RESEND_API_KEY set; email to ${email.to} not sent.`);
    console.log(`\n--- email (not sent: no email API key) ---\nTo: ${email.to}\nSubject: ${email.subject}\n\n${email.text}\n--- end email ---\n`);
    return false;
  }
  try {
    const res = brevoKey ? await sendWithBrevo(brevoKey, email) : await sendWithResend(resendKey!, email);
    if (!res.ok) {
      console.error(`Email to ${email.to} failed: ${res.status} ${await res.text().catch(() => '')}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Email to ${email.to} failed`, err);
    return false;
  }
}

function sendWithBrevo(key: string, email: Email) {
  const from = process.env.MAIL_FROM;
  if (!from) throw new Error('MAIL_FROM must be set to a sender verified in Brevo.');
  return fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': key, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: parseSender(from),
      to: [{ email: email.to }],
      subject: email.subject,
      textContent: email.text,
    }),
  });
}

function sendWithResend(key: string, email: Email) {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || 'Gained <onboarding@resend.dev>',
      to: [email.to],
      subject: email.subject,
      text: email.text,
    }),
  });
}
