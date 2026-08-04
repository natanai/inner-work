import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { CardFace, GiftIcon } from './Cards'
import { encodeCommit, parseCommit } from './commitSelection'
import type { GameState } from './model'
import { SpecialChoiceSummary } from './SpecialChoiceSummary'
import {
  isSpecialAction,
  specialActionById,
  specialActionRequiresStrategy,
  specialActionSummary,
  specialActionTiming,
} from './specialActions'

type SpecialActionEvent = CustomEvent<{ cardId?: string }>

export function openSpecialAction(cardId: string): void {
  window.dispatchEvent(new CustomEvent('inner-work:configure-special', { detail: { cardId } }))
}

function positiveEffects(game: GameState, strategyId: string | null): Array<{ need: string; amount: number }> {
  if (!strategyId) return []
  const strategy = game.cognitions.flatMap((cognition) => cognition.hand).find((card) => card.id === strategyId && !isSpecialAction(card))
  if (!strategy) return []
  const eventActive = game.situation.event || game.cognitions.some((cognition) => parseCommit(cognition.selected).specialId === 'SA6')
  const source = eventActive ? [...strategy.effects, ...strategy.eventEffects] : strategy.effects
  const grouped = new Map<string, number>()
  source.forEach((effect) => {
    if (effect.amount > 0) grouped.set(effect.need, (grouped.get(effect.need) ?? 0) + effect.amount)
  })
  return [...grouped.entries()].map(([need, amount]) => ({ need, amount })).sort((a, b) => b.amount - a.amount)
}

export function SpecialActionLayer({ game, onGameChange }: { game: GameState; onGameChange: (game: GameState) => void }) {
  const [cardId, setCardId] = useState<string | null>(null)
  const [target, setTarget] = useState<string | null>(null)
  const player = game.cognitions.find((cognition) => cognition.human) ?? game.cognitions[0]
  const commit = parseCommit(player.selected)
  const special = cardId ? specialActionById(cardId) : null
  const pairedStrategy = player.hand.find((card) => card.id === commit.strategyId && !isSpecialAction(card)) ?? null
  const boostOptions = useMemo(() => positiveEffects(game, commit.strategyId), [game, commit.strategyId])
  const requiresStrategy = special ? specialActionRequiresStrategy(special) : false

  useEffect(() => {
    const open = (event: Event) => {
      const nextId = (event as SpecialActionEvent).detail?.cardId
      const card = player.hand.find((item) => item.id === nextId && isSpecialAction(item))
      if (!card || game.phase !== 'planning') return
      setCardId(card.id)
      setTarget(commit.specialId === card.id ? commit.target : null)
    }
    window.addEventListener('inner-work:configure-special', open)
    return () => window.removeEventListener('inner-work:configure-special', open)
  }, [game.phase, player.hand, player.selected])

  useEffect(() => {
    if (game.phase !== 'planning') setCardId(null)
  }, [game.phase])

  const close = () => {
    setCardId(null)
    setTarget(null)
  }

  const apply = () => {
    if (!special) return
    if (requiresStrategy && !pairedStrategy) return
    if (special.id === 'SA1' && !target) return
    if (special.id === 'SA7' && !target) return
    const selected = encodeCommit({ strategyId: commit.strategyId, specialId: special.id, target })
    onGameChange({
      ...game,
      cognitions: game.cognitions.map((cognition) => cognition.id === player.id ? { ...cognition, selected } : cognition),
    })
    close()
  }

  const remove = () => {
    onGameChange({
      ...game,
      cognitions: game.cognitions.map((cognition) => cognition.id === player.id
        ? { ...cognition, selected: encodeCommit({ strategyId: commit.strategyId, specialId: null, target: null }) }
        : cognition),
    })
    close()
  }

  const selectedAlready = Boolean(special && commit.specialId === special.id)
  const incomplete = Boolean(
    special
    && ((requiresStrategy && !pairedStrategy) || (special.id === 'SA1' && !target) || (special.id === 'SA7' && !target)),
  )

  return (
    <>
      <SpecialChoiceSummary game={game} />
      {special && createPortal(
        <dialog open className="special-action-dialog" onClick={close} aria-label={`Configure ${special.title}`}>
          <section onClick={(event) => event.stopPropagation()}>
            <header>
              <div><span>Special Action · {specialActionTiming(special)}</span><h1>{special.title}</h1></div>
              <button onClick={close} aria-label="Close Special Action">×</button>
            </header>
            <div className="special-action-layout">
              <div className="special-action-card"><CardFace kind="strategy" id={special.id} /></div>
              <div className="special-action-copy">
                <p>{specialActionSummary(special)}</p>
                <aside>
                  <b>How this commitment works</b>
                  <span>{requiresStrategy
                    ? 'Choose one ordinary Strategy first. This Special Action resolves before that Strategy and changes how the Strategy is checked.'
                    : 'This Special Action may be committed alone or alongside one ordinary Strategy. It resolves first; a paired Strategy is then checked for legality.'}</span>
                </aside>

                {requiresStrategy && !pairedStrategy && <p className="special-action-warning">Choose an ordinary Strategy from your hand first, then return to {special.title}.</p>}
                {requiresStrategy && pairedStrategy && <p className="special-paired-card">Paired with <strong>{pairedStrategy.title}</strong></p>}

                {special.id === 'SA1' && (
                  <fieldset>
                    <legend>Choose the unresolved Public Need to replace</legend>
                    <div className="special-target-grid">
                      {game.cognitions.flatMap((cognition) => cognition.publicNeeds.filter((slot) => slot.gifts > 0).map((slot) => {
                        const value = `${cognition.id}:${slot.card.id}`
                        return (
                          <button type="button" className={target === value ? `selected owner-${cognition.id}` : `owner-${cognition.id}`} key={value} onClick={() => setTarget(value)}>
                            <b>{cognition.id === 'alpha' ? 'α' : cognition.id === 'beta' ? 'β' : 'γ'}</b>
                            <span><small>{slot.card.feeling}</small><strong>{slot.card.need}</strong></span>
                            <em><GiftIcon variation={cognition.id === 'beta' ? 1 : cognition.id === 'gamma' ? 2 : 0} />{slot.gifts}</em>
                          </button>
                        )
                      }))}
                    </div>
                  </fieldset>
                )}

                {special.id === 'SA7' && (
                  <fieldset>
                    <legend>Choose the effect to boost by +3</legend>
                    <div className="special-boost-grid">
                      {boostOptions.map((effect) => <button type="button" className={target === effect.need ? 'selected' : ''} key={effect.need} onClick={() => setTarget(effect.need)}><strong>{effect.need}</strong><span>+{effect.amount} → +{effect.amount + 3}</span></button>)}
                    </div>
                  </fieldset>
                )}

                {(special.id === 'SA2' || special.id === 'SA3') && <p className="special-action-privacy">The app checks hidden Private Needs only during resolution. This screen never reveals or confirms which Strategies match them.</p>}
                {(special.id === 'SA4' || special.id === 'SA5') && <p className="special-action-timing">The new Bonus Need{special.id === 'SA4' ? 's are' : ' is'} placed before ordinary Strategies resolve, so matching Strategies may use them immediately.</p>}
                {special.id === 'SA6' && <p className="special-action-timing">Event effects activate on every ordinary Strategy played this round, even when the current Situation is not normally an Event.</p>}
              </div>
            </div>
            <footer>
              {selectedAlready && <button className="quiet" onClick={remove}>Remove Special Action</button>}
              <button className="primary" disabled={incomplete} onClick={apply}>
                {selectedAlready ? 'Update commitment' : 'Commit this Special Action'}
              </button>
            </footer>
          </section>
        </dialog>,
        document.body,
      )}
    </>
  )
}
