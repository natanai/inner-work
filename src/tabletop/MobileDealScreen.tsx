import { useEffect, useState } from 'react'
import type { Cognition, GameState } from './model'
import { CardBack, CardFace, GiftIcon, type CardKind } from './Cards'
import { cognitionIdentity } from './cognitionIdentity'
import { Deck } from './DealScreen'

type InspectedCard = {
  kind: CardKind
  id: string
  label: string
}

function MobileCognitionDeal({ cognition, human, step, onInspect }: {
  cognition: Cognition
  human: boolean
  step: number
  onInspect: (card: InspectedCard) => void
}) {
  const identity = cognitionIdentity(cognition)
  return (
    <section className={`mobile-deal-cognition owner-${cognition.id} ${human ? 'human' : ''} ${step >= 2 ? 'visible' : ''}`}>
      <header className="cognition-identity-line">
        <b className={`cognition-identity-token owner-${cognition.id}`}>{identity.seat}</b>
        <div className="cognition-role-name"><small>{identity.role}</small><strong>{identity.name}</strong></div>
      </header>
      <div className="mobile-deal-need-row">
        {cognition.publicNeeds.map((slot) => (
          <div key={slot.card.id} className="mobile-deal-need">
            <button
              className="mobile-deal-card-button"
              onClick={() => onInspect({ kind: 'need', id: slot.card.id, label: `${slot.card.feeling}: ${slot.card.need}` })}
              aria-label={`Inspect ${slot.card.feeling}: ${slot.card.need}`}
            >
              <CardFace kind="need" id={slot.card.id} />
            </button>
            <p><span>{slot.card.feeling}</span><strong>{slot.card.need}</strong><b><GiftIcon variation={0} />{slot.gifts}</b></p>
          </div>
        ))}
        <div className="mobile-deal-private"><CardBack kind="need" /><span>Private</span></div>
      </div>
      <div className={`mobile-deal-hand ${human ? 'inspectable' : ''}`} aria-label={`${cognition.hand.length} Strategy cards`}>
        {cognition.hand.map((card, index) => human && step >= 4
          ? (
            <button
              key={card.id}
              className={`mobile-deal-hand-card mobile-deal-hand-card-${index + 1}`}
              onClick={() => onInspect({ kind: 'strategy', id: card.id, label: card.title })}
              aria-label={`Inspect ${card.title}`}
            >
              <CardFace kind="strategy" id={card.id} />
            </button>
          )
          : <CardBack key={card.id} kind="strategy" className={`mobile-deal-hand-card mobile-deal-hand-card-${index + 1}`} />)}
      </div>
    </section>
  )
}

export function MobileDealScreen({ game, onDone }: { game: GameState; onDone: () => void }) {
  const [step, setStep] = useState(0)
  const [inspected, setInspected] = useState<InspectedCard | null>(null)

  useEffect(() => {
    const timers = [1, 2, 3, 4].map((next, index) => window.setTimeout(() => setStep(next), 450 + index * 600))
    return () => timers.forEach(window.clearTimeout)
  }, [game.situation.id])

  const messages = [
    'Setting the decks…',
    'Drawing a Situation…',
    'Dealing Public and Private Needs…',
    'Dealing hidden Strategy hands…',
    'Your hand is ready.',
  ]

  return (
    <main className="mobile-deal-page">
      <header className="mobile-deal-header"><span>Inner Work</span><strong>{messages[step]}</strong></header>
      <section className="mobile-deal-stage">
        <div className="mobile-deal-decks">
          <Deck kind="situation" count={game.situationDeck.length + 1} />
          <Deck kind="need" count={game.needDeck.length + 9} />
          <Deck kind="strategy" count={game.strategyDeck.length + 12} />
        </div>

        {step >= 1 && (
          <section className="mobile-deal-situation">
            <button className="mobile-deal-card-button" onClick={() => setInspected({ kind: 'situation', id: game.situation.id, label: game.situation.title })} aria-label={`Inspect ${game.situation.title}`}>
              <CardFace kind="situation" id={game.situation.id} />
            </button>
            <div><span>Situation</span><strong>{game.situation.title}</strong></div>
          </section>
        )}

        <div className="mobile-deal-opponents">
          <MobileCognitionDeal cognition={game.cognitions[1]} human={false} step={step} onInspect={setInspected} />
          <MobileCognitionDeal cognition={game.cognitions[2]} human={false} step={step} onInspect={setInspected} />
        </div>

        <MobileCognitionDeal cognition={game.cognitions[0]} human step={step} onInspect={setInspected} />
      </section>
      {step >= 4 && <button className="primary mobile-take-seat" onClick={onDone}>Take your seat</button>}

      {inspected && (
        <dialog open className="mobile-card-dialog mobile-deal-inspector" onClick={() => setInspected(null)} aria-label={inspected.label}>
          <div className={`mobile-dialog-inner mobile-dialog-${inspected.kind}`} onClick={(event) => event.stopPropagation()}>
            <button className="mobile-dialog-close" onClick={() => setInspected(null)} aria-label="Close card">×</button>
            <div className="mobile-dialog-image"><CardFace kind={inspected.kind} id={inspected.id} /></div>
            <section><h2>{inspected.label}</h2></section>
          </div>
        </dialog>
      )}
    </main>
  )
}
