// 有头像就显示图，没有就退回昵称首字母——和原来的样式保持一致。
export function Avatar({
  name, src, size = 28,
}: { name: string; src?: string | null; size?: number }) {
  const style = { width: size, height: size };
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        loading="lazy"
        decoding="async"
        style={style}
        className="shrink-0 rounded-full bg-rose-100 object-cover"
      />
    );
  }
  return (
    <div
      style={{ ...style, fontSize: Math.max(10, Math.round(size * 0.42)) }}
      className="flex shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-500"
    >
      {name.slice(0, 1)}
    </div>
  );
}
