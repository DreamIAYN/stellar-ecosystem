import { useEffect, useRef, useState } from 'react'
import { getBlobUrl } from './db'

export function useBlobUrl(blobId?: string | null) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(Boolean(blobId))
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    if (!blobId) {
      setUrl(null)
      setLoading(false)
      return
    }
    setLoading(true)
    getBlobUrl(blobId)
      .then((u) => {
        if (active.current) {
          setUrl(u)
          setLoading(false)
        }
      })
      .catch(() => active.current && setLoading(false))
    return () => {
      active.current = false
    }
  }, [blobId])
  return { url, loading }
}

export function useClock(interval = 1000) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), interval)
    return () => clearInterval(t)
  }, [interval])
  return now
}

export function useClickOutside<T extends HTMLElement>(onOutside: () => void, active = true) {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (!active) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onOutside, active])
  return ref
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => (typeof window === 'undefined' ? false : window.matchMedia(query).matches))
  useEffect(() => {
    const mq = window.matchMedia(query)
    const handler = () => setMatches(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [query])
  return matches
}
