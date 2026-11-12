import type { JSX } from 'react'
import { CheckCircleIcon, FolderIcon, XIcon } from './Icons'

export interface ToastData {
  kind: 'success' | 'error'
  title: string
  message?: string
  filePath?: string
}

interface ToastProps {
  toast: ToastData
  onClose: () => void
  onShowItem: (filePath: string) => void
}

export function Toast({ toast, onClose, onShowItem }: ToastProps): JSX.Element {
  return (
    <div
      className={`toast toast-${toast.kind}`}
      role={toast.kind === 'error' ? 'alert' : 'status'}
    >
      <div className="toast-icon" aria-hidden="true">
        {toast.kind === 'success' ? <CheckCircleIcon size={21} /> : <XIcon size={21} />}
      </div>
      <div className="toast-content">
        <p className="toast-title">{toast.title}</p>
        {toast.message ? (
          <p className="toast-message" title={toast.message}>
            {toast.message}
          </p>
        ) : null}
        {toast.filePath ? (
          <button
            type="button"
            className="toast-action"
            onClick={() => onShowItem(toast.filePath as string)}
          >
            <FolderIcon size={15} />
            Show in folder
          </button>
        ) : null}
      </div>
      <button type="button" className="icon-button toast-close" onClick={onClose} aria-label="Dismiss">
        <XIcon size={16} />
      </button>
    </div>
  )
}
