import { useEffect, useState } from 'react'
import type { Cognition, GameState } from './model'
import { CardBack, CardFace, GiftIcon } from './Cards'
import { Deck } from './DealScreen'

function MobileCognitionDeal({ cognition, human, step }: { cognition: Cognition; human: boolean; step: number }) {
  return (
    <section className={`mobile-deal-cognition ${human ? 'human' : ''} ${step >= 2 ? 'visible' : ''}`}>
      <header><span>{human ? 'You' : 'NPC'}</span><strong>{cognition.name}</strong></header>
      <div className="mobile-deal-need-row">
        {cognition.publicNeeds.map((slot) => (
          <div key={slot.card.id} className="mobile-deal-need">
            <CardFace kind="need" id={slot.card.id} />
            <p><span>{slot.card.feeling}</span><strong>{slot.card.need}</strong><b><GiftIcon variation={0} />{slot.gifts}</b></p>
          </div>
        ))}
        <div className="mobile-deal-private"><CardBack kind="need" /><span>Private</span></div>
      </div>
      <div className="mobile-deal-hand" aria-label={`${cognition.hand.length} Strategy cards`}>
        {cognition.hand.map((card, index) => human && step >= 4
          ? <CardFace key={card.id} kind="strategy" id={card.id} style={{ transform: `translateX(${index * 22}px) rotate(${(index - 1.5) * 3}deg)` }} />
          : <CardBack key={card.id} kind="strategy" style={{ transform: `translateX(${index * 22}px) rotate(${(index - 1.5) * 3}deg)` }} />)}
      </div>
    </section>
  )
}

export function MobileDealScreen({ game, onDone }: { game: GameState; onDone: () => void }) {
  const [step, setStep] = useState(0)

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
            <CardFace kind="situation" id={game.situation.id} />
            <div><span>Situation</span><strong>{game.situation.title}</strong></div>
          </section>
        )}

        <div className="mobile-deal-opponents">
          <MobileCognitionDeal cognition={game.cognitions[1]} human={false} step={step} />
          <MobileCognitionDeal cognition={game.cognitions[2]} human={false} step={step} />
        </div>

        <MobileCognitionDeal cognition={game.cognitions[0]} human step={step} />
      </section>
      {step >= 4 && <button className="primary mobile-take-seat" onClick={onDone}>Take your seat</button>}
    </main>
  )
}
