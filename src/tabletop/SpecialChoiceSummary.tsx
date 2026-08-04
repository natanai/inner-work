import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { enumeratePlanningPaths, summarizePlanningPaths } from './planningPaths'
import type { GameState } from './model'

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

export function SpecialChoiceSummary({ game }: { game: GameState }) {
  const target = useTradeRoomTarget()
  const paths = useMemo(() => enumeratePlanningPaths(game, { privacy: 'player' }), [game])
  const summary = useMemo(() => summarizePlanningPaths(paths), [paths])

  if (!target || game.phase !== 'planning') return null
  return createPortal(
    <aside
      className="choice-path-summary special-choice-summary"
      aria-label={`${summary.known} known planning routes and ${summary.uncertain} uncertain possibilities`}
    >
      <div>
        <span>Choice check</span>
        <strong>{summary.known} known planning route{summary.known === 1 ? '' : 's'}</strong>
      </div>
      <div className="choice-certainty">
        <span><b>{summary.known}</b> confirmed</span>
        {summary.uncertain > 0 && <span className="uncertain"><b>{summary.uncertain}</b> hidden or permission-based</span>}
      </div>
      <p>
        <b>{summary.strategy}</b> playable card{summary.strategy === 1 ? '' : 's'}
        <b>{summary.trade}</b> directed trade route{summary.trade === 1 ? '' : 's'}
        <b>{summary.special}</b> Special Action route{summary.special === 1 ? '' : 's'}
        <b>{summary.magnifier}</b> Magnifier route{summary.magnifier === 1 ? '' : 's'}
        {summary.discard > 0 && <><b>{summary.discard}</b> discard route</>}
      </p>
      {summary.uncertain > 0 && <small>Private-Need matches and NPC permission remain deliberately unconfirmed until the relevant action resolves.</small>}
    </aside>,
    target,
  )
}
