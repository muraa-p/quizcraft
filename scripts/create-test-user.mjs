import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envPath = '.env.local';
const env = fs.readFileSync(envPath, 'utf8');
const get = (k) => {
  const m = env.match(new RegExp('^' + k + '=(.*)$', 'm'));
  return m ? m[1].trim() : '';
};
const url = get('NEXT_PUBLIC_SUPABASE_URL');
const key = get('NEXT_PUBLIC_SUPABASE_ANON_KEY');
if (!url || !key || url.includes('YOUR_PROJECT_REF') || key.includes('YOUR_SUPABASE_ANON_PUBLIC_KEY')) {
  console.error(JSON.stringify({ error: 'Missing Supabase credentials in .env.local' }));
  process.exit(1);
}
const supabase = createClient(url, key);

const email = process.env.TEST_EMAIL || 'tester@quizcraft.app';
const password = process.env.TEST_PASSWORD || 'QuizcraftTest!2026';

async function main() {
  const out = { email, password, schemaProbe: null, signUp: null, signIn: null };
  try {
    const probe = await supabase.from('quizzes').select('id').limit(1);
    out.schemaProbe = probe.error ? { error: probe.error.message, code: probe.error.code || null, details: probe.error.details || null, hint: probe.error.hint || null } : { ok: true, rows: (probe.data || []).length };
  } catch (e) {
    out.schemaProbe = { exception: String(e) };
  }

  try {
    const { data: su, error: suErr } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: 'Test User' } },
    });
    out.signUp = suErr ? { error: suErr.message, status: suErr.status || null } : {
      userId: su.user?.id || null,
      hasSession: !!su.session,
      identitiesCount: Array.isArray(su.user?.identities) ? su.user.identities.length : null,
      emailConfirmedAt: su.user?.email_confirmed_at || null,
      role: su.user?.role || null,
    };
  } catch (e) {
    out.signUp = { exception: String(e) };
  }

  if (!out.signUp?.hasSession) {
    try {
      const { data: si, error: siErr } = await supabase.auth.signInWithPassword({ email, password });
      out.signIn = siErr ? { error: siErr.message, status: siErr.status || null } : { hasSession: !!si.session, userId: si.user?.id || null };
    } catch (e) {
      out.signIn = { exception: String(e) };
    }
  }

  console.log(JSON.stringify(out, null, 2));
}

main().catch(e => { console.error(JSON.stringify({ fatal: String(e) })); process.exit(1); });
