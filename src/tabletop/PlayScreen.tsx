import { useState } from 'react'
import type { StrategyCard } from '../data/cards'
import type { Cognition, GameState, Resolution } from './model'
import { canPlay } from './model'
import { CardBack, CardFace, Magnifier, NeedCardOnTable, type CardKind } from './Cards'
import { Deck } from './DealScreen'

type InspectedCard = {
  kind: CardKind
  id: string
  label: string
}

function NpcSeat({
  cognition,
  resolution,
  onInspect,
}: {
  cognition: Cognition
  resolution?: Resolution
  onInspect: (card: InspectedCard) => void
}) {
  return (
    <section className={`npc-seat npc-${cognition.id}`}>
      <header><span>NPC</span><strong>{cognition.name}</strong><b>{cognition.privateScore} private</b></header>
      <div className="npc-needs">
        {cognition.publicNeeds.map((slot) => (
          <NeedCardOnTable
            key={slot.card.id}
            slot={slot}
            onInspect={() => onInspect({ kind: 'need', id: slot.card.id, label: `${slot.card.feeling}: ${slot.card.need}` })}
          />
        ))}
        <div className="private-back"><CardBack kind="need" /><span>Private</span></div>
      </div>
      <div className="npc-hand" aria-label={`${cognition.hand.length} hidden Strategy cards`}>
        {cognition.hand.map((card, index) => (
          <CardBack key={card.id} kind="strategy" style={{ transform: `translateX(${index * 22}px) rotate(${(index - 1.5) * 4}deg)` }} />
        ))}
      </div>
      <p>{resolution ? <>Revealed <strong>{resolution.strategy.title}</strong></> : 'Choosing privately'}</p>
    </section>
  )
}

function Reveal({
  lines,
  onInspect,
}: {
  lines: Resolution[]
  onInspect: (card: InspectedCard) => void
}) {
  return (
    <section className="reveal-tray" aria-live="polite">
      <span className="caption">Strategies revealed together</span>
      <div className="revealed-row">
        {lines.map((line) => (
          <article key={line.cognitionId}>
            <button
              className="inspectable-card"
              onClick={() => onInspect({ kind: 'strategy', id: line.strategy.id, label: line.strategy.title })}
              aria-label={`Enlarge ${line.strategy.title}`}
            >
              <CardFace kind="strategy" id={line.strategy.id} />
            </button>
            <strong>{line.cognitionName}</strong>
            <small>{line.legal ? `+${line.shared} shared · +${line.private} private` : 'Discarded'}</small>
          </article>
        ))}
      </div>
      <div className="story-notes">{lines.map((line) => <p key={line.cognitionId}>{line.story}</p>)}</div>
    </section>
  )
}

function PlayerSeat({
  cognition,
  phase,
  onSelect,
  onRevealPrivate,
  onInspect,
}: {
  cognition: Cognition
  phase: GameState['phase']
  onSelect: (id: string) => void
  onRevealPrivate: () => void
  onInspect: (card: InspectedCard) => void
}) {
  return (
    <section className="player-seat">
      <header className="player-title"><div><span>You are</span><h2>{cognition.name}</h2></div><b>{cognition.privateScore} private points</b></header>
      <div className="player-needs">
        <div>
          <span className="caption">Your Public Needs</span>
          <div className="large-needs">
            {cognition.publicNeeds.map((slot) => (
              <NeedCardOnTable
                key={slot.card.id}
                slot={slot}
                large
                onInspect={() => onInspect({ kind: 'need', id: slot.card.id, label: `${slot.card.feeling}: ${slot.card.need}` })}
              />
            ))}
          </div>
        </div>
        <div>
          <span className="caption">Your Private Need</span>
          <div className="private-station">
            {cognition.privateVisible ? (
              <NeedCardOnTable
                slot={cognition.privateNeed}
                large
                onInspect={() => onInspect({ kind: 'need', id: cognition.privateNeed.card.id, label: `${cognition.privateNeed.card.feeling}: ${cognition.privateNeed.card.need}` })}
              />
            ) : <CardBack kind="need" className="large-private" />}
            <Magnifier used={cognition.magnifierUsed} disabled={phase !== 'planning' || cognition.magnifierUsed} onClick={onRevealPrivate} />
          </div>
        </div>
      </div>
      <div className="hand-area">
        <header><div><span className="caption">Your Strategy hand</span><strong>Choose one card</strong></div><small>Choose the card to play. Use “View” to enlarge it.</small></header>
        <div className="player-hand">
          {cognition.hand.map((card: StrategyCard) => {
            const selected = card.id === cognition.selected
            const legal = canPlay(cognition, card)
            return (
              <div className={`hand-card ${selected ? 'selected' : ''}`} key={card.id}>
                <button className="card-choice" disabled={phase !== 'planning'} onClick={() => onSelect(card.id)} aria-pressed={selected}>
                  <CardFace kind="strategy" id={card.id} />
                  <span className={legal ? 'playable' : 'discard'}>{legal ? 'Playable' : 'Discard only'}</span>
                </button>
                <button className="inspect" onClick={() => onInspect({ kind: 'strategy', id: card.id, label: card.title })} aria-label={`Enlarge ${card.title}`}>View</button>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export function PlayScreen({
  game,
  onChange,
  onNextSituation,
  onEnd,
}: {
  game: GameState
  onChange: (game: GameState) => void
  onNextSituation: () => void
  onEnd: () => void
}) {
  const [inspected, setInspected] = useState<InspectedCard | null>(null)
  const alpha = game.cognitions[0]
  const beta = game.cognitions[1]
  const gamma = game.cognitions[2]
  const betaResult = game.resolution.find((line) => line.cognitionId === 'beta')
  const gammaResult = game.resolution.find((line) => line.cognitionId === 'gamma')

  return (
    <main className="play-page">
      <header className="game-top">
        <div><span>Inner Work · Situation {game.situationNumber}</span><strong>{game.situation.title}</strong></div>
        <div><b>{game.sharedScore} shared gifts</b><b>Round {game.round}</b><button onClick={onEnd}>End day</button></div>
      </header>
      <section className="game-table">
        <NpcSeat cognition={beta} resolution={betaResult} onInspect={setInspected} />
        <section className="center-table">
          <div className="deck-row"><Deck kind="situation" count={game.situationDeck.length} /><Deck kind="need" count={game.needDeck.length} /><Deck kind="strategy" count={game.strategyDeck.length} /></div>
          <button
            className="inspectable-card situation-inspect"
            onClick={() => setInspected({ kind: 'situation', id: game.situation.id, label: game.situation.title })}
            aria-label={`Enlarge ${game.situation.title}`}
          >
            <CardFace kind="situation" id={game.situation.id} className="center-situation" />
          </button>
          {game.phase === 'planning' ? (
            <div className="turn-prompt"><b>1</b><p><strong>Choose one Strategy.</strong><span>Cognitions β and γ choose in secret. All three cards reveal together.</span></p></div>
          ) : <Reveal lines={game.resolution} onInspect={setInspected} />}
        </section>
        <NpcSeat cognition={gamma} resolution={gammaResult} onInspect={setInspected} />
        <PlayerSeat
          cognition={alpha}
          phase={game.phase}
          onSelect={(id) => onChange({ ...game, cognitions: game.cognitions.map((cognition) => cognition.id === 'alpha' ? { ...cognition, selected: cognition.selected === id ? null : id } : cognition) })}
          onRevealPrivate={() => onChange({ ...game, cognitions: game.cognitions.map((cognition) => cognition.id === 'alpha' ? { ...cognition, privateVisible: true, magnifierUsed: true } : cognition) })}
          onInspect={setInspected}
        />
      </section>
      <footer className="action-bar">
        <div><span>{game.phase === 'planning' ? 'Your turn' : game.phase === 'complete' ? 'Situation complete' : 'Round complete'}</span><strong>{game.phase === 'planning' ? alpha.selected ? 'Your card is chosen.' : 'Choose a Strategy from your hand.' : game.phase === 'complete' ? 'Every Public Need has been tended.' : 'Some gifts remain on Public Needs.'}</strong></div>
        {game.phase === 'planning' && <button className="primary" disabled={!alpha.selected} onClick={() => onChange(game)}>Reveal all Strategies</button>}
        {game.phase === 'revealed' && <button className="primary" onClick={() => onChange(game)}>Draw the next round</button>}
        {game.phase === 'complete' && <button className="primary" onClick={onNextSituation}>Draw the next Situation</button>}
      </footer>
      {inspected && (
        <dialog open className="card-dialog" onClick={() => setInspected(null)} aria-label={inspected.label}>
          <div className={`card-dialog-inner zoom-${inspected.kind}`} onClick={(event: { stopPropagation(): void }) => event.stopPropagation()}>
            <button className="dialog-close" onClick={() => setInspected(null)} aria-label="Close enlarged card">×</button>
            <CardFace kind={inspected.kind} id={inspected.id} className="zoomed-card" />
          </div>
        </dialog>
      )}
    </main>
  )
}
