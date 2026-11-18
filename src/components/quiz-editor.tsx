'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { blankQuestion, defaultGradeBands, ensureQuizDefaults, normalizeQuestionForEditor, prepareQuestionForSave, questionTypeHelp, questionTypeLabels } from '@/lib/quiz-helpers';
import { downloadImportTemplate, parseQuestionsFromFile } from '@/lib/quiz-import';
import { mergeSettings, mergeTheme } from '@/lib/demo';
import { createClient, hasSupabaseEnv } from '@/lib/supabase/client';
import { fromLocalDateTimeInput, toLocalDateTimeInput, uid } from '@/lib/utils';
import { QuizTaker } from '@/components/quiz-taker';
import type { GradeBand, MatchPair, Question, QuestionType, Quiz, QuizSettings, QuizTheme } from '@/types/quiz';
import { ArrowDown, ArrowLeft, ArrowUp, Check, Copy, Download, Eye, EyeOff, ExternalLink, FileCode2, FileSpreadsheet, Play, Plus, Save, Trash2, Upload } from 'lucide-react';

type EditorProps = {
  quiz: Quiz;
  initialQuestions: Question[];
  storage?: 'supabase' | 'local';
  backHref?: string;
  takeHref?: string;
  onLocalSave?: (quiz: Quiz, questions: Question[]) => void;
};

type EditableQuestion = Question & { dbId?: string };

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`px-3 py-2 text-sm font-semibold rounded-md border ${active ? 'bg-[var(--ink)] text-white border-[var(--ink)]' : 'border-[var(--line)] bg-white/60 hover:bg-white'}`}>{children}</button>;
}

export function QuizEditor({ quiz: initialQuiz, initialQuestions, storage = 'supabase', backHref = '/dashboard', takeHref, onLocalSave }: EditorProps) {
  const router = useRouter();
  const supabase = useMemo(() => (storage === 'supabase' && hasSupabaseEnv() ? createClient() : null), [storage]);
  const [quiz, setQuiz] = useState<Quiz>(ensureQuizDefaults(initialQuiz));
  const [questions, setQuestions] = useState<EditableQuestion[]>(
    (initialQuestions || []).sort((a, b) => a.position - b.position).map((q, i) => ({ ...normalizeQuestionForEditor(q, i), dbId: q.id }))
  );
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [tab, setTab] = useState<'build' | 'settings' | 'results' | 'share'>('build');
  const [showPreview, setShowPreview] = useState(false);
  const [selectedType, setSelectedType] = useState<QuestionType>('multiple_choice');
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function updateQuiz<K extends keyof Quiz>(key: K, value: Quiz[K]) { setQuiz((q) => ({ ...q, [key]: value })); }
  function updateSettings(patch: Partial<QuizSettings>) { setQuiz((q) => ({ ...q, settings: mergeSettings({ ...(q.settings || {}), ...patch }) })); }
  function updateTheme(patch: Partial<QuizTheme>) { setQuiz((q) => ({ ...q, theme: mergeTheme({ ...(q.theme || {}), ...patch }) })); }
  function updateQuestion(id: string, patch: Partial<Question>) { setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q))); }
  function setQuestionList(updater: (qs: EditableQuestion[]) => EditableQuestion[]) { setQuestions((qs) => updater(qs).map((q, i) => ({ ...q, position: i }))); }

  async function onImportFile(file?: File | null) {
    if (!file) return;
    setImporting(true);
    setMsg(null);
    try {
      const { questions: imported, warnings } = await parseQuestionsFromFile(file);
      if (!imported.length) throw new Error('No questions found in the file. Make sure the first sheet has a header row (e.g. type,prompt,options,correct) and at least one non-empty prompt.');
      const normalized = imported.map((q, i) => normalizeQuestionForEditor({ ...q, id: uid('q') }, i));
      if (importMode === 'replace') {
        const existingDbIds = questions.filter((q) => q.dbId).map((q) => q.dbId as string);
        if (existingDbIds.length) setDeletedIds((d) => [...d, ...existingDbIds]);
        setQuestions(normalized.map((q, i) => ({ ...q, position: i })));
      } else {
        setQuestions((qs) => [...qs, ...normalized].map((q, i) => ({ ...q, position: i })));
      }
      const warnText = warnings.length ? ` (${warnings.length} warning${warnings.length === 1 ? '' : 's'}: ${warnings[0]})` : '';
      setMsg({ type: 'ok', text: `Imported ${normalized.length} item${normalized.length === 1 ? '' : 's'} from ${file.name}${warnText}. Review and click Save.` });
      setTab('build');
    } catch (e: unknown) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Could not import file.' });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function addQuestion(type: QuestionType = selectedType) {
    setQuestions((qs) => [...qs, { ...blankQuestion(type, qs.length, quiz.id) }]);
  }
  function duplicateQuestion(id: string) {
    setQuestionList((qs) => {
      const i = qs.findIndex((q) => q.id === id);
      if (i < 0) return qs;
      const src = qs[i];
      const copy: EditableQuestion = { ...JSON.parse(JSON.stringify(src)) as EditableQuestion, id: uid('q'), prompt: src.prompt ? `${src.prompt} (copy)` : '' };
      delete copy.dbId;
      const next = [...qs]; next.splice(i + 1, 0, copy); return next;
    });
  }
  function removeQuestion(id: string) {
    setQuestionList((qs) => {
      const q = qs.find((x) => x.id === id);
      if (q?.dbId) setDeletedIds((d) => [...d, q.dbId as string]);
      return qs.filter((x) => x.id !== id);
    });
  }
  function moveQuestion(id: string, dir: -1 | 1) {
    setQuestionList((qs) => {
      const idx = qs.findIndex((q) => q.id === id); const ni = idx + dir;
      if (idx < 0 || ni < 0 || ni >= qs.length) return qs;
      const copy = [...qs]; const [item] = copy.splice(idx, 1); copy.splice(ni, 0, item); return copy;
    });
  }
  function changeType(id: string, type: QuestionType) {
    setQuestionList((qs) => qs.map((q) => {
      if (q.id !== id) return q;
      const b = blankQuestion(type, q.position, quiz.id);
      const next: EditableQuestion = {
        ...b,
        id: q.id,
        dbId: q.dbId,
        prompt: q.prompt,
        description: q.description || '',
        imageUrl: q.imageUrl || '',
        explanation: q.explanation || '',
        required: q.required,
        points: type === 'long_text' ? 0 : (q.points || 1),
      };
      return next;
    }));
  }

  function normalizeAllForSave() {
    if (!quiz.title.trim()) throw new Error('Quiz title is required.');
    if (!quiz.slug.trim()) throw new Error('Quiz slug is required.');
    const normalized = questions.map((q, i) => prepareQuestionForSave(q, i, quiz.id));
    return normalized;
  }

  async function save(status?: 'draft' | 'published') {
    setSaving(true); setMsg(null);
    try {
      const normalized = normalizeAllForSave();
      const wasPublished = quiz.status === 'published';
      const nextStatus = status || quiz.status;
      const nextQuiz = ensureQuizDefaults({ ...quiz, title: quiz.title.trim(), description: (quiz.description || '').trim(), slug: quiz.slug.trim().toLowerCase(), status: nextStatus, updated_at: new Date().toISOString() });

      if (storage === 'local') {
        onLocalSave?.(nextQuiz, normalized);
        setQuiz(nextQuiz);
        setQuestions(normalized.map((q, i) => normalizeQuestionForEditor(q, i)));
        const localMsg = nextStatus === 'published'
          ? 'Saved locally (marked as published in this browser). Note: local demos are not publicly shareable.'
          : (wasPublished ? 'Saved locally and marked as draft in this browser.' : 'Saved locally in this browser.');
        setMsg({ type: 'ok', text: localMsg });
        return;
      }
      if (!supabase) throw new Error('Supabase is not configured.');

      const { error: qErr } = await supabase.from('quizzes').update({
        title: nextQuiz.title,
        description: nextQuiz.description || '',
        slug: nextQuiz.slug,
        status: nextStatus,
        theme: nextQuiz.theme,
        settings: nextQuiz.settings,
      }).eq('id', nextQuiz.id);
      if (qErr) throw qErr;

      if (deletedIds.length) {
        const { error } = await supabase.from('questions').delete().in('id', deletedIds);
        if (error) throw error;
        setDeletedIds([]);
      }

      const newIdMap: Record<string, string> = {};
      for (let i = 0; i < questions.length; i += 1) {
        const q = questions[i];
        const n = normalized[i];
        const payload = {
          quiz_id: nextQuiz.id,
          type: n.type,
          prompt: n.prompt,
          description: n.description || '',
          image_url: n.imageUrl || null,
          required: n.required !== false,
          options: n.options || [],
          correct: n.correct || [],
          match_pairs: n.matchPairs || [],
          match_correct: n.matchCorrect || {},
          points: n.points ?? 0,
          explanation: n.explanation || '',
          position: n.position ?? i,
        };
        if (q.dbId) {
          const { error } = await supabase.from('questions').update(payload).eq('id', q.dbId);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.from('questions').insert(payload).select('id').single();
          if (error) throw error;
          newIdMap[q.id] = data.id as string;
        }
      }

      const remapped: EditableQuestion[] = normalized.map((n, i) => {
        const old = questions[i];
        const id = old.dbId || newIdMap[old.id] || n.id;
        return { ...normalizeQuestionForEditor({ ...n, id }, i), dbId: id };
      });
      setQuestions(remapped);
      setQuiz(nextQuiz);
      const okText = nextStatus === 'published'
        ? (wasPublished ? 'Quiz updated. Your live public link is up to date.' : 'Quiz published. It is now live at its public link.')
        : (wasPublished ? 'Quiz unpublished and saved as draft. The public link will no longer be accessible.' : 'Quiz saved as draft.');
      setMsg({ type: 'ok', text: okText });
      router.refresh();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Could not save quiz.' });
    } finally {
      setSaving(false);
    }
  }

  const envSiteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
  const origin = envSiteUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  const publicUrl = origin ? `${origin}/q/${quiz.slug}` : `/q/${quiz.slug}`;
  const embedCode = `<iframe src="${publicUrl}" title="${quiz.title.replace(/"/g, '&quot;')}" width="100%" height="800" style="border:1px solid #ddd;border-radius:12px;" loading="lazy"></iframe>`;

  const settings = quiz.settings || mergeSettings(null);

  return (
    <div className="space-y-5 pb-24">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sticky top-16 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-[var(--paper)]/95 backdrop-blur border-b border-[var(--line)]">
        <div>
          <Link href={backHref} className="inline-flex items-center gap-1 text-sm muted hover:text-[var(--ink)] mb-1"><ArrowLeft size={14}/> {storage === 'local' ? 'Local demos' : 'Dashboard'}</Link>
          <h1 className="text-2xl sm:text-3xl font-semibold leading-tight">{storage === 'local' ? 'Edit local quiz' : 'Edit quiz'}</h1>
          <p className="muted mt-0.5 text-sm">{questions.filter(q => q.type !== 'section').length} question{questions.filter(q => q.type !== 'section').length === 1 ? '' : 's'} · {quiz.status}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-ghost" type="button" onClick={() => setShowPreview((v) => !v)}>{showPreview ? <EyeOff size={15}/> : <Eye size={15}/>} {showPreview ? 'Hide preview' : 'Preview'}</button>
          {storage === 'local' ? (
            <>
              <button className="btn btn-primary" onClick={() => save('draft')} disabled={saving} type="button"><Save size={15}/> {saving ? 'Saving…' : 'Save local copy'}</button>
              {takeHref && <Link href={takeHref} className="btn btn-secondary"><Play size={15}/> Open take view</Link>}
            </>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={() => save('draft')} disabled={saving} type="button"><Save size={15}/> {saving ? 'Saving…' : 'Save draft'}</button>
              <button className="btn btn-primary" onClick={() => save('published')} disabled={saving} type="button"><Check size={15}/> {quiz.status === 'published' ? 'Save & update' : 'Publish'}</button>
            </>
          )}
        </div>
      </div>

      {msg && <p className={`text-sm rounded-md px-3 py-2 border ${msg.type==='ok' ? 'bg-[var(--ok-bg)] text-[var(--ok)] border-teal-200' : 'bg-[var(--bad-bg)] text-[var(--bad)] border-red-200'}`}>{msg.text}</p>}

      {showPreview && (
        <section className="panel rounded-lg p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div><p className="kicker mb-1">Preview</p><h2 className="text-xl font-semibold">How respondents will experience this quiz</h2></div>
            <p className="text-xs muted">Preview uses current editor state; save to persist changes.</p>
          </div>
          <div className="border border-[var(--line)] rounded-lg p-3 sm:p-4 bg-white/40">
            <QuizTaker quiz={{ ...quiz, status: 'draft' }} questions={questions as Question[]} persistResponse={false} preview />
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <TabButton active={tab==='build'} onClick={()=>setTab('build')}>Build</TabButton>
        <TabButton active={tab==='settings'} onClick={()=>setTab('settings')}>Settings</TabButton>
        <TabButton active={tab==='results'} onClick={()=>setTab('results')}>Results & grading</TabButton>
        <TabButton active={tab==='share'} onClick={()=>setTab('share')}>Share</TabButton>
      </div>

      {tab === 'build' && (
        <div className="grid xl:grid-cols-[1fr_320px] gap-6 items-start">
          <div className="space-y-5">
            <section className="panel rounded-lg p-5 sm:p-6 space-y-4">
              <h2 className="text-xl font-semibold">Quiz details</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2"><label className="label">Title</label><input className="field" value={quiz.title} onChange={(e)=>updateQuiz('title', e.target.value)} placeholder="Quiz title" /></div>
                <div className="sm:col-span-2"><label className="label">Description</label><textarea className="field min-h-[90px]" value={quiz.description || ''} onChange={(e)=>updateQuiz('description', e.target.value)} placeholder="What is this quiz about?" /></div>
                <div><label className="label">Slug</label><input className="field font-mono text-sm" value={quiz.slug} onChange={(e)=>updateQuiz('slug', e.target.value.replace(/[^a-z0-9-]/g,'').toLowerCase())} /></div>
                <div><label className="label">Mode</label><select className="field" value={settings.mode || 'scored'} onChange={(e)=>updateSettings({ mode: e.target.value as QuizSettings['mode'] })}><option value="scored">Scored quiz / test</option><option value="survey">Survey / feedback (no grading emphasis)</option></select></div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold">Questions</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <select className="field !w-auto !py-2 text-sm" value={selectedType} onChange={(e)=>setSelectedType(e.target.value as QuestionType)}>
                    {Object.entries(questionTypeLabels).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <button type="button" className="btn btn-primary !py-2" onClick={()=>addQuestion(selectedType)}><Plus size={15}/> Add</button>
                </div>
              </div>

              <div className="panel rounded-lg p-4 sm:p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="font-semibold inline-flex items-center gap-2"><FileSpreadsheet size={16} className="text-[var(--accent)]"/> Import from Excel / CSV</h3>
                    <p className="text-sm muted mt-1">Upload questions from a spreadsheet (parsed in your browser — nothing is saved to the database until you click Save). Download the template, fill it in, then import.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn btn-secondary !py-2 text-sm" onClick={downloadImportTemplate}><Download size={14}/> Download template</button>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="text-sm" onChange={(e)=>onImportFile(e.target.files?.[0] || null)} />
                  <label className="text-sm inline-flex items-center gap-2"><input type="radio" name="importmode" checked={importMode==='append'} onChange={()=>setImportMode('append')} /> Append</label>
                  <label className="text-sm inline-flex items-center gap-2"><input type="radio" name="importmode" checked={importMode==='replace'} onChange={()=>setImportMode('replace')} /> Replace existing</label>
                  {importing && <span className="text-sm muted inline-flex items-center gap-1"><Upload size={14}/> Parsing…</span>}
                </div>
                <p className="text-xs muted">Supported columns: type, prompt, description, options (use <code>|</code>), correct (use <code>|</code>; short answers support <code>=Exact</code> and <code>*keyword*</code>; long answers can list keywords for auto-check), points, required, explanation, pairs (Left=Right | ...), image. Includes all question types and section headings.</p>
              </div>

              {questions.length === 0 && <div className="panel rounded-lg p-8 text-center muted">No questions yet. Choose a type and add your first question, or import from Excel/CSV above.</div>}

              {questions.map((q, idx) => (
                <QuestionCard key={q.id} q={q} idx={idx} total={questions.length}
                  onChange={(patch)=>updateQuestion(q.id, patch)}
                  onType={(type)=>changeType(q.id, type)}
                  onMove={(dir)=>moveQuestion(q.id, dir)}
                  onRemove={()=>removeQuestion(q.id)}
                  onDuplicate={()=>duplicateQuestion(q.id)}
                />
              ))}

              <div className="panel rounded-lg p-4 flex flex-wrap gap-2 items-center">
                <span className="text-sm font-semibold mr-1">Quick add:</span>
                {(['multiple_choice','multi_select','true_false','short_text','dropdown','number','long_text','ranking','matching','section'] as QuestionType[]).map((t) => (
                  <button key={t} type="button" className="btn btn-secondary !py-1.5 !px-3 text-xs" onClick={()=>addQuestion(t)}>+ {questionTypeLabels[t]}</button>
                ))}
                <span className="hidden sm:inline-block w-px h-6 bg-[var(--line)] mx-1" aria-hidden />
                <button type="button" className="btn btn-secondary !py-1.5 !px-3 text-xs" onClick={downloadImportTemplate}><Download size={13}/> Template</button>
                <button type="button" className="btn btn-secondary !py-1.5 !px-3 text-xs" onClick={() => fileInputRef.current?.click()} disabled={importing}><Upload size={13}/> {importing ? 'Importing…' : 'Import Excel/CSV'}</button>
              </div>
            </section>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-28">
            <section className="panel rounded-lg p-5 space-y-3">
              <h2 className="text-lg font-semibold">Builder tips</h2>
              <ul className="text-sm muted space-y-2">
                <li>Use <strong className="text-[var(--ink)]">Preview</strong> to test flow, required fields, and scoring.</li>
                <li>Mark correct answers for scored questions. Surveys can use 0-point/open questions.</li>
                <li>Short answers: case-insensitive by default; use <code>=Exact</code> for case-sensitive or <code>*keyword*</code> to accept if it appears in the response.</li>
                <li>Long answers: add keywords to auto-check (all must appear), or leave empty for manual/not auto-graded.</li>
                <li>Use <strong className="text-[var(--ink)]">Section / heading</strong> items to add headings and instructions inside the quiz.</li>
              </ul>
            </section>
            <section className="panel rounded-lg p-5 space-y-3">
              <h2 className="text-lg font-semibold">At a glance</h2>
              <div className="text-sm space-y-1.5">
                <div className="flex justify-between"><span className="muted">Questions</span><strong>{questions.filter(q=>q.type!=='section').length}</strong></div>
                <div className="flex justify-between"><span className="muted">Sections</span><strong>{questions.filter(q=>q.type==='section').length}</strong></div>
                <div className="flex justify-between"><span className="muted">Total points</span><strong>{questions.reduce((a,q)=>a + Number(q.points||0),0)}</strong></div>
                <div className="flex justify-between"><span className="muted">Show answers</span><strong>{settings.showAnswers}</strong></div>
                <div className="flex justify-between"><span className="muted">Pass mark</span><strong>{settings.passMark}%</strong></div>
              </div>
            </section>
          </aside>
        </div>
      )}

      <div className="fixed bottom-4 right-4 sm:right-6 z-30 flex flex-wrap gap-2 items-center panel rounded-lg p-2 shadow-lg border border-[var(--line)]">
        <span className="text-xs muted px-2 hidden sm:inline">{storage === 'local' ? 'Local quiz' : (quiz.status === 'published' ? 'Published' : 'Draft')}</span>
        {storage === 'local' ? (
          <button className="btn btn-primary !py-2" onClick={() => save('draft')} disabled={saving} type="button"><Save size={15}/> {saving ? 'Saving…' : 'Save'}</button>
        ) : (
          <>
            <button className="btn btn-secondary !py-2" onClick={() => save('draft')} disabled={saving} type="button"><Save size={15}/> {saving ? 'Saving…' : 'Save'}</button>
            <button className="btn btn-primary !py-2" onClick={() => save('published')} disabled={saving} type="button"><Check size={15}/> {quiz.status === 'published' ? 'Update' : 'Publish'}</button>
          </>
        )}
      </div>

      {tab === 'settings' && (
        <SettingsTab quiz={quiz} onSettings={updateSettings} onTheme={updateTheme} />
      )}
      {tab === 'results' && (
        <ResultsTab settings={settings} onSettings={updateSettings} />
      )}
      {tab === 'share' && (
        <ShareTab storage={storage} quiz={quiz} publicUrl={publicUrl} embedCode={embedCode} saving={saving} onPublish={() => save('published')} onCopied={(t,m)=>setMsg({type:t,text:m})} />
      )}
    </div>
  );
}
function QuestionCard({ q, idx, total, onChange, onType, onMove, onRemove, onDuplicate }: { q: Question; idx: number; total: number; onChange: (patch: Partial<Question>) => void; onType: (t: QuestionType) => void; onMove: (dir: -1 | 1) => void; onRemove: () => void; onDuplicate: () => void }) {
  function setOption(i: number, text: string) {
    const opts = [...(q.options || [])]; opts[i] = { ...opts[i], text }; onChange({ options: opts });
  }
  function addOption() { onChange({ options: [...(q.options || []), { id: uid('o'), text: '' }] }); }
  function removeOption(id: string) {
    const opts = (q.options || []).filter((o) => o.id !== id);
    const correct = (q.correct || []).filter((c) => c !== id);
    const patch: Partial<Question> = { options: opts, correct };
    if (q.type === 'ranking') patch.correct = opts.map((o) => o.id);
    onChange(patch);
  }
  function toggleCorrect(id: string, multi: boolean) {
    if (!multi) return onChange({ correct: [id] });
    const has = (q.correct || []).includes(id);
    onChange({ correct: has ? (q.correct || []).filter((c) => c !== id) : [...(q.correct || []), id] });
  }

  const canHaveOptions = ['multiple_choice','multi_select','dropdown','true_false','ranking'].includes(q.type);
  const isMatching = q.type === 'matching';
  const pairs = q.matchPairs || [];
  const isSection = q.type === 'section';

  function updatePair(i: number, patch: Partial<MatchPair>) {
    const next = pairs.map((p, idx2) => idx2 === i ? { ...p, ...patch } : p);
    onChange({ matchPairs: next, matchCorrect: Object.fromEntries(next.map((p) => [p.id, p.id])) });
  }
  function addPair() {
    const p = { id: uid('p'), left: '', right: '' };
    const next = [...pairs, p];
    onChange({ matchPairs: next, matchCorrect: Object.fromEntries(next.map((x) => [x.id, x.id])) });
  }
  function removePair(id: string) {
    const next = pairs.filter((p) => p.id !== id);
    onChange({ matchPairs: next, matchCorrect: Object.fromEntries(next.map((x) => [x.id, x.id])) });
  }

  function moveRankingOption(i: number, dir: -1 | 1) {
    const opts = [...(q.options || [])];
    const ni = i + dir; if (ni < 0 || ni >= opts.length) return;
    const [it] = opts.splice(i,1); opts.splice(ni,0,it);
    onChange({ options: opts, correct: opts.map(o=>o.id) });
  }

  return (
    <div className={`panel rounded-lg p-5 space-y-4 ${isSection ? 'border-l-4 border-l-[var(--accent)]' : ''}`}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold"><span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[rgba(15,118,110,0.12)] text-[var(--accent)]">{idx + 1}</span> {questionTypeLabels[q.type]}</div>
          <div className="flex flex-wrap items-center gap-2">
            <select className="field !py-1.5 !w-auto text-sm" value={q.type} onChange={(e)=>onType(e.target.value as QuestionType)}>{Object.entries(questionTypeLabels).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select>
            {!isSection && <label className="text-xs muted flex items-center gap-1">Points <input className="field !py-1 !w-20 text-sm" type="number" min={0} step="1" value={q.points ?? 0} onChange={(e)=>onChange({ points: Number(e.target.value) })} /></label>}
            <button type="button" className="btn btn-ghost !px-2 !py-1.5" onClick={()=>onMove(-1)} disabled={idx===0} title="Move up"><ArrowUp size={15}/></button>
            <button type="button" className="btn btn-ghost !px-2 !py-1.5" onClick={()=>onMove(1)} disabled={idx===total-1} title="Move down"><ArrowDown size={15}/></button>
            <button type="button" className="btn btn-ghost !px-2 !py-1.5" onClick={onDuplicate} title="Duplicate">Copy</button>
            <button type="button" className="btn btn-ghost !px-2 !py-1.5 text-[var(--signal)]" onClick={onRemove} title="Remove"><Trash2 size={15}/></button>
          </div>
        </div>
        {questionTypeHelp[q.type] && <p className="text-xs muted -mt-1">{questionTypeHelp[q.type]}</p>}
      </div>

      <div className="grid gap-3">
        <div>
          <label className="label">{q.type === 'section' ? 'Heading / title' : 'Prompt'}</label>
          <textarea className="field min-h-[78px]" value={q.prompt} onChange={(e)=>onChange({ prompt: e.target.value })} placeholder={q.type === 'section' ? 'Section heading...' : 'Ask your question...'} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">{q.type === 'section' ? 'Section description' : 'Description/help text'} <span className="muted font-normal">(optional)</span></label>
            <input className="field" value={q.description || ''} onChange={(e)=>onChange({ description: e.target.value })} placeholder={q.type === 'section' ? 'Instructions for this section' : 'Extra context for respondents'} />
          </div>
          <div>
            <label className="label">Image URL <span className="muted font-normal">(optional)</span></label>
            <input className="field" value={q.imageUrl || ''} onChange={(e)=>onChange({ imageUrl: e.target.value })} placeholder="https://..." />
          </div>
        </div>
        {q.type !== 'section' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={q.required !== false} onChange={(e)=>onChange({ required: e.target.checked })} /> Required question</label>}
      </div>

      {canHaveOptions && q.type !== 'ranking' && (
        <div className="space-y-2">
          <label className="label">Options {q.type==='multi_select' ? <span className="muted font-normal">(select all correct)</span> : q.type !== 'true_false' ? <span className="muted font-normal">(select the correct one)</span> : null}</label>
          {(q.options || []).map((o, i) => {
            const checked = (q.correct || []).includes(o.id);
            return (
              <div key={o.id} className="flex items-center gap-2">
                <input type={q.type==='multi_select' ? 'checkbox' : 'radio'} name={`correct-${q.id}`} checked={checked} onChange={()=>toggleCorrect(o.id, q.type==='multi_select')} title="Mark correct" disabled={q.type==='true_false'} />
                <input className="field !py-2" value={o.text} disabled={q.type==='true_false'} onChange={(e)=>setOption(i, e.target.value)} placeholder={`Option ${i+1}`} />
                {q.type !== 'true_false' && <button type="button" className="btn btn-ghost !px-2 !py-2" onClick={()=>removeOption(o.id)} disabled={(q.options||[]).length <= 2} title="Remove option"><Trash2 size={14}/></button>}
              </div>
            );
          })}
          {q.type !== 'true_false' && <button type="button" className="btn btn-ghost !px-2 text-sm" onClick={addOption}><Plus size={14}/> Add option</button>}
        </div>
      )}

      {q.type === 'ranking' && (
        <div className="space-y-2">
          <label className="label">Items in correct order (top to bottom)</label>
          {(q.options || []).map((o, i) => (
            <div key={o.id} className="flex items-center gap-2">
              <span className="text-xs muted w-5 text-center">{i+1}</span>
              <input className="field !py-2" value={o.text} onChange={(e)=>setOption(i, e.target.value)} placeholder={`Item ${i+1}`} />
              <button type="button" className="btn btn-ghost !px-2 !py-2" onClick={()=>moveRankingOption(i,-1)} disabled={i===0}><ArrowUp size={14}/></button>
              <button type="button" className="btn btn-ghost !px-2 !py-2" onClick={()=>moveRankingOption(i,1)} disabled={i===(q.options||[]).length-1}><ArrowDown size={14}/></button>
              <button type="button" className="btn btn-ghost !px-2 !py-2" onClick={()=>removeOption(o.id)} disabled={(q.options||[]).length <= 2}><Trash2 size={14}/></button>
            </div>
          ))}
          <div className="flex items-center gap-2"><button type="button" className="btn btn-ghost !px-2 text-sm" onClick={addOption}><Plus size={14}/> Add item</button><span className="text-xs muted">Reorder to define the correct ranking.</span></div>
        </div>
      )}

      {q.type === 'short_text' && (
        <div className="space-y-2">
          <label className="label">Accepted answers</label>
          {(q.correct || []).map((ans, i) => (
            <div key={i} className="flex items-center gap-2">
              <input className="field !py-2" value={ans} onChange={(e)=>{ const next=[...(q.correct||[])]; next[i]=e.target.value; onChange({ correct: next }); }} placeholder={i===0 ? 'e.g. Paris, =Paris (exact case), or *keyword*' : 'Another accepted answer'} />
              <button type="button" className="btn btn-ghost !px-2 !py-2" onClick={()=>onChange({ correct: (q.correct||[]).filter((_,j)=>j!==i) })} disabled={(q.correct||[]).length <= 1}><Trash2 size={14}/></button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost !px-2 text-sm" onClick={()=>onChange({ correct: [...(q.correct||[]), ''] })}><Plus size={14}/> Add accepted answer</button>
          <p className="text-xs muted">By default matching is case-insensitive (extra spaces ignored). Use <code>=Paris</code> for exact, case-sensitive matching, or <code>*keyword*</code> to accept responses that contain that keyword.</p>
        </div>
      )}

      {q.type === 'number' && (
        <div className="space-y-2">
          <label className="label">Accepted answers or ranges</label>
          {(q.correct || []).map((ans, i) => (
            <div key={i} className="flex items-center gap-2">
              <input className="field !py-2" value={ans} onChange={(e)=>{ const next=[...(q.correct||[])]; next[i]=e.target.value; onChange({ correct: next }); }} placeholder={i===0 ? 'e.g. 42 or 10:20' : 'Another accepted value/range'} />
              <button type="button" className="btn btn-ghost !px-2 !py-2" onClick={()=>onChange({ correct: (q.correct||[]).filter((_,j)=>j!==i) })} disabled={(q.correct||[]).length <= 1}><Trash2 size={14}/></button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost !px-2 text-sm" onClick={()=>onChange({ correct: [...(q.correct||[]), ''] })}><Plus size={14}/> Add accepted answer</button>
          <p className="text-xs muted">Use exact values (7) or inclusive ranges (10:20).</p>
        </div>
      )}

      {isMatching && (
        <div className="space-y-2">
          <label className="label">Matching pairs (left = prompt, right = correct match)</label>
          {pairs.map((p, i) => (
            <div key={p.id} className="grid sm:grid-cols-[1fr_auto_1fr_auto] gap-2 items-center">
              <input className="field !py-2" value={p.left} onChange={(e)=>updatePair(i,{ left: e.target.value })} placeholder={`Left item ${i+1}`} />
              <span className="text-xs muted text-center">↔</span>
              <input className="field !py-2" value={p.right} onChange={(e)=>updatePair(i,{ right: e.target.value })} placeholder={`Right match ${i+1}`} />
              <button type="button" className="btn btn-ghost !px-2 !py-2" onClick={()=>removePair(p.id)} disabled={pairs.length <= 2}><Trash2 size={14}/></button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost !px-2 text-sm" onClick={addPair}><Plus size={14}/> Add pair</button>
          <p className="text-xs muted">Respondents will match each left item to one of the right-side options.</p>
        </div>
      )}

      {q.type === 'long_text' && (
        <div className="space-y-2">
          <label className="label">Required keywords for auto-check <span className="muted font-normal">(optional)</span></label>
          {(q.correct || []).map((ans, i) => (
            <div key={i} className="flex items-center gap-2">
              <input className="field !py-2" value={ans} onChange={(e)=>{ const next=[...(q.correct||[])]; next[i]=e.target.value; onChange({ correct: next }); }} placeholder={i===0 ? 'e.g. photosynthesis (leave empty for manual review)' : 'Another keyword'} />
              <button type="button" className="btn btn-ghost !px-2 !py-2" onClick={()=>onChange({ correct: (q.correct||[]).filter((_,j)=>j!==i) })} disabled={(q.correct||[]).length <= 1}><Trash2 size={14}/></button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost !px-2 text-sm" onClick={()=>onChange({ correct: [...(q.correct||[]), ''] })}><Plus size={14}/> Add keyword</button>
          <p className="text-sm rounded-md border border-[var(--line)] bg-white/50 px-3 py-2 muted">If you add keywords, the response is auto-checked to ensure it includes all of them (case-insensitive). Leave empty to collect the response for manual review (not auto-graded).</p>
        </div>
      )}

      {q.type === 'section' && (
        <p className="text-sm rounded-md border border-[rgba(15,118,110,0.2)] bg-[rgba(15,118,110,0.06)] px-3 py-2 text-[var(--ink-soft)]">Section headings help organize your quiz. Use the prompt as the heading and description as supporting text. Sections are shown to respondents but are not scored.</p>
      )}

      {!isSection && (
        <div>
          <label className="label">Explanation / feedback <span className="muted font-normal">(optional)</span></label>
          <textarea className="field min-h-[70px]" value={q.explanation || ''} onChange={(e)=>onChange({ explanation: e.target.value })} placeholder="Shown after checking or in review depending on settings." />
        </div>
      )}
    </div>
  );
}

function SettingsTab({ quiz, onSettings, onTheme }: { quiz: Quiz; onSettings: (p: Partial<QuizSettings>) => void; onTheme: (p: Partial<QuizTheme>) => void }) {
  const s = mergeSettings(quiz.settings);
  const behaviorChecks: Array<[keyof QuizSettings, string]> = [
    ['oneQuestionPerPage', 'Show one question per page'],
    ['showProgressBar', 'Show progress bar'],
    ['shuffleQuestions', 'Shuffle questions'],
    ['shuffleOptions', 'Shuffle options'],
    ['allowRetake', 'Allow retake'],
    ['showScore', 'Show score to respondents'],
  ];
  const respondentChecks: Array<[keyof QuizSettings, string]> = [
    ['collectName', 'Ask for name'],
    ['collectEmail', 'Ask for email'],
    ['requireName', 'Require name'],
    ['requireEmail', 'Require email'],
  ];
  return (
    <div className="grid lg:grid-cols-2 gap-6 items-start">
      <section className="panel rounded-lg p-5 sm:p-6 space-y-4">
        <h2 className="text-xl font-semibold">Behavior</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="label">Show answers</label><select className="field" value={s.showAnswers} onChange={(e)=>onSettings({ showAnswers: e.target.value as QuizSettings['showAnswers'] })}><option value="after_each">After each question</option><option value="at_end">At end (review)</option><option value="never">Never</option></select></div>
          <div><label className="label">Pass mark (%)</label><input className="field" type="number" min={0} max={100} value={s.passMark ?? 70} onChange={(e)=>onSettings({ passMark: Number(e.target.value) })} /></div>
          <div><label className="label">Time limit (minutes)</label><input className="field" type="number" min={0} value={s.timeLimitMinutes ?? ''} onChange={(e)=>onSettings({ timeLimitMinutes: e.target.value === '' ? null : Number(e.target.value) })} placeholder="No limit" /></div>
          <div><label className="label">Access code <span className="muted font-normal">(optional)</span></label><input className="field" value={s.accessCode || ''} onChange={(e)=>onSettings({ accessCode: e.target.value })} placeholder="Leave blank for open access" /></div>
          <div><label className="label">Opens at <span className="muted font-normal">(optional)</span></label><input className="field" type="datetime-local" value={toLocalDateTimeInput(s.opensAt)} onChange={(e)=>onSettings({ opensAt: fromLocalDateTimeInput(e.target.value) })} /></div>
          <div><label className="label">Closes at <span className="muted font-normal">(optional)</span></label><input className="field" type="datetime-local" value={toLocalDateTimeInput(s.closesAt)} onChange={(e)=>onSettings({ closesAt: fromLocalDateTimeInput(e.target.value) })} /></div>
        </div>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 pt-2">
          {behaviorChecks.map(([k,label]) => (
            <label key={String(k)} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(s[k])} onChange={(e)=>onSettings({ [k]: e.target.checked } as Partial<QuizSettings>)} /> {label}</label>
          ))}
        </div>
      </section>

      <div className="space-y-6">
        <section className="panel rounded-lg p-5 sm:p-6 space-y-4">
          <h2 className="text-xl font-semibold">Respondent info</h2>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
            {respondentChecks.map(([k,label]) => (
              <label key={String(k)} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(s[k])} onChange={(e)=>onSettings({ [k]: e.target.checked } as Partial<QuizSettings>)} /> {label}</label>
            ))}
          </div>
          <p className="text-xs muted">Email collection is useful for lead capture; use responsibly and comply with your privacy requirements.</p>
        </section>

        <section className="panel rounded-lg p-5 sm:p-6 space-y-4">
          <h2 className="text-xl font-semibold">Messages & redirect</h2>
          <div><label className="label">Welcome message <span className="muted font-normal">(optional)</span></label><textarea className="field min-h-[70px]" value={s.welcomeMessage || ''} onChange={(e)=>onSettings({ welcomeMessage: e.target.value })} placeholder="Shown before the quiz starts" /></div>
          <div><label className="label">Completion message <span className="muted font-normal">(optional)</span></label><textarea className="field min-h-[70px]" value={s.successMessage || ''} onChange={(e)=>onSettings({ successMessage: e.target.value })} placeholder="Shown on the results screen" /></div>
          <div><label className="label">Redirect URL after completion <span className="muted font-normal">(optional)</span></label><input className="field" value={s.redirectUrl || ''} onChange={(e)=>onSettings({ redirectUrl: e.target.value })} placeholder="https://..." /></div>
        </section>

        <section className="panel rounded-lg p-5 sm:p-6 space-y-4">
          <h2 className="text-xl font-semibold">Appearance</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            <div><label className="label">Accent</label><input className="field h-10 p-1" type="color" value={quiz.theme?.accent || '#0f766e'} onChange={(e)=>onTheme({ accent: e.target.value })} /></div>
            <div><label className="label">Paper</label><input className="field h-10 p-1" type="color" value={quiz.theme?.paper || '#f3ede2'} onChange={(e)=>onTheme({ paper: e.target.value })} /></div>
            <div><label className="label">Ink</label><input className="field h-10 p-1" type="color" value={quiz.theme?.ink || '#18212b'} onChange={(e)=>onTheme({ ink: e.target.value })} /></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="label">Font style</label><select className="field" value={quiz.theme?.font || 'editorial'} onChange={(e)=>onTheme({ font: e.target.value as QuizTheme['font'] })}><option value="editorial">Editorial serif + sans</option><option value="modern">Modern sans</option><option value="classic">Classic serif</option></select></div>
            <div><label className="label">Corner style</label><select className="field" value={quiz.theme?.radius || 'soft'} onChange={(e)=>onTheme({ radius: e.target.value as QuizTheme['radius'] })}><option value="soft">Soft</option><option value="sharp">Sharp</option></select></div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ResultsTab({ settings, onSettings }: { settings: QuizSettings; onSettings: (p: Partial<QuizSettings>) => void }) {
  const bands = [...(settings.gradeBands || defaultGradeBands())].sort((a,b)=>b.min-a.min);
  function updateBand(id: string, patch: Partial<GradeBand>) {
    const next = bands.map((b) => b.id === id ? { ...b, ...patch } : b).sort((a,b)=>b.min-a.min);
    onSettings({ gradeBands: next });
  }
  function addBand() { onSettings({ gradeBands: [...bands, { id: uid('band'), min: 0, label: 'New band', description: '' }] }); }
  function removeBand(id: string) { if (bands.length <= 1) return; onSettings({ gradeBands: bands.filter((b)=>b.id!==id) }); }
  return (
    <div className="grid lg:grid-cols-2 gap-6 items-start">
      <section className="panel rounded-lg p-5 sm:p-6 space-y-4">
        <h2 className="text-xl font-semibold">Grading & outcomes</h2>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!settings.showScore} onChange={(e)=>onSettings({ showScore: e.target.checked })} /> Show numeric score and percent</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!settings.certificateEnabled} onChange={(e)=>onSettings({ certificateEnabled: e.target.checked })} /> Show completion/pass certificate on results</label>
        {settings.certificateEnabled && (
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="label">Certificate title</label><input className="field" value={settings.certificateTitle || ''} onChange={(e)=>onSettings({ certificateTitle: e.target.value })} /></div>
            <div><label className="label">Issuer / organization</label><input className="field" value={settings.certificateIssuer || ''} onChange={(e)=>onSettings({ certificateIssuer: e.target.value })} /></div>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!settings.leaderboardEnabled} onChange={(e)=>onSettings({ leaderboardEnabled: e.target.checked })} /> Enable leaderboard (based on saved responses)</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!settings.respondentCanViewLeaderboard} onChange={(e)=>onSettings({ respondentCanViewLeaderboard: e.target.checked })} /> Show leaderboard to respondents</label>
        <p className="text-xs muted">Leaderboards and saved response analytics require Supabase-connected published quizzes.</p>
      </section>

      <section className="panel rounded-lg p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">Grade bands</h2><button type="button" className="btn btn-secondary !py-1.5 text-sm" onClick={addBand}><Plus size={14}/> Add band</button></div>
        <p className="text-sm muted">Bands are matched by minimum percent (highest first). Use them to label results like Excellent/Pass/Needs review.</p>
        <div className="space-y-3">
          {bands.map((b) => (
            <div key={b.id} className="rounded-md border border-[var(--line)] p-3 space-y-2 bg-white/40">
              <div className="grid grid-cols-[110px_1fr_auto] gap-2 items-center">
                <div><label className="label !mb-1">Min %</label><input className="field !py-2" type="number" min={0} max={100} value={b.min} onChange={(e)=>updateBand(b.id,{ min: Number(e.target.value) })} /></div>
                <div><label className="label !mb-1">Label</label><input className="field !py-2" value={b.label} onChange={(e)=>updateBand(b.id,{ label: e.target.value })} /></div>
                <button type="button" className="btn btn-ghost !px-2 !py-2 mt-5 text-[var(--signal)]" onClick={()=>removeBand(b.id)} disabled={bands.length<=1}><Trash2 size={14}/></button>
              </div>
              <div><label className="label !mb-1">Description <span className="muted font-normal">(optional)</span></label><input className="field !py-2" value={b.description || ''} onChange={(e)=>updateBand(b.id,{ description: e.target.value })} /></div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ShareTab({ storage, quiz, publicUrl, embedCode, saving, onPublish, onCopied }: { storage: 'supabase' | 'local'; quiz: Quiz; publicUrl: string; embedCode: string; saving: boolean; onPublish: () => void; onCopied: (t:'ok'|'err', m:string)=>void }) {
  async function copy(text: string, ok: string) { try { await navigator.clipboard.writeText(text); onCopied('ok', ok); } catch { onCopied('err', 'Could not copy to clipboard.'); } }
  const isLocalHost = publicUrl.includes('localhost') || publicUrl.includes('127.0.0.1');
  return (
    <div className="grid lg:grid-cols-2 gap-6 items-start">
      <section className="panel rounded-lg p-5 sm:p-6 space-y-4">
        <h2 className="text-xl font-semibold">Publish & share</h2>
        {storage === 'local' ? (
          <div className="space-y-3 text-sm">
            <p className="muted">This is a local demo quiz stored in your browser. To publish a public link and collect responses, recreate or copy it into a Supabase-connected quiz from the dashboard.</p>
            <div className="rounded-md border border-[var(--line)] p-3 bg-white/50"><p className="font-semibold mb-1">Local slug</p><code className="text-xs break-all">{quiz.slug}</code></div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className={`text-sm rounded-md border px-4 py-3 ${quiz.status === 'published' ? 'border-[rgba(15,118,110,0.25)] bg-[rgba(15,118,110,0.08)] text-[var(--ink)]' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
              <p className="font-semibold text-base">{quiz.status === 'published' ? 'Live — your quiz is published' : 'Draft — your quiz is not live yet'}</p>
              <p className="mt-1">{quiz.status === 'published' ? 'Anyone with the public link can open and take this quiz from anywhere. Respondents see the same quiz experience as preview, and their submissions are saved (subject to your access/schedule settings).' : 'Click “Publish quiz” to make it live. Once published, anyone with the public link can take it from anywhere (same respondent experience as preview).'}</p>
              {quiz.status !== 'published' && (
                <button type="button" className="btn btn-primary mt-3" onClick={onPublish} disabled={saving}><Check size={15}/> {saving ? 'Publishing…' : 'Publish quiz'}</button>
              )}
            </div>
            <div>
              <label className="label">Public URL {quiz.status !== 'published' && <span className="muted font-normal">(available after publishing)</span>}</label>
              <div className="flex gap-2"><input className="field font-mono text-xs" readOnly value={publicUrl} /><button type="button" className="btn btn-secondary !px-3" onClick={()=>copy(publicUrl,'Public link copied.')} title="Copy public link"><Copy size={14}/></button></div>
            </div>
            {isLocalHost && (
              <p className="text-sm rounded-md border border-amber-200 bg-amber-50 text-amber-900 px-3 py-2">
                This link points to your local machine, so classmates/others won&apos;t be able to open it. Deploy the app (or host it on a reachable URL), set <code>NEXT_PUBLIC_SITE_URL</code> to that URL, and share the published <code>/q/{quiz.slug}</code> link.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {quiz.status === 'published' ? (
                <a href={`/q/${quiz.slug}`} target="_blank" rel="noreferrer" className="btn btn-primary"><ExternalLink size={15}/> Open live quiz</a>
              ) : (
                <a href={`/q/${quiz.slug}`} target="_blank" rel="noreferrer" className="btn btn-secondary" aria-disabled="true" onClick={(e)=>e.preventDefault()} title="Publish the quiz first to make the public link live"><Play size={15}/> Public link (publish first)</a>
              )}
              <a href={`/q/${quiz.slug}`} target="_blank" rel="noreferrer" className="btn btn-ghost"><Play size={15}/> Open /q link</a>
            </div>
          </div>
        )}
      </section>

      <section className="panel rounded-lg p-5 sm:p-6 space-y-4">
        <h2 className="text-xl font-semibold">Embed & audience tips</h2>
        <div>
          <label className="label">Embed code <span className="muted font-normal">(iframe)</span></label>
          <textarea className="field min-h-[120px] font-mono text-xs" readOnly value={embedCode} />
          <div className="mt-2 flex gap-2"><button type="button" className="btn btn-secondary !py-2 text-sm" onClick={()=>copy(embedCode,'Embed code copied.')}><FileCode2 size={14}/> Copy embed code</button></div>
        </div>
        <div className="text-sm space-y-2 muted">
          <p className="font-semibold text-[var(--ink)]">Audience controls included</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Publish/unpublish, unique share slug, and optional access code.</li>
            <li>Open/close schedule and optional name/email collection.</li>
            <li>Retake, score visibility, answer reveal, and completion messaging.</li>
            <li>Embed on your site or share direct links by email/chat/social.</li>
          </ul>
          <p className="text-xs">For larger audiences on free tiers, monitor Supabase usage and consider enabling anti-spam/captcha at the edge if needed.</p>
        </div>
      </section>
    </div>
  );
}
