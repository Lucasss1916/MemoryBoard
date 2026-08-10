'use client';
// 兜底：留言板页面里任何一处崩了，至少给个能点「重试」的界面，
// 而不是整页白屏 + "Application error: a client-side exception has occurred"。
export default function BoardError({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-center">
      <p className="text-4xl">😵‍💫</p>
      <h1 className="mt-3 text-lg font-semibold text-gray-800">这一页没能加载出来</h1>
      <p className="mt-2 text-sm text-gray-500">
        如果刚刚在上传照片，多半是图片太大被网关拦下了，换张小一点的再试。
      </p>
      {error.digest && (
        <p className="mt-1 text-xs text-gray-400">错误编号：{error.digest}</p>
      )}
      <div className="mt-5 flex justify-center gap-2">
        <button onClick={reset} className="btn btn-primary">重试</button>
        <a href="/boards" className="btn btn-ghost">返回全部留言板</a>
      </div>
    </main>
  );
}
