# 开发记录与交接文档

> 这份文档记录项目做了什么、怎么搭的、以及**换一台电脑如何继续开发**。
> 面向的是「过一阵回来 / 换设备」时能快速捡起来。

---

## 一、项目是什么

一个带账号系统的多人「点滴留言板」：

- 登录后才能用
- 按身份建**多个独立留言板**（💗恋人 / 🏠家人 / 🤝朋友 / ✨其他）
- 每板一个**邀请码**，凭码加入；只有同板成员能看该板内容（互相隔离）
- 板内三块：**💬留言墙**（文字+照片）、**🔒时间胶囊**、**🎈纪念日**
- **时间胶囊**：设未来解锁日期；到期前对**其他人完全不可见**（列表里没这条，不是锁定态），只有作者自己能看；到期后同板成员才出现
- **权限归属**：只能改/删自己的留言和胶囊，后端强制校验
- **小组件只读接口** `/api/widget?token=xxx`：给 iOS Scripting 小组件拉最新留言和纪念日

---

## 二、技术栈与关键决策

| 项 | 选择 | 为什么 |
|---|---|---|
| 框架 | Next.js 15（App Router）+ TypeScript | 前后端一体，方便给小组件提供 API |
| 后端逻辑 | Server Actions | 不用手写一堆 REST，表单直连函数 |
| 数据库 | PostgreSQL | 配合 Docker 一键起；生产可靠 |
| ORM | Prisma | 类型安全、`db push` 改表方便 |
| 认证 | 自建：bcrypt 存密码 + jose 签发 JWT，放 httpOnly cookie | 轻量、无第三方依赖 |
| 图片 | 存服务器本地磁盘 `public/uploads` | 简单；用 Docker 命名卷持久化 |
| 部署 | Docker Compose（app + postgres） | 一条命令连数据库一起起 |

> 历史：最初本地用 SQLite 起步，后来为了 Docker 一键部署统一切到 PostgreSQL。

---

## 三、目录结构

    memory-board/
    ├── Dockerfile              # 多阶段构建，产出 standalone 运行镜像
    ├── docker-compose.yml      # app + postgres 两服务 + 命名卷
    ├── docker-entrypoint.sh    # 启动前跑 prisma db push 同步表结构
    ├── .dockerignore
    ├── .env.example            # 环境变量样例（复制成 .env）
    ├── next.config.mjs         # 开了 output:'standalone'
    ├── prisma/schema.prisma    # 数据模型（postgresql + binaryTargets）
    ├── public/uploads/         # 上传的图片
    └── src/
        ├── app/
        │   ├── actions/        # ★ 后端逻辑（Server Actions）
        │   │   ├── auth.ts             # 注册/登录/登出
        │   │   ├── boards.ts           # 建板/加入/退出
        │   │   ├── messages.ts         # 留言增改删（权限校验）
        │   │   ├── capsules.ts         # 时间胶囊 建/删
        │   │   ├── anniversaries.ts    # 纪念日 建/删
        │   │   └── widget.ts           # 生成/重置小组件令牌
        │   ├── api/widget/route.ts     # 小组件只读 JSON 接口
        │   ├── login/ register/        # 登录/注册页
        │   ├── settings/               # 设置页（小组件令牌）
        │   ├── boards/                 # 留言板列表
        │   └── boards/[id]/            # 板详情（三个 Tab 的所有组件）
        ├── components/Header.tsx
        └── lib/                # ★ 核心工具
            ├── prisma.ts       # DB 连接单例
            ├── auth.ts         # 密码哈希 + 会话 cookie + getCurrentUser
            ├── access.ts       # 成员校验 + 胶囊可见性 isCapsuleVisible
            ├── upload.ts       # 图片存本地磁盘
            ├── dates.ts        # 纪念日倒数/周年计算
            ├── widget.ts       # 汇总小组件数据
            └── constants.ts    # 身份类型

**读代码从哪看起**：`src/lib/access.ts`（隔离和权限的核心）→ `src/app/actions/*`（每个功能的后端）→ `src/app/boards/[id]/page.tsx`（把数据喂给前端的地方）。

---

## 四、数据模型（prisma/schema.prisma）

- **User**：邮箱、昵称、密码哈希、`widgetToken`（小组件令牌）
- **Board**：名称、`kind`（身份类型）、`inviteCode`（唯一邀请码）、owner
- **BoardMember**：谁在哪个板、角色 OWNER/MEMBER —— **隔离的关键**，`@@unique([boardId,userId])`
- **Message**：留言，`content` + 可选 `imageUrl`，属于某板某作者
- **TimeCapsule**：`unlockAt` 解锁日期；可见性逻辑在 `access.ts`
- **Anniversary**：纪念日，`date` + `yearly`（是否每年重复）

改了模型后：`npm run db:push`（本地）或重启 compose（Docker 里 entrypoint 会自动同步）。

---

## 五、几个关键实现点（容易踩坑 / 值得记住）

1. **登录态**：cookie 名 `mb_session`，JWT 用 `AUTH_SECRET` 签。换机器/换环境时 `AUTH_SECRET` 变了，旧 cookie 会失效（重新登录即可）。

2. **胶囊「对他人完全隐藏」**：在 `boards/[id]/page.tsx` 里先
   `capsules.filter(c => isCapsuleVisible(c, user.id, now))` 过滤，**未解锁的非自己胶囊在服务端就被丢掉**，前端根本收不到，不是靠 CSS 藏。

3. **小组件接口隐私**：`/api/widget` **只返回留言和纪念日，绝不含胶囊内容**；留言也只给文本和 `hasImage` 布尔，不外泄图片 URL。

4. **图片持久化**：存 `public/uploads`。Docker 里挂了命名卷 `uploads`，容器重建不丢。**注意**：不能部署到 Vercel 那种无持久磁盘的平台（会丢图）。

5. **Next standalone + Prisma on Alpine**：Dockerfile 用 alpine，Prisma 需要 `linux-musl-openssl-3.0.x` 引擎，已在 schema 的 `binaryTargets` 里固定。换基础镜像时注意这个。

6. **Server Actions 的返回**：用 `useActionState`，action 返回 `{error?}`；成功后靠 `revalidatePath` 刷新或 `redirect` 跳转。

---

## 六、换一台电脑继续开发

### 方式 A：用 Docker（最省事，推荐）

前提：装 Docker Desktop。

    # 1. 拿到代码（解压 zip 或 git clone）
    cd memory-board

    # 2. 准备环境变量
    cp .env.example .env
    #    编辑 .env，把 AUTH_SECRET 改成随机串：openssl rand -base64 32

    # 3. 一键起（app + 数据库）
    docker compose up --build

浏览器开 http://localhost:3000 。改代码后 `docker compose up --build` 重新构建即可。
数据库数据在命名卷 `db_data`，图片在 `uploads`，`docker compose down` 不会删（要删数据加 `-v`）。

### 方式 B：本机直接跑（需要本地装 Node 20 + 一个 Postgres）

    # 1. 装依赖
    npm install

    # 2. 起一个 Postgres（可以用 docker 只起数据库那半个）
    docker run -d --name mb-pg -e POSTGRES_PASSWORD=postgres \
      -e POSTGRES_DB=memoryboard -p 5432:5432 postgres:16-alpine

    # 3. 配 .env
    cp .env.example .env
    #    DATABASE_URL 指向 localhost:5432（.env.example 里已是这个）
    #    改 AUTH_SECRET

    # 4. 建表 + 起开发服务器
    npm run db:push
    npm run dev        # http://localhost:3000

    # 常用：npm run db:studio 可视化看数据库

### 需要装的工具清单

- **Node.js 20+**（方式 B 必须；方式 A 不装也行）
- **Docker Desktop**（方式 A，或方式 B 用来只起数据库）
- 编辑器建议 VS Code + 插件：Prisma、Tailwind CSS IntelliSense、ESLint

---

## 七、常用命令速查

| 命令 | 作用 |
|---|---|
| `docker compose up --build` | 一键起（app+db），改代码后重跑 |
| `docker compose down` | 停（保留数据卷） |
| `docker compose down -v` | 停并**删除数据**（慎用） |
| `docker compose logs -f app` | 看应用日志 |
| `npm run dev` | 本机开发热更新 |
| `npm run build` | 生产构建 |
| `npm run db:push` | 按 schema 同步表结构 |
| `npm run db:studio` | 打开 Prisma 可视化 |

---

## 八、已完成 / 待办

**已完成**
- [x] 账号系统（注册/登录/会话）
- [x] 多身份留言板 + 邀请码 + 成员隔离
- [x] 留言 + 照片 + 权限归属
- [x] 时间胶囊（未解锁对他人完全隐藏）
- [x] 纪念日（倒数 / 周年）
- [x] 小组件只读接口 `/api/widget` + 设置页令牌管理
- [x] Docker Compose 一键部署（含数据库）

**待办 / 可扩展**
- [ ] Scripting 小组件的展示脚本（接口已就绪，见 README「Scripting 小组件」）
- [ ] 留言板成员列表 / 移除成员 / 转让 owner
- [ ] 胶囊到期提醒、纪念日推送
- [ ] 图片压缩、多图
- [ ] 找回密码

---

## 九、部署到公网

见 README.md 的「部署到服务器 / VPS」和 Docker 说明。要点：
Docker Compose 起好后，前面用 Nginx 反代 + certbot 配 HTTPS 域名
（小组件必须 https），并把 `X-Forwarded-Host`/`X-Forwarded-Proto`
两个头传给 app（设置页据此拼小组件地址）。
