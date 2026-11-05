import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react'
import type { AppId, Params } from '../core/types'
import { AppErrorBoundary } from './AppErrorBoundary'

export interface AppProps {
  params: Params
  winId: string
}

const CHUNK_RETRY_KEY = 'stellar-chunk-retry'

function lazyWithRetry(factory: () => Promise<{ default: ComponentType<AppProps> }>): LazyExoticComponent<ComponentType<AppProps>> {
  return lazy(async () => {
    try {
      return await factory()
    } catch (error) {
      // A deployment can replace an old index.html whose hashed chunk has been
      // removed. Reload once with cache-busting headers so the browser picks
      // up the new manifest instead of showing "app offline".
      if (!sessionStorage.getItem(CHUNK_RETRY_KEY)) {
        sessionStorage.setItem(CHUNK_RETRY_KEY, '1')
        const url = new URL(location.href)
        url.searchParams.set('v', String(Date.now()))
        location.replace(url.toString())
      }
      throw error
    }
  })
}

const IMApp = lazyWithRetry(() => import('../apps/im/IMApp'))
const DriveApp = lazyWithRetry(() => import('../apps/drive/DriveApp'))
const MediaApp = lazyWithRetry(() => import('../apps/media/MediaApp'))
const ScannerApp = lazyWithRetry(() => import('../apps/scanner/ScannerApp'))
const AIApp = lazyWithRetry(() => import('../apps/ai/AIApp'))
const MeetingApp = lazyWithRetry(() => import('../apps/meeting/MeetingApp'))
const EditorApp = lazyWithRetry(() => import('../apps/editor/EditorApp'))
const RemoteApp = lazyWithRetry(() => import('../apps/remote/RemoteApp'))
const NotesApp = lazyWithRetry(() => import('../apps/notes/NotesApp'))
const BrowserApp = lazyWithRetry(() => import('../apps/browser/BrowserApp'))
const AssistantApp = lazyWithRetry(() => import('../apps/assistant/AssistantApp'))
const SettingsApp = lazyWithRetry(() => import('../apps/settings/SettingsApp'))

const REGISTRY: Record<AppId, ComponentType<AppProps>> = {
  im: IMApp,
  drive: DriveApp,
  media: MediaApp,
  scanner: ScannerApp,
  ai: AIApp,
  meeting: MeetingApp,
  editor: EditorApp,
  remote: RemoteApp,
  notes: NotesApp,
  browser: BrowserApp,
  assistant: AssistantApp,
  settings: SettingsApp,
}

export function AppRenderer({ appId, params, winId }: { appId: AppId; params: Params; winId: string }) {
  const Comp = REGISTRY[appId]
  return (
    <AppErrorBoundary app={appId}>
      <Suspense fallback={<div className="app-loading"><span className="spinner" /><span>正在装载 {appId}…</span></div>}>
        <Comp params={params} winId={winId} />
      </Suspense>
    </AppErrorBoundary>
  )
}
