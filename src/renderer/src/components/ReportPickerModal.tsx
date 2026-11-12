import { useEffect, useMemo, useState, type JSX } from 'react'
import type { LibraryReportItem, LibrarySnapshot } from '@shared/types'
import { errorMessage } from '../lib/errors'
import { folderLabel, itemMeta, reportsOnly } from '../lib/library'
import { FileSpreadsheetIcon, SearchIcon } from './Icons'
import { Modal } from './Modal'

interface ReportPickerModalProps {
  onSelect: (item: LibraryReportItem) => void
  onClose: () => void
}

export function ReportPickerModal({
  onSelect,
  onClose
}: ReportPickerModalProps): JSX.Element {
  const [library, setLibrary] = useState<LibrarySnapshot | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    window.raven
      .getLibrary()
      .then((snapshot) => {
        if (active) setLibrary(snapshot)
      })
      .catch((loadError: unknown) => {
        if (active) setError(errorMessage(loadError))
      })
    return () => {
      active = false
    }
  }, [])

  const reports = useMemo(() => {
    const all = reportsOnly(library?.items ?? []).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    )
    const search = query.trim().toLowerCase()
    if (!search) return all
    return all.filter((item) => {
      const haystack = `${item.name} ${item.seasonLabel}`.toLowerCase()
      return haystack.includes(search)
    })
  }, [library, query])

  return (
    <Modal
      title="Choose a saved report"
      subtitle="Pick the report whose players you want to arrange into a roster."
      width="wide"
      onClose={onClose}
    >
      <div className="report-picker-search search-box">
        <SearchIcon size={16} />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search saved reports"
          aria-label="Search saved reports"
          autoFocus
        />
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {!library && !error ? <p className="field-hint">Loading reports…</p> : null}

      {library && reports.length === 0 ? (
        <div className="report-picker-empty">
          <FileSpreadsheetIcon size={28} />
          <p>
            {query.trim()
              ? `No saved report matches “${query.trim()}”.`
              : 'No saved reports yet. Generate a report and choose Save to reports first.'}
          </p>
        </div>
      ) : null}

      {reports.length > 0 ? (
        <div className="report-picker-list">
          {reports.map((item) => (
            <button
              type="button"
              className="report-picker-row"
              key={item.id}
              onClick={() => onSelect(item)}
            >
              <span className="library-item-icon">
                <FileSpreadsheetIcon size={19} />
              </span>
              <span className="report-picker-copy">
                <span className="report-picker-name">{item.name}</span>
                <span className="report-picker-meta">{itemMeta(item)}</span>
                <span className="report-picker-folder">
                  {folderLabel(library?.folders ?? [], item.folderId)}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </Modal>
  )
}
