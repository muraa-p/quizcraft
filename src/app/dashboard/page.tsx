import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BarChart3, ExternalLink, FilePenLine, Plus } from 'lucide-react';
import { DeleteQuizButton } from '@/components/delete-quiz-button';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return (
      <div className="container-page py-12 max-w-3xl">
        <p className="kicker mb-2">Dashboard</p>
        <h1 className="text-4xl font-semibold mb-3">Supabase not connected yet</h1>
        <p className="muted mb-8 max-w-2xl">You can still test the full quiz-building and taking experience without a backend using local demo mode. Connect Supabase when you&apos;re ready to publish and collect responses.</p>
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <div className="panel rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">Try it now (no setup)</h2>
            <p className="muted text-sm mb-4">Take sample quizzes or build and edit your own quiz in the browser (saved to local storage). No sign-in required.</p>
            <div className="flex flex-wrap gap-2">
              <Link href="/demo/local" className="btn btn-primary">Open local builder</Link>
              <Link href="/templates" className="btn btn-secondary">Try templates</Link>
            </div>
          </div>
          <div className="panel rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">Connect Supabase (full app)</h2>
            <p className="muted text-sm leading-relaxed">1) Create a free Supabase project. 2) Run <code>supabase/schema.sql</code> in the SQL editor. 3) Copy <code>.env.example</code> to <code>.env.local</code> (or fill <code>.env.local</code>/<code>.env</code>) and set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>. 4) Restart the dev server.</p>
          </div>
        </div>
      </div>
    );
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/dashboard');

  const { data: quizzes, error } = await supabase
    .from('quizzes')
    .select('id,title,description,slug,status,updated_at,created_at')
    .eq('owner_id', user.id)
    .order('updated_at', { ascending: false });

  const ids = (quizzes || []).map((q) => q.id);
  const counts: Record<string, number> = {};
  if (ids.length) {
    const { data: resp } = await supabase.from('responses').select('quiz_id').in('quiz_id', ids);
    for (const r of resp || []) counts[r.quiz_id] = (counts[r.quiz_id] || 0) + 1;
  }

  return (
    <div className="container-page py-10 sm:py-14">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <p className="kicker mb-2">Dashboard</p>
          <h1 className="text-4xl sm:text-5xl font-semibold">Your quizzes</h1>
          <p className="muted mt-2">Create, edit, publish, and review responses.</p>
        </div>
        <Link href="/dashboard/new" className="btn btn-primary"><Plus size={16} /> New quiz</Link>
      </div>

      {error && <p className="mb-4 text-sm text-[var(--bad)]">{error.message}</p>}

      {!quizzes?.length ? (
        <div className="panel rounded-lg p-8 sm:p-10 text-center max-w-2xl">
          <h2 className="text-2xl font-semibold mb-2">No quizzes yet</h2>
          <p className="muted mb-6">Start from scratch or use a template as inspiration.</p>
          <div className="flex justify-center gap-3 flex-wrap">
            <Link href="/dashboard/new" className="btn btn-primary">Create a quiz</Link>
            <Link href="/templates" className="btn btn-secondary">View templates</Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {quizzes.map((q) => (
            <article key={q.id} className="panel rounded-lg p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h2 className="font-display text-2xl font-semibold truncate">{q.title}</h2>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${q.status === 'published' ? 'bg-[rgba(15,118,110,0.12)] text-[var(--accent)]' : 'bg-[rgba(24,33,43,0.08)] text-[var(--ink-soft)]'}`}>{q.status}</span>
                </div>
                {q.description ? <p className="muted text-sm line-clamp-2">{q.description}</p> : <p className="muted text-sm">No description</p>}
                <p className="text-xs muted mt-2">Updated {new Date(q.updated_at).toLocaleString()} · {counts[q.id] || 0} responses</p>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <Link href={`/dashboard/quizzes/${q.id}/edit`} className="btn btn-secondary !py-2"><FilePenLine size={15} /> Edit</Link>
                <Link href={`/dashboard/quizzes/${q.id}/responses`} className="btn btn-ghost !py-2"><BarChart3 size={15} /> Responses</Link>
                {q.status === 'published' && (
                  <Link href={`/q/${q.slug}`} className="btn btn-ghost !py-2" target="_blank"><ExternalLink size={15} /> Open</Link>
                )}
                <DeleteQuizButton id={q.id} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
