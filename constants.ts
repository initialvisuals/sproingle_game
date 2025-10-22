/**
 * @file constants.ts
 * @description This file contains all the static game configuration and constants.
 * It's used for game balance, defining entity properties, and setting up the initial game state.
 */
import type { GameState, ColorScheme, Direction, Item, Player, PlayerClass } from './types';
import React from 'react';

// --- WORLD & VIEWPORT ---
export const VIEWPORT_WIDTH = 13;
export const VIEWPORT_HEIGHT = 20;
export const WORLD_SCREENS_W = 3;
export const WORLD_SCREENS_H = 3;

// --- GAME BALANCE & MECHANICS ---
export const XP_BASE = 100;
export const XP_GROWTH_FACTOR = 1.5;
export const BOMB_FUSE_STEPS = 6;
export const BOMB_RANGE = 6;
export const POISON_TICK_STEPS = 3;
export const POISON_DAMAGE = 5;

// --- ENUMERATIONS ---
export enum TileType { FLOOR = 0, WALL = 1 }
export enum EnemyType { GOBLIN = 'GOBLIN', SLIME = 'SLIME', SKELETON = 'SKELETON', SPIDER = 'SPIDER' }
export enum ItemType { POTION = 'POTION', GOLD = 'GOLD', ARROWS = 'ARROWS', BOMB = 'BOMB', ANTIDOTE = 'ANTIDOTE' }
export enum HazardType { SPIKES = 'SPIKES', FIRE = 'FIRE', PIT = 'PIT' }

// --- ENTITY STYLES & DEFINITIONS ---
export const WIZARD_CHAR = '🧙‍♂️';
// TODO: Implement Altars
export const ALTAR_CHAR = '🔯';

// TODO: Define Augments here as part of the new system.
// Augments will be powerful, run-altering passive upgrades offered at Altars.
/*
export const AUGMENTS: Record<AugmentId, Augment> = {
  PIERCING_ARROWS: { id: 'PIERCING_ARROWS', name: 'Piercing Arrows', description: 'Your arrows fly through enemies, hitting all in a line.' },
  VAMPIRIC_STRIKE: { id: 'VAMPIRIC_STRIKE', name: 'Vampiric Strike', description: 'Melee attacks have a 25% chance to heal you for 1 HP.' },
  // ... more augments
};
*/


export const PLAYER_CLASSES: Record<PlayerClass, { name: string, icon: string, char: string, description: string, stats: Partial<Player> }> = {
  Knight: {
    name: 'Knight', icon: '💂', char: '💂',
    description: 'Durable melee expert. High HP & melee damage. Less effective with bombs.',
    stats: { 
        maxHp: 120, hp: 120, attack: 12, gold: 0,
        arrows: 0, maxArrows: 3, bombs: 0, maxBombs: 3, potions: 1, antidotes: 0,
        meleeDamageBonus: 2, arrowDamageBonus: 0, bombDamageBonus: -15
    },
  },
  Ranger: {
    name: 'Ranger', icon: '🥷', char: '🥷',
    description: 'Ranged specialist. Arrows are powerful, but melee is weak. Starts with an antidote.',
    stats: { 
        maxHp: 100, hp: 100, attack: 10, gold: 0,
        arrows: 6, maxArrows: 9, bombs: 0, maxBombs: 3, potions: 0, antidotes: 1,
        meleeDamageBonus: -2, arrowDamageBonus: 5, bombDamageBonus: -10
    },
  },
  Sapper: {
    name: 'Sapper', icon: '👲', char: '👲',
    description: 'Explosives expert. Bombs deal massive damage. Less skilled with arrows.',
    stats: { 
        maxHp: 100, hp: 100, attack: 10, gold: 10,
        arrows: 0, maxArrows: 3, bombs: 3, maxBombs: 5, potions: 1, antidotes: 0,
        meleeDamageBonus: 0, arrowDamageBonus: -5, bombDamageBonus: 25
    },
  }
};

export const PLAYER_DIRECTION_INDICATOR: Record<Direction, { char: string, style: React.CSSProperties }> = {
    ArrowUp:    { char: '▲', style: { top: '-8px', left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.7)'}},
    ArrowDown:  { char: '▼', style: { bottom: '-8px', left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.7)'}},
    ArrowLeft:  { char: '◄', style: { left: '-8px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.7)'}},
    ArrowRight: { char: '►', style: { right: '-8px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.7)'}},
};

export const ENEMY_STYLES: Record<EnemyType, { char: string; baseXp: number }> = {
  [EnemyType.GOBLIN]: { char: '👺', baseXp: 10 }, 
  [EnemyType.SLIME]: { char: '🦠', baseXp: 8 }, 
  [EnemyType.SKELETON]: { char: '💀', baseXp: 12 }, 
  [EnemyType.SPIDER]: { char: '🕷️', baseXp: 15 }, 
};

export const ITEM_STYLES: Record<ItemType, { char: string }> = {
    [ItemType.POTION]: { char: '🧪' },
    [ItemType.GOLD]: { char: '💰' },
    [ItemType.ARROWS]: { char: '🏹' },
    [ItemType.BOMB]: { char: '💣' },
    [ItemType.ANTIDOTE]: { char: '🍶' },
};

export const SHOP_ITEMS = [
    { name: 'Potion', type: ItemType.POTION, cost: 25, emoji: '🧪' },
    { name: 'Antidote', type: ItemType.ANTIDOTE, cost: 30, emoji: '🍶' },
    { name: 'Arrows (3)', type: ItemType.ARROWS, cost: 15, emoji: '🏹' },
    { name: 'Bomb', type: ItemType.BOMB, cost: 40, emoji: '💣' },
] as const;

export const HAZARD_STYLES: Record<HazardType, { char: string }> = {
    [HazardType.SPIKES]: { char: '뾰' },
    [HazardType.FIRE]: { char: '🔥' },
    [HazardType.PIT]: { char: '🕳️' },
};

export const DOODAD_CHARS = ['🪨', '🍄', '🌿', '🦴'];

export const THEMES: ColorScheme[] = [
  { name: 'Default', bg: '#1a1a1a', text: '#f0f0f0', wall: '#4a4a4a', floor: '#303030', accent1: '#a855f7', accent2: '#bef264', doodad: '#78716c' },
  { name: 'Crypt', bg: '#2c3e50', text: '#ecf0f1', wall: '#5D6D7E', floor: '#34495e', accent1: '#5dade2', accent2: '#a9cce3', doodad: '#95a5a6' },
  { name: 'Lava Caves', bg: '#270808', text: '#fadbd8', wall: '#641e16', floor: '#421b1b', accent1: '#f5b041', accent2: '#f1c40f', doodad: '#4a2323' },
  { name: 'Forest', bg: '#143d2E', text: '#e8f8f5', wall: '#1e8449', floor: '#196f3d', accent1: '#a3e4d7', accent2: '#fdebd0', doodad: '#7d6608' },
];

const initialPlayer = { 
  ...PLAYER_CLASSES.Knight.stats,
  x: 1, y: 1, level: 1, xp: 0, xpToNextLevel: XP_BASE, 
  playerClass: 'Knight' as PlayerClass,
  isPoisoned: false, poisonStepCounter: 0,
  corruption: 0, activeAugments: [], // Initial values for new systems
} as Player;

export const GAME_STATE: GameState = {
  map: Array(VIEWPORT_HEIGHT).fill(Array(VIEWPORT_WIDTH).fill(TileType.WALL)),
  player: initialPlayer,
  enemies: [], items: [], exit: null, wizard: null, hazards: [], doodads: [],
  bombs: [], activeBlasts: [], damageNumbers: [], pickedUpItems: new Set(),
  level: 1, theme: THEMES[0], camera: { x: 0, y: 0 },
  altars: [], // Initial value for new system
};