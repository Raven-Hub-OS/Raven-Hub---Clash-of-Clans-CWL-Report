import type { JSX } from 'react'
import { ArrowRightIcon, CheckCircleIcon, ExternalLinkIcon, HelpIcon } from './Icons'

interface TrackingModalProps {
  onClose: () => void
}

const STEPS = [
  {
    title: 'Use or create a Discord server',
    body: 'ClashKing is managed through Discord. A small private server is enough.'
  },
  {
    title: 'Invite ClashKing with admin permissions',
    body: 'Use the official invite link and accept the permissions the bot requests.'
  },
  {
    title: 'Create a member role and a clan channel',
    body: 'For example @member and #general. They are required by the /addclan command.'
  },
  {
    title: 'Run /addclan for each clan',
    body: 'Provide the clan tag, a category, the member role and the clan channel. Repeat for every clan you want to track.'
  },
  {
    title: 'Wait, then generate the report again',
    body: 'ClashKing polls the game and may take a few minutes to expose the new data.'
  }
]

export function TrackingModal({ onClose }: TrackingModalProps): JSX.Element {
  const open = (url: string): void => {
    void window.raven.openExternal(url)
  }

  return (
    <div className="tracking-content">
      <div className="tracking-intro">
        <span className="tracking-icon">
          <HelpIcon size={22} />
        </span>
        <p>
          ClashKing only stores detailed CWL history for clans that have been added to a Discord
          server with the ClashKing bot. This is a one-time setup per clan.
        </p>
      </div>

      <ol className="setup-steps">
        {STEPS.map((step, index) => (
          <li key={step.title}>
            <span className="setup-step-number">{index + 1}</span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="tracking-note">
        <CheckCircleIcon size={18} />
        <p>
          <strong>Add clans before the CWL starts.</strong> Historical seasons are not guaranteed
          after a clan is added, so tracking usually begins with the next CWL.
        </p>
      </div>

      <div className="modal-actions">
        <button
          type="button"
          className="button button-primary"
          onClick={() => open('https://invite.clashk.ing')}
        >
          Invite ClashKing
          <ExternalLinkIcon size={15} />
        </button>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => open('https://docs.clashk.ing/clan-setups/add-a-clan')}
        >
          Open setup guide
          <ArrowRightIcon size={15} />
        </button>
        <button type="button" className="button button-ghost" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  )
}
