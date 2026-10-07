# 两个人的打卡 · Couple Connect

**一起打卡，互相监督，也互相想念。**

两个人的打卡是一个面向情侣的日常陪伴网页：各自安排今天的任务，分享心情和当前状态，再用表情、留言和轻松的互动回应彼此。

它适合异地相处，也适合住在同一座城市、却常常各自忙碌的两个人。你可以知道 TA 今天在努力做什么，看到一件小事被完成，也能在 TA 累的时候留一句关心。彼此的日常因此多了一点可见的参与。

当前提供可自行部署的 Web 版本，支持手机与电脑访问，并包含 PWA 安装入口。

## 产品想解决什么

两个人的时间安排往往不同：一方正在复习，另一方还在工作；等到有空聊天时，一天里的很多小进展已经过去了。这个产品把任务、状态和回应放在一起，让陪伴可以发生在各自生活的间隙。

| 日常需要 | 产品里的做法 | 想带来的体验 |
|---|---|---|
| 想一起坚持一件事 | 各自列任务，完成后打卡，查看双方进度 | 自己安排节奏，也有人见证努力 |
| 想知道现在适不适合联系 TA | 主动分享心情、专注状态和正在做的事 | 给沟通多一点背景，给专注留一点空间 |
| 想回应对方的一个小进展 | 在 TA 的任务上点表情或写留言 | 完成一件事后，可以收到鼓励和关心 |
| 想给普通的一天加点互动 | 主动进入摸鱼状态，让 TA 来抓包 | 留下两个人之间的小玩笑 |

### 设计思路

- **任务由本人安排。** 两个人各自添加和完成自己的任务，对方通过查看、表情和留言参与。
- **状态由本人分享。** 心情、专注与活动是主动选择的表达，用来帮助彼此理解当下。
- **反馈落在具体的小事上。** 一句加油、一个抱抱，都可以留在对应的任务下面，和那次努力一起被看到。
- **监督也可以轻松一点。** 摸鱼与抓包在双方愿意参与时提供趣味互动；被抓后自动结束摸鱼状态，并设置冷却时间。

## 一个普通的一天

早上，两个人各自列下今天想完成的事：复习一章课本、完成一段工作，或者读几页书。

开始学习时，把状态切换为专注中；休息时分享一下心情。对方打开页面，就能看到最近更新的状态和任务进展。

完成一件事后勾选打卡，TA 可以在任务下面点一个加油，或者留一句今天也辛苦了。晚上切换日期，还能回看之前的任务和反馈。

## 当前功能

| 功能 | 已实现的内容 |
|---|---|
| 注册与登录 | 用户名、密码、昵称；登录后进入自己的账号 |
| 情侣配对 | 一方生成 6 位配对码，另一方输入绑定；任务与状态按配对关系展示 |
| 每日任务 | 添加、完成、取消完成、删除自己的任务；显示完成时间、完成数量与进度条 |
| 日期回看 | 查看今天及过去日期的双方任务和批阅 |
| 心情与状态 | 心情：平常、开心、有点累、想你了、emo；专注：可打扰、专注中、摸鱼中；活动：待着、学习、工作、吃饭、睡觉、通勤 |
| 活跃信息 | 展示在线标记与上次活跃时间，帮助了解对方最近是否使用了应用 |
| 任务批阅 | 给 TA 的任务添加亲亲、抱抱、加油、敲头表情，或写留言；同一任务上的反馈可以更新 |
| 摸鱼与抓包 | TA 主动设为摸鱼中后可以抓包；记录双方被抓次数和最近 20 条抓包历史，同一抓包关系有 5 分钟冷却 |
| 手机与电脑 | 窄屏使用单列布局；包含 Web App Manifest、Service Worker 和浏览器安装入口 |

## 两个人怎么开始

1. 打开同一个已部署的应用地址，各自注册账号并填写昵称。
2. 一方点击「生成我的配对码」，把 6 位码发给另一方。
3. 另一方输入配对码，点击「绑定 TA」。完成配对后进入两个人的主页面。
4. 各自添加自己的任务，选择当前心情、专注状态和活动。
5. 完成任务时勾选打卡；查看 TA 的任务时，可以点表情或写留言。顶部日期按钮可回看过去的记录。

实际使用建议从少量任务开始。把任务写得具体一点，也给休息和临时变化留些空间。完成数量提供的是一天的进度参考，彼此的反馈可以同样关注努力、疲惫和需要帮助的时刻。

## 同步与使用说明

- **页面可见时约每 6 秒获取一次最新数据。** 切到后台会跳过主页面轮询；输入文字时会暂缓重绘，避免打断输入。
- **在线标记来自最近的应用活跃记录。** 当前以最近 2 分钟内是否活跃估计在线情况，不能据此判断 TA 是否方便回复。
- **心情、专注和活动由用户主动设置。** 摸鱼抓包也以本人选择摸鱼状态为前提。
- **每人对 TA 的一条任务保留一条当前批阅。** 后续表情或留言会更新这条反馈。
- **任务按日期保存；状态展示最近一次设置的值。** 查看过去日期时，任务会切换到那一天，状态卡仍显示当前状态。
- **当前界面没有解除或更换配对的入口。** 使用自己的账号和正确的配对码完成绑定。

## 本地运行

需要 Node.js ≥ 18 和 npm。

```bash
git clone https://github.com/Synex1213/to-gether-do.git
cd to-gether-do
npm install --include=dev
npm start
```

打开 [http://localhost:3000](http://localhost:3000)，可以用两个浏览器或普通窗口与无痕窗口分别登录两个人的账号。

| 运行方式 | 配置 | 数据保存方式 |
|---|---|---|
| 本地预览 | 不设置 `DATABASE_URL`，`NODE_ENV` 保持非 `production` | 使用 `pg-mem` 内存库；重启后账号与记录清空 |
| PostgreSQL | 设置有效的 `DATABASE_URL` | 保存到对应数据库，适用于实际使用 |
| 生产环境 | `NODE_ENV=production`，必须设置 `DATABASE_URL` | 缺少或仅填写空白连接串时直接报错，避免进入内存模式 |

项目直接读取进程环境变量，不会自动加载本地 `.env` 文件。本地使用 PostgreSQL 时，可在启动前设置环境变量，例如 PowerShell：

```powershell
$env:DATABASE_URL = 'postgresql://USER:PASSWORD@HOST:5432/DATABASE'
$env:JWT_SECRET = 'replace-with-your-own-random-secret'
npm start
```

请将示例中的用户名、密码、主机、数据库名称和密钥替换为自己的值。

### 回归检查

安装开发依赖后运行：

```bash
npm test
```

当前测试覆盖生产环境缺少或空白连接串、PostgreSQL 分支与 SSL 参数、本地缺少 `pg-mem` 的提示、原始依赖错误保留，以及内存库建表和读写。实际 PostgreSQL 连通性与数据保存需要在目标部署环境中验证。

## 部署到 Render

应用使用一个 Node Web Service 和一个 PostgreSQL 数据库。两个人访问同一个服务地址，登录各自的账号，数据通过同一数据库同步。

### 配置现有 Web Service

1. 在 [Render 控制台](https://dashboard.render.com) 选择 **New + → Postgres**。选择与现有 Web Service 相同的 Region，等待数据库状态变为 `Available`。已有可用数据库则直接使用。
2. 打开数据库页面，复制 **Connect → Internal** 中的完整 Internal Database URL。
3. 打开现有 Web Service，在 Settings 中核对下表。

| 配置项 | 值 |
|---|---|
| Repository | `Synex1213/to-gether-do` |
| Branch | `main` |
| Runtime | Node |
| Root Directory | 留空 |
| Build Command | `npm install --omit=dev` |
| Start Command | `node src/server.js` |
| Health Check Path | `/api/health` |

4. 在这个 **Web Service 的 Environment** 中设置下面的变量。

| 变量 | 要求 | 说明 |
|---|---|---|
| `DATABASE_URL` | 生产环境必填 | 完整 PostgreSQL 连接串；同区域 Render 服务使用 Internal Database URL |
| `JWT_SECRET` | 生产环境必填 | 登录令牌的随机密钥，已经设置则保留原值 |
| `NODE_ENV` | 生产环境必填 | 填 `production` |
| `PORT` | 通常无需手动设置 | Render 自动注入；本地默认 `3000` |
| `PGSSL` | 可选 | 填 `true` 时显式启用 TLS；同区域 Internal URL 可保持未设置 |

变量名需要准确：登录密钥的 KEY 是 **`JWT_SECRET`**。连接串和密钥放在环境变量中，填写实际值时不要加额外引号或尖括号。

可以在本机生成密钥：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

5. 点击 **Save, rebuild, and deploy**。环境变量已经保存但尚未部署时，也可使用 **Manual Deploy → Deploy latest commit**。

第一次启动会自动创建应用所需的数据表。

### 使用 Blueprint 新建部署

仓库根目录已有 [`render.yaml`](render.yaml)，适用于通过 Blueprint 创建服务：

1. Render → **New + → Blueprint**，选择本仓库和 `main` 分支。
2. 检查 Web Service 与数据库的 Region 一致，再应用配置。
3. Blueprint 会创建 `couple-connect` 和 `couple-connect-db`，关联 `DATABASE_URL` 并生成 `JWT_SECRET`。

直接创建的 Web Service 需要按上一节手动配置；仅在仓库中放置 `render.yaml` 不会为它自动关联数据库。

### 验证部署

Logs 应出现以下启动信息，其中地址和端口由运行环境决定：

```text
Couple Connect running at http://... (store: postgres)
```

访问服务地址下的 `/api/health`，应返回：

```json
{"ok":true,"store":"postgres"}
```

这个接口用于确认服务已启动以及当前存储模式。继续用两个账号完成配对，创建并完成任务、添加批阅；重启 Web Service 后重新登录，确认记录仍在，才能验证实际的数据保存。

### Render Free 的使用期限

`render.yaml` 默认使用 Free 方案，适合试用。Free Web Service 闲置约 15 分钟会休眠，再次打开需要等待服务启动。

**Free PostgreSQL 在创建 30 天后到期。** 到期后有 14 天升级宽限期，宽限期结束会删除数据库和数据。打算长期保存两个人的记录时，需要选择能持续使用的数据库方案。

参考：[Render 数据库连接](https://render.com/docs/postgresql-creating-connecting)、[环境变量与部署](https://render.com/docs/configure-environment-variables)、[Free 方案限制](https://render.com/docs/free)。

## 安装到桌面或主屏幕

部署后使用 HTTPS 地址访问。在支持安装的浏览器中，可以通过浏览器的安装入口将网页添加为应用；浏览器提供安装提示时，页面顶部也会显示「安装到桌面」。安装后可从图标进入同一个应用。

项目包含静态页面缓存，登录、打卡、批阅和同步仍需要连接服务器。安装入口与显示方式取决于浏览器和设备。

参考：[MDN：PWA 安装条件与浏览器支持](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)。

## 技术与代码结构

前端使用原生 HTML、CSS 和 JavaScript，由 Express 同时提供页面与 API，无需单独的前端构建步骤。

| 组成 | 实现 |
|---|---|
| 服务端 | Node.js + Express |
| 数据库 | PostgreSQL + `pg`；本地预览使用开发依赖 `pg-mem` |
| 账号 | `bcryptjs` 保存密码哈希，`jsonwebtoken` 签发登录令牌 |
| 页面同步 | HTTP API + 定时轮询 |
| 安装与缓存 | Web App Manifest + Service Worker |

| 路径 | 职责 |
|---|---|
| [`src/server.js`](src/server.js) | 服务启动、路由、静态页面和健康检查 |
| [`src/db.js`](src/db.js) | 数据库选择、初始化、建表与查询 |
| [`src/auth.js`](src/auth.js) | 密码处理和登录鉴权 |
| [`src/routes/`](src/routes/) | 注册登录、配对、任务、状态、批阅与抓包接口 |
| [`public/app.js`](public/app.js) | 页面交互、数据加载和轮询 |
| [`public/styles.css`](public/styles.css) | 界面样式与窄屏布局 |
| [`public/manifest.webmanifest`](public/manifest.webmanifest)、[`public/sw.js`](public/sw.js) | 安装配置与静态资源缓存 |
| [`test/db-init.test.js`](test/db-init.test.js) | 数据库启动回归检查 |

## 常见问题

| 现象 | 处理方式 |
|---|---|
| 启动提示必须设置 `DATABASE_URL` | 检查 Web Service 的 Environment，确认变量名、连接串和数据库状态；保存后重新部署 |
| 本地提示缺少 `pg-mem` | 执行 `npm install --include=dev`；内存预览使用非生产环境 |
| 本地重启后账号或任务消失 | 内存库会随进程结束清空；实际使用配置 PostgreSQL |
| 对方的状态没有立刻变化 | 等待下一次轮询，并保持页面可见；输入框有焦点时页面可能延后重绘 |
| 退出或关闭页面后仍短暂显示在线 | 在线标记按最近 2 分钟的活跃记录估计 |
| 登录失效 | 重新登录，并确认部署时保持 `JWT_SECRET` 稳定 |
| Free 服务首次打开较慢 | 等待休眠中的服务启动；持续使用时根据需要调整服务方案 |
| 数据库到期或不可用 | 检查数据库状态和方案期限；单独重启 Web Service 无法恢复已删除的数据 |

<details>
<summary>GitHub 连接超时：临时使用本机代理（Windows / PowerShell）</summary>

以下命令适用于 HTTPS 远程仓库，假设 Clash 类代理正在运行，端口为 `7897`。在本机项目目录执行：

```powershell
Test-NetConnection 127.0.0.1 -Port 7897
git remote -v
git -c http.proxy=http://127.0.0.1:7897 ls-remote origin
git -c http.proxy=http://127.0.0.1:7897 pull --ff-only origin main
git -c http.proxy=http://127.0.0.1:7897 push origin main
```

`-c` 仅影响当前命令，结束后代理设置自动失效。`http.proxy` 同样适用于 HTTPS 仓库。`Test-NetConnection github.com -Port 443` 测试的是直连，结果为 `False` 时，经代理访问仍可能成功。

如果之前另行设置过全局代理，需要取消那些旧配置，可以执行；未设置的键提示不存在是正常的：

```powershell
git config --global --unset-all http.proxy
git config --global --unset-all https.proxy
```

</details>
