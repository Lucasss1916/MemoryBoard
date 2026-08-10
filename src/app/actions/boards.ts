'use server';
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { getMembership } from '@/lib/access';

export type ActionState = { error?: string } | undefined;

function genInviteCode() {
  // 8 位大写字母数字邀请码
  return randomBytes(6).toString('base64').replace(/[^A-Z0-9]/gi, '').slice(0, 8).toUpperCase();
}

const createSchema = z.object({
  name: z.string().min(1, '请填写留言板名称').max(40),
  kind: z.enum(['LOVER', 'FAMILY', 'FRIEND', 'OTHER']),
});

export async function createBoardAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = createSchema.safeParse({
    name: formData.get('name'),
    kind: formData.get('kind'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // 保证邀请码唯一
  let code = genInviteCode();
  while (await prisma.board.findUnique({ where: { inviteCode: code } })) {
    code = genInviteCode();
  }

  const board = await prisma.board.create({
    data: {
      name: parsed.data.name,
      kind: parsed.data.kind,
      inviteCode: code,
      ownerId: user.id,
      members: { create: { userId: user.id, role: 'OWNER' } },
    },
  });
  redirect(`/boards/${board.id}`);
}

const joinSchema = z.object({
  code: z.string().min(1, '请输入邀请码'),
});

export async function joinBoardAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = joinSchema.safeParse({ code: formData.get('code') });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const code = parsed.data.code.trim().toUpperCase();
  const board = await prisma.board.findUnique({ where: { inviteCode: code } });
  if (!board) return { error: '邀请码无效' };

  const existing = await getMembership(user.id, board.id);
  if (existing) redirect(`/boards/${board.id}`);

  await prisma.boardMember.create({
    data: { userId: user.id, boardId: board.id, role: 'MEMBER' },
  });
  redirect(`/boards/${board.id}`);
}

// 退出留言板（拥有者不能退出，需先转让/删除——MVP 简单拦截）
export async function leaveBoardAction(boardId: string) {
  const user = await requireUser();
  const m = await getMembership(user.id, boardId);
  if (!m) return;
  if (m.role === 'OWNER') return; // MVP：拥有者不可退出
  await prisma.boardMember.delete({
    where: { boardId_userId: { boardId, userId: user.id } },
  });
  redirect('/boards');
}
