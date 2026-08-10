import 'server-only';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { prisma } from './prisma';
import { getFile, listDir, putFile, ensureDir, webdavConfig, type WebdavConfig } from './webdav';
import { exportDatabase, DB_DIR, PHOTO_DIR } from './backup';

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'public/uploads';
// 恢复前的自动快照单独放，不进 db/：否则它会挤占那 3 个轮换名额，
// 连着恢复几次就能把真正的历史备份全顶掉。
const PRE_RESTORE_DIR = 'pre-restore';

export type RestorePreview = {
  file: string;
  exportedAt: string | null;
  counts: Record<string, number>;
  current: Record<string, number>;
  // 恢复后当前登录的这个人还在不在——不在就会被登出
  adminSurvives: boolean;
  missingPhotos: number;
};

export type RestoreResult = {
  file: string;
  restored: Record<string, number>;
  photosDownloaded: number;
  photosMissing: string[];
  snapshot: string;
  adminSurvives: boolean;
};

type Dump = {
  version?: number;
  exportedAt?: string;
  data?: Record<string, unknown[]>;
};

// 备份文件是从网盘拿的，不能默认它没坏。这里只做结构校验，
// 字段级的校验交给 Prisma——写不进去会整体回滚。
function parseDump(buf: Buffer, file: string): Required<Pick<Dump, 'data'>> & Dump {
  let json: Dump;
  try {
    json = JSON.parse(buf.toString('utf-8'));
  } catch {
    throw new Error(`${file} 不是合法的 JSON，可能传输中损坏了`);
  }
  if (!json || typeof json !== 'object' || !json.data) {
    throw new Error(`${file} 不像是本站的备份文件（缺 data 字段）`);
  }
  for (const t of TABLES) {
    if (!Array.isArray(json.data[t])) {
      throw new Error(`${file} 缺少 ${t} 数据，拒绝用它恢复`);
    }
  }
  return json as Required<Pick<Dump, 'data'>> & Dump;
}

// 顺序即依赖顺序：写入按这个序，删除按倒序。
const TABLES = ['users', 'boards', 'members', 'messages', 'capsules', 'anniversaries'] as const;
type Table = (typeof TABLES)[number];

export async function listBackups(): Promise<string[]> {
  const cfg = requireCfg();
  const files = await listDir(cfg, DB_DIR);
  return files
    .filter((n) => n.startsWith('memoryboard-') && n.endsWith('.json'))
    .sort()
    .reverse();
}

function requireCfg(): WebdavConfig {
  const cfg = webdavConfig();
  if (!cfg) throw new Error('WebDAV 未配置：请在 .env 里设置 WEBDAV_URL / WEBDAV_USER / WEBDAV_PASSWORD');
  return cfg;
}

// 日期字段在 JSON 里是字符串，Prisma 要 Date 对象
const DATE_FIELDS = new Set(['createdAt', 'updatedAt', 'joinedAt', 'unlockAt', 'date']);
function reviveDates<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = { ...row };
  for (const k of Object.keys(out)) {
    if (DATE_FIELDS.has(k) && typeof out[k] === 'string') out[k] = new Date(out[k] as string);
  }
  return out as T;
}

// 看一眼备份里有什么、跟现在差多少，但不动数据库。
export async function previewRestore(file: string, currentEmail: string): Promise<RestorePreview> {
  const cfg = requireCfg();
  const buf = await getFile(cfg, DB_DIR, safeName(file));
  if (!buf) throw new Error(`网盘上找不到 ${file}`);
  const dump = parseDump(buf, file);

  const counts: Record<string, number> = {};
  for (const t of TABLES) counts[t] = dump.data[t].length;

  const now = await exportDatabase();
  const users = dump.data.users as Array<{ email?: string }>;
  const adminSurvives = users.some(
    (u) => (u.email ?? '').trim().toLowerCase() === currentEmail.trim().toLowerCase(),
  );

  // 备份里引用了、但网盘 photos/ 下没有的图，恢复后会是裂图
  const referenced = collectPhotos(dump.data);
  const remote = new Set(await listDir(cfg, PHOTO_DIR));
  const missingPhotos = [...referenced].filter((n) => !remote.has(n)).length;

  return {
    file,
    exportedAt: dump.exportedAt ?? null,
    counts,
    current: now.counts as unknown as Record<string, number>,
    adminSurvives,
    missingPhotos,
  };
}

function collectPhotos(data: Record<string, unknown[]>): Set<string> {
  const names = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v === 'string' && v.startsWith('/uploads/')) {
      const n = v.slice('/uploads/'.length);
      if (n && n === path.basename(n)) names.add(n);
    }
  };
  for (const t of TABLES) {
    for (const row of data[t] as Array<Record<string, unknown>>) {
      add(row.imageUrl);
      add(row.avatarUrl);
    }
  }
  return names;
}

// 文件名是从界面选的，但仍当作不可信输入：只允许纯文件名。
function safeName(file: string): string {
  if (!file || file !== path.basename(file) || !/^memoryboard-[\w-]+\.json$/.test(file)) {
    throw new Error('备份文件名不合法');
  }
  return file;
}

export async function runRestore(file: string, currentEmail: string): Promise<RestoreResult> {
  const cfg = requireCfg();
  const name = safeName(file);

  const buf = await getFile(cfg, DB_DIR, name);
  if (!buf) throw new Error(`网盘上找不到 ${file}`);
  const dump = parseDump(buf, file);

  // ── 1. 先给"现在"留一份后悔药 ──
  // 恢复是不可逆操作，万一选错了文件，起码还能把当前数据找回来。
  const snapshot = await snapshotCurrent(cfg);

  // ── 2. 整库替换，全程一个事务 ──
  // 中途失败会整体回滚，不会留下"删了一半"的库。
  const restored: Record<string, number> = {};
  await prisma.$transaction(async (tx) => {
    // 删除按依赖倒序：先删叶子再删根，避免外键报错
    await tx.anniversary.deleteMany();
    await tx.timeCapsule.deleteMany();
    await tx.message.deleteMany();
    await tx.boardMember.deleteMany();
    await tx.board.deleteMany();
    await tx.user.deleteMany();

    // 写入按正序：父行先就位，子行的外键才有指向
    const d = dump.data;
    const rows = (t: Table) => (d[t] as Array<Record<string, unknown>>).map(reviveDates);
    restored.users = (await tx.user.createMany({ data: rows('users') as never })).count;
    restored.boards = (await tx.board.createMany({ data: rows('boards') as never })).count;
    restored.members = (await tx.boardMember.createMany({ data: rows('members') as never })).count;
    restored.messages = (await tx.message.createMany({ data: rows('messages') as never })).count;
    restored.capsules = (await tx.timeCapsule.createMany({ data: rows('capsules') as never })).count;
    restored.anniversaries = (await tx.anniversary.createMany({ data: rows('anniversaries') as never })).count;
  }, { timeout: 120_000 }).catch((e) => {
    // 事务已整体回滚，原数据没动。Prisma 的原始报错（外键约束之类）
    // 对站长没有意义，换成一句能看懂的。
    // Prisma 把真正的原因放在多行报错的最后一行（如"Foreign key constraint violated"）
    const lines = e instanceof Error ? e.message.split('\n').map((l) => l.trim()).filter(Boolean) : [];
    const detail = lines[lines.length - 1] ?? '';
    throw new Error(
      `备份文件的数据对不上，恢复已中止，原数据未受影响。${detail ? `（${detail.trim()}）` : ''}`,
    );
  });

  // ── 3. 把备份里引用到的照片拉回本地 ──
  // 放在事务后面：照片缺几张只是裂图，不值得让整库恢复回滚。
  const { downloaded, missing } = await restorePhotos(cfg, collectPhotos(dump.data));

  const users = dump.data.users as Array<{ email?: string }>;
  const adminSurvives = users.some(
    (u) => (u.email ?? '').trim().toLowerCase() === currentEmail.trim().toLowerCase(),
  );

  return { file, restored, photosDownloaded: downloaded, photosMissing: missing, snapshot, adminSurvives };
}

async function snapshotCurrent(cfg: WebdavConfig): Promise<string> {
  const dump = await exportDatabase();
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const name = `before-restore-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.json`;
  await ensureDir(cfg, PRE_RESTORE_DIR);
  await putFile(cfg, Buffer.from(JSON.stringify(dump, null, 2), 'utf-8'), PRE_RESTORE_DIR, name);
  return `${PRE_RESTORE_DIR}/${name}`;
}

// 只补本地没有的照片。已经在本地的不重复下载——文件名含时间戳且内容不可变，
// 和备份时的增量判断是同一个道理。
async function restorePhotos(cfg: WebdavConfig, wanted: Set<string>) {
  const dir = path.resolve(process.cwd(), UPLOAD_DIR);
  await mkdir(dir, { recursive: true });

  const remote = new Set(await listDir(cfg, PHOTO_DIR));
  let local: Set<string>;
  try {
    const { readdir } = await import('fs/promises');
    local = new Set((await readdir(dir)).filter((n) => !n.startsWith('.')));
  } catch {
    local = new Set();
  }

  let downloaded = 0;
  const missing: string[] = [];
  for (const name of wanted) {
    if (local.has(name)) continue;
    if (!remote.has(name)) { missing.push(name); continue; }
    try {
      const buf = await getFile(cfg, PHOTO_DIR, name);
      if (!buf) { missing.push(name); continue; }
      await writeFile(path.join(dir, name), buf);
      downloaded++;
    } catch {
      missing.push(name);
    }
  }
  return { downloaded, missing };
}
