import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { useGame } from './useGame'
import { LANGUAGES, useI18n } from './i18n'
import { useTheme, type ThemeChoice } from './theme'
import { PlayerSetup } from './components/PlayerSetup'
import { Scoreboard } from './components/Scoreboard'
import { ExpansionPicker } from './components/ExpansionPicker'
import { RoomPanel } from './components/RoomPanel'
import { UpdatePrompt } from './components/UpdatePrompt'
import { useMessageAlerts } from './useMessageAlerts'

export default function App() {
  const { t } = useI18n()
  const game = useGame()
  const { state, room } = game
  const alerts = useMessageAlerts(state, game.syncEpoch, {
    earnMessage: game.earnMessage,
    dismissMessage: game.dismissMessage,
    resolveMessages: game.resolveMessages,
  })
  const [menuOpen, setMenuOpen] = useState(false)
  const [expansionsOpen, setExpansionsOpen] = useState(false)
  const [roomPanelOpen, setRoomPanelOpen] = useState(false)

  // Close the header menu on an outside click or Escape. A plain overlay div
  // can't do this here: the header's `backdrop-blur` makes it a containing
  // block for `position: fixed`, so a `fixed inset-0` catcher would only cover
  // the header strip, not the body. A document-level listener sidesteps that.
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

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
            {/* The title shows on every size: moving the language + theme
                controls into the menu freed up the header strip, so the phone
                no longer needs to lean on the 🏰 alone for the brand. */}
            <h1 className="text-lg font-bold leading-tight">
              {t.appTitle}
              <span className="block text-xs font-normal text-fg/50">
                {t.appSubtitle}
              </span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
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

            {/* The menu is always available. Before the game starts it carries
                only appearance settings (language + theme); once playing it also
                holds the game actions. */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-fg/80 hover:bg-overlay/10"
              >
                {t.menu} ▾
              </button>
              {menuOpen && (
                <div className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-xl border border-line/10 bg-surface shadow-xl">
                  {state.started && (
                    <>
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
                              // resetScores / newGame clear pendingMessages in
                              // the reducer (synced), so no local clear needed.
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
                      <div className="border-t border-line/10" />
                    </>
                  )}
                  <MenuAppearance />
                </div>
              )}
            </div>
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
        <div className="pointer-events-auto rounded-xl border border-amber-400/30 bg-amber-500/20 px-4 py-3 text-sm font-semibold text-amber-900 shadow-2xl backdrop-blur dark:text-amber-50">
          {text}
        </div>
      )}
    </div>
  )
}

/**
 * Appearance settings rendered inside the header menu: a language picker and a
 * theme picker, each a small segmented control. Tapping a swatch deliberately
 * leaves the menu open (the outside-click closer ignores in-menu clicks) so a
 * player can flip both without reopening.
 */
function MenuAppearance() {
  const { t, lang, setLang } = useI18n()
  const { theme, setTheme } = useTheme()
  const themes: { value: ThemeChoice; icon: string; label: string }[] = [
    { value: 'light', icon: '☀️', label: t.themeLight },
    { value: 'dark', icon: '🌙', label: t.themeDark },
    { value: 'system', icon: '🖥️', label: t.themeSystem },
  ]
  return (
    <>
      <SettingRow label={t.languageLabel}>
        {LANGUAGES.map((l) => (
          <SegButton
            key={l.code}
            active={lang === l.code}
            onClick={() => setLang(l.code)}
          >
            {l.label}
          </SegButton>
        ))}
      </SettingRow>
      <SettingRow label={t.themeLabel}>
        {themes.map((o) => (
          <SegButton
            key={o.value}
            active={theme === o.value}
            onClick={() => setTheme(o.value)}
            ariaLabel={o.label}
            title={o.label}
          >
            <span aria-hidden>{o.icon}</span>
          </SegButton>
        ))}
      </SettingRow>
    </>
  )
}

function SettingRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <span className="text-sm text-fg/90">{label}</span>
      <div className="flex shrink-0 rounded-lg bg-overlay/5 p-0.5 text-xs font-semibold">
        {children}
      </div>
    </div>
  )
}

function SegButton({
  active,
  onClick,
  ariaLabel,
  title,
  children,
}: {
  active: boolean
  onClick: () => void
  ariaLabel?: string
  title?: string
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel}
      title={title}
      className={`rounded-md px-2 py-1 transition ${
        active ? 'bg-overlay/15 text-fg' : 'text-fg/50 hover:text-fg/80'
      }`}
    >
      {children}
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
