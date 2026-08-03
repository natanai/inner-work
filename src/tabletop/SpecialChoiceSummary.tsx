import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { distinctDirectedTradePaths } from './directedTrading'
import { canPlayCommitted, type Cognition, type GameState } from './model'
import { isSpecialAction, type SpecialActionCard } from './specialActions'

function useTradeRoomTarget(): HTMLElement | null {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  useEffect(() => {
    const refresh = () => setTarget(document.querySelector<HTMLElement>('.trade-room'))
    refresh()
    const observer = new MutationObserver(refresh)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])
  return target
}

function positiveEffects(card: Cognition['hand'][number], eventActive: boolean): number {
  if (isSpecialAction(card)) return 0
  const effects = eventActive ? [...card.effects, ...card.eventEffects] : card.effects
  return new Set(effects.filter((effect) => effect.amount > 0).map((effect) => effect.need)).size
}

function pathsForSpecial(game: GameState, player: Cognition, card: SpecialActionCard): number {
  const ordinary = player.hand.filter((item) => !isSpecialAction(item))
  switch (card.id) {
    case 'SA1': return game.cognitions.flatMap((cognition) => cognition.publicNeeds).filter((slot) => slot.gifts > 0).length
    case 'SA2':
    case 'SA3': return ordinary.length > 0 ? 1 : 0
    case 'SA4':
    case 'SA5': return 1
    case 'SA6': return ordinary.some((strategy) => strategy.eventEffects.length > 0) ? 1 : 0
    case 'SA7': return ordinary.reduce((total, strategy) => total + positiveEffects(strategy, game.situation.event), 0)
  }
}

export function specialActionPathCount(game: GameState, player: Cognition): number {
  return player.hand.filter(isSpecialAction).reduce((total, card) => total + pathsForSpecial(game, player, card), 0)
}

export function SpecialChoiceSummary({ game }: { game: GameState }) {
  const target = useTradeRoomTarget()
  const player = game.cognitions.find((cognition) => cognition.human) ?? game.cognitions[0]
  const legal = useMemo(() => player.hand.filter((card) => !isSpecialAction(card) && canPlayCommitted(game, player, card)).length, [game, player])
  const trades = useMemo(() => distinctDirectedTradePaths(game), [game])
  const specials = useMemo(() => specialActionPathCount(game, player), [game, player])
  const magnifier: number = player.magnifierUsed ? 0 : 4
  const discard = legal === 0 ? 1 : 0
  const total = legal + trades + specials + magnifier + discard

  if (!target || game.phase !== 'planning') return null
  return createPortal(
    <aside className="choice-path-summary special-choice-summary" aria-label={`${total} currently available planning paths`}>
      <div><span>Choice check</span><strong>{total} planning path{total === 1 ? '' : 's'} visible</strong></div>
      <p>
        <b>{legal}</b> playable card{legal === 1 ? '' : 's'}
        <b>{trades}</b> directed trade{trades === 1 ? '' : 's'}
        <b>{specials}</b> Special Action path{specials === 1 ? '' : 's'}
        <b>{magnifier}</b> Magnifier action{magnifier === 1 ? '' : 's'}
        {discard > 0 && <><b>1</b> required discard</>}
      </p>
    </aside>,
    target,
  )
}
