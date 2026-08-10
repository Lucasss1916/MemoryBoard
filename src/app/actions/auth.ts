'use server';
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
} from '@/lib/auth';

const registerSchema = z.object({
  name: z.string().min(1, '请填写昵称').max(30),
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(6, '密码至少 6 位'),
  code: z.string().optional(),
});

export type ActionState = { error?: string } | undefined;

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    code: formData.get('code') ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { name, email, password, code } = parsed.data;

  // 限制注册：设了 SIGNUP_CODE 就必须提供正确口令；没设则开放注册
  const signupCode = process.env.SIGNUP_CODE;
  if (signupCode && signupCode.trim() !== '') {
    if (!code || code.trim() !== signupCode.trim()) {
      return { error: '注册口令不正确，请联系管理员获取' };
    }
  }
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return { error: '该邮箱已注册' };

  const user = await prisma.user.create({
    data: { name, email, password: await hashPassword(password) },
  });
  await createSession(user.id);
  redirect('/boards');
}

const loginSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(1, '请输入密码'),
});

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.password))) {
    return { error: '邮箱或密码错误' };
  }
  await createSession(user.id);
  redirect('/boards');
}

export async function logoutAction() {
  await destroySession();
  redirect('/login');
}
