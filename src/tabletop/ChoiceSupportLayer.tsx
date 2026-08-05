import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CardBack, CardFace, GiftIcon } from './Cards'
import { generateDirectedTradeOptions, type DirectedTradeOption } from './directedTrading'
import {
  beginPrivateReviewWithMagnifier,
  endPrivateReview,
  replaceOwnPublicNeedWithMagnifier,
  replaceStrategiesWithMagnifier,
  requestNpcPublicNeedReplacement,
} from './magnifierActions'
import type { CognitionId, GameState } from './model'
import { applyTrade } from './trading'

type MagnifierMode = 'menu' | 'refresh' | 'own-need' | 'other-need' | 'review-confirm' | 'reviewing'
type NeedChoice = { cognitionId: CognitionId; cardId: string }

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

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}

function DirectedTradePanel({ game, onGameChange }: { game: GameState; onGameChange: (game: GameState) => void }) {
  const options = useMemo(() => generateDirectedTradeOptions(game), [game])
  const needs = unique(options.map((option) => `${option.requestedKind}:${option.requestedNeed}`))
  const [target, setTarget] = useState(needs[0] ?? '')
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!needs.includes(target)) setTarget(needs[0] ?? '')
  }, [needs.join('|'), target])

  const visible = options.filter((option) => `${option.requestedKind}:${option.requestedNeed}` === target).slice(0, 8)
  const accept = (option: DirectedTradeOption) => {
    onGameChange(applyTrade(game, option))
    setNotice(`Trade complete: “${option.npcGives.title}” is now in your hand.`)
  }

  return (
    <section className="directed-trade-panel compact-directed-trades">
      <header><span>Request by Need</span><h2>What do you need a card for?</h2></header>
      {notice && <p className="choice-notice">{notice}</p>}
      {needs.length === 0 ? <p className="choice-empty">No mutually legal request is available.</p> : <>
        <div className="directed-trade-needs" role="list" aria-label="Needs to request">
          {needs.map((key) => {
            const [, ...name] = key.split(':')
            const label = name.join(':')
            return <button key={key} className={target === key ? 'active' : ''} onClick={() => setTarget(key)}>{label}</button>
          })}
        </div>
        <div className="directed-trade-options">
          {visible.map((option) => (
            <article key={option.id}>
              <header><span>{option.npcName}</span><strong>{option.requestedNeed}</strong></header>
              <div className="directed-trade-cards">
                <section><small>Give</small><CardFace kind="strategy" id={option.playerGives.id} /><b>{option.playerGives.title}</b></section>
                <i aria-hidden="true">⇄</i>
                <section><small>Receive</small><CardFace kind="strategy" id={option.npcGives.id} /><b>{option.npcGives.title}</b></section>
              </div>
              <button className="primary" onClick={() => accept(option)}>Make trade</button>
            </article>
          ))}
        </div>
      </>}
    </section>
  )
}

export function ChoiceSupportLayer({ game, onGameChange, children }: { game: GameState; onGameChange: (game: GameState) => void; children?: ReactNode }) {
  const [magnifierOpen, setMagnifierOpen] = useState(false)
  const [mode, setMode] = useState<MagnifierMode>('menu')
  const [selectedCards, setSelectedCards] = useState<string[]>([])
  const [needChoice, setNeedChoice] = useState<NeedChoice | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const tradeTarget = useTradeRoomTarget()
  const player = game.cognitions.find((cognition) => cognition.human) ?? game.cognitions[0]

  const openMagnifier = () => {
    if (game.phase !== 'planning' || player.magnifierUsed) return
    setMode('menu')
    setSelectedCards([])
    setNeedChoice(null)
    setNotice(null)
    setMagnifierOpen(true)
  }

  useEffect(() => {
    const handler = (event: Event) => {
      event.stopImmediatePropagation()
      openMagnifier()
    }
    window.addEventListener('inner-work:open-magnifier', handler)
    return () => window.removeEventListener('inner-work:open-magnifier', handler)
  }, [game, player.magnifierUsed])

  useEffect(() => {
    if (player.magnifierUsed && mode !== 'reviewing') setMagnifierOpen(false)
  }, [player.magnifierUsed, mode])

  const close = () => {
    if (mode === 'reviewing') onGameChange(endPrivateReview(game))
    setMagnifierOpen(false)
    setMode('menu')
  }

  const refreshHand = () => {
    const result = replaceStrategiesWithMagnifier(game, player.id, selectedCards)
    setNotice(result.message)
    if (result.accepted) {
      onGameChange(result.game)
      setMagnifierOpen(false)
    }
  }

  const replaceOwn = () => {
    if (!needChoice) return
    const result = replaceOwnPublicNeedWithMagnifier(game, needChoice.cardId)
    setNotice(result.message)
    if (result.accepted) {
      onGameChange(result.game)
      setMagnifierOpen(false)
    }
  }

  const replaceOther = () => {
    if (!needChoice) return
    const result = requestNpcPublicNeedReplacement(game, needChoice.cognitionId, needChoice.cardId)
    setNotice(result.message)
    if (result.accepted) {
      onGameChange(result.game)
      setMagnifierOpen(false)
    }
  }

  const review = () => {
    const result = beginPrivateReviewWithMagnifier(game)
    setNotice(result.message)
    if (result.accepted) {
      onGameChange(result.game)
      setMode('reviewing')
    }
  }

  return (
    <>
      {children}
      {tradeTarget && createPortal(<DirectedTradePanel game={game} onGameChange={onGameChange} />, tradeTarget)}
      {magnifierOpen && createPortal(
        <dialog open className="magnifier-choice-dialog" onClick={close} aria-label="Choose a Magnifying Glass action">
          <section onClick={(event) => event.stopPropagation()}>
            <header><div><span>Magnifier · once this Situation</span><h1>{mode === 'menu' ? 'Choose one use.' : 'Confirm your choice.'}</h1></div><button onClick={close} aria-label="Close Magnifier menu">×</button></header>
            {notice && <p className="choice-notice">{notice}</p>}

            {mode === 'menu' && <div className="magnifier-action-grid">
              <button onClick={() => setMode('refresh')}><b>↻</b><span><strong>Replace cards</strong><small>Exchange any number from your hand.</small></span></button>
              <button onClick={() => setMode('own-need')}><b>＋</b><span><strong>Replace your Need</strong><small>Swap one Public Need for two new ones.</small></span></button>
              <button onClick={() => setMode('other-need')}><b>?</b><span><strong>Ask another Cognition</strong><small>Request permission to replace its Need.</small></span></button>
              <button onClick={() => setMode('review-confirm')}><b>⌕</b><span><strong>Review Private Need</strong><small>Look once, then return it face down.</small></span></button>
            </div>}

            {mode === 'refresh' && <div className="magnifier-choice-body">
              <p>Select the cards to exchange.</p>
              <div className="magnifier-card-picker">{player.hand.map((card) => {
                const chosen = selectedCards.includes(card.id)
                return <button key={card.id} className={chosen ? 'selected' : ''} onClick={() => setSelectedCards(chosen ? selectedCards.filter((id) => id !== card.id) : [...selectedCards, card.id])}><CardFace kind="strategy" id={card.id} /><span>{chosen ? 'Replace' : 'Keep'}</span></button>
              })}</div>
              <footer><button className="quiet" onClick={() => setMode('menu')}>Back</button><button className="primary" disabled={selectedCards.length === 0} onClick={refreshHand}>Replace {selectedCards.length || ''} card{selectedCards.length === 1 ? '' : 's'}</button></footer>
            </div>}

            {mode === 'own-need' && <div className="magnifier-choice-body">
              <p>Choose the Public Need to replace.</p>
              <div className="magnifier-need-picker">{player.publicNeeds.map((slot) => <button key={slot.card.id} className={needChoice?.cardId === slot.card.id ? 'selected' : ''} onClick={() => setNeedChoice({ cognitionId: player.id, cardId: slot.card.id })}><span>{slot.card.feeling}</span><strong>{slot.card.need}</strong><b><GiftIcon variation={0} />{slot.gifts}</b></button>)}</div>
              <footer><button className="quiet" onClick={() => setMode('menu')}>Back</button><button className="primary" disabled={!needChoice} onClick={replaceOwn}>Replace Need</button></footer>
            </div>}

            {mode === 'other-need' && <div className="magnifier-choice-body">
              <p>Choose a Need and ask its Cognition. A refusal does not spend the Magnifier.</p>
              <div className="magnifier-need-picker">{game.cognitions.filter((cognition) => !cognition.human).flatMap((cognition) => cognition.publicNeeds.map((slot) => <button key={`${cognition.id}:${slot.card.id}`} className={needChoice?.cognitionId === cognition.id && needChoice.cardId === slot.card.id ? 'selected' : ''} onClick={() => setNeedChoice({ cognitionId: cognition.id, cardId: slot.card.id })}><span>{cognition.name} · {slot.card.feeling}</span><strong>{slot.card.need}</strong><b><GiftIcon variation={cognition.id === 'beta' ? 1 : 2} />{slot.gifts}</b></button>))}</div>
              <footer><button className="quiet" onClick={() => setMode('menu')}>Back</button><button className="primary" disabled={!needChoice} onClick={replaceOther}>Ask permission</button></footer>
            </div>}

            {mode === 'review-confirm' && <div className="magnifier-choice-body review-confirm">
              <CardBack kind="need" className="large-private" />
              <p>The card returns face down when you close it.</p>
              <footer><button className="quiet" onClick={() => setMode('menu')}>Back</button><button className="primary" onClick={review}>Review Need</button></footer>
            </div>}

            {mode === 'reviewing' && <div className="magnifier-choice-body reviewing">
              <span>Look carefully</span>
              <CardFace kind="need" id={player.privateNeed.card.id} />
              <h2>{player.privateNeed.card.feeling}: {player.privateNeed.card.need}</h2>
              <button className="primary" onClick={close}>Return face down</button>
            </div>}
          </section>
        </dialog>, document.body)}
    </>
  )
}
