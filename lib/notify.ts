// Who gets which email, and when. Each function loads what it needs and sends; none of them
// throws, so a notification problem never interrupts a booking, a quiz or a payment.
// Server-only. The wording lives in lib/emails.ts.

import { db } from './db';
import { baseCentsFor } from './payout';
import { bookedEmail, confirmHappenedEmail, familyEmail, quizEmail, settledEmail, topicsReadyEmail } from './emails';
import { appUrl, sendEmail } from './mail';
import { quizToken } from './signing';

async function safely(what: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (err) {
    console.error(`Notification failed (${what})`, err);
  }
}

const withPeople = { tutor: true, student: true, payer: true } as const;

/** The hold is approved: the session is booked. */
export const notifyBooked = (sessionId: string) =>
  safely('booked', async () => {
    const s = await db.session.findUniqueOrThrow({ where: { id: sessionId }, include: withPeople });
    const common = { subject: s.subject, studentName: s.student.name, tutorName: s.tutor.name, startAt: s.start_at, priceCents: s.price_cents };
    await sendEmail({ to: s.payer.email, ...bookedEmail({ ...common, to: 'payer', link: appUrl(`/sessions/${s.id}`) }) });
    await sendEmail({ to: s.tutor.email, ...bookedEmail({ ...common, to: 'tutor', link: appUrl('/home') }) });
    if (s.student_id !== s.payer_id) {
      await sendEmail({ to: s.student.email, ...bookedEmail({ ...common, to: 'student', link: appUrl('/home') }) });
    }
  });

/** A quiz is open for the student: the warm-up, the post-session quiz or the 48-hour check-in. */
export const notifyQuiz = (quizId: string) =>
  safely('quiz', async () => {
    const q = await db.quiz.findUniqueOrThrow({ where: { id: quizId }, include: { session: { include: withPeople } } });
    const s = q.session;
    await sendEmail({
      to: s.student.email,
      ...quizEmail({
        kind: q.kind,
        studentName: s.student.name,
        subject: s.subject,
        tutorName: s.tutor.name,
        link: appUrl(`/quiz/${q.id}?t=${quizToken(q.id)}`),
        closesAt: q.closes_at,
      }),
    });
  });

/** The topic list is ready for the tutor to confirm. */
export const notifyTopicsReady = (sessionId: string) =>
  safely('topics', async () => {
    const s = await db.session.findUniqueOrThrow({ where: { id: sessionId }, include: withPeople });
    if (s.topics_confirmed_at) return;
    await sendEmail({
      to: s.tutor.email,
      ...topicsReadyEmail({ tutorName: s.tutor.name, studentName: s.student.name, subject: s.subject, link: appUrl(`/sessions/${s.id}/live`) }),
    });
  });

/** The tutor ended the session: ask the payer to confirm it happened (releases the base). */
export const notifySessionEnded = (sessionId: string) =>
  safely('ended', async () => {
    const s = await db.session.findUniqueOrThrow({ where: { id: sessionId }, include: withPeople });
    if (s.family_confirmed_at) return;
    await sendEmail({ to: s.payer.email, ...confirmHappenedEmail({ tutorName: s.tutor.name, subject: s.subject, link: appUrl(`/sessions/${s.id}`) }) });
  });

/** The session settled: the bonus is paid and the rest returned. */
export const notifySettled = (sessionId: string) =>
  safely('settled', async () => {
    const s = await db.session.findUniqueOrThrow({ where: { id: sessionId }, include: { ...withPeople, escrow: true, result: true } });
    const baseCents = baseCentsFor(s.price_cents);
    const tutorPay = s.result?.tutor_pay_cents ?? baseCents;
    const common = {
      subject: s.subject,
      studentName: s.student.name,
      tutorName: s.tutor.name,
      baseCents,
      bonusCents: tutorPay - baseCents,
      returnedCents: s.escrow?.returned_cents ?? s.price_cents - tutorPay,
      link: appUrl(`/sessions/${s.id}`),
    };
    await sendEmail({ to: s.payer.email, ...settledEmail({ ...common, to: 'payer' }) });
    await sendEmail({ to: s.tutor.email, ...settledEmail({ ...common, to: 'tutor' }) });
  });

/**
 * A family link was made (or set up), so tell the other person.
 *  - parent-added-you / account-created: a parent added a student (account-created: a new one)
 *  - student-added-you: a student linked an existing parent
 *  - invited: a student added a parent email with no account yet
 *  - parent-joined: an invited parent signed up, so the student is now in their family
 */
export const notifyFamily = (
  kind: 'parent-added-you' | 'student-added-you' | 'account-created' | 'invited' | 'parent-joined',
  p: { toEmail: string; toName: string; byName: string },
) =>
  safely('family', async () => {
    const link =
      kind === 'account-created'
        ? appUrl(`/signup?role=student&email=${encodeURIComponent(p.toEmail)}`)
        : kind === 'invited'
          ? appUrl(`/signup?role=parent&email=${encodeURIComponent(p.toEmail)}`)
          : appUrl('/home');
    await sendEmail({ to: p.toEmail, ...familyEmail({ kind, toName: p.toName, byName: p.byName, link }) });
  });
