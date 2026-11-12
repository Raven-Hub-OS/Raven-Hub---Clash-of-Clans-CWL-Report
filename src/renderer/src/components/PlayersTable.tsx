import { useMemo, useState, type JSX } from 'react'
import {
  createSortedRowModel,
  flexRender,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type SortingState
} from '@tanstack/react-table'
import type { PlayerRow } from '@shared/types'
import { formatDecimal, formatInt } from '../lib/format'
import {
  attackStarsTone,
  avgDefenseTone,
  avgStarsTone,
  destructionTone,
  missedTone
} from '../lib/metrics'
import { CopyIcon } from './Icons'

interface PlayersTableProps {
  players: PlayerRow[]
  onCopyTag: (tag: string) => void
}

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel()
})

const NUMERIC_COLUMNS = new Set([
  'th',
  'warsParticipated',
  'attacks',
  'missed',
  'attackStars',
  'avgStars',
  'destruction',
  'defenses',
  'defenseStars',
  'avgDefense',
  'reaches',
  'dips'
])

const HEADER_TITLES: Record<string, string> = {
  tag: 'Full player tag',
  th: 'Town Hall level from the most recent war played',
  warsParticipated: 'Wars in which the player was on the clan lineup',
  missed: 'Wars participated minus attacks used',
  attackStars: 'Total stars earned in attack',
  avgStars: 'Attack stars divided by attacks',
  destruction: 'Total destruction percentage across all attacks',
  defenses: 'Attacks received from the opposing clan',
  defenseStars: 'Stars conceded while defending',
  avgDefense: 'Defense stars divided by defenses, lower is better',
  reaches: 'Attacks made against a higher Town Hall',
  dips: 'Attacks made against a lower Town Hall'
}

export function PlayersTable({ players, onCopyTag }: PlayersTableProps): JSX.Element {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'clan', desc: false },
    { id: 'attackStars', desc: true }
  ])

  const columns = useMemo<ColumnDef<typeof features, PlayerRow>[]>(
    () => [
      {
        accessorKey: 'clan',
        header: 'Clan',
        cell: (info) => {
          const clan = info.getValue() as string
          return (
            <span className="player-clan" title={clan}>
              {clan}
            </span>
          )
        }
      },
      {
        accessorKey: 'name',
        header: 'Name',
        cell: (info) => {
          const name = info.getValue() as string
          return (
            <span className="player-name" title={name}>
              {name}
            </span>
          )
        }
      },
      {
        accessorKey: 'tag',
        header: '#',
        cell: (info) => {
          const tag = info.getValue() as string
          return (
            <button
              type="button"
              className="tag-copy"
              onClick={() => onCopyTag(tag)}
              title={`Copy ${tag}`}
            >
              <span>{tag}</span>
              <CopyIcon size={13} />
            </button>
          )
        }
      },
      {
        accessorKey: 'th',
        header: 'TH',
        cell: (info) => <span className="th-badge">{formatInt(info.getValue() as number)}</span>
      },
      {
        accessorKey: 'warsParticipated',
        header: 'Wars Participated',
        cell: (info) => formatInt(info.getValue() as number)
      },
      {
        accessorKey: 'attacks',
        header: 'Attacks',
        cell: (info) => formatInt(info.getValue() as number)
      },
      {
        accessorKey: 'missed',
        header: 'Missed',
        cell: (info) => {
          const value = info.getValue() as number
          return <span className={`metric ${missedTone(value)}`}>{formatInt(value)}</span>
        }
      },
      {
        accessorKey: 'attackStars',
        header: 'Attack Stars',
        cell: (info) => {
          const row = info.row.original
          return (
            <span
              className={`metric ${attackStarsTone(row.attackStars, row.warsParticipated, row.missed)}`}
            >
              {formatInt(row.attackStars)}
            </span>
          )
        }
      },
      {
        accessorKey: 'avgStars',
        header: 'Avg Stars',
        cell: (info) => {
          const row = info.row.original
          return (
            <span className={`metric ${avgStarsTone(row.avgStars, row.attacks)}`}>
              {formatDecimal(row.avgStars, 2)}
            </span>
          )
        }
      },
      {
        accessorKey: 'destruction',
        header: 'Destruction',
        cell: (info) => {
          const row = info.row.original
          return (
            <span className={`metric ${destructionTone(row.destruction, row.attacks)}`}>
              {formatDecimal(row.destruction, 2)}
            </span>
          )
        }
      },
      {
        accessorKey: 'defenses',
        header: 'Defenses',
        cell: (info) => {
          const value = info.getValue() as number
          return <span className={value === 0 ? 'muted-value' : ''}>{formatInt(value)}</span>
        }
      },
      {
        accessorKey: 'defenseStars',
        header: 'Defense Stars',
        cell: (info) => formatInt(info.getValue() as number)
      },
      {
        accessorKey: 'avgDefense',
        header: 'Avg Defense',
        cell: (info) => {
          const row = info.row.original
          return (
            <span className={`metric ${avgDefenseTone(row.avgDefense, row.defenses)}`}>
              {row.defenses === 0 ? '—' : formatDecimal(row.avgDefense, 2)}
            </span>
          )
        }
      },
      {
        accessorKey: 'reaches',
        header: 'Reaches',
        cell: (info) => {
          const value = info.getValue() as number
          return <span className={value === 0 ? 'muted-value' : ''}>{formatInt(value)}</span>
        }
      },
      {
        accessorKey: 'dips',
        header: 'Dips',
        cell: (info) => {
          const value = info.getValue() as number
          return <span className={value === 0 ? 'muted-value' : ''}>{formatInt(value)}</span>
        }
      }
    ],
    [onCopyTag]
  )

  const table = useTable({
    features,
    data: players,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getRowId: (row) => `${row.clanTag}:${row.tag}`
  })

  return (
    <div className="table-shell">
      <table className="players-table" aria-label="CWL player statistics">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sorted = header.column.getIsSorted()
                const numeric = NUMERIC_COLUMNS.has(header.column.id)
                return (
                  <th
                    key={header.id}
                    className={`${numeric ? 'numeric' : ''} ${
                      header.column.id === 'clan' ? 'sticky-col' : ''
                    }`}
                    aria-sort={
                      sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'
                    }
                    title={HEADER_TITLES[header.column.id]}
                  >
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        type="button"
                        className="sort-button"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <span className={`sort-mark ${sorted || 'none'}`} aria-hidden="true">
                          {sorted === 'asc' ? '↑' : sorted === 'desc' ? '↓' : '↕'}
                        </span>
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td className="table-empty" colSpan={columns.length}>
                No players match the current filters.
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getAllCells().map((cell) => {
                  const numeric = NUMERIC_COLUMNS.has(cell.column.id)
                  return (
                    <td
                      key={cell.id}
                      className={`${numeric ? 'numeric' : ''} ${
                        cell.column.id === 'clan' ? 'sticky-col' : ''
                      }`}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  )
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
