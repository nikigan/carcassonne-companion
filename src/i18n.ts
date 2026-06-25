import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { ColorKey } from './colors'
import {
  CATHEDRAL_EMOJI,
  FEATURE_EMOJI,
  GOODS_EMOJI,
  INN_EMOJI,
  PIG_EMOJI,
  type FeatureType,
} from './scoring'
import type { GoodType, ScoreDescriptor } from './types'

export type Lang = 'en' | 'ru'

export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'ru', label: 'RU' },
]

const STORAGE_KEY = 'carcassonne-companion:lang'

/* ------------------------------------------------------------------ *
 * Pluralization helpers
 * ------------------------------------------------------------------ */

function pluralEn(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

/**
 * Russian has three plural forms (one / few / many), selected by the last
 * digit(s) of the number. `forms` is [one, few, many].
 */
function pluralRu(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1]
  return forms[2]
}

/* ------------------------------------------------------------------ *
 * String tables
 * ------------------------------------------------------------------ */

export interface Strings {
  appTitle: string
  appSubtitle: string
  menu: string
  editPlayers: string
  resetScores: string
  newGame: string
  confirmReset: string
  confirmNewGame: string

  playersHeading: string
  playersHint: string
  colorLabel: string
  noPlayers: string
  playerNamePlaceholder: string
  add: string
  startGame: string
  defaultPlayerName: (n: number) => string
  removePlayerAria: (name: string) => string
  playerNameAria: string

  featuresTab: string
  goodsTab: string
  manualTab: string
  featureNames: Record<FeatureType, string>
  tiles: string
  pennants: string
  completed: string
  surroundingTiles: string
  completedCities: string
  roadHint: string
  cityHint: string
  cloisterHint: string
  fieldHint: string
  currentScore: (score: number) => string
  addPoints: (n: number) => string
  points: string
  close: string
  decreaseAria: (label: string) => string
  increaseAria: (label: string) => string

  // Expansions
  inn: string
  cathedral: string
  pig: string
  castleValue: string
  castleHint: string
  goodNames: Record<GoodType, string>
  recordGoods: string
  goodsTabHint: string
  scoreTradeGoods: string
  goodsMajority: (good: string) => string
  goodsLabel: string

  scoreBtn: string
  subtractAria: (name: string) => string
  addPointAria: (name: string) => string
  scoreLog: string
  noPointsYet: string
  undo: string
  undoAria: string
  leadingTitle: string
  leads: (name: string, score: number) => string

  colors: Record<ColorKey, string>
  customColor: string
  chooseCustom: string
  inUse: (name: string) => string
}

const en: Strings = {
  appTitle: 'Carcassonne',
  appSubtitle: 'Companion',
  menu: 'Menu',
  editPlayers: 'Edit players',
  resetScores: 'Reset scores',
  newGame: 'New game',
  confirmReset: 'Reset all scores to zero?',
  confirmNewGame: 'Start a new game? This clears players and scores.',

  playersHeading: 'Players',
  playersHint: 'Add everyone playing and pick a color for each.',
  colorLabel: 'Color',
  noPlayers: 'No players yet — add your first below.',
  playerNamePlaceholder: 'Player name',
  add: 'Add',
  startGame: 'Start game',
  defaultPlayerName: (n) => `Player ${n}`,
  removePlayerAria: (name) => `Remove ${name}`,
  playerNameAria: 'Player name',

  featuresTab: 'Features',
  goodsTab: 'Goods',
  manualTab: 'Manual',
  featureNames: {
    road: 'Road',
    city: 'City',
    cloister: 'Cloister',
    field: 'Field',
    castle: 'Castle',
  },
  tiles: 'Tiles',
  pennants: 'Pennants',
  completed: 'Completed',
  surroundingTiles: 'Surrounding tiles',
  completedCities: 'Completed cities',
  roadHint: '1 point per tile. With an inn: 2 per tile when completed, 0 if not.',
  cityHint:
    'Completed: 2 per tile + 2 per pennant. Cathedral: 3 each when completed, 0 if not.',
  cloisterHint: '1 for the cloister + 1 per surrounding tile (max 9).',
  fieldHint:
    'Game end: 3 points per completed city it borders (4 with a pig).',
  currentScore: (score) => `Current: ${score} ${pluralEn(score, 'pt', 'pts')}`,
  addPoints: (n) => `Add ${n} ${pluralEn(n, 'point', 'points')}`,
  points: 'Points',
  close: 'Close',
  decreaseAria: (label) => `Decrease ${label}`,
  increaseAria: (label) => `Increase ${label}`,

  inn: 'Inn',
  cathedral: 'Cathedral',
  pig: 'Pig',
  castleValue: 'Feature value',
  castleHint:
    'Scores the points of the completed feature that triggered the castle.',
  goodNames: {
    wine: 'Wine',
    grain: 'Grain',
    cloth: 'Cloth',
  },
  recordGoods: 'Record goods',
  goodsTabHint:
    'Trade goods collected when completing cities. Score majorities from the menu at game end.',
  scoreTradeGoods: 'Score trade goods',
  goodsMajority: (good) => `${good} majority`,
  goodsLabel: 'Goods',

  scoreBtn: 'Score',
  subtractAria: (name) => `Subtract a point from ${name}`,
  addPointAria: (name) => `Add a point to ${name}`,
  scoreLog: 'Score log',
  noPointsYet: 'No points scored yet.',
  undo: 'undo',
  undoAria: 'Undo this entry',
  leadingTitle: 'Leading',
  leads: (name, score) =>
    `${name} leads with ${score} ${pluralEn(score, 'pt', 'pts')}`,

  colors: {
    red: 'Red',
    blue: 'Blue',
    yellow: 'Yellow',
    green: 'Green',
    black: 'Black',
    pink: 'Pink',
    gray: 'Gray',
  },
  customColor: 'Custom color',
  chooseCustom: 'Choose a custom color',
  inUse: (name) => `${name} (in use)`,
}

// Russian uses the official Carcassonne (Hobby World) rule terms:
// Дорога, Город, Монастырь, Луг, герб (pennant), тайл (tile).
const ru: Strings = {
  appTitle: 'Каркассон',
  appSubtitle: 'Помощник',
  menu: 'Меню',
  editPlayers: 'Изменить игроков',
  resetScores: 'Сбросить очки',
  newGame: 'Новая игра',
  confirmReset: 'Сбросить все очки до нуля?',
  confirmNewGame: 'Начать новую игру? Игроки и очки будут удалены.',

  playersHeading: 'Игроки',
  playersHint: 'Добавьте всех игроков и выберите цвет для каждого.',
  colorLabel: 'Цвет',
  noPlayers: 'Пока нет игроков — добавьте первого ниже.',
  playerNamePlaceholder: 'Имя игрока',
  add: 'Добавить',
  startGame: 'Начать игру',
  defaultPlayerName: (n) => `Игрок ${n}`,
  removePlayerAria: (name) => `Удалить ${name}`,
  playerNameAria: 'Имя игрока',

  featuresTab: 'Объекты',
  goodsTab: 'Товары',
  manualTab: 'Вручную',
  featureNames: {
    road: 'Дорога',
    city: 'Город',
    cloister: 'Монастырь',
    field: 'Луг',
    castle: 'Замок',
  },
  tiles: 'Тайлы',
  pennants: 'Гербы',
  completed: 'Завершён',
  surroundingTiles: 'Тайлы вокруг',
  completedCities: 'Завершённые города',
  roadHint:
    '1 очко за тайл. С трактиром: 2 за тайл если завершена, иначе 0.',
  cityHint:
    'Завершённый: 2 за тайл + 2 за герб. С собором: по 3 если завершён, иначе 0.',
  cloisterHint:
    '1 за монастырь + 1 за каждый соседний тайл (максимум 9).',
  fieldHint:
    'В конце игры: 3 очка за каждый завершённый город рядом (4 со свиньёй).',
  currentScore: (score) =>
    `Сейчас: ${score} ${pluralRu(score, ['очко', 'очка', 'очков'])}`,
  addPoints: (n) =>
    `Добавить ${n} ${pluralRu(n, ['очко', 'очка', 'очков'])}`,
  points: 'Очки',
  close: 'Закрыть',
  decreaseAria: (label) => `Уменьшить: ${label}`,
  increaseAria: (label) => `Увеличить: ${label}`,

  inn: 'Трактир',
  cathedral: 'Собор',
  pig: 'Свинья',
  castleValue: 'Очки объекта',
  castleHint: 'Начисляет очки завершённого объекта, который активировал замок.',
  goodNames: {
    wine: 'Вино',
    grain: 'Зерно',
    cloth: 'Ткань',
  },
  recordGoods: 'Записать',
  goodsTabHint:
    'Товары собираются при завершении городов. Подсчитайте большинство в конце игры через меню.',
  scoreTradeGoods: 'Подсчитать товары',
  goodsMajority: (good) => `Большинство: ${good}`,
  goodsLabel: 'Товары',

  scoreBtn: 'Счёт',
  subtractAria: (name) => `Отнять очко у ${name}`,
  addPointAria: (name) => `Добавить очко: ${name}`,
  scoreLog: 'История очков',
  noPointsYet: 'Очки ещё не начислены.',
  undo: 'отмена',
  undoAria: 'Отменить запись',
  leadingTitle: 'Лидер',
  leads: (name, score) =>
    `${name} лидирует: ${score} ${pluralRu(score, ['очко', 'очка', 'очков'])}`,

  colors: {
    red: 'Красный',
    blue: 'Синий',
    yellow: 'Жёлтый',
    green: 'Зелёный',
    black: 'Чёрный',
    pink: 'Розовый',
    gray: 'Серый',
  },
  customColor: 'Свой цвет',
  chooseCustom: 'Выберите свой цвет',
  inUse: (name) => `${name} (занят)`,
}

const TABLES: Record<Lang, Strings> = { en, ru }

/* ------------------------------------------------------------------ *
 * Score-log label formatting (localized, with feature emoji)
 * ------------------------------------------------------------------ */

export function formatDescriptor(desc: ScoreDescriptor, lang: Lang): string {
  if (lang === 'ru') return formatRu(desc)
  return formatEn(desc)
}

function formatEn(d: ScoreDescriptor): string {
  switch (d.kind) {
    case 'road': {
      const t = d.tiles
      const inn = d.inn ? ` ${INN_EMOJI}` : ''
      return `${FEATURE_EMOJI.road} Road${inn} (${t} ${pluralEn(t, 'tile', 'tiles')})`
    }
    case 'city': {
      const t = d.tiles
      const penn =
        d.pennants > 0
          ? `, ${d.pennants} ${pluralEn(d.pennants, 'pennant', 'pennants')}`
          : ''
      const cath = d.cathedral ? ` ${CATHEDRAL_EMOJI}` : ''
      const state = d.completed ? 'completed' : 'incomplete'
      return `${FEATURE_EMOJI.city} City${cath} ${state} (${t} ${pluralEn(t, 'tile', 'tiles')}${penn})`
    }
    case 'cloister':
      return d.completed
        ? `${FEATURE_EMOJI.cloister} Cloister completed (9)`
        : `${FEATURE_EMOJI.cloister} Cloister (${d.surrounding} surrounding ${pluralEn(d.surrounding, 'tile', 'tiles')})`
    case 'field': {
      const pig = d.pig ? ` ${PIG_EMOJI}` : ''
      return `${FEATURE_EMOJI.field} Field${pig} (${d.cities} completed ${pluralEn(d.cities, 'city', 'cities')})`
    }
    case 'castle':
      return `${FEATURE_EMOJI.castle} Castle (${d.value})`
    case 'goodsBonus':
      return `${GOODS_EMOJI[d.good]} ${capitalize(d.good)} majority`
    case 'manual':
      return `${FEATURE_EMOJI.manual} Manual ${d.amount > 0 ? '+' : ''}${d.amount}`
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatRu(d: ScoreDescriptor): string {
  switch (d.kind) {
    case 'road': {
      const t = d.tiles
      const inn = d.inn ? ` ${INN_EMOJI}` : ''
      return `${FEATURE_EMOJI.road} Дорога${inn} (${t} ${pluralRu(t, ['тайл', 'тайла', 'тайлов'])})`
    }
    case 'city': {
      const t = d.tiles
      const penn =
        d.pennants > 0
          ? `, ${d.pennants} ${pluralRu(d.pennants, ['герб', 'герба', 'гербов'])}`
          : ''
      const cath = d.cathedral ? ` ${CATHEDRAL_EMOJI}` : ''
      const state = d.completed ? 'завершён' : 'незавершён'
      return `${FEATURE_EMOJI.city} Город${cath} ${state} (${t} ${pluralRu(t, ['тайл', 'тайла', 'тайлов'])}${penn})`
    }
    case 'cloister':
      return d.completed
        ? `${FEATURE_EMOJI.cloister} Монастырь завершён (9)`
        : `${FEATURE_EMOJI.cloister} Монастырь (${d.surrounding} ${pluralRu(d.surrounding, ['тайл', 'тайла', 'тайлов'])} вокруг)`
    case 'field': {
      const pig = d.pig ? ` ${PIG_EMOJI}` : ''
      return `${FEATURE_EMOJI.field} Луг${pig} (${d.cities} ${pluralRu(d.cities, ['завершённый город', 'завершённых города', 'завершённых городов'])})`
    }
    case 'castle':
      return `${FEATURE_EMOJI.castle} Замок (${d.value})`
    case 'goodsBonus': {
      const names: Record<typeof d.good, string> = {
        wine: 'вино',
        grain: 'зерно',
        cloth: 'ткань',
      }
      return `${GOODS_EMOJI[d.good]} Большинство: ${names[d.good]}`
    }
    case 'manual':
      return `${FEATURE_EMOJI.manual} Вручную ${d.amount > 0 ? '+' : ''}${d.amount}`
  }
}

/* ------------------------------------------------------------------ *
 * Language context
 * ------------------------------------------------------------------ */

function detectInitialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'en' || stored === 'ru') return stored
  } catch {
    // ignore
  }
  try {
    if (navigator.language?.toLowerCase().startsWith('ru')) return 'ru'
  } catch {
    // ignore
  }
  return 'en'
}

interface I18nContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: Strings
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => detectInitialLang())

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // ignore
    }
    document.documentElement.lang = lang
  }, [lang])

  const value: I18nContextValue = {
    lang,
    setLang: setLangState,
    t: TABLES[lang],
  }

  return createElement(I18nContext.Provider, { value }, children)
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within a LanguageProvider')
  return ctx
}
