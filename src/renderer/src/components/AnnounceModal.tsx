import { useCallback, useState, type JSX } from 'react'
import type { PlayerRow, RosterClan } from '@shared/types'
import { DiscordIcon, WhatsAppIcon, CopyIcon, XIcon } from './Icons'
import { Modal } from './Modal'

interface AnnounceModalProps {
  clans: RosterClan[]
  players: PlayerRow[]
  seasonLabel: string
  onClose: () => void
}

interface ClanPlayers {
  tag: string
  name: string
  players: PlayerRow[]
}

function clanKey(clan: Pick<RosterClan, 'tag'>): string {
  return clan.tag.replace(/^#/, '')
}

function cocLink(clanTag: string): string {
  const tag = clanTag.replace(/^#/, '')
  return `https://link.clashofclans.com/en/?action=OpenClanProfile&tag=%23${tag}`
}

function monthYear(seasonLabel: string): string {
  const match = seasonLabel.match(/([A-Z][a-z]+)\s+(\d{4})/)
  if (match) return `${match[1]} ${match[2]}`
  return seasonLabel
}

function groupPlayersByClan(
  clans: RosterClan[],
  players: PlayerRow[]
): ClanPlayers[] {
  const byClan = new Map<string, ClanPlayers>()
  const order: string[] = []

  for (const clan of clans) {
    const tag = clanKey(clan)
    byClan.set(tag, { tag, name: clan.name, players: [] })
    order.push(tag)
  }

  for (const player of players) {
    const tag = clanKey(player.clanTag ? { tag: player.clanTag } : { tag: '' })
    const entry = byClan.get(tag)
    if (entry) {
      entry.players.push(player)
    } else {
      byClan.set(tag, { tag: player.clanTag, name: player.clan, players: [player] })
      order.push(tag)
    }
  }

  return order.map((tag) => byClan.get(tag)!)
}

function buildDiscordMessage(
  seasonLabel: string,
  customMessage: string,
  groups: ClanPlayers[]
): string {
  const lines: string[] = []
  lines.push(`# CWL Roster ${monthYear(seasonLabel)}`)
  lines.push('')
  if (customMessage.trim()) {
    lines.push(customMessage.trim())
    lines.push('')
  }
  for (const group of groups) {
    if (group.players.length === 0) continue
    lines.push(`## ${group.name}`)
    lines.push(cocLink(group.tag))
    lines.push('')
    for (const player of group.players) {
      lines.push(` * ${player.name}`)
    }
    lines.push('')
  }
  return lines.join('\n').trimEnd() + '\n'
}

function buildWhatsAppMessage(
  seasonLabel: string,
  customMessage: string,
  groups: ClanPlayers[]
): string {
  const lines: string[] = []
  lines.push(`🏆 *CWL Roster ${monthYear(seasonLabel)}*`)
  lines.push('')
  if (customMessage.trim()) {
    lines.push(customMessage.trim())
    lines.push('')
  }
  for (const group of groups) {
    if (group.players.length === 0) continue
    lines.push(`🏰 *${group.name}*`)
    lines.push(`🔗 ${cocLink(group.tag)}`)
    lines.push('')
    for (const player of group.players) {
      lines.push(`• ${player.name}`)
    }
    lines.push('')
  }
  return lines.join('\n').trimEnd() + '\n'
}

async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text)
    return
  }
  // Fallback for non-secure contexts (e.g. file:// Electron renderer)
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  try {
    document.execCommand('copy')
  } finally {
    document.body.removeChild(textarea)
  }
}

export function AnnounceModal({
  clans,
  players,
  seasonLabel,
  onClose
}: AnnounceModalProps): JSX.Element {
  const groups = groupPlayersByClan(clans, players)
  const [customMessage, setCustomMessage] = useState('')
  const [copied, setCopied] = useState<'discord' | 'whatsapp' | null>(null)

  const discordMessage = buildDiscordMessage(seasonLabel, customMessage, groups)
  const whatsAppMessage = buildWhatsAppMessage(seasonLabel, customMessage, groups)

  const handleCopy = async (kind: 'discord' | 'whatsapp', text: string): Promise<void> => {
    try {
      await copyToClipboard(text)
      setCopied(kind)
      setTimeout(() => setCopied(null), 1200)
    } catch {
      setCopied(null)
    }
  }

  return (
    <Modal
      title="Generate announcement"
      subtitle="CWL roster announcement"
      onClose={onClose}
      width="wide"
    >
      <div className="announce-body">
        <label className="field-label">Custom message (optional)</label>
        <textarea
          className="text-input"
          value={customMessage}
          onChange={(event) => setCustomMessage(event.target.value)}
          rows={4}
          placeholder="Add a custom message that will appear after the title."
        />
        <div className="announce-preview">
          <h4>Preview (Discord)</h4>
          <pre className="announce-pre">{discordMessage}</pre>
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={() => void handleCopy('discord', discordMessage)}
            disabled={copied === 'discord'}
          >
            <DiscordIcon size={14} />
            {copied === 'discord' ? 'Copied!' : 'Copy to clipboard'}
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => void handleCopy('whatsapp', whatsAppMessage)}
            disabled={copied === 'whatsapp'}
          >
            <WhatsAppIcon size={14} />
            {copied === 'whatsapp' ? 'Copied!' : 'Copy to clipboard'}
          </button>
          <button type="button" className="button button-secondary" onClick={onClose}>
            <XIcon size={14} />
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}
