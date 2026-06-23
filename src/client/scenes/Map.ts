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

    constructor() {
        super('MapScene');
    }

    create() {
        this.cameras.main.setBackgroundColor('#2b2b2b');

        this.add.text(this.scale.width / 2, 40, 'Mappa di Gioco', {
            fontSize: '28px', color: '#e94560', fontFamily: 'Arial, sans-serif', fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0);

        this.stepsText = this.add.text(this.scale.width / 2, 80, 'Caricamento Passi...', {
            fontSize: '22px', color: '#ffffff', fontFamily: 'Arial, sans-serif', fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0);

        this.soulsText = this.add.text(this.scale.width / 2, 110, 'Anime: 0', {
            fontSize: '20px', color: '#9c27b0', fontFamily: 'Arial, sans-serif', fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0);

        this.depthText = this.add.text(20, 20, 'Depth: 0 (Max: 0)', {
            fontSize: '18px', color: '#00bcd4', fontFamily: 'Arial, sans-serif', fontStyle: 'bold'
        }).setOrigin(0, 0).setScrollFactor(0);

        this.leaderboardText = this.add.text(this.scale.width - 200, 20, 'Leaderboard...', {
            fontSize: '14px', color: '#ffeb3b', fontFamily: 'Arial, sans-serif', fontStyle: 'bold'
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
        // Overlay
        const overlay = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.8)
            .setOrigin(0, 0)
            .setInteractive()
            .setScrollFactor(0)
            .setDepth(100);

        const popupBg = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, 600, 400, 0x222222)
            .setStrokeStyle(4, 0x555555)
            .setScrollFactor(0)
            .setDepth(101);

        const title = this.add.text(this.scale.width / 2, this.scale.height / 2 - 160, 'MERCANTE ERRANTE', {
            fontSize: '28px', color: '#ffeb3b', fontStyle: 'bold', fontFamily: 'Arial'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

        const closeBtn = this.add.rectangle(this.scale.width / 2, this.scale.height / 2 + 160, 150, 40, 0xe94560)
            .setInteractive({ useHandCursor: true })
            .setScrollFactor(0)
            .setDepth(101)
            .on('pointerdown', () => {
                cleanup();
                this.resolveNodeEvent(targetNode).catch(console.error);
            });
            
        const closeTxt = this.add.text(this.scale.width / 2, this.scale.height / 2 + 160, 'Saluta e Vai', {
            fontSize: '18px', color: '#ffffff', fontStyle: 'bold', fontFamily: 'Arial'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

        const elements: Phaser.GameObjects.GameObject[] = [overlay, popupBg, title, closeBtn, closeTxt];

        // Randomly pick 3 items (simple shuffle)
        const shuffled = [...ITEMS].sort(() => 0.5 - Math.random());
        const selectedItems = shuffled.slice(0, 3);

        const startX = this.scale.width / 2 - 180;
        
        selectedItems.forEach((item, index) => {
            const x = startX + (index * 180);
            const y = this.scale.height / 2 - 10;

            const card = this.add.rectangle(x, y, 160, 200, 0x333333)
                .setStrokeStyle(2, item.color)
                .setScrollFactor(0)
                .setDepth(101);

            const nameTxt = this.add.text(x, y - 70, item.name, {
                fontSize: '16px', color: '#ffffff', fontStyle: 'bold', fontFamily: 'Arial', align: 'center', wordWrap: { width: 150 }
            }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

            const rarityTxt = this.add.text(x, y - 30, `[${item.rarity}]`, {
                fontSize: '14px', color: `#${item.color.toString(16).padStart(6, '0')}`, fontStyle: 'bold', fontFamily: 'Arial'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

            const effectTxt = this.add.text(x, y + 10, `+${item.effectValue} ${item.effectType.toUpperCase()}`, {
                fontSize: '14px', color: '#a0a0a0', fontFamily: 'Arial', align: 'center', wordWrap: { width: 140 }
            }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

            const buyBtn = this.add.rectangle(x, y + 60, 120, 35, 0x4caf50)
                .setInteractive({ useHandCursor: true })
                .setScrollFactor(0)
                .setDepth(101);
                
            const buyTxt = this.add.text(x, y + 60, `${item.cost} Anime`, {
                fontSize: '16px', color: '#ffffff', fontStyle: 'bold', fontFamily: 'Arial'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

            buyBtn.on('pointerdown', async () => {
                const success = await this.buyItem(item.id);
                if (success) {
                    buyBtn.disableInteractive();
                    buyBtn.setFillStyle(0x555555);
                    buyTxt.setText('VENDUTO');
                }
            });

            elements.push(card, nameTxt, rarityTxt, effectTxt, buyBtn, buyTxt);
        });

        const cleanup = () => {
            elements.forEach(e => e.destroy());
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
        this.cameras.main.setBounds(0, 0, maxNodeX + 500, this.scale.height);
        this.cameras.main.centerOn(this.playerMarker.x, this.scale.height / 2);

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
            this.cameras.main.pan(targetNode.x, this.scale.height / 2, 500, 'Power2');

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
