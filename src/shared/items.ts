export type Rarity = 'Common' | 'Rare' | 'Epic' | 'Legendary';

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
    { id: 'hp_com', name: 'Lesser Potion', rarity: 'Common', cost: 10, color: 0x4caf50, effectType: 'hp', effectValue: 1 },
    { id: 'hp_rar', name: 'Greater Potion', rarity: 'Rare', cost: 25, color: 0x2196f3, effectType: 'hp', effectValue: 3 },
    { id: 'hp_epi', name: 'Elixir of Life', rarity: 'Epic', cost: 60, color: 0x9c27b0, effectType: 'hp', effectValue: 8 },
    
    // Attack Upgrades
    { id: 'atk_com', name: 'Rusty Sword', rarity: 'Common', cost: 10, color: 0xe94560, effectType: 'attack', effectValue: 1 },
    { id: 'atk_rar', name: 'Longsword', rarity: 'Rare', cost: 25, color: 0x2196f3, effectType: 'attack', effectValue: 3 },
    { id: 'atk_epi', name: 'Demonic Blade', rarity: 'Epic', cost: 60, color: 0x9c27b0, effectType: 'attack', effectValue: 8 },
    
    // Soul Catcher
    { id: 'soul_com', name: 'Soul Collector', rarity: 'Common', cost: 15, color: 0x00bcd4, effectType: 'soulCatcher', effectValue: 1 },
    { id: 'soul_rar', name: 'Soul Lantern', rarity: 'Rare', cost: 35, color: 0x2196f3, effectType: 'soulCatcher', effectValue: 2 },
    { id: 'soul_epi', name: 'Reaping Scythe', rarity: 'Epic', cost: 80, color: 0x9c27b0, effectType: 'soulCatcher', effectValue: 4 },
    
    // Army Size
    { id: 'army_com', name: 'Lesser Commander', rarity: 'Common', cost: 20, color: 0xffeb3b, effectType: 'armySize', effectValue: 1 },
    { id: 'army_rar', name: 'Dark General', rarity: 'Rare', cost: 45, color: 0x2196f3, effectType: 'armySize', effectValue: 2 },
    { id: 'army_leg', name: 'Lich King', rarity: 'Legendary', cost: 120, color: 0xff9800, effectType: 'armySize', effectValue: 5 },
    
    // Bone Armor
    { id: 'arm_com', name: 'Fragile Bones', rarity: 'Common', cost: 15, color: 0x795548, effectType: 'boneArmor', effectValue: 1 },
    { id: 'arm_rar', name: 'Reinforced Bones', rarity: 'Rare', cost: 35, color: 0x2196f3, effectType: 'boneArmor', effectValue: 2 },
    { id: 'arm_epi', name: 'Skeletal Armor', rarity: 'Epic', cost: 75, color: 0x9c27b0, effectType: 'boneArmor', effectValue: 4 },
];
