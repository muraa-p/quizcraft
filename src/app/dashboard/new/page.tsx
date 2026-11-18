import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { NewQuizForm } from '@/components/new-quiz-form';

export const dynamic = 'force-dynamic';

export default async function NewQuizPage({ searchParams }: { searchParams?: { template?: string } }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    redirect('/dashboard');
  }
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const template = typeof searchParams?.template === 'string' ? searchParams.template : undefined;
  const nextPath = `/dashboard/new${template ? `?template=${encodeURIComponent(template)}` : ''}`;
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return (
    <div className="container-page py-10 sm:py-14 max-w-2xl">
      <p className="kicker mb-2">New quiz</p>
      <h1 className="text-4xl font-semibold mb-2">{template ? 'Create from template' : 'Create a quiz'}</h1>
      <p className="muted mb-8">{template ? 'We’ll copy the template into a new draft quiz you can edit, save, and publish.' : 'Give it a title to start. You can add questions and settings in the editor.'}</p>
      <NewQuizForm templateSlug={template} />
    </div>
  );
}
