import { useId, type JSX } from 'react'
import type { LibraryFolder } from '@shared/types'
import { flattenFolderOptions, isFolderDescendant } from '../lib/library'

interface FolderSelectProps {
  folders: LibraryFolder[]
  value: string | null
  onChange: (folderId: string | null) => void
  label?: string
  allowRoot?: boolean
  excludeDescendantsOf?: string
  disabled?: boolean
}

export function FolderSelect({
  folders,
  value,
  onChange,
  label = 'Folder',
  allowRoot = true,
  excludeDescendantsOf,
  disabled = false
}: FolderSelectProps): JSX.Element {
  const id = useId()
  const options = flattenFolderOptions(folders, allowRoot).filter((option) => {
    if (!excludeDescendantsOf || !option.id) return true
    return (
      option.id !== excludeDescendantsOf &&
      !isFolderDescendant(folders, option.id, excludeDescendantsOf)
    )
  })

  return (
    <div className="form-field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="select-control select-control-block">
        <select
          id={id}
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value || null)}
          disabled={disabled}
        >
          {options.map((option) => (
            <option value={option.id} key={option.id || 'root'}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
