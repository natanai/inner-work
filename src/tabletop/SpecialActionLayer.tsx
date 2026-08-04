import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { CardFace, GiftIcon } from './Cards'
import { encodeCommit, parseCommit } from './commitSelection'
import type { GameState } from './model'
import { SpecialChoiceSummary } from './SpecialChoiceSummary'
import {
  isSpecialAction,
  specialActionById,
  specialActionSummary,
  specialActionTiming,
} from './specialActions'
import {
  applyDiscussionSpecialAction,
  cognitionUsedSpecialAction,
  discussionActions,
  ordinaryEffects,
  prepareNpcDiscussionActions,
} from './timedSpecialActions'

type SpecialActionEvent = CustomEvent<{ cardId?: string }>

export function openSpecialAction(cardId: string): void {
  window.dispatchEvent(new CustomEvent('inner-work:configure-special', { detail: { cardId } }))
}

function usePlanningStatusTarget(): HTMLElement | null {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  useEffect(() => {
    const refresh = () => setTarget(document.querySelector<HTMLElement>('.desktop-planning-tools-target, .mobile-hand-section, .trade-room'))
    refresh()
    const observer = new MutationObserver(refresh)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])
  return target
}

function DiscussionActionStatus({ game }: { game: GameState }) {
  const target = usePlanningStatusTarget()
  const active = discussionActions(game)
  if (!target || game.phase !== 'planning' || active.length === 0) return null
  return createPortal(
    <aside className="discussion-actions-live" aria-label="Discussion Actions active this round">
      <span>Already active from Discussion</span>
      <div>{active.map((use) => <p key={`${use.cognitionId}:${use.card.id}`}><b>{use.card.title}</b><small>{use.target ?? use.summary}</small></p>)}</div>
    </aside>,
    target,
  )
}

export function SpecialActionLayer({ game, onGameChange }: { game: GameState; onGameChange: (game: GameState) => void }) {
  const [cardId, setCardId] = useState<string | null>(null)
  const [target, setTarget] = useState<string | null>(null)
  const [strategyId, setStrategyId] = useState<string | null>(null)
  const player = game.cognitions.find((cognition) => cognition.human) ?? game.cognitions[0]
  const commit = parseCommit(player.selected)
  const special = cardId ? specialActionById(cardId) : null
  const timing = special ? specialActionTiming(special) : null
  const discussion = timing === 'Discussion Phase'
  const ordinaryStrategies = player.hand.filter((card) => !isSpecialAction(card))
  const pairedStrategy = ordinaryStrategies.find((card) => card.id === strategyId) ?? null
  const boostOptions = useMemo(() => pairedStrategy
    ? ordinaryEffects(game, pairedStrategy).filter((effect) => effect.amount > 0)
      .reduce<Array<{ need: string; amount: number }>>((items, effect) => {
        const existing = items.find((item) => item.need === effect.need)
        if (existing) existing.amount += effect.amount
        else items.push({ need: effect.need, amount: effect.amount })
        return items
      }, [])
      .sort((left, right) => right.amount - left.amount)
    : [], [game, pairedStrategy])
  const usedAnotherSpecial = cognitionUsedSpecialAction(game, player.id) && commit.specialId !== special?.id

  useEffect(() => {
    if (game.phase !== 'planning') return
    const prepared = prepareNpcDiscussionActions(game)
    if (prepared !== game) onGameChange(prepared)
  }, [game, onGameChange])

  useEffect(() => {
    const open = (event: Event) => {
      const nextId = (event as SpecialActionEvent).detail?.cardId
      const card = player.hand.find((item) => item.id === nextId && isSpecialAction(item))
      if (!card || game.phase !== 'planning') return
      const current = parseCommit(player.selected)
      setCardId(card.id)
      setStrategyId(current.specialId === card.id ? current.strategyId : current.strategyId)
      setTarget(current.specialId === card.id ? current.target : null)
    }
    window.addEventListener('inner-work:configure-special', open)
    return () => window.removeEventListener('inner-work:configure-special', open)
  }, [game.phase, player.hand, player.selected])

  useEffect(() => {
    if (game.phase !== 'planning') setCardId(null)
  }, [game.phase])

  useEffect(() => {
    if (special?.id === 'SA7' && target && !boostOptions.some((effect) => effect.need === target)) setTarget(null)
  }, [special?.id, target, boostOptions])

  const close = () => {
    setCardId(null)
    setTarget(null)
    setStrategyId(null)
  }

  const apply = () => {
    if (!special) return
    if (discussion) {
      if (special.id === 'SA1' && !target) return
      const next = applyDiscussionSpecialAction(game, player.id, special.id, target)
      if (next !== game) onGameChange(next)
      close()
      return
    }

    if (!strategyId || usedAnotherSpecial) return
    if (special.id === 'SA7' && !target) return
    const selected = encodeCommit({
      strategyId,
      specialId: special.id,
      target: special.id === 'SA7' ? target : null,
      playForPrivate: special.id === 'SA2',
    })
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
        ? { ...cognition, selected: encodeCommit({ strategyId: commit.strategyId, specialId: null, target: null, playForPrivate: false }) }
        : cognition),
    })
    close()
  }

  const selectedAlready = Boolean(special && !discussion && commit.specialId === special.id)
  const incomplete = Boolean(
    special
    && (usedAnotherSpecial
      || (discussion && special.id === 'SA1' && !target)
      || (!discussion && !strategyId)
      || (special.id === 'SA7' && !target)),
  )

  return (
    <>
      <SpecialChoiceSummary game={game} />
      <DiscussionActionStatus game={game} />
      {special && createPortal(
        <dialog open className="special-action-dialog" onClick={close} aria-label={`Configure ${special.title}`}>
          <section onClick={(event) => event.stopPropagation()}>
            <header>
              <div><span>Special Action · {timing}</span><h1>{special.title}</h1></div>
              <button onClick={close} aria-label="Close Special Action">×</button>
            </header>
            <div className="special-action-layout">
              <div className="special-action-card"><CardFace kind="strategy" id={special.id} /></div>
              <div className="special-action-copy">
                <p>{specialActionSummary(special)}</p>
                <aside>
                  <b>{discussion ? 'This changes the table now' : 'This is a conditional commitment'}</b>
                  <span>{discussion
                    ? 'Use this card openly during Discussion. It leaves your hand immediately, and its result is available before anyone finishes choosing or trading.'
                    : 'Choose the ordinary Strategy inside this screen. The pair remains hidden until simultaneous reveal, and the Special Action is checked before the Strategy can resolve.'}</span>
                </aside>

                {usedAnotherSpecial && <p className="special-action-warning">This Cognition has already used a Special Action this round. Each Cognition may use at most one Special Action before the hand refills.</p>}

                {discussion && special.id === 'SA1' && (
                  <fieldset>
                    <legend>Choose the unresolved Public Need to replace now</legend>
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

                {!discussion && (
                  <fieldset>
                    <legend>{special.id === 'SA2' ? 'Assign one Strategy specifically to your Private Need' : 'Choose the Strategy to receive the boost'}</legend>
                    <div className="special-strategy-grid">
                      {ordinaryStrategies.map((strategy) => <button type="button" className={strategyId === strategy.id ? 'selected' : ''} key={strategy.id} onClick={() => { setStrategyId(strategy.id); setTarget(null) }}><strong>{strategy.title}</strong><small>{special.id === 'SA2' ? 'Private match checked only at reveal' : 'Choose one positive effect next'}</small></button>)}
                    </div>
                  </fieldset>
                )}

                {special.id === 'SA7' && pairedStrategy && (
                  <fieldset>
                    <legend>Choose the effect to boost by +3</legend>
                    <div className="special-boost-grid">
                      {boostOptions.map((effect) => <button type="button" className={target === effect.need ? 'selected' : ''} key={effect.need} onClick={() => setTarget(effect.need)}><strong>{effect.need}</strong><span>+{effect.amount} → +{effect.amount + 3}</span></button>)}
                    </div>
                  </fieldset>
                )}

                {special.id === 'SA2' && <p className="special-action-privacy">This screen deliberately does not confirm whether the selected Strategy tends your face-down Private Need. At reveal, a mismatch discards Deep Introspection and the Strategy, applies none of the Strategy’s effects, and leaves the unmet Private Need in play.</p>}
                {special.id === 'SA3' && <p className="special-action-timing">Once used, every Cognition gains a separate “Assign to Private Need” option for ordinary Strategies during this Discussion.</p>}
                {(special.id === 'SA4' || special.id === 'SA5') && <p className="special-action-timing">The new Bonus Need{special.id === 'SA4' ? 's appear' : ' appears'} immediately on the table and may qualify Strategies in this same round.</p>}
                {special.id === 'SA6' && <p className="special-action-timing">Event effects become visible in Strategy previews, legality, and trading as soon as this card is used.</p>}
              </div>
            </div>
            <footer>
              {selectedAlready && <button className="quiet" onClick={remove}>Remove Start-of-Play Action</button>}
              <button className="primary" disabled={incomplete} onClick={apply}>
                {discussion ? 'Use now during Discussion' : selectedAlready ? 'Update hidden commitment' : 'Commit this pair'}
              </button>
            </footer>
          </section>
        </dialog>,
        document.body,
      )}
    </>
  )
}
