'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Trash2 } from 'lucide-react';

export function DeleteQuizButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function onDelete() {
    if (!confirm('Delete this quiz and all its questions and responses? This cannot be undone.')) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('quizzes').delete().eq('id', id);
      if (error) throw error;
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Could not delete quiz');
    } finally {
      setLoading(false);
    }
  }
  return (
    <button onClick={onDelete} disabled={loading} className="btn btn-ghost !py-2 text-[var(--signal)] hover:bg-red-50" type="button" title="Delete quiz">
      <Trash2 size={15} /> {loading ? '…' : 'Delete'}
    </button>
  );
}
