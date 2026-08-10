# 🕰️ 点滴留言板 (Memory Board)

一个带账号系统的多人留言板：可发文字和照片、按身份（恋人/家人/朋友）划分不同留言板、
成员之间隔离、支持时间胶囊和纪念日。为后续的 iOS Scripting 小组件预留了数据接口。

## ✨ 已实现（第一版 MVP）

- **账号系统**：邮箱 + 密码注册 / 登录，会话用加密 cookie（30 天）
- **限制注册**：可设注册口令（SIGNUP_CODE），只有知道口令的人才能建账号，不对外开放
- **多身份留言板**：创建时选身份类型（💗恋人 / 🏠家人 / 🤝朋友 / ✨其他），互相独立
- **邀请码加入**：每个留言板有唯一 8 位邀请码，别人凭码加入
- **成员隔离**：只有加入某留言板的人才能查看该板的留言（非成员访问被拦截）
- **留言 + 照片**：发文字、传图片；图片存服务器本地 public/uploads
- **权限归属**：只能编辑 / 删除**自己**的留言，后端强制校验
- **时间胶囊**：封存文字/照片并设解锁日期；**未到期时对其他人完全不可见（列表里直接没有这一条，不是锁定态）**，只有作者本人能看；到期后同板成员才出现并可读
- **纪念日**：为留言板添加纪念日，自动倒数天数、显示第几周年，可设每年重复
- **小组件只读接口**：`GET /api/widget?token=xxx`，供 iOS Scripting 小组件拉取最新留言和临近纪念日
- **个人设置**：可上传头像（浏览器端自动压到 256px），留言和顶栏都显示；照片上传前也会自动压缩到 1MB 以内
- **点开看大图**：留言墙的照片是裁切过的缩略图，点一下弹出完整原图（不裁切），可一键保存到本地，手机上也能长按保存
- **站长 WebDAV 备份**：由环境变量 `ADMIN_EMAIL` 指定站长，一键把数据库和照片备份到网盘；数据库最多留 3 份自动轮换，照片增量上传
- **一键恢复**：从网盘任选一份备份还原全站（整库覆盖 + 照片拉回），恢复前自动留一份当前数据的后悔药，中途出错整体回滚
- **Docker Compose 一键部署**：`docker compose up` 同时起应用和 PostgreSQL，数据/图片用命名卷持久化

## 🧭 后续阶段(待做)

- **Scripting 小组件脚本**：接口已就绪(见下方“Scripting 小组件”),只差在 Scripting App 里写展示脚本。

## 🚀 快速开始（Docker 一键，含数据库）

装了 Docker Desktop 后，一条命令把**应用 + PostgreSQL** 一起起来：

    # 1. 准备环境变量
    cp .env.example .env
    #    编辑 .env，把 AUTH_SECRET 改成随机串（openssl rand -base64 32）

    # 2. 一键启动
    docker compose up --build

打开 http://localhost:3000 → 注册账号 → 创建留言板 → 拿邀请码给别人加入。

- 数据库数据存命名卷 `db_data`，图片存命名卷 `uploads`，`docker compose down` 不会删
- 停并**清空数据**：`docker compose down -v`
- 看日志：`docker compose logs -f app`

> 首次启动时容器会自动执行 `prisma db push` 建表，不需要手动初始化。

## 📖 怎么使用（登录 / 邀请码 / 限制注册）

**没有"管理员账号"这个概念** —— 系统是平等的多人协作模型，谁注册都是普通用户；
你在自己建的留言板里是"创建者"。想要"只有我圈子的人能用"，靠下面的**注册口令**实现。

### 第一次使用

1. 打开站点会跳到登录页，但数据库是空的，所以**先点「注册」**建第一个账号
2. 注册成功自动登录，进入留言板列表

### 生成邀请码（自动，不用手动建）

1. 列表页点 **「+ 新建留言板」**，填名称、选身份（恋人/家人/朋友/其他）→ 创建
2. 进入该板，顶部就有一行 **8 位邀请码**（系统自动生成、每板唯一）
3. 把邀请码发给对方；对方**先注册自己的账号**，再在列表页点 **「用邀请码加入」** 输入邀请码即可进同一个板

只有加入同一个板的人，才能看该板的留言、纪念日和已解锁的时间胶囊。

### 限制注册（相当于"邀请制"）

不想让任何人都能注册，就在 `.env` 里设一个注册口令：

    SIGNUP_CODE="你自定义的口令"

- 设了之后，**注册页会多一个"注册口令"输入框，填对才能注册**——口令由你私下发给要用的人
- 想开放注册：把这行留空或删掉即可
- 改完重启：`docker compose up -d --build`（或本地开发重启 `npm run dev`）

> 提示：这不是"管理员登录"，而是"注册准入"。你自己也是用邮箱密码登录，和别人一样，
> 只是只有你手里的口令能放行新账号。


## 🧑‍💻 本地开发（不走 Docker）

需要 Node.js 20+ 和一个 PostgreSQL。

    # 起一个 Postgres（也可只用 compose 的数据库那半个）
    docker run -d --name mb-pg -e POSTGRES_PASSWORD=postgres \
      -e POSTGRES_DB=memoryboard -p 5432:5432 postgres:16-alpine

    npm install
    cp .env.example .env          # 改 AUTH_SECRET；DATABASE_URL 已指向 localhost:5432
    npm run db:push               # 建表
    npm run dev                   # http://localhost:3000

> 想可视化看数据库：npm run db:studio
>
> 换电脑继续开发、更详细的说明见 **DEVELOPMENT.md**。

## 🗂️ 项目结构

    src/
      app/
        actions/            # Server Actions（后端逻辑）
          auth.ts           #   注册/登录/登出
          boards.ts         #   建板/加入/退出
          messages.ts       #   留言 增改删（含权限校验）
          capsules.ts       #   时间胶囊 建/删
          anniversaries.ts  #   纪念日 建/删
          widget.ts         #   生成/重置小组件令牌
        api/widget/route.ts # 小组件只读 JSON 接口
        login/ register/    # 登录 / 注册页
        settings/           # 设置页（小组件令牌）
        boards/             # 留言板列表
        boards/[id]/        # 板详情（留言墙/胶囊/纪念日 三个 Tab）
      components/Header.tsx  # 顶部栏
      lib/
        prisma.ts           # 数据库连接
        auth.ts             # 密码哈希 + 会话 cookie
        access.ts           # 成员/权限校验（隔离 + 胶囊可见性）
        upload.ts           # 图片上传到本地磁盘
        dates.ts            # 纪念日倒数/周年计算
        widget.ts           # 小组件数据汇总
        constants.ts        # 身份类型
    prisma/schema.prisma    # 数据模型
    public/uploads/         # 上传的图片

## ☁️ 部署到服务器 / VPS（Docker Compose）

在一台 Linux 服务器 / VPS 上，用 Docker Compose 把应用和数据库一起跑起来。
图片和数据库都用命名卷持久化，重启不丢。

### 1. 装 Docker

    # Ubuntu 一键装 Docker + compose 插件
    curl -fsSL https://get.docker.com | sudo sh

### 2. 传代码、配环境变量、启动

    # 把项目传到服务器（scp / git clone 均可）
    cd memory-board
    cp .env.example .env
    # 编辑 .env：
    #   AUTH_SECRET 改成随机串（openssl rand -base64 32）
    #   SIGNUP_CODE 设注册口令（想限制注册就填，开放注册就留空）
    #   POSTGRES_PASSWORD 改成一个强密码
    #   ADMIN_EMAIL 填你自己的邮箱（想用备份功能就填，见下方「备份」）
    #   WEBDAV_URL / WEBDAV_USER / WEBDAV_PASSWORD 网盘备份，三个都填才启用

    sudo docker compose up -d --build

应用即跑在 http://服务器IP:3000 ，数据库在容器内、数据存卷 `db_data`。

### 3. 配 Nginx 反代 + HTTPS 域名

小组件必须走 HTTPS，给它套域名和证书。在**宿主机**装 Nginx（或再起一个 Nginx 容器），
新建 `/etc/nginx/sites-available/memory-board`：

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

启用并申请免费证书：

    sudo ln -s /etc/nginx/sites-available/memory-board /etc/nginx/sites-enabled/
    sudo nginx -t && sudo systemctl reload nginx
    sudo apt-get install -y certbot python3-certbot-nginx
    sudo certbot --nginx -d your-domain.com

完成后访问 https://your-domain.com 就是你的留言板。

> X-Forwarded-Host / X-Forwarded-Proto 两个头要传给应用，
> 「设置」页才能拼出正确的小组件 https 地址。

### 4. 常用运维命令

    sudo docker compose logs -f app      # 看日志
    sudo docker compose up -d --build    # 更新代码后重新部署
    sudo docker compose down             # 停（保留数据）
    sudo docker compose down -v          # 停并删数据（慎用）

数据库改过模型时不用手动迁移——容器启动会自动 `prisma db push`。

### 5. 备份（WebDAV）

在 `.env` 里填好 `ADMIN_EMAIL`（你自己的邮箱）和三个 `WEBDAV_*`，重启后用这个邮箱登录，
「设置」页最下面会多出「备份到 WebDAV」，可以点「测试连接」和「立即备份」。别人看不到这块。

- 数据库导成 JSON，**最多保留 3 份**，超出自动删最旧的
- 照片**增量上传**，只传网盘上没有的，第二次备份基本不花时间
- 网盘上分 `db/` 和 `photos/` 两个目录

⚠️ 备份文件含所有人的留言和密码哈希，WebDAV 目录一定要是私有的。

### 6. 恢复（网站崩了之后）

「设置」→「从备份恢复」→ 选一份备份 → 「查看内容」看清楚要换成什么 → 输入「恢复」二字确认。

- **整库覆盖**，不是合并；执行前自动把当前数据另存到网盘 `pre-restore/`，选错了还能补救
- 全程一个事务，备份文件坏了会整体回滚，**原数据不会被弄成半截**
- 照片自动从网盘拉回，缺图会明确提示有几张
- 备份里没有你当前账号的话，恢复后会自动登出，用备份里的账号登录即可

详细步骤（含换服务器的情况）见 DEPLOY.md。

### （备选）不用 Docker 的手动部署

也可以在服务器上装 Node 20 + Postgres，手动 `npm install && npm run build`，
用 pm2 守护 `npm start`。细节见 DEVELOPMENT.md 的「方式 B」。

## 📱 Scripting 小组件（接口已就绪）

小组件只负责“读”——通过网页端接口拿数据展示，不做任何写入。

### 只读接口

    GET /api/widget?token=<你的令牌>&limit=10

- 令牌在网页版「设置」页生成 / 复制 / 重置，一个账号一个令牌
- 返回**该账号所有已加入留言板**里的最新留言 + 临近纪念日
- 出于隐私：**不返回任何时间胶囊内容**；留言只给文本和“是否带图”，不外泄图片

返回示例：

    {
      "user": "Alice",
      "boards": ["我们俩"],
      "messages": [
        { "board": "我们俩", "author": "Bob", "content": "我也是~", "hasImage": false, "createdAt": "2026-08-07T07:40:06.781Z" }
      ],
      "anniversaries": [
        { "title": "在一起", "board": "我们俩", "date": "2024-05-20", "daysUntil": 286 }
      ],
      "generatedAt": "2026-08-07T07:40:19.054Z"
    }

### Scripting 示例脚本

在 Scripting App 里新建脚本，把 URL 换成你自己的：

    const url = "https://your-domain.com/api/widget?token=你的令牌&limit=5"
    const data = await fetch(url).then(r => r.json())

    const nextAnn = data.anniversaries[0]
    const latest = data.messages[0]

    // 具体用 Scripting 的 Widget/View API 渲染，下面是取值示意：
    const annText = nextAnn
      ? `${nextAnn.title} 还有 ${nextAnn.daysUntil} 天`
      : "暂无纪念日"
    const msgText = latest
      ? `${latest.author}：${latest.content}`
      : "还没有留言"

    console.log(annText)
    console.log(msgText)

> Scripting 的具体小组件排版 API 参见官方文档
> https://scriptingapp.github.io/zh/llms-full.txt

## 🔐 安全说明

- 密码用 bcrypt 哈希存储，不存明文
- 会话用 HS256 签名的 JWT，放在 httpOnly cookie
- 所有读写都在后端校验「登录 + 是该板成员 + 是内容作者」
- 部署时务必把 AUTH_SECRET 改成随机值，并启用 HTTPS
- 备份功能只认 `ADMIN_EMAIL` 这一个邮箱，且每次操作都在后端重新校验；不设这个变量则任何人都用不了
- 备份出来的 JSON 含全部留言和密码哈希，WebDAV 目录务必私有
- 恢复要二次确认（输入「恢复」二字），且备份文件名只接受 `memoryboard-*.json`，不会被拿去读服务器上的其他文件
