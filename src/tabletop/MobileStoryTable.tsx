import { useEffect, useState, type CSSProperties } from 'react'
import { CardFace, GiftIcon, strategyText } from './Cards'
import type { GameState, Resolution } from './model'

type Props = {
  game: GameState
  onContinue: () => void
  onNextSituation: () => void
}

type Inspection = {
  id: string
  title: string
}

function MatchSummary({ line }: { line: Resolution }) {
  const empty = line.publicMatches.length === 0
    && line.privateMatches.length === 0
    && line.bonusMatches.length === 0
    && line.bonusCreated.length === 0

  return (
    <section className="mobile-story-effects" aria-label="Needs affected by this Strategy">
      {line.publicMatches.length > 0 && (
        <p><span>Public Needs tended</span><strong>{line.publicMatches.join(' · ')}</strong></p>
      )}
      {line.privateMatches.length > 0 && (
        <p><span>Private effects</span><strong>{line.privateMatches.length} hidden Need{line.privateMatches.length === 1 ? '' : 's'} also tended</strong></p>
      )}
      {line.bonusMatches.length > 0 && (
        <p><span>Bonus Needs tended</span><strong>{line.bonusMatches.join(' · ')}</strong></p>
      )}
      {line.bonusCreated.length > 0 && (
        <p className="created">
          <span>Introduced by this action</span>
          <strong>{line.bonusCreated.map((bonus) => `${bonus.need} · ${bonus.gifts} gift${bonus.gifts === 1 ? '' : 's'} next round`).join(' · ')}</strong>
        </p>
      )}
      {empty && <p><span>Result</span><strong>This Strategy is discarded.</strong></p>}
    </section>
  )
}

function RevealMoment({ game, onInspect }: { game: GameState; onInspect: (inspection: Inspection) => void }) {
  return (
    <section className="mobile-story-reveal">
      <div className="mobile-story-situation-ribbon">
        <span>Current Situation</span>
        <strong>{game.situation.title}</strong>
      </div>
      <header>
        <span>Simultaneous reveal</span>
        <h1>Three parts influenced one shared person.</h1>
        <p>The Strategies turn over together. The table now slows down so each Cognition can explain what it brought forward, what the person did, and what that action tended across the whole psyche.</p>
      </header>
      <div className="mobile-story-reveal-cards">
        {game.resolution.map((line, index) => (
          <button
            key={line.cognitionId}
            style={{ '--mobile-story-order': index } as CSSProperties}
            onClick={() => onInspect({ id: line.strategy.id, title: line.strategy.title })}
            aria-label={`Inspect ${line.strategy.title}, chosen by ${line.cognitionName}`}
          >
            <CardFace kind="strategy" id={line.strategy.id} />
            <strong>{line.cognitionName}</strong>
          </button>
        ))}
      </div>
      <p className="mobile-story-pause">The gifts have not moved yet. First, hear what each shared action means.</p>
    </section>
  )
}

function StoryMoment({
  game,
  line,
  index,
  humanStory,
  setHumanStory,
  onInspect,
}: {
  game: GameState
  line: Resolution
  index: number
  humanStory: string
  setHumanStory: (value: string) => void
  onInspect: (inspection: Inspection) => void
}) {
  const human = line.cognitionId === 'alpha'
  const [showExample, setShowExample] = useState(false)
  const introduced = line.bonusCreated.map((bonus) => bonus.need)

  return (
    <section className="mobile-story-turn">
      <header>
        <span>Story {index + 1} of {game.resolution.length} · {line.cognitionName}</span>
        <h1>{line.cognitionName} influenced one shared action.</h1>
      </header>

      <div className="mobile-story-card-stage">
        <div className="mobile-story-situation-card" aria-hidden="true">
          <CardFace kind="situation" id={game.situation.id} />
        </div>
        <button
          className="mobile-story-played-card"
          onClick={() => onInspect({ id: line.strategy.id, title: line.strategy.title })}
          aria-label={`Inspect ${line.strategy.title}`}
        >
          <CardFace kind="strategy" id={line.strategy.id} />
        </button>
      </div>

      <div className="mobile-story-context-line">
        <span>During</span><strong>{game.situation.title}</strong>
        <span>the person chose to</span><strong>{line.strategy.title}</strong>
      </div>

      {human ? (
        <section className="mobile-story-writing">
          <p className="mobile-story-principle">The Cognition supplies the motivation. The one shared person performs the Strategy.</p>
          <div className="mobile-story-cues">
            <p><b>1</b><span><strong>Motivation</strong>What Need did {line.cognitionName} bring forward?</span></p>
            <p><b>2</b><span><strong>Shared action</strong>What did the person actually say, do, notice, request, or change?</span></p>
            <p><b>3</b><span><strong>Wider effect</strong>What else did the action tend{introduced.length ? `, and how did it introduce ${introduced.join(' and ')} as a Bonus Need` : ''}?</span></p>
          </div>
          <label htmlFor="mobile-dedicated-story">Tell the shared-person story in your own words.</label>
          <textarea
            id="mobile-dedicated-story"
            value={humanStory}
            onChange={(event) => setHumanStory(event.target.value)}
            placeholder={`${line.cognitionName} brought forward… The person chose to… It also…`}
          />
          <button className="quiet mobile-story-example-toggle" onClick={() => setShowExample((visible) => !visible)}>
            {showExample ? 'Hide example' : 'See an example'}
          </button>
          {showExample && (
            <aside className="mobile-story-example">
              <span>Generated from this play</span>
              <p>{line.story}</p>
              <button className="quiet" onClick={() => setHumanStory(line.story)}>Use as a starting point</button>
            </aside>
          )}
        </section>
      ) : (
        <blockquote className="mobile-story-npc-story">{line.story}</blockquote>
      )}

      <p className="mobile-story-card-text">{strategyText(line.strategy)}</p>
      <MatchSummary line={line} />
    </section>
  )
}

function RoundSummary({ game }: { game: GameState }) {
  const ledger = game.roundLedger
  if (!ledger) return null
  const changed = ledger.publicChanges.filter((change) => change.removed > 0)

  return (
    <section className="mobile-story-summary">
      <header>
        <span>Round summary</span>
        <h1>Now the gifts move.</h1>
        <p>Only after all three stories are heard do the card effects resolve visibly.</p>
      </header>

      <div className="mobile-story-bank">
        <GiftIcon variation={0} />
        <b>+{ledger.publicRemoved}</b>
        <span>shared gifts</span>
      </div>

      <div className="mobile-story-summary-list">
        <section>
          <h2>Public Needs tended</h2>
          {changed.length > 0
            ? changed.map((change) => (
              <p key={change.key}>
                <span>{change.cognitionName} · {change.need}</span>
                <b>{change.before} → {change.after}</b>
              </p>
            ))
            : <p><span>No Public gifts moved.</span></p>}
        </section>

        <section>
          <h2>Individual points</h2>
          {ledger.privateAwards.map((award) => (
            <p key={`${award.cognitionId}-${award.need}`}><span>{award.cognitionName} · Private</span><b>+{award.points}</b></p>
          ))}
          {ledger.bonusAwards.map((award) => (
            <p key={award.bonusId}><span>{award.cognitionNames.join(' & ')} · {award.need}</span><b>+{award.pointsEach} each</b></p>
          ))}
          {ledger.privateAwards.length === 0 && ledger.bonusAwards.length === 0 && <p><span>No individual gifts moved.</span></p>}
        </section>

        {ledger.bonusCreated.length > 0 && (
          <section className="created">
            <h2>Bonus Needs entering next round</h2>
            {ledger.bonusCreated.map((bonus) => (
              <p key={bonus.id}>
                <span>{bonus.need} · introduced when {bonus.sourceCognitionName} brought forward “{bonus.sourceStrategyTitle}”</span>
                <b><GiftIcon variation={1} />{bonus.gifts}</b>
              </p>
            ))}
          </section>
        )}
      </div>
    </section>
  )
}

export function MobileStoryTable({ game, onContinue, onNextSituation }: Props) {
  const [step, setStep] = useState(0)
  const [humanStory, setHumanStory] = useState('')
  const [inspection, setInspection] = useState<Inspection | null>(null)
  const finalStep = game.resolution.length + 1

  useEffect(() => {
    setStep(0)
    setHumanStory('')
    setInspection(null)
  }, [game.situationNumber, game.round])

  useEffect(() => {
    const bodyOverflow = document.body.style.overflow
    const rootOverflow = document.documentElement.style.overflow
    const bodyOverscroll = document.body.style.overscrollBehavior
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'none'
    document.body.classList.add('mobile-story-table-open')
    return () => {
      document.body.style.overflow = bodyOverflow
      document.documentElement.style.overflow = rootOverflow
      document.body.style.overscrollBehavior = bodyOverscroll
      document.body.classList.remove('mobile-story-table-open')
    }
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
    <dialog open className="mobile-story-table" aria-label="Inner Work Story Table">
      <div className="mobile-story-shell">
        <header className="mobile-story-topbar">
          <div><span>Inner Work · Story Table</span><strong>{game.situation.title}</strong></div>
          <div className="mobile-story-progress" aria-label={`Story step ${Math.min(step + 1, finalStep + 1)} of ${finalStep + 1}`}>
            {Array.from({ length: finalStep + 1 }, (_, index) => <i key={index} className={index <= step ? 'active' : ''} />)}
          </div>
        </header>

        <main>
          {step === 0 && <RevealMoment game={game} onInspect={setInspection} />}
          {step > 0 && step <= game.resolution.length && (
            <StoryMoment
              key={game.resolution[step - 1].cognitionId}
              game={game}
              line={game.resolution[step - 1]}
              index={step - 1}
              humanStory={humanStory}
              setHumanStory={setHumanStory}
              onInspect={setInspection}
            />
          )}
          {step === finalStep && <RoundSummary game={game} />}
        </main>

        <footer>
          <button className="primary" onClick={next}>{label}</button>
        </footer>
      </div>

      {inspection && (
        <dialog open className="mobile-story-inspector" aria-label={inspection.title}>
          <div>
            <button onClick={() => setInspection(null)} aria-label="Close enlarged Strategy">×</button>
            <CardFace kind="strategy" id={inspection.id} />
            <strong>{inspection.title}</strong>
          </div>
        </dialog>
      )}
    </dialog>
  )
}
