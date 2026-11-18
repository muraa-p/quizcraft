export type QuestionType =
  | 'multiple_choice'
  | 'multi_select'
  | 'true_false'
  | 'short_text'
  | 'long_text'
  | 'number'
  | 'dropdown'
  | 'ranking'
  | 'matching'
  | 'section';

export type QuizMode = 'scored' | 'survey';

export interface Option {
  id: string;
  text: string;
  imageUrl?: string;
}

export interface MatchPair {
  id: string;
  left: string;
  right: string;
}

export interface Question {
  id: string;
  quiz_id: string;
  type: QuestionType;
  prompt: string;
  description?: string;
  imageUrl?: string;
  required?: boolean;
  options: Option[];
  correct: string[]; // option ids, accepted answers, number as string, or order for ranking
  matchPairs?: MatchPair[]; // for matching: left items and correct right mapping encoded in correct? easier: pairs with ids and correct as {pairId:rightId}
  matchCorrect?: Record<string, string>; // pairId -> right option id
  points: number;
  explanation: string;
  position: number;
}

export interface QuizTheme {
  accent: string;
  paper: string;
  ink: string;
  font?: 'editorial' | 'modern' | 'classic';
  radius?: 'soft' | 'sharp';
}

export interface GradeBand {
  id: string;
  min: number; // inclusive percent
  label: string;
  description?: string;
}

export interface QuizSettings {
  mode?: QuizMode;
  showAnswers: 'after_each' | 'at_end' | 'never';
  passMark: number; // percent
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  collectName: boolean;
  collectEmail?: boolean;
  requireName?: boolean;
  requireEmail?: boolean;
  oneQuestionPerPage?: boolean;
  showProgressBar?: boolean;
  allowRetake?: boolean;
  showScore?: boolean;
  timeLimitMinutes?: number | null;
  accessCode?: string;
  opensAt?: string | null;
  closesAt?: string | null;
  welcomeMessage?: string;
  successMessage?: string;
  redirectUrl?: string;
  certificateEnabled?: boolean;
  certificateTitle?: string;
  certificateIssuer?: string;
  gradeBands?: GradeBand[];
  leaderboardEnabled?: boolean;
  respondentCanViewLeaderboard?: boolean;
}

export interface Quiz {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  slug: string;
  status: 'draft' | 'published';
  theme: QuizTheme;
  settings: QuizSettings;
  created_at: string;
  updated_at: string;
  questions?: Question[];
}

export interface ResponseRow {
  id: string;
  quiz_id: string;
  respondent_name: string | null;
  respondent_email?: string | null;
  answers: Record<string, string | string[] | Record<string, string>>;
  score: number;
  total: number;
  passed: boolean | null;
  percent?: number | null;
  grade_label?: string | null;
  duration_seconds?: number | null;
  created_at: string;
}

export type AnswerValue = string | string[] | Record<string, string> | number | undefined;
