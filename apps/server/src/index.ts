import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID, randomBytes } from 'node:crypto'
import express from 'express'
import { WebSocketServer, WebSocket } from 'ws'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT ?? 8787)
const MAX_ROOM_SIZE = 8
const MAX_MESSAGE = 1000

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '128kb' }))

const startedAt = Date.now()

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'stellar-edge', uptime: Math.round((Date.now() - startedAt) / 1000), rooms: rooms.size, clients: wss?.clients.size ?? 0 })
})

app.get('/api/ice', (_req, res) => {
  const turn = process.env.TURN_URL
  const iceServers: RTCIceServerLike[] = [{ urls: 'stun:stun.cloudflare.com:3478' }, { urls: 'stun:stun.l.google.com:19302' }]
  if (turn && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
    iceServers.push({ urls: turn, username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL })
  }
  res.json({ iceServers })
})

interface RTCIceServerLike { urls: string; username?: string; credential?: string }

const webDist = path.resolve(__dirname, '../../web/dist')
if (existsSync(path.join(webDist, 'index.html'))) {
  app.use(express.static(webDist, { index: false, maxAge: '1h' }))
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/ws')) {
      res.sendFile(path.join(webDist, 'index.html'))
    } else next()
  })
} else {
  app.get('/', (_req, res) => {
    res.type('text/plain').send('Stellar edge is running. Build the web app first: pnpm --filter @stellar/web build\nWebSocket endpoint: /ws')
  })
}

app.use((_req, res) => res.status(404).json({ error: 'not_found' }))

const server = createServer(app)

interface Client {
  id: string
  name: string
  room: string
  mic: boolean
  cam: boolean
  alive: boolean
  ws: WebSocket
}
interface Room {
  clients: Map<string, Client>
}
const rooms = new Map<string, Room>()
const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 })

function publicPeer(c: Client) {
  return { id: c.id, name: c.name, mic: c.mic, cam: c.cam }
}

function broadcast(room: string, payload: unknown, except?: string) {
  const r = rooms.get(room)
  if (!r) return
  const data = JSON.stringify(payload)
  for (const c of r.clients.values()) {
    if (c.id !== except && c.ws.readyState === WebSocket.OPEN) c.ws.send(data)
  }
}

function leave(client: Client, notify = true) {
  const r = rooms.get(client.room)
  if (!r) return
  r.clients.delete(client.id)
  if (notify) broadcast(client.room, { type: 'peer-left', from: client.id, name: client.name })
  if (r.clients.size === 0) rooms.delete(client.room)
  client.room = ''
}

function sanitizeRoom(value: unknown): string {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24)
}
function sanitizeName(value: unknown): string {
  return String(value ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 28) || '访客'
}

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  if (url.pathname !== '/ws') {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n')
    socket.destroy()
    return
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
})

wss.on('connection', (ws, req) => {
  ;(ws as WebSocket & { __alive?: boolean }).__alive = true
  const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '')
  const client: Client = {
    id: randomUUID(),
    name: '访客',
    room: '',
    mic: false,
    cam: false,
    alive: true,
    ws,
  }
  let joined = false

  const reject = (message: string) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'error', message }))
  }

  ws.on('pong', () => { ;(ws as WebSocket & { __alive?: boolean }).__alive = true; client.alive = true })

  ws.on('message', (raw) => {
    let msg: any
    try { msg = JSON.parse(String(raw)) } catch { return reject('消息格式错误') }
    if (!msg || typeof msg.type !== 'string') return
    client.alive = true

    if (msg.type === 'join') {
      if (joined) return reject('已经在房间中')
      const room = sanitizeRoom(msg.room)
      const name = sanitizeName(msg.name)
      if (room.length < 2) return reject('房间号至少需要 2 个字符')
      const existing = rooms.get(room)
      if (existing && existing.clients.size >= MAX_ROOM_SIZE) return reject('房间已满（最多 8 人）')
      client.id = typeof msg.id === 'string' && /^[a-zA-Z0-9_-]{4,64}$/.test(msg.id) ? msg.id : randomUUID()
      client.name = name
      client.room = room
      client.mic = Boolean(msg.mic ?? false)
      client.cam = Boolean(msg.cam ?? false)
      const r = existing ?? { clients: new Map<string, Client>() }
      if (!existing) rooms.set(room, r)
      r.clients.set(client.id, client)
      joined = true
      ws.send(JSON.stringify({ type: 'joined', room, selfId: client.id, peers: [...r.clients.values()].filter((c) => c.id !== client.id).map(publicPeer) }))
      broadcast(room, { type: 'peer-joined', peer: publicPeer(client) }, client.id)
      console.log(`[room ${room}] ${name} joined (${r.clients.size}/8) from ${ip}`)
      return
    }

    if (!joined) return reject('请先加入房间')

    if (msg.type === 'offer' || msg.type === 'answer' || msg.type === 'ice') {
      const target = rooms.get(client.room)?.clients.get(String(msg.to))
      if (!target || target.ws.readyState !== WebSocket.OPEN) return
      target.ws.send(JSON.stringify({ ...msg, from: client.id, name: client.name }))
      return
    }

    if (msg.type === 'chat') {
      const text = String(msg.text ?? '').trim().slice(0, MAX_MESSAGE)
      if (!text) return
      broadcast(client.room, {
        type: 'chat',
        id: typeof msg.id === 'string' ? msg.id.slice(0, 64) : randomBytes(8).toString('hex'),
        from: client.id,
        name: client.name,
        text,
        time: new Date().toISOString(),
      })
      return
    }

    if (msg.type === 'state') {
      client.mic = Boolean(msg.mic)
      client.cam = Boolean(msg.cam)
      broadcast(client.room, { type: 'peer-state', from: client.id, mic: client.mic, cam: client.cam }, client.id)
      return
    }

    if (msg.type === 'leave') {
      leave(client)
      joined = false
      ws.close()
      return
    }

    if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', time: Date.now() }))
    }
  })

  ws.on('close', () => {
    if (joined && client.room) leave(client)
    joined = false
  })

  ws.on('error', (err) => {
    console.warn('ws error', err.message)
  })
})

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    const anyWs = ws as WebSocket & { __alive?: boolean }
    if (anyWs.__alive === false) { ws.terminate(); continue }
    anyWs.__alive = false
    ws.ping()
  }
}, 30000)
wss.on('close', () => clearInterval(heartbeat))

server.listen(PORT, () => {
  console.log(`\n  ◉ Stellar Edge  ·  http://127.0.0.1:${PORT}`)
  console.log(`    WebSocket     ·  /ws`)
  console.log(`    Health        ·  /api/health`)
  console.log(`    Web root      ·  ${existsSync(path.join(webDist, 'index.html')) ? webDist : 'not built (run pnpm build)'}\n`)
})

function shutdown() {
  console.log('\nShutting down Stellar Edge…')
  clearInterval(heartbeat)
  for (const ws of wss.clients) ws.close(1001, 'server shutdown')
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 2500)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
