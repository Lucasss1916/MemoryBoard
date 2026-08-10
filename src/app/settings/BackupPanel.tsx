'use client';
import { useActionState } from 'react';
import { runBackupAction, testWebdavAction, type BackupState } from '@/app/actions/backup';

function Result({ state }: { state: BackupState }) {
  if (state?.error) return <p className="text-sm text-rose-500">{state.error}</p>;
  if (state?.success) return <p className="text-sm text-emerald-600">{state.success}</p>;
  return null;
}

export function BackupPanel({ configured }: { configured: boolean }) {
  const [backupState, backup, backing] = useActionState<BackupState>(runBackupAction, undefined);
  const [testState, test, testing] = useActionState<BackupState>(testWebdavAction, undefined);

  return (
    <div className="space-y-3">
      {!configured && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
          还没配置 WebDAV。在 .env 里填好 WEBDAV_URL / WEBDAV_USER / WEBDAV_PASSWORD 并重启即可。
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <form action={backup}>
          <button className="btn btn-primary" disabled={backing || !configured}>
            {backing ? '备份中…' : '立即备份'}
          </button>
        </form>
        <form action={test}>
          <button className="btn btn-ghost" disabled={testing || !configured}>
            {testing ? '测试中…' : '测试连接'}
          </button>
        </form>
      </div>
      {backing && (
        <p className="text-xs text-gray-400">照片多的话可能要等一会儿，别关页面。</p>
      )}
      <Result state={backupState} />
      <Result state={testState} />
    </div>
  );
}
