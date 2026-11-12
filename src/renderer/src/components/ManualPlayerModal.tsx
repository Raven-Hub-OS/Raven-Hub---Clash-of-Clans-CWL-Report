import { useId, useState, type JSX } from 'react'
import { normalizeTag } from '@shared/tags'
import type { PlayerRow, RosterClan } from '@shared/types'
import { Modal } from './Modal'

interface ManualPlayerModalProps {
  clan: RosterClan
  onAdd: (player: PlayerRow) => void
  onClose: () => void
}

interface ManualPlayerForm {
  name: string
  tag: string
  th: string
  stars: string
  avgStars: string
  missed: string
}

const EMPTY_FORM: ManualPlayerForm = {
  name: '',
  tag: '',
  th: '15',
  stars: '0',
  avgStars: '0',
  missed: '0'
}

export function ManualPlayerModal({
  clan,
  onAdd,
  onClose
}: ManualPlayerModalProps): JSX.Element {
  const [form, setForm] = useState<ManualPlayerForm>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const nameId = useId()
  const tagId = useId()
  const thId = useId()
  const starsId = useId()
  const avgStarsId = useId()
  const missedId = useId()

  const update = (field: keyof ManualPlayerForm, value: string): void => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = (): void => {
    const name = form.name.trim()
    if (!name) {
      setError('Enter the player name.')
      return
    }

    const typedTag = form.tag.trim()
    const playerTag = typedTag ? normalizeTag(typedTag) : null
    if (typedTag && !playerTag) {
      setError('Enter a valid player tag, for example #2PP, or leave it blank.')
      return
    }

    const th = wholeNumber(form.th)
    const stars = wholeNumber(form.stars)
    const missed = wholeNumber(form.missed)
    const avgStars = decimalNumber(form.avgStars)
    if (th === null || stars === null || missed === null || avgStars === null) {
      setError('TH, stars and missed must be numbers.')
      return
    }

    setError(null)
    onAdd({
      clanTag: clan.tag,
      clan: clan.name,
      name,
      tag: playerTag ?? manualTag(),
      th,
      warsParticipated: 0,
      attacks: 0,
      missed,
      attackStars: stars,
      avgStars,
      destruction: 0,
      defenses: 0,
      defenseStars: 0,
      avgDefense: 0,
      reaches: 0,
      dips: 0
    })
  }

  return (
    <Modal
      title="Add player manually"
      subtitle={`${clan.name}${clan.league ? ` · ${clan.league}` : ''}`}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          handleSubmit()
        }}
      >
        <div className="manual-player-grid">
          <div className="form-field">
            <label className="field-label" htmlFor={nameId}>
              Player name
            </label>
            <input
              id={nameId}
              className="text-input"
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
              maxLength={80}
              autoFocus
            />
          </div>

          <div className="form-field">
            <label className="field-label" htmlFor={tagId}>
              Player tag (optional)
            </label>
            <input
              id={tagId}
              className="text-input"
              value={form.tag}
              onChange={(event) => update('tag', event.target.value)}
              placeholder="#2PP"
              maxLength={20}
            />
          </div>

          <div className="form-field">
            <label className="field-label" htmlFor={thId}>
              TH
            </label>
            <input
              id={thId}
              className="text-input"
              type="number"
              min="1"
              max="99"
              step="1"
              value={form.th}
              onChange={(event) => update('th', event.target.value)}
            />
          </div>

          <div className="form-field">
            <label className="field-label" htmlFor={starsId}>
              Stars
            </label>
            <input
              id={starsId}
              className="text-input"
              type="number"
              min="0"
              step="1"
              value={form.stars}
              onChange={(event) => update('stars', event.target.value)}
            />
          </div>

          <div className="form-field">
            <label className="field-label" htmlFor={avgStarsId}>
              Avg stars
            </label>
            <input
              id={avgStarsId}
              className="text-input"
              type="number"
              min="0"
              step="0.01"
              value={form.avgStars}
              onChange={(event) => update('avgStars', event.target.value)}
            />
          </div>

          <div className="form-field">
            <label className="field-label" htmlFor={missedId}>
              Missed
            </label>
            <input
              id={missedId}
              className="text-input"
              type="number"
              min="0"
              step="1"
              value={form.missed}
              onChange={(event) => update('missed', event.target.value)}
            />
          </div>
        </div>

        <p className="field-hint">
          Manual players keep these visible stats. Detailed report stats start at zero.
        </p>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="modal-actions">
          <button type="submit" className="button button-primary">
            Add player
          </button>
          <button type="button" className="button button-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}

function wholeNumber(value: string): number | null {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) return null
  return Math.round(number)
}

function decimalNumber(value: string): number | null {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) return null
  return number
}

function manualTag(): string {
  return `#MANUAL${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}
