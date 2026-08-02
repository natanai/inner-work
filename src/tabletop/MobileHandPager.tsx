import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { GameState } from './model'

export function MobileHandPager({ game }: { game: GameState }) {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [carousel, setCarousel] = useState<HTMLElement | null>(null)
  const [index, setIndex] = useState(0)
  const handKey = game.cognitions[0]?.hand.map((card) => card.id).join('|') ?? ''

  useEffect(() => {
    if (game.phase !== 'planning') {
      setTarget(null)
      setCarousel(null)
      return
    }
    const frame = window.requestAnimationFrame(() => {
      const section = document.querySelector<HTMLElement>('.mobile-hand-section')
      const row = section?.querySelector<HTMLElement>('.mobile-hand-carousel') ?? null
      setTarget(section ?? null)
      setCarousel(row)
      setIndex(0)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [game.phase, handKey])

  useEffect(() => {
    if (!carousel) return
    const update = () => {
      const cards = [...carousel.querySelectorAll<HTMLElement>('.mobile-hand-card')]
      if (!cards.length) return
      const center = carousel.scrollLeft + carousel.clientWidth / 2
      let closest = 0
      let distance = Number.POSITIVE_INFINITY
      cards.forEach((card, cardIndex) => {
        const cardCenter = card.offsetLeft + card.offsetWidth / 2
        const nextDistance = Math.abs(cardCenter - center)
        if (nextDistance < distance) {
          distance = nextDistance
          closest = cardIndex
        }
      })
      setIndex(closest)
    }
    carousel.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    update()
    return () => {
      carousel.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [carousel])

  if (!target || !carousel || game.phase !== 'planning') return null
  const cards = [...carousel.querySelectorAll<HTMLElement>('.mobile-hand-card')]
  const total = cards.length

  const move = (direction: -1 | 1) => {
    if (!total) return
    const nextIndex = (index + direction + total) % total
    const card = cards[nextIndex]
    const left = card.offsetLeft - (carousel.clientWidth - card.offsetWidth) / 2
    carousel.scrollTo({ left, behavior: 'smooth' })
    setIndex(nextIndex)
  }

  return createPortal(
    <nav className="mobile-hand-pager" aria-label="Strategy hand navigation">
      <button onClick={() => move(-1)} aria-label="Previous Strategy">←</button>
      <span><b>{Math.min(index + 1, total)}</b> of {total}</span>
      <button onClick={() => move(1)} aria-label="Next Strategy">→</button>
    </nav>,
    target,
  )
}
