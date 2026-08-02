import { useEffect, useState, type CSSProperties } from 'react'
import { CardFace, GiftIcon, strategyText } from './Cards'
import type { GameState, Resolution } from './model'

type Props = {
  game: GameState
  onContinue: () => void
  onNextSituation: () => void
  onInspectStrategy: (id: string, label: string) => void
}

function MatchList({ line }: { line: Resolution }) {
  const empty = line.publicMatches.length === 0 && line.privateMatches.length === 0 && line.bonusMatches.length === 0
  return (
    <div className="desktop-story-matches">
      {line.publicMatches.length > 0 && <p><span>Shared Public Needs</span><strong>{line.publicMatches.join(' · ')}</strong></p>}
      {line.privateMatches.length > 0 && <p><span>Private Needs</span><strong>{line.privateMatches.length} hidden Need{line.privateMatches.length === 1 ? '' : 's'} also tended</strong></p>}
      {line.bonusMatches.length > 0 && <p><span>Bonus Needs</span><strong>{line.bonusMatches.join(' · ')}</strong></p>}
      {line.bonusCreated.length > 0 && <p className="created"><span>Creates for next round</span><strong>{line.bonusCreated.map((bonus) => bonus.need).join(' · ')}</strong></p>}
      {empty && <p><span>Result</span><strong>This Strategy is discarded.</strong></p>}
    </div>
  )
}

function RevealMoment({ game }: { game: GameState }) {
  return (
    <section className="desktop-story-reveal">
      <div className="desktop-story-situation-ghost"><CardFace kind="situation" id={game.situation.id} /></div>
      <header>
        <span>Simultaneous reveal</span>
        <h1>Three responses enter the same Situation.</h1>
        <p>The cards were committed together. Now the table slows down so each Cognition can explain what its Strategy means in lived experience.</p>
      </header>
      <div className="desktop-story-reveal-cards">
        {game.resolution.map((line, index) => (
          <article key={line.cognitionId} style={{ '--story-order': index } as CSSProperties}>
            <CardFace kind="strategy" id={line.strategy.id} />
            <strong>{line.cognitionName}</strong>
          </article>
        ))}
      </div>
    </section>
  )
}

function StoryMoment({
  game,
  line,
  index,
  humanStory,
  setHumanStory,
  onInspectStrategy,
}: {
  game: GameState
  line: Resolution
  index: number
  humanStory: string
  setHumanStory: (value: string) => void
  onInspectStrategy: (id: string, label: string) => void
}) {
  const human = line.cognitionId === 'alpha'
  return (
    <section className="desktop-story-turn">
      <div className="desktop-story-context">
        <span>Current Situation</span>
        <div><CardFace kind="situation" id={game.situation.id} /></div>
        <strong>{game.situation.title}</strong>
      </div>
      <button className="desktop-story-played-card" onClick={() => onInspectStrategy(line.strategy.id, line.strategy.title)}>
        <CardFace kind="strategy" id={line.strategy.id} />
      </button>
      <div className="desktop-story-reflection">
        <span>Story {index + 1} of 3 · {line.cognitionName}</span>
        <h1>What does “{line.strategy.title}” actually look like here?</h1>
        <p className="desktop-story-theme">A Strategy is not only a matching word. It is something a person could really do to make more room for a Need.</p>
        {human ? (
          <div className="desktop-story-writing">
            <label htmlFor="desktop-human-story">Describe a small, believable version of this response.</label>
            <textarea
              id="desktop-human-story"
              value={humanStory}
              onChange={(event) => setHumanStory(event.target.value)}
              placeholder="What might you say, do, notice, ask for, or change in this Situation?"
            />
            <button className="quiet" onClick={() => setHumanStory(line.story)}>Use the suggested story</button>
          </div>
        ) : <blockquote>{line.story}</blockquote>}
        <p className="desktop-story-card-text">{strategyText(line.strategy)}</p>
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
    <section className="desktop-story-summary">
      <header><span>Round summary</span><h1>The gifts move only after all three stories are heard.</h1><p>Public gifts enter the shared bank. Private and Bonus gifts become individual points.</p></header>
      <div className="desktop-story-bank"><GiftIcon variation={0} /><b>+{ledger.publicRemoved}</b><span>shared gifts</span></div>
      <div className="desktop-story-summary-grid">
        <article>
          <h2>Public Needs tended</h2>
          {changed.length > 0 ? changed.map((change) => <p key={change.key}><span>{change.cognitionName} · {change.need}</span><b>{change.before} → {change.after}</b></p>) : <p><span>No Public gifts moved.</span></p>}
        </article>
        <article>
          <h2>Individual points</h2>
          {ledger.privateAwards.map((award) => <p key={`${award.cognitionId}-${award.need}`}><span>{award.cognitionName} · Private</span><b>+{award.points}</b></p>)}
          {ledger.bonusAwards.map((award) => <p key={award.bonusId}><span>{award.cognitionNames.join(' & ')} · {award.need}</span><b>+{award.pointsEach} each</b></p>)}
          {ledger.privateAwards.length === 0 && ledger.bonusAwards.length === 0 && <p><span>No individual gifts moved.</span></p>}
        </article>
        {ledger.bonusCreated.length > 0 && <article><h2>Bonus Needs arriving next round</h2>{ledger.bonusCreated.map((bonus) => <p key={bonus.id}><span>{bonus.need} · from {bonus.sourceStrategyTitle}</span><b><GiftIcon variation={1} />{bonus.gifts}</b></p>)}</article>}
      </div>
    </section>
  )
}

export function DesktopStoryTable({ game, onContinue, onNextSituation, onInspectStrategy }: Props) {
  const [step, setStep] = useState(0)
  const [humanStory, setHumanStory] = useState('')
  const finalStep = game.resolution.length + 1

  useEffect(() => {
    setStep(0)
    setHumanStory('')
  }, [game.situationNumber, game.round])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])

  const next = () => {
    if (step < finalStep) {
      setStep((current) => current + 1)
      return
    }
    if (game.phase === 'complete') onNextSituation()
    else onContinue()
  }

  const label = step === 0
    ? 'Hear the first story'
    : step <= game.resolution.length
      ? step === game.resolution.length ? 'See what changed' : 'Hear the next story'
      : game.phase === 'complete' ? 'Draw the next Situation' : 'Draw the next round'

  return (
    <dialog open className="desktop-story-dialog" aria-label="Story phase">
      <div className="desktop-story-shell">
        <header className="desktop-story-topbar">
          <div><span>Inner Work · Story Table</span><strong>{game.situation.title}</strong></div>
          <div className="desktop-story-progress" aria-label={`Story step ${Math.min(step + 1, finalStep + 1)} of ${finalStep + 1}`}>
            {Array.from({ length: finalStep + 1 }, (_, index) => <i key={index} className={index <= step ? 'active' : ''} />)}
          </div>
        </header>
        <main>
          {step === 0 && <RevealMoment game={game} />}
          {step > 0 && step <= game.resolution.length && (
            <StoryMoment
              game={game}
              line={game.resolution[step - 1]}
              index={step - 1}
              humanStory={humanStory}
              setHumanStory={setHumanStory}
              onInspectStrategy={onInspectStrategy}
            />
          )}
          {step === finalStep && <RoundSummary game={game} />}
        </main>
        <footer><button className="primary" onClick={next}>{label}</button></footer>
      </div>
    </dialog>
  )
}
