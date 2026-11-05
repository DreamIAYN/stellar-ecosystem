import DOMPurify from 'dompurify'
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  Copy,
  FileText,
  Loader2,
  MessageSquarePlus,
  MoreHorizontal,
  Paperclip,
  Plus,
  RotateCcw,
  Search,
  Send,
  Settings2,
  Sparkles,
  Square,
  Trash2,
  Wand2,
  X,
} from 'lucide-react'
import { marked } from 'marked'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppProps } from '../../components/AppRenderer'
import { ecosystem } from '../../core/ecosystem'
import { streamCompletion } from '../../core/ai'
import { useSystem } from '../../core/store'
import type { AIConversation, AIMessage, AIProvider } from '../../core/types'
import { cn, copyText, formatDuration, relativeTime, uid } from '../../core/utils'

interface ContextChip { id: string; name: string; text: string }

const QUICK_PROMPTS = [
  { title: '总结会议纪要', text: '总结云巢里的评审纪要，列出决策与待办。', icon: FileText, hue: '#69e6ff' },
  { title: '审阅扫描件', text: '帮我整理扫描件里的关键信息，并指出需要补充的条款。', icon: Sparkles, hue: '#fda4af' },
  { title: '起草一封邮件', text: '以产品负责人的语气，起草一封关于 v0.1 内测邀请的邮件。', icon: Wand2, hue: '#c4b5fd' },
  { title: '解释一段代码', text: '解释这段代码的并发模型，并指出潜在风险。', icon: MessageSquarePlus, hue: '#fcd34d' },
]

export default function AIApp({ params }: AppProps) {
  const conversations = useSystem((s) => s.conversations)
  const activeConversationId = useSystem((s) => s.activeConversationId)
  const providers = useSystem((s) => s.providers)
  const selectedProviderId = useSystem((s) => s.selectedProviderId)
  const selectProvider = useSystem((s) => s.selectProvider)
  const updateProvider = useSystem((s) => s.updateProvider)
  const addConversation = useSystem((s) => s.addConversation)
  const deleteConversation = useSystem((s) => s.deleteConversation)
  const setActiveConversation = useSystem((s) => s.setActiveConversation)
  const appendAIMessage = useSystem((s) => s.appendAIMessage)
  const patchAIMessage = useSystem((s) => s.patchAIMessage)
  const updateConversation = useSystem((s) => s.updateConversation)
  const aiQueue = useSystem((s) => s.aiQueue)
  const consumeAIRequest = useSystem((s) => s.consumeAIRequest)
  const toast = useSystem((s) => s.toast)
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [providerMenu, setProviderMenu] = useState(false)
  const [settingsProvider, setSettingsProvider] = useState<AIProvider | null>(null)
  const [filePicker, setFilePicker] = useState(false)
  const [systemEditor, setSystemEditor] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [contexts, setContexts] = useState<ContextChip[]>([])
  const [streaming, setStreaming] = useState(false)
  const [menuId, setMenuId] = useState<string | null>(null)
  const processedQueue = useRef(new Set<string>())
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const active = conversations.find((c) => c.id === activeConversationId) ?? conversations[0]
  const provider = providers.find((p) => p.id === selectedProviderId) ?? providers[0]
  const filtered = conversations.filter((c) => !query.trim() || c.title.toLowerCase().includes(query.toLowerCase()) || c.messages.some((m) => m.content.toLowerCase().includes(query.toLowerCase())))
  const configured = provider?.kind === 'demo' || Boolean(provider?.apiKey)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [active?.id, active?.messages.length, streaming])

  useEffect(() => {
    if (!aiQueue.length) return
    const req = aiQueue.find((r) => !processedQueue.current.has(r.id))
    if (!req) return
    processedQueue.current.add(req.id)
    consumeAIRequest(req.id)
    const context = req.context?.trim()
    const title = req.prompt.slice(0, 26) || '新的对话'
    const convId = addConversation({
      title,
      system: req.system ?? active?.system,
      messages: req.autoSend
        ? []
        : [],
    })
    if (req.autoSend) {
      const userMsg: AIMessage = { id: uid('aim'), role: 'user', content: req.prompt, time: new Date().toISOString(), context }
      appendAIMessage(convId, userMsg)
      requestCompletion(convId, req.prompt, provider, context, req.system ?? active?.system)
    } else {
      setDraft(req.prompt)
      if (context) setContexts([{ id: uid('ctx'), name: req.origin ? `来自 ${req.origin}` : '跨应用上下文', text: context }])
      setTimeout(() => inputRef.current?.focus(), 80)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiQueue])

  useEffect(() => {
    if (params.focusComposer) setTimeout(() => inputRef.current?.focus(), 100)
  }, [params.focusComposer])

  useEffect(() => {
    if (!active && conversations.length === 0) {
      addConversation({ title: '新的对话' })
    }
  }, [active, conversations.length, addConversation])

  const requestCompletion = async (convId: string, prompt: string, prov: AIProvider, context?: string, system?: string, regenerate = false) => {
    const conv = useSystem.getState().conversations.find((c) => c.id === convId)
    if (!conv) return
    setStreaming(true)
    const assistant: AIMessage = { id: uid('aim'), role: 'assistant', content: '', time: new Date().toISOString(), providerId: prov.id, model: prov.model, pending: true }
    appendAIMessage(convId, assistant)
    const ctrl = new AbortController()
    abortRef.current = ctrl
    let full = ''
    try {
      const history = [...conv.messages.filter((m) => !m.pending), { id: 'tmp-user', role: 'user' as const, content: context ? `${prompt}\n\n---\n以下是来自星环生态的上下文：\n${context}` : prompt, time: new Date().toISOString() }]
      await streamCompletion(prov, history, {
        system,
        signal: ctrl.signal,
        onDelta: (delta) => {
          full += delta
          patchAIMessage(convId, assistant.id, { content: full })
        },
      })
      patchAIMessage(convId, assistant.id, { content: full, pending: false })
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        patchAIMessage(convId, assistant.id, { content: full + '\n\n_（已停止生成）_', pending: false })
      } else {
        patchAIMessage(convId, assistant.id, {
          content: `**请求失败**\n\n${e instanceof Error ? e.message : '未知错误'}\n\n> 检查「控制台 → AI 模型」中的 Base URL、API Key 与模型名称。部分服务商需要允许浏览器跨域访问。`,
          pending: false,
          error: true,
        })
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
      const latest = useSystem.getState().conversations.find((c) => c.id === convId)
      if (latest && latest.messages.filter((m) => m.role === 'user').length === 1 && latest.title === '新的对话') {
        updateConversation(convId, { title: prompt.slice(0, 26) })
      }
      if (regenerate) {/* no-op */}
    }
  }

  const send = async () => {
    if (!draft.trim() || streaming) return
    const prompt = draft.trim()
    const context = contexts.map((c) => `【${c.name}】\n${c.text}`).join('\n\n')
    const convId = active?.id ?? addConversation({ title: prompt.slice(0, 26) })
    const userMsg: AIMessage = { id: uid('aim'), role: 'user', content: prompt, time: new Date().toISOString(), context: context || undefined }
    appendAIMessage(convId, userMsg)
    setDraft('')
    setContexts([])
    const latest = useSystem.getState().conversations.find((c) => c.id === convId)
    if (latest && latest.messages.filter((m) => m.role === 'user').length === 1) updateConversation(convId, { title: prompt.slice(0, 26) })
    await requestCompletion(convId, prompt, provider, context || undefined, active?.system)
  }

  const regenerate = async () => {
    if (!active || streaming) return
    const msgs = [...active.messages]
    while (msgs.length && msgs[msgs.length - 1].role === 'assistant') msgs.pop()
    const lastUser = [...msgs].reverse().find((m) => m.role === 'user')
    if (!lastUser) return
    updateConversation(active.id, { messages: msgs })
    await requestCompletion(active.id, lastUser.content, provider, lastUser.context, active.system, true)
  }

  const stop = () => { abortRef.current?.abort() }

  const newConversation = () => {
    const id = addConversation({ title: '新的对话', system: active?.system })
    setActiveConversation(id)
    setDraft('')
    setContexts([])
    setTimeout(() => inputRef.current?.focus(), 80)
  }

  const addFileContext = async (fileId: string) => {
    const f = useSystem.getState().files.find((x) => x.id === fileId)
    if (!f) return
    const text = await ecosystem.getFileText(f)
    if (!text) return toast('无法读取', '这个文件不是文本格式。', 'error')
    setContexts((prev) => [...prev, { id: uid('ctx'), name: f.name, text: text.slice(0, 16000) }])
    setFilePicker(false)
    toast('已添加上下文', `${f.name} · ${text.length} 字符`, 'success')
  }

  return (
    <div className="ai">
      <aside className="ai-side">
        <div className="ai-side-head">
          <div className="ai-brand"><span className="ai-brand-orb"><Sparkles size={15} /></span><div><strong>智核</strong><span>NOVA AI</span></div></div>
          <button className="icon-btn" onClick={newConversation} title="新对话"><Plus size={17} /></button>
        </div>
        <button className="ai-new" onClick={newConversation}><MessageSquarePlus size={14} /> 新的对话</button>
        <div className="field ai-search"><Search size={13} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索对话" /></div>
        <div className="ai-conv-list scroll-y">
          {filtered.map((c) => (
            <div key={c.id} className={cn('ai-conv-item', c.id === active?.id && 'active')} onClick={() => { setActiveConversation(c.id); setContexts([]) }}>
              <span className="ai-conv-icon"><MessageSquarePlus size={13} /></span>
              <span className="grow"><strong>{c.title}</strong><small>{c.messages.length} 条 · {relativeTime(c.updatedAt)}</small></span>
              <button className="ai-conv-del" onClick={(e) => { e.stopPropagation(); deleteConversation(c.id) }}><Trash2 size={12} /></button>
            </div>
          ))}
          {filtered.length === 0 && <div className="empty-state"><Search size={18} /><strong>没有对话</strong></div>}
        </div>
        <div className="ai-side-foot">
          <button className="ai-provider-card" onClick={() => setProviderMenu((v) => !v)}>
            <span className="ai-provider-dot" style={{ background: provider?.color }} />
            <span className="grow"><strong>{provider?.label}</strong><small>{provider?.kind === 'demo' ? '本地演示 · 无需 Key' : configured ? `${provider?.model}` : '未配置 API Key'}</small></span>
            <ArrowDown size={12} />
          </button>
          {providerMenu && (
            <div className="ai-provider-menu">
              {providers.map((p) => (
                <button key={p.id} className={p.id === provider?.id ? 'active' : ''} onClick={() => { selectProvider(p.id); setProviderMenu(false) }}>
                  <span className="ai-provider-dot" style={{ background: p.color }} />
                  <span className="grow"><strong>{p.label}</strong><small>{p.kind === 'demo' ? '演示模式' : p.apiKey ? p.model : '需要 API Key'}</small></span>
                  {p.id === provider?.id && <Check size={13} />}
                </button>
              ))}
              <div className="menu-sep" />
              <button onClick={() => { setSettingsProvider(provider); setProviderMenu(false) }}><Settings2 size={13} /> 配置当前模型</button>
            </div>
          )}
          <div className="ai-side-hint"><span className={cn('dot', configured ? '' : 'off')} /> {configured ? '已就绪' : '去控制台配置'} · Key 只存本机</div>
        </div>
      </aside>

      <main className="ai-main">
        <header className="ai-head">
          <div className="ai-head-title"><strong>{active?.title ?? '智核'}</strong><span>{active ? `${active.messages.length} 条消息` : '多模型工作台'}</span></div>
          <div className="ai-head-actions">
            <select className="ai-model-select" value={provider?.model} onChange={(e) => updateProvider(provider.id, { model: e.target.value })}>
              {provider?.models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <button className="btn sm" onClick={() => setSettingsProvider(provider)}><Settings2 size={12} /> {provider?.kind === 'demo' ? '接入模型' : '配置'}</button>
            <button className="icon-btn" onClick={() => setSystemEditor(true)} title="系统提示词"><MoreHorizontal size={16} /></button>
            <button className={cn('icon-btn ai-mobile-only', mobileMenu && 'active')} onClick={() => setMobileMenu((v) => !v)} aria-label="会话菜单"><MessageSquarePlus size={16} /></button>
          </div>
          {mobileMenu && (
            <div className="ai-mobile-menu">
              <button className="ai-mobile-new" onClick={() => { newConversation(); setMobileMenu(false) }}><Plus size={13} /> 新的对话</button>
              <div className="ai-mobile-menu-label">最近会话</div>
              <div className="ai-mobile-menu-list">
                {conversations.slice(0, 8).map((c) => (
                  <button key={c.id} className={c.id === active?.id ? 'active' : ''} onClick={() => { setActiveConversation(c.id); setMobileMenu(false) }}><MessageSquarePlus size={12} /><span>{c.title}</span></button>
                ))}
              </div>
              <button className="ai-mobile-menu-foot" onClick={() => { setSettingsProvider(provider); setMobileMenu(false) }}><Settings2 size={13} /> 配置当前模型</button>
              <button className="ai-mobile-menu-foot" onClick={() => { setSystemEditor(true); setMobileMenu(false) }}><Sparkles size={13} /> 系统提示词</button>
            </div>
          )}
        </header>

        <div className="ai-messages scroll-y" ref={scrollRef}>
          {active && active.messages.length === 0 && (
            <AiWelcome onPrompt={(p) => { setDraft(p); inputRef.current?.focus() }} />
          )}
          {active?.messages.map((m, i) => (
            <AiMessageView key={m.id} message={m} conversation={active} onCopy={async () => { await copyText(m.content); toast('已复制', undefined, 'success') }} isLast={i === active.messages.length - 1} onRegenerate={regenerate} />
          ))}
          {streaming && !active?.messages.some((m) => m.pending) && <div className="ai-typing"><span /><span /><span /></div>}
        </div>

        <div className="ai-composer-wrap">
          {contexts.length > 0 && (
            <div className="ai-context-row">
              {contexts.map((c) => (
                <span className="ai-context-chip" key={c.id}><FileText size={11} />{c.name}<small>{c.text.length} 字</small><button onClick={() => setContexts((prev) => prev.filter((x) => x.id !== c.id))}><X size={10} /></button></span>
              ))}
            </div>
          )}
          <div className="ai-composer">
            <textarea
              ref={inputRef}
              value={draft}
              rows={1}
              onChange={(e) => { setDraft(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(150, e.target.scrollHeight)}px` }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder={provider?.kind === 'demo' ? '问点什么…（当前为演示模式，不会发出网络请求）' : `向 ${provider?.label} 提问…`}
            />
            <div className="ai-composer-tools">
              <button className="icon-btn sm" title="添加上下文文件" onClick={() => setFilePicker(true)}><Paperclip size={16} /></button>
              <button className="icon-btn sm" title="系统提示词" onClick={() => setSystemEditor(true)}><Sparkles size={16} /></button>
              <span className="ai-model-mini"><span className="ai-provider-dot" style={{ background: provider?.color }} />{provider?.model}</span>
              <span className="grow" />
              {streaming ? <button className="ai-stop" onClick={stop}><Square size={13} fill="currentColor" /></button> : <button className="ai-send" onClick={send} disabled={!draft.trim()}><Send size={16} /></button>}
            </div>
          </div>
          <div className="ai-composer-foot"><span>Enter 发送 · Shift+Enter 换行 · 内容会自动保存到本机</span><span className="chip">{configured ? 'READY' : 'DEMO'}</span></div>
        </div>
      </main>

      {settingsProvider && <ProviderSettings provider={settingsProvider} onClose={() => setSettingsProvider(null)} />}
      {filePicker && <FileContextPicker onClose={() => setFilePicker(false)} onPick={addFileContext} />}
      {systemEditor && active && <SystemEditor conversation={active} onClose={() => setSystemEditor(false)} />}
    </div>
  )
}

function AiWelcome({ onPrompt }: { onPrompt: (p: string) => void }) {
  return (
    <div className="ai-welcome">
      <div className="ai-orb">
        <span className="ai-orb-ring r1" /><span className="ai-orb-ring r2" /><span className="ai-orb-core"><Sparkles size={28} /></span>
      </div>
      <span className="sheet-eyebrow">NOVA · MULTI-MODEL</span>
      <h1>让整个生态，<br />听懂你的问题。</h1>
      <p>把云巢文件、扫描件、网页或会议纪要交给我。一个对话里，可以随时切换 DeepSeek、Claude、Gemini、OpenAI 与本地 Ollama。</p>
      <div className="ai-quick-grid">
        {QUICK_PROMPTS.map((q) => (
          <button key={q.title} className="ai-quick" onClick={() => onPrompt(q.text)}>
            <span className="ai-quick-icon" style={{ background: `linear-gradient(145deg, ${q.hue}, ${q.hue}55)`, color: '#06111d' }}><q.icon size={15} /></span>
            <span><strong>{q.title}</strong><small>{q.text}</small></span>
            <ArrowUpRight size={12} className="faint" />
          </button>
        ))}
      </div>
    </div>
  )
}

function AiMessageView({ message, onCopy, isLast, onRegenerate, conversation }: { message: AIMessage; onCopy: () => void; isLast: boolean; onRegenerate: () => void; conversation: AIConversation }) {
  const html = message.role === 'assistant' ? DOMPurify.sanitize(marked.parse(message.content || '') as string) : ''
  return (
    <div className={cn('ai-msg', message.role)}>
      {message.role === 'assistant' ? (
        <span className="ai-avatar"><Sparkles size={14} /></span>
      ) : (
        <span className="ai-user-avatar">我</span>
      )}
      <div className="ai-msg-body">
        <div className="ai-msg-meta">
          <strong>{message.role === 'assistant' ? '智核' : '我'}</strong>
          <span>{new Date(message.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
          {message.model && <span className="ai-msg-model">{message.model}</span>}
          {message.pending && <span className="ai-thinking"><span className="spinner" style={{ width: 9, height: 9 }} /> 生成中</span>}
        </div>
        {message.role === 'assistant' ? (
          message.content ? <div className="ai-md markdown" dangerouslySetInnerHTML={{ __html: html }} /> : <div className="ai-typing"><span /><span /><span /></div>
        ) : (
          <div className="ai-user-text">{message.content}</div>
        )}
        {message.context && <details className="ai-msg-context"><summary><FileText size={10} /> 附带 {message.context.length} 字符上下文</summary><pre>{message.context.slice(0, 1200)}</pre></details>}
        {!message.pending && (
          <div className="ai-msg-actions">
            <button onClick={onCopy}><Copy size={11} /> 复制</button>
            {message.role === 'assistant' && isLast && <button onClick={onRegenerate}><RotateCcw size={11} /> 重新生成</button>}
            <span className="faint">{message.error ? '错误' : conversation.title.slice(0, 18)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function ProviderSettings({ provider, onClose }: { provider: AIProvider; onClose: () => void }) {
  const updateProvider = useSystem((s) => s.updateProvider)
  const toast = useSystem((s) => s.toast)
  const [form, setForm] = useState(provider)
  const save = () => {
    updateProvider(provider.id, form)
    toast('模型配置已保存', `${form.label} · ${form.model}`, 'success')
    onClose()
  }
  return (
    <div className="ai-modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ai-modal">
        <header><div><span className="sheet-eyebrow">MODEL CONNECTION</span><h3>连接 {provider.label}</h3></div><button className="icon-btn" onClick={onClose}><X size={16} /></button></header>
        {provider.kind === 'demo' ? (
          <p className="hint">演示模式不会发出任何网络请求。要接入真实模型，请选择左侧的其他提供方，或在下方把当前提供方改为任意 OpenAI 兼容端点。</p>
        ) : null}
        <label className="label">显示名称</label>
        <div className="field"><input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></div>
        <label className="label">API Base URL</label>
        <div className="field"><input value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder="https://api.example.com/v1" /></div>
        <label className="label">API Key</label>
        <div className="field"><input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder="sk-…" autoComplete="off" /></div>
        <label className="label">模型名称</label>
        <div className="field"><input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
        <div className="ai-provider-models">
          {form.models.map((m) => <button key={m} className={m === form.model ? 'active' : ''} onClick={() => setForm({ ...form, model: m })}>{m}</button>)}
        </div>
        <p className="hint">密钥保存在当前浏览器的本地存储中，不会上传到星环服务器。生产环境建议使用自己的服务端代理。</p>
        <div className="row gap-6" style={{ justifyContent: 'flex-end' }}><button className="btn sm" onClick={onClose}>取消</button><button className="btn primary sm" onClick={save}><Check size={12} /> 保存配置</button></div>
      </div>
    </div>
  )
}

function FileContextPicker({ onClose, onPick }: { onClose: () => void; onPick: (id: string) => void }) {
  const files = useSystem((s) => s.files)
  const list = files.filter((f) => f.kind === 'file' && !f.trashed && (f.mime.startsWith('text/') || /\.(md|txt|json|ts|tsx|js|jsx|css|html|py)$/.test(f.name)))
  return (
    <div className="ai-modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ai-modal">
        <header><div><span className="sheet-eyebrow">CONTEXT FROM NEST</span><h3>添加云巢上下文</h3></div><button className="icon-btn" onClick={onClose}><X size={16} /></button></header>
        <div className="ai-file-list scroll-y">
          {list.map((f) => (
            <button key={f.id} onClick={() => onPick(f.id)}><FileText size={15} /><span className="grow"><strong>{f.name}</strong><small>{f.mime} · {f.size} B</small></span><Plus size={13} /></button>
          ))}
          {list.length === 0 && <div className="empty-state"><FileText size={20} /><strong>没有文本文件</strong></div>}
        </div>
      </div>
    </div>
  )
}

function SystemEditor({ conversation, onClose }: { conversation: AIConversation; onClose: () => void }) {
  const updateConversation = useSystem((s) => s.updateConversation)
  const [value, setValue] = useState(conversation.system ?? '')
  return (
    <div className="ai-modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ai-modal">
        <header><div><span className="sheet-eyebrow">SYSTEM PROMPT</span><h3>系统提示词</h3></div><button className="icon-btn" onClick={onClose}><X size={16} /></button></header>
        <textarea className="textarea" value={value} onChange={(e) => setValue(e.target.value)} rows={6} placeholder="为这个对话设定角色与约束…" />
        <p className="hint">系统提示词只作用于当前对话，切换对话后会使用各自的设定。</p>
        <div className="row gap-6" style={{ justifyContent: 'flex-end' }}><button className="btn sm" onClick={onClose}>取消</button><button className="btn primary sm" onClick={() => { updateConversation(conversation.id, { system: value }); onClose() }}>保存</button></div>
      </div>
    </div>
  )
}
