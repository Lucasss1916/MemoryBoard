import 'server-only';

// 极简 WebDAV 客户端。只用到 PUT / PROPFIND / MKCOL / DELETE 四个动作，
// 不值得为此引入依赖（坚果云、Nextcloud、InfiniCLOUD 等都支持这几个）。

export type WebdavConfig = {
  url: string;       // 形如 https://dav.example.com/dav/memoryboard
  user: string;
  password: string;
};

export function webdavConfig(): WebdavConfig | null {
  const url = process.env.WEBDAV_URL?.trim().replace(/\/+$/, '');
  const user = process.env.WEBDAV_USER?.trim();
  const password = process.env.WEBDAV_PASSWORD;
  if (!url || !user || !password) return null;
  return { url, user, password };
}

function authHeader(c: WebdavConfig) {
  return 'Basic ' + Buffer.from(`${c.user}:${c.password}`).toString('base64');
}

function join(base: string, ...parts: string[]) {
  const tail = parts
    .filter(Boolean)
    .map((p) => p.split('/').filter(Boolean).map(encodeURIComponent).join('/'))
    .join('/');
  return tail ? `${base}/${tail}` : base;
}

async function dav(c: WebdavConfig, method: string, target: string, init: RequestInit = {}) {
  const res = await fetch(target, {
    ...init,
    method,
    headers: { Authorization: authHeader(c), ...(init.headers ?? {}) },
    // 备份是后台操作，别让 Next 缓存
    cache: 'no-store',
  });
  return res;
}

// 建目录。已存在(405)不算失败。
export async function ensureDir(c: WebdavConfig, ...segments: string[]): Promise<void> {
  const res = await dav(c, 'MKCOL', join(c.url, ...segments));
  if (res.ok || res.status === 405) return;
  throw new Error(`建目录失败 ${res.status} ${res.statusText}`);
}

export async function putFile(
  c: WebdavConfig, body: Buffer | Uint8Array, ...segments: string[]
): Promise<void> {
  const res = await dav(c, 'PUT', join(c.url, ...segments), {
    body: new Uint8Array(body),
    headers: { 'Content-Type': 'application/octet-stream' },
  });
  if (!res.ok) throw new Error(`上传失败 ${res.status} ${res.statusText}`);
}

export async function deleteFile(c: WebdavConfig, ...segments: string[]): Promise<void> {
  const res = await dav(c, 'DELETE', join(c.url, ...segments));
  // 404 说明本来就没有，忽略
  if (!res.ok && res.status !== 404) {
    throw new Error(`删除失败 ${res.status} ${res.statusText}`);
  }
}

// 列出目录下的文件名（只要文件，不含子目录）。目录不存在返回空数组。
export async function listDir(c: WebdavConfig, ...segments: string[]): Promise<string[]> {
  const res = await dav(c, 'PROPFIND', join(c.url, ...segments), {
    headers: { Depth: '1', 'Content-Type': 'application/xml' },
    body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>',
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`列目录失败 ${res.status} ${res.statusText}`);

  const xml = await res.text();
  const names: string[] = [];
  // 服务端返回的命名空间前缀不统一(d:/D:/lp1: 都见过)，用宽松匹配逐个 response 解析
  const blocks = xml.split(/<[^>]*:?response[\s>]/i).slice(1);
  for (const b of blocks) {
    const href = /<[^>]*:?href[^>]*>([\s\S]*?)<\/[^>]*:?href>/i.exec(b)?.[1]?.trim();
    if (!href) continue;
    // 带 <collection/> 的是目录，跳过
    if (/<[^>]*:?collection\s*\/?>/i.test(b)) continue;
    const name = decodeURIComponent(href.replace(/\/+$/, '').split('/').pop() ?? '');
    if (name) names.push(name);
  }
  return names;
}

// 下载一个文件。404 返回 null（调用方通常要区分"没有"和"出错"）。
export async function getFile(c: WebdavConfig, ...segments: string[]): Promise<Buffer | null> {
  const res = await dav(c, 'GET', join(c.url, ...segments));
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`下载失败 ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

// 连通性自检：建一次目录就够，能过说明地址/账号/密码都对
export async function checkConnection(c: WebdavConfig): Promise<void> {
  await ensureDir(c);
}
