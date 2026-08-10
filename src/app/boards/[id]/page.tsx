import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMembership, isCapsuleVisible } from '@/lib/access';
import { kindLabel, MESSAGE_PAGE_SIZE } from '@/lib/constants';
import { daysUntil, yearsSince } from '@/lib/dates';
import { Header } from '@/components/Header';
import { PostBox } from './PostBox';
import { MessageItem } from './MessageItem';
import { BoardTabs } from './BoardTabs';
import { CapsuleForm } from './CapsuleForm';
import { CapsuleItem } from './CapsuleItem';
import { AnniversaryForm } from './AnniversaryForm';
import { AnniversaryItem } from './AnniversaryItem';
import { Prisma } from '@prisma/client';

// 带 include 的查询结果类型(含 author)
type CapsuleWithAuthor = Prisma.TimeCapsuleGetPayload<{
  include: { author: { select: { id: true; name: true } } }
}>;
type MessageWithAuthor = Prisma.MessageGetPayload<{
  include: { author: { select: { id: true; name: true; avatarUrl: true } } }
}>;
type AnniversaryPlain = Awaited<ReturnType<typeof prisma.anniversary.findMany>>[number];
// 供 JSX 中 map 回调使用:视图对象的形状
type CapsuleView = {
  id: string; title: string; content: string; imageUrl: string | null;
  unlockAt: string; authorName: string; pending: boolean; isMine: boolean;
};
type AnnView = {
  id: string; title: string; date: string; yearly: boolean;
  daysUntil: number; years: number;
};

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const board = await prisma.board.findUnique({ where: { id } });
  if (!board) notFound();

  const membership = await getMembership(user.id, board.id);
  if (!membership) {
    return (
      <>
        <Header userName={user.name} avatarUrl={user.avatarUrl} />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="text-gray-500">你还不是这个留言板的成员,无法查看内容。</p>
          <Link href="/boards" className="btn btn-ghost mt-4">返回</Link>
        </main>
      </>
    );
  }

  const k = kindLabel(board.kind);

  // 并行拉取三类数据
  const [messages, capsules, anniversaries] = await Promise.all([
    prisma.message.findMany({
      where: { boardId: board.id },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      // 只取最近这些条：板用久了留言上千条，全量渲染会让首屏越来越慢
      take: MESSAGE_PAGE_SIZE,
    }),
    prisma.timeCapsule.findMany({
      where: { boardId: board.id },
      include: { author: { select: { id: true, name: true } } },
      orderBy: { unlockAt: 'asc' },
    }),
    prisma.anniversary.findMany({ where: { boardId: board.id } }),
  ]);

  const now = new Date();

  // 胶囊可见性:
  //  - 未到解锁日期,对「非作者」完全不可见 —— 直接从列表过滤掉,连锁定态都不显示
  //  - 作者本人始终能看到自己封存的(未解锁时标记 pending,提示他人尚看不到)
  const capsuleViews: CapsuleView[] = capsules
    .filter((c: CapsuleWithAuthor) => isCapsuleVisible(c, user.id, now))
    .map((c: CapsuleWithAuthor) => {
      const unlocked = now >= c.unlockAt;
      return {
        id: c.id,
        title: c.title,
        content: c.content,
        imageUrl: c.imageUrl,
        unlockAt: c.unlockAt.toISOString(),
        authorName: c.author.name,
        pending: !unlocked, // 仅可能出现在作者自己的未解锁胶囊上
        isMine: c.authorId === user.id,
      };
    });

  // 纪念日:按最近的排前面
  const annViews = anniversaries
    .map((a: AnniversaryPlain) => ({
      id: a.id,
      title: a.title,
      date: a.date.toISOString(),
      yearly: a.yearly,
      daysUntil: daysUntil(a.date, a.yearly, now),
      years: yearsSince(a.date, now),
    }))
    .sort((x: { daysUntil: number }, y: { daysUntil: number }) => x.daysUntil - y.daysUntil);

  return (
    <>
      <Header userName={user.name} avatarUrl={user.avatarUrl} />
      <main className="mx-auto max-w-3xl px-4 py-6 space-y-5">
        <div className="card p-5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800">{k.emoji} {board.name}</h1>
              <p className="text-xs text-gray-400 mt-1">{k.label}留言板</p>
            </div>
            <Link href="/boards" className="text-sm text-gray-400 hover:text-gray-600">← 全部</Link>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2">
            <span className="text-xs text-gray-500">邀请码</span>
            <code className="font-mono font-bold tracking-widest text-rose-500">{board.inviteCode}</code>
            <span className="text-xs text-gray-400">· 分享给同板的人加入</span>
          </div>
        </div>

        <BoardTabs
          wall={
            <div className="space-y-4">
              <PostBox boardId={board.id} />
              <section className="space-y-3">
                {messages.length === 0 ? (
                  <div className="card p-8 text-center text-gray-400 text-sm">还没有留言,写下第一条吧 ✍️</div>
                ) : (
                  messages.map((m: MessageWithAuthor) => (
                    <MessageItem
                      key={m.id}
                      message={{
                        id: m.id,
                        content: m.content,
                        imageUrl: m.imageUrl,
                        createdAt: m.createdAt.toISOString(),
                        authorName: m.author.name,
                        authorAvatar: m.author.avatarUrl,
                      }}
                      isMine={m.authorId === user.id}
                    />
                  ))
                )}
              </section>
            </div>
          }
          capsule={
            <div className="space-y-4">
              <CapsuleForm boardId={board.id} />
              <section className="space-y-3">
                {capsuleViews.length === 0 ? (
                  <div className="card p-8 text-center text-gray-400 text-sm">
                    还没有时间胶囊。封存一段话,到日子再一起打开 🔒
                  </div>
                ) : (
                  capsuleViews.map((c: CapsuleView) => <CapsuleItem key={c.id} capsule={c} />)
                )}
              </section>
            </div>
          }
          anniv={
            <div className="space-y-4">
              <AnniversaryForm boardId={board.id} />
              <section className="space-y-3">
                {annViews.length === 0 ? (
                  <div className="card p-8 text-center text-gray-400 text-sm">
                    还没有纪念日。添加一个,一起数着日子 🎈
                  </div>
                ) : (
                  annViews.map((a: AnnView) => <AnniversaryItem key={a.id} ann={a} />)
                )}
              </section>
            </div>
          }
        />
      </main>
    </>
  );
}
