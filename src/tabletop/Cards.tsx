import type { CSSProperties } from 'react'
import { needs, situations, strategies, type StrategyCard } from '../data/cards'
import { CARD_ART, UI_ASSETS } from '../assets/cardArt'
import type { NeedSlot } from './model'

export type CardKind = 'strategy' | 'need' | 'situation'

export function CardFace({ kind, id, className = '', style }: { kind: CardKind; id: string; className?: string; style?: CSSProperties }) {
  const artwork = CARD_ART[id]
  if (kind === 'strategy') {
    const card = strategies.find((item) => item.id === id)
    if (!card) return null
    return <article className={`physical-card strategy-face ${className}`} style={style} aria-label={card.title}>
      <header><span>{card.id}</span><strong>{card.title}</strong></header>
      <div className="illustration strategy-picture">{artwork && <img src={artwork} alt="" />}</div>
      <div className="effect-pills">{card.effects.map((effect) => <span key={`${id}-${effect.need}`} className={effect.amount < 0 ? 'negative' : ''}>{effect.need} <b>{effect.amount > 0 ? `+${effect.amount}` : effect.amount}</b></span>)}</div>
      {card.eventEffects.length > 0 && <footer>Event: {card.eventEffects.map((effect) => `${effect.need} ${effect.amount}`).join(' · ')}</footer>}
    </article>
  }
  if (kind === 'need') {
    const card = needs.find((item) => item.id === id)
    if (!card) return null
    return <article className={`physical-card need-face ${className}`} style={style} aria-label={`${card.feeling}: ${card.need}`}>
      <header><span>{card.feeling}</span><strong>{card.need}</strong></header>
      <div className="illustration need-picture">{artwork && <img src={artwork} alt="" />}</div>
    </article>
  }
  const card = situations.find((item) => item.id === id)
  if (!card) return null
  return <article className={`physical-card situation-face ${className}`} style={style} aria-label={card.title}>
    <div className="illustration situation-picture">{artwork && <img src={artwork} alt="" />}</div>
    <div className="situation-copy">
      <span>{card.event ? 'Event situation' : 'Situation'}</span>
      <strong>{card.title}</strong>
      <div>{card.effects.map((effect) => <b key={`${id}-${effect.need}`}>{effect.need} +{effect.amount}</b>)}</div>
      {card.feelingMultiplier && <small>{card.feelingMultiplier} Needs receive ×2 gifts</small>}
    </div>
  </article>
}

export function CardBack({ kind, className = '', style }: { kind: CardKind; className?: string; style?: CSSProperties }) {
  const source = kind === 'strategy' ? UI_ASSETS.strategyBack : kind === 'need' ? UI_ASSETS.needBack : UI_ASSETS.situationBack
  return <div className={`physical-card card-back ${kind}-back ${className}`} style={style} aria-hidden="true"><img src={source} alt="" /></div>
}

export function GiftPieces({ count }: { count: number }) {
  if (count === 0) return <span className="tended-label">Tended</span>
  return <div className="gift-pieces" aria-label={`${count} gifts remaining`}>
    {Array.from({ length: Math.min(count, 8) }, (_, index) => <img key={index} src={UI_ASSETS.gift} alt="" />)}
    {count > 8 && <b>+{count - 8}</b>}
  </div>
}

export function NeedCardOnTable({ slot, large = false }: { slot: NeedSlot; large?: boolean }) {
  return <div className={`need-with-gifts ${large ? 'large' : ''} ${slot.gifts === 0 ? 'tended' : ''}`}>
    <CardFace kind="need" id={slot.card.id} />
    <GiftPieces count={slot.gifts} />
  </div>
}

export function Magnifier({ used, disabled, onClick }: { used: boolean; disabled: boolean; onClick: () => void }) {
  return <button className={`magnifier ${used ? 'used' : ''}`} disabled={disabled} onClick={onClick} aria-label="Look at your Private Need">
    <img src={UI_ASSETS.magnifier} alt="" /><span>{used ? 'Used' : 'Look'}</span>
  </button>
}

export function strategyText(card: StrategyCard): string {
  const normal = card.effects.map((effect) => `${effect.need} ${effect.amount > 0 ? `+${effect.amount}` : effect.amount}`).join(' · ')
  const event = card.eventEffects.length ? ` Event: ${card.eventEffects.map((effect) => `${effect.need} ${effect.amount}`).join(' · ')}.` : ''
  return `${normal}.${event}`
}
