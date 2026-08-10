'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { requireMembership } from '@/lib/access';
import { saveImage } from '@/lib/upload';

export type ActionState = { error?: string } | undefined;

const createSchema = z.object({
  boardId: z.string().min(1),
  content: z.string().max(2000),
});

export async function createMessageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = createSchema.safeParse({
    boardId: formData.get('boardId'),
    content: formData.get('content') ?? '',
  });
  if (!parsed.success) return { error: '内容过长' };

  const { boardId, content } = parsed.data;
  // 隔离校验：必须是该板成员
  await requireMembership(user.id, boardId);

  const image = formData.get('image');
  let imageUrl: string | null = null;
  if (image instanceof File && image.size > 0) {
    try {
      imageUrl = await saveImage(image);
    } catch (e) {
      return { error: e instanceof Error ? e.message : '图片上传失败' };
    }
  }

  if (!content.trim() && !imageUrl) {
    return { error: '请写点什么，或添加一张照片' };
  }

  await prisma.message.create({
    data: { boardId, authorId: user.id, content: content.trim(), imageUrl },
  });
  revalidatePath(`/boards/${boardId}`);
}

export async function updateMessageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(formData.get('id') || '');
  const content = String(formData.get('content') || '').trim();

  const msg = await prisma.message.findUnique({ where: { id } });
  if (!msg) return { error: '留言不存在' };
  // 权限归属：只能改自己的
  if (msg.authorId !== user.id) return { error: '只能编辑自己的留言' };
  if (!content && !msg.imageUrl) return { error: '内容不能为空' };

  await prisma.message.update({ where: { id }, data: { content } });
  revalidatePath(`/boards/${msg.boardId}`);
}

export async function deleteMessageAction(id: string) {
  const user = await requireUser();
  const msg = await prisma.message.findUnique({ where: { id } });
  if (!msg) return;
  // 权限归属：只能删自己的
  if (msg.authorId !== user.id) throw new Error('只能删除自己的留言');
  await prisma.message.delete({ where: { id } });
  revalidatePath(`/boards/${msg.boardId}`);
}
