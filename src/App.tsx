import { useEffect, useMemo, useState } from 'react'
import { CardBack } from './tabletop/Cards'
import { preloadGameAssets } from './tabletop/cardAssets'
import { DealScreen } from './tabletop/DealScreen'
import { MobileDealScreen } from './tabletop/MobileDealScreen'
import { MobilePlayScreen } from './tabletop/MobilePlayScreen'
import { PlayScreen } from './tabletop/PlayScreen'
import { continueRound, createGame, nextSituation, resolveRound, type GameState } from './tabletop/model'

function usePhoneLayout(): boolean {
  const query = '(max-width: 760px)'
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)

  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setPhone(media.matches)
    update()
    if (media.addEventListener) media.addEventListener('change', update)
    else media.addListener(update)
    return () => {
      if (media.removeEventListener) media.removeEventListener('change', update)
      else media.removeListener(update)
    }
  }, [])

  return phone
}

function Home({ onStart }: { onStart: () => void }) {
  const [rules, setRules] = useState(false)
  return <main className="home-page"><section className="home-table">
    <div className="home-copy"><span>A cooperative card game for one whole person</span><h1>Inner<br />Work</h1><p>Play as Cognition α alongside two hidden-hand NPCs. Draw a Situation, discover Needs, and choose Strategies that tend the shared psyche.</p><div><button className="primary" onClick={onStart}>Set up the table</button><button className="quiet" onClick={() => setRules(!rules)}>{rules ? 'Hide overview' : 'How it plays'}</button></div>{rules && <aside><strong>One turn at a time.</strong><p>Your Public Needs and Strategy hand are visible. NPC hands and all Private Needs stay facedown. Choose one Strategy; the NPCs choose secretly; all three reveal together.</p></aside>}</div>
    <div className="home-cards"><CardBack kind="need" /><CardBack kind="strategy" /><CardBack kind="situation" /></div>
  </section></main>
}

function LoadingScreen({ game, onReady }: { game: GameState; onReady: () => void }) {
  const [progress, setProgress] = useState({ completed: 0, total: 1 })
  const [error, setError] = useState<string | null>(null)
  const percentage = Math.round((progress.completed / progress.total) * 100)
  const key = useMemo(() => `${game.situation.id}-${game.round}-${game.cognitions.map((cognition) => cognition.hand.map((card) => card.id).join(',')).join('|')}`, [game])

  useEffect(() => {
    let active = true
    setError(null)
    preloadGameAssets(game, (completed, total) => {
      if (active) setProgress({ completed, total: Math.max(total, 1) })
    }).then(() => {
      if (active) onReady()
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'The card library could not be prepared.')
    })
    return () => { active = false }
  }, [key])

  return <main className="loading-page"><section className="loading-table">
    <div className="loading-decks" aria-hidden="true"><CardBack kind="need" /><CardBack kind="situation" /><CardBack kind="strategy" /></div>
    <span className="caption">Preparing the table</span>
    <h1>Shuffling the full-size cards…</h1>
    <p>The game is loading only the cards needed for this deal. The rest of the library will wait until it is needed.</p>
    <div className="loading-progress" aria-label={`${percentage}% loaded`}><i style={{ width: `${percentage}%` }} /></div>
    <strong>{error ? 'A card could not be loaded.' : `${progress.completed} of ${progress.total} cards ready`}</strong>
    {error && <><small>{error}</small><button className="primary" onClick={() => window.location.reload()}>Try again</button></>}
  </section></main>
}

function DayEnd({ game, onAgain, onHome }: { game: GameState; onAgain: () => void; onHome: () => void }) {
  const scores = game.cognitions.map((cognition) => cognition.privateScore)
  const highest = Math.max(...scores)
  const balance = highest === 0 ? 100 : Math.round((Math.min(...scores) / highest) * 100)
  return <main className="end-page"><section><span>The table is cleared</span><h1>What did the whole psyche receive?</h1><div className="end-scores"><article><b>{game.sharedScore}</b><span>shared gifts</span></article><article><b>{game.situationNumber}</b><span>situations</span></article><article><b>{balance}%</b><span>balance</span></article></div><div className="cognition-scores">{game.cognitions.map((cognition) => <p key={cognition.id}><span>{cognition.name}</span><b>{cognition.privateScore} private</b></p>)}</div><div><button className="primary" onClick={onAgain}>Play another day</button><button className="quiet" onClick={onHome}>Home</button></div></section></main>
}

type Screen = 'home' | 'loading' | 'deal' | 'play' | 'end'
type ReadyScreen = 'deal' | 'play'

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [readyScreen, setReadyScreen] = useState<ReadyScreen>('deal')
  const [game, setGame] = useState<GameState | null>(null)
  const phone = usePhoneLayout()

  const prepare = (nextGame: GameState, destination: ReadyScreen) => {
    setGame(nextGame)
    setReadyScreen(destination)
    setScreen('loading')
  }
  const start = () => prepare(createGame(), 'deal')

  if (!game || screen === 'home') return <Home onStart={start} />
  if (screen === 'loading') return <LoadingScreen game={game} onReady={() => setScreen(readyScreen)} />
  if (screen === 'deal') return phone
    ? <MobileDealScreen game={game} onDone={() => setScreen('play')} />
    : <DealScreen game={game} onDone={() => setScreen('play')} />
  if (screen === 'end') return <DayEnd game={game} onAgain={start} onHome={() => setScreen('home')} />

  const handleChange = (next: GameState) => {
    if (next !== game) {
      setGame(next)
      return
    }
    if (game.phase === 'planning') {
      setGame(resolveRound(game))
      return
    }
    prepare(continueRound(game), 'play')
  }
  const handleNextSituation = () => prepare(nextSituation(game), 'deal')
  const handleEnd = () => setScreen('end')

  return phone
    ? <MobilePlayScreen game={game} onChange={handleChange} onNextSituation={handleNextSituation} onEnd={handleEnd} />
    : <PlayScreen game={game} onChange={handleChange} onNextSituation={handleNextSituation} onEnd={handleEnd} />
}
