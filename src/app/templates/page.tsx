import Link from 'next/link';
import { sampleQuizzes } from '@/lib/sample-quizzes';
import { ArrowRight, Copy, FlaskConical, ListChecks, Play, Plus } from 'lucide-react';

export const metadata = { title: 'Templates — QuizCraft' };

export default function TemplatesPage() {
  return (
    <div className="container-page py-12 sm:py-16">
      <div className="max-w-2xl mb-10">
        <p className="kicker mb-3">Templates</p>
        <h1 className="text-4xl sm:text-5xl font-semibold mb-4">Start from a working quiz.</h1>
        <p className="muted text-lg leading-relaxed">Use a template as a starting point for your own quiz (copy it to the local builder, or into your Supabase dashboard), or try it instantly in demo mode.</p>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sampleQuizzes.map((q) => (
          <article key={q.slug} className="panel rounded-lg p-6 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold tracking-wide uppercase text-[var(--accent)]">{q.category}</span>
              <span className="text-xs muted inline-flex items-center gap-1"><ListChecks size={14} /> {q.questions.length} items</span>
            </div>
            <h2 className="font-display text-2xl font-semibold leading-tight mb-2">{q.title}</h2>
            <p className="muted text-sm leading-relaxed flex-1">{q.description}</p>
            <ul className="mt-4 mb-5 space-y-1.5 text-sm">
              {q.questions.slice(0, 3).map((ques, i) => (
                <li key={i} className="truncate muted"><span className="text-[var(--ink)]">•</span> {ques.prompt}</li>
              ))}
              {q.questions.length > 3 && <li className="muted">+ {q.questions.length - 3} more</li>}
            </ul>
            <div className="flex flex-wrap gap-2 mt-auto">
              <Link href={`/demo/${q.slug}`} className="btn btn-ghost !py-2 !px-3 text-sm"><Play size={14} /> Try</Link>
              <Link href={`/demo/local?template=${q.slug}`} className="btn btn-secondary !py-2 !px-3 text-sm flex-1"><Copy size={14} /> Copy to builder</Link>
              <Link href={`/dashboard/new?template=${q.slug}`} className="btn btn-primary !py-2 !px-3 text-sm"><Plus size={14} /> Use in dashboard</Link>
            </div>
          </article>
        ))}
      </div>
      <div className="mt-12 grid sm:grid-cols-2 gap-4">
        <div className="panel rounded-lg p-6 sm:p-8 flex flex-col items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold mb-1 inline-flex items-center gap-2"><FlaskConical size={20} className="text-[var(--accent)]"/> Local quiz builder</h2>
            <p className="muted">Create and edit your own quiz in the browser (saved to local storage) — no Supabase needed. Great for testing the editor and taking experience.</p>
          </div>
          <Link href="/demo/local" className="btn btn-secondary whitespace-nowrap">Open local builder</Link>
        </div>
        <div className="panel rounded-lg p-6 sm:p-8 flex flex-col items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold mb-1">Publish and share</h2>
            <p className="muted">Connect Supabase to create accounts, publish shareable quizzes at <code>/q/your-slug</code>, and collect responses. To let classmates access a quiz, deploy the app and set <code>NEXT_PUBLIC_SITE_URL</code> to your public URL.</p>
          </div>
          <Link href="/dashboard/new" className="btn btn-secondary whitespace-nowrap">Create in dashboard <ArrowRight size={15} /></Link>
        </div>
      </div>
    </div>
  );
}
