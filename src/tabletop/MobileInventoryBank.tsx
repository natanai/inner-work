import { GiftIcon } from './Cards'
import type { GameState } from './model'

export function MobileInventoryBank({ game }: { game: GameState }) {
  const player = game.cognitions.find((cognition) => cognition.human) ?? game.cognitions[0]
  const personalScore = player.privateScore + player.bonusScore
  const magnifierReady = game.phase === 'planning' && !player.magnifierUsed && player.privateNeed.gifts > 0

  const reviewPrivateNeed = () => {
    if (!magnifierReady) return
    window.dispatchEvent(new Event('inner-work:review-private'))
  }

  return (
    <aside className="mobile-inventory-bank" aria-label="Score bank and inventory">
      <div className="mobile-bank-item mobile-bank-group" aria-label={`${game.sharedScore} shared group gifts`}>
        <GiftIcon variation={0} />
        <span>Group</span>
        <strong>{game.sharedScore}</strong>
      </div>

      <div className="mobile-bank-item mobile-bank-personal" aria-label={`${personalScore} personal points`}>
        <b aria-hidden="true">α</b>
        <span>Yours</span>
        <strong>{personalScore}</strong>
      </div>

      <button
        className={`mobile-bank-item mobile-bank-magnifier ${player.magnifierUsed ? 'used' : ''}`}
        type="button"
        disabled={!magnifierReady}
        onClick={reviewPrivateNeed}
        aria-label={player.magnifierUsed ? 'Magnifying glass already used this Situation' : 'Use the magnifying glass to review your Private Need'}
      >
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <circle cx="15" cy="15" r="9" />
          <path d="m22 22 10 10" />
          <path className="shine" d="M10 12c1.2-2 3-3 5.4-3" />
        </svg>
        <span>Magnifier</span>
        <strong>{player.magnifierUsed ? 'Used' : 'Ready'}</strong>
      </button>
    </aside>
  )
}
