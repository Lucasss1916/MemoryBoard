import 'server-only';
import { prisma } from './prisma';

// 校验 user 是否是 board 成员，是则返回成员记录，否则 null
export async function getMembership(userId: string, boardId: string) {
  return prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId } },
  });
}

// 要求是成员，否则抛错（隔离：只有同板成员能读写）
export async function requireMembership(userId: string, boardId: string) {
  const m = await getMembership(userId, boardId);
  if (!m) throw new Error('FORBIDDEN_NOT_MEMBER');
  return m;
}

// 判断一条时间胶囊对某用户当前是否可见：
// 作者本人始终可见；其他成员需到 unlockAt 之后。
export function isCapsuleVisible(
  capsule: { authorId: string; unlockAt: Date },
  userId: string,
  now: Date = new Date()
) {
  if (capsule.authorId === userId) return true;
  return now >= capsule.unlockAt;
}
