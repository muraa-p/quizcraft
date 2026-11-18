import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--line)] mt-16">
      <div className="container-page py-10 grid gap-8 sm:grid-cols-[1.4fr_1fr_1fr] text-sm">
        <div>
          <p className="font-display text-lg font-semibold">QuizCraft</p>
          <p className="muted mt-2 max-w-sm leading-relaxed">
            An open-source quiz maker. Create scored quizzes, share a link, and see results — without payments, ads, or AI upsells.
          </p>
        </div>
        <div>
          <p className="font-semibold mb-2">Product</p>
          <ul className="space-y-1.5 muted">
            <li><Link href="/" className="hover:text-[var(--ink)]">Home</Link></li>
            <li><Link href="/templates" className="hover:text-[var(--ink)]">Templates</Link></li>
            <li><Link href="/dashboard" className="hover:text-[var(--ink)]">Dashboard</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-semibold mb-2">Build</p>
          <ul className="space-y-1.5 muted">
            <li>Next.js + Supabase</li>
            <li>Free-tier friendly</li>
            <li>MIT-style open source starter</li>
          </ul>
        </div>
      </div>
      <div className="container-page pb-8 text-xs muted">Made for learning, teams, and fun. You own your data and deployment.</div>
    </footer>
  );
}
