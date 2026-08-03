import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CardBack, CardFace, GiftIcon } from './Cards'
import { generateDirectedTradeOptions, distinctDirectedTradePaths, type DirectedTradeOption } from './directedTrading'
import {
  beginPrivateReviewWithMagnifier,
  endPrivateReview,
  replaceOwnPublicNeedWithMagnifier,
  replaceStrategiesWithMagnifier,
  requestNpcPublicNeedReplacement,
} from './magnifierActions'
import { canPlay, type CognitionId, type GameState } from './model'
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
    setNotice(`Trade complete: you asked for ${option.requestedNeed} and received “${option.npcGives.title}.” You may make another trade before committing.`)
  }

  return (
    <section className="directed-trade-panel">
      <header>
        <span>Ask for what you need</span>
        <h2>Initiate a trade instead of waiting for a suggestion.</h2>
        <p>Choose a Need. An NPC reveals only a specific card it can offer and the card it would accept from you. You may complete any number of exchanges during Discussion.</p>
      </header>
      {notice && <p className="choice-notice">{notice}</p>}
      {needs.length === 0 ? (
        <p className="choice-empty">No mutually legal directed trade is available with the current hidden hands.</p>
      ) : (
        <>
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
                <header><span>{option.npcName} can help with</span><strong>{option.requestedNeed}</strong></header>
                <div className="directed-trade-cards">
                  <section><small>You give</small><CardFace kind="strategy" id={option.playerGives.id} /><b>{option.playerGives.title}</b></section>
                  <i aria-hidden="true">⇄</i>
                  <section><small>You receive</small><CardFace kind="strategy" id={option.npcGives.id} /><b>{option.npcGives.title}</b></section>
                </div>
                <p>{option.npcName} can legally use your card. The offered card lets you play through {option.requestedNeed}.</p>
                <button className="primary" onClick={() => accept(option)}>Make this trade</button>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function ChoicePathSummary({ game }: { game: GameState }) {
  const player = game.cognitions.find((cognition) => cognition.human) ?? game.cognitions[0]
  const bonuses = game.bonusNeeds.filter((bonus) => bonus.gifts > 0 && bonus.availableRound <= game.round)
  const legal = player.hand.filter((card) => canPlay(player, card, bonuses)).length
  const trades = distinctDirectedTradePaths(game)
  const magnifier = player.magnifierUsed ? 0 : 4
  const total = legal + trades + magnifier
  return (
    <aside className="choice-path-summary" aria-label={`${total} currently available planning paths`}>
      <div><span>Choice check</span><strong>{total} planning path{total === 1 ? '' : 's'} visible</strong></div>
      <p><b>{legal}</b> playable card{legal === 1 ? '' : 's'} <b>{trades}</b> directed trade{trades === 1 ? '' : 's'} <b>{magnifier}</b> Magnifier action{magnifier === 1 ? '' : 's'}</p>
    </aside>
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
    window.addEventListener('inner-work:review-private', handler)
    return () => {
      window.removeEventListener('inner-work:open-magnifier', handler)
      window.removeEventListener('inner-work:review-private', handler)
    }
  }, [game, player.magnifierUsed])

  useEffect(() => {
    if (player.magnifierUsed && mode !== 'reviewing') setMagnifierOpen(false)
  }, [player.magnifierUsed])

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

  const planningInsertion = tradeTarget ? createPortal(<>
    <ChoicePathSummary game={game} />
    <DirectedTradePanel game={game} onGameChange={onGameChange} />
    {!player.magnifierUsed && <button className="magnifier-choice-launch" onClick={openMagnifier}><span>Magnifying glass</span><strong>Choose one of four once-per-Situation actions</strong></button>}
  </>, tradeTarget) : null

  return (
    <>
      {children}
      {planningInsertion}
      {magnifierOpen && createPortal(
        <dialog open className="magnifier-choice-dialog" onClick={close} aria-label="Choose a Magnifying Glass action">
          <section onClick={(event) => event.stopPropagation()}>
            <header><div><span>Magnifying glass · once this Situation</span><h1>{mode === 'menu' ? 'Choose how to use it.' : 'Confirm this action.'}</h1></div><button onClick={close} aria-label="Close Magnifier menu">×</button></header>
            {notice && <p className="choice-notice">{notice}</p>}

            {mode === 'menu' && <div className="magnifier-action-grid">
              <button onClick={() => setMode('refresh')}><b>↻</b><span><strong>Replace Strategy cards</strong><small>Choose any number from your hand and draw the same number.</small></span></button>
              <button onClick={() => setMode('own-need')}><b>＋</b><span><strong>Replace one of your Public Needs</strong><small>Remove one and place two new Public Needs in its place.</small></span></button>
              <button onClick={() => setMode('other-need')}><b>?</b><span><strong>Request a change for another Cognition</strong><small>Ask permission to replace one of its Public Needs with two new ones.</small></span></button>
              <button onClick={() => setMode('review-confirm')}><b>⌕</b><span><strong>Review your Private Need</strong><small>Look once, then return it face down and rely on memory.</small></span></button>
            </div>}

            {mode === 'refresh' && <div className="magnifier-choice-body">
              <p>Select every card you want to replace. This spends the Magnifier once, regardless of how many you choose.</p>
              <div className="magnifier-card-picker">{player.hand.map((card) => {
                const chosen = selectedCards.includes(card.id)
                return <button key={card.id} className={chosen ? 'selected' : ''} onClick={() => setSelectedCards(chosen ? selectedCards.filter((id) => id !== card.id) : [...selectedCards, card.id])}><CardFace kind="strategy" id={card.id} /><span>{chosen ? 'Replace' : 'Keep'}</span></button>
              })}</div>
              <footer><button className="quiet" onClick={() => setMode('menu')}>Back</button><button className="primary" disabled={selectedCards.length === 0} onClick={refreshHand}>Replace {selectedCards.length || ''} card{selectedCards.length === 1 ? '' : 's'}</button></footer>
            </div>}

            {mode === 'own-need' && <div className="magnifier-choice-body">
              <p>Choose one Public Need to remove. Two newly drawn Public Needs will replace it and receive this Situation’s normal setup gifts.</p>
              <div className="magnifier-need-picker">{player.publicNeeds.map((slot) => <button key={slot.card.id} className={needChoice?.cardId === slot.card.id ? 'selected' : ''} onClick={() => setNeedChoice({ cognitionId: player.id, cardId: slot.card.id })}><span>{slot.card.feeling}</span><strong>{slot.card.need}</strong><b><GiftIcon variation={0} />{slot.gifts}</b></button>)}</div>
              <footer><button className="quiet" onClick={() => setMode('menu')}>Back</button><button className="primary" disabled={!needChoice} onClick={replaceOwn}>Spend Magnifier and replace</button></footer>
            </div>}

            {mode === 'other-need' && <div className="magnifier-choice-body">
              <p>Choose a Public Need and ask its Cognition. The NPC accepts when the two replacements create at least as many connections with its hidden hand. A declined request does not spend the Magnifier.</p>
              <div className="magnifier-need-picker">{game.cognitions.filter((cognition) => !cognition.human).flatMap((cognition) => cognition.publicNeeds.map((slot) => <button key={`${cognition.id}:${slot.card.id}`} className={needChoice?.cognitionId === cognition.id && needChoice.cardId === slot.card.id ? 'selected' : ''} onClick={() => setNeedChoice({ cognitionId: cognition.id, cardId: slot.card.id })}><span>{cognition.name} · {slot.card.feeling}</span><strong>{slot.card.need}</strong><b><GiftIcon variation={cognition.id === 'beta' ? 1 : 2} />{slot.gifts}</b></button>))}</div>
              <footer><button className="quiet" onClick={() => setMode('menu')}>Back</button><button className="primary" disabled={!needChoice} onClick={replaceOther}>Ask permission</button></footer>
            </div>}

            {mode === 'review-confirm' && <div className="magnifier-choice-body review-confirm">
              <CardBack kind="need" className="large-private" />
              <p>Using this action spends the Magnifier for the Situation. The card will return face down when you close the review.</p>
              <footer><button className="quiet" onClick={() => setMode('menu')}>Back</button><button className="primary" onClick={review}>Use Magnifier</button></footer>
            </div>}

            {mode === 'reviewing' && <div className="magnifier-choice-body reviewing">
              <span>Look carefully</span>
              <CardFace kind="need" id={player.privateNeed.card.id} />
              <h2>{player.privateNeed.card.feeling}: {player.privateNeed.card.need}</h2>
              <p>Any Cognition’s legally played Strategy may incidentally tend this Need. Its gift becomes your individual point.</p>
              <button className="primary" onClick={close}>Return it face down</button>
            </div>}
          </section>
        </dialog>, document.body)}
    </>
  )
}
