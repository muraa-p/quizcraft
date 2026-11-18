'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient, hasSupabaseEnv } from '@/lib/supabase/client';

function LoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next') || '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(search.get('error'));
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!hasSupabaseEnv()) {
      setError('Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment.');
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push(next);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container-page py-12 sm:py-16 max-w-md">
      <p className="kicker mb-3">Account</p>
      <h1 className="text-4xl font-semibold mb-2">Log in</h1>
      <p className="muted mb-8">Access your dashboard to create and manage quizzes.</p>
      <form onSubmit={onSubmit} className="panel rounded-lg p-6 space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" className="field" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" className="field" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        {error && <p className="text-sm rounded-md border border-red-200 bg-[var(--bad-bg)] text-[var(--bad)] px-3 py-2">{error}</p>}
        <button className="btn btn-primary w-full" disabled={loading} type="submit">{loading ? 'Signing in…' : 'Log in'}</button>
      </form>
      <p className="mt-4 text-sm muted">No account yet? <Link href="/signup" className="text-[var(--accent)] font-semibold hover:underline">Create one</Link></p>
      <div className="mt-6 text-xs muted leading-relaxed border-t border-[var(--line)] pt-4">
        Setup note: create a free Supabase project, run <code>supabase/schema.sql</code> in the SQL editor, then set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="container-page py-12">Loading…</div>}>
      <LoginInner />
    </Suspense>
  );
}
