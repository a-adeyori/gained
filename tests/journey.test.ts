import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextStep, stageOf, stageStatuses, type JourneySession } from '../lib/journey';

const now = new Date('2026-10-20T12:00:00Z');
const hours = (h: number) => new Date(now.getTime() + h * 3_600_000);

const base = (over: Partial<JourneySession> = {}): JourneySession => ({
  id: 's1',
  status: 'booked',
  start_at: hours(24),
  ended_at: null,
  tutor_id: 'tutor',
  student_id: 'kid',
  payer_id: 'parent',
  topics_json: null,
  topics_confirmed_at: null,
  tutor_confirmed_at: null,
  family_confirmed_at: null,
  escrow: { state: 'held' },
  quizzes: [{ id: 'q-base', kind: 'baseline', sent_at: hours(-1), completed_at: null, closes_at: null }],
  student: { name: 'Ada Lovelace' },
  tutor: { name: 'Maya Okafor' },
  ...over,
});

test('before the hold is approved, only the payer can act', () => {
  const s = base({ escrow: null, quizzes: [] });
  assert.equal(stageOf(s), 'Booked');
  assert.equal(nextStep(s, 'parent', now)?.kind, 'action');
  assert.equal(nextStep(s, 'tutor', now)?.kind, 'wait');
});

test('the student is asked for the warm-up; the parent gets the link to send', () => {
  const s = base();
  assert.equal(stageOf(s), 'Warm-up');
  const kid = nextStep(s, 'kid', now);
  assert.equal(kid?.kind === 'action' && kid.quizId, 'q-base');
  assert.match(nextStep(s, 'parent', now)!.title, /Ada has a warm-up/);
});

test('the tutor gets the session room 15 minutes before the start', () => {
  assert.equal(nextStep(base({ start_at: hours(2) }), 'tutor', now)?.kind, 'wait');
  const soon = nextStep(base({ start_at: hours(0.2) }), 'tutor', now);
  assert.equal(soon?.kind === 'action' && soon.href, '/sessions/s1/live');
});

test('after the session the tutor confirms topics, then the family confirms it happened', () => {
  const ended = base({ status: 'ended', ended_at: hours(-1), topics_json: [{ topic: 'x' }] });
  assert.equal(stageOf(ended), 'Session');
  assert.equal(nextStep(ended, 'tutor', now)?.kind === 'action' && nextStep(ended, 'tutor', now)?.title, 'Confirm what you covered');
  assert.equal(nextStep(ended, 'parent', now)?.kind, 'wait');

  const confirmed = { ...ended, topics_confirmed_at: hours(-0.5), tutor_confirmed_at: hours(-0.5) };
  assert.equal(stageOf(confirmed), 'Quiz');
  assert.equal(nextStep(confirmed, 'parent', now)?.title, 'Did the session happen?');
});

test('an adult student who pays for themselves is asked to take the quiz', () => {
  const s = base({
    payer_id: 'kid',
    ended_at: hours(-1),
    topics_confirmed_at: hours(-0.5),
    tutor_confirmed_at: hours(-0.5),
    family_confirmed_at: hours(-0.4),
    escrow: { state: 'base_paid' },
    quizzes: [{ id: 'q-post', kind: 'post', sent_at: hours(-0.3), completed_at: null, closes_at: null }],
  });
  const step = nextStep(s, 'kid', now);
  assert.equal(step?.kind === 'action' && step.quizId, 'q-post');
});

test('the check-in waits 48 hours, then settles to Paid', () => {
  const afterQuiz = base({
    ended_at: hours(-2),
    topics_confirmed_at: hours(-1.5),
    escrow: { state: 'awaiting_retention' },
    quizzes: [{ id: 'q-post', kind: 'post', sent_at: hours(-1), completed_at: hours(-0.5), closes_at: null }],
  });
  assert.equal(stageOf(afterQuiz), 'Check-in');
  assert.match(nextStep(afterQuiz, 'kid', now)!.title, /Check-in quiz coming/);

  const paid = { ...afterQuiz, escrow: { state: 'settled' } };
  assert.equal(stageOf(paid), 'Paid');
  assert.ok(stageStatuses(paid).every((x) => x.status === 'done' || x.status === 'skipped'));
  // The warm-up was never completed, so it shows as skipped rather than done.
  assert.equal(stageStatuses(paid)[1].status, 'skipped');
});
