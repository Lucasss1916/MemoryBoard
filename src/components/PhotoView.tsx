'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// 留言墙里的缩略图是 object-cover 裁过的，边上看不全；点开看原图 + 能存下来。
export function PhotoView({ src, className }: { src: string; className?: string }) {
  const [open, setOpen] = useState(false);
  // 弹层要挂到 body 上（见下方 createPortal），服务端渲染时没有 document，
  // 所以等挂载完成再渲染。
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // 打开时锁掉背景滚动，否则手机上滑动会连着底下的列表一起动
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onClick={() => setOpen(true)}
        className={`${className ?? ''} cursor-zoom-in`}
      />

      {/* 必须挂到 body：留言卡片用了 backdrop-blur，那会生成新的层叠上下文，
          把弹层的 z-50 关在卡片内部——结果就是顶栏(z-10)反而盖在弹层上面，
          点顶栏那一条区域关不掉弹层。挂到 body 就绕开了所有祖先层叠上下文。 */}
      {open && mounted && createPortal(
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
        >
          {/* 图本身不该关闭弹层：想长按保存的时候点到图上就没了会很烦 */}
          <img
            src={src}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-lg object-contain"
          />

          {/* 这层横跨整个宽度，不能让它吃掉点击：否则点两侧空白关不掉弹层。
              pointer-events 只在真正的按钮上打开。 */}
          <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center gap-3">
            {/* 走 /api/download：那条路由会回 Content-Disposition: attachment。
                直接链原图不行——图片是静态资源，浏览器会打开而不是存盘 */}
            <a
              href={src.replace(/^\/uploads\//, '/api/download/')}
              download
              onClick={(e) => e.stopPropagation()}
              className="pointer-events-auto rounded-full bg-white/90 px-5 py-2 text-sm font-medium text-gray-800 hover:bg-white"
            >
              ⬇️ 保存图片
            </a>
            <button
              onClick={() => setOpen(false)}
              className="pointer-events-auto rounded-full bg-white/20 px-5 py-2 text-sm text-white hover:bg-white/30"
            >
              关闭
            </button>
          </div>

          <p className="pointer-events-none absolute inset-x-0 top-5 text-center text-xs text-white/60">
            手机上可长按图片保存
          </p>
        </div>,
        document.body,
      )}
    </>
  );
}
