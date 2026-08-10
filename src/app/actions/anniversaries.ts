'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { requireMembership } from '@/lib/access';

export type ActionState = { error?: string } | undefined;

const createSchema = z.object({
  boardId: z.string().min(1),
  title: z.string().min(1, '请填写纪念日名称').max(80),
  date: z.string().min(1, '请选择日期'),
  yearly: z.enum(['on', 'off']).optional(),
});

export async function createAnniversaryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = createSchema.safeParse({
    boardId: formData.get('boardId'),
    title: formData.get('title'),
    date: formData.get('date'),
    yearly: formData.get('yearly') ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { boardId, title, date, yearly } = parsed.data;
  // 隔离：必须是该板成员
  await requireMembership(user.id, boardId);

  const d = new Date(date);
  if (isNaN(d.getTime())) return { error: '日期无效' };

  await prisma.anniversary.create({
    data: { boardId, title: title.trim(), date: d, yearly: yearly === 'on' },
  });
  revalidatePath(`/boards/${boardId}`);
}

export async function deleteAnniversaryAction(id: string) {
  const user = await requireUser();
  const ann = await prisma.anniversary.findUnique({ where: { id } });
  if (!ann) return;
  // 纪念日属于留言板：只要是该板成员即可删除
  await requireMembership(user.id, ann.boardId);
  await prisma.anniversary.delete({ where: { id } });
  revalidatePath(`/boards/${ann.boardId}`);
}
