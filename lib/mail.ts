// Outgoing email. With RESEND_API_KEY set, sends through Resend's HTTP API. Without it (local
// development), prints each email to the server console so its links can be clicked. Never
// throws: a lost email must not break a booking, a quiz or a payment. Server-only.

export type Email = { to: string; subject: string; text: string };

/** Absolute link into the app, for emails. */
export function appUrl(path = '') {
  const base = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}${path}`;
}

export async function sendEmail(email: Email): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === 'production') console.warn(`RESEND_API_KEY is not set; email to ${email.to} not sent.`);
    console.log(`\n--- email (not sent: no RESEND_API_KEY) ---\nTo: ${email.to}\nSubject: ${email.subject}\n\n${email.text}\n--- end email ---\n`);
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || 'Gained <onboarding@resend.dev>',
        to: [email.to],
        subject: email.subject,
        text: email.text,
      }),
    });
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
