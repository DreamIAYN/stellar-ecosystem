# 星环架构

## 设计目标

1. **同一轨道**：应用不是孤立页面，文件、会话、AI、通知与窗口都共享同一套核心对象。
2. **Local-first**：默认不依赖账号与中心服务器；元数据与 Blob 都在本机，可完整导出。
3. **可移植**：Web/PWA、Docker 自托管与 Electron 壳复用同一前端；没有平台专属业务逻辑。
4. **可审计**：开源、纯前端 AI 直连、信令服务无数据库、媒体默认 P2P。
5. **诚实的边界**：浏览器无法做到的（跨站 iframe、OS 输入注入）明确说明并提供替代路径。

## 分层

### Shell

- `components/Shell.tsx`：壁纸、窗口层、Dock、覆盖层、全局快捷键。
- `WindowFrame.tsx`：拖拽/缩放/最大化/最小化；桌面持久化在 Zustand。
- `TopBar.tsx`：品牌、本地节点、指令中心入口、通知、助手、个人菜单。
- `Home.tsx`：桌面 Bento 仪表盘。
- `CommandPalette.tsx`：应用、文件、会话、笔记、书签、操作的统一检索。
- `ShareSheet.tsx`：跨应用分享中枢。
- `Launcher.tsx`、`NotificationsPanel.tsx`、`Shortcuts.tsx`、`Toasts.tsx`。

### Core

- `types.ts`：窗口、文件、会话、朋友圈、AI、扫描、笔记、浏览器等类型。
- `store.ts`：单一 Zustand Store（persist），所有应用只通过 action 修改状态。
- `db.ts`：IndexedDB 的 `blobs` / `kv` 两个 object store，负责二进制内容。
- `ecosystem.ts`：跨应用 SDK（`open`、`share`、`saveFile`、`askAI`、`sendFileToChat` 等）。
- `ai.ts`：OpenAI / Anthropic / Gemini / Ollama 的统一流式适配器与离线演示模型。
- `seed.ts`：首次启动的演示数据（全部由代码生成，无外部版权素材）。
- `registry.tsx`：应用元数据、图标、默认窗口尺寸。

### Apps

每个应用位于 `src/apps/<app>/`，默认导出 React 组件，接收 `params` 与 `winId`。应用通过 `AppRenderer` 懒加载，单个应用崩溃由 `AppErrorBoundary` 隔离。

### Edge

`apps/server/src/index.ts`：

- Express 静态托管 `apps/web/dist`（生产）。
- `/ws` WebSocket 信令：房间、peer 列表、offer/answer/ICE、房间聊天、状态广播、离开。
- 8 人房间上限、名称/房间号清洗、消息长度限制、30s 心跳。
- `/api/health`、`/api/ice`（可选 TURN 环境变量）。

## 应用间调用

```text
App A ── ecosystem.saveFile(blob) ──► IndexedDB blobs
   │                                  └─► Store.files (metadata)
   ├── ecosystem.open('im', {chatId}) ─► Window Manager
   ├── ecosystem.sendFileToChat(fileId, chatId) ─► Store.chats
   ├── ecosystem.askAI({prompt, context}) ─► aiQueue ─► AI App
   ├── ecosystem.share(payload) ─► ShareSheet
   └── ecosystem.notify(...) ─► Notifications + Toasts
```

- **文件只传 ID**：聊天、编辑器、播放器、扫描仪、笔记均引用 `fileId`，避免大对象在应用间复制。
- **AI 队列**：`aiQueue` 让任意应用把问题与上下文投递给智核；AI 应用消费后新建会话并流式回复。
- **窗口参数**：`openApp(appId, params)` 是深链接；同一应用单实例，参数合并并聚焦。
- **通知动作**：通知可以携带 `{ appId, params }`，点击后完成跨应用跳转。

## 数据模型摘要

```ts
interface DriveFile {
  id: string; name: string; kind: 'file' | 'folder'
  parentId: string | null; mime: string; size: number
  blobId?: string; text?: string; externalUrl?: string
  thumb?: string; starred?: boolean; trashed?: boolean
  sourceApp?: AppId; tags?: string[]
}
```

文本文件优先存 `text`（可被编辑器/AI 直接读取）；二进制文件存 `blobId` 指向 IndexedDB。上传图片会生成缩略图 `thumb`（JPEG data URL）以便快速渲染。

## 扫描图像管线

```text
Camera / File / Cloud
  → HTMLImageElement
  → 四点归一化坐标 (0..1)
  → Homography（目标矩形 → 源四边形）
  → 逐像素重采样（上限 1700px）
  → 滤镜（original / enhance / magic / gray / bw / removeInk）
  → JPEG data URL（页面预览 / OCR / PDF）
```

`removeInk` 使用 HSV 饱和度 + 色度边缘判定，并针对抗锯齿边缘增加 `chroma + warm/cool` 条件，减少彩色笔迹残留。

## 安全与限制

- 无服务端数据库、无遥测；信令服务器不持有用户文件。
- 媒体走 WebRTC P2P；STUN 仅用于发现，TURN 为可选中继。
- Web 端内置浏览器受目标网站 `X-Frame-Options` / CSP 限制。
- Web 端远控无法向操作系统注入键鼠事件；仅同步指针/剪贴板/截图。
- API Key 存储于 localStorage；生产环境应使用服务端代理。
- OCR 首次运行从 CDN 获取语言包，存在网络依赖，可通过自托管语言包替换。

## 可移植性

- 前端没有 Node API 依赖（除信令 URL），可直接部署为静态站点 + 独立信令服务。
- 生产镜像由一个 Node 进程同时托管 SPA 与信令，方便 `docker compose up`。
- Electron 壳仅提供窗口/原生菜单/文件系统桥接的扩展点，不改变业务代码。
- 所有数据可通过 Zip 导出，避免锁定。
