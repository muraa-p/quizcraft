'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getDemoQuiz, type DemoQuiz } from '@/lib/demo-store';
import { QuizTaker } from '@/components/quiz-taker';
import { ArrowLeft, FlaskConical } from 'lucide-react';

export default function LocalDemoTakePage() {
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

  const { questions, ...quiz } = demo;
  return (
    <div className="container-page py-8 sm:py-12 max-w-3xl">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Link href={`/demo/local/${demo.id}/edit`} className="inline-flex items-center gap-1 text-sm muted hover:text-[var(--ink)]"><ArrowLeft size={14} /> Back to editor</Link>
        <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide uppercase px-2.5 py-1.5 rounded-md border border-[var(--line)] bg-[rgba(15,118,110,0.06)] text-[var(--accent)]">
          <FlaskConical size={14} /> Local demo — responses not saved
        </div>
      </div>
      <QuizTaker quiz={quiz} questions={questions || []} persistResponse={false} />
    </div>
  );
}
