import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

// 生产模式(standalone)下,Next 只服务构建时就在 public/ 里的文件,
// 运行时上传的图片不会被静态服务,所以用这个路由从磁盘读取并返回。
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'public/uploads';

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ file: string[] }> }
) {
  const { file } = await params;
  const dir = path.join(process.cwd(), UPLOAD_DIR);
  const target = path.join(dir, ...file);

  // 防止路径穿越
  if (!path.resolve(target).startsWith(path.resolve(dir) + path.sep)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    const buf = await readFile(target);
    const type = MIME[path.extname(target).toLowerCase()] || 'application/octet-stream';
    const headers: Record<string, string> = {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=31536000, immutable',
      // 图片是用户上传的，别让浏览器猜类型去执行它
      'X-Content-Type-Options': 'nosniff',
    };
    return new NextResponse(new Uint8Array(buf), { headers });
  } catch {
    return new NextResponse('Not Found', { status: 404 });
  }
}
