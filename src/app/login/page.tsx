import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { LoginForm } from './LoginForm';

export default async function LoginPage() {
  if (await getCurrentUser()) redirect('/boards');
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">欢迎回来 👋</h1>
        <p className="text-sm text-gray-500 mb-6">登录后即可查看你的留言板</p>
        <LoginForm />
        <p className="text-sm text-gray-500 mt-4 text-center">
          还没有账号？{' '}
          <Link href="/register" className="text-rose-500 hover:underline">注册</Link>
        </p>
      </div>
    </main>
  );
}
