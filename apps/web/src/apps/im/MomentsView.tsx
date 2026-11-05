import { Camera, Heart, ImagePlus, MapPin, MessageCircle, Send, Share2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Avatar } from '../../components/Avatar'
import { ecosystem } from '../../core/ecosystem'
import { useSystem } from '../../core/store'
import { encodeSvg, makeThumbnail, relativeTime } from '../../core/utils'

const COVER = encodeSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="420" viewBox="0 0 1200 420">
  <defs>
    <linearGradient id="c" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0b1d2c"/><stop offset=".5" stop-color="#16234a"/><stop offset="1" stop-color="#2a1637"/></linearGradient>
    <radialGradient id="g1"><stop stop-color="#69e6ff" stop-opacity=".35"/><stop offset="1" stop-color="#69e6ff" stop-opacity="0"/></radialGradient>
    <radialGradient id="g2"><stop stop-color="#ff7ac8" stop-opacity=".3"/><stop offset="1" stop-color="#ff7ac8" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1200" height="420" fill="url(#c)"/>
  <circle cx="850" cy="90" r="300" fill="url(#g1)"/>
  <circle cx="1120" cy="390" r="250" fill="url(#g2)"/>
  <g fill="none" stroke="#9bb8e8" opacity=".22">
    <circle cx="950" cy="180" r="140"/><circle cx="950" cy="180" r="210"/><ellipse cx="950" cy="180" rx="320" ry="88" transform="rotate(-18 950 180)"/>
  </g>
  <text x="1120" y="170" text-anchor="end" fill="rgba(240,247,255,.9)" font-family="Manrope, sans-serif" font-size="44" font-weight="800" letter-spacing="9">MOMENTS</text>
  <text x="1120" y="205" text-anchor="end" fill="rgba(180,205,235,.55)" font-family="Manrope, sans-serif" font-size="12" letter-spacing="6">STELLAR · LIFE IN ONE ORBIT</text>
</svg>`)

export function MomentsView() {
  const moments = useSystem((s) => s.moments)
  const contacts = useSystem((s) => s.contacts)
  const profile = useSystem((s) => s.profile)
  const toggleLike = useSystem((s) => s.toggleLikeMoment)
  const addComment = useSystem((s) => s.addMomentComment)
  const [composer, setComposer] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [comments, setComments] = useState<Record<string, string>>({})
  const people = useMemo(() => [{ id: 'me', name: profile.name, hue: profile.hue }, ...contacts.map((c) => ({ id: c.id, name: c.name, hue: c.hue }))], [contacts, profile])

  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? '星环用户'
  const hueOf = (id: string) => people.find((p) => p.id === id)?.hue ?? 200

  return (
    <section className="moments">
      <header className="im-page-head moments-head">
        <div><span className="sheet-eyebrow">MOMENTS</span><h2>朋友圈</h2></div>
        <div className="row gap-8">
          <button className="btn sm" onClick={() => ecosystem.share({ title: '星环朋友圈', text: moments[0]?.text, sourceApp: 'im' })}><Share2 size={13} /> 分享</button>
          <button className="btn primary sm" onClick={() => setComposer(true)}><Camera size={13} /> 发布动态</button>
        </div>
      </header>
      <div className="moments-scroll scroll-y">
        <div className="moments-cover">
          <img className="moments-cover-img" src={COVER} alt="" />
          <div className="moments-cover-shade" />
          <div className="moments-cover-profile">
            <Avatar name={profile.name} hue={profile.hue} size={66} round />
            <div><strong>{profile.name}</strong><span>{profile.bio}</span></div>
          </div>
          <span className="moments-cover-tag">星环 · 生活切片</span>
        </div>
        <div className="moments-feed">
          {moments.map((m) => {
            const liked = m.likes.includes('me')
            return (
              <article className="moment-post" key={m.id}>
                <Avatar name={nameOf(m.authorId)} hue={hueOf(m.authorId)} size={40} round />
                <div className="moment-main">
                  <header><strong>{nameOf(m.authorId)}</strong><span>{relativeTime(m.time)}</span></header>
                  <p>{m.text}</p>
                  {m.images.length > 0 && (
                    <div className={`moment-images n${Math.min(m.images.length, 4)}`}>
                      {m.images.map((src, i) => <button key={i} onClick={() => setLightbox(src)}><img src={src} alt="" /></button>)}
                    </div>
                  )}
                  {m.location && <div className="moment-location"><MapPin size={10} /> {m.location}</div>}
                  <div className="moment-actions">
                    <button className={liked ? 'liked' : ''} onClick={() => toggleLike(m.id)}><Heart size={14} fill={liked ? 'currentColor' : 'none'} /> {m.likes.length || ''}</button>
                    <button onClick={() => document.getElementById(`comment-${m.id}`)?.focus()}><MessageCircle size={14} /> {m.comments.length || ''}</button>
                    <button onClick={() => ecosystem.share({ title: `${nameOf(m.authorId)}的朋友圈`, text: m.text, image: m.images[0], sourceApp: 'im' })}><Share2 size={14} /></button>
                  </div>
                  {(m.likes.length > 0 || m.comments.length > 0) && (
                    <div className="moment-social">
                      {m.likes.length > 0 && <div className="moment-likes"><Heart size={11} fill="currentColor" /> {m.likes.map(nameOf).join('、')} 觉得很赞</div>}
                      {m.comments.map((c) => (
                        <div className="moment-comment" key={c.id}><strong>{nameOf(c.authorId)}</strong>：{c.text}<span>{relativeTime(c.time)}</span></div>
                      ))}
                    </div>
                  )}
                  <div className="moment-comment-form">
                    <input
                      id={`comment-${m.id}`}
                      value={comments[m.id] ?? ''}
                      onChange={(e) => setComments((c) => ({ ...c, [m.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (comments[m.id] ?? '').trim()) {
                          addComment(m.id, comments[m.id].trim())
                          setComments((c) => ({ ...c, [m.id]: '' }))
                        }
                      }}
                      placeholder="写评论…"
                    />
                    <button onClick={() => { const v = (comments[m.id] ?? '').trim(); if (!v) return; addComment(m.id, v); setComments((c) => ({ ...c, [m.id]: '' })) }}><Send size={12} /></button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
      {composer && <MomentComposer onClose={() => setComposer(false)} />}
      {lightbox && (
        <div className="im-modal-back moment-lightbox" onMouseDown={() => setLightbox(null)}>
          <button className="icon-btn lightbox-close" onClick={() => setLightbox(null)}><X size={20} /></button>
          <img src={lightbox} alt="" onMouseDown={(e) => e.stopPropagation()} />
        </div>
      )}
    </section>
  )
}

function MomentComposer({ onClose }: { onClose: () => void }) {
  const addMoment = useSystem((s) => s.addMoment)
  const toast = useSystem((s) => s.toast)
  const [text, setText] = useState('')
  const [location, setLocation] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const pick = async (files: FileList | null) => {
    if (!files) return
    setBusy(true)
    for (const file of Array.from(files).slice(0, 4 - images.length)) {
      if (!file.type.startsWith('image/')) continue
      const thumb = await makeThumbnail(file, 1000, 0.82).catch(() => null)
      if (thumb) {
        setImages((prev) => [...prev, thumb])
        ecosystem.saveFile({ name: file.name, mime: file.type, blob: file, folderName: '图片', sourceApp: 'im', thumb })
      }
    }
    setBusy(false)
  }

  const publish = () => {
    if (!text.trim() && images.length === 0) return
    addMoment({ authorId: 'me', text: text.trim() || '分享一张照片。', images, location: location.trim() || undefined })
    toast('已发布到朋友圈', '好友们可以在星讯里看到。', 'success')
    onClose()
  }

  return (
    <div className="im-modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="im-modal moment-composer">
        <header><div><span className="sheet-eyebrow">NEW MOMENT</span><h3>发布动态</h3></div><button className="icon-btn" onClick={onClose}><X size={17} /></button></header>
        <textarea className="textarea" autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="这一刻的想法…" rows={4} />
        {images.length > 0 && <div className="composer-images">{images.map((img, i) => <div key={i}><img src={img} alt="" /><button onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}><X size={11} /></button></div>)}</div>}
        <div className="field"><MapPin size={14} /><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="所在位置（可选）" /></div>
        <div className="composer-actions">
          <label className="btn sm"><ImagePlus size={14} /> 添加图片<input type="file" accept="image/*" multiple hidden onChange={(e) => pick(e.target.files)} /></label>
          <span className="hint">{images.length}/4 · 图片会自动压缩并存入云巢</span>
          <span className="grow" />
          <button className="btn sm" onClick={onClose}>取消</button>
          <button className="btn primary sm" onClick={publish} disabled={busy || (!text.trim() && images.length === 0)}>发布</button>
        </div>
      </div>
    </div>
  )
}
