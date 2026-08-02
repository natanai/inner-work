import { useMemo, useState, type ReactNode } from 'react'
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
  const reasons = [
    own.length ? `your Public Need${own.length === 1 ? '' : 's'}: ${own.join(', ')}` : '',
    bonus.length ? `active Bonus Need${bonus.length === 1 ? '' : 's'}: ${bonus.join(', ')}` : '',
  ].filter(Boolean)
  return reasons.join(' and ')
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

function OwnershipBoard({ game }: { game: GameState }) {
  return (
    <section className="discussion-section responsibility-board">
      <header><span>Who is responsible for what?</span><h2>Each Cognition must qualify its play with its own Public Need.</h2></header>
      <div className="responsibility-grid">
        {game.cognitions.map((cognition) => (
          <article key={cognition.id} className={`responsibility-card owner-${cognition.id}`}>
            <header><b>{symbol(cognition)}</b><div><span>{cognition.human ? 'You control' : 'NPC'}</span><strong>{cognition.name}</strong></div></header>
            <div>
              {cognition.publicNeeds.map((slot) => (
                <p key={slot.card.id} className={slot.gifts === 0 ? 'complete' : ''}>
                  <span><small>{slot.card.feeling}</small><strong>{slot.card.need}</strong></span>
                  <b><GiftIcon variation={cognition.id === 'beta' ? 1 : cognition.id === 'gamma' ? 2 : 0} />{slot.gifts}</b>
                </p>
              ))}
            </div>
            <small>{cognition.human ? 'Your Strategy must tend one of these, or an active Bonus Need.' : `Trade ${cognition.name} cards that let it tend one of these.`}</small>
          </article>
        ))}
      </div>
    </section>
  )
}

function PrivateGoal({ game }: { game: GameState }) {
  const player = game.cognitions.find((cognition) => cognition.human)
  if (!player) return null
  const known = player.privateVisible || player.magnifierUsed
  return (
    <section className={`private-goal ${known ? 'known' : 'unknown'}`}>
      <span>Private strategy</span>
      {known ? (
        <>
          <h2>You remember: {player.privateNeed.card.need}</h2>
          <p>Any Cognition’s <strong>legally played</strong> Strategy can incidentally tend this Need. Its gift still goes into your individual score.</p>
        </>
      ) : (
        <>
          <h2>Your Private Need is still hidden.</h2>
          <p>Use the magnifying glass to review it. Once known, this discussion screen will flag Strategies and trades that can incidentally tend it.</p>
        </>
      )}
    </section>
  )
}

function HandPlanner({ game }: { game: GameState }) {
  const player = game.cognitions.find((cognition) => cognition.human)
  if (!player) return null
  const privateKnown = player.privateVisible || player.magnifierUsed
  return (
    <section className="discussion-section hand-planner">
      <header><span>Your hand</span><h2>Why each Strategy is—or is not—legal for you.</h2></header>
      <div className="planner-cards">
        {player.hand.map((card) => {
          const analysis = analyzeStrategy(game, player, card)
          const helps = alsoHelpsText(analysis)
          const targets = tradeTargets(analysis, player.id)
          return (
            <article key={card.id} className={analysis.playable ? 'legal' : 'trade-candidate'}>
              <div className="planner-card-image"><CardFace kind="strategy" id={card.id} /></div>
              <div className="planner-card-copy">
                <span>{analysis.playable ? 'Legal for Cognition α' : 'Not legal for Cognition α'}</span>
                <h3>{card.title}</h3>
                {analysis.playable
                  ? <p><b>Playable because:</b> It tends {responsibilityText(analysis)}.</p>
                  : <p><b>Why not:</b> It does not currently tend your own Public Needs or an active Bonus Need.</p>}
                {helps && <p><b>Also helps the group:</b> {helps}.</p>}
                {privateKnown && analysis.tendsOwnPrivate && <p className="private-opportunity"><b>Private opportunity:</b> It also tends your remembered Private Need, {player.privateNeed.card.need}.</p>}
                {!analysis.playable && targets && <p className="trade-opportunity"><b>Trade opportunity:</b> {targets}.</p>}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function ProposalCard({
  game,
  proposal,
  onAccept,
}: {
  game: GameState
  proposal: TradeProposal
  onAccept: () => void
}) {
  const player = game.cognitions.find((cognition) => cognition.human)
  const privateKnown = Boolean(player && (player.privateVisible || player.magnifierUsed))
  return (
    <article className={`trade-proposal ${proposal.mutualUpgrade ? 'mutual-upgrade' : ''}`}>
      <header>
        <div><span>{proposal.mutualUpgrade ? 'Mutual upgrade' : 'Fair exchange'}</span><h3>{proposal.npcName} offers a swap</h3></div>
        <b>{symbol(game.cognitions.find((cognition) => cognition.id === proposal.npcId) ?? game.cognitions[1])}</b>
      </header>
      <div className="trade-cards">
        <section>
          <span>You give</span>
          <CardFace kind="strategy" id={proposal.playerGives.id} />
          <strong>{proposal.playerGives.title}</strong>
          <small>{proposal.npcName} can play it for {unique(proposal.npcReceives.ownPublic.map((match) => match.need)).join(', ') || 'an active Bonus Need'}.</small>
        </section>
        <i aria-hidden="true">⇄</i>
        <section>
          <span>You receive</span>
          <CardFace kind="strategy" id={proposal.npcGives.id} />
          <strong>{proposal.npcGives.title}</strong>
          <small>You can play it for {responsibilityText(proposal.playerReceives)}.</small>
        </section>
      </div>
      {privateKnown && proposal.playerReceives.tendsOwnPrivate && (
        <p className="private-opportunity"><b>Especially useful:</b> the offered card also tends your remembered Private Need.</p>
      )}
      <p className="trade-secrecy">Only this proposed return card is revealed. The rest of {proposal.npcName}’s hand stays hidden.</p>
      <button className="primary" onClick={onAccept}>Accept this trade</button>
    </article>
  )
}

export function TradeDiscussionLayer({
  game,
  onGameChange,
  children,
}: {
  game: GameState
  onGameChange: (game: GameState) => void
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const proposals = useMemo(() => generateTradeProposals(game), [game])

  const accept = (proposal: TradeProposal) => {
    onGameChange(applyTrade(game, proposal))
    setNotice(`Trade completed with ${proposal.npcName}: you received “${proposal.npcGives.title}.”`)
  }

  return (
    <div className="discussion-layer">
      {children}
      {game.phase === 'planning' && (
        <button className="discussion-launch" onClick={() => setOpen(true)}>
          <span>Discussion phase</span>
          <strong>Plan & trade</strong>
          {proposals.length > 0 && <b>{proposals.length}</b>}
        </button>
      )}

      {open && (
        <dialog open className="discussion-dialog" onClick={() => setOpen(false)} aria-label="Discussion and trading phase">
          <div className="discussion-dialog-inner" onClick={(event) => event.stopPropagation()}>
            <header className="discussion-dialog-header">
              <div><span>Discussion Phase</span><h1>Coordinate before everyone commits a Strategy.</h1><p>You may trade any number of cards. NPC hands stay hidden except for a specific card offered in a trade.</p></div>
              <button onClick={() => setOpen(false)} aria-label="Close discussion">×</button>
            </header>

            {notice && <p className="trade-notice">{notice}</p>}
            <OwnershipBoard game={game} />
            <PrivateGoal game={game} />

            <section className="discussion-section trade-room">
              <header><span>Suggested trades</span><h2>NPCs look for exchanges that help both recipients play legally.</h2><p>Their hidden Private Needs may influence whether a proposal is attractive, but those Needs are never disclosed.</p></header>
              {proposals.length > 0
                ? <div className="trade-proposal-list">{proposals.map((proposal) => <ProposalCard key={proposal.id} game={game} proposal={proposal} onAccept={() => accept(proposal)} />)}</div>
                : <div className="no-trades"><strong>No mutually useful one-card swap is available right now.</strong><p>You can still choose a legal Strategy, discard, or revisit trading after the next draw.</p></div>}
            </section>

            <HandPlanner game={game} />
            <footer><button className="primary" onClick={() => setOpen(false)}>Return to planning</button></footer>
          </div>
        </dialog>
      )}
    </div>
  )
}
