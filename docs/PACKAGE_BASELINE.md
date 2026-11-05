# 软件包基线与恢复说明

2.0 的界面以用户上传的桌面软件包为准，而不是 1.3 的宽屏网页布局。

## 采用的基线

- `couple-widget-upload.zip`：Electron 无边框透明窗、340×560 展开尺寸、置顶与托盘、单列卡片的设计来源。
- `couple-connect.zip`：Express API 与静态页面的参考。保留 GitHub 后续已修复的配对事务、解绑、回应参数和生产数据库配置。
- `couple-app-src.zip`：另一个 React 网页原型，仅作对照，不把其中的整页导航、情侣品牌或私有配置引入桌面客户端。
- `icon-transparent-final.png`：采用其真实 RGBA 通道；PNG 原图未重绘，ICO 仅做安装所需的格式导出。

## 本次的界面约束

- 默认 320×244，仅显示双方近况；展开回到原版 340×560。
- 左上可拖动，右上置顶、展开/收起、最小化和隐藏到托盘；靠桌面右下角首次出现，后续记住位置。
- 蓝、紫、绿、黄、粉及黑白七种主题缩成底部色点，默认保留原版绿的方向。
- 日历选择日期，不使用逐天前后翻页。历史只回看计划，实时状态独立。
- 不新增消息流、排行榜或复杂通知；计划、互动和设置仅在展开后按需显示。
- 网页入口和桌面端共享同一份 widget 代码，防止再次演变为独立的大型页面。

## 上传文件指纹

| 文件 | SHA-256 |
| --- | --- |
| couple-widget-upload.zip | `92afa116209743b793be2a9663fad62126c3e3253dfd75333d1868a9db04aa12` |
| couple-connect.zip | `5dd3353af49403b9fc47e0e20896f0d79d1e9e3bea497e0ef3c5635ee349658e` |
| couple-app-src.zip | `565a39b30486112a33dd2e4bc7d5dae3bef64389cc1cd5f085f8b9aa88dabdb1` |
| icon-transparent-final.png | `e6f7da2bd64a1a02d73852ac54cf3f0eb3fbd5835074668aa111086ffa463c63` |
