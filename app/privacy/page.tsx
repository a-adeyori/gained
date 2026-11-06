// Privacy policy (draft). Every statement here describes what the code actually does; keep it
// in step when data handling changes (lib/media.ts, lib/escrow.ts settle, lib/auth.ts).

import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-page';

export const metadata: Metadata = { title: 'Privacy policy' };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="November 5, 2026">
      <section>
        <p>
          Gained is run by <strong>[Company legal name]</strong>. This policy explains what we collect when you use Gained,
          why, who we share it with, and how long we keep it. Questions or requests: <strong>[privacy contact email]</strong>.
        </p>
      </section>

      <section id="recordings">
        <h2>Session recordings</h2>
        <ul>
          <li>Every session’s audio is recorded, with the parent’s (or adult student’s) agreement at booking. It’s how the quiz is written from what was actually covered.</li>
          <li>When the session ends, the audio is turned into a written transcript and the <strong>audio is deleted immediately</strong>. It’s never kept longer than one hour, even if transcription fails. No person listens to it.</li>
          <li>The transcript is used only to write that session’s quizzes, and is <strong>deleted when the session settles</strong> (after the 48-hour check-in).</li>
        </ul>
      </section>

      <section>
        <h2>What we collect</h2>
        <ul>
          <li><strong>Account details:</strong> name, email, password (stored only as a one-way hash), and your role. For students, whether they’re under 18, and who their parent is.</li>
          <li><strong>Tutor profile:</strong> subjects, price, bio, availability, and the PayPal email payouts go to.</li>
          <li><strong>Sessions:</strong> subject, time, what the family planned to cover, the topics the tutor confirmed, the tutor’s notes, the transcript (until settlement, as above), and any photos of worked problems the tutor uploads (deleted once processed, within one hour).</li>
          <li><strong>Quizzes:</strong> questions, answers, scores, and the reasoning behind each grade. These make up the results families and tutors see, and are needed to review appeals.</li>
          <li><strong>Payments:</strong> PayPal handles all card and bank details; we never see them. We keep PayPal’s order, authorization, capture and payout IDs, and the amounts.</li>
          <li><strong>Daily problem:</strong> students’ answers and streaks.</li>
        </ul>
      </section>

      <section>
        <h2>Who we share it with</h2>
        <p>Only the services that make Gained work, each for its one job:</p>
        <ul>
          <li><strong>PayPal:</strong> holding, capturing and refunding payments, and paying tutors.</li>
          <li><strong>OpenAI:</strong> turning session audio into a transcript.</li>
          <li><strong>Anthropic (Claude):</strong> working out what a session covered from its transcript, photos and the tutor’s notes, writing quizzes, grading answers, and answering tutors’ questions about their own dashboard.</li>
          <li><strong>Resend:</strong> sending email (quiz links, booking and results notices, sign-in links).</li>
          <li><strong>Render:</strong> hosting the app and its database, in the United States.</li>
        </ul>
        <p>Within Gained, a session’s results are visible to its student, the paying parent, the tutor, and our admins (who review appeals). We don’t sell personal data or use it for advertising.</p>
      </section>

      <section>
        <h2>Cookies and browser storage</h2>
        <ul>
          <li>One cookie keeps you signed in, for up to 30 days. It can’t be read by scripts on the page.</li>
          <li>The tutor dashboard remembers its layout in your browser.</li>
          <li>No advertising or tracking cookies.</li>
        </ul>
      </section>

      <section>
        <h2>How long we keep it</h2>
        <ul>
          <li>Audio: deleted right after transcription (at most one hour).</li>
          <li>Photos of worked problems: deleted once processed (at most one hour).</li>
          <li>Transcripts: deleted when the session settles.</li>
          <li>Accounts, sessions, quiz results and payment records: while your account is open, and afterwards as long as needed for accounting and legal obligations: <strong>[retention period]</strong>.</li>
        </ul>
      </section>

      <section>
        <h2>Children</h2>
        <p>
          Students under 18 use Gained with a parent, who books and pays for sessions and agrees to the recording.{' '}
          <strong>[Policy for children under 13, and how parental consent is verified under COPPA, to be decided with counsel.]</strong>
        </p>
      </section>

      <section>
        <h2>Your choices</h2>
        <ul>
          <li>You can see your sessions, results and how every answer was graded in the app, and appeal a grade within 72 hours.</li>
          <li>To get a copy of your data or delete your account, email <strong>[privacy contact email]</strong>.</li>
        </ul>
      </section>
    </LegalPage>
  );
}
