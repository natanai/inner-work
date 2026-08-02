import { useMemo, useState } from 'react'
import type { StrategyCard } from '../data/cards'
import type { Cognition, GameState, NeedSlot, Resolution } from './model'
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

function resolvedNeedNames(lines: Resolution[]): Set<string> {
  return new Set(
    lines
      .filter((line) => line.legal)
      .flatMap((line) => line.strategy.effects)
      .filter((effect) => effect.amount > 0)
      .map((effect) => effect.need),
  )
}

function cognitionSymbol(cognition: Cognition): string {
  if (cognition.id === 'alpha') return 'α'
  if (cognition.id === 'beta') return 'β'
  return 'γ'
}

function NeedChip({
  cognition,
  slot,
  highlighted,
  expanded = false,
  onInspect,
}: {
  cognition: Cognition
  slot: NeedSlot
  highlighted: boolean
  expanded?: boolean
  onInspect: () => void
}) {
  return (
    <button className={`mobile-need-chip ${expanded ? 'expanded' : ''} ${highlighted ? 'resolved' : ''}`} onClick={onInspect}>
      <span className="mobile-cognition-symbol">{cognitionSymbol(cognition)}</span>
      <span className="mobile-need-copy"><small>{slot.card.feeling}</small><strong>{slot.card.need}</strong></span>
      <span className="mobile-gift-count"><GiftIcon variation={cognition.id === 'beta' ? 1 : cognition.id === 'gamma' ? 2 : 0} /><b>{slot.gifts}</b></span>
      {highlighted && <em>Tended this round</em>}
    </button>
  )
}

function MobileNeedStrip({
  game,
  tendedNeeds,
  onInspect,
}: {
  game: GameState
  tendedNeeds: Set<string>
  onInspect: (card: InspectedCard) => void
}) {
  return (
    <section className="mobile-need-strip-section">
      <header><div><span>Public Needs</span><strong>What the shared psyche is holding</strong></div><small>Swipe</small></header>
      <div className="mobile-need-strip">
        {game.cognitions.flatMap((cognition) => cognition.publicNeeds.map((slot) => (
          <NeedChip
            key={`${cognition.id}-${slot.card.id}`}
            cognition={cognition}
            slot={slot}
            highlighted={tendedNeeds.has(slot.card.need)}
            onInspect={() => onInspect({
              kind: 'need',
              id: slot.card.id,
              label: `${slot.card.feeling}: ${slot.card.need}`,
              detail: `${slot.gifts} gift${slot.gifts === 1 ? '' : 's'} remaining for ${cognition.name}.`,
            })}
          />
        )))}
      </div>
    </section>
  )
}

function MobileHand({
  cognition,
  phase,
  onSelect,
  onInspect,
}: {
  cognition: Cognition
  phase: GameState['phase']
  onSelect: (id: string) => void
  onInspect: (card: InspectedCard) => void
}) {
  return (
    <section className="mobile-hand-section">
      <header><div><span>Your Strategy hand</span><strong>Swipe through four choices</strong></div><small>{cognition.selected ? '1 chosen' : 'Choose 1'}</small></header>
      <div className="mobile-hand-carousel">
        {cognition.hand.map((card: StrategyCard) => {
          const selected = card.id === cognition.selected
          const legal = canPlay(cognition, card)
          return (
            <article className={`mobile-hand-card ${selected ? 'selected' : ''}`} key={card.id}>
              <button
                className="mobile-card-preview"
                onClick={() => onInspect({ kind: 'strategy', id: card.id, label: card.title, detail: strategyText(card) })}
                aria-label={`Read ${card.title}`}
              >
                <CardFace kind="strategy" id={card.id} />
                <span>Tap to read full-size</span>
              </button>
              <div className="mobile-card-copy">
                <span className={legal ? 'mobile-playable' : 'mobile-discard'}>{legal ? 'Playable' : 'Would be discarded'}</span>
                <h2>{card.title}</h2>
                <p>{strategyText(card)}</p>
                <button
                  className="mobile-choose-strategy"
                  disabled={phase !== 'planning'}
                  onClick={() => onSelect(card.id)}
                  aria-pressed={selected}
                >
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

function MobileReveal({
  lines,
  onInspect,
}: {
  lines: Resolution[]
  onInspect: (card: InspectedCard) => void
}) {
  const tended = resolvedNeedNames(lines)
  return (
    <section className="mobile-reveal-section" aria-live="polite">
      <header><span>Strategies revealed together</span><strong>Swipe to review each Cognition</strong></header>
      <div className="mobile-reveal-carousel">
        {lines.map((line) => (
          <article key={line.cognitionId}>
            <button
              className="mobile-card-preview"
              onClick={() => onInspect({ kind: 'strategy', id: line.strategy.id, label: line.strategy.title, detail: strategyText(line.strategy) })}
            >
              <CardFace kind="strategy" id={line.strategy.id} />
              <span>Tap to read full-size</span>
            </button>
            <div><span>{line.cognitionName}</span><h2>{line.strategy.title}</h2><strong>{line.legal ? `+${line.shared} shared · +${line.private} private` : 'Discarded'}</strong><p>{line.story}</p></div>
          </article>
        ))}
      </div>
      {tended.size > 0 && (
        <div className="mobile-resolution-summary">
          <GiftIcon variation={1} />
          <p><strong>Gift tokens were removed from:</strong><span>{[...tended].join(' · ')}</span></p>
        </div>
      )}
    </section>
  )
}

function PrivateNeedStation({
  cognition,
  tended,
  onInspect,
  onReveal,
}: {
  cognition: Cognition
  tended: boolean
  onInspect: (card: InspectedCard) => void
  onReveal: () => void
}) {
  const visible = cognition.human && cognition.privateVisible
  return (
    <div className="mobile-private-station">
      <div className="mobile-private-card-frame">
        {visible ? (
          <button onClick={() => onInspect({
            kind: 'need',
            id: cognition.privateNeed.card.id,
            label: `${cognition.privateNeed.card.feeling}: ${cognition.privateNeed.card.need}`,
            detail: `${cognition.privateNeed.gifts} gifts remain.`,
          })}>
            <CardFace kind="need" id={cognition.privateNeed.card.id} />
          </button>
        ) : <CardBack kind="need" />}
      </div>
      <div className="mobile-private-copy">
        <span>{visible ? cognition.privateNeed.card.feeling : 'Hidden'}</span>
        <strong>{visible ? cognition.privateNeed.card.need : cognition.human ? 'Your Private Need' : 'Private Need'}</strong>
        <p><GiftIcon variation={2} />{cognition.privateNeed.gifts} gift{cognition.privateNeed.gifts === 1 ? '' : 's'} remaining</p>
        {tended && <em>Tended this round</em>}
        {cognition.human && !visible && <Magnifier used={cognition.magnifierUsed} disabled={cognition.magnifierUsed} onClick={onReveal} />}
      </div>
    </div>
  )
}

function MobileNeedsPanel({
  game,
  tendedNeeds,
  onInspect,
  onRevealPrivate,
}: {
  game: GameState
  tendedNeeds: Set<string>
  onInspect: (card: InspectedCard) => void
  onRevealPrivate: () => void
}) {
  return (
    <section className="mobile-reference-panel mobile-needs-panel">
      <header><span>Needs in play</span><h1>What each Cognition is carrying</h1><p>Tap any Public Need to read its complete card.</p></header>
      {game.cognitions.map((cognition) => (
        <article className="mobile-cognition-needs" key={cognition.id}>
          <div className="mobile-section-heading"><span>{cognition.human ? 'You' : 'NPC'}</span><strong>{cognition.name}</strong><small>{cognition.privateScore} private</small></div>
          <div className="mobile-panel-need-list">
            {cognition.publicNeeds.map((slot) => (
              <NeedChip
                key={slot.card.id}
                cognition={cognition}
                slot={slot}
                expanded
                highlighted={tendedNeeds.has(slot.card.need)}
                onInspect={() => onInspect({ kind: 'need', id: slot.card.id, label: `${slot.card.feeling}: ${slot.card.need}`, detail: `${slot.gifts} gifts remain.` })}
              />
            ))}
          </div>
          <div className="mobile-private-need">
            <span>Private Need</span>
            <PrivateNeedStation
              cognition={cognition}
              tended={tendedNeeds.has(cognition.privateNeed.card.need)}
              onInspect={onInspect}
              onReveal={onRevealPrivate}
            />
          </div>
        </article>
      ))}
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
            <aside><strong>{cognition.hand.length}</strong><span>cards</span><strong>{cognition.privateScore}</strong><span>private</span></aside>
          </article>
        ))}
      </div>
      <p className="mobile-reference-note">NPC Strategy hands and Private Needs remain hidden. Their selected Strategy becomes visible only when all three cards reveal together.</p>
    </section>
  )
}

function MobileRulesPanel({ phase }: { phase: GameState['phase'] }) {
  return (
    <section className="mobile-reference-panel mobile-rules-panel">
      <header><span>How this turn works</span><h1>{phase === 'planning' ? 'Choose a Strategy' : phase === 'complete' ? 'The Situation is complete' : 'Review what happened'}</h1></header>
      <ol>
        <li><b>Read the Situation.</b><span>It changes how many gift tokens begin on each Public Need.</span></li>
        <li><b>Notice every Public Need.</b><span>You may play a Strategy only when it tends at least one of your own unresolved Public Needs.</span></li>
        <li><b>Choose one Strategy.</b><span>Cognitions β and γ choose from hidden hands at the same time.</span></li>
        <li><b>Reveal together.</b><span>A Strategy applies its full value to every matching Need. Its strength is never divided.</span></li>
      </ol>
      <p className="mobile-reference-note">The magnifying glass may reveal your Private Need once per Situation. A Strategy can tend that Need incidentally even though it was not directly targeted.</p>
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
  const alpha = game.cognitions[0]
  const beta = game.cognitions[1]
  const gamma = game.cognitions[2]
  const tendedNeeds = useMemo(() => resolvedNeedNames(game.resolution), [game.resolution])

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

  const actionLabel = game.phase === 'planning'
    ? 'Reveal Strategies'
    : game.phase === 'complete'
      ? 'Next Situation'
      : 'Next round'

  return (
    <main className={`mobile-play-page mobile-tab-${tab}`}>
      <header className="mobile-game-header">
        <div><span>Situation {game.situationNumber} · Round {game.round}</span><strong>{game.situation.title}</strong></div>
        <div><b><GiftIcon variation={0} />{game.sharedScore}</b><button onClick={onEnd}>End</button></div>
      </header>

      <div className="mobile-stage">
        {tab === 'play' && (
          <>
            <section className="mobile-situation-section">
              <button
                className="mobile-situation-card"
                onClick={() => setInspected({ kind: 'situation', id: game.situation.id, label: game.situation.title })}
              >
                <CardFace kind="situation" id={game.situation.id} />
                <span>Tap the Situation to read it full-size</span>
              </button>
              <div className="mobile-npc-status"><span>{beta.name}: {beta.hand.length} hidden</span><i /><span>{gamma.name}: {gamma.hand.length} hidden</span></div>
            </section>
            <MobileNeedStrip game={game} tendedNeeds={tendedNeeds} onInspect={setInspected} />
            {game.phase === 'planning'
              ? <MobileHand cognition={alpha} phase={game.phase} onSelect={selectStrategy} onInspect={setInspected} />
              : <MobileReveal lines={game.resolution} onInspect={setInspected} />}
          </>
        )}
        {tab === 'needs' && <MobileNeedsPanel game={game} tendedNeeds={tendedNeeds} onInspect={setInspected} onRevealPrivate={revealPrivate} />}
        {tab === 'cognitions' && <MobileCognitionsPanel game={game} />}
        {tab === 'rules' && <MobileRulesPanel phase={game.phase} />}
      </div>

      {tab === 'play' && (
        <div className="mobile-action-dock">
          <div><span>{game.phase === 'planning' ? 'Your turn' : game.phase === 'complete' ? 'Situation complete' : 'Round resolved'}</span><strong>{game.phase === 'planning' ? alpha.selected ? 'Strategy chosen' : 'Choose one Strategy' : game.phase === 'complete' ? 'All Public Needs are tended' : 'Review the gift markers'}</strong></div>
          <button
            className="primary"
            disabled={game.phase === 'planning' && !alpha.selected}
            onClick={() => game.phase === 'complete' ? onNextSituation() : onChange(game)}
          >{actionLabel}</button>
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
    </main>
  )
}
