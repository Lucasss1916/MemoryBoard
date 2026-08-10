import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildWidgetData } from '@/lib/widget';

export const dynamic = 'force-dynamic';

// 只读接口:GET /api/widget?token=xxx
// 供 iOS Scripting 小组件拉取「当前用户可见」的最新留言与临近纪念日
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'missing token' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { widgetToken: token },
    select: { id: true, name: true },
  });
  if (!user) {
    return NextResponse.json({ error: 'invalid token' }, { status: 401 });
  }

  const limitRaw = Number(req.nextUrl.searchParams.get('limit') ?? '10');
  const limit = Math.min(Math.max(1, isNaN(limitRaw) ? 10 : limitRaw), 30);

  // 把「用户实际访问的域名/协议」从请求头传给组装逻辑,确保 imageUrl 是能直接访问的绝对地址
  const data = await buildWidgetData(user.id, limit, {
    proto: req.headers.get('x-forwarded-proto') ?? undefined,
    host: req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? undefined,
  });

  return NextResponse.json(
    { user: user.name, ...data },
    {
      headers: {
        // 允许小组件跨域读取;只读接口无副作用
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    }
  );
}
