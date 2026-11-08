// Terms of service (draft). The money rules here are the product's actual rules (lib/payout.ts,
// lib/retention.ts); keep them in step if those change.

import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/legal-page';

export const metadata: Metadata = { title: 'Terms of service' };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" updated="November 8, 2026">
      <section>
        <p>
          These terms are an agreement between you and <strong>[Company legal name]</strong> (“Gained”). By creating an account
          you agree to them and to our{' '}
          <Link href="/privacy" className="underline underline-offset-4">
            privacy policy
          </Link>
          .
        </p>
      </section>

      <section>
        <h2>Accounts</h2>
        <ul>
          <li>Give accurate details and keep your password private. You’re responsible for activity on your account.</li>
          <li>Parents are responsible for the student accounts in their family.</li>
          <li>A student belongs to one family. The first parent or student to add the other makes the link.</li>
        </ul>
      </section>

      <section>
        <h2>How payment works</h2>
        <ul>
          <li>When you book, PayPal places a <strong>hold</strong> for the session price. Nothing is charged at booking.</li>
          <li>After the session, once both sides confirm it happened (or 24 hours pass), <strong>80% is paid to the tutor</strong> as a guaranteed base, whatever the quizzes show.</li>
          <li>Up to the remaining <strong>20% is a learning bonus</strong>, earned by measured progress: 12.5% of the price based on the quiz right after the session and 7.5% based on a check-in quiz 48 hours later, each scaled by normalized gain.</li>
          <li>Whatever part of the bonus isn’t earned is <strong>released back to you</strong> through PayPal.</li>
          <li>If the student skips a quiz, it’s scored at the tutor’s average gain. A score that drops counts as zero gain, never less.</li>
          <li>Gained keeps a <strong>10% platform fee</strong> from what the tutor receives (the base and any bonus). Families pay only the session price.</li>
        </ul>
      </section>

      <section>
        <h2>How progress is measured</h2>
        <p>
          Sessions aren’t recorded. The warm-up quiz is written from what the family says the student needs to learn, and the quizzes
          after the session from the tutor’s summary of what they taught. Tutors must describe what they actually taught, accurately,
          since the quizzes and their learning bonus depend on it. More in the{' '}
          <Link href="/privacy#quizzes" className="underline underline-offset-4">
            privacy policy
          </Link>
          .
        </p>
      </section>

      <section>
        <h2>Grades and appeals</h2>
        <ul>
          <li>Quizzes are written and graded by AI, and every grade shows its reasoning.</li>
          <li>The family or the tutor can appeal within <strong>72 hours</strong> of the session ending. A person reviews it before the final payment moves, and may adjust the tutor’s pay, never below the base.</li>
        </ul>
      </section>

      <section>
        <h2>Tutors</h2>
        <ul>
          <li>Tutors are <strong>[independent contractors / relationship to be decided]</strong>, set their own price and availability, and are paid to the PayPal email in their profile.</li>
          <li>Tutors must deliver the sessions they’re booked for and keep sessions appropriate for students’ ages.</li>
        </ul>
      </section>

      <section>
        <h2>Cancellations and refunds</h2>
        <p>
          <strong>[Cancellation window, no-shows and refund rules to be decided.]</strong> If a hold is never approved, no session is
          booked and nothing is charged.
        </p>
      </section>

      <section>
        <h2>Everything else</h2>
        <ul>
          <li>Don’t misuse Gained: no cheating on quizzes for someone else, no harassment, no attempts to break or probe the service.</li>
          <li>We may suspend accounts that break these terms.</li>
          <li>
            <strong>[Limitation of liability, disputes and governing law to be drafted by counsel.]</strong>
          </li>
          <li>Questions: <strong>[contact email]</strong>.</li>
        </ul>
      </section>
    </LegalPage>
  );
}
