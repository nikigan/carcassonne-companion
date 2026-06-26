import { useState } from 'react'
import { useGame } from './useGame'
import { LANGUAGES, useI18n } from './i18n'
import { PlayerSetup } from './components/PlayerSetup'
import { Scoreboard } from './components/Scoreboard'
import { ExpansionPicker } from './components/ExpansionPicker'
import { RoomPanel } from './components/RoomPanel'

export default function App() {
  const { t, lang, setLang } = useI18n()
  const game = useGame()
  const { state, room } = game
  const [menuOpen, setMenuOpen] = useState(false)
  const [expansionsOpen, setExpansionsOpen] = useState(false)
  const [roomPanelOpen, setRoomPanelOpen] = useState(false)

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
              {t.appTitle}
              <span className="block text-xs font-normal text-white/50">
                {t.appSubtitle}
              </span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-lg bg-white/5 p-0.5 text-xs font-semibold">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={`rounded-md px-2 py-1 transition ${
                    lang === l.code
                      ? 'bg-white/15 text-white'
                      : 'text-white/50 hover:text-white/80'
                  }`}
                  aria-pressed={lang === l.code}
                >
                  {l.label}
                </button>
              ))}
            </div>

            {room && (
              <button
                onClick={() => setRoomPanelOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1 text-xs font-mono"
                aria-label={`${room.code} — ${room.status === 'open' ? t.statusConnected : room.status === 'reconnecting' ? t.statusReconnecting : t.statusConnecting}`}
              >
                <span className={`h-2 w-2 rounded-full ${room.status === 'open' ? 'bg-green-400' : room.status === 'reconnecting' ? 'bg-amber-400' : 'bg-white/40'}`} />
                {room.code}
              </button>
            )}

            {state.started && (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10"
                >
                  {t.menu} ▾
                </button>
                {menuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setMenuOpen(false)}
                    />
                    <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-white/10 bg-gray-800 shadow-xl">
                      {!room ? (
                        <MenuItem
                          label={`${t.shareGame} 🔗`}
                          onClick={async () => {
                            await game.createRoom()
                            setRoomPanelOpen(true)
                            setMenuOpen(false)
                          }}
                        />
                      ) : (
                        <MenuItem
                          label={`${t.roomTitle} 🔗`}
                          onClick={() => {
                            setRoomPanelOpen(true)
                            setMenuOpen(false)
                          }}
                        />
                      )}
                      <MenuItem
                        label={t.editPlayers}
                        onClick={() => {
                          game.editPlayers()
                          setMenuOpen(false)
                        }}
                      />
                      <MenuItem
                        label={`${t.expansionsTitle} 🧩`}
                        onClick={() => {
                          setExpansionsOpen(true)
                          setMenuOpen(false)
                        }}
                      />
                      {state.expansions.tradersBuilders && (
                        <MenuItem
                          label={`${t.scoreTradeGoods} 🛢️`}
                          onClick={() => {
                            game.scoreTradeGoods()
                            setMenuOpen(false)
                          }}
                        />
                      )}
                      {state.expansions.goldMines && (
                        <MenuItem
                          label={`${t.scoreGold} 🟨`}
                          onClick={() => {
                            game.scoreGoldIngots()
                            setMenuOpen(false)
                          }}
                        />
                      )}
                      {/* Nuclear actions: solo always; in a room only the host. */}
                      {(!room || room.isHost) && (
                        <>
                          <MenuItem
                            label={t.resetScores}
                            onClick={() => {
                              if (confirm(t.confirmReset)) game.resetScores()
                              setMenuOpen(false)
                            }}
                          />
                          <MenuItem
                            label={t.newGame}
                            danger
                            onClick={() => {
                              if (confirm(t.confirmNewGame)) game.newGame()
                              setMenuOpen(false)
                            }}
                          />
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main>
        {state.started ? (
          <Scoreboard
            state={state}
            onScore={game.addScore}
            onRecordTokens={game.recordTokens}
            onUndo={game.undoEntry}
          />
        ) : (
          <PlayerSetup
            players={state.players}
            expansions={state.expansions}
            onAdd={game.addPlayer}
            onUpdate={game.updatePlayer}
            onRemove={game.removePlayer}
            onToggleExpansion={game.setExpansion}
            onStart={game.startGame}
            onCreateRoom={async () => { await game.createRoom(); setRoomPanelOpen(true) }}
            onJoinRoom={game.joinRoom}
            inRoom={room !== null}
          />
        )}
      </main>

      {expansionsOpen && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 sm:items-center"
          onClick={() => setExpansionsOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-gray-800 p-5 shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">{t.expansionsTitle}</h2>
              <button
                onClick={() => setExpansionsOpen(false)}
                className="rounded-lg px-2 py-1 text-white/50 hover:bg-white/10"
                aria-label={t.close}
              >
                ✕
              </button>
            </div>
            <p className="mb-3 text-xs text-white/50">{t.expansionsHint}</p>
            <ExpansionPicker
              config={state.expansions}
              onToggle={game.setExpansion}
            />
          </div>
        </div>
      )}

      {roomPanelOpen && room && (
        <RoomPanel
          code={room.code}
          onClose={() => setRoomPanelOpen(false)}
          onLeave={() => { game.leaveRoom(); setRoomPanelOpen(false) }}
        />
      )}

      {state.started && leader && state.log.length > 0 && (
        <footer className="pb-8 text-center text-xs text-white/30">
          {t.leads(leader.name, leader.score)}
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
