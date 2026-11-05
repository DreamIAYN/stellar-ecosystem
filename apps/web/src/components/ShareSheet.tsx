import { BookmarkPlus, Bot, Check, Cloud, Code2, Copy, Download, ExternalLink, FileText, Link2, Send, X } from 'lucide-react'
import { useState } from 'react'
import { ecosystem } from '../core/ecosystem'
import { useSystem } from '../core/store'
import type { Chat, DriveFile } from '../core/types'
import { blobToDataUrl, copyText, dataUrlToBlob, formatBytes, isImageMime, relativeTime } from '../core/utils'
import { Avatar } from './Avatar'

export function ShareSheet() {
  const payload = useSystem((s) => s.sharePayload)
  const files = useSystem((s) => s.files)
  const chats = useSystem((s) => s.chats)
  const addFile = useSystem((s) => s.addFile)
  const addBookmark = useSystem((s) => s.addBookmark)
  const closeOverlay = useSystem((s) => s.closeOverlay)
  const openApp = useSystem((s) => s.openApp)
  const toast = useSystem((s) => s.toast)
  const [busy, setBusy] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  if (!payload) return null

  const file = payload.fileId ? files.find((f) => f.id === payload.fileId) : undefined
  const visibleChats = [...chats].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt.localeCompare(a.updatedAt))

  const buildText = () => {
    if (payload.text) return payload.text
    if (payload.url) return payload.url
    return ''
  }

  const sendTo = async (chat: Chat) => {
    setBusy(chat.id)
    try {
      if (payload.fileId) {
        ecosystem.sendFileToChat(payload.fileId, chat.id)
      } else if (payload.image) {
        const blob = await dataUrlToBlob(payload.image)
        const saved = await ecosystem.saveFile({ name: payload.title || '图片.png', mime: blob.type || 'image/png', blob, folderName: '图片', sourceApp: payload.sourceApp, thumb: payload.image })
        useSystem.getState().sendMessage(chat.id, { senderId: 'me', kind: 'image', image: payload.image, fileId: saved.id, text: saved.name, status: 'sent' })
        openApp('im', { chatId: chat.id })
      } else if (payload.blobId) {
        const saved = await ecosystem.saveFile({ name: payload.title, mime: 'application/octet-stream', blob: await (await import('../core/db')).getBlob(payload.blobId) ?? undefined, folderName: '文档', sourceApp: payload.sourceApp })
        ecosystem.sendFileToChat(saved.id, chat.id)
      } else {
        const text = buildText() || payload.title
        const message = payload.url
          ? { senderId: 'me', kind: 'link' as const, text: payload.title, linkParams: { url: payload.url }, status: 'sent' as const }
          : { senderId: 'me', kind: 'text' as const, text, status: 'sent' as const }
        useSystem.getState().sendMessage(chat.id, message)
        openApp('im', { chatId: chat.id })
      }
      toast('已发送', `内容已交给 ${chat.name}`, 'success')
      setSent(chat.id)
    } catch (e) {
      toast('发送失败', e instanceof Error ? e.message : '未知错误', 'error')
    } finally {
      setBusy(null)
    }
  }

  const saveToDrive = async () => {
    setBusy('drive')
    try {
      if (file) {
        toast('已在云巢中', `${file.name} 已经保存。`, 'success')
        return
      }
      let saved: DriveFile
      if (payload.blobId) {
        const { getBlob } = await import('../core/db')
        const blob = await getBlob(payload.blobId)
        if (!blob) throw new Error('临时文件已失效')
        saved = await ecosystem.saveFile({ name: payload.title, mime: blob.type || 'application/octet-stream', blob, folderName: '文档', sourceApp: payload.sourceApp })
      } else if (payload.url) {
        saved = await ecosystem.saveText({ name: `${payload.title || '网页收藏'}.md`, text: `# ${payload.title}\n\n${payload.url}\n\n${payload.text ?? ''}`, folderName: '文档', sourceApp: payload.sourceApp, tags: ['网页'] })
      } else if (payload.image) {
        const blob = await dataUrlToBlob(payload.image)
        saved = await ecosystem.saveFile({ name: `${payload.title || '图片'}.png`, mime: 'image/png', blob, folderName: '图片', sourceApp: payload.sourceApp })
      } else {
        saved = await ecosystem.saveText({ name: `${payload.title || '分享内容'}.md`, text: buildText() || payload.title, folderName: '文档', sourceApp: payload.sourceApp })
      }
      toast('已保存到云巢', saved.name, 'success')
      openApp('drive', { previewId: saved.id })
    } catch (e) {
      toast('保存失败', e instanceof Error ? e.message : '未知错误', 'error')
    } finally {
      setBusy(null)
    }
  }

  const askAI = async () => {
    setBusy('ai')
    let context = payload.text ?? ''
    if (file) context = (await ecosystem.getFileText(file).catch(() => '')) || context
    if (payload.url) context = `${context}\n\n网页地址：${payload.url}`
    ecosystem.askAI({
      prompt: `请分析并总结这个内容：${payload.title}`,
      context: context.slice(0, 12000),
      origin: payload.sourceApp,
      autoSend: true,
    })
    closeOverlay()
    setBusy(null)
  }

  const openEditor = async () => {
    if (file) {
      closeOverlay()
      openApp('editor', { fileId: file.id })
      return
    }
    setBusy('editor')
    const saved = await ecosystem.saveText({ name: `${payload.title || '分享文本'}.md`, text: buildText() || payload.title, mime: 'text/markdown', folderName: '文档', sourceApp: payload.sourceApp })
    closeOverlay()
    openApp('editor', { fileId: saved.id })
    setBusy(null)
  }

  const copy = async () => {
    const text = payload.url ?? buildText() ?? payload.title
    const ok = await copyText(text)
    toast(ok ? '已复制' : '复制失败', ok ? '内容已写入剪贴板。' : '浏览器拒绝了剪贴板访问。', ok ? 'success' : 'error')
  }

  return (
    <div className="overlay-backdrop sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && closeOverlay()}>
      <div className="share-sheet" role="dialog" aria-modal aria-label="分享">
        <header className="sheet-head">
          <div><span className="sheet-eyebrow">ECOSYSTEM SHARE</span><h2>分享到星环</h2></div>
          <button className="icon-btn" onClick={closeOverlay}><X size={18} /></button>
        </header>

        <div className="share-preview">
          <div className={`share-thumb ${file && isImageMime(file.mime) ? 'has-image' : ''}`}>
            {file?.thumb ? <img src={file.thumb} alt="" /> : payload.image ? <img src={payload.image} alt="" /> : payload.url ? <Link2 size={22} /> : file ? <FileText size={22} /> : <Cloud size={22} />}
          </div>
          <div className="grow">
            <strong>{payload.title}</strong>
            <p>{payload.url ? payload.url : file ? `${file.mime} · ${formatBytes(file.size)} · ${relativeTime(file.updatedAt)}` : payload.text?.slice(0, 120) || '来自星环生态的内容'}</p>
            {payload.sourceApp && <span className="chip">{sourceName(payload.sourceApp)}</span>}
          </div>
        </div>

        <div className="share-actions">
          <button className="share-action" onClick={saveToDrive} disabled={busy === 'drive'}>
            <span className="share-action-icon"><Cloud size={17} /></span><strong>{file ? '已在云巢' : '保存到云巢'}</strong><small>文件进入本地优先存储</small>
          </button>
          <button className="share-action" onClick={askAI} disabled={busy === 'ai'}>
            <span className="share-action-icon"><Bot size={17} /></span><strong>用 AI 分析</strong><small>带上下文打开智核</small>
          </button>
          <button className="share-action" onClick={openEditor}>
            <span className="share-action-icon"><Code2 size={17} /></span><strong>在代码工坊打开</strong><small>编辑文本与 Markdown</small>
          </button>
          <button className="share-action" onClick={copy}>
            <span className="share-action-icon"><Copy size={17} /></span><strong>复制内容</strong><small>链接或文本</small>
          </button>
          {payload.url && (
            <>
              <button className="share-action" onClick={() => { addBookmark({ title: payload.title, url: payload.url!, hue: 190 }); toast('已加入书签', payload.url!, 'success') }}>
                <span className="share-action-icon"><BookmarkPlus size={17} /></span><strong>收藏网址</strong><small>保存到内置浏览器</small>
              </button>
              <button className="share-action" onClick={() => { closeOverlay(); openApp('browser', { url: payload.url }) }}>
                <span className="share-action-icon"><ExternalLink size={17} /></span><strong>在内置浏览器打开</strong><small>新标签页</small>
              </button>
            </>
          )}
        </div>

        <div className="share-contact-head">
          <span className="section-title">发送到会话</span>
          <span className="hint">{visibleChats.length} 个会话</span>
        </div>
        <div className="share-contacts">
          {visibleChats.map((chat) => (
            <button key={chat.id} className={`share-contact ${sent === chat.id ? 'sent' : ''}`} onClick={() => sendTo(chat)} disabled={busy === chat.id}>
              <Avatar name={chat.name} hue={chat.avatarHue} size={37} online={chat.type === 'direct' ? chat.online : undefined} />
              <span className="grow"><strong>{chat.name}</strong><small>{chat.type === 'group' ? `${chat.members.length + 1} 人 · 群聊` : chat.signature}</small></span>
              {sent === chat.id ? <Check size={15} className="sent-check" /> : busy === chat.id ? <span className="spinner" /> : <Send size={14} className="faint" />}
            </button>
          ))}
        </div>
        <footer className="share-foot">
          <span><Download size={12} /> 内容只在你的设备与目标应用之间流动</span>
          <button className="text-btn" onClick={closeOverlay}>完成</button>
        </footer>
      </div>
    </div>
  )
}

function sourceName(id: string) {
  const names: Record<string, string> = { scanner: '扫描师', drive: '云巢', browser: '漫游', notes: '墨记', media: '声影', editor: '代码工坊', im: '星讯', meeting: '会客厅' }
  return names[id] ?? '星环'
}
