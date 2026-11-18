import type { Question, Quiz, QuizSettings, QuizTheme } from '@/types/quiz';
import type { SampleQuiz } from '@/lib/sample-quizzes';

type SampleQuestionInput = SampleQuiz['questions'][number] & {
  description?: string;
  imageUrl?: string;
  required?: boolean;
  options?: Question['options'];
  correct?: string[];
  matchPairs?: Question['matchPairs'];
  matchCorrect?: Record<string, string>;
};

export const defaultTheme: QuizTheme = { accent: '#0f766e', paper: '#f3ede2', ink: '#18212b', font: 'editorial', radius: 'soft' };
export const defaultSettings: QuizSettings = {
  mode: 'scored',
  showAnswers: 'after_each',
  passMark: 70,
  shuffleQuestions: false,
  shuffleOptions: false,
  collectName: false,
  collectEmail: false,
  requireName: false,
  requireEmail: false,
  oneQuestionPerPage: true,
  showProgressBar: true,
  allowRetake: true,
  showScore: true,
  timeLimitMinutes: null,
  accessCode: '',
  opensAt: null,
  closesAt: null,
  welcomeMessage: '',
  successMessage: '',
  redirectUrl: '',
  certificateEnabled: false,
  certificateTitle: 'Certificate of Completion',
  certificateIssuer: '',
  gradeBands: [
    { id: 'band_a', min: 80, label: 'Excellent', description: 'Strong understanding of the material.' },
    { id: 'band_b', min: 60, label: 'Good', description: 'Solid grasp with room to improve.' },
    { id: 'band_c', min: 0, label: 'Keep practicing', description: 'Review the explanations and try again.' },
  ],
  leaderboardEnabled: false,
  respondentCanViewLeaderboard: false,
};

export function mergeSettings(settings?: Partial<QuizSettings> | null): QuizSettings {
  return { ...defaultSettings, ...(settings || {}), gradeBands: (settings?.gradeBands && settings.gradeBands.length ? settings.gradeBands : defaultSettings.gradeBands) };
}

export function mergeTheme(theme?: Partial<QuizTheme> | null): QuizTheme {
  return { ...defaultTheme, ...(theme || {}) };
}

export function sampleToQuiz(sample: SampleQuiz): { quiz: Quiz; questions: Question[] } {
  const quizId = `demo_${sample.slug}`;
  const questions: Question[] = sample.questions.map((q, i) => {
    const sq = q as SampleQuestionInput;
    return {
      id: `${quizId}_q${i + 1}`,
      quiz_id: quizId,
      type: q.type,
      prompt: q.prompt,
      description: sq.description || '',
      imageUrl: sq.imageUrl || '',
      required: sq.required ?? true,
      options: Array.isArray(sq.options) ? sq.options : [],
      correct: Array.isArray(sq.correct) ? sq.correct : [],
      matchPairs: Array.isArray(sq.matchPairs) ? sq.matchPairs : [],
      matchCorrect: sq.matchCorrect || {},
      points: q.points ?? (q.type === 'long_text' ? 0 : 1),
      explanation: q.explanation || '',
      position: q.position ?? i,
    };
  });
  const quiz: Quiz = {
    id: quizId,
    owner_id: 'demo',
    title: sample.title,
    description: sample.description,
    slug: sample.slug,
    status: 'published',
    theme: mergeTheme(sample.theme),
    settings: mergeSettings(sample.settings),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  return { quiz, questions };
}
