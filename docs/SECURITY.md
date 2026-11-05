# 安全模型与限制

## 数据

- 默认无账号、无遥测、无中心数据库。
- 文件 Blob 在浏览器 IndexedDB；元数据在 localStorage。
- 导出备份为 Zip，包含元数据、Blob 与 AI Key 配置；请视为敏感文件。
- 清理浏览器站点数据会删除本地云巢。

## AI Key

- Key 仅保存在当前浏览器 localStorage。
- 请求由浏览器直接发往服务商；星环服务端不接触 Key。
- 生产环境建议自建同源代理，把 Key 保存在服务端并通过鉴权控制访问。

## WebRTC

- 会议/远控使用 DTLS-SRTP 加密；媒体默认点对点。
- STUN 仅用于发现公网地址。TURN 中继能看到加密流量的元数据，但无法解密媒体。
- 房间号是弱凭证；请使用随机、足够长的房间号，并在公网部署 HTTPS。

## 浏览器限制

- 跨站 iframe 受目标站点 `X-Frame-Options` / CSP 约束。
- Web 端远控不能注入 OS 键鼠；仅同步指针、剪贴板与截图。
- 摄像头/麦克风/屏幕共享需要用户手势与安全上下文（HTTPS 或 localhost）。
- OCR 首次运行会从 CDN 加载语言包；若需离线，可自托管语言包并修改 Tesseract 配置。

## 依赖与供应链

- 锁定文件 `pnpm-lock.yaml`；CI 建议运行 `pnpm install --frozen-lockfile`。
- 新增依赖必须记录到 `THIRD_PARTY_NOTICES.md` 并检查许可证。
- 本项目未使用微信、腾讯会议、ToDesk、扫描全能王的任何私有代码或素材。

## 报告漏洞

请通过仓库 Issue（标记 `security`）或维护者邮箱私下报告，不要在公开 Issue 中粘贴可利用细节。我们会在确认后尽快修复并致谢。
