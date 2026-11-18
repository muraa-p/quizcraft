'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createDemoQuiz, deleteDemoQuiz, listDemoQuizzes, saveDemoQuiz, type DemoQuiz } from '@/lib/demo-store';
import { sampleQuizzes } from '@/lib/sample-quizzes';
import { sampleToQuiz } from '@/lib/demo';
import { uid } from '@/lib/utils';
import { FilePenLine, FlaskConical, Play, Plus, Trash2 } from 'lucide-react';

function LocalDemoInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [quizzes, setQuizzes] = useState<DemoQuiz[]>([]);
  const [title, setTitle] = useState('');
  const [ready, setReady] = useState(false);
  const handledTemplate = useRef(false);

  useEffect(() => {
    setQuizzes(listDemoQuizzes());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || handledTemplate.current) return;
    const tpl = searchParams.get('template');
    if (!tpl) return;
    const sample = sampleQuizzes.find((s) => s.slug === tpl);
    if (!sample) return;
    handledTemplate.current = true;
    const { quiz, questions } = sampleToQuiz(sample);
    const now = new Date().toISOString();
    const localId = uid('local');
    const local: DemoQuiz = {
      ...quiz,
      id: localId,
      owner_id: 'local',
      slug: `${quiz.slug}-${Math.random().toString(36).slice(2, 6)}`,
      status: 'draft',
      created_at: now,
      updated_at: now,
      questions: questions.map((q) => ({ ...q, id: uid('q'), quiz_id: localId })),
    };
    saveDemoQuiz(local);
    router.replace(`/demo/local/${local.id}/edit`);
  }, [ready, router, searchParams]);

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const q = createDemoQuiz(title || 'Untitled quiz', '');
    setTitle('');
    router.push(`/demo/local/${q.id}/edit`);
  }

  function onDelete(id: string) {
    if (!confirm('Delete this local demo quiz?')) return;
    deleteDemoQuiz(id);
    setQuizzes(listDemoQuizzes());
  }

  return (
    <div className="container-page py-10 sm:py-14">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <p className="kicker mb-2 inline-flex items-center gap-2"><FlaskConical size={14}/> Local demo</p>
          <h1 className="text-4xl sm:text-5xl font-semibold">Test the quiz builder</h1>
          <p className="muted mt-2 max-w-2xl">Create and edit quizzes in your browser (saved to local storage). No Supabase connection required. Responses are not collected — this is for testing the editor and quiz-taking experience.</p>
          {searchParams.get('template') && <p className="mt-2 text-sm text-[var(--accent)]">Preparing a copy from template…</p>}
        </div>
      </div>

      <div className="grid lg:grid-cols-[360px_1fr] gap-6 items-start">
        <form onSubmit={onCreate} className="panel rounded-lg p-5 space-y-3">
          <h2 className="text-xl font-semibold">New local quiz</h2>
          <div>
            <label className="label" htmlFor="ltitle">Title</label>
            <input id="ltitle" className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Safety refresher" />
          </div>
          <button className="btn btn-primary w-full" type="submit"><Plus size={15}/> Create & edit</button>
          <p className="text-xs muted">Stored only in this browser. Connect Supabase later for real accounts, publishing, and saved responses. You can also start from a <Link href="/templates" className="text-[var(--accent)] underline">template</Link>.</p>
        </form>

        <div className="space-y-3">
          {!ready ? (
            <div className="panel rounded-lg p-6 muted">Loading…</div>
          ) : quizzes.length === 0 ? (
            <div className="panel rounded-lg p-8 text-center">
              <h2 className="text-xl font-semibold mb-2">No local quizzes yet</h2>
              <p className="muted">Create one to test the editor, or try a sample template.</p>
              <div className="mt-4"><Link href="/templates" className="btn btn-secondary">Browse templates</Link></div>
            </div>
          ) : (
            quizzes.map((q) => (
              <article key={q.id} className="panel rounded-lg p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="font-display text-2xl font-semibold truncate">{q.title || 'Untitled quiz'}</h2>
                  <p className="text-sm muted mt-1">{q.questions?.length || 0} questions · Updated {q.updated_at ? new Date(q.updated_at).toLocaleString() : '—'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/demo/local/${q.id}/edit`} className="btn btn-secondary !py-2"><FilePenLine size={15}/> Edit</Link>
                  <Link href={`/demo/local/${q.id}/take`} className="btn btn-ghost !py-2"><Play size={15}/> Take</Link>
                  <button onClick={() => onDelete(q.id)} className="btn btn-ghost !py-2 text-[var(--signal)] hover:bg-red-50" type="button"><Trash2 size={15}/> Delete</button>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function LocalDemoPage() {
  return (
    <Suspense fallback={<div className="container-page py-10 muted">Loading…</div>}>
      <LocalDemoInner />
    </Suspense>
  );
}
