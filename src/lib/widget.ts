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

// 由相对路径生成原图与缩略图的绝对地址。
// imageUrl 走 /uploads/... 原图;thumbUrl 走 /thumb/...?w=<宽度>,
// 由 /thumb 路由用 sharp 实时压成小 webp,给小组件用。
function imageUrls(
  rel: string | null,
  base: string,
  thumbWidth: number
): { imageUrl: string | null; thumbUrl: string | null } {
  if (!rel) return { imageUrl: null, thumbUrl: null };
  const clean = rel.startsWith('/') ? rel : `/${rel}`;
  const imageUrl = `${base}${clean}`;
  // /uploads/xxx.jpg -> /thumb/xxx.jpg?w=200
  const thumbPath = clean.replace(/^\/uploads\//, '/thumb/');
  return { imageUrl, thumbUrl: `${base}${thumbPath}?w=${thumbWidth}` };
}

export type WidgetOptions = {
  // 只看某个留言板(需已校验用户是其成员);不传则汇总全部
  boardId?: string;
  // 缩略图宽度(像素),默认 200,适合小组件
  thumbWidth?: number;
};

// 汇总某用户可见的小组件/页面数据:留言、纪念日、已解锁的时间胶囊、可选板列表。
// 隔离原则:只取用户 membership 覆盖的留言板;指定 boardId 时进一步收窄到那一个板。
// 时间胶囊:未解锁的只有作者本人能看到,且不返回正文内容。
export async function buildWidgetData(
  userId: string,
  limit = 10,
  forwarded?: { proto?: string; host?: string },
  options: WidgetOptions = {}
) {
  const thumbWidth = options.thumbWidth ?? 200;
  const base = proxyBase(forwarded);

  const memberships = await prisma.boardMember.findMany({
    where: { userId },
    select: { boardId: true },
  });
  const allBoardIds = memberships.map((m: { boardId: string }) => m.boardId);

  // 全部可选留言板(始终返回,供小组件/页面切换)
  const allBoards = await prisma.board.findMany({
    where: { id: { in: allBoardIds } },
    select: { id: true, name: true, kind: true },
    orderBy: { createdAt: 'asc' },
  });

  // 决定本次实际查询哪些板:指定且用户确实是成员 → 只查那一个;否则查全部
  let boardIds = allBoardIds;
  if (options.boardId) {
    if (!allBoardIds.includes(options.boardId)) {
      // 不是成员:直接空数据,绝不跨板泄露
      return {
        boards: allBoards,
        selectedBoardId: null,
        messages: [],
        anniversaries: [],
        capsules: [],
        generatedAt: new Date().toISOString(),
      };
    }
    boardIds = [options.boardId];
  }

  if (boardIds.length === 0) {
    return {
      boards: allBoards,
      selectedBoardId: options.boardId ?? null,
      messages: [],
      anniversaries: [],
      capsules: [],
      generatedAt: new Date().toISOString(),
    };
  }

  const now = new Date();

  const [messages, anniversaries, capsules] = await Promise.all([
    prisma.message.findMany({
      where: { boardId: { in: boardIds } },
      include: {
        author: { select: { name: true } },
        board: { select: { id: true, name: true, kind: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.anniversary.findMany({
      where: { boardId: { in: boardIds } },
      include: { board: { select: { id: true, name: true, kind: true } } },
    }),
    // 时间胶囊:已解锁的全板可见;未解锁的仅作者本人可见(且下面不给正文)
    prisma.timeCapsule.findMany({
      where: {
        boardId: { in: boardIds },
        OR: [{ unlockAt: { lte: now } }, { authorId: userId }],
      },
      include: {
        author: { select: { name: true } },
        board: { select: { id: true, name: true, kind: true } },
      },
      orderBy: { unlockAt: 'asc' },
      take: limit,
    }),
  ]);

  const anns = anniversaries
    .map((a) => ({
      title: a.title,
      board: a.board.name,
      boardId: a.board.id,
      boardKind: a.board.kind,
      date: a.date.toISOString().slice(0, 10),
      daysUntil: daysUntil(a.date, a.yearly, now),
    }))
    .sort((x: { daysUntil: number }, y: { daysUntil: number }) => x.daysUntil - y.daysUntil)
    .slice(0, limit);

  return {
    boards: allBoards,
    selectedBoardId: options.boardId ?? null,
    messages: messages.map((m) => ({
      board: m.board.name,
      boardId: m.board.id,
      boardKind: m.board.kind,
      author: m.author.name,
      content: m.content,
      hasImage: !!m.imageUrl,
      // 完整可访问的图片地址:适配 X-Forwarded-Proto / 反向代理场景,避免漏掉协议或端口
      ...imageUrls(m.imageUrl, base, thumbWidth),
      createdAt: m.createdAt.toISOString(),
    })),
    anniversaries: anns,
    capsules: capsules.map((c) => {
      const unlocked = c.unlockAt.getTime() <= now.getTime();
      const imgs = unlocked ? imageUrls(c.imageUrl, base, thumbWidth) : { imageUrl: null, thumbUrl: null };
      return {
        board: c.board.name,
        boardId: c.board.id,
        boardKind: c.board.kind,
        author: c.author.name,
        title: c.title,
        unlocked,
        unlockAt: c.unlockAt.toISOString(),
        // 未解锁:不泄露正文与图片,只给标题和解锁日期
        content: unlocked ? c.content : null,
        hasImage: unlocked ? !!c.imageUrl : false,
        ...imgs,
      };
    }),
    generatedAt: now.toISOString(),
  };
}
