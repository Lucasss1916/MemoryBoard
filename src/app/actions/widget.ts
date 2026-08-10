'use server';
import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

// 生成（或重置）当前用户的小组件访问令牌
export async function regenerateWidgetTokenAction() {
  const user = await requireUser();
  const token = randomBytes(24).toString('base64url');
  await prisma.user.update({ where: { id: user.id }, data: { widgetToken: token } });
  revalidatePath('/settings');
}
