
/**
 * @file App.tsx
 * @description This is the main component for the Sproingle rogue-lite game.
 * It manages all game state, the main game loop, player actions, and rendering of all UI components and modals.
 * The game is turn-based, with player actions triggering subsequent enemy turns and state updates.
 */
import React from 'react';
import { GameGrid } from './components/GameGrid';
import { GameUI } from './components/GameUI';
import { TopHud } from './components/TopHud';
import { Modal } from './components/Modal';
import { LevelUpModal } from './components/LevelUpModal';
import { ShopModal } from './components/ShopModal';
import { TitleScreen } from './components/TitleScreen';
import { SettingsModal } from './components/SettingsModal';
import { Dpad } from './components/Dpad';
import { ActionPanel } from './components/ActionPanel';
import { VolumeControls } from './components/VolumeControls';
import { ClassSelectionModal } from './components/ClassSelectionModal';
import { generateDungeon } from './services/dungeonService';
import { soundService } from './services/soundService';
import { getEnemyDescription } from './services/geminiService';
import type { GameState, Enemy, Position, Item, ArrowProjectile, Direction, Bomb, Player, GameScreen, PlayerClass, DamageNumber } from './types';
import { GAME_STATE, VIEWPORT_WIDTH, VIEWPORT_HEIGHT, ItemType, HazardType, THEMES, ENEMY_STYLES, XP_BASE, XP_GROWTH_FACTOR, SHOP_ITEMS, WORLD_SCREENS_W, WORLD_SCREENS_H, BOMB_FUSE_STEPS, BOMB_RANGE, PLAYER_CLASSES, POISON_TICK_STEPS, POISON_DAMAGE, EnemyType } from './constants';

const App: React.FC = () => {
  // --- CORE GAME STATE ---
  const [gameState, setGameState] = React.useState<GameState>(GAME_STATE);
  const [gameScreen, setGameScreen] = React.useState<GameScreen>('title');
  const [isGameOver, setIsGameOver] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);
  const animatingRef = React.useRef(false); // Ref to prevent player input during animations

  // --- UI/MODAL STATE ---
  const [message, setMessage] = React.useState('Welcome! Use arrow keys to move.');
  const [isInspecting, setIsInspecting] = React.useState(false);
  const [inspectedEnemy, setInspectedEnemy] = React.useState<{ enemy: Enemy; description: string } | null>(null);
  const [isLevelingUp, setIsLevelingUp] = React.useState(false);
  const [isShopping, setIsShopping] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  
  // --- VISUAL/AUDIO FEEDBACK STATE ---
  const [arrowProjectile, setArrowProjectile] = React.useState<ArrowProjectile | null>(null);
  const [isPlayerHit, setIsPlayerHit] = React.useState(false);
  const [isPlayerPoisonedFlashing, setIsPlayerPoisonedFlashing] = React.useState(false);
  const [damageNumbers, setDamageNumbers] = React.useState<DamageNumber[]>([]);
  const [musicVolume, setMusicVolume] = React.useState(() => {
    try {
      const saved = localStorage.getItem('sproingle_music_volume');
      return saved ? JSON.parse(saved) : 0.1;
    } catch { return 0.1; }
  });
  const [sfxVolume, setSfxVolume] = React.useState(() => {
    try {
      const saved = localStorage.getItem('sproingle_sfx_volume');
      return saved ? JSON.parse(saved) : 0.25;
    } catch { return 0.25; }
  });
  
  // --- AUDIO MANAGEMENT ---
  React.useEffect(() => {
    soundService.setMusicVolume(musicVolume);
    localStorage.setItem('sproingle_music_volume', JSON.stringify(musicVolume));
  }, [musicVolume]);
  React.useEffect(() => {
    soundService.setSfxVolume(sfxVolume);
    localStorage.setItem('sproingle_sfx_volume', JSON.stringify(sfxVolume));
  }, [sfxVolume]);

  const handleSfxVolumeChange = (volume: number) => {
    setSfxVolume(volume);
    soundService.playSelect();
  };
  
  // --- THEME MANAGEMENT ---
  React.useEffect(() => {
    const root = document.documentElement;
    const theme = gameState.theme;
    root.style.setProperty('--color-bg', theme.bg);
    root.style.setProperty('--color-text', theme.text);
    root.style.setProperty('--color-wall', theme.wall);
    root.style.setProperty('--color-floor', theme.floor);
    root.style.setProperty('--color-accent1', theme.accent1);
    root.style.setProperty('--color-accent2', theme.accent2);
    root.style.setProperty('--color-doodad', theme.doodad);
  }, [gameState.theme]);

  const createDamageNumber = (x: number, y: number, amount: number, type: 'player' | 'enemy') => {
    const id = Date.now() + Math.random();
    setDamageNumbers(prev => [...prev, { id, x, y, amount, type }]);
    setTimeout(() => {
      setDamageNumbers(prev => prev.filter(dn => dn.id !== id));
    }, 1000);
  };

  const triggerPlayerHitEffect = React.useCallback(() => {
    setIsPlayerHit(true);
    setTimeout(() => setIsPlayerHit(false), 200);
  }, []);
  
  const triggerPoisonFlashEffect = React.useCallback(() => {
    setIsPlayerPoisonedFlashing(true);
    setTimeout(() => setIsPlayerPoisonedFlashing(false), 300);
  }, []);

  const newGame = (level: number, playerOverride?: Partial<Player>) => {
    const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
    const dungeon = generateDungeon(level);
    
    const playerStats = { ...dungeon.player, ...(playerOverride || {}) };

    setGameState({ ...dungeon, theme, level, player: playerStats as Player });
    setMessage(`Level ${level}. Find the stairs!`);
    setIsGameOver(false);
    setIsPaused(false);
    if (level === 1 && !playerOverride) soundService.playStart();
  };

  const startGame = () => {
    soundService.resumeContext();
    soundService.playBackgroundMusic();
    setGameScreen('class_selection');
  };
  
  const handleClassSelect = (playerClass: PlayerClass) => {
    const classData = PLAYER_CLASSES[playerClass];
    const playerStart: Partial<Player> = { ...classData.stats, playerClass, corruption: 0, activeAugments: [] };
    newGame(1, playerStart);
    setGameScreen('game');
  };

  const restartGame = () => {
     const playerClass = gameState.player.playerClass;
     const classDefaults = PLAYER_CLASSES[playerClass].stats;
     const retainedPlayer: Partial<Player> = {
       playerClass: playerClass,
       level: gameState.player.level,
       maxHp: gameState.player.maxHp,
       attack: gameState.player.attack,
       gold: Math.floor(gameState.player.gold / 2),
       xp: 0,
       ...classDefaults, // Carries over correct starting items and caps
       corruption: gameState.player.corruption, // Carry over corruption
       activeAugments: gameState.player.activeAugments, // Carry over augments
     };
     newGame(1, retainedPlayer);
     setMessage('You awake at the entrance, stronger but lighter of pocket...');
  };

  const quitGame = () => {
    setIsPaused(false);
    setGameScreen('title');
  };

  const handleNextLevel = () => {
    soundService.playNextLevel();
    setIsTransitioning(true);
    setTimeout(() => {
        const newDungeonLevel = gameState.level + 1;
        const retainedPlayer: Partial<Player> = { ...gameState.player, hp: gameState.player.maxHp };
        newGame(newDungeonLevel, retainedPlayer);
        setMessage(`You feel stronger! Welcome to level ${newDungeonLevel}`);
        setIsTransitioning(false);
    }, 400);
  };

  const handleInspectEnemy = async (enemy: Enemy) => {
    if (isInspecting) return;
    setIsInspecting(true);
    setInspectedEnemy({ enemy, description: 'Thinking...' });
    soundService.playSelect();
    try {
      const description = await getEnemyDescription(enemy.type);
      setInspectedEnemy({ enemy, description });
    } catch (error) {
      console.error(error);
      setInspectedEnemy({ enemy, description: 'Could not get a read on this one...' });
    }
  };
  
  const handleEnemyDefeated = (enemy: Enemy) => {
    const xpGained = Math.floor(ENEMY_STYLES[enemy.type].baseXp * (1 + gameState.level / 10));
    setMessage(`You defeated the ${enemy.type}! +${xpGained} XP`);
    soundService.playEnemyDeath();
    
    // TODO: Augment Effect Application
    // Example: check for an augment that grants gold on kill
    // if (gameState.player.activeAugments.includes('GOLD_RUSH')) {
    //   setGameState(prev => ({...prev, player: {...prev.player, gold: prev.player.gold + 5}}));
    // }

    setGameState(prev => {
      const newPlayerState = { ...prev.player };
      newPlayerState.xp += xpGained;
      if (newPlayerState.xp >= newPlayerState.xpToNextLevel) {
        setIsLevelingUp(true);
        soundService.playLevelUp();
      }
      return { ...prev, player: newPlayerState };
    });
  };
  
  const handleLevelUpChoice = (choice: 'hp' | 'attack') => {
    setGameState(prev => {
        const newPlayer = {...prev.player};
        if (choice === 'hp') {
            newPlayer.maxHp += 20;
            newPlayer.hp = newPlayer.maxHp;
        } else {
            newPlayer.attack += 5;
        }
        newPlayer.xp -= newPlayer.xpToNextLevel;
        newPlayer.level += 1;
        newPlayer.xpToNextLevel = Math.floor(XP_BASE * Math.pow(newPlayer.level, XP_GROWTH_FACTOR));
        return {...prev, player: newPlayer};
    });
    setIsLevelingUp(false);
  };
  
  const handleBuyItem = (item: typeof SHOP_ITEMS[number]) => {
    if (gameState.player.gold < item.cost) {
        setMessage("You don't have enough gold!");
        return;
    }
    soundService.playShopBuy();
    setGameState(prev => {
        const newPlayer = {...prev.player, gold: prev.player.gold - item.cost};
        switch(item.type) {
            case ItemType.POTION:
                newPlayer.potions = Math.min(3, newPlayer.potions + 1);
                setMessage("Bought a potion.");
                break;
            case ItemType.ARROWS:
                newPlayer.arrows = Math.min(newPlayer.maxArrows, newPlayer.arrows + 3);
                setMessage("Bought 3 arrows.");
                break;
            case ItemType.BOMB:
                newPlayer.bombs = Math.min(newPlayer.maxBombs, newPlayer.bombs + 1);
                setMessage("Bought a bomb.");
                break;
            case ItemType.ANTIDOTE:
                newPlayer.antidotes = Math.min(3, newPlayer.antidotes + 1);
                setMessage("Bought an antidote.");
                break;
        }
        return {...prev, player: newPlayer};
    });
  }

  const processEnemyTurn = () => {
    setGameState(prev => {
      const { player, enemies, map } = prev;
      let newPlayerState = { ...player };
      let messages: string[] = [];
      let playerWasHit = false;

      const updatedEnemies = enemies.map(enemy => {
        if (enemy.hp <= 0) return enemy;
        const playerScreen = { x: Math.floor(player.x / VIEWPORT_WIDTH), y: Math.floor(player.y / VIEWPORT_HEIGHT) };
        const enemyScreen = { x: Math.floor(enemy.x / VIEWPORT_WIDTH), y: Math.floor(enemy.y / VIEWPORT_HEIGHT) };
        if (playerScreen.x !== enemyScreen.x || playerScreen.y !== enemyScreen.y) return enemy;
        let { x: newEx, y: newEy } = enemy;
        const dx = player.x - newEx, dy = player.y - newEy;

        if (Math.abs(dx) > Math.abs(dy)) newEx += Math.sign(dx);
        else if (Math.abs(dy) > Math.abs(dx)) newEy += Math.sign(dy);
        else if (dx !== 0) { if (Math.random() > 0.5) newEx += Math.sign(dx); else newEy += Math.sign(dy); }

        if (newEx === player.x && newEy === player.y) {
          // TODO: Corruption Effect Application
          // Example: Increase enemy damage based on player's corruption level.
          // const corruptionBonus = Math.floor(newPlayerState.corruption / 10);
          const corruptionBonus = 0; // Placeholder
          const enemyDamage = enemy.attack + corruptionBonus + Math.floor(Math.random() * 3);

          newPlayerState.hp -= enemyDamage;
          createDamageNumber(player.x, player.y, enemyDamage, 'player');
          messages.push(`The ${enemy.type} attacks for ${enemyDamage} damage!`);
          playerWasHit = true;

          if (enemy.type === EnemyType.SPIDER && !newPlayerState.isPoisoned) {
              newPlayerState.isPoisoned = true;
              newPlayerState.poisonStepCounter = 0;
              messages.push("You have been poisoned!");
              soundService.playPoisoned();
          }
          return enemy;
        } 
        
        const isWall = map[newEy]?.[newEx] === 1;
        const isOccupied = enemies.some(e => e.id !== enemy.id && e.x === newEx && e.y === newEy && e.hp > 0);
        if (!isWall && !isOccupied) return { ...enemy, x: newEx, y: newEy };
        
        return enemy;
      });

      if (messages.length > 0) setMessage(messages.join(' '));
      if (playerWasHit) { triggerPlayerHitEffect(); soundService.playCrunch(); }
      if (newPlayerState.hp <= 0 && player.hp > 0) { setIsGameOver(true); soundService.playPlayerDeath(); }

      return { ...prev, enemies: updatedEnemies, player: newPlayerState };
    });
    setTimeout(() => animatingRef.current = false, 150);
  };

  const processTurn = (newPlayerPos: Position) => {
    if (animatingRef.current) return;
    animatingRef.current = true;

    setGameState(prev => {
      let newPlayerState = { ...prev.player, ...newPlayerPos };
      let newBombs = prev.bombs.map(b => ({ ...b, stepsRemaining: b.stepsRemaining - 1 }));
      let newEnemies = [...prev.enemies];
      let newPickedUpItems = new Set(prev.pickedUpItems);
      let newActiveBlasts: Position[] = [];
      let shouldEnemiesMove = true;
      let shouldExit = false;

      // Poison Tick
      if (newPlayerState.isPoisoned) {
          newPlayerState.poisonStepCounter++;
          if (newPlayerState.poisonStepCounter >= POISON_TICK_STEPS) {
              newPlayerState.poisonStepCounter = 0;
              newPlayerState.hp -= POISON_DAMAGE;
              createDamageNumber(newPlayerState.x, newPlayerState.y, POISON_DAMAGE, 'player');
              setMessage("The poison burns...");
              soundService.playPoisonTick();
              triggerPoisonFlashEffect();
          }
      }

      // Bomb Detonation
      const explodingBombs = newBombs.filter(b => b.stepsRemaining <= 0);
      newBombs = newBombs.filter(b => b.stepsRemaining > 0);
      if (explodingBombs.length > 0) {
          soundService.playExplosion();
          explodingBombs.forEach(bomb => {
              for (let i = 0; i < 4; i++) {
                  for (let j = 1; j <= BOMB_RANGE; j++) {
                      const dx = i === 0 ? j : i === 1 ? -j : 0;
                      const dy = i === 2 ? j : i === 3 ? -j : 0;
                      const tileX = bomb.x + dx, tileY = bomb.y + dy;
                      if (prev.map[tileY]?.[tileX] === 1) break;
                      if (!newActiveBlasts.some(p => p.x === tileX && p.y === tileY)) newActiveBlasts.push({x: tileX, y: tileY});
                  }
              }
              if (!newActiveBlasts.some(p => p.x === bomb.x && p.y === bomb.y)) newActiveBlasts.push({x: bomb.x, y: bomb.y});
          });
          const bombDamage = 50 + newPlayerState.bombDamageBonus;
          newEnemies = newEnemies.map(enemy => {
              if (enemy.hp > 0 && newActiveBlasts.some(p => p.x === enemy.x && p.y === enemy.y)) {
                  const newHp = enemy.hp - bombDamage;
                  createDamageNumber(enemy.x, enemy.y, bombDamage, 'enemy');
                  if (newHp <= 0) handleEnemyDefeated(enemy);
                  return {...enemy, hp: newHp, isHit: true};
              }
              return enemy;
          });
          if (newActiveBlasts.some(p => p.x === newPlayerState.x && p.y === newPlayerState.y)) {
              newPlayerState.hp -= bombDamage;
              createDamageNumber(newPlayerState.x, newPlayerState.y, bombDamage, 'player');
              triggerPlayerHitEffect();
          }
      }
      
      soundService.playSproing();

      // Interaction Logic
      if (prev.wizard?.x === newPlayerPos.x && prev.wizard?.y === newPlayerPos.y) {
          setIsShopping(true);
          soundService.playSelect();
          shouldEnemiesMove = false;
      } else if (prev.exit?.x === newPlayerPos.x && prev.exit?.y === newPlayerPos.y) {
          shouldExit = true;
          shouldEnemiesMove = false;
      // --- TODO: Altar Interaction Logic ---
      // const altarAtPos = prev.altars.find(a => a.x === newPlayerPos.x && a.y === newPlayerPos.y);
      // if (altarAtPos) {
      //   openAltarModal(altarAtPos); // A new modal state would be needed.
      //   shouldEnemiesMove = false;
      // }
      // --- END TODO ---
      } else {
        const itemAtPos = prev.items.find(i => i.x === newPlayerPos.x && i.y === newPlayerPos.y);
        if (itemAtPos) {
            const itemKey = `${itemAtPos.x},${itemAtPos.y}`;
            if (!newPickedUpItems.has(itemKey)) {
                newPickedUpItems.add(itemKey);
                switch (itemAtPos.type) {
                    case ItemType.POTION:
                        if (newPlayerState.hp < newPlayerState.maxHp) {
                            newPlayerState.hp = Math.min(newPlayerState.maxHp, newPlayerState.hp + 20);
                            setMessage("You drink a healing potion! +20 HP");
                            soundService.playHeal();
                        } else {
                            newPlayerState.potions = Math.min(3, newPlayerState.potions + 1);
                            setMessage("You stored a potion for later.");
                            soundService.playArrowPickup();
                        }
                        break;
                    case ItemType.GOLD: newPlayerState.gold += 5 + prev.level; setMessage(`You found ${5 + prev.level} gold!`); soundService.playGoldPickup(); break;
                    case ItemType.ARROWS: newPlayerState.arrows = Math.min(newPlayerState.maxArrows, newPlayerState.arrows + 3); setMessage(`You found 3 arrows!`); soundService.playArrowPickup(); break;
                    case ItemType.BOMB: newPlayerState.bombs = Math.min(newPlayerState.maxBombs, newPlayerState.bombs + 1); setMessage(`You found a bomb!`); soundService.playArrowPickup(); break;
                    case ItemType.ANTIDOTE: newPlayerState.antidotes = Math.min(3, newPlayerState.antidotes + 1); setMessage(`You found an antidote!`); soundService.playArrowPickup(); break;
                }
            }
        }

        const hazardAtPos = prev.hazards.find(t => t.x === newPlayerPos.x && t.y === newPlayerPos.y);
        if (hazardAtPos) {
            let damage = 0, isInstantDeath = false;
            switch(hazardAtPos.type) {
                case HazardType.PIT: setMessage(`You fell into a pit!`); soundService.playFall(); isInstantDeath = true; break;
                case HazardType.SPIKES: damage = 5 + prev.level; setMessage(`You stepped on spikes! -${damage} HP`); soundService.playTrap(); break;
                case HazardType.FIRE: damage = 8 + prev.level; setMessage(`You stepped in fire! -${damage} HP`); soundService.playTrap(); break;
            }
            if(damage > 0) createDamageNumber(newPlayerState.x, newPlayerState.y, damage, 'player');
            newPlayerState.hp -= damage;
            triggerPlayerHitEffect();
            if (isInstantDeath) newPlayerState.hp = 0;
        } 
      }
      
      if (newPlayerState.hp <= 0 && prev.player.hp > 0) {
          setIsGameOver(true);
          soundService.playPlayerDeath();
          shouldEnemiesMove = false;
          newPlayerState.hp = 0;
      }
      
      const finalState = { ...prev, player: newPlayerState, bombs: newBombs, enemies: newEnemies.map(e => ({...e, isHit: false})), pickedUpItems: newPickedUpItems, activeBlasts: newActiveBlasts };

      setTimeout(() => {
          if (shouldExit) handleNextLevel();
          else if (shouldEnemiesMove) processEnemyTurn();
          else animatingRef.current = false;
      }, 150);

      if (newActiveBlasts.length > 0) setTimeout(() => setGameState(p => ({...p, activeBlasts: []})), 200);
      
      return finalState;
    });
  };
  
  const handleMove = React.useCallback((direction: Direction) => {
    if (isGameOver || isInspecting || animatingRef.current || arrowProjectile || isPaused || isLevelingUp || isShopping || isTransitioning) return;
    setGameState(prev => ({...prev, player: {...prev.player, lastMoveDirection: direction}}));
    let { x, y } = gameState.player;
    let nextX = x, nextY = y;

    if (direction === 'ArrowUp') nextY--; else if (direction === 'ArrowDown') nextY++; else if (direction === 'ArrowLeft') nextX--; else if (direction === 'ArrowRight') nextX++; else return;
    if (gameState.map[nextY]?.[nextX] === 1) { setMessage("Ouch! A wall."); soundService.playBump(); return; }

    const currentScreen = gameState.camera;
    const nextScreen = { x: Math.floor(nextX / VIEWPORT_WIDTH), y: Math.floor(nextY / VIEWPORT_HEIGHT) };
    if (currentScreen.x !== nextScreen.x || currentScreen.y !== nextScreen.y) {
        if (nextScreen.x >= 0 && nextScreen.x < WORLD_SCREENS_W && nextScreen.y >= 0 && nextScreen.y < WORLD_SCREENS_H) {
            setIsTransitioning(true); soundService.playNextLevel();
            setTimeout(() => {
                setGameState(prev => ({...prev, player: {...prev.player, x: nextX, y: nextY}, camera: nextScreen}));
                setIsTransitioning(false);
            }, 300);
        } else { setMessage("You can't go that way."); soundService.playBump(); }
        return;
    }

    const enemyAtPos = gameState.enemies.find(enemy => enemy.x === nextX && enemy.y === nextY && enemy.hp > 0);
    if (enemyAtPos) {
        animatingRef.current = true;
        let newPlayerState = { ...gameState.player };
        let newEnemiesState = [...gameState.enemies];
        let messages: string[] = [];

        const playerDamage = newPlayerState.attack + newPlayerState.meleeDamageBonus + Math.floor(Math.random() * 5);
        const enemyIndex = newEnemiesState.findIndex(e => e.id === enemyAtPos.id);
        const newEnemyHp = newEnemiesState[enemyIndex].hp - playerDamage;
        messages.push(`You hit the ${enemyAtPos.type} for ${playerDamage} damage!`);
        createDamageNumber(enemyAtPos.x, enemyAtPos.y, playerDamage, 'enemy');
        soundService.playCrunch();
        newEnemiesState[enemyIndex] = {...newEnemiesState[enemyIndex], hp: newEnemyHp, isHit: true};

        if (newEnemyHp > 0) {
            const enemyDamage = enemyAtPos.attack + Math.floor(Math.random() * 3);
            newPlayerState.hp -= enemyDamage;
            messages.push(`The ${enemyAtPos.type} hits back for ${enemyDamage} damage!`);
            createDamageNumber(newPlayerState.x, newPlayerState.y, enemyDamage, 'player');
            triggerPlayerHitEffect();
        } else { handleEnemyDefeated(enemyAtPos); }
        setMessage(messages.join(' '));
        if (newPlayerState.hp <= 0) { setIsGameOver(true); soundService.playPlayerDeath(); newPlayerState.hp = 0; }
        
        setGameState(prev => ({...prev, player: newPlayerState, enemies: newEnemiesState}));
        setTimeout(() => {
          setGameState(prev => ({...prev, enemies: prev.enemies.map(e => ({...e, isHit: false}))}));
          if (newPlayerState.hp > 0) processEnemyTurn(); else animatingRef.current = false;
        }, 150);
    } else { processTurn({x: nextX, y: nextY}); }
  }, [gameState, isGameOver, isInspecting, arrowProjectile, isPaused, isLevelingUp, isShopping, isTransitioning, triggerPlayerHitEffect]);

  const handleFireArrow = React.useCallback(() => {
    const { player } = gameState;
    if (isGameOver || isInspecting || animatingRef.current || arrowProjectile || player.arrows <= 0 || !player.lastMoveDirection || isPaused || isLevelingUp || isShopping || isTransitioning) return;
    setGameState(prev => ({...prev, player: {...prev.player, arrows: prev.player.arrows - 1}}));
    soundService.playArrowFire();
    const direction = player.lastMoveDirection;
    let arrowPos = { x: player.x, y: player.y };

    const moveArrow = () => {
      if (direction === 'ArrowUp') arrowPos.y--; else if (direction === 'ArrowDown') arrowPos.y++; else if (direction === 'ArrowLeft') arrowPos.x--; else arrowPos.x++;
      setArrowProjectile({ ...arrowPos, visible: true, direction });
      const { map, enemies } = gameState;
      if (map[arrowPos.y]?.[arrowPos.x] === 1) { setArrowProjectile(null); return; }
      const enemyHitIndex = enemies.findIndex(e => e.x === arrowPos.x && e.y === arrowPos.y && e.hp > 0);
      if (enemyHitIndex !== -1) {
        const arrowDamage = Math.floor((gameState.player.attack + gameState.player.arrowDamageBonus) * 0.8) + Math.floor(Math.random() * 4);
        setGameState(prev => {
          const newEnemies = [...prev.enemies];
          const updatedEnemy = {...newEnemies[enemyHitIndex]};
          updatedEnemy.hp -= arrowDamage;
          updatedEnemy.isHit = true;
          newEnemies[enemyHitIndex] = updatedEnemy;
          createDamageNumber(updatedEnemy.x, updatedEnemy.y, arrowDamage, 'enemy');
          setMessage(`Arrow hit ${updatedEnemy.type} for ${arrowDamage} damage!`);
          soundService.playArrowHit();
          if (updatedEnemy.hp <= 0) handleEnemyDefeated(updatedEnemy);
          setTimeout(() => setGameState(p => ({...p, enemies: p.enemies.map(e => ({...e, isHit: false}))})), 200);
          return {...prev, enemies: newEnemies};
        });
        // TODO: Augment Effect Application
        // Example: If the player has 'PIERCING_ARROWS', don't stop the arrow here.
        // if (!gameState.player.activeAugments.includes('PIERCING_ARROWS')) {
        //   setArrowProjectile(null);
        //   return;
        // }
        setArrowProjectile(null);
        return;
      }
      setTimeout(moveArrow, 60);
    };
    moveArrow();
  }, [gameState, isGameOver, isInspecting, arrowProjectile, isPaused, isLevelingUp, isShopping, isTransitioning]);
  
  const handleDropBomb = React.useCallback(() => {
    const { player, bombs } = gameState;
    if (isGameOver || isInspecting || animatingRef.current || isPaused || player.bombs <= 0 || isLevelingUp || isShopping || isTransitioning) return;
    if (bombs.some(b => b.x === player.x && b.y === player.y)) return;
    setGameState(prev => ({ ...prev, player: { ...prev.player, bombs: prev.player.bombs - 1}, bombs: [...prev.bombs, { x: player.x, y: player.y, stepsRemaining: BOMB_FUSE_STEPS, id: Date.now() }] }));
    soundService.playBombDrop();
  }, [gameState, isGameOver, isInspecting, isPaused, isLevelingUp, isShopping, isTransitioning]);

  const handleUsePotion = React.useCallback(() => {
    if (gameState.player.potions <= 0 || gameState.player.hp === gameState.player.maxHp) return;
    setGameState(prev => ({...prev, player: {...prev.player, potions: prev.player.potions - 1, hp: Math.min(prev.player.maxHp, prev.player.hp + 50)}}));
    setMessage("You drink a potion and feel refreshed. +50 HP");
    soundService.playHeal();
  }, [gameState.player.potions, gameState.player.hp, gameState.player.maxHp]);

  const handleUseAntidote = React.useCallback(() => {
    if (gameState.player.antidotes <= 0 || !gameState.player.isPoisoned) return;
    setGameState(prev => ({...prev, player: {...prev.player, antidotes: prev.player.antidotes - 1, isPoisoned: false}}));
    setMessage("You drink the antidote. The poison subsides.");
    soundService.playCure();
  }, [gameState.player.antidotes, gameState.player.isPoisoned]);

  const handleKeyDown = React.useCallback((e: KeyboardEvent) => {
    if (gameScreen !== 'game' || isGameOver) return;
    if (e.key === 'Escape') {
      if (isInspecting) { setInspectedEnemy(null); setIsInspecting(false); } 
      else if (isShopping) setIsShopping(false);
      else if (!isLevelingUp) setIsPaused(prev => !prev);
      return;
    }
    if (isPaused || isLevelingUp || isShopping || isTransitioning) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) handleMove(e.key as Direction);
    else if (e.key === 'f' || e.key === ' ') { e.preventDefault(); handleFireArrow(); } 
    else if (e.key === 'b') { e.preventDefault(); handleDropBomb(); }
    else if (e.key === 'h') { e.preventDefault(); handleUsePotion(); }
    else if (e.key === 'u') { e.preventDefault(); handleUseAntidote(); }
  }, [handleMove, handleFireArrow, handleDropBomb, handleUsePotion, handleUseAntidote, isPaused, isGameOver, isLevelingUp, isShopping, isInspecting, gameScreen, isTransitioning]);

  React.useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
  
  const anyModalOpen = isGameOver || !!inspectedEnemy || isPaused || isLevelingUp || isShopping;

  const renderGame = () => (
    <div className={`w-full h-full ${isPlayerHit ? 'screen-shake' : ''} ${isPlayerPoisonedFlashing ? 'green-flash' : ''} flex flex-col`}>
      <header className="w-full max-w-lg mx-auto flex-shrink-0">
        <TopHud player={gameState.player} onPause={() => setIsPaused(true)} />
      </header>
      
      <main className="flex-grow flex flex-col items-center justify-center">
          <div className="relative p-1 bg-black mx-auto" style={{border: '2px solid var(--color-accent2)', boxShadow: `0 0 10px var(--color-accent2)`, width: 'fit-content'}}>
            <GameGrid 
              map={gameState.map} player={gameState.player} enemies={gameState.enemies}
              items={gameState.items.filter(i => !gameState.pickedUpItems.has(`${i.x},${i.y}`))}
              exit={gameState.exit} wizard={gameState.wizard} hazards={gameState.hazards}
              doodads={gameState.doodads} bombs={gameState.bombs} activeBlasts={gameState.activeBlasts}
              arrowProjectile={arrowProjectile} onEnemyClick={handleInspectEnemy} camera={gameState.camera}
              isTransitioning={isTransitioning} isPlayerHit={isPlayerHit} isPlayerPoisonedFlashing={isPlayerPoisonedFlashing}
              damageNumbers={damageNumbers}
              // TODO: Pass altars to the GameGrid
              altars={gameState.altars}
            />
            <GameUI message={message} />
            {anyModalOpen && <div className="absolute inset-0 bg-black bg-opacity-70 z-10" />}
          </div>
      </main>
      
      {!anyModalOpen && (
        <footer className="w-full flex-shrink-0 md:hidden p-2 flex justify-between items-end">
          <Dpad onMove={handleMove} />
          <ActionPanel onFireArrow={handleFireArrow} onDropBomb={handleDropBomb} onUsePotion={handleUsePotion} onUseAntidote={handleUseAntidote} player={gameState.player} />
        </footer>
      )}

      {isGameOver && (
        <Modal title="YOU DIED" onClose={restartGame} buttonText="Try Again?">
          <p className="text-center text-lg">You reached player level {gameState.player.level} on dungeon level {gameState.level} with {gameState.player.gold} gold.</p>
           <p className="text-center text-sm mt-4">Your strength and resilience grow, but your wallet feels lighter...</p>
        </Modal>
      )}
      {isPaused && (
        <Modal title="PAUSED" onClose={() => setIsPaused(false)} buttonText="Resume">
          <div className="flex flex-col items-center space-y-6">
            <VolumeControls musicVolume={musicVolume} sfxVolume={sfxVolume} onMusicVolumeChange={setMusicVolume} onSfxVolumeChange={handleSfxVolumeChange} />
            <div className="w-full flex justify-around items-center pt-4">
              <button onClick={restartGame} className="bg-orange-600 text-white px-6 py-2 font-bold hover:bg-orange-500 active:scale-95 transform transition-all">Restart</button>
              <button onClick={quitGame} className="bg-red-600 text-white px-6 py-2 font-bold hover:bg-red-500 active:scale-95 transform transition-all">Quit</button>
            </div>
          </div>
        </Modal>
      )}
      {isLevelingUp && (<LevelUpModal onChoice={handleLevelUpChoice} />)}
      {/* FIX: Changed handleBuy to handleBuyItem */}
      {isShopping && gameState.wizard && (<ShopModal playerGold={gameState.player.gold} onBuy={handleBuyItem} onClose={() => setIsShopping(false)} />)}
      {/* TODO: Create an AltarModal component to display when the player interacts with an Altar */}
      {inspectedEnemy && (
        <Modal title={`Inspecting ${inspectedEnemy.enemy.type}`} onClose={() => { setInspectedEnemy(null); setIsInspecting(false); }} buttonText="Close">
          <div className="text-center">
            <p className="text-lg" style={{color: 'var(--color-accent1)'}}>HP: {inspectedEnemy.enemy.hp}, ATK: {inspectedEnemy.enemy.attack}</p>
            <p className="mt-4 text-base min-h-[6em] flex items-center justify-center" style={{color: 'var(--color-text)'}}>"{inspectedEnemy.description}"</p>
          </div>
        </Modal>
      )}
    </div>
  );
  
  return (
    <div className="flex flex-col h-screen p-2 sm:p-4 select-none" style={{backgroundColor: 'var(--color-bg)'}}>
      {gameScreen === 'title' && <TitleScreen onStart={startGame} onSettings={() => setIsSettingsOpen(true)} />}
      {gameScreen === 'class_selection' && <ClassSelectionModal onSelect={handleClassSelect} />}
      {gameScreen === 'game' && renderGame()}
      {isSettingsOpen && (
         <SettingsModal onClose={() => setIsSettingsOpen(false)}>
            <VolumeControls musicVolume={musicVolume} sfxVolume={sfxVolume} onMusicVolumeChange={setMusicVolume} onSfxVolumeChange={handleSfxVolumeChange} />
         </SettingsModal>
      )}
    </div>
  );
};

export default App;