// Privacy policy (draft). Every statement here describes what the code actually does; keep it
// in step when data handling changes (lib/pipeline.ts, lib/escrow.ts settle, lib/auth.ts).

import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-page';

export const metadata: Metadata = { title: 'Privacy policy' };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="November 9, 2026">
      <section>
        <p>
          Gained is run by <strong>[Company legal name]</strong>. This policy explains what we collect when you use Gained,
          why, who we share it with, and how long we keep it. Questions or requests: <a href="mailto:adeyori.adekunle@bulldogs.aamu.edu" className="underline underline-offset-4 hover:text-ink">adeyori.adekunle@bulldogs.aamu.edu</a>.
        </p>
      </section>

      <section id="quizzes">
        <h2>Sessions and quizzes</h2>
        <ul>
          <li>Sessions happen online, on the tutor’s own Zoom or Google Meet link. Zoom or Google runs the call under its own privacy policy; Gained doesn’t receive it.</li>
          <li><strong>Gained doesn’t record sessions.</strong> No audio or video of a session is captured by Gained.</li>
          <li>The warm-up quiz before a session is written from what the family says the student needs to learn, entered at booking.</li>
          <li>The quiz after the session and the 48-hour check-in are written from the tutor’s summary of what they taught, which the tutor reviews as a list of topics before any quiz is written.</li>
        </ul>
      </section>

      <section>
        <h2>What we collect</h2>
        <ul>
          <li><strong>Account details:</strong> name, email, password (stored only as a one-way hash), and your role. For students, whether they’re under 18, and who their parent is.</li>
          <li><strong>Tutor profile:</strong> subjects, price, bio, their Zoom or Google Meet link (shown to families who book them), availability, and the PayPal email payouts go to.</li>
          <li><strong>Sessions:</strong> subject, time, what the family planned to cover, the topics the tutor confirmed, and the tutor’s summary of what they taught.</li>
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
          <li><strong>Elastic</strong> (its managed AI, which runs Anthropic’s Claude): writing the warm-up quiz from what the family entered, working out what a session covered from the tutor’s summary, writing the later quizzes, grading answers, and answering tutors’ questions about their own dashboard.</li>
          <li><strong>Brevo:</strong> sending email (quiz links, booking and results notices, sign-in links).</li>
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
          <li>Accounts, sessions, quiz results and payment records: while your account is open, and afterwards as long as needed for accounting and legal obligations: <strong>[retention period]</strong>.</li>
        </ul>
      </section>

      <section>
        <h2>Children</h2>
        <p>
          Students under 18 use Gained with a parent, who books and pays for sessions.{' '}
          <strong>[Policy for children under 13, and how parental consent is verified under COPPA, to be decided with counsel.]</strong>
        </p>
      </section>

      <section>
        <h2>Your choices</h2>
        <ul>
          <li>You can see your sessions, results and how every answer was graded in the app, and appeal a grade within 72 hours.</li>
          <li>Delete your account any time from your Account page; it removes your account and the sessions, quizzes and results you’re part of. A parent deletes a child’s account from theirs. To get a copy of your data, email <a href="mailto:adeyori.adekunle@bulldogs.aamu.edu" className="underline underline-offset-4 hover:text-ink">adeyori.adekunle@bulldogs.aamu.edu</a>.</li>
        </ul>
      </section>
    </LegalPage>
  );
}
