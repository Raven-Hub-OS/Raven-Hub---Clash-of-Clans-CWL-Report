import { useEffect, useId, useState, type JSX } from 'react'
import type { LibrarySnapshot } from '@shared/types'
import { errorMessage } from '../lib/errors'
import { FolderSelect } from './FolderSelect'
import { Modal } from './Modal'

interface SaveRosterModalProps {
  initialName: string
  initialFolderId: string | null
  onSave: (name: string, folderId: string | null) => Promise<void>
  onClose: () => void
}

export function SaveRosterModal({
  initialName,
  initialFolderId,
  onSave,
  onClose
}: SaveRosterModalProps): JSX.Element {
  const [library, setLibrary] = useState<LibrarySnapshot | null>(null)
  const [name, setName] = useState(initialName)
  const [folderId, setFolderId] = useState(initialFolderId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameId = useId()

  useEffect(() => {
    let active = true
    window.raven
      .getLibrary()
      .then((snapshot) => {
        if (!active) return
        setLibrary(snapshot)
        setFolderId((current) =>
          current && snapshot.folders.some((folder) => folder.id === current) ? current : null
        )
      })
      .catch((loadError: unknown) => {
        if (active) setError(errorMessage(loadError))
      })
    return () => {
      active = false
    }
  }, [])

  const handleSave = async (): Promise<void> => {
    if (!name.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      await onSave(name.trim(), folderId)
    } catch (saveError) {
      setError(errorMessage(saveError))
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Save roster"
      subtitle="Choose a folder in your local report library."
      onClose={onClose}
    >
      <div className="form-field">
        <label className="field-label" htmlFor={nameId}>
          Roster name
        </label>
        <input
          id={nameId}
          className="text-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={120}
          autoFocus
        />
      </div>

      {library ? (
        <FolderSelect
          folders={library.folders}
          value={folderId}
          onChange={setFolderId}
          label="Save in"
          disabled={busy}
        />
      ) : (
        <p className="field-hint">Loading folders…</p>
      )}

      {error ? <p className="form-error">{error}</p> : null}

      <div className="modal-actions">
        <button
          type="button"
          className="button button-primary"
          onClick={() => void handleSave()}
          disabled={!library || !name.trim() || busy}
        >
          {busy ? 'Saving…' : 'Save roster'}
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
