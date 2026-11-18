# QuizCraft



A production-oriented, open-source quiz platform built with **Next.js (App Router)**, **Tailwind CSS**, and **Supabase** (Postgres + Auth + RLS). It covers core quiz-maker workflows while remaining free-tier friendly.



## Features

- **No-setup demo mode (works without Supabase):** try sample quizzes and use a local browser-based builder/editor/taker (`/demo/*`, saved to local storage, responses not persisted)
- **Comprehensive question types:** multiple choice, multi-select, true/false, dropdown, short answer, long answer (open response), number (exact/range), ranking, matching, and **section/heading** blocks
- **Question authoring tools:** points, required flag, descriptions/help text, image URLs, explanations/feedback, duplicate/reorder/delete, and validation
- **Excel/CSV import (client-side):** download a template, fill it in, and import questions in the browser (parsed locally; nothing is written to the database until you save)
- **Templates as starting points:** copy a sample template into the local builder or create a new Supabase-backed draft from a template
- **Flexible text grading:** short answers are case-insensitive by default, with support for exact/case-sensitive (`=Answer`) and keyword/contains (`*keyword*`) matching; long answers can optionally be auto-checked by required keywords
- **Preview:** in-editor preview using the same runtime as respondents
- **Quiz settings:** scored or survey mode, answer reveal (after each / at end / never), pass mark, one-question-per-page or all-at-once, progress bar, shuffle questions/options, retakes, score visibility, time limit, access code, open/close schedule, welcome/completion messages, redirect URL
- **Respondent/audience options:** optional/required name and email collection, public share slug, publish/unpublish, embeddable iframe code
- **Results & outcomes:** pass/fail, grade bands, optional completion certificate view, score/percent display, answer review (per settings)
- **Analytics & responses (Supabase):** response table with score, percent, grade, pass/fail, duration, name/email, and summary stats (average score, pass rate, average time)
- **Theme controls:** accent/paper/ink colors, font style, corner style
- **Supabase-backed dashboard:** auth, create/edit/delete quizzes, publish, public quiz route (`/q/[slug]`), and RLS-protected data access

> Note: This project implements a broad "quiz-maker" feature set in an open-source, free-tier stack. Some proprietary SaaS capabilities (payments, AI generation, built-in email/CRM/team billing, anti-spam services, etc.) are not integrated by default, but hooks/fields and UI flows are provided where practical. For real external sharing (e.g. classmates), deploy the app to a reachable URL and set `NEXT_PUBLIC_SITE_URL` so public links point to that host (localhost links only work on your own machine). Some advanced audience controls are enforced in the app UI/runtime; strengthen server-side enforcement/policies for strict production requirements.



## Test without Supabase first



You can try the core quiz-taking and authoring UX without creating a Supabase project:



1. `npm install && npm run dev`

2. Open [http://localhost:3000](http://localhost:3000)

3. Click **Try a demo quiz** (sample templates) or **Test the builder** (`/demo/local`) to create/edit/take your own quiz in the browser.



Demo/local quizzes are stored in your browser's local storage only. Responses are not collected/saved to a backend in demo mode. To publish quizzes and collect responses, connect Supabase (below).



## Tech stack



- [Next.js 14](https://nextjs.org/) (App Router, TypeScript)

- [Supabase](https://supabase.com/) for database and authentication (free tier)

- Tailwind CSS



## Getting started



### 1. Install dependencies



```bash

npm install

```



### 2. Create a Supabase project (free)



1. Create a project at [supabase.com](https://supabase.com/).

2. In the Supabase SQL Editor, run the schema in [`supabase/schema.sql`](supabase/schema.sql). This creates/updates tables (`profiles`, `quizzes`, `questions`, `responses`), RLS policies, triggers, and compatibility columns for newer question/response features.

3. In **Project Settings → API**, copy your Project URL and anon/public key.



### 3. Configure environment



```bash

cp .env.example .env.local

```



Edit `.env.local`:



```env

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co

NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

NEXT_PUBLIC_SITE_URL=http://localhost:3000

```



### 4. Run locally



```bash

npm run dev

```



Open [http://localhost:3000](http://localhost:3000).



### 5. Deploy (free)



- **Vercel**: import the repo, set the same env vars, deploy.

- **Supabase**: already hosted; ensure your site URL/redirect URLs are configured in Supabase Auth settings if you use email confirmation/magic links.



## Notes

- Public visitors can only read **published** quizzes/questions and submit responses (enforced by RLS). Quiz owners manage their own data.
- For external sharing (e.g. classmates), deploy the app to a reachable/public URL and set `NEXT_PUBLIC_SITE_URL` to that URL so share links and embeds point to it. Links based on `localhost` only work on your own machine.
- Short-answer grading is case-insensitive by default and ignores extra spaces. Use `=Answer` for exact/case-sensitive matching, or `*keyword*` to accept responses containing that keyword/phrase. Number questions support exact values and inclusive ranges (`min:max`, e.g. `10:20`).
- Ranking is auto-graded against the defined correct order; matching is auto-graded by correct pairs. Long-answer questions can be open responses (not auto-graded) or auto-checked when you provide required keywords (all must appear). Section/heading items are display-only and not scored.
- Excel/CSV import and template download run in the browser (no file upload to the database). Imported questions are added to the editor state and only persisted when you save.
- If you add the new `section` question type on an existing Supabase project, re-run the relevant `questions` type-constraint update from [`supabase/schema.sql`](supabase/schema.sql) and reload the schema cache so inserts/updates are accepted.
- Some advanced audience controls (access code, schedule, respondent info, retakes, etc.) are enforced in the app UI/runtime; strengthen server-side enforcement/policies as needed for strict production requirements.
- Live Supabase-backed behavior (auth, persistence, RLS, public submissions) should be verified with a configured Supabase project.



## Project structure



- `src/app` — routes (marketing, auth, dashboard, editor, responses, public quiz, demo)

- `src/components` — UI components (editor, quiz taker, forms)

- `src/lib` — Supabase clients, scoring, quiz helpers, demo/sample data, utilities

- `src/types` — shared domain types

- `supabase/schema.sql` — database schema, RLS policies, and compatibility updates



## Validation



After changes, run:



```bash

npm run lint

npx tsc --noEmit

npm run build

``` 



## License



Open-source starter. Use and modify freely for your own projects.

