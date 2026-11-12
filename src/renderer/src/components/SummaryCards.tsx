import type { JSX } from 'react'
import type { ReportStats } from '@shared/types'
import { formatDecimal, formatInt } from '../lib/format'
import {
  SwordsIcon,
  ShieldIcon,
  TargetIcon,
  UsersIcon,
  ClockIcon,
  TrophyIcon
} from './Icons'

interface SummaryCardsProps {
  stats: ReportStats
}

export function SummaryCards({ stats }: SummaryCardsProps): JSX.Element {
  const cards = [
    {
      label: 'Clans',
      value: formatInt(stats.clans),
      hint: 'in this report',
      tone: 'indigo',
      icon: <ShieldIcon size={17} />
    },
    {
      label: 'Players',
      value: formatInt(stats.players),
      hint: 'with a CWL row',
      tone: 'sky',
      icon: <UsersIcon size={17} />
    },
    {
      label: 'Attacks',
      value: formatInt(stats.attacks),
      hint: `${formatInt(stats.attackStars)} stars scored`,
      tone: 'blue',
      icon: <SwordsIcon size={17} />
    },
    {
      label: 'Missed',
      value: formatInt(stats.missed),
      hint: stats.missed === 0 ? 'perfect attendance' : 'attacks not used',
      tone: stats.missed === 0 ? 'green' : 'amber',
      icon: <ClockIcon size={17} />
    },
    {
      label: 'Avg stars',
      value: formatDecimal(stats.avgStars, 2),
      hint: 'per attack',
      tone: 'green',
      icon: <TrophyIcon size={17} />
    },
    {
      label: 'Avg defense',
      value: formatDecimal(stats.avgDefense, 2),
      hint: 'lower is better',
      tone: 'rose',
      icon: <TargetIcon size={17} />
    }
  ]

  return (
    <section className="summary-grid" aria-label="Report summary">
      {cards.map((card) => (
        <article className={`summary-card tone-${card.tone}`} key={card.label}>
          <div className="summary-card-top">
            <span className="summary-icon">{card.icon}</span>
            <span className="summary-label">{card.label}</span>
          </div>
          <strong className="summary-value">{card.value}</strong>
          <span className="summary-hint">{card.hint}</span>
        </article>
      ))}
    </section>
  )
}
