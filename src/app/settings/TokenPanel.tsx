'use client';
import { useState } from 'react';
import { regenerateWidgetTokenAction } from '@/app/actions/widget';

export function TokenPanel({ token, baseUrl }: { token: string | null; baseUrl: string }) {
  const [copied, setCopied] = useState('');
  const url = token ? `${baseUrl}/api/widget?token=${token}` : '';

  const copy = async (text: string, tag: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(() => setCopied(''), 1500);
    } catch {}
  };

  return (
    <div className="space-y-3">
      {token ? (
        <>
          <div>
            <label className="mb-1 block text-xs text-gray-500">小组件接口 URL</label>
            <div className="flex gap-2">
              <input readOnly value={url} className="input font-mono text-xs" onFocus={(e) => e.target.select()} />
              <button onClick={() => copy(url, 'url')} className="btn btn-ghost shrink-0">
                {copied === 'url' ? '已复制' : '复制'}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-400">在 Scripting 小组件里 fetch 这个地址即可。</p>
          </div>
          <form action={regenerateWidgetTokenAction}>
            <button className="btn btn-ghost text-rose-500">重置令牌</button>
          </form>
        </>
      ) : (
        <form action={regenerateWidgetTokenAction}>
          <button className="btn btn-primary">生成令牌</button>
        </form>
      )}
    </div>
  );
}
