'use client';
import { useActionState, useEffect, useState } from 'react';
import {
  listBackupsAction, previewRestoreAction, runRestoreAction,
  type PreviewState, type RestoreState,
} from '@/app/actions/backup';

const LABELS: Record<string, string> = {
  users: '用户', boards: '留言板', members: '成员',
  messages: '留言', capsules: '时间胶囊', anniversaries: '纪念日',
};

// memoryboard-20260810-143555.json → 2026-08-10 14:35:55
function prettyName(f: string) {
  const m = /^memoryboard-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.json$/.exec(f);
  if (!m) return f;
  return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}`;
}

export function RestorePanel({ configured }: { configured: boolean }) {
  const [files, setFiles] = useState<string[] | null>(null);
  const [listErr, setListErr] = useState<string | null>(null);
  const [file, setFile] = useState('');
  const [confirm, setConfirm] = useState('');

  const [preview, doPreview, previewing] = useActionState<PreviewState, FormData>(
    previewRestoreAction, undefined);
  const [restore, doRestore, restoring] = useActionState<RestoreState, FormData>(
    runRestoreAction, undefined);

  useEffect(() => {
    if (!configured) return;
    listBackupsAction().then((r) => {
      if (r?.error) setListErr(r.error);
      else setFiles(r?.files ?? []);
    });
  }, [configured]);

  // 恢复成功后当前账号可能已经不存在了，这时必须重新登录
  useEffect(() => {
    if (restore?.loggedOut) {
      const t = setTimeout(() => { window.location.href = '/login'; }, 4000);
      return () => clearTimeout(t);
    }
  }, [restore?.loggedOut]);

  if (!configured) return null;

  const p = preview?.preview;

  return (
    <div className="space-y-3">
      <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
        ⚠️ 恢复会<strong>清空当前全站数据</strong>，再用备份内容整体替换，不能撤销。
        执行前会自动把现在的数据存一份到网盘的 pre-restore/ 目录，万一选错还能找回来。
      </p>

      {listErr && <p className="text-sm text-rose-500">{listErr}</p>}
      {files === null && !listErr && <p className="text-sm text-gray-400">正在读取备份列表…</p>}
      {files?.length === 0 && <p className="text-sm text-gray-500">网盘上还没有备份，先点上面的「立即备份」。</p>}

      {!!files?.length && (
        <>
          <form action={doPreview} className="flex flex-wrap items-center gap-2">
            <select
              name="file"
              value={file}
              onChange={(e) => { setFile(e.target.value); setConfirm(''); }}
              className="input max-w-xs"
            >
              <option value="">选择要恢复的备份…</option>
              {files.map((f) => (
                <option key={f} value={f}>{prettyName(f)}</option>
              ))}
            </select>
            <button className="btn btn-ghost" disabled={previewing || !file}>
              {previewing ? '读取中…' : '查看内容'}
            </button>
          </form>

          {preview?.error && <p className="text-sm text-rose-500">{preview.error}</p>}

          {p && p.file === file && (
            <div className="space-y-3 rounded-lg border border-gray-200 p-3">
              <p className="text-sm text-gray-600">
                备份时间：{p.exportedAt ? new Date(p.exportedAt).toLocaleString('zh-CN') : '未知'}
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400">
                    <th className="py-1">数据</th><th>现在</th><th>恢复后</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(LABELS).map((k) => {
                    const now = p.current[k] ?? 0;
                    const after = p.counts[k] ?? 0;
                    return (
                      <tr key={k} className="border-t border-gray-100">
                        <td className="py-1 text-gray-600">{LABELS[k]}</td>
                        <td className="text-gray-400">{now}</td>
                        <td className={after < now ? 'font-medium text-rose-500' : 'text-gray-700'}>
                          {after}{after < now && ` （少 ${now - after}）`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {p.missingPhotos > 0 && (
                <p className="text-xs text-amber-700">
                  ⚠️ 有 {p.missingPhotos} 张照片在网盘上找不到，恢复后这些位置会是裂图。
                </p>
              )}
              {!p.adminSurvives && (
                <p className="text-xs text-rose-600">
                  ⚠️ 这份备份里没有你现在这个账号，恢复后你会被登出，需要用备份里存在的账号重新登录。
                </p>
              )}

              <form action={doRestore} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="file" value={file} />
                <input
                  name="confirm"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="输入「恢复」以确认"
                  className="input max-w-[12rem]"
                />
                <button
                  className="btn bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50"
                  disabled={restoring || confirm.trim() !== '恢复'}
                >
                  {restoring ? '恢复中…' : '确认恢复'}
                </button>
              </form>
              {restoring && (
                <p className="text-xs text-gray-400">正在覆盖数据并下载照片，别关页面。</p>
              )}
            </div>
          )}
        </>
      )}

      {restore?.error && <p className="text-sm text-rose-500">{restore.error}</p>}
      {restore?.success && (
        <p className="text-sm text-emerald-600">
          {restore.success}
          {restore.loggedOut && '。即将跳转到登录页…'}
        </p>
      )}
    </div>
  );
}
