import type { StrategyCard } from '../data/cards'
import { CognitionSeatBadge } from './CognitionSeatBadge'
import type { Cognition, GameState } from './model'
import { isSpecialAction, specialActionSummary, specialActionTiming } from './specialActions'
import { analyzeStrategy, type BonusMatch, type PublicMatch } from './trading'

function giftLabel(count: number): string {
  return `${count} gift${count === 1 ? '' : 's'}`
}

function CognitionToken({ id }: { id: PublicMatch['cognitionId'] }) {
  return <CognitionSeatBadge cognition={id} size="small" />
}

function bonusOrigin(game: GameState, bonus: BonusMatch): string {
  const immediateDiscussionAction = bonus.sourceStrategyId === 'SA4' || bonus.sourceStrategyId === 'SA5'
  const introducedRound = immediateDiscussionAction
    ? bonus.availableRound
    : Math.max(1, bonus.availableRound - 1)
  const when = introducedRound === game.round
    ? 'this round'
    : introducedRound === game.round - 1
      ? 'last round'
      : `in Round ${introducedRound}`
  return `Introduced ${when} by “${bonus.sourceStrategyTitle}” · ${bonus.sourceCognitionName}`
}

export function StrategyQuickSummary({ game, cognition, card }: {
  game: GameState
  cognition: Cognition
  card: StrategyCard
}) {
  if (isSpecialAction(card)) {
    const timing = specialActionTiming(card)
    const discussion = timing === 'Discussion Phase'
    return (
      <ul className="strategy-quick-summary special" aria-label={`Special Action timing: ${timing}`}>
        <li className="creates">
          <b className="strategy-bonus-token" aria-hidden="true">✦</b>
          <span><strong>{timing}</strong> · {discussion ? 'changes the table immediately' : 'checked at simultaneous reveal'}</span>
          <em>{discussion ? 'Now' : 'Pair'}</em>
        </li>
      </ul>
    )
  }

  const analysis = analyzeStrategy(game, cognition, card)
  if (!analysis.playable) return <span className="strategy-quick-discard">No visible match · play normally only as a discard, or assign privately when a Special Action permits it</span>

  return (
    <ul className="strategy-quick-summary" aria-label="What this playable Strategy contributes">
      {analysis.ownPublic.map((match) => (
        <li className={`qualifies owner-${match.cognitionId}`} key={`own:${match.cognitionId}:${match.need}`}>
          <CognitionToken id={match.cognitionId} />
          <span>Playable through your <strong>{match.need}</strong></span>
          <em>+{match.strength}</em>
        </li>
      ))}
      {analysis.bonusNeeds.map((bonus) => (
        <li className="qualifies bonus" key={`bonus:${bonus.id}`}>
          <b className="strategy-bonus-token" aria-hidden="true">✦</b>
          <span>Playable through Bonus <strong>{bonus.need}</strong></span>
          <em>+{bonus.strength}</em>
        </li>
      ))}
      {analysis.otherPublic.map((match) => (
        <li className={`also owner-${match.cognitionId}`} key={`other:${match.cognitionId}:${match.need}`}>
          <CognitionToken id={match.cognitionId} />
          <span>Also tends <strong>{match.need}</strong></span>
          <em>+{match.strength}</em>
        </li>
      ))}
      {analysis.createdBonuses.map((bonus) => (
        <li className="creates" key={`creates:${bonus.need}`}>
          <b className="strategy-bonus-token" aria-hidden="true">＋</b>
          <span>Introduces Bonus <strong>{bonus.need}</strong> next round</span>
          <em>+{bonus.gifts}</em>
        </li>
      ))}
    </ul>
  )
}

function PublicDetail({ match, qualification }: { match: PublicMatch; qualification: boolean }) {
  return (
    <li className={`strategy-detail-row owner-${match.cognitionId}`}>
      <CognitionToken id={match.cognitionId} />
      <span><strong>{match.need}</strong><small>{qualification ? 'Makes this card playable' : `${match.cognitionName} · Public Need`}</small></span>
      <b>+{match.strength}</b>
      <em>{match.gifts}/{match.remaining} {giftLabel(match.remaining).replace(/^\d+ /, '')}</em>
      {match.eventStrength > 0 && <i>Event +{match.eventStrength}</i>}
    </li>
  )
}

function BonusDetail({ game, bonus }: { game: GameState; bonus: BonusMatch }) {
  return (
    <li className="strategy-detail-row bonus">
      <b className="strategy-bonus-token" aria-hidden="true">✦</b>
      <span>
        <strong>{bonus.need}</strong>
        <small>Active Bonus · makes this card playable</small>
        <small className="strategy-bonus-origin">{bonusOrigin(game, bonus)}</small>
      </span>
      <b>+{bonus.strength}</b>
      <em>up to {bonus.contribution}/{bonus.gifts} gifts</em>
      {bonus.eventStrength > 0 && <i>Event +{bonus.eventStrength}</i>}
    </li>
  )
}

export function StrategyContributionDetails({ game, cognition, card, compact = false }: {
  game: GameState
  cognition: Cognition
  card: StrategyCard
  compact?: boolean
}) {
  if (isSpecialAction(card)) {
    const timing = specialActionTiming(card)
    const discussion = timing === 'Discussion Phase'
    return (
      <section className={`strategy-contribution-details special ${compact ? 'compact' : ''}`}>
        <div className="strategy-detail-group">
          <h3>{timing}</h3>
          <ul>
            <li className="strategy-detail-row created">
              <b className="strategy-bonus-token" aria-hidden="true">✦</b>
              <span><strong>{discussion ? 'Use openly during planning' : 'Configure a hidden conditional pair'}</strong><small>{specialActionSummary(card)}</small></span>
              <em>{discussion ? 'Its effect becomes available immediately' : 'The Special Action is checked before the Strategy resolves'}</em>
            </li>
          </ul>
        </div>
      </section>
    )
  }

  const analysis = analyzeStrategy(game, cognition, card)
  const hasQualification = analysis.ownPublic.length > 0 || analysis.bonusNeeds.length > 0
  const hasOtherPublic = analysis.otherPublic.length > 0

  return (
    <section className={`strategy-contribution-details ${compact ? 'compact' : ''} ${analysis.playable ? 'playable' : 'discard'}`}>
      {!analysis.playable && <p className="strategy-contribution-empty">No visible match with your unresolved Public Needs or an active Bonus Need. A private-targeted commitment, when available, is checked only at reveal.</p>}
      {hasQualification && <div className="strategy-detail-group"><h3>Makes it playable</h3><ul>{analysis.ownPublic.map((match) => <PublicDetail key={`${match.cognitionId}:${match.need}`} match={match} qualification />)}{analysis.bonusNeeds.map((bonus) => <BonusDetail key={bonus.id} game={game} bonus={bonus} />)}</ul></div>}
      {hasOtherPublic && <div className="strategy-detail-group"><h3>{analysis.playable ? 'Also tends' : 'Could help after a trade'}</h3><ul>{analysis.otherPublic.map((match) => <PublicDetail key={`${match.cognitionId}:${match.need}`} match={match} qualification={false} />)}</ul></div>}
      {analysis.createdBonuses.length > 0 && <div className="strategy-detail-group"><h3>Introduces next round</h3><ul>{analysis.createdBonuses.map((bonus) => <li className="strategy-detail-row created" key={bonus.need}><b className="strategy-bonus-token" aria-hidden="true">＋</b><span><strong>{bonus.need}</strong><small>New Bonus Need</small></span><b>+{bonus.gifts}</b><em>{bonus.eventGifts > 0 ? `Event effect +${bonus.eventGifts}` : 'next round'}</em></li>)}</ul></div>}
    </section>
  )
}
