import type { StrategyCard } from '../data/cards'
import type { Cognition, GameState } from './model'
import { analyzeStrategy, type BonusMatch, type PublicMatch } from './trading'

function gifts(count: number): string {
  return `${count} gift${count === 1 ? '' : 's'}`
}

function eventNote(eventStrength: number): string {
  return eventStrength > 0 ? ` This includes +${eventStrength} activated by the current Event Situation.` : ''
}

function PublicContribution({ match, qualification }: { match: PublicMatch; qualification: boolean }) {
  return (
    <article className={`strategy-contribution-row public owner-${match.cognitionId}`}>
      <header>
        <span>{qualification ? 'Qualifies the play · Your Public Need' : `${match.cognitionName} · Public Need`}</span>
        <b>+{match.strength} {match.need}</b>
      </header>
      <strong>{match.feeling}: {match.need}</strong>
      <p>
        Adds +{match.strength} toward this Public Need. With {gifts(match.remaining)} currently remaining, this effect can account for up to {gifts(match.gifts)} when the three legal Strategies are combined.
        {eventNote(match.eventStrength)}
      </p>
    </article>
  )
}

function BonusContribution({ bonus }: { bonus: BonusMatch }) {
  return (
    <article className="strategy-contribution-row bonus">
      <header><span>Qualifies the play · Active Bonus Need</span><b>+{bonus.strength} {bonus.need}</b></header>
      <strong>{bonus.need}</strong>
      <p>
        This matching active Bonus Need makes the Strategy legal. Any play tied for the strongest {bonus.need} effect can receive up to {gifts(bonus.contribution)} of the {gifts(bonus.gifts)} currently on it.
        {eventNote(bonus.eventStrength)}
      </p>
    </article>
  )
}

export function StrategyContributionDetails({
  game,
  cognition,
  card,
  compact = false,
}: {
  game: GameState
  cognition: Cognition
  card: StrategyCard
  compact?: boolean
}) {
  const analysis = analyzeStrategy(game, cognition, card)
  const hasQualification = analysis.ownPublic.length > 0 || analysis.bonusNeeds.length > 0
  const hasOtherPublic = analysis.otherPublic.length > 0

  return (
    <section className={`strategy-contribution-details ${compact ? 'compact' : ''} ${analysis.playable ? 'playable' : 'discard'}`}>
      <header className="strategy-contribution-heading">
        <span>{analysis.playable ? 'Why this Strategy can be played' : 'Why this is discard only'}</span>
        <strong>{analysis.playable
          ? 'It matches one of your unresolved Public Needs or an active Bonus Need.'
          : 'It does not match either of your unresolved Public Needs or any active Bonus Need.'}</strong>
      </header>

      {hasQualification && (
        <div className="strategy-contribution-group qualifying">
          {analysis.ownPublic.map((match) => <PublicContribution key={`${match.cognitionId}:${match.need}`} match={match} qualification />)}
          {analysis.bonusNeeds.map((bonus) => <BonusContribution key={bonus.id} bonus={bonus} />)}
        </div>
      )}

      {hasOtherPublic && (
        <div className="strategy-contribution-group incidental">
          <h3>{analysis.playable ? 'What else this shared action can tend' : 'Potential value if traded to a Cognition that can play it'}</h3>
          {analysis.otherPublic.map((match) => <PublicContribution key={`${match.cognitionId}:${match.need}`} match={match} qualification={false} />)}
        </div>
      )}

      {analysis.createdBonuses.length > 0 && (
        <div className="strategy-contribution-group introduced">
          <h3>{analysis.playable ? 'What this play would introduce' : 'Additional effect if another Cognition can legally play it'}</h3>
          {analysis.createdBonuses.map((bonus) => (
            <article className="strategy-contribution-row created" key={bonus.need}>
              <header><span>New Bonus Need next round</span><b>{gifts(bonus.gifts)}</b></header>
              <strong>{bonus.need}</strong>
              <p>
                A legal play would introduce a Bonus Need for {bonus.need} with {gifts(bonus.gifts)} next round.
                {bonus.eventGifts > 0 ? ` ${gifts(bonus.eventGifts)} come from the card’s Event effect, which is active in this Situation.` : ''}
              </p>
            </article>
          ))}
        </div>
      )}

      {!hasQualification && !hasOtherPublic && analysis.createdBonuses.length === 0 && (
        <p className="strategy-contribution-empty">None of this card’s effects currently connect to a visible Public or active Bonus Need.</p>
      )}
    </section>
  )
}
