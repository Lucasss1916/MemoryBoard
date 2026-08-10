'use client';
import { useActionState, useState } from 'react';
import { updateMessageAction, deleteMessageAction } from '@/app/actions/messages';
import { SubmitButton } from '@/components/SubmitButton';
import { Avatar } from '@/components/Avatar';
import { PhotoView } from '@/components/PhotoView';

type Msg = {
  id: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  authorName: string;
  authorAvatar: string | null;
};

export function MessageItem({ message, isMine }: { message: Msg; isMine: boolean }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updateMessageAction, undefined);

  const time = new Date(message.createdAt).toLocaleString('zh-CN', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar name={message.authorName} src={message.authorAvatar} size={28} />
          <span className="text-sm font-medium text-gray-700">{message.authorName}</span>
          <span className="text-xs text-gray-400">{time}</span>
        </div>
        {isMine && !editing && (
          <div className="flex gap-2 text-xs">
            <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-gray-600">编辑</button>
            <form action={deleteMessageAction.bind(null, message.id)}>
              <SubmitButton
                pendingText="删除中…"
                className="text-gray-400 hover:text-rose-500 disabled:opacity-50"
              >
                删除
              </SubmitButton>
            </form>
          </div>
        )}
      </div>

      {editing ? (
        <form
          action={async (fd) => { await action(fd); setEditing(false); }}
          className="mt-3 space-y-2"
        >
          <input type="hidden" name="id" value={message.id} />
          <textarea name="content" defaultValue={message.content} rows={3} className="input resize-none" />
          {state?.error && <p className="text-sm text-rose-500">{state.error}</p>}
          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={pending}>保存</button>
            <button type="button" onClick={() => setEditing(false)} className="btn btn-ghost">取消</button>
          </div>
        </form>
      ) : (
        <>
          {message.content && (
            <p className="mt-2 whitespace-pre-wrap text-gray-700">{message.content}</p>
          )}
          {message.imageUrl && (
            // 没存原图尺寸，先用固定高度占位：否则未加载的图高度为 0，
            // 浏览器会认为它们全在视口内，lazy 就失效了。
            <PhotoView
              src={message.imageUrl}
              className="mt-2 h-64 w-full rounded-lg bg-rose-50/60 object-cover"
            />
          )}
        </>
      )}
    </div>
  );
}
