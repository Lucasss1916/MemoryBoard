'use client';
import { useActionState } from 'react';
import {
  updateNameAction,
  updateEmailAction,
  updatePasswordAction,
} from '@/app/actions/profile';

function Result({ state }: { state: { error?: string; success?: string } | undefined }) {
  if (state?.error) return <p className="text-sm text-rose-500">{state.error}</p>;
  if (state?.success) return <p className="text-sm text-emerald-600">{state.success}</p>;
  return null;
}

export function ProfileNameForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState(updateNameAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <input
        name="name"
        defaultValue={name}
        required
        maxLength={30}
        className="input"
        placeholder="昵称"
      />
      <Result state={state} />
      <button className="btn btn-primary" disabled={pending}>
        {pending ? '保存中...' : '保存昵称'}
      </button>
    </form>
  );
}

export function ProfileEmailForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(updateEmailAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <input
        name="email"
        type="email"
        defaultValue={email}
        required
        className="input"
        placeholder="邮箱"
      />
      <input
        name="currentPassword"
        type="password"
        required
        autoComplete="current-password"
        className="input"
        placeholder="当前密码"
      />
      <Result state={state} />
      <button className="btn btn-primary" disabled={pending}>
        {pending ? '保存中...' : '保存邮箱'}
      </button>
    </form>
  );
}

export function ProfilePasswordForm() {
  const [state, action, pending] = useActionState(updatePasswordAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <input
        name="currentPassword"
        type="password"
        required
        autoComplete="current-password"
        className="input"
        placeholder="当前密码"
      />
      <input
        name="newPassword"
        type="password"
        required
        minLength={6}
        autoComplete="new-password"
        className="input"
        placeholder="新密码(至少 6 位)"
      />
      <Result state={state} />
      <button className="btn btn-primary" disabled={pending}>
        {pending ? '保存中...' : '修改密码'}
      </button>
    </form>
  );
}
