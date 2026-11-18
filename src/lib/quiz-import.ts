import * as XLSX from 'xlsx';
import { blankQuestion, questionTypeLabels } from '@/lib/quiz-helpers';
import { uid } from '@/lib/utils';
import type { Question, QuestionType } from '@/types/quiz';

type ParsedRow = Record<string, unknown>;

const TYPE_ALIASES: Record<string, QuestionType> = {
  multiple_choice: 'multiple_choice',
  mcq: 'multiple_choice',
  single: 'multiple_choice',
  single_choice: 'multiple_choice',
  multi_select: 'multi_select',
  multiselect: 'multi_select',
  checkbox: 'multi_select',
  multiple_answers: 'multi_select',
  true_false: 'true_false',
  truefalse: 'true_false',
  boolean: 'true_false',
  dropdown: 'dropdown',
  select: 'dropdown',
  short_text: 'short_text',
  short_answer: 'short_text',
  short: 'short_text',
  text: 'short_text',
  long_text: 'long_text',
  long_answer: 'long_text',
  paragraph: 'long_text',
  essay: 'long_text',
  number: 'number',
  numeric: 'number',
  ranking: 'ranking',
  rank: 'ranking',
  order: 'ranking',
  matching: 'matching',
  match: 'matching',
  pairs: 'matching',
  section: 'section',
  heading: 'section',
  header: 'section',
};

function get(row: ParsedRow, ...keys: string[]) {
  for (const k of keys) {
    const v = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()] ?? row[k.replace(/\s+/g, '_')];
    if (v !== undefined && v !== null) return String(v);
  }
  // try normalized lookup
  const norm: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) norm[k.trim().toLowerCase().replace(/[\s-]+/g, '_')] = v == null ? '' : String(v);
  for (const k of keys) {
    const nk = k.trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (norm[nk] !== undefined) return norm[nk];
  }
  return '';
}

function parseBool(v: string, d = true) {
  const s = v.trim().toLowerCase();
  if (!s) return d;
  if (['true','yes','y','1','required'].includes(s)) return true;
  if (['false','no','n','0','optional'].includes(s)) return false;
  return d;
}

function parseType(raw: string): QuestionType {
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!key) return 'multiple_choice';
  return TYPE_ALIASES[key] || 'multiple_choice';
}

function splitList(raw: string) {
  const s = raw.trim();
  if (!s) return [] as string[];
  if (s.includes('|')) return s.split('|').map(x => x.trim()).filter(Boolean);
  if (s.includes('\n')) return s.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  if (s.includes(';')) return s.split(';').map(x => x.trim()).filter(Boolean);
  // keep commas inside ranges like 10:20? ranges use : so comma split is fine for options
  return s.split(',').map(x => x.trim()).filter(Boolean);
}

function splitPairs(raw: string) {
  const items = splitList(raw);
  return items.map((item) => {
    const idx = item.includes('=>') ? item.indexOf('=>') : item.includes('=') ? item.indexOf('=') : item.includes(':') ? item.indexOf(':') : -1;
    if (idx < 0) return { left: item.trim(), right: '' };
    const sep = item.includes('=>') ? '=>' : item.includes('=') ? '=' : ':';
    const [l, ...rest] = item.split(sep);
    return { left: (l || '').trim(), right: rest.join(sep).trim() };
  }).filter(p => p.left || p.right);
}

export function questionsFromWorkbookRows(rows: ParsedRow[], quizId = ''): { questions: Question[]; warnings: string[] } {
  const questions: Question[] = [];
  const warnings: string[] = [];
  rows.forEach((row, i) => {
    const prompt = get(row, 'prompt', 'question', 'title', 'text', 'heading').trim();
    if (!prompt) return; // skip empty rows
    const type = parseType(get(row, 'type', 'question_type', 'kind'));
    const q = blankQuestion(type, questions.length, quizId);
    q.prompt = prompt;
    q.description = get(row, 'description', 'help', 'hint', 'subtitle').trim();
    q.imageUrl = get(row, 'image', 'image_url', 'imageurl').trim();
    q.explanation = get(row, 'explanation', 'feedback', 'rationale').trim();
    q.required = type === 'section' ? false : parseBool(get(row, 'required'), true);
    const pts = Number(get(row, 'points', 'score'));
    q.points = Number.isFinite(pts) ? pts : (type === 'long_text' || type === 'section' ? 0 : 1);

    if (type === 'section') {
      q.required = false; q.points = 0; q.options = []; q.correct = []; q.matchPairs = []; q.matchCorrect = {};
      questions.push(q);
      return;
    }

    if (['multiple_choice', 'multi_select', 'dropdown', 'ranking', 'true_false'].includes(type)) {
      const optRaw = get(row, 'options', 'choices', 'items', 'answers');
      const opts = splitList(optRaw);
      if (type !== 'true_false' && opts.length) {
        q.options = opts.map((text, idx) => ({ id: `o${idx + 1}_${uid('').slice(0,4)}`, text }));
      }
      if (type === 'true_false') {
        q.options = [{ id: 'true', text: 'True' }, { id: 'false', text: 'False' }];
      }
      const corrRaw = get(row, 'correct', 'correct_answer', 'answer', 'correct_answers', 'key');
      const corrList = splitList(corrRaw);
      if (type === 'ranking') {
        if (corrList.length) {
          // allow specifying correct order by text
          const byText = new Map(q.options.map(o => [o.text.trim().toLowerCase(), o.id]));
          const orderedIds = corrList.map(c => byText.get(c.trim().toLowerCase()) || q.options.find(o => o.id === c)?.id).filter(Boolean) as string[];
          if (orderedIds.length === q.options.length) {
            // reorder options to correct order for editor convenience
            const map = new Map(q.options.map(o => [o.id, o]));
            q.options = orderedIds.map(id => map.get(id)!).filter(Boolean);
          }
        }
        q.correct = q.options.map(o => o.id);
      } else if (type === 'multi_select') {
        const byText = new Map(q.options.map(o => [o.text.trim().toLowerCase(), o.id]));
        q.correct = corrList.map(c => byText.get(c.trim().toLowerCase()) || (q.options.some(o => o.id === c) ? c : '')).filter(Boolean) as string[];
        if (!q.correct.length && q.options.length) warnings.push(`Row ${i + 2}: no matching correct options found for multi-select question.`);
      } else if (type === 'true_false') {
        const v = corrRaw.trim().toLowerCase();
        q.correct = [v.startsWith('t') || v === '1' || v === 'yes' ? 'true' : 'false'];
      } else {
        const byText = new Map(q.options.map(o => [o.text.trim().toLowerCase(), o.id]));
        const c = corrList[0] || corrRaw.trim();
        const id = byText.get(c.trim().toLowerCase()) || (q.options.some(o => o.id === c) ? c : q.options[0]?.id || '');
        q.correct = id ? [id] : [];
      }
    } else if (type === 'short_text' || type === 'long_text' || type === 'number') {
      const corrRaw = get(row, 'correct', 'correct_answer', 'answer', 'accepted', 'accepted_answers', 'keywords', 'keyword');
      const list = splitList(corrRaw);
      q.correct = list.length ? list : (corrRaw.trim() ? [corrRaw.trim()] : []);
      if (type === 'long_text' && !q.correct.length) q.points = Number.isFinite(pts) ? pts : 0;
    } else if (type === 'matching') {
      const pairsRaw = get(row, 'pairs', 'matching_pairs', 'options', 'correct', 'answer');
      const pairs = splitPairs(pairsRaw);
      if (pairs.length >= 2) {
        q.matchPairs = pairs.map((p, idx) => ({ id: `p${idx + 1}_${uid('').slice(0,4)}`, left: p.left, right: p.right }));
        q.matchCorrect = Object.fromEntries(q.matchPairs.map(p => [p.id, p.id]));
      }
      q.options = [];
      q.correct = [];
    }

    questions.push(q);
  });
  return { questions, warnings };
}

export async function parseQuestionsFromFile(file: File): Promise<{ questions: Question[]; warnings: string[]; sheetName?: string }> {
  const name = file.name.toLowerCase();
  let rows: ParsedRow[] = [];
  let sheetName: string | undefined;
  if (name.endsWith('.csv')) {
    const text = await file.text();
    const wb = XLSX.read(text, { type: 'string' });
    sheetName = wb.SheetNames[0];
    rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' }) as ParsedRow[];
  } else {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    sheetName = wb.SheetNames[0];
    rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' }) as ParsedRow[];
  }
  const res = questionsFromWorkbookRows(rows);
  return { ...res, sheetName };
}

export function downloadImportTemplate() {
  const headers = ['type','prompt','description','options','correct','points','required','explanation','pairs','image'];
  const sampleRows = [
    { type: 'multiple_choice', prompt: 'What is 2 + 2?', description: '', options: '3 | 4 | 5', correct: '4', points: 1, required: 'true', explanation: '2 + 2 equals 4.', pairs: '', image: '' },
    { type: 'multi_select', prompt: 'Select prime numbers', description: '', options: '2 | 3 | 4 | 5', correct: '2 | 3 | 5', points: 2, required: 'true', explanation: '', pairs: '', image: '' },
    { type: 'true_false', prompt: 'The sky is blue.', description: '', options: '', correct: 'true', points: 1, required: 'true', explanation: '', pairs: '', image: '' },
    { type: 'short_text', prompt: 'Capital of France?', description: 'Use =Paris for exact case, or *pari* for keyword', options: '', correct: 'Paris | *paris*', points: 1, required: 'true', explanation: '', pairs: '', image: '' },
    { type: 'long_text', prompt: 'Describe photosynthesis.', description: 'Optional keywords: all must appear to auto-check', options: '', correct: 'sunlight | chlorophyll', points: 0, required: 'true', explanation: '', pairs: '', image: '' },
    { type: 'number', prompt: 'How many days in a leap year?', description: '', options: '', correct: '366', points: 1, required: 'true', explanation: '', pairs: '', image: '' },
    { type: 'dropdown', prompt: 'Pick a color', description: '', options: 'Red | Green | Blue', correct: 'Blue', points: 1, required: 'true', explanation: '', pairs: '', image: '' },
    { type: 'ranking', prompt: 'Rank small to large', description: '', options: 'One | Two | Three', correct: 'One | Two | Three', points: 1, required: 'true', explanation: 'Order defines correct ranking.', pairs: '', image: '' },
    { type: 'matching', prompt: 'Match animals to sounds', description: '', options: '', correct: '', points: 2, required: 'true', explanation: '', pairs: 'Dog=Bark | Cat=Meow', image: '' },
    { type: 'section', prompt: 'Section: Science basics', description: 'Answer the following questions.', options: '', correct: '', points: 0, required: 'false', explanation: '', pairs: '', image: '' },
  ];
  const ws = XLSX.utils.json_to_sheet(sampleRows, { header: headers });
  const help = [
    ['QuizCraft import template'],
    ['Columns: type, prompt, description, options, correct, points, required, explanation, pairs, image'],
    ['Types: ' + (Object.keys(questionTypeLabels) as QuestionType[]).join(', ')],
    ['options: separate with | (for choice/ranking/dropdown). true_false can leave options empty.'],
    ['correct: for choices use option text or leave to manual fix; multi_select separate with |; short_text supports =ExactCase and *keyword*; long_text can list keywords (all required) for auto-check; number supports ranges like 10:20.'],
    ['pairs: for matching use Left=Right separated by | (or Left:Right).'],
    ['section: creates a heading/description block (not a question).'],
  ];
  const wsHelp = XLSX.utils.aoa_to_sheet(help);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Questions');
  XLSX.utils.book_append_sheet(wb, wsHelp, 'Help');
  XLSX.writeFile(wb, 'quizcraft-import-template.xlsx');
}