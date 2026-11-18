'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient, hasSupabaseEnv } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setInfo(null);
    if (!hasSupabaseEnv()) {
      setError('Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment.');
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: name || email.split('@')[0] } },
      });
      if (error) throw error;
      if (data.session) {
        router.push('/dashboard');
        router.refresh();
      } else {
        setInfo('Check your email to confirm your account, then log in. (If email confirmation is disabled in Supabase, you can log in immediately.)');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not create account.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container-page py-12 sm:py-16 max-w-md">
      <p className="kicker mb-3">Account</p>
      <h1 className="text-4xl font-semibold mb-2">Create your account</h1>
      <p className="muted mb-8">Start building and sharing quizzes with your own Supabase backend.</p>
      <form onSubmit={onSubmit} className="panel rounded-lg p-6 space-y-4">
        <div>
          <label className="label" htmlFor="name">Display name</label>
          <input id="name" className="field" type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Optional" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" className="field" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" className="field" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          <p className="text-xs muted mt-1">At least 6 characters.</p>
        </div>
        {error && <p className="text-sm rounded-md border border-red-200 bg-[var(--bad-bg)] text-[var(--bad)] px-3 py-2">{error}</p>}
        {info && <p className="text-sm rounded-md border border-teal-200 bg-[var(--ok-bg)] text-[var(--ok)] px-3 py-2">{info}</p>}
        <button className="btn btn-primary w-full" disabled={loading} type="submit">{loading ? 'Creating account…' : 'Create account'}</button>
      </form>
      <p className="mt-4 text-sm muted">Already have an account? <Link href="/login" className="text-[var(--accent)] font-semibold hover:underline">Log in</Link></p>
    </div>
  );
}
