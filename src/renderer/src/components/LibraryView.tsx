import { useCallback, useEffect, useMemo, useState, type JSX } from 'react'
import type {
  LibraryFolder,
  LibraryItem,
  LibraryReportItem,
  LibraryRosterItem,
  LibrarySnapshot,
  ReportData
} from '@shared/types'
import { errorMessage } from '../lib/errors'
import { childFolders, folderChain, folderItems, folderLabel, itemMeta } from '../lib/library'
import { ConfirmModal } from './ConfirmModal'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  FolderIcon,
  FolderPlusIcon,
  MoveIcon,
  PencilIcon,
  SearchIcon,
  TrashIcon,
  UsersIcon
} from './Icons'
import { MoveModal } from './MoveModal'
import { PromptModal } from './PromptModal'
import type { ToastData } from './Toast'

interface LibraryViewProps {
  refreshKey: number
  onOpenReport: (item: LibraryReportItem, report: ReportData) => void
  onOpenRoster: (item: LibraryRosterItem) => void
  onToast: (toast: ToastData) => void
}

type PromptState =
  | { kind: 'new-folder' }
  | { kind: 'rename-folder'; folder: LibraryFolder }
  | { kind: 'rename-item'; item: LibraryItem }

type ConfirmState =
  | { kind: 'folder'; folder: LibraryFolder }
  | { kind: 'item'; item: LibraryItem }

type MoveState = { kind: 'folder'; folder: LibraryFolder } | { kind: 'item'; item: LibraryItem }

export function LibraryView({
  refreshKey,
  onOpenReport,
  onOpenRoster,
  onToast
}: LibraryViewProps): JSX.Element {
  const [snapshot, setSnapshot] = useState<LibrarySnapshot | null>(null)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [prompt, setPrompt] = useState<PromptState | null>(null)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [move, setMove] = useState<MoveState | null>(null)

  const load = useCallback(async (): Promise<void> => {
    try {
      const next = await window.raven.getLibrary()
      setSnapshot(next)
      setSelectedFolderId((current) =>
        current && next.folders.some((folder) => folder.id === current) ? current : null
      )
    } catch (loadError) {
      onToast({
        kind: 'error',
        title: 'Could not load the report library',
        message: errorMessage(loadError)
      })
    }
  }, [onToast])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  const folders = snapshot?.folders ?? []
  const items = snapshot?.items ?? []
  const search = query.trim().toLowerCase()
  const selectedChain = folderChain(folders, selectedFolderId)
  const visibleFolders = search ? [] : childFolders(folders, selectedFolderId)
  const currentItems = search
    ? items.filter((item) => {
        const haystack = `${item.name} ${item.seasonLabel}`.toLowerCase()
        return haystack.includes(search)
      })
    : folderItems(items, selectedFolderId)
  const visibleItems = search
    ? [...currentItems].sort((a, b) => a.name.localeCompare(b.name, 'en'))
    : currentItems

  const selectFolder = (folderId: string | null): void => {
    setSelectedFolderId(folderId)
    if (folderId) {
      setExpanded((current) => {
        const next = new Set(current)
        for (const folder of folderChain(folders, folderId)) next.add(folder.id)
        return next
      })
    }
  }

  const runAction = async (action: () => Promise<void>): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      await action()
      await load()
    } catch (actionError) {
      onToast({
        kind: 'error',
        title: 'Could not update the report library',
        message: errorMessage(actionError)
      })
    } finally {
      setBusy(false)
    }
  }

  const handlePromptConfirm = async (value: string): Promise<void> => {
    if (!prompt) return

    if (prompt.kind === 'new-folder') {
      await window.raven.createLibraryFolder(value, selectedFolderId)
      onToast({ kind: 'success', title: 'Folder created', message: value })
    } else if (prompt.kind === 'rename-folder') {
      await window.raven.renameLibraryFolder(prompt.folder.id, value)
      onToast({ kind: 'success', title: 'Folder renamed', message: value })
    } else {
      await window.raven.renameLibraryItem(prompt.item.id, value)
      onToast({ kind: 'success', title: 'Item renamed', message: value })
    }

    setPrompt(null)
    await load()
  }

  const handleConfirm = async (): Promise<void> => {
    if (!confirm) return

    if (confirm.kind === 'folder') {
      await window.raven.deleteLibraryFolder(confirm.folder.id)
      setSelectedFolderId(confirm.folder.parentId)
      onToast({ kind: 'success', title: 'Folder deleted', message: confirm.folder.name })
    } else {
      await window.raven.deleteLibraryItem(confirm.item.id)
      onToast({ kind: 'success', title: 'Item deleted', message: confirm.item.name })
    }

    setConfirm(null)
    await load()
  }

  const handleMove = async (folderId: string | null): Promise<void> => {
    if (!move) return

    if (move.kind === 'folder') {
      await window.raven.moveLibraryFolder(move.folder.id, folderId, 100_000)
    } else {
      await window.raven.moveLibraryItem(move.item.id, folderId, 100_000)
    }

    setMove(null)
    await load()
  }

  const openReport = async (item: LibraryReportItem): Promise<void> => {
    try {
      const report = await window.raven.getLibraryReport(item.id)
      onOpenReport(item, report)
    } catch (openError) {
      onToast({
        kind: 'error',
        title: 'Could not open the saved report',
        message: errorMessage(openError)
      })
    }
  }

  const openRoster = (item: LibraryRosterItem): void => {
    onOpenRoster(item)
  }

  const exportReport = async (item: LibraryReportItem): Promise<void> => {
    try {
      const result = await window.raven.exportLibraryReport(item.id)
      if (!result.canceled && result.filePath) {
        onToast({
          kind: 'success',
          title: 'Workbook exported',
          message: result.filePath,
          filePath: result.filePath
        })
      }
    } catch (exportError) {
      onToast({
        kind: 'error',
        title: 'Could not export the report',
        message: errorMessage(exportError)
      })
    }
  }

  const exportRoster = async (item: LibraryRosterItem): Promise<void> => {
    try {
      const roster = await window.raven.getLibraryRoster(item.id)
      const result = await window.raven.exportRoster({
        id: item.id,
        name: item.name,
        folderId: item.folderId,
        sourceReportItemId: roster.sourceReportItemId,
        sourceReportName: roster.sourceReportName,
        seasonLabel: roster.seasonLabel,
        players: roster.players
      })
      if (!result.canceled && result.filePath) {
        onToast({
          kind: 'success',
          title: 'Roster exported',
          message: result.filePath,
          filePath: result.filePath
        })
      }
    } catch (exportError) {
      onToast({
        kind: 'error',
        title: 'Could not export the roster',
        message: errorMessage(exportError)
      })
    }
  }

  const moveSibling = (kind: 'folder' | 'item', item: LibraryFolder | LibraryItem, delta: number): void => {
    const siblings =
      kind === 'folder'
        ? childFolders(folders, selectedFolderId)
        : folderItems(items, selectedFolderId)
    const index = siblings.findIndex((candidate) => candidate.id === item.id)
    if (index < 0) return
    const target = index + delta
    if (target < 0 || target >= siblings.length) return

    void runAction(async () => {
      if (kind === 'folder') {
        await window.raven.moveLibraryFolder(item.id, selectedFolderId, target)
      } else {
        await window.raven.moveLibraryItem(item.id, selectedFolderId, target)
      }
    })
  }

  if (!snapshot) {
    return (
      <main className="main library-main">
        <div className="library-loading panel">Loading report library…</div>
      </main>
    )
  }

  return (
    <main className="main library-main">
      <div className="library-heading">
        <div>
          <p className="eyebrow">Local report library</p>
          <h1>Reports</h1>
          <p className="library-subtitle">
            Organise saved reports and rosters in folders. Everything stays on this computer.
          </p>
        </div>
        <button
          type="button"
          className="button button-primary"
          onClick={() => setPrompt({ kind: 'new-folder' })}
        >
          <FolderPlusIcon size={16} />
          New folder
        </button>
      </div>

      <div className="library-layout">
        <aside className="library-sidebar panel">
          <div className="tree-root">
            <button
              type="button"
              className={`tree-label ${selectedFolderId === null ? 'tree-selected' : ''}`}
              onClick={() => selectFolder(null)}
            >
              <FolderIcon size={16} />
              <span>Reports</span>
              <span className="tree-count">{items.length}</span>
            </button>
          </div>
          <FolderTree
            folders={folders}
            selectedId={selectedFolderId}
            expanded={expanded}
            onSelect={selectFolder}
            onToggle={(folderId) => {
              setExpanded((current) => {
                const next = new Set(current)
                if (next.has(folderId)) next.delete(folderId)
                else next.add(folderId)
                return next
              })
            }}
          />
        </aside>

        <section className="library-content panel">
          <div className="library-toolbar">
            <div className="library-breadcrumb">
              <button type="button" className="link-button small" onClick={() => selectFolder(null)}>
                Reports
              </button>
              {selectedChain.map((folder) => (
                <span className="crumb" key={folder.id}>
                  <ChevronRightIcon size={13} />
                  <button
                    type="button"
                    className="link-button small"
                    onClick={() => selectFolder(folder.id)}
                  >
                    {folder.name}
                  </button>
                </span>
              ))}
            </div>

            <div className="library-toolbar-actions">
              <div className="search-box library-search">
                <SearchIcon size={16} />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search reports and rosters"
                  aria-label="Search reports and rosters"
                />
              </div>
            </div>
          </div>

          {!search && visibleFolders.length > 0 ? (
            <div className="folder-list">
              {visibleFolders.map((folder, index) => {
                const count = items.filter((item) => item.folderId === folder.id).length
                return (
                  <article className="folder-row" key={folder.id}>
                    <button
                      type="button"
                      className="folder-row-main"
                      onClick={() => selectFolder(folder.id)}
                    >
                      <FolderIcon size={17} />
                      <span className="folder-row-name">{folder.name}</span>
                      <span className="folder-row-meta">
                        {count} item{count === 1 ? '' : 's'}
                      </span>
                    </button>
                    <div className="row-actions">
                      <IconAction
                        label="Move up"
                        disabled={index === 0 || busy}
                        onClick={() => moveSibling('folder', folder, -1)}
                      >
                        <ArrowUpIcon size={14} />
                      </IconAction>
                      <IconAction
                        label="Move down"
                        disabled={index === visibleFolders.length - 1 || busy}
                        onClick={() => moveSibling('folder', folder, 1)}
                      >
                        <ArrowDownIcon size={14} />
                      </IconAction>
                      <IconAction
                        label="Rename folder"
                        disabled={busy}
                        onClick={() => setPrompt({ kind: 'rename-folder', folder })}
                      >
                        <PencilIcon size={14} />
                      </IconAction>
                      <IconAction
                        label="Move folder"
                        disabled={busy}
                        onClick={() => setMove({ kind: 'folder', folder })}
                      >
                        <MoveIcon size={14} />
                      </IconAction>
                      <IconAction
                        label="Delete folder"
                        disabled={busy}
                        onClick={() => setConfirm({ kind: 'folder', folder })}
                      >
                        <TrashIcon size={14} />
                      </IconAction>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : null}

          {visibleItems.length > 0 ? (
            <div className="item-list">
              {visibleItems.map((item, index) => (
                <article className={`library-item library-item-${item.type}`} key={item.id}>
                  <button
                    type="button"
                    className="library-item-main"
                    onClick={() =>
                      item.type === 'report' ? void openReport(item) : openRoster(item)
                    }
                  >
                    <span className="library-item-icon">
                      {item.type === 'report' ? (
                        <FileSpreadsheetIcon size={19} />
                      ) : (
                        <UsersIcon size={19} />
                      )}
                    </span>
                    <span className="library-item-copy">
                      <span className="library-item-name">{item.name}</span>
                      <span className="library-item-meta">
                        {itemMeta(item)}
                        {search ? ` · ${folderLabel(folders, item.folderId)}` : ''}
                      </span>
                    </span>
                  </button>
                  <div className="row-actions">
                    {!search ? (
                      <>
                        <IconAction
                          label="Move up"
                          disabled={index === 0 || busy}
                          onClick={() => moveSibling('item', item, -1)}
                        >
                          <ArrowUpIcon size={14} />
                        </IconAction>
                        <IconAction
                          label="Move down"
                          disabled={index === visibleItems.length - 1 || busy}
                          onClick={() => moveSibling('item', item, 1)}
                        >
                          <ArrowDownIcon size={14} />
                        </IconAction>
                      </>
                    ) : null}
                    <IconAction
                      label="Export XLSX"
                      disabled={busy}
                      onClick={() =>
                        item.type === 'report'
                          ? void exportReport(item)
                          : void exportRoster(item)
                      }
                    >
                      <DownloadIcon size={14} />
                    </IconAction>
                    <IconAction
                      label="Rename"
                      disabled={busy}
                      onClick={() => setPrompt({ kind: 'rename-item', item })}
                    >
                      <PencilIcon size={14} />
                    </IconAction>
                    <IconAction
                      label="Move to folder"
                      disabled={busy}
                      onClick={() => setMove({ kind: 'item', item })}
                    >
                      <MoveIcon size={14} />
                    </IconAction>
                    <IconAction
                      label="Delete"
                      disabled={busy}
                      onClick={() => setConfirm({ kind: 'item', item })}
                    >
                      <TrashIcon size={14} />
                    </IconAction>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {!search && visibleFolders.length === 0 && visibleItems.length === 0 ? (
            <div className="library-empty">
              <FolderIcon size={34} />
              <h2>{selectedFolderId ? 'This folder is empty' : 'No saved reports yet'}</h2>
              <p>
                Generate a report and choose <strong>Save to reports</strong> to keep it here.
                You can also create folders to organise future reports.
              </p>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setPrompt({ kind: 'new-folder' })}
              >
                <FolderPlusIcon size={16} />
                Create a folder
              </button>
            </div>
          ) : null}

          {search && visibleItems.length === 0 ? (
            <div className="library-empty">
              <SearchIcon size={30} />
              <h2>No matches</h2>
              <p>No report or roster matches “{query.trim()}”.</p>
            </div>
          ) : null}
        </section>
      </div>

      {prompt ? (
        <PromptModal
          title={
            prompt.kind === 'new-folder'
              ? 'New folder'
              : prompt.kind === 'rename-folder'
                ? 'Rename folder'
                : 'Rename item'
          }
          label={prompt.kind === 'new-folder' ? 'Folder name' : 'Name'}
          initialValue={
            prompt.kind === 'new-folder'
              ? ''
              : prompt.kind === 'rename-folder'
                ? prompt.folder.name
                : prompt.item.name
          }
          confirmLabel={prompt.kind === 'new-folder' ? 'Create folder' : 'Rename'}
          onConfirm={handlePromptConfirm}
          onClose={() => setPrompt(null)}
        />
      ) : null}

      {confirm ? (
        <ConfirmModal
          title={confirm.kind === 'folder' ? 'Delete folder?' : 'Delete item?'}
          subtitle={
            confirm.kind === 'folder'
              ? 'Everything inside this folder will also be deleted.'
              : 'This removes the saved item from this computer.'
          }
          confirmLabel={confirm.kind === 'folder' ? 'Delete folder' : 'Delete item'}
          danger
          onConfirm={handleConfirm}
          onClose={() => setConfirm(null)}
        >
          <p>
            Are you sure you want to delete{' '}
            <strong>{confirm.kind === 'folder' ? confirm.folder.name : confirm.item.name}</strong>?
            This cannot be undone.
          </p>
        </ConfirmModal>
      ) : null}

      {move ? (
        <MoveModal
          title={move.kind === 'folder' ? 'Move folder' : 'Move item'}
          subtitle="Choose a destination folder."
          folders={folders}
          initialFolderId={
            move.kind === 'folder' ? move.folder.parentId : move.item.folderId
          }
          excludeDescendantsOf={move.kind === 'folder' ? move.folder.id : undefined}
          onMove={handleMove}
          onClose={() => setMove(null)}
        />
      ) : null}
    </main>
  )
}

interface FolderTreeProps {
  folders: LibraryFolder[]
  selectedId: string | null
  expanded: Set<string>
  onSelect: (folderId: string) => void
  onToggle: (folderId: string) => void
}

function FolderTree({
  folders,
  selectedId,
  expanded,
  onSelect,
  onToggle
}: FolderTreeProps): JSX.Element {
  const renderChildren = (parentId: string | null, depth: number): JSX.Element[] =>
    childFolders(folders, parentId).flatMap((folder) => {
      const children = childFolders(folders, folder.id)
      const isExpanded = expanded.has(folder.id)
      const row = (
        <div className="tree-node" key={folder.id}>
          {children.length > 0 ? (
            <button
              type="button"
              className="tree-toggle"
              onClick={() => onToggle(folder.id)}
              aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
            >
              {isExpanded ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
            </button>
          ) : (
            <span className="tree-toggle-placeholder" />
          )}
          <button
            type="button"
            className={`tree-label ${selectedId === folder.id ? 'tree-selected' : ''}`}
            style={{ paddingLeft: 4 + depth * 16 }}
            onClick={() => onSelect(folder.id)}
          >
            <FolderIcon size={15} />
            <span>{folder.name}</span>
          </button>
        </div>
      )

      return isExpanded ? [row, ...renderChildren(folder.id, depth + 1)] : [row]
    })

  return <div className="folder-tree">{renderChildren(null, 0)}</div>
}

function IconAction({
  label,
  onClick,
  disabled,
  children
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: JSX.Element
}): JSX.Element {
  return (
    <button
      type="button"
      className="icon-button row-action"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}
