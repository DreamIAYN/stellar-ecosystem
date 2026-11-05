import { Command, X } from 'lucide-react'
import { useSystem } from '../core/store'

const GROUPS = [
  { title: '全局', items: [['⌘ K', '打开指令中心'], ['⌘ ⇧ Space', '唤醒小环'], ['⌘ /', '快捷键帮助'], ['Esc', '关闭浮层']] },
  { title: '窗口', items: [['双击标题栏', '最大化 / 还原'], ['⌘ W', '关闭当前窗口'], ['⌘ M', '最小化'], ['拖拽标题栏', '移动窗口']] },
  { title: '应用', items: [['⌘ S', '保存（编辑器 / 笔记）'], ['⌘ Enter', '发送消息'], ['⌘ ⇧ S', '分享当前内容'], ['⌘ P', '搜索当前应用']] },
]

export function Shortcuts() {
  const closeOverlay = useSystem((s) => s.closeOverlay)
  return (
    <div className="overlay-backdrop" onMouseDown={(e) => e.target === e.currentTarget && closeOverlay()}>
      <div className="shortcuts-card" role="dialog" aria-modal>
        <header className="shortcuts-head">
          <div><span className="sheet-eyebrow"><Command size={11} /> KEYBOARD</span><h2>快捷键</h2></div>
          <button className="icon-btn" onClick={closeOverlay}><X size={18} /></button>
        </header>
        <div className="shortcuts-grid">
          {GROUPS.map((g) => (
            <section key={g.title}>
              <h3>{g.title}</h3>
              {g.items.map(([key, action]) => (
                <div className="shortcut-row" key={key}><span>{action}</span><kbd>{key}</kbd></div>
              ))}
            </section>
          ))}
        </div>
        <p className="shortcuts-note">快捷键在 macOS 使用 ⌘，在 Windows / Linux 自动映射为 Ctrl。输入框聚焦时，部分单键快捷键会被忽略。</p>
      </div>
    </div>
  )
}
