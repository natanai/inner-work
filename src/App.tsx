import { useMemo, useState } from 'react'
import {
  needs,
  situations,
  strategies,
  type NeedCard,
  type SituationCard,
  type StrategyCard,
} from './data/cards'

type Screen = 'home' | 'play' | 'day-end'
type Phase = 'planning' | 'resolved' | 'situation-complete'
type Controller = 'human' | 'npc'
type NpcStyle = 'cooperative' | 'self-protective'

type NeedSlot = {
  card: NeedCard
  boxes: number
}

type PlayerTemplate = {
  id: string
  name: string
  subtitle: string
  controller: Controller
  npcStyle?: NpcStyle
}

type Cognition = PlayerTemplate & {
  publicNeeds: NeedSlot[]
  privateNeed: NeedSlot
  privateVisible: boolean
  magnifyingUsed: boolean
  hand: StrategyCard[]
  selectedStrategyId: string | null
  score: number
}

type GameState = {
  parts: Cognition[]
  situation: SituationCard
  situationDeck: SituationCard[]
  needDeck: NeedCard[]
  strategyDeck: StrategyCard[]
  groupScore: number
  situationsCompleted: number
  round: number
  phase: Phase
  storyLog: string[]
  lastResolution: ResolutionLine[]
}

type ResolutionLine = {
  part: string
  strategy: string
  story: string
  groupPoints: number
  privatePoints: number
}

const PLAYER_TEMPLATES: PlayerTemplate[] = [
  {
    id: 'alpha',
    name: 'Cognition α',
    subtitle: 'You · choose strategies for this cognition.',
    controller: 'human',
  },
  {
    id: 'beta',
    name: 'Cognition β',
    subtitle: 'NPC · tends to favor broad shared benefit.',
    controller: 'npc',
    npcStyle: 'cooperative',
  },
  {
    id: 'gamma',
    name: 'Cognition γ',
    subtitle: 'NPC · tends to protect its own neglected needs.',
    controller: 'npc',
    npcStyle: 'self-protective',
  },
]

function shuffle<T>(input: T[]): T[] {
  const next = [...input]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
  }
  return next
}

function drawOne<T>(deck: T[], recycle: T[]): [T, T[]] {
  const source = deck.length > 0 ? deck : shuffle(recycle)
  const [card, ...rest] = source
  if (!card) throw new Error('Unable to draw a card from an empty deck.')
  return [card, rest]
}

function applySituationToParts(parts: Cognition[], situation: SituationCard): Cognition[] {
  return parts.map((part) => ({
    ...part,
    magnifyingUsed: false,
    privateVisible: false,
    publicNeeds: part.publicNeeds.map((slot) => {
      const situationEffect = situation.effects.find((effect) => effect.need === slot.card.need)?.amount ?? 0
      const baseBoxes = 1 + Math.max(0, situationEffect)
      const multiplied = slot.card.feeling === situation.feelingMultiplier ? baseBoxes * 2 : baseBoxes
      return { ...slot, boxes: multiplied }
    }),
  }))
}

function buildInitialGame(): GameState {
  let needDeck = shuffle(needs)
  let strategyDeck = shuffle(strategies)
  const situationDeck = shuffle(situations)
  const [situation, ...remainingSituations] = situationDeck

  const parts: Cognition[] = PLAYER_TEMPLATES.map((template) => {
    const partNeeds = needDeck.slice(0, 3)
    needDeck = needDeck.slice(3)
    const hand = strategyDeck.slice(0, 4)
    strategyDeck = strategyDeck.slice(4)

    return {
      ...template,
      privateNeed: { card: partNeeds[0], boxes: 1 },
      publicNeeds: partNeeds.slice(1).map((card) => ({ card, boxes: 1 })),
      privateVisible: false,
      magnifyingUsed: false,
      hand,
      selectedStrategyId: null,
      score: 0,
    }
  })

  return {
    parts: applySituationToParts(parts, situation),
    situation,
    situationDeck: remainingSituations,
    needDeck,
    strategyDeck,
    groupScore: 0,
    situationsCompleted: 0,
    round: 1,
    phase: 'planning',
    storyLog: [],
    lastResolution: [],
  }
}

function strategyCanBePlayed(part: Cognition, strategy: StrategyCard): boolean {
  return strategy.effects.some(
    (effect) => effect.amount > 0 && part.publicNeeds.some((slot) => slot.boxes > 0 && slot.card.need === effect.need),
  )
}

function scoreStrategyForNpc(part: Cognition, allParts: Cognition[], strategy: StrategyCard): number {
  if (!strategyCanBePlayed(part, strategy)) return Number.NEGATIVE_INFINITY

  let sharedBenefit = 0
  let ownPublicBenefit = 0
  let ownPrivateBenefit = 0
  let publicHarm = 0

  for (const effect of strategy.effects) {
    if (effect.amount > 0) {
      for (const target of allParts) {
        for (const slot of target.publicNeeds) {
          if (slot.card.need !== effect.need || slot.boxes === 0) continue
          // A Strategy applies its full value to every matching Need; its value is never divided.
          const tended = Math.min(slot.boxes, effect.amount)
          sharedBenefit += tended
          if (target.id === part.id) ownPublicBenefit += tended
        }
      }

      if (part.privateNeed.card.need === effect.need && part.privateNeed.boxes > 0) {
        ownPrivateBenefit += Math.min(part.privateNeed.boxes, effect.amount)
      }
    }

    if (effect.amount < 0) {
      for (const target of allParts) {
        for (const slot of target.publicNeeds) {
          if (slot.card.need === effect.need) publicHarm += Math.abs(effect.amount)
        }
      }
    }
  }

  const jitter = Math.random() * 0.25
  if (part.npcStyle === 'self-protective') {
    return ownPublicBenefit * 5 + ownPrivateBenefit * 4 + sharedBenefit * 1.5 - publicHarm * 6 + jitter
  }
  return sharedBenefit * 5 + ownPublicBenefit * 1.5 + ownPrivateBenefit * 2 - publicHarm * 6 + jitter
}

function chooseNpcStrategy(part: Cognition, allParts: Cognition[]): string | null {
  const ranked = part.hand
    .map((strategy) => ({ strategy, score: scoreStrategyForNpc(part, allParts, strategy) }))
    .filter((choice) => Number.isFinite(choice.score))
    .sort((a, b) => b.score - a.score)

  if (ranked[0]) return ranked[0].strategy.id

  // With no legal play, the NPC discards an imperfect card rather than using hidden information to cheat.
  return part.hand[Math.floor(Math.random() * part.hand.length)]?.id ?? null
}

function boxesLabel(count: number): string {
  if (count === 0) return 'tended'
  return `${count} gift ${count === 1 ? 'box' : 'boxes'}`
}

function generatedStory(situation: SituationCard, strategy: StrategyCard, part: Cognition): string {
  const tended = strategy.effects
    .filter((effect) => effect.amount > 0)
    .map((effect) => effect.need)
    .slice(0, 3)
  const needPhrase = tended.length > 0 ? tended.join(', ') : 'what was needed'
  return `${part.name} responded to “${situation.title}” by choosing “${strategy.title},” tending to ${needPhrase}.`
}

function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [game, setGame] = useState<GameState | null>(null)
  const [rulesOpen, setRulesOpen] = useState(false)

  const startGame = () => {
    setGame(buildInitialGame())
    setScreen('play')
  }

  if (screen === 'home' || !game) {
    return (
      <main className="home-shell">
        <section className="hero-panel">
          <div className="eyebrow">A cooperative game for one whole person</div>
          <h1>Inner Work</h1>
          <p className="hero-copy">
            Play as Cognition α alongside two locally simulated cognitions. Tend to visible needs, remember what is
            hidden, and discover whether the shared psyche can finish the day with something that matters to everyone.
          </p>
          <div className="hero-actions">
            <button className="primary-button" onClick={startGame}>Begin a day</button>
            <button className="secondary-button" onClick={() => setRulesOpen((open) => !open)}>
              {rulesOpen ? 'Hide overview' : 'How this version plays'}
            </button>
          </div>
          {rulesOpen && (
            <div className="overview-card">
              <h2>Solo with two NPC cognitions</h2>
              <p>
                You control Cognition α. Cognitions β and γ are simple rule-based NPCs with hidden hands and private
                needs. After you commit a Strategy, both NPCs make their choices and all three Strategies reveal together.
              </p>
              <p>
                Every Strategy applies its full value to every matching Need in play. Its strength is never divided
                between matching cards or players. Special Actions and deeper NPC negotiation will follow after the core
                resolution rules are verified.
              </p>
            </div>
          )}
          <div className="hero-orbit hero-orbit-one" aria-hidden="true" />
          <div className="hero-orbit hero-orbit-two" aria-hidden="true" />
        </section>
        <section className="principles-grid" aria-label="Game principles">
          <article><span>01</span><h2>Notice</h2><p>Feelings point toward needs that want attention.</p></article>
          <article><span>02</span><h2>Negotiate</h2><p>Three cognitions act separately on behalf of one shared psyche.</p></article>
          <article><span>03</span><h2>Integrate</h2><p>Shared well-being matters alongside private experience.</p></article>
        </section>
      </main>
    )
  }

  const humanPart = game.parts.find((part) => part.controller === 'human')
  const humanReady = Boolean(humanPart?.selectedStrategyId)
  const allPublicTended = game.parts.every((part) => part.publicNeeds.every((slot) => slot.boxes === 0))

  const selectStrategy = (partId: string, strategyId: string) => {
    if (game.phase !== 'planning') return
    setGame((current) => current && ({
      ...current,
      parts: current.parts.map((part) => part.id === partId && part.controller === 'human'
        ? { ...part, selectedStrategyId: strategyId }
        : part),
    }))
  }

  const revealPrivateNeed = (partId: string) => {
    if (game.phase !== 'planning') return
    setGame((current) => current && ({
      ...current,
      parts: current.parts.map((part) => part.id === partId && part.controller === 'human' && !part.magnifyingUsed
        ? { ...part, magnifyingUsed: true, privateVisible: true }
        : part),
    }))
  }

  const tradeStrategy = (fromPartId: string, strategyId: string, toPartId: string) => {
    if (game.phase !== 'planning' || fromPartId === toPartId) return
    setGame((current) => {
      if (!current) return current
      const from = current.parts.find((part) => part.id === fromPartId)
      const to = current.parts.find((part) => part.id === toPartId)
      const card = from?.hand.find((strategy) => strategy.id === strategyId)
      if (!from || from.controller !== 'human' || !to || !card || to.hand.length >= 6) return current

      return {
        ...current,
        parts: current.parts.map((part) => {
          if (part.id === fromPartId) {
            return {
              ...part,
              selectedStrategyId: part.selectedStrategyId === strategyId ? null : part.selectedStrategyId,
              hand: part.hand.filter((strategy) => strategy.id !== strategyId),
            }
          }
          if (part.id === toPartId) return { ...part, hand: [...part.hand, card] }
          return part
        }),
      }
    })
  }

  const resolveRound = () => {
    if (!humanReady || game.phase !== 'planning') return

    setGame((current) => {
      if (!current) return current

      const committedParts = current.parts.map((part) => part.controller === 'npc'
        ? { ...part, selectedStrategyId: chooseNpcStrategy(part, current.parts) }
        : part)

      let nextParts = committedParts.map((part) => ({
        ...part,
        publicNeeds: part.publicNeeds.map((slot) => ({ ...slot })),
        privateNeed: { ...part.privateNeed },
      }))
      let groupPointsEarned = 0
      const lines: ResolutionLine[] = []

      for (const actingPart of committedParts) {
        const strategy = actingPart.hand.find((card) => card.id === actingPart.selectedStrategyId)
        if (!strategy) continue
        let lineGroup = 0
        let linePrivate = 0

        const legalPlay = strategyCanBePlayed(actingPart, strategy)
        if (!legalPlay) {
          lines.push({
            part: actingPart.name,
            strategy: strategy.title,
            story: `${actingPart.name} could not connect “${strategy.title}” to one of its public needs, so the card was discarded.`,
            groupPoints: 0,
            privatePoints: 0,
          })
          continue
        }

        for (const effect of strategy.effects) {
          if (effect.amount > 0) {
            nextParts = nextParts.map((part) => {
              const publicNeeds = part.publicNeeds.map((slot) => {
                if (slot.card.need !== effect.need || slot.boxes === 0) return slot
                // The complete effect is independently applied to each matching Need.
                const removed = Math.min(slot.boxes, effect.amount)
                groupPointsEarned += removed
                lineGroup += removed
                return { ...slot, boxes: slot.boxes - removed }
              })

              let privateNeed = part.privateNeed
              let score = part.score
              if (privateNeed.card.need === effect.need && privateNeed.boxes > 0) {
                const removed = Math.min(privateNeed.boxes, effect.amount)
                privateNeed = { ...privateNeed, boxes: privateNeed.boxes - removed }
                score += removed
                linePrivate += removed
              }
              return { ...part, publicNeeds, privateNeed, score }
            })
          } else if (effect.amount < 0) {
            nextParts = nextParts.map((part) => ({
              ...part,
              publicNeeds: part.publicNeeds.map((slot) => slot.card.need === effect.need
                ? { ...slot, boxes: slot.boxes + Math.abs(effect.amount) }
                : slot),
            }))
          }
        }

        lines.push({
          part: actingPart.name,
          strategy: strategy.title,
          story: generatedStory(current.situation, strategy, actingPart),
          groupPoints: lineGroup,
          privatePoints: linePrivate,
        })
      }

      const completed = nextParts.every((part) => part.publicNeeds.every((slot) => slot.boxes === 0))
      return {
        ...current,
        parts: nextParts,
        groupScore: current.groupScore + groupPointsEarned,
        phase: completed ? 'situation-complete' : 'resolved',
        lastResolution: lines,
        storyLog: [...current.storyLog, ...lines.map((line) => line.story)],
      }
    })
  }

  const refillHands = (parts: Cognition[], currentDeck: StrategyCard[]): [Cognition[], StrategyCard[]] => {
    let deck = currentDeck
    const used = parts.flatMap((part) => part.hand.filter((card) => card.id === part.selectedStrategyId))
    const nextParts = parts.map((part) => {
      let hand = part.hand.filter((card) => card.id !== part.selectedStrategyId)
      while (hand.length < 4) {
        const [card, rest] = drawOne(deck, strategies.filter((candidate) => !used.some((item) => item.id === candidate.id)))
        hand = [...hand, card]
        deck = rest
      }
      return { ...part, hand, selectedStrategyId: null, privateVisible: false }
    })
    return [nextParts, deck]
  }

  const continueRound = () => {
    if (game.phase !== 'resolved') return
    setGame((current) => {
      if (!current) return current
      const [parts, strategyDeck] = refillHands(current.parts, current.strategyDeck)
      return { ...current, parts, strategyDeck, round: current.round + 1, phase: 'planning', lastResolution: [] }
    })
  }

  const nextSituation = () => {
    if (game.phase !== 'situation-complete') return
    setGame((current) => {
      if (!current) return current
      let needDeck = current.needDeck
      let situationDeck = current.situationDeck
      let nextSituationCard: SituationCard
      ;[nextSituationCard, situationDeck] = drawOne(situationDeck, situations.filter((card) => card.id !== current.situation.id))

      const refreshedParts = current.parts.map((part) => {
        const privateWasMet = part.privateNeed.boxes === 0
        let privateNeed = part.privateNeed
        const newPublicNeeds: NeedSlot[] = []

        if (privateWasMet) {
          let card: NeedCard
          ;[card, needDeck] = drawOne(needDeck, needs)
          privateNeed = { card, boxes: 1 }
        }
        while (newPublicNeeds.length < 2) {
          let card: NeedCard
          ;[card, needDeck] = drawOne(needDeck, needs)
          if (card.id !== privateNeed.card.id) newPublicNeeds.push({ card, boxes: 1 })
        }

        return {
          ...part,
          privateNeed,
          publicNeeds: newPublicNeeds,
          selectedStrategyId: null,
          privateVisible: false,
          magnifyingUsed: false,
        }
      })

      const [partsWithHands, strategyDeck] = refillHands(refreshedParts, current.strategyDeck)
      return {
        ...current,
        parts: applySituationToParts(partsWithHands, nextSituationCard),
        needDeck,
        strategyDeck,
        situation: nextSituationCard,
        situationDeck,
        situationsCompleted: current.situationsCompleted + 1,
        round: 1,
        phase: 'planning',
        lastResolution: [],
      }
    })
  }

  const endDay = () => setScreen('day-end')

  if (screen === 'day-end') {
    const scores = game.parts.map((part) => part.score)
    const lowest = Math.min(...scores)
    const highest = Math.max(...scores)
    const balance = highest === 0 ? 100 : Math.round((lowest / highest) * 100)
    return (
      <main className="end-shell">
        <section className="end-card">
          <div className="eyebrow">The day is complete</div>
          <h1>What did the whole psyche receive?</h1>
          <div className="end-score-grid">
            <article><strong>{game.groupScore}</strong><span>shared gift boxes</span></article>
            <article><strong>{game.situationsCompleted}</strong><span>situations completed</span></article>
            <article><strong>{balance}%</strong><span>cognitive balance</span></article>
          </div>
          <div className="part-results">
            {game.parts.map((part) => (
              <div key={part.id}><span>{part.name}</span><strong>{part.score} private points</strong></div>
            ))}
          </div>
          <p className="reflection-copy">
            A high shared score shows how much the visible system received. Cognitive balance asks a different question:
            did every cognition receive at least some care, or did one flourish while another disappeared?
          </p>
          <div className="hero-actions">
            <button className="primary-button" onClick={startGame}>Begin another day</button>
            <button className="secondary-button" onClick={() => setScreen('home')}>Return home</button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="game-shell">
      <header className="game-header">
        <div>
          <div className="eyebrow">Inner Work · Situation {game.situationsCompleted + 1}</div>
          <h1>{game.situation.title}</h1>
        </div>
        <div className="score-cluster">
          <div><span>Shared</span><strong>{game.groupScore}</strong></div>
          <div><span>Round</span><strong>{game.round}</strong></div>
          <button className="quiet-button" onClick={endDay}>End day</button>
        </div>
      </header>

      <section className="situation-panel">
        <div className="situation-symbol" aria-hidden="true">✦</div>
        <div>
          <h2>What this situation asks from the psyche</h2>
          <div className="effect-row">
            {game.situation.effects.map((effect) => (
              <span key={effect.need}>{effect.need} <b>+{effect.amount}</b></span>
            ))}
          </div>
          <p>
            Feeling multiplier: <strong>{game.situation.feelingMultiplier ?? 'None'} ×2</strong>
            {game.situation.event ? ' · Event effects may be triggered by a Special Action.' : ''}
          </p>
        </div>
      </section>

      {game.lastResolution.length > 0 && (
        <section className="resolution-panel" aria-live="polite">
          <div className="resolution-heading">
            <div><div className="eyebrow">Reveal</div><h2>The story this round created</h2></div>
            <span>{allPublicTended ? 'All public needs are tended.' : 'Some public needs still need care.'}</span>
          </div>
          <div className="resolution-list">
            {game.lastResolution.map((line) => (
              <article key={`${line.part}-${line.strategy}`}>
                <p>{line.story}</p>
                <span>+{line.groupPoints} shared · +{line.privatePoints} private</span>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="parts-grid">
        {game.parts.map((part) => (
          <article className="part-board" key={part.id}>
            <div className="part-heading">
              <div>
                <h2>{part.name}</h2>
                <p>{part.subtitle}</p>
              </div>
              <div className="private-score">{part.score}<span>private</span></div>
            </div>

            <div className="needs-row">
              {part.publicNeeds.map((slot) => (
                <NeedCardView key={slot.card.id} slot={slot} label="Public need" />
              ))}
              <div className={`need-card private-need ${part.privateVisible ? 'is-revealed' : ''}`}>
                {part.privateVisible ? (
                  <>
                    <span className="card-kicker">Private need</span>
                    <strong>{part.privateNeed.card.need}</strong>
                    <em>{part.privateNeed.card.feeling}</em>
                    <GiftBoxes count={part.privateNeed.boxes} />
                  </>
                ) : (
                  <>
                    <span className="private-mark">?</span>
                    <strong>Private need</strong>
                    <em>{part.privateNeed.boxes === 0 ? 'quietly tended' : 'hidden from other cognitions'}</em>
                  </>
                )}
              </div>
            </div>

            <div className="part-tools">
              {part.controller === 'human' ? (
                <button
                  className="tool-button"
                  disabled={part.magnifyingUsed || game.phase !== 'planning'}
                  onClick={() => revealPrivateNeed(part.id)}
                >
                  ◉ {part.magnifyingUsed ? 'Magnifying glass used' : 'Reveal private need'}
                </button>
              ) : (
                <span className="tool-button">◌ Rule-based NPC</span>
              )}
              <span>
                {part.controller === 'human'
                  ? (part.selectedStrategyId ? 'Strategy committed' : 'Choose one strategy')
                  : (game.phase === 'planning' ? 'Commits after Cognition α' : 'Strategy revealed')}
              </span>
            </div>

            <div className="hand-grid">
              {part.controller === 'human' ? part.hand.map((strategy) => {
                const legal = strategyCanBePlayed(part, strategy)
                const selected = part.selectedStrategyId === strategy.id
                return (
                  <div className="strategy-wrap" key={strategy.id}>
                    <button
                      className={`strategy-card ${selected ? 'is-selected' : ''} ${!legal ? 'is-unplayable' : ''}`}
                      disabled={game.phase !== 'planning'}
                      onClick={() => selectStrategy(part.id, strategy.id)}
                      aria-pressed={selected}
                    >
                      <span className="card-kicker">{strategy.id}</span>
                      <strong>{strategy.title}</strong>
                      <div className="strategy-effects">
                        {strategy.effects.map((effect) => (
                          <span key={`${strategy.id}-${effect.need}`} className={effect.amount < 0 ? 'negative' : ''}>
                            {effect.need} {effect.amount > 0 ? `+${effect.amount}` : effect.amount}
                          </span>
                        ))}
                      </div>
                      <small>{legal ? 'Full value applies to every matching Need' : 'Select to discard, or offer it to an NPC'}</small>
                    </button>
                    {game.phase === 'planning' && (
                      <div className="trade-row">
                        {game.parts.filter((target) => target.controller === 'npc').map((target) => (
                          <button key={target.id} onClick={() => tradeStrategy(part.id, strategy.id, target.id)}>
                            Offer to {target.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              }) : part.hand.map((strategy, index) => {
                const revealed = game.phase !== 'planning' && part.selectedStrategyId === strategy.id
                return (
                  <div className="strategy-wrap" key={strategy.id}>
                    <div className={`strategy-card ${revealed ? 'is-selected' : ''}`}>
                      <span className="card-kicker">{revealed ? strategy.id : `Hidden strategy ${index + 1}`}</span>
                      <strong>{revealed ? strategy.title : 'Face down'}</strong>
                      {revealed ? (
                        <div className="strategy-effects">
                          {strategy.effects.map((effect) => (
                            <span key={`${strategy.id}-${effect.need}`} className={effect.amount < 0 ? 'negative' : ''}>
                              {effect.need} {effect.amount > 0 ? `+${effect.amount}` : effect.amount}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <small>Its contents remain private until the simultaneous reveal.</small>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </article>
        ))}
      </section>

      <footer className="action-dock">
        <div>
          <strong>
            {game.phase === 'planning'
              ? (humanReady ? 'Cognition α is ready' : 'Cognition α needs a Strategy')
              : 'Round resolved'}
          </strong>
          <span>
            {game.phase === 'planning' && 'NPC choices are made only after you commit; all three reveal together.'}
            {game.phase === 'resolved' && 'Refill hands and continue tending this situation.'}
            {game.phase === 'situation-complete' && 'The whole psyche can move into a new situation.'}
          </span>
        </div>
        {game.phase === 'planning' && (
          <button className="primary-button" disabled={!humanReady} onClick={resolveRound}>
            Commit α and reveal
          </button>
        )}
        {game.phase === 'resolved' && (
          <button className="primary-button" onClick={continueRound}>Continue this situation</button>
        )}
        {game.phase === 'situation-complete' && (
          <button className="primary-button" onClick={nextSituation}>Draw the next situation</button>
        )}
      </footer>
    </main>
  )
}

function NeedCardView({ slot, label }: { slot: NeedSlot; label: string }) {
  return (
    <div className={`need-card ${slot.boxes === 0 ? 'is-tended' : ''}`}>
      <span className="card-kicker">{label}</span>
      <strong>{slot.card.need}</strong>
      <em>{slot.card.feeling}</em>
      <GiftBoxes count={slot.boxes} />
    </div>
  )
}

function GiftBoxes({ count }: { count: number }) {
  const boxes = useMemo(() => Array.from({ length: Math.min(count, 8) }, (_, index) => index), [count])
  return (
    <div className="gift-boxes" aria-label={boxesLabel(count)}>
      {count === 0 ? <span className="tended-mark">✓ tended</span> : boxes.map((box) => <span key={box}>◆</span>)}
      {count > 8 && <b>+{count - 8}</b>}
    </div>
  )
}

export default App
