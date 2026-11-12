import { useState, type JSX } from 'react'
import type { LibraryFolder } from '@shared/types'
import { errorMessage } from '../lib/errors'
import { FolderSelect } from './FolderSelect'
import { Modal } from './Modal'

interface MoveModalProps {
  title: string
  subtitle?: string
  folders: LibraryFolder[]
  initialFolderId: string | null
  excludeDescendantsOf?: string
  onMove: (folderId: string | null) => Promise<void>
  onClose: () => void
}

export function MoveModal({
  title,
  subtitle,
  folders,
  initialFolderId,
  excludeDescendantsOf,
  onMove,
  onClose
}: MoveModalProps): JSX.Element {
  const [folderId, setFolderId] = useState(initialFolderId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleMove = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await onMove(folderId)
    } catch (moveError) {
      setError(errorMessage(moveError))
      setBusy(false)
    }
  }

  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose}>
      <FolderSelect
        folders={folders}
        value={folderId}
        onChange={setFolderId}
        label="Destination folder"
        excludeDescendantsOf={excludeDescendantsOf}
        disabled={busy}
      />
      {error ? <p className="form-error">{error}</p> : null}
      <div className="modal-actions">
        <button
          type="button"
          className="button button-primary"
          onClick={() => void handleMove()}
          disabled={busy}
        >
          {busy ? 'Moving…' : 'Move here'}
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
