import { Scene } from 'phaser';
import * as Phaser from 'phaser';
import { trpc } from '../trpc';
import { ITEMS } from '../../shared/items';

type MapNode = {
    id: number;
    x: number;
    y: number;
    type: 'start' | 'battle' | 'treasure' | 'boss' | 'empty';
    visited: boolean;
    nextNodes: number[];
};

export class MapScene extends Scene {
    private stepsText!: Phaser.GameObjects.Text;
    private soulsText!: Phaser.GameObjects.Text;
    private depthText!: Phaser.GameObjects.Text;
    private leaderboardText!: Phaser.GameObjects.Text;
    private currentSteps: number = 0;
    private currentSouls: number = 0;
    private isProcessingStep: boolean = false;
    private nodes: MapNode[] = [];
    private playerMarker!: Phaser.GameObjects.Arc;
    private currentNodeIndex: number = 0;
    private titleText!: Phaser.GameObjects.Text;
    // Position functions for open popup, called on resize to keep popup screen-centered
    private popupPositionFns: Array<(w: number, h: number, s: number) => void> = [];

    constructor() {
        super('MapScene');
    }

    create() {
        this.cameras.main.setBackgroundColor('#2b2b2b');

        this.titleText = this.add.text(this.scale.width / 2, 40, 'Mappa di Gioco', {
            fontSize: '28px', color: '#e94560', fontFamily: '"Exo 2", Arial, sans-serif', fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0);

        this.stepsText = this.add.text(this.scale.width / 2, 80, 'Caricamento Passi...', {
            fontSize: '22px', color: '#ffffff', fontFamily: '"Exo 2", Arial, sans-serif', fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0);

        this.soulsText = this.add.text(this.scale.width / 2, 110, 'Anime: 0', {
            fontSize: '20px', color: '#9c27b0', fontFamily: '"Exo 2", Arial, sans-serif', fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0);

        this.depthText = this.add.text(20, 20, 'Depth: 0 (Max: 0)', {
            fontSize: '18px', color: '#00bcd4', fontFamily: '"Exo 2", Arial, sans-serif', fontStyle: 'bold'
        }).setOrigin(0, 0).setScrollFactor(0);

        this.leaderboardText = this.add.text(this.scale.width - 200, 20, 'Leaderboard...', {
            fontSize: '14px', color: '#ffeb3b', fontFamily: '"Exo 2", Arial, sans-serif', fontStyle: 'bold'
        }).setOrigin(0, 0).setScrollFactor(0);
        
        this.fetchSteps().catch(console.error);
        this.fetchLeaderboard().catch(console.error);
        
        const savedNodes = this.registry.get('mapNodes');
        const savedIndex = this.registry.get('currentNodeIndex');

        if (savedNodes) {
            this.nodes = savedNodes;
            this.currentNodeIndex = savedIndex || 0;
        } else {
            this.currentNodeIndex = 0;
            this.generateMap();
            this.registry.set('mapNodes', this.nodes);
            this.registry.set('currentNodeIndex', this.currentNodeIndex);
        }

        this.drawMap();

        // With RESIZE mode and no fixed dims, scale.width/height always equals
        // the real viewport. Just sync camera size on resize.
        this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
            this.cameras.main.setSize(gameSize.width, gameSize.height);
            this.cameras.main.setPosition(0, 0);
            this.updateLayout(gameSize.width, gameSize.height);
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    updateLayout(width: number, _height: number) {
        if (this.titleText) this.titleText.setPosition(width / 2, 40);
        if (this.stepsText) this.stepsText.setPosition(width / 2, 80);
        if (this.soulsText) this.soulsText.setPosition(width / 2, 110);
        if (this.leaderboardText) this.leaderboardText.setPosition(width - 200, 20);
        // Reposition all open popup elements
        if (this.popupPositionFns.length > 0) {
            const s = Math.min(1, width / 650, _height / 480);
            this.popupPositionFns.forEach(fn => fn(width, _height, s));
        }
    }

    async fetchSteps() {
        try {
            const state = await trpc.getState.query();
            this.currentSteps = state.stepsLeft;
            this.currentSouls = state.souls;
            this.stepsText.setText(`Passi Residui: ${this.currentSteps} / ${state.maxSteps}`);
            this.soulsText.setText(`Anime: ${this.currentSouls}`);
            this.depthText.setText(`Depth: ${state.depth} (Max: ${state.maxDepth})`);
        } catch (err) {
            console.error("Errore passi:", err);
            this.stepsText.setText('Errore caricamento passi');
        }
    }

    async fetchLeaderboard() {
        try {
            const lb = await trpc.getLeaderboard.query();
            let text = "--- TOP 10 ---\n";
            lb.forEach((entry: { username: string; score: number }, i: number) => {
                text += `${i + 1}. ${entry.username}: ${entry.score}\n`;
            });
            this.leaderboardText.setText(text);
        } catch (err) {
            console.error(err);
            this.leaderboardText.setText("Leaderboard offline");
        }
    }

    async buyItem(itemId: string) {
        try {
            const res = await trpc.buyUpgrade.mutate({ itemId });
            this.currentSouls = res.souls;
            this.soulsText.setText(`Anime: ${this.currentSouls}`);
            alert(`Oggetto acquistato!`);
            return true;
        } catch (err) {
            alert(`Errore: ${(err as Error).message}`);
            return false;
        }
    }

    showShopPopup(targetNode: MapNode) {
        const W = this.scale.width;
        const H = this.scale.height;
        const popupScale = Math.min(1, W / 650, H / 480);
        const cx = W / 2;
        const cy = H / 2;

        // All elements use setScrollFactor(0) → fixed to screen, not world.
        // This means resize never moves them off screen.

        const overlay = this.add.rectangle(cx, cy, 99999, 99999, 0x000000, 0.82)
            .setScrollFactor(0).setDepth(200).setInteractive();

        const popupBg = this.add.rectangle(cx, cy, 620, 420, 0x1a1a2e)
            .setStrokeStyle(3, 0xe94560)
            .setScrollFactor(0).setDepth(201);

        const title = this.add.text(cx, cy - 175, '🧟 MERCANTE ERRANTE 🧟', {
            fontSize: '22px', color: '#ffeb3b', fontStyle: 'bold', fontFamily: '"Exo 2", Arial'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

        const subTitle = this.add.text(cx, cy - 148, 'Scegli fino a 3 oggetti', {
            fontSize: '13px', color: '#888888', fontFamily: '"Exo 2", Arial'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

        const closeBtn = this.add.rectangle(cx, cy + 180, 160, 42, 0xe94560)
            .setScrollFactor(0).setDepth(201)
            .setInteractive({ useHandCursor: true })
            .on('pointerover', () => closeBtn.setFillStyle(0xff5c77))
            .on('pointerout', () => closeBtn.setFillStyle(0xe94560))
            .on('pointerdown', () => {
                cleanup();
                this.resolveNodeEvent(targetNode).catch(console.error);
            });

        const closeTxt = this.add.text(cx, cy + 180, 'Saluta e Vai', {
            fontSize: '17px', color: '#ffffff', fontStyle: 'bold', fontFamily: '"Exo 2", Arial'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

        const allElements: Phaser.GameObjects.GameObject[] = [overlay, popupBg, title, subTitle, closeBtn, closeTxt];

        // Position functions: called on resize to keep everything screen-centered
        const positionFns: Array<(w: number, h: number, s: number) => void> = [
            (w, h) => { overlay.setPosition(w / 2, h / 2); },
            (w, h) => { popupBg.setPosition(w / 2, h / 2); },
            (w, h) => { title.setPosition(w / 2, h / 2 - 175); },
            (w, h) => { subTitle.setPosition(w / 2, h / 2 - 148); },
            (w, h) => { closeBtn.setPosition(w / 2, h / 2 + 180); },
            (w, h) => { closeTxt.setPosition(w / 2, h / 2 + 180); },
        ];

        // Pick 3 random items
        const shuffled = [...ITEMS].sort(() => 0.5 - Math.random());
        const selectedItems = shuffled.slice(0, 3);

        selectedItems.forEach((item, index) => {
            const offX = (index - 1) * 190 * popupScale; // -190, 0, +190 from center

            const cardX = cx + offX;
            const cardY = cy + 10;
            const cardW = 170 * popupScale;
            const cardH = 210 * popupScale;

            const card = this.add.rectangle(cardX, cardY, cardW, cardH, 0x16213e)
                .setStrokeStyle(2, item.color)
                .setScrollFactor(0).setDepth(201);

            const nameTxt = this.add.text(cardX, cardY - 72 * popupScale, item.name, {
                fontSize: `${Math.floor(15 * popupScale)}px`,
                color: '#ffffff', fontStyle: 'bold', fontFamily: '"Exo 2", Arial',
                align: 'center', wordWrap: { width: 150 * popupScale }
            }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

            const rarityColor = `#${item.color.toString(16).padStart(6, '0')}`;
            const rarityTxt = this.add.text(cardX, cardY - 30 * popupScale, `[${item.rarity}]`, {
                fontSize: `${Math.floor(13 * popupScale)}px`,
                color: rarityColor, fontStyle: 'bold', fontFamily: '"Exo 2", Arial'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

            const effectTxt = this.add.text(cardX, cardY + 10 * popupScale, `+${item.effectValue} ${item.effectType.toUpperCase()}`, {
                fontSize: `${Math.floor(12 * popupScale)}px`,
                color: '#a0a0a0', fontFamily: '"Exo 2", Arial', align: 'center'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

            const buyBtnW = 130 * popupScale;
            const buyBtnH = 36 * popupScale;
            const buyBtn = this.add.rectangle(cardX, cardY + 72 * popupScale, buyBtnW, buyBtnH, 0x4caf50)
                .setScrollFactor(0).setDepth(202)
                .setInteractive({ useHandCursor: true })
                .on('pointerover', () => { if (buyBtn.input?.enabled) buyBtn.setFillStyle(0x66bb6a); })
                .on('pointerout', () => { if (buyBtn.input?.enabled) buyBtn.setFillStyle(0x4caf50); });

            const buyTxt = this.add.text(cardX, cardY + 72 * popupScale, `${item.cost} 💀`, {
                fontSize: `${Math.floor(15 * popupScale)}px`,
                color: '#ffffff', fontStyle: 'bold', fontFamily: '"Exo 2", Arial'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(202);

            buyBtn.on('pointerdown', async () => {
                const success = await this.buyItem(item.id);
                if (success) {
                    buyBtn.disableInteractive();
                    buyBtn.setFillStyle(0x555555);
                    buyTxt.setText('VENDUTO');
                }
            });

            allElements.push(card, nameTxt, rarityTxt, effectTxt, buyBtn, buyTxt);

            // Register position functions for this card's elements
            positionFns.push(
                (w, h, s) => { const ox = (index - 1) * 190 * s; card.setPosition(w / 2 + ox, h / 2 + 10); card.setSize(170 * s, 210 * s); },
                (w, h, s) => { const ox = (index - 1) * 190 * s; nameTxt.setPosition(w / 2 + ox, h / 2 + 10 - 72 * s); },
                (w, h, s) => { const ox = (index - 1) * 190 * s; rarityTxt.setPosition(w / 2 + ox, h / 2 + 10 - 30 * s); },
                (w, h, s) => { const ox = (index - 1) * 190 * s; effectTxt.setPosition(w / 2 + ox, h / 2 + 10 + 10 * s); },
                (w, h, s) => { const ox = (index - 1) * 190 * s; buyBtn.setPosition(w / 2 + ox, h / 2 + 10 + 72 * s); buyBtn.setSize(130 * s, 36 * s); },
                (w, h, s) => { const ox = (index - 1) * 190 * s; buyTxt.setPosition(w / 2 + ox, h / 2 + 10 + 72 * s); },
            );
        });

        // Store so updateLayout can call them on resize
        this.popupPositionFns = positionFns;

        const cleanup = () => {
            allElements.forEach(e => e.destroy());
            this.popupPositionFns = [];
        };
    }

    generateMap() {
        const centerY = this.scale.height / 2 + 80;
        const startX = 100;
        const spacingX = 150;
        const spacingY = 80;

        this.nodes = [];
        let currentId = 0;

        this.nodes.push({ id: currentId++, x: startX, y: centerY, type: 'start', visited: true, nextNodes: [] });

        let previousLevelNodes = [0];
        const totalLevels = 100; // 100 levels

        for (let level = 1; level <= totalLevels; level++) {
            const isBossLevel = level % 5 === 0;
            const numNodes = isBossLevel ? 1 : Math.floor(Math.random() * 2) + 2; 
            const currentLevelNodes: number[] = [];

            const totalHeight = (numNodes - 1) * spacingY;
            const startY = centerY - totalHeight / 2;

            for (let i = 0; i < numNodes; i++) {
                let nodeType: 'boss' | 'treasure' | 'empty' | 'battle' = 'battle';
                if (isBossLevel) {
                    nodeType = 'boss';
                } else {
                    const rand = Math.random();
                    if (rand < 0.15) nodeType = 'treasure';
                    else if (rand < 0.45) nodeType = 'empty'; // 30% chance of empty
                }
                
                const nodeId = currentId++;
                this.nodes.push({
                    id: nodeId,
                    x: startX + level * spacingX,
                    y: startY + i * spacingY,
                    type: nodeType,
                    visited: false,
                    nextNodes: []
                });
                currentLevelNodes.push(nodeId);
            }

            previousLevelNodes.forEach((prevId, index) => {
                const targetIdx = Math.min(index, currentLevelNodes.length - 1);
                this.nodes[prevId]!.nextNodes.push(currentLevelNodes[targetIdx]!);
            });

            currentLevelNodes.forEach((currId, index) => {
                const hasIncoming = previousLevelNodes.some(prevId => this.nodes[prevId]!.nextNodes.includes(currId));
                if (!hasIncoming) {
                    const sourceIdx = Math.min(index, previousLevelNodes.length - 1);
                    const sourceId = previousLevelNodes[sourceIdx];
                    if (!this.nodes[sourceId!]!.nextNodes.includes(currId)) {
                        this.nodes[sourceId!]!.nextNodes.push(currId);
                    }
                }
            });
            
            if (previousLevelNodes.length > 1 && currentLevelNodes.length > 1) {
                if (Math.random() > 0.5) {
                    const randPrev = previousLevelNodes[Math.floor(Math.random() * previousLevelNodes.length)];
                    const randCurr = currentLevelNodes[Math.floor(Math.random() * currentLevelNodes.length)];
                    if (randPrev !== undefined && randCurr !== undefined && !this.nodes[randPrev]!.nextNodes.includes(randCurr)) {
                        this.nodes[randPrev]!.nextNodes.push(randCurr);
                    }
                }
            }

            previousLevelNodes = currentLevelNodes;
        }
    }

    drawMap() {
        // Disegna linee tra i nodi
        const graphics = this.add.graphics();
        graphics.lineStyle(4, 0x555555);

        this.nodes.forEach(node => {
            node.nextNodes.forEach(nextId => {
                const n2 = this.nodes.find(n => n.id === nextId);
                if (n2) {
                    graphics.beginPath();
                    graphics.moveTo(node.x, node.y);
                    graphics.lineTo(n2.x, n2.y);
                    graphics.strokePath();
                }
            });
        });

        // Disegna nodi
        this.nodes.forEach((node, index) => {
            let color = 0x888888;
            if (node.type === 'start') color = 0x4caf50;
            if (node.type === 'battle') color = 0xe94560;
            if (node.type === 'treasure') color = 0xffeb3b;
            if (node.type === 'boss') color = 0x9c27b0;
            if (node.type === 'empty') color = 0x607d8b;

            this.add.circle(node.x, node.y, node.type === 'boss' ? 35 : 25, color)
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => this.tryMoveToNode(index));

            // Testo Nodo
            this.add.text(node.x, node.y + 35, node.type, {
                fontSize: '12px', color: '#ffffff', fontFamily: 'Arial'
            }).setOrigin(0.5);
        });

        // Marker giocatore
        const startNode = this.nodes[this.currentNodeIndex]!;
        this.playerMarker = this.add.circle(startNode.x, startNode.y, 15, 0x00bcd4);

        const maxNodeX = this.nodes[this.nodes.length - 1]!.x;
        // Wide vertical bounds so resize never shows black bars
        this.cameras.main.setBounds(0, -9999, maxNodeX + 500, 99999);
        this.cameras.main.centerOn(this.playerMarker.x, this.nodes[0]!.y);

        // Abilita lo scroll libero della mappa
        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (pointer.isDown) {
                this.cameras.main.scrollX -= (pointer.x - pointer.prevPosition.x) / this.cameras.main.zoom;
            }
        });
    }

    async tryMoveToNode(targetIndex: number) {
        const currentNode = this.nodes[this.currentNodeIndex]!;
        if (!currentNode.nextNodes.includes(targetIndex)) {
            console.log("Puoi muoverti solo ai nodi connessi al tuo nodo corrente.");
            return;
        }

        if (this.isProcessingStep || this.currentSteps <= 0) {
            console.log("Nessun passo residuo o azione in corso.");
            return;
        }

        this.isProcessingStep = true;
        this.stepsText.setText('Consumo passo in corso...');
        
        try {
            const state = await trpc.spendStep.mutate();
            this.currentSteps = state.stepsLeft;
            this.stepsText.setText(`Passi Residui: ${this.currentSteps} / ${state.maxSteps}`);
            
            // Movimento riuscito
            this.currentNodeIndex = targetIndex;
            const targetNode = this.nodes[targetIndex]!;
            targetNode.visited = true;

            this.registry.set('currentNodeIndex', this.currentNodeIndex);
            this.registry.set('mapNodes', this.nodes);

            let stepsSinceLastShop = this.registry.get('stepsSinceLastShop') || 0;
            stepsSinceLastShop++;

            // Animazione movimento
            this.tweens.add({
                targets: this.playerMarker,
                x: targetNode.x,
                y: targetNode.y,
                duration: 500,
                ease: 'Power2',
                onComplete: () => {
                    if (stepsSinceLastShop >= 5) {
                        this.registry.set('stepsSinceLastShop', 0);
                        this.showShopPopup(targetNode);
                    } else {
                        this.registry.set('stepsSinceLastShop', stepsSinceLastShop);
                        this.resolveNodeEvent(targetNode).catch(console.error);
                    }
                }
            });
            this.cameras.main.pan(targetNode.x, this.nodes[0]!.y, 500, 'Power2');

        } catch (err) {
            console.error("Errore nel consumo passi:", err);
            this.stepsText.setText(`Errore: ${(err as Error).message || 'Riprova'}`);
        } finally {
            this.isProcessingStep = false;
        }
    }

    async resolveNodeEvent(node: MapNode) {
        if (node.type === 'battle' || node.type === 'boss') {
            this.registry.set('isBossBattle', node.type === 'boss');
            // Vai alla scena di battaglia
            this.scene.start('Game');
        } else if (node.type === 'treasure') {
            try {
                const res = await trpc.gainSouls.mutate({ amount: 20 });
                this.currentSouls = res.souls;
                this.soulsText.setText(`Anime: ${this.currentSouls}`);
                alert("Hai trovato un tesoro! +20 Anime!");
            } catch (err) {
                console.error("Errore tesoro:", err);
            }
        } else if (node.type === 'empty') {
            // Nessun evento, area sicura
        }
    }
}
