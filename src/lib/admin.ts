import 'server-only';
import { requireUser } from './auth';

// 站长身份靠环境变量 ADMIN_EMAIL 指定，不进数据库。
// 想换人改 .env 重启即可；没设置就是「没有站长」，备份入口对所有人关闭。
export function adminEmail(): string | null {
  const v = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return v ? v : null;
}

export function isAdminEmail(email: string): boolean {
  const admin = adminEmail();
  return admin !== null && email.trim().toLowerCase() === admin;
}

// 要求当前用户是站长，否则抛错。备份接口涉及全站数据，必须挡住普通用户。
export async function requireAdmin() {
  const user = await requireUser();
  if (!isAdminEmail(user.email)) throw new Error('FORBIDDEN_NOT_ADMIN');
  return user;
}
