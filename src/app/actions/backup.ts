'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { runBackup } from '@/lib/backup';
import { listBackups, previewRestore, runRestore, type RestorePreview } from '@/lib/restore';
import { destroySession } from '@/lib/auth';
import { webdavConfig, checkConnection } from '@/lib/webdav';

export type BackupState =
  | { error?: string; success?: string }
  | undefined;

export async function runBackupAction(): Promise<BackupState> {
  try {
    await requireAdmin();
  } catch {
    return { error: '只有站长能执行备份' };
  }

  try {
    const r = await runBackup();
    const bits = [
      `数据库已备份为 ${r.dbFile}`,
      `照片新增上传 ${r.photosUploaded} 张（已存在 ${r.photosSkipped} 张跳过）`,
    ];
    if (r.removedOld.length) bits.push(`清理旧备份 ${r.removedOld.length} 份`);
    if (r.failedPhotos.length) bits.push(`⚠️ ${r.failedPhotos.length} 张照片上传失败`);
    return { success: bits.join('；') };
  } catch (e) {
    return { error: e instanceof Error ? e.message : '备份失败' };
  }
}

export async function testWebdavAction(): Promise<BackupState> {
  try {
    await requireAdmin();
  } catch {
    return { error: '只有站长能执行此操作' };
  }

  const cfg = webdavConfig();
  if (!cfg) return { error: 'WebDAV 未配置：请设置 WEBDAV_URL / WEBDAV_USER / WEBDAV_PASSWORD' };
  try {
    await checkConnection(cfg);
    return { success: '连接正常，可以备份' };
  } catch (e) {
    return { error: `连不上：${e instanceof Error ? e.message : '未知错误'}` };
  }
}

// ── 恢复 ────────────────────────────────────────────────
// 恢复会整库覆盖，所以拆成两步：先 preview 让站长看清楚要换成什么，
// 再输入确认字样才真的执行。

export type RestoreListState =
  | { error?: string; files?: string[] }
  | undefined;

export async function listBackupsAction(): Promise<RestoreListState> {
  try {
    await requireAdmin();
  } catch {
    return { error: '只有站长能查看备份' };
  }
  try {
    return { files: await listBackups() };
  } catch (e) {
    return { error: e instanceof Error ? e.message : '读取备份列表失败' };
  }
}

export type PreviewState =
  | { error?: string; preview?: RestorePreview }
  | undefined;

export async function previewRestoreAction(
  _prev: PreviewState,
  fd: FormData,
): Promise<PreviewState> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: '只有站长能执行恢复' };
  }
  const file = String(fd.get('file') ?? '');
  if (!file) return { error: '请先选择一个备份文件' };
  try {
    return { preview: await previewRestore(file, admin.email) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : '读取备份失败' };
  }
}

export type RestoreState =
  | { error?: string; success?: string; loggedOut?: boolean }
  | undefined;

export async function runRestoreAction(
  _prev: RestoreState,
  fd: FormData,
): Promise<RestoreState> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: '只有站长能执行恢复' };
  }

  const file = String(fd.get('file') ?? '');
  const confirm = String(fd.get('confirm') ?? '').trim();
  if (!file) return { error: '请先选择一个备份文件' };
  // 覆盖全站数据这种事，光点一下按钮太容易手滑了
  if (confirm !== '恢复') return { error: '请在输入框里打「恢复」两个字以确认' };

  try {
    const r = await runRestore(file, admin.email);
    const bits = [
      `已用 ${r.file} 覆盖全站数据`,
      `用户 ${r.restored.users}、留言 ${r.restored.messages}、` +
        `留言板 ${r.restored.boards}、胶囊 ${r.restored.capsules}、纪念日 ${r.restored.anniversaries}`,
      `照片补回 ${r.photosDownloaded} 张`,
    ];
    if (r.photosMissing.length) bits.push(`⚠️ ${r.photosMissing.length} 张照片在网盘上找不到，会显示为裂图`);
    bits.push(`恢复前的数据已存到 ${r.snapshot}`);

    // 备份里没有这个账号 = 当前会话指向一个已经不存在的用户，
    // 留着 cookie 只会让人卡在"登录了但哪都进不去"的状态，直接清掉。
    if (!r.adminSurvives) {
      await destroySession();
      return {
        success: bits.join('；'),
        loggedOut: true,
      };
    }

    revalidatePath('/', 'layout');
    return { success: bits.join('；') };
  } catch (e) {
    return { error: e instanceof Error ? e.message : '恢复失败，数据未改动' };
  }
}
