'use client';
import { useActionState, useRef, useState } from 'react';
import { createCapsuleAction } from '@/app/actions/capsules';
import { compressImage, ImageTooLargeError } from '@/lib/image';

export function CapsuleForm({ boardId }: { boardId: string }) {
  const [state, action, pending] = useActionState(createCapsuleAction, undefined);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // 压缩后的照片：和留言墙一样，避免大图撑爆请求体
  const [image, setImage] = useState<File | null>(null);
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  // 默认解锁日期设为一年后
  const oneYear = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn-primary w-full">
        🔒 封存一个时间胶囊
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        if (image) fd.set('image', image);
        else fd.delete('image');
        try {
          await action(fd);
          formRef.current?.reset();
          setImage(null);
          setFailed(null);
        } catch {
          setFailed('照片没能上传成功，可能是图片太大或网络中断，换一张再试试');
        }
      }}
      className="card p-4 space-y-3"
    >
      <input type="hidden" name="boardId" value={boardId} />
      <input name="title" placeholder="标题,如「给一年后的我们」" className="input" required />
      <textarea name="content" rows={4} placeholder="写下想留给未来的话…" className="input resize-none" required />
      <div>
        <label className="mb-1 block text-xs text-gray-500">解锁日期(到期前只有你能看)</label>
        <input name="unlockAt" type="date" defaultValue={oneYear} className="input" required />
      </div>
      <label className="btn btn-ghost cursor-pointer">
        {working ? '处理中…' : '📷 附一张照片'}
        <input
          type="file"
          name="image"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            setFailed(null);
            if (!f) { setImage(null); return; }
            setWorking(true);
            try {
              setImage(await compressImage(f));
            } catch (err) {
              setImage(null);
              e.target.value = '';
              setFailed(err instanceof ImageTooLargeError ? err.message : '这张图片处理失败，换一张试试');
            } finally {
              setWorking(false);
            }
          }}
        />
      </label>
      {(failed || state?.error) && (
        <p className="text-sm text-rose-500">{failed ?? state?.error}</p>
      )}
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={pending || working}>{pending ? '封存中…' : '封存'}</button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">取消</button>
      </div>
    </form>
  );
}
