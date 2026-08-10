import 'server-only';
import { prisma } from './prisma';
import { daysUntil } from './dates';

// 组装图片的绝对地址。优先用转发头还原用户实际访问的域名与协议
// (小组件/网页端才能用 https://你的域名/uploads/xxx.jpg 打开图片)。
function proxyBase(forwarded?: { proto?: string; host?: string }): string {
  const proto = forwarded?.proto || process.env['PROTO'] || ''
  const host = forwarded?.host || process.env['HOST'] || ''
  if (proto && host) return `${proto}://${host}`
  // 兜底:直接部署在 3000 端口且无反代时
  return `${process.env['PROTO'] ?? 'http'}://${process.env['HOST'] ?? 'localhost'}:${process.env['PORT'] ?? '3000'}`
}

// 汇总某用户在「所有他加入的留言板」里的小组件数据
// 只读、绝不包含未解锁的时间胶囊内容
export async function buildWidgetData(userId: string, limit = 10, forwarded?: { proto?: string; host?: string }) {
  const memberships = await prisma.boardMember.findMany({
    where: { userId },
    select: { boardId: true },
  });
  const boardIds = memberships.map((m: { boardId: string }) => m.boardId);
  if (boardIds.length === 0) {
    return { messages: [], anniversaries: [], generatedAt: new Date().toISOString() };
  }

  const [messages, anniversaries, boards] = await Promise.all([
    prisma.message.findMany({
      where: { boardId: { in: boardIds } },
      include: {
        author: { select: { name: true } },
        board: { select: { name: true, kind: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.anniversary.findMany({
      where: { boardId: { in: boardIds } },
      include: { board: { select: { name: true } } },
    }),
    prisma.board.findMany({ where: { id: { in: boardIds } }, select: { id: true, name: true } }),
  ]);

  const now = new Date();

  const anns = anniversaries
    .map((a) => ({
      title: a.title,
      board: a.board.name,
      date: a.date.toISOString().slice(0, 10),
      daysUntil: daysUntil(a.date, a.yearly, now),
    }))
    .sort((x: { daysUntil: number }, y: { daysUntil: number }) => x.daysUntil - y.daysUntil)
    .slice(0, limit);

  return {
    boards: boards.map((b: { id: string; name: string }) => b.name),
    messages: messages.map((m) => ({
      board: m.board.name,
      author: m.author.name,
      content: m.content,
      hasImage: !!m.imageUrl,
      // 完整可访问的图片地址:适配 X-Forwarded-Proto / 反向代理场景,避免漏掉协议或端口
      imageUrl: m.imageUrl
        ? `${proxyBase(forwarded)}${m.imageUrl.startsWith('/') ? '' : '/'}${m.imageUrl}`
        : null,
      createdAt: m.createdAt.toISOString(),
    })),
    anniversaries: anns,
    generatedAt: now.toISOString(),
  };
}
