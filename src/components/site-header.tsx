import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PenSquare } from 'lucide-react';

export async function SiteHeader() {
  const hasEnv = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  let user: { email?: string | null } | null = null;
  if (hasEnv) {
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      user = data.user;
    } catch {
      user = null;
    }
  }

  return (
    <header className="border-b border-[var(--line)] bg-[rgba(243,237,226,0.85)] backdrop-blur-sm sticky top-0 z-40">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-sm bg-[var(--accent)] text-white">
            <PenSquare size={15} aria-hidden />
          </span>
          <span>QuizCraft</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2 text-sm font-medium">
          <Link href="/templates" className="px-3 py-2 rounded-md hover:bg-[rgba(24,33,43,0.06)]">Templates</Link>
          {user ? (
            <>
              <Link href="/dashboard" className="px-3 py-2 rounded-md hover:bg-[rgba(24,33,43,0.06)]">Dashboard</Link>
              <form action="/auth/signout" method="post">
                <button className="px-3 py-2 rounded-md hover:bg-[rgba(24,33,43,0.06)] text-[var(--ink-soft)]" type="submit">Sign out</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="px-3 py-2 rounded-md hover:bg-[rgba(24,33,43,0.06)]">Log in</Link>
              <Link href="/signup" className="btn btn-primary !py-2 !px-3">Start building</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
