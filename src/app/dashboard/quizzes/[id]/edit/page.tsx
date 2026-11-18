import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { QuizEditor } from '@/components/quiz-editor';
import type { Question, Quiz } from '@/types/quiz';

export const dynamic = 'force-dynamic';

type DbQuestion = {
  id: string;
  quiz_id: string;
  type: Question['type'];
  prompt: string;
  description?: string | null;
  image_url?: string | null;
  imageUrl?: string | null;
  required?: boolean | null;
  options?: Question['options'];
  correct?: string[];
  match_pairs?: Question['matchPairs'];
  matchPairs?: Question['matchPairs'];
  match_correct?: Record<string, string>;
  matchCorrect?: Record<string, string>;
  points?: number | string | null;
  explanation?: string | null;
  position?: number | null;
};

function mapQuestion(row: DbQuestion): Question {
  return {
    id: row.id,
    quiz_id: row.quiz_id,
    type: row.type,
    prompt: row.prompt || '',
    description: row.description || '',
    imageUrl: row.image_url || row.imageUrl || '',
    required: row.required !== false,
    options: Array.isArray(row.options) ? row.options : [],
    correct: Array.isArray(row.correct) ? row.correct : [],
    matchPairs: Array.isArray(row.match_pairs) ? row.match_pairs : Array.isArray(row.matchPairs) ? row.matchPairs : [],
    matchCorrect: row.match_correct || row.matchCorrect || {},
    points: Number(row.points ?? 0),
    explanation: row.explanation || '',
    position: Number(row.position ?? 0),
  } as Question;
}

export default async function EditQuizPage({ params }: { params: { id: string } }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) redirect('/dashboard');
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/dashboard/quizzes/${params.id}/edit`);

  const { data: quiz } = await supabase.from('quizzes').select('*').eq('id', params.id).eq('owner_id', user.id).single();
  if (!quiz) notFound();
  const { data: questions } = await supabase.from('questions').select('*').eq('quiz_id', params.id).order('position', { ascending: true });

  return (
    <div className="container-page py-8 sm:py-10">
      <QuizEditor quiz={quiz as Quiz} initialQuestions={(questions || []).map(mapQuestion)} />
    </div>
  );
}
