import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { kindLabel } from '@/lib/constants';
import { Header } from '@/components/Header';
import { CreateJoin } from './CreateJoin';

export default async function BoardsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const memberships = await prisma.boardMember.findMany({
    where: { userId: user.id },
    include: { board: { include: { _count: { select: { members: true, messages: true } } } } },
    orderBy: { joinedAt: 'desc' },
  });

  return (
    <>
      <Header userName={user.name} avatarUrl={user.avatarUrl} />
      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        <CreateJoin />

        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-500">我的留言板</h2>
          {memberships.length === 0 ? (
            <div className="card p-8 text-center text-gray-400 text-sm">
              还没有留言板,创建一个或用邀请码加入吧
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {memberships.map(({ board, role }: { board: { id: string; name: string; kind: string; _count: { members: number; messages: number } }; role: string }) => {
                const k = kindLabel(board.kind);
                return (
                  <Link key={board.id} href={`/boards/${board.id}`} className="card p-4 hover:shadow-md transition">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{k.emoji}</span>
                      {role === 'OWNER' && (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-500">创建者</span>
                      )}
                    </div>
                    <h3 className="mt-2 font-semibold text-gray-800">{board.name}</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      {k.label} · {board._count.members} 位成员 · {board._count.messages} 条留言
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
