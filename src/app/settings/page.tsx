import Link from 'next/link';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Header } from '@/components/Header';
import { TokenPanel } from './TokenPanel';
import { ProfileNameForm, ProfileEmailForm, ProfilePasswordForm } from './ProfileForms';
import { AvatarForm } from './AvatarForm';
import { BackupPanel } from './BackupPanel';
import { RestorePanel } from './RestorePanel';
import { isAdminEmail } from '@/lib/admin';
import { webdavConfig } from '@/lib/webdav';

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const full = await prisma.user.findUnique({
    where: { id: user.id },
    select: { widgetToken: true, avatarUrl: true },
  });

  // 推断站点根地址(用于拼小组件 URL)
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const baseUrl = `${proto}://${host}`;

  // 备份区块只对站长显示（ADMIN_EMAIL 指定）
  const isAdmin = isAdminEmail(user.email);

  return (
    <>
      <Header userName={user.name} avatarUrl={user.avatarUrl} />
      <main className="mx-auto max-w-3xl px-4 py-6 space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">⚙️ 设置</h1>
          <Link href="/boards" className="text-sm text-gray-400 hover:text-gray-600">← 返回</Link>
        </div>

        <section className="card p-5 space-y-4">
          <div>
            <h2 className="font-semibold text-gray-800">👤 个人信息</h2>
            <p className="text-sm text-gray-500">登录邮箱:{user.email}</p>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-600">头像</h3>
            <AvatarForm name={user.name} avatarUrl={full?.avatarUrl ?? null} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-600">修改昵称</h3>
              <ProfileNameForm name={user.name} />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-600">修改邮箱</h3>
              <ProfileEmailForm email={user.email} />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-600">修改密码</h3>
              <ProfilePasswordForm />
            </div>
          </div>
        </section>

        <section className="card p-5 space-y-3">
          <h2 className="font-semibold text-gray-800">📱 小组件访问令牌</h2>
          <p className="text-sm text-gray-500">
            用于 iOS Scripting 小组件只读拉取你的最新留言和纪念日。令牌相当于只读密码,
            请勿分享;泄露后点「重置」即可作废旧令牌。
          </p>
          <TokenPanel token={full?.widgetToken ?? null} baseUrl={baseUrl} />
        </section>

        {isAdmin && (
          <section className="card p-5 space-y-3">
            <h2 className="font-semibold text-gray-800">💾 备份到 WebDAV（站长）</h2>
            <p className="text-sm text-gray-500">
              把全站数据导出成 JSON 传到你的网盘，照片只上传新增的那些。
              数据库备份保留最新 3 份，更早的会自动清理。
              备份文件含所有人的留言和密码哈希，请放在私有目录。
            </p>
            <BackupPanel configured={webdavConfig() !== null} />
          </section>
        )}

        {isAdmin && (
          <section className="card p-5 space-y-3">
            <h2 className="font-semibold text-gray-800">♻️ 从备份恢复（站长）</h2>
            <p className="text-sm text-gray-500">
              服务器换了或数据丢了，可以用网盘上的备份把全站数据还原回来。
              恢复是整库覆盖，执行前会自动把当前数据另存一份。
            </p>
            <RestorePanel configured={webdavConfig() !== null} />
          </section>
        )}
      </main>
    </>
  );
}
