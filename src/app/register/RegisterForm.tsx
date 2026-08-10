'use client';
import { useActionState } from 'react';
import { registerAction } from '@/app/actions/auth';

export function RegisterForm({ requireCode }: { requireCode: boolean }) {
  const [state, action, pending] = useActionState(registerAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <input name="name" placeholder="昵称" className="input" required />
      <input name="email" type="email" placeholder="邮箱" className="input" required />
      <input name="password" type="password" placeholder="密码（至少 6 位）" className="input" required />
      {requireCode && (
        <input name="code" placeholder="注册口令（向管理员获取）" className="input" required />
      )}
      {state?.error && <p className="text-sm text-rose-500">{state.error}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>
        {pending ? '注册中…' : '注册'}
      </button>
    </form>
  );
}
