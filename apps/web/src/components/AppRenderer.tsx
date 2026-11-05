import { lazy, Suspense, type ComponentType } from 'react'
import type { AppId, Params } from '../core/types'
import { AppErrorBoundary } from './AppErrorBoundary'

export interface AppProps {
  params: Params
  winId: string
}

const IMApp = lazy(() => import('../apps/im/IMApp'))
const DriveApp = lazy(() => import('../apps/drive/DriveApp'))
const MediaApp = lazy(() => import('../apps/media/MediaApp'))
const ScannerApp = lazy(() => import('../apps/scanner/ScannerApp'))
const AIApp = lazy(() => import('../apps/ai/AIApp'))
const MeetingApp = lazy(() => import('../apps/meeting/MeetingApp'))
const EditorApp = lazy(() => import('../apps/editor/EditorApp'))
const RemoteApp = lazy(() => import('../apps/remote/RemoteApp'))
const NotesApp = lazy(() => import('../apps/notes/NotesApp'))
const BrowserApp = lazy(() => import('../apps/browser/BrowserApp'))
const AssistantApp = lazy(() => import('../apps/assistant/AssistantApp'))
const SettingsApp = lazy(() => import('../apps/settings/SettingsApp'))

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
