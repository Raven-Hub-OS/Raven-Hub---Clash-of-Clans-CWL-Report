import { useEffect, useId, useRef, useState, type JSX } from 'react'
import { errorMessage } from '../lib/errors'
import { Modal } from './Modal'

interface PromptModalProps {
  title: string
  subtitle?: string
  label: string
  initialValue?: string
  confirmLabel?: string
  onConfirm: (value: string) => Promise<void>
  onClose: () => void
}

export function PromptModal({
  title,
  subtitle,
  label,
  initialValue = '',
  confirmLabel = 'Save',
  onConfirm,
  onClose
}: PromptModalProps): JSX.Element {
  const [value, setValue] = useState(initialValue)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const trimmed = value.trim()

  const handleSubmit = async (): Promise<void> => {
    if (!trimmed || busy) return
    setBusy(true)
    setError(null)
    try {
      await onConfirm(trimmed)
    } catch (submitError) {
      setError(errorMessage(submitError))
      setBusy(false)
    }
  }

  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void handleSubmit()
        }}
      >
        <label className="field-label" htmlFor={inputId}>
          {label}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          className="text-input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={120}
          disabled={busy}
        />
        {error ? <p className="form-error">{error}</p> : null}
        <div className="modal-actions">
          <button
            type="submit"
            className="button button-primary"
            disabled={!trimmed || busy}
          >
            {busy ? 'Saving…' : confirmLabel}
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
      </form>
    </Modal>
  )
}
