'use client';
import { useActionState, useRef, useState } from 'react';
import { createMessageAction } from '@/app/actions/messages';
import { compressImage, ImageTooLargeError } from '@/lib/image';

export function PostBox({ boardId }: { boardId: string }) {
  const [state, action, pending] = useActionState(createMessageAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  // 压缩后的照片：提交时用它替换掉原始的大文件
  const [image, setImage] = useState<File | null>(null);
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  function reset() {
    formRef.current?.reset();
    setPreview((url) => { if (url) URL.revokeObjectURL(url); return null; });
    setImage(null);
    setFailed(null);
  }

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        if (image) fd.set('image', image);
        else fd.delete('image');
        try {
          await action(fd);
          reset();
        } catch {
          // 请求体被网关拒掉等情况：给出人话提示，别让整页崩成 Application error
          setFailed('照片没能上传成功，可能是图片太大或网络中断，换一张再试试');
        }
      }}
      className="card p-4 space-y-3"
    >
      <input type="hidden" name="boardId" value={boardId} />
      <textarea
        name="content"
        rows={3}
        placeholder="写下此刻的点滴…"
        className="input resize-none"
      />
      {preview && (
        <img src={preview} alt="预览" className="max-h-48 rounded-lg object-cover" />
      )}
      <div className="flex items-center justify-between">
        <label className="btn btn-ghost cursor-pointer">
          {working ? '处理中…' : '📷 添加照片'}
          <input
            type="file"
            name="image"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              setFailed(null);
              if (!f) { setImage(null); setPreview(null); return; }
              setWorking(true);
              try {
                // 先压缩再预览，预览的就是真正会上传的那张
                const small = await compressImage(f);
                setImage(small);
                setPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(small); });
              } catch (err) {
                // 解不开的巨图：当场拦下并说清楚，别等传上去才发现是张裂图
                setImage(null);
                setPreview((old) => { if (old) URL.revokeObjectURL(old); return null; });
                e.target.value = '';
                setFailed(err instanceof ImageTooLargeError ? err.message : '这张图片处理失败，换一张试试');
              } finally {
                setWorking(false);
              }
            }}
          />
        </label>
        <button className="btn btn-primary" disabled={pending || working}>
          {pending ? '发布中…' : '发布'}
        </button>
      </div>
      {(failed || state?.error) && (
        <p className="text-sm text-rose-500">{failed ?? state?.error}</p>
      )}
    </form>
  );
}
