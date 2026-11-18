import { mergeSettings, mergeTheme } from '@/lib/demo';
import { uid } from '@/lib/utils';
import type { GradeBand, MatchPair, Option, Question, QuestionType, Quiz, QuizSettings } from '@/types/quiz';

type QuestionInput = Question & {
  image_url?: string;
  match_pairs?: MatchPair[];
  match_correct?: Record<string, string>;
  options?: Array<Partial<Option> & { id?: string; text?: string }>;
};

export const questionTypeLabels: Record<QuestionType, string> = {
  multiple_choice: 'Multiple choice',
  multi_select: 'Multi-select',
  true_false: 'True / False',
  dropdown: 'Dropdown',
  short_text: 'Short answer',
  long_text: 'Long answer',
  number: 'Number',
  ranking: 'Ranking',
  matching: 'Matching',
  section: 'Section / heading',
};

export const questionTypeHelp: Partial<Record<QuestionType, string>> = {
  multiple_choice: 'Choose one correct option.',
  multi_select: 'Choose all correct options.',
  true_false: 'Simple true or false answer.',
  dropdown: 'Pick one answer from a list.',
  short_text: 'Accept written answers. Case-insensitive by default; use =Answer for exact case-sensitive match, or *keyword* to accept if the response contains that keyword.',
  long_text: 'Collect an open-ended response. Leave keywords empty for manual/not auto-graded, or add keywords to auto-check that the response includes them all.',
  number: 'Accept exact numbers or ranges (use min:max, e.g. 10:20).',
  ranking: 'Put items in the correct order.',
  matching: 'Match items on the left with items on the right.',
  section: 'Display a heading/description to organize your quiz (not a question).',
};

export function defaultOptions(type: QuestionType): Option[] {
  if (type === 'true_false') return [{ id: 'true', text: 'True' }, { id: 'false', text: 'False' }];
  if (type === 'multiple_choice' || type === 'multi_select' || type === 'dropdown') {
    return [{ id: uid('o'), text: '' }, { id: uid('o'), text: '' }];
  }
  if (type === 'ranking') {
    return [{ id: uid('o'), text: '' }, { id: uid('o'), text: '' }, { id: uid('o'), text: '' }];
  }
  return [];
}

export function blankQuestion(type: QuestionType, position: number, quizId = ''): Question {
  const base: Question = {
    id: uid('q'),
    quiz_id: quizId,
    type,
    prompt: '',
    description: '',
    imageUrl: '',
    required: type === 'section' ? false : true,
    options: defaultOptions(type),
    correct: [],
    matchPairs: type === 'matching' ? [
      { id: uid('p'), left: '', right: '' },
      { id: uid('p'), left: '', right: '' },
    ] : [],
    matchCorrect: {},
    points: type === 'long_text' || type === 'section' ? 0 : 1,
    explanation: '',
    position,
  };
  if (type === 'short_text' || type === 'number') base.correct = [''];
  if (type === 'ranking') base.correct = base.options.map((o) => o.id);
  if (type === 'matching') base.matchCorrect = Object.fromEntries((base.matchPairs || []).map((p) => [p.id, p.id]));
  return base;
}

export function normalizeQuestionForEditor(q: QuestionInput, i: number): Question {
  const type = q.type;
  const nq: Question = {
    ...q,
    id: q.id,
    quiz_id: q.quiz_id,
    type,
    prompt: q.prompt || '',
    description: q.description || '',
    imageUrl: q.imageUrl || q.image_url || '',
    required: type === 'section' ? false : (q.required ?? true),
    options: Array.isArray(q.options) ? q.options.map((o) => ({ id: o.id || uid('o'), text: String(o.text || ''), imageUrl: o.imageUrl || '' })) : defaultOptions(type),
    correct: Array.isArray(q.correct) ? q.correct.map(String) : [],
    matchPairs: Array.isArray(q.matchPairs) ? q.matchPairs : (Array.isArray(q.match_pairs) ? q.match_pairs : []),
    matchCorrect: q.matchCorrect || q.match_correct || {},
    points: Number.isFinite(Number(q.points)) ? Number(q.points) : (type === 'long_text' || type === 'section' ? 0 : 1),
    explanation: q.explanation || '',
    position: Number.isFinite(Number(q.position)) ? Number(q.position) : i,
  };
  if ((type === 'multiple_choice' || type === 'multi_select' || type === 'dropdown' || type === 'ranking') && nq.options.length < 2) {
    nq.options = [...nq.options, ...defaultOptions(type)].slice(0, Math.max(2, nq.options.length || 2));
  }
  if (type === 'true_false') nq.options = [{ id: 'true', text: 'True' }, { id: 'false', text: 'False' }];
  if ((type === 'short_text' || type === 'number') && nq.correct.length === 0) nq.correct = [''];
  if (type === 'ranking' && nq.correct.length === 0) nq.correct = nq.options.map((o) => o.id);
  if (type === 'matching') {
    const pairs = (nq.matchPairs || []) as MatchPair[];
    nq.matchPairs = pairs.length >= 2 ? pairs : (blankQuestion('matching', i).matchPairs || []);
    nq.matchCorrect = nq.matchCorrect && Object.keys(nq.matchCorrect).length ? nq.matchCorrect : Object.fromEntries((nq.matchPairs || []).map((p) => [p.id, p.id]));
  }
  if (type === 'section') {
    nq.required = false;
    nq.points = 0;
    nq.correct = [];
    nq.options = [];
    nq.matchPairs = [];
    nq.matchCorrect = {};
  }
  return nq;
}

export function prepareQuestionForSave(q: Question, i: number, quizId: string): Question {
  const nq = normalizeQuestionForEditor({ ...q, position: i }, i);
  const prompt = nq.prompt.trim();
  if (!prompt) throw new Error(`${nq.type === 'section' ? 'Section' : 'Question'} ${i + 1} needs a ${nq.type === 'section' ? 'heading/title' : 'prompt'}.`);
  const base: Question = {
    ...nq,
    id: q.id,
    quiz_id: quizId,
    prompt,
    description: (nq.description || '').trim(),
    imageUrl: (nq.imageUrl || '').trim(),
    required: nq.type === 'section' ? false : nq.required !== false,
    explanation: (nq.explanation || '').trim(),
    points: nq.type === 'long_text' || nq.type === 'section' ? Number(nq.points || 0) : Number(nq.points || 0),
    position: i,
    options: [],
    correct: [],
    matchPairs: [],
    matchCorrect: {},
  };

  if (nq.type === 'section') {
    return { ...base, required: false, points: 0, correct: [], options: [], matchPairs: [], matchCorrect: {}, explanation: base.explanation };
  }

  if (nq.type === 'multiple_choice' || nq.type === 'multi_select' || nq.type === 'dropdown') {
    const opts = nq.options.map((o) => ({ id: o.id, text: o.text.trim() })).filter((o) => o.text);
    if (opts.length < 2) throw new Error(`Question ${i + 1} needs at least 2 options.`);
    const validIds = new Set(opts.map((o) => o.id));
    const correct = nq.correct.filter((c) => validIds.has(c));
    if (nq.type === 'multi_select') {
      if (!correct.length) throw new Error(`Question ${i + 1} needs at least one correct option.`);
    } else {
      if (correct.length !== 1) throw new Error(`Question ${i + 1} needs exactly one correct option.`);
    }
    return { ...base, options: opts, correct };
  }

  if (nq.type === 'true_false') {
    const correct = nq.correct.filter((c) => c === 'true' || c === 'false');
    if (correct.length !== 1) throw new Error(`Question ${i + 1} needs a correct answer.`);
    return { ...base, options: [{ id: 'true', text: 'True' }, { id: 'false', text: 'False' }], correct };
  }

  if (nq.type === 'short_text' || nq.type === 'number') {
    const correct = nq.correct.map((c) => String(c).trim()).filter(Boolean);
    if (!correct.length) throw new Error(`Question ${i + 1} needs at least one accepted answer${nq.type === 'number' ? ' or range' : ''}.`);
    return { ...base, correct };
  }

  if (nq.type === 'long_text') {
    const correct = nq.correct.map((c) => String(c).trim()).filter(Boolean);
    return { ...base, correct, points: Number(nq.points || 0) };
  }

  if (nq.type === 'ranking') {
    const opts = nq.options.map((o) => ({ id: o.id, text: o.text.trim() })).filter((o) => o.text);
    if (opts.length < 2) throw new Error(`Question ${i + 1} needs at least 2 items to rank.`);
    const ids = opts.map((o) => o.id);
    const set = new Set(ids);
    let correct = nq.correct.filter((id) => set.has(id));
    if (correct.length !== ids.length) correct = ids; // fallback to current listed order
    return { ...base, options: opts, correct };
  }

  if (nq.type === 'matching') {
    const pairs = (nq.matchPairs || []).map((p) => ({ id: p.id, left: String(p.left || '').trim(), right: String(p.right || '').trim() })).filter((p) => p.left || p.right);
    const complete = pairs.filter((p) => p.left && p.right);
    if (complete.length < 2) throw new Error(`Question ${i + 1} needs at least 2 complete matching pairs.`);
    const matchCorrect: Record<string, string> = {};
    for (const p of complete) matchCorrect[p.id] = p.id;
    return { ...base, matchPairs: complete, matchCorrect, correct: [] };
  }

  return base;
}

export function ensureQuizDefaults(quiz: Quiz): Quiz {
  return { ...quiz, theme: mergeTheme(quiz.theme), settings: mergeSettings(quiz.settings) };
}

export function defaultGradeBands(): GradeBand[] {
  return [
    { id: uid('band'), min: 80, label: 'Excellent', description: 'Strong understanding of the material.' },
    { id: uid('band'), min: 60, label: 'Good', description: 'Solid grasp with room to improve.' },
    { id: uid('band'), min: 0, label: 'Keep practicing', description: 'Review the explanations and try again.' },
  ];
}

export function normalizeSettings(settings?: Partial<QuizSettings> | null): QuizSettings {
  return mergeSettings(settings);
}
