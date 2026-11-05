export type AppId =
  | 'im'
  | 'drive'
  | 'media'
  | 'scanner'
  | 'ai'
  | 'meeting'
  | 'editor'
  | 'remote'
  | 'notes'
  | 'browser'
  | 'assistant'
  | 'settings'

export type AppCategory = '沟通' | '存储' | '媒体' | '创作' | '智能' | '协作' | '系统'
export type Params = Record<string, unknown>

export interface AppDefinition {
  id: AppId
  name: string
  en: string
  tagline: string
  description: string
  category: AppCategory
  hue: string
  hue2: string
  dock: boolean
  defaultSize: { w: number; h: number }
}

export interface WindowState {
  id: string
  appId: AppId
  title: string
  params: Params
  x: number
  y: number
  w: number
  h: number
  z: number
  minimized: boolean
  maximized: boolean
  createdAt: number
}

export interface NotificationItem {
  id: string
  appId: AppId
  title: string
  body: string
  time: string
  read: boolean
  action?: { appId: AppId; params?: Params }
}

export type DriveFileKind = 'file' | 'folder'

export interface DriveFile {
  id: string
  name: string
  kind: DriveFileKind
  parentId: string | null
  mime: string
  size: number
  blobId?: string
  text?: string
  externalUrl?: string
  thumb?: string
  starred?: boolean
  trashed?: boolean
  createdAt: string
  updatedAt: string
  sourceApp?: AppId
  tags?: string[]
}

export interface ChatMessage {
  id: string
  senderId: 'me' | string
  kind: 'text' | 'image' | 'file' | 'voice' | 'system' | 'call' | 'link'
  text?: string
  fileId?: string
  blobId?: string
  image?: string
  duration?: number
  time: string
  status?: 'sent' | 'read' | 'sending'
  callKind?: 'voice' | 'video'
  linkParams?: Params
}

export interface Chat {
  id: string
  type: 'direct' | 'group'
  name: string
  avatarHue: number
  members: string[]
  messages: ChatMessage[]
  unread: number
  pinned?: boolean
  muted?: boolean
  online?: boolean
  signature?: string
  isAI?: boolean
  draft?: string
  updatedAt: string
}

export interface Contact {
  id: string
  name: string
  hue: number
  online: boolean
  signature: string
  region?: string
  tags?: string[]
  email?: string
}

export interface MomentComment {
  id: string
  authorId: string
  text: string
  time: string
}

export interface Moment {
  id: string
  authorId: string
  text: string
  images: string[]
  time: string
  likes: string[]
  comments: MomentComment[]
  location?: string
}

export type ProviderKind = 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'demo'

export interface AIProvider {
  id: string
  kind: ProviderKind
  label: string
  baseUrl: string
  apiKey: string
  model: string
  models: string[]
  color: string
}

export interface AIMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  time: string
  providerId?: string
  model?: string
  error?: boolean
  pending?: boolean
  context?: string
}

export interface AIConversation {
  id: string
  title: string
  messages: AIMessage[]
  system?: string
  createdAt: string
  updatedAt: string
}

export interface AIRequest {
  id: string
  prompt: string
  context?: string
  system?: string
  origin?: AppId
  autoSend?: boolean
}

export interface SharePayload {
  title: string
  text?: string
  url?: string
  fileId?: string
  blobId?: string
  sourceApp?: AppId
  image?: string
}

export interface Point {
  x: number
  y: number
  p: number
}

export interface Stroke {
  id: string
  tool: 'pen' | 'marker' | 'eraser'
  color: string
  width: number
  points: Point[]
}

export type NoteTemplate = 'blank' | 'lined' | 'grid' | 'dot'

export interface NoteText {
  id: string
  x: number
  y: number
  text: string
  color: string
  size: number
}

export interface NotePage {
  id: string
  strokes: Stroke[]
  texts?: NoteText[]
  template: NoteTemplate
}

export interface Notebook {
  id: string
  title: string
  pages: NotePage[]
  coverHue: number
  createdAt: string
  updatedAt: string
}

export interface BrowserTab {
  id: string
  url: string
  title: string
  history: string[]
  index: number
}

export interface Bookmark {
  id: string
  title: string
  url: string
  hue: number
}

export interface MeetingRecord {
  id: string
  code: string
  title: string
  startedAt: string
  duration: number
  participants: number
}

export interface ScanPage {
  id: string
  blobId: string
  thumb: string
  originalName?: string
  rotation: number
  filter: string
}

export interface ScanDoc {
  id: string
  title: string
  mode: 'document' | 'exam' | 'idcard'
  pages: ScanPage[]
  createdAt: string
  updatedAt: string
}

export interface Preferences {
  accent: 'aurora' | 'violet' | 'amber' | 'rose'
  wallpaper: 'orbit' | 'aurora' | 'grid'
  deviceName: string
  reduceMotion: boolean
  language: 'zh-CN' | 'en'
}

export interface Profile {
  name: string
  handle: string
  hue: number
  bio: string
}

export interface ToastItem {
  id: string
  title: string
  body?: string
  kind: 'info' | 'success' | 'error'
}

export interface SearchHit {
  id: string
  kind: 'app' | 'file' | 'chat' | 'note' | 'action' | 'bookmark'
  title: string
  subtitle?: string
  appId?: AppId
  params?: Params
  action?: () => void
}
