// PRD screen 5: the baseline, post-session and retention quizzes. Opened from a link on the
// student's phone, so it needs no sign-in (the link carries a signed token).

import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, Logo } from '@/components/ui';
import { loadQuiz, publicQuestions, quizWindow } from '@/lib/quiz-access';
import { QuizRunner } from './quiz-runner';

export const metadata: Metadata = { title: 'Quiz', robots: { index: false } };

const KIND_TITLE = { baseline: 'Warm-up check', post: 'What did you learn?', retention: '48-hour check-in' } as const;
const KIND_INTRO = {
  baseline: 'A quick check before your session, so we can measure how much you learn. It’s fine not to know these yet.',
  post: 'A few new problems on what you just covered.',
  retention: 'The same skills, two days later. This checks what stuck.',
} as const;

export default async function QuizPage({ params, searchParams }: PageProps<'/quiz/[id]'>) {
  const { id } = await params;
  const { t } = await searchParams;
  const token = typeof t === 'string' ? t : undefined;
  const quiz = await loadQuiz(id, token);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="mx-auto flex h-14 w-full max-w-xl items-center px-4">
        <Logo className="text-xl" />
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-10">
        {!quiz ? (
          <Message title="This link doesn’t work">Ask your tutor or parent for a fresh quiz link.</Message>
        ) : (
          (() => {
            const state = quizWindow(quiz);
            if (state === 'done') return <Message title="All done">Thanks! Your results will show up on the session page soon.</Message>;
            if (state === 'not-sent') return <Message title="Not open yet">This quiz opens 48 hours after your session.</Message>;
            if (state === 'closed') return <Message title="This quiz has closed">No problem: it won’t count against you.</Message>;
            return (
              <QuizRunner
                quizId={quiz.id}
                sessionId={quiz.session_id}
                token={token}
                kind={quiz.kind}
                title={KIND_TITLE[quiz.kind]}
                intro={KIND_INTRO[quiz.kind]}
                subject={quiz.session.subject}
                tutorName={quiz.session.tutor.name}
                questions={publicQuestions(quiz)}
                answered={Object.keys((quiz.responses_json ?? {}) as Record<string, string>).length}
              />
            );
          })()
        )}
      </main>
    </div>
  );
}

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mt-10 text-center">
      <h1 className="font-display text-3xl">{title}</h1>
      <p className="mt-2 text-ink-soft">{children}</p>
      <Link href="/home" className="mt-4 inline-block text-sm text-muted underline underline-offset-4">
        Go to Gained
      </Link>
    </Card>
  );
}
