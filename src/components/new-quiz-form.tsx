'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, hasSupabaseEnv } from '@/lib/supabase/client';
import { normalizeQuestionForEditor, prepareQuestionForSave } from '@/lib/quiz-helpers';
import { sampleToQuiz } from '@/lib/demo';
import { sampleQuizzes } from '@/lib/sample-quizzes';
import { slugify, uid } from '@/lib/utils';

export function NewQuizForm({ templateSlug }: { templateSlug?: string }) {
  const router = useRouter();
  const template = useMemo(() => (templateSlug ? sampleQuizzes.find((s) => s.slug === templateSlug) || null : null), [templateSlug]);
  const [title, setTitle] = useState(template ? `${template.title} (copy)` : '');
  const [description, setDescription] = useState(template?.description || '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (template) {
      setTitle(`${template.title} (copy)`);
      setDescription(template.description || '');
    }
  }, [template]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!hasSupabaseEnv()) { setError('Supabase is not configured.'); return; }
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const base = slugify(title) || 'quiz';
      const slug = `${base}-${Math.random().toString(36).slice(2, 7)}`;

      let theme: Record<string, unknown> | undefined;
      let settings: Record<string, unknown> | undefined;
      let preparedQuestions: ReturnType<typeof prepareQuestionForSave>[] = [];
      if (template) {
        const { quiz, questions } = sampleToQuiz(template);
        theme = quiz.theme as unknown as Record<string, unknown>;
        settings = quiz.settings as unknown as Record<string, unknown>;
        preparedQuestions = questions.map((q, i) => prepareQuestionForSave(normalizeQuestionForEditor({ ...q, id: uid('q') }, i), i, ''));
      }

      const insertPayload: Record<string, unknown> = {
        owner_id: user.id,
        title: title.trim(),
        description: description.trim(),
        slug,
        status: 'draft',
      };
      if (theme) insertPayload.theme = theme;
      if (settings) insertPayload.settings = settings;

      const { data, error } = await supabase.from('quizzes').insert(insertPayload).select('id').single();
      if (error) throw error;

      if (preparedQuestions.length) {
        const rows = preparedQuestions.map((n, i) => ({
          quiz_id: data.id as string,
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
        }));
        const { error: qErr } = await supabase.from('questions').insert(rows);
        if (qErr) throw qErr;
      }

      router.push(`/dashboard/quizzes/${data.id}/edit`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not create quiz.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="panel rounded-lg p-6 space-y-4">
      {template && (
        <div className="rounded-md border border-[rgba(15,118,110,0.25)] bg-[rgba(15,118,110,0.06)] px-3 py-2 text-sm">
          Starting from template: <strong>{template.title}</strong>. You can edit everything after creation.
        </div>
      )}
      <div>
        <label className="label" htmlFor="title">Quiz title</label>
        <input id="title" className="field" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Workplace Safety Refresher" />
      </div>
      <div>
        <label className="label" htmlFor="desc">Description <span className="muted font-normal">(optional)</span></label>
        <textarea id="desc" className="field min-h-[90px]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this quiz about?" />
      </div>
      {error && <p className="text-sm rounded-md border border-red-200 bg-[var(--bad-bg)] text-[var(--bad)] px-3 py-2">{error}</p>}
      <div className="flex gap-3">
        <button className="btn btn-primary" disabled={loading} type="submit">{loading ? 'Creating…' : (template ? 'Create from template' : 'Create and edit')}</button>
      </div>
    </form>
  );
}
