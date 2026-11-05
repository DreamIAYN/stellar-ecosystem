import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useSystem } from '../core/store'

export function Toasts() {
  const toasts = useSystem((s) => s.toasts)
  const dismiss = useSystem((s) => s.dismissToast)
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <span className="toast-icon">
            {t.kind === 'success' ? <CheckCircle2 size={16} /> : t.kind === 'error' ? <XCircle size={16} /> : <Info size={16} />}
          </span>
          <div className="grow">
            <div className="toast-title">{t.title}</div>
            {t.body && <div className="toast-body">{t.body}</div>}
          </div>
          <button className="icon-btn sm" onClick={() => dismiss(t.id)} aria-label="关闭提示"><X size={13} /></button>
        </div>
      ))}
    </div>
  )
}
