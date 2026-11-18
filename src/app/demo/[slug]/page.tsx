import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sampleQuizzes } from '@/lib/sample-quizzes';
import { sampleToQuiz } from '@/lib/demo';
import { QuizTaker } from '@/components/quiz-taker';
import { ArrowLeft, FlaskConical } from 'lucide-react';

export function generateStaticParams() {
  return sampleQuizzes.map((q) => ({ slug: q.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const sample = sampleQuizzes.find((q) => q.slug === params.slug);
  if (!sample) return { title: 'Demo — QuizCraft' };
  return { title: `Try: ${sample.title} — QuizCraft`, description: sample.description };
}

export default function DemoQuizPage({ params }: { params: { slug: string } }) {
  const sample = sampleQuizzes.find((q) => q.slug === params.slug);
  if (!sample) notFound();
  const { quiz, questions } = sampleToQuiz(sample);

  return (
    <div className="container-page py-8 sm:py-12 max-w-3xl">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Link href="/templates" className="inline-flex items-center gap-1 text-sm muted hover:text-[var(--ink)]"><ArrowLeft size={14} /> Back to templates</Link>
        <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide uppercase px-2.5 py-1.5 rounded-md border border-[var(--line)] bg-[rgba(15,118,110,0.06)] text-[var(--accent)]">
          <FlaskConical size={14} /> Demo mode — responses not saved
        </div>
      </div>
      <QuizTaker quiz={quiz} questions={questions} persistResponse={false} />
    </div>
  );
}
