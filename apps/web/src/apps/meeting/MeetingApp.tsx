import {
  Check,
  Clipboard,
  Clock3,
  Copy,
  Link2,
  LogOut,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  Radio,
  ScreenShare,
  Settings2,
  Share2,
  Square,
  Users,
  Video,
  VideoOff,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { AppProps } from '../../components/AppRenderer'
import { Avatar } from '../../components/Avatar'
import { ecosystem } from '../../core/ecosystem'
import { useSystem } from '../../core/store'
import { formatDuration, relativeTime } from '../../core/utils'
import { useMeeting, type PeerView } from './useMeeting'

export default function MeetingApp({ params }: AppProps) {
  const profile = useSystem((s) => s.profile)
  const meetings = useSystem((s) => s.meetings)
  const toast = useSystem((s) => s.toast)
  const m = useMeeting()
  const [panel, setPanel] = useState<'chat' | 'people' | null>(null)
  const [chat, setChat] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [copied, setCopied] = useState(false)
  const chatEnd = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    m.setDisplayName(profile.name)
    if (params.room) m.setRoom(String(params.room).toUpperCase())
    else if (params.create) m.setRoom(m.generateCode())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!m.inRoom) { setElapsed(0); return }
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [m.inRoom])

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: 'end' })
  }, [m.messages.length, panel])

  const copyInvite = async () => {
    const text = `星环会客厅 · 房间号 ${m.room}\n${location.origin}${location.pathname}#meeting?room=${m.room}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
      toast('邀请已复制', `房间 ${m.room} · 把它发给星讯联系人`, 'success')
    } catch {
      toast('复制失败', text, 'error')
    }
  }

  const join = () => {
    if (!m.displayName.trim()) return toast('请输入昵称', undefined, 'error')
    if (!m.room.trim()) return toast('请输入房间号', undefined, 'error')
    m.join(m.displayName, m.room)
  }

  if (!m.inRoom) {
    return (
      <div className="meet">
        <div className="meet-lobby">
          <div className="meet-lobby-left">
            <div className="meet-brand"><span className="meet-brand-icon"><Video size={18} /></span><div><strong>会客厅</strong><span>ORBIT MEET · WEBRTC</span></div></div>
            <div className="meet-lobby-copy">
              <span className="sheet-eyebrow">REAL-TIME · PEER TO PEER</span>
              <h1>距离，<br />只是一个房间号。</h1>
              <p>多人音视频、屏幕共享、聊天与云端录制。基于 WebRTC 点对点传输，媒体流不经过业务服务器。</p>
            </div>
            <div className="meet-form">
              <label className="label">你的昵称</label>
              <div className="field"><Avatar name={m.displayName || profile.name} hue={profile.hue} size={22} round /><input value={m.displayName} onChange={(e) => m.setDisplayName(e.target.value)} placeholder="显示名称" /></div>
              <label className="label" style={{ marginTop: 9 }}>房间号</label>
              <div className="meet-room-row">
                <div className="field grow"><span className="mono meet-room-prefix">STL</span><input value={m.room} onChange={(e) => m.setRoom(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12))} placeholder="2048" /></div>
                <button className="btn" onClick={() => m.setRoom(m.generateCode())}>随机</button>
              </div>
              <div className="meet-pretoggles">
                <button className={m.micOn ? 'on' : ''} onClick={m.toggleMic}>{m.micOn ? <Mic size={15} /> : <MicOff size={15} />}<span>{m.micOn ? '麦克风已开' : '麦克风关闭'}</span></button>
                <button className={m.camOn ? 'on' : ''} onClick={m.toggleCam}>{m.camOn ? <Video size={15} /> : <VideoOff size={15} />}<span>{m.camOn ? '摄像头已开' : '摄像头关闭'}</span></button>
              </div>
              {m.error && <div className="meet-error">{m.error}</div>}
              <button className="btn primary lg meet-join" onClick={join} disabled={m.joining}>
                {m.joining ? <span className="spinner" style={{ width: 15, height: 15 }} /> : <ArrowEnter />}
                {m.joining ? '正在连接信令…' : '加入会客厅'}
              </button>
              <div className="meet-lobby-meta"><span><Wifi size={11} /> WebRTC · 端到端媒体</span><span><Radio size={11} /> 最多 8 人</span><span><Clock3 size={11} /> 本地录制</span></div>
            </div>
            {meetings.length > 0 && (
              <div className="meet-recent">
                <div className="section-title">最近的会议</div>
                {meetings.slice(0, 2).map((r) => (
                  <button key={r.id} onClick={() => { m.setRoom(r.code); document.querySelector<HTMLInputElement>('.meet-form input[placeholder="2048"]')?.focus() }}>
                    <span className="meet-recent-icon"><Video size={14} /></span>
                    <span className="grow"><strong>{r.title}</strong><small>{relativeTime(r.startedAt)} · {formatDuration(r.duration)} · {r.participants} 人</small></span>
                    <span className="chip">{r.code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="meet-lobby-preview">
            <div className="meet-preview-card">
              <div className="meet-preview-glow" />
              <div className="meet-preview-head"><span className="chip green"><span className="dot pulse" /> 预览</span><span className="mono">{m.room || 'STL-____'}</span></div>
              <div className="meet-preview-video">
                <MediaPreview stream={m.localStream} muted />
                {!m.localStream?.getVideoTracks().length && (
                  <div className="meet-preview-avatar"><Avatar name={m.displayName || profile.name} hue={profile.hue} size={92} round /><strong>{m.displayName || profile.name}</strong><span>{m.mediaReady ? '摄像头未开启 · 以头像加入' : '正在请求摄像头…'}</span></div>
                )}
                <div className="meet-preview-self">我 · 本地预览</div>
              </div>
              <div className="meet-preview-features">
                <div><MonitorUp size={14} /><span>屏幕共享</span></div>
                <div><MessageSquare size={14} /><span>房间聊天</span></div>
                <div><Radio size={14} /><span>本地录制</span></div>
                <div><Link2 size={14} /><span>一键邀请</span></div>
              </div>
            </div>
            <div className="meet-orbit orbit-one" /><div className="meet-orbit orbit-two" />
            <div className="meet-lobby-foot"><span className="dot pulse" /> 信令节点 {location.host}/ws</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="meet meet-room">
      <header className="meet-room-head">
        <div className="meet-room-title">
          <span className="meet-live"><span className="dot pulse" /> LIVE</span>
          <div><strong>星环评审会</strong><span>房间 {m.room} · {m.connected ? '已连接' : '连接中断'}</span></div>
        </div>
        <div className="meet-head-center">
          <span className="meet-timer"><Clock3 size={11} /> {formatDuration(elapsed)}</span>
          {m.recording && <span className="meet-rec"><span className="rec-dot" /> REC</span>}
          <span className={m.connected ? 'meet-status online' : 'meet-status'}>{m.connected ? <Wifi size={11} /> : <WifiOff size={11} />}{m.connected ? `${m.peers.length + 1} 人在线` : '信令断开'}</span>
        </div>
        <div className="meet-head-actions">
          <span className="meet-code" onClick={copyInvite}>{m.room} <Copy size={11} /></span>
          <button className="btn sm" onClick={copyInvite}>{copied ? <Check size={12} /> : <Share2 size={12} />}{copied ? '已复制' : '邀请'}</button>
        </div>
      </header>

      {m.error && <div className="meet-banner">{m.error}<button onClick={() => m.setError('')}><X size={12} /></button></div>}

      <div className="meet-room-body">
        <div className="meet-grid-wrap">
          <div className={`meet-grid count-${Math.min(6, m.peers.length + 1)}`}>
            <VideoTile name={m.displayName || '我'} stream={m.screenStream ?? m.localStream} self muted={!m.sharing} mic={m.micOn} cam={m.camOn || m.sharing} sharing={m.sharing} />
            {m.peers.map((p) => <VideoTile key={p.id} name={p.name} stream={p.stream} mic={p.mic} cam={p.cam} connection={p.connection} />)}
            {m.peers.length === 0 && (
              <button className="meet-wait-tile" onClick={copyInvite}>
                <span className="meet-wait-orbs"><span /><span /><span /></span>
                <strong>等待其他人加入</strong>
                <p>复制房间号 <b>{m.room}</b>，或把邀请发给星讯联系人。</p>
                <span className="btn sm"><Link2 size={12} /> 复制邀请链接</span>
              </button>
            )}
          </div>
          <div className="meet-room-foot">
            <span><span className="dot pulse" /> 媒体流通过 WebRTC 点对点传输</span>
            <span>STUN: Cloudflare / Google · 自托管时可配置 TURN</span>
          </div>
        </div>

        {panel && (
          <aside className="meet-panel">
            <header><div className="segmented"><button className={panel === 'chat' ? 'active' : ''} onClick={() => setPanel('chat')}><MessageSquare size={12} /> 聊天</button><button className={panel === 'people' ? 'active' : ''} onClick={() => setPanel('people')}><Users size={12} /> 成员</button></div><button className="icon-btn sm" onClick={() => setPanel(null)}><X size={14} /></button></header>
            {panel === 'chat' ? (
              <>
                <div className="meet-chat scroll-y">
                  {m.messages.map((msg) => msg.from === 'system' ? (
                    <div key={msg.id} className="meet-chat-system">{msg.text}</div>
                  ) : (
                    <div key={msg.id} className={`meet-chat-msg ${msg.from === m.selfId ? 'mine' : ''}`}>
                      <span className="meet-chat-name">{msg.from === m.selfId ? '我' : msg.name} · {new Date(msg.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                      <p>{msg.text}</p>
                    </div>
                  ))}
                  <div ref={chatEnd} />
                </div>
                <div className="meet-chat-input">
                  <input value={chat} onChange={(e) => setChat(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && chat.trim()) { m.sendChat(chat); setChat('') } }} placeholder="发送消息…" />
                  <button onClick={() => { if (chat.trim()) { m.sendChat(chat); setChat('') } }}><SendIcon /></button>
                </div>
              </>
            ) : (
              <div className="meet-people scroll-y">
                <div className="meet-person"><Avatar name={m.displayName || profile.name} hue={profile.hue} size={34} round /><span className="grow"><strong>{m.displayName || profile.name}（我）</strong><small>主持人 · 本地</small></span><span className="meet-person-state">{m.micOn ? <Mic size={12} /> : <MicOff size={12} />}{m.camOn ? <Video size={12} /> : <VideoOff size={12} />}</span></div>
                {m.peers.map((p) => <div className="meet-person" key={p.id}><Avatar name={p.name} hue={200} size={34} round /><span className="grow"><strong>{p.name}</strong><small>{p.connection === 'connected' ? '已连接' : p.connection}</small></span><span className="meet-person-state">{p.mic ? <Mic size={12} /> : <MicOff size={12} />}{p.cam ? <Video size={12} /> : <VideoOff size={12} />}</span></div>)}
              </div>
            )}
          </aside>
        )}
      </div>

      <footer className="meet-toolbar">
        <button className={`meet-tool ${m.micOn ? '' : 'off'}`} onClick={m.toggleMic}><span>{m.micOn ? <Mic size={19} /> : <MicOff size={19} />}</span><small>{m.micOn ? '静音' : '取消静音'}</small></button>
        <button className={`meet-tool ${m.camOn ? '' : 'off'}`} onClick={m.toggleCam}><span>{m.camOn ? <Video size={19} /> : <VideoOff size={19} />}</span><small>{m.camOn ? '关闭视频' : '开启视频'}</small></button>
        <button className={`meet-tool ${m.sharing ? 'active' : ''}`} onClick={m.toggleShare}><span><MonitorUp size={19} /></span><small>{m.sharing ? '停止共享' : '共享屏幕'}</small></button>
        <button className={`meet-tool ${panel === 'chat' ? 'active' : ''}`} onClick={() => setPanel((p) => (p === 'chat' ? null : 'chat'))}><span><MessageSquare size={19} /></span><small>聊天</small></button>
        <button className={`meet-tool ${panel === 'people' ? 'active' : ''}`} onClick={() => setPanel((p) => (p === 'people' ? null : 'people'))}><span><Users size={19} /></span><small>成员</small></button>
        <button className={`meet-tool ${m.recording ? 'recording' : ''}`} onClick={m.toggleRecording}><span>{m.recording ? <Square size={16} fill="currentColor" /> : <Radio size={19} />}</span><small>{m.recording ? '停止录制' : '录制'}</small></button>
        <button className="meet-tool leave" onClick={m.leave}><span><LogOut size={19} /></span><small>离开</small></button>
      </footer>
    </div>
  )
}

function MediaPreview({ stream, muted = false }: { stream: MediaStream | null; muted?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream
  }, [stream])
  return <video ref={ref} autoPlay playsInline muted={muted} className="meet-preview-video-el" />
}

function VideoTile({ name, stream, self, muted, mic, cam, sharing, connection }: { name: string; stream: MediaStream | null; self?: boolean; muted?: boolean; mic: boolean; cam: boolean; sharing?: boolean; connection?: RTCPeerConnectionState }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [hasVideo, setHasVideo] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    ref.current.srcObject = stream
    const check = () => setHasVideo(Boolean(stream && stream.getVideoTracks().some((t) => t.readyState === 'live' && t.enabled)))
    check()
    const t = setInterval(check, 1200)
    return () => clearInterval(t)
  }, [stream])
  return (
    <div className={`meet-tile ${hasVideo && cam ? 'has-video' : ''}`}>
      <video ref={ref} autoPlay playsInline muted={muted} className="meet-tile-video" />
      {(!hasVideo || !cam) && (
        <div className="meet-tile-avatar"><Avatar name={name} hue={self ? 204 : 250} size={64} round /><strong>{name}</strong><span>{cam ? '视频加载中…' : '摄像头已关闭'}</span></div>
      )}
      <div className="meet-tile-bar">
        <span className="meet-tile-name">{name}{self ? '（我）' : ''}{sharing ? ' · 共享中' : ''}</span>
        <span className="meet-tile-icons">{mic ? <Mic size={11} /> : <MicOff size={11} />}{cam || sharing ? <Video size={11} /> : <VideoOff size={11} />}</span>
      </div>
      {!self && connection && connection !== 'connected' && <span className="meet-tile-connecting">{connection === 'connecting' ? '连接中…' : connection}</span>}
      {self && <span className="meet-tile-self">本地</span>}
    </div>
  )
}

function ArrowEnter() {
  return <Video size={15} />
}
function SendIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
}
