import type { CSSProperties } from 'react'
import { needs, situations, strategies, type StrategyCard } from '../data/cards'
import type { NeedSlot } from './model'

export type CardKind = 'strategy' | 'need' | 'situation'

type Atlas = {
  file: string
  columns: number
  rows: number
  prefix: string
}

const BASE_URL = import.meta.env.BASE_URL

const ATLASES: Record<CardKind, Atlas> = {
  strategy: { file: 'strategies.webp', columns: 9, rows: 6, prefix: 'ST' },
  need: { file: 'needs.webp', columns: 6, rows: 5, prefix: 'FN' },
  situation: { file: 'situations.webp', columns: 5, rows: 5, prefix: 'S' },
}

function cardLabel(kind: CardKind, id: string): string | null {
  if (kind === 'strategy') return strategies.find((card) => card.id === id)?.title ?? null
  if (kind === 'need') {
    const card = needs.find((item) => item.id === id)
    return card ? `${card.feeling}: ${card.need}` : null
  }
  return situations.find((card) => card.id === id)?.title ?? null
}

function atlasStyle(kind: CardKind, id: string): CSSProperties | null {
  const atlas = ATLASES[kind]
  if (!id.startsWith(atlas.prefix)) return null
  const cardNumber = Number.parseInt(id.slice(atlas.prefix.length), 10)
  if (!Number.isFinite(cardNumber) || cardNumber < 1) return null

  const index = cardNumber - 1
  const column = index % atlas.columns
  const row = Math.floor(index / atlas.columns)
  if (row >= atlas.rows) return null

  const x = atlas.columns === 1 ? 0 : (column / (atlas.columns - 1)) * 100
  const y = atlas.rows === 1 ? 0 : (row / (atlas.rows - 1)) * 100

  return {
    backgroundImage: `url(${BASE_URL}cards/${atlas.file})`,
    backgroundSize: `${atlas.columns * 100}% ${atlas.rows * 100}%`,
    backgroundPosition: `${x}% ${y}%`,
    backgroundRepeat: 'no-repeat',
  }
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
  const sprite = atlasStyle(kind, id)
  if (!label || !sprite) return null

  return (
    <span
      className={`physical-card full-card-front ${kind}-face ${className}`}
      style={{ ...sprite, ...style }}
      role="img"
      aria-label={label}
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
  const file = kind === 'strategy' ? 'strategy-back.webp' : kind === 'need' ? 'need-back.webp' : 'situation-back.webp'
  return (
    <span className={`physical-card card-back ${kind}-back ${className}`} style={style} aria-hidden="true">
      <img src={`${BASE_URL}cards/${file}`} alt="" />
    </span>
  )
}

function GiftIcon({ variation }: { variation: number }) {
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
  onInspect,
}: {
  slot: NeedSlot
  large?: boolean
  onInspect?: () => void
}) {
  const card = <CardFace kind="need" id={slot.card.id} />
  return (
    <div className={`need-with-gifts ${large ? 'large' : ''} ${slot.gifts === 0 ? 'tended' : ''}`}>
      {onInspect ? (
        <button className="inspectable-card" onClick={onInspect} aria-label={`Enlarge ${slot.card.feeling}: ${slot.card.need}`}>
          {card}
        </button>
      ) : card}
      <GiftPieces count={slot.gifts} />
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
