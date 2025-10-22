/**
 * @file types.ts
 * @description This file contains all the core type definitions and interfaces for the Sproingle game.
 * It serves as the single source of truth for the data structures used throughout the application.
 */
import { TileType, EnemyType, ItemType, HazardType } from './constants';

export type Direction = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';
export type GameScreen = 'title' | 'class_selection' | 'game';
export type PlayerClass = 'Knight' | 'Ranger' | 'Sapper';

// --- FUTURE FEATURE: AUGMENTS ---
// TODO: Define specific augment IDs as we create them.
// export type AugmentId = 'PIERCING_ARROWS' | 'VAMPIRIC_STRIKE' | 'EXTRA_GOLD';
export type AugmentId = string; 

export interface Augment {
  id: AugmentId;
  name: string;
  description: string;
}
// --- END FUTURE FEATURE ---

export interface Position { x: number; y: number; }

export interface Player extends Position {
  hp: number;
  maxHp: number;
  attack: number;
  // Consumables
  arrows: number;
  maxArrows: number;
  bombs: number;
  maxBombs: number;
  potions: number;
  antidotes: number;
  gold: number;
  // Progression
  level: number;
  xp: number;
  xpToNextLevel: number;
  // Class & State
  playerClass: PlayerClass;
  lastMoveDirection?: Direction;
  isPoisoned: boolean;
  poisonStepCounter: number;
  // Damage modifiers
  meleeDamageBonus: number;
  arrowDamageBonus: number;
  bombDamageBonus: number;
  // --- FUTURE FEATURE: CORRUPTION & AUGMENTS ---
  // TODO: Implement Corruption and Augments.
  corruption: number; // Increases when accepting powerful boons.
  activeAugments: AugmentId[]; // List of currently active run-altering upgrades.
  // --- END FUTURE FEATURE ---
}

export interface Enemy extends Position {
  id: number;
  type: EnemyType;
  hp: number;
  attack: number;
  isHit?: boolean;
}

export interface Item extends Position { type: ItemType; }
export interface Hazard extends Position { type: HazardType; }
export interface Doodad extends Position { char: string; }
export interface Bomb extends Position { id: number; stepsRemaining: number; }
export interface ArrowProjectile extends Position { visible: boolean; direction: Direction; }
export interface Wizard extends Position {}
// --- FUTURE FEATURE: ALTARS ---
// TODO: Implement Altars as interactable objects that grant Augments.
export interface Altar extends Position {}
// --- END FUTURE FEATURE ---

export interface DamageNumber {
    id: number;
    x: number;
    y: number;
    amount: number;
    type: 'player' | 'enemy';
}

export interface ColorScheme {
    name: string; bg: string; text: string; wall: string; floor: string;
    accent1: string; accent2: string; doodad: string;
}

export interface GameState {
  map: TileType[][];
  player: Player;
  enemies: Enemy[];
  items: Item[];
  exit: Position | null;
  wizard: Wizard | null;
  hazards: Hazard[];
  doodads: Doodad[];
  bombs: Bomb[];
  activeBlasts: Position[];
  damageNumbers: DamageNumber[];
  pickedUpItems: Set<string>;
  level: number;
  theme: ColorScheme;
  camera: Position;
  // --- FUTURE FEATURE: ALTARS ---
  // TODO: Add altars to the game state.
  altars: Altar[];
  // --- END FUTURE FEATURE ---
}