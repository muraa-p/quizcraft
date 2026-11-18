import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env.local', 'utf8');
const get = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [,''])[1].trim();
const url = get('NEXT_PUBLIC_SUPABASE_URL');
const key = get('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const email = 'tester@quizcraft.app';
const password = '1234567890';

const supabase = createClient(url, key);
const out = { email };

async function probe(table) {
  const { data, error } = await supabase.from(table).select('*').limit(1);
  if (error) return { ok: false, code: error.code || null, message: error.message, details: error.details || null, hint: error.hint || null };
  return { ok: true, rows: Array.isArray(data) ? data.length : null };
}

(async () => {
  out.schema = {
    profiles: await probe('profiles'),
    quizzes: await probe('quizzes'),
    questions: await probe('questions'),
    responses: await probe('responses'),
  };

  const signIn = await supabase.auth.signInWithPassword({ email, password });
  if (signIn.error) {
    out.signIn = { ok: false, status: signIn.error.status || null, message: signIn.error.message };
    console.log(JSON.stringify(out, null, 2));
    process.exit(0);
  }
  out.signIn = { ok: true, userId: signIn.data.user?.id || null, session: !!signIn.data.session };

  const slug = 'diag-' + Date.now().toString(36);
  const ins = await supabase.from('quizzes').insert({
    owner_id: signIn.data.user.id,
    title: 'Diagnostic Quiz',
    description: 'temp',
    slug,
    status: 'draft',
  }).select('id, slug').single();
  out.createQuiz = ins.error ? { ok: false, code: ins.error.code || null, message: ins.error.message, details: ins.error.details || null, hint: ins.error.hint || null } : { ok: true, id: ins.data.id, slug: ins.data.slug };

  if (ins.data?.id) {
    const del = await supabase.from('quizzes').delete().eq('id', ins.data.id);
    out.cleanup = del.error ? { ok: false, message: del.error.message } : { ok: true };
  }

  console.log(JSON.stringify(out, null, 2));
})().catch(e => { console.error(JSON.stringify({ fatal: String(e), stack: e?.stack })); process.exit(1); });
