import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import type { StrategyCard } from '../data/cards'
import { CardFace, GiftIcon, strategyText, type CardKind } from './Cards'
import { canPlay, type Cognition, type GameState, type NeedSlot } from './model'
import { StrategyContributionDetails } from './StrategyContributionDetails'

type InspectedCard = {
  kind: CardKind
  id: string
  label: string
  detail?: string
}

type PortalTargets = {
  hand: HTMLElement | null
  needs: HTMLElement[]
}

type GestureAxis = 'pending' | 'horizontal' | 'vertical'

type PointerStart = {
  x: number
  y: number
}

function cognitionSymbol(cognition: Cognition): string {
  if (cognition.id === 'alpha') return 'α'
  if (cognition.id === 'beta') return 'β'
  return 'γ'
}

function activeBonuses(game: GameState) {
  return game.bonusNeeds.filter((bonus) => bonus.gifts > 0 && bonus.availableRound <= game.round)
}

function giftOriginText(slot: NeedSlot): string {
  const parts = [`Base ${slot.setup.base}`]
  if (slot.setup.situation > 0) parts.push(`Situation +${slot.setup.situation}`)
  if (slot.setup.multiplied) parts.push(`${slot.card.feeling} ×2`)
  return parts.join(' · ')
}

function giftDetailText(slot: NeedSlot): string {
  return `${giftOriginText(slot)}. Started with ${slot.setup.total}; ${slot.gifts} required gift${slot.gifts === 1 ? '' : 's'} remain.`
}

function sameTargets(previous: PortalTargets, next: PortalTargets): boolean {
  return previous.hand === next.hand
    && previous.needs.length === next.needs.length
    && previous.needs.every((target, index) => target === next.needs[index])
}

function useMobilePortalTargets(): PortalTargets {
  const [targets, setTargets] = useState<PortalTargets>({ hand: null, needs: [] })

  useEffect(() => {
    const refresh = () => {
      const next: PortalTargets = {
        hand: document.querySelector<HTMLElement>('.mobile-hand-section'),
        needs: [...document.querySelectorAll<HTMLElement>('.mobile-cognition-needs')],
      }
      setTargets((previous) => sameTargets(previous, next) ? previous : next)
    }

    const frame = window.requestAnimationFrame(refresh)
    const observer = new MutationObserver(refresh)
    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('resize', refresh)

    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', refresh)
    }
  }, [])

  useEffect(() => {
    targets.hand?.classList.add('true-stack-mounted')
    targets.needs.forEach((target) => target.classList.add('true-needs-mounted'))
    return () => {
      targets.hand?.classList.remove('true-stack-mounted')
      targets.needs.forEach((target) => target.classList.remove('true-needs-mounted'))
    }
  }, [targets])

  return targets
}

function wrap(index: number, total: number): number {
  if (total === 0) return 0
  return (index + total) % total
}

function StrategyStack({
  game,
  onGameChange,
  onInspect,
}: {
  game: GameState
  onGameChange: (game: GameState) => void
  onInspect: (card: InspectedCard) => void
}) {
  const player = game.cognitions.find((cognition) => cognition.human) ?? game.cognitions[0]
  const cards = player.hand
  const bonuses = activeBonuses(game)
  const handKey = cards.map((card) => card.id).join('|')
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, cards.findIndex((card) => card.id === player.selected)))
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [animating, setAnimating] = useState(false)
  const pointerStart = useRef<PointerStart | null>(null)
  const pointerId = useRef<number | null>(null)
  const gestureAxis = useRef<GestureAxis>('pending')
  const moved = useRef(false)
  const animationTimer = useRef<number | null>(null)

  useEffect(() => {
    const selectedIndex = cards.findIndex((card) => card.id === player.selected)
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
    setDragX(0)
    setDragging(false)
    setAnimating(false)
    pointerStart.current = null
    pointerId.current = null
    gestureAxis.current = 'pending'
  }, [handKey])

  useEffect(() => () => {
    if (animationTimer.current !== null) window.clearTimeout(animationTimer.current)
  }, [])

  const cycle = (direction: -1 | 1) => {
    if (animating || cards.length < 2) return
    setDragging(false)
    setAnimating(true)
    setDragX(direction > 0 ? -window.innerWidth * 1.15 : window.innerWidth * 1.15)
    animationTimer.current = window.setTimeout(() => {
      setActiveIndex((index) => wrap(index + direction, cards.length))
      setDragX(0)
      setAnimating(false)
      moved.current = false
    }, 190)
  }

  const resetPointer = () => {
    pointerStart.current = null
    pointerId.current = null
    gestureAxis.current = 'pending'
    setDragging(false)
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (animating) return
    pointerStart.current = { x: event.clientX, y: event.clientY }
    pointerId.current = event.pointerId
    gestureAxis.current = 'pending'
    moved.current = false
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current
    if (!start || pointerId.current !== event.pointerId || animating) return

    const distanceX = event.clientX - start.x
    const distanceY = event.clientY - start.y
    const horizontalDistance = Math.abs(distanceX)
    const verticalDistance = Math.abs(distanceY)

    if (gestureAxis.current === 'pending' && Math.max(horizontalDistance, verticalDistance) >= 9) {
      if (verticalDistance > horizontalDistance * 1.15) {
        gestureAxis.current = 'vertical'
        moved.current = true
        setDragX(0)
        setDragging(false)
        return
      }
      if (horizontalDistance > verticalDistance * 1.15) {
        gestureAxis.current = 'horizontal'
        moved.current = true
        setDragging(true)
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.setPointerCapture(event.pointerId)
        }
      }
    }

    if (gestureAxis.current !== 'horizontal') return
    event.preventDefault()
    setDragX(Math.max(-150, Math.min(150, distanceX)))
  }

  const finishPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current
    if (!start || pointerId.current !== event.pointerId) return

    const distanceX = event.clientX - start.x
    const horizontalGesture = gestureAxis.current === 'horizontal'
    resetPointer()

    if (horizontalGesture && Math.abs(distanceX) >= 48) cycle(distanceX < 0 ? 1 : -1)
    else setDragX(0)
  }

  const cancelPointer = () => {
    resetPointer()
    setDragX(0)
  }

  const select = (card: StrategyCard) => {
    onGameChange({
      ...game,
      cognitions: game.cognitions.map((cognition) => cognition.id === player.id
        ? { ...cognition, selected: cognition.selected === card.id ? null : card.id }
        : cognition),
    })
  }

  return (
    <section className="true-strategy-stack" aria-label="Your Strategy hand">
      <header>
        <div><span>Your response</span><strong>Choose one Strategy for these Needs</strong></div>
        <small>Swipe sideways</small>
      </header>

      <div
        className={`true-stack-deck ${dragging ? 'dragging' : ''} ${animating ? 'animating' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={cancelPointer}
      >
        {cards.map((card, cardIndex) => {
          const offset = wrap(cardIndex - activeIndex, cards.length)
          const active = offset === 0
          const visibleOffset = Math.min(offset, 3)
          const selected = card.id === player.selected
          const legal = canPlay(player, card, bonuses)
          const style: CSSProperties = active
            ? {
                zIndex: cards.length + 4,
                transform: `translateX(${dragX}px) rotate(${dragX / 34}deg)`,
              }
            : {
                zIndex: cards.length - visibleOffset,
                transform: `translate(${visibleOffset * 8}px, ${visibleOffset * -8}px) rotate(${visibleOffset % 2 === 0 ? -.55 : .55}deg) scale(${1 - visibleOffset * .012})`,
                opacity: offset > 3 ? 0 : 1,
              }

          return (
            <article
              className={`true-stack-card ${active ? 'active' : 'behind'} ${selected ? 'selected' : ''}`}
              style={style}
              aria-hidden={!active}
              inert={!active ? true : undefined}
              key={card.id}
            >
              <button
                className="true-stack-preview"
                onClick={() => {
                  if (moved.current) return
                  onInspect({ kind: 'strategy', id: card.id, label: card.title, detail: strategyText(card) })
                }}
                aria-label={`Enlarge ${card.title}`}
                tabIndex={active ? 0 : -1}
              >
                <CardFace kind="strategy" id={card.id} />
              </button>
              <div className="true-stack-copy">
                <span className={legal ? 'mobile-playable' : 'mobile-discard'}>{legal ? 'Playable now' : 'Discard only'}</span>
                <h2>{card.title}</h2>
                <p>{strategyText(card)}</p>
                <details className="strategy-contribution-disclosure">
                  <summary>See exact contributions</summary>
                  <StrategyContributionDetails game={game} cognition={player} card={card} compact />
                </details>
                <button className="mobile-choose-strategy" onClick={() => select(card)} aria-pressed={selected} tabIndex={active ? 0 : -1}>
                  {selected ? 'Chosen — tap to undo' : legal ? 'Choose this Strategy' : 'Choose to discard'}
                </button>
              </div>
            </article>
          )
        })}
      </div>

      <nav className="true-stack-controls" aria-label="Strategy deck navigation">
        <button onClick={() => cycle(-1)} aria-label="Bring previous Strategy to the front">←</button>
        <span><b>{cards.length ? activeIndex + 1 : 0}</b> of {cards.length}</span>
        <button onClick={() => cycle(1)} aria-label="Move front Strategy to the back">→</button>
      </nav>
    </section>
  )
}

function NeedGalleryRow({
  cognition,
  onInspect,
}: {
  cognition: Cognition
  onInspect: (card: InspectedCard) => void
}) {
  return (
    <section className={`true-need-gallery-row true-need-owner-${cognition.id}`}>
      <header><span>Public Need cards</span></header>
      <div>
        {cognition.publicNeeds.map((slot) => (
          <button
            className={`true-public-need-card ${slot.gifts === 0 ? 'tended' : ''}`}
            key={slot.card.id}
            onClick={() => onInspect({
              kind: 'need',
              id: slot.card.id,
              label: `${slot.card.feeling}: ${slot.card.need}`,
              detail: giftDetailText(slot),
            })}
          >
            <span className="true-need-owner-badge">{cognitionSymbol(cognition)}</span>
            <CardFace kind="need" id={slot.card.id} />
            <span className="true-need-gift-badge"><GiftIcon variation={cognition.id === 'beta' ? 1 : cognition.id === 'gamma' ? 2 : 0} /><b>{slot.gifts}</b></span>
            <span className="true-need-caption"><small>{slot.card.feeling}</small><strong>{slot.card.need}</strong></span>
            <span className="true-need-origin"><small>{giftOriginText(slot)}</small><strong>{slot.gifts}/{slot.setup.total} left</strong></span>
          </button>
        ))}
      </div>
    </section>
  )
}

function CardInspector({ game, inspected, onClose }: { game: GameState; inspected: InspectedCard; onClose: () => void }) {
  const player = game.cognitions.find((cognition) => cognition.human) ?? game.cognitions[0]
  const strategy = inspected.kind === 'strategy' ? player.hand.find((card) => card.id === inspected.id) : null
  return (
    <dialog open className="mobile-card-dialog true-card-inspector" onClick={onClose} aria-label={inspected.label}>
      <div className={`mobile-dialog-inner mobile-dialog-${inspected.kind}`} onClick={(event) => event.stopPropagation()}>
        <button className="mobile-dialog-close" onClick={onClose} aria-label="Close card">×</button>
        <div className="mobile-dialog-image"><CardFace kind={inspected.kind} id={inspected.id} /></div>
        <section>
          <h2>{inspected.label}</h2>
          {inspected.detail && <p>{inspected.detail}</p>}
          {strategy && <StrategyContributionDetails game={game} cognition={player} card={strategy} />}
        </section>
      </div>
    </dialog>
  )
}

export function MobileCardExperienceLayer({
  game,
  onGameChange,
}: {
  game: GameState
  onGameChange: (game: GameState) => void
}) {
  const targets = useMobilePortalTargets()
  const [inspected, setInspected] = useState<InspectedCard | null>(null)
  const phone = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches, [])

  if (!phone) return null

  return (
    <>
      {targets.hand && game.phase === 'planning' && createPortal(
        <StrategyStack game={game} onGameChange={onGameChange} onInspect={setInspected} />,
        targets.hand,
      )}
      {targets.needs.map((target, index) => {
        const cognition = game.cognitions[index]
        return cognition ? createPortal(
          <NeedGalleryRow cognition={cognition} onInspect={setInspected} />,
          target,
        ) : null
      })}
      {inspected && createPortal(<CardInspector game={game} inspected={inspected} onClose={() => setInspected(null)} />, document.body)}
    </>
  )
}
