// 浏览器端图片压缩：手机照片动辄十几 MB，直接提交会被 Nginx / Server Action
// 的请求体上限拦掉，页面只会弹一句 "Application error"。这里在上传前把照片
// 缩到长边 1600px 的 JPEG，既避开上限，也省流量。
// 1600px 足够铺满手机屏和大多数桌面浏览，再大只是白白多传字节。
const MAX_DIMENSION = 1600;
// 目标 1MB：留言墙一屏能有十几张图，单张再大整页就拖不动了。
const TARGET_BYTES = 1024 * 1024;
const QUALITIES = [0.82, 0.72, 0.62, 0.5, 0.4];

// 压不动就原样上传是不行的：手机相机的 1 亿像素照片体积可能只有几 MB，
// 能传上去，但手机浏览器解码不了那么大的位图，最后就是"上传成功却显示裂图"。
// 所以像素数超过这个上限时，宁可报错也不让它传上去。
const MAX_PIXELS = 40_000_000;

// 压缩失败分两种，给的建议不一样，所以分开报
export class ImageTooLargeError extends Error {
  constructor(reason: 'size' | 'decode' = 'size') {
    super(
      reason === 'decode'
        ? '这张图浏览器打不开（iPhone 的 HEIC 格式常见于此），请在相册里导出成 JPG 再传'
        : '这张图尺寸太大，浏览器处理不了，换一张或先用系统相册导出一份小图再传',
    );
    this.name = 'ImageTooLargeError';
  }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

type Decoded = { source: CanvasImageSource; width: number; height: number; close: () => void };

// 解码分两条路：createImageBitmap 快且不占 DOM，但在部分浏览器上对超大图会
// 直接抛 OOM；<img> 那条慢一些，却能解 Safari 的 HEIC，也更容易扛住大图。
// 两条都试过再放弃。
async function decode(file: File): Promise<Decoded | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file);
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      // 落到下面的 <img> 方案
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode failed'));
      el.src = url;
    });
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('empty');
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }
}

export async function compressImage(
  file: File,
  { maxDimension = MAX_DIMENSION, targetBytes = TARGET_BYTES } = {},
): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  // GIF 可能是动图，转 canvas 只会留下第一帧，原样放行。
  // 体积超标时由服务端按 8MB 上限给出明确提示。
  if (file.type === 'image/gif') return file;

  const decoded = await decode(file);
  if (!decoded) {
    // 两条解码路都失败。小图交给服务端按格式判断（能给出"格式不支持"这种
    // 准话）；大图则是解码不了的巨图，直接拦下，别让它变成一张裂图。
    if (file.size > targetBytes) throw new ImageTooLargeError('decode');
    return file;
  }

  const { source, width, height, close } = decoded;
  try {
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    // 尺寸和体积都已达标，不用动
    if (scale === 1 && file.size <= targetBytes) return file;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      if (width * height > MAX_PIXELS) throw new ImageTooLargeError();
      return file;
    }
    // JPEG 没有透明通道，先铺白底，免得透明区域变成黑块
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

    const name = file.name.replace(/\.[^.]+$/, '') || 'photo';
    let last: Blob | null = null;
    for (const q of QUALITIES) {
      const blob = await toBlob(canvas, q);
      if (!blob) break;
      last = blob;
      if (blob.size <= targetBytes) break;
    }

    if (!last) {
      // 画布导不出（多半是超大图爆了内存），这时原图更传不得
      if (width * height > MAX_PIXELS) throw new ImageTooLargeError();
      return file;
    }

    // 只有在「没缩过尺寸」时才允许退回原图。缩过就必须用新图——原图可能是
    // 一张浏览器根本解不开的巨图，退回去等于把裂图传上服务器。
    if (scale === 1 && last.size >= file.size) return file;

    return new File([last], `${name}.jpg`, { type: 'image/jpeg' });
  } finally {
    close();
  }
}

// 头像只会显示成几十像素的小圆图，256px / 150KB 足够，传大图纯属浪费。
export function compressAvatar(file: File): Promise<File> {
  return compressImage(file, { maxDimension: 256, targetBytes: 150 * 1024 });
}
