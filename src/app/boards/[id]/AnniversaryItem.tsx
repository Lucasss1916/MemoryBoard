'use client';
import { deleteAnniversaryAction } from '@/app/actions/anniversaries';
import { SubmitButton } from '@/components/SubmitButton';

export type AnniversaryView = {
  id: string;
  title: string;
  date: string;
  yearly: boolean;
  daysUntil: number;
  years: number;
};

export function AnniversaryItem({ ann }: { ann: AnniversaryView }) {
  const dateStr = new Date(ann.date).toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const badge =
    ann.daysUntil === 0 ? '就是今天 🎉' : `还有 ${ann.daysUntil} 天`;

  return (
    <div className="card flex items-center justify-between p-4">
      <div>
        <p className="font-semibold text-gray-800">🎈 {ann.title}</p>
        <p className="mt-1 text-xs text-gray-400">
          {dateStr}
          {ann.yearly && ann.years > 0 && ` · 已 ${ann.years} 周年`}
          {ann.yearly ? ' · 每年' : ''}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-sm ${ann.daysUntil === 0 ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-500'}`}>
          {badge}
        </span>
        <form action={deleteAnniversaryAction.bind(null, ann.id)}>
          <SubmitButton
            pendingText="删除中…"
            className="text-xs text-gray-400 hover:text-rose-500 disabled:opacity-50"
          >
            删除
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
