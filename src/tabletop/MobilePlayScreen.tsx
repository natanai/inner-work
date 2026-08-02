import { useEffect, useMemo, useState } from 'react'
import type { StrategyCard } from '../data/cards'
import type { BonusNeed, Cognition, GameState, NeedSlot, Resolution } from './model'
import { canPlay } from './model'
import {
  CardBack,
  CardFace,
  GiftIcon,
  Magnifier,
  strategyText,
  type CardKind,
} from './Cards'

type MobileTab = 'play' | 'needs' | 'cognitions' | 'rules'

type InspectedCard = {
  kind: CardKind
  id: string
  label: string
  detail?: string
}

type DetailSheet =
  | { kind: 'situation' }
  | { kind: 'need'; cognition: Cognition; slot: NeedSlot; shownGifts: number }
  | { kind: 'bonus'; bonus: BonusNeed }

function cognitionSymbol(cognition: Cognition): string {
  if (cognition.id === 'alpha') return 'α'
  if (cognition.id === 'beta') return 'β'
  return 'γ'
}

function publicKey(cognition: Cognition, slot: NeedSlot): string {
  return `${cognition.id}:${slot.card.id}`
}

function activeBonuses(game: GameState): BonusNeed[] {
  return game.bonusNeeds.filter((bonus) => bonus.gifts > 0 && bonus.availableRound <= game.round)
}

function pendingBonuses(game: GameState): BonusNeed[] {
  return game.bonusNeeds.filter((bonus) => bonus.gifts > 0 && bonus.availableRound > game.round)
}

function shownPublicGifts(game: GameState, cognition: Cognition, slot: NeedSlot, reviewComplete: boolean): number {
  if (game.phase === 'planning' || reviewComplete || !game.roundLedger) return slot.gifts
  return game.roundLedger.publicChanges.find((change) => change.key === publicKey(cognition, slot))?.before ?? slot.gifts
}

function setupSummary(slot: NeedSlot): string {
  const parts = [`Base ${slot.setup.base}`]
  if (slot.setup.situation > 0) parts.push(`Situation +${slot.setup.situation}`)
  if (slot.setup.multiplied) parts.push(`${slot.card.feeling} ×2`)
  return parts.join(' · ')
}

function PublicNeedTile({
  cognition,
  slot,
  gifts,
  changed,
  compact = false,
  onOpen,
}: {
  cognition: Cognition
  slot: NeedSlot
  gifts: number
  changed: boolean
  compact?: boolean
  onOpen: () => void
}) {
  return (
    <button className={`situation-need-tile ${changed ? 'changed' : ''} ${gifts === 0 ? 'complete' : ''} ${compact ? 'compact' : ''}`} onClick={onOpen}>
      <span className="situation-need-owner">{cognitionSymbol(cognition)}</span>
      <span className="situation-need-copy">
        <small>{slot.card.feeling}</small>
        <strong>{slot.card.need}</strong>
        {!compact && <em>{setupSummary(slot)}</em>}
      </span>
      <span className="situation-need-gifts"><GiftIcon variation={cognition.id === 'beta' ? 1 : cognition.id === 'gamma' ? 2 : 0} /><b>{gifts}</b></span>
      <span className="need-kind">Required</span>
      {changed && <span className="need-change">Tended this round</span>}
    </button>
  )
}

function BonusNeedTile({ bonus, active, onOpen }: { bonus: BonusNeed; active: boolean; onOpen: () => void }) {
  return (
    <button className={`bonus-need-tile ${active ? 'active' : 'pending'}`} onClick={onOpen}>
      <span className="bonus-star">✦</span>
      <span><small>{active ? 'Bonus Need' : 'Arrives next round'}</small><strong>{bonus.need}</strong><em>Created by {bonus.sourceStrategyTitle}</em></span>
      <b><GiftIcon variation={1} />{bonus.gifts}</b>
    </button>
  )
}

function SituationTableau({
  game,
  reviewComplete,
  onInspectSituation,
  onOpenSituation,
  onOpenNeed,
  onOpenBonus,
}: {
  game: GameState
  reviewComplete: boolean
  onInspectSituation: () => void
  onOpenSituation: () => void
  onOpenNeed: (cognition: Cognition, slot: NeedSlot, gifts: number) => void
  onOpenBonus: (bonus: BonusNeed) => void
}) {
  const active = activeBonuses(game)
  const pending = pendingBonuses(game)
  const changed = new Set((reviewComplete ? game.roundLedger?.publicChanges : [])?.filter((change) => change.removed > 0).map((change) => change.key) ?? [])

  return (
    <section className="situation-tableau">
      <div className="situation-card-wrap">
        <button className="mobile-situation-card" onClick={onInspectSituation}>
          <CardFace kind="situation" id={game.situation.id} />
          <span>Tap to read full-size</span>
        </button>
      </div>

      <section className="required-needs-board">
        <header>
          <div><span>Required Public Needs</span><strong>Tend every remaining gift to resolve the Situation</strong></div>
          <button onClick={onOpenSituation}>Why these gifts?</button>
        </header>
        <div className="required-needs-grid">
          {game.cognitions.flatMap((cognition) => cognition.publicNeeds.map((slot) => {
            const gifts = shownPublicGifts(game, cognition, slot, reviewComplete)
            return (
              <PublicNeedTile
                key={publicKey(cognition, slot)}
                cognition={cognition}
                slot={slot}
                gifts={gifts}
                changed={changed.has(publicKey(cognition, slot))}
                onOpen={() => onOpenNeed(cognition, slot, gifts)}
              />
            )
          }))}
        </div>
      </section>

      {(active.length > 0 || pending.length > 0) && (
        <section className="bonus-needs-board">
          <header><span>Optional Bonus Needs</span><strong>Bonus gifts become individual points and do not block the next Situation.</strong></header>
          <div>
            {active.map((bonus) => <BonusNeedTile key={bonus.id} bonus={bonus} active onOpen={() => onOpenBonus(bonus)} />)}
            {pending.map((bonus) => <BonusNeedTile key={bonus.id} bonus={bonus} active={false} onOpen={() => onOpenBonus(bonus)} />)}
          </div>
        </section>
      )}
    </section>
  )
}

function MobileHand({
  game,
  cognition,
  onSelect,
  onInspect,
}: {
  game: GameState
  cognition: Cognition
  onSelect: (id: string) => void
  onInspect: (card: InspectedCard) => void
}) {
  const bonuses = activeBonuses(game)
  return (
    <section className="mobile-hand-section">
      <header><div><span>Your response</span><strong>Choose one Strategy for these Needs</strong></div><small>{cognition.selected ? '1 chosen' : 'Swipe'}</small></header>
      <div className="mobile-hand-carousel">
        {cognition.hand.map((card: StrategyCard) => {
          const selected = card.id === cognition.selected
          const legal = canPlay(cognition, card, bonuses)
          return (
            <article className={`mobile-hand-card ${selected ? 'selected' : ''}`} key={card.id}>
              <button
                className="mobile-card-preview"
                onClick={() => onInspect({ kind: 'strategy', id: card.id, label: card.title, detail: strategyText(card) })}
                aria-label={`Read ${card.title}`}
              >
                <CardFace kind="strategy" id={card.id} />
                <span>Read full-size</span>
              </button>
              <div className="mobile-card-copy">
                <span className={legal ? 'mobile-playable' : 'mobile-discard'}>{legal ? 'Tends a required or Bonus Need' : 'Discard only'}</span>
                <h2>{card.title}</h2>
                <p>{strategyText(card)}</p>
                <button className="mobile-choose-strategy" onClick={() => onSelect(card.id)} aria-pressed={selected}>
                  {selected ? 'Chosen — tap to undo' : legal ? 'Choose this Strategy' : 'Choose to discard'}
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function MatchList({ line }: { line: Resolution }) {
  return (
    <div className="story-match-list">
      {line.publicMatches.length > 0 && <p><span>Required Public Needs</span><strong>{line.publicMatches.join(' · ')}</strong></p>}
      {line.privateMatches.length > 0 && <p><span>Private Needs</span><strong>{line.privateMatches.length} hidden Need{line.privateMatches.length === 1 ? '' : 's'} also tended</strong></p>}
      {line.bonusMatches.length > 0 && <p><span>Active Bonus Needs</span><strong>{line.bonusMatches.join(' · ')}</strong></p>}
      {line.bonusCreated.length > 0 && <p className="created"><span>Introduced by this shared action</span><strong>{line.bonusCreated.map((bonus) => `${bonus.need} · available next round`).join(' · ')}</strong></p>}
      {line.publicMatches.length === 0 && line.privateMatches.length === 0 && line.bonusMatches.length === 0 && line.bonusCreated.length === 0 && <p><span>Result</span><strong>This Strategy is discarded.</strong></p>}
    </div>
  )
}

function RevealOverview({ lines }: { lines: Resolution[] }) {
  return (
    <section className="story-reveal-overview">
      <header><span>Simultaneous reveal</span><h1>Three parts influenced one shared person.</h1><p>The Strategies were committed together. We will now hear what each Cognition brought forward, what the person did, and what that action tended across the whole psyche.</p></header>
      <div>{lines.map((line) => <article key={line.cognitionId}><CardFace kind="strategy" id={line.strategy.id} /><strong>{line.cognitionName}</strong></article>)}</div>
    </section>
  )
}

function StoryStep({
  line,
  index,
  humanStory,
  setHumanStory,
  onInspect,
}: {
  line: Resolution
  index: number
  humanStory: string
  setHumanStory: (value: string) => void
  onInspect: (card: InspectedCard) => void
}) {
  const human = line.cognitionId === 'alpha'
  const [showExample, setShowExample] = useState(false)
  const introduced = line.bonusCreated.map((bonus) => bonus.need)
  return (
    <section className="story-step collective-mobile-story-step">
      <header><span>Story {index + 1} of 3</span><h1>{line.cognitionName} influenced one shared action</h1></header>
      <button className="story-card" onClick={() => onInspect({ kind: 'strategy', id: line.strategy.id, label: line.strategy.title, detail: strategyText(line.strategy) })}>
        <CardFace kind="strategy" id={line.strategy.id} />
      </button>
      <div className="story-copy">
        {human ? (
          <>
            <p className="collective-mobile-story-rule">Keep the Cognition as the source of motivation and the whole person as the one who actually performs the Strategy.</p>
            <div className="collective-mobile-story-cues">
              <p><b>Motivation</b><span>What Need did {line.cognitionName} bring forward?</span></p>
              <p><b>Shared action</b><span>What did the person actually do?</span></p>
              <p><b>Wider effect</b><span>What else was tended{introduced.length ? `, and how was ${introduced.join(' and ')} introduced as a Bonus Need` : ''}?</span></p>
            </div>
            <label htmlFor="human-story">Tell the shared-person story in your own words.</label>
            <textarea id="human-story" value={humanStory} onChange={(event) => setHumanStory(event.target.value)} placeholder={`${line.cognitionName} brought forward… The shared person chose to… It also…`} />
            <button className="quiet" onClick={() => setShowExample((visible) => !visible)}>{showExample ? 'Hide example' : 'See an example'}</button>
            {showExample && <aside className="collective-mobile-story-example"><p>{line.story}</p><button className="quiet" onClick={() => setHumanStory(line.story)}>Use as a starting point</button></aside>}
          </>
        ) : <p className="collective-mobile-story-npc">{line.story}</p>}
        <MatchList line={line} />
      </div>
    </section>
  )
}

function RoundSummary({ game }: { game: GameState }) {
  const ledger = game.roundLedger
  if (!ledger) return null
  const changed = ledger.publicChanges.filter((change) => change.removed > 0)
  return (
    <section className="round-story-summary">
      <header><span>Round summary</span><h1>The gifts now move.</h1><p>Public gifts enter the shared group bank. Private and Bonus gifts become individual points.</p></header>
      <div className="shared-gift-transfer"><GiftIcon variation={0} /><b>+{ledger.publicRemoved}</b><span>to the shared bank</span></div>
      {changed.length > 0 && <div className="summary-list"><strong>Required Needs tended</strong>{changed.map((change) => <p key={change.key}><span>{change.cognitionName} · {change.need}</span><b>{change.before} → {change.after}</b></p>)}</div>}
      {ledger.privateAwards.length > 0 && <div className="summary-list"><strong>Private points</strong>{ledger.privateAwards.map((award) => <p key={`${award.cognitionId}-${award.need}`}><span>{award.cognitionName}</span><b>+{award.points}</b></p>)}</div>}
      {ledger.bonusAwards.length > 0 && <div className="summary-list bonus"><strong>Bonus points</strong>{ledger.bonusAwards.map((award) => <p key={award.bonusId}><span>{award.cognitionNames.join(' & ')} · {award.need}</span><b>+{award.pointsEach} each</b></p>)}</div>}
      {ledger.bonusCreated.length > 0 && <div className="summary-list created"><strong>Bonus Needs arriving next round</strong>{ledger.bonusCreated.map((bonus) => <p key={bonus.id}><span>{bonus.need} · introduced when {bonus.sourceCognitionName} brought forward {bonus.sourceStrategyTitle}</span><b><GiftIcon variation={1} />{bonus.gifts}</b></p>)}</div>}
      {ledger.publicRemoved === 0 && ledger.privateAwards.length === 0 && ledger.bonusAwards.length === 0 && <p className="mobile-reference-note">No gifts moved this round.</p>}
    </section>
  )
}

function MobileRevealFlow({
  game,
  step,
  humanStory,
  setHumanStory,
  onInspect,
}: {
  game: GameState
  step: number
  humanStory: string
  setHumanStory: (value: string) => void
  onInspect: (card: InspectedCard) => void
}) {
  if (step === 0) return <RevealOverview lines={game.resolution} />
  if (step <= game.resolution.length) {
    const line = game.resolution[step - 1]
    return <StoryStep key={line.cognitionId} line={line} index={step - 1} humanStory={humanStory} setHumanStory={setHumanStory} onInspect={onInspect} />
  }
  return <RoundSummary game={game} />
}

function MobileNeedsPanel({
  game,
  reviewComplete,
  onOpenNeed,
  onOpenBonus,
  onRevealPrivate,
  onInspect,
}: {
  game: GameState
  reviewComplete: boolean
  onOpenNeed: (cognition: Cognition, slot: NeedSlot, gifts: number) => void
  onOpenBonus: (bonus: BonusNeed) => void
  onRevealPrivate: () => void
  onInspect: (card: InspectedCard) => void
}) {
  const active = activeBonuses(game)
  const pending = pendingBonuses(game)
  return (
    <section className="mobile-reference-panel mobile-needs-panel">
      <header><span>Needs in play</span><h1>Required, Private, and Bonus Needs</h1><p>Only required Public Needs determine when the Situation is complete.</p></header>
      {game.cognitions.map((cognition) => (
        <article className="mobile-cognition-needs" key={cognition.id}>
          <div className="mobile-section-heading"><span>{cognition.human ? 'You' : 'NPC'}</span><strong>{cognition.name}</strong><small>{cognition.privateScore + cognition.bonusScore} individual</small></div>
          <div className="mobile-panel-need-list">
            {cognition.publicNeeds.map((slot) => {
              const gifts = shownPublicGifts(game, cognition, slot, reviewComplete)
              return <PublicNeedTile key={slot.card.id} cognition={cognition} slot={slot} gifts={gifts} changed={false} compact onOpen={() => onOpenNeed(cognition, slot, gifts)} />
            })}
          </div>
          <div className="mobile-private-need">
            <span>Private Need</span>
            <div className="mobile-private-station">
              <div className="mobile-private-card-frame">
                {cognition.human && cognition.privateVisible ? (
                  <button onClick={() => onInspect({ kind: 'need', id: cognition.privateNeed.card.id, label: `${cognition.privateNeed.card.feeling}: ${cognition.privateNeed.card.need}`, detail: `${cognition.privateNeed.gifts} gift remains.` })}>
                    <CardFace kind="need" id={cognition.privateNeed.card.id} />
                  </button>
                ) : <CardBack kind="need" />}
              </div>
              <div className="mobile-private-copy">
                <span>{cognition.human ? 'Your hidden opportunity' : 'Hidden from you'}</span>
                <strong>{cognition.human && cognition.privateVisible ? cognition.privateNeed.card.need : 'Private Need'}</strong>
                <p><GiftIcon variation={2} />{cognition.privateNeed.gifts} gift{cognition.privateNeed.gifts === 1 ? '' : 's'} remaining</p>
                {cognition.human && !cognition.privateVisible && <Magnifier used={cognition.magnifierUsed} disabled={game.phase !== 'planning' || cognition.magnifierUsed} onClick={onRevealPrivate} />}
              </div>
            </div>
          </div>
        </article>
      ))}
      {(active.length > 0 || pending.length > 0) && <section className="reference-bonus-needs"><h2>Bonus Needs</h2>{[...active, ...pending].map((bonus) => <BonusNeedTile key={bonus.id} bonus={bonus} active={bonus.availableRound <= game.round} onOpen={() => onOpenBonus(bonus)} />)}</section>}
    </section>
  )
}

function MobileCognitionsPanel({ game }: { game: GameState }) {
  return (
    <section className="mobile-reference-panel">
      <header><span>Cognitions</span><h1>Three perspectives, one shared psyche</h1></header>
      <div className="mobile-cognition-list">
        {game.cognitions.map((cognition) => (
          <article key={cognition.id}>
            <b>{cognitionSymbol(cognition)}</b>
            <div><span>{cognition.human ? 'You control' : 'NPC chooses privately'}</span><h2>{cognition.name}</h2><p>{cognition.publicNeeds.map((slot) => slot.card.need).join(' · ')}</p></div>
            <aside><strong>{cognition.hand.length}</strong><span>cards</span><strong>{cognition.privateScore + cognition.bonusScore}</strong><span>individual</span></aside>
          </article>
        ))}
      </div>
      <p className="mobile-reference-note">Public gifts enter the shared group bank. Private and Bonus gifts contribute to the individual score of the Cognition that receives them.</p>
    </section>
  )
}

function MobileRulesPanel({ phase }: { phase: GameState['phase'] }) {
  return (
    <section className="mobile-reference-panel mobile-rules-panel">
      <header><span>How this turn works</span><h1>{phase === 'planning' ? 'Situation → Needs → Strategy' : 'Reveal → Stories → Gifts'}</h1></header>
      <ol>
        <li><b>The Situation establishes context.</b><span>It adds gifts to matching Public Needs and may double Needs with a particular feeling.</span></li>
        <li><b>Required Public Needs drive play.</b><span>All of their gifts must be tended before the next Situation begins.</span></li>
        <li><b>Strategies reveal simultaneously.</b><span>Then each Cognition explains what it brought forward and how the one shared person acted.</span></li>
        <li><b>Public gifts enter the group bank.</b><span>Private and Bonus gifts become individual points. Bonus Needs never block the next Situation.</span></li>
      </ol>
      <p className="mobile-reference-note">A Strategy may be played when it tends at least one of that Cognition’s unresolved Public Needs or an active Bonus Need. Its full strength applies to every matching Need.</p>
    </section>
  )
}

function SituationDetails({ game, reviewComplete, onClose }: { game: GameState; reviewComplete: boolean; onClose: () => void }) {
  const rows = game.cognitions.flatMap((cognition) => cognition.publicNeeds.map((slot) => ({ cognition, slot, gifts: shownPublicGifts(game, cognition, slot, reviewComplete) })))
  const initial = rows.reduce((total, row) => total + row.slot.setup.total, 0)
  const remaining = rows.reduce((total, row) => total + row.gifts, 0)
  const shared = game.phase !== 'planning' && !reviewComplete && game.roundLedger ? game.roundLedger.sharedBefore : game.sharedScore
  return (
    <section className="mobile-detail-sheet" role="dialog" aria-modal="true" aria-label="Situation details">
      <button className="sheet-backdrop" onClick={onClose} aria-label="Close details" />
      <div>
        <header><span>Situation progress</span><button onClick={onClose}>×</button><h2>{game.situation.title}</h2></header>
        <div className="situation-progress-numbers"><p><b>{remaining}</b><span>required gifts remain</span></p><p><b>{initial - remaining}</b><span>tended this Situation</span></p><p><b>{shared}</b><span>shared bank today</span></p></div>
        <section><h3>Setup effects</h3>{game.situation.effects.map((effect) => <p key={effect.need}><span>{effect.need}</span><b>+{effect.amount}</b></p>)}{game.situation.feelingMultiplier && <p><span>{game.situation.feelingMultiplier} Needs</span><b>×2</b></p>}</section>
        <section><h3>Required Needs</h3>{rows.map(({ cognition, slot, gifts }) => <p key={publicKey(cognition, slot)}><span>{cognitionSymbol(cognition)} · {slot.card.feeling}: {slot.card.need}</span><b>{gifts}/{slot.setup.total}</b></p>)}</section>
        <p className="sheet-note">The Situation ends when every required Public Need reaches 0. Bonus Needs are optional and are tracked separately.</p>
      </div>
    </section>
  )
}

function NeedDetails({ cognition, slot, shownGifts, onClose }: { cognition: Cognition; slot: NeedSlot; shownGifts: number; onClose: () => void }) {
  return (
    <section className="mobile-detail-sheet" role="dialog" aria-modal="true" aria-label={`${slot.card.need} details`}>
      <button className="sheet-backdrop" onClick={onClose} aria-label="Close details" />
      <div>
        <header><span>Required Public Need · Cognition {cognitionSymbol(cognition)}</span><button onClick={onClose}>×</button><h2>{slot.card.feeling}: {slot.card.need}</h2></header>
        <div className="need-gift-equation">
          <p><b>{slot.setup.base}</b><span>base gift</span></p>
          <i>+</i>
          <p><b>{slot.setup.situation}</b><span>from Situation</span></p>
          {slot.setup.multiplied && <><i>×</i><p><b>2</b><span>{slot.card.feeling} multiplier</span></p></>}
          <i>=</i>
          <p><b>{slot.setup.total}</b><span>started here</span></p>
        </div>
        <div className="need-remaining-callout"><GiftIcon variation={cognition.id === 'beta' ? 1 : cognition.id === 'gamma' ? 2 : 0} /><p><strong>{shownGifts} required gift{shownGifts === 1 ? '' : 's'} remain</strong><span>These gifts must reach 0 before the Situation can end.</span></p></div>
        <button className="quiet" onClick={onClose}>Return to the table</button>
      </div>
    </section>
  )
}

function BonusDetails({ bonus, game, onClose }: { bonus: BonusNeed; game: GameState; onClose: () => void }) {
  const active = bonus.availableRound <= game.round
  return (
    <section className="mobile-detail-sheet" role="dialog" aria-modal="true" aria-label={`${bonus.need} Bonus Need details`}>
      <button className="sheet-backdrop" onClick={onClose} aria-label="Close details" />
      <div>
        <header><span>Optional Bonus Need</span><button onClick={onClose}>×</button><h2>{bonus.need}</h2></header>
        <div className="need-remaining-callout bonus"><GiftIcon variation={1} /><p><strong>{bonus.gifts} Bonus gift{bonus.gifts === 1 ? '' : 's'}</strong><span>{active ? 'Available to tend this round.' : `Becomes available in round ${bonus.availableRound}.`}</span></p></div>
        <section><h3>Where it came from</h3><p><span>Strategy</span><b>{bonus.sourceStrategyTitle}</b></p><p><span>Played by</span><b>{bonus.sourceCognitionName}</b></p></section>
        <p className="sheet-note">Bonus gifts become individual points for the Cognition that tends them. They do not need to reach 0 for the Situation to end.</p>
        <button className="quiet" onClick={onClose}>Return to the table</button>
      </div>
    </section>
  )
}

export function MobilePlayScreen({
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
  const [tab, setTab] = useState<MobileTab>('play')
  const [inspected, setInspected] = useState<InspectedCard | null>(null)
  const [details, setDetails] = useState<DetailSheet | null>(null)
  const [reviewStep, setReviewStep] = useState(0)
  const [humanStory, setHumanStory] = useState('')
  const alpha = game.cognitions[0]
  const reviewComplete = game.phase === 'planning' || reviewStep > game.resolution.length

  useEffect(() => {
    setReviewStep(0)
    setHumanStory('')
  }, [game.situationNumber, game.round, game.phase])

  const remainingRequired = useMemo(() => game.cognitions.reduce((total, cognition) => total + cognition.publicNeeds.reduce((subtotal, slot) => subtotal + shownPublicGifts(game, cognition, slot, reviewComplete), 0), 0), [game, reviewComplete])

  const selectStrategy = (id: string) => onChange({
    ...game,
    cognitions: game.cognitions.map((cognition) => cognition.id === 'alpha'
      ? { ...cognition, selected: cognition.selected === id ? null : id }
      : cognition),
  })

  const revealPrivate = () => onChange({
    ...game,
    cognitions: game.cognitions.map((cognition) => cognition.id === 'alpha'
      ? { ...cognition, privateVisible: true, magnifierUsed: true }
      : cognition),
  })

  const reviewLastStep = game.resolution.length + 1
  const actionLabel = game.phase === 'planning'
    ? 'Reveal Strategies'
    : reviewStep === 0
      ? `Review ${game.resolution[0]?.cognitionName ?? 'first story'}`
      : reviewStep < game.resolution.length
        ? `Next: ${game.resolution[reviewStep]?.cognitionName ?? 'story'}`
        : reviewStep === game.resolution.length
          ? 'See round summary'
          : game.phase === 'complete' ? 'Next Situation' : 'Next round'

  const handleAction = () => {
    if (game.phase === 'planning') {
      onChange(game)
      return
    }
    if (reviewStep < reviewLastStep) {
      setReviewStep((step) => step + 1)
      return
    }
    if (game.phase === 'complete') onNextSituation()
    else onChange(game)
  }

  return (
    <main className={`mobile-play-page mobile-tab-${tab}`}>
      <header className="mobile-game-header">
        <div><span>Situation {game.situationNumber} · Round {game.round}</span><strong>{game.situation.title}</strong></div>
        <div>
          <button className="situation-progress-pill" onClick={() => setDetails({ kind: 'situation' })} aria-label={`${remainingRequired} required gifts remain. Open Situation details.`}><GiftIcon variation={0} /><b>{remainingRequired}</b><small>left</small></button>
          <button onClick={onEnd}>End</button>
        </div>
      </header>

      <div className="mobile-stage">
        {tab === 'play' && (
          <>
            <SituationTableau
              game={game}
              reviewComplete={reviewComplete}
              onInspectSituation={() => setInspected({ kind: 'situation', id: game.situation.id, label: game.situation.title })}
              onOpenSituation={() => setDetails({ kind: 'situation' })}
              onOpenNeed={(cognition, slot, shownGifts) => setDetails({ kind: 'need', cognition, slot, shownGifts })}
              onOpenBonus={(bonus) => setDetails({ kind: 'bonus', bonus })}
            />
            {game.phase === 'planning'
              ? <MobileHand game={game} cognition={alpha} onSelect={selectStrategy} onInspect={setInspected} />
              : <MobileRevealFlow game={game} step={reviewStep} humanStory={humanStory} setHumanStory={setHumanStory} onInspect={setInspected} />}
          </>
        )}
        {tab === 'needs' && <MobileNeedsPanel game={game} reviewComplete={reviewComplete} onOpenNeed={(cognition, slot, shownGifts) => setDetails({ kind: 'need', cognition, slot, shownGifts })} onOpenBonus={(bonus) => setDetails({ kind: 'bonus', bonus })} onRevealPrivate={revealPrivate} onInspect={setInspected} />}
        {tab === 'cognitions' && <MobileCognitionsPanel game={game} />}
        {tab === 'rules' && <MobileRulesPanel phase={game.phase} />}
      </div>

      {tab === 'play' && (
        <div className="mobile-action-dock">
          <div><span>{game.phase === 'planning' ? 'Your turn' : reviewStep <= game.resolution.length ? 'Play / Story phase' : game.phase === 'complete' ? 'Situation complete' : 'Round reviewed'}</span><strong>{game.phase === 'planning' ? alpha.selected ? 'Your Strategy is committed.' : 'Choose one Strategy.' : reviewStep === 0 ? 'All Strategies revealed together.' : reviewStep <= game.resolution.length ? `Listening to story ${reviewStep} of ${game.resolution.length}.` : game.phase === 'complete' ? 'Every required Public Need is tended.' : 'Required gifts still remain.'}</strong></div>
          <button className="primary" disabled={game.phase === 'planning' && !alpha.selected} onClick={handleAction}>{actionLabel}</button>
        </div>
      )}

      <nav className="mobile-bottom-nav" aria-label="Game views">
        {(['play', 'needs', 'cognitions', 'rules'] as MobileTab[]).map((item) => (
          <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)} aria-current={tab === item ? 'page' : undefined}>
            <span>{item === 'play' ? '◆' : item === 'needs' ? '▣' : item === 'cognitions' ? '◉' : '?'}</span>{item === 'cognitions' ? 'Cognitions' : item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </nav>

      {inspected && (
        <dialog open className="mobile-card-dialog" onClick={() => setInspected(null)} aria-label={inspected.label}>
          <div className={`mobile-dialog-inner mobile-dialog-${inspected.kind}`} onClick={(event) => event.stopPropagation()}>
            <button className="mobile-dialog-close" onClick={() => setInspected(null)} aria-label="Close card">×</button>
            <div className="mobile-dialog-image"><CardFace kind={inspected.kind} id={inspected.id} /></div>
            <section><h2>{inspected.label}</h2>{inspected.detail && <p>{inspected.detail}</p>}<button className="primary" onClick={() => setInspected(null)}>Return to the table</button></section>
          </div>
        </dialog>
      )}

      {details?.kind === 'situation' && <SituationDetails game={game} reviewComplete={reviewComplete} onClose={() => setDetails(null)} />}
      {details?.kind === 'need' && <NeedDetails cognition={details.cognition} slot={details.slot} shownGifts={details.shownGifts} onClose={() => setDetails(null)} />}
      {details?.kind === 'bonus' && <BonusDetails bonus={details.bonus} game={game} onClose={() => setDetails(null)} />}
    </main>
  )
}
