'use client';
import { useActionState, useRef, useState } from 'react';
import { updateAvatarAction, removeAvatarAction } from '@/app/actions/profile';
import { compressAvatar, ImageTooLargeError } from '@/lib/image';
import { Avatar } from '@/components/Avatar';
import { SubmitButton } from '@/components/SubmitButton';

export function AvatarForm({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const [state, action, pending] = useActionState(updateAvatarAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-4">
      <Avatar name={name} src={preview ?? avatarUrl} size={64} />

      <form
        ref={formRef}
        action={async (fd) => {
          if (!file) { setFailed('请先选择一张图片'); return; }
          fd.set('avatar', file);
          try {
            await action(fd);
            setFile(null);
            setPreview((u) => { if (u) URL.revokeObjectURL(u); return null; });
            formRef.current?.reset();
          } catch {
            setFailed('头像没能上传成功，换一张再试试');
          }
        }}
        className="space-y-2"
      >
        <div className="flex flex-wrap items-center gap-2">
          <label className="btn btn-ghost cursor-pointer">
            {working ? '处理中…' : '选择图片'}
            <input
              type="file"
              name="avatar"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                setFailed(null);
                if (!f) { setFile(null); return; }
                setWorking(true);
                try {
                  // 头像压到 256px，几十 KB 就够，顺便避开上传体积限制
                  const small = await compressAvatar(f);
                  setFile(small);
                  setPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(small); });
                } catch (err) {
                  setFile(null);
                  setPreview((old) => { if (old) URL.revokeObjectURL(old); return null; });
                  e.target.value = '';
                  setFailed(err instanceof ImageTooLargeError ? err.message : '这张图片处理失败，换一张试试');
                } finally {
                  setWorking(false);
                }
              }}
            />
          </label>
          <button className="btn btn-primary" disabled={pending || working || !file}>
            {pending ? '上传中…' : '保存头像'}
          </button>
        </div>
        {(failed || state?.error) && (
          <p className="text-sm text-rose-500">{failed ?? state?.error}</p>
        )}
        {state?.success && <p className="text-sm text-emerald-600">{state.success}</p>}
      </form>

      {avatarUrl && (
        <form action={removeAvatarAction}>
          <SubmitButton pendingText="移除中…" className="text-xs text-gray-400 hover:text-rose-500 disabled:opacity-50">
            移除头像
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
