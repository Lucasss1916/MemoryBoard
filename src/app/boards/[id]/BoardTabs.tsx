'use client';
import { useState } from 'react';

const TABS = [
  { key: 'wall', label: '💬 留言墙' },
  { key: 'capsule', label: '🔒 时间胶囊' },
  { key: 'anniv', label: '🎈 纪念日' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function BoardTabs({
  wall, capsule, anniv,
}: {
  wall: React.ReactNode;
  capsule: React.ReactNode;
  anniv: React.ReactNode;
}) {
  const [tab, setTab] = useState<TabKey>('wall');
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`btn ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div>
        {tab === 'wall' && wall}
        {tab === 'capsule' && capsule}
        {tab === 'anniv' && anniv}
      </div>
    </div>
  );
}
