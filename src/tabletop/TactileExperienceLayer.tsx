import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { GameState } from './model'

type Targets = {
  privateNeed: HTMLElement | null
  story: HTMLElement | null
}

function sameTargets(previous: Targets, next: Targets): boolean {
  return previous.privateNeed === next.privateNeed && previous.story === next.story
}

export function TactileExperienceLayer({ game }: { game: GameState }) {
  const [targets, setTargets] = useState<Targets>({ privateNeed: null, story: null })
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches)
  const player = game.cognitions.find((cognition) => cognition.human)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)')
    const refresh = () => {
      setPhone(media.matches)
      const next = {
        privateNeed: document.querySelector<HTMLElement>('.mobile-cognition-needs:first-of-type .mobile-private-copy'),
        story: document.querySelector<HTMLElement>('.story-copy'),
      }
      setTargets((previous) => sameTargets(previous, next) ? previous : next)
    }
    refresh()
    const observer = new MutationObserver(refresh)
    observer.observe(document.body, { childList: true, subtree: true })
    media.addEventListener?.('change', refresh)
    return () => {
      observer.disconnect()
      media.removeEventListener?.('change', refresh)
    }
  }, [])

  if (!phone || !player) return null

  return (
    <>
      {targets.privateNeed && game.phase === 'planning' && !player.privateVisible && createPortal(
        <button
          className="needs-review-private"
          disabled={player.magnifierUsed}
          onClick={() => window.dispatchEvent(new Event('inner-work:review-private'))}
        >
          <span aria-hidden="true">⌕</span>
          <strong>{player.magnifierUsed ? 'Magnifier used' : 'Review once'}</strong>
        </button>,
        targets.privateNeed,
      )}
      {targets.story && game.phase !== 'planning' && createPortal(
        <aside className="story-meaning-cue">
          <span>Make it real</span>
          <p>In <strong>{game.situation.title}</strong>, what would this action actually look or feel like? How could it make more room for the Needs named below?</p>
        </aside>,
        targets.story,
      )}
    </>
  )
}
