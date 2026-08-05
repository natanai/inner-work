import { useState } from 'react'
import { cognitionIdentity } from './cognitionIdentity'
import { normalizeSharedPersonName } from './gameParticipants'
import type { GameState } from './model'
import './shared-person-setup.css'

export function SharedPersonSetupScreen({
  game,
  onConfirm,
}: {
  game: GameState
  onConfirm: (name: string) => void
}) {
  const player = game.cognitions.find((cognition) => cognition.human) ?? game.cognitions[0]
  const identity = cognitionIdentity(player)
  const [value, setValue] = useState('')
  const name = normalizeSharedPersonName(value)

  return (
    <main className="shared-person-setup-page">
      <section className="shared-person-setup-card">
        <span className="shared-person-eyebrow">Before the first Situation</span>
        <h1>Three Cognitions influence one person.</h1>
        <p>Each Cognition brings different Needs and possible Strategies. Together, they shape what one person does next.</p>

        <div className={`shared-person-player owner-${player.id}`}>
          <b aria-label={`Seat ${identity.seat}`}>{identity.seat}</b>
          <span>You are</span>
          <strong>{identity.name}</strong>
        </div>

        <label htmlFor="shared-person-name">Who are you collectively influencing?</label>
        <input
          id="shared-person-name"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && name) onConfirm(name)
          }}
          maxLength={40}
          autoComplete="off"
          placeholder="For example, Billy"
          autoFocus
        />
        <small>This name will be used throughout the Story Table.</small>
        <button className="primary" disabled={!name} onClick={() => onConfirm(name)}>Begin {name ? `${name}’s` : 'the'} story</button>
      </section>
    </main>
  )
}
