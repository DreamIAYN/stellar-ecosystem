import {
  ArrowRight,
  Check,
  Clipboard,
  Copy,
  Download,
  Eye,
  Keyboard,
  Link2,
  Lock,
  Maximize,
  Monitor,
  MonitorSmartphone,
  MousePointer2,
  Power,
  Radio,
  Send,
  Settings2,
  Shield,
  ShieldCheck,
  UserRound,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { AppProps } from '../../components/AppRenderer'
import { ecosystem } from '../../core/ecosystem'
import { useSystem } from '../../core/store'
import { cn, downloadBlob, formatDuration, randomCode } from '../../core/utils'
import { useRemote } from './useRemote'

export default function RemoteApp(_props: AppProps) {
  const r = useRemote()
  const toast = useSystem((s) => s.toast)
  const [mode, setMode] = useState<'host' | 'controller'>('host')
  const [session, setSession] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [copied, setCopied] = useState(false)
  const [clip, setClip] = useState('')
  const hostVideo = useRef<HTMLVideoElement>(null)
  const remoteVideo = useRef<HTMLVideoElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef(false)

  useEffect(() => {
    activeRef.current = r.stage === 'connected' || r.stage === 'waiting' || r.stage === 'sharing'
    if (!activeRef.current) { setElapsed(0); return }
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [r.stage])

  useEffect(() => {
    if (hostVideo.current && r.screen) hostVideo.current.srcObject = r.screen
  }, [r.screen])

  useEffect(() => {
    if (remoteVideo.current && r.remoteStream) remoteVideo.current.srcObject = r.remoteStream
  }, [r.remoteStream])

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
      toast('已复制', text, 'success')
    } catch { toast('复制失败', undefined, 'error') }
  }

  const begin = () => {
    const code = (session || randomCode(4)).toUpperCase()
    setSession(code)
    if (mode === 'host') r.startHost(code)
    else r.startController(code)
  }

  const screenshot = () => {
    const video = mode === 'host' ? hostVideo.current : remoteVideo.current
    if (!video || !video.videoWidth) return toast('暂无画面', '还没有可截取的视频流。', 'error')
    const c = document.createElement('canvas')
    c.width = video.videoWidth
    c.height = video.videoHeight
    c.getContext('2d')!.drawImage(video, 0, 0)
    c.toBlob(async (blob) => {
      if (!blob) return
      const saved = await ecosystem.saveFile({ name: `远程截图-${r.code}-${Date.now()}.png`, mime: 'image/png', blob, folderName: '图片', sourceApp: 'remote', tags: ['远程'] })
      downloadBlob(blob, saved.name)
      toast('截图已保存', '同时写入云巢「图片」。', 'success')
    }, 'image/png')
  }

  const onRemoteMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!r.isController || r.stage !== 'connected') return
    const rect = e.currentTarget.getBoundingClientRect()
    r.sendPointer(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)), Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)))
  }

  const idle = r.stage === 'idle' || r.stage === 'error'

  return (
    <div className="remote">
      <header className="remote-head">
        <div className="remote-brand"><span className="remote-brand-icon"><MonitorSmartphone size={18} /></span><div><strong>远界</strong><span>REMOTE DESK · P2P</span></div></div>
        <div className="remote-status">
          <span className={cn('chip', r.connected ? 'green' : '')}><span className={cn('dot', !r.connected && 'off')} /> {r.connected ? 'P2P 已连接' : r.stage === 'idle' ? '未连接' : '等待对端'}</span>
          <span className="chip"><Lock size={10} /> DTLS 加密</span>
          {!idle && <span className="remote-timer mono">{formatDuration(elapsed)}</span>}
        </div>
        <div className="remote-head-actions">
          {!idle && <button className="btn sm" onClick={screenshot}><Download size={12} /> 截图</button>}
          {!idle && <button className="btn sm" onClick={r.stop}><Power size={12} /> 结束会话</button>}
        </div>
      </header>

      {idle ? (
        <div className="remote-setup">
          <div className="remote-setup-left">
            <span className="sheet-eyebrow">REMOTE ASSISTANCE · ZERO TRUST</span>
            <h1>把屏幕递过去，<br />像坐在他身边。</h1>
            <p>被控端主动共享屏幕，控制端通过加密的 WebRTC 数据通道同步指针、剪贴板与操作指令。会话码就是唯一入口。</p>
            <div className="remote-role-tabs">
              <button className={mode === 'host' ? 'active' : ''} onClick={() => setMode('host')}><Monitor size={16} /><span><strong>我要共享屏幕</strong><small>被控端 · 请求权限</small></span></button>
              <button className={mode === 'controller' ? 'active' : ''} onClick={() => setMode('controller')}><MousePointer2 size={16} /><span><strong>我要控制设备</strong><small>控制端 · 输入会话码</small></span></button>
            </div>
            <label className="label">{mode === 'host' ? '设置本次会话码' : '输入对方的会话码'}</label>
            <div className="remote-code-row">
              <div className="field grow"><span className="remote-code-prefix">R</span><input value={session} onChange={(e) => setSession(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))} placeholder={mode === 'host' ? '留空自动生成' : '例如 7K2M'} /></div>
              {mode === 'host' && <button className="btn" onClick={() => setSession(randomCode(4).toUpperCase())}>随机</button>}
              <button className="btn primary" onClick={begin}>{mode === 'host' ? <><Monitor size={14} /> 开始共享</> : <><ArrowRight size={14} /> 连接会话</>}</button>
            </div>
            {r.error && <div className="remote-error">{r.error}</div>}
            <div className="remote-note"><Shield size={12} /><span>浏览器安全限制：Web 版可同步画面、指针与剪贴板，实际系统级键鼠注入需安装桌面代理。所有会话默认点对点，不经过业务服务器。</span></div>
            <div className="remote-steps">
              <div><span>01</span><strong>共享</strong><p>被控端选择窗口或整屏</p></div>
              <div><span>02</span><strong>授权</strong><p>确认会话码与权限</p></div>
              <div><span>03</span><strong>协助</strong><p>指针、剪贴板与截图</p></div>
            </div>
          </div>
          <div className="remote-setup-right">
            <div className="remote-visual">
              <div className="remote-screen-mock">
                <div className="remote-screen-bar"><span /><span /><span /><em>被控端 · 屏幕预览</em></div>
                <div className="remote-screen-content">
                  <div className="remote-mock-side" />
                  <div className="remote-mock-main"><span /><span /><span /><span /><div className="remote-mock-cards"><i /><i /><i /></div><div className="remote-mock-chart"><b style={{ height: '34%' }} /><b style={{ height: '58%' }} /><b style={{ height: '42%' }} /><b style={{ height: '76%' }} /><b style={{ height: '62%' }} /><b style={{ height: '88%' }} /></div></div>
                </div>
                <div className="remote-cursor-demo"><MousePointer2 size={15} fill="currentColor" /><span>控制端指针</span></div>
                <div className="remote-permission-pop"><ShieldCheck size={13} /><span><strong>等待授权</strong><small>对方确认后才可查看画面</small></span></div>
              </div>
              <div className="remote-float-card"><Lock size={12} /><span>端到端加密<br /><small>DTLS / SRTP</small></span></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="remote-session">
          <div className="remote-stage" ref={stageRef} onPointerMove={onRemoteMove} onClick={() => r.isController && r.sendKey('click')} onDoubleClick={() => stageRef.current?.requestFullscreen?.().catch(() => {})}>
            {r.role === 'host' ? (
              <>
                <video ref={hostVideo} autoPlay muted playsInline className="remote-video" />
                {!r.screen && <div className="remote-placeholder"><Monitor size={34} /><strong>正在等待屏幕共享…</strong><span>请在浏览器弹窗中选择要共享的窗口</span></div>}
                {r.cursor.visible && <div className="remote-remote-cursor" style={{ left: `${r.cursor.x * 100}%`, top: `${r.cursor.y * 100}%` }}><MousePointer2 size={22} fill="currentColor" /><span>控制端</span></div>}
                {r.stage === 'waiting' && (
                  <div className="remote-waiting-overlay">
                    <div className="remote-waiting-orb"><Radio size={22} /></div>
                    <span className="sheet-eyebrow">SESSION READY</span>
                    <h2>把会话码发给对方</h2>
                    <button className="remote-big-code" onClick={() => copy(`R-${r.code}`)}>{r.code} <Copy size={14} /></button>
                    <p>对方在「远界 → 我要控制设备」中输入这个码，即可请求查看。</p>
                    <span className="remote-share-link" onClick={() => copy(`星环远界会话码：${r.code}\n${location.origin}${location.pathname}#remote`)}><Link2 size={12} /> 复制邀请链接</span>
                  </div>
                )}
                <div className="remote-stage-badge"><span className="dot pulse" /> 被控端 · 共享中</div>
              </>
            ) : (
              <>
                <video ref={remoteVideo} autoPlay playsInline className="remote-video" />
                {!r.remoteStream && (
                  <div className="remote-placeholder"><MonitorSmartphone size={34} /><strong>{r.stage === 'sharing' ? '正在建立 P2P 通道…' : '等待被控端画面'}</strong><span>会话码 {r.code} · 加密传输</span>{r.stage === 'sharing' && <span className="spinner" />}</div>
                )}
                {r.remoteStream && <div className="remote-control-hint"><MousePointer2 size={12} /> 移动指针即可同步控制位置 · 双击全屏</div>}
                <div className="remote-stage-badge controller"><span className="dot pulse" /> 控制端 · {r.remoteStream ? '画面已连接' : '连接中'}</div>
                <button className="remote-fullscreen" onClick={() => stageRef.current?.requestFullscreen?.().catch(() => {})}><Maximize size={15} /></button>
              </>
            )}
          </div>

          <aside className="remote-panel">
            <div className="remote-panel-section">
              <span className="section-title">会话</span>
              <div className="remote-session-code"><span>R-{r.code}</span><button onClick={() => copy(`R-${r.code}`)}>{copied ? <Check size={12} /> : <Copy size={12} />}</button></div>
              <div className="remote-kv"><span>角色</span><strong>{r.role === 'host' ? '被控端' : '控制端'}</strong></div>
              <div className="remote-kv"><span>对端</span><strong>{r.peerName || '等待加入'}</strong></div>
              <div className="remote-kv"><span>延迟</span><strong>{r.latency !== null ? `${r.latency} ms` : '—'}</strong></div>
              <div className="remote-kv"><span>安全</span><strong className="green"><ShieldCheck size={10} /> DTLS</strong></div>
            </div>

            {r.role === 'host' && (
              <div className="remote-panel-section">
                <div className="remote-toggle-row"><div><strong>允许远程指针</strong><span>同步控制端的鼠标位置</span></div><button className={cn('switch', r.allowControl && 'on')} onClick={() => r.setAllowControl((v) => !v)} /></div>
                <div className="remote-toggle-row"><div><strong>允许键盘指令</strong><span>仅记录，不注入系统</span></div><button className="switch" /></div>
                <p className="hint">安装 Stellar Desktop Agent 后，这些指令会通过本机 IPC 注入系统键鼠。</p>
              </div>
            )}

            <div className="remote-panel-section">
              <span className="section-title">剪贴板</span>
              <textarea className="textarea remote-clip" value={clip} onChange={(e) => setClip(e.target.value)} placeholder="把文本发送到对端剪贴板…" rows={3} />
              <button className="btn sm" onClick={() => { if (clip.trim()) { r.shareClipboard(clip.trim()); setClip('') } }}><Send size={12} /> 发送剪贴板</button>
              {r.receivedClipboard && <div className="remote-received"><span>收到：</span><p>{r.receivedClipboard}</p></div>}
            </div>

            <div className="remote-panel-section remote-log-section">
              <span className="section-title">活动</span>
              <div className="remote-log scroll-y">
                {r.log.map((l) => <div key={l.id} className={cn('remote-log-item', l.kind)}><span className="mono">{l.time}</span><p>{l.text}</p></div>)}
                {r.log.length === 0 && <div className="hint">会话事件会显示在这里。</div>}
              </div>
            </div>

            <button className="btn danger remote-end" onClick={r.stop}><Power size={13} /> 结束远程会话</button>
          </aside>
        </div>
      )}
    </div>
  )
}
