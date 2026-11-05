import {
  ArrowLeft,
  Captions,
  ChevronDown,
  FolderOpen,
  ListMusic,
  Maximize,
  Music2,
  Pause,
  PictureInPicture2,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  Search,
  Share2,
  Shuffle,
  SkipBack,
  SkipForward,
  Sparkles,
  Upload,
  Video,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppProps } from '../../components/AppRenderer'
import { ecosystem } from '../../core/ecosystem'
import { useSystem } from '../../core/store'
import type { DriveFile } from '../../core/types'
import { cn, formatBytes, formatDuration, isAudioMime, isVideoMime, makeArt, makeThumbnail } from '../../core/utils'

interface Cue { start: number; end: number; text: string }

export default function MediaApp({ params }: AppProps) {
  const files = useSystem((s) => s.files)
  const toast = useSystem((s) => s.toast)
  const mediaFiles = useMemo(() => files.filter((f) => !f.trashed && f.kind === 'file' && (isAudioMime(f.mime) || isVideoMime(f.mime) || /\.(mp4|webm|mp3|wav|ogg|m4a)$/i.test(f.name))).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [files])
  const initial = (params.fileId as string) || mediaFiles.find((f) => isVideoMime(f.mime))?.id || mediaFiles[0]?.id || ''
  const [currentId, setCurrentId] = useState(initial)
  const current = mediaFiles.find((f) => f.id === currentId) ?? mediaFiles[0]
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [muted, setMuted] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [loop, setLoop] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [queueOpen, setQueueOpen] = useState(true)
  const [search, setSearch] = useState('')
  const [cues, setCues] = useState<Cue[]>([])
  const [subsOn, setSubsOn] = useState(true)
  const [dragging, setDragging] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const subInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const isAudio = current ? isAudioMime(current.mime) || !isVideoMime(current.mime) : false
  const art = current?.thumb || makeArt(Number(current?.id.replace(/\D/g, '').slice(-2) || 4), current?.name.split('.')[0]?.toUpperCase() ?? 'STELLAR', 900, 900)
  const filtered = mediaFiles.filter((f) => !search.trim() || f.name.toLowerCase().includes(search.toLowerCase()))
  const activeCue = cues.find((c) => time >= c.start && time <= c.end)

  useEffect(() => {
    if (params.fileId && params.fileId !== currentId) setCurrentId(String(params.fileId))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.fileId])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.load()
    setTime(0)
    setDuration(0)
    setPlaying(false)
    if (params.autoplay) v.play().then(() => setPlaying(true)).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.volume = volume
    v.muted = muted
    v.playbackRate = speed
    v.loop = loop
  }, [volume, muted, speed, loop])

  const toggle = async () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      try { await v.play(); setPlaying(true) } catch { toast('无法播放', '媒体源不可用或浏览器阻止了自动播放。', 'error') }
    } else { v.pause(); setPlaying(false) }
  }

  const next = (dir = 1) => {
    if (!current || mediaFiles.length === 0) return
    const idx = mediaFiles.findIndex((f) => f.id === current.id)
    let n = shuffle ? Math.floor(Math.random() * mediaFiles.length) : (idx + dir + mediaFiles.length) % mediaFiles.length
    setCurrentId(mediaFiles[n].id)
  }

  const loadSubtitle = async (file: File | undefined) => {
    if (!file) return
    const text = await file.text()
    const parsed = parseVtt(text)
    setCues(parsed)
    setSubsOn(true)
    toast(parsed.length ? '字幕已加载' : '字幕为空', parsed.length ? `${file.name} · ${parsed.length} 条` : '没有解析到 VTT 字幕。', parsed.length ? 'success' : 'error')
  }

  const upload = async (files: FileList | null) => {
    if (!files?.[0]) return
    const f = files[0]
    const thumb = f.type.startsWith('image/') ? await makeThumbnail(f, 900).catch(() => undefined) : undefined
    const saved = await ecosystem.saveFile({ name: f.name, mime: f.type || 'application/octet-stream', blob: f, folderName: '音视频', sourceApp: 'media', thumb })
    toast('已加入云巢与播放列表', saved.name, 'success')
    setCurrentId(saved.id)
    if (fileInput.current) fileInput.current.value = ''
  }

  const fullscreen = () => {
    if (!stageRef.current) return
    if (document.fullscreenElement) document.exitFullscreen()
    else stageRef.current.requestFullscreen?.().catch(() => {})
  }

  return (
    <div className="media">
      <aside className={cn('media-queue', !queueOpen && 'collapsed')}>
        <header className="media-q-head">
          <div><span className="sheet-eyebrow">PLAYLIST</span><h2>声影</h2></div>
          <button className="icon-btn" onClick={() => setQueueOpen(false)} title="收起播放列表"><ArrowLeft size={16} /></button>
        </header>
        <div className="media-q-tools">
          <div className="field media-search"><Search size={13} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索媒体" /></div>
          <button className="icon-btn" onClick={() => fileInput.current?.click()} title="导入本地文件"><Plus size={16} /></button>
        </div>
        <div className="media-q-stats"><span>播放队列 · {filtered.length}</span><span>{formatBytes(filtered.reduce((n, f) => n + f.size, 0))}</span></div>
        <div className="media-q-list scroll-y">
          {filtered.map((f, i) => (
            <button key={f.id} className={cn('media-q-item', f.id === current?.id && 'active')} onClick={() => { setCurrentId(f.id); setCues([]); videoRef.current?.play().catch(() => {}) }}>
              <span className="media-q-thumb" style={f.thumb ? { backgroundImage: `url(${f.thumb})` } : undefined}>
                {!f.thumb && (isVideoMime(f.mime) ? <Video size={15} /> : <Music2 size={15} />)}
                {f.id === current?.id && <span className="media-q-playing">{playing ? <span className="eq"><i /><i /><i /></span> : <Play size={8} fill="currentColor" />}</span>}
              </span>
              <span className="media-q-copy"><strong>{f.name}</strong><small>{isVideoMime(f.mime) ? '视频' : '音频'} · {formatBytes(f.size)}</small></span>
              <span className="media-q-index">{String(i + 1).padStart(2, '0')}</span>
            </button>
          ))}
          {filtered.length === 0 && <div className="empty-state"><ListMusic size={22} /><strong>播放列表为空</strong><p>从云巢添加音视频，或导入本地文件。</p></div>}
        </div>
        <footer className="media-q-foot">
          <button onClick={() => ecosystem.open('drive', { folderId: 'folder-media' })}><FolderOpen size={12} /> 打开云巢音视频</button>
          <button onClick={() => fileInput.current?.click()}><Upload size={12} /> 导入</button>
        </footer>
      </aside>

      <main className="media-main">
        <header className="media-topbar">
          {!queueOpen && <button className="icon-btn" onClick={() => setQueueOpen(true)} title="播放列表"><ListMusic size={17} /></button>}
          <div className="media-top-title"><span>{isAudio ? '正在聆听' : '正在观看'}</span><strong>{current?.name ?? '未选择媒体'}</strong></div>
          <div className="media-top-actions">
            <button className="btn sm" onClick={() => current && ecosystem.share(ecosystem.makeShareFromFile(current))}><Share2 size={12} /> 分享</button>
            <button className="btn sm" onClick={() => current && ecosystem.askAI({ prompt: `为媒体「${current.name}」写一段 80 字以内的播放推荐语。`, origin: 'media' })}><Sparkles size={12} /> AI 推荐</button>
          </div>
        </header>

        <div className="media-stage-wrap">
          <div className={cn('media-stage', isAudio && 'audio-stage', dragging && 'dragging')} ref={stageRef} onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files) }}>
            <div className="media-ambient" style={{ backgroundImage: `url(${art})` }} />
            {current ? (
              isAudio ? (
                <div className="media-audio">
                  <div className={cn('media-art', playing && 'playing')} style={{ backgroundImage: `url(${art})` }}>
                    <div className="media-art-ring" />
                    <div className="media-art-center"><Music2 size={26} /></div>
                  </div>
                  <div className="media-audio-info">
                    <span className="sheet-eyebrow">NOW PLAYING</span>
                    <h1>{current.name.replace(/\.[^.]+$/, '')}</h1>
                    <p>星环媒体库 · 本地播放</p>
                  </div>
                  <div className={cn('media-wave', playing && 'playing')} aria-hidden>
                    {Array.from({ length: 42 }).map((_, i) => <i key={i} style={{ animationDelay: `${(i % 14) * 70}ms`, height: `${12 + ((i * 17) % 54)}%` }} />)}
                  </div>
                  <video
                    ref={videoRef}
                    className="media-audio-el"
                    src={current.externalUrl ?? undefined}
                    playsInline
                    onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
                    onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                    onEnded={() => { setPlaying(false); if (loop) return; next(1) }}
                  />
                  {current.blobId && <BlobVideoSource blobId={current.blobId} videoRef={videoRef} />}
                </div>
              ) : (
                <div className="media-video-wrap">
                  <video
                    ref={videoRef}
                    className="media-video"
                    src={current.externalUrl ?? undefined}
                    playsInline
                    onClick={toggle}
                    onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
                    onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                    onEnded={() => { setPlaying(false); if (loop) return; next(1) }}
                  />
                  {current.blobId && <BlobVideoSource blobId={current.blobId} videoRef={videoRef} />}
                  {!playing && (
                    <button className="media-big-play" onClick={toggle}><Play size={30} fill="currentColor" /></button>
                  )}
                  {subsOn && activeCue && <div className="media-subtitle">{activeCue.text}</div>}
                  <div className="media-video-badge"><span className="dot pulse" /> {isVideoMime(current.mime) ? '视频' : '媒体'} · 本地优先</div>
                </div>
              )
            ) : (
              <div className="empty-state"><ListMusic size={30} /><strong>还没有媒体</strong><p>导入一个本地文件，或从云巢选择音视频。</p></div>
            )}
            {dragging && <div className="media-drop"><Upload size={24} /><strong>松开以导入到云巢</strong><span>音视频会自动加入播放队列</span></div>}
          </div>
        </div>

        <div className="media-controls">
          <div className="media-timeline">
            <span>{formatDuration(time)}</span>
            <input type="range" min={0} max={duration || 0} step={0.1} value={time} onChange={(e) => { const v = Number(e.target.value); setTime(v); if (videoRef.current) videoRef.current.currentTime = v }} aria-label="播放进度" style={{ '--progress': `${duration ? (time / duration) * 100 : 0}%` } as React.CSSProperties} />
            <span>{formatDuration(duration)}</span>
          </div>
          <div className="media-control-row">
            <div className="media-ctrl-left">
              <button className={cn('icon-btn', shuffle && 'active')} onClick={() => setShuffle((v) => !v)} title="随机播放"><Shuffle size={15} /></button>
              <button className="icon-btn" onClick={() => next(-1)} title="上一个"><SkipBack size={17} /></button>
              <button className="media-play-btn" onClick={toggle}>{playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}</button>
              <button className="icon-btn" onClick={() => next(1)} title="下一个"><SkipForward size={17} /></button>
              <button className={cn('icon-btn', loop && 'active')} onClick={() => setLoop((v) => !v)} title="循环"><Repeat size={15} /></button>
            </div>
            <div className="media-ctrl-center">
              <button className={cn('icon-btn', speed !== 1 && 'active')} onClick={() => setSpeed((s) => (s === 1 ? 1.25 : s === 1.25 ? 1.5 : s === 1.5 ? 2 : s === 2 ? 0.75 : 1))} title="播放速度"><span className="speed-label">{speed}×</span></button>
              <button className={cn('icon-btn', subsOn && cues.length > 0 && 'active')} onClick={() => cues.length ? setSubsOn((v) => !v) : subInput.current?.click()} title="字幕"><Captions size={16} /></button>
              <button className="icon-btn" onClick={fullscreen} title="全屏"><Maximize size={16} /></button>
              <button className="icon-btn" onClick={() => videoRef.current?.requestPictureInPicture?.().catch(() => toast('画中画不可用', '当前浏览器不支持画中画。', 'info'))} title="画中画"><PictureInPicture2 size={16} /></button>
            </div>
            <div className="media-ctrl-right">
              <button className="icon-btn" onClick={() => setMuted((v) => !v)} title={muted ? '取消静音' : '静音'}>{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>
              <input type="range" min={0} max={1} step={0.01} value={muted ? 0 : volume} onChange={(e) => { setVolume(Number(e.target.value)); setMuted(false) }} aria-label="音量" style={{ '--progress': `${(muted ? 0 : volume) * 100}%` } as React.CSSProperties} />
              <span className="media-vol-label">{Math.round((muted ? 0 : volume) * 100)}</span>
            </div>
          </div>
        </div>
        <input ref={fileInput} type="file" accept="audio/*,video/*" hidden onChange={(e) => upload(e.target.files)} />
        <input ref={subInput} type="file" accept=".vtt,text/vtt" hidden onChange={(e) => loadSubtitle(e.target.files?.[0])} />
      </main>
    </div>
  )
}

function BlobVideoSource({ blobId, videoRef }: { blobId: string; videoRef: React.RefObject<HTMLVideoElement | null> }) {
  useEffect(() => {
    let url: string | null = null
    import('../../core/db').then(({ getBlobUrl }) => getBlobUrl(blobId)).then((u) => {
      url = u
      if (u && videoRef.current) {
        videoRef.current.src = u
        videoRef.current.load()
      }
    })
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [blobId, videoRef])
  return null
}

function parseVtt(text: string): Cue[] {
  const cues: Cue[] = []
  const blocks = text.replace(/\r/g, '').split(/\n\n+/)
  for (const block of blocks) {
    const lines = block.split('\n').filter(Boolean)
    const timeLine = lines.find((l) => l.includes('-->'))
    if (!timeLine) continue
    const m = timeLine.match(/(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3})/)
    if (!m) continue
    const idx = lines.indexOf(timeLine)
    cues.push({ start: parseTime(m[1]), end: parseTime(m[2]), text: lines.slice(idx + 1).join('\n').replace(/<[^>]+>/g, '') })
  }
  return cues
}
function parseTime(s: string) {
  const parts = s.replace(',', '.').split(':').map(Number)
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return parts[0] * 60 + parts[1]
}
