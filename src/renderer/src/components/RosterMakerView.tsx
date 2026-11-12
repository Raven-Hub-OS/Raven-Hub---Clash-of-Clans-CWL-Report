import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type JSX
} from 'react'
import type {
  LibraryReportItem,
  LibraryRosterItem,
  LibrarySnapshot,
  PlayerRow,
  RosterClan,
  RosterDraft
} from '@shared/types'
import { leagueLabel, sortClansByLeague, sortPlayersByLeague } from '@shared/league'
import { assignPlayerToClan, moveRosterRow, removeRosterRow, rosterPlayerKey } from '@shared/roster'
import { normalizeTag } from '@shared/tags'
import { formatDecimal, formatInt } from '../lib/format'
import { errorMessage } from '../lib/errors'
import { defaultRosterName, folderLabel, itemMeta, rostersOnly } from '../lib/library'
import { missedTone } from '../lib/metrics'
import { ConfirmModal } from './ConfirmModal'
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  CopyIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  GripIcon,
  PlusIcon,
  SaveIcon,
  SearchIcon,
  TrashIcon,
  TrophyIcon,
  UsersIcon
} from './Icons'
import { ManualPlayerModal } from './ManualPlayerModal'
import { AnnounceModal } from './AnnounceModal'
import { PromptModal } from './PromptModal'
import { ReportPickerModal } from './ReportPickerModal'
import { SaveRosterModal } from './SaveRosterModal'
import type { ToastData } from './Toast'

interface RosterEditor {
  itemId: string | null
  name: string
  folderId: string | null
  sourceReportItemId: string | null
  sourceReportName: string
  seasonLabel: string
  seasonKey: string | null
  clans: RosterClan[]
  sourcePlayers: PlayerRow[]
  extraPlayers: PlayerRow[]
  sourceMissing: boolean
  rosterPlayers: PlayerRow[]
}

interface RosterMakerViewProps {
  active: boolean
  refreshKey: number
  openRequest: { id: string; token: number } | null
  onOpenRequestHandled: () => void
  onLibraryChanged: () => void
  onToast: (toast: ToastData) => void
}

type DragState =
  | { kind: 'source'; player: PlayerRow }
  | { kind: 'roster'; tag: string }

type DropTarget =
  | { kind: 'source' }
  | { kind: 'section'; clanTag: string }
  | { kind: 'row'; clanTag: string; index: number }

interface SectionRow {
  player: PlayerRow
  index: number
}

export function RosterMakerView({
  active,
  refreshKey,
  openRequest,
  onOpenRequestHandled,
  onLibraryChanged,
  onToast
}: RosterMakerViewProps): JSX.Element {
  const [library, setLibrary] = useState<LibrarySnapshot | null>(null)
  const [preferredFolderId, setPreferredFolderId] = useState<string | null>(null)
  const [editor, setEditor] = useState<RosterEditor | null>(null)
  const [baseline, setBaseline] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [addClanOpen, setAddClanOpen] = useState(false)
  const [announceOpen, setAnnounceOpen] = useState(false)
  const [manualClan, setManualClan] = useState<RosterClan | null>(null)
  const [loadingRoster, setLoadingRoster] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)
  const [sourceSearch, setSourceSearch] = useState('')
  const [dragging, setDragging] = useState<DragState | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)

  const loadLibrary = useCallback(async (): Promise<void> => {
    try {
      const snapshot = await window.raven.getLibrary()
      setLibrary(snapshot)
    } catch (loadError) {
      onToast({
        kind: 'error',
        title: 'Could not load the report library',
        message: errorMessage(loadError)
      })
    }
  }, [onToast])

  useEffect(() => {
    void loadLibrary()
  }, [loadLibrary, refreshKey])

  useEffect(() => {
    let mounted = true
    window.raven
      .getSettings()
      .then((settings) => {
        if (mounted) setPreferredFolderId(settings.lastRosterFolderId)
      })
      .catch(() => undefined)
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!openRequest) return
    let mounted = true

    const open = async (): Promise<void> => {
      setLoadingRoster(true)
      try {
        const snapshot = await window.raven.getLibrary()
        if (!mounted) return
        setLibrary(snapshot)
        const item = snapshot.items.find(
          (candidate): candidate is LibraryRosterItem =>
            candidate.id === openRequest.id && candidate.type === 'roster'
        )
        if (!item) throw new Error('That saved roster was not found.')

        const next = await editorFromSavedRoster(item)
        if (!mounted) return
        setEditor(next)
        setBaseline(editorSignature(next))
        setSourceSearch('')
      } catch (openError) {
        if (mounted) {
          onToast({
            kind: 'error',
            title: 'Could not open the saved roster',
            message: errorMessage(openError)
          })
        }
      } finally {
        if (mounted) {
          setLoadingRoster(false)
          onOpenRequestHandled()
        }
      }
    }

    void open()
    return () => {
      mounted = false
    }
  }, [openRequest, onToast, onOpenRequestHandled])

  const savedRosters = useMemo(
    () =>
      rostersOnly(library?.items ?? []).sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt)
      ),
    [library]
  )

  const availablePlayers = useMemo(
    () =>
      sortPlayersByLeague(
        mergePlayers(editor?.sourcePlayers ?? [], editor?.extraPlayers ?? []),
        editor?.clans ?? []
      ),
    [editor?.sourcePlayers, editor?.extraPlayers, editor?.clans]
  )

  const rosterPlayerTags = useMemo(
    () => new Set((editor?.rosterPlayers ?? []).map((player) => player.tag)),
    [editor?.rosterPlayers]
  )

  const filteredSource = useMemo(() => {
    const search = sourceSearch.trim().toLowerCase()
    if (!search) return availablePlayers
    return availablePlayers.filter((player) => {
      const haystack = `${player.name} ${player.tag} ${player.clan}`.toLowerCase()
      return haystack.includes(search)
    })
  }, [availablePlayers, sourceSearch])

  const sectionClans = useMemo(() => {
    const clans = mergeRosterClans(
      editor?.clans ?? [],
      (editor?.rosterPlayers ?? []).map((player) => ({
        tag: player.clanTag,
        name: player.clan,
        league: null
      }))
    )
    return sortClansByLeague(clans)
  }, [editor?.clans, editor?.rosterPlayers])

  const sectionRows = useMemo(() => {
    const rows = new Map<string, SectionRow[]>()
    for (const clan of sectionClans) rows.set(clan.tag, [])

    const players = editor?.rosterPlayers ?? []
    for (let index = 0; index < players.length; index += 1) {
      const list = rows.get(clanKey(players[index]))
      if (list) list.push({ player: players[index], index })
    }
    return rows
  }, [editor?.rosterPlayers, sectionClans])

  const dirty = editor ? editorSignature(editor) !== baseline : false

  const resolveFolder = (folderId: string | null): string | null => {
    if (!folderId) return null
    return library?.folders.some((folder) => folder.id === folderId) ? folderId : null
  }

  const handleSelectReport = async (item: LibraryReportItem): Promise<void> => {
    setPickerOpen(false)
    setLoadingRoster(true)
    try {
      const report = await window.raven.getLibraryReport(item.id)
      const reportClans = reportClansFromReport(report.clans)
      if (editor) {
        setEditor({
          ...editor,
          sourceReportItemId: item.id,
          sourceReportName: item.name,
          seasonLabel: report.seasonLabel,
          seasonKey: report.seasonKey,
          sourcePlayers: report.players,
          sourceMissing: false,
          clans: mergeRosterClans(editor.clans, reportClans)
        })
      } else {
        const next: RosterEditor = {
          itemId: null,
          name: defaultRosterName(report.seasonLabel, item.name),
          folderId: resolveFolder(preferredFolderId),
          sourceReportItemId: item.id,
          sourceReportName: item.name,
          seasonLabel: report.seasonLabel,
          seasonKey: report.seasonKey,
          clans: sortClansByLeague(reportClans),
          sourcePlayers: report.players,
          extraPlayers: [],
          sourceMissing: false,
          rosterPlayers: []
        }
        setEditor(next)
        setBaseline(editorSignature(next))
      }
      setSourceSearch('')
    } catch (selectError) {
      onToast({
        kind: 'error',
        title: 'Could not load the saved report',
        message: errorMessage(selectError)
      })
    } finally {
      setLoadingRoster(false)
    }
  }

  const openSavedRoster = async (item: LibraryRosterItem): Promise<void> => {
    setLoadingRoster(true)
    try {
      const next = await editorFromSavedRoster(item)
      setEditor(next)
      setBaseline(editorSignature(next))
      setSourceSearch('')
    } catch (openError) {
      onToast({
        kind: 'error',
        title: 'Could not open the saved roster',
        message: errorMessage(openError)
      })
    } finally {
      setLoadingRoster(false)
    }
  }

  const addPlayer = (player: PlayerRow): void => {
    setEditor((current) => {
      if (!current) return current
      if (current.rosterPlayers.some((row) => row.tag === player.tag)) {
        return current
      }
      return { ...current, rosterPlayers: [...current.rosterPlayers, player] }
    })
  }

  const insertPlayer = (player: PlayerRow, clan: RosterClan, index: number): void => {
    setEditor((current) => {
      if (!current) return current
      if (current.rosterPlayers.some((row) => row.tag === player.tag)) {
        return current
      }
      const next = [...current.rosterPlayers]
      next.splice(
        Math.max(0, Math.min(index, next.length)),
        0,
        assignPlayerToClan(player, clan)
      )
      return { ...current, rosterPlayers: next }
    })
  }

  const removePlayer = (index: number): void => {
    setEditor((current) =>
      current
        ? { ...current, rosterPlayers: removeRosterRow(current.rosterPlayers, index) }
        : current
    )
  }

  const moveSectionPlayer = (clanTag: string, index: number, delta: number): void => {
    setEditor((current) => {
      if (!current) return current
      const indices = current.rosterPlayers
        .map((player, position) => ({ player, position }))
        .filter((entry) => clanKey(entry.player) === clanTag)
        .map((entry) => entry.position)
      const position = indices.indexOf(index)
      const target = position + delta
      if (position < 0 || target < 0 || target >= indices.length) return current
      return {
        ...current,
        rosterPlayers: moveRosterRow(current.rosterPlayers, index, indices[target])
      }
    })
  }

  const moveRosterPlayerTo = (tag: string, clan: RosterClan, target: number): void => {
    setEditor((current) => {
      if (!current) return current
      const index = current.rosterPlayers.findIndex((player) => player.tag === tag)
      if (index === -1) return current

      const assigned = assignPlayerToClan(current.rosterPlayers[index], clan)
      if (index === target && assigned === current.rosterPlayers[index]) return current

      const rows = current.rosterPlayers.map((player, position) =>
        position === index ? assigned : player
      )
      return {
        ...current,
        rosterPlayers: moveRosterRow(rows, index, target)
      }
    })
  }

  const resetDrag = (): void => {
    setDragging(null)
    setDropTarget(null)
  }

  const handleDragStart = (event: DragEvent, source: DragState): void => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(
      'text/plain',
      source.kind === 'source' ? source.player.tag : source.tag
    )
    setDragging(source)
  }

  const handleDragOver = (event: DragEvent, target: DropTarget): void => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDropTarget(target)
  }

  const handleDrop = (event: DragEvent, target: DropTarget): void => {
    event.preventDefault()
    if (!dragging) {
      resetDrag()
      return
    }

    const players = editor?.rosterPlayers ?? []

    if (dragging.kind === 'source') {
      if (target.kind === 'source') {
        resetDrag()
        return
      }

      const clan = sectionClans.find((entry) => entry.tag === target.clanTag)
      if (!clan) {
        resetDrag()
        return
      }

      const index =
        target.kind === 'row' ? target.index : sectionEndIndex(players, target.clanTag)
      insertPlayer(dragging.player, clan, index)
    } else if (target.kind === 'source') {
      const index = players.findIndex((row) => row.tag === dragging.tag)
      if (index !== -1) removePlayer(index)
    } else {
      const clan = sectionClans.find((entry) => entry.tag === target.clanTag)
      if (!clan) {
        resetDrag()
        return
      }

      const index =
        target.kind === 'row' ? target.index : sectionEndIndex(players, target.clanTag)
      moveRosterPlayerTo(dragging.tag, clan, index)
    }

    resetDrag()
  }

  const closeEditor = (): void => {
    setEditor(null)
    setBaseline('')
    setSourceSearch('')
    setDragging(null)
    setDropTarget(null)
    setManualClan(null)
    setAddClanOpen(false)
  }

  const requestCloseEditor = (): void => {
    if (dirty) setDiscardOpen(true)
    else closeEditor()
  }

  const handleSaveRoster = async (name: string, folderId: string | null): Promise<void> => {
    if (!editor) return

    const item = await window.raven.saveRosterToLibrary({
      id: editor.itemId ?? undefined,
      name,
      folderId,
      sourceReportItemId: editor.sourceReportItemId,
      sourceReportName: editor.sourceReportName,
      seasonLabel: editor.seasonLabel,
      seasonKey: editor.seasonKey,
      clans: sectionClans,
      extraPlayers: editor.extraPlayers,
      players: editor.rosterPlayers
    })

    const next: RosterEditor = {
      ...editor,
      itemId: item.id,
      name: item.name,
      folderId: item.folderId
    }
    setEditor(next)
    setBaseline(editorSignature(next))
    setPreferredFolderId(item.folderId)
    setSaveOpen(false)
    onLibraryChanged()
    onToast({ kind: 'success', title: 'Roster saved', message: item.name })
  }

  const exportRosterDraft = async (draft: RosterDraft, key: string): Promise<void> => {
    setExporting(key)
    try {
      const result = await window.raven.exportRoster(draft)
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
    } finally {
      setExporting(null)
    }
  }

  const handleExportEditor = async (): Promise<void> => {
    if (!editor || editor.rosterPlayers.length === 0) return
    await exportRosterDraft(
      {
        id: editor.itemId ?? undefined,
        name: editor.name,
        folderId: editor.folderId,
        sourceReportItemId: editor.sourceReportItemId,
        sourceReportName: editor.sourceReportName,
        seasonLabel: editor.seasonLabel,
        seasonKey: editor.seasonKey,
        clans: sectionClans,
        extraPlayers: editor.extraPlayers,
        players: editor.rosterPlayers
      },
      'editor'
    )
  }

  const handleExportSaved = async (item: LibraryRosterItem): Promise<void> => {
    try {
      const roster = await window.raven.getLibraryRoster(item.id)
      let clans = roster.clans
      if (clans.length === 0 && roster.sourceReportItemId) {
        try {
          const report = await window.raven.getLibraryReport(roster.sourceReportItemId)
          clans = reportClansFromReport(report.clans)
        } catch {
          // A deleted source report leaves the legacy snapshot without league data.
        }
      }

      await exportRosterDraft(
        {
          id: item.id,
          name: roster.name,
          folderId: item.folderId,
          sourceReportItemId: roster.sourceReportItemId,
          sourceReportName: roster.sourceReportName,
          seasonLabel: roster.seasonLabel,
          seasonKey: roster.seasonKey,
          clans,
          extraPlayers: roster.extraPlayers,
          players: roster.players
        },
        item.id
      )
    } catch (loadError) {
      onToast({
        kind: 'error',
        title: 'Could not open the saved roster',
        message: errorMessage(loadError)
      })
    }
  }

  const handleAddClan = async (rawTag: string): Promise<void> => {
    if (!editor) return
    const tag = normalizeTag(rawTag)
    if (!tag) throw new Error('Enter a valid clan tag, for example #2PP or #8QU8J9LP.')
    const existing = sectionClans.find((clan) => clan.tag === tag)
    if (existing) throw new Error(`${existing.name} is already in this roster.`)

    const loaded = await window.raven.loadRosterClan(tag, editor.seasonKey)
    setEditor((current) => {
      if (!current) return current
      return {
        ...current,
        seasonKey: current.seasonKey ?? loaded.seasonKey,
        clans: mergeRosterClans(current.clans, [loaded.clan]),
        extraPlayers: mergePlayers(current.extraPlayers, loaded.players)
      }
    })
    setAddClanOpen(false)
    onToast({
      kind: 'success',
      title: 'Clan added',
      message: `${loaded.clan.name} · ${loaded.players.length} ${
        loaded.players.length === 1 ? 'player' : 'players'
      } loaded`
    })
  }

  const handleManualPlayer = (player: PlayerRow): void => {
    setEditor((current) => {
      if (!current) return current
      let candidate = player
      let suffix = 2
      while (current.rosterPlayers.some((row) => row.tag === candidate.tag)) {
        candidate = { ...player, tag: `${player.tag}-${suffix}` }
        suffix += 1
      }
      return { ...current, rosterPlayers: [...current.rosterPlayers, candidate] }
    })
    setManualClan(null)
  }

  if (!editor) {
    return (
      <main className="main roster-main" hidden={!active}>
        <div className="roster-heading">
          <div>
            <p className="eyebrow">After the report</p>
            <h1>CWL Roster Maker</h1>
            <p className="roster-subtitle">
              Pick a saved report, add the players you want and arrange one table per clan in
              league order.
            </p>
          </div>
          <button
            type="button"
            className="button button-primary"
            onClick={() => setPickerOpen(true)}
            disabled={loadingRoster}
          >
            <UsersIcon size={17} />
            New roster
          </button>
        </div>

        <div className="roster-start-grid">
          <section className="panel roster-callout">
            <div className="roster-callout-icon">
              <UsersIcon size={26} />
            </div>
            <h2>Build the lineup you actually want</h2>
            <p>
              The saved report stays untouched. Drag players onto any clan table, reorder them,
              add extra clans and save the result in the same folder library as your reports.
            </p>
            <ul className="roster-benefits">
              <li>One roster table per clan, ordered by league rank.</li>
              <li>Drag players from the report onto any clan table.</li>
              <li>Add more clans by tag and load their CWL players.</li>
              <li>Add manual players when the data is not in ClashKing.</li>
              <li>Export the final lineup as a single XLSX table.</li>
            </ul>
            <button
              type="button"
              className="button button-primary"
              onClick={() => setPickerOpen(true)}
              disabled={loadingRoster}
            >
              <FileSpreadsheetIcon size={17} />
              Choose a saved report
            </button>
            <p className="field-hint">
              Reports are created on the Home tab. Use <strong>Save to reports</strong> in the
              report view to make them available here.
            </p>
          </section>

          <section className="panel roster-saved">
            <div className="roster-saved-head">
              <div>
                <h2>Saved rosters</h2>
                <p>Open a roster to keep editing it or export it again.</p>
              </div>
              <span className="roster-count">{savedRosters.length}</span>
            </div>

            {savedRosters.length > 0 ? (
              <div className="roster-saved-list">
                {savedRosters.map((item) => (
                  <article className="roster-saved-row" key={item.id}>
                    <button
                      type="button"
                      className="roster-saved-main"
                      onClick={() => void openSavedRoster(item)}
                      disabled={loadingRoster}
                    >
                      <span className="library-item-icon">
                        <UsersIcon size={19} />
                      </span>
                      <span className="roster-saved-copy">
                        <span className="roster-saved-name">{item.name}</span>
                        <span className="roster-saved-meta">{itemMeta(item)}</span>
                        <span className="roster-saved-folder">
                          {folderLabel(library?.folders ?? [], item.folderId)}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="icon-button row-action"
                      title="Export XLSX"
                      aria-label="Export XLSX"
                      onClick={() => void handleExportSaved(item)}
                      disabled={exporting !== null}
                    >
                      <DownloadIcon size={15} />
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="roster-empty-saved">
                <UsersIcon size={30} />
                <p>
                  No saved rosters yet. Your first roster will appear here once you choose a
                  report and save it.
                </p>
              </div>
            )}
          </section>
        </div>

        {pickerOpen ? (
          <ReportPickerModal
            onSelect={(item) => void handleSelectReport(item)}
            onClose={() => setPickerOpen(false)}
          />
        ) : null}
      </main>
    )
  }

  return (
    <main className="main roster-main" hidden={!active}>
      <div className="roster-heading roster-editor-heading">
        <div>
          <p className="eyebrow">
            CWL Roster Maker
            {dirty ? <span className="roster-dirty-badge">Unsaved changes</span> : null}
          </p>
          <h1>{editor.name}</h1>
          <p className="roster-subtitle">
            {editor.seasonLabel} · {editor.rosterPlayers.length} player
            {editor.rosterPlayers.length === 1 ? '' : 's'} in roster · {sectionClans.length}{' '}
            clan{sectionClans.length === 1 ? '' : 's'}
            {editor.itemId ? ' · Saved in your report library' : ' · Not saved yet'}
          </p>
        </div>
        <div className="roster-heading-actions">
          <button type="button" className="button button-ghost" onClick={requestCloseEditor}>
            <ArrowLeftIcon size={16} />
            All rosters
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setSaveOpen(true)}
            disabled={editor.rosterPlayers.length === 0}
          >
            <SaveIcon size={16} />
            Save roster
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => void handleExportEditor()}
            disabled={editor.rosterPlayers.length === 0 || exporting !== null}
          >
            <DownloadIcon size={17} />
            {exporting === 'editor' ? 'Exporting…' : 'Export XLSX'}
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setAnnounceOpen(true)}
            disabled={editor.rosterPlayers.length === 0}
          >
            <CopyIcon size={16} />
            Generate announcement
          </button>
        </div>
      </div>

      <div className="roster-source-bar panel">
        <div className="roster-source-copy">
          <FileSpreadsheetIcon size={17} />
          <div>
            <strong>{editor.sourceReportName}</strong>
            <span>
              {editor.sourceMissing
                ? 'Source report is no longer in the library. Your saved roster and added clans are intact.'
                : `${editor.seasonLabel} · ${availablePlayers.length} available player${
                    availablePlayers.length === 1 ? '' : 's'
                  }`}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="link-button small"
          onClick={() => setPickerOpen(true)}
          disabled={loadingRoster}
        >
          Change report
        </button>
      </div>

      <div className="roster-grid roster-grid-clans">
        <section className="panel roster-panel roster-source-panel">
          <div className="roster-panel-head">
            <div className="roster-panel-title">
              <span className="roster-step">1</span>
              <div>
                <h2>Available players</h2>
                <p>
                  From the report and added clans. Drag any player onto the clan table where
                  they should play.
                </p>
              </div>
            </div>
            <span className="roster-count">{availablePlayers.length}</span>
          </div>

          <div className="roster-filter">
            <div className="search-box">
              <SearchIcon size={15} />
              <input
                type="search"
                value={sourceSearch}
                onChange={(event) => setSourceSearch(event.target.value)}
                placeholder="Search available players"
                aria-label="Search available players"
              />
            </div>
          </div>

          <div
            className={`roster-table-wrap ${
              dropTarget?.kind === 'source' && dragging?.kind === 'roster'
                ? 'roster-drop-remove'
                : ''
            }`}
            onDragOver={(event) => handleDragOver(event, { kind: 'source' })}
            onDrop={(event) => handleDrop(event, { kind: 'source' })}
          >
            {filteredSource.length > 0 ? (
              <table
                className="roster-table roster-source-table"
                aria-label="Players available for the roster"
              >
                <thead>
                  <tr>
                    <th>CLAN</th>
                    <th>PLAYER</th>
                    <th className="numeric">TH</th>
                    <th className="numeric">STARS</th>
                    <th className="numeric">AVG STARS</th>
                    <th className="numeric">MISSED</th>
                    <th aria-label="Add to roster" />
                  </tr>
                </thead>
                <tbody>
                  {filteredSource.map((player) => {
                    const added = rosterPlayerTags.has(player.tag)
                    return (
                      <tr
                        key={rosterPlayerKey(player)}
                        className={added ? 'roster-row-added' : ''}
                        draggable={!added}
                        onDragStart={
                          added
                            ? undefined
                            : (event) => handleDragStart(event, { kind: 'source', player })
                        }
                        onDragEnd={resetDrag}
                        onDoubleClick={added ? undefined : () => addPlayer(player)}
                      >
                        <td>
                          <span className="roster-clan">{player.clan}</span>
                        </td>
                        <td>
                          <span className="roster-player-name">{player.name}</span>
                          <span className="roster-player-tag">
                            {displayTag(player.tag)}
                          </span>
                        </td>
                        <td className="numeric">
                          <span className="th-badge">{formatInt(player.th)}</span>
                        </td>
                        <td className="numeric">{formatInt(player.attackStars)}</td>
                        <td className="numeric">{formatDecimal(player.avgStars, 2)}</td>
                        <td className="numeric">
                          <span className={`metric ${missedTone(player.missed)}`}>
                            {formatInt(player.missed)}
                          </span>
                        </td>
                        <td className="roster-add-cell">
                          {added ? (
                            <span className="roster-added-label">Added</span>
                          ) : (
                            <button
                              type="button"
                              className="icon-button row-action"
                              title={`Add to ${player.clan || 'their original clan'}`}
                              aria-label={`Add ${player.name} to ${
                                player.clan || 'their original clan'
                              }`}
                              onClick={() => addPlayer(player)}
                            >
                              <PlusIcon size={15} />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <div className="roster-table-empty">
                <SearchIcon size={26} />
                <p>
                  {editor.sourceMissing
                    ? 'The source report is no longer available. Added clans and manual players still work.'
                    : sourceSearch.trim()
                      ? `No player matches “${sourceSearch.trim()}”.`
                      : 'This report has no players. Add a clan by tag to load more.'}
                </p>
                {editor.sourceMissing ? (
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => setPickerOpen(true)}
                  >
                    Choose another report
                  </button>
                ) : null}
              </div>
            )}
          </div>
          {dragging?.kind === 'roster' ? (
            <p className="roster-drop-hint">Drop here to remove a player from the roster.</p>
          ) : null}
        </section>

        <section className="panel roster-panel roster-panel-picked">
          <div className="roster-panel-head">
            <div className="roster-panel-title">
              <span className="roster-step">2</span>
              <div>
                <h2>Your roster</h2>
                <p>
                  One table per clan, ordered by league. Drag players between tables. No limit
                  on players.
                </p>
              </div>
            </div>
            <span className="roster-count">{editor.rosterPlayers.length}</span>
          </div>

          {sectionClans.length === 0 ? (
            <div className="roster-picked-empty">
              <UsersIcon size={30} />
              <h3>No clans in this roster</h3>
              <p>Add a clan by tag below, or choose a report that contains clans.</p>
            </div>
          ) : (
            <div className="roster-clan-sections">
              {sectionClans.map((clan) => {
                const rows = sectionRows.get(clan.tag) ?? []
                const highlighted =
                  dropTarget?.kind === 'section' && dropTarget.clanTag === clan.tag

                return (
                  <section
                    className={`roster-clan-section ${highlighted ? 'roster-drop-active' : ''}`}
                    key={clan.tag}
                    onDragOver={(event) =>
                      handleDragOver(event, { kind: 'section', clanTag: clan.tag })
                    }
                    onDrop={(event) =>
                      handleDrop(event, { kind: 'section', clanTag: clan.tag })
                    }
                  >
                    <header className="roster-clan-head">
                      <div className="roster-clan-title">
                        <div className="roster-clan-name-row">
                          <h3>{clan.name}</h3>
                          <span className="roster-clan-tag">{clan.tag}</span>
                        </div>
                        <span className="roster-league-badge">
                          <TrophyIcon size={12} />
                          {leagueLabel(clan.league)}
                        </span>
                      </div>
                      <div className="roster-clan-actions">
                        <span className="roster-clan-count">
                          {rows.length} {rows.length === 1 ? 'player' : 'players'}
                        </span>
                        <button
                          type="button"
                          className="button button-secondary roster-add-player"
                          onClick={() => setManualClan(clan)}
                        >
                          <PlusIcon size={14} />
                          Add player
                        </button>
                      </div>
                    </header>

                    {rows.length === 0 ? (
                      <div className="roster-clan-empty">
                        <p>Drop a player here or add one manually.</p>
                      </div>
                    ) : (
                      <div className="roster-table-wrap roster-clan-table-wrap">
                        <table
                          className="roster-table roster-table-picked"
                          aria-label={`${clan.name} roster`}
                        >
                          <thead>
                            <tr>
                              <th className="roster-order-head">#</th>
                              <th aria-label="Drag handle" />
                              <th>PLAYER</th>
                              <th className="numeric">TH</th>
                              <th className="numeric">STARS</th>
                              <th className="numeric">AVG STARS</th>
                              <th className="numeric">MISSED</th>
                              <th aria-label="Actions" />
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map(({ player, index }, position) => (
                              <tr
                                key={rosterPlayerKey(player)}
                                draggable
                                className={
                                  dropTarget?.kind === 'row' &&
                                  dropTarget.clanTag === clan.tag &&
                                  dropTarget.index === index
                                    ? 'roster-drop-row'
                                    : ''
                                }
                                onDragStart={(event) =>
                                  handleDragStart(event, {
                                    kind: 'roster',
                                    tag: player.tag
                                  })
                                }
                                onDragEnd={resetDrag}
                                onDragOver={(event) => {
                                  event.stopPropagation()
                                  handleDragOver(event, {
                                    kind: 'row',
                                    clanTag: clan.tag,
                                    index
                                  })
                                }}
                                onDrop={(event) => {
                                  event.stopPropagation()
                                  handleDrop(event, {
                                    kind: 'row',
                                    clanTag: clan.tag,
                                    index
                                  })
                                }}
                              >
                                <td className="numeric roster-order">{position + 1}</td>
                                <td className="roster-grip-cell">
                                  <GripIcon size={15} />
                                </td>
                                <td>
                                  <span className="roster-player-name">{player.name}</span>
                                  <span className="roster-player-tag">
                                    {displayTag(player.tag)}
                                  </span>
                                </td>
                                <td className="numeric">
                                  <span className="th-badge">{formatInt(player.th)}</span>
                                </td>
                                <td className="numeric">
                                  {formatInt(player.attackStars)}
                                </td>
                                <td className="numeric">
                                  {formatDecimal(player.avgStars, 2)}
                                </td>
                                <td className="numeric">
                                  <span className={`metric ${missedTone(player.missed)}`}>
                                    {formatInt(player.missed)}
                                  </span>
                                </td>
                                <td>
                                  <div className="roster-row-actions">
                                    <button
                                      type="button"
                                      className="icon-button row-action"
                                      title="Move up"
                                      aria-label={`Move ${player.name} up`}
                                      onClick={() =>
                                        moveSectionPlayer(clan.tag, index, -1)
                                      }
                                      disabled={position === 0}
                                    >
                                      <ArrowUpIcon size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      className="icon-button row-action"
                                      title="Move down"
                                      aria-label={`Move ${player.name} down`}
                                      onClick={() =>
                                        moveSectionPlayer(clan.tag, index, 1)
                                      }
                                      disabled={position === rows.length - 1}
                                    >
                                      <ArrowDownIcon size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      className="icon-button row-action row-action-danger"
                                      title="Remove from roster"
                                      aria-label={`Remove ${player.name} from roster`}
                                      onClick={() => removePlayer(index)}
                                    >
                                      <TrashIcon size={14} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                )
              })}
            </div>
          )}

          <div className="roster-add-clan-bar">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setAddClanOpen(true)}
            >
              <PlusIcon size={15} />
              Add clan
            </button>
            <p className="field-hint">
              Enter a clan tag to load its CWL players for {editor.seasonLabel}.
            </p>
          </div>

          {editor.rosterPlayers.length > 0 ? (
            <div className="roster-panel-footer">
              <button
                type="button"
                className="link-button small roster-clear-button"
                onClick={() => setClearOpen(true)}
              >
                Clear roster
              </button>
            </div>
          ) : null}
        </section>
      </div>

      {loadingRoster ? (
        <div className="roster-loading" role="status">
          Loading roster…
        </div>
      ) : null}

      {pickerOpen ? (
        <ReportPickerModal
          onSelect={(item) => void handleSelectReport(item)}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}

      {saveOpen ? (
        <SaveRosterModal
          initialName={editor.name}
          initialFolderId={editor.folderId ?? preferredFolderId}
          onSave={handleSaveRoster}
          onClose={() => setSaveOpen(false)}
        />
      ) : null}

      {addClanOpen ? (
        <PromptModal
          title="Add clan"
          subtitle={`Loads the CWL players from ${editor.seasonLabel}.`}
          label="Clan tag"
          initialValue="#"
          confirmLabel="Add clan"
          onConfirm={handleAddClan}
          onClose={() => setAddClanOpen(false)}
        />
      ) : null}

      {manualClan ? (
        <ManualPlayerModal
          clan={manualClan}
          onAdd={handleManualPlayer}
          onClose={() => setManualClan(null)}
        />
      ) : null}

      {announceOpen ? (
        <AnnounceModal
          clans={sectionClans}
          players={editor.rosterPlayers}
          seasonLabel={editor.seasonLabel}
          onClose={() => setAnnounceOpen(false)}
        />
      ) : null}

      {discardOpen ? (
        <ConfirmModal
          title="Discard unsaved changes?"
          subtitle="Your current roster has not been saved."
          confirmLabel="Discard changes"
          danger
          onConfirm={async () => {
            setDiscardOpen(false)
            closeEditor()
          }}
          onClose={() => setDiscardOpen(false)}
        >
          <p>
            Leave this roster and return to the saved roster list? Any unsaved changes will be
            lost.
          </p>
        </ConfirmModal>
      ) : null}

      {clearOpen ? (
        <ConfirmModal
          title="Clear the roster?"
          subtitle="This only clears the current draft. A saved copy is not changed until you save."
          confirmLabel="Clear roster"
          danger
          onConfirm={async () => {
            setEditor((current) =>
              current ? { ...current, rosterPlayers: [] } : current
            )
            setClearOpen(false)
          }}
          onClose={() => setClearOpen(false)}
        >
          <p>Remove all players from every clan table?</p>
        </ConfirmModal>
      ) : null}
    </main>
  )
}

async function editorFromSavedRoster(item: LibraryRosterItem): Promise<RosterEditor> {
  const roster = await window.raven.getLibraryRoster(item.id)
  let sourcePlayers: PlayerRow[] = []
  let sourceMissing = true
  let reportClans: RosterClan[] = []
  let reportSeasonKey: string | null = null

  if (roster.sourceReportItemId) {
    try {
      const report = await window.raven.getLibraryReport(roster.sourceReportItemId)
      sourcePlayers = report.players
      sourceMissing = false
      reportClans = reportClansFromReport(report.clans)
      reportSeasonKey = report.seasonKey
    } catch {
      sourceMissing = true
    }
  }

  const playerClans: RosterClan[] = roster.players.map((player) => ({
    tag: player.clanTag,
    name: player.clan,
    league: null
  }))

  return {
    itemId: item.id,
    name: roster.name,
    folderId: item.folderId,
    sourceReportItemId: roster.sourceReportItemId,
    sourceReportName: roster.sourceReportName,
    seasonLabel: roster.seasonLabel,
    seasonKey: roster.seasonKey ?? reportSeasonKey,
    clans: mergeRosterClans(roster.clans, reportClans, playerClans),
    sourcePlayers,
    extraPlayers: roster.extraPlayers,
    sourceMissing,
    rosterPlayers: roster.players
  }
}

function editorSignature(editor: RosterEditor): string {
  return JSON.stringify({
    name: editor.name,
    folderId: editor.folderId,
    sourceReportItemId: editor.sourceReportItemId,
    sourceReportName: editor.sourceReportName,
    seasonLabel: editor.seasonLabel,
    seasonKey: editor.seasonKey,
    clans: editor.clans.map((clan) => ({
      tag: clanKey(clan),
      name: clan.name,
      league: clan.league
    })),
    extraPlayers: editor.extraPlayers.map(rosterPlayerKey),
    players: editor.rosterPlayers.map(rosterPlayerKey)
  })
}

function reportClansFromReport(
  clans: Array<{ tag: string; name: string; league: string | null }>
): RosterClan[] {
  return clans.map((clan) => ({
    tag: normalizeTag(clan.tag) ?? clan.tag,
    name: clan.name,
    league: clan.league
  }))
}

function mergeRosterClans(...groups: RosterClan[][]): RosterClan[] {
  const merged = new Map<string, RosterClan>()

  for (const group of groups) {
    for (const clan of group) {
      const tag = normalizeTag(clan.tag) ?? clan.tag
      const existing = merged.get(tag)
      merged.set(tag, {
        tag,
        name: clan.name || existing?.name || tag,
        league: clan.league ?? existing?.league ?? null
      })
    }
  }

  return sortClansByLeague([...merged.values()])
}

function mergePlayers(existing: PlayerRow[], incoming: PlayerRow[]): PlayerRow[] {
  const seen = new Set(existing.map(rosterPlayerKey))
  const merged = [...existing]

  for (const player of incoming) {
    const key = rosterPlayerKey(player)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(player)
  }

  return merged
}

function clanKey(value: Pick<PlayerRow, 'clanTag'> | Pick<RosterClan, 'tag'>): string {
  const tag = 'clanTag' in value ? value.clanTag : value.tag
  return normalizeTag(tag) ?? tag
}

function sectionEndIndex(players: PlayerRow[], clanTag: string): number {
  for (let index = players.length - 1; index >= 0; index -= 1) {
    if (clanKey(players[index]) === clanTag) return index + 1
  }
  return players.length
}

function displayTag(tag: string): string {
  return tag.startsWith('#MANUAL') ? 'Manual entry' : tag
}
