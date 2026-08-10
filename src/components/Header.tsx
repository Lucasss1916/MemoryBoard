import Link from 'next/link';
import { logoutAction } from '@/app/actions/auth';
import { Avatar } from './Avatar';

export function Header({ userName, avatarUrl }: { userName: string; avatarUrl?: string | null }) {
  return (
    <header className="sticky top-0 z-10 border-b border-white/60 bg-cream/80 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/boards" className="font-bold text-gray-800">
          🕰️ 点滴留言板
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/settings" className="text-gray-400 hover:text-rose-500">设置</Link>
          <span className="flex items-center gap-1.5 text-gray-500">
            <Avatar name={userName} src={avatarUrl} size={24} />
            {userName}
          </span>
          <form action={logoutAction}>
            <button className="text-gray-400 hover:text-rose-500">退出</button>
          </form>
        </div>
      </div>
    </header>
  );
}
