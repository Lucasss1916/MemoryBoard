'use client';
import { useActionState, useState } from 'react';
import { createBoardAction, joinBoardAction } from '@/app/actions/boards';
import { BOARD_KINDS } from '@/lib/constants';

export function CreateJoin() {
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [createState, createAct, creating] = useActionState(createBoardAction, undefined);
  const [joinState, joinAct, joining] = useActionState(joinBoardAction, undefined);

  return (
    <div className="card p-5">
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setTab('create')}
          className={`btn ${tab === 'create' ? 'btn-primary' : 'btn-ghost'}`}
        >
          + 新建留言板
        </button>
        <button
          onClick={() => setTab('join')}
          className={`btn ${tab === 'join' ? 'btn-primary' : 'btn-ghost'}`}
        >
          用邀请码加入
        </button>
      </div>

      {tab === 'create' ? (
        <form action={createAct} className="space-y-3">
          <input name="name" placeholder="留言板名称，如「我们俩」" className="input" required />
          <div>
            <p className="mb-1.5 text-xs text-gray-500">身份类型</p>
            <div className="flex flex-wrap gap-2">
              {BOARD_KINDS.map((k, i) => (
                <label key={k.value} className="cursor-pointer">
                  <input
                    type="radio"
                    name="kind"
                    value={k.value}
                    defaultChecked={i === 0}
                    className="peer sr-only"
                  />
                  <span className="btn btn-ghost peer-checked:bg-rose-500 peer-checked:text-white peer-checked:border-rose-500">
                    {k.emoji} {k.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
          {createState?.error && <p className="text-sm text-rose-500">{createState.error}</p>}
          <button className="btn btn-primary" disabled={creating}>
            {creating ? '创建中…' : '创建'}
          </button>
        </form>
      ) : (
        <form action={joinAct} className="space-y-3">
          <input name="code" placeholder="输入 8 位邀请码" className="input uppercase" required />
          {joinState?.error && <p className="text-sm text-rose-500">{joinState.error}</p>}
          <button className="btn btn-primary" disabled={joining}>
            {joining ? '加入中…' : '加入'}
          </button>
        </form>
      )}
    </div>
  );
}
