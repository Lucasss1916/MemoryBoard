import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

// 专门用于「保存图片」的下载端点。
// 为什么不复用 /uploads/*：当 UPLOAD_DIR 在 public 里时（默认配置），
// Next 会把这些文件当静态资源直接服务，请求根本走不到路由，
// 也就没法带上 Content-Disposition，浏览器只会打开图片而不是存盘。
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
  { params }: { params: Promise<{ file: string[] }> },
) {
  const { file } = await params;
  const dir = path.resolve(process.cwd(), UPLOAD_DIR);
  const target = path.resolve(dir, ...file);

  // 防止路径穿越
  if (path.dirname(target) !== dir) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const ext = path.extname(target).toLowerCase();
  if (!MIME[ext]) return new NextResponse('Not Found', { status: 404 });

  try {
    const buf = await readFile(target);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': MIME[ext],
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        // 磁盘上的名字是随机串，存下来没法认，给个像样的文件名
        'Content-Disposition': `attachment; filename="memoryboard-${path.basename(target)}"`,
      },
    });
  } catch {
    return new NextResponse('Not Found', { status: 404 });
  }
}
