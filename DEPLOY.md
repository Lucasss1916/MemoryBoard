# 🚀 服务器部署指南 (Memory Board)

目标：在一台 Ubuntu / Debian 服务器上把「留言板 + PostgreSQL」跑起来，并用 Nginx 反代配 HTTPS。

全文在**服务器**上执行（个别标了「本机」的步骤在本机执行）。

---

## 一、安装 Docker

Ubuntu 一条命令装 Docker + compose 插件：

```bash
sudo curl -fsSL https://get.docker.com | sudo sh
```

装完确认：

```bash
sudo docker --version        # 有版本号即成功
sudo docker compose version  # 有版本号即成功
```

> 阿里云 / 腾讯云等国内服务器如果 docker 拉镜像慢，可以配国内镜像加速源，见文末附录 A。

---

## 二、把代码传上去（任选一种）

### 方式 1：Git（推荐，更新方便）

没有 git 仓库的话，先**在服务器上**建一个裸仓库，之后用 `git push` 推送代码：

```bash
# 服务器上
sudo apt-get install -y git
mkdir -p ~/memory-board.git
cd ~/memory-board.git
git init --bare
```

在本机把这个仓库加为 remote 并推送：

```bash
# 本机,项目目录里
git remote add deploy user@你的服务器IP:~/memory-board.git
git push deploy main
```

然后在服务器上 clone 出来部署：

```bash
# 服务器上
cd ~
git clone ~/memory-board.git memory-board
```

之后每次改代码，只要：

```bash
# 本机
git add -A && git commit -m "xxx" && git push deploy main

# 服务器上
cd ~/memory-board && git pull && sudo docker compose up -d --build
```

### 方式 2：直接传文件（不用 Git）

本机用 scp 把整个项目传过去（**排除** `node_modules`、`.next`、`.env`）：

```bash
cd /Volumes/New/memory-board
rsync -av --exclude 'node_modules' --exclude '.next' \
  --exclude '.env' --exclude '.git' \
  ./ user@你的服务器IP:~/memory-board/
```

> 上面把 rsync 一次性传整个目录；文件不多，也可以直接 `scp` 一个个传。

---

## 三、配置环境变量

```bash
cd ~/memory-board
cp .env.example .env
nano .env    # 用任意编辑器
```

必改三处：

| 变量 | 改成什么 |
|---|---|
| `AUTH_SECRET` | 一段随机长字符串，`openssl rand -base64 32` 生成 |
| `SIGNUP_CODE` | 你的注册口令（想开放注册就留空） |
| `POSTGRES_PASSWORD` | 数据库强密码，随便定一个记好 |

`DATABASE_URL` 和 `POSTGRES_USER/DB` 不用动——compose 会自动把 app 的数据库地址指向 `db` 容器。

选填（想要备份就填）：

| 变量 | 改成什么 |
|---|---|
| `ADMIN_EMAIL` | 你自己的邮箱。填了谁，谁就是站长，只有站长能在「设置」页看到备份功能；留空则谁都看不到 |
| `WEBDAV_URL` | 网盘的 WebDAV 地址，要写到具体目录，例如 `https://dav.jianguoyun.com/dav/memoryboard` |
| `WEBDAV_USER` | WebDAV 账号 |
| `WEBDAV_PASSWORD` | WebDAV 密码（坚果云等要用「应用密码」，不是登录密码） |

三个 `WEBDAV_*` 都填了备份才启用，缺一个就当没配。改完 `.env` 要 `docker compose up -d` 重启才生效。

> ⚠️ 备份文件里含所有人的留言原文和密码哈希，WebDAV 目录务必是私有的，别用任何公开分享链接。

---

## 四、启动

```bash
sudo docker compose up -d --build
```

等几十秒（首次构建要装依赖），确认起来了：

```bash
sudo docker compose ps
```

两行都显示 `Up`（health: healthy）就对了。应用在 **http://服务器IP:3000**。

看日志 / 重启 / 停：

```bash
sudo docker compose logs -f app   # 看日志
sudo docker compose up -d --build # 更新代码后重新部署
sudo docker compose down          # 停(保留数据)
```

---

## 四之二、备份（防止服务器挂了数据全没）

配好上面的 `ADMIN_EMAIL` + `WEBDAV_*` 后，用站长账号登录 → 右上角「设置」→ 最下面「备份到 WebDAV」：

- **测试连接**：先点这个，确认账号密码和地址没写错。
- **立即备份**：把数据库导成一个 JSON 文件传上去，再把 `public/uploads` 里的照片同步过去。

备份策略：

- **数据库最多留 3 份**，文件名带时间戳（`memoryboard-20260810-143555.json`），传完自动删掉更早的，网盘不会越攒越多。
- **照片是增量的**：只传网盘上还没有的。照片文件名带时间戳且内容不会改，所以同名即同图，第二次备份几乎不耗流量。

网盘上的结构：

```
你配的目录/
├── db/       ← 最近 3 次的数据库快照
└── photos/   ← 全部照片
```

网盘上还会多出一个 `pre-restore/` 目录，放的是每次恢复前自动存的当前数据（见下）。

### 怎么恢复

服务器重装了、数据库删了、或者误删了一堆留言，都可以从备份还原：

1. 新服务器照常 `docker compose up -d --build` 起起来，**用备份里存在的邮箱注册一个账号**（数据会被覆盖掉，只是为了能登录进去）。
2. `.env` 里的 `ADMIN_EMAIL` 和 `WEBDAV_*` 填成和原来一样。
3. 用站长账号登录 → 「设置」→「从备份恢复」→ 选备份 → **查看内容**。
4. 确认那张对比表（现在有多少 / 恢复后有多少），在输入框里打「恢复」两个字，点「确认恢复」。

几点要知道：

- 恢复是**整库覆盖**：先清空现有数据，再写入备份内容，不是合并。
- 执行前会自动把当前数据存到网盘 `pre-restore/` 目录。**选错备份也能补救**——把那个文件名改成 `memoryboard-*.json` 挪回 `db/`，再恢复一次即可。
- 整个覆盖过程在一个数据库事务里。备份文件损坏或数据对不上会**整体回滚**，原数据一行不动。
- 照片会按需从网盘拉回本地，只下载本地没有的。网盘上缺的图会明确告诉你有几张。
- 如果备份里没有你当前登录的账号，恢复后会自动登出，用备份里的账号重新登录即可。

---

## 五、配 Nginx 反代 + HTTPS（必做，小组件要求 HTTPS）

### 1. 装 Nginx

```bash
sudo apt-get install -y nginx
```

### 2. 写站点配置

```bash
sudo nano /etc/nginx/sites-available/memory-board
```

把 `your-domain.com` 换成你的域名：

```nginx
server {
    server_name your-domain.com;
    client_max_body_size 12M;   # 允许上传图片

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 3. 启用并申请免费证书

```bash
sudo ln -s /etc/nginx/sites-available/memory-board /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 申请 Let's Encrypt 免费证书(自动配好 HTTPS)
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

完成后访问 **https://your-domain.com** 就是你的留言板。

> `X-Forwarded-Host` / `X-Forwarded-Proto` 两个头必须传给应用，否则「设置」页拼不出正确的小组件 HTTPS 地址。

---

## 六、日常运维

| 命令 | 作用 |
|---|---|
| `sudo docker compose logs -f app` | 看应用日志 |
| `sudo docker compose up -d --build` | 更新代码后重新部署 |
| `sudo docker compose down` | 停(保留数据) |
| `sudo docker compose down -v` | 停并**删数据**(慎用!) |
| `sudo docker compose exec db psql -U postgres` | 进数据库命令行 |

数据库和图片都存在命名卷里（`db_data` / `uploads`），容器重建不丢。改过数据模型也不用手动迁移，容器启动会自动 `prisma db push`。

---

## 附录 A：国内服务器镜像加速

如果拉镜像慢，编辑 `/etc/docker/daemon.json`：

```json
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://dockerproxy.com"
  ]
}
```

然后：

```bash
sudo systemctl restart docker
```

（用阿里云/腾讯云的服务器，也可以直接用它们的容器镜像加速器地址。）

## 附录 B：Dockerfile 已知修复记录

> 2026-08-08 修复：Docker 部署时 `prisma db push` 报
> `ENOENT: no such file or directory, open '/app/node_modules/.bin/prisma_schema_build_bg.wasm'`。
> 原因是 Dockerfile 里 `COPY .../.bin/prisma` 跟随 symlink 拷贝，导致 Prisma CLI 的 `__dirname` 错位，
> 找不到 wasm 引擎。已在 Dockerfile 改为手动 `ln -sf` 重建 symlink。如果重新 clone 的是旧代码，记得应用这个修复。
