import { useState } from 'react'
import { CardFace, GiftIcon } from './Cards'
import { DesktopPlayerHand, DesktopSituationTableau, type DesktopDetail, type DesktopInspection } from './DesktopTableau'
import { DesktopStoryTable } from './DesktopStoryTable'
import type { GameState } from './model'

function DetailDialog({ game, detail, onClose }: { game: GameState; detail: DesktopDetail; onClose: () => void }) {
  if (detail.kind === 'situation') {
    const remaining = game.cognitions.flatMap((cognition) => cognition.publicNeeds).reduce((total, slot) => total + slot.gifts, 0)
    const started = game.cognitions.flatMap((cognition) => cognition.publicNeeds).reduce((total, slot) => total + slot.setup.total, 0)
    return (
      <dialog open className="desktop-detail-dialog" onClick={onClose} aria-label="Situation details">
        <section onClick={(event) => event.stopPropagation()}>
          <button className="dialog-close" onClick={onClose}>×</button>
          <span>Situation progress</span><h1>{game.situation.title}</h1>
          <div className="desktop-detail-stats"><p><b>{remaining}</b><span>required gifts remain</span></p><p><b>{started - remaining}</b><span>tended this Situation</span></p><p><b>{game.sharedScore}</b><span>shared bank total</span></p></div>
          <h2>Setup effects</h2>
          <div className="desktop-situation-effects">{game.situation.effects.map((effect) => <p key={effect.need}><strong>{effect.need}</strong><b>+{effect.amount}</b></p>)}</div>
          <p className="desktop-detail-note"><b>{game.situation.feelingMultiplier}</b> Needs are doubled after the Situation modifiers are added.</p>
          <p className="desktop-detail-note">The Situation resolves only when every gift on every required Public Need is gone.</p>
        </section>
      </dialog>
    )
  }

  if (detail.kind === 'bonus') {
    return (
      <dialog open className="desktop-detail-dialog" onClick={onClose} aria-label="Bonus Need details">
        <section onClick={(event) => event.stopPropagation()}>
          <button className="dialog-close" onClick={onClose}>×</button>
          <span>Optional Bonus Need</span><h1>{detail.bonus.need}</h1>
          <div className="desktop-detail-stats"><p><b>{detail.bonus.gifts}</b><span>individual gifts remain</span></p><p><b>{detail.bonus.availableRound <= game.round ? 'Now' : `Round ${detail.bonus.availableRound}`}</b><span>available</span></p></div>
          <p className="desktop-detail-note">Created by <b>{detail.bonus.sourceCognitionName}</b> using “{detail.bonus.sourceStrategyTitle}.” Bonus gifts become individual points and do not block the next Situation.</p>
        </section>
      </dialog>
    )
  }

  const { cognition, slot } = detail
  return (
    <dialog open className="desktop-detail-dialog desktop-need-detail" onClick={onClose} aria-label={`${slot.card.feeling}: ${slot.card.need}`}>
      <section onClick={(event) => event.stopPropagation()}>
        <button className="dialog-close" onClick={onClose}>×</button>
        <div className="desktop-detail-need-art"><CardFace kind="need" id={slot.card.id} /></div>
        <div><span>{cognition.name} · Required Public Need</span><h1>{slot.card.feeling}: {slot.card.need}</h1>
          <div className="desktop-gift-equation">
            <p><b>{slot.setup.base}</b><span>base gift</span></p>
            <i>+</i><p><b>{slot.setup.situation}</b><span>from Situation</span></p>
            {slot.setup.multiplied && <><i>×</i><p><b>2</b><span>{slot.card.feeling} multiplier</span></p></>}
            <i>=</i><p><b>{slot.setup.total}</b><span>started here</span></p>
          </div>
          <p className="desktop-detail-note"><GiftIcon variation={cognition.id === 'beta' ? 1 : cognition.id === 'gamma' ? 2 : 0} /><b>{slot.gifts}</b> required gift{slot.gifts === 1 ? '' : 's'} remain.</p>
        </div>
      </section>
    </dialog>
  )
}

export function PlayScreen({ game, onChange, onNextSituation, onEnd }: {
  game: GameState
  onChange: (game: GameState) => void
  onNextSituation: () => void
  onEnd: () => void
}) {
  const [inspected, setInspected] = useState<DesktopInspection | null>(null)
  const [detail, setDetail] = useState<DesktopDetail | null>(null)
  const player = game.cognitions.find((cognition) => cognition.human) ?? game.cognitions[0]

  const select = (id: string) => onChange({
    ...game,
    cognitions: game.cognitions.map((cognition) => cognition.id === player.id
      ? { ...cognition, selected: cognition.selected === id ? null : id }
      : cognition),
  })

  const reviewPrivate = () => window.dispatchEvent(new CustomEvent('inner-work:review-private'))

  return (
    <main className="play-page desktop-parity-page">
      <header className="desktop-game-header">
        <div><span>Inner Work · Situation {game.situationNumber}</span><strong>{game.situation.title}</strong></div>
        <div><b><GiftIcon variation={0} />{game.sharedScore} shared</b><b>Round {game.round}</b><button onClick={onEnd}>End day</button></div>
      </header>

      <DesktopSituationTableau game={game} onInspect={setInspected} onDetail={setDetail} onReviewPrivate={reviewPrivate} />

      {game.phase === 'planning' && (
        <DesktopPlayerHand game={game} onSelect={select} onInspect={setInspected} />
      )}

      {game.phase === 'planning' && (
        <footer className="desktop-action-bar">
          <div><span>Your turn</span><strong>{player.selected ? 'Your response is ready.' : 'Choose a Strategy, trade, or prepare a discard.'}</strong></div>
          <button className="primary" disabled={!player.selected} onClick={() => onChange(game)}>Reveal all Strategies</button>
        </footer>
      )}

      {game.phase !== 'planning' && (
        <DesktopStoryTable
          game={game}
          onContinue={() => onChange(game)}
          onNextSituation={onNextSituation}
          onInspectStrategy={(id, label) => setInspected({ kind: 'strategy', id, label })}
        />
      )}

      {detail && <DetailDialog game={game} detail={detail} onClose={() => setDetail(null)} />}
      {inspected && (
        <dialog open className="card-dialog desktop-card-inspector" onClick={() => setInspected(null)} aria-label={inspected.label}>
          <div className={`card-dialog-inner zoom-${inspected.kind}`} onClick={(event) => event.stopPropagation()}>
            <button className="dialog-close" onClick={() => setInspected(null)} aria-label="Close enlarged card">×</button>
            <CardFace kind={inspected.kind} id={inspected.id} className="zoomed-card" />
            {inspected.detail && <p>{inspected.detail}</p>}
          </div>
        </dialog>
      )}
    </main>
  )
}
