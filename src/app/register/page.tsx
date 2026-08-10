import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { RegisterForm } from './RegisterForm';

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect('/boards');
  const requireCode = !!(process.env.SIGNUP_CODE && process.env.SIGNUP_CODE.trim());
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">创建账号 ✨</h1>
        <p className="text-sm text-gray-500 mb-6">记录你和 TA 们的点滴</p>
        <RegisterForm requireCode={requireCode} />
        <p className="text-sm text-gray-500 mt-4 text-center">
          已有账号？{' '}
          <Link href="/login" className="text-rose-500 hover:underline">登录</Link>
        </p>
      </div>
    </main>
  );
}
