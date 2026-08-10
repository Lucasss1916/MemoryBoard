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
  title: z.string().min(1, '请填写标题').max(80),
  content: z.string().max(4000),
  unlockAt: z.string().min(1, '请选择解锁日期'),
});

export async function createCapsuleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = createSchema.safeParse({
    boardId: formData.get('boardId'),
    title: formData.get('title'),
    content: formData.get('content') ?? '',
    unlockAt: formData.get('unlockAt'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { boardId, title, content, unlockAt } = parsed.data;
  // 隔离：必须是该板成员
  await requireMembership(user.id, boardId);

  const unlockDate = new Date(unlockAt);
  if (isNaN(unlockDate.getTime())) return { error: '解锁日期无效' };
  // 解锁日期必须在未来（否则失去封存意义）
  if (unlockDate.getTime() <= Date.now()) {
    return { error: '解锁日期需要设在未来' };
  }
  if (!content.trim()) return { error: '写点想对未来说的话吧' };

  const image = formData.get('image');
  let imageUrl: string | null = null;
  if (image instanceof File && image.size > 0) {
    try {
      imageUrl = await saveImage(image);
    } catch (e) {
      return { error: e instanceof Error ? e.message : '图片上传失败' };
    }
  }

  await prisma.timeCapsule.create({
    data: { boardId, authorId: user.id, title: title.trim(), content: content.trim(), imageUrl, unlockAt: unlockDate },
  });
  revalidatePath(`/boards/${boardId}`);
}

export async function deleteCapsuleAction(id: string) {
  const user = await requireUser();
  const cap = await prisma.timeCapsule.findUnique({ where: { id } });
  if (!cap) return;
  // 权限归属：只能删自己的胶囊
  if (cap.authorId !== user.id) throw new Error('只能删除自己的时间胶囊');
  await prisma.timeCapsule.delete({ where: { id } });
  revalidatePath(`/boards/${cap.boardId}`);
}
