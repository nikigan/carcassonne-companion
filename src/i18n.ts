import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { ColorKey } from './colors'
import type { ExpansionId } from './expansions'
import {
  ANIMAL_EMOJI,
  CATHEDRAL_EMOJI,
  FEATURE_EMOJI,
  GOODS_EMOJI,
  INN_EMOJI,
  MAGE_EMOJI,
  PIG_EMOJI,
  WITCH_EMOJI,
  type FeatureType,
} from './scoring'
import type {
  CircusAnimal,
  GoodType,
  MagicFigure,
  ScoreDescriptor,
} from './types'

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
  useRecentScore: string
  goldIngots: string
  goldHint: string
  messageHint: string
  goodNames: Record<GoodType, string>
  recordGoods: string
  goodsTabHint: string
  scoreTradeGoods: string
  scoreGold: string
  goodsMajority: (good: string) => string
  goodsLabel: string

  // Mage & Witch
  magicLabel: string
  magicNone: string
  mage: string
  witch: string

  // Circus & Artists
  circusAnimal: string
  meeples: string
  acrobatsCount: string
  ringmasterTiles: string
  circusHint: string
  acrobatsHint: string
  ringmasterHint: string
  animalNames: Record<CircusAnimal, string>

  // Expansion configuration
  expansionsTitle: string
  expansionsHint: string
  expansionNames: Record<ExpansionId, string>
  expansionDescriptions: Record<ExpansionId, string>

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

  // Multiplayer / room
  playOnMultipleDevices: string
  shareGame: string
  roomTitle: string
  roomCode: string
  joinByCode: string
  enterCode: string
  join: string
  copyLink: string
  linkCopied: string
  scanToJoin: string
  scanQr: string
  scanQrHint: string
  scanCameraDenied: string
  scanNoCamera: string
  scanInvalidQr: string
  leaveRoom: string
  confirmLeaveRoom: string
  statusConnecting: string
  statusConnected: string
  statusReconnecting: string
  // PWA update prompt
  updateAvailable: string
  refresh: string
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
    cloister: 'Monastery',
    field: 'Field',
    castle: 'Castle',
    gold: 'Gold',
    message: 'Message',
    circus: 'Circus',
    acrobats: 'Acrobats',
    ringmaster: 'Ringmaster',
    fairy: 'Fairy',
  },
  tiles: 'Tiles',
  pennants: 'Coat of arms',
  completed: 'Completed',
  surroundingTiles: 'Surrounding tiles',
  completedCities: 'Completed cities',
  roadHint: '1 point per tile. With an inn: 2 per tile when completed, 0 if not.',
  cityHint:
    'Completed: 2 per tile + 2 per coat of arms. Cathedral: 3 each when completed, 0 if not.',
  cloisterHint: '1 for the monastery + 1 per surrounding tile (max 9).',
  fieldHint:
    'Game end: 3 points per completed city it borders (4 with a pig), +1 per adjacent castle.',
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
  useRecentScore: 'Use a recent score',
  goldIngots: 'Gold ingots',
  goldHint:
    'Gold Mines: scored from the menu at game end (1–3 bars: 1 each, 4–6: 2, 7–9: 3, 10+: 4).',
  messageHint: 'Points received from a message tile (The Messages).',
  goodNames: {
    wine: 'Wine',
    grain: 'Grain',
    cloth: 'Cloth',
  },
  recordGoods: 'Record',
  goodsTabHint:
    'Goods and gold collected during play. Score them from the menu at game end.',
  scoreTradeGoods: 'Score trade goods',
  scoreGold: 'Score gold',
  goodsMajority: (good) => `${good} majority`,
  goodsLabel: 'Goods',

  magicLabel: 'Magic figure',
  magicNone: 'None',
  mage: 'Mage',
  witch: 'Witch',

  circusAnimal: 'Animal',
  meeples: 'Your meeples nearby',
  acrobatsCount: 'Acrobats',
  ringmasterTiles: 'Adjacent circus / acrobat tiles',
  circusHint: 'Each of your meeples by the Big Top scores the animal’s value.',
  acrobatsHint: 'Each acrobat scores 5 points for its owner.',
  ringmasterHint:
    'Scored on top of the feature: +2 per circus or acrobat tile on or next to the Ringmaster’s tile.',
  animalNames: {
    elephant: 'Elephant',
    tiger: 'Tiger',
    bear: 'Bear',
    seal: 'Seal',
    monkey: 'Monkey',
    flea: 'Flea',
  },

  expansionsTitle: 'Expansions',
  expansionsHint: 'Pick what you’re playing — the rest stays out of the way.',
  expansionNames: {
    innsCathedrals: 'Inns & Cathedrals',
    tradersBuilders: 'Traders & Builders',
    princessDragon: 'The Princess & the Dragon',
    bridgesCastlesBazaars: 'Bridges, Castles & Bazaars',
    goldMines: 'Gold Mines',
    messages: 'The Messages',
    mageWitch: 'The Mage & Witch',
    circus: 'Circus & Artists',
  },
  expansionDescriptions: {
    innsCathedrals: 'Inns on roads, cathedrals in cities.',
    tradersBuilders: 'Trade goods majorities and the pig.',
    princessDragon: 'The fairy: +1 each turn, +3 when a feature scores.',
    bridgesCastlesBazaars: 'Castles.',
    goldMines: 'Gold ingots, scored at game end.',
    messages: 'Message tiles (manual points).',
    mageWitch: 'Mage boosts and witch halves a road or city.',
    circus: 'Big Top animals, acrobats and the ringmaster.',
  },

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

  playOnMultipleDevices: 'Play on multiple devices',
  shareGame: 'Share game',
  roomTitle: 'Shared game',
  roomCode: 'Room code',
  joinByCode: 'Join by code',
  enterCode: 'Enter code',
  join: 'Join',
  copyLink: 'Copy link',
  linkCopied: 'Copied!',
  scanToJoin: 'Scan to join',
  scanQr: 'Scan QR',
  scanQrHint: 'Point at the room QR',
  scanCameraDenied: 'Camera access denied. Enable it in settings, or join by code.',
  scanNoCamera: 'No camera available. Join by code instead.',
  scanInvalidQr: "That's not a room QR.",
  leaveRoom: 'Leave room',
  confirmLeaveRoom: 'Leave this shared game? Your device returns to solo play.',
  statusConnecting: 'Connecting…',
  statusConnected: 'Live',
  statusReconnecting: 'Reconnecting…',

  updateAvailable: 'A new version is available.',
  refresh: 'Refresh',
}

// Russian uses the official Carcassonne (Hobby World) rule terms:
// Дорога, Город, Монастырь, Поле, щит (pennant/shield), тайл (tile).
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
    field: 'Поле',
    castle: 'Замок',
    gold: 'Золото',
    message: 'Послание',
    circus: 'Цирк',
    acrobats: 'Акробаты',
    ringmaster: 'Директор',
    fairy: 'Фея',
  },
  tiles: 'Тайлы',
  pennants: 'Щиты',
  completed: 'Завершён',
  surroundingTiles: 'Тайлы вокруг',
  completedCities: 'Завершённые города',
  roadHint:
    '1 очко за тайл. С трактиром: 2 за тайл если завершена, иначе 0.',
  cityHint:
    'Завершённый: 2 за тайл + 2 за щит. С собором: по 3 если завершён, иначе 0.',
  cloisterHint:
    '1 за монастырь + 1 за каждый соседний тайл (максимум 9).',
  fieldHint:
    'В конце игры: 3 очка за каждый завершённый город рядом (4 со свиньёй), +1 за каждый соседний замок.',
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
  useRecentScore: 'Выбрать из недавних',
  goldIngots: 'Слитки золота',
  goldHint:
    'Золотые жилы: подсчёт через меню в конце игры (1–3 слитка: по 1, 4–6: по 2, 7–9: по 3, 10+: по 4).',
  messageHint: 'Очки, полученные от послания (Послания).',
  goodNames: {
    wine: 'Вино',
    grain: 'Зерно',
    cloth: 'Ткань',
  },
  recordGoods: 'Записать',
  goodsTabHint:
    'Товары и золото, собранные за игру. Подсчитайте их через меню в конце игры.',
  scoreTradeGoods: 'Подсчитать товары',
  scoreGold: 'Подсчитать золото',
  goodsMajority: (good) => `Большинство: ${good}`,
  goodsLabel: 'Товары',

  magicLabel: 'Магия',
  magicNone: 'Нет',
  mage: 'Маг',
  witch: 'Ведьма',

  circusAnimal: 'Животное',
  meeples: 'Ваши миплы рядом',
  acrobatsCount: 'Акробаты',
  ringmasterTiles: 'Соседние тайлы цирка / акробатов',
  circusHint: 'Каждый ваш мипл у шатра приносит очки, равные значению животного.',
  acrobatsHint: 'Каждый акробат приносит владельцу 5 очков.',
  ringmasterHint:
    'Начисляется сверх объекта: +2 за каждый тайл цирка или акробатов на тайле директора или рядом с ним.',
  animalNames: {
    elephant: 'Слон',
    tiger: 'Тигр',
    bear: 'Медведь',
    seal: 'Тюлень',
    monkey: 'Обезьяна',
    flea: 'Блоха',
  },

  expansionsTitle: 'Дополнения',
  expansionsHint: 'Выберите, во что играете — лишнее не будет мешать.',
  expansionNames: {
    innsCathedrals: 'Трактиры и соборы',
    tradersBuilders: 'Купцы и строители',
    princessDragon: 'Принцесса и дракон',
    bridgesCastlesBazaars: 'Мосты, замки и базары',
    goldMines: 'Золотые жилы',
    messages: 'Послания',
    mageWitch: 'Маг и ведьма',
    circus: 'Цирк',
  },
  expansionDescriptions: {
    innsCathedrals: 'Трактиры на дорогах, соборы в городах.',
    tradersBuilders: 'Большинство товаров и свинья.',
    princessDragon: 'Фея: +1 за ход, +3 при подсчёте объекта.',
    bridgesCastlesBazaars: 'Замки.',
    goldMines: 'Слитки золота, подсчёт в конце игры.',
    messages: 'Тайлы посланий (очки вручную).',
    mageWitch: 'Маг усиливает, ведьма уменьшает дорогу или город.',
    circus: 'Животные шатра, акробаты и директор цирка.',
  },

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

  playOnMultipleDevices: 'Играть на нескольких устройствах',
  shareGame: 'Поделиться игрой',
  roomTitle: 'Общая игра',
  roomCode: 'Код комнаты',
  joinByCode: 'Войти по коду',
  enterCode: 'Введите код',
  join: 'Войти',
  copyLink: 'Скопировать ссылку',
  linkCopied: 'Скопировано!',
  scanToJoin: 'Отсканируйте, чтобы войти',
  scanQr: 'Сканировать QR',
  scanQrHint: 'Наведите на QR-код комнаты',
  scanCameraDenied: 'Доступ к камере запрещён. Разрешите его в настройках или войдите по коду.',
  scanNoCamera: 'Камера недоступна. Войдите по коду.',
  scanInvalidQr: 'Это не QR-код комнаты.',
  leaveRoom: 'Выйти из комнаты',
  confirmLeaveRoom: 'Выйти из общей игры? Устройство вернётся к одиночной игре.',
  statusConnecting: 'Подключение…',
  statusConnected: 'В сети',
  statusReconnecting: 'Переподключение…',

  updateAvailable: 'Доступно обновление.',
  refresh: 'Обновить',
}

const TABLES: Record<Lang, Strings> = { en, ru }

/* ------------------------------------------------------------------ *
 * Score-log label formatting (localized, with feature emoji)
 * ------------------------------------------------------------------ */

export function formatDescriptor(desc: ScoreDescriptor, lang: Lang): string {
  if (lang === 'ru') return formatRu(desc)
  return formatEn(desc)
}

/** Trailing mage/witch emoji for a road/city label (Mage & Witch). */
function magicSuffix(magic: MagicFigure): string {
  if (magic === 'mage') return ` ${MAGE_EMOJI}`
  if (magic === 'witch') return ` ${WITCH_EMOJI}`
  return ''
}

function formatEn(d: ScoreDescriptor): string {
  switch (d.kind) {
    case 'road': {
      const t = d.tiles
      const inn = d.inn ? ` ${INN_EMOJI}` : ''
      return `${FEATURE_EMOJI.road} Road${inn}${magicSuffix(d.magic)} (${t} ${pluralEn(t, 'tile', 'tiles')})`
    }
    case 'city': {
      const t = d.tiles
      const penn =
        d.pennants > 0
          ? `, ${d.pennants} ${pluralEn(d.pennants, 'coat of arms', 'coats of arms')}`
          : ''
      const cath = d.cathedral ? ` ${CATHEDRAL_EMOJI}` : ''
      const state = d.completed ? 'completed' : 'incomplete'
      return `${FEATURE_EMOJI.city} City${cath}${magicSuffix(d.magic)} ${state} (${t} ${pluralEn(t, 'tile', 'tiles')}${penn})`
    }
    case 'cloister':
      return d.completed
        ? `${FEATURE_EMOJI.cloister} Monastery completed (9)`
        : `${FEATURE_EMOJI.cloister} Monastery (${d.surrounding} surrounding ${pluralEn(d.surrounding, 'tile', 'tiles')})`
    case 'field': {
      const pig = d.pig ? ` ${PIG_EMOJI}` : ''
      const castles = d.castles > 0 ? `, ${d.castles} ${FEATURE_EMOJI.castle}` : ''
      return `${FEATURE_EMOJI.field} Field${pig} (${d.cities} completed ${pluralEn(d.cities, 'city', 'cities')}${castles})`
    }
    case 'castle':
      return `${FEATURE_EMOJI.castle} Castle (${d.value})`
    case 'gold':
      return `${FEATURE_EMOJI.gold} Gold (${d.ingots} ${pluralEn(d.ingots, 'ingot', 'ingots')})`
    case 'message':
      return `${FEATURE_EMOJI.message} Message`
    case 'circus':
      return `${FEATURE_EMOJI.circus} Circus (${ANIMAL_EMOJI[d.animal]} ×${d.meeples})`
    case 'acrobats':
      return `${FEATURE_EMOJI.acrobats} Acrobats ×${d.count}`
    case 'ringmaster':
      return `${FEATURE_EMOJI.ringmaster} Ringmaster (${d.tiles} ${pluralEn(d.tiles, 'tile', 'tiles')})`
    case 'fairy':
      return d.bonus === 1
        ? `${FEATURE_EMOJI.fairy} Fairy +1 (start of turn)`
        : `${FEATURE_EMOJI.fairy} Fairy +3 (feature)`
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
      return `${FEATURE_EMOJI.road} Дорога${inn}${magicSuffix(d.magic)} (${t} ${pluralRu(t, ['тайл', 'тайла', 'тайлов'])})`
    }
    case 'city': {
      const t = d.tiles
      const penn =
        d.pennants > 0
          ? `, ${d.pennants} ${pluralRu(d.pennants, ['щит', 'щита', 'щитов'])}`
          : ''
      const cath = d.cathedral ? ` ${CATHEDRAL_EMOJI}` : ''
      const state = d.completed ? 'завершён' : 'незавершён'
      return `${FEATURE_EMOJI.city} Город${cath}${magicSuffix(d.magic)} ${state} (${t} ${pluralRu(t, ['тайл', 'тайла', 'тайлов'])}${penn})`
    }
    case 'cloister':
      return d.completed
        ? `${FEATURE_EMOJI.cloister} Монастырь завершён (9)`
        : `${FEATURE_EMOJI.cloister} Монастырь (${d.surrounding} ${pluralRu(d.surrounding, ['тайл', 'тайла', 'тайлов'])} вокруг)`
    case 'field': {
      const pig = d.pig ? ` ${PIG_EMOJI}` : ''
      const castles = d.castles > 0 ? `, ${d.castles} ${FEATURE_EMOJI.castle}` : ''
      return `${FEATURE_EMOJI.field} Поле${pig} (${d.cities} ${pluralRu(d.cities, ['завершённый город', 'завершённых города', 'завершённых городов'])}${castles})`
    }
    case 'castle':
      return `${FEATURE_EMOJI.castle} Замок (${d.value})`
    case 'gold':
      return `${FEATURE_EMOJI.gold} Золото (${d.ingots} ${pluralRu(d.ingots, ['слиток', 'слитка', 'слитков'])})`
    case 'message':
      return `${FEATURE_EMOJI.message} Послание`
    case 'circus':
      return `${FEATURE_EMOJI.circus} Цирк (${ANIMAL_EMOJI[d.animal]} ×${d.meeples})`
    case 'acrobats':
      return `${FEATURE_EMOJI.acrobats} Акробаты ×${d.count}`
    case 'ringmaster':
      return `${FEATURE_EMOJI.ringmaster} Директор (${d.tiles} ${pluralRu(d.tiles, ['тайл', 'тайла', 'тайлов'])})`
    case 'fairy':
      return d.bonus === 1
        ? `${FEATURE_EMOJI.fairy} Фея +1 (начало хода)`
        : `${FEATURE_EMOJI.fairy} Фея +3 (объект)`
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
