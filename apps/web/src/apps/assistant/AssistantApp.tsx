import { AudioLines, Mic, MicOff, Send, Sparkles, Volume2, VolumeX, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { AppProps } from '../../components/AppRenderer'
import { ecosystem } from '../../core/ecosystem'
import { useSystem } from '../../core/store'
import { APP_DEFINITIONS } from '../../core/registry'
import { cn, formatClock } from '../../core/utils'

interface LogItem { id: string; role: 'user' | 'halo'; text: string; time: string; action?: string }

const SUGGESTIONS = [
  '打开扫描师，切换到试卷模式',
  '给林小满发消息说会议改到八点',
  '发起一个会议，房间 STL-2048',
  '现在几点？',
]

export default function AssistantApp(_props: AppProps) {
  const profile = useSystem((s) => s.profile)
  const [listening, setListening] = useState(false)
  const [muted, setMuted] = useState(false)
  const [supported, setSupported] = useState(true)
  const [interim, setInterim] = useState('')
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [log, setLog] = useState<LogItem[]>([
    { id: 'hello', role: 'halo', text: `你好，${profile.name}。我是小环。试试说「打开扫描师」，或者让我把云巢里的评审纪要发给林小满。`, time: new Date().toISOString() },
  ])
  const recognitionRef = useRef<any>(null)
  const logEnd = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { setSupported(false); return }
    const rec = new SR()
    rec.lang = 'zh-CN'
    rec.continuous = false
    rec.interimResults = true
    rec.onresult = (event: any) => {
      let finalText = ''
      let temp = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i]
        if (r.isFinal) finalText += r[0].transcript
        else temp += r[0].transcript
      }
      setInterim(temp)
      if (finalText) {
        setInterim('')
        handle(finalText.trim())
      }
    }
    rec.onerror = (e: any) => {
      setListening(false)
      if (e.error === 'not-allowed') addLog('halo', '麦克风权限被拒绝。请允许浏览器访问麦克风，或直接输入文字。')
      else if (e.error !== 'no-speech') addLog('halo', `语音识别遇到问题：${e.error}`)
    }
    rec.onend = () => setListening(false)
    recognitionRef.current = rec
    return () => { rec.onend = null; rec.abort?.(); window.speechSynthesis?.cancel() }
  }, [])

  useEffect(() => {
    logEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [log.length, thinking])

  const addLog = (role: LogItem['role'], text: string, action?: string) => {
    setLog((prev) => [...prev.slice(-30), { id: `${Date.now()}-${Math.random()}`, role, text, time: new Date().toISOString(), action }])
  }

  const speak = (text: string) => {
    if (muted || !('speechSynthesis' in window)) return
    try {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text.replace(/[*_#`]/g, ''))
      u.lang = 'zh-CN'
      u.rate = 1.02
      u.pitch = 1.05
      const voices = window.speechSynthesis.getVoices()
      const zh = voices.find((v) => v.lang.startsWith('zh'))
      if (zh) u.voice = zh
      window.speechSynthesis.speak(u)
    } catch {}
  }

  const answer = (text: string, action?: string) => {
    addLog('halo', text, action)
    speak(text)
    setThinking(false)
  }

  const handle = async (raw: string) => {
    const text = raw.trim()
    if (!text) return
    addLog('user', text)
    setThinking(true)
    await new Promise((r) => setTimeout(r, 260))
    const t = text.toLowerCase()
    const state = useSystem.getState()

    if (/^(你好|嗨|hello|hi)/.test(t)) return answer(`你好，${profile.name}。今天想先处理什么？`)
    if (/(静音|别说话|关闭声音)/.test(text)) { setMuted(true); return answer('好，我不说话。你可以继续用文字或手势。') }
    if (/(取消静音|打开声音)/.test(text)) { setMuted(false); return answer('声音已打开。') }
    if (/(几点|时间)/.test(text) && !/(会议|安排)/.test(text)) return answer(`现在是 ${formatClock()}，${new Date().toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' })}。`)
    if (/谁在线|在线的人/.test(text)) {
      const online = state.contacts.filter((c) => c.online).map((c) => c.name)
      return answer(`${online.join('、')} 在线。需要我帮你打开星讯吗？`, 'open:im')
    }
    if (/(打开|启动|进入).*(朋友圈|动态)/.test(text)) return answer('朋友圈在星讯里，我先帮你打开星讯。', 'open:im')
    if (/(扫描|拍|打开).*(试卷|作业)/.test(text) || /(试卷|去手写)/.test(text)) {
      ecosystem.scan('exam')
      return answer('扫描师已切换到试卷模式。把试卷放平，拍照后拖动四个角，再用去手写滤镜清除红蓝笔迹。', 'open:scanner')
    }
    if (/(扫描|拍).*(证件|身份证|护照)/.test(text)) { ecosystem.scan('idcard'); return answer('证件模式已打开。导出时会自动加水印。', 'open:scanner') }
    if (/(扫描|拍).*(文档|合同|发票)/.test(text)) { ecosystem.scan('document'); return answer('扫描师的文档模式已就绪。', 'open:scanner') }
    if (/会议|会客厅|开会/.test(text)) {
      const room = text.match(/([A-Z]{2,5}-?\d{2,6})/i)?.[1]?.toUpperCase()
      ecosystem.open('meeting', room ? { room } : { create: true })
      return answer(room ? `会客厅已准备，房间 ${room}。` : '已为你创建会客厅，进去后可以复制邀请链接。', 'open:meeting')
    }
    if (/(发消息|告诉|通知).*(给)?/.test(text)) {
      const others = [...state.contacts].sort((a, b) => b.name.length - a.name.length)
      const target = others.find((c) => text.includes(c.name))
      const content = text.replace(/^.*?(?:说|：|:)/, '').trim()
      if (target && content && content !== text) {
        const chat = state.chats.find((c) => c.type === 'direct' && c.name === target.name)
        if (chat) {
          state.sendMessage(chat.id, { senderId: 'me', kind: 'text', text: content, status: 'sent' })
        } else {
          const id = state.createDirectChat(target.id)
          useSystem.getState().sendMessage(id, { senderId: 'me', kind: 'text', text: content, status: 'sent' })
        }
        ecosystem.open('im', { chatId: chat?.id })
        return answer(`已把「${content}」发给 ${target.name}。`, 'open:im')
      }
      ecosystem.open('im')
      return answer('已打开星讯。告诉我「给谁发什么」，我就能直接发送。', 'open:im')
    }
    if (/(新建|创建|打开).*(笔记|手写)/.test(text)) {
      const id = state.addNotebook({ title: '小环速记' })
      state.openApp('notes', { notebookId: id })
      return answer('已新建「小环速记」，打开墨记就可以写了。', 'open:notes')
    }
    if (/(播放|听|看).*(音乐|视频|电影|媒体)/.test(text)) { ecosystem.open('media'); return answer('声影已打开，播放列表里有云巢的音频和视频。', 'open:media') }
    if (/(云巢|文件|云盘)/.test(text) && /(打开|看看|查看|有哪)/.test(text)) {
      ecosystem.open('drive')
      return answer(`云巢里有 ${state.files.filter((f) => f.kind === 'file' && !f.trashed).length} 个文件，已经替你打开。`, 'open:drive')
    }
    if (/(浏览器|网页|搜索)/.test(text)) {
      const q = text.replace(/.*(?:搜索|查一下|查|打开)/, '').trim()
      if (q) ecosystem.open('browser', { url: `https://www.bing.com/search?q=${encodeURIComponent(q)}` })
      else ecosystem.open('browser')
      return answer(q ? `已在漫游里搜索「${q}」。` : '漫游已打开。', 'open:browser')
    }
    if (/(总结|摘要|整理).*(纪要|会议|文件|扫描)/.test(text)) {
      const file = state.files.find((f) => f.id === 'file-notes')
      const context = file?.text ?? ''
      ecosystem.askAI({ prompt: '帮我总结这份评审纪要，输出决策与待办。', context, origin: 'assistant', autoSend: true })
      return answer('我把评审纪要交给了智核，正在生成摘要。', 'open:ai')
    }
    const app = APP_DEFINITIONS.find((a) => text.includes(a.name) || text.toLowerCase().includes(a.en.toLowerCase()))
    if (app) { state.openApp(app.id); return answer(`${app.name}已打开。`, `open:${app.id}`) }

    ecosystem.askAI({ prompt: text, origin: 'assistant', autoSend: true })
    return answer('这个问题超出了我的本地指令范围，我把它交给了智核。', 'open:ai')
  }

  const startListening = () => {
    if (!supported) { inputRef.current?.focus(); return }
    if (listening) { recognitionRef.current?.stop(); setListening(false); return }
    try {
      setInterim('')
      recognitionRef.current?.start()
      setListening(true)
    } catch {
      setListening(false)
    }
  }

  const submit = () => {
    if (!input.trim()) return
    handle(input)
    setInput('')
  }

  return (
    <div className={cn('assistant', listening && 'listening')}>
      <header className="assistant-head">
        <div className="assistant-brand"><span className="assistant-brand-icon"><AudioLines size={17} /></span><div><strong>小环</strong><span>HALO ASSISTANT</span></div></div>
        <div className="assistant-status"><span className={cn('dot', listening ? 'pulse' : '')} /> {listening ? '正在聆听' : thinking ? '正在思考' : '待命'} <span className="hint">· 本地指令优先</span></div>
        <button className="icon-btn" onClick={() => { setMuted((m) => !m); if (!muted) window.speechSynthesis?.cancel() }} title={muted ? '打开声音' : '静音'}>{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>
      </header>

      <div className="assistant-body">
        <div className="halo-stage">
          <div className="halo-orb-wrap" onClick={startListening} role="button" aria-label="开始语音输入">
            <div className="halo-ring r1" /><div className="halo-ring r2" /><div className="halo-ring r3" />
            <div className="halo-core"><AudioLines size={38} /></div>
            <span className="halo-wave w1" /><span className="halo-wave w2" />
          </div>
          <h1>{listening ? '我在听。' : thinking ? '让我想一想。' : '随时，说一声。'}</h1>
          <p className="halo-sub">{supported ? (listening ? interim || '说出你的指令，例如「打开扫描师」' : '点击光环或按下麦克风，用一句话调度整个生态。') : '当前浏览器不支持语音识别，请使用下方文字输入。'}</p>
          <button className={cn('halo-mic', listening && 'active')} onClick={startListening}>{listening ? <MicOff size={20} /> : <Mic size={20} />}<span>{listening ? '停止聆听' : '开始说话'}</span></button>
          {listening && <div className="halo-interim">{interim || '…'}</div>}
          <div className="halo-suggestions">
            {SUGGESTIONS.map((s) => <button key={s} onClick={() => handle(s)}>{s}</button>)}
          </div>
        </div>

        <div className="halo-conversation">
          <div className="halo-conv-head"><span className="section-title">对话</span><button className="text-btn" onClick={() => setLog(log.slice(-1))}><X size={11} /> 清空</button></div>
          <div className="halo-log scroll-y">
            {log.map((item) => (
              <div key={item.id} className={cn('halo-msg', item.role)}>
                <span className="halo-msg-avatar">{item.role === 'halo' ? <AudioLines size={13} /> : '我'}</span>
                <div><p>{item.text}</p><span>{new Date(item.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}{item.action ? ` · ${item.action}` : ''}</span></div>
              </div>
            ))}
            {thinking && <div className="halo-msg halo"><span className="halo-msg-avatar"><AudioLines size={13} /></span><div className="ai-typing"><span /><span /><span /></div></div>}
            <div ref={logEnd} />
          </div>
          <div className="halo-input">
            <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder={supported ? '也可以直接打字，或输入指令…' : '输入指令，例如「打开云巢」…'} />
            <button onClick={submit} disabled={!input.trim()}><Send size={14} /></button>
          </div>
          <div className="halo-foot"><span><Mic size={10} /> 语音识别由浏览器提供</span><span><Sparkles size={10} /> 指令在本机解析</span></div>
        </div>
      </div>
    </div>
  )
}
