import type { GameState, ColorScheme, Direction, Player, PlayerClass } from '../../types';
import { PLAYER_CLASSES } from './data/player_classes';
import { SYSTEMS } from './data/systems';

export const XP_BASE = 100;
export const XP_GROWTH_FACTOR = 1.5;
export const BOMB_FUSE_STEPS = 4;
export const BOMB_RANGE = 2;
export const POISON_TICK_STEPS = 3;
export const POISON_DAMAGE = 5;

export enum TileType { FLOOR = 0, WALL = 1 }
export enum EnemyType { GOBLIN = 'GOBLIN', SLIME = 'SLIME', SKELETON = 'SKELETON', SPIDER = 'SPIDER', SLIME_MINI = 'SLIME_MINI' }
export enum ItemType { POTION = 'POTION', GOLD = 'GOLD', ARROWS = 'ARROWS', BOMB = 'BOMB', ANTIDOTE = 'ANTIDOTE' }
export enum HazardType { SPIKES = 'SPIKES', FIRE = 'FIRE', PIT = 'PIT', POISON = 'POISON' }

export const WIZARD_CHAR = '🧙';
export const ALTAR_CHAR = '🔯';

export const PLAYER_DIRECTION_INDICATOR: Record<Direction, { char: string, style: object }> = {
    ArrowUp:    { char: '▲', style: { top: '-8px', left: '50%', transform: 'translateX(-50%)'}},
    ArrowDown:  { char: '▼', style: { bottom: '-8px', left: '50%', transform: 'translateX(-50%)'}},
    ArrowLeft:  { char: '◄', style: { left: '-8px', top: '50%', transform: 'translateY(-50%)'}},
    ArrowRight: { char: '►', style: { right: '-8px', top: '50%', transform: 'translateY(-50%)'}},
};
export const HAZARD_STYLES: Record<HazardType, { char: string, color: string }> = {
    [HazardType.SPIKES]: { char: '뾰', color: '#95a5a6' },
    [HazardType.FIRE]: { char: '🔥', color: '#e74c3c' },
    [HazardType.PIT]: { char: '🕳️', color: '#2c3e50' },
    [HazardType.POISON]: { char: '⚗️', color: '#2ecc71' },
};
export const DOODAD_CHARS = ['🌿', '🍄', '🦴', '💎', '🕸️'];
export const ITEM_STYLES: Record<ItemType, { char: string }> = {
    [ItemType.POTION]: { char: '🧪' },
    [ItemType.GOLD]: { char: '💰' },
    [ItemType.ARROWS]: { char: '🏹' },
    [ItemType.BOMB]: { char: '💣' },
    [ItemType.ANTIDOTE]: { char: '🍶' },
};

const initialPlayer = { 
  ...PLAYER_CLASSES.Knight.stats,
  x: 1, y: 1, level: 1, xp: 0, xpToNextLevel: XP_BASE, 
  playerClass: 'Knight' as PlayerClass,
  isPoisoned: false, poisonStepCounter: 0,
  corruption: 0, activeAugments: [], stepsTaken: 0,
} as Player;

export const GAME_STATE: GameState = {
  map: Array(SYSTEMS.VIEWPORT_HEIGHT).fill(Array(SYSTEMS.VIEWPORT_WIDTH).fill(TileType.WALL)),
  player: initialPlayer,
  enemies: [], items: [], exit: null, wizard: null, hazards: [], doodads: [],
  bombs: [], activeBlasts: [], damageNumbers: [], pickedUpItems: new Set(),
  level: 1, theme: SYSTEMS.THEMES[0], camera: { x: 0, y: 0 },
  altars: [],
};