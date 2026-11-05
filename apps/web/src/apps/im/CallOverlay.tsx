import { Mic, MicOff, MonitorUp, PhoneOff, Share2, SwitchCamera, Video, VideoOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ecosystem } from '../../core/ecosystem'
import type { Chat } from '../../core/types'
import { formatDuration } from '../../core/utils'
import { Avatar } from '../../components/Avatar'

export function CallOverlay({ chat, kind, onClose }: { chat: Chat; kind: 'voice' | 'video'; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const screenRef = useRef<MediaStream | null>(null)
  const started = useRef(Date.now())
  const [seconds, setSeconds] = useState(0)
  const [muted, setMuted] = useState(false)
  const [cameraOn, setCameraOn] = useState(kind === 'video')
  const [sharing, setSharing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ended, setEnded] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started.current) / 1000)), 1000)
    let active = true
    navigator.mediaDevices
      ?.getUserMedia({ audio: true, video: kind === 'video' ? { facingMode: 'user', width: 1280, height: 720 } : false })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setMuted(!stream.getAudioTracks().length)
        setCameraOn(stream.getVideoTracks().length > 0)
      })
      .catch((e) => {
        setError(e?.name === 'NotAllowedError' ? '未获得摄像头 / 麦克风权限' : '无法访问媒体设备')
        setMuted(true)
        setCameraOn(false)
      })
    return () => {
      active = false
      clearInterval(timer)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      screenRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [kind])

  const hangup = () => {
    if (ended) return
    setEnded(true)
    const duration = Math.floor((Date.now() - started.current) / 1000)
    useSystemSend(chat.id, duration, kind)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    screenRef.current?.getTracks().forEach((t) => t.stop())
    onClose()
  }

  const toggleMute = () => {
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = muted))
    setMuted((v) => !v)
  }

  const toggleCamera = () => {
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = !cameraOn))
    setCameraOn((v) => !v)
  }

  const shareScreen = async () => {
    try {
      if (sharing) {
        screenRef.current?.getTracks().forEach((t) => t.stop())
        screenRef.current = null
        if (videoRef.current) videoRef.current.srcObject = streamRef.current
        setSharing(false)
        return
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
      screenRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      stream.getVideoTracks()[0].onended = () => {
        setSharing(false)
        if (videoRef.current) videoRef.current.srcObject = streamRef.current
      }
      setSharing(true)
    } catch {
      ecosystem.toast('未共享屏幕', '你取消了屏幕共享。', 'info')
    }
  }

  const upgrade = () => {
    const room = `CALL-${chat.name.slice(0, 2).toUpperCase()}`
    ecosystem.startMeeting(room)
    ecosystem.toast('已创建会客厅', `房间 ${room} · 可以把链接发给对方`, 'success')
    onClose()
  }

  return (
    <div className={`call-overlay ${kind}`}>
      <div className="call-bg">
        <div className="call-aurora" />
        <div className="call-grid" />
      </div>
      <header className="call-head">
        <div className="chip"><span className="dot pulse" /> {kind === 'video' ? '视频通话' : '语音通话'} · 演示通道</div>
        <div className="call-timer">{formatDuration(seconds)}</div>
        <button className="icon-btn" onClick={hangup} aria-label="关闭"><PhoneOff size={16} /></button>
      </header>
      <div className="call-stage">
        {kind === 'video' ? (
          <div className="call-video-wrap">
            <video ref={videoRef} autoPlay muted playsInline className="call-video" />
            {!cameraOn && !sharing && (
              <div className="call-video-fallback">
                <Avatar name={chat.name} hue={chat.avatarHue} size={102} round />
                <strong>摄像头已关闭</strong>
                <span>{error ?? '点击下方按钮重新开启'}</span>
              </div>
            )}
            {sharing && <div className="call-screen-tag"><MonitorUp size={14} /> 正在共享屏幕</div>}
            <div className="call-pip">
              <Avatar name={chat.name} hue={chat.avatarHue} size={44} round online={chat.online} />
              <div><strong>{chat.name}</strong><span>{chat.type === 'group' ? '群聊 · 3 人' : '对方尚未加入演示通道'}</span></div>
            </div>
            <div className="call-self-tag">我 · 本地预览</div>
          </div>
        ) : (
          <div className="call-audio-stage">
            <div className="call-avatar-rings">
              <span className="ring r1" /><span className="ring r2" /><span className="ring r3" />
              <Avatar name={chat.name} hue={chat.avatarHue} size={122} round online={chat.online} />
            </div>
            <h2>{chat.name}</h2>
            <p>{error ?? (chat.online ? '正在等待对方加入 · 媒体已就绪' : '对方当前离线 · 本地演示')}</p>
            <div className="call-wavebars" aria-hidden>
              {Array.from({ length: 28 }).map((_, i) => <i key={i} style={{ animationDelay: `${i * 55}ms`, height: `${18 + ((i * 13) % 32)}%` }} />)}
            </div>
          </div>
        )}
      </div>
      <footer className="call-controls">
        <button className={`call-ctrl ${muted ? 'off' : ''}`} onClick={toggleMute}><span>{muted ? <MicOff size={20} /> : <Mic size={20} />}</span><small>{muted ? '取消静音' : '静音'}</small></button>
        {kind === 'video' && <button className={`call-ctrl ${!cameraOn ? 'off' : ''}`} onClick={toggleCamera}><span>{cameraOn ? <Video size={20} /> : <VideoOff size={20} />}</span><small>{cameraOn ? '关闭视频' : '开启视频'}</small></button>}
        <button className={`call-ctrl ${sharing ? 'active' : ''}`} onClick={shareScreen}><span><MonitorUp size={20} /></span><small>{sharing ? '停止共享' : '共享屏幕'}</small></button>
        <button className="call-ctrl" onClick={upgrade}><span><Share2 size={20} /></span><small>升级为会议</small></button>
        <button className="call-ctrl" onClick={() => ecosystem.toast('切换摄像头', '多摄像头切换在桌面壳中可用。', 'info')}><span><SwitchCamera size={20} /></span><small>切换镜头</small></button>
        <button className="call-ctrl hangup" onClick={hangup}><span><PhoneOff size={21} /></span><small>挂断</small></button>
      </footer>
      <div className="call-note">浏览器的媒体权限仅用于本地预览。真正的一对一通话请在「会客厅」创建房间并邀请对方加入。</div>
    </div>
  )
}

function useSystemSend(chatId: string, duration: number, kind: 'voice' | 'video') {
  import('../../core/store').then(({ useSystem }) => {
    if (duration < 2) return
    const msg = useSystem.getState().sendMessage(chatId, {
      senderId: 'me',
      kind: 'call',
      callKind: kind,
      duration,
      text: kind === 'video' ? '视频通话' : '语音通话',
      status: 'read',
    })
    return msg
  })
}
