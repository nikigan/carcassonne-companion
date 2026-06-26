# The Messengers — Message Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notify the player whenever they earn a Messengers message tile — a 📜 badge per qualifying player (tap to open their Messages form, ✕ to dismiss), a small generic toast, and a short chime.

**Architecture:** A pure trigger reduces to one check per score (`points % 5 === 0 || newTotal % 5 === 0`), so no two-marker tracking is needed. An isolated hook `useMessageAlerts(state)` watches the score log and owns the ephemeral alert state; `Scoreboard` renders badges; `App` wires the hook, toast, and a sound toggle. `useGame` is untouched.

**Tech Stack:** React 19 + TypeScript (strict) + Tailwind CSS v4 + Vite 6. Web Audio API for the chime. No test runner — `npm run build` (`tsc -b && vite build`) is the gate.

## Global Constraints

- **Build gate:** `npm run build` must stay green (strict type-check). There is no test runner or linter — the build is the only automated check.
- **i18n completeness:** every new key must exist in **both** `en` and `ru` in `src/i18n.ts` (TypeScript enforces this via the `Strings` interface). Russian uses official Hobby World terms.
- **No self-attribution** in commits/comments (per global instructions; the project no longer adds Co-Authored-By trailers).
- **Localization:** no hard-coded user-facing strings in components — add a `Strings` key.
- **Reduced motion:** any animation must be gated (use Tailwind's `motion-safe:` variant).
- **Internal ids stay:** expansion id `messages` and feature kind `message` are unchanged; only display strings get the new-edition names.

---

### Task 1: Sound utility

**Files:**
- Create: `src/sound.ts`

**Interfaces:**
- Produces: `playMessageChime(): void`, `unlockAudio(): void`

- [ ] **Step 1: Create `src/sound.ts`**

```ts
/**
 * Tiny Web Audio "ding" used to flag that a player earned a message tile
 * (The Messengers). Generated programmatically so there's no asset to bundle —
 * keeps the PWA small and works offline.
 */

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  return ctx
}

/** Resume the shared AudioContext. Safe to call from any user gesture. */
export function unlockAudio(): void {
  const c = getCtx()
  if (c && c.state === 'suspended') void c.resume()
}

/** A short two-note chime (A5 → E6) signalling an earned message. */
export function playMessageChime(): void {
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') void c.resume()
  const now = c.currentTime
  const notes = [
    { freq: 880, start: 0, dur: 0.12 }, // A5
    { freq: 1318.51, start: 0.1, dur: 0.2 }, // E6
  ]
  for (const n of notes) {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = n.freq
    gain.gain.setValueAtTime(0.0001, now + n.start)
    gain.gain.exponentialRampToValueAtTime(0.18, now + n.start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur)
    osc.connect(gain).connect(c.destination)
    osc.start(now + n.start)
    osc.stop(now + n.start + n.dur + 0.02)
  }
}

// Unlock the AudioContext on the first user interaction so the chime can play
// later from inside an effect (browsers block audio until a gesture occurs).
if (typeof window !== 'undefined') {
  const unlock = () => {
    unlockAudio()
    window.removeEventListener('pointerdown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS (no type errors).

- [ ] **Step 3: Commit**

```bash
git add src/sound.ts
git commit -m "Add Web Audio chime for message alerts"
```

---

### Task 2: Message-alerts hook

**Files:**
- Create: `src/useMessageAlerts.ts`

**Interfaces:**
- Consumes: `GameState` from `./types`; `playMessageChime` from `./sound`.
- Produces:
  ```ts
  interface MessageAlerts {
    pending: Set<string>
    toast: { id: number } | null
    clear: () => void
    dismiss: (id: string) => void
    soundOn: boolean
    setSoundOn: (on: boolean) => void
  }
  function useMessageAlerts(state: GameState): MessageAlerts
  ```

- [ ] **Step 1: Create `src/useMessageAlerts.ts`**

```ts
import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameState } from './types'
import { playMessageChime } from './sound'

const SOUND_KEY = 'carcassonne-companion:sound'

function loadSoundPref(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}

export interface MessageAlerts {
  /** Player ids currently showing a 📜 badge. */
  pending: Set<string>
  /** Bumped on each qualifying score; drives the attention toast. */
  toast: { id: number } | null
  /** Clear ALL badges — a message was resolved (only the active player draws). */
  clear: () => void
  /** Remove ONE player's badge — they crossed a ÷5 on someone else's turn. */
  dismiss: (id: string) => void
  soundOn: boolean
  setSoundOn: (on: boolean) => void
}

/**
 * The Messengers: a player earns a message when one of their two scoring
 * figures lands on a multiple of 5. With the optimal "÷5 → messenger, rest →
 * meeple" routing this collapses to a single check per score:
 *   amount > 0 && (amount % 5 === 0 || newTotal % 5 === 0)
 * so we only need the latest entry and the player's running total.
 *
 * Ephemeral UI state — not part of GameState/localStorage. Fires only on a
 * single new log entry (so undo, initial load and room-resync never trigger),
 * and de-dupes by entry id (so multiplayer's optimistic→reconciled echo of the
 * same id can't double-fire).
 */
export function useMessageAlerts(state: GameState): MessageAlerts {
  const [pending, setPending] = useState<Set<string>>(() => new Set())
  const [toast, setToast] = useState<{ id: number } | null>(null)
  const [soundOn, setSoundOnState] = useState<boolean>(loadSoundPref)

  const seen = useRef<Set<string>>(new Set())
  const prevLen = useRef(0)
  const init = useRef(false)
  const toastSeq = useRef(0)
  const soundRef = useRef(soundOn)
  soundRef.current = soundOn

  const enabled = state.expansions.messages

  useEffect(() => {
    const log = state.log
    const top = log[0]

    // First run: remember existing entries, never alert for history.
    if (!init.current) {
      init.current = true
      seen.current = new Set(log.map((e) => e.id))
      prevLen.current = log.length
      return
    }

    const grew = log.length === prevLen.current + 1
    prevLen.current = log.length

    if (enabled && top && grew && !seen.current.has(top.id)) {
      const player = state.players.find((p) => p.id === top.playerId)
      if (
        player &&
        top.amount > 0 &&
        (top.amount % 5 === 0 || player.score % 5 === 0)
      ) {
        setPending((prev) => {
          const next = new Set(prev)
          next.add(player.id)
          return next
        })
        toastSeq.current += 1
        setToast({ id: toastSeq.current })
        if (soundRef.current) playMessageChime()
      }
    }

    seen.current = new Set(log.map((e) => e.id))
  }, [state.log, state.players, enabled])

  // Auto-dismiss the toast a few seconds after the latest trigger.
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  const clear = useCallback(
    () => setPending((prev) => (prev.size ? new Set() : prev)),
    [],
  )

  const dismiss = useCallback(
    (id: string) =>
      setPending((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        return next
      }),
    [],
  )

  const setSoundOn = useCallback((on: boolean) => {
    setSoundOnState(on)
    try {
      localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
    } catch {
      // ignore
    }
  }, [])

  return { pending, toast, clear, dismiss, soundOn, setSoundOn }
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS. (The hook is exported but not yet consumed — that's fine for `tsc`.)

- [ ] **Step 3: Commit**

```bash
git add src/useMessageAlerts.ts
git commit -m "Add useMessageAlerts hook for Messengers notifications"
```

---

### Task 3: i18n — new strings + new-edition rename

**Files:**
- Modify: `src/i18n.ts` (interface ~line 174; `en` ~lines 243/286/295/341; `ru` ~lines 413/456/465/511)

**Interfaces:**
- Produces (on `Strings`): `messageAvailable: string`, `messageBadgeAria: (name: string) => string`, `messageDismissAria: (name: string) => string`, `soundLabel: string`.

- [ ] **Step 1: Add the four keys to the `Strings` interface**

In `src/i18n.ts`, find (around line 173-176):

```ts
  statusReconnecting: string
  // PWA update prompt
  updateAvailable: string
  refresh: string
}
```

Replace with:

```ts
  statusReconnecting: string

  // Message alerts (The Messengers)
  messageAvailable: string
  messageBadgeAria: (name: string) => string
  messageDismissAria: (name: string) => string
  soundLabel: string

  // PWA update prompt
  updateAvailable: string
  refresh: string
}
```

- [ ] **Step 2: Add the English values + rename the English Messengers display**

In the `en` table, replace `messageHint` (line 243):

```ts
  messageHint: 'Points received from a message tile (The Messages).',
```

with:

```ts
  messageHint: 'Points received from a message tile (The Messengers).',
```

Replace the `en` `expansionNames.messages` line (286):

```ts
    messages: 'The Messages',
```

with:

```ts
    messages: 'The Messengers',
```

Replace the `en` `expansionDescriptions.messages` line (295):

```ts
    messages: 'Message tiles (manual points).',
```

with:

```ts
    messages: 'Auto-alerts message tiles (manual points).',
```

Add the four new `en` values — replace (lines 340-342):

```ts
  updateAvailable: 'A new version is available.',
  refresh: 'Refresh',
}
```

with:

```ts
  messageAvailable: '📜 A message is available!',
  messageBadgeAria: (name) => `${name} — open message`,
  messageDismissAria: (name) => `${name} — dismiss message`,
  soundLabel: 'Sound',

  updateAvailable: 'A new version is available.',
  refresh: 'Refresh',
}
```

- [ ] **Step 3: Add the Russian values + rename the Russian Messengers display**

In the `ru` table, replace `messageHint` (line 413):

```ts
  messageHint: 'Очки, полученные от послания (Послания).',
```

with:

```ts
  messageHint: 'Очки, полученные от послания (Гонцы).',
```

Replace the `ru` `expansionNames.messages` line (456):

```ts
    messages: 'Послания',
```

with:

```ts
    messages: 'Гонцы',
```

Replace the `ru` `expansionDescriptions.messages` line (465):

```ts
    messages: 'Тайлы посланий (очки вручную).',
```

with:

```ts
    messages: 'Оповещает о тайлах посланий (очки вручную).',
```

Add the four new `ru` values — replace (lines 510-512):

```ts
  updateAvailable: 'Доступно обновление.',
  refresh: 'Обновить',
}
```

with:

```ts
  messageAvailable: '📜 Появилось послание!',
  messageBadgeAria: (name) => `${name} — открыть послание`,
  messageDismissAria: (name) => `${name} — убрать послание`,
  soundLabel: 'Звук',

  updateAvailable: 'Доступно обновление.',
  refresh: 'Обновить',
}
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: PASS. (If a key is missing from one table, `tsc` fails — that's the completeness check working.)

- [ ] **Step 5: Commit**

```bash
git add src/i18n.ts
git commit -m "Add message-alert strings; rename expansion to The Messengers / Гонцы"
```

---

### Task 4: ScoreModal — `initialFeature` prop

**Files:**
- Modify: `src/components/ScoreModal.tsx` (Props ~line 44; destructure ~line 58; PresetForms call ~line 129; `PresetForms` ~line 154)

**Interfaces:**
- Consumes: `FeatureType` (already imported at line 32).
- Produces: `ScoreModal` accepts optional `initialFeature?: FeatureType`; opens the preset grid pre-selected to it.

- [ ] **Step 1: Add `initialFeature` to `Props`**

Replace the `Props` interface (lines 44-53):

```ts
interface Props {
  player: Player
  /** Recent feature scores the castle can borrow its value from. */
  recentFeatures: CastleEntry[]
  /** Active expansions — gates which scoring inputs appear. */
  expansions: ExpansionConfig
  onClose: () => void
  onScore: (amount: number, desc: ScoreDescriptor) => void
  onRecordTokens: (delta: TokenDelta) => void
}
```

with:

```ts
interface Props {
  player: Player
  /** Recent feature scores the castle can borrow its value from. */
  recentFeatures: CastleEntry[]
  /** Active expansions — gates which scoring inputs appear. */
  expansions: ExpansionConfig
  /** Pre-select this feature in the Features grid (e.g. 'message' from a badge). */
  initialFeature?: FeatureType
  onClose: () => void
  onScore: (amount: number, desc: ScoreDescriptor) => void
  onRecordTokens: (delta: TokenDelta) => void
}
```

- [ ] **Step 2: Destructure `initialFeature` and pass it to `PresetForms`**

Replace the destructure (lines 58-65):

```ts
export function ScoreModal({
  player,
  recentFeatures,
  expansions,
  onClose,
  onScore,
  onRecordTokens,
}: Props) {
```

with:

```ts
export function ScoreModal({
  player,
  recentFeatures,
  expansions,
  initialFeature,
  onClose,
  onScore,
  onRecordTokens,
}: Props) {
```

Replace the `PresetForms` render (lines 129-135):

```tsx
        {tab === 'preset' && (
          <PresetForms
            onApply={apply}
            recentFeatures={recentFeatures}
            expansions={expansions}
          />
        )}
```

with:

```tsx
        {tab === 'preset' && (
          <PresetForms
            onApply={apply}
            recentFeatures={recentFeatures}
            expansions={expansions}
            initialFeature={initialFeature}
          />
        )}
```

- [ ] **Step 3: Seed `PresetForms` with `initialFeature`**

Replace the `PresetForms` signature + first state line (lines 154-164):

```tsx
function PresetForms({
  onApply,
  recentFeatures,
  expansions,
}: {
  onApply: ApplyFn
  recentFeatures: CastleEntry[]
  expansions: ExpansionConfig
}) {
  const { t } = useI18n()
  const [feature, setFeature] = useState<FeatureType>('road')
```

with:

```tsx
function PresetForms({
  onApply,
  recentFeatures,
  expansions,
  initialFeature,
}: {
  onApply: ApplyFn
  recentFeatures: CastleEntry[]
  expansions: ExpansionConfig
  initialFeature?: FeatureType
}) {
  const { t } = useI18n()
  const [feature, setFeature] = useState<FeatureType>(initialFeature ?? 'road')
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: PASS. (Prop is optional, so existing callers still compile.)

- [ ] **Step 5: Commit**

```bash
git add src/components/ScoreModal.tsx
git commit -m "Let ScoreModal open pre-selected to a feature"
```

---

### Task 5: Scoreboard — message badges

**Files:**
- Modify: `src/components/Scoreboard.tsx` (import ~line 11; `Props` ~line 14; component head ~line 39; Score button ~line 170; card content ~line 153; ScoreModal render ~line 226)

**Interfaces:**
- Consumes: `MessageAlerts.pending/clear/dismiss` (passed as props), `FeatureType` from `../scoring`, `ScoreModal initialFeature`.
- Produces: `Scoreboard` accepts optional `messagePending?: Set<string>`, `onClearMessages?: () => void`, `onDismissMessage?: (playerId: string) => void`.

- [ ] **Step 1: Import `FeatureType`**

Replace line 11:

```ts
import { FEATURE_EMOJI, GOODS_EMOJI } from '../scoring'
```

with:

```ts
import { FEATURE_EMOJI, GOODS_EMOJI, type FeatureType } from '../scoring'
```

- [ ] **Step 2: Add the three optional props**

Replace the `Props` interface (lines 14-19):

```ts
interface Props {
  state: GameState
  onScore: (playerId: string, amount: number, desc: ScoreDescriptor) => void
  onRecordTokens: (playerId: string, delta: TokenDelta) => void
  onUndo: (entryId: string) => void
}
```

with:

```ts
interface Props {
  state: GameState
  onScore: (playerId: string, amount: number, desc: ScoreDescriptor) => void
  onRecordTokens: (playerId: string, delta: TokenDelta) => void
  onUndo: (entryId: string) => void
  /** Player ids with an unresolved 📜 message (The Messengers). */
  messagePending?: Set<string>
  /** Resolve the message moment — clears every badge. */
  onClearMessages?: () => void
  /** Dismiss one player's badge (they earned no message — not their turn). */
  onDismissMessage?: (playerId: string) => void
}
```

- [ ] **Step 3: Destructure props, add `initialFeature` state and open helpers**

Replace the component head (lines 39-42):

```ts
export function Scoreboard({ state, onScore, onRecordTokens, onUndo }: Props) {
  const { t, lang } = useI18n()
  const [activeId, setActiveId] = useState<string | null>(null)
  const active = state.players.find((p) => p.id === activeId) ?? null
```

with:

```ts
export function Scoreboard({
  state,
  onScore,
  onRecordTokens,
  onUndo,
  messagePending,
  onClearMessages,
  onDismissMessage,
}: Props) {
  const { t, lang } = useI18n()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [initialFeature, setInitialFeature] = useState<FeatureType | undefined>(
    undefined,
  )
  const active = state.players.find((p) => p.id === activeId) ?? null

  const openScore = (id: string) => {
    setInitialFeature(undefined)
    setActiveId(id)
  }
  // Badge tap = "this player receives it": open their Messages form, clear all.
  const openMessage = (id: string) => {
    setInitialFeature('message')
    setActiveId(id)
    onClearMessages?.()
  }
```

- [ ] **Step 4: Point the Score button at `openScore`**

Replace the Score button (lines 170-175):

```tsx
                <button
                  onClick={() => setActiveId(p.id)}
                  className="h-10 rounded-xl bg-amber-500 px-3 text-sm font-bold text-gray-900 hover:bg-amber-400 active:scale-95"
                >
                  {t.scoreBtn}
                </button>
```

with:

```tsx
                <button
                  onClick={() => openScore(p.id)}
                  className="h-10 rounded-xl bg-amber-500 px-3 text-sm font-bold text-gray-900 hover:bg-amber-400 active:scale-95"
                >
                  {t.scoreBtn}
                </button>
```

- [ ] **Step 5: Render the badge under the score**

Replace the goods row line in the card (line 153):

```tsx
                <GoodsRow goods={p.goods} gold={p.gold} />
```

with:

```tsx
                <GoodsRow goods={p.goods} gold={p.gold} />
                {messagePending?.has(p.id) && (
                  <div className="mt-1.5 inline-flex items-center gap-0.5 rounded-full bg-amber-500/20 py-0.5 pl-2 pr-0.5 text-amber-200 motion-safe:animate-pulse">
                    <button
                      type="button"
                      onClick={() => openMessage(p.id)}
                      aria-label={t.messageBadgeAria(p.name)}
                      className="flex items-center gap-1 text-xs font-semibold"
                    >
                      <span aria-hidden>{FEATURE_EMOJI.message}</span>
                      {t.featureNames.message}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDismissMessage?.(p.id)}
                      aria-label={t.messageDismissAria(p.name)}
                      className="ml-0.5 rounded-full px-1 text-xs text-amber-200/70 hover:bg-white/10 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>
                )}
```

- [ ] **Step 6: Pass `initialFeature` to `ScoreModal`**

Replace the ScoreModal render (lines 226-235):

```tsx
      {active && (
        <ScoreModal
          player={active}
          recentFeatures={recentFeatures}
          expansions={state.expansions}
          onClose={() => setActiveId(null)}
          onScore={(amount, desc) => onScore(active.id, amount, desc)}
          onRecordTokens={(delta) => onRecordTokens(active.id, delta)}
        />
      )}
```

with:

```tsx
      {active && (
        <ScoreModal
          player={active}
          recentFeatures={recentFeatures}
          expansions={state.expansions}
          initialFeature={initialFeature}
          onClose={() => setActiveId(null)}
          onScore={(amount, desc) => onScore(active.id, amount, desc)}
          onRecordTokens={(delta) => onRecordTokens(active.id, delta)}
        />
      )}
```

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: PASS. (New props are optional; badges stay hidden until `App` supplies `messagePending` in Task 6.)

- [ ] **Step 8: Commit**

```bash
git add src/components/Scoreboard.tsx
git commit -m "Render per-player message badges on the scoreboard"
```

---

### Task 6: App — wire hook, toast, sound toggle

**Files:**
- Modify: `src/App.tsx` (imports ~line 8; head ~line 13; menu ~lines 129-172; Scoreboard render ~line 185; bottom ~line 249; add `MessageToast`)

**Interfaces:**
- Consumes: `useMessageAlerts` (Task 2), `Scoreboard` message props (Task 5), `t.messageAvailable` / `t.soundLabel` (Task 3).

- [ ] **Step 1: Import the hook**

Replace line 8:

```ts
import { UpdatePrompt } from './components/UpdatePrompt'
```

with:

```ts
import { UpdatePrompt } from './components/UpdatePrompt'
import { useMessageAlerts } from './useMessageAlerts'
```

- [ ] **Step 2: Call the hook**

Replace line 13:

```ts
  const { state, room } = game
```

with:

```ts
  const { state, room } = game
  const alerts = useMessageAlerts(state)
```

- [ ] **Step 3: Add the Sound toggle and clear badges on reset / new game**

Replace the Expansions menu item plus the reset/new-game block (lines 129-173):

```tsx
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
```

with:

```tsx
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
```

- [ ] **Step 4: Pass badge props to `Scoreboard`**

Replace the Scoreboard render (lines 185-190):

```tsx
          <Scoreboard
            state={state}
            onScore={game.addScore}
            onRecordTokens={game.recordTokens}
            onUndo={game.undoEntry}
          />
```

with:

```tsx
          <Scoreboard
            state={state}
            onScore={game.addScore}
            onRecordTokens={game.recordTokens}
            onUndo={game.undoEntry}
            messagePending={alerts.pending}
            onClearMessages={alerts.clear}
            onDismissMessage={alerts.dismiss}
          />
```

- [ ] **Step 5: Render the toast**

Replace line 249:

```tsx
      <UpdatePrompt />
```

with:

```tsx
      <MessageToast show={alerts.toast !== null} text={t.messageAvailable} />
      <UpdatePrompt />
```

- [ ] **Step 6: Add the `MessageToast` component**

At the end of `src/App.tsx` (after the `MenuItem` function, around line 273), add:

```tsx
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
```

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 8: Manual verification (`npm run dev`, http://localhost:5173)**

  1. Start a game with ≥2 players; enable **The Messengers** (menu → Expansions). Confirm the picker now reads "The Messengers" (EN) / "Гонцы" (RU).
  2. Score **5** for a player (Score → Manual or +5 via a feature) → 📜 badge appears on their card, a "📜 A message is available!" toast slides up, and a chime plays.
  3. Score **3** then **2** for one player (total 5) → no badge on the first, badge fires on the second (total ÷5).
  4. Score **3** (total 3) → no badge, no toast.
  5. Tap the badge's **📜** → that player's ScoreModal opens on the Messages form; all badges clear.
  6. Trigger badges on two players, then tap one badge's **✕** → only that player's badge goes; the other stays.
  7. Menu → toggle **🔔 Sound** to **🔕** → score a ÷5 → badge + toast still appear, no chime.
  8. Switch language to RU → toast/badge/labels read in Russian.
  9. Menu → **Reset scores** → badges clear.
  10. (If reduced motion is enabled in the OS) the badge does not pulse.

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx
git commit -m "Wire message alerts: badges, toast, and sound toggle"
```

---

## Self-Review

**Spec coverage:**
- Trigger `amount>0 && (amount%5===0 || total%5===0)`, single-prepend, id-dedup → Task 2. ✓
- Badge set; chip-tap opens form + clears all; ✕ dismisses one → Tasks 5 (+4 form open, +2 clear/dismiss). ✓
- Generic toast, no player name, ~4s, `role="status"` → Tasks 2 (timer) + 6 (`MessageToast`). ✓
- Web Audio chime + menu Sound toggle (persisted, default on) → Tasks 1 + 2 + 6. ✓
- New-edition rename + tile term unchanged + new i18n keys (en+ru) → Task 3. ✓
- `App` wires hook, leaves `useGame` untouched; clear on reset/new game → Task 6. ✓
- Multiplayer: hook reads shared `state.log`, dedup by id → Task 2 (no server change needed). ✓
- Reduced motion via `motion-safe:` → Task 5. ✓

**Placeholder scan:** none — every step shows complete code and an exact build/commit command.

**Type consistency:** `messagePending` / `onClearMessages` / `onDismissMessage` consistent across Tasks 5↔6; `initialFeature?: FeatureType` consistent across Tasks 4↔5; `MessageAlerts` field names (`pending`, `toast`, `clear`, `dismiss`, `soundOn`, `setSoundOn`) consistent across Tasks 2↔6; `playMessageChime` consistent across Tasks 1↔2.

## Notes for the implementer

- Per global instructions, create `.claude/messenger-notifications/PROGRESS.md` at the start and tick tasks off as you go.
- The design spec is `docs/superpowers/specs/2026-06-27-messenger-notifications-design.md` — consult it if a decision feels underspecified.
- Commits omit any AI co-author trailer (project + global rule).
