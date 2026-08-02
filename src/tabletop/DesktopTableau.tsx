import type { StrategyCard } from '../data/cards'
import { CardBack, CardFace, GiftIcon, strategyText, type CardKind } from './Cards'
import { canPlay, type BonusNeed, type Cognition, type GameState, type NeedSlot } from './model'

export type DesktopInspection = {
  kind: CardKind
  id: string
  label: string
  detail?: string
}

export type DesktopDetail =
  | { kind: 'situation' }
  | { kind: 'need'; cognition: Cognition; slot: NeedSlot }
  | { kind: 'bonus'; bonus: BonusNeed }

function symbol(cognition: Cognition): string {
  if (cognition.id === 'alpha') return 'α'
  if (cognition.id === 'beta') return 'β'
  return 'γ'
}

function setupSummary(slot: NeedSlot): string {
  const pieces = [`Base ${slot.setup.base}`]
  if (slot.setup.situation > 0) pieces.push(`Situation +${slot.setup.situation}`)
  if (slot.setup.multiplied) pieces.push(`${slot.card.feeling} ×2`)
  return pieces.join(' · ')
}

function NeedCard({ cognition, slot, onInspect, onDetail }: {
  cognition: Cognition
  slot: NeedSlot
  onInspect: (card: DesktopInspection) => void
  onDetail: (detail: DesktopDetail) => void
}) {
  return (
    <article className={`desktop-need-card owner-${cognition.id} ${slot.gifts === 0 ? 'complete' : ''}`}>
      <button className="desktop-need-art" onClick={() => onInspect({ kind: 'need', id: slot.card.id, label: `${slot.card.feeling}: ${slot.card.need}` })}>
        <CardFace kind="need" id={slot.card.id} />
        <span className="desktop-owner-token">{symbol(cognition)}</span>
        <span className="desktop-gift-token"><GiftIcon variation={cognition.id === 'beta' ? 1 : cognition.id === 'gamma' ? 2 : 0} /><b>{slot.gifts}</b></span>
      </button>
      <button className="desktop-need-caption" onClick={() => onDetail({ kind: 'need', cognition, slot })}>
        <span>{slot.card.feeling}</span>
        <strong>{slot.card.need}</strong>
        <small>{setupSummary(slot)}</small>
      </button>
    </article>
  )
}

function CognitionColumn({ cognition, onInspect, onDetail, onReviewPrivate }: {
  cognition: Cognition
  onInspect: (card: DesktopInspection) => void
  onDetail: (detail: DesktopDetail) => void
  onReviewPrivate: () => void
}) {
  return (
    <section className={`desktop-cognition-column owner-${cognition.id}`}>
      <header>
        <b>{symbol(cognition)}</b>
        <div><span>{cognition.human ? 'You' : 'NPC'}</span><strong>{cognition.name}</strong></div>
        <small>{cognition.privateScore + cognition.bonusScore} individual</small>
      </header>
      <div className="desktop-cognition-needs">
        {cognition.publicNeeds.map((slot) => <NeedCard key={slot.card.id} cognition={cognition} slot={slot} onInspect={onInspect} onDetail={onDetail} />)}
      </div>
      <div className="desktop-private-and-hand">
        <div className="desktop-private-card">
          <CardBack kind="need" />
          <span>Private</span>
          {cognition.human && !cognition.magnifierUsed && <button onClick={onReviewPrivate}>⌕ Review once</button>}
          {cognition.human && cognition.magnifierUsed && <small>Magnifier used</small>}
        </div>
        {!cognition.human && (
          <div className="desktop-hidden-hand" aria-label={`${cognition.hand.length} hidden Strategy cards`}>
            {cognition.hand.map((card, index) => <CardBack key={card.id} kind="strategy" style={{ transform: `translateX(${index * 20}px) rotate(${(index - 1.5) * 4}deg)` }} />)}
            <span>{cognition.hand.length} hidden</span>
          </div>
        )}
      </div>
    </section>
  )
}

function BonusBoard({ game, onDetail }: { game: GameState; onDetail: (detail: DesktopDetail) => void }) {
  const bonuses = game.bonusNeeds.filter((bonus) => bonus.gifts > 0)
  if (bonuses.length === 0) return null
  return (
    <section className="desktop-bonus-board">
      <header><span>Optional Bonus Needs</span><strong>Individual opportunities; they do not block the next Situation.</strong></header>
      <div>{bonuses.map((bonus) => (
        <button key={bonus.id} className={bonus.availableRound <= game.round ? 'active' : 'pending'} onClick={() => onDetail({ kind: 'bonus', bonus })}>
          <span>✦</span><div><small>{bonus.availableRound <= game.round ? 'Active now' : 'Next round'}</small><strong>{bonus.need}</strong><em>from {bonus.sourceStrategyTitle}</em></div><b><GiftIcon variation={1} />{bonus.gifts}</b>
        </button>
      ))}</div>
    </section>
  )
}

export function DesktopSituationTableau({ game, onInspect, onDetail, onReviewPrivate }: {
  game: GameState
  onInspect: (card: DesktopInspection) => void
  onDetail: (detail: DesktopDetail) => void
  onReviewPrivate: () => void
}) {
  const remaining = game.cognitions.flatMap((cognition) => cognition.publicNeeds).reduce((total, slot) => total + slot.gifts, 0)
  return (
    <section className="desktop-situation-tableau">
      <article className="desktop-situation-panel">
        <button className="desktop-situation-art" onClick={() => onInspect({ kind: 'situation', id: game.situation.id, label: game.situation.title })}>
          <CardFace kind="situation" id={game.situation.id} />
        </button>
        <header><span>Situation {game.situationNumber} · Round {game.round}</span><h1>{game.situation.title}</h1></header>
        <button className="desktop-situation-progress" onClick={() => onDetail({ kind: 'situation' })}>
          <GiftIcon variation={0} /><b>{remaining}</b><span>required gifts remain</span><small>View setup and progress</small>
        </button>
      </article>
      <section className="desktop-required-board">
        <header><div><span>Required Public Needs</span><h2>These are what the whole psyche is responding to.</h2></div><p>Each Cognition may qualify a Strategy through its own two Needs. A legal play can still help matching Needs anywhere on the table.</p></header>
        <div className="desktop-owner-grid">
          {game.cognitions.map((cognition) => <CognitionColumn key={cognition.id} cognition={cognition} onInspect={onInspect} onDetail={onDetail} onReviewPrivate={onReviewPrivate} />)}
        </div>
        <BonusBoard game={game} onDetail={onDetail} />
      </section>
    </section>
  )
}

export function DesktopPlayerHand({ game, onSelect, onInspect }: {
  game: GameState
  onSelect: (id: string) => void
  onInspect: (card: DesktopInspection) => void
}) {
  const player = game.cognitions.find((cognition) => cognition.human) ?? game.cognitions[0]
  const activeBonuses = game.bonusNeeds.filter((bonus) => bonus.gifts > 0 && bonus.availableRound <= game.round)
  const openPlanning = () => document.querySelector<HTMLButtonElement>('.discussion-launch')?.click()
  return (
    <section className="desktop-response-stage">
      <header><div><span>Your response</span><h2>Choose one Strategy that you can actually use here.</h2></div><p>A legal card must tend one of α’s Public Needs or an active Bonus Need. Its other effects may help anyone.</p></header>
      <div className="desktop-planning-tools-target">
        <button className="desktop-planning-launch" onClick={openPlanning}><span>Before choosing</span><strong>Plan, discuss, and trade</strong><b>Open planning tools</b></button>
      </div>
      <div className="desktop-player-hand">
        {player.hand.map((card: StrategyCard) => {
          const legal = canPlay(player, card, activeBonuses)
          const selected = player.selected === card.id
          return (
            <article key={card.id} className={`${selected ? 'selected' : ''} ${legal ? 'legal' : 'discard'}`}>
              <button className="desktop-strategy-art" onClick={() => onInspect({ kind: 'strategy', id: card.id, label: card.title, detail: strategyText(card) })}>
                <CardFace kind="strategy" id={card.id} />
              </button>
              <div><span>{legal ? 'Playable now' : 'Discard only'}</span><strong>{card.title}</strong><small>{strategyText(card)}</small><button onClick={() => onSelect(card.id)}>{selected ? 'Undo choice' : legal ? 'Choose Strategy' : 'Choose discard'}</button></div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
