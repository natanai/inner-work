import { useEffect, useState } from 'react'
import type { Cognition, GameState } from './model'
import { CardBack, CardFace } from './Cards'

export function Deck({ kind, count }: { kind: 'strategy' | 'need' | 'situation'; count: number }) {
  const label = kind === 'strategy' ? 'Strategy' : kind === 'need' ? 'Need' : 'Situation'
  return <div className={`deck deck-${kind}`}>
    <i /><i /><CardBack kind={kind} />
    <span>{label}<b>{count}</b></span>
  </div>
}

function OpponentDeal({ cognition, visible }: { cognition: Cognition; visible: boolean }) {
  return <div className={`deal-opponent ${visible ? 'visible' : ''}`}>
    <strong>{cognition.name}</strong>
    <div className="dealt-needs">{cognition.publicNeeds.map((slot) => <CardFace key={slot.card.id} kind="need" id={slot.card.id} />)}<CardBack kind="need" /></div>
    <div className="dealt-hidden-hand">{cognition.hand.map((card, index) => <CardBack key={card.id} kind="strategy" style={{ transform: `translateX(${index * 18}px) rotate(${(index - 1.5) * 5}deg)` }} />)}</div>
  </div>
}

export function DealScreen({ game, onDone }: { game: GameState; onDone: () => void }) {
  const [step, setStep] = useState(0)
  useEffect(() => {
    const timers = [1, 2, 3, 4].map((next, index) => window.setTimeout(() => setStep(next), 650 + index * 750))
    return () => timers.forEach(window.clearTimeout)
  }, [game.situation.id])
  const alpha = game.cognitions[0]
  const messages = ['Setting the decks on the table…', 'Drawing a Situation…', 'Dealing Public and Private Needs…', 'Dealing Strategy hands facedown…', 'Your hand is ready.']
  return <main className="deal-page"><section className="deal-table">
    <p className="deal-message">{messages[step]}</p>
    <OpponentDeal cognition={game.cognitions[1]} visible={step >= 2} />
    <div className="deal-center">
      <div className="deal-decks"><Deck kind="situation" count={game.situationDeck.length + 1} /><Deck kind="need" count={game.needDeck.length + 9} /><Deck kind="strategy" count={game.strategyDeck.length + 12} /></div>
      {step >= 1 && <CardFace kind="situation" id={game.situation.id} className="dealt-situation" />}
    </div>
    <OpponentDeal cognition={game.cognitions[2]} visible={step >= 2} />
    <div className={`deal-player ${step >= 2 ? 'visible' : ''}`}>
      <div className="dealt-needs">{alpha.publicNeeds.map((slot) => <CardFace key={slot.card.id} kind="need" id={slot.card.id} />)}<CardBack kind="need" /></div>
      <div className="dealt-player-hand">{alpha.hand.map((card, index) => step >= 4 ? <CardFace key={card.id} kind="strategy" id={card.id} style={{ animationDelay: `${index * 90}ms` }} /> : step >= 3 ? <CardBack key={card.id} kind="strategy" style={{ animationDelay: `${index * 90}ms` }} /> : null)}</div>
    </div>
    {step >= 4 && <button className="primary take-seat" onClick={onDone}>Take your seat</button>}
  </section></main>
}
