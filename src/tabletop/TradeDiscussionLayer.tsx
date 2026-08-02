import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CardFace, GiftIcon } from './Cards'
import type { Cognition, GameState } from './model'
import { analyzeStrategy, applyTrade, generateTradeProposals, type StrategyAnalysis, type TradeProposal } from './trading'

function symbol(cognition: Cognition): string {
  if (cognition.id === 'alpha') return 'α'
  if (cognition.id === 'beta') return 'β'
  return 'γ'
}

function unique(items: string[]): string[] {
  return [...new Set(items)]
}

function responsibilityText(analysis: StrategyAnalysis): string {
  const own = unique(analysis.ownPublic.map((match) => match.need))
  const bonus = unique(analysis.bonusNeeds.map((need) => need.need))
  return [
    own.length ? `your Public Need${own.length === 1 ? '' : 's'}: ${own.join(', ')}` : '',
    bonus.length ? `active Bonus Need${bonus.length === 1 ? '' : 's'}: ${bonus.join(', ')}` : '',
  ].filter(Boolean).join(' and ')
}

function alsoHelpsText(analysis: StrategyAnalysis): string {
  const grouped = new Map<string, string[]>()
  for (const match of analysis.otherPublic) {
    const current = grouped.get(match.cognitionName) ?? []
    grouped.set(match.cognitionName, unique([...current, match.need]))
  }
  return [...grouped.entries()].map(([name, needs]) => `${name}: ${needs.join(', ')}`).join(' · ')
}

function tradeTargets(analysis: StrategyAnalysis, playerId: string): string {
  return analysis.playableBy
    .filter((target) => target.cognitionId !== playerId)
    .map((target) => `${target.cognitionName} could play it for ${target.needs.join(', ')}`)
    .join(' · ')
}

function InfoDisclosure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="discussion-info">
      <summary><span aria-hidden="true">i</span><b>{label}</b></summary>
      <div>{children}</div>
    </details>
  )
}

function OwnershipBoard({ game }: { game: GameState }) {
  return (
    <section className="discussion-section responsibility-board">
      <header><span>Public responsibilities</span><h2>Who can qualify each play?</h2></header>
      <div className="responsibility-grid">
        {game.cognitions.map((cognition) => (
          <article key={cognition.id} className={`responsibility-card owner-${cognition.id}`}>
            <header><b>{symbol(cognition)}</b><div><span>{cognition.human ? 'You' : 'NPC'}</span><strong>{cognition.name}</strong></div></header>
            <div>
              {cognition.publicNeeds.map((slot) => (
                <p key={slot.card.id} className={slot.gifts === 0 ? 'complete' : ''}>
                  <span><small>{slot.card.feeling}</small><strong>{slot.card.need}</strong></span>
                  <b><GiftIcon variation={cognition.id === 'beta' ? 1 : cognition.id === 'gamma' ? 2 : 0} />{slot.gifts}</b>
                </p>
              ))}
            </div>
          </article>
        ))}
      </div>
      <InfoDisclosure label="Why ownership matters">
        <p>A Cognition may play a Strategy only when it tends one of its own unresolved Public Needs or an active Bonus Need. Once legally played, that Strategy can also tend matching Needs belonging to anyone.</p>
      </InfoDisclosure>
    </section>
  )
}

function PrivateGoal({ game, onReview }: { game: GameState; onReview: () => void }) {
  const player = game.cognitions.find((cognition) => cognition.human)
  if (!player) return null
  return (
    <section className={`private-goal ${player.privateVisible ? 'known' : 'unknown'}`}>
      <span>Private opportunity</span>
      {player.privateVisible ? (
        <><h2>{player.privateNeed.card.need} is visible.</h2><p>Look carefully; it will return face down when you close the review.</p></>
      ) : player.magnifierUsed ? (
        <><h2>Your magnifier has been used.</h2><p>Rely on what you remember for the rest of this Situation.</p></>
      ) : (
        <><h2>Your Private Need remains face down.</h2><button className="private-goal-review" onClick={onReview}>Use the magnifying glass</button></>
      )}
      <InfoDisclosure label="How Private points work">
        <p>Any Cognition’s legally played Strategy may incidentally tend your Private Need. Its gift still becomes your individual point.</p>
      </InfoDisclosure>
    </section>
  )
}

function HandPlanner({ game }: { game: GameState }) {
  const player = game.cognitions.find((cognition) => cognition.human)
  if (!player) return null
  const privateKnown = player.privateVisible
  return (
    <details className="discussion-section hand-planner progressive-panel">
      <summary><span>Card guidance</span><strong>Check why each Strategy is playable</strong><b>＋</b></summary>
      <div className="planner-cards">
        {player.hand.map((card) => {
          const analysis = analyzeStrategy(game, player, card)
          const helps = alsoHelpsText(analysis)
          const targets = tradeTargets(analysis, player.id)
          return (
            <article key={card.id} className={analysis.playable ? 'legal' : 'trade-candidate'}>
              <div className="planner-card-image"><CardFace kind="strategy" id={card.id} /></div>
              <div className="planner-card-copy">
                <span>{analysis.playable ? 'Playable' : 'Trade or discard'}</span>
                <h3>{card.title}</h3>
                {analysis.playable
                  ? <p><b>Qualifies through:</b> {responsibilityText(analysis)}.</p>
                  : <p>It does not currently tend your Public Needs or an active Bonus Need.</p>}
                {helps && <p><b>Also helps:</b> {helps}.</p>}
                {privateKnown && analysis.tendsOwnPrivate && <p className="private-opportunity"><b>Private opportunity:</b> also tends {player.privateNeed.card.need}.</p>}
                {!analysis.playable && targets && <p className="trade-opportunity"><b>Useful to trade:</b> {targets}.</p>}
              </div>
            </article>
          )
        })}
      </div>
    </details>
  )
}

function ProposalCard({ game, proposal, onAccept }: { game: GameState; proposal: TradeProposal; onAccept: () => void }) {
  const player = game.cognitions.find((cognition) => cognition.human)
  const privateKnown = Boolean(player?.privateVisible)
  return (
    <article className={`trade-proposal ${proposal.mutualUpgrade ? 'mutual-upgrade' : ''}`}>
      <header>
        <div><span>{proposal.mutualUpgrade ? 'Mutual upgrade' : 'Fair exchange'}</span><h3>{proposal.npcName} offers a swap</h3></div>
        <b>{symbol(game.cognitions.find((cognition) => cognition.id === proposal.npcId) ?? game.cognitions[1])}</b>
      </header>
      <div className="trade-cards">
        <section><span>You give</span><CardFace kind="strategy" id={proposal.playerGives.id} /><strong>{proposal.playerGives.title}</strong></section>
        <i aria-hidden="true">⇄</i>
        <section><span>You receive</span><CardFace kind="strategy" id={proposal.npcGives.id} /><strong>{proposal.npcGives.title}</strong></section>
      </div>
      <button className="primary" onClick={onAccept}>Accept trade</button>
      <InfoDisclosure label="Why this trade works">
        <p>{proposal.npcName} can play your card for {unique(proposal.npcReceives.ownPublic.map((match) => match.need)).join(', ') || 'an active Bonus Need'}.</p>
        <p>You can play the offered card for {responsibilityText(proposal.playerReceives)}.</p>
        {privateKnown && proposal.playerReceives.tendsOwnPrivate && <p><b>Private opportunity:</b> the offered card also tends your currently visible Private Need.</p>}
        <p>Only this return card is revealed; the rest of {proposal.npcName}’s hand stays hidden.</p>
      </InfoDisclosure>
    </article>
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
  const [privateReviewOpen, setPrivateReviewOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const proposals = useMemo(() => generateTradeProposals(game), [game])
  const player = game.cognitions.find((cognition) => cognition.human)
  const { target, phone } = useMobilePlanningTarget()

  const accept = (proposal: TradeProposal) => {
    onGameChange(applyTrade(game, proposal))
    setNotice(`Trade complete: you received “${proposal.npcGives.title}.”`)
  }

  const reviewPrivate = () => {
    if (!player || player.magnifierUsed || game.phase !== 'planning') return
    setOpen(false)
    onGameChange({
      ...game,
      cognitions: game.cognitions.map((cognition) => cognition.id === player.id
        ? { ...cognition, privateVisible: true, magnifierUsed: true }
        : cognition),
    })
    setPrivateReviewOpen(true)
  }

  const closePrivateReview = () => {
    if (player) {
      onGameChange({
        ...game,
        cognitions: game.cognitions.map((cognition) => cognition.id === player.id
          ? { ...cognition, privateVisible: false }
          : cognition),
      })
    }
    setPrivateReviewOpen(false)
  }

  useEffect(() => {
    const handleReview = () => reviewPrivate()
    window.addEventListener('inner-work:review-private', handleReview)
    return () => window.removeEventListener('inner-work:review-private', handleReview)
  }, [game, player])

  const launch = game.phase === 'planning' ? (
    <button className={`discussion-launch ${phone ? 'discussion-launch-in-flow' : ''}`} onClick={() => setOpen(true)}>
      <span>Before choosing</span>
      <strong>Planning tools</strong>
      {proposals.length > 0 && <b>{proposals.length}</b>}
    </button>
  ) : null

  return (
    <div className="discussion-layer">
      {children}
      {phone && target && launch ? createPortal(launch, target) : !phone ? launch : null}

      {open && (
        <dialog open className="discussion-dialog" onClick={() => setOpen(false)} aria-label="Discussion and trading phase">
          <div className="discussion-dialog-inner" onClick={(event) => event.stopPropagation()}>
            <header className="discussion-dialog-header">
              <div><span>Discussion phase</span><h1>Plan before you commit.</h1></div>
              <button onClick={() => setOpen(false)} aria-label="Close discussion">×</button>
            </header>

            <InfoDisclosure label="How discussion and trading work">
              <p>Each Cognition needs a Strategy it can legally play through its own Public Need or an active Bonus Need. Trade any number of cards before everyone commits. NPC hands remain hidden except for a specific card offered in a trade.</p>
            </InfoDisclosure>

            {notice && <p className="trade-notice">{notice}</p>}
            <OwnershipBoard game={game} />
            <PrivateGoal game={game} onReview={reviewPrivate} />

            <section className="discussion-section trade-room">
              <header><span>Suggested trades</span><h2>{proposals.length > 0 ? 'Useful swaps available' : 'No useful swap right now'}</h2></header>
              {proposals.length > 0
                ? <div className="trade-proposal-list">{proposals.map((proposal) => <ProposalCard key={proposal.id} game={game} proposal={proposal} onAccept={() => accept(proposal)} />)}</div>
                : <div className="no-trades"><strong>Continue with a legal Strategy or discard.</strong></div>}
            </section>

            <HandPlanner game={game} />
            <footer><button className="primary" onClick={() => setOpen(false)}>Return to your hand</button></footer>
          </div>
        </dialog>
      )}

      {privateReviewOpen && player && (
        <dialog open className="private-review-dialog" onClick={closePrivateReview} aria-label="Review your Private Need">
          <section onClick={(event) => event.stopPropagation()}>
            <span>Magnifying glass · one review this Situation</span>
            <h1>Look carefully.</h1>
            <div><CardFace kind="need" id={player.privateNeed.card.id} /></div>
            <strong>{player.privateNeed.card.feeling}: {player.privateNeed.card.need}</strong>
            <InfoDisclosure label="Why this matters">
              <p>Any Cognition may incidentally tend this Need through a legally played Strategy. The individual point belongs to you.</p>
            </InfoDisclosure>
            <button className="primary" onClick={closePrivateReview}>Return it face down</button>
          </section>
        </dialog>
      )}
    </div>
  )
}
