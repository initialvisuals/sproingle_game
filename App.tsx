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
import { CorruptionMeter } from './components/CorruptionMeter';
import { generateDungeon } from './services/dungeonService';
import { soundService } from './services/soundService';
import { getEnemyDescription } from './services/geminiService';
import type { GameState, Enemy, Position, Item, ArrowProjectile, Direction, Bomb, Player, GameScreen, PlayerClass, DamageNumber, AugmentId } from '../../types';
import { GAME_STATE, ItemType, HazardType, XP_BASE, XP_GROWTH_FACTOR, BOMB_FUSE_STEPS, BOMB_RANGE, POISON_TICK_STEPS, POISON_DAMAGE, EnemyType, TileType } from './constants';
import { PLAYER_CLASSES } from './data/player_classes';
import { ENEMY_DATA } from './data/enemies';
import { SHOP_ITEMS } from './data/items';
import { SYSTEMS } from './data/systems';
import { AUGMENTS } from './data/augments';
import { ALTAR_EFFECTS } from './data/altars';


const App: React.FC = () => {
  const [gameState, setGameState] = React.useState<GameState>(GAME_STATE);
  const [gameScreen, setGameScreen] = React.useState<GameScreen>('title');
  const [isGameOver, setIsGameOver] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);
  const animatingRef = React.useRef(false);

  const [message, setMessage] = React.useState('Welcome! Use arrow keys to move.');
  const [isInspecting, setIsInspecting] = React.useState(false);
  const [inspectedEnemy, setInspectedEnemy] = React.useState<{ enemy: Enemy; description: string } | null>(null);
  const [isLevelingUp, setIsLevelingUp] = React.useState(false);
  const [isShopping, setIsShopping] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  
  const [arrowProjectile, setArrowProjectile] = React.useState<ArrowProjectile | null>(null);
  const [isPlayerHit, setIsPlayerHit] = React.useState(false);
  const [isPlayerPoisonedFlashing, setIsPlayerPoisonedFlashing] = React.useState(false);
  const [damageNumbers, setDamageNumbers] = React.useState<DamageNumber[]>([]);
  const [musicVolume, setMusicVolume] = React.useState(() => { try { const saved = localStorage.getItem('sproingle_music_volume'); return saved ? JSON.parse(saved) : 0.1; } catch { return 0.1; } });
  const [sfxVolume, setSfxVolume] = React.useState(() => { try { const saved = localStorage.getItem('sproingle_sfx_volume'); return saved ? JSON.parse(saved) : 0.25; } catch { return 0.25; } });
  
  React.useEffect(() => { soundService.setMusicVolume(musicVolume); localStorage.setItem('sproingle_music_volume', JSON.stringify(musicVolume)); }, [musicVolume]);
  React.useEffect(() => { soundService.setSfxVolume(sfxVolume); localStorage.setItem('sproingle_sfx_volume', JSON.stringify(sfxVolume)); }, [sfxVolume]);

  const handleSfxVolumeChange = (volume: number) => { setSfxVolume(volume); soundService.play('select'); };
  
  React.useEffect(() => {
    const root = document.documentElement;
    const theme = gameState.theme;
    if(theme) {
       Object.keys(theme).forEach(key => {
         if (key !== 'name') root.style.setProperty(`--color-${key}`, theme[key])
       });
    }
  }, [gameState.theme]);
  
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isGameOver || isLevelingUp || isShopping || isSettingsOpen) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        handleMove(e.key as Direction);
      } else if (e.key.toLowerCase() === 'p') usePotion();
      else if (e.key.toLowerCase() === 'b') placeBomb();
      else if (e.key.toLowerCase() === 'a') fireArrow();
      else if (e.key.toLowerCase() === 'c') useAntidote();
      else if (e.key.toLowerCase() === 'escape') setIsPaused(p => !p);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, isGameOver, isLevelingUp, isShopping, isSettingsOpen, isPaused]);


  const createDamageNumber = (x: number, y: number, amount: number, type: 'player' | 'enemy') => {
    const id = Date.now() + Math.random();
    setDamageNumbers(prev => [...prev, { id, x, y, amount, type }]);
    setTimeout(() => { setDamageNumbers(prev => prev.filter(dn => dn.id !== id)); }, 1000);
  };

  const triggerPlayerHitEffect = React.useCallback(() => { setIsPlayerHit(true); setTimeout(() => setIsPlayerHit(false), 200); }, []);
  const triggerPoisonFlashEffect = React.useCallback(() => { setIsPlayerPoisonedFlashing(true); setTimeout(() => setIsPlayerPoisonedFlashing(false), 300); }, []);

  const newGame = (level: number, playerOverride?: Partial<Player>) => {
    const theme = SYSTEMS.THEMES[Math.floor(Math.random() * SYSTEMS.THEMES.length)];
    const dungeon = generateDungeon(level);
    const playerStats = { ...dungeon.player, ...(playerOverride || {}) };
    setGameState({ ...dungeon, theme, level, player: playerStats as Player });
    setMessage(`Level ${level}. Find the stairs!`);
    setIsGameOver(false);
    setIsPaused(false);
    if (level === 1 && !playerOverride) soundService.play('level_start');
  };

  const startGame = () => { soundService.init(); soundService.playBackgroundMusic(); setGameScreen('class_selection'); };
  
  const handleClassSelect = (playerClass: PlayerClass) => {
    const classData = PLAYER_CLASSES[playerClass];
    const playerStart: Partial<Player> = { ...classData.stats, playerClass, corruption: 0, activeAugments: [], stepsTaken: 0 };
    newGame(1, playerStart);
    setGameScreen('game');
  };

  const restartGame = () => {
     const playerClass = gameState.player.playerClass;
     const classDefaults = PLAYER_CLASSES[playerClass].stats;
     const retainedPlayer: Partial<Player> = {
       playerClass: playerClass, level: gameState.player.level, maxHp: gameState.player.maxHp,
       attack: gameState.player.attack, gold: Math.floor(gameState.player.gold / 2), xp: 0,
       ...classDefaults, corruption: gameState.player.corruption, activeAugments: gameState.player.activeAugments,
     };
     newGame(1, retainedPlayer);
     setMessage('You awake at the entrance, stronger but lighter of pocket...');
  };

  const quitGame = () => { setIsPaused(false); soundService.stopBackgroundMusic(); setGameScreen('title'); };

  const handleNextLevel = () => {
    soundService.play('level_up');
    setIsTransitioning(true);
    setTimeout(() => {
        const newDungeonLevel = gameState.level + 1;
        const retainedPlayer: Partial<Player> = { ...gameState.player, hp: gameState.player.maxHp };
        newGame(newDungeonLevel, retainedPlayer);
        setMessage(`Welcome to level ${newDungeonLevel}`);
        setIsTransitioning(false);
    }, 400);
  };

  const handleInspectEnemy = async (enemy: Enemy) => {
    if (isInspecting) return;
    setIsInspecting(true);
    setInspectedEnemy({ enemy, description: 'Thinking...' });
    soundService.play('inspect');
    try {
      const description = await getEnemyDescription(enemy.type);
      setInspectedEnemy({ enemy, description });
    } catch (error) {
      console.error(error);
      setInspectedEnemy({ enemy, description: 'Could not get a read on this one...' });
    }
  };
  
  const handleEnemyDefeated = (enemy: Enemy) => {
    const xpGained = Math.floor(ENEMY_DATA[enemy.type].baseXp * (1 + gameState.level / 10));
    setMessage(`Defeated ${enemy.type}! +${xpGained} XP`);
    soundService.play('enemy_die');
    
    setGameState(prev => {
      let newEnemies = prev.enemies;
      // Handle slime splitting
      if(ENEMY_DATA[enemy.type].onDeath === 'split') {
          setMessage("The slime splits in two!");
          soundService.play('slime_split');
          const babySlime = { ...ENEMY_DATA.SLIME_MINI, id: Date.now(), x: enemy.x, y: enemy.y };
          const babySlime2 = { ...ENEMY_DATA.SLIME_MINI, id: Date.now()+1, x: enemy.x+1, y: enemy.y }; // a bit naive
          newEnemies.push(babySlime, babySlime2);
      }

      const newPlayerState = { ...prev.player, xp: prev.player.xp + xpGained };
      if (newPlayerState.xp >= newPlayerState.xpToNextLevel) {
        setIsLevelingUp(true);
        soundService.play('level_up');
      }
      return { ...prev, player: newPlayerState, enemies: newEnemies };
    });
  };
  
  const handleLevelUpChoice = (choice: 'hp' | 'attack') => {
    setGameState(prev => {
        const newPlayer = {...prev.player};
        if (choice === 'hp') { newPlayer.maxHp += 20; newPlayer.hp = newPlayer.maxHp; } 
        else { newPlayer.attack += 5; }
        newPlayer.xp -= newPlayer.xpToNextLevel;
        newPlayer.level += 1;
        newPlayer.xpToNextLevel = Math.floor(XP_BASE * Math.pow(newPlayer.level, XP_GROWTH_FACTOR));
        return {...prev, player: newPlayer};
    });
    setIsLevelingUp(false);
  };
  
  const handleBuyItem = (item: typeof SHOP_ITEMS[number]) => {
    if (gameState.player.gold < item.cost) { setMessage("Not enough gold!"); soundService.play('error'); return; }
    soundService.play('buy_item');
    setGameState(prev => {
        const newPlayer = {...prev.player, gold: prev.player.gold - item.cost};
        switch(item.type) {
            case ItemType.POTION: newPlayer.potions = Math.min(3, newPlayer.potions + 1); setMessage("Bought a potion."); break;
            case ItemType.ARROWS: newPlayer.arrows = Math.min(newPlayer.maxArrows, newPlayer.arrows + 3); setMessage("Bought 3 arrows."); break;
            case ItemType.BOMB: newPlayer.bombs = Math.min(newPlayer.maxBombs, newPlayer.bombs + 1); setMessage("Bought a bomb."); break;
            case ItemType.ANTIDOTE: newPlayer.antidotes = Math.min(3, newPlayer.antidotes + 1); setMessage("Bought an antidote."); break;
        }
        return {...prev, player: newPlayer};
    });
  };
  
  const usePotion = () => {
    if (gameState.player.activeAugments.includes('IRON_WILL')) { setMessage("Your iron will prevents you from drinking potions!"); soundService.play('error'); return; }
    if (gameState.player.potions > 0 && gameState.player.hp < gameState.player.maxHp) {
      soundService.play('use_potion');
      setGameState(prev => {
        const healAmount = Math.floor(prev.player.maxHp * 0.5);
        const newHp = Math.min(prev.player.maxHp, prev.player.hp + healAmount);
        return { ...prev, player: { ...prev.player, hp: newHp, potions: prev.player.potions - 1 } };
      });
      setMessage("You used a potion and feel refreshed.");
    } else {
      setMessage(gameState.player.potions === 0 ? "No potions!" : "Health is full.");
    }
  };

  const useAntidote = () => {
      if(gameState.player.antidotes > 0 && gameState.player.isPoisoned) {
          soundService.play('use_potion');
          setGameState(prev => ({ ...prev, player: { ...prev.player, isPoisoned: false, poisonStepCounter: 0, antidotes: prev.player.antidotes - 1 }}));
          setMessage("You used an antidote and the poison subsided.");
      } else {
          setMessage(gameState.player.antidotes === 0 ? "No antidotes!" : "You are not poisoned.");
      }
  }

  const placeBomb = () => {
    if (gameState.player.bombs > 0) {
      soundService.play('place_bomb');
      setGameState(prev => ({
        ...prev,
        player: { ...prev.player, bombs: prev.player.bombs - 1 },
        bombs: [...prev.bombs, { id: Date.now(), x: prev.player.x, y: prev.player.y, stepsRemaining: BOMB_FUSE_STEPS }]
      }));
      setMessage("You placed a bomb. Get clear!");
    } else {
      setMessage("No bombs!");
    }
  }

  const fireArrow = () => {
    if (gameState.player.arrows > 0 && gameState.player.lastMoveDirection) {
      soundService.play('arrow_shot');
      setGameState(prev => ({ ...prev, player: { ...prev.player, arrows: prev.player.arrows - 1 } }));
      setArrowProjectile({ x: gameState.player.x, y: gameState.player.y, direction: gameState.player.lastMoveDirection, visible: true });
      animatingRef.current = true;
    } else {
      setMessage(gameState.player.arrows === 0 ? "No arrows!" : "Move first to aim.");
    }
  };
  
  const processAugmentEffects = (playerState: Player): Player => {
    let newPlayer = {...playerState};
    if(newPlayer.activeAugments.includes('CORRUPTED_BLOOD') && newPlayer.stepsTaken % 25 === 0 && newPlayer.stepsTaken > 0) {
        newPlayer.maxHp = Math.max(1, newPlayer.maxHp - 1);
        newPlayer.hp = Math.min(newPlayer.hp, newPlayer.maxHp);
        setMessage("Your corrupted blood drains your vitality...");
    }
    return newPlayer;
  }

  const processEnemyTurn = (currentState: GameState): GameState => {
    let newEnemies = [...currentState.enemies];
    let newPlayer = { ...currentState.player };
    let playerTookDamage = false;

    newEnemies.forEach((enemy, index) => {
        let dx = newPlayer.x - enemy.x;
        let dy = newPlayer.y - enemy.y;
        let newX = enemy.x;
        let newY = enemy.y;

        if (Math.abs(dx) > Math.abs(dy)) newX += Math.sign(dx);
        else newY += Math.sign(dy);

        if (newX === newPlayer.x && newY === newPlayer.y) {
            const damage = Math.max(1, enemy.attack);
            newPlayer.hp -= damage;
            createDamageNumber(newPlayer.x, newPlayer.y, damage, 'player');
            playerTookDamage = true;
            if(ENEMY_DATA[enemy.type].canPoison && Math.random() < 0.3) {
                newPlayer.isPoisoned = true;
                setMessage("You have been poisoned!");
            }
        } else if (currentState.map[newY][newX] === TileType.FLOOR && !newEnemies.some(e => e.x === newX && e.y === newY)) {
            newEnemies[index] = { ...enemy, x: newX, y: newY };
        }
    });
    
    if (playerTookDamage) {
        soundService.play('player_hit');
        triggerPlayerHitEffect();
        if (newPlayer.hp <= 0) {
            setIsGameOver(true);
            setMessage("You have been defeated!");
            soundService.play('game_over');
        }
    }
    return { ...currentState, player: newPlayer, enemies: newEnemies };
  };

  const processTurn = (newPlayerPos: Position): GameState => {
      let newState: GameState = { ...gameState, player: { ...gameState.player, ...newPlayerPos, stepsTaken: gameState.player.stepsTaken + 1 } };
      
      newState.player = processAugmentEffects(newState.player);

      // Bomb Ticking
      let newBombs = [];
      let newBlasts: Position[] = [];
      for (const bomb of newState.bombs) {
          const newSteps = bomb.stepsRemaining - 1;
          if (newSteps > 0) {
              newBombs.push({ ...bomb, stepsRemaining: newSteps });
          } else {
              soundService.play('bomb_explode');
              for (let y = bomb.y - BOMB_RANGE; y <= bomb.y + BOMB_RANGE; y++) {
                  for (let x = bomb.x - BOMB_RANGE; x <= bomb.x + BOMB_RANGE; x++) {
                      if (x >= 0 && x < newState.map[0].length && y >= 0 && y < newState.map.length) {
                          const dist = Math.sqrt(Math.pow(x - bomb.x, 2) + Math.pow(y - bomb.y, 2));
                          if (dist <= BOMB_RANGE) newBlasts.push({x, y});
                      }
                  }
              }
          }
      }
      
      newState.bombs = newBombs;
      
      // Apply blast damage
      if (newBlasts.length > 0) {
          const bombDamage = 20 + newState.player.bombDamageBonus;
          newState.enemies = newState.enemies.filter(enemy => {
              if (newBlasts.some(b => b.x === enemy.x && b.y === enemy.y)) {
                  createDamageNumber(enemy.x, enemy.y, bombDamage, 'enemy');
                  handleEnemyDefeated(enemy);
                  return false;
              }
              return true;
          });
          if (newBlasts.some(b => b.x === newState.player.x && b.y === newState.player.y)) {
              newState.player.hp -= bombDamage;
              createDamageNumber(newState.player.x, newState.player.y, bombDamage, 'player');
              triggerPlayerHitEffect();
              if (newState.player.hp <= 0) {
                  setIsGameOver(true);
                  setMessage("You blew yourself up!");
              }
          }
      }
      newState.activeBlasts = newBlasts;

      // Poison
      if (newState.player.isPoisoned) {
          const newCounter = newState.player.poisonStepCounter + 1;
          if (newCounter >= POISON_TICK_STEPS) {
              newState.player.hp -= POISON_DAMAGE;
              createDamageNumber(newState.player.x, newState.player.y, POISON_DAMAGE, 'player');
              triggerPoisonFlashEffect();
              if (newState.player.hp <= 0) {
                  setIsGameOver(true);
                  setMessage("You succumbed to poison.");
              }
              newState.player.poisonStepCounter = 0;
          } else {
              newState.player.poisonStepCounter = newCounter;
          }
      }
      
      return processEnemyTurn(newState);
  };
  
  const handleMove = (direction: Direction) => {
    if (animatingRef.current || isPaused) return;

    let { x, y } = gameState.player;
    if (direction === 'ArrowUp') y--;
    else if (direction === 'ArrowDown') y++;
    else if (direction === 'ArrowLeft') x--;
    else if (direction === 'ArrowRight') x++;

    if (gameState.map[y][x] === TileType.WALL) { soundService.play('wall_bump'); return; }

    const enemyAtTarget = gameState.enemies.find(e => e.x === x && e.y === y);
    if (enemyAtTarget) { // Attack
      soundService.play('player_attack');
      const damage = gameState.player.attack + gameState.player.meleeDamageBonus;
      createDamageNumber(x, y, damage, 'enemy');
      const newHp = enemyAtTarget.hp - damage;
      if (newHp <= 0) {
        handleEnemyDefeated(enemyAtTarget);
        const newState = processTurn({x: gameState.player.x, y: gameState.player.y});
        setGameState({...newState, enemies: newState.enemies.filter(e => e.id !== enemyAtTarget.id)});
      } else {
        const newEnemies = gameState.enemies.map(e => e.id === enemyAtTarget.id ? { ...e, hp: newHp, isHit: true } : e);
        const newState = processTurn({x: gameState.player.x, y: gameState.player.y});
        setGameState({...newState, enemies: newEnemies});
        setTimeout(() => setGameState(p => ({...p, enemies: p.enemies.map(e => e.id === enemyAtTarget.id ? {...e, isHit: false} : e)})), 200);
      }
    } else { // Move
      soundService.play('player_move');
      
      const newState = processTurn({x, y});
      
      newState.player.lastMoveDirection = direction;
      
      const itemAtTarget = newState.items.find(i => i.x === x && i.y === y);
      if (itemAtTarget) {
        const itemKey = `${itemAtTarget.x},${itemAtTarget.y}`;
        if(!newState.pickedUpItems.has(itemKey)) {
          soundService.play('pickup_item');
          newState.pickedUpItems.add(itemKey);
          switch(itemAtTarget.type) {
            case ItemType.GOLD: newState.player.gold += 10; setMessage("Found 10 gold!"); break;
            case ItemType.POTION: newState.player.potions = Math.min(3, newState.player.potions + 1); setMessage("Found a potion!"); break;
            case ItemType.ARROWS: newState.player.arrows = Math.min(newState.player.maxArrows, newState.player.arrows + 3); setMessage("Found 3 arrows!"); break;
            case ItemType.BOMB: newState.player.bombs = Math.min(newState.player.maxBombs, newState.player.bombs + 1); setMessage("Found a bomb!"); break;
            case ItemType.ANTIDOTE: newState.player.antidotes = Math.min(3, newState.player.antidotes + 1); setMessage("Found an antidote!"); break;
          }
        }
      }
      
      if (newState.wizard && newState.wizard.x === x && newState.wizard.y === y) {
        setIsShopping(true);
        setMessage("The wizard offers wares.");
      }
      
      const altarAtTarget = newState.altars.find(a => a.x === x && a.y === y);
      if (altarAtTarget) {
          soundService.play('altar');
          const effects = Object.values(ALTAR_EFFECTS);
          const effect = effects[Math.floor(Math.random() * effects.length)];
          
          let newPlayer = {...newState.player};
          let effectMsg = effect.description;

          if(effect.type === 'stat') {
              newPlayer[effect.stat] = Math.max(effect.stat === 'maxHp' ? 10 : 1, newPlayer[effect.stat] + effect.value);
              if (effect.stat === 'maxHp') newPlayer.hp = newPlayer.maxHp;
          } else if (effect.type === 'augment') {
              if(!newPlayer.activeAugments.includes(effect.augmentId)) {
                  newPlayer.activeAugments.push(effect.augmentId);
                  const augment = AUGMENTS[effect.augmentId];
                  effectMsg = `You have been granted the augment: ${augment.name}!`;
                  if(augment.onAcquire) {
                    Object.entries(augment.onAcquire).forEach(([stat, value]) => {
                       newPlayer[stat] += value;
                    });
                  }
              } else {
                 effectMsg = "The altar's power feels familiar and fades...";
              }
          }
          
          const corruptionGained = effect.corruption || 10;
          newPlayer.corruption = Math.min(100, newPlayer.corruption + corruptionGained);
          
          setMessage(effectMsg);
          newState.player = newPlayer;
      }

      if (newState.exit && newState.exit.x === x && newState.exit.y === y) {
        handleNextLevel();
        return;
      }
      
      const { VIEWPORT_WIDTH, VIEWPORT_HEIGHT } = SYSTEMS;
      newState.camera.x = Math.floor(x / VIEWPORT_WIDTH);
      newState.camera.y = Math.floor(y / VIEWPORT_HEIGHT);
      
      setGameState(newState);
      setTimeout(() => setGameState(p => ({...p, activeBlasts: []})), 100);
    }
  };
  
  React.useEffect(() => {
    if (!arrowProjectile || !arrowProjectile.visible) return;

    let { x, y, direction } = arrowProjectile;
    const interval = setInterval(() => {
        if (direction === 'ArrowUp') y--;
        else if (direction === 'ArrowDown') y++;
        else if (direction === 'ArrowLeft') x--;
        else if (direction === 'ArrowRight') x++;

        if (gameState.map[y]?.[x] !== TileType.FLOOR) {
            setArrowProjectile(null);
            animatingRef.current = false;
            const newState = processTurn({x: gameState.player.x, y: gameState.player.y});
            setGameState(newState);
            return;
        }

        const enemyHit = gameState.enemies.find(e => e.x === x && e.y === y);
        if (enemyHit) {
            soundService.play('arrow_hit');
            const damage = 10 + gameState.player.arrowDamageBonus;
            createDamageNumber(x, y, damage, 'enemy');
            const newHp = enemyHit.hp - damage;
            if (newHp <= 0) handleEnemyDefeated(enemyHit);

            setGameState(prev => ({
                ...prev,
                enemies: newHp <= 0 ? prev.enemies.filter(e => e.id !== enemyHit.id) : prev.enemies.map(e => e.id === enemyHit.id ? { ...e, hp: newHp } : e)
            }));
            setArrowProjectile(null);
            animatingRef.current = false;
            const newState = processTurn({x: gameState.player.x, y: gameState.player.y});
            setGameState(newState);
            return;
        }

        setArrowProjectile(p => p ? { ...p, x, y } : null);

    }, 50);

    return () => {
        clearInterval(interval);
        animatingRef.current = false;
    };
}, [arrowProjectile, gameState.map]);


  if (gameScreen === 'title') return <TitleScreen onStart={startGame} onSettings={() => setIsSettingsOpen(true)} />;
  if (gameScreen === 'class_selection') return <ClassSelectionModal onSelect={handleClassSelect} />;
  
  return (
    <div className="flex flex-col h-screen p-2 sm:p-4 select-none" style={{backgroundColor: 'var(--color-bg)'}}>
      <div className={`flex-grow flex flex-col items-center justify-center relative transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
        <TopHud player={gameState.player} level={gameState.level} />
        <GameGrid 
          gameState={gameState} 
          isPlayerHit={isPlayerHit} 
          isPlayerPoisonedFlashing={isPlayerPoisonedFlashing}
          arrowProjectile={arrowProjectile}
          damageNumbers={damageNumbers}
        />
        <GameUI 
          message={message} 
          isInspecting={isInspecting} 
          inspectedEnemy={inspectedEnemy}
          onCloseInspect={() => setIsInspecting(false)}
        />
        <CorruptionMeter corruption={gameState.player.corruption} />
        <VolumeControls onMusicChange={setMusicVolume} onSfxChange={handleSfxVolumeChange} initialMusic={musicVolume} initialSfx={sfxVolume} />
      </div>

      <div className="flex-shrink-0 lg:hidden mt-2">
         <Dpad onMove={handleMove} />
         <ActionPanel onUsePotion={usePotion} onPlaceBomb={placeBomb} onFireArrow={fireArrow} />
      </div>

      {isGameOver && <Modal title="Game Over" onClose={restartGame}><p className="text-center">{message}</p><button className="mt-4 bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-4 rounded" onClick={restartGame}>Restart</button></Modal>}
      {isPaused && <Modal title="Paused" onClose={() => setIsPaused(false)}><div className="flex flex-col space-y-2"><button className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-4 rounded" onClick={() => setIsPaused(false)}>Resume</button><button className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded" onClick={quitGame}>Quit to Title</button></div></Modal>}
      {isLevelingUp && <LevelUpModal onChoice={handleLevelUpChoice} />}
      {isShopping && <ShopModal onBuy={handleBuyItem} onClose={() => setIsShopping(false)} gold={gameState.player.gold} />}
      {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
    </div>
  );
};
export default App;
