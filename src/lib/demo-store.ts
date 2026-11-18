import { defaultSettings, defaultTheme, mergeSettings, mergeTheme } from '@/lib/demo';
import type { Question, Quiz } from '@/types/quiz';
import { slugify, uid } from '@/lib/utils';

const KEY = 'quizcraft_demo_v2';

export type DemoQuiz = Quiz & { questions: Question[] };

type Store = { quizzes: Record<string, DemoQuiz> };

type LegacyQuestion = Partial<Question> & {
  description?: string;
  imageUrl?: string;
  image_url?: string;
  required?: boolean;
  matchPairs?: Question['matchPairs'];
  match_pairs?: Question['matchPairs'];
  matchCorrect?: Record<string, string>;
  match_correct?: Record<string, string>;
};

function read(): Store {
  if (typeof window === 'undefined') return { quizzes: {} };
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem('quizcraft_demo_v1');
    if (!raw) return { quizzes: {} };
    const parsed = JSON.parse(raw) as Store;
    if (!parsed || typeof parsed !== 'object' || !parsed.quizzes) return { quizzes: {} };
    const migrated: Store = { quizzes: {} };
    for (const [id, q] of Object.entries(parsed.quizzes)) {
      migrated.quizzes[id] = {
        ...q,
        theme: mergeTheme(q.theme),
        settings: mergeSettings(q.settings),
        questions: (q.questions || []).map((qq, i) => {
          const lq = qq as LegacyQuestion;
          return {
            ...qq,
            description: lq.description || '',
            imageUrl: lq.imageUrl || lq.image_url || '',
            required: lq.required ?? true,
            options: Array.isArray(qq.options) ? qq.options : [],
            correct: Array.isArray(qq.correct) ? qq.correct : [],
            matchPairs: lq.matchPairs || lq.match_pairs || [],
            matchCorrect: lq.matchCorrect || lq.match_correct || {},
            points: Number(qq.points ?? 1),
            explanation: qq.explanation || '',
            position: Number(qq.position ?? i),
          } as Question;
        }),
      } as DemoQuiz;
    }
    return migrated;
  } catch {
    return { quizzes: {} };
  }
}

function write(store: Store) {
  localStorage.setItem(KEY, JSON.stringify(store));
}

export function listDemoQuizzes(): DemoQuiz[] {
  const store = read();
  return Object.values(store.quizzes).sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
}

export function getDemoQuiz(id: string): DemoQuiz | null {
  const store = read();
  return store.quizzes[id] || null;
}

export function saveDemoQuiz(quiz: DemoQuiz): DemoQuiz {
  const store = read();
  const next = { ...quiz, updated_at: new Date().toISOString(), theme: mergeTheme(quiz.theme), settings: mergeSettings(quiz.settings) };
  store.quizzes[next.id] = next;
  write(store);
  return next;
}

export function deleteDemoQuiz(id: string) {
  const store = read();
  delete store.quizzes[id];
  write(store);
}

export function createDemoQuiz(title: string, description: string): DemoQuiz {
  const id = uid('local');
  const base = slugify(title) || 'quiz';
  const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const quiz: DemoQuiz = {
    id,
    owner_id: 'local',
    title: title.trim() || 'Untitled quiz',
    description: (description || '').trim(),
    slug,
    status: 'draft',
    theme: { ...defaultTheme },
    settings: { ...defaultSettings },
    created_at: now,
    updated_at: now,
    questions: [],
  };
  return saveDemoQuiz(quiz);
}
