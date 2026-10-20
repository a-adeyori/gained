# Gained

Tutoring where parents pay for learning, not hours. The full session price is held through PayPal at booking. After the session, an AI quiz built from what was actually covered is compared with a baseline, and the tutor is paid an 80% guaranteed base plus up to a 20% bonus tied to measured learning gain. Whatever isn't earned goes back to the parent automatically.

Built for the PayPal AI Hackathon (Build What's Next with PayPal and AI). All payments run in the PayPal sandbox.

## How a session flows

1. **Booking.** A parent picks a slot in the tutor's Bryntum calendar and approves a PayPal hold (`intent: AUTHORIZE`) for the full price. A 5-question baseline is written from the tutor's planned topics.
2. **Session.** The tutor records audio in the browser (with consent), adds photos of worked problems, or types 3–5 bullet points.
3. **After the session.** The Render workflow transcribes the audio (OpenAI `gpt-transcribe`), extracts what was covered (Claude, with the photos), and the tutor confirms the topic list in one tap. Claude writes a post-session quiz and a retention quiz, and a second Claude call checks each one.
4. **Base.** Once both sides confirm the session happened (the family's side is automatic after 24 hours, or when the student takes the quiz), the 80% base is captured with `final_capture: false` and paid to the tutor through Payouts.
5. **Retention.** The cron job sends the retention quiz 48 hours after the session. It closes 12 hours later; an unanswered quiz is scored at the tutor's rolling average gain.
6. **Settlement.** After the 72-hour appeal window, the bonus is captured with `final_capture: true` (which releases the rest to the parent), or the hold is voided if no bonus was earned.

Tutor pay = price × (0.80 + 0.125 × g_quiz + 0.075 × g_retention), where g is normalized gain `(post − pre) / (100 − pre)`, clamped to 0–1. A baseline of 90% or more uses the score itself.

Holds older than 72 hours are reauthorized once, immediately before a capture (`ensureFreshAuthorization` in `lib/paypal.ts`).

## Project layout

| Path | What it is |
| --- | --- |
| `lib/paypal.ts` | Every PayPal call: orders, authorize, capture, void, reauthorize, payouts |
| `lib/payout.ts` | The payout formula, in integer cents |
| `lib/escrow.ts` | Escrow lifecycle: booking, base capture, settlement |
| `lib/claude.ts` | Every Claude call, each validated against a Zod schema with one retry |
| `lib/grading.ts` | Deterministic grading for multiple choice and numeric answers |
| `lib/pipeline.ts` | One function per workflow task |
| `workflow/index.ts` | The Render Workflow service (tasks wrap `lib/pipeline.ts`) |
| `scripts/cron.ts` | The Render Cron Job (every 15 minutes) |
| `scripts/money-loop.ts` | Standalone sandbox test of the money flow |
| `scripts/seed.ts` | Demo data (3 tutors, 5 students, 20 sessions), all flagged `is_seed` |
| `prisma/schema.prisma` | Data model |
| `app/` | Next.js App Router screens and API routes |

## Run it locally

Needs Node.js 20.9 or later, a Postgres database, and a Redis-compatible Key Value store (for example `docker run -p 6379:6379 valkey/valkey`).

```bash
npm install
cp env.example .env.local   # fill it in (see below)
npx prisma migrate deploy    # creates the tables
npm run create-admin         # admin account from ADMIN_EMAIL / ADMIN_PASSWORD (resolves appeals)
npm run seed                 # optional demo data; prints the demo password
npm run dev
```

With `WORKFLOW_MODE=inline` in `.env.local`, workflow tasks run inside the web process, so the full flow works without deploying to Render. Run `npm run cron` by hand to send retention quizzes and settle sessions.

`npm test` runs the unit tests (payout math, grading, retention timing, the reauthorization rule).

### Test the PayPal money loop on its own

```bash
npm run money-loop                  # authorize, capture 80%, reauthorize, capture bonus
npm run money-loop -- --no-bonus    # authorize, capture 80%, void the rest
npm run money-loop -- --base-only   # leave a hold open for the day-4 reauthorization test
npm run money-loop -- --resume <authorization_id>
```

PayPal only allows reauthorizing after the 3-day honor period, so a same-day reauthorization is expected to fail. Start a `--base-only` hold and `--resume` it on day 4 to test reauthorizing a partially captured hold.

## Deploy to Render

`render.yaml` defines the web service, the workflow service (`gained-workflow`), the cron job, Postgres and Key Value. Create a Blueprint from this repo and fill in the secrets it asks for. The web service runs migrations before each deploy.

## Built with

- **PayPal** Orders v2 (authorize, capture, void, reauthorize) and Payouts, all server-side in `lib/paypal.ts`.
- **Claude** (`claude-sonnet-5-5` for topics, quizzes and grading; `claude-haiku-5-5` for the quiz check; `claude-opus-5-5` for the dashboard assistant).
- **OpenAI** `gpt-transcribe` for speech-to-text.
- **Render** web service, Workflows, Cron Job, Postgres and Key Value.
- **AG Studio** for the tutor dashboard and its AI assistant.
- **Bryntum Scheduler** for booking and availability.
- **APIMatic Context Plugin**: not set up yet. Install it (`npx context-plugins install paypal`) and use it for PayPal work before claiming the APIMatic prize.
