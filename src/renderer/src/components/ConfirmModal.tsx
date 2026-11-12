import { useState, type JSX, type ReactNode } from 'react'
import { errorMessage } from '../lib/errors'
import { Modal } from './Modal'

interface ConfirmModalProps {
  title: string
  subtitle?: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => Promise<void>
  onClose: () => void
  children: ReactNode
}

export function ConfirmModal({
  title,
  subtitle,
  confirmLabel = 'Confirm',
  danger = false,
  onConfirm,
  onClose,
  children
}: ConfirmModalProps): JSX.Element {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
    } catch (confirmError) {
      setError(errorMessage(confirmError))
      setBusy(false)
    }
  }

  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose}>
      <div className="confirm-copy">{children}</div>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="modal-actions">
        <button
          type="button"
          className={`button ${danger ? 'button-danger' : 'button-primary'}`}
          onClick={() => void handleConfirm()}
          disabled={busy}
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
        <button
          type="button"
          className="button button-secondary"
          onClick={onClose}
          disabled={busy}
        >
          Cancel
        </button>
      </div>
    </Modal>
  )
}
