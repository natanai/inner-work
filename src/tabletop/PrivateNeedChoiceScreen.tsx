import { useState } from 'react'
import { CardFace } from './Cards'
import type { GameState } from './model'
import { privateNeedCandidates } from './privateNeedChoice'

export function PrivateNeedChoiceScreen({
  game,
  onChoose,
}: {
  game: GameState
  onChoose: (cardId: string) => void
}) {
  const candidates = privateNeedCandidates(game)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [memorizing, setMemorizing] = useState(false)
  const selected = candidates.find((slot) => slot.card.id === selectedId) ?? null

  if (memorizing && selected) {
    return (
      <main className="private-choice-page memorizing">
        <section className="private-choice-memory">
          <span>Before it turns face down</span>
          <h1>Remember your Private Need.</h1>
          <p>This Need can earn individual points when any legally played Strategy tends it. After setup, the magnifying glass is your one opportunity this Situation to look again.</p>
          <div className="private-memory-card">
            <CardFace kind="need" id={selected.card.id} />
          </div>
          <div className="private-memory-label"><small>{selected.card.feeling}</small><strong>{selected.card.need}</strong></div>
          <button className="primary" onClick={() => onChoose(selected.card.id)}>Place it face down</button>
          <button className="quiet" onClick={() => setMemorizing(false)}>Choose a different Need</button>
        </section>
      </main>
    )
  }

  return (
    <main className="private-choice-page">
      <section className="private-choice-shell">
        <header>
          <span>Need setup</span>
          <h1>Choose one Private Need.</h1>
          <p>The other two become your Public Needs. Your Private Need begins with one gift, stays hidden from the other Cognitions, and provides your personal scoring opportunity.</p>
        </header>
        <div className="private-choice-cards" role="radiogroup" aria-label="Choose your Private Need">
          {candidates.map((slot, index) => {
            const selectedCard = selectedId === slot.card.id
            return (
              <button
                key={slot.card.id}
                className={selectedCard ? 'selected' : ''}
                onClick={() => setSelectedId(slot.card.id)}
                role="radio"
                aria-checked={selectedCard}
              >
                <span className="choice-number">{index + 1}</span>
                <CardFace kind="need" id={slot.card.id} />
                <span className="choice-copy"><small>{slot.card.feeling}</small><strong>{slot.card.need}</strong></span>
                <span className="choice-status">{selectedCard ? 'Private' : 'Choose as Private'}</span>
              </button>
            )
          })}
        </div>
        <aside><strong>Public versus Private</strong><p>Public Needs receive the Situation’s gift modifiers and must be cleared for the group to move on. The Private Need is not changed by the Situation and is worth individual points.</p></aside>
        <button className="primary private-choice-confirm" disabled={!selected} onClick={() => setMemorizing(true)}>Review and memorize this Need</button>
      </section>
    </main>
  )
}
