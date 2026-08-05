import { cognitionIdentity } from './cognitionIdentity'
import type { Cognition, CognitionId } from './model'

type Props = {
  cognition: Cognition | CognitionId
  className?: string
  size?: 'small' | 'medium' | 'large'
}

/**
 * The only visible circular marker for a Cognition.
 * Internal alpha/beta/gamma ids never become UI text; every surface gets the
 * same seat number, owner color, font, alignment, and accessible name here.
 */
export function CognitionSeatBadge({ cognition, className = '', size = 'medium' }: Props) {
  const identity = cognitionIdentity(cognition)
  return (
    <span
      className={`cognition-seat-badge owner-${identity.id} size-${size} ${className}`.trim()}
      aria-label={`${identity.role}, ${identity.name}, Seat ${identity.seat}`}
    >
      {identity.seat}
    </span>
  )
}
