import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

// 缩略图 / 低画质图路由:GET /thumb/<相对路径>?w=<宽度>
// 用 sharp 把 public/uploads 里的原图实时压成小 webp,给 iOS 小组件用,
// 避免直接加载原图过慢。放在独立路径上,不会被 Next 的静态文件处理抢先(那样会丢掉 ?w 查询)。
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'public/uploads';

// 只允许几个离散宽度,避免被任意尺寸打爆 CPU
const ALLOWED_WIDTHS = [64, 128, 200, 320, 480, 640, 800];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ file: string[] }> }
) {
  const { file } = await params;
  const dir = path.join(process.cwd(), UPLOAD_DIR);
  const target = path.join(dir, ...file);

  // 防止路径穿越
  if (!path.resolve(target).startsWith(path.resolve(dir) + path.sep)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const wRaw = Number(req.nextUrl.searchParams.get('w') ?? '200');
  const w = ALLOWED_WIDTHS.reduce((a, b) =>
    Math.abs(b - wRaw) < Math.abs(a - wRaw) ? b : a
  );

  try {
    const buf = await readFile(target);
    const ext = path.extname(target).toLowerCase();

    // gif 保持原图,避免丢失动画
    if (ext === '.gif') {
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'image/gif',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    const out = await sharp(buf)
      .rotate() // 依 EXIF 摆正
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer();

    return new NextResponse(new Uint8Array(out), {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse('Not Found', { status: 404 });
  }
}
