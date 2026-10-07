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
npm install
npm start
```

打开 http://localhost:3000 。未配置数据库时使用内存库，**重启即清空**，仅用于本地预览。

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
4. 直接点 **Apply**

Render 会自动创建：

- PostgreSQL 数据库 `couple-connect-db`
- Web 服务 `couple-connect`，并自动关联 `DATABASE_URL`、生成 `JWT_SECRET`

部署完成后得到地址，形如 `https://couple-connect-xxxx.onrender.com`。
首次启动会自动建好所有数据表，无需手动建表或迁移。

> 备选（手动）：New + → PostgreSQL 先建库，再 New + → Web Service，
> Build Command 填 `npm install --omit=dev`，Start Command 填 `node src/server.js`，
> 并在 Environment 里加 `DATABASE_URL`（数据库的 Internal Database URL）、
> `NODE_ENV=production`、`JWT_SECRET`（随机长字符串）。

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

---

## 常见问题

- **免费版第一次打开很慢 / 偶尔要等**：Render Free 服务闲置约 15 分钟会休眠，冷启动约需 30–50 秒。介意可在服务设置里升级到 Starter 计划。
- **接口报错 / 数据不保存**：查看 Render 服务 Logs，确认 `DATABASE_URL` 已关联、数据库状态正常。
- **登录很快失效**：确认 `JWT_SECRET` 已设置且不要频繁更换（更换会使所有登录失效）。
- **想本地连真实 PostgreSQL**：设置环境变量 `DATABASE_URL=postgresql://用户:密码@主机:5432/couple_connect` 后再 `npm start`。
