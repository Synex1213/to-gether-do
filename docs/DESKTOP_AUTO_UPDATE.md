# Windows 桌面版自动更新与发布

这个功能只作用于 Windows Electron NSIS 安装版。Render 的 Express 启动命令仍然是 node src/server.js，后端 PostgreSQL、网页及桌面任务功能保留。

## 已实现功能

- 已安装的 Windows 程序在启动时检查更新，运行期间每 4 小时检查一次。检测到高于当前版本的稳定版后自动下载。
- 下载完成后询问「立即更新 / 稍后」。立即更新会允许托盘程序真正退出并安装。稍后可以在托盘菜单「检查软件更新」再次打开安装提示。
- 开发态（npm run desktop）和非 Windows 环境不会检查更新。
- .github/workflows/desktop-ci.yml：PR 自动运行 npm test 并尝试生成 Windows NSIS 测试安装包。
- .github/workflows/desktop-release.yml：仅推送与 package.json 一致的 v* 标签才触发正式 Windows Release。构建器先上传 EXE、latest.yml 和相关文件，成功后再公开草稿 Release。
- .github/workflows/sync-desktop-lockfile.yml：第一次向 desktop-auto-update 分支提交时自动从 npm 官方源重建依赖锁文件并提交，保证 CI 的 npm ci 可以使用。

## 第一次验收

1. 查看 GitHub Actions 中的 Synchronize desktop lockfile 是否成功。分支中应出现机器人提交 build: synchronize desktop dependency lockfile。如果没有写入权限，在本地项目执行 npm install --package-lock-only，提交更新的 package-lock.json。
2. 创建或更新 PR，检查 Desktop CI (Windows) 中的测试、打包步骤全部通过。该工作流的 artifact 仅用于验收，不能替代 Releases 中的正式更新发布。
3. 将 PR 合并到 main，并确认 package.json 当前版本号。例如目前是 1.0.0，则在对应 main 提交上创建 v1.0.0 标签并推送。
4. 等待 Publish Windows desktop release 工作流成功。GitHub Releases 中应存在正式发布且包含 NSIS EXE、latest.yml，以及构建器生成的其他更新文件。
5. 在 Windows 安装首次正式发行版、填写 Render HTTPS 地址，验收登录、任务、托盘、开机自启、始终置顶及关闭隐藏行为。
6. 下一次将 package.json 版本更新到 1.0.1 并提交，再推送 v1.0.1 标签。运行已安装的 v1.0.0，验证下载完成提示、「稍后」、托盘检查更新和「立即更新」安装流程。

## 后续发布（在 main 干净工作区）

    npm version patch
    git push origin main --follow-tags

版本标签必须与 package.json 的 version 匹配。普通提交只由 Render 处理网页/API 部署，不会发布 Windows 安装包。

旧的、不包含更新模块的 EXE 必须手动安装一次带有此功能的 NSIS 正式发行版，之后才会自动更新。

## 权限与安全

- 仓库需要启用 GitHub Actions。Release workflow 使用 GitHub 自动分配的 GITHUB_TOKEN 与 contents:write，不要把令牌写入桌面程序、仓库文件或 Render 环境变量。
- 下载源为公开 GitHub Releases。改私有仓库前要重新设计授权的更新分发方式，不能把私人 GitHub Token 嵌入客户端。
- 建议给 Windows 安装包签名，可设置 Actions Secrets：WIN_CSC_LINK 和 WIN_CSC_KEY_PASSWORD。未签名程序可能触发 Windows SmartScreen；不要随意停用签名校验。
- 只能以 NSIS 安装版验证自动更新；单独的 portable EXE 不适用于此流程。
- latest.yml 必须和 EXE 来自同一次构建并共同出现在公开 Release 中。Draft Release 对普通客户端不可见，不能只上传 EXE。
- 如果锁文件同步自动推送失败，先手动提交 lockfile；不要将 npm ci 改成永久无锁依赖安装以掩盖错误。

## 故障定位

- 未发现新版本：确认新版本号更高、不是 draft、标签与版本一致、公开 Release 包含 latest.yml。
- 更新下载失败：检查 GitHub 网络访问、文件校验与 Releases 资产。
- 更新安装失败：检查签名、NSIS 安装方式、用户权限与托盘关闭拦截。
- Render 服务仍从 src/server.js 启动。浏览器端与桌面客户端都使用相同后端 API，不要把 Render 的 startCommand 改为 electron .。

