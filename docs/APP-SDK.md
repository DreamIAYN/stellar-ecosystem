# 生态 SDK

`ecosystem` 单例位于 `apps/web/src/core/ecosystem.ts`，是应用之间唯一推荐的调用入口。它不依赖任何 UI 组件，可在任意应用内使用。

## 打开应用与文件

```ts
import { ecosystem } from '../../core/ecosystem'

// 打开应用并传入参数（同应用单实例，参数合并）
ecosystem.open('scanner', { mode: 'exam' })
ecosystem.open('im', { chatId: 'chat-lin' })
ecosystem.open('meeting', { room: 'STL-2048' })
ecosystem.open('editor', { fileId: 'file-readme' })

// 根据 mime 自动选择打开方式
ecosystem.openFile('file-video')   // → 声影
ecosystem.openFile('file-readme')  // → 代码工坊
ecosystem.openFile('file-exam')    // → 云巢预览
```

## 文件

```ts
// 保存二进制文件
const file = await ecosystem.saveFile({
  name: '合同.pdf',
  mime: 'application/pdf',
  blob,
  folderName: '扫描件',      // 自动匹配已有文件夹
  sourceApp: 'scanner',
  tags: ['扫描'],
})

// 保存文本
const note = await ecosystem.saveText({
  name: '会议纪要.md',
  text: '# 评审\n\n...',
  mime: 'text/markdown',
  folderName: '文档',
  sourceApp: 'meeting',
})

// 读取
const text = await ecosystem.getFileText(file)
const blob = await ecosystem.getFileBlob(file)
const url = await ecosystem.getFileUrl(file)
```

## 分享

```ts
ecosystem.share({
  title: '数学随堂练习-扫描件.jpg',
  image: dataUrl,
  text: '来自扫描师',
  sourceApp: 'scanner',
})
```

分享面板会把内容发送到会话、保存到云巢、交给 AI、在编辑器中打开、复制或收藏网址。

## AI

```ts
ecosystem.askAI({
  prompt: '总结这份评审纪要',
  context: noteText,        // 任意文本上下文，最多按应用自行截断
  system: '你是严谨的会议助理。',
  origin: 'meeting',
  autoSend: true,           // true: 打开智核并立即发送
})
```

- `autoSend: false` 会把问题预填到输入框，并附带上下文 chip。
- 上下文超过 12k 字符时请自行截断；真实模型 token 预算由用户负责。

## 聊天与会议

```ts
ecosystem.sendFileToChat(file.id, 'chat-lin')
ecosystem.sendTextToChat('chat-lin', '合同已经发你了。')
ecosystem.startCall('chat-lin', 'video')   // 打开本地媒体通话界面
ecosystem.startMeeting('STL-2048')
ecosystem.scan('exam')
```

## 通知 / Toast

```ts
ecosystem.notify('云巢', '备份完成', { appId: 'drive' })
ecosystem.toast('已保存', '文件在云巢「扫描件」', 'success')
```

## 约定

- **不要直接操作 IndexedDB**：使用 `ecosystem.saveFile` 以保证元数据与 Blob 一致。
- **不要在校验中依赖窗口尺寸**：Shell 会处理桌面/移动布局。
- **文件引用只传 ID**：聊天消息、编辑器、AI 上下文都应引用 `fileId`，需要内容时再读取。
- **错误要可定位**：文件操作失败时给出文件名与失败原因。
- **尊重许可**：新增依赖时更新 `THIRD_PARTY_NOTICES.md`。
