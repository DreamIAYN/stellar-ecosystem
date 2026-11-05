import { getBlob, getBlobUrl, putBlob } from './db'
import { useSystem } from './store'
import type { AppId, Chat, DriveFile, Params, SharePayload } from './types'
import { fileKindLabel, isAudioMime, isImageMime, isVideoMime, nowIso, uid } from './utils'

function state() {
  return useSystem.getState()
}

export interface SaveFileInput {
  name: string
  mime: string
  blob?: Blob
  text?: string
  parentId?: string | null
  folderName?: string
  sourceApp?: AppId
  tags?: string[]
  thumb?: string
  externalUrl?: string
  starred?: boolean
}

export const ecosystem = {
  open(appId: AppId, params: Params = {}, opts?: { maximize?: boolean }) {
    return state().openApp(appId, params, opts)
  },

  openFile(fileId: string) {
    const file = state().files.find((f) => f.id === fileId)
    if (!file) {
      state().toast('文件不存在', '它可能已经从云巢中移除。', 'error')
      return
    }
    if (file.kind === 'folder') {
      state().openApp('drive', { folderId: file.id })
      return
    }
    if (file.externalUrl) {
      if (isAudioMime(file.mime) || isVideoMime(file.mime)) state().openApp('media', { fileId: file.id, autoplay: true })
      else state().openApp('browser', { url: file.externalUrl })
      return
    }
    if (isAudioMime(file.mime) || isVideoMime(file.mime)) {
      state().openApp('media', { fileId: file.id, autoplay: true })
      return
    }
    if (isImageMime(file.mime) || file.mime === 'application/pdf') {
      state().openApp('drive', { previewId: file.id })
      return
    }
    if (file.mime.startsWith('text/') || ['application/json', 'application/javascript', 'application/typescript'].includes(file.mime)) {
      state().openApp('editor', { fileId: file.id })
      return
    }
    state().openApp('drive', { previewId: file.id })
  },

  async saveFile(input: SaveFileInput): Promise<DriveFile> {
    const s = state()
    let parentId = input.parentId ?? null
    if (parentId === null && input.folderName) {
      const folder = s.files.find((f) => f.kind === 'folder' && f.name === input.folderName && !f.trashed)
      if (folder) parentId = folder.id
    }
    let blobId: string | undefined
    let size = input.text?.length ?? 0
    if (input.blob) {
      blobId = await putBlob(input.blob)
      size = input.blob.size
    }
    const file = state().addFile({
      name: input.name,
      kind: 'file',
      parentId,
      mime: input.mime,
      size,
      blobId,
      text: input.text,
      externalUrl: input.externalUrl,
      sourceApp: input.sourceApp ?? 'drive',
      tags: input.tags,
      thumb: input.thumb,
      starred: input.starred,
    })
    return file
  },

  async saveText(input: { name: string; text: string; mime?: string; folderName?: string; parentId?: string | null; sourceApp?: AppId; tags?: string[] }) {
    return this.saveFile({
      name: input.name,
      mime: input.mime ?? 'text/plain',
      text: input.text,
      folderName: input.folderName,
      parentId: input.parentId,
      sourceApp: input.sourceApp,
      tags: input.tags,
    })
  },

  async getFileBlob(file: DriveFile): Promise<Blob | null> {
    if (file.externalUrl) {
      try {
        const res = await fetch(file.externalUrl)
        if (!res.ok) throw new Error(String(res.status))
        return await res.blob()
      } catch {
        return null
      }
    }
    if (file.blobId) return getBlob(file.blobId)
    if (file.text !== undefined) return new Blob([file.text], { type: file.mime || 'text/plain' })
    return null
  },

  async getFileUrl(file: DriveFile): Promise<string | null> {
    if (file.externalUrl) return file.externalUrl
    if (file.blobId) return getBlobUrl(file.blobId)
    if (file.text !== undefined) return URL.createObjectURL(new Blob([file.text], { type: file.mime || 'text/plain' }))
    return null
  },

  async getFileText(file: DriveFile): Promise<string> {
    if (file.text !== undefined) return file.text
    if (file.blobId) {
      const blob = await getBlob(file.blobId)
      if (blob) return blob.text()
    }
    return ''
  },

  share(payload: SharePayload) {
    state().openShare(payload)
  },

  askAI(payload: { prompt: string; context?: string; system?: string; origin?: AppId; autoSend?: boolean }) {
    state().addAIRequest(payload)
    state().openApp('ai', { focusComposer: true })
  },

  notify(title: string, body: string, appId: AppId = 'settings', action?: { appId: AppId; params?: Params }) {
    state().notify({ appId, title, body, action })
  },

  toast(title: string, body?: string, kind: 'info' | 'success' | 'error' = 'info') {
    state().toast(title, body, kind)
  },

  sendFileToChat(fileId: string, chatId: string, text?: string) {
    const file = state().files.find((f) => f.id === fileId)
    if (!file) return
    state().sendMessage(chatId, { senderId: 'me', kind: 'file', fileId, text: text ?? file.name, status: 'sent' })
    state().openApp('im', { chatId })
  },

  sendTextToChat(chatId: string, text: string) {
    state().sendMessage(chatId, { senderId: 'me', kind: 'text', text, status: 'sent' })
  },

  openChat(chat: Chat) {
    state().openApp('im', { chatId: chat.id })
  },

  startCall(chatId: string, kind: 'voice' | 'video') {
    state().openApp('im', { chatId, call: { kind, chatId } })
  },

  startMeeting(room?: string) {
    state().openApp('meeting', { room })
  },

  scan(mode: 'document' | 'exam' | 'idcard' = 'document') {
    state().openApp('scanner', { mode })
  },

  newNote() {
    state().openApp('notes')
  },

  async copyFileToDrive(file: DriveFile) {
    const blob = await this.getFileBlob(file)
    return this.saveFile({
      name: `副本-${file.name}`,
      mime: file.mime,
      blob: blob ?? undefined,
      text: file.text,
      parentId: file.parentId,
      sourceApp: file.sourceApp,
    })
  },

  describeFile(file: DriveFile) {
    return `${fileKindLabel(file.name)} · ${file.mime}`
  },

  makeShareFromFile(file: DriveFile): SharePayload {
    return {
      title: file.name,
      fileId: file.id,
      blobId: file.blobId,
      text: file.text?.slice(0, 160),
      sourceApp: file.sourceApp,
    }
  },

  async ensureFolder(name: string, parentId: string | null = null): Promise<DriveFile> {
    const existing = state().files.find((f) => f.kind === 'folder' && f.name === name && f.parentId === parentId && !f.trashed)
    if (existing) return existing
    return state().addFile({
      name,
      kind: 'folder',
      parentId,
      mime: 'application/x-folder',
      size: 0,
      sourceApp: 'drive',
    })
  },

  async saveScanPdf(blob: Blob, name: string) {
    return this.saveFile({ name, mime: 'application/pdf', blob, folderName: '扫描件', sourceApp: 'scanner', tags: ['扫描'] })
  },

  newId(prefix = 'id') {
    return uid(prefix)
  },

  now() {
    return nowIso()
  },
}

export type Ecosystem = typeof ecosystem
