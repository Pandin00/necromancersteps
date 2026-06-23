export type Rarity = 'Comune' | 'Raro' | 'Epico' | 'Leggendario';

export type ItemDef = {
    id: string;
    name: string;
    rarity: Rarity;
    cost: number;
    color: number;
    effectType: 'hp' | 'attack' | 'soulCatcher' | 'boneArmor' | 'armySize';
    effectValue: number;
};

export const ITEMS: ItemDef[] = [
    // HP Upgrades
    { id: 'hp_com', name: 'Pozione Minore', rarity: 'Comune', cost: 10, color: 0x4caf50, effectType: 'hp', effectValue: 1 },
    { id: 'hp_rar', name: 'Pozione Maggiore', rarity: 'Raro', cost: 25, color: 0x2196f3, effectType: 'hp', effectValue: 3 },
    { id: 'hp_epi', name: 'Elisir della Vita', rarity: 'Epico', cost: 60, color: 0x9c27b0, effectType: 'hp', effectValue: 8 },
    
    // Attack Upgrades
    { id: 'atk_com', name: 'Spada Arrugginita', rarity: 'Comune', cost: 10, color: 0xe94560, effectType: 'attack', effectValue: 1 },
    { id: 'atk_rar', name: 'Spada Lunga', rarity: 'Raro', cost: 25, color: 0x2196f3, effectType: 'attack', effectValue: 3 },
    { id: 'atk_epi', name: 'Lama Demoniaca', rarity: 'Epico', cost: 60, color: 0x9c27b0, effectType: 'attack', effectValue: 8 },
    
    // Soul Catcher
    { id: 'soul_com', name: 'Raccogli Anime', rarity: 'Comune', cost: 15, color: 0x00bcd4, effectType: 'soulCatcher', effectValue: 1 },
    { id: 'soul_rar', name: 'Lanterna delle Anime', rarity: 'Raro', cost: 35, color: 0x2196f3, effectType: 'soulCatcher', effectValue: 2 },
    { id: 'soul_epi', name: 'Falce Mietitrice', rarity: 'Epico', cost: 80, color: 0x9c27b0, effectType: 'soulCatcher', effectValue: 4 },
    
    // Army Size
    { id: 'army_com', name: 'Comandante Minore', rarity: 'Comune', cost: 20, color: 0xffeb3b, effectType: 'armySize', effectValue: 1 },
    { id: 'army_rar', name: 'Generale Oscuro', rarity: 'Raro', cost: 45, color: 0x2196f3, effectType: 'armySize', effectValue: 2 },
    { id: 'army_leg', name: 'Re dei Lich', rarity: 'Leggendario', cost: 120, color: 0xff9800, effectType: 'armySize', effectValue: 5 },
    
    // Bone Armor
    { id: 'arm_com', name: 'Ossa Fragili', rarity: 'Comune', cost: 15, color: 0x795548, effectType: 'boneArmor', effectValue: 1 },
    { id: 'arm_rar', name: 'Ossa Rinforzate', rarity: 'Raro', cost: 35, color: 0x2196f3, effectType: 'boneArmor', effectValue: 2 },
    { id: 'arm_epi', name: 'Armatura Scheletrica', rarity: 'Epico', cost: 75, color: 0x9c27b0, effectType: 'boneArmor', effectValue: 4 },
];
