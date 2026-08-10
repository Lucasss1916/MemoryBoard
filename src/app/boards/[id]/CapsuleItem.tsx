'use client';
import { deleteCapsuleAction } from '@/app/actions/capsules';
import { PhotoView } from '@/components/PhotoView';
import { SubmitButton } from '@/components/SubmitButton';

export type CapsuleView = {
  id: string;
  title: string;
  content: string;
  imageUrl: string | null;
  unlockAt: string;
  authorName: string;
  pending: boolean; // 作者本人尚未解锁的胶囊（他人此时根本看不到这条）
  isMine: boolean;
};

export function CapsuleItem({ capsule }: { capsule: CapsuleView }) {
  const unlock = new Date(capsule.unlockAt).toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const days = Math.max(
    0,
    Math.ceil((new Date(capsule.unlockAt).getTime() - Date.now()) / 86400000)
  );

  return (
    <div className={`card p-4 ${capsule.pending ? 'bg-amber-50/70' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{capsule.pending ? '🕰️' : '📬'}</span>
          <span className="font-semibold text-gray-800">{capsule.title}</span>
        </div>
        {capsule.isMine && (
          <form action={deleteCapsuleAction.bind(null, capsule.id)}>
            <SubmitButton
              pendingText="删除中…"
              className="text-xs text-gray-400 hover:text-rose-500 disabled:opacity-50"
            >
              删除
            </SubmitButton>
          </form>
        )}
      </div>

      {capsule.pending && (
        <p className="mt-2 rounded-md bg-amber-100/70 px-2 py-1 text-xs text-amber-700">
          🔒 封存中 · {unlock} 解锁(还有 {days} 天)。此前只有你能看到,同板其他人到期后才会看到这条。
        </p>
      )}

      <p className="mt-2 text-xs text-gray-400">
        {capsule.authorName} · {capsule.pending ? '待解锁' : `${unlock} 已解锁`}
      </p>
      {capsule.content && (
        <p className="mt-2 whitespace-pre-wrap text-gray-700">{capsule.content}</p>
      )}
      {capsule.imageUrl && (
        <PhotoView
          src={capsule.imageUrl}
          className="mt-2 h-64 w-full rounded-lg bg-rose-50/60 object-cover"
        />
      )}
    </div>
  );
}
