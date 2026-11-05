import type {
  AIConversation,
  AIProvider,
  Bookmark,
  BrowserTab,
  Chat,
  Contact,
  DriveFile,
  MeetingRecord,
  Moment,
  Notebook,
  NotificationItem,
  Profile,
  ScanDoc,
  Preferences,
} from './types'
import { daysAgo, makeArt, minutesAgo, nowIso, uid } from './utils'

const projectReadme = `# 星环 Stellar

> 一个开源、本地优先、可自托管的个人数字生态。

## 同一轨道上的 12 个应用

- **星讯** — IM、朋友圈、语音与视频通话
- **云巢** — 云盘、跨应用接力与备份
- **声影** — 音视频播放器
- **扫描师** — 文档 / 试卷去手写 / 证件扫描
- **智核** — 多模型 AI 工作台
- **会客厅** — WebRTC 会议与直播
- **代码工坊** — 文本与代码编辑器
- **远界** — 远程协助
- **墨记** — 手写压感笔记本
- **漫游** — 内置浏览器
- **小环** — 语音助手
- **控制台** — 偏好、数据与许可

## 设计原则

1. **Local-first**：数据默认留在设备，可导出、可迁移。
2. **可组装**：所有应用通过同一套事件总线互相调用。
3. **可移植**：浏览器、PWA、桌面壳与 Docker 共用一份代码。
4. **开放**：Apache-2.0，欢迎 Fork 与自托管。
`

const architecture = `# 生态架构

\`\`\`
┌──────────────────────────── Stellar Shell ────────────────────────────┐
│  Dock · Window Manager · Command Palette · Notification Center       │
├──────────────────────────────────────────────────────────────────────┤
│  IM    Drive   Scanner   AI   Meet   Editor   Remote   Notes   ...  │
├──────────────────────────────────────────────────────────────────────┤
│  Ecosystem SDK — open() · share() · saveFile() · askAI() · notify()  │
├──────────────────────────────────────────────────────────────────────┤
│  Zustand Store · IndexedDB Blob Store · WebRTC Signaling (Node/WS)   │
└──────────────────────────────────────────────────────────────────────┘
\`\`\`

## 应用如何互相调用

任何应用都可以通过 \`ecosystem\` 单例发起跨应用动作：

\`\`\`ts
// 扫描仪：把 PDF 保存到云巢，再交给星讯发送
const file = await ecosystem.saveBlob(pdfBlob, { name: '合同.pdf', mime: 'application/pdf' })
ecosystem.open('im', { shareFileId: file.id, to: 'contact-lin' })

// 任意应用：把内容交给 AI
ecosystem.askAI({ prompt: '总结这份会议纪要', context: noteText, origin: 'notes' })
\`\`\`

## 端口

- Web / PWA：5173（开发）
- 信令 + 静态服务：8787
- WebSocket：\`/ws\`
`

const ideas = `# 产品灵感池

## 已落地
- 扫描仪 → 云巢 → 星讯：合同扫描后一键发送
- 会议 → 云巢：录制文件自动归档
- 浏览器 → 智核：网页摘要
- 语音助手 → 任意应用：自然语言唤醒

## 下一步
- 端到端加密的 P2P 文件传输
- 桌面代理的 OS 级远控输入
- 扫描件表格结构识别
- 多设备增量同步（CRDT）
`

const promptLibrary = `# 提示词库

## 审阅
你是一位严谨的产品评审专家。请从用户价值、边界条件、实现成本三个维度审阅以下方案，并给出可执行的改进项。

## 扫描件
你是一位档案数字化专家。请从以下 OCR 文本中提取标题、日期、甲乙方与关键条款，输出 Markdown 表格。

## 代码
你是一位资深 TypeScript 工程师。请指出这段代码的并发、错误处理与可维护性问题，并给出最小补丁。
`

const meetingNotes = `# 星环 v0.1 评审纪要

时间：周四 20:00
地点：会客厅 / STL-2048

## 结论
1. 扫描仪的试卷去手写作为首发差异化能力。
2. 生态内所有文件默认进入云巢，应用之间只传 fileId。
3. 桌面端先以 PWA + Electron 壳验证，再评估 Tauri。

## 待办
- [ ] 补全远控桌面代理的输入注入
- [ ] 扫描 PDF 支持批量导出
- [ ] 会议录制自动转写
`

const licenseNote = `# 开源与许可

星环 Stellar 以 Apache-2.0 许可开源。你可以自由使用、修改、分发与商业部署。

## 第三方
- React / Vite / Zustand / lucide-react — MIT
- CodeMirror — MIT
- jsPDF — MIT
- Tesseract.js — Apache-2.0
- Marked — MIT
- JSZip — MIT / GPL-3.0（双许可，本项目按 MIT 使用）

本项目与微信、腾讯会议、ToDesk、扫描全能王无任何关联，界面仅作功能参考，未使用其商标或私有资源。所有演示图片由代码生成。
`

const helloHtml = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>Hello Stellar</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#070a12;color:#eaf2ff;font-family:system-ui,sans-serif}
    .card{padding:48px 56px;border-radius:28px;background:linear-gradient(145deg,rgba(105,230,255,.12),rgba(155,140,255,.08));border:1px solid rgba(255,255,255,.1);text-align:center;box-shadow:0 30px 100px rgba(0,0,0,.5)}
    h1{margin:0 0 12px;font-size:42px;letter-spacing:-.03em;background:linear-gradient(90deg,#69e6ff,#9b8cff,#ff7ac8);-webkit-background-clip:text;color:transparent}
    p{color:#93a0b8;line-height:1.8}
    code{color:#69e6ff}
  </style>
</head>
<body>
  <div class="card">
    <h1>Hello, Stellar.</h1>
    <p>这份文件来自<code>云巢</code>，正在<code>代码工坊</code>里运行。</p>
  </div>
</body>
</html>
`

const ecosystemDemoTs = `// 在任意应用里调用生态能力
import { ecosystem } from '@stellar/sdk'

const { id } = await ecosystem.saveText({
  name: '扫描结果.md',
  text: '# OCR 结果\\n\\n这是从扫描仪直接写入云巢的文本。',
  folder: '扫描件',
})

ecosystem.open('ai', {
  prompt: '帮我整理这份 OCR 结果',
  contextFileId: id,
})

ecosystem.notify('代码工坊', '已保存到云巢', '扫描结果.md')
`

export function examSampleSvg() {
  const questions = [
    ['1', '已知函数 f(x)=x²-4x+3，求其顶点坐标与最小值。', '顶点 (2,-1)，最小值 -1', ''],
    ['2', '解方程 2x + 5 = 17。', 'x = 6', ''],
    ['3', '在直角三角形 ABC 中，∠C=90°，AC=3，BC=4，求 AB。', 'AB = 5', ''],
  ]
  const rows = questions
    .map(
      (q, i) => `
    <text x="92" y="${300 + i * 170}" class="q">${q[0]}. ${q[1]}</text>
    <text x="120" y="${350 + i * 170}" class="answer">${q[2]}</text>
    <line x1="90" y1="${372 + i * 170}" x2="760" y2="${372 + i * 170}" class="line"/>`,
    )
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="850" height="1120" viewBox="0 0 850 1120">
  <defs>
    <filter id="paper"><feTurbulence baseFrequency=".8" numOctaves="2" stitchTiles="stitch" type="fractalNoise" result="n"/><feColorMatrix in="n" type="saturate" values="0" result="g"/><feComponentTransfer in="g" result="t"><feFuncA type="linear" slope=".05"/></feComponentTransfer><feBlend in="SourceGraphic" in2="t" mode="multiply"/></filter>
  </defs>
  <rect width="850" height="1120" fill="#fffdf7" filter="url(#paper)"/>
  <text x="425" y="96" text-anchor="middle" class="title">数学 · 随堂练习</text>
  <text x="92" y="142" class="meta">姓名：纪辰　　班级：高二（3）班　　得分：______</text>
  <line x1="90" y1="170" x2="760" y2="170" class="line"/>
  ${rows}
  <text x="760" y="1035" text-anchor="end" class="meta">第 1 页 / 共 1 页</text>
  <text x="425" y="1080" text-anchor="middle" class="red">红笔为订正笔迹，扫描时请去除</text>
  <style>
    .title{font:700 34px 'Songti SC', serif; fill:#111}
    .meta{font:16px 'Songti SC', serif; fill:#333}
    .q{font:19px 'Songti SC', serif; fill:#1b1b1b}
    .answer{font:italic 22px 'Kaiti SC', 'STKaiti', cursive; fill:#c22b3f}
    .line{stroke:#c9c3b6;stroke-width:1.2}
    .red{font:16px 'Kaiti SC', cursive; fill:#c22b3f}
  </style>
</svg>`
}

export const CONTACTS: Contact[] = [
  { id: 'contact-lin', name: '林小满', hue: 188, online: true, signature: '把复杂的事做简单', region: '杭州', tags: ['设计', '产品组'], email: 'lin@stellar.local' },
  { id: 'contact-chen', name: '陈子航', hue: 258, online: true, signature: '正在重构边缘节点', region: '深圳', tags: ['工程', 'WebRTC'], email: 'chen@stellar.local' },
  { id: 'contact-zhou', name: '周未', hue: 28, online: false, signature: '光是最好的滤镜', region: '大理', tags: ['摄影'], email: 'zhou@stellar.local' },
  { id: 'contact-ache', name: '阿澈', hue: 332, online: true, signature: '产品经理 / 露营爱好者', region: '上海', tags: ['产品', '露营'], email: 'ache@stellar.local' },
  { id: 'contact-yu', name: '余安', hue: 128, online: false, signature: '慢一点，比较快', region: '北京', tags: ['财务'], email: 'yu@stellar.local' },
]

const artA = makeArt(7, 'AURORA / 07')
const artB = makeArt(18, 'MOUNTAIN / 18')
const artC = makeArt(31, 'CAMP / 31')
const artD = makeArt(46, 'STUDIO / 46')

export const DRIVE_FILES: DriveFile[] = [
  {
    id: 'file-welcome',
    name: '星环 · 从这里开始.md',
    kind: 'file',
    parentId: null,
    mime: 'text/markdown',
    size: projectReadme.length,
    text: projectReadme,
    starred: true,
    createdAt: daysAgo(2),
    updatedAt: minutesAgo(42),
    sourceApp: 'notes',
    tags: ['置顶'],
  },
  {
    id: 'file-contract',
    name: '劳动合同-扫描件.svg',
    kind: 'file',
    parentId: null,
    mime: 'image/svg+xml',
    size: 0,
    text: `<svg xmlns="http://www.w3.org/2000/svg" width="850" height="1120"><rect width="850" height="1120" fill="#fffdf8"/><text x="425" y="90" text-anchor="middle" font-family="serif" font-size="28" font-weight="700" fill="#111">劳动合同</text><text x="90" y="140" font-family="serif" font-size="15" fill="#333">甲方：星环科技有限公司</text><text x="90" y="172" font-family="serif" font-size="15" fill="#333">乙方：纪辰</text><line x1="90" y1="198" x2="760" y2="198" stroke="#bbb"/><g font-family="serif" font-size="14" fill="#222"><text x="90" y="240">第一条 合同期限</text><text x="90" y="270">本合同自 2025 年 11 月 01 日起生效，至 2028 年 10 月 31 日止。</text><text x="90" y="320">第二条 工作内容</text><text x="90" y="350">乙方担任生态产品设计工作，工作地点为杭州。</text><text x="90" y="400">第三条 保密与知识产权</text><text x="90" y="430">双方对合作过程中知悉的商业信息承担保密义务。</text><text x="90" y="480">第四条 其他</text><text x="90" y="510">本合同一式两份，甲乙双方各执一份。</text></g><g font-family="cursive" font-size="40" fill="#1d4ed8" opacity=".9" transform="rotate(-8 500 920)"><text x="470" y="900">仅供入职使用</text></g><line x1="90" y1="980" x2="360" y2="980" stroke="#999"/><line x1="480" y1="980" x2="750" y2="980" stroke="#999"/><text x="90" y="1010" font-family="serif" font-size="13" fill="#555">甲方（盖章）</text><text x="480" y="1010" font-family="serif" font-size="13" fill="#555">乙方（签字）</text></svg>`,
    thumb: makeArt(91, 'CONTRACT / 91', 600, 800),
    starred: true,
    createdAt: daysAgo(1),
    updatedAt: minutesAgo(88),
    sourceApp: 'scanner',
    tags: ['扫描', '合同'],
  },
  {
    id: 'file-brand-poster',
    name: '品牌主视觉.svg',
    kind: 'file',
    parentId: null,
    mime: 'image/svg+xml',
    size: 0,
    text: `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#05070d"/><stop offset="1" stop-color="#16112b"/></linearGradient><radialGradient id="b"><stop stop-color="#69e6ff" stop-opacity=".7"/><stop offset="1" stop-color="#69e6ff" stop-opacity="0"/></radialGradient></defs><rect width="900" height="1200" fill="url(#a)"/><circle cx="670" cy="320" r="260" fill="url(#b)"/><circle cx="450" cy="480" r="230" fill="none" stroke="#9b8cff" stroke-width="2" opacity=".5"/><ellipse cx="450" cy="480" rx="340" ry="120" fill="none" stroke="#69e6ff" stroke-width="1.5" opacity=".4" transform="rotate(-24 450 480)"/><text x="450" y="980" text-anchor="middle" fill="#f4f8ff" font-family="sans-serif" font-size="58" font-weight="800" letter-spacing="20">STELLAR</text><text x="450" y="1030" text-anchor="middle" fill="#7e8aa3" font-family="sans-serif" font-size="16" letter-spacing="10">ONE ORBIT. ALL YOUR LIFE.</text></svg>`,
    thumb: artD,
    createdAt: daysAgo(3),
    updatedAt: daysAgo(3),
    sourceApp: 'editor',
    tags: ['品牌'],
  },
  { id: 'folder-projects', name: '项目', kind: 'folder', parentId: null, mime: 'application/x-folder', size: 0, createdAt: daysAgo(48), updatedAt: daysAgo(1), starred: true },
  { id: 'folder-stellar', name: '星环 Stellar', kind: 'folder', parentId: 'folder-projects', mime: 'application/x-folder', size: 0, createdAt: daysAgo(40), updatedAt: daysAgo(1) },
  { id: 'folder-docs', name: '文档', kind: 'folder', parentId: null, mime: 'application/x-folder', size: 0, createdAt: daysAgo(40), updatedAt: daysAgo(2) },
  { id: 'folder-scans', name: '扫描件', kind: 'folder', parentId: null, mime: 'application/x-folder', size: 0, createdAt: daysAgo(30), updatedAt: daysAgo(1), starred: true },
  { id: 'folder-media', name: '音视频', kind: 'folder', parentId: null, mime: 'application/x-folder', size: 0, createdAt: daysAgo(30), updatedAt: daysAgo(3) },
  { id: 'folder-images', name: '图片', kind: 'folder', parentId: null, mime: 'application/x-folder', size: 0, createdAt: daysAgo(30), updatedAt: daysAgo(3) },
  { id: 'folder-code', name: '代码', kind: 'folder', parentId: null, mime: 'application/x-folder', size: 0, createdAt: daysAgo(26), updatedAt: daysAgo(1) },
  {
    id: 'file-readme',
    name: 'README.md',
    kind: 'file',
    parentId: 'folder-stellar',
    mime: 'text/markdown',
    size: projectReadme.length,
    text: projectReadme,
    starred: true,
    createdAt: daysAgo(38),
    updatedAt: daysAgo(1),
    sourceApp: 'editor',
    tags: ['文档', '开源'],
  },
  {
    id: 'file-arch',
    name: 'ARCHITECTURE.md',
    kind: 'file',
    parentId: 'folder-stellar',
    mime: 'text/markdown',
    size: architecture.length,
    text: architecture,
    createdAt: daysAgo(20),
    updatedAt: daysAgo(2),
    sourceApp: 'editor',
  },
  {
    id: 'file-ideas',
    name: '产品灵感.md',
    kind: 'file',
    parentId: 'folder-docs',
    mime: 'text/markdown',
    size: ideas.length,
    text: ideas,
    createdAt: daysAgo(12),
    updatedAt: daysAgo(2),
    sourceApp: 'notes',
  },
  {
    id: 'file-prompts',
    name: '提示词库.md',
    kind: 'file',
    parentId: 'folder-docs',
    mime: 'text/markdown',
    size: promptLibrary.length,
    text: promptLibrary,
    createdAt: daysAgo(22),
    updatedAt: daysAgo(5),
  },
  {
    id: 'file-notes',
    name: '评审纪要.md',
    kind: 'file',
    parentId: 'folder-docs',
    mime: 'text/markdown',
    size: meetingNotes.length,
    text: meetingNotes,
    createdAt: daysAgo(4),
    updatedAt: minutesAgo(180),
    sourceApp: 'meeting',
  },
  {
    id: 'file-license',
    name: '开源与许可.md',
    kind: 'file',
    parentId: 'folder-docs',
    mime: 'text/markdown',
    size: licenseNote.length,
    text: licenseNote,
    createdAt: daysAgo(30),
    updatedAt: daysAgo(30),
  },
  {
    id: 'file-hello',
    name: 'hello.stellar.html',
    kind: 'file',
    parentId: 'folder-code',
    mime: 'text/html',
    size: helloHtml.length,
    text: helloHtml,
    createdAt: daysAgo(6),
    updatedAt: daysAgo(1),
    sourceApp: 'editor',
    tags: ['代码'],
  },
  {
    id: 'file-sdk-demo',
    name: 'ecosystem-demo.ts',
    kind: 'file',
    parentId: 'folder-code',
    mime: 'text/typescript',
    size: ecosystemDemoTs.length,
    text: ecosystemDemoTs,
    createdAt: daysAgo(3),
    updatedAt: daysAgo(3),
    sourceApp: 'editor',
  },
  {
    id: 'file-exam',
    name: '数学随堂练习.svg',
    kind: 'file',
    parentId: 'folder-scans',
    mime: 'image/svg+xml',
    size: examSampleSvg().length,
    text: examSampleSvg(),
    thumb: makeArt(88, 'EXAM / 88', 600, 800),
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
    sourceApp: 'scanner',
    tags: ['试卷', '扫描'],
  },
  {
    id: 'file-aurora',
    name: 'aurora.svg',
    kind: 'file',
    parentId: 'folder-images',
    mime: 'image/svg+xml',
    size: 0,
    text: `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="640"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0b1b2e"/><stop offset=".5" stop-color="#132a4c"/><stop offset="1" stop-color="#2a1745"/></linearGradient><filter id="b"><feGaussianBlur stdDeviation="30"/></filter></defs><rect width="900" height="640" fill="url(#g)"/><path d="M-50 380 C200 120 430 520 640 180 S900 360 980 160" stroke="#69e6ff" stroke-width="90" fill="none" opacity=".28" filter="url(#b)"/><path d="M-50 420 C220 170 430 560 660 220 S900 400 980 200" stroke="#9b8cff" stroke-width="52" fill="none" opacity=".22" filter="url(#b)"/><circle cx="690" cy="170" r="5" fill="#eaf6ff"/><circle cx="760" cy="260" r="3" fill="#eaf6ff" opacity=".7"/></svg>`,
    thumb: artA,
    createdAt: daysAgo(9),
    updatedAt: daysAgo(9),
    starred: true,
  },
  {
    id: 'file-poster',
    name: 'studio-poster.svg',
    kind: 'file',
    parentId: 'folder-images',
    mime: 'image/svg+xml',
    size: 0,
    text: `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#1a0e28"/><stop offset="1" stop-color="#2a0f22"/></linearGradient></defs><rect width="900" height="1200" fill="url(#a)"/><circle cx="450" cy="450" r="260" fill="none" stroke="#ff7ac8" stroke-width="2" opacity=".6"/><circle cx="450" cy="450" r="180" fill="none" stroke="#69e6ff" stroke-width="2" opacity=".55"/><text x="450" y="1040" text-anchor="middle" fill="#f4eaf4" font-family="Manrope,sans-serif" font-size="64" font-weight="800" letter-spacing="18">STELLAR</text></svg>`,
    thumb: artD,
    createdAt: daysAgo(15),
    updatedAt: daysAgo(15),
  },
  {
    id: 'file-audio',
    name: '晨间氛围.mp3',
    kind: 'file',
    parentId: 'folder-media',
    mime: 'audio/mpeg',
    size: 2410000,
    externalUrl: 'https://mdn.github.io/shared-assets/audio/t-rex-roar.mp3',
    createdAt: daysAgo(11),
    updatedAt: daysAgo(11),
    tags: ['音频'],
  },
  {
    id: 'file-video',
    name: '花的延时.mp4',
    kind: 'file',
    parentId: 'folder-media',
    mime: 'video/mp4',
    size: 6840000,
    externalUrl: 'https://mdn.github.io/shared-assets/videos/flower.mp4',
    thumb: artB,
    createdAt: daysAgo(8),
    updatedAt: daysAgo(8),
    starred: true,
    tags: ['视频'],
  },
  {
    id: 'file-video-2',
    name: '山脊云海.mp4',
    kind: 'file',
    parentId: 'folder-media',
    mime: 'video/mp4',
    size: 12400000,
    externalUrl: 'https://mdn.github.io/shared-assets/videos/flower.webm',
    thumb: artC,
    createdAt: daysAgo(7),
    updatedAt: daysAgo(7),
    tags: ['视频'],
  },
]

export const CHATS: Chat[] = [
  {
    id: 'chat-lin',
    type: 'direct',
    name: '林小满',
    avatarHue: 188,
    members: ['contact-lin'],
    unread: 2,
    pinned: true,
    online: true,
    signature: '把复杂的事做简单',
    updatedAt: minutesAgo(6),
    messages: [
      { id: 'm-lin-1', senderId: 'contact-lin', kind: 'text', text: '新版本的扫描师我试了，试卷模式对红色批注的清理很干净 ✨', time: minutesAgo(48) },
      { id: 'm-lin-2', senderId: 'me', kind: 'text', text: '透视校正那块还有个小问题，拍歪一点就会切边。', time: minutesAgo(42), status: 'read' },
      { id: 'm-lin-3', senderId: 'contact-lin', kind: 'text', text: '我放了一份测试样张在云巢，你直接用扫描师打开看看。', time: minutesAgo(20) },
      { id: 'm-lin-4', senderId: 'contact-lin', kind: 'file', fileId: 'file-exam', text: '数学随堂练习.svg', time: minutesAgo(19) },
      { id: 'm-lin-5', senderId: 'contact-lin', kind: 'text', text: '另外，下午的拍摄花絮我发朋友圈了，记得看 👀', time: minutesAgo(6) },
    ],
  },
  {
    id: 'chat-group',
    type: 'group',
    name: '星环产品组',
    avatarHue: 214,
    members: ['contact-lin', 'contact-chen', 'contact-ache', 'contact-yu'],
    unread: 5,
    pinned: true,
    updatedAt: minutesAgo(24),
    messages: [
      { id: 'm-g-1', senderId: 'system', kind: 'system', text: '你加入了群聊「星环产品组」', time: daysAgo(6) },
      { id: 'm-g-2', senderId: 'contact-ache', kind: 'text', text: '明晚 8 点做 v0.1 评审，会客厅房间号 STL-2048，议题在文档里。', time: minutesAgo(54) },
      { id: 'm-g-3', senderId: 'contact-chen', kind: 'text', text: '信令服务补了自动重连，多人 mesh 上限先按 6 人做。', time: minutesAgo(46) },
      { id: 'm-g-4', senderId: 'contact-lin', kind: 'text', text: '收到。我把评审纪要同步到云巢「文档」了。', time: minutesAgo(30) },
      { id: 'm-g-5', senderId: 'contact-lin', kind: 'file', fileId: 'file-notes', text: '评审纪要.md', time: minutesAgo(29) },
      { id: 'm-g-6', senderId: 'contact-ache', kind: 'text', text: '@你 记得带上扫描仪的试卷模式 demo。', time: minutesAgo(24) },
    ],
  },
  {
    id: 'chat-chen',
    type: 'direct',
    name: '陈子航',
    avatarHue: 258,
    members: ['contact-chen'],
    unread: 0,
    online: true,
    signature: '正在重构边缘节点',
    updatedAt: minutesAgo(65),
    messages: [
      { id: 'm-c-1', senderId: 'contact-chen', kind: 'text', text: '这段 WebRTC mesh 的代码你帮我看一眼？', time: minutesAgo(80) },
      { id: 'm-c-2', senderId: 'contact-chen', kind: 'file', fileId: 'file-sdk-demo', text: 'ecosystem-demo.ts', time: minutesAgo(79) },
      { id: 'm-c-3', senderId: 'me', kind: 'text', text: '晚点用代码工坊打开。顺便把会议室的屏幕共享也接上。', time: minutesAgo(70), status: 'read' },
      { id: 'm-c-4', senderId: 'contact-chen', kind: 'text', text: 'OK，屏幕共享我复用远界的 sender，替换 track 就行。', time: minutesAgo(65) },
    ],
  },
  {
    id: 'chat-zhou',
    type: 'direct',
    name: '周未',
    avatarHue: 28,
    members: ['contact-zhou'],
    unread: 1,
    online: false,
    signature: '光是最好的滤镜',
    updatedAt: minutesAgo(110),
    messages: [
      { id: 'm-z-1', senderId: 'contact-zhou', kind: 'text', text: '昨天的极光，原片放云巢了。', time: minutesAgo(118) },
      { id: 'm-z-2', senderId: 'contact-zhou', kind: 'image', image: artA, time: minutesAgo(116) },
      { id: 'm-z-3', senderId: 'me', kind: 'text', text: '太顶了，直接拿来做桌面壁纸。', time: minutesAgo(112), status: 'read' },
      { id: 'm-z-4', senderId: 'contact-zhou', kind: 'text', text: '下次一起去拍，凌晨四点出发那种。', time: minutesAgo(110) },
    ],
  },
  {
    id: 'chat-ache',
    type: 'direct',
    name: '阿澈',
    avatarHue: 332,
    members: ['contact-ache'],
    unread: 0,
    online: true,
    signature: '产品经理 / 露营爱好者',
    updatedAt: daysAgo(1),
    messages: [
      { id: 'm-a-1', senderId: 'contact-ache', kind: 'text', text: '周末露营装备清单已同步到云巢，谁还缺睡袋？', time: daysAgo(1) },
      { id: 'm-a-2', senderId: 'contact-ache', kind: 'image', image: artC, time: daysAgo(1) },
      { id: 'm-a-3', senderId: 'me', kind: 'text', text: '我带炉具和咖啡，帐篷谁带？', time: daysAgo(1), status: 'read' },
      { id: 'm-a-4', senderId: 'contact-ache', kind: 'call', callKind: 'voice', duration: 326, text: '语音通话', time: daysAgo(1) },
    ],
  },
  {
    id: 'chat-ai',
    type: 'direct',
    name: '星环助手',
    avatarHue: 272,
    members: [],
    unread: 0,
    isAI: true,
    signature: '把整个生态变成一句话',
    updatedAt: minutesAgo(300),
    messages: [
      { id: 'm-ai-1', senderId: 'assistant', kind: 'text', text: '我是小环。你可以直接说「把云巢里的评审纪要发给林小满」，或者「打开扫描仪，拍一份试卷」。', time: minutesAgo(300) },
    ],
  },
]

export const MOMENTS: Moment[] = [
  {
    id: 'moment-1',
    authorId: 'contact-lin',
    text: '把桌面搬进了浏览器。新的星环生态今天开始内测，12 个应用终于在同一轨道上了。',
    images: [artA, artD],
    time: minutesAgo(90),
    location: '杭州 · 天目里',
    likes: ['me', 'contact-chen', 'contact-ache', 'contact-zhou'],
    comments: [
      { id: 'cm-1', authorId: 'contact-chen', text: '扫描仪的试卷模式太强了，红笔一键消失。', time: minutesAgo(76) },
      { id: 'cm-2', authorId: 'contact-ache', text: '朋友圈也能直接跳到会议，生态感拉满。', time: minutesAgo(60) },
    ],
  },
  {
    id: 'moment-2',
    authorId: 'contact-zhou',
    text: '凌晨四点的山脊，云海比闹钟准时。原片在云巢，欢迎自取。',
    images: [artB],
    time: minutesAgo(240),
    location: '大理 · 苍山',
    likes: ['me', 'contact-lin'],
    comments: [{ id: 'cm-3', authorId: 'contact-lin', text: '第三张的层次绝了。', time: minutesAgo(200) }],
  },
  {
    id: 'moment-3',
    authorId: 'contact-ache',
    text: '周末露营装备清单已同步到云巢，谁还缺睡袋？',
    images: [artC],
    time: daysAgo(1),
    location: '安吉 · 竹海',
    likes: ['me', 'contact-zhou', 'contact-yu'],
    comments: [],
  },
]

export const PROVIDERS: AIProvider[] = [
  { id: 'demo', kind: 'demo', label: '星环演示模型', baseUrl: '', apiKey: '', model: 'stellar-demo', models: ['stellar-demo'], color: '#9b8cff' },
  { id: 'deepseek', kind: 'openai', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', apiKey: '', model: 'deepseek-chat', models: ['deepseek-chat', 'deepseek-reasoner'], color: '#4d6bfe' },
  { id: 'openai', kind: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini', models: ['gpt-4o-mini', 'gpt-4o', 'o3-mini'], color: '#10a37f' },
  { id: 'anthropic', kind: 'anthropic', label: 'Anthropic Claude', baseUrl: 'https://api.anthropic.com', apiKey: '', model: 'claude-sonnet-4-5', models: ['claude-sonnet-4-5', 'claude-opus-4-1', 'claude-haiku-4-5'], color: '#d97757' },
  { id: 'gemini', kind: 'gemini', label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com', apiKey: '', model: 'gemini-2.5-flash', models: ['gemini-2.5-flash', 'gemini-2.5-pro'], color: '#4285f4' },
  { id: 'ollama', kind: 'ollama', label: 'Ollama 本地', baseUrl: 'http://localhost:11434', apiKey: '', model: 'qwen2.5:7b', models: ['qwen2.5:7b', 'llama3.2', 'deepseek-r1:8b'], color: '#22c55e' },
]

export const AI_CONVERSATIONS: AIConversation[] = [
  {
    id: 'conv-welcome',
    title: '欢迎来到智核',
    system: '你是星环 Stellar 的 AI 助手，回答简洁、具体，优先给出可执行步骤。',
    createdAt: minutesAgo(600),
    updatedAt: minutesAgo(590),
    messages: [],
  },
]

export const NOTEBOOKS: Notebook[] = [
  {
    id: 'notebook-1',
    title: '灵感速记',
    coverHue: 28,
    pages: [
      {
        id: 'page-1',
        template: 'dot',
        texts: [
          { id: 't1', x: 0.13, y: 0.17, text: '星环 · 灵感板', color: '#1f2937', size: 44 },
          { id: 't2', x: 0.14, y: 0.34, text: '扫描  →  云巢  →  分享', color: '#1d4ed8', size: 30 },
          { id: 't3', x: 0.55, y: 0.44, text: '让每个应用都能', color: '#374151', size: 24 },
          { id: 't4', x: 0.55, y: 0.50, text: '接住另一个应用的内容', color: '#374151', size: 24 },
          { id: 't5', x: 0.16, y: 0.64, text: '试卷去手写', color: '#b91c1c', size: 28 },
          { id: 't6', x: 0.16, y: 0.70, text: '红蓝笔迹 → 干净卷面', color: '#6b7280', size: 20 },
          { id: 't7', x: 0.58, y: 0.82, text: '下一步：OCR → AI 整理', color: '#059669', size: 24 },
        ],
        strokes: [
          { id: 's1', tool: 'pen', color: '#1f2937', width: 2.1, points: [{x:.12,y:.205,p:.7},{x:.48,y:.205,p:.8},{x:.48,y:.23,p:.6}] },
          { id: 's2', tool: 'pen', color: '#1d4ed8', width: 2.6, points: [{x:.145,y:.375,p:.75},{x:.43,y:.378,p:.85},{x:.43,y:.40,p:.45}] },
          { id: 's3', tool: 'pen', color: '#b91c1c', width: 2.2, points: [{x:.16,y:.665,p:.7},{x:.30,y:.667,p:.8},{x:.30,y:.69,p:.5}] },
          { id: 's4', tool: 'marker', color: '#facc15', width: 10, points: [{x:.55,y:.515,p:.6},{x:.80,y:.515,p:.7}] },
          { id: 's5', tool: 'pen', color: '#059669', width: 2.4, points: [{x:.57,y:.84,p:.7},{x:.84,y:.842,p:.9},{x:.82,y:.86,p:.5},{x:.79,y:.84,p:.6}] },
        ],
      },
      { id: 'page-1b', strokes: [], template: 'lined' },
    ],
    createdAt: daysAgo(14),
    updatedAt: daysAgo(1),
  },
  {
    id: 'notebook-2',
    title: '产品草图',
    coverHue: 204,
    pages: [{
      id: 'page-2',
      template: 'grid',
      texts: [
        { id: 't8', x: 0.16, y: 0.18, text: 'v0.1 结构', color: '#0f172a', size: 38 },
        { id: 't9', x: 0.2, y: 0.38, text: '统一 Shell', color: '#1d4ed8', size: 26 },
        { id: 't10', x: 0.2, y: 0.55, text: '应用总线', color: '#7c3aed', size: 26 },
        { id: 't11', x: 0.2, y: 0.72, text: '本地存储', color: '#059669', size: 26 },
        { id: 't12', x: 0.58, y: 0.46, text: '12 个应用', color: '#374151', size: 28 },
        { id: 't13', x: 0.58, y: 0.53, text: '互相调用 · 一个生态', color: '#6b7280', size: 20 },
      ],
      strokes: [
        { id: 's6', tool: 'pen', color: '#1d4ed8', width: 2.4, points: [{x:.19,y:.40,p:.7},{x:.47,y:.40,p:.8},{x:.47,y:.42,p:.6}] },
        { id: 's7', tool: 'pen', color: '#7c3aed', width: 2.4, points: [{x:.19,y:.57,p:.7},{x:.47,y:.57,p:.8},{x:.47,y:.59,p:.6}] },
        { id: 's8', tool: 'pen', color: '#059669', width: 2.4, points: [{x:.19,y:.74,p:.7},{x:.47,y:.74,p:.8},{x:.47,y:.76,p:.6}] },
        { id: 's9', tool: 'pen', color: '#94a3b8', width: 2, points: [{x:.48,y:.41,p:.6},{x:.56,y:.47,p:.7},{x:.48,y:.58,p:.6},{x:.56,y:.62,p:.7}] },
        { id: 's10', tool: 'marker', color: '#6ee7b7', width: 12, points: [{x:.57,y:.55,p:.6},{x:.83,y:.55,p:.7}] },
      ],
    }],
    createdAt: daysAgo(5),
    updatedAt: daysAgo(2),
  },
]

export const BOOKMARKS: Bookmark[] = [
  { id: 'bm-start', title: '星环起始页', url: 'stellar://start', hue: 190 },
  { id: 'bm-mdn', title: 'MDN Web Docs', url: 'https://developer.mozilla.org/zh-CN/', hue: 210 },
  { id: 'bm-wiki', title: '维基百科', url: 'https://zh.wikipedia.org/', hue: 150 },
  { id: 'bm-osm', title: 'OpenStreetMap', url: 'https://www.openstreetmap.org/', hue: 120 },
  { id: 'bm-github', title: 'GitHub', url: 'https://github.com/', hue: 260 },
]

export const INITIAL_TABS: BrowserTab[] = [
  { id: 'tab-1', url: 'stellar://start', title: '起始页', history: ['stellar://start'], index: 0 },
]

export const NOTIFICATIONS: NotificationItem[] = [
  { id: 'n-1', appId: 'meeting', title: '评审会即将开始', body: '「星环 v0.1」将在 20:00 开始，房间 STL-2048。', time: minutesAgo(12), read: false, action: { appId: 'meeting', params: { room: 'STL-2048' } } },
  { id: 'n-2', appId: 'scanner', title: '试卷去手写完成', body: '「数学随堂练习」已处理 3 页，红色批注已清除。', time: minutesAgo(52), read: false, action: { appId: 'scanner', params: { mode: 'exam' } } },
  { id: 'n-3', appId: 'drive', title: '云巢已同步', body: '12 个文件已保存到本地存储，数据留在你的设备。', time: minutesAgo(180), read: true, action: { appId: 'drive' } },
]

export const PROFILE: Profile = {
  name: '纪辰',
  handle: 'jichen',
  hue: 204,
  bio: '在星环里构建自己的数字生活。',
}

export const PREFERENCES: Preferences = {
  accent: 'aurora',
  wallpaper: 'orbit',
  deviceName: 'Jichen · Stellar Book',
  reduceMotion: false,
  language: 'zh-CN',
}

export const SCAN_DOCS: ScanDoc[] = []
export const MEETINGS: MeetingRecord[] = []

export function seedAll() {
  return {
    files: DRIVE_FILES,
    chats: CHATS,
    contacts: CONTACTS,
    moments: MOMENTS,
    notifications: NOTIFICATIONS,
    providers: PROVIDERS,
    conversations: AI_CONVERSATIONS,
    notebooks: NOTEBOOKS,
    bookmarks: BOOKMARKS,
    tabs: INITIAL_TABS,
    profile: PROFILE,
    preferences: PREFERENCES,
    scanDocs: SCAN_DOCS,
    meetings: MEETINGS,
    seededAt: nowIso(),
    demoVersion: uid('seed'),
  }
}
