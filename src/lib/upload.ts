import 'server-only';
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';
import { MAX_IMAGE_BYTES, MAX_IMAGE_LABEL } from './constants';

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'public/uploads';
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_BYTES = MAX_IMAGE_BYTES;

// 保存上传的图片，返回可公开访问的相对路径 /uploads/xxx.ext
export async function saveImage(file: File): Promise<string> {
  if (!ALLOWED.includes(file.type)) {
    throw new Error('图片格式不支持（仅 jpg/png/webp/gif）');
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`图片太大（上限 ${MAX_IMAGE_LABEL}）`);
  }
  const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
  const name = `${Date.now()}-${randomBytes(6).toString('hex')}.${ext}`;
  const dir = path.join(process.cwd(), UPLOAD_DIR);
  await mkdir(dir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, name), buf);
  return `/uploads/${name}`;
}

// 删除一张上传的图（换头像时清理旧文件）。
// 只接受 /uploads/文件名 这种由 saveImage 生成的路径，且删除前再解析一次确认
// 没跑出上传目录——避免传进来的字符串被构造成 ../../ 之类。
export async function deleteUpload(publicPath: string): Promise<void> {
  const name = publicPath.replace(/^\/uploads\//, '');
  if (!name || name !== path.basename(name)) return;

  const dir = path.resolve(process.cwd(), UPLOAD_DIR);
  const target = path.resolve(dir, name);
  if (path.dirname(target) !== dir) return;

  // 文件不在了（手动删过、或备份恢复后对不上）不是错误，忽略即可
  await unlink(target).catch(() => {});
}
