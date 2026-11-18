import Link from 'next/link';
import { ArrowRight, BarChart3, CheckCircle2, LayoutDashboard, Palette, Plus, Share2, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const features = [
  {
    icon: CheckCircle2,
    title: 'Questions that fit the job',
    text: 'Multiple choice, multi-select, true/false, short/long answer, number, ranking, matching, sections, and more — with scoring, feedback, and flexible answer checking.',
  },
  {
    icon: Palette,
    title: 'Your look, not a template',
    text: 'Set accent and paper colors, choose how answers are revealed, add a pass mark, schedule access, and control the quiz experience.',
  },
  {
    icon: Share2,
    title: 'One link to share',
    text: 'Publish a quiz and share its public link. Anyone with the link can take it without creating an account (when deployed and published).',
  },
  {
    icon: BarChart3,
    title: 'Results you can read',
    text: 'Takers see their score and feedback instantly. You get responses, scores, and timestamps in your dashboard.',
  },
];

const steps = [
  { n: '01', title: 'Write or import questions', text: 'Build manually, start from a template, or import from an Excel/CSV file.' },
  { n: '02', title: 'Tune settings', text: 'Pick scoring, answer reveal, access controls, shuffle, and theme.' },
  { n: '03', title: 'Publish and share', text: 'Publish and share the public link so respondents can take it from anywhere.' },
];

export default async function Home() {
  const hasEnv = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  let isAuthed = false;
  if (hasEnv) {
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      isAuthed = Boolean(data.user);
    } catch {
      isAuthed = false;
    }
  }

  return (
    <div>
      <section className="container-page pt-14 pb-16 sm:pt-20 sm:pb-24 grid lg:grid-cols-[1.15fr_.85fr] gap-10 items-end">
        <div>
          <p className="kicker mb-4">Open-source quiz maker</p>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-semibold leading-[0.95] max-w-3xl">
            Build quizzes people actually finish.
          </h1>
          <p className="mt-6 text-lg sm:text-xl leading-relaxed max-w-2xl muted">
            QuizCraft is a free, open-source alternative for making scored quizzes, practice tests, and knowledge checks.
            No payments, no ads, no AI upsells — just questions, a share link, and clear results.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {isAuthed ? (
              <>
                <Link href="/dashboard" className="btn btn-primary text-base px-5 py-3">
                  Open dashboard <LayoutDashboard size={16} />
                </Link>
                <Link href="/dashboard/new" className="btn btn-secondary text-base px-5 py-3">
                  Create new quiz <Plus size={16} />
                </Link>
              </>
            ) : (
              <>
                <Link href="/templates" className="btn btn-primary text-base px-5 py-3">
                  Browse templates <ArrowRight size={16} />
                </Link>
                <Link href="/demo/local" className="btn btn-secondary text-base px-5 py-3">Try the builder</Link>
              </>
            )}
          </div>
          <p className="mt-4 text-sm muted">
            {isAuthed
              ? "You're signed in. Build and publish quizzes from your dashboard, then share the public /q/your-slug link with respondents (use your deployed site URL so others can access it)."
              : 'No sign-in needed to try demos. Create an account to build, publish, and collect responses with your own Supabase project.'}
          </p>
        </div>
        <div className="panel rounded-lg p-5 sm:p-6 lg:translate-y-4">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-3 mb-4">
            <span className="text-sm font-semibold">Workplace Safety Refresher</span>
            <span className="text-xs px-2 py-1 rounded bg-[rgba(15,118,110,0.12)] text-[var(--accent)] font-semibold">5 questions</span>
          </div>
          <p className="text-sm muted mb-3">Question 2 of 5</p>
          <p className="font-display text-2xl leading-snug mb-4">You notice a small spill in a hallway. What should you do first?</p>
          <div className="space-y-2.5">
            {[
              'Ignore it if it looks small',
              'Warn others and secure the area',
              'Wait for someone else to report it',
              'Cover it with paper',
            ].map((opt, i) => (
              <div key={opt} className={`rounded-md border px-3 py-2.5 text-sm ${i === 1 ? 'border-[var(--accent)] bg-[rgba(15,118,110,0.08)]' : 'border-[var(--line)] bg-white/50'}`}>
                <span className="font-semibold mr-2 text-[var(--ink-soft)]">{String.fromCharCode(65 + i)}.</span>{opt}
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-md border border-[var(--line)] bg-[var(--ok-bg)] px-3 py-2 text-sm text-[var(--ok)]">
            <strong>Correct.</strong> Preventing slips comes first: warn people and secure or mark the area.
          </div>
        </div>
      </section>

      <hr className="rule" />

      <section className="container-page py-14 sm:py-18">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((f) => (
            <div key={f.title} className="pt-2">
              <f.icon className="text-[var(--accent)] mb-3" size={22} aria-hidden />
              <h2 className="text-2xl font-semibold leading-tight mb-2">{f.title}</h2>
              <p className="muted leading-relaxed text-[15px]">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[var(--paper-deep)] border-y border-[var(--line)]">
        <div className="container-page py-14 sm:py-18 grid lg:grid-cols-[.9fr_1.1fr] gap-10 items-start">
          <div>
            <p className="kicker mb-3">How it works</p>
            <h2 className="text-4xl sm:text-5xl font-semibold leading-[1.02]">From blank page to shareable quiz in minutes.</h2>
            <p className="muted mt-4 leading-relaxed max-w-md">The core flow is simple on purpose: write, configure, publish. Your data lives in your own Supabase project.</p>
          </div>
          <ol className="space-y-0 border-t border-[var(--line)]">
            {steps.map((s) => (
              <li key={s.n} className="grid grid-cols-[auto_1fr] gap-5 py-6 border-b border-[var(--line)]">
                <span className="font-display text-3xl text-[var(--accent)] leading-none pt-1">{s.n}</span>
                <div>
                  <h3 className="text-2xl font-semibold mb-1">{s.title}</h3>
                  <p className="muted leading-relaxed">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="container-page py-14 sm:py-20 grid lg:grid-cols-2 gap-10 items-center">
        <div className="panel rounded-lg p-6 sm:p-8">
          <p className="kicker mb-3">What’s included</p>
          <ul className="space-y-3 text-[15px]">
            {[
              'Scored quizzes with explanations and per-question feedback',
              'Multiple question types, sections/headings, and flexible short/long answer checking',
              'Pass mark, answer reveal modes, shuffle, timers, access/schedule controls',
              'Excel/CSV import (browser-parsed) with a downloadable template',
              'Starter templates you can copy and customize',
              'Public share links and a responses dashboard (with Supabase)',
              'Self-hostable with Next.js and Supabase (free tiers)',
            ].map((item) => (
              <li key={item} className="flex gap-3"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--accent)] flex-none" /><span>{item}</span></li>
            ))}
          </ul>
        </div>
        <div>
          <p className="kicker mb-3">Good to know</p>
          <h2 className="text-4xl font-semibold leading-tight mb-4">Shareable links work when your app is reachable.</h2>
          <p className="muted leading-relaxed mb-4">Published quizzes are accessible at <code>/q/your-slug</code>. To let classmates or anyone else take a quiz, deploy the app (or host it on a network-accessible URL) and set <code>NEXT_PUBLIC_SITE_URL</code> so share links point to that address.</p>
          <p className="muted leading-relaxed mb-8">This project focuses on core quiz-maker workflows and stays simple to run. Some advanced or proprietary platform features may differ from commercial tools.</p>
          {isAuthed ? (
            <Link href="/dashboard/new" className="btn btn-primary">Create a quiz <Sparkles size={16} /></Link>
          ) : (
            <Link href="/signup" className="btn btn-primary">Get started <Sparkles size={16} /></Link>
          )}
        </div>
      </section>
    </div>
  );
}
