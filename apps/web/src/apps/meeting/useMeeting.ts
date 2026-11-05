import { useEffect, useRef, useState } from 'react'
import { ecosystem } from '../../core/ecosystem'
import { useSystem } from '../../core/store'
import { randomCode, uid } from '../../core/utils'

export interface PeerView {
  id: string
  name: string
  stream: MediaStream | null
  mic: boolean
  cam: boolean
  connection: RTCPeerConnectionState
}

interface ChatItem { id: string; from: string; name: string; text: string; time: string }

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' },
]

export function useMeeting() {
  const toast = useSystem((s) => s.toast)
  const addMeetingRecord = useSystem((s) => s.addMeetingRecord)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
  const [room, setRoom] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [inRoom, setInRoom] = useState(false)
  const [joining, setJoining] = useState(false)
  const [connected, setConnected] = useState(false)
  const [selfId, setSelfId] = useState('')
  const [error, setError] = useState('')
  const [peers, setPeers] = useState<PeerView[]>([])
  const [messages, setMessages] = useState<ChatItem[]>([])
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [recording, setRecording] = useState(false)
  const [mediaReady, setMediaReady] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const localRef = useRef<MediaStream | null>(null)
  const pcs = useRef(new Map<string, RTCPeerConnection>())
  const pendingIce = useRef(new Map<string, RTCIceCandidateInit[]>())
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunks = useRef<Blob[]>([])
  const joinedAt = useRef(0)
  const selfName = useRef('')
  const roomRef = useRef('')

  useEffect(() => {
    initMedia()
    return () => {
      cleanupPeers()
      wsRef.current?.close()
      localRef.current?.getTracks().forEach((t) => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function initMedia() {
    if (localRef.current) return localRef.current
    try {
      const stream = await navigator.mediaDevices?.getUserMedia({ audio: true, video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } })
      if (!stream) throw new Error('媒体设备不可用')
      localRef.current = stream
      setLocalStream(stream)
      setMediaReady(true)
      setMicOn(stream.getAudioTracks().some((t) => t.enabled))
      setCamOn(stream.getVideoTracks().some((t) => t.enabled))
      return stream
    } catch (e) {
      setError(e instanceof Error && e.name === 'NotAllowedError' ? '未获得摄像头 / 麦克风权限。你仍可加入房间，但只能收发文字。' : '未检测到摄像头 / 麦克风，将以头像加入。你仍可以使用文字聊天和屏幕共享。')
      const empty = new MediaStream()
      localRef.current = empty
      setLocalStream(empty)
      setMicOn(false)
      setCamOn(false)
      setMediaReady(true)
      return empty
    }
  }

  function cleanupPeers() {
    for (const pc of pcs.current.values()) {
      try { pc.close() } catch {}
    }
    pcs.current.clear()
    pendingIce.current.clear()
    setPeers([])
  }

  function send(payload: Record<string, unknown>) {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload))
  }

  function sendState() {
    send({ type: 'state', mic: micOn, cam: camOn })
  }

  function broadcastState() {
    send({ type: 'state', mic: micOn, cam: camOn })
  }

  async function join(name: string, code: string) {
    if (!name.trim() || !code.trim()) return
    setJoining(true)
    setError('')
    selfName.current = name.trim()
    roomRef.current = code.trim().toUpperCase()
    setRoom(code.trim().toUpperCase())
    setDisplayName(name.trim())
    const stream = await initMedia()
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${location.host}/ws`)
    wsRef.current = ws
    ws.onopen = () => {
      setConnected(true)
      ws.send(JSON.stringify({ type: 'join', room: roomRef.current, name: selfName.current, id: uid('peer') }))
    }
    ws.onmessage = (event) => {
      let msg: any
      try { msg = JSON.parse(event.data) } catch { return }
      handleSignal(msg, stream)
    }
    ws.onclose = () => {
      setConnected(false)
      setJoining(false)
      if (joinedAt.current) {
        setError('信令连接已断开。请检查服务器或网络后重新加入。')
      }
    }
    ws.onerror = () => {
      setError('无法连接信令服务器。请确认 Node 服务正在运行（端口 8787）。')
      setJoining(false)
    }
  }

  async function handleSignal(msg: any, stream: MediaStream) {
    switch (msg.type) {
      case 'joined': {
        setJoining(false)
        setInRoom(true)
        setSelfId(msg.selfId ?? '')
        joinedAt.current = Date.now()
        setMessages([{ id: uid('msg'), from: 'system', name: '系统', text: `你已加入房间 ${roomRef.current}`, time: new Date().toISOString() }])
        sendState()
        for (const p of msg.peers ?? []) {
          await createPeer(p.id, p.name, true)
        }
        break
      }
      case 'peers': {
        for (const p of msg.peers ?? []) await createPeer(p.id, p.name, true)
        break
      }
      case 'peer-joined': {
        if (msg.peer?.id) await createPeer(msg.peer.id, msg.peer.name, false)
        sendState()
        break
      }
      case 'offer': {
        const pc = await createPeer(msg.from, msg.name ?? '访客', false)
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
        await flushIce(msg.from, pc)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        send({ type: 'answer', to: msg.from, sdp: answer })
        break
      }
      case 'answer': {
        const pc = pcs.current.get(msg.from)
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
          await flushIce(msg.from, pc)
        }
        break
      }
      case 'ice': {
        if (!msg.candidate) break
        const pc = pcs.current.get(msg.from)
        if (pc?.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {})
        else {
          const q = pendingIce.current.get(msg.from) ?? []
          q.push(msg.candidate)
          pendingIce.current.set(msg.from, q)
        }
        break
      }
      case 'peer-left': {
        const pc = pcs.current.get(msg.from)
        if (pc) { pc.close(); pcs.current.delete(msg.from) }
        setPeers((prev) => prev.filter((p) => p.id !== msg.from))
        break
      }
      case 'peer-state': {
        setPeers((prev) => prev.map((p) => (p.id === msg.from ? { ...p, mic: Boolean(msg.mic), cam: Boolean(msg.cam) } : p)))
        break
      }
      case 'chat': {
        setMessages((prev) => [...prev.slice(-99), { id: msg.id ?? uid('msg'), from: msg.from, name: msg.name, text: msg.text, time: msg.time ?? new Date().toISOString() }])
        break
      }
      case 'error': {
        setError(msg.message ?? '房间错误')
        setJoining(false)
        break
      }
    }
  }

  async function createPeer(peerId: string, name: string, initiator: boolean): Promise<RTCPeerConnection> {
    const existing = pcs.current.get(peerId)
    if (existing) return existing
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    pcs.current.set(peerId, pc)
    const stream = localRef.current
    if (stream) for (const track of stream.getTracks()) pc.addTrack(track, stream)
    const peer: PeerView = { id: peerId, name, stream: null, mic: true, cam: true, connection: 'connecting' }
    setPeers((prev) => [...prev.filter((p) => p.id !== peerId), peer])
    pc.onicecandidate = (e) => {
      if (e.candidate) send({ type: 'ice', to: peerId, candidate: e.candidate.toJSON() })
    }
    pc.ontrack = (e) => {
      const remote = e.streams[0]
      setPeers((prev) => prev.map((p) => (p.id === peerId ? { ...p, stream: remote ?? p.stream } : p)))
    }
    pc.onconnectionstatechange = () => {
      setPeers((prev) => prev.map((p) => (p.id === peerId ? { ...p, connection: pc.connectionState } : p)))
      if (pc.connectionState === 'failed') {
        try { pc.restartIce() } catch {}
      }
    }
    if (initiator) {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      send({ type: 'offer', to: peerId, sdp: offer, name: selfName.current })
    }
    return pc
  }

  async function flushIce(peerId: string, pc: RTCPeerConnection) {
    const q = pendingIce.current.get(peerId)
    if (!q) return
    for (const c of q) await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {})
    pendingIce.current.delete(peerId)
  }

  function toggleMic() {
    const next = !micOn
    localRef.current?.getAudioTracks().forEach((t) => (t.enabled = next))
    setMicOn(next)
    send({ type: 'state', mic: next, cam: camOn })
  }

  function toggleCam() {
    const next = !camOn
    localRef.current?.getVideoTracks().forEach((t) => (t.enabled = next))
    setCamOn(next)
    send({ type: 'state', mic: micOn, cam: next })
  }

  async function toggleShare() {
    if (sharing) {
      screenStream?.getTracks().forEach((t) => t.stop())
      setScreenStream(null)
      setSharing(false)
      const camTrack = localRef.current?.getVideoTracks()[0]
      for (const pc of pcs.current.values()) {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
        if (sender && camTrack) await sender.replaceTrack(camTrack).catch(() => {})
      }
      return
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false })
      const track = stream.getVideoTracks()[0]
      stream.getVideoTracks()[0].onended = () => { setSharing(false); setScreenStream(null); toggleShare() }
      for (const pc of pcs.current.values()) {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
        if (sender) await sender.replaceTrack(track).catch(() => {})
        else pc.addTrack(track, stream)
      }
      setScreenStream(stream)
      setSharing(true)
    } catch {
      toast('未共享屏幕', '浏览器拒绝了屏幕共享，或你取消了选择。', 'info')
    }
  }

  function sendChat(text: string) {
    if (!text.trim()) return
    send({ type: 'chat', id: uid('msg'), text: text.trim(), time: new Date().toISOString() })
  }

  function startRecording() {
    if (!localRef.current || localRef.current.getTracks().length === 0) {
      toast('无法录制', '没有可录制的媒体轨道。', 'error')
      return
    }
    try {
      const rec = new MediaRecorder(localRef.current, { mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm' })
      recordedChunks.current = []
      rec.ondataavailable = (e) => e.data.size && recordedChunks.current.push(e.data)
      rec.onstop = async () => {
        const blob = new Blob(recordedChunks.current, { type: 'video/webm' })
        setRecording(false)
        try {
          const saved = await ecosystem.saveFile({ name: `会议录制-${roomRef.current}-${new Date().toISOString().slice(11, 19)}.webm`, mime: 'video/webm', blob, folderName: '音视频', sourceApp: 'meeting', tags: ['会议'] })
          toast('录制已保存', `${saved.name} 已写入云巢「音视频」。`, 'success')
        } catch {
          toast('录制保存失败', '浏览器内存不足或存储被拒绝。', 'error')
        }
      }
      rec.start(1000)
      recorderRef.current = rec
      setRecording(true)
    } catch {
      toast('无法开始录制', '当前浏览器不支持 MediaRecorder。', 'error')
    }
  }

  function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop()
      recorderRef.current = null
    } else startRecording()
  }

  function leave() {
    const duration = joinedAt.current ? Math.round((Date.now() - joinedAt.current) / 1000) : 0
    if (duration > 3) addMeetingRecord({ id: uid('meeting'), code: roomRef.current, title: `会客厅 ${roomRef.current}`, startedAt: new Date(Date.now() - duration * 1000).toISOString(), duration, participants: peers.length + 1 })
    send({ type: 'leave' })
    joinedAt.current = 0
    cleanupPeers()
    setMessages([])
    setInRoom(false)
    setJoining(false)
    setSharing(false)
    setRecording(false)
    screenStream?.getTracks().forEach((t) => t.stop())
    setScreenStream(null)
    try { wsRef.current?.close() } catch {}
    wsRef.current = null
    setConnected(false)
    recorderRef.current?.stop()
    recorderRef.current = null
    roomRef.current = ''
  }

  return {
    localStream, screenStream, room, setRoom, displayName, setDisplayName, inRoom, joining, connected, error, setError, selfId,
    peers, messages, micOn, camOn, sharing, recording, mediaReady,
    join, leave, toggleMic, toggleCam, toggleShare, sendChat, toggleRecording, generateCode: () => randomCode(4).toUpperCase(),
  }
}
