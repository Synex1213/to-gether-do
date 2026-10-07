# 两个人的打卡 · Couple Connect

情侣之间使用的远程网页应用：各自给每天定任务，对方能看到完成情况、看到你的实时状态，并能给你的任务做表情/留言批阅；还有「摸鱼被抓」的趣味互动。

## 功能

- **账号 + 情侣配对**：各自注册登录，用 6 位配对码绑定，只能看到彼此
- **每日 TodoList**：给自己定任务、勾选完成；对方可查看每条任务的完成状态、完成时间与当日进度，可切换日期回看历史
- **远程状态**：心情、专注状态、正在做什么、在线 / 最后活跃时间
- **批阅**：对 TA 的任务发表情（😘 亲亲 / 🤗 抱抱 / 💪 加油 / 💢 敲头）或写留言
- **摸鱼 & 抓包**：可把状态设为「摸鱼中」，对方点「抓包」即记录一次「摸鱼被抓现行」，含次数统计、历史与防刷屏冷却

技术上零平台私有依赖：Node.js + Express + PostgreSQL，前端为原生页面（无需构建），并支持作为 PWA 安装到电脑桌面。

---

## 一、本地运行（可选，用于先看效果）

```bash
npm install --include=dev
npm start
```

打开 http://localhost:3000 。未配置数据库时使用内存库，**重启即清空**，仅用于本地预览。

本地预览不要设置 `NODE_ENV=production`。生产环境必须配置 `DATABASE_URL`，否则启动会直接给出配置提示，不会退回内存库。

运行 `npm test` 可检查生产环境缺少连接串、PostgreSQL 分支选择、本地缺依赖提示和内存库建表/读写。

---

## 二、部署到 Render（让两人真正远程同步）

### 1. 把代码推送到 GitHub

```bash
cd couple-connect
git init
git add .
git commit -m "init couple-connect"
git branch -M main
```

到 https://github.com/new 新建一个**空仓库**（不要勾选 README），然后：

```bash
git remote add origin https://github.com/<你的用户名>/couple-connect.git
git push -u origin main
```

### 2. 用 Blueprint 一键部署（推荐）

1. 打开 https://dashboard.render.com 登录
2. 右上角 **New +** → **Blueprint**
3. 选择刚才的仓库（首次需授权 GitHub），分支选 `main`
4. 检查数据库与 Web Service 的 Region 相同，再点 **Apply**

Render 会自动创建：

- PostgreSQL 数据库 `couple-connect-db`
- Web 服务 `couple-connect`，并自动关联 `DATABASE_URL`、生成 `JWT_SECRET`

部署完成后得到地址，形如 `https://couple-connect-xxxx.onrender.com`。
首次启动会自动建好所有数据表，无需手动建表或迁移。

**如果已经单独创建了 Web Service，直接配置现有服务即可。** 仓库包含 `render.yaml` 不等于现有 Web Service 已使用 Blueprint；手动创建的服务仍需手动关联数据库。

1. Render → **New + → Postgres**（部分界面显示 PostgreSQL），数据库名称可用 `couple-connect-db`。选择与现有 Web Service **相同的 Region**，等状态变为 `Available`。已有可用数据库则直接使用。
2. 打开数据库页面 → **Connect → Internal**（或 Info 页面中的 Internal Database URL），复制完整连接串。
3. 打开现有 Web Service → **Settings**，确认仓库为 `Synex1213/to-gether-do`，分支为 `main`，Runtime 为 Node，Root Directory 留空（项目位于仓库根目录），Build Command 为 `npm install --omit=dev`，Start Command 为 `node src/server.js`。Health Check Path 可填 `/api/health`。
4. Web Service → **Environment**，添加下面三个变量。连接串和密钥填写实际值，不要包含尖括号或额外引号：

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | 第 2 步复制的完整 Internal Database URL |
   | `JWT_SECRET` | 随机长字符串，已经设置过则保留原值 |
   | `NODE_ENV` | `production` |

   密钥可在本机生成：`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`。不要提交连接串或密钥到 GitHub。此项目直接读取进程环境变量，不会自动加载本地 `.env` 文件。
5. 选择 **Save, rebuild, and deploy**。若环境变量已经保存但尚未部署，可用 **Manual Deploy → Deploy latest commit**。
6. Logs 应出现 `Couple Connect running ... (store: postgres)`。访问 `https://你的服务地址/api/health` 应返回 `{"ok":true,"store":"postgres"}`。注册账号并创建任务后重启服务，再登录确认数据仍在。

同区域 Internal URL 通常无需额外设置 `PGSSL`，保留默认值即可。代码仍支持用 `PGSSL=true` 显式启用 TLS。

Render 的 Free PostgreSQL 在创建 30 天后到期，之后有 14 天升级宽限期，宽限期结束会删除数据库。长期保存打卡记录应使用付费 PostgreSQL。`render.yaml` 保留原有 Free 配置用于试用，未自动更改计费方案。

参考：[Render 数据库连接](https://render.com/docs/postgresql-creating-connecting)、[环境变量保存与部署](https://render.com/docs/configure-environment-variables)、[Free PostgreSQL 限制](https://render.com/docs/free#free-postgres)。

### 3. 两人开始使用

1. 各自打开上面的网址，分别**注册**自己的账号
2. 一方点「生成我的配对码」，把 6 位码发给另一方
3. 另一方在首页输入配对码「绑定 TA」
4. 之后即可互相查看任务、状态并批阅、抓包

---

## 三、安装成电脑桌面软件（PWA）

部署后的网页可直接“安装”，得到桌面图标、独立窗口、开始菜单入口，体验与桌面软件基本一致：

- 用 **Chrome 或 Edge** 打开 Render 网址
- 点击地址栏右侧的**安装图标**，或浏览器菜单 →「安装 “两个人的打卡”」
- 安装后从桌面图标启动；可在 Windows 设置 → 应用 → 启动里设为开机自启

> 需要真正的 `.exe` 安装包（Electron）也可以做：用 Electron 加载该网址再用
> electron-builder 打包。但 PWA 已能满足绝大多数桌面体验，建议先用 PWA；
> 确有需要再让我补 Electron 工程。

---

## 环境变量

| 变量 | 必需 | 说明 |
|---|---|---|
| `PORT` | Render 自动注入 | 服务监听端口，无需手动设置 |
| `DATABASE_URL` | 是 | PostgreSQL 连接串，Blueprint 自动关联 |
| `JWT_SECRET` | 是 | 登录令牌密钥，Blueprint 用 `generateValue` 自动生成 |
| `NODE_ENV` | 是 | 生产环境设为 `production` |
| `PGSSL` | 否 | `true` 时显式启用 TLS；Render 同区域 Internal URL 可保持未设置 |

---

## 常见问题

- **免费版第一次打开很慢 / 偶尔要等**：Render Free 服务闲置约 15 分钟会休眠，冷启动约需 30–50 秒。介意可在服务设置里升级到 Starter 计划。
- **接口报错 / 数据不保存**：查看 Render 服务 Logs，确认 `DATABASE_URL` 已关联、数据库状态正常。
- **启动提示必须设置 DATABASE_URL**：确认变量加在 Web Service 的 Environment 中，变量名为 `DATABASE_URL`，值不是空白；保存后重新部署。
- **本地启动提示缺少 pg-mem**：运行 `npm install --include=dev`。`pg-mem` 仅用于本地预览，生产环境继续使用 `npm install --omit=dev`。
- **登录很快失效**：确认 `JWT_SECRET` 已设置且不要频繁更换（更换会使所有登录失效）。
- **想本地连真实 PostgreSQL**：设置环境变量 `DATABASE_URL=postgresql://用户:密码@主机:5432/couple_connect` 后再 `npm start`。

## Git 推送通过本机代理（Windows / PowerShell）

在本机项目目录执行，保持 Clash 正在运行且代理端口为 `7897`。下面命令适用于 HTTPS 远程仓库：

```powershell
Test-NetConnection 127.0.0.1 -Port 7897
git remote -v
git -c http.proxy=http://127.0.0.1:7897 ls-remote origin
git -c http.proxy=http://127.0.0.1:7897 push origin main
```

`-c` 只影响当前命令，命令结束后代理配置自动失效，无需执行取消命令。它不会修改本机原有 Git 配置。`http.proxy` 同样适用于 HTTPS 仓库，不需要关闭证书校验。若远程地址是 SSH，可先改为本项目的 HTTPS 地址：

```powershell
git remote set-url origin https://github.com/Synex1213/to-gether-do.git
```

如果之前手动设置过全局代理，希望取消那些旧配置，可执行（未设置的键提示不存在是正常的）：

```powershell
git config --global --unset-all http.proxy
git config --global --unset-all https.proxy
```

`Test-NetConnection github.com -Port 443` 检查的是直连，不会使用 Git 的 `-c` 代理；其结果为 `False` 时，经代理推送仍可能成功。
