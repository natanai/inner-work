import { useState } from 'react'
import { CardBack, CardFace, GiftIcon, type CardKind } from './Cards'
import { CognitionSeatBadge } from './CognitionSeatBadge'
import { parseCommit } from './commitSelection'
import { cognitionIdentity } from './cognitionIdentity'
import type { Cognition, GameState, NeedSlot } from './model'
import { specialActionById, specialActionRequiresStrategy } from './specialActions'

type MobileTab = 'play' | 'needs' | 'cognitions' | 'rules'
type Inspection = { kind: CardKind; id: string; label: string }

function NeedSummary({ cognition, slot }: { cognition: Cognition; slot: NeedSlot }) {
  return (
    <p className={slot.gifts === 0 ? 'complete' : ''}>
      <span><small>{slot.card.feeling}</small><strong>{slot.card.need}</strong></span>
      <b><GiftIcon variation={cognition.id === 'beta' ? 1 : cognition.id === 'gamma' ? 2 : 0} />{slot.gifts}</b>
    </p>
  )
}

function CognitionSnapshot({ cognition }: { cognition: Cognition }) {
  const identity = cognitionIdentity(cognition)
  return (
    <article className={`planning-cognition-snapshot owner-${cognition.id}`}>
      <header><CognitionSeatBadge cognition={cognition} /><div><span>{identity.role}</span><strong>{identity.name}</strong></div></header>
      <div>{cognition.publicNeeds.map((slot) => <NeedSummary key={slot.card.id} cognition={cognition} slot={slot} />)}</div>
    </article>
  )
}

function PlayPanel({ game, onInspect }: { game: GameState; onInspect: (inspection: Inspection) => void }) {
  return (
    <>
      <button className="mobile-situation-card" onClick={() => onInspect({ kind: 'situation', id: game.situation.id, label: game.situation.title })}>
        <CardFace kind="situation" id={game.situation.id} />
        <span>Tap to read full-size</span>
      </button>
      <section className="planning-snapshot mobile-table-snapshot" aria-label="Public Needs in play">
        <div>{game.cognitions.map((cognition) => <CognitionSnapshot key={cognition.id} cognition={cognition} />)}</div>
      </section>
      <section className="mobile-hand-section" aria-label="Your Strategy hand" />
    </>
  )
}

function NeedsPanel({ game, onInspect, onMagnifier }: { game: GameState; onInspect: (inspection: Inspection) => void; onMagnifier: () => void }) {
  return (
    <section className="mobile-reference-panel mobile-needs-panel">
      <header><span>Needs in play</span><h1>Public and Private Needs</h1><p>Public gifts move the group forward. Private gifts become individual points.</p></header>
      {game.cognitions.map((cognition) => {
        const identity = cognitionIdentity(cognition)
        return (
          <article className="mobile-cognition-needs" key={cognition.id}>
            <div className="mobile-section-heading"><span>{identity.role}</span><strong>{identity.name}</strong><small>Seat {identity.seat}</small></div>
            <div className="mobile-panel-need-list">
              {cognition.publicNeeds.map((slot) => (
                <button className="situation-need-tile compact" key={slot.card.id} onClick={() => onInspect({ kind: 'need', id: slot.card.id, label: `${slot.card.feeling}: ${slot.card.need}` })}>
                  <CognitionSeatBadge cognition={cognition} size="small" className="situation-need-owner" />
                  <span className="situation-need-copy"><small>{slot.card.feeling}</small><strong>{slot.card.need}</strong></span>
                  <span className="situation-need-gifts"><GiftIcon variation={cognition.id === 'beta' ? 1 : cognition.id === 'gamma' ? 2 : 0} /><b>{slot.gifts}</b></span>
                </button>
              ))}
            </div>
            <div className="mobile-private-need">
              <span>Private Need</span>
              <div className="mobile-private-station">
                <div className="mobile-private-card-frame"><CardBack kind="need" /></div>
                <div className="mobile-private-copy">
                  <span>{cognition.human ? 'Your hidden opportunity' : 'Hidden from you'}</span>
                  <strong>Private Need</strong>
                  <p><GiftIcon variation={2} />{cognition.privateNeed.gifts} gift{cognition.privateNeed.gifts === 1 ? '' : 's'} remaining</p>
                  {cognition.human && !cognition.magnifierUsed && game.phase === 'planning' && <button className="quiet" onClick={onMagnifier}>Use Magnifier</button>}
                  {cognition.human && cognition.magnifierUsed && <em>Magnifier used</em>}
                </div>
              </div>
            </div>
          </article>
        )
      })}
    </section>
  )
}

function CognitionsPanel({ game }: { game: GameState }) {
  return (
    <section className="mobile-reference-panel">
      <header><span>Cognitions</span><h1>Three perspectives, one person</h1></header>
      <div className="mobile-cognition-list">
        {game.cognitions.map((cognition) => {
          const identity = cognitionIdentity(cognition)
          return (
            <article key={cognition.id} className={`owner-${cognition.id}`}>
              <CognitionSeatBadge cognition={cognition} />
              <div><span>{identity.role}</span><h2>{identity.name}</h2><p>{cognition.publicNeeds.map((slot) => slot.card.need).join(' · ')}</p></div>
              <aside><strong>{cognition.hand.length}</strong><span>cards</span><strong>{cognition.privateScore + cognition.bonusScore}</strong><span>individual</span></aside>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function RulesPanel() {
  return (
    <section className="mobile-reference-panel mobile-rules-panel">
      <header><span>This round</span><h1>Plan → commit → tell the story</h1></header>
      <ol>
        <li><b>Find a legal route.</b><span>Use one of your Public Needs, an active Bonus Need, or a permitted Private route.</span></li>
        <li><b>Use Discussion first.</b><span>Trade or play a Discussion Action before committing.</span></li>
        <li><b>Reveal together.</b><span>Start-of-Play Actions are checked before ordinary Strategies.</span></li>
      </ol>
    </section>
  )
}

export function MobilePlayScreen({
  game,
  onChange,
  onNextSituation: _onNextSituation,
  onEnd,
}: {
  game: GameState
  onChange: (game: GameState) => void
  onNextSituation: () => void
  onEnd: () => void
}) {
  const [tab, setTab] = useState<MobileTab>('play')
  const [inspection, setInspection] = useState<Inspection | null>(null)
  const player = game.cognitions.find((cognition) => cognition.human) ?? game.cognitions[0]
  const commit = parseCommit(player.selected)
  const committedSpecial = specialActionById(commit.specialId)
  const ready = Boolean(player.selected && (!committedSpecial || !specialActionRequiresStrategy(committedSpecial) || commit.strategyId))
  const remaining = game.cognitions.flatMap((cognition) => cognition.publicNeeds).reduce((total, slot) => total + slot.gifts, 0)
  const openMagnifier = () => window.dispatchEvent(new Event('inner-work:open-magnifier'))
  void _onNextSituation

  return (
    <main className={`mobile-play-page mobile-tab-${tab}`}>
      <header className="mobile-game-header">
        <div><span>Situation {game.situationNumber} · Round {game.round}</span><strong>{game.situation.title}</strong></div>
        <div><b><GiftIcon variation={0} />{remaining}</b><button onClick={onEnd}>End</button></div>
      </header>

      <div className="mobile-stage">
        {tab === 'play' && <PlayPanel game={game} onInspect={setInspection} />}
        {tab === 'needs' && <NeedsPanel game={game} onInspect={setInspection} onMagnifier={openMagnifier} />}
        {tab === 'cognitions' && <CognitionsPanel game={game} />}
        {tab === 'rules' && <RulesPanel />}
      </div>

      {tab === 'play' && (
        <div className="mobile-action-dock">
          <div><span>Your turn</span><strong>{ready ? 'Your commitment is ready.' : 'Choose a Strategy or prepare a discard.'}</strong></div>
          <button className="primary" disabled={!ready} onClick={() => onChange(game)}>Reveal all</button>
        </div>
      )}

      <nav className="mobile-bottom-nav" aria-label="Game views">
        {(['play', 'needs', 'cognitions', 'rules'] as MobileTab[]).map((item) => (
          <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)} aria-current={tab === item ? 'page' : undefined}>
            <span>{item === 'play' ? '◆' : item === 'needs' ? '▣' : item === 'cognitions' ? '◉' : '?'}</span>{item === 'cognitions' ? 'Cognitions' : item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </nav>

      {inspection && (
        <dialog open className="mobile-card-dialog" onClick={() => setInspection(null)} aria-label={inspection.label}>
          <div className={`mobile-dialog-inner mobile-dialog-${inspection.kind}`} onClick={(event) => event.stopPropagation()}>
            <button className="mobile-dialog-close" onClick={() => setInspection(null)} aria-label="Close card">×</button>
            <div className="mobile-dialog-image"><CardFace kind={inspection.kind} id={inspection.id} /></div>
            <section><h2>{inspection.label}</h2><button className="primary" onClick={() => setInspection(null)}>Return to table</button></section>
          </div>
        </dialog>
      )}
    </main>
  )
}
