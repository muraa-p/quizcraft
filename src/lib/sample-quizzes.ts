import type { Question, QuizSettings, QuizTheme } from '@/types/quiz';

export type SampleQuiz = {
  slug: string;
  title: string;
  description: string;
  category: string;
  theme?: Partial<QuizTheme>;
  settings?: Partial<QuizSettings>;
  questions: Array<Pick<Question, 'type' | 'prompt' | 'options' | 'correct' | 'points' | 'explanation' | 'position'> & Partial<Question>>;
};

export const sampleQuizzes: SampleQuiz[] = [
  {
    slug: 'general-knowledge-starter',
    title: 'General Knowledge Starter',
    description: 'A short warm-up covering everyday facts with mixed question types.',
    category: 'Trivia',
    settings: { oneQuestionPerPage: true, showAnswers: 'after_each', passMark: 70, leaderboardEnabled: true, respondentCanViewLeaderboard: true },
    questions: [
      { type: 'multiple_choice', prompt: 'Which planet is known as the Red Planet?', options: [{id:'a',text:'Venus'},{id:'b',text:'Mars'},{id:'c',text:'Jupiter'},{id:'d',text:'Mercury'}], correct: ['b'], points: 1, explanation: 'Mars appears red because of iron oxide on its surface.', position: 0 },
      { type: 'dropdown', prompt: 'Select the largest ocean on Earth.', options: [{id:'atl',text:'Atlantic Ocean'},{id:'pac',text:'Pacific Ocean'},{id:'ind',text:'Indian Ocean'},{id:'arc',text:'Arctic Ocean'}], correct: ['pac'], points: 1, explanation: 'The Pacific Ocean covers more area than all land combined.', position: 1 },
      { type: 'true_false', prompt: 'The chemical symbol for water is H2O.', options: [{id:'true',text:'True'},{id:'false',text:'False'}], correct: ['true'], points: 1, explanation: 'Water has two hydrogen atoms and one oxygen atom.', position: 2 },
      { type: 'number', prompt: 'How many continents are commonly taught in the seven-continent model?', options: [], correct: ['7'], points: 1, explanation: 'The common model includes seven continents.', position: 3 },
      { type: 'short_text', prompt: 'Name the language with the most native speakers worldwide.', options: [], correct: ['mandarin', 'mandarin chinese', 'chinese'], points: 1, explanation: 'Mandarin Chinese has the largest number of native speakers.', position: 4 },
    ],
  },
  {
    slug: 'workplace-safety-check',
    title: 'Workplace Safety Check',
    description: 'A practical refresher with multi-select, ranking, and matching.',
    category: 'Training',
    settings: { oneQuestionPerPage: true, showAnswers: 'at_end', passMark: 80, collectName: true, certificateEnabled: true, certificateTitle: 'Safety Refresher Completion' },
    questions: [
      { type: 'multiple_choice', prompt: 'You notice a small spill in a hallway. What should you do first?', options: [{id:'a',text:'Ignore it if it looks small'},{id:'b',text:'Warn others and secure the area'},{id:'c',text:'Wait for someone else to report it'},{id:'d',text:'Cover it with paper'}], correct: ['b'], points: 1, explanation: 'Preventing slips comes first: warn people and secure or mark the area.', position: 0 },
      { type: 'multi_select', prompt: 'Which are good password practices? Select all that apply.', options: [{id:'a',text:'Use a unique password per account'},{id:'b',text:'Share passwords with teammates for convenience'},{id:'c',text:'Enable multi-factor authentication when available'},{id:'d',text:'Write passwords on a sticky note at your desk'}], correct: ['a','c'], points: 2, explanation: 'Unique passwords and MFA reduce account risk.', position: 1 },
      { type: 'ranking', prompt: 'Rank these steps for responding to a minor hazard from first to last.', options: [{id:'warn',text:'Warn people nearby'},{id:'secure',text:'Secure or mark the area'},{id:'report',text:'Report it through the proper channel'}], correct: ['warn','secure','report'], points: 2, explanation: 'Immediate safety comes first, then containment, then reporting.', position: 2 },
      { type: 'matching', prompt: 'Match each item to the correct action.', options: [], correct: [], matchPairs: [{id:'p1',left:'Fire alarm sounds',right:'Evacuate using the nearest safe exit'},{id:'p2',left:'Damaged equipment',right:'Stop using it and report it'},{id:'p3',left:'Unknown chemical container',right:'Do not handle it; follow hazard procedure'}], matchCorrect: {p1:'p1',p2:'p2',p3:'p3'}, points: 3, explanation: 'Each situation has a specific safe response.', position: 3 },
    ],
  },
  {
    slug: 'study-habits-survey',
    title: 'Study Habits Check-in',
    description: 'A short survey-style quiz with open responses and reflection prompts.',
    category: 'Education',
    settings: { mode: 'survey', oneQuestionPerPage: false, showAnswers: 'never', collectName: true, collectEmail: true, passMark: 0 },
    questions: [
      { type: 'multiple_choice', prompt: 'How often do you review material after class?', options: [{id:'daily',text:'Daily'},{id:'weekly',text:'A few times a week'},{id:'rarely',text:'Rarely'},{id:'before',text:'Only before exams'}], correct: ['daily'], points: 0, explanation: '', position: 0 },
      { type: 'long_text', prompt: 'What study strategy has helped you most recently?', options: [], correct: [], points: 0, explanation: '', position: 1 },
      { type: 'number', prompt: 'About how many focused study hours do you aim for in a week?', options: [], correct: ['1:168'], points: 0, explanation: '', position: 2 },
      { type: 'short_text', prompt: 'Name one topic you want to understand better.', options: [], correct: ['any'], points: 0, explanation: '', position: 3 },
    ],
  },
];
