import { Scene } from 'phaser';
import * as Phaser from 'phaser';
import { trpc } from '../trpc';
import type { Minion } from '../../server/trpc';

type RenderedUnit = {
    data: Minion;
    container: Phaser.GameObjects.Container;
    rect: Phaser.GameObjects.Rectangle;
    hpText: Phaser.GameObjects.Text;
    label: Phaser.GameObjects.Text;
};

export class Game extends Scene {
  private playerArmy: RenderedUnit[] = [];
  private enemyArmy: RenderedUnit[] = [];

  private fightButton!: Phaser.GameObjects.Rectangle;
  private fightText!: Phaser.GameObjects.Text;

  private titleText!: Phaser.GameObjects.Text;
  private minionsText!: Phaser.GameObjects.Text;
  private topBar!: Phaser.GameObjects.Rectangle;

  private isFighting: boolean = false;
  private soulsEarned: number = 0;

  private allPlayerMinions: Minion[] = [];
  private benchedMinions: Minion[] = [];
  private currentArmySizeLimit: number = 5;
  
  private benchButton!: Phaser.GameObjects.Rectangle;
  private benchText!: Phaser.GameObjects.Text;

  private currentDepth: number = 0;
  private currentStepsTaken: number = 0;
  private isBossBattle: boolean = false;

  private benchContainer?: Phaser.GameObjects.Container | undefined;
  private selectedBenchUnit?: Minion | undefined;
  private selectedActiveUnit?: Minion | undefined;

  constructor() {
    super('Game');
  }

  create() {
    this.cameras.main.setBackgroundColor('#1a1a2e');

    // UI HUD Top Bar
    this.topBar = this.add.rectangle(this.scale.width / 2, 45, this.scale.width, 90, 0x16213e)
        .setAlpha(0.9)
        .setStrokeStyle(2, 0x3a4f7c);

    this.titleText = this.add.text(this.scale.width / 2, 30, 'The 100 Steps of the Necromancer', {
        fontSize: '26px', color: '#e94560', fontFamily: 'Arial, sans-serif', fontStyle: 'bold'
    }).setOrigin(0.5).setShadow(2, 2, '#000000', 2, true, true);

    this.minionsText = this.add.text(this.scale.width / 2, 65, 'Loading Army from Reddit...', {
        fontSize: '14px', color: '#a0aab2', fontFamily: 'Arial, sans-serif'
    }).setOrigin(0.5);

    // Modernized Fight Button
    this.fightButton = this.add.rectangle(this.scale.width / 2, this.scale.height - 80, 240, 60, 0xe94560)
        .setInteractive({ useHandCursor: true })
        .setStrokeStyle(3, 0xffffff)
        .on('pointerdown', () => {
            this.fightButton.setScale(0.95);
            this.startAutoBattle();
        })
        .on('pointerover', () => this.fightButton.setFillStyle(0xff5c77))
        .on('pointerout', () => this.fightButton.setFillStyle(0xe94560).setScale(1));

    // Pulse animation for fight button
    this.tweens.add({
        targets: this.fightButton,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
    });

    this.fightText = this.add.text(this.scale.width / 2, this.scale.height - 80, 'START BATTLE', {
        fontSize: '22px', color: '#ffffff', fontStyle: 'bold', fontFamily: 'Arial, sans-serif'
    }).setOrigin(0.5).setShadow(1, 1, '#000000', 2, true, true);

    // Bench Button
    this.benchButton = this.add.rectangle(this.scale.width / 2, this.scale.height - 140, 160, 40, 0x0f3460)
        .setInteractive({ useHandCursor: true })
        .setStrokeStyle(2, 0xffffff)
        .on('pointerdown', () => {
            if (!this.isFighting) this.openBenchMenu();
        });

    this.benchText = this.add.text(this.scale.width / 2, this.scale.height - 140, 'PANCHINA', {
        fontSize: '18px', color: '#ffffff', fontStyle: 'bold', fontFamily: 'Arial, sans-serif'
    }).setOrigin(0.5).setShadow(1, 1, '#000000', 1, true, true);

    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
        this.updateLayout(gameSize.width, gameSize.height);
    });

    this.fetchMinions().catch(console.error);

    this.updateLayout(this.scale.width, this.scale.height);
  }

  async fetchMinions() {
      try {
          const state = await trpc.getState.query();
          this.currentArmySizeLimit = 5 + (state.upgrades.armySize * 2);

          const minions = await trpc.getMinions.query();
          this.allPlayerMinions = minions;
          this.minionsText.setText(`Generated Army: ${minions.length} Reddit Minions`);
          
          this.isBossBattle = this.registry.get('isBossBattle') || false;
          this.currentStepsTaken = this.registry.get('currentNodeIndex') || 0;
          this.currentDepth = state.depth;

          this.setupArmies(this.allPlayerMinions, this.currentArmySizeLimit, this.currentDepth, this.currentStepsTaken, this.isBossBattle);
      } catch (err) {
          console.error("Errore reddit:", err);
          this.minionsText.setText('Error loading army.');
      }
  }

  getColorForType(type: string, isEnemy: boolean) {
      if (isEnemy) return 0xe94560; // Rosso base per nemici
      
      switch(type) {
          case 'GOLEM': return 0x4caf50; // Verde
          case 'MAGE': return 0x9c27b0; // Viola
          case 'ARCHER': return 0x00bcd4; // Ciano
          case 'ZOMBIE': return 0x8bc34a; // Verde chiaro
          case 'GHOST': return 0xffffff; // Bianco
          default: return 0x0f3460; // Blu scuro
      }
  }

  setupArmies(playerData: Minion[], armySizeLimit: number, depth: number, stepsTaken: number, isBossBattle: boolean) {
      // Pulisci vecchie armate player
      this.playerArmy.forEach(u => u.container.destroy());
      this.playerArmy = [];

      this.benchedMinions = playerData.slice(armySizeLimit);

      // Popola Player Army (da sinistra verso destra, il primo è a destra)
      playerData.slice(0, armySizeLimit).forEach((data, index) => {
          this.playerArmy.push(this.createUnit(data, index, false));
      });

      // Generazione Procedurale Nemici basata su Depth e Passi
      if (this.enemyArmy.length === 0) {
          const enemyData: Minion[] = [];
      
      // La difficoltà scala sia per le vittorie (depth) sia in base a quanto si è camminato sulla mappa (steps)
      const difficulty = depth + (stepsTaken * 0.2);

      if (isBossBattle) {
          // Mega Boss
          enemyData.push({
              id: 'boss1',
              type: 'HERO',
              author: 'MEGA HERO',
              hp: Math.floor(100 + (difficulty * 20)),
              attack: Math.floor(10 + (difficulty * 2)),
              hasBoneArmor: true
          });
          // Aggiungiamo un paio di minion di supporto
          enemyData.push({ id: 'supp1', type: 'PRIEST', author: 'Acolyte', hp: Math.floor(20 + difficulty*2), attack: Math.floor(5 + difficulty), hasBoneArmor: false });
          enemyData.push({ id: 'supp2', type: 'PRIEST', author: 'Acolyte', hp: Math.floor(20 + difficulty*2), attack: Math.floor(5 + difficulty), hasBoneArmor: false });
      } else {
          // Battaglia standard: curva di difficoltà progressiva
          // Nodo 0: 1 nemico. Aumenta gradualmente fino a 10.
          const enemyCount = Math.min(10, 1 + Math.floor(difficulty / 1.5));
          for (let i = 0; i < enemyCount; i++) {
              const rand = Math.random();
              let type: 'PEASANT' | 'GUARD' | 'PRIEST' | 'RANGER' | 'KNIGHT' | 'PALADIN' = 'PEASANT';
              
              // La probabilità di trovare nemici speciali aumenta con la difficoltà (inizia a 0%)
              const golemChance = Math.min(0.3, difficulty * 0.03); 
              const mageChance = Math.min(0.4, difficulty * 0.05); 
              const archerChance = Math.min(0.4, difficulty * 0.06);
              const zombieChance = Math.min(0.3, difficulty * 0.04);
              const ghostChance = Math.min(0.2, difficulty * 0.02);

              let baseHp = 6;
              let baseAtk = 2;

              if (rand < golemChance) {
                  type = 'KNIGHT';
                  baseHp = 20;
                  baseAtk = 4;
              } else if (rand < golemChance + mageChance) {
                  type = 'PRIEST';
                  baseHp = 10;
                  baseAtk = 5;
              } else if (rand < golemChance + mageChance + archerChance) {
                  type = 'RANGER';
                  baseHp = 6;
                  baseAtk = 3;
              } else if (rand < golemChance + mageChance + archerChance + zombieChance) {
                  type = 'GUARD';
                  baseHp = 25;
                  baseAtk = 1;
              } else if (rand < golemChance + mageChance + archerChance + zombieChance + ghostChance) {
                  type = 'PALADIN';
                  baseHp = 5;
                  baseAtk = 7;
              }

              enemyData.push({
                  id: `e${i}`,
                  type,
                  author: `Enemy ${i+1}`,
                  hp: baseHp + Math.floor(difficulty * 2.5) + Math.floor(Math.random() * 4),
                  attack: baseAtk + Math.floor(difficulty * 0.8) + Math.floor(Math.random() * 2),
                  hasBoneArmor: type === 'KNIGHT' && Math.random() < Math.min(0.8, difficulty * 0.05) // Scudo solo a diff elevate
              });
          }
      }

          enemyData.forEach((data, index) => {
              const unit = this.createUnit(data, index, true);
              if (data.author === 'MEGA HERO') {
                  unit.container.setScale(1.5);
                  unit.rect.setFillStyle(0xff0000).setStrokeStyle(4, 0xffaa00);
              }
              this.enemyArmy.push(unit);
          });
      }
  }

  getUnitPosition(index: number, isEnemy: boolean, width: number, height: number) {
      const centerX = width / 2;
      const startY = height / 2 + 30; // Spostato giù per via della top bar
      
      // Calcoliamo la dimensione dello schermo per decidere quante colonne/righe e spaziatura
      const isMobile = width < 768;
      const spacingX = isMobile ? 55 : 70;
      const spacingY = isMobile ? 65 : 75;
      const unitsPerCol = isMobile ? 5 : 4; 
      
      const dir = isEnemy ? 1 : -1;
      const col = Math.floor(index / unitsPerCol);
      const row = index % unitsPerCol;
      
      const yOffset = (row - (unitsPerCol - 1) / 2) * spacingY;
      // Il primo fronte è a 60px dal centro (o 80px su schermi larghi)
      const frontOffset = isMobile ? 60 : 80;
      const xPos = centerX + (dir * frontOffset) + (dir * col * spacingX);
      const yPos = startY + yOffset;
      
      return { x: xPos, y: yPos };
  }

  createUnit(data: Minion, queueIndex: number, isEnemy: boolean): RenderedUnit {
      const pos = this.getUnitPosition(queueIndex, isEnemy, this.scale.width, this.scale.height);

      const color = this.getColorForType(data.type, isEnemy);
      const rect = this.add.rectangle(0, 0, 50, 50, color).setStrokeStyle(2, isEnemy ? 0xffaaaa : 0xaaccff);
      
      const hpText = this.add.text(0, -35, `HP: ${data.hp}`, {
          fontSize: '12px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold'
      }).setOrigin(0.5).setShadow(1, 1, '#000000', 1);

      const typeStr = data.type.substring(0, 3);
      const label = this.add.text(0, 0, `${typeStr}\nATK: ${data.attack}`, {
          fontSize: '11px', color: '#ffffff', fontFamily: 'Arial', align: 'center', fontStyle: 'bold'
      }).setOrigin(0.5).setShadow(1, 1, '#000000', 1);

      const container = this.add.container(pos.x, pos.y, [rect, hpText, label]);

      if (!isEnemy) {
          container.setSize(60, 60);
          container.setInteractive({ cursor: 'grab' });
          this.input.setDraggable(container);
          
          container.on('dragstart', () => {
              if (this.isFighting) return;
              container.setDepth(100);
          });
          
          container.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
              if (this.isFighting) return;
              container.x = dragX;
              container.y = dragY;
          });
          
          container.on('dragend', () => {
              if (this.isFighting) return;
              container.setDepth(0);
              this.reorderArmy();
          });
      }

      if (data.hasBoneArmor) {
          const shield = this.add.circle(20, -20, 8, 0xffffff).setName('shield');
          container.add(shield);
      }

      return { data, container, rect, hpText, label };
  }

  reorderArmy() {
      // Per il player: X maggiore = più vicino al fronte = primo in coda.
      this.playerArmy.sort((a, b) => {
          if (Math.abs(b.container.x - a.container.x) > 20) {
              return b.container.x - a.container.x;
          }
          return a.container.y - b.container.y;
      });
      this.shiftArmy(this.playerArmy, false);

      const newActiveOrder = this.playerArmy.map(u => u.data);
      this.allPlayerMinions = [...newActiveOrder, ...this.benchedMinions];

      const order = this.allPlayerMinions.map(u => u.id);
      trpc.saveArmyOrder.mutate({ order }).catch(console.error);
  }

  updateLayout(width: number, height: number) {
    this.cameras.resize(width, height);
    
    if (this.topBar) {
        this.topBar.setPosition(width / 2, 45);
        this.topBar.setSize(width, 90);
    }
    if (this.titleText) this.titleText.setPosition(width / 2, 30);
    if (this.minionsText) this.minionsText.setPosition(width / 2, 65);
    if (this.benchButton) {
        this.benchButton.setPosition(width / 2, height - 140);
        this.benchText.setPosition(width / 2, height - 140);
    }
    if (this.fightButton) {
        this.fightButton.setPosition(width / 2, height - 80);
        this.fightText.setPosition(width / 2, height - 80);
    }

    // Riposiziona armate al volo
    this.playerArmy.forEach((unit, index) => {
        const pos = this.getUnitPosition(index, false, width, height);
        unit.container.setPosition(pos.x, pos.y);
    });

    this.enemyArmy.forEach((unit, index) => {
        const pos = this.getUnitPosition(index, true, width, height);
        unit.container.setPosition(pos.x, pos.y);
    });
  }

  startAutoBattle() {
    if (this.isFighting || this.playerArmy.length === 0 || this.enemyArmy.length === 0) return;
    this.isFighting = true;
    this.soulsEarned = 0;

    // Nascondi controlli
    this.fightButton.setVisible(false);
    this.fightText.setVisible(false);
    this.benchButton.setVisible(false);
    this.benchText.setVisible(false);

    // Inizia ciclo di attacchi
    this.executeAttackCycle();
  }

  executeAttackCycle() {
      // Condizioni di fine battaglia
      if (this.playerArmy.length === 0) {
          this.endBattle('You Lost Your Army...');
          return;
      }
      if (this.enemyArmy.length === 0) {
          this.endBattle('VICTORY!');
          return;
      }

      // Attacca il giocatore
      const playerFront = this.playerArmy[0]!;
      const enemyFront = this.enemyArmy[0]!;
      
      const playerMages = this.playerArmy.filter((u, idx) => idx > 0 && (u.data.type === 'MAGE' || u.data.type === 'ARCHER'));
      const playerDistanceDmg = playerMages.reduce((sum, m) => sum + m.data.attack, 0);

      playerMages.forEach(mage => {
          this.tweens.add({ targets: mage.container, y: mage.container.y - 10, duration: 100, yoyo: true });
      });

      // Animazione attacco player
      this.tweens.add({
          targets: playerFront.container,
          x: enemyFront.container.x - 50,
          y: enemyFront.container.y,
          duration: 200,
          yoyo: true,
          ease: 'Power2',
          onYoyo: () => {
              this.cameras.main.shake(100, 0.005);
              
              let damageToEnemy = playerFront.data.attack + playerDistanceDmg;
              
              if (enemyFront.data.hasBoneArmor) {
                  enemyFront.data.hasBoneArmor = false;
                  damageToEnemy = 0;
                  const shield = enemyFront.container.getByName('shield');
                  if (shield) shield.destroy();
                  this.showFloatingText(enemyFront.container.x, enemyFront.container.y - 40, 'SHIELD!', '#ffffff');
              } else {
                  this.showFloatingText(enemyFront.container.x, enemyFront.container.y - 40, `-${damageToEnemy}`, '#ff0000');
              }
              
              // Applica Danno
              enemyFront.data.hp -= damageToEnemy;
              this.updateUnitUI(enemyFront);

              if (enemyFront.data.hp <= 0) {
                  // Nemico morto
                  this.killUnit(this.enemyArmy, 0, true);
              }
          },
          onComplete: () => {
              if (this.enemyArmy.length === 0) {
                  this.executeAttackCycle(); // controllerà la vittoria
                  return;
              }

              // Risposta del nemico (se ancora vivo)
              const currentEnemyFront = this.enemyArmy[0]!;
              this.time.delayedCall(150, () => {
                  this.enemyCounterAttack(currentEnemyFront, playerFront);
              });
          }
      });
  }

  enemyCounterAttack(enemyFront: RenderedUnit, playerFront: RenderedUnit) {
      const enemyMages = this.enemyArmy.filter((u, idx) => idx > 0 && (u.data.type === 'PRIEST' || u.data.type === 'RANGER'));
      const enemyDistanceDmg = enemyMages.reduce((sum, m) => sum + m.data.attack, 0);

      enemyMages.forEach(mage => {
          this.tweens.add({ targets: mage.container, y: mage.container.y - 10, duration: 100, yoyo: true });
      });

      this.tweens.add({
          targets: enemyFront.container,
          x: playerFront.container.x + 50,
          y: playerFront.container.y,
          duration: 200,
          yoyo: true,
          ease: 'Power2',
          onYoyo: () => {
              this.cameras.main.shake(100, 0.005);
              
              let damageToPlayer = enemyFront.data.attack + enemyDistanceDmg;
              
              if (playerFront.data.hasBoneArmor) {
                  playerFront.data.hasBoneArmor = false;
                  damageToPlayer = 0;
                  const shield = playerFront.container.getByName('shield');
                  if (shield) shield.destroy();
                  this.showFloatingText(playerFront.container.x, playerFront.container.y - 40, 'SHIELD!', '#ffffff');
              } else {
                  this.showFloatingText(playerFront.container.x, playerFront.container.y - 40, `-${damageToPlayer}`, '#ff0000');
              }
              
              // Applica Danno
              playerFront.data.hp -= damageToPlayer;
              this.updateUnitUI(playerFront);

              if (playerFront.data.hp <= 0) {
                  // Player morto
                  this.killUnit(this.playerArmy, 0, false);
              }
          },
          onComplete: () => {
              // Turno finito, il ciclo ricomincia
              this.time.delayedCall(300, () => {
                  this.executeAttackCycle();
              });
          }
      });
  }

  showFloatingText(x: number, y: number, msg: string, color: string) {
      const txt = this.add.text(x, y, msg, { fontSize: '20px', color: color, fontStyle: 'bold' }).setOrigin(0.5);
      this.tweens.add({
          targets: txt,
          y: y - 40,
          alpha: 0,
          duration: 800,
          onComplete: () => txt.destroy()
      });
  }

  updateUnitUI(unit: RenderedUnit) {
      unit.data.hp = Math.max(0, unit.data.hp);
      unit.hpText.setText(`HP: ${unit.data.hp}`);
  }

  killUnit(army: RenderedUnit[], index: number, isEnemy: boolean) {
      const deadUnit = army.splice(index, 1)[0];
      if (!deadUnit) return;
      
      if (isEnemy) {
          // Guadagna anime in base al nemico
          this.soulsEarned += (deadUnit.data.type === 'KNIGHT' || deadUnit.data.type === 'PALADIN' || deadUnit.data.type === 'HERO') ? 3 : 1;
      }
      
      // Animazione morte
      this.tweens.add({
          targets: deadUnit.container,
          alpha: 0,
          scale: 0.5,
          duration: 300,
          onComplete: () => {
              deadUnit.container.destroy();
              this.shiftArmy(army, isEnemy);
          }
      });
  }

  shiftArmy(army: RenderedUnit[], isEnemy: boolean) {
      army.forEach((unit, index) => {
          const pos = this.getUnitPosition(index, isEnemy, this.scale.width, this.scale.height);
          this.tweens.add({
              targets: unit.container,
              x: pos.x,
              y: pos.y,
              duration: 300,
              ease: 'Power1'
          });
      });
  }

  endBattle(message: string) {
    if (this.soulsEarned > 0) {
        trpc.gainSouls.mutate({ amount: this.soulsEarned }).catch(console.error);
        message += `\n+${this.soulsEarned} Souls`;
    }

    if (message.includes('VICTORY')) {
        trpc.winBattle.mutate().catch(console.error);
    } else {
        trpc.die.mutate().catch(console.error);
        this.registry.remove('mapNodes');
        this.registry.remove('currentNodeIndex');
    }

    this.add.text(this.scale.width / 2, this.scale.height - 150, message, {
        fontSize: '48px',
        color: message.includes('VICTORY') ? '#4caf50' : '#f44336',
        fontStyle: 'bold',
        fontFamily: 'Arial, sans-serif',
        align: 'center'
    }).setOrigin(0.5);

    this.time.delayedCall(4000, () => {
        this.isFighting = false;
        this.scene.start('MapScene');
    });
  }

  // --- BENCH MENU LOGIC ---
  openBenchMenu() {
      if (this.benchContainer) return;

      const width = this.scale.width;
      const height = this.scale.height;

      this.benchContainer = this.add.container(0, 0).setDepth(200);

      const bg = this.add.rectangle(width/2, height/2, width, height, 0x000000, 0.8)
          .setInteractive(); 
      
      const panelHeight = Math.min(height * 0.8, 600);
      const panel = this.add.rectangle(width/2, height/2, Math.min(width * 0.9, 600), panelHeight, 0x16213e)
          .setStrokeStyle(4, 0x3a4f7c);

      const title = this.add.text(width/2, height/2 - panelHeight/2 + 30, 'GESTIONE PANCHINA', {
          fontSize: '24px', color: '#ffffff', fontStyle: 'bold'
      }).setOrigin(0.5);

      const closeBtn = this.add.text(width/2 + Math.min(width * 0.45, 300) - 30, height/2 - panelHeight/2 + 30, 'X', {
          fontSize: '24px', color: '#ff0000', fontStyle: 'bold'
      }).setOrigin(0.5).setInteractive({useHandCursor: true}).on('pointerdown', () => {
          this.closeBenchMenu();
      });

      this.benchContainer.add([bg, panel, title, closeBtn]);

      this.renderBenchContent(width, height, panelHeight);
  }

  closeBenchMenu() {
      if (this.benchContainer) {
          this.benchContainer.destroy();
          this.benchContainer = undefined;
      }
      this.selectedBenchUnit = undefined;
      this.selectedActiveUnit = undefined;
  }

  renderBenchContent(width: number, height: number, panelHeight: number) {
      if (!this.benchContainer) return;
      
      const innerName = 'benchInner';
      const oldInner = this.benchContainer.getByName(innerName) as Phaser.GameObjects.Container;
      if (oldInner) oldInner.destroy();

      const inner = this.add.container(0, 0).setName(innerName);
      this.benchContainer.add(inner);

      const startYActive = height/2 - panelHeight/2 + 100;
      const startYBench = height/2 + 30;

      inner.add(this.add.text(width/2, startYActive - 35, 'Esercito Attivo (Clicca per selezionare)', { fontSize: '16px', color: '#aaccff' }).setOrigin(0.5));
      inner.add(this.add.text(width/2, startYBench - 35, 'In Panchina (Clicca per scambiare)', { fontSize: '16px', color: '#ffaaaa' }).setOrigin(0.5));

      const activeMinions = this.allPlayerMinions.slice(0, this.currentArmySizeLimit);
      
      const drawMinionGrid = (minions: Minion[], startY: number, isActive: boolean) => {
          const cols = Math.min(minions.length, 5); 
          const spacingX = 60;
          const startX = width/2 - ((cols - 1) * spacingX) / 2;

          minions.forEach((m, idx) => {
              const row = Math.floor(idx / 5);
              const col = idx % 5;
              const x = startX + col * spacingX;
              const y = startY + row * 60;

              const isSelected = (this.selectedActiveUnit?.id === m.id) || (this.selectedBenchUnit?.id === m.id);
              const color = this.getColorForType(m.type, false);
              
              const rect = this.add.rectangle(x, y, 50, 50, color)
                  .setStrokeStyle(isSelected ? 4 : 2, isSelected ? 0xffea00 : 0xaaccff)
                  .setInteractive({useHandCursor: true})
                  .on('pointerdown', () => {
                      if (isActive) {
                          this.selectedActiveUnit = m;
                      } else {
                          this.selectedBenchUnit = m;
                      }
                      
                      // Swap se entrambi selezionati
                      if (this.selectedActiveUnit && this.selectedBenchUnit) {
                          this.swapUnits(this.selectedActiveUnit, this.selectedBenchUnit);
                          this.selectedActiveUnit = undefined;
                          this.selectedBenchUnit = undefined;
                      }
                      
                      this.renderBenchContent(width, height, panelHeight); // re-render
                  });

              const typeStr = m.type.substring(0, 3);
              const label = this.add.text(x, y, `${typeStr}\n${m.hp}HP`, { fontSize: '11px', color: '#fff', align: 'center', fontStyle: 'bold' }).setOrigin(0.5);

              inner.add([rect, label]);
          });
      };

      drawMinionGrid(activeMinions, startYActive, true);
      drawMinionGrid(this.benchedMinions, startYBench, false);
  }

  swapUnits(u1: Minion, u2: Minion) {
      const idx1 = this.allPlayerMinions.findIndex(m => m.id === u1.id);
      const idx2 = this.allPlayerMinions.findIndex(m => m.id === u2.id);
      if (idx1 >= 0 && idx2 >= 0) {
          const temp = this.allPlayerMinions[idx1];
          this.allPlayerMinions[idx1] = this.allPlayerMinions[idx2]!;
          this.allPlayerMinions[idx2] = temp!;
          
          this.setupArmies(this.allPlayerMinions, this.currentArmySizeLimit, this.currentDepth, this.currentStepsTaken, this.isBossBattle);
          
          const order = this.allPlayerMinions.map(u => u.id);
          trpc.saveArmyOrder.mutate({ order }).catch(console.error);
      }
  }
}
