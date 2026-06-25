import { useState } from 'react'
import { useGame } from './useGame'
import { PlayerSetup } from './components/PlayerSetup'
import { Scoreboard } from './components/Scoreboard'

export default function App() {
  const game = useGame()
  const { state } = game
  const [menuOpen, setMenuOpen] = useState(false)

  const leader =
    state.started && state.players.length
      ? [...state.players].sort((a, b) => b.score - a.score)[0]
      : null

  return (
    <div className="min-h-full bg-gray-900 text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-gray-900/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden>
              🏰
            </span>
            <h1 className="text-lg font-bold leading-tight">
              Carcassonne
              <span className="block text-xs font-normal text-white/50">
                Companion
              </span>
            </h1>
          </div>

          {state.started && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10"
              >
                Menu ▾
              </button>
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-white/10 bg-gray-800 shadow-xl">
                    <MenuItem
                      label="Edit players"
                      onClick={() => {
                        game.editPlayers()
                        setMenuOpen(false)
                      }}
                    />
                    <MenuItem
                      label="Reset scores"
                      onClick={() => {
                        if (confirm('Reset all scores to zero?')) game.resetScores()
                        setMenuOpen(false)
                      }}
                    />
                    <MenuItem
                      label="New game"
                      danger
                      onClick={() => {
                        if (confirm('Start a new game? This clears players and scores.'))
                          game.newGame()
                        setMenuOpen(false)
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      <main>
        {state.started ? (
          <Scoreboard
            state={state}
            onScore={game.addScore}
            onUndo={game.undoEntry}
          />
        ) : (
          <PlayerSetup
            players={state.players}
            onAdd={game.addPlayer}
            onUpdate={game.updatePlayer}
            onRemove={game.removePlayer}
            onStart={game.startGame}
          />
        )}
      </main>

      {state.started && leader && state.log.length > 0 && (
        <footer className="pb-8 text-center text-xs text-white/30">
          {leader.name} leads with {leader.score} pts
        </footer>
      )}
    </div>
  )
}

function MenuItem({
  label,
  onClick,
  danger,
}: {
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`block w-full px-4 py-3 text-left text-sm hover:bg-white/10 ${
        danger ? 'text-red-400' : 'text-white/90'
      }`}
    >
      {label}
    </button>
  )
}
