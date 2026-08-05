import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import type { StrategyCard } from '../data/cards'
import { CardFace, strategyText } from './Cards'
import { cardIsCommitted, parseCommit, setOrdinaryCommit, setPrivateOrdinaryCommit } from './commitSelection'
import type { GameState } from './model'
import { openSpecialAction } from './SpecialActionLayer'
import { isSpecialAction } from './specialActions'
import { StrategyContributionDetails, StrategyQuickSummary } from './StrategyContributionDetails'
import { canPlayVisible, groupPrivatePlayActive } from './timedSpecialActions'

type GestureAxis = 'pending' | 'horizontal' | 'vertical'
type HandMode = 'docked' | 'undocked'

const HAND_MODE_KEY = 'inner-work:strategy-hand-mode'

function wrap(index: number, total: number): number {
  if (total === 0) return 0
  return (index + total) % total
}

function readHandMode(): HandMode {
  try { return window.localStorage.getItem(HAND_MODE_KEY) === 'undocked' ? 'undocked' : 'docked' } catch { return 'docked' }
}

function usePlayTabActive(): boolean {
  const [active, setActive] = useState(false)
  useEffect(() => {
    const refresh = () => setActive(Boolean(document.querySelector('.mobile-play-page.mobile-tab-play')))
    refresh()
    const observer = new MutationObserver(refresh)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])
  return active
}

function useHandTarget(): HTMLElement | null {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  useEffect(() => {
    const refresh = () => setTarget(document.querySelector<HTMLElement>('.mobile-hand-section'))
    refresh()
    const observer = new MutationObserver(refresh)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])
  return target
}

export function StickyStrategyHand({ game, onGameChange }: { game: GameState; onGameChange: (game: GameState) => void }) {
  const player = game.cognitions.find((cognition) => cognition.human) ?? game.cognitions[0]
  const cards = player.hand
  const playActive = usePlayTabActive()
  const handTarget = useHandTarget()
  const selectedIndex = Math.max(0, cards.findIndex((card) => cardIsCommitted(player, card.id)))
  const [frontIndex, setFrontIndex] = useState(selectedIndex)
  const [inspectedIndex, setInspectedIndex] = useState<number | null>(null)
  const [handMode, setHandMode] = useState<HandMode>(readHandMode)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const gestureAxis = useRef<GestureAxis>('pending')
  const suppressClick = useRef(false)
  const inspectorPointerStart = useRef<{ x: number; y: number } | null>(null)
  const inspectorGestureAxis = useRef<GestureAxis>('pending')
  const handKey = cards.map((card) => card.id).join('|')
  const inspected = inspectedIndex === null ? null : cards[wrap(inspectedIndex, cards.length)] ?? null
  const privateRouteOpen = groupPrivatePlayActive(game)
  const commit = parseCommit(player.selected)

  useLayoutEffect(() => {
    document.documentElement.dataset.strategyHand = handMode
    try { window.localStorage.setItem(HAND_MODE_KEY, handMode) } catch { /* session-only preference */ }
  }, [handMode])

  useEffect(() => {
    setFrontIndex(selectedIndex)
    setInspectedIndex(null)
  }, [handKey, selectedIndex])

  useEffect(() => { if (handMode === 'undocked') setInspectedIndex(null) }, [handMode])

  const available = playActive && game.phase === 'planning' && cards.length > 0
  if (!available) return null

  const cycle = (direction: -1 | 1) => setFrontIndex((index) => wrap(index + direction, cards.length))
  const cycleInspector = (direction: -1 | 1) => setInspectedIndex((index) => {
    const next = wrap((index ?? frontIndex) + direction, cards.length)
    setFrontIndex(next)
    return next
  })

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointerStart.current = { x: event.clientX, y: event.clientY }
    gestureAxis.current = 'pending'
    suppressClick.current = false
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current
    if (!start) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (gestureAxis.current === 'pending' && Math.max(Math.abs(dx), Math.abs(dy)) > 10) {
      if (Math.abs(dx) > Math.abs(dy) * 1.3) {
        gestureAxis.current = 'horizontal'
        suppressClick.current = true
        event.currentTarget.setPointerCapture?.(event.pointerId)
      } else if (Math.abs(dy) > Math.abs(dx) * 1.15) gestureAxis.current = 'vertical'
    }
    if (gestureAxis.current === 'horizontal') event.preventDefault()
  }
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current
    if (!start) return
    const dx = event.clientX - start.x
    if (gestureAxis.current === 'horizontal' && Math.abs(dx) > 42) cycle(dx < 0 ? 1 : -1)
    pointerStart.current = null
    gestureAxis.current = 'pending'
    window.setTimeout(() => { suppressClick.current = false }, 0)
  }

  const onInspectorPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    inspectorPointerStart.current = { x: event.clientX, y: event.clientY }
    inspectorGestureAxis.current = 'pending'
  }
  const onInspectorPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = inspectorPointerStart.current
    if (!start) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (inspectorGestureAxis.current === 'pending' && Math.max(Math.abs(dx), Math.abs(dy)) > 10) {
      if (Math.abs(dx) > Math.abs(dy) * 1.25) {
        inspectorGestureAxis.current = 'horizontal'
        event.currentTarget.setPointerCapture?.(event.pointerId)
      } else if (Math.abs(dy) > Math.abs(dx) * 1.15) inspectorGestureAxis.current = 'vertical'
    }
    if (inspectorGestureAxis.current === 'horizontal') event.preventDefault()
  }
  const onInspectorPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = inspectorPointerStart.current
    if (!start) return
    const dx = event.clientX - start.x
    if (inspectorGestureAxis.current === 'horizontal' && Math.abs(dx) > 44) cycleInspector(dx < 0 ? 1 : -1)
    inspectorPointerStart.current = null
    inspectorGestureAxis.current = 'pending'
  }

  const choose = (card: StrategyCard) => {
    if (isSpecialAction(card)) {
      openSpecialAction(card.id)
      return
    }
    const current = parseCommit(player.selected)
    const nextOrdinary = current.strategyId === card.id && !current.playForPrivate ? null : card.id
    onGameChange({
      ...game,
      cognitions: game.cognitions.map((cognition) => cognition.id === player.id
        ? { ...cognition, selected: setOrdinaryCommit(cognition.selected, nextOrdinary) }
        : cognition),
    })
  }

  const choosePrivate = (card: StrategyCard) => {
    if (isSpecialAction(card) || !privateRouteOpen) return
    const current = parseCommit(player.selected)
    const nextOrdinary = current.strategyId === card.id && current.playForPrivate ? null : card.id
    onGameChange({
      ...game,
      cognitions: game.cognitions.map((cognition) => cognition.id === player.id
        ? { ...cognition, selected: setPrivateOrdinaryCommit(cognition.selected, nextOrdinary) }
        : cognition),
    })
  }

  const offsets = [0, -48, 48, -86, 86]
  const preference = handTarget ? createPortal(
    <section className={`hand-dock-preference ${handMode}`} aria-label="Strategy hand display preference">
      <div><span>Strategy hand</span><strong>{handMode === 'docked' ? 'Docked behind the menu' : 'Shown in the page'}</strong></div>
      <button onClick={() => setHandMode(handMode === 'docked' ? 'undocked' : 'docked')}>{handMode === 'docked' ? 'Undock' : 'Dock to bottom'}</button>
    </section>, handTarget,
  ) : null

  const inlineHand = handTarget && handMode === 'undocked' ? createPortal(
    <div className="phase-aware-inline-hand" aria-label="Your phase-aware Strategy hand">
      {cards.map((card, index) => {
        const special = isSpecialAction(card)
        const selected = cardIsCommitted(player, card.id)
        const privateSelected = !special && commit.strategyId === card.id && commit.playForPrivate
        const legal = special || canPlayVisible(game, player, card)
        return <button className={`${selected ? 'selected' : ''} ${privateSelected ? 'private-targeted' : ''}`} key={card.id} onClick={() => setInspectedIndex(index)} aria-label={`Inspect ${card.title}`}><CardFace kind="strategy" id={card.id} /><span><small>{special ? 'Special Action' : privateSelected ? 'Assigned to Private Need' : legal ? 'Visible legal route' : 'No visible match'}</small><strong>{card.title}</strong>{selected && <b>{special ? 'Prepared' : privateSelected ? 'Private target' : 'Chosen'}</b>}</span></button>
      })}
    </div>, handTarget,
  ) : null

  return (
    <>
      {preference}
      {inlineHand}
      {handMode === 'docked' && (
        <aside className="sticky-strategy-hand" aria-label="Your Strategy hand">
          <div className="sticky-hand-caption"><span>Your hand</span><b>{frontIndex + 1} of {cards.length}</b><small>Tap the front card to inspect</small></div>
          <div className="sticky-hand-fan" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { pointerStart.current = null; gestureAxis.current = 'pending' }}>
            {cards.map((card, index) => {
              const order = wrap(index - frontIndex, cards.length)
              const front = order === 0
              const selected = cardIsCommitted(player, card.id)
              const privateSelected = !isSpecialAction(card) && commit.strategyId === card.id && commit.playForPrivate
              const visibleOrder = Math.min(order, offsets.length - 1)
              const style: CSSProperties = {
                zIndex: front ? cards.length + 2 : cards.length - visibleOrder,
                transform: `translateX(calc(-50% + ${offsets[visibleOrder]}px)) translateY(${front ? 0 : 8 + visibleOrder * 3}px) rotate(${front ? 0 : offsets[visibleOrder] / 24}deg) scale(${front ? 1 : .94 - visibleOrder * .015})`,
              }
              return (
                <button className={`sticky-hand-card ${front ? 'front' : 'rear'} ${selected ? 'selected' : ''} ${privateSelected ? 'private-targeted' : ''}`} style={style} key={card.id} onClick={() => {
                  if (suppressClick.current) return
                  if (!front) setFrontIndex(index)
                  else setInspectedIndex(index)
                }} aria-label={front ? `Inspect ${card.title}` : `Bring ${card.title} to the front`}>
                  <CardFace kind="strategy" id={card.id} />
                  {selected && <span className="sticky-card-chosen">{isSpecialAction(card) ? 'Start Action' : privateSelected ? 'Private target' : 'Chosen'}</span>}
                </button>
              )
            })}
          </div>
        </aside>
      )}

      {inspected && inspectedIndex !== null && (
        <dialog open className="mobile-card-dialog sticky-hand-inspector" onClick={() => setInspectedIndex(null)} aria-label={inspected.title}>
          <div className="mobile-dialog-inner mobile-dialog-strategy" onClick={(event) => event.stopPropagation()}>
            <button className="mobile-dialog-close" onClick={() => setInspectedIndex(null)} aria-label="Close card">×</button>
            <div className="sticky-inspector-card-stage" onPointerDown={onInspectorPointerDown} onPointerMove={onInspectorPointerMove} onPointerUp={onInspectorPointerUp} onPointerCancel={() => { inspectorPointerStart.current = null; inspectorGestureAxis.current = 'pending' }}>
              <button className="sticky-inspector-arrow previous" type="button" onClick={() => cycleInspector(-1)} aria-label="Previous card">‹</button>
              <div className="mobile-dialog-image"><CardFace kind="strategy" id={inspected.id} /></div>
              <button className="sticky-inspector-arrow next" type="button" onClick={() => cycleInspector(1)} aria-label="Next card">›</button>
              <span className="sticky-inspector-count">{wrap(inspectedIndex, cards.length) + 1} of {cards.length}</span>
            </div>
            <section>
              <StrategyQuickSummary game={game} cognition={player} card={inspected} />
              <h2>{inspected.title}</h2>
              <p>{strategyText(inspected)}</p>
              <details className="strategy-contribution-disclosure"><summary>More contribution details</summary><StrategyContributionDetails game={game} cognition={player} card={inspected} compact /></details>
              <div className="sticky-inspector-actions">
                <button className="primary" onClick={() => { choose(inspected); if (!isSpecialAction(inspected)) setInspectedIndex(null) }}>
                  {cardIsCommitted(player, inspected.id) && !(commit.strategyId === inspected.id && commit.playForPrivate)
                    ? isSpecialAction(inspected) ? 'Review or remove this Start-of-Play Action' : 'Undo this choice'
                    : isSpecialAction(inspected) ? 'Use or configure this Special Action'
                      : canPlayVisible(game, player, inspected) ? 'Choose normally' : 'Choose to discard'}
                </button>
                {privateRouteOpen && !isSpecialAction(inspected) && <button className="quiet private-route" onClick={() => { choosePrivate(inspected); setInspectedIndex(null) }}>{commit.strategyId === inspected.id && commit.playForPrivate ? 'Undo Private assignment' : 'Assign to Private Need'}</button>}
              </div>
            </section>
          </div>
        </dialog>
      )}
    </>
  )
}
