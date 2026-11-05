import { useEffect, useRef, useState } from 'react'
import { useSystem } from '../../core/store'
import { uid } from '../../core/utils'

export type RemoteRole = 'host' | 'controller'
export type RemoteStage = 'idle' | 'sharing' | 'waiting' | 'connected' | 'error'
export interface RemoteLog { id: string; time: string; text: string; kind: 'info' | 'control' | 'system' }
export interface Cursor { x: number; y: number; visible: boolean }

const ICE: RTCIceServer[] = [{ urls: 'stun:stun.cloudflare.com:3478' }, { urls: 'stun:stun.l.google.com:19302' }]

export function useRemote() {
  const toast = useSystem((s) => s.toast)
  const [role, setRole] = useState<RemoteRole>('host')
  const [stage, setStage] = useState<RemoteStage>('idle')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [screen, setScreen] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [log, setLog] = useState<RemoteLog[]>([])
  const [cursor, setCursor] = useState<Cursor>({ x: 0.5, y: 0.5, visible: false })
  const [connected, setConnected] = useState(false)
  const [peerName, setPeerName] = useState('')
  const [latency, setLatency] = useState<number | null>(null)
  const [allowControl, setAllowControl] = useState(true)
  const [clipboard, setClipboard] = useState('')
  const [receivedClipboard, setReceivedClipboard] = useState('')
  const wsRef = useRef<WebSocket | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const screenRef = useRef<MediaStream | null>(null)
  const roleRef = useRef<RemoteRole>('host')
  const allowRef = useRef(true)
  const isController = role === 'controller'

  useEffect(() => { allowRef.current = allowControl }, [allowControl])
  useEffect(() => () => cleanup(), [])

  function cleanup() {
    screenRef.current?.getTracks().forEach((t) => t.stop())
    screenRef.current = null
    dcRef.current?.close()
    dcRef.current = null
    pcRef.current?.close()
    pcRef.current = null
    wsRef.current?.close()
    wsRef.current = null
    setScreen(null)
    setRemoteStream(null)
    setConnected(false)
    setStage('idle')
    setCursor({ x: 0.5, y: 0.5, visible: false })
    setLatency(null)
  }

  function addLog(text: string, kind: RemoteLog['kind'] = 'info') {
    setLog((prev) => [...prev.slice(-80), { id: uid('log'), time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }), text, kind }])
  }

  function connectWs(session: string, as: RemoteRole) {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${location.host}/ws`)
    wsRef.current = ws
    roleRef.current = as
    setRole(as)
    setCode(session)
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', room: `R-${session}`, name: as === 'host' ? '被控端' : '控制端', id: uid('peer') }))
      addLog(as === 'host' ? '已创建远程会话，等待控制端…' : '已连接信令，正在寻找被控端…', 'system')
    }
    ws.onmessage = (e) => {
      let m: any
      try { m = JSON.parse(e.data) } catch { return }
      handle(m).catch((err) => console.warn(err))
    }
    ws.onerror = () => { setError('无法连接信令服务，请确认 Node 服务运行在 8787 端口。'); setStage('error') }
    ws.onclose = () => { if (roleRef.current) setConnected(false) }
  }

  function send(payload: Record<string, unknown>) {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(payload))
  }

  async function handle(m: any) {
    if (m.type === 'joined') {
      if (roleRef.current === 'controller') {
        setStage('sharing')
        if (m.peers?.length) {
          setPeerName(m.peers[0].name)
          await createControllerPeer(m.peers[0].id)
        }
      } else {
        setStage('waiting')
      }
      return
    }
    if (m.type === 'peer-joined') {
      setPeerName(m.peer?.name ?? '对端')
      addLog(`${m.peer?.name ?? '对端'} 已加入会话`, 'system')
      if (roleRef.current === 'controller') await createControllerPeer(m.peer.id)
      else setStage('waiting')
      return
    }
    if (m.type === 'offer') {
      if (roleRef.current !== 'host') return
      const pc = createBasePeer(m.from)
      pc.ondatachannel = (ev) => setupDataChannel(ev.channel)
      if (!screenRef.current) return setError('还没有共享屏幕')
      for (const track of screenRef.current.getTracks()) pc.addTrack(track, screenRef.current)
      await pc.setRemoteDescription(new RTCSessionDescription(m.sdp))
      await flushIce(m.from, pc)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      send({ type: 'answer', to: m.from, sdp: answer })
      setStage('connected')
      addLog('控制端已建立视频通道', 'system')
      return
    }
    if (m.type === 'answer') {
      const pc = pcRef.current
      if (pc) { await pc.setRemoteDescription(new RTCSessionDescription(m.sdp)); await flushIce(m.from, pc) }
      return
    }
    if (m.type === 'ice') {
      const pc = pcRef.current
      if (!pc || !m.candidate) return
      if (pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(m.candidate)).catch(() => {})
      else pendingIce.current.push(m.candidate)
      return
    }
    if (m.type === 'peer-left') {
      addLog('对端已断开', 'system')
      setConnected(false)
      setStage(roleRef.current === 'host' ? 'waiting' : 'sharing')
      setCursor((c) => ({ ...c, visible: false }))
      return
    }
    if (m.type === 'error') { setError(m.message ?? '房间错误'); setStage('error') }
  }

  const pendingIce = useRef<RTCIceCandidateInit[]>([])

  function createBasePeer(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE })
    pcRef.current = pc
    pc.onicecandidate = (e) => { if (e.candidate) send({ type: 'ice', to: peerId, candidate: e.candidate.toJSON() }) }
    pc.ondatachannel = (ev) => setupDataChannel(ev.channel)
    pc.onconnectionstatechange = () => {
      setConnected(pc.connectionState === 'connected')
      if (pc.connectionState === 'failed') setError('P2P 连接失败，可能需要 TURN 中继。')
    }
    return pc
  }

  async function createControllerPeer(hostId: string) {
    if (pcRef.current) return
    const pc = createBasePeer(hostId)
    pc.addTransceiver('video', { direction: 'recvonly' })
    pc.addTransceiver('audio', { direction: 'recvonly' })
    const dc = pc.createDataChannel('control', { ordered: true })
    setupDataChannel(dc)
    pc.ontrack = (e) => {
      setRemoteStream(e.streams[0])
      setStage('connected')
      addLog('已接收到被控端画面', 'system')
    }
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    send({ type: 'offer', to: hostId, sdp: offer })
    setStage('sharing')
  }

  async function flushIce(_peerId: string, pc: RTCPeerConnection) {
    for (const c of pendingIce.current) await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {})
    pendingIce.current = []
  }

  function setupDataChannel(dc: RTCDataChannel) {
    dcRef.current = dc
    dc.onopen = () => {
      setConnected(true)
      addLog('加密数据通道已建立', 'system')
      if (roleRef.current === 'controller') sendCtrl({ type: 'hello', name: '控制端' })
    }
    dc.onclose = () => addLog('数据通道已关闭', 'system')
    dc.onmessage = (ev) => {
      let m: any
      try { m = JSON.parse(ev.data) } catch { return }
      if (m.type === 'move') {
        if (roleRef.current === 'host' && allowRef.current) setCursor({ x: m.x, y: m.y, visible: true })
      } else if (m.type === 'leave') {
        setCursor((c) => ({ ...c, visible: false }))
      } else if (m.type === 'ping') {
        sendCtrl({ type: 'pong', t: m.t })
      } else if (m.type === 'pong') {
        setLatency(Math.max(1, Math.round(performance.now() - m.t)))
      } else if (m.type === 'clip') {
        setReceivedClipboard(String(m.text ?? '').slice(0, 20000))
        addLog('收到对端剪贴板内容', 'control')
        if (roleRef.current === 'controller') addLog('被控端剪贴板已同步', 'control')
      } else if (m.type === 'key') {
        addLog(`远程按键：${String(m.key ?? '').slice(0, 24)}`, 'control')
      } else if (m.type === 'hello') {
        addLog(`${m.name ?? '对端'} 已握手`, 'system')
      }
    }
  }

  function sendCtrl(m: Record<string, unknown>) {
    if (dcRef.current?.readyState === 'open') dcRef.current.send(JSON.stringify(m))
  }

  async function startHost(session: string) {
    if (!session.trim()) return
    setError('')
    setRole('host')
    setCode(session)
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 20 }, audio: false })
      screenRef.current = stream
      setScreen(stream)
      stream.getVideoTracks()[0].onended = () => { addLog('本地屏幕共享已停止', 'system'); setStage((s) => (s === 'connected' ? s : 'idle')) }
      connectWs(session, 'host')
      setStage('waiting')
      addLog('正在共享屏幕', 'system')
    } catch (e) {
      setError(e instanceof Error && e.name === 'NotAllowedError' ? '未获得屏幕共享权限。' : '无法开始屏幕共享。')
      setStage('error')
    }
  }

  function startController(session: string) {
    if (!session.trim()) return
    setError('')
    setRole('controller')
    setCode(session)
    setStage('sharing')
    connectWs(session, 'controller')
  }

  function stop() {
    if (dcRef.current?.readyState === 'open') sendCtrl({ type: 'leave' })
    cleanup()
    setRole('host')
    setError('')
    addLog('会话已结束', 'system')
    toast('远程会话已结束', undefined, 'info')
  }

  function sendPointer(x: number, y: number) {
    sendCtrl({ type: 'move', x, y })
  }

  function sendKey(key: string) {
    sendCtrl({ type: 'key', key })
  }

  function shareClipboard(text: string) {
    sendCtrl({ type: 'clip', text })
    addLog('已发送剪贴板内容', 'control')
  }

  useEffect(() => {
    if (!connected || role !== 'controller') return
    const t = setInterval(() => sendCtrl({ type: 'ping', t: performance.now() }), 2000)
    return () => clearInterval(t)
  }, [connected, role])

  return {
    role, stage, code, setCode, error, screen, remoteStream, log, cursor, connected, peerName, latency, allowControl, setAllowControl,
    clipboard, setClipboard, receivedClipboard, isController,
    startHost, startController, stop, sendPointer, sendKey, shareClipboard, addLog,
  }
}
