'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { createClient, hasSupabaseEnv } from '@/lib/supabase/client';
import { mergeSettings, mergeTheme } from '@/lib/demo';
import { getGradeLabel, isQuizOpen, scoreQuestion, scoreQuiz } from '@/lib/scoring';
import { formatDuration, shuffle } from '@/lib/utils';
import type { AnswerValue, MatchPair, Option, Question, Quiz } from '@/types/quiz';
import { CheckCircle2, Clock3, Lock, RotateCcw, Send, XCircle } from 'lucide-react';

type Props = { quiz: Quiz; questions: Question[]; persistResponse?: boolean; preview?: boolean };

type RawQuestion = Partial<Question> & {
  image_url?: string;
  match_pairs?: MatchPair[];
  match_correct?: Record<string, string>;
};

function normalizeQuestion(q: RawQuestion, i: number): Question {
  const opts = Array.isArray(q.options)
    ? q.options.map((o) => {
        const opt = o as Option & { imageUrl?: string };
        return { id: String(opt.id), text: String(opt.text ?? ''), imageUrl: opt.imageUrl || '' };
      })
    : [];
  return {
    id: String(q.id || `q_${i}`),
    quiz_id: String(q.quiz_id || ''),
    type: q.type || 'multiple_choice',
    prompt: q.prompt || '',
    description: q.description || '',
    imageUrl: q.imageUrl || q.image_url || '',
    required: q.required !== false,
    options: opts,
    correct: Array.isArray(q.correct) ? q.correct.map((c) => String(c)) : [],
    matchPairs: Array.isArray(q.matchPairs) ? q.matchPairs : Array.isArray(q.match_pairs) ? q.match_pairs : [],
    matchCorrect: q.matchCorrect || q.match_correct || {},
    points: Number.isFinite(Number(q.points)) ? Number(q.points) : 0,
    explanation: q.explanation || '',
    position: Number.isFinite(Number(q.position)) ? Number(q.position) : i,
  };
}

function typeLabel(t: Question['type']) {
  switch (t) {
    case 'multiple_choice': return 'Multiple choice';
    case 'multi_select': return 'Select all that apply';
    case 'true_false': return 'True or False';
    case 'dropdown': return 'Dropdown';
    case 'short_text': return 'Short answer';
    case 'long_text': return 'Long answer';
    case 'number': return 'Number';
    case 'ranking': return 'Ranking';
    case 'matching': return 'Matching';
    case 'section': return 'Section';
    default: return 'Question';
  }
}

function isAnswered(q: Question, a: AnswerValue) {
  if (q.type === 'section') return true;
  if (a == null) return false;
  if (typeof a === 'string') return a.trim().length > 0;
  if (Array.isArray(a)) return a.length > 0;
  if (typeof a === 'number') return !Number.isNaN(a);
  if (typeof a === 'object') return Object.keys(a).length > 0;
  return false;
}

function formatUserAnswer(q: Question, a: AnswerValue) {
  if (q.type === 'ranking') {
    const ids = Array.isArray(a) ? a.map(String) : (q.options || []).map(o => o.id);
    const map = new Map((q.options || []).map(o => [o.id, o.text]));
    return ids.map((id, i) => `${i + 1}. ${map.get(id) || id}`).join(' · ') || '—';
  }
  if (!isAnswered(q, a)) return '—';
  if (q.type === 'short_text' || q.type === 'long_text' || q.type === 'number') return String(a ?? '');
  if (q.type === 'matching') {
    const given = a && typeof a === 'object' && !Array.isArray(a) ? a as Record<string, string> : {};
    const pairs = q.matchPairs || [];
    const rightMap = new Map(pairs.map(p => [p.id, p.right]));
    return pairs.map(p => `${p.left} → ${rightMap.get(given[p.id] || '') || '—'}`).join(' · ');
  }
  const ids = Array.isArray(a) ? a.map(String) : [String(a)];
  const map = new Map((q.options || []).map(o => [o.id, o.text]));
  return ids.map(id => map.get(id) || id).join(', ');
}

function formatCorrectAnswer(q: Question) {
  if (q.type === 'short_text' || q.type === 'number') return (q.correct || []).join(' / ') || '—';
  if (q.type === 'long_text') {
    const keys = (q.correct || []).map(String).filter(Boolean);
    return keys.length ? `Must include keywords: ${keys.join(' / ')}` : 'Not auto-graded';
  }
  if (q.type === 'ranking') {
    const ids = (q.correct || []).map(String);
    const map = new Map((q.options || []).map(o => [o.id, o.text]));
    return ids.map((id, i) => `${i + 1}. ${map.get(id) || id}`).join(' · ') || '—';
  }
  if (q.type === 'matching') {
    const pairs = q.matchPairs || [];
    return pairs.map(p => `${p.left} → ${p.right}`).join(' · ') || '—';
  }
  const ids = (q.correct || []).map(String);
  const map = new Map((q.options || []).map(o => [o.id, o.text]));
  return ids.map(id => map.get(id) || id).join(', ') || '—';
}

export function QuizTaker({ quiz: rawQuiz, questions, persistResponse = true, preview = false }: Props) {
  const quiz = { ...rawQuiz, theme: mergeTheme(rawQuiz.theme), settings: mergeSettings(rawQuiz.settings) };
  const settings = quiz.settings;

  const prepared = useMemo(() => {
    const qs = [...questions].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map(normalizeQuestion);
    const sections = qs.filter((q) => q.type === 'section');
    let items = qs.filter((q) => q.type !== 'section');
    if (settings.shuffleQuestions) items = shuffle(items);
    if (settings.shuffleOptions) {
      items = items.map((q) => {
        if (['multiple_choice', 'multi_select', 'dropdown'].includes(q.type)) return { ...q, options: shuffle(q.options || []) };
        return q;
      });
    }
    // keep section headings in their original relative positions when not shuffling; when shuffling, show sections first
    return settings.shuffleQuestions ? [...sections, ...items] : qs.map((q) => (q.type === 'section' ? q : (items.shift() as Question) || q));
  }, [questions, settings.shuffleQuestions, settings.shuffleOptions]);

  const initialAnswers = useMemo(() => {
    const a: Record<string, AnswerValue> = {};
    for (const q of prepared) {
      if (q.type === 'ranking') a[q.id] = (q.options || []).map((o) => o.id);
      if (q.type === 'matching') a[q.id] = {};
    }
    return a;
  }, [prepared]);

  const [accessGranted, setAccessGranted] = useState(!settings.accessCode || preview);
  const [accessInput, setAccessInput] = useState('');
  const needsIntro = Boolean(
    settings.welcomeMessage ||
    (settings.accessCode && !preview) ||
    (settings.collectName && settings.requireName) ||
    (settings.collectEmail && settings.requireEmail) ||
    settings.timeLimitMinutes
  );
  const [started, setStarted] = useState(!needsIntro);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(initialAnswers);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [startTime] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [timeUp, setTimeUp] = useState(false);
  const finishOnce = useRef(false);

  useEffect(() => {
    setAnswers(initialAnswers);
    setChecked({});
    setStep(0);
    setDone(false);
    setSavedId(null);
    setSubmitError(null);
    setTimeUp(false);
    finishOnce.current = false;
  }, [initialAnswers]);

  const openState = preview ? { open: true as const, reason: '' } : isQuizOpen(settings);
  const allMode = settings.oneQuestionPerPage === false;

  const result = useMemo(() => scoreQuiz(prepared, answers), [prepared, answers]);
  const percent = result.percent ?? (result.total ? Math.round((result.score / result.total) * 100) : 0);
  const passed = percent >= (settings.passMark ?? 70);
  const grade = getGradeLabel(percent, settings.gradeBands);

  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startTime]);

  useEffect(() => {
    if (preview || !started || done || !settings.timeLimitMinutes || settings.timeLimitMinutes <= 0) return;
    const limit = settings.timeLimitMinutes * 60;
    if (elapsed >= limit && !timeUp) {
      setTimeUp(true);
      void finish(answers, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, started, done, settings.timeLimitMinutes, preview]);

  function setAnswer(qid: string, value: AnswerValue) {
    setAnswers((a) => ({ ...a, [qid]: value }));
  }

  function validateBeforeSubmit() {
    const missing = prepared.filter((q) => q.required !== false && !isAnswered(q, answers[q.id]));
    if (settings.collectName && settings.requireName && !name.trim()) return 'Please enter your name.';
    if (settings.collectEmail && settings.requireEmail && !email.trim()) return 'Please enter your email.';
    if (settings.collectEmail && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Please enter a valid email address.';
    if (missing.length) {
      if (settings.oneQuestionPerPage !== false) {
        const idx = prepared.findIndex((q) => q.id === missing[0].id);
        if (idx >= 0) setStep(idx);
      }
      return `Please answer ${missing.length === 1 ? 'the required question' : `${missing.length} required questions`}.`;
    }
    return null;
  }

  async function finish(finalAnswers = answers, forced = false) {
    if (finishOnce.current) return;
    if (!forced) {
      const err = validateBeforeSubmit();
      if (err) { setSubmitError(err); return; }
    }
    finishOnce.current = true;
    setSubmitError(null);
    setDone(true);
    if (preview || !persistResponse || !hasSupabaseEnv()) return;

    setSubmitting(true);
    try {
      const supabase = createClient();
      const res = scoreQuiz(prepared, finalAnswers);
      const pct = res.percent ?? (res.total ? Math.round((res.score / res.total) * 100) : 0);
      const gradeBand = getGradeLabel(pct, settings.gradeBands);
      const payload = {
        quiz_id: quiz.id,
        respondent_name: settings.collectName ? (name.trim() || null) : null,
        respondent_email: settings.collectEmail ? (email.trim() || null) : null,
        answers: finalAnswers,
        score: res.score,
        total: res.total,
        percent: pct,
        passed: settings.mode === 'survey' ? null : pct >= (settings.passMark ?? 70),
        grade_label: gradeBand?.label || null,
        duration_seconds: Math.max(0, Math.floor((Date.now() - startTime) / 1000)),
        meta: { preview: false, time_up: forced && timeUp },
      };
      const { data, error } = await supabase.from('responses').insert(payload).select('id').single();
      if (error) throw error;
      setSavedId(data.id);
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'Could not save your response (you can still see your score).');
    } finally {
      setSubmitting(false);
    }
  }

  const theme = quiz.theme;
  const themeStyle: React.CSSProperties & Record<string, string> = {
    '--accent': theme.accent || '#0f766e',
    '--paper': theme.paper || '#f3ede2',
    '--ink': theme.ink || '#18212b',
  };
  const radiusClass = theme.radius === 'sharp' ? 'rounded-none' : 'rounded-lg';
  const fontClass = theme.font === 'modern' ? '[font-family:var(--font-body),ui-sans-serif,system-ui,sans-serif]' : theme.font === 'classic' ? '[font-family:Georgia,Times,serif]' : '';

  if (!prepared.length) {
    return <div style={themeStyle} className={`panel ${radiusClass} p-8 text-center ${fontClass}`}><h1 className="text-3xl font-semibold mb-2">{quiz.title}</h1><p className="muted">This quiz has no questions yet.</p></div>;
  }

  if (!openState.open) {
    return <div style={themeStyle} className={`panel ${radiusClass} p-8 text-center max-w-xl mx-auto ${fontClass}`}><Lock className="mx-auto mb-3 text-[var(--accent)]" /><h1 className="text-3xl font-semibold mb-2">{quiz.title}</h1><p className="muted">{openState.reason}</p></div>;
  }

  if (!started) {
    return (
      <div style={themeStyle} className={`panel ${radiusClass} p-6 sm:p-8 space-y-5 ${fontClass}`}>
        <div>
          <p className="kicker mb-2">Quiz</p>
          <h1 className="text-4xl font-semibold leading-tight mb-3">{quiz.title}</h1>
          {quiz.description && <p className="muted text-lg leading-relaxed">{quiz.description}</p>}
        </div>
        {settings.welcomeMessage && <div className="rounded-md border border-[var(--line)] bg-white/50 p-4 whitespace-pre-wrap">{settings.welcomeMessage}</div>}
        <div className="grid sm:grid-cols-3 gap-3 text-sm">
          <div className="rounded-md border border-[var(--line)] p-3"><div className="muted text-xs">Questions</div><div className="font-semibold text-lg">{prepared.filter(q=>q.type!=='section').length}</div></div>
          <div className="rounded-md border border-[var(--line)] p-3"><div className="muted text-xs">Total points</div><div className="font-semibold text-lg">{prepared.reduce((a, q) => a + Number(q.points || 0), 0)}</div></div>
          <div className="rounded-md border border-[var(--line)] p-3"><div className="muted text-xs">Time</div><div className="font-semibold text-lg">{settings.timeLimitMinutes ? `${settings.timeLimitMinutes} min` : 'Untimed'}</div></div>
        </div>
        {(settings.collectName || settings.collectEmail) && (
          <div className="grid sm:grid-cols-2 gap-3 max-w-2xl">
            {settings.collectName && <div><label className="label">Your name {settings.requireName ? '' : <span className="muted font-normal">(optional)</span>}</label><input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" /></div>}
            {settings.collectEmail && <div><label className="label">Email {settings.requireEmail ? '' : <span className="muted font-normal">(optional)</span>}</label><input type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></div>}
          </div>
        )}
        {settings.accessCode && !preview && !accessGranted && (
          <div className="max-w-sm">
            <label className="label">Access code required</label>
            <div className="flex gap-2">
              <input className="field" value={accessInput} onChange={(e) => setAccessInput(e.target.value)} placeholder="Enter access code" />
              <button type="button" className="btn btn-primary" onClick={() => setAccessGranted(accessInput.trim() === String(settings.accessCode).trim())}>Unlock</button>
            </div>
            {accessInput && accessInput.trim() !== String(settings.accessCode).trim() && <p className="text-sm text-[var(--signal)] mt-2">Incorrect access code.</p>}
          </div>
        )}
        {submitError && <p className="text-sm text-[var(--signal)]">{submitError}</p>}
        <button type="button" className="btn btn-primary" disabled={!accessGranted} onClick={() => {
          if (settings.collectName && settings.requireName && !name.trim()) { setSubmitError('Please enter your name to continue.'); return; }
          if (settings.collectEmail && settings.requireEmail && !email.trim()) { setSubmitError('Please enter your email to continue.'); return; }
          if (settings.collectEmail && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setSubmitError('Please enter a valid email address.'); return; }
          setSubmitError(null); setStarted(true);
        }}>Start quiz</button>
      </div>
    );
  }

  if (done) {
    const canReview = settings.showAnswers === 'at_end' || settings.showAnswers === 'after_each';
    return (
      <div style={themeStyle} className={`space-y-6 ${fontClass}`}>
        <div className={`panel ${radiusClass} p-6 sm:p-8 space-y-4`}>
          <p className="kicker mb-1">Results</p>
          <h1 className="text-4xl font-semibold">{quiz.title}</h1>
          {(settings.collectName && name) && <p className="muted">For {name}</p>}
          {settings.successMessage && <p className="rounded-md border border-[var(--line)] bg-white/50 p-3 whitespace-pre-wrap">{settings.successMessage}</p>}

          {(settings.showScore ?? true) && settings.mode !== 'survey' && (
            <div className="flex flex-wrap gap-5 items-end">
              <div><div className="text-sm muted">Score</div><div className="font-display text-5xl font-semibold">{result.score} / {result.total}</div></div>
              <div className="pb-1"><div className="text-sm muted">Percent</div><div className="text-2xl font-semibold">{percent}%</div></div>
              <div className="pb-1"><div className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold ${passed ? 'bg-[var(--ok-bg)] text-[var(--ok)]' : 'bg-[var(--bad-bg)] text-[var(--bad)]'}`}>{passed ? <CheckCircle2 size={16} /> : <XCircle size={16} />} {passed ? 'Passed' : 'Not passed'} <span className="font-normal">(pass mark {settings.passMark ?? 70}%)</span></div></div>
            </div>
          )}
          {settings.mode === 'survey' && <p className="text-[var(--ok)] font-semibold">Thanks — your response has been recorded.</p>}
          {grade && settings.mode !== 'survey' && <div className="rounded-md border border-[rgba(15,118,110,0.2)] bg-[rgba(15,118,110,0.06)] p-4"><p className="font-semibold text-lg">{grade.label}</p>{grade.description && <p className="text-sm muted mt-1">{grade.description}</p>}</div>}

          <div className="flex flex-wrap gap-4 text-sm muted">
            <span className="inline-flex items-center gap-1"><Clock3 size={14} /> Time: {formatDuration(elapsed)}</span>
            {timeUp && <span className="text-[var(--signal)] font-semibold">Time limit reached</span>}
            {submitting && <span>Saving your response…</span>}
            {savedId && <span className="text-[var(--ok)]">Response saved.</span>}
            {preview && <span>Preview mode — response not saved.</span>}
          </div>
          {submitError && <p className="text-sm text-[var(--signal)]">{submitError}</p>}

          {settings.certificateEnabled && passed && settings.mode !== 'survey' && (
            <div className="rounded-md border-2 border-[var(--accent)] p-5 bg-white/60 text-center max-w-xl">
              <p className="kicker mb-2">Certificate</p>
              <h2 className="text-2xl font-semibold mb-1">{settings.certificateTitle || 'Certificate of Completion'}</h2>
              <p className="muted mb-2">Awarded to</p>
              <p className="text-xl font-semibold mb-2">{name || 'Participant'}</p>
              <p className="text-sm muted">for completing <strong>{quiz.title}</strong> with a score of {percent}%.</p>
              {settings.certificateIssuer && <p className="text-xs muted mt-3">Issued by {settings.certificateIssuer}</p>}
              <p className="text-xs muted mt-2">Date: {new Date().toLocaleDateString()}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            {settings.allowRetake !== false && <button className="btn btn-secondary" onClick={() => { finishOnce.current = false; setStep(0); setAnswers({}); setChecked({}); setDone(false); setSavedId(null); setSubmitError(null); setTimeUp(false); }}><RotateCcw size={15} /> Take again</button>}
            {settings.redirectUrl && <a className="btn btn-primary" href={settings.redirectUrl} target="_blank" rel="noreferrer"><Send size={15} /> Continue</a>}
          </div>
        </div>

        {settings.showAnswers !== 'never' && canReview && (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Review</h2>
            {prepared.map((q, i) => {
              if (q.type === 'section') {
                return (
                  <div key={q.id} className={`panel ${radiusClass} p-5 bg-[rgba(15,118,110,0.04)]`}>
                    <p className="kicker mb-1">Section</p>
                    <p className="font-semibold text-xl">{q.prompt}</p>
                    {q.description && <p className="muted mt-1 whitespace-pre-wrap">{q.description}</p>}
                  </div>
                );
              }
              const r = result.detail[q.id];
              const ok = r?.ok;
              const displayIndex = prepared.slice(0, i).filter(x => x.type !== 'section').length;
              return (
                <div key={q.id} className={`panel ${radiusClass} p-5`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="font-semibold"><span className="muted mr-2">{displayIndex + 1}.</span>{q.prompt}</p>
                    {ok !== null && ok !== undefined ? <span className={`text-xs font-semibold px-2 py-1 rounded flex-none ${ok ? 'bg-[var(--ok-bg)] text-[var(--ok)]' : 'bg-[var(--bad-bg)] text-[var(--bad)]'}`}>{ok ? 'Correct' : 'Incorrect'}</span> : <span className="text-xs font-semibold px-2 py-1 rounded flex-none bg-[rgba(24,33,43,0.08)] text-[var(--ink-soft)]">Recorded</span>}
                  </div>
                  <div className="text-sm space-y-1 mb-2">
                    <p><span className="muted">Your answer:</span> <strong className="whitespace-pre-wrap">{formatUserAnswer(q, answers[q.id])}</strong></p>
                    {(q.type !== 'long_text' || ((q.correct||[]).filter(Boolean).length>0)) && <p><span className="muted">Correct answer:</span> <strong className="whitespace-pre-wrap">{formatCorrectAnswer(q)}</strong></p>}
                  </div>
                  {q.explanation && <p className="text-sm mt-2 rounded-md bg-[rgba(15,118,110,0.06)] border border-[rgba(15,118,110,0.15)] px-3 py-2"><strong>Explanation:</strong> {q.explanation}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const q = prepared[step];
  const currentChecked = !!checked[q?.id];
  const currentScore = q ? scoreQuestion(q, answers[q.id]) : null;
  const totalPoints = prepared.reduce((a, qq) => a + Number(qq.points || 0), 0);
  const remaining = settings.timeLimitMinutes ? Math.max(0, settings.timeLimitMinutes * 60 - elapsed) : null;
  const answerable = prepared.filter(x => x.type !== 'section');
  const answeredCount = answerable.filter(x => isAnswered(x, answers[x.id])).length;
  const progressPct = allMode ? Math.round((answeredCount / Math.max(1, answerable.length)) * 100) : Math.round(((step + 1) / Math.max(1, prepared.length)) * 100);

  function canAdvanceFor(qs: Question[]) {
    for (const item of qs) {
      if (item.type === 'section') continue;
      if (item.required !== false && !isAnswered(item, answers[item.id])) return false;
    }
    if (step === 0 || allMode) {
      if (settings.collectName && settings.requireName && !name.trim()) return false;
      if (settings.collectEmail && settings.requireEmail && !email.trim()) return false;
    }
    return true;
  }

  return (
    <div style={themeStyle} className={`space-y-5 ${fontClass}`}>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="kicker mb-1">Quiz</p>
          <h1 className="text-3xl sm:text-4xl font-semibold leading-tight">{quiz.title}</h1>
          {quiz.description && <p className="muted mt-2 max-w-2xl">{quiz.description}</p>}
        </div>
        <div className="text-sm muted sm:text-right space-y-1 min-w-[180px]">
          {!allMode && <div>Item {step + 1} of {prepared.length} · {prepared.filter(x=>x.type!=='section').length} questions</div>}
          {allMode && <div>{prepared.filter(x=>x.type!=='section').length} questions · {totalPoints} points</div>}
          {settings.showProgressBar !== false && <div className="h-1.5 w-full sm:w-44 ml-auto bg-[rgba(24,33,43,0.12)] rounded-full overflow-hidden"><div className="h-full bg-[var(--accent)] rounded-full transition-all" style={{ width: `${progressPct}%` }} /></div>}
          {remaining != null && <div className={`inline-flex items-center gap-1 ${remaining < 60 ? 'text-[var(--signal)] font-semibold' : ''}`}><Clock3 size={14} /> {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</div>}
        </div>
      </div>

      {(settings.collectName || settings.collectEmail) && !allMode && step === 0 && (!settings.welcomeMessage) && (
        <div className={`panel ${radiusClass} p-4 grid sm:grid-cols-2 gap-3`}>
          {settings.collectName && <div><label className="label">Your name {settings.requireName ? '' : <span className="muted font-normal">(optional)</span>}</label><input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" /></div>}
          {settings.collectEmail && <div><label className="label">Email {settings.requireEmail ? '' : <span className="muted font-normal">(optional)</span>}</label><input type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></div>}
        </div>
      )}

      {allMode ? (
        <div className="space-y-4">
          {prepared.map((qq, i) => {
            const displayIndex = prepared.slice(0, i).filter(x => x.type !== 'section').length;
            if (qq.type === 'section') {
              return <div key={qq.id} className={`panel ${radiusClass} p-5 sm:p-6 bg-[rgba(15,118,110,0.04)]`}><QuestionInner q={qq} index={displayIndex} answer={answers[qq.id]} setAnswer={(v) => setAnswer(qq.id, v)} checked={!!checked[qq.id]} /></div>;
            }
            return <QuestionBlock key={qq.id} q={qq} index={displayIndex} answer={answers[qq.id]} setAnswer={(v) => setAnswer(qq.id, v)} checked={!!checked[qq.id]} showCheck={settings.showAnswers === 'after_each'} onCheck={() => setChecked(c => ({ ...c, [qq.id]: true }))} radiusClass={radiusClass} />;
          })}
          <div className="flex justify-end"><button className="btn btn-primary" type="button" onClick={() => finish()} disabled={submitting}><Send size={15} /> {submitting ? 'Submitting…' : 'Submit quiz'}</button></div>
          {submitError && <p className="text-sm text-[var(--signal)]">{submitError}</p>}
        </div>
      ) : (
        <div className={`panel ${radiusClass} p-5 sm:p-7`}>
          <QuestionInner q={q} index={prepared.slice(0, step).filter(x => x.type !== 'section').length} answer={answers[q.id]} setAnswer={(v) => setAnswer(q.id, v)} checked={currentChecked} />
          {settings.showAnswers === 'after_each' && currentChecked && currentScore && q.type !== 'section' && <Feedback q={q} score={currentScore} />}
          <div className="mt-6 flex flex-wrap gap-3 items-center justify-between">
            <button className="btn btn-ghost" type="button" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}>Back</button>
            <div className="flex gap-2">
              {q.type === 'section' ? (
                step < prepared.length - 1 ? (
                  <button className="btn btn-primary" type="button" onClick={() => { setSubmitError(null); setStep(s => s + 1); }}>Continue</button>
                ) : (
                  <button className="btn btn-primary" type="button" disabled={submitting} onClick={() => finish()}>{submitting ? 'Finishing…' : 'See results'}</button>
                )
              ) : settings.showAnswers === 'after_each' && !currentChecked ? (
                <button className="btn btn-primary" type="button" disabled={!canAdvanceFor([q])} onClick={() => setChecked(c => ({ ...c, [q.id]: true }))}>Check answer</button>
              ) : step < prepared.length - 1 ? (
                <button className="btn btn-primary" type="button" disabled={!canAdvanceFor([q])} onClick={() => { setSubmitError(null); setStep(s => s + 1); }}>Next</button>
              ) : (
                <button className="btn btn-primary" type="button" disabled={!canAdvanceFor([q]) || submitting} onClick={() => finish()}>{submitting ? 'Finishing…' : 'See results'}</button>
              )}
            </div>
          </div>
          {submitError && <p className="text-sm text-[var(--signal)] mt-3">{submitError}</p>}
        </div>
      )}
    </div>
  );
}

function QuestionBlock({ q, index, answer, setAnswer, checked, showCheck, onCheck, radiusClass }: { q: Question; index: number; answer: AnswerValue; setAnswer: (v: AnswerValue) => void; checked: boolean; showCheck: boolean; onCheck: () => void; radiusClass: string }) {
  const score = checked ? scoreQuestion(q, answer) : null;
  return (
    <div className={`panel ${radiusClass} p-5 sm:p-6`}>
      <QuestionInner q={q} index={index} answer={answer} setAnswer={setAnswer} checked={checked} />
      {showCheck && !checked && q.type !== 'section' && <div className="mt-4"><button type="button" className="btn btn-secondary !py-2 text-sm" onClick={onCheck} disabled={!isAnswered(q, answer)}>Check answer</button></div>}
      {showCheck && checked && score && q.type !== 'section' && <Feedback q={q} score={score} />}
    </div>
  );
}

function QuestionInner({ q, index, answer, setAnswer, checked }: { q: Question; index: number; answer: AnswerValue; setAnswer: (v: AnswerValue) => void; checked: boolean }) {
  if (q.type === 'section') {
    return (
      <div className="pt-2">
        <p className="kicker mb-2">Section</p>
        <h2 className="font-display text-3xl sm:text-4xl leading-tight mb-2">{q.prompt}</h2>
        {q.description && <p className="muted text-lg whitespace-pre-wrap">{q.description}</p>}
        {q.imageUrl && <Image src={q.imageUrl} alt="" width={1200} height={720} unoptimized className="mt-4 max-h-72 w-auto rounded-md border border-[var(--line)] object-contain bg-white" />}
      </div>
    );
  }
  return (
    <div>
      <p className="text-sm muted mb-2">{typeLabel(q.type)} · {q.points} point{Number(q.points) === 1 ? '' : 's'} {q.required !== false ? '' : '· optional'}</p>
      <h2 className="font-display text-2xl sm:text-3xl leading-snug mb-2"><span className="muted mr-2 text-xl">{index + 1}.</span>{q.prompt}</h2>
      {q.description && <p className="muted mb-4 whitespace-pre-wrap">{q.description}</p>}
      {q.imageUrl && <Image src={q.imageUrl} alt="" width={1200} height={720} unoptimized className="mb-4 max-h-72 w-auto rounded-md border border-[var(--line)] object-contain bg-white" />}
      <QuestionInput q={q} answer={answer} setAnswer={setAnswer} disabled={checked} />
    </div>
  );
}

function QuestionInput({ q, answer, setAnswer, disabled }: { q: Question; answer: AnswerValue; setAnswer: (v: AnswerValue) => void; disabled: boolean }) {
  if (q.type === 'section') {
    return null;
  }
  if (q.type === 'short_text' || q.type === 'number') {
    return <div><label className="label" htmlFor={`q-${q.id}`}>Your answer</label><input id={`q-${q.id}`} className="field" type={q.type === 'number' ? 'number' : 'text'} value={String(answer ?? '')} disabled={disabled} onChange={(e) => setAnswer(e.target.value)} placeholder={q.type === 'number' ? 'Enter a number' : 'Type your answer'} /></div>;
  }
  if (q.type === 'long_text') {
    return <div><label className="label" htmlFor={`q-${q.id}`}>Your response</label><textarea id={`q-${q.id}`} className="field min-h-[140px]" value={String(answer ?? '')} disabled={disabled} onChange={(e) => setAnswer(e.target.value)} placeholder="Write your response..." /></div>;
  }
  if (q.type === 'dropdown') {
    return <div><label className="label" htmlFor={`q-${q.id}`}>Select an answer</label><select id={`q-${q.id}`} className="field" value={String(answer ?? '')} disabled={disabled} onChange={(e) => setAnswer(e.target.value)}><option value="">Choose…</option>{(q.options || []).map(o => <option key={o.id} value={o.id}>{o.text}</option>)}</select></div>;
  }
  if (q.type === 'ranking') {
    const opts = q.options || [];
    const current = Array.isArray(answer) && (answer as string[]).length === opts.length ? (answer as string[]).map(String) : opts.map(o => o.id);
    const map = new Map(opts.map(o => [o.id, o.text]));
    const move = (i: number, dir: -1 | 1) => {
      const arr = [...current]; const ni = i + dir; if (ni < 0 || ni >= arr.length) return; const [it] = arr.splice(i, 1); arr.splice(ni, 0, it); setAnswer(arr);
    };
    return <div className="space-y-2">{current.map((id, i) => <div key={id} className="flex items-center gap-2 rounded-md border border-[var(--line)] bg-white/50 px-3 py-2"><span className="text-sm font-semibold w-6">{i + 1}.</span><span className="flex-1">{map.get(id) || id}</span><button type="button" className="btn btn-ghost !px-2 !py-1" disabled={disabled || i === 0} onClick={() => move(i, -1)}>↑</button><button type="button" className="btn btn-ghost !px-2 !py-1" disabled={disabled || i === current.length - 1} onClick={() => move(i, 1)}>↓</button></div>)}{!Array.isArray(answer) || (answer as string[]).length !== opts.length ? <p className="text-xs muted">Use arrows to set the order.</p> : null}</div>;
  }
  if (q.type === 'matching') {
    const pairs = q.matchPairs || [];
    const rightOptions = pairs.map(p => ({ id: p.id, text: p.right }));
    const given = answer && typeof answer === 'object' && !Array.isArray(answer) ? answer as Record<string, string> : {};
    return <div className="space-y-2">{pairs.map((p) => <div key={p.id} className="grid sm:grid-cols-[1fr_1fr] gap-2 items-center"><div className="rounded-md border border-[var(--line)] bg-white/50 px-3 py-2 text-sm">{p.left}</div><select className="field" value={given[p.id] || ''} disabled={disabled} onChange={(e) => setAnswer({ ...given, [p.id]: e.target.value })}><option value="">Select match…</option>{rightOptions.map(r => <option key={r.id} value={r.id}>{r.text}</option>)}</select></div>)}</div>;
  }

  const multi = q.type === 'multi_select';
  const opts = q.options || [];
  return <div className="space-y-2.5">{(opts.length ? opts : q.type === 'true_false' ? [{id:'true',text:'True'},{id:'false',text:'False'}] : []).map((o) => {
    const selected = multi ? (Array.isArray(answer) && (answer as string[]).includes(o.id)) : String(answer ?? '') === o.id;
    return <label key={o.id} className={`flex items-start gap-3 rounded-md border px-3.5 py-3 cursor-pointer transition ${selected ? 'border-[var(--accent)] bg-[rgba(15,118,110,0.06)]' : 'border-[var(--line)] bg-white/40 hover:bg-white/70'} ${disabled ? 'cursor-default' : ''}`}><input className="mt-1" type={multi ? 'checkbox' : 'radio'} name={`q-${q.id}`} checked={selected} disabled={disabled} onChange={() => { if (multi) { const cur = Array.isArray(answer) ? [...(answer as string[])] : []; setAnswer(selected ? cur.filter(x => x !== o.id) : [...cur, o.id]); } else { setAnswer(o.id); } }} /><span>{o.text}</span></label>;
  })}</div>;
}

function Feedback({ q, score }: { q: Question; score: ReturnType<typeof scoreQuestion> }) {
  const ok = score.ok;
  const showCorrect = ok === false && (q.type !== 'long_text' || ((q.correct || []).filter(Boolean).length > 0));
  return (
    <div className={`mt-5 rounded-md border px-4 py-3 text-sm ${ok ? 'bg-[var(--ok-bg)] text-[var(--ok)] border-teal-200' : ok === false ? 'bg-[var(--bad-bg)] text-[var(--bad)] border-red-200' : 'bg-[rgba(24,33,43,0.05)] text-[var(--ink-soft)] border-[var(--line)]'}`}>
      <p className="font-semibold mb-1">{ok ? 'Correct' : ok === false ? 'Not quite' : 'Response recorded'}</p>
      {showCorrect && <p className="mb-1"><span className="font-semibold">Correct answer:</span> <span className="whitespace-pre-wrap">{formatCorrectAnswer(q)}</span></p>}
      {score.feedback && <p className="mb-1">{score.feedback}</p>}
      {q.explanation && <p>{q.explanation}</p>}
    </div>
  );
}
