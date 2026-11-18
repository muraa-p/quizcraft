import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { scoreQuestion } from '@/lib/scoring';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import type { AnswerValue, MatchPair, Option, Question } from '@/types/quiz';

export const dynamic = 'force-dynamic';

type ResponseRow = {
  id: string;
  quiz_id: string;
  respondent_name: string | null;
  respondent_email: string | null;
  answers: Record<string, unknown> | null;
  score: number | string;
  total: number | string;
  percent: number | string | null;
  passed: boolean | null;
  grade_label: string | null;
  duration_seconds: number | null;
  created_at: string;
};

type DbQuestion = {
  id: string;
  quiz_id: string;
  type: Question['type'];
  prompt: string;
  description?: string | null;
  image_url?: string | null;
  required?: boolean | null;
  options?: unknown;
  correct?: unknown;
  match_pairs?: unknown;
  match_correct?: unknown;
  points?: number | string | null;
  explanation?: string | null;
  position?: number | null;
};

function mapQuestion(row: DbQuestion, i: number): Question {
  const opts = Array.isArray(row.options)
    ? (row.options as Array<Option & { image_url?: string }>).map((o) => ({ id: String(o.id), text: String(o.text ?? ''), imageUrl: o.imageUrl || o.image_url || '' }))
    : [];
  const pairs = Array.isArray(row.match_pairs) ? (row.match_pairs as MatchPair[]) : [];
  const correct = Array.isArray(row.correct) ? row.correct.map((c) => String(c)) : [];
  const matchCorrect = row.match_correct && typeof row.match_correct === 'object' && !Array.isArray(row.match_correct)
    ? (row.match_correct as Record<string, string>)
    : {};
  return {
    id: String(row.id),
    quiz_id: String(row.quiz_id),
    type: row.type,
    prompt: row.prompt || '',
    description: row.description || '',
    imageUrl: row.image_url || '',
    required: row.required !== false,
    options: opts,
    correct,
    matchPairs: pairs,
    matchCorrect,
    points: Number.isFinite(Number(row.points)) ? Number(row.points) : 0,
    explanation: row.explanation || '',
    position: Number.isFinite(Number(row.position)) ? Number(row.position) : i,
  };
}

function formatAnswer(q: Question, answer: unknown): string {
  if (q.type === 'section') return '—';
  if (answer == null) return '—';
  if (q.type === 'short_text' || q.type === 'long_text' || q.type === 'number') {
    const s = String(answer).trim();
    return s || '—';
  }
  if (q.type === 'ranking') {
    const ids = Array.isArray(answer) ? answer.map(String) : (q.options || []).map((o) => o.id);
    if (!ids.length) return '—';
    const map = new Map((q.options || []).map((o) => [o.id, o.text]));
    return ids.map((id, i) => `${i + 1}. ${map.get(id) || id}`).join(' · ');
  }
  if (q.type === 'matching') {
    const given = answer && typeof answer === 'object' && !Array.isArray(answer) ? (answer as Record<string, string>) : {};
    const pairs = q.matchPairs || [];
    if (!pairs.length) return '—';
    const rightMap = new Map(pairs.map((p) => [p.id, p.right]));
    return pairs.map((p) => `${p.left} → ${rightMap.get(String(given[p.id] || '')) || '—'}`).join(' · ');
  }
  const ids = Array.isArray(answer) ? answer.map(String) : [String(answer)];
  const clean = ids.map((v) => v.trim()).filter(Boolean);
  if (!clean.length) return '—';
  const map = new Map((q.options || []).map((o) => [o.id, o.text]));
  return clean.map((id) => map.get(id) || id).join(', ');
}

function formatCorrect(q: Question): string {
  if (q.type === 'short_text' || q.type === 'number') return (q.correct || []).filter(Boolean).join(' / ') || '—';
  if (q.type === 'long_text') {
    const keys = (q.correct || []).filter(Boolean);
    return keys.length ? `Must include: ${keys.join(' / ')}` : 'Not auto-graded';
  }
  if (q.type === 'ranking') {
    const map = new Map((q.options || []).map((o) => [o.id, o.text]));
    return (q.correct || []).map((id, i) => `${i + 1}. ${map.get(id) || id}`).join(' · ') || '—';
  }
  if (q.type === 'matching') {
    return (q.matchPairs || []).map((p) => `${p.left} → ${p.right}`).join(' · ') || '—';
  }
  const map = new Map((q.options || []).map((o) => [o.id, o.text]));
  return (q.correct || []).map((id) => map.get(id) || id).join(', ') || '—';
}

export default async function ResponsesPage({ params }: { params: { id: string } }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) redirect('/dashboard');
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/dashboard/quizzes/${params.id}/responses`);

  const { data: quiz } = await supabase.from('quizzes').select('id,title,slug,status').eq('id', params.id).eq('owner_id', user.id).single();
  if (!quiz) notFound();
  const [{ data: responses }, { data: questionRows }] = await Promise.all([
    supabase.from('responses').select('*').eq('quiz_id', params.id).order('created_at', { ascending: false }).limit(500),
    supabase.from('questions').select('*').eq('quiz_id', params.id).order('position', { ascending: true }),
  ]);

  const rows = (responses || []) as ResponseRow[];
  const questions = (questionRows || []).map((q, i) => mapQuestion(q as DbQuestion, i));
  const avg = rows.length ? Math.round(rows.reduce((a, r) => a + (Number(r.percent ?? (Number(r.total) ? (Number(r.score) / Number(r.total)) * 100 : 0))), 0) / rows.length) : 0;
  const graded = rows.filter((r) => r.passed !== null && r.passed !== undefined);
  const passRate = graded.length ? Math.round((graded.filter((r) => r.passed).length / graded.length) * 100) : 0;
  const avgDuration = rows.length ? Math.round(rows.reduce((a, r) => a + Number(r.duration_seconds || 0), 0) / rows.length) : 0;

  return (
    <div className="container-page py-10 sm:py-14">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm muted hover:text-[var(--ink)] mb-4"><ArrowLeft size={14}/> Back to dashboard</Link>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <p className="kicker mb-2">Responses & analytics</p>
          <h1 className="text-4xl font-semibold">{quiz.title}</h1>
          <p className="muted mt-1">/q/{quiz.slug} · {rows.length} response{rows.length === 1 ? '' : 's'}</p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <div className="panel rounded-md px-4 py-3"><div className="muted text-xs">Avg score</div><div className="font-display text-2xl font-semibold">{avg}%</div></div>
          <div className="panel rounded-md px-4 py-3"><div className="muted text-xs">Pass rate</div><div className="font-display text-2xl font-semibold">{graded.length ? `${passRate}%` : '—'}</div></div>
          <div className="panel rounded-md px-4 py-3"><div className="muted text-xs">Avg time</div><div className="font-display text-2xl font-semibold">{avgDuration ? `${Math.round(avgDuration/60)}m` : '—'}</div></div>
        </div>
      </div>

      {!rows.length ? (
        <div className="panel rounded-lg p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">No responses yet</h2>
          <p className="muted">Publish your quiz and share its link to start collecting responses.</p>
          {quiz.status === 'published' && <p className="mt-3"><Link className="text-[var(--accent)] font-semibold hover:underline" href={`/q/${quiz.slug}`}>Open public quiz</Link></p>}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm muted">Click a response to view the answers provided.</p>
          {rows.map((r) => {
            const pct = Number(r.percent ?? (Number(r.total) ? Math.round((Number(r.score) / Number(r.total)) * 100) : 0));
            const answers = (r.answers && typeof r.answers === 'object') ? (r.answers as Record<string, unknown>) : {};
            let qn = 0;
            return (
              <details key={r.id} className="panel rounded-lg overflow-hidden group">
                <summary className="list-none cursor-pointer px-4 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 hover:bg-[rgba(24,33,43,0.02)]">
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-1 flex-1">
                    <div>
                      <div className="font-semibold">{r.respondent_name || <span className="muted font-normal">Anonymous</span>}</div>
                      <div className="text-xs muted">{new Date(r.created_at).toLocaleString()}</div>
                    </div>
                    <div className="text-sm">
                      {r.respondent_email ? <div>{r.respondent_email}</div> : <div className="muted">No email</div>}
                    </div>
                    <div className="text-sm">
                      <div><strong>{Number(r.score)}</strong> / {Number(r.total)} · <strong>{pct}%</strong></div>
                      <div className="muted text-xs">{r.grade_label || 'No grade label'}</div>
                    </div>
                    <div className="text-sm">
                      {r.passed == null ? <span className="muted">—</span> : r.passed ? <span className="text-[var(--ok)] font-semibold">Passed</span> : <span className="text-[var(--signal)] font-semibold">Not passed</span>}
                      <div className="muted text-xs">{r.duration_seconds ? `${Math.floor(Number(r.duration_seconds)/60)}m ${Number(r.duration_seconds)%60}s` : 'Duration —'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[var(--accent)] font-semibold flex-none"><span className="group-open:hidden">View answers</span><span className="hidden group-open:inline">Hide answers</span><ChevronDown size={16} className="transition-transform group-open:rotate-180" /></div>
                </summary>
                <div className="border-t border-[var(--line)] px-4 py-4 bg-white/30 space-y-3">
                  {questions.length === 0 && <p className="text-sm muted">No question data available for this quiz.</p>}
                  {questions.map((q) => {
                    if (q.type === 'section') {
                      return (
                        <div key={q.id} className="rounded-md border border-[rgba(15,118,110,0.2)] bg-[rgba(15,118,110,0.04)] px-4 py-3">
                          <p className="kicker mb-1">Section</p>
                          <p className="font-semibold">{q.prompt}</p>
                          {q.description && <p className="text-sm muted mt-1">{q.description}</p>}
                        </div>
                      );
                    }
                    qn += 1;
                    const ans = answers[q.id] as AnswerValue;
                    const res = scoreQuestion(q, ans);
                    return (
                      <div key={q.id} className="rounded-md border border-[var(--line)] bg-white/60 px-4 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                          <p className="font-semibold"><span className="muted mr-2">{qn}.</span>{q.prompt}</p>
                          {res.ok === true ? <span className="text-xs font-semibold px-2 py-1 rounded bg-[var(--ok-bg)] text-[var(--ok)]">Correct · {res.earned}/{res.possible}</span>
                            : res.ok === false ? <span className="text-xs font-semibold px-2 py-1 rounded bg-[var(--bad-bg)] text-[var(--bad)]">Incorrect · {res.earned}/{res.possible}</span>
                            : <span className="text-xs font-semibold px-2 py-1 rounded bg-[rgba(24,33,43,0.08)] text-[var(--ink-soft)]">Recorded · {res.earned}/{res.possible}</span>}
                        </div>
                        <div className="text-sm space-y-1">
                          <p><span className="muted">Provided:</span> <strong className="whitespace-pre-wrap break-words">{formatAnswer(q, ans)}</strong></p>
                          {(q.type !== 'long_text' || (q.correct || []).filter(Boolean).length > 0) && (
                            <p><span className="muted">Correct/expected:</span> <span className="whitespace-pre-wrap break-words">{formatCorrect(q)}</span></p>
                          )}
                          {res.feedback && <p className="muted">{res.feedback}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
