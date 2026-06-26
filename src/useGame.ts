import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  GameState,
  GoodType,
  Player,
  ScoreDescriptor,
  ScoreEntry,
  TokenDelta,
} from './types'
import { emptyGoods } from './types'
import type { ExpansionId } from './expansions'
import { GOODS_MAJORITY_BONUS, scoreGold } from './scoring'
import { emptyGame, loadGame, saveGame, uid } from './storage'

const GOOD_TYPES: GoodType[] = ['wine', 'grain', 'cloth']

/**
 * Central game state hook. Owns players + score log, persists to localStorage
 * on every change, and exposes intent-named actions.
 */
export function useGame() {
  const [state, setState] = useState<GameState>(() => loadGame())

  // Persist after first render is skipped via this ref so we don't immediately
  // re-write what we just loaded (harmless, but avoids a redundant write).
  const hydrated = useRef(false)
  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true
      return
    }
    saveGame(state)
  }, [state])

  const addPlayer = useCallback((name: string, color: string) => {
    setState((s) => ({
      ...s,
      players: [
        ...s.players,
        {
          id: uid(),
          name: name.trim() || `#${s.players.length + 1}`,
          color,
          score: 0,
          goods: emptyGoods(),
          gold: 0,
        },
      ],
    }))
  }, [])

  const updatePlayer = useCallback(
    (id: string, patch: Partial<Pick<Player, 'name' | 'color'>>) => {
      setState((s) => ({
        ...s,
        players: s.players.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      }))
    },
    [],
  )

  const removePlayer = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      players: s.players.filter((p) => p.id !== id),
      log: s.log.filter((e) => e.playerId !== id),
    }))
  }, [])

  const startGame = useCallback(() => {
    setState((s) => (s.players.length > 0 ? { ...s, started: true } : s))
  }, [])

  /** Return to the player setup screen without losing scores. */
  const editPlayers = useCallback(() => {
    setState((s) => ({ ...s, started: false }))
  }, [])

  /** Toggle a single expansion on/off for the current game. */
  const setExpansion = useCallback((id: ExpansionId, on: boolean) => {
    setState((s) => ({
      ...s,
      expansions: { ...s.expansions, [id]: on },
    }))
  }, [])

  const addScore = useCallback(
    (playerId: string, amount: number, desc: ScoreDescriptor) => {
      if (!Number.isFinite(amount) || amount === 0) return
      const entry: ScoreEntry = {
        id: uid(),
        playerId,
        amount,
        desc,
        timestamp: Date.now(),
      }
      setState((s) => ({
        ...s,
        players: s.players.map((p) =>
          p.id === playerId ? { ...p, score: p.score + amount } : p,
        ),
        log: [entry, ...s.log],
      }))
    },
    [],
  )

  /** Undo a single log entry, reverting its effect on the player's score. */
  const undoEntry = useCallback((entryId: string) => {
    setState((s) => {
      const entry = s.log.find((e) => e.id === entryId)
      if (!entry) return s
      return {
        ...s,
        players: s.players.map((p) =>
          p.id === entry.playerId ? { ...p, score: p.score - entry.amount } : p,
        ),
        log: s.log.filter((e) => e.id !== entryId),
      }
    })
  }, [])

  /** Add to a player's collected tokens: trade goods and/or gold ingots. */
  const recordTokens = useCallback((playerId: string, delta: TokenDelta) => {
    setState((s) => ({
      ...s,
      players: s.players.map((p) =>
        p.id === playerId
          ? {
              ...p,
              goods: {
                wine: p.goods.wine + (delta.wine ?? 0),
                grain: p.goods.grain + (delta.grain ?? 0),
                cloth: p.goods.cloth + (delta.cloth ?? 0),
              },
              gold: p.gold + (delta.gold ?? 0),
            }
          : p,
      ),
    }))
  }, [])

  /**
   * Score gold ingots (game end): each player's gold is worth a progressive
   * per-ingot rate based on how much they hold. Gold is then cleared.
   */
  const scoreGoldIngots = useCallback(() => {
    setState((s) => {
      const entries: ScoreEntry[] = []
      for (const p of s.players) {
        if (p.gold <= 0) continue
        entries.push({
          id: uid(),
          playerId: p.id,
          amount: scoreGold(p.gold),
          desc: { kind: 'gold', ingots: p.gold },
          timestamp: Date.now(),
        })
      }
      if (entries.length === 0) return s
      const byPlayer = new Map(entries.map((e) => [e.playerId, e.amount]))
      return {
        ...s,
        players: s.players.map((p) => ({
          ...p,
          score: p.score + (byPlayer.get(p.id) ?? 0),
          gold: 0,
        })),
        log: [...entries, ...s.log],
      }
    })
  }, [])

  /**
   * Score trade-goods majorities (game end): each player holding the most of a
   * good earns a bonus; ties share it. Goods are then cleared.
   */
  const scoreTradeGoods = useCallback(() => {
    setState((s) => {
      const bonus: Record<string, number> = {}
      const entries: ScoreEntry[] = []
      let awarded = false

      for (const good of GOOD_TYPES) {
        const max = s.players.reduce((m, p) => Math.max(m, p.goods[good]), 0)
        if (max <= 0) continue
        for (const p of s.players) {
          if (p.goods[good] !== max) continue
          awarded = true
          bonus[p.id] = (bonus[p.id] ?? 0) + GOODS_MAJORITY_BONUS
          entries.push({
            id: uid(),
            playerId: p.id,
            amount: GOODS_MAJORITY_BONUS,
            desc: { kind: 'goodsBonus', good },
            timestamp: Date.now(),
          })
        }
      }

      if (!awarded) return s
      return {
        ...s,
        players: s.players.map((p) => ({
          ...p,
          score: p.score + (bonus[p.id] ?? 0),
          goods: emptyGoods(),
        })),
        log: [...entries, ...s.log],
      }
    })
  }, [])

  /** Reset scores (and collected tokens) to zero but keep the same players. */
  const resetScores = useCallback(() => {
    setState((s) => ({
      ...s,
      players: s.players.map((p) => ({
        ...p,
        score: 0,
        goods: emptyGoods(),
        gold: 0,
      })),
      log: [],
    }))
  }, [])

  /**
   * Wipe players and scores and return to player setup, but carry the current
   * expansion selection forward (the user usually plays the same set again).
   * The persistence effect rewrites storage with this fresh state.
   */
  const newGame = useCallback(() => {
    setState((s) => ({ ...emptyGame, expansions: s.expansions }))
  }, [])

  return {
    state,
    addPlayer,
    updatePlayer,
    removePlayer,
    startGame,
    editPlayers,
    setExpansion,
    addScore,
    recordTokens,
    scoreTradeGoods,
    scoreGoldIngots,
    undoEntry,
    resetScores,
    newGame,
  }
}
