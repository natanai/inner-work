import { useState } from 'react'
import { CardBack } from './tabletop/Cards'
import { DealScreen } from './tabletop/DealScreen'
import { PlayScreen } from './tabletop/PlayScreen'
import { continueRound, createGame, nextSituation, resolveRound, type GameState } from './tabletop/model'

function Home({ onStart }: { onStart: () => void }) {
  const [rules, setRules] = useState(false)
  return <main className="home-page"><section className="home-table">
    <div className="home-copy"><span>A cooperative card game for one whole person</span><h1>Inner<br />Work</h1><p>Play as Cognition α alongside two hidden-hand NPCs. Draw a Situation, discover Needs, and choose Strategies that tend the shared psyche.</p><div><button className="primary" onClick={onStart}>Set up the table</button><button className="quiet" onClick={() => setRules(!rules)}>{rules ? 'Hide overview' : 'How it plays'}</button></div>{rules && <aside><strong>One turn at a time.</strong><p>Your Public Needs and Strategy hand are visible. NPC hands and all Private Needs stay facedown. Choose one Strategy; the NPCs choose secretly; all three reveal together.</p></aside>}</div>
    <div className="home-cards"><CardBack kind="need" /><CardBack kind="strategy" /><CardBack kind="situation" /></div>
  </section></main>
}

function DayEnd({ game, onAgain, onHome }: { game: GameState; onAgain: () => void; onHome: () => void }) {
  const scores = game.cognitions.map((cognition) => cognition.privateScore)
  const highest = Math.max(...scores)
  const balance = highest === 0 ? 100 : Math.round((Math.min(...scores) / highest) * 100)
  return <main className="end-page"><section><span>The table is cleared</span><h1>What did the whole psyche receive?</h1><div className="end-scores"><article><b>{game.sharedScore}</b><span>shared gifts</span></article><article><b>{game.situationNumber}</b><span>situations</span></article><article><b>{balance}%</b><span>balance</span></article></div><div className="cognition-scores">{game.cognitions.map((cognition) => <p key={cognition.id}><span>{cognition.name}</span><b>{cognition.privateScore} private</b></p>)}</div><div><button className="primary" onClick={onAgain}>Play another day</button><button className="quiet" onClick={onHome}>Home</button></div></section></main>
}

export default function App() {
  const [screen, setScreen] = useState<'home' | 'deal' | 'play' | 'end'>('home')
  const [game, setGame] = useState<GameState | null>(null)
  const start = () => { setGame(createGame()); setScreen('deal') }
  if (!game || screen === 'home') return <Home onStart={start} />
  if (screen === 'deal') return <DealScreen game={game} onDone={() => setScreen('play')} />
  if (screen === 'end') return <DayEnd game={game} onAgain={start} onHome={() => setScreen('home')} />
  return <PlayScreen game={game} onChange={(next) => {
    if (next === game) setGame(game.phase === 'planning' ? resolveRound(game) : continueRound(game))
    else setGame(next)
  }} onNextSituation={() => { setGame(nextSituation(game)); setScreen('deal') }} onEnd={() => setScreen('end')} />
}
