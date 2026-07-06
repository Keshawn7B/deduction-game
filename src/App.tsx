import { Route, Routes } from 'react-router-dom'
import { RulesLegend } from './components/game/RulesLegend'
import { GameBackdrop } from './components/layout/GameBackdrop'
import { GamePage } from './pages/GamePage'
import { GuessPage } from './pages/GuessPage'
import { HomePage } from './pages/HomePage'
import { LobbyPage } from './pages/LobbyPage'
import { WinnerPage } from './pages/WinnerPage'

export default function App() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-slate-950 text-slate-100">
      <GameBackdrop />
      <div className="relative z-10">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/lobby/:roomCode" element={<LobbyPage />} />
          <Route path="/game/:roomCode" element={<GamePage />} />
          <Route path="/game/:roomCode/guess" element={<GuessPage />} />
          <Route path="/winner/:roomCode" element={<WinnerPage />} />
        </Routes>
      </div>
      <RulesLegend />
    </main>
  )
}
