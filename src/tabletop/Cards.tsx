import type { CSSProperties } from 'react'
import { needs, situations, strategies, type StrategyCard } from '../data/cards'
import { cardBackUrl, cardFrontUrl, type CardKind } from './cardAssets'
import type { NeedSlot } from './model'

export type { CardKind } from './cardAssets'

function cardLabel(kind: CardKind, id: string): string | null {
  if (kind === 'strategy') return strategies.find((card) => card.id === id)?.title ?? null
  if (kind === 'need') {
    const card = needs.find((item) => item.id === id)
    return card ? `${card.feeling}: ${card.need}` : null
  }
  return situations.find((card) => card.id === id)?.title ?? null
}

export function CardFace({
  kind,
  id,
  className = '',
  style,
}: {
  kind: CardKind
  id: string
  className?: string
  style?: CSSProperties
}) {
  const label = cardLabel(kind, id)
  if (!label) return null

  return (
    <img
      className={`physical-card full-card-front ${kind}-face ${className}`}
      style={style}
      src={cardFrontUrl(kind, id)}
      alt={label}
      decoding="async"
      draggable={false}
    />
  )
}

export function CardBack({
  kind,
  className = '',
  style,
}: {
  kind: CardKind
  className?: string
  style?: CSSProperties
}) {
  return (
    <span className={`physical-card card-back ${kind}-back ${className}`} style={style} aria-hidden="true">
      <img src={cardBackUrl(kind)} alt="" decoding="async" draggable={false} />
    </span>
  )
}

export function GiftIcon({ variation = 0 }: { variation?: number }) {
  return (
    <svg className={`gift-piece gift-piece-${variation % 3}`} viewBox="0 0 32 32" aria-hidden="true">
      <path className="gift-lid" d="M3 11h26v6H3z" />
      <path className="gift-box" d="M5 17h22v13H5z" />
      <path className="gift-ribbon" d="M14 11h4v19h-4z" />
      <path className="gift-bow" d="M16 10C9 10 8 2 12 2c3 0 4 5 4 8Zm0 0c7 0 8-8 4-8-3 0-4 5-4 8Z" />
    </svg>
  )
}

export function GiftPieces({ count }: { count: number }) {
  if (count === 0) return <span className="tended-label">Tended</span>
  return (
    <div className="gift-pieces" aria-label={`${count} gifts remaining`}>
      {Array.from({ length: Math.min(count, 8) }, (_, index) => <GiftIcon key={index} variation={index} />)}
      {count > 8 && <b>+{count - 8}</b>}
    </div>
  )
}

export function NeedCardOnTable({
  slot,
  large = false,
  highlighted = false,
  onInspect,
}: {
  slot: NeedSlot
  large?: boolean
  highlighted?: boolean
  onInspect?: () => void
}) {
  const card = <CardFace kind="need" id={slot.card.id} />
  return (
    <div className={`need-with-gifts ${large ? 'large' : ''} ${slot.gifts === 0 ? 'tended' : ''} ${highlighted ? 'gift-resolved' : ''}`}>
      {onInspect ? (
        <button className="inspectable-card" onClick={onInspect} aria-label={`Enlarge ${slot.card.feeling}: ${slot.card.need}`}>
          {card}
        </button>
      ) : card}
      <div className="card-readable-label"><span>{slot.card.feeling}</span><strong>{slot.card.need}</strong></div>
      <GiftPieces count={slot.gifts} />
      {highlighted && (
        <div className="gift-impact" aria-label={`${slot.card.need} was tended this round`}>
          <GiftIcon variation={1} />
          <span>Tended this round</span>
        </div>
      )}
    </div>
  )
}

export function Magnifier({
  used,
  disabled,
  onClick,
}: {
  used: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button className={`magnifier ${used ? 'used' : ''}`} disabled={disabled} onClick={onClick} aria-label="Look at your Private Need">
      <svg viewBox="0 0 72 72" aria-hidden="true">
        <circle className="magnifier-lens" cx="29" cy="29" r="19" />
        <circle className="magnifier-shine" cx="23" cy="23" r="8" />
        <path className="magnifier-handle" d="m43 43 19 19" />
      </svg>
      <span>{used ? 'Used' : 'Look'}</span>
    </button>
  )
}

export function strategyText(card: StrategyCard): string {
  const normal = card.effects.map((effect) => `${effect.need} ${effect.amount > 0 ? `+${effect.amount}` : effect.amount}`).join(' · ')
  const event = card.eventEffects.length ? ` Event: ${card.eventEffects.map((effect) => `${effect.need} ${effect.amount}`).join(' · ')}.` : ''
  return `${normal}.${event}`
}
