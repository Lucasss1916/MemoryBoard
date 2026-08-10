'use client';
import { useActionState } from 'react';
import { loginAction } from '@/app/actions/auth';

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <input name="email" type="email" placeholder="邮箱" className="input" required />
      <input name="password" type="password" placeholder="密码" className="input" required />
      {state?.error && <p className="text-sm text-rose-500">{state.error}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>
        {pending ? '登录中…' : '登录'}
      </button>
    </form>
  );
}
