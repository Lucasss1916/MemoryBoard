import 'server-only';
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { prisma } from './prisma';
import {
  webdavConfig, ensureDir, putFile, deleteFile, listDir, type WebdavConfig,
} from './webdav';

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'public/uploads';
// 恢复流程要用同样的目录名和导出格式，一并导出
export const DB_DIR = 'db';
export const PHOTO_DIR = 'photos';
// 数据库备份保留份数：只留最新 3 份，旧的自动删。
const KEEP_DB_COPIES = 3;

export type BackupResult = {
  dbFile: string;
  photosUploaded: number;
  photosSkipped: number;
  removedOld: string[];
  failedPhotos: string[];
};

// 导出全库为 JSON。密码哈希也带上——恢复后大家还能用原密码登录；
// 这也意味着备份文件本身等同于敏感数据，WebDAV 那头要放在私有目录。
export async function exportDatabase() {
  const [users, boards, members, messages, capsules, anniversaries] = await Promise.all([
    prisma.user.findMany(),
    prisma.board.findMany(),
    prisma.boardMember.findMany(),
    prisma.message.findMany(),
    prisma.timeCapsule.findMany(),
    prisma.anniversary.findMany(),
  ]);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    counts: {
      users: users.length, boards: boards.length, members: members.length,
      messages: messages.length, capsules: capsules.length, anniversaries: anniversaries.length,
    },
    data: { users, boards, members, messages, capsules, anniversaries },
  };
}

function stamp(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export async function runBackup(): Promise<BackupResult> {
  const cfg = webdavConfig();
  if (!cfg) throw new Error('WebDAV 未配置：请在 .env 里设置 WEBDAV_URL / WEBDAV_USER / WEBDAV_PASSWORD');

  await ensureDir(cfg);
  await ensureDir(cfg, DB_DIR);
  await ensureDir(cfg, PHOTO_DIR);

  // ── 1. 数据库：整库导出，保留最新 3 份 ──
  const dump = await exportDatabase();
  const dbFile = `memoryboard-${stamp()}.json`;
  await putFile(cfg, Buffer.from(JSON.stringify(dump, null, 2), 'utf-8'), DB_DIR, dbFile);

  const removedOld = await rotateDbBackups(cfg);

  // ── 2. 照片：增量，只传远端没有的 ──
  const { uploaded, skipped, failed } = await syncPhotos(cfg);

  return {
    dbFile,
    photosUploaded: uploaded,
    photosSkipped: skipped,
    removedOld,
    failedPhotos: failed,
  };
}

// 只保留最新的 KEEP_DB_COPIES 份。文件名里带时间戳，按名字倒序就是按时间倒序。
async function rotateDbBackups(cfg: WebdavConfig): Promise<string[]> {
  const files = (await listDir(cfg, DB_DIR))
    .filter((n) => n.startsWith('memoryboard-') && n.endsWith('.json'))
    .sort()
    .reverse();

  const stale = files.slice(KEEP_DB_COPIES);
  const removed: string[] = [];
  for (const f of stale) {
    // 删旧备份失败不该让整次备份算失败——新备份已经传上去了
    try {
      await deleteFile(cfg, DB_DIR, f);
      removed.push(f);
    } catch {}
  }
  return removed;
}

// 增量同步：列一次远端已有文件，只上传本地多出来的那些。
// 照片文件名是「时间戳-随机」且从不改内容，所以「名字在 = 内容一样」成立，
// 不必比对哈希。
async function syncPhotos(cfg: WebdavConfig) {
  const dir = path.resolve(process.cwd(), UPLOAD_DIR);
  let local: string[];
  try {
    local = (await readdir(dir, { withFileTypes: true }))
      .filter((e) => e.isFile() && !e.name.startsWith('.'))
      .map((e) => e.name);
  } catch {
    return { uploaded: 0, skipped: 0, failed: [] as string[] };
  }

  const remote = new Set(await listDir(cfg, PHOTO_DIR));
  let uploaded = 0;
  let skipped = 0;
  const failed: string[] = [];

  for (const name of local) {
    if (remote.has(name)) { skipped++; continue; }
    try {
      const buf = await readFile(path.join(dir, name));
      await putFile(cfg, buf, PHOTO_DIR, name);
      uploaded++;
    } catch {
      // 单张失败不中断整体，最后一并报告
      failed.push(name);
    }
  }
  return { uploaded, skipped, failed };
}
