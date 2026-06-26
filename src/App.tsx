import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { useGame } from './useGame'
import { LANGUAGES, useI18n } from './i18n'
import { useTheme } from './theme'
import { PlayerSetup } from './components/PlayerSetup'
import { Scoreboard } from './components/Scoreboard'
import { ExpansionPicker } from './components/ExpansionPicker'
import { RoomPanel } from './components/RoomPanel'
import { UpdatePrompt } from './components/UpdatePrompt'
import { useMessageAlerts } from './useMessageAlerts'

export default function App() {
  const { t, lang, setLang } = useI18n()
  const game = useGame()
  const { state, room } = game
  const alerts = useMessageAlerts(state)
  const [menuOpen, setMenuOpen] = useState(false)
  const [expansionsOpen, setExpansionsOpen] = useState(false)
  const [roomPanelOpen, setRoomPanelOpen] = useState(false)

  // Measure the sticky header so the tablet two-column layout can offset the
  // sticky players column by exactly its height (it varies with the top
  // safe-area inset). Exposed as the CSS var `--app-header-h` on the root.
  const headerRef = useRef<HTMLElement>(null)
  const [headerHeight, setHeaderHeight] = useState(0)
  useLayoutEffect(() => {
    const el = headerRef.current
    if (!el) return
    const measure = () => setHeaderHeight(el.offsetHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const leader =
    state.started && state.players.length
      ? [...state.players].sort((a, b) => b.score - a.score)[0]
      : null

  return (
    <div
      className="min-h-dvh bg-canvas text-fg"
      style={{ '--app-header-h': `${headerHeight}px` } as CSSProperties}
    >
      <header
        ref={headerRef}
        className="sticky top-0 z-20 border-b border-line/10 bg-canvas/90 pt-[env(safe-area-inset-top)] backdrop-blur"
      >
        <div className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-3 md:max-w-5xl">
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden>
              🏰
            </span>
            <h1 className="text-lg font-bold leading-tight">
              {t.appTitle}
              <span className="block text-xs font-normal text-fg/50">
                {t.appSubtitle}
              </span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-lg bg-overlay/5 p-0.5 text-xs font-semibold">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={`rounded-md px-2 py-1 transition ${
                    lang === l.code
                      ? 'bg-overlay/15 text-fg'
                      : 'text-fg/50 hover:text-fg/80'
                  }`}
                  aria-pressed={lang === l.code}
                >
                  {l.label}
                </button>
              ))}
            </div>

            <ThemeToggle />

            {room && (
              <button
                onClick={() => setRoomPanelOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-overlay/5 px-2 py-1 text-xs font-mono"
                aria-label={`${room.code} — ${room.status === 'open' ? t.statusConnected : room.status === 'reconnecting' ? t.statusReconnecting : t.statusConnecting}`}
              >
                <span className={`h-2 w-2 rounded-full ${room.status === 'open' ? 'bg-green-400' : room.status === 'reconnecting' ? 'bg-amber-400' : 'bg-overlay/40'}`} />
                {room.code}
              </button>
            )}

            {state.started && (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-fg/80 hover:bg-overlay/10"
                >
                  {t.menu} ▾
                </button>
                {menuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setMenuOpen(false)}
                    />
                    <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-line/10 bg-surface shadow-xl">
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
                      <MenuItem
                        label={`${alerts.soundOn ? '🔔' : '🔕'} ${t.soundLabel}`}
                        onClick={() => alerts.setSoundOn(!alerts.soundOn)}
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
                              if (confirm(t.confirmReset)) {
                                game.resetScores()
                                alerts.clear()
                              }
                              setMenuOpen(false)
                            }}
                          />
                          <MenuItem
                            label={t.newGame}
                            danger
                            onClick={() => {
                              if (confirm(t.confirmNewGame)) {
                                game.newGame()
                                alerts.clear()
                              }
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
            messagePending={alerts.pending}
            onClearMessages={alerts.clear}
            onDismissMessage={alerts.dismiss}
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
          className="fixed inset-0 z-30 flex items-end justify-center bg-scrim/60 sm:items-center"
          onClick={() => setExpansionsOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">{t.expansionsTitle}</h2>
              <button
                onClick={() => setExpansionsOpen(false)}
                className="rounded-lg px-2 py-1 text-fg/50 hover:bg-overlay/10"
                aria-label={t.close}
              >
                ✕
              </button>
            </div>
            <p className="mb-3 text-xs text-fg/50">{t.expansionsHint}</p>
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
        <footer className="pb-8 text-center text-xs text-fg/30">
          {t.leads(leader.name, leader.score)}
        </footer>
      )}

      <MessageToast show={alerts.toast !== null} text={t.messageAvailable} />
      <UpdatePrompt />
    </div>
  )
}

/**
 * Small, generic attention toast for an earned message. Deliberately names no
 * player — who actually draws the tile isn't known yet. Sits just above the
 * update toast. Mounted at all times so screen readers announce content flips.
 */
function MessageToast({ show, text }: { show: boolean; text: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(5rem,calc(env(safe-area-inset-bottom)+5rem))]"
    >
      {show && (
        <div className="pointer-events-auto rounded-xl border border-amber-400/30 bg-amber-500/20 px-4 py-3 text-sm font-semibold text-amber-50 shadow-2xl backdrop-blur">
          {text}
        </div>
      )}
    </div>
  )
}

function ThemeToggle() {
  const { t } = useI18n()
  const { theme, cycle } = useTheme()
  const icon = theme === 'light' ? '☀️' : theme === 'dark' ? '🌙' : '🖥️'
  const label =
    theme === 'light'
      ? t.themeLight
      : theme === 'dark'
        ? t.themeDark
        : t.themeSystem
  return (
    <button
      onClick={cycle}
      className="rounded-lg bg-overlay/5 px-2 py-1 text-base leading-none transition hover:bg-overlay/10"
      aria-label={t.themeToggleAria(label)}
      title={label}
    >
      <span aria-hidden>{icon}</span>
    </button>
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
      className={`block w-full px-4 py-3 text-left text-sm hover:bg-overlay/10 ${
        danger ? 'text-red-400' : 'text-fg/90'
      }`}
    >
      {label}
    </button>
  )
}
