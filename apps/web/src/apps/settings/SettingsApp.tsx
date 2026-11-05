import {
  Check,
  ChevronRight,
  Cloud,
  Database,
  Download,
  Eye,
  EyeOff,
  FileJson,
  HardDrive,
  Info,
  KeyRound,
  Laptop,
  Loader2,
  Palette,
  Plus,
  RefreshCcw,
  Shield,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { AppProps } from '../../components/AppRenderer'
import { Avatar } from '../../components/Avatar'
import { clearBlobs, estimateUsage, getBlob, putBlob } from '../../core/db'
import { ecosystem } from '../../core/ecosystem'
import { useSystem } from '../../core/store'
import type { AIProvider } from '../../core/types'
import { downloadBlob, formatBytes, nowIso } from '../../core/utils'
import { streamCompletion } from '../../core/ai'

type Tab = 'appearance' | 'ai' | 'data' | 'about'

const TABS: { id: Tab; label: string; icon: typeof Palette; note: string }[] = [
  { id: 'appearance', label: '外观与账户', icon: Palette, note: '主题、壁纸、身份' },
  { id: 'ai', label: 'AI 模型', icon: Sparkles, note: '多模型 API 配置' },
  { id: 'data', label: '数据与迁移', icon: Database, note: '备份、导入、清理' },
  { id: 'about', label: '关于与许可', icon: Info, note: '开源、版本、致谢' },
]

export default function SettingsApp({ params }: AppProps) {
  const [tab, setTab] = useState<Tab>((params.tab as Tab) || 'appearance')
  const [usage, setUsage] = useState({ usage: 0, quota: 0 })
  const [busy, setBusy] = useState('')
  const importRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (params.tab && TABS.some((t) => t.id === params.tab)) setTab(params.tab as Tab)
  }, [params.tab])
  useEffect(() => { estimateUsage().then(setUsage).catch(() => {}) }, [])

  const exportBackup = async () => {
    setBusy('export')
    try {
      const { default: JSZip } = await import('jszip')
      const s = useSystem.getState()
      const zip = new JSZip()
      const state = {
        version: 1,
        exportedAt: nowIso(),
        app: 'stellar',
        files: s.files,
        chats: s.chats,
        contacts: s.contacts,
        moments: s.moments,
        notifications: s.notifications,
        providers: s.providers,
        conversations: s.conversations,
        notebooks: s.notebooks,
        bookmarks: s.bookmarks,
        browserTabs: s.browserTabs,
        profile: s.profile,
        preferences: s.preferences,
        scanDocs: s.scanDocs,
        meetings: s.meetings,
      }
      zip.file('stellar.json', JSON.stringify(state, null, 2))
      const blobIds = new Set<string>()
      for (const f of s.files) if (f.blobId) blobIds.add(f.blobId)
      for (const c of s.chats) for (const m of c.messages) if (m.blobId) blobIds.add(m.blobId)
      for (const d of s.scanDocs) for (const p of d.pages) if (p.blobId) blobIds.add(p.blobId)
      const folder = zip.folder('blobs')!
      for (const id of blobIds) {
        const blob = await getBlob(id)
        if (blob) folder.file(id, blob)
      }
      const out = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
      downloadBlob(out, `stellar-backup-${new Date().toISOString().slice(0, 10)}.zip`)
      useSystem.getState().toast('备份已导出', `${s.files.length} 个文件 · ${formatBytes(out.size)}`, 'success')
    } catch (e) {
      useSystem.getState().toast('备份失败', e instanceof Error ? e.message : '未知错误', 'error')
    } finally { setBusy('') }
  }

  const importBackup = async (file: File | undefined) => {
    if (!file) return
    setBusy('import')
    try {
      const { default: JSZip } = await import('jszip')
      const zip = await JSZip.loadAsync(file)
      const metaFile = zip.file('stellar.json')
      if (!metaFile) throw new Error('备份中缺少 stellar.json')
      const meta = JSON.parse(await metaFile.async('string'))
      const blobEntries = zip.folder('blobs')
      if (blobEntries) {
        const tasks: Promise<void>[] = []
        blobEntries.forEach((path, entry) => {
          if (entry.dir) return
          tasks.push(entry.async('blob').then((blob) => putBlob(blob, path).then(() => undefined)))
        })
        await Promise.all(tasks)
      }
      useSystem.getState().importSnapshot(meta)
      useSystem.getState().toast('备份已恢复', '数据已合并到当前设备。', 'success')
    } catch (e) {
      useSystem.getState().toast('恢复失败', e instanceof Error ? e.message : '文件格式不正确', 'error')
    } finally {
      setBusy('')
      if (importRef.current) importRef.current.value = ''
    }
  }

  const reset = async () => {
    if (!confirm('确定重置演示数据？本地的文件和对话会被清空。')) return
    setBusy('reset')
    try {
      await clearBlobs()
      useSystem.getState().resetDemo()
      useSystem.getState().toast('已重置', '所有数据回到初始演示状态。', 'success')
    } finally { setBusy('') }
  }

  return (
    <div className="settings">
      <aside className="settings-side">
        <div className="settings-brand"><span className="settings-brand-icon"><Laptop size={16} /></span><div><strong>控制台</strong><span>STELLAR CONTROL</span></div></div>
        <nav>
          {TABS.map((t) => <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}><t.icon size={15} /><span><strong>{t.label}</strong><small>{t.note}</small></span></button>)}
        </nav>
        <div className="settings-side-foot"><span className="dot pulse" /> 本地节点在线<span className="mono">v0.1.0</span></div>
      </aside>
      <main className="settings-main scroll-y">
        {tab === 'appearance' && <Appearance />}
        {tab === 'ai' && <AIModels />}
        {tab === 'data' && <DataPanel usage={usage} busy={busy} onExport={exportBackup} onImport={() => importRef.current?.click()} onReset={reset} />}
        {tab === 'about' && <About />}
        <input ref={importRef} type="file" accept=".zip,application/zip" hidden onChange={(e) => importBackup(e.target.files?.[0])} />
      </main>
    </div>
  )
}

function Appearance() {
  const profile = useSystem((s) => s.profile)
  const preferences = useSystem((s) => s.preferences)
  const setProfile = useSystem((s) => s.setProfile)
  const setPreferences = useSystem((s) => s.setPreferences)
  const accents = [
    { id: 'aurora', label: '极光青', colors: ['#69e6ff', '#9b8cff'] },
    { id: 'violet', label: '星云紫', colors: ['#b9a4ff', '#ff8ad4'] },
    { id: 'amber', label: '日冕金', colors: ['#ffd37a', '#ff9f6b'] },
    { id: 'rose', label: '玫瑰粉', colors: ['#ff8fb8', '#b79bff'] },
  ] as const
  return (
    <div className="settings-page">
      <header><span className="sheet-eyebrow">APPEARANCE & IDENTITY</span><h1>外观与账户</h1><p>让星环看起来像你的空间。偏好保存在本机，不随账号同步。</p></header>
      <section className="settings-card">
        <div className="settings-card-head"><span className="section-title">身份</span><span className="chip"><Shield size={10} /> 本地账户</span></div>
        <div className="settings-profile">
          <Avatar name={profile.name} hue={profile.hue} size={54} round />
          <div className="settings-profile-fields">
            <div className="field"><UserRound size={13} /><input value={profile.name} onChange={(e) => setProfile({ name: e.target.value })} placeholder="显示名称" /></div>
            <div className="field"><span className="mono">@</span><input value={profile.handle} onChange={(e) => setProfile({ handle: e.target.value.replace(/\s/g, '').slice(0, 24) })} placeholder="handle" /></div>
          </div>
        </div>
        <label className="label">一句话介绍</label>
        <div className="field"><input value={profile.bio} onChange={(e) => setProfile({ bio: e.target.value })} /></div>
        <label className="label" style={{ marginTop: 10 }}>头像色相</label>
        <input type="range" min={0} max={360} value={profile.hue} onChange={(e) => setProfile({ hue: Number(e.target.value) })} style={{ '--progress': `${(profile.hue / 360) * 100}%` } as React.CSSProperties} />
      </section>

      <section className="settings-card">
        <div className="settings-card-head"><span className="section-title">强调色</span><span className="hint">全局生效</span></div>
        <div className="accent-grid">
          {accents.map((a) => (
            <button key={a.id} className={preferences.accent === a.id ? 'active' : ''} onClick={() => setPreferences({ accent: a.id })}>
              <span className="accent-swatch" style={{ background: `linear-gradient(135deg, ${a.colors[0]}, ${a.colors[1]})` }} />
              <strong>{a.label}</strong>
              {preferences.accent === a.id && <Check size={13} />}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card-head"><span className="section-title">桌面</span></div>
        <div className="setting-row"><div><strong>壁纸</strong><span>仅在桌面 Shell 显示</span></div><div className="segmented">{(['orbit', 'aurora', 'grid'] as const).map((w) => <button key={w} className={preferences.wallpaper === w ? 'active' : ''} onClick={() => setPreferences({ wallpaper: w })}>{w === 'orbit' ? '轨道' : w === 'aurora' ? '极光' : '网格'}</button>)}</div></div>
        <div className="setting-row"><div><strong>设备名称</strong><span>显示在本地节点与备份中</span></div><div className="field" style={{ width: 220, height: 31 }}><input value={preferences.deviceName} onChange={(e) => setPreferences({ deviceName: e.target.value })} /></div></div>
        <div className="setting-row"><div><strong>减少动效</strong><span>降低光晕与过渡动画</span></div><button className={`switch ${preferences.reduceMotion ? 'on' : ''}`} onClick={() => setPreferences({ reduceMotion: !preferences.reduceMotion })} /></div>
      </section>
    </div>
  )
}

function AIModels() {
  const providers = useSystem((s) => s.providers)
  const selected = useSystem((s) => s.selectedProviderId)
  const select = useSystem((s) => s.selectProvider)
  const update = useSystem((s) => s.updateProvider)
  const addProvider = useSystem((s) => s.addProvider)
  const [open, setOpen] = useState<string>(selected)
  const [visible, setVisible] = useState<Record<string, boolean>>({})
  const [testing, setTesting] = useState('')
  const [testResult, setTestResult] = useState<Record<string, string>>({})

  const addCustom = () => {
    const p: AIProvider = { id: `custom-${Date.now()}`, kind: 'openai', label: '自定义端点', baseUrl: 'https://api.example.com/v1', apiKey: '', model: 'gpt-4o-mini', models: ['gpt-4o-mini'], color: '#69e6ff' }
    addProvider(p)
    select(p.id)
    setOpen(p.id)
  }

  const test = async (p: AIProvider) => {
    setTesting(p.id)
    setTestResult((r) => ({ ...r, [p.id]: '' }))
    try {
      let out = ''
      await streamCompletion(p, [{ id: 'test', role: 'user', content: '请只回复：连接成功', time: nowIso() }], { system: '你是连接测试助手。', onDelta: (d) => { out += d } })
      setTestResult((r) => ({ ...r, [p.id]: `连接成功 · ${out.slice(0, 40) || 'OK'}` }))
    } catch (e) {
      setTestResult((r) => ({ ...r, [p.id]: `失败：${e instanceof Error ? e.message : '未知错误'}` }))
    } finally { setTesting('') }
  }

  return (
    <div className="settings-page">
      <header><span className="sheet-eyebrow">MODEL CONNECTIONS</span><h1>AI 模型</h1><p>接入任意 OpenAI 兼容端点、Anthropic、Gemini 或本地 Ollama。API Key 只保存在当前浏览器。</p></header>
      <div className="settings-ai-note"><KeyRound size={14} /><div><strong>密钥即配置</strong><span>生产环境建议自建服务端代理，避免把 Key 暴露给最终用户。此处的 Key 通过浏览器直连服务商。</span></div></div>
      <div className="provider-list">
        {providers.map((p) => (
          <section key={p.id} className={`provider-card ${selected === p.id ? 'current' : ''}`}>
            <button className="provider-head" onClick={() => setOpen(open === p.id ? '' : p.id)}>
              <span className="provider-dot" style={{ background: p.color }} />
              <span className="grow"><strong>{p.label}</strong><small>{p.kind === 'demo' ? '演示模式 · 无网络请求' : p.kind === 'ollama' ? '本地推理' : p.apiKey ? `已配置 · ${p.model}` : '未配置 API Key'}</small></span>
              {p.id === selected && <span className="chip green">当前</span>}
              <ChevronRight size={14} className={open === p.id ? 'rot' : ''} />
            </button>
            {open === p.id && (
              <div className="provider-body">
                <div className="provider-grid">
                  <div><label className="label">显示名称</label><div className="field"><input value={p.label} onChange={(e) => update(p.id, { label: e.target.value })} /></div></div>
                  <div><label className="label">模型</label><div className="field"><input value={p.model} onChange={(e) => update(p.id, { model: e.target.value })} list={`models-${p.id}`} /></div><datalist id={`models-${p.id}`}>{p.models.map((m) => <option key={m} value={m} />)}</datalist></div>
                  <div className="span-2"><label className="label">Base URL</label><div className="field"><input value={p.baseUrl} onChange={(e) => update(p.id, { baseUrl: e.target.value })} placeholder="https://api.example.com/v1" /></div></div>
                  <div className="span-2"><label className="label">API Key</label><div className="field"><KeyRound size={13} /><input type={visible[p.id] ? 'text' : 'password'} value={p.apiKey} onChange={(e) => update(p.id, { apiKey: e.target.value })} placeholder={p.kind === 'ollama' ? '本地 Ollama 通常无需 Key' : 'sk-…'} autoComplete="off" /><button className="icon-btn sm" onClick={() => setVisible((v) => ({ ...v, [p.id]: !v[p.id] }))}>{visible[p.id] ? <EyeOff size={12} /> : <Eye size={12} />}</button></div></div>
                </div>
                <div className="provider-models">{p.models.map((m) => <button key={m} className={p.model === m ? 'active' : ''} onClick={() => update(p.id, { model: m })}>{m}</button>)}</div>
                {testResult[p.id] && <div className={`provider-test ${testResult[p.id].startsWith('失败') ? 'error' : 'ok'}`}>{testResult[p.id]}</div>}
                <div className="provider-actions">
                  <button className="btn sm" onClick={() => test(p)} disabled={testing === p.id}>{testing === p.id ? <Loader2 size={12} className="spin" /> : <RefreshCcw size={12} />} 测试连接</button>
                  <button className="btn sm primary" onClick={() => { select(p.id); useSystem.getState().toast('已切换模型', `${p.label} · ${p.model}`, 'success') }}><Check size={12} /> 设为当前</button>
                  <span className="grow" />
                  <span className="hint">{p.kind === 'demo' ? '离线可用' : p.apiKey ? '浏览器直连' : '尚未配置'}</span>
                </div>
              </div>
            )}
          </section>
        ))}
      </div>
      <button className="btn provider-add" onClick={addCustom}><Plus size={14} /> 添加 OpenAI 兼容端点</button>
      <p className="settings-tip">CORS 提示：部分服务商不允许浏览器直连。若「测试连接」失败，可部署同源的 <code>/api/ai/proxy</code>，或使用 Ollama 并设置 <code>OLLAMA_ORIGINS</code>。</p>
    </div>
  )
}

function DataPanel({ usage, busy, onExport, onImport, onReset }: { usage: { usage: number; quota: number }; busy: string; onExport: () => void; onImport: () => void; onReset: () => void }) {
  const files = useSystem((s) => s.files)
  const chats = useSystem((s) => s.chats)
  const notebooks = useSystem((s) => s.notebooks)
  const totalSize = files.reduce((n, f) => n + f.size, 0)
  return (
    <div className="settings-page">
      <header><span className="sheet-eyebrow">LOCAL-FIRST DATA</span><h1>数据与迁移</h1><p>星环默认把数据留在你的设备。备份是一个包含元数据与 Blob 的 Zip，可在任意浏览器恢复。</p></header>
      <div className="data-stats">
        <div><Cloud size={16} /><strong>{files.filter((f) => f.kind === 'file' && !f.trashed).length}</strong><span>云巢文件</span></div>
        <div><FileJson size={16} /><strong>{totalSize ? formatBytes(totalSize) : '0 B'}</strong><span>文件体积</span></div>
        <div><Database size={16} /><strong>{chats.length}</strong><span>会话</span></div>
        <div><HardDrive size={16} /><strong>{notebooks.length}</strong><span>笔记本</span></div>
      </div>
      <section className="settings-card">
        <div className="settings-card-head"><span className="section-title">浏览器存储</span><span className="chip">{usage.quota ? `${((usage.usage / usage.quota) * 100).toFixed(1)}%` : '本地'}</span></div>
        <div className="storage-bar"><i style={{ width: `${usage.quota ? Math.min(100, (usage.usage / usage.quota) * 100) : 8}%` }} /></div>
        <div className="storage-labels"><span>已用 {formatBytes(usage.usage)}</span><span>配额 {usage.quota ? formatBytes(usage.quota) : '由浏览器管理'}</span></div>
        <p className="hint">清除浏览器站点数据会同时移除云巢与聊天记录。请定期导出备份。</p>
      </section>
      <section className="settings-card">
        <div className="settings-card-head"><span className="section-title">备份与恢复</span></div>
        <div className="data-actions">
          <button className="data-action" onClick={onExport} disabled={busy === 'export'}><span><Download size={17} /></span><strong>导出完整备份</strong><small>Zip · 含文件 Blob 与所有应用数据</small>{busy === 'export' && <Loader2 size={13} className="spin" />}</button>
          <button className="data-action" onClick={onImport} disabled={busy === 'import'}><span><Upload size={17} /></span><strong>从备份恢复</strong><small>合并到当前浏览器 · 覆盖同 ID 数据</small>{busy === 'import' && <Loader2 size={13} className="spin" />}</button>
        </div>
        <p className="hint">备份包含 API Key 配置。分享备份前请从「AI 模型」中清除密钥。</p>
      </section>
      <section className="settings-card danger-zone">
        <div className="settings-card-head"><span className="section-title">危险区域</span></div>
        <div className="setting-row"><div><strong>重置演示数据</strong><span>清空本机所有文件、会话、笔记并恢复初始内容</span></div><button className="btn danger sm" onClick={onReset} disabled={busy === 'reset'}><Trash2 size={12} /> 重置</button></div>
      </section>
    </div>
  )
}

function About() {
  const openApp = useSystem((s) => s.openApp)
  const files = useSystem((s) => s.files)
  return (
    <div className="settings-page">
      <header><span className="sheet-eyebrow">OPEN SOURCE · APACHE-2.0</span><h1>关于星环</h1><p>一个开源、本地优先、可自托管的个人数字生态。没有厂商锁定，没有私有格式。</p></header>
      <section className="about-hero">
        <span className="about-logo"><Sparkles size={26} /></span>
        <div><strong>星环 Stellar</strong><span>v0.1.0 · 全生态工作空间</span><p>12 个应用共享同一套窗口管理、文件系统、事件总线与身份。浏览器、PWA、Docker 与桌面壳共用一份代码。</p></div>
      </section>
      <div className="about-grid">
        <section className="settings-card"><div className="settings-card-head"><span className="section-title">开源许可</span></div><p className="about-text">本项目以 <strong>Apache License 2.0</strong> 开源。你可以自由使用、修改、分发与商业部署，需保留版权与许可声明。</p><button className="btn sm" onClick={() => openApp('editor', { fileId: files.find((f) => f.id === 'file-license')?.id })}>阅读许可与第三方声明 <ChevronRight size={12} /></button></section>
        <section className="settings-card"><div className="settings-card-head"><span className="section-title">技术栈</span></div><div className="about-tags">{['React 19', 'Vite', 'TypeScript', 'Zustand', 'CodeMirror 6', 'WebRTC', 'Node.js', 'ws', 'jsPDF', 'Tesseract.js', 'IndexedDB', 'PWA'].map((t) => <span key={t}>{t}</span>)}</div></section>
      </div>
      <section className="settings-card"><div className="settings-card-head"><span className="section-title">边界与致谢</span></div><p className="about-text">星环与微信、腾讯会议、ToDesk、扫描全能王无任何关联。界面与交互只作功能参考，未使用其商标、图标或私有资源。所有演示图片由代码实时生成。感谢所有开源依赖的作者。</p><div className="about-legal"><span><Shield size={11} /> Apache-2.0</span><span><Info size={11} /> 无遥测</span><span><Cloud size={11} /> 可自托管</span></div></section>
      <section className="settings-card"><div className="settings-card-head"><span className="section-title">生态互操作</span></div><p className="about-text">通过统一的 <code>ecosystem</code> SDK，任意应用都能调用 <code>open()</code>、<code>share()</code>、<code>saveFile()</code>、<code>askAI()</code> 与 <code>notify()</code>。这是星环区别于“应用合集”的核心。</p></section>
    </div>
  )
}
