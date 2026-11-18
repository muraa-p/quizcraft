import { matchesAcceptedAnswer, textContainsKeywords } from './utils';
import type { AnswerValue, GradeBand, Question, QuizSettings } from '@/types/quiz';

export type QuestionScore = { ok: boolean | null; earned: number; possible: number; feedback?: string };

function isBlank(answer: AnswerValue) {
  if (answer == null) return true;
  if (typeof answer === 'string') return answer.trim() === '';
  if (Array.isArray(answer)) return answer.length === 0;
  if (typeof answer === 'number') return Number.isNaN(answer);
  if (typeof answer === 'object') return Object.keys(answer).length === 0;
  return false;
}

function sameArray(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const aa = [...a];
  const bb = [...b];
  return aa.every((v, i) => v === bb[i]);
}

export function scoreQuestion(q: Question, answer: AnswerValue): QuestionScore {
  const possible = Number.isFinite(q.points) ? Number(q.points) : 1;

  if (q.type === 'section') {
    return { ok: null, earned: 0, possible: 0, feedback: '' };
  }

  if (q.type === 'long_text') {
    const keys = (q.correct || []).map((c) => String(c).trim()).filter(Boolean);
    if (!keys.length) {
      const ok = isBlank(answer) ? false : null;
      return { ok, earned: 0, possible, feedback: isBlank(answer) ? 'No answer provided.' : 'Response recorded (not auto-graded).' };
    }
    if (isBlank(answer)) {
      return { ok: false, earned: 0, possible, feedback: 'No answer provided.' };
    }
    const ok = textContainsKeywords(String(answer ?? ''), keys) === true;
    return { ok, earned: ok ? possible : 0, possible, feedback: ok ? 'Required keywords found.' : 'Response did not include all required keywords.' };
  }

  if (q.type === 'short_text') {
    const given = String(answer ?? '');
    const accepted = (q.correct || []).map((c) => String(c)).filter((c) => c.trim());
    const ok = accepted.length ? accepted.some((a) => matchesAcceptedAnswer(given, a)) : false;
    return { ok, earned: ok ? possible : 0, possible };
  }

  if (q.type === 'number') {
    const given = String(answer ?? '').trim();
    const accepted = (q.correct || []).map((c) => String(c).trim()).filter(Boolean);
    if (!accepted.length) return { ok: false, earned: 0, possible };
    const ok = accepted.some((a) => {
      if (a.includes(':')) {
        const [minS, maxS] = a.split(':');
        const min = Number(minS); const max = Number(maxS);
        const n = Number(given);
        return !Number.isNaN(n) && !Number.isNaN(min) && !Number.isNaN(max) && n >= min && n <= max;
      }
      return given === a || Number(given) === Number(a);
    });
    return { ok, earned: ok ? possible : 0, possible };
  }

  if (q.type === 'multi_select') {
    const given = Array.isArray(answer) ? [...answer].map(String).sort() : [];
    const correct = [...(q.correct || [])].map(String).sort();
    const ok = sameArray(given, correct);
    return { ok, earned: ok ? possible : 0, possible };
  }

  if (q.type === 'ranking') {
    const given = Array.isArray(answer) ? [...answer].map(String) : [];
    const correct = [...(q.correct || [])].map(String);
    const ok = correct.length > 0 && sameArray(given, correct);
    return { ok, earned: ok ? possible : 0, possible };
  }

  if (q.type === 'matching') {
    const given = answer && typeof answer === 'object' && !Array.isArray(answer) ? (answer as Record<string, string>) : {};
    const correct = q.matchCorrect || {};
    const keys = Object.keys(correct);
    if (!keys.length) return { ok: false, earned: 0, possible };
    const ok = keys.every((k) => String(given[k] || '') === String(correct[k]));
    return { ok, earned: ok ? possible : 0, possible };
  }

  // multiple_choice, true_false, dropdown
  const given = Array.isArray(answer) ? String(answer[0] ?? '') : String(answer ?? '');
  const ok = Boolean(given) && (q.correct || []).map(String).includes(given);
  return { ok, earned: ok ? possible : 0, possible };
}

export function scoreQuiz(questions: Question[], answers: Record<string, AnswerValue>) {
  let score = 0;
  let total = 0;
  const detail: Record<string, QuestionScore> = {};
  for (const q of questions) {
    const r = scoreQuestion(q, answers[q.id]);
    detail[q.id] = r;
    score += r.earned;
    total += r.possible;
  }
  const percent = total ? Math.round((score / total) * 100) : 0;
  return { score, total, percent, detail };
}

export function getGradeLabel(percent: number, bands?: GradeBand[]) {
  if (!bands || !bands.length) return null;
  const sorted = [...bands].sort((a, b) => b.min - a.min);
  return sorted.find((b) => percent >= b.min) || sorted[sorted.length - 1] || null;
}

export function isQuizOpen(settings?: QuizSettings) {
  const now = Date.now();
  if (settings?.opensAt) {
    const t = Date.parse(settings.opensAt);
    if (!Number.isNaN(t) && now < t) return { open: false, reason: 'This quiz is not open yet.' };
  }
  if (settings?.closesAt) {
    const t = Date.parse(settings.closesAt);
    if (!Number.isNaN(t) && now > t) return { open: false, reason: 'This quiz is closed.' };
  }
  return { open: true as const, reason: '' };
}
