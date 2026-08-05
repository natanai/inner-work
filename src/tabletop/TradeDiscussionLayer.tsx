import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CardFace, GiftIcon } from './Cards'
import { cognitionIdentity, cognitionSymbol } from './cognitionIdentity'
import type { Cognition, GameState } from './model'
import { analyzeStrategy, applyTrade, generateTradeProposals, type StrategyAnalysis, type TradeProposal } from './trading'

function unique(items: string[]): string[] {
  return [...new Set(items)]
}

function responsibilityText(analysis: StrategyAnalysis): string {
  const own = unique(analysis.ownPublic.map((match) => match.need))
  const bonus = unique(analysis.bonusNeeds.map((need) => need.need))
  return [own.join(', '), bonus.join(', ')].filter(Boolean).join(' · ')
}

function InfoDisclosure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="discussion-info">
      <summary><span aria-hidden="true">i</span><b>{label}</b></summary>
      <div>{children}</div>
    </details>
  )
}

function CognitionSnapshot({ cognition }: { cognition: Cognition }) {
  const identity = cognitionIdentity(cognition)
  return (
    <article className={`planning-cognition-snapshot owner-${cognition.id}`}>
      <header>
        <b>{cognitionSymbol(cognition)}</b>
        <div><span>{identity.role}</span><strong>{identity.name}</strong></div>
      </header>
      <div>
        {cognition.publicNeeds.map((slot) => (
          <p key={slot.card.id} className={slot.gifts === 0 ? 'complete' : ''}>
            <span><small>{slot.card.feeling}</small><strong>{slot.card.need}</strong></span>
            <b><GiftIcon variation={cognition.id === 'beta' ? 1 : cognition.id === 'gamma' ? 2 : 0} />{slot.gifts}</b>
          </p>
        ))}
      </div>
    </article>
  )
}

function PlanningSnapshot({ game }: { game: GameState }) {
  return (
    <section className="planning-snapshot" aria-label="Public Needs at a glance">
      <header><span>Needs at a glance</span><strong>Choose a route that tends one of your unresolved Needs.</strong></header>
      <div>{game.cognitions.map((cognition) => <CognitionSnapshot key={cognition.id} cognition={cognition} />)}</div>
    </section>
  )
}

function ProposalCard({ game, proposal, onAccept }: { game: GameState; proposal: TradeProposal; onAccept: () => void }) {
  const player = game.cognitions.find((cognition) => cognition.human)
  const privateKnown = Boolean(player?.privateVisible)
  return (
    <article className={`trade-proposal compact ${proposal.mutualUpgrade ? 'mutual-upgrade' : ''}`}>
      <header><div><span>{proposal.mutualUpgrade ? 'Mutual upgrade' : 'Available swap'}</span><h3>{proposal.npcName}</h3></div><b>{cognitionSymbol(proposal.npcId)}</b></header>
      <div className="trade-cards">
        <section><span>Give</span><CardFace kind="strategy" id={proposal.playerGives.id} /><strong>{proposal.playerGives.title}</strong></section>
        <i aria-hidden="true">⇄</i>
        <section><span>Receive</span><CardFace kind="strategy" id={proposal.npcGives.id} /><strong>{proposal.npcGives.title}</strong></section>
      </div>
      <button className="primary" onClick={onAccept}>Make trade</button>
      <InfoDisclosure label="Why it works">
        <p>{proposal.npcName} can use your card, and the offered card qualifies through {responsibilityText(proposal.playerReceives) || 'an active route'}.</p>
        {privateKnown && proposal.playerReceives.tendsOwnPrivate && <p>The offered card also tends your visible Private Need.</p>}
      </InfoDisclosure>
    </article>
  )
}

function HandPlanner({ game }: { game: GameState }) {
  const player = game.cognitions.find((cognition) => cognition.human)
  if (!player) return null
  return (
    <details className="discussion-section hand-planner progressive-panel planning-tool-panel">
      <summary><span>Card guide</span><strong>Why can I play each card?</strong><b>＋</b></summary>
      <div className="planner-cards">
        {player.hand.map((card) => {
          const analysis = analyzeStrategy(game, player, card)
          return (
            <article key={card.id} className={analysis.playable ? 'legal' : 'trade-candidate'}>
              <div className="planner-card-image"><CardFace kind="strategy" id={card.id} /></div>
              <div className="planner-card-copy">
                <span>{analysis.playable ? 'Playable' : 'Trade or discard'}</span>
                <h3>{card.title}</h3>
                <p>{analysis.playable ? responsibilityText(analysis) || 'Active route' : 'No visible match'}</p>
              </div>
            </article>
          )
        })}
      </div>
    </details>
  )
}

function useMobilePlanningTarget(): { target: HTMLElement | null; phone: boolean } {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)')
    const refresh = () => {
      setPhone(media.matches)
      setTarget(document.querySelector<HTMLElement>('.mobile-hand-section'))
    }
    refresh()
    const observer = new MutationObserver(refresh)
    observer.observe(document.body, { childList: true, subtree: true })
    media.addEventListener?.('change', refresh)
    return () => {
      observer.disconnect()
      media.removeEventListener?.('change', refresh)
    }
  }, [])

  return { target, phone }
}

export function TradeDiscussionLayer({ game, onGameChange, children }: { game: GameState; onGameChange: (game: GameState) => void; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const proposals = useMemo(() => generateTradeProposals(game), [game])
  const player = game.cognitions.find((cognition) => cognition.human)
  const { target, phone } = useMobilePlanningTarget()

  const accept = (proposal: TradeProposal) => {
    onGameChange(applyTrade(game, proposal))
    setNotice(`Trade complete: “${proposal.npcGives.title}” is now in your hand.`)
  }

  const openMagnifier = () => {
    if (!player || player.magnifierUsed || game.phase !== 'planning') return
    setOpen(false)
    window.dispatchEvent(new Event('inner-work:open-magnifier'))
  }

  const launch = game.phase === 'planning' ? (
    <button className={`discussion-launch ${phone ? 'discussion-launch-in-flow' : ''}`} onClick={() => setOpen(true)}>
      <span>Before choosing</span>
      <strong>Plan or trade</strong>
      {proposals.length > 0 && <b>{proposals.length}</b>}
    </button>
  ) : null

  return (
    <div className="discussion-layer">
      {children}
      {phone && target && launch ? createPortal(launch, target) : !phone ? launch : null}

      {open && (
        <dialog open className="discussion-dialog planning-dialog-condensed" onClick={() => setOpen(false)} aria-label="Planning and trading">
          <div className="discussion-dialog-inner" onClick={(event) => event.stopPropagation()}>
            <header className="discussion-dialog-header">
              <div><span>Discussion phase</span><h1>Choose your next move.</h1></div>
              <button onClick={() => setOpen(false)} aria-label="Close planning">×</button>
            </header>

            <p className="planning-one-line">Play a Strategy, trade, use a tool, or deliberately discard.</p>
            {notice && <p className="trade-notice">{notice}</p>}
            <PlanningSnapshot game={game} />

            <section className="planning-action-strip" aria-label="Planning tools">
              <button className="planning-magnifier-action" disabled={!player || player.magnifierUsed} onClick={openMagnifier}>
                <b aria-hidden="true">⌕</b>
                <span><strong>Magnifier</strong><small>{player?.magnifierUsed ? 'Already used' : 'Choose one official use'}</small></span>
              </button>
              <button onClick={() => document.querySelector<HTMLElement>('.planning-trade-panel')?.setAttribute('open', '')}>
                <b aria-hidden="true">⇄</b>
                <span><strong>Trade</strong><small>{proposals.length ? `${proposals.length} suggested` : 'Ask for a Need'}</small></span>
              </button>
            </section>

            <details className="discussion-section planning-tool-panel planning-trade-panel">
              <summary><span>Trading</span><strong>See trade options</strong><b>＋</b></summary>
              <div className="trade-room">
                {proposals.length > 0 && <div className="trade-proposal-list">{proposals.map((proposal) => <ProposalCard key={proposal.id} game={game} proposal={proposal} onAccept={() => accept(proposal)} />)}</div>}
                {proposals.length === 0 && <p className="no-trades"><strong>No suggested swap.</strong> You can still request a card by Need below.</p>}
              </div>
            </details>

            <HandPlanner game={game} />

            <InfoDisclosure label="How planning works">
              <p>A legal Strategy tends one of your unresolved Public Needs or an active Bonus Need. NPC hands stay hidden except for a specific trade offer.</p>
            </InfoDisclosure>

            <footer><button className="primary" onClick={() => setOpen(false)}>Return to hand</button></footer>
          </div>
        </dialog>
      )}
    </div>
  )
}
