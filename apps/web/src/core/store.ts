import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { APP_MAP } from './registry'
import {
  AI_CONVERSATIONS,
  BOOKMARKS,
  CHATS,
  CONTACTS,
  DRIVE_FILES,
  INITIAL_TABS,
  MEETINGS,
  MOMENTS,
  NOTEBOOKS,
  NOTIFICATIONS,
  PREFERENCES,
  PROFILE,
  PROVIDERS,
  SCAN_DOCS,
  seedAll,
} from './seed'
import type {
  AIConversation,
  AIMessage,
  AIProvider,
  AIRequest,
  AppId,
  Bookmark,
  BrowserTab,
  Chat,
  ChatMessage,
  Contact,
  DriveFile,
  MeetingRecord,
  Moment,
  MomentComment,
  Notebook,
  NotePage,
  NotificationItem,
  Params,
  Preferences,
  Profile,
  ScanDoc,
  SharePayload,
  Stroke,
  ToastItem,
  WindowState,
} from './types'
import { clamp, nowIso, uid } from './utils'

export type Overlay = 'palette' | 'share' | 'notifications' | 'launcher' | 'shortcuts' | null

export interface SystemState {
  files: DriveFile[]
  chats: Chat[]
  contacts: Contact[]
  moments: Moment[]
  notifications: NotificationItem[]
  providers: AIProvider[]
  conversations: AIConversation[]
  selectedProviderId: string
  activeConversationId: string
  notebooks: Notebook[]
  bookmarks: Bookmark[]
  browserTabs: BrowserTab[]
  profile: Profile
  preferences: Preferences
  scanDocs: ScanDoc[]
  meetings: MeetingRecord[]

  windows: WindowState[]
  toasts: ToastItem[]
  overlay: Overlay
  sharePayload: SharePayload | null
  aiQueue: AIRequest[]
  selection: { appId: AppId; label: string; text: string } | null

  openApp: (appId: AppId, params?: Params, opts?: { maximize?: boolean }) => string
  closeWindow: (id: string) => void
  focusWindow: (id: string) => void
  minimizeWindow: (id: string) => void
  toggleMaximize: (id: string) => void
  updateWindow: (id: string, patch: Partial<WindowState>) => void
  setWindowParams: (id: string, params: Params) => void

  notify: (item: Omit<NotificationItem, 'id' | 'time' | 'read'> & { time?: string }) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  dismissNotification: (id: string) => void
  toast: (title: string, body?: string, kind?: ToastItem['kind']) => void
  dismissToast: (id: string) => void

  openOverlay: (overlay: Overlay) => void
  closeOverlay: () => void
  openShare: (payload: SharePayload) => void
  setSelection: (selection: SystemState['selection']) => void

  addFile: (file: Omit<DriveFile, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; createdAt?: string; updatedAt?: string }) => DriveFile
  updateFile: (id: string, patch: Partial<DriveFile>) => void
  trashFile: (id: string) => void
  restoreFile: (id: string) => void
  deleteFileForever: (id: string) => void
  moveFile: (id: string, parentId: string | null) => void

  sendMessage: (chatId: string, message: Omit<ChatMessage, 'id' | 'time'> & { id?: string; time?: string }) => ChatMessage
  addChatMessage: (chatId: string, message: ChatMessage) => void
  createDirectChat: (contactId: string) => string
  markChatRead: (chatId: string) => void
  togglePinChat: (chatId: string) => void
  setChatDraft: (chatId: string, draft: string) => void

  addMoment: (moment: Omit<Moment, 'id' | 'time' | 'likes' | 'comments'>) => void
  toggleLikeMoment: (id: string) => void
  addMomentComment: (id: string, text: string) => void

  addProvider: (provider: AIProvider) => void
  updateProvider: (id: string, patch: Partial<AIProvider>) => void
  selectProvider: (id: string) => void
  addConversation: (conversation?: Partial<AIConversation>) => string
  updateConversation: (id: string, patch: Partial<AIConversation>) => void
  deleteConversation: (id: string) => void
  setActiveConversation: (id: string) => void
  appendAIMessage: (conversationId: string, message: AIMessage) => void
  patchAIMessage: (conversationId: string, messageId: string, patch: Partial<AIMessage>) => void
  addAIRequest: (request: Omit<AIRequest, 'id'> & { id?: string }) => string
  consumeAIRequest: (id: string) => void

  addNotebook: (notebook?: Partial<Notebook>) => string
  updateNotebook: (id: string, patch: Partial<Notebook>) => void
  addNotePage: (notebookId: string) => string
  updateNotePage: (notebookId: string, pageId: string, patch: Partial<NotePage>) => void
  deleteNotebook: (id: string) => void

  updateBrowserTab: (id: string, patch: Partial<BrowserTab>) => void
  addBrowserTab: (url?: string) => string
  closeBrowserTab: (id: string) => void
  addBookmark: (bookmark: Omit<Bookmark, 'id'>) => void
  removeBookmark: (id: string) => void

  addScanDoc: (doc: ScanDoc) => void
  updateScanDoc: (id: string, patch: Partial<ScanDoc>) => void
  deleteScanDoc: (id: string) => void
  addMeetingRecord: (record: MeetingRecord) => void

  setProfile: (patch: Partial<Profile>) => void
  setPreferences: (patch: Partial<Preferences>) => void
  resetDemo: () => void
  importSnapshot: (snapshot: Partial<SystemState>) => void
}

const seed = {
  files: DRIVE_FILES,
  chats: CHATS,
  contacts: CONTACTS,
  moments: MOMENTS,
  notifications: NOTIFICATIONS,
  providers: PROVIDERS,
  conversations: AI_CONVERSATIONS,
  selectedProviderId: 'demo',
  activeConversationId: 'conv-welcome',
  notebooks: NOTEBOOKS,
  bookmarks: BOOKMARKS,
  browserTabs: INITIAL_TABS,
  profile: PROFILE,
  preferences: PREFERENCES,
  scanDocs: SCAN_DOCS,
  meetings: MEETINGS,
}

export const useSystem = create<SystemState>()(
  persist(
    (set, get) => ({
      ...seed,
      windows: [],
      toasts: [],
      overlay: null,
      sharePayload: null,
      aiQueue: [],
      selection: null,

      openApp: (appId, params = {}, opts) => {
        const state = get()
        const existing = state.windows.find((w) => w.appId === appId)
        const z = Math.max(10, ...state.windows.map((w) => w.z)) + 1
        if (existing) {
          set({
            windows: state.windows.map((w) =>
              w.id === existing.id
                ? {
                    ...w,
                    params: { ...w.params, ...params },
                    minimized: false,
                    maximized: opts?.maximize ?? w.maximized,
                    z,
                  }
                : w,
            ),
            overlay: null,
          })
          return existing.id
        }
        const def = APP_MAP[appId]
        const vw = typeof window === 'undefined' ? 1440 : window.innerWidth
        const vh = typeof window === 'undefined' ? 900 : window.innerHeight
        const compact = vw < 820
        const w = compact ? vw : Math.min(def.defaultSize.w, vw - 72)
        const h = compact ? vh : Math.min(def.defaultSize.h, vh - 108)
        const cascade = (state.windows.length % 5) * 24
        const x = compact ? 0 : clamp((vw - w) / 2 + cascade - 28, 18, vw - w - 18)
        const y = compact ? 0 : clamp((vh - h) / 2 + cascade - 34, 58, vh - h - 34)
        const id = `${appId}-${uid('w')}`
        const win: WindowState = {
          id,
          appId,
          title: def.name,
          params,
          x,
          y,
          w,
          h,
          z,
          minimized: false,
          maximized: compact || Boolean(opts?.maximize),
          createdAt: Date.now(),
        }
        set({ windows: [...state.windows, win], overlay: null })
        return id
      },

      closeWindow: (id) => set({ windows: get().windows.filter((w) => w.id !== id) }),
      focusWindow: (id) => {
        const state = get()
        const z = Math.max(10, ...state.windows.map((w) => w.z)) + 1
        set({ windows: state.windows.map((w) => (w.id === id ? { ...w, z, minimized: false } : w)) })
      },
      minimizeWindow: (id) => set({ windows: get().windows.map((w) => (w.id === id ? { ...w, minimized: true } : w)) }),
      toggleMaximize: (id) => set({ windows: get().windows.map((w) => (w.id === id ? { ...w, maximized: !w.maximized } : w)) }),
      updateWindow: (id, patch) => set({ windows: get().windows.map((w) => (w.id === id ? { ...w, ...patch } : w)) }),
      setWindowParams: (id, params) =>
        set({ windows: get().windows.map((w) => (w.id === id ? { ...w, params: { ...w.params, ...params } } : w)) }),

      notify: (item) => {
        const n: NotificationItem = { ...item, id: uid('n'), time: item.time ?? nowIso(), read: false }
        set({ notifications: [n, ...get().notifications].slice(0, 60) })
      },
      markNotificationRead: (id) => set({ notifications: get().notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }),
      markAllNotificationsRead: () => set({ notifications: get().notifications.map((n) => ({ ...n, read: true })) }),
      dismissNotification: (id) => set({ notifications: get().notifications.filter((n) => n.id !== id) }),

      toast: (title, body, kind = 'info') => {
        const id = uid('toast')
        set({ toasts: [...get().toasts, { id, title, body, kind }] })
        setTimeout(() => get().dismissToast(id), 3800)
      },
      dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

      openOverlay: (overlay) => set({ overlay }),
      closeOverlay: () => set({ overlay: null, sharePayload: null }),
      openShare: (payload) => set({ overlay: 'share', sharePayload: payload }),
      setSelection: (selection) => set({ selection }),

      addFile: (file) => {
        const now = nowIso()
        const item: DriveFile = {
          ...file,
          id: file.id ?? uid('file'),
          createdAt: file.createdAt ?? now,
          updatedAt: file.updatedAt ?? now,
        }
        set({ files: [item, ...get().files] })
        return item
      },
      updateFile: (id, patch) => set({ files: get().files.map((f) => (f.id === id ? { ...f, ...patch, updatedAt: patch.updatedAt ?? nowIso() } : f)) }),
      trashFile: (id) => {
        const all = get().files
        const ids = new Set([id])
        let changed = true
        while (changed) {
          changed = false
          for (const f of all) {
            if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
              ids.add(f.id)
              changed = true
            }
          }
        }
        set({ files: all.map((f) => (ids.has(f.id) ? { ...f, trashed: true, updatedAt: nowIso() } : f)) })
      },
      restoreFile: (id) => {
        const all = get().files
        const ids = new Set([id])
        let changed = true
        while (changed) {
          changed = false
          for (const f of all) {
            if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
              ids.add(f.id)
              changed = true
            }
          }
        }
        set({ files: all.map((f) => (ids.has(f.id) ? { ...f, trashed: false, updatedAt: nowIso() } : f)) })
      },
      deleteFileForever: (id) => {
        const all = get().files
        const ids = new Set([id])
        let changed = true
        while (changed) {
          changed = false
          for (const f of all) {
            if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
              ids.add(f.id)
              changed = true
            }
          }
        }
        set({ files: all.filter((f) => !ids.has(f.id)) })
      },
      moveFile: (id, parentId) => set({ files: get().files.map((f) => (f.id === id ? { ...f, parentId, updatedAt: nowIso() } : f)) }),

      sendMessage: (chatId, message) => {
        const msg: ChatMessage = { ...message, id: message.id ?? uid('m'), time: message.time ?? nowIso() }
        set({
          chats: get().chats.map((c) =>
            c.id === chatId
              ? { ...c, messages: [...c.messages, msg], updatedAt: msg.time, unread: 0, draft: '' }
              : c,
          ),
        })
        return msg
      },
      addChatMessage: (chatId, message) =>
        set({ chats: get().chats.map((c) => (c.id === chatId ? { ...c, messages: [...c.messages, message], updatedAt: message.time } : c)) }),
      createDirectChat: (contactId) => {
        const existing = get().chats.find((c) => c.type === 'direct' && c.members.includes(contactId))
        if (existing) {
          get().openApp('im', { chatId: existing.id })
          return existing.id
        }
        const contact = get().contacts.find((c) => c.id === contactId)
        if (!contact) return 'chat-lin'
        const chat: Chat = {
          id: uid('chat'),
          type: 'direct',
          name: contact.name,
          avatarHue: contact.hue,
          members: [contact.id],
          messages: [],
          unread: 0,
          online: contact.online,
          signature: contact.signature,
          updatedAt: nowIso(),
        }
        set({ chats: [chat, ...get().chats] })
        get().openApp('im', { chatId: chat.id })
        return chat.id
      },
      markChatRead: (chatId) => set({ chats: get().chats.map((c) => (c.id === chatId ? { ...c, unread: 0 } : c)) }),
      togglePinChat: (chatId) => set({ chats: get().chats.map((c) => (c.id === chatId ? { ...c, pinned: !c.pinned } : c)) }),
      setChatDraft: (chatId, draft) => set({ chats: get().chats.map((c) => (c.id === chatId ? { ...c, draft } : c)) }),

      addMoment: (moment) =>
        set({
          moments: [
            { ...moment, id: uid('moment'), time: nowIso(), likes: [], comments: [] },
            ...get().moments,
          ],
        }),
      toggleLikeMoment: (id) =>
        set({
          moments: get().moments.map((m) => {
            if (m.id !== id) return m
            return { ...m, likes: m.likes.includes('me') ? m.likes.filter((x) => x !== 'me') : [...m.likes, 'me'] }
          }),
        }),
      addMomentComment: (id, text) => {
        const comment: MomentComment = { id: uid('cm'), authorId: 'me', text, time: nowIso() }
        set({ moments: get().moments.map((m) => (m.id === id ? { ...m, comments: [...m.comments, comment] } : m)) })
      },

      addProvider: (provider) => set({ providers: [...get().providers, provider] }),
      updateProvider: (id, patch) => set({ providers: get().providers.map((p) => (p.id === id ? { ...p, ...patch } : p)) }),
      selectProvider: (id) => set({ selectedProviderId: id }),
      addConversation: (conversation) => {
        const now = nowIso()
        const conv: AIConversation = {
          id: conversation?.id ?? uid('conv'),
          title: conversation?.title ?? '新的对话',
          messages: conversation?.messages ?? [],
          system: conversation?.system,
          createdAt: conversation?.createdAt ?? now,
          updatedAt: conversation?.updatedAt ?? now,
        }
        set({ conversations: [conv, ...get().conversations], activeConversationId: conv.id })
        return conv.id
      },
      updateConversation: (id, patch) => set({ conversations: get().conversations.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: nowIso() } : c)) }),
      deleteConversation: (id) => {
        const remaining = get().conversations.filter((c) => c.id !== id)
        set({ conversations: remaining, activeConversationId: remaining[0]?.id ?? '' })
      },
      setActiveConversation: (id) => set({ activeConversationId: id }),
      appendAIMessage: (conversationId, message) =>
        set({
          conversations: get().conversations.map((c) =>
            c.id === conversationId ? { ...c, messages: [...c.messages, message], updatedAt: nowIso() } : c,
          ),
        }),
      patchAIMessage: (conversationId, messageId, patch) =>
        set({
          conversations: get().conversations.map((c) =>
            c.id === conversationId
              ? { ...c, messages: c.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m)) }
              : c,
          ),
        }),
      addAIRequest: (request) => {
        const item: AIRequest = { ...request, id: request.id ?? uid('req') }
        set({ aiQueue: [...get().aiQueue, item] })
        return item.id
      },
      consumeAIRequest: (id) => set({ aiQueue: get().aiQueue.filter((r) => r.id !== id) }),

      addNotebook: (notebook) => {
        const now = nowIso()
        const nb: Notebook = {
          id: notebook?.id ?? uid('notebook'),
          title: notebook?.title ?? '未命名笔记',
          coverHue: notebook?.coverHue ?? Math.floor(Math.random() * 360),
          pages: notebook?.pages ?? [{ id: uid('page'), strokes: [], template: 'lined' }],
          createdAt: notebook?.createdAt ?? now,
          updatedAt: notebook?.updatedAt ?? now,
        }
        set({ notebooks: [nb, ...get().notebooks] })
        return nb.id
      },
      updateNotebook: (id, patch) => set({ notebooks: get().notebooks.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: nowIso() } : n)) }),
      addNotePage: (notebookId) => {
        const pageId = uid('page')
        set({
          notebooks: get().notebooks.map((n) =>
            n.id === notebookId ? { ...n, pages: [...n.pages, { id: pageId, strokes: [], template: n.pages.at(-1)?.template ?? 'lined' }], updatedAt: nowIso() } : n,
          ),
        })
        return pageId
      },
      updateNotePage: (notebookId, pageId, patch) =>
        set({
          notebooks: get().notebooks.map((n) =>
            n.id === notebookId
              ? { ...n, pages: n.pages.map((p) => (p.id === pageId ? { ...p, ...patch } : p)), updatedAt: nowIso() }
              : n,
          ),
        }),
      deleteNotebook: (id) => set({ notebooks: get().notebooks.filter((n) => n.id !== id) }),

      updateBrowserTab: (id, patch) => set({ browserTabs: get().browserTabs.map((t) => (t.id === id ? { ...t, ...patch } : t)) }),
      addBrowserTab: (url) => {
        const id = uid('tab')
        const start = url ?? 'stellar://start'
        set({ browserTabs: [...get().browserTabs, { id, url: start, title: '新标签页', history: [start], index: 0 }] })
        return id
      },
      closeBrowserTab: (id) => {
        const tabs = get().browserTabs
        if (tabs.length <= 1) {
          set({ browserTabs: [{ id: uid('tab'), url: 'stellar://start', title: '起始页', history: ['stellar://start'], index: 0 }] })
          return
        }
        set({ browserTabs: tabs.filter((t) => t.id !== id) })
      },
      addBookmark: (bookmark) => set({ bookmarks: [...get().bookmarks, { ...bookmark, id: uid('bm') }] }),
      removeBookmark: (id) => set({ bookmarks: get().bookmarks.filter((b) => b.id !== id) }),

      addScanDoc: (doc) => set({ scanDocs: [doc, ...get().scanDocs] }),
      updateScanDoc: (id, patch) => set({ scanDocs: get().scanDocs.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: nowIso() } : d)) }),
      deleteScanDoc: (id) => set({ scanDocs: get().scanDocs.filter((d) => d.id !== id) }),
      addMeetingRecord: (record) => set({ meetings: [record, ...get().meetings].slice(0, 30) }),

      setProfile: (patch) => set({ profile: { ...get().profile, ...patch } }),
      setPreferences: (patch) => set({ preferences: { ...get().preferences, ...patch } }),
      resetDemo: () =>
        set({
          ...seed,
          windows: [],
          toasts: [],
          overlay: null,
          sharePayload: null,
          aiQueue: [],
          selection: null,
        }),
      importSnapshot: (snapshot) => {
        const allowed: (keyof SystemState)[] = [
          'files',
          'chats',
          'contacts',
          'moments',
          'notifications',
          'providers',
          'conversations',
          'notebooks',
          'bookmarks',
          'browserTabs',
          'profile',
          'preferences',
          'scanDocs',
          'meetings',
        ]
        const patch: Record<string, unknown> = {}
        for (const key of allowed) {
          if (snapshot[key] !== undefined) patch[key] = snapshot[key]
        }
        set(patch as Partial<SystemState>)
      },
    }),
    {
      name: 'stellar-ecosystem-v1',
      version: 1,
      partialize: (state) => ({
        files: state.files,
        chats: state.chats,
        contacts: state.contacts,
        moments: state.moments,
        notifications: state.notifications,
        providers: state.providers,
        conversations: state.conversations,
        selectedProviderId: state.selectedProviderId,
        activeConversationId: state.activeConversationId,
        notebooks: state.notebooks,
        bookmarks: state.bookmarks,
        browserTabs: state.browserTabs,
        profile: state.profile,
        preferences: state.preferences,
        scanDocs: state.scanDocs,
        meetings: state.meetings,
        windows: state.windows,
      }),
    },
  ),
)

export type SeedShape = ReturnType<typeof seedAll>
