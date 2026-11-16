window.LAST_BLOOM_CONFIG = {
  columns: 12,
  rows: 8,
  gridWidth: 84.1,
  gridHeight: 100,
  roadHeight: 28.5,
  gridTop: 28.5,
  baseTower: { asset: "assets/town/hometown.gif", col: 5, row: 6, columns: 2, rows: 2 },
  coinStart: 2500,
  baseHp: 100,
  baseRecoveryPercent: 3,
  roundCountdownSeconds: 30,
  maxEnemiesOnMap: 12,
  upgradeCost: 150,
  upgradeCostStep: 75,
  coinPerRound: 100,
  randomMonsterScalingAttributes: ["hp", "atk", "sa", "rc", "def"],
  monsters: [
    { id: "M1", name: "Alice", faction: "DEMON", asset: "assets/character/M1.png", normalAsset: "assets/character/M1_N.png", ultimateAsset: "assets/character/M1_U.png", hp: 3000, atk: 5, sa: 0.95, rc: 0, def: 5, ultimateDamage: 15, ultimateInterval: 5, skills: ["STUN"], spawnChance: 0.3, spawnMin: 1, spawnMax: 3, coinReward: 20 },
    { id: "M2", name: "Snake Queen", faction: "DEMON", asset: "assets/character/M2.png", normalAsset: "assets/character/M2_N.png", ultimateAsset: "assets/character/M2_U.png", hp: 5000, atk: 8, sa: 1.96, rc: 5, def: 8, ultimateDamage: 20, ultimateInterval: 3, skills: ["SLOW", "HEALING_REDUCTION"], spawnChance: 0.25, spawnMin: 1, spawnMax: 2, coinReward: 35 },
    { id: "M3", name: "Dragon of Paint", faction: "DEMON", asset: "assets/character/M3.png", normalAsset: "assets/character/M3_N.png", ultimateAsset: "assets/character/M3_U.png", hp: 12000, atk: 15, sa: 1.75, rc: 15, def: 15, ultimateDamage: 45, ultimateInterval: 10, skills: ["ARMOR_REDUCTION", "RDEF"], spawnChance: 0.2, spawnMin: 1, spawnMax: 2, coinReward: 60 },
    { id: "M4", name: "Gradus", faction: "DEMON", asset: "assets/character/M4.png", normalAsset: "assets/character/M4_N.png", ultimateAsset: "assets/character/M4_U.png", hp: 25000, atk: 25, sa: 1.85, rc: 25, def: 25, ultimateDamage: 75, ultimateInterval: 15, skills: ["RATK", "ARMOR_PENETRATION"], spawnChance: 0.15, spawnMin: 1, spawnMax: 1, coinReward: 100 },
    { id: "M5", name: "Relortans", faction: "DEMON", asset: "assets/character/M5.png", normalAsset: "assets/character/M5_N.png", ultimateAsset: "assets/character/M5_U.png", hp: 40000, atk: 35, sa: 1.73, rc: 35, def: 35, ultimateDamage: 1000, ultimateInterval: 20, skills: ["STUN", "CRITICAL"], spawnChance: 0.1, spawnMin: 1, spawnMax: 1, coinReward: 150 }
  ],
  unitTypes: [
    { id: "C1", name: "Magic Boy", faction: "HUMAN", asset: "assets/character/C1.png", normalAsset: "assets/character/C1_N.png", ultimateAsset: "assets/character/C1_U.png", cost: 80, hp: 115, atk: 20, sa: 0.8, rc: 250, def: 8, specialDamage: 120, specialInterval: 5, range: 5, skillIds: ["CRITICAL", "ARMOR_PENETRATION"] },
    { id: "C2", name: "Water Queen", faction: "HUMAN", asset: "assets/character/C2.png", normalAsset: "assets/character/C2_N.png", ultimateAsset: "assets/character/C2_U.png", cost: 120, hp: 95, atk: 20, sa: 1.11, rc: 200, def: 7, specialDamage: 150, specialInterval: 3, range: 3, skillIds: ["SLOW", "HEALING_REDUCTION"] },
    { id: "C3", name: "Iron Warrior", faction: "HUMAN", asset: "assets/character/C3.png", normalAsset: "assets/character/C3_N.png", ultimateAsset: "assets/character/C3_U.png", cost: 75, hp: 145, atk: 20, sa: 0.61, rc: 150, def: 18, specialDamage: 105, specialInterval: 4, range: 4, skillIds: ["LIFESTEAL", "ARMOR_REDUCTION", "RDEF"] },
    { id: "C4", name: "Master Michel", faction: "HUMAN", asset: "assets/character/C4.png", normalAsset: "assets/character/C4_N.png", ultimateAsset: "assets/character/C4_U.png", cost: 150, hp: 125, atk: 20, sa: 0.95, rc: 195, def: 6, specialDamage: 210, specialInterval: 7, range: 6, skillIds: ["TEAM_HEAL", "SLOW_RESISTANCE", "CLR"] },
    { id: "C5", name: "David Dame", faction: "HUMAN", asset: "assets/character/C5.png", normalAsset: "assets/character/C5_N.png", ultimateAsset: "assets/character/C5_U.png", cost: 50, hp: 230, atk: 20, sa: 0.65, rc: 275, def: 22, specialDamage: 135, specialInterval: 2, range: 2, skillIds: ["STUN", "RATK"], additionalValue: 150 }
  ],
  cardSlots: ["C1", "C2", "C3", "C4", "C5", null, null, null,null, null],
  effects: [
    { id: "STUN", name: "Choáng", deployment: "PROJECTILE", userFaction: "BOTH", targetFaction: "OPPONENT", impact: "TARGET", effect: "STUN", value: 2, duration: 2, cooldown: 7, chance: 0.35, speed: 420, size: 14, radius: 0 },
    { id: "LIFESTEAL", name: "Hút máu", deployment: "PROJECTILE", userFaction: "BOTH", targetFaction: "OPPONENT", impact: "TARGET", effect: "LIFESTEAL", value: 25, duration: 0, cooldown: 0, chance: 1, speed: 420, size: 12, radius: 0 },
    { id: "ARMOR_REDUCTION", name: "Giảm giáp %", deployment: "PROJECTILE", userFaction: "BOTH", targetFaction: "OPPONENT", impact: "TARGET", effect: "ARMOR_REDUCTION", value: 25, duration: 5, cooldown: 8, chance: 0.4, speed: 380, size: 14, radius: 0 },
    { id: "HEALING_REDUCTION", name: "Giảm hồi phục", deployment: "PROJECTILE", userFaction: "BOTH", targetFaction: "OPPONENT", impact: "TARGET", effect: "HEALING_REDUCTION", value: 35, duration: 5, cooldown: 8, chance: 0.4, speed: 380, size: 12, radius: 0 },
    { id: "SLOW", name: "Làm chậm", deployment: "PROJECTILE", userFaction: "BOTH", targetFaction: "OPPONENT", impact: "TARGET", effect: "SLOW", value: 30, duration: 4, cooldown: 7, chance: 0.4, speed: 380, size: 13, radius: 0 },
    { id: "TEAM_HEAL", name: "Hồi máu đội", deployment: "TARGET_POINT", userFaction: "HUMAN", targetFaction: "HUMAN", impact: "USER_POINT", effect: "TEAM_HEAL", value: 75, duration: 0, cooldown: 8, chance: 1, delay: 0.2, speed: 0, size: 18, radius: 2 },
    { id: "CRITICAL", name: "Chí mạng", deployment: "PROJECTILE", userFaction: "BOTH", targetFaction: "OPPONENT", impact: "TARGET", effect: "CRITICAL", value: 150, duration: 0, cooldown: 0, chance: 0.2, multiplier: 150, speed: 420, size: 15, radius: 0 },
    { id: "ARMOR_PENETRATION", name: "Xuyên giáp", deployment: "PROJECTILE", userFaction: "BOTH", targetFaction: "OPPONENT", impact: "TARGET", effect: "ARMOR_PENETRATION", value: 40, duration: 0, cooldown: 7, chance: 0.4, speed: 420, size: 12, radius: 0 },
    { id: "SLOW_RESISTANCE", name: "Kháng chậm", deployment: "GLOBAL", userFaction: "BOTH", targetFaction: "USER_FACTION", impact: "GLOBAL", effect: "SLOW_RESISTANCE", value: 40, duration: 6, cooldown: 10, chance: 1, speed: 0, size: 0, radius: 0 },
    { id: "CLR", name: "Thanh tẩy", deployment: "GLOBAL", userFaction: "BOTH", targetFaction: "USER_FACTION", impact: "GLOBAL", effect: "CLR", value: 0, duration: 0, cooldown: 12, chance: 1, speed: 0, size: 0, radius: 0 },
    { id: "RATK", name: "Giảm ATK", deployment: "PROJECTILE", userFaction: "BOTH", targetFaction: "OPPONENT", impact: "TARGET", effect: "RATK", value: 10, duration: 4, cooldown: 8, chance: 0.4, speed: 380, size: 12, radius: 0 },
    { id: "RDEF", name: "Giảm DEF", deployment: "PROJECTILE", userFaction: "BOTH", targetFaction: "OPPONENT", impact: "TARGET", effect: "RDEF", value: 10, duration: 4, cooldown: 8, chance: 0.4, speed: 380, size: 12, radius: 0 }
  ],
  skills: [
    { id: "heal", name: "Hồi phục", asset: "assets/skills/heal.svg", cost: 40, cooldown: 18, value: 55, description: "Hồi HP cho tất cả tướng" },
    { id: "burst", name: "Bộc phá", asset: "assets/skills/burst.svg", cost: 60, cooldown: 22, value: 75, description: "Gây sát thương lên mọi quái" },
    { id: "freeze", name: "Đóng băng", asset: "assets/skills/freeze.svg", cost: 50, cooldown: 25, value: 4, description: "Choáng quái trong vùng" },
    { id: "coin", name: "Tiếp tế", asset: "assets/skills/essence.svg", cost: 0, cooldown: 30, value: 70, description: "Nhận thêm COIN" }
  ]
};
