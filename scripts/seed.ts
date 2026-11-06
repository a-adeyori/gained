// Demo data so dashboards look alive: 3 tutors, 5 students (two families and an adult
// student), 20 sessions across every escrow state. All of it is marked is_seed (and uses
// @example.com emails), so it never counts as pilot results and can be removed cleanly.
//
//   npm run seed            add the demo data (replaces any earlier seed data)
//   npm run seed -- --clear remove it
//
// Also creates the admin account from ADMIN_EMAIL / ADMIN_PASSWORD if set. For the admin alone,
// with no demo data, use `npm run create-admin`.

import type { Question } from '../lib/claude';
import { ensureAdmin } from './admin';
import { db } from '../lib/db';
import type { EscrowState } from '../lib/generated/prisma/enums';
import { baseCentsFor, computeSplit } from '../lib/payout';
import { hashPassword } from '../lib/signing';

const DEMO_PASSWORD = 'gained-demo';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// A small deterministic random, so every seed run produces the same data.
let state = 42;
const rand = () => ((state = (state * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

const TOPICS = {
  Math: ['Linear equations', 'Quadratic factoring', 'Systems of equations', 'Exponent rules', 'Slope and intercepts', 'Derivatives of polynomials'],
  Physics: ['Kinematics', "Newton's second law", 'Free-body diagrams', 'Conservation of energy', 'Projectile motion', 'Momentum'],
};

function questions(subject: 'Math' | 'Physics', topic: string, seed: number): Question[] {
  return Array.from({ length: 5 }, (_, i) => {
    const a = 2 + ((seed + i) % 7);
    const b = 3 + ((seed * 3 + i) % 9);
    const isMc = i % 2 === 0;
    const prompt =
      subject === 'Math'
        ? `Solve for $x$: $${a}x + ${b} = ${a * (i + 2) + b}$`
        : `A ${a} kg cart accelerates at ${b} m/s². What net force acts on it?`;
    const answer = subject === 'Math' ? i + 2 : a * b;
    return {
      id: `q${i + 1}`,
      topic,
      skill: topic,
      difficulty: (['easy', 'easy', 'medium', 'medium', 'hard'] as const)[i],
      type: isMc ? 'multiple_choice' : 'numeric',
      prompt,
      choices: isMc ? [answer - 1, answer, answer + 2, answer * 2].map(String) : [],
      correct_choice: isMc ? 1 : null,
      numeric_answer: isMc ? null : answer,
      tolerance: isMc ? null : 0.01,
      unit: subject === 'Physics' && !isMc ? 'N' : null,
      model_answer: String(answer),
      rubric: '',
      explanation: subject === 'Math' ? `Subtract ${b}, then divide by ${a}.` : 'Use F = ma.',
    };
  });
}

async function clear() {
  const seedSessions = await db.session.findMany({ where: { is_seed: true }, select: { id: true } });
  const ids = seedSessions.map((s) => s.id);
  await db.answer.deleteMany({ where: { quiz: { session_id: { in: ids } } } });
  await db.quiz.deleteMany({ where: { session_id: { in: ids } } });
  await db.result.deleteMany({ where: { session_id: { in: ids } } });
  await db.appeal.deleteMany({ where: { session_id: { in: ids } } });
  await db.escrow.deleteMany({ where: { session_id: { in: ids } } });
  await db.session.deleteMany({ where: { id: { in: ids } } });
  const seedUsers = { email: { endsWith: '@example.com' } };
  await db.availability.deleteMany({ where: { tutor: seedUsers } });
  await db.user.updateMany({ where: seedUsers, data: { parent_id: null } });
  await db.user.deleteMany({ where: seedUsers });
  console.log(`Removed ${ids.length} seed sessions and their users.`);
}

async function seed() {
  await clear();
  const password_hash = await hashPassword(DEMO_PASSWORD);
  const user = (data: { role: 'parent' | 'student' | 'tutor'; name: string; email: string } & Record<string, unknown>) =>
    db.user.create({ data: { password_hash, ...data } });

  const tutors = await Promise.all([
    user({ role: 'tutor', name: 'Maya Okafor', email: 'maya.tutor@example.com', paypal_email: 'maya.tutor@example.com', subjects: ['Math'], price_cents: 6000, bio: 'Algebra and precalculus. Former high school teacher.', service_area: 'Brooklyn, NY' }),
    user({ role: 'tutor', name: 'Daniel Reyes', email: 'daniel.tutor@example.com', paypal_email: 'daniel.tutor@example.com', subjects: ['Physics', 'Math'], price_cents: 7000, bio: 'Physics TA. Mechanics, calculus.', service_area: 'Queens, NY' }),
    user({ role: 'tutor', name: 'Priya Shah', email: 'priya.tutor@example.com', paypal_email: 'priya.tutor@example.com', subjects: ['Math'], price_cents: 5000, bio: 'Learning assistant for intro calculus.', service_area: 'Manhattan, NY' }),
  ]);
  const parentA = await user({ role: 'parent', name: 'Angela Brooks', email: 'angela.parent@example.com' });
  const parentB = await user({ role: 'parent', name: 'Marcus Lee', email: 'marcus.parent@example.com' });
  const students = await Promise.all([
    user({ role: 'student', name: 'Jordan Brooks', email: 'jordan.student@example.com', is_minor: true, parent_id: parentA.id }),
    user({ role: 'student', name: 'Ava Brooks', email: 'ava.student@example.com', is_minor: true, parent_id: parentA.id }),
    user({ role: 'student', name: 'Ethan Lee', email: 'ethan.student@example.com', is_minor: true, parent_id: parentB.id }),
    user({ role: 'student', name: 'Sofia Lee', email: 'sofia.student@example.com', is_minor: false, parent_id: parentB.id }),
  ]);
  // An adult college student who pays for their own sessions.
  const adult = await user({ role: 'parent', name: 'Kwame Mensah', email: 'kwame.adult@example.com' });
  const learners = [
    ...students.map((s) => ({ student: s, payer: s.parent_id === parentA.id ? parentA : parentB })),
    { student: adult, payer: adult },
  ];

  // Two weeks of availability for each tutor: weekday evenings and Saturday mornings.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const tutor of tutors) {
    for (let d = 0; d < 14; d++) {
      const day = new Date(today.getTime() + d * DAY);
      const dow = day.getDay();
      if (dow === 0) continue;
      const [from, to] = dow === 6 ? [9, 13] : [16, 20];
      await db.availability.create({
        data: { tutor_id: tutor.id, start_at: new Date(day.getTime() + from * HOUR), end_at: new Date(day.getTime() + to * HOUR) },
      });
    }
  }

  // 20 sessions: 14 in the past (settled, returned, awaiting, appeal), 6 ahead (held).
  const plan: { daysAgo: number; state: EscrowState }[] = [
    ...[34, 30, 27, 24, 21, 18, 15, 12, 9].map((daysAgo) => ({ daysAgo, state: 'settled' as const })),
    { daysAgo: 20, state: 'returned' },
    { daysAgo: 6, state: 'returned' },
    { daysAgo: 4, state: 'in_appeal' },
    { daysAgo: 2, state: 'awaiting_retention' },
    { daysAgo: 1, state: 'base_paid' },
    ...[-1, -2, -3, -5, -6, -8].map((daysAgo) => ({ daysAgo, state: 'held' as const })),
  ];

  for (const [n, p] of plan.entries()) {
    const tutor = tutors[n % 3];
    const { student, payer } = learners[n % learners.length];
    const subject = (tutor.subjects.includes('Physics') && n % 2 ? 'Physics' : 'Math') as 'Math' | 'Physics';
    const topic = pick(TOPICS[subject]);
    const start = new Date(today.getTime() - p.daysAgo * DAY + 17 * HOUR);
    const end = new Date(start.getTime() + HOUR);
    const past = p.daysAgo > 0;
    const price = tutor.price_cents ?? 6000;

    // Pre scores between 30 and 70; most sessions gain, the "returned" ones don't.
    const pre = 30 + Math.round(rand() * 40);
    const gain = p.state === 'returned' ? -5 + rand() * 5 : 10 + rand() * 30;
    const post = Math.min(100, Math.max(0, Math.round(pre + gain)));
    const retention = Math.min(100, Math.max(0, Math.round(post - rand() * 10)));
    const hasRetention = ['settled', 'returned', 'in_appeal'].includes(p.state);
    const split = computeSplit({ priceCents: price, preScore: pre, postScore: post, retentionScore: hasRetention ? retention : null, tutorAverageGain: 0.4 });
    const settled = p.state === 'settled' || p.state === 'returned';

    const session = await db.session.create({
      data: {
        is_seed: true,
        tutor_id: tutor.id,
        student_id: student.id,
        payer_id: payer.id,
        start_at: start,
        end_at: end,
        ended_at: past ? end : null,
        price_cents: price,
        subject,
        planned_topics: topic,
        meeting_place: 'Brooklyn Public Library, Central branch',
        consent_recording: n % 4 !== 0,
        status: !past ? 'booked' : settled ? 'settled' : 'complete',
        notes: n % 4 === 0 ? `- ${topic}\n- Worked examples\n- Common mistakes` : null,
        topics_json: past ? { topics: [{ name: topic, skills: [topic], problem_types: ['worked examples'] }], worked_problems: [], summary: `Covered ${topic.toLowerCase()}.` } : undefined,
        topics_confirmed_at: past ? end : null,
        tutor_confirmed_at: past ? end : null,
        family_confirmed_at: past ? new Date(end.getTime() + 2 * HOUR) : null,
        paypal_order_id: `SEED-ORDER-${n}`,
      },
    });
    await db.escrow.create({
      data: {
        session_id: session.id,
        order_id: `SEED-ORDER-${n}`,
        authorization_id: `SEED-AUTH-${n}`,
        authorized_at: new Date(start.getTime() - 3 * DAY),
        reauthorized: past && p.daysAgo > 3,
        state: p.state,
        base_capture_id: past ? `SEED-CAP-BASE-${n}` : null,
        bonus_capture_id: p.state === 'settled' ? `SEED-CAP-BONUS-${n}` : null,
        base_payout_id: past ? `SEED-PAYOUT-BASE-${n}` : null,
        bonus_payout_id: p.state === 'settled' ? `SEED-PAYOUT-BONUS-${n}` : null,
        returned_cents: settled ? split.returnedCents : null,
      },
    });

    const kinds = past ? (['baseline', 'post', ...(hasRetention ? ['retention' as const] : [])] as const) : (['baseline'] as const);
    for (const [k, kind] of kinds.entries()) {
      const qs = questions(subject, topic, n * 10 + k);
      const score = kind === 'baseline' ? pre : kind === 'post' ? post : retention;
      const sent = kind === 'baseline' ? new Date(start.getTime() - 2 * DAY) : kind === 'post' ? end : new Date(end.getTime() + 48 * HOUR);
      const completed = past ? new Date(sent.getTime() + HOUR) : null;
      const quiz = await db.quiz.create({
        data: {
          session_id: session.id,
          kind,
          questions_json: qs,
          sent_at: sent,
          closes_at: kind === 'retention' ? new Date(sent.getTime() + 12 * HOUR) : null,
          completed_at: completed,
          score: past ? score : null,
        },
      });
      if (!past) continue;
      // Mark the first round(score/20) questions right, so per-question grades match the score.
      const right = Math.round(score / 20);
      for (const [i, q] of qs.entries()) {
        const correct = i < right;
        await db.answer.create({
          data: {
            quiz_id: quiz.id,
            question_index: i,
            answer: q.type === 'multiple_choice' ? (correct ? '1' : '0') : String(correct ? q.numeric_answer : (q.numeric_answer ?? 0) + 1),
            score: correct ? 1 : 0,
            rationale: correct ? `Correct. ${q.explanation}` : `The answer is ${q.model_answer}. ${q.explanation}`,
          },
        });
      }
    }

    if (past) {
      await db.result.create({
        data: {
          session_id: session.id,
          pre_score: pre,
          post_score: post,
          retention_score: hasRetention ? retention : null,
          gain_quiz: split.gainQuiz,
          gain_retention: hasRetention ? split.gainRetention : null,
          tutor_pay_cents: settled ? split.tutorPayCents : null,
          rationale:
            post > pre
              ? `${student.name.split(' ')[0]} went from ${pre}% to ${post}% on ${topic.toLowerCase()}, getting the core steps right on new problems. The remaining misses were on the hardest question.`
              : `${student.name.split(' ')[0]} scored about the same before and after on ${topic.toLowerCase()}, so no learning bonus was earned. The tutor still receives the guaranteed base of ${(baseCentsFor(price) / 100).toFixed(2)} dollars.`,
        },
      });
    }
    if (p.state === 'in_appeal') {
      await db.appeal.create({ data: { session_id: session.id, opened_by: payer.id, reason: 'Question 4 asked about a topic we did not cover in the session.' } });
    }
  }

  console.log(`Seeded 3 tutors, 5 students and ${plan.length} sessions. Demo password for every @example.com account: ${DEMO_PASSWORD}`);
}

async function main() {
  if (process.argv.includes('--clear')) await clear();
  else await seed();
  await ensureAdmin();
}

main()
  .then(() => db.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });
