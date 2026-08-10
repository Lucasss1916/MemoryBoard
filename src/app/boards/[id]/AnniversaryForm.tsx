'use client';
import { useActionState, useRef, useState } from 'react';
import { createAnniversaryAction } from '@/app/actions/anniversaries';

export function AnniversaryForm({ boardId }: { boardId: string }) {
  const [state, action, pending] = useActionState(createAnniversaryAction, undefined);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn-primary w-full">
        🎈 添加纪念日
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={async (fd) => { await action(fd); formRef.current?.reset(); }}
      className="card p-4 space-y-3"
    >
      <input type="hidden" name="boardId" value={boardId} />
      <input name="title" placeholder="纪念日名称,如「在一起的日子」" className="input" required />
      <div>
        <label className="mb-1 block text-xs text-gray-500">日期</label>
        <input name="date" type="date" className="input" required />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input type="checkbox" name="yearly" defaultChecked className="h-4 w-4 accent-rose-500" />
        每年重复(生日 / 周年这类)
      </label>
      {state?.error && <p className="text-sm text-rose-500">{state.error}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={pending}>{pending ? '添加中…' : '添加'}</button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">取消</button>
      </div>
    </form>
  );
}
