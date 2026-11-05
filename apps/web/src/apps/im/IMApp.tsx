import {
  Aperture,
  ArrowLeft,
  Check,
  CheckCheck,
  Heart,
  ImagePlus,
  Laugh,
  MessageCircle,
  MessageSquare,
  Mic,
  MoreHorizontal,
  Paperclip,
  Phone,
  Pin,
  Search,
  Send,
  Sparkles,
  Square,
  Users,
  Video,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppProps } from '../../components/AppRenderer'
import { Avatar } from '../../components/Avatar'
import { useBlobUrl } from '../../core/hooks'
import { ecosystem } from '../../core/ecosystem'
import { useSystem } from '../../core/store'
import type { Chat, ChatMessage, Contact } from '../../core/types'
import { cn, formatBytes, formatDuration, makeThumbnail, relativeTime, shortTime } from '../../core/utils'
import { CallOverlay } from './CallOverlay'
import { MomentsView } from './MomentsView'

const EMOJIS = ['😀', '😄', '😊', '😉', '😍', '🥰', '😎', '🤔', '😅', '😂', '🥹', '😭', '😤', '🤯', '🥳', '😴', '👍', '👏', '🙌', '🤝', '💪', '✨', '🔥', '💜', '🌙', '☕', '🎉', '🚀', '📎', '✅', '👀', '🫶']

function dateDivider(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return '今天'
  const y = new Date(now)
  y.setDate(now.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return '昨天'
  return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })
}

function messagePreview(m: ChatMessage, files: { id: string; name: string }[]) {
  if (m.kind === 'text') return m.text ?? ''
  if (m.kind === 'image') return '[图片]'
  if (m.kind === 'file') return `[文件] ${m.text ?? files.find((f) => f.id === m.fileId)?.name ?? ''}`
  if (m.kind === 'voice') return `[语音] ${formatDuration(m.duration ?? 0)}`
  if (m.kind === 'call') return `[通话] ${formatDuration(m.duration ?? 0)}`
  if (m.kind === 'link') return `[链接] ${m.text ?? ''}`
  return m.text ?? ''
}

export default function IMApp({ params, winId }: AppProps) {
  const chats = useSystem((s) => s.chats)
  const files = useSystem((s) => s.files)
  const profile = useSystem((s) => s.profile)
  const contacts = useSystem((s) => s.contacts)
  const sendMessage = useSystem((s) => s.sendMessage)
  const markChatRead = useSystem((s) => s.markChatRead)
  const openApp = useSystem((s) => s.openApp)
  const setWindowParams = useSystem((s) => s.setWindowParams)
  const togglePin = useSystem((s) => s.togglePinChat)
  const toast = useSystem((s) => s.toast)
  const [panel, setPanel] = useState<'chats' | 'moments' | 'contacts'>('chats')
  const [query, setQuery] = useState('')
  const [listFilter, setListFilter] = useState<'all' | 'unread' | 'group'>('all')
  const [activeId, setActiveId] = useState<string>((params.chatId as string) || chats.find((c) => c.pinned)?.id || chats[0]?.id || '')
  const [call, setCall] = useState<{ kind: 'voice' | 'video'; chatId: string } | null>(null)
  const [newChat, setNewChat] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [sendBusy, setSendBusy] = useState(false)
  const [mobileList, setMobileList] = useState(!(params.chatId as string))
  const scrollRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recordChunks = useRef<Blob[]>([])
  const recordStream = useRef<MediaStream | null>(null)
  const recordTimer = useRef<number | null>(null)
  const recordStart = useRef(0)
  const imgInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const lastCallKey = useRef('')
  const cancelRecord = useRef(false)

  const sortedChats = useMemo(
    () => [...chats].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt.localeCompare(a.updatedAt)),
    [chats],
  )
  const filtered = sortedChats.filter((c) => {
    if (listFilter === 'unread' && c.unread === 0) return false
    if (listFilter === 'group' && c.type !== 'group') return false
    return !query.trim() || c.name.toLowerCase().includes(query.toLowerCase()) || c.messages.some((m) => m.text?.toLowerCase().includes(query.toLowerCase()))
  })
  const active = chats.find((c) => c.id === activeId) ?? filtered[0] ?? chats[0]
  const activeMessages = active?.messages ?? []
  const totalUnread = chats.reduce((n, c) => n + c.unread, 0)

  useEffect(() => {
    if (params.chatId && params.chatId !== activeId) {
      setActiveId(String(params.chatId))
      setPanel('chats')
      setMobileList(false)
    }
    const callParam = params.call as { kind?: 'voice' | 'video'; chatId?: string } | undefined
    if (callParam?.kind && callParam.chatId) {
      const key = `${callParam.kind}:${callParam.chatId}`
      if (lastCallKey.current !== key) {
        lastCallKey.current = key
        setActiveId(callParam.chatId)
        setCall({ kind: callParam.kind, chatId: callParam.chatId })
        setWindowParams(winId, { call: undefined })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.chatId, params.call])

  useEffect(() => {
    if (active) markChatRead(active.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id])

  useEffect(() => {
    setDraft(active?.draft ?? '')
  }, [active?.id])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [active?.id, activeMessages.length])

  useEffect(() => {
    return () => {
      recordStream.current?.getTracks().forEach((t) => t.stop())
      if (recordTimer.current) window.clearInterval(recordTimer.current)
    }
  }, [])

  const selectChat = (chat: Chat) => {
    if (chat.isAI) {
      openApp('ai')
      return
    }
    setActiveId(chat.id)
    setMobileList(false)
    setMoreOpen(false)
  }

  const doSend = () => {
    if (!active || !draft.trim()) return
    sendMessage(active.id, { senderId: 'me', kind: 'text', text: draft.trim(), status: 'sent' })
    setDraft('')
    useSystem.getState().setChatDraft(active.id, '')
    textRef.current?.focus()
  }

  const attach = async (fileList: FileList | null, onlyImages: boolean) => {
    if (!active || !fileList?.length) return
    setSendBusy(true)
    try {
      for (const file of Array.from(fileList).slice(0, 8)) {
        if (onlyImages && !file.type.startsWith('image/')) continue
        const thumb = file.type.startsWith('image/') ? await makeThumbnail(file, 900).catch(() => undefined) : undefined
        const saved = await ecosystem.saveFile({
          name: file.name,
          mime: file.type || 'application/octet-stream',
          blob: file,
          folderName: file.type.startsWith('image/') ? '图片' : '文档',
          sourceApp: 'im',
          thumb,
        })
        if (file.type.startsWith('image/')) {
          sendMessage(active.id, { senderId: 'me', kind: 'image', image: thumb, fileId: saved.id, text: file.name, status: 'sent' })
        } else {
          sendMessage(active.id, { senderId: 'me', kind: 'file', fileId: saved.id, text: saved.name, status: 'sent' })
        }
      }
    } catch (e) {
      toast('发送失败', e instanceof Error ? e.message : '无法处理文件', 'error')
    } finally {
      setSendBusy(false)
      if (imgInput.current) imgInput.current.value = ''
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      recordStream.current = stream
      recordChunks.current = []
      const rec = new MediaRecorder(stream)
      recorderRef.current = rec
      rec.ondataavailable = (e) => e.data.size && recordChunks.current.push(e.data)
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const duration = Math.max(1, Math.round((Date.now() - recordStart.current) / 1000))
        if (cancelRecord.current) {
          cancelRecord.current = false
          recordChunks.current = []
          return
        }
        if (recordChunks.current.length === 0) return
        const blob = new Blob(recordChunks.current, { type: rec.mimeType || 'audio/webm' })
        try {
          const saved = await ecosystem.saveFile({ name: `语音-${new Date().toISOString().slice(11, 19)}.webm`, mime: blob.type, blob, folderName: '音视频', sourceApp: 'im' })
          if (active) sendMessage(active.id, { senderId: 'me', kind: 'voice', blobId: saved.blobId, fileId: saved.id, duration, text: '语音消息', status: 'sent' })
        } catch {
          toast('语音保存失败', '录音仍保留在本地内存中。', 'error')
        }
      }
      cancelRecord.current = false
      recordStart.current = Date.now()
      rec.start()
      setRecording(true)
      setRecordSeconds(0)
      recordTimer.current = window.setInterval(() => setRecordSeconds(Math.floor((Date.now() - recordStart.current) / 1000)), 500)
    } catch {
      toast('无法录音', '请允许浏览器访问麦克风。', 'error')
    }
  }

  const stopRecording = (cancel = false) => {
    if (recordTimer.current) window.clearInterval(recordTimer.current)
    recordTimer.current = null
    if (cancel) {
      cancelRecord.current = true
      recordChunks.current = []
    }
    try {
      recorderRef.current?.stop()
    } catch {}
    recorderRef.current = null
    setRecording(false)
  }

  if (panel === 'moments') {
    return <div className="im"><Rail panel={panel} setPanel={setPanel} unread={totalUnread} profile={profile} openApp={openApp} /><MomentsView /></div>
  }
  if (panel === 'contacts') {
    return (
      <div className="im">
        <Rail panel={panel} setPanel={setPanel} unread={totalUnread} profile={profile} openApp={openApp} />
        <ContactsView contacts={contacts} chats={chats} profile={profile} onNewChat={() => setNewChat(true)} />
        {newChat && <NewChatModal contacts={contacts} onClose={() => setNewChat(false)} onPick={(contact) => { setNewChat(false); useSystem.getState().createDirectChat(contact.id); setPanel('chats'); setMobileList(false) }} />}
      </div>
    )
  }

  return (
    <div className={cn('im', mobileList && 'mobile-list')}>
      <Rail panel={panel} setPanel={setPanel} unread={totalUnread} profile={profile} openApp={openApp} />
      <aside className="im-list">
        <header className="im-list-head">
          <div><h2>星讯</h2><span className="im-sub">{totalUnread ? `${totalUnread} 条未读` : '全部已读'}</span></div>
          <button className="icon-btn" onClick={() => setNewChat(true)} title="发起新会话"><MessageSquare size={17} /></button>
        </header>
        <div className="im-search field">
          <Search size={14} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索消息与联系人" />
          {query && <button className="icon-btn sm" onClick={() => setQuery('')}><X size={12} /></button>}
        </div>
        <div className="im-filter-row">
          <button className={cn('chip', listFilter === 'all' && 'accent')} onClick={() => setListFilter('all')}>全部</button>
          <button className={cn('chip', listFilter === 'unread' && 'accent')} onClick={() => setListFilter('unread')}>未读</button>
          <button className={cn('chip', listFilter === 'group' && 'accent')} onClick={() => setListFilter('group')}>群聊</button>
          <span className="grow" />
          <Pin size={11} className="faint" />
        </div>
        <div className="im-chat-list scroll-y">
          {filtered.map((chat) => {
            const last = chat.messages.at(-1)
            return (
              <button key={chat.id} className={cn('im-chat-item', chat.id === active?.id && 'active')} onClick={() => selectChat(chat)}>
                <Avatar name={chat.name} hue={chat.avatarHue} size={43} round online={chat.type === 'direct' ? chat.online : undefined} />
                <span className="im-chat-copy">
                  <span className="im-chat-top">
                    <strong>{chat.name}</strong>
                    <small>{shortTime(chat.updatedAt)}</small>
                  </span>
                  <span className="im-chat-bottom">
                    <span className="im-preview">{chat.isAI ? '智核 · 多模型 AI' : last ? messagePreview(last, files) : '开始聊天吧'}</span>
                    {chat.pinned && <Pin size={10} className="faint" />}
                    {chat.unread > 0 && <span className="im-unread">{chat.unread > 99 ? '99+' : chat.unread}</span>}
                  </span>
                </span>
              </button>
            )
          })}
          {filtered.length === 0 && <div className="empty-state"><Search size={20} /><strong>没有匹配的会话</strong></div>}
        </div>
        <footer className="im-list-foot">
          <button onClick={() => openApp('ai')}><Sparkles size={13} /> 智核助手 <span className="chip green">在线</span></button>
        </footer>
      </aside>

      <section className={cn('im-conv', !mobileList && 'mobile-conv')}>
        {active ? (
          <>
            <header className="im-conv-head">
              <button className="icon-btn im-back" onClick={() => setMobileList(true)}><ArrowLeft size={18} /></button>
              <Avatar name={active.name} hue={active.avatarHue} size={37} round online={active.type === 'direct' ? active.online : undefined} />
              <div className="im-conv-title">
                <strong>{active.name} {active.isAI && <span className="chip accent">AI</span>}</strong>
                <span>{active.type === 'group' ? `群聊 · ${active.members.length + 1} 人` : active.online ? '在线 · 本地节点' : '离线'}</span>
              </div>
              <div className="im-conv-actions">
                <button className="icon-btn" title="会话内搜索" onClick={() => setQuery('')}><Search size={16} /></button>
                <button className="icon-btn" title="语音通话" onClick={() => setCall({ kind: 'voice', chatId: active.id })}><Phone size={16} /></button>
                <button className="icon-btn" title="视频通话" onClick={() => setCall({ kind: 'video', chatId: active.id })}><Video size={16} /></button>
                <button className="icon-btn" title="用 AI 总结" onClick={() => {
                  const context = active.messages.slice(-30).map((m) => `${m.senderId === 'me' ? '我' : active.name}：${m.text ?? '[附件]'}`).join('\n')
                  ecosystem.askAI({ prompt: `总结这段对话，并给出 3 条可执行的回复建议：\n${context}`, origin: 'im', autoSend: true })
                }}><Sparkles size={16} /></button>
                <div className="im-more-wrap">
                  <button className={cn('icon-btn', moreOpen && 'active')} onClick={() => setMoreOpen((v) => !v)}><MoreHorizontal size={17} /></button>
                  {moreOpen && (
                    <div className="im-more-menu">
                      <button onClick={() => { togglePin(active.id); setMoreOpen(false) }}><Pin size={14} />{active.pinned ? '取消置顶' : '置顶会话'}</button>
                      <button onClick={() => { markChatRead(active.id); setMoreOpen(false); toast('已标记为已读', active.name, 'success') }}><CheckCheck size={14} />全部已读</button>
                      <button onClick={() => { setMoreOpen(false); ecosystem.open('settings') }}><Sparkles size={14} />会话设置</button>
                    </div>
                  )}
                </div>
              </div>
            </header>

            <div className="im-messages scroll-y" ref={scrollRef}>
              <div className="im-msg-banner">
                <span className="dot pulse" /> 消息通过本地节点传递 · 附件保存到云巢
              </div>
              {activeMessages.map((m, i) => {
                const prev = activeMessages[i - 1]
                const showDate = !prev || new Date(prev.time).toDateString() !== new Date(m.time).toDateString()
                if (m.senderId === 'system') {
                  return (
                    <div key={m.id}>
                      {showDate && <div className="msg-date">{dateDivider(m.time)}</div>}
                      <div className="msg-system">{m.text}</div>
                    </div>
                  )
                }
                const mine = m.senderId === 'me'
                const sender = contacts.find((c) => c.id === m.senderId)
                return (
                  <div key={m.id}>
                    {showDate && <div className="msg-date">{dateDivider(m.time)}</div>}
                    <div className={cn('msg-row', mine && 'mine', m.kind === 'call' && 'call-row')}>
                      {!mine && m.kind !== 'call' && <Avatar name={sender?.name ?? active.name} hue={sender?.hue ?? active.avatarHue} size={31} round online={sender?.online} />}
                      <div className="msg-content">
                        {!mine && active.type === 'group' && m.kind !== 'call' && <span className="msg-sender">{sender?.name}</span>}
                        <MessageBody message={m} mine={mine} />
                        <div className={cn('msg-meta', mine && 'mine')}>
                          <span>{shortTime(m.time)}</span>
                          {mine && (m.status === 'read' ? <CheckCheck size={10} /> : <Check size={10} />)}
                        </div>
                      </div>
                      {mine && m.kind !== 'call' && <Avatar name={profile.name} hue={profile.hue} size={31} round />}
                    </div>
                  </div>
                )
              })}
            </div>

            <footer className="im-composer">
              {recording ? (
                <div className="recording-bar">
                  <span className="rec-dot" />
                  <strong>正在录音</strong>
                  <span className="mono">{formatDuration(recordSeconds)}</span>
                  <div className="grow" />
                  <button className="btn sm danger" onClick={() => stopRecording(true)}><X size={12} /> 取消</button>
                  <button className="btn sm primary" onClick={() => stopRecording(false)}><Square size={11} /> 发送语音</button>
                </div>
              ) : (
                <>
                  <div className="im-tools">
                    <button className="icon-btn sm" title="表情" onClick={() => setEmojiOpen((v) => !v)}><Laugh size={17} /></button>
                    <button className="icon-btn sm" title="发送图片" onClick={() => imgInput.current?.click()}><ImagePlus size={17} /></button>
                    <button className="icon-btn sm" title="发送文件" onClick={() => fileInput.current?.click()}><Paperclip size={17} /></button>
                    <button className="icon-btn sm" title="语音消息" onClick={startRecording}><Mic size={17} /></button>
                    <span className="grow" />
                    <button className="icon-btn sm" title="AI 起草回复" onClick={() => {
                      const context = active.messages.slice(-12).map((m) => `${m.senderId === 'me' ? '我' : active.name}：${m.text ?? '[附件]'}`).join('\n')
                      ecosystem.askAI({ prompt: `帮我起草一条回复，语气自然、简短。对话如下：\n${context}`, origin: 'im' })
                    }}><Sparkles size={16} /></button>
                  </div>
                  <div className="im-input-wrap">
                    <textarea
                      ref={textRef}
                      value={draft}
                      rows={1}
                      onChange={(e) => {
                        setDraft(e.target.value)
                        e.target.style.height = 'auto'
                        e.target.style.height = `${Math.min(112, e.target.scrollHeight)}px`
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          doSend()
                        }
                      }}
                      placeholder={`发送给 ${active.name}…`}
                    />
                    <button className="im-send" onClick={doSend} disabled={!draft.trim() || sendBusy} aria-label="发送"><Send size={16} /></button>
                  </div>
                  <div className="im-composer-foot"><span>Enter 发送 · Shift+Enter 换行</span><span>{draft.length}/2000</span></div>
                  {emojiOpen && (
                    <div className="emoji-pop">
                      {EMOJIS.map((e) => <button key={e} onClick={() => { setDraft((d) => d + e); setEmojiOpen(false) }}>{e}</button>)}
                    </div>
                  )}
                </>
              )}
              <input ref={imgInput} type="file" accept="image/*" multiple hidden onChange={(e) => attach(e.target.files, true)} />
              <input ref={fileInput} type="file" multiple hidden onChange={(e) => attach(e.target.files, false)} />
            </footer>
          </>
        ) : (
          <div className="empty-state"><MessageCircle size={28} /><strong>选择一个会话</strong><p>从左侧选择联系人，或发起一个新的对话。</p></div>
        )}
      </section>

      {newChat && <NewChatModal contacts={contacts} onClose={() => setNewChat(false)} onPick={(contact) => { setNewChat(false); useSystem.getState().createDirectChat(contact.id); setMobileList(false) }} />}
      {call && <CallOverlay chat={chats.find((c) => c.id === call.chatId) ?? active!} kind={call.kind} onClose={() => setCall(null)} />}
    </div>
  )
}

function Rail({ panel, setPanel, unread, profile, openApp }: { panel: string; setPanel: (p: 'chats' | 'moments' | 'contacts') => void; unread: number; profile: { name: string; hue: number }; openApp: (id: 'ai' | 'settings') => void }) {
  return (
    <nav className="im-rail">
      <div className="im-rail-logo"><Avatar name={profile.name} hue={profile.hue} size={34} round /></div>
      <div className="im-rail-tabs">
        <button className={cn('im-rail-btn', panel === 'chats' && 'active')} onClick={() => setPanel('chats')} title="消息"><MessageSquare size={19} />{unread > 0 && <span className="im-rail-badge">{unread}</span>}</button>
        <button className={cn('im-rail-btn', panel === 'moments' && 'active')} onClick={() => setPanel('moments')} title="朋友圈"><Aperture size={19} /></button>
        <button className={cn('im-rail-btn', panel === 'contacts' && 'active')} onClick={() => setPanel('contacts')} title="通讯录"><Users size={19} /></button>
      </div>
      <div className="im-rail-bottom">
        <button className="im-rail-btn" onClick={() => openApp('ai')} title="智核"><Sparkles size={18} /></button>
        <button className="im-rail-btn" onClick={() => openApp('settings')} title="设置"><MoreHorizontal size={19} /></button>
      </div>
    </nav>
  )
}

function MessageBody({ message, mine }: { message: ChatMessage; mine: boolean }) {
  const file = useSystem((s) => s.files.find((f) => f.id === message.fileId))
  if (message.kind === 'text') return <div className={cn('msg-bubble', mine && 'mine')}>{message.text}</div>
  if (message.kind === 'image') {
    return (
      <button className="msg-image" onClick={() => message.fileId && ecosystem.openFile(message.fileId)}>
        {message.image ? <img src={message.image} alt={message.text ?? '图片'} /> : <div className="msg-image-fallback"><ImagePlus size={24} /></div>}
        <span className="msg-image-cap">{message.text}</span>
      </button>
    )
  }
  if (message.kind === 'file') {
    return (
      <button className="msg-file" onClick={() => message.fileId && ecosystem.openFile(message.fileId)}>
        <span className="msg-file-icon">{file?.mime.startsWith('image') ? <ImagePlus size={18} /> : <Paperclip size={18} />}</span>
        <span className="grow"><strong>{file?.name ?? message.text}</strong><small>{file ? `${formatBytes(file.size)} · ${file.mime.split('/')[1]?.toUpperCase()}` : '云巢文件'}</small></span>
        <span className="chip">打开</span>
      </button>
    )
  }
  if (message.kind === 'voice') return <VoiceBubble message={message} mine={mine} />
  if (message.kind === 'call') {
    return (
      <div className="msg-call">
        <span className="msg-call-icon">{message.callKind === 'video' ? <Video size={15} /> : <Phone size={15} />}</span>
        <span><strong>{message.text}</strong><small>{formatDuration(message.duration ?? 0)} · 已结束</small></span>
      </div>
    )
  }
  if (message.kind === 'link') {
    return (
      <button className="msg-link" onClick={() => ecosystem.open('browser', { url: (message.linkParams?.url as string) ?? message.text })}>
        <span className="msg-link-icon">↗</span>
        <span className="grow"><strong>{message.text}</strong><small>{String(message.linkParams?.url ?? '')}</small></span>
      </button>
    )
  }
  return null
}

function VoiceBubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  const { url } = useBlobUrl(message.blobId)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  return (
    <button className={cn('msg-voice', mine && 'mine')} onClick={() => {
      if (!audioRef.current) {
        if (!url) return
        const a = new Audio(url)
        audioRef.current = a
        a.onended = () => setPlaying(false)
      }
      if (playing) { audioRef.current.pause(); setPlaying(false) } else { audioRef.current.play(); setPlaying(true) }
    }}>
      <span className="voice-play">{playing ? <Square size={11} /> : <Mic size={12} />}</span>
      <span className="voice-wave">{Array.from({ length: 13 }).map((_, i) => <i key={i} style={{ height: `${5 + ((i * 7) % 16)}px` }} />)}</span>
      <span className="voice-dur">{formatDuration(message.duration ?? 0)}</span>
    </button>
  )
}

function ContactsView({ contacts, chats, profile, onNewChat }: { contacts: Contact[]; chats: Chat[]; profile: { name: string; hue: number; bio: string }; onNewChat: () => void }) {
  const [q, setQ] = useState('')
  const groups = chats.filter((c) => c.type === 'group')
  const filtered = contacts.filter((c) => (c.name + c.signature).toLowerCase().includes(q.toLowerCase()))
  return (
    <section className="im-contacts">
      <header className="im-page-head">
        <div><span className="sheet-eyebrow">ADDRESS BOOK</span><h2>通讯录</h2></div>
        <button className="btn sm" onClick={onNewChat}><MessageSquare size={13} /> 发起会话</button>
      </header>
      <div className="im-contact-profile">
        <Avatar name={profile.name} hue={profile.hue} size={58} round />
        <div><strong>{profile.name}</strong><span>{profile.bio}</span></div>
        <span className="chip green"><span className="dot" /> 在线</span>
      </div>
      <div className="field im-contact-search"><Search size={14} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索联系人" /></div>
      <div className="im-contact-scroll scroll-y">
        <div className="section-title">群聊 · {groups.length}</div>
        <div className="im-contact-grid">
          {groups.map((g) => (
            <button key={g.id} className="im-contact-card" onClick={() => ecosystem.open('im', { chatId: g.id })}>
              <Avatar name={g.name} hue={g.avatarHue} size={38} round />
              <span><strong>{g.name}</strong><small>{g.members.length + 1} 人</small></span>
            </button>
          ))}
        </div>
        <div className="section-title" style={{ marginTop: 18 }}>联系人 · {filtered.length}</div>
        <div className="im-contact-list">
          {filtered.map((c) => (
            <button key={c.id} className="im-contact-row" onClick={() => useSystem.getState().createDirectChat(c.id)}>
              <Avatar name={c.name} hue={c.hue} size={38} round online={c.online} />
              <span className="grow"><strong>{c.name} <span className="faint">· {c.region}</span></strong><small>{c.signature}</small></span>
              <span className="chip">{c.tags?.[0]}</span>
              <MessageCircle size={14} className="faint" />
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

function NewChatModal({ contacts, onClose, onPick }: { contacts: Contact[]; onClose: () => void; onPick: (contact: Contact) => void }) {
  const [q, setQ] = useState('')
  const filtered = contacts.filter((c) => (c.name + c.signature).toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="im-modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="im-modal">
        <header><div><span className="sheet-eyebrow">NEW CONVERSATION</span><h3>发起新会话</h3></div><button className="icon-btn" onClick={onClose}><X size={17} /></button></header>
        <div className="field"><Search size={14} /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索联系人" /></div>
        <div className="im-new-list scroll-y">
          {filtered.map((c) => (
            <button key={c.id} onClick={() => onPick(c)}>
              <Avatar name={c.name} hue={c.hue} size={37} round online={c.online} />
              <span className="grow"><strong>{c.name}</strong><small>{c.signature}</small></span>
              <MessageCircle size={14} className="faint" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
