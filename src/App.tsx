import { Route, Routes } from 'react-router-dom'
import { GamePage } from './pages/GamePage'
import { GuessPage } from './pages/GuessPage'
import { HomePage } from './pages/HomePage'
import { LobbyPage } from './pages/LobbyPage'
import { WinnerPage } from './pages/WinnerPage'

export default function App() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/lobby/:roomCode" element={<LobbyPage />} />
        <Route path="/game/:roomCode" element={<GamePage />} />
        <Route path="/game/:roomCode/guess" element={<GuessPage />} />
        <Route path="/winner/:roomCode" element={<WinnerPage />} />
      </Routes>
    </main>
  )
}
