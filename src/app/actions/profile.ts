'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { saveImage, deleteUpload } from '@/lib/upload';
import {
  requireUser,
  hashPassword,
  verifyPassword,
  createSession,
} from '@/lib/auth';

export type ActionState = { error?: string; success?: string } | undefined;

const nameSchema = z.object({
  name: z.string().trim().min(1, '请填写昵称').max(30, '昵称最多 30 个字'),
});

// 修改昵称
export async function updateNameAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = nameSchema.safeParse({ name: formData.get('name') });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.user.update({ where: { id: user.id }, data: { name: parsed.data.name } });
  revalidatePath('/settings');
  return { success: '昵称已更新' };
}

const emailSchema = z.object({
  email: z.string().email('邮箱格式不正确').trim().toLowerCase(),
});

// 修改邮箱(需验证当前密码)
export async function updateEmailAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = emailSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const currentPassword = String(formData.get('currentPassword') ?? '');
  const full = await prisma.user.findUnique({ where: { id: user.id } });
  if (!full) return { error: '用户不存在' };
  if (!(await verifyPassword(currentPassword, full.password))) {
    return { error: '当前密码不正确' };
  }

  const exists = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (exists && exists.id !== user.id) return { error: '该邮箱已被使用' };

  await prisma.user.update({ where: { id: user.id }, data: { email: parsed.data.email } });
  revalidatePath('/settings');
  return { success: '邮箱已更新' };
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1, '请输入当前密码'),
  newPassword: z.string().min(6, '新密码至少 6 位'),
});

// 修改密码(需验证当前密码,改完刷新会话保持登录)
export async function updatePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const full = await prisma.user.findUnique({ where: { id: user.id } });
  if (!full) return { error: '用户不存在' };
  if (!(await verifyPassword(parsed.data.currentPassword, full.password))) {
    return { error: '当前密码不正确' };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { password: await hashPassword(parsed.data.newPassword) },
  });
  // 密码变更后重新签发会话,保持登录态
  await createSession(user.id);
  return { success: '密码已更新' };
}

// 更新头像。旧头像换下来后删掉，免得 uploads 目录里堆一堆没人用的图。
export async function updateAvatarAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const image = formData.get('avatar');
  if (!(image instanceof File) || image.size === 0) {
    return { error: '请选择一张图片' };
  }

  let url: string;
  try {
    url = await saveImage(image);
  } catch (e) {
    return { error: e instanceof Error ? e.message : '头像上传失败' };
  }

  const before = await prisma.user.findUnique({
    where: { id: user.id },
    select: { avatarUrl: true },
  });
  await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: url } });
  if (before?.avatarUrl) await deleteUpload(before.avatarUrl);

  revalidatePath('/settings');
  revalidatePath('/boards');
  return { success: '头像已更新' };
}

// 移除头像，回到用昵称首字母的默认样式
export async function removeAvatarAction(): Promise<void> {
  const user = await requireUser();
  const before = await prisma.user.findUnique({
    where: { id: user.id },
    select: { avatarUrl: true },
  });
  if (!before?.avatarUrl) return;

  await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: null } });
  await deleteUpload(before.avatarUrl);
  revalidatePath('/settings');
  revalidatePath('/boards');
}
