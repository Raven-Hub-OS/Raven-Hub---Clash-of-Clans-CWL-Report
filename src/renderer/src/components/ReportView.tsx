import { useMemo, useState, type JSX } from 'react'
import type { ReportData } from '@shared/types'
import { formatDateTime, formatInt } from '../lib/format'
import { SummaryCards } from './SummaryCards'
import { WarningsPanel } from './WarningsPanel'
import { PlayersTable } from './PlayersTable'
import {
  ArrowLeftIcon,
  CalendarIcon,
  DownloadIcon,
  SaveIcon,
  SearchIcon,
  ShieldIcon
} from './Icons'

interface ReportViewProps {
  report: ReportData
  saving: boolean
  backLabel?: string
  onBack: () => void
  onSave: () => void
  saveLabel?: string
  onSaveToReports?: () => void
  onOpenTracking: () => void
  onCopyTag: (tag: string) => void
}

export function ReportView({
  report,
  saving,
  backLabel = 'New report',
  onBack,
  onSave,
  saveLabel = 'Save XLSX',
  onSaveToReports,
  onOpenTracking,
  onCopyTag
}: ReportViewProps): JSX.Element {
  const [clanFilter, setClanFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [onlyMissed, setOnlyMissed] = useState(false)

  const filteredPlayers = useMemo(() => {
    const query = search.trim().toLowerCase()
    return report.players.filter((player) => {
      if (clanFilter !== 'all' && player.clanTag !== clanFilter) return false
      if (onlyMissed && player.missed === 0) return false
      if (!query) return true
      return (
        player.name.toLowerCase().includes(query) ||
        player.tag.toLowerCase().includes(query) ||
        player.clan.toLowerCase().includes(query)
      )
    })
  }, [report.players, clanFilter, search, onlyMissed])

  const hasFilters = clanFilter !== 'all' || search.trim() !== '' || onlyMissed

  return (
    <main className="main report-main">
      <div className="report-top">
        <button type="button" className="button button-ghost" onClick={onBack}>
          <ArrowLeftIcon size={16} />
          {backLabel}
        </button>

        <div className="report-meta">
          <span className="season-badge">
            <CalendarIcon size={15} />
            {report.seasonLabel}
          </span>
          <span className="report-generated">
            Latest finished season · Generated {formatDateTime(report.generatedAt)}
          </span>
        </div>

        <div className="report-actions">
          {onSaveToReports ? (
            <button
              type="button"
              className="button button-secondary"
              onClick={onSaveToReports}
              disabled={saving}
            >
              <SaveIcon size={16} />
              Save to reports
            </button>
          ) : null}
          <button
            type="button"
            className="button button-primary"
            onClick={onSave}
            disabled={saving}
          >
            <DownloadIcon size={17} />
            {saving ? 'Saving…' : saveLabel}
          </button>
        </div>
      </div>

      <section className="report-heading">
        <div>
          <p className="eyebrow">Report ready</p>
          <h1>CWL {report.seasonLabel}</h1>
          <p className="report-subtitle">
            {formatInt(report.clans.length)} clan{report.clans.length === 1 ? '' : 's'} ·{' '}
            {formatInt(report.players.length)} player
            {report.players.length === 1 ? '' : 's'} · {formatInt(report.stats.attacks)} attacks
          </p>
        </div>

        <div className="clan-strip" aria-label="Clans in this report">
          {report.clans.map((clan) => (
            <span className="clan-pill" key={clan.tag}>
              <span className="clan-pill-name">{clan.name}</span>
              <span className="clan-pill-meta">
                {clan.league ?? 'CWL'}
                {clan.rank ? ` · Rank ${clan.rank}` : ''}
              </span>
            </span>
          ))}
        </div>
      </section>

      <SummaryCards stats={report.stats} />

      <WarningsPanel warnings={report.warnings} onOpenTracking={onOpenTracking} />

      <section className="report-table-panel panel">
        <div className="table-toolbar">
          <div className="toolbar-left">
            <div className="search-box">
              <SearchIcon size={16} />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, tag or clan"
                aria-label="Search players"
              />
            </div>

            <label className="select-control">
              <span className="sr-only">Filter by clan</span>
              <select
                value={clanFilter}
                onChange={(event) => setClanFilter(event.target.value)}
              >
                <option value="all">All clans</option>
                {report.clans.map((clan) => (
                  <option value={clan.tag} key={clan.tag}>
                    {clan.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="check-control">
              <input
                type="checkbox"
                checked={onlyMissed}
                onChange={(event) => setOnlyMissed(event.target.checked)}
              />
              Only missed attacks
            </label>
          </div>

          <div className="toolbar-right">
            <span className="row-count">
              {formatInt(filteredPlayers.length)} of {formatInt(report.players.length)} players
            </span>
            {hasFilters ? (
              <button
                type="button"
                className="link-button small"
                onClick={() => {
                  setClanFilter('all')
                  setSearch('')
                  setOnlyMissed(false)
                }}
              >
                Reset filters
              </button>
            ) : null}
          </div>
        </div>

        <PlayersTable players={filteredPlayers} onCopyTag={onCopyTag} />

        <div className="table-footer">
          <span>Destruction is the total percentage across all attacks.</span>
          <span className="table-source">
            <ShieldIcon size={14} />
            Data by ClashKing
            <button
              type="button"
              className="link-button small"
              onClick={() => void window.raven.openExternal('https://clashk.ing')}
            >
              clashk.ing
            </button>
            <span className="table-source-divider">·</span>
            Unofficial, not affiliated with Supercell
          </span>
        </div>
      </section>
    </main>
  )
}
