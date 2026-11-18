'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getDemoQuiz, saveDemoQuiz, type DemoQuiz } from '@/lib/demo-store';
import { QuizEditor } from '@/components/quiz-editor';
import type { Question, Quiz } from '@/types/quiz';
import { FlaskConical } from 'lucide-react';

export default function LocalDemoEditPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id as string;
  const [loaded, setLoaded] = useState(false);
  const [demo, setDemo] = useState<DemoQuiz | null>(null);

  useEffect(() => {
    setDemo(getDemoQuiz(id));
    setLoaded(true);
  }, [id]);

  if (!loaded) return <div className="container-page py-10 muted">Loading…</div>;
  if (!demo) {
    return (
      <div className="container-page py-12 max-w-xl">
        <h1 className="text-3xl font-semibold mb-2">Local quiz not found</h1>
        <p className="muted mb-4">It may have been deleted or is stored in a different browser.</p>
        <Link href="/demo/local" className="btn btn-primary">Back to local demos</Link>
      </div>
    );
  }

  const { questions, ...quizRest } = demo;
  return (
    <div className="container-page py-8 sm:py-10">
      <div className="mb-4 inline-flex items-center gap-2 text-xs font-semibold tracking-wide uppercase px-2.5 py-1.5 rounded-md border border-[var(--line)] bg-[rgba(15,118,110,0.06)] text-[var(--accent)]">
        <FlaskConical size={14} /> Local demo — saved in this browser only
      </div>
      <QuizEditor
        quiz={quizRest as Quiz}
        initialQuestions={(questions || []) as Question[]}
        storage="local"
        backHref="/demo/local"
        takeHref={`/demo/local/${demo.id}/take`}
        onLocalSave={(quiz, qs) => {
          const current = getDemoQuiz(id);
          const next: DemoQuiz = { ...(current || demo), ...quiz, questions: qs };
          saveDemoQuiz(next);
          setDemo(next);
        }}
      />
    </div>
  );
}
