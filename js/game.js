(() => {
  "use strict";
  const cfg = window.LAST_BLOOM_CONFIG;
  const $ = id => document.getElementById(id);
  const gameShell = document.querySelector(".game-shell");
  const gameScreen = $("gameScreen");
  const towerElement = $("baseTower");
  const grid = $("battleGrid");
  const road = $("roadZone");
  const unitsLayer = $("unitsLayer");
  const effectsLayer = $("effectsLayer");
  const unitTray = $("unitTray");
  const skillTray = $("skillTray");
  const waveButton = $("waveButton");
  const skipButton = $("skipButton");
  const roundStatus = $("roundStatus");
  const message = $("combatMessage");
  const helperText = $("helperText");
  const modToggle = $("modToggle");
  const fullscreenToggle = $("fullscreenToggle");
  const modOverlay = $("modOverlay");
  const modForm = $("modForm");
  const modGlobalFields = $("modGlobalFields");
  const modSkillFields = $("modSkillFields");
  const modEffectFields = $("modEffectFields");
  const modError = $("modError");
  const idleAnimationFrequencyInput = $("idleAnimationFrequency");
  const idleAnimationFrequencyValue = $("idleAnimationFrequencyValue");
  const idleAnimationStatus = $("idleAnimationStatus");
  const uiTextSizeInput = $("uiTextSize");
  const uiTextSizeValue = $("uiTextSizeValue");
  const uiTextSizeStatus = $("uiTextSizeStatus");
  const upgradeOverlay = $("upgradeOverlay");

  document.documentElement.style.setProperty("--grid-width", `${cfg.gridWidth}%`);
  document.documentElement.style.setProperty("--grid-height", `${cfg.gridHeight}%`);
  document.documentElement.style.setProperty("--grid-columns", cfg.columns);
  document.documentElement.style.setProperty("--grid-rows", cfg.rows);
  document.documentElement.style.setProperty("--road-height", `${cfg.roadHeight}%`);
  document.documentElement.style.setProperty("--grid-top", `${cfg.gridTop}%`);
  document.documentElement.style.setProperty("--tower-left",
    `${(100 - cfg.gridWidth) / 2 + cfg.baseTower.col * cfg.gridWidth / cfg.columns}%`);
  document.documentElement.style.setProperty("--tower-top", `${cfg.baseTower.row * 100 / cfg.rows}%`);
  document.documentElement.style.setProperty("--tower-width",
    `${cfg.baseTower.columns * cfg.gridWidth / cfg.columns}%`);
  document.documentElement.style.setProperty("--tower-height", `${cfg.baseTower.rows * 100 / cfg.rows}%`);
  towerElement.querySelector("img").src = cfg.baseTower.asset;

  const unitDefs = new Map(cfg.unitTypes.map(unit => [unit.id, unit]));
  const monsterDefs = new Map(cfg.monsters.map(monster => [monster.id, monster]));
  const skillDefs = new Map(cfg.skills.map(skill => [skill.id, skill]));
  const effectDefs = new Map(cfg.effects.map(effect => [effect.id, effect]));
  const modStorageKey = "lastBloomModSettings";
  const idleAnimationStorageKey = "lastBloomIdleAnimationFrequency";
  const uiTextSizeStorageKey = "lastBloomUiTextSize";
  const legacyGameStorageKey = "lastBloomGameProgressV1";
  const saveSlotIds = ["slot-1", "slot-2", "slot-3", "slot-4", "slot-5"];
  const activeSaveSlotStorageKey = "lastBloomActiveSaveSlotV1";
  const gameStorageKeyForSlot = slotId => `lastBloomGameProgressV2_${slotId}`;
  const backupStorageKeyForSlot = slotId => `lastBloomGameBackupV1_${slotId}`;
  let activeSaveSlotId = "slot-1";
  try {
    const storedSlotId = localStorage.getItem(activeSaveSlotStorageKey);
    if (saveSlotIds.includes(storedSlotId)) activeSaveSlotId = storedSlotId;
  } catch (error) {
    console.warn("Không thể đọc slot lưu đang dùng.", error);
  }

  function applyIdleAnimationFrequency(frequency) {
    const roundedFrequency = Math.round(frequency * 10) / 10;
    if (!Number.isFinite(frequency) || roundedFrequency < 0.3 || roundedFrequency > 3) {
      throw new Error("Tần suất nhấp nhô phải từ 0,3 đến 3 lần/giây.");
    }
    idleAnimationFrequencyInput.value = String(roundedFrequency);
    idleAnimationFrequencyValue.textContent = Number.isInteger(roundedFrequency)
      ? String(roundedFrequency)
      : roundedFrequency.toFixed(1).replace(".", ",");
    document.documentElement.style.setProperty("--idle-bob-duration", `${1000 / roundedFrequency}ms`);
  }
  function loadIdleAnimationFrequency() {
    try {
      const saved = localStorage.getItem(idleAnimationStorageKey);
      if (saved === null) return 2;
      const savedFrequency = Number(saved);
      if (!Number.isFinite(savedFrequency)) {
        throw new Error("Tần suất nhấp nhô đã lưu không hợp lệ.");
      }
      const frequency = Math.round(savedFrequency * 10) / 10;
      if (Number.isInteger(savedFrequency) && savedFrequency >= 1 && savedFrequency <= 10) {
        const migratedFrequency = Math.min(3, frequency);
        if (migratedFrequency !== savedFrequency) {
          try {
            localStorage.setItem(idleAnimationStorageKey, String(migratedFrequency));
          } catch (error) {
            console.warn("Không thể cập nhật tần suất nhấp nhô cũ.", error);
          }
        }
        return migratedFrequency;
      }
      if (frequency < 0.3 || frequency > 3) throw new Error("Tần suất nhấp nhô đã lưu không hợp lệ.");
      return frequency;
    } catch (error) {
      console.warn("Không thể tải tần suất nhấp nhô đã lưu; dùng mặc định 2 lần/giây.", error);
      return 2;
    }
  }
  applyIdleAnimationFrequency(loadIdleAnimationFrequency());
  function applyUiTextSize(size) {
    if (!Number.isInteger(size) || size < 10 || size > 16) {
      throw new Error("Cỡ chữ giao diện phải từ 10 đến 16 px.");
    }
    uiTextSizeInput.value = String(size);
    uiTextSizeValue.textContent = String(size);
    document.documentElement.style.setProperty("--ui-font-small", `${size * 0.75}px`);
    document.documentElement.style.setProperty("--ui-font-medium", `${size * 0.85}px`);
    document.documentElement.style.setProperty("--ui-font-base", `${size}px`);
    document.documentElement.style.setProperty("--ui-font-large", `${size * 1.25}px`);
  }
  function loadUiTextSize() {
    try {
      const saved = localStorage.getItem(uiTextSizeStorageKey);
      if (saved === null) return 12;
      const size = Number(saved);
      if (!Number.isInteger(size) || size < 10 || size > 16) {
        throw new Error("Cỡ chữ giao diện đã lưu không hợp lệ.");
      }
      return size;
    } catch (error) {
      console.warn("Không thể tải cỡ chữ giao diện; dùng mặc định 12 px.", error);
      return 12;
    }
  }
  applyUiTextSize(loadUiTextSize());

  function updateFullscreenToggle() {
    const isFullscreen = document.fullscreenElement === gameShell;
    const label = isFullscreen ? "Thoát toàn màn hình" : "Bật toàn màn hình";
    fullscreenToggle.setAttribute("aria-label", label);
    fullscreenToggle.title = label;
    fullscreenToggle.textContent = isFullscreen ? "↙" : "⛶";
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement === gameShell) {
        await document.exitFullscreen();
      } else if (typeof gameShell.requestFullscreen === "function") {
        await gameShell.requestFullscreen();
      } else {
        showMessage("Trình duyệt không hỗ trợ chế độ toàn màn hình.");
      }
    } catch (error) {
      console.error("Không thể đổi chế độ toàn màn hình.", error);
      showMessage("Không thể đổi chế độ toàn màn hình.");
    }
  }

  function readModSettings() {
    return {
      coinStart: cfg.coinStart,
      baseHp: cfg.baseHp,
      skills: Object.fromEntries(cfg.skills.map(skill => [skill.id, {
        cost: skill.cost, cooldown: skill.cooldown, value: skill.value
      }])),
      effects: Object.fromEntries(cfg.effects.map(effect => {
        const values = {
          value: effect.value, duration: effect.duration,
          cooldown: effect.cooldown, chance: effect.chance
        };
        if (Number.isFinite(effect.multiplier)) values.multiplier = effect.multiplier;
        return [effect.id, values];
      }))
    };
  }
  const defaultModSettings = readModSettings();
  const previousSkillDefaults = {
    heal: { cost: 5, cooldown: 5 },
    burst: { cost: 0, cooldown: 0.07589 },
    freeze: { cost: 0, cooldown: 7 },
    coin: { cost: 0, cooldown: 3 }
  };
  function migrateStoredSkillDefaults(settings) {
    if (!settings || !settings.skills || typeof settings.skills !== "object" || Array.isArray(settings.skills)) {
      return false;
    }
    let migrated = false;
    cfg.skills.forEach(skill => {
      const previous = previousSkillDefaults[skill.id];
      const saved = settings.skills[skill.id];
      if (!previous || !saved || typeof saved !== "object" || Array.isArray(saved)) return;
      ["cost", "cooldown"].forEach(property => {
        if (saved[property] === previous[property] && skill[property] !== previous[property]) {
          saved[property] = skill[property];
          migrated = true;
        }
      });
    });
    return migrated;
  }
  function isValidModSettings(settings) {
    const values = settings && [settings.coinStart, settings.baseHp];
    if (!values || !values.every(value => Number.isFinite(value) && value >= 0 && value <= 99999999999999999999999) || settings.baseHp === 0) return false;
    return cfg.skills.every(skill => {
      const current = settings.skills && settings.skills[skill.id];
      return current && [current.cost, current.cooldown, current.value]
        .every(value => Number.isFinite(value) && value >= 0 && value <= 99999999999999999999999);
    }) && cfg.effects.every(effect => {
      const current = settings.effects && settings.effects[effect.id];
      const values = current && [current.value, current.duration, current.cooldown, current.chance];
      return values && values.every(value => Number.isFinite(value) && value >= 0 && value <= 99999999999999999999999) &&
        current.chance <= 1 && (!Number.isFinite(effect.multiplier) ||
          Number.isFinite(current.multiplier) && current.multiplier >= 0 && current.multiplier <= 99999999999999999999999);
    });
  }
  function mergeStoredModSettings(settings) {
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
      throw new Error("Dữ liệu menu mod không hợp lệ.");
    }
    const merged = readModSettings();
    if ((Object.prototype.hasOwnProperty.call(settings, "coinStart") && !Number.isFinite(settings.coinStart)) ||
        (Object.prototype.hasOwnProperty.call(settings, "baseHp") && !Number.isFinite(settings.baseHp)) ||
        (settings.skills !== undefined &&
          (!settings.skills || typeof settings.skills !== "object" || Array.isArray(settings.skills))) ||
        (settings.effects !== undefined &&
          (!settings.effects || typeof settings.effects !== "object" || Array.isArray(settings.effects)))) {
      throw new Error("Dữ liệu menu mod không hợp lệ.");
    }
    if (Number.isFinite(settings.coinStart)) merged.coinStart = settings.coinStart;
    if (Number.isFinite(settings.baseHp)) merged.baseHp = settings.baseHp;
    cfg.skills.forEach(skill => {
      const saved = settings.skills && settings.skills[skill.id];
      if (saved && typeof saved === "object") Object.assign(merged.skills[skill.id], saved);
    });
    cfg.effects.forEach(effect => {
      const saved = settings.effects && settings.effects[effect.id];
      if (saved && typeof saved === "object") Object.assign(merged.effects[effect.id], saved);
    });
    if (!isValidModSettings(merged)) throw new Error("Dữ liệu menu mod không hợp lệ.");
    return merged;
  }
  function applyModSettings(settings) {
    cfg.coinStart = settings.coinStart;
    cfg.baseHp = settings.baseHp;
    cfg.skills.forEach(skill => Object.assign(skill, settings.skills[skill.id]));
    cfg.effects.forEach(effect => Object.assign(effect, settings.effects[effect.id]));
  }
  try {
    const savedSettings = localStorage.getItem(modStorageKey);
    if (savedSettings) {
      const parsedSettings = JSON.parse(savedSettings);
      const migrated = migrateStoredSkillDefaults(parsedSettings);
      applyModSettings(mergeStoredModSettings(parsedSettings));
      if (migrated) {
        try {
          localStorage.setItem(modStorageKey, JSON.stringify(readModSettings()));
        } catch (error) {
          console.warn("Không thể lưu giá trị kỹ năng mặc định mới.", error);
        }
      }
    }
  } catch (error) {
    console.warn("Không thể tải thông số menu mod đã lưu.", error);
  }
  if (window.LAST_BLOOM_APPLY_ENABLED_MODS) window.LAST_BLOOM_APPLY_ENABLED_MODS();

  const state = {
    coins: cfg.coinStart, baseHp: cfg.baseHp, wave: 0, bestWave: 0,
    selected: null, units: [], enemies: [], projectiles: [], delayedEffects: [], waveActive: false,
    paused: false, gameOver: false, countdownUntil: 0, nextUnitId: 1,
    nextEnemyId: 1, lastTick: performance.now(), messageTimer: null,
    skillReadyAt: {}, monsterBonusCounts: Object.fromEntries(cfg.randomMonsterScalingAttributes.map(key => [key, 0])),
    humanUpgradeLevel: 0, humanUpgradeTotalSpent: 0,
    skillUpgradeLevels: { heal: 0, burst: 0, freeze: 0 },
    skillUpgradeSpent: { heal: 0, burst: 0, freeze: 0 },
    roundDamageDealt: 0, modWasRunning: false, upgradeWasRunning: false,
  };
  window.LAST_BLOOM_CONFIRM_RELOAD = () => {
    if (state.wave === 0 && state.units.length === 0 && state.enemies.length === 0) return true;
    return window.confirm("Áp dụng cấu hình sẽ tải lại game và kết thúc trận hiện tại. Tiếp tục?");
  };
  cfg.skills.forEach(skill => { state.skillReadyAt[skill.id] = 0; });
  migrateLegacyGameSave();
  restoreGameState();

  function roundCoin(amount) {
    return Math.round((amount + Number.EPSILON) * 100) / 100;
  }
  function formatCoin(amount) {
    return roundCoin(amount).toLocaleString("vi-VN", {
      minimumFractionDigits: Number.isInteger(roundCoin(amount)) ? 0 : 2,
      maximumFractionDigits: 2
    });
  }
  function upgradeCostForLevel(level) {
    return roundCoin(cfg.humanUpgradeBaseCost * Math.pow(cfg.upgradeCostGrowth, level));
  }
  function cumulativeUpgradeCost(level) {
    let total = 0;
    for (let index = 0; index < level; index++) total = roundCoin(total + upgradeCostForLevel(index));
    return total;
  }
  function skillValue(skill) {
    return skill.value * Math.pow(cfg.skillUpgradeEffectMultiplier, state.skillUpgradeLevels[skill.id] || 0);
  }
  function isValidEntitySnapshot(entity, kind) {
    if (!entity || typeof entity !== "object" || Array.isArray(entity) || entity.kind !== kind) return false;
    const typeExists = kind === "unit" ? unitDefs.has(entity.type) : monsterDefs.has(entity.type);
    const stats = ["hp", "maxHp", "atk", "sa", "rc", "def", "specialDamage"];
    const validSkillTimers = entity.skillReadyAt && typeof entity.skillReadyAt === "object" &&
      !Array.isArray(entity.skillReadyAt) &&
      Object.values(entity.skillReadyAt).every(value => Number.isFinite(value) && value >= 0);
    const validEffects = Array.isArray(entity.effects) && entity.effects.length <= 100 &&
      entity.effects.every(effect => effect && effectDefs.has(effect.id) &&
        Number.isFinite(effect.value) && Number.isFinite(effect.remaining) && effect.remaining >= 0 &&
        ["HUMAN", "DEMON"].includes(effect.sourceFaction));
    const validLocation = kind === "unit"
      ? Number.isInteger(entity.col) && entity.col >= 0 && entity.col < cfg.columns &&
        Number.isInteger(entity.row) && entity.row >= 0 && entity.row + 1 < cfg.rows
      : Number.isInteger(entity.lane) && entity.lane >= 0 && entity.lane < cfg.columns &&
        [1, 2].includes(entity.phase) && typeof entity.defeated === "boolean" &&
        typeof entity.rewarded === "boolean" && Number.isFinite(entity.coinReward) && entity.coinReward >= 0;
    return typeExists && Number.isInteger(kind === "unit" ? entity.uid : entity.eid) &&
      stats.every(key => Number.isFinite(entity[key]) && entity[key] >= 0) &&
      entity.maxHp > 0 && entity.hp <= entity.maxHp &&
      Array.isArray(entity.skillIds) && entity.skillIds.every(id => typeof id === "string" && effectDefs.has(id)) &&
      validSkillTimers && validEffects && validLocation &&
      ["nextAttackAt", "nextHealAt", "nextSpecialAt"].every(key =>
        Number.isFinite(entity[key]) && entity[key] >= 0);
  }
  function saveEntitySnapshot(entity, now) {
    const snapshot = JSON.parse(JSON.stringify(entity));
    ["nextAttackAt", "nextHealAt", "nextSpecialAt"].forEach(key => {
      if (Number.isFinite(snapshot[key])) snapshot[key] = Math.max(0, snapshot[key] - now);
    });
    snapshot.skillReadyAt = Object.fromEntries(Object.entries(snapshot.skillReadyAt || {}).map(([id, at]) =>
      [id, Math.max(0, at - now)]));
    snapshot.effects = snapshot.effects.map(effect => ({
      ...effect,
      remaining: effect.expiresAt === 0 ? 0 : Math.max(0, effect.expiresAt - now),
      expiresAt: undefined
    }));
    return snapshot;
  }
  function restoreEntitySnapshot(snapshot, now) {
    const entity = { ...snapshot };
    ["nextAttackAt", "nextHealAt", "nextSpecialAt"].forEach(key => {
      if (Number.isFinite(entity[key])) entity[key] = now + entity[key];
    });
    entity.skillReadyAt = Object.fromEntries(Object.entries(entity.skillReadyAt || {}).map(([id, remaining]) =>
      [id, now + remaining]));
    entity.effects = entity.effects.map(effect => {
      const restored = { ...effect, expiresAt: effect.remaining === 0 ? 0 : now + effect.remaining };
      delete restored.remaining;
      return restored;
    });
    return entity;
  }
  function isValidGameSnapshot(saved) {
    return Boolean(saved && saved.version === 1 && Number.isFinite(saved.coins) && saved.coins >= 0 &&
      Number.isFinite(saved.baseHp) && saved.baseHp >= 0 && Number.isInteger(saved.wave) && saved.wave >= 0 &&
      Array.isArray(saved.units) && Array.isArray(saved.enemies) &&
      saved.units.length <= 200 && saved.enemies.length <= 100 &&
      saved.units.every(entity => isValidEntitySnapshot(entity, "unit")) &&
      saved.enemies.every(entity => isValidEntitySnapshot(entity, "enemy")) &&
      Number.isInteger(saved.humanUpgradeLevel) && saved.humanUpgradeLevel >= 0 &&
      saved.humanUpgradeLevel <= 1000 &&
      Number.isFinite(saved.humanUpgradeTotalSpent) && saved.humanUpgradeTotalSpent >= 0);
  }
  function migrateLegacyGameSave() {
    try {
      const slotOneSave = localStorage.getItem(gameStorageKeyForSlot("slot-1"));
      if (slotOneSave === null && activeSaveSlotId === "slot-1") {
        const legacyBestWave = Number(localStorage.getItem("lastBloomBestWave"));
        if (Number.isInteger(legacyBestWave) && legacyBestWave >= 0) {
          state.bestWave = Math.max(state.bestWave, legacyBestWave);
        }
      }
      if (slotOneSave !== null) return;
      const legacySave = localStorage.getItem(legacyGameStorageKey);
      if (legacySave === null) return;
      const parsed = JSON.parse(legacySave);
      if (!isValidGameSnapshot(parsed)) throw new Error("Bản lưu cũ không hợp lệ.");
      localStorage.setItem(gameStorageKeyForSlot("slot-1"), legacySave);
    } catch (error) {
      console.error("Không thể chuyển bản lưu cũ sang Slot 1; dữ liệu gốc vẫn được giữ nguyên.", error);
    }
  }
  function saveGameState() {
    const now = performance.now();
    const snapshot = {
      version: 1,
      savedAt: Date.now(),
      coins: roundCoin(state.coins),
      baseHp: state.baseHp,
      wave: state.wave,
      bestWave: state.bestWave,
      waveActive: state.waveActive,
      paused: state.paused,
      gameOver: state.gameOver,
      countdownRemaining: Math.max(0, state.countdownUntil - now),
      nextUnitId: state.nextUnitId,
      nextEnemyId: state.nextEnemyId,
      monsterBonusCounts: state.monsterBonusCounts,
      humanUpgradeLevel: state.humanUpgradeLevel,
      humanUpgradeTotalSpent: state.humanUpgradeTotalSpent,
      skillUpgradeLevels: state.skillUpgradeLevels,
      skillUpgradeSpent: state.skillUpgradeSpent,
      roundDamageDealt: state.roundDamageDealt,
      skillReadyAt: Object.fromEntries(Object.entries(state.skillReadyAt).map(([id, at]) =>
        [id, Math.max(0, at - now)])),
      units: state.units.map(unit => saveEntitySnapshot(unit, now)),
      enemies: state.enemies.map(enemy => saveEntitySnapshot(enemy, now))
    };
    try {
      localStorage.setItem(gameStorageKeyForSlot(activeSaveSlotId), JSON.stringify(snapshot));
      const status = $("saveStatus");
      if (status) status.textContent = `Đã tự động lưu ${activeSaveSlotId.replace("slot-", "Slot ")} trên thiết bị này.`;
      updateSaveManagement();
    } catch (error) {
      console.error("Không thể lưu tiến trình trận đấu.", error);
      const status = $("saveStatus");
      if (status) status.textContent = "Không thể lưu tiến trình. Hãy giải phóng dung lượng trình duyệt và tạo bản xuất JSON.";
    }
  }
  function restoreGameState() {
    try {
      const raw = localStorage.getItem(gameStorageKeyForSlot(activeSaveSlotId));
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!isValidGameSnapshot(saved)) {
        throw new Error("Dữ liệu trận đấu đã lưu không hợp lệ.");
      }
      const now = performance.now();
      state.coins = roundCoin(saved.coins);
      state.baseHp = saved.baseHp;
      state.wave = saved.wave;
      state.bestWave = Number.isInteger(saved.bestWave) ? Math.max(state.bestWave, saved.bestWave) : state.bestWave;
      state.waveActive = Boolean(saved.waveActive);
      state.paused = state.waveActive || Boolean(saved.paused);
      state.gameOver = Boolean(saved.gameOver);
      state.countdownUntil = now + Math.max(0, Number(saved.countdownRemaining) || 0);
      state.nextUnitId = Math.max(1, Number(saved.nextUnitId) || 1);
      state.nextEnemyId = Math.max(1, Number(saved.nextEnemyId) || 1);
      state.monsterBonusCounts = Object.fromEntries(cfg.randomMonsterScalingAttributes.map(key =>
        [key, Math.max(0, Number(saved.monsterBonusCounts && saved.monsterBonusCounts[key]) || 0)]));
      state.humanUpgradeLevel = saved.humanUpgradeLevel;
      state.humanUpgradeTotalSpent = roundCoin(saved.humanUpgradeTotalSpent);
      ["heal", "burst", "freeze"].forEach(id => {
        state.skillUpgradeLevels[id] = Math.max(0, Math.min(1000,
          Number(saved.skillUpgradeLevels && saved.skillUpgradeLevels[id]) || 0));
        state.skillUpgradeSpent[id] = roundCoin(Math.max(0,
          Number(saved.skillUpgradeSpent && saved.skillUpgradeSpent[id]) || 0));
      });
      state.roundDamageDealt = Math.max(0, Number(saved.roundDamageDealt) || 0);
      cfg.skills.forEach(skill => {
        state.skillReadyAt[skill.id] = now + Math.max(0,
          Number(saved.skillReadyAt && saved.skillReadyAt[skill.id]) || 0);
      });
      state.units = saved.units.map(entity => restoreEntitySnapshot(entity, now));
      state.enemies = saved.enemies.map(entity => restoreEntitySnapshot(entity, now));
      state.enemies.forEach(enemy => {
        delete enemy.phaseTwoReadyAt;
        if (!enemy.defeated && enemy.phase === 1 && enemy.hp <= 0) {
          enemy.phase = 2;
          enemy.hp = enemy.maxHp;
        }
      });
      state.nextUnitId = Math.max(state.nextUnitId, ...state.units.map(unit => unit.uid + 1));
      state.nextEnemyId = Math.max(state.nextEnemyId, ...state.enemies.map(enemy => enemy.eid + 1));
    } catch (error) {
      console.error("Không thể khôi phục tiến trình trận đấu đã lưu.", error);
      try { localStorage.removeItem(gameStorageKeyForSlot(activeSaveSlotId)); }
      catch (removeError) { console.error("Không thể xóa tiến trình trận đấu lỗi.", removeError); }
    }
  }
  function updateSaveManagement() {
    const slotSelect = $("saveSlotSelect");
    if (!slotSelect) return;
    slotSelect.value = activeSaveSlotId;
    try {
      const currentSave = localStorage.getItem(gameStorageKeyForSlot(activeSaveSlotId));
      $("saveSlotDetails").textContent = currentSave
        ? `Slot này có tiến trình đã lưu${state.wave ? ` · Đợt ${state.wave}` : ""}.`
        : "Slot này chưa có tiến trình; bắt đầu chơi sẽ tạo bản lưu mới.";
      const backupText = localStorage.getItem(backupStorageKeyForSlot(activeSaveSlotId));
      const restoreButton = $("saveBackupRestore");
      if (!backupText) {
        $("backupStatus").textContent = "Chưa có backup cho slot này.";
        restoreButton.disabled = true;
      } else {
        const backup = JSON.parse(backupText);
        $("backupStatus").textContent = `Backup gần nhất: ${new Date(backup.createdAt).toLocaleString("vi-VN")}.`;
        restoreButton.disabled = false;
      }
    } catch (error) {
      console.error("Không thể đọc thông tin slot hoặc backup.", error);
      $("saveSlotDetails").textContent = "Không thể đọc dữ liệu slot.";
      $("backupStatus").textContent = "Không thể đọc backup.";
      $("saveBackupRestore").disabled = true;
    }
  }
  function confirmReplacingProgress(action) {
    if (state.wave === 0 && state.units.length === 0 && state.enemies.length === 0) return true;
    return window.confirm(`${action} sẽ thay thế tiến trình hiện tại. Tiếp tục?`);
  }
  function createSaveBackup() {
    try {
      saveGameState();
      const raw = localStorage.getItem(gameStorageKeyForSlot(activeSaveSlotId));
      const snapshot = raw && JSON.parse(raw);
      if (!isValidGameSnapshot(snapshot)) throw new Error("Không có tiến trình hợp lệ để sao lưu.");
      localStorage.setItem(backupStorageKeyForSlot(activeSaveSlotId), JSON.stringify({
        version: 1, createdAt: Date.now(), save: snapshot
      }));
      updateSaveManagement();
      showMessage("Đã tạo backup cho slot hiện tại");
    } catch (error) {
      console.error("Không thể tạo backup tiến trình.", error);
      $("backupStatus").textContent = `Không thể tạo backup: ${error.message}`;
    }
  }
  function restoreSaveBackup() {
    if (!confirmReplacingProgress("Khôi phục backup")) return;
    try {
      const backup = JSON.parse(localStorage.getItem(backupStorageKeyForSlot(activeSaveSlotId)) || "null");
      if (!backup || backup.version !== 1 || !isValidGameSnapshot(backup.save)) {
        throw new Error("Backup không hợp lệ hoặc không tồn tại.");
      }
      localStorage.setItem(gameStorageKeyForSlot(activeSaveSlotId), JSON.stringify(backup.save));
      location.reload();
    } catch (error) {
      console.error("Không thể khôi phục backup.", error);
      $("backupStatus").textContent = `Không thể khôi phục backup: ${error.message}`;
    }
  }
  function exportSaveJson() {
    try {
      saveGameState();
      const raw = localStorage.getItem(gameStorageKeyForSlot(activeSaveSlotId));
      const snapshot = raw && JSON.parse(raw);
      if (!isValidGameSnapshot(snapshot)) throw new Error("Không có tiến trình hợp lệ để xuất.");
      const contents = JSON.stringify({
        format: "LAST_BLOOM_SAVE", formatVersion: 1, exportedAt: new Date().toISOString(),
        save: snapshot
      }, null, 2);
      const url = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `last-bloom-${activeSaveSlotId}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      $("saveStatus").textContent = "Đã xuất tiến trình thành file JSON.";
    } catch (error) {
      console.error("Không thể xuất tiến trình.", error);
      $("saveStatus").textContent = `Không thể xuất JSON: ${error.message}`;
    }
  }
  async function importSaveJson(file) {
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("File JSON vượt quá giới hạn 5 MB.");
      const parsed = JSON.parse(await file.text());
      const snapshot = parsed && parsed.format === "LAST_BLOOM_SAVE" && parsed.formatVersion === 1
        ? parsed.save : parsed;
      if (!isValidGameSnapshot(snapshot)) throw new Error("File không chứa tiến trình LAST BLOOM hợp lệ.");
      if (!confirmReplacingProgress("Nhập tiến trình")) return;
      localStorage.setItem(gameStorageKeyForSlot(activeSaveSlotId), JSON.stringify(snapshot));
      location.reload();
    } catch (error) {
      console.error("Không thể nhập tiến trình.", error);
      $("saveStatus").textContent = `Không thể nhập JSON: ${error.message}`;
    } finally {
      $("saveImportFile").value = "";
    }
  }
  function clearAllLocalGameData() {
    const accepted = window.confirm(
      "Xóa toàn bộ tiến trình, backup, nhân vật/mod tùy chỉnh và cài đặt đã lưu trên thiết bị này, rồi chơi lại từ đầu? Thao tác này không thể hoàn tác."
    );
    if (!accepted) return;
    try {
      const keys = [
        legacyGameStorageKey, "lastBloomBestWave", activeSaveSlotStorageKey,
        "lastBloomManagedGameDataV1", modStorageKey, idleAnimationStorageKey, uiTextSizeStorageKey,
        ...saveSlotIds.flatMap(slotId => [
          gameStorageKeyForSlot(slotId), backupStorageKeyForSlot(slotId)
        ])
      ];
      keys.forEach(key => localStorage.removeItem(key));
      location.reload();
    } catch (error) {
      console.error("Không thể xóa toàn bộ dữ liệu game.", error);
      $("saveStatus").textContent = "Không thể xóa hết dữ liệu đã lưu. Hãy kiểm tra quyền lưu trữ của trình duyệt.";
    }
  }
  function changeSaveSlot(slotId) {
    if (!saveSlotIds.includes(slotId)) return;
    if (!confirmReplacingProgress("Chuyển slot")) {
      $("saveSlotSelect").value = activeSaveSlotId;
      return;
    }
    try {
      saveGameState();
      localStorage.setItem(activeSaveSlotStorageKey, slotId);
      location.reload();
    } catch (error) {
      console.error("Không thể chuyển slot lưu.", error);
      $("saveStatus").textContent = "Không thể đổi slot do trình duyệt không lưu được cài đặt.";
      $("saveSlotSelect").value = activeSaveSlotId;
    }
  }

  function showMessage(text, duration = 1900) {
    message.textContent = text;
    message.classList.add("visible");
    clearTimeout(state.messageTimer);
    state.messageTimer = setTimeout(() => message.classList.remove("visible"), duration);
  }
  function setHint(text) { helperText.textContent = text; }
  function fmtTime(ms) { return Math.max(0, Math.ceil(ms / 1000)); }
  function factionOf(entity) {
    return entity.kind === "unit" ? "HUMAN" : "DEMON";
  }
  function alive(entity) { return entity.hp > 0; }
  function activeEffects(entity, now = performance.now()) {
    entity.effects = entity.effects.filter(effect => effect.expiresAt === 0 || effect.expiresAt > now);
    return entity.effects;
  }
  function getEffect(entity, id, now = performance.now()) {
    return activeEffects(entity, now).find(effect => effect.id === id);
  }
  function isStunned(entity, now) { return Boolean(getEffect(entity, "STUN", now)); }
  function statMultiplier(entity, stat, now) {
    const debuff = getEffect(entity, stat === "atk" ? "RATK" : "RDEF", now);
    return debuff ? Math.max(0, 1 - debuff.value / 100) : 1;
  }
  function displayedStat(entity, stat, now) {
    const base = entity[stat] || 0;
    if (stat === "atk" || stat === "def") return base * statMultiplier(entity, stat, now);
    return base;
  }
  function attackInterval(entity, now) {
    const slow = getEffect(entity, "SLOW", now);
    const resistance = getEffect(entity, "SLOW_RESISTANCE", now);
    const reduction = slow ? Math.max(0, slow.value * (1 - (resistance ? resistance.value / 100 : 0))) : 0;
    return 1000 / Math.max(0.05, entity.sa) * (1 + reduction / 100);
  }
  function applyStatus(target, id, value, duration, now = performance.now()) {
    if (!alive(target)) return;
    const targetFaction = factionOf(target);
    const resist = getEffect(target, "SLOW_RESISTANCE", now);
    if (id === "SLOW" && resist) value *= Math.max(0, 1 - resist.value / 100);
    if (id === "SLOW" && value <= 0) return;
    if (id === "STUN" && duration > 0 && resist) duration *= Math.max(0, 1 - resist.value / 100);
    if (id === "STUN" && duration <= 0) return;
    const previous = activeEffects(target, now).find(effect => effect.id === id);
    const next = {
      id, value, expiresAt: duration > 0 ? now + duration * 1000 : 0,
      sourceFaction: targetFaction
    };
    if (previous) {
      previous.value = Math.max(previous.value, value);
      previous.expiresAt = Math.max(previous.expiresAt, next.expiresAt);
    } else target.effects.push(next);
  }
  function clearDebuffs(target, now = performance.now()) {
    if (!alive(target)) return;
    target.effects = activeEffects(target, now).filter(effect => effect.id === "SLOW_RESISTANCE");
  }
  function healEntity(target, amount, now) {
    if (!alive(target)) return;
    const reduction = getEffect(target, "HEALING_REDUCTION", now);
    const actual = amount * (reduction ? Math.max(0, 1 - reduction.value / 100) : 1);
    target.hp = Math.min(target.maxHp, target.hp + actual);
  }
  function damageAmount(attacker, target, armorPenetration = 0, criticalMultiplier = 1, now = performance.now()) {
    const armorReduction = getEffect(target, "ARMOR_REDUCTION", now);
    const def = Math.max(0, displayedStat(target, "def", now) *
      (1 - (armorReduction ? armorReduction.value / 100 : 0)) *
      (1 - Math.max(0, armorPenetration) / 100));
    return Math.max(1, displayedStat(attacker, "atk", now) * (100 / (100 + def)) * criticalMultiplier);
  }
  function awardKill(enemy) {
    if (enemy.rewarded || !enemy.defeated) return;
    enemy.rewarded = true;
    state.coins = roundCoin(state.coins + enemy.coinReward);
  }
  function damageEntity(attacker, target, rawDamage, now = performance.now(), armorPenetration = 0, criticalMultiplier = 1) {
    if (!alive(attacker) || !alive(target)) return 0;
    const damage = Math.max(1, rawDamage || damageAmount(attacker, target, armorPenetration, criticalMultiplier, now));
    const actualDamage = Math.min(target.hp, damage);
    target.hp = Math.max(0, target.hp - actualDamage);
    if (attacker.kind === "unit" && target.kind === "enemy") state.roundDamageDealt += actualDamage;
    if (target.kind === "enemy" && target.hp <= 0) {
      if (target.phase === 1 && !target.defeated) {
        target.phase = 2;
        target.hp = target.maxHp;
        target.nextAttackAt = now + 650;
        target.nextHealAt = now + 5000;
        target.nextSpecialAt = now + (target.specialInterval || 0) * 1000;
        flashDemonPhase();
      } else {
        target.defeated = true;
        awardKill(target);
      }
    }
    return actualDamage;
  }
  function resolveTargetFaction(owner, targetFaction) {
    const faction = factionOf(owner);
    if (targetFaction === "OPPONENT") return faction === "HUMAN" ? "DEMON" : "HUMAN";
    if (targetFaction === "USER_FACTION") return faction;
    return targetFaction;
  }
  function targetsFor(owner, faction) {
    return (faction === "HUMAN" ? state.units : state.enemies).filter(alive);
  }
  function pointFor(entity) {
    if (entity.kind === "unit") {
      return {
        x: ((100 - cfg.gridWidth) / 2) + ((entity.col + 0.5) * cfg.gridWidth / cfg.columns),
        y: cfg.gridTop + ((entity.row + 1) * (100 - cfg.gridTop) / cfg.rows)
      };
    }
    if (entity.kind === "base") {
      const tower = cfg.baseTower;
      return {
        x: ((100 - cfg.gridWidth) / 2) + ((tower.col + tower.columns / 2) * cfg.gridWidth / cfg.columns),
        y: cfg.gridTop + ((tower.row + tower.rows / 2) * (100 - cfg.gridTop) / cfg.rows)
      };
    }
    return {
      x: cellCenterX(entity.lane),
      y: cfg.roadHeight * (entity.top + entity.height * 0.72) / 100
    };
  }
  function cellCenterX(col) {
    const left = (100 - cfg.gridWidth) / 2;
    return left + ((col + 0.5) * cfg.gridWidth / cfg.columns);
  }
  function createImpact(x, y, className = "skill-impact") {
    const impact = document.createElement("span");
    impact.className = className;
    impact.style.left = `${x}%`;
    impact.style.top = `${y}%`;
    effectsLayer.appendChild(impact);
    setTimeout(() => impact.remove(), 650);
  }
  function occupied(col, row) {
    return state.units.some(unit => unit.col === col && row <= unit.row + 1 && row + 1 >= unit.row);
  }
  function overlapsTower(col, row) {
    const tower = cfg.baseTower;
    return col >= tower.col && col < tower.col + tower.columns &&
      row < tower.row + tower.rows && row + 1 >= tower.row;
  }
  function canPlace(col, row) {
    return col >= 0 && col < cfg.columns && row >= 0 && row + 1 < cfg.rows &&
      !occupied(col, row) && !overlapsTower(col, row);
  }

  const cellEls = [];
  for (let row = 0; row < cfg.rows; row++) {
    for (let col = 0; col < cfg.columns; col++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "grid-cell";
      cell.dataset.col = col;
      cell.dataset.row = row;
      cell.setAttribute("aria-label", `Ô ${row + 1}, cột ${col + 1}`);
      cell.addEventListener("click", () => placeSelected(col, row));
      grid.appendChild(cell);
      cellEls.push(cell);
    }
  }

  function renderCards() {
    cfg.cardSlots.forEach((unitId, index) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "unit-card";
      card.dataset.slot = index;
      if (!unitId || !unitDefs.has(unitId)) {
        card.disabled = true;
        card.setAttribute("aria-label", "Ô tướng trống");
      } else {
        const def = unitDefs.get(unitId);
        card.dataset.unit = unitId;
        card.title = `${def.name} · ${def.cost} COIN`;
        card.setAttribute("aria-label", `${def.name}, giá ${def.cost} COIN`);
        const img = document.createElement("img");
        img.src = def.asset;
        img.alt = def.name;
        img.draggable = false;
        const cost = document.createElement("span");
        cost.className = "unit-cost";
        cost.textContent = def.cost;
        card.append(img, cost);
        card.addEventListener("click", () => {
          if (state.gameOver) return;
          if (state.selected === unitId) state.selected = null;
          else if (state.coins < def.cost) showMessage(`Chưa đủ COIN để gọi ${def.name}`);
          else state.selected = unitId;
          renderSelection();
        });
      }
      unitTray.appendChild(card);
    });
  }

  function skillEffectText(skill) {
    const value = skillValue(skill);
    if (skill.id === "heal") return `Hồi ${formatCoin(value)} HP cho tất cả tướng`;
    if (skill.id === "burst") return `Gây ${formatCoin(value)} sát thương lên mọi quái`;
    if (skill.id === "freeze") return `Choáng quái trong ${formatCoin(value)} giây`;
    return `Nhận thêm ${formatCoin(value)} COIN`;
  }
  function renderSkills() {
    cfg.skills.forEach(skill => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "skill-button";
      button.dataset.skill = skill.id;
      const img = document.createElement("img");
      img.src = skill.asset;
      img.alt = skill.name;
      img.draggable = false;
      const cooldown = document.createElement("span");
      cooldown.className = "skill-cooldown";
      button.append(img, cooldown);
      button.addEventListener("click", () => useSkill(skill.id));
      skillTray.appendChild(button);
    });
  }

  function addModField(container, labelText, value, setting, skillId, property, effectId) {
    const label = document.createElement("label");
    label.className = "mod-field";
    const caption = document.createElement("span");
    caption.textContent = labelText;
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.max = "1000000";
    input.step = property === "cooldown" ? "0.01" : property === "value" ? "0.1" : "1";
    input.required = true;
    input.value = value;
    if (setting) input.dataset.setting = setting;
    if (skillId) {
      input.dataset.skillId = skillId;
      input.dataset.property = property;
    }
    if (effectId) {
      input.dataset.effectId = effectId;
      input.dataset.property = property;
    }
    input.addEventListener("input", () => { modError.textContent = ""; });
    label.append(caption, input);
    container.appendChild(label);
  }
  function buildModForm() {
    [
      ["COIN bắt đầu", cfg.coinStart, "coinStart"],
      ["COIN hiện tại", state.coins, "currentCoin"],
      ["Máu trụ tối đa", cfg.baseHp, "baseHp"],
      ["Máu trụ hiện tại", state.baseHp, "currentBaseHp"]
    ].forEach(([label, value, setting]) => addModField(modGlobalFields, label, value, setting));
    const valueLabels = { heal: "Lượng hồi HP", burst: "Sát thương", freeze: "Thời gian choáng (giây)", coin: "COIN nhận" };
    cfg.skills.forEach(skill => {
      const row = document.createElement("section");
      row.className = "mod-skill-row";
      const heading = document.createElement("h3");
      heading.textContent = skill.name;
      const fields = document.createElement("div");
      fields.className = "mod-skill-fields";
      addModField(fields, "Giá COIN", skill.cost, null, skill.id, "cost");
      addModField(fields, "Hồi chiêu (giây)", skill.cooldown, null, skill.id, "cooldown");
      addModField(fields, valueLabels[skill.id] || "Giá trị hiệu ứng", skill.value, null, skill.id, "value");
      row.append(heading, fields);
      modSkillFields.appendChild(row);
    });
    cfg.effects.forEach(effect => {
      const row = document.createElement("section");
      row.className = "mod-skill-row";
      const heading = document.createElement("h3");
      heading.textContent = effect.name;
      const fields = document.createElement("div");
      fields.className = "mod-effect-fields";
      addModField(fields, "Giá trị", effect.value, null, null, "value", effect.id);
      addModField(fields, "Thời lượng (giây)", effect.duration, null, null, "duration", effect.id);
      addModField(fields, "Hồi chiêu (giây)", effect.cooldown, null, null, "cooldown", effect.id);
      addModField(fields, "Xác suất (%)", effect.chance * 100, null, null, "chance", effect.id);
      if (Number.isFinite(effect.multiplier)) {
        addModField(fields, "Sát thương chí mạng (%)", effect.multiplier, null, null, "multiplier", effect.id);
      }
      row.append(heading, fields);
      modEffectFields.appendChild(row);
    });
  }
  function syncModForm() {
    const values = {
      coinStart: cfg.coinStart, currentCoin: state.coins,
      baseHp: cfg.baseHp, currentBaseHp: state.baseHp
    };
    modGlobalFields.querySelectorAll("input").forEach(input => { input.value = values[input.dataset.setting]; });
    modSkillFields.querySelectorAll("input").forEach(input => {
      input.value = skillDefs.get(input.dataset.skillId)[input.dataset.property];
    });
    modEffectFields.querySelectorAll("input").forEach(input => {
      const value = effectDefs.get(input.dataset.effectId)[input.dataset.property];
      input.value = input.dataset.property === "chance" ? value * 100 : value;
    });
    modError.textContent = "";
  }
  function setModOpen(open) {
    if (modOverlay.hidden === !open) return;
    modOverlay.hidden = !open;
    if (open) {
      if (window.LAST_BLOOM_SELECT_SETTINGS_TAB) window.LAST_BLOOM_SELECT_SETTINGS_TAB("game");
      state.modWasRunning = state.waveActive && !state.paused;
      if (state.modWasRunning) state.paused = true;
      syncModForm();
      $("modClose").focus();
    } else {
      if (state.modWasRunning && state.waveActive && !state.gameOver) state.paused = false;
      state.modWasRunning = false;
      modToggle.focus();
    }
    updateWaveButton();
  }
  function submitModForm(event) {
    event.preventDefault();
    const next = readModSettings();
    const currentCoin = Number(modGlobalFields.querySelector('[data-setting="currentCoin"]').value);
    const currentBaseHp = Number(modGlobalFields.querySelector('[data-setting="currentBaseHp"]').value);
    modGlobalFields.querySelectorAll("input[data-setting]").forEach(input => {
      if (input.dataset.setting !== "currentCoin" && input.dataset.setting !== "currentBaseHp") {
        next[input.dataset.setting] = Number(input.value);
      }
    });
    modSkillFields.querySelectorAll("input").forEach(input => {
      next.skills[input.dataset.skillId][input.dataset.property] = Number(input.value);
    });
    modEffectFields.querySelectorAll("input").forEach(input => {
      const property = input.dataset.property;
      next.effects[input.dataset.effectId][property] =
        Number(input.value) / (property === "chance" ? 100 : 1);
    });
    if (!isValidModSettings(next) || !Number.isFinite(currentCoin) || currentCoin < 0 ||
        !Number.isFinite(currentBaseHp) || currentBaseHp < 0 || currentBaseHp > next.baseHp) {
      modError.textContent = "Giá trị không hợp lệ. COIN và thông số kỹ năng phải từ 0 trở lên; máu trụ hiện tại không vượt mức tối đa.";
      return;
    }
    const now = performance.now();
    const previous = readModSettings();
    cfg.skills.forEach(skill => {
      const remaining = Math.max(0, state.skillReadyAt[skill.id] - now);
      const oldCooldown = previous.skills[skill.id].cooldown * 1000;
      if (remaining > 0 && oldCooldown > 0) {
        const progress = 1 - Math.min(1, remaining / oldCooldown);
        state.skillReadyAt[skill.id] = now + (1 - progress) * next.skills[skill.id].cooldown * 1000;
      }
    });
    const entities = state.units.concat(state.enemies);
    cfg.effects.forEach(effect => {
      const oldCooldown = previous.effects[effect.id].cooldown * 1000;
      const newCooldown = next.effects[effect.id].cooldown * 1000;
      entities.forEach(entity => {
        const remaining = Math.max(0, (entity.skillReadyAt[effect.id] || 0) - now);
        if (remaining > 0 && oldCooldown > 0) {
          const progress = 1 - Math.min(1, remaining / oldCooldown);
          entity.skillReadyAt[effect.id] = now + (1 - progress) * newCooldown;
        }
      });
    });
    applyModSettings(next);
    state.coins = currentCoin;
    state.baseHp = currentBaseHp;
    try { localStorage.setItem(modStorageKey, JSON.stringify(next)); }
    catch (error) {
      console.error("Không thể lưu thông số menu mod.", error);
      modError.textContent = "Đã áp dụng trong trận nhưng không thể lưu thông số trên thiết bị.";
      updateHud();
      updateSkillButtons();
      renderSelection();
      return;
    }
    saveGameState();
    updateHud();
    updateSkillButtons();
    renderSelection();
    setModOpen(false);
    showMessage("Thông số mod đã được áp dụng và lưu.");
  }
  function resetModSettings() {
    applyModSettings(defaultModSettings);
    state.coins = cfg.coinStart;
    state.baseHp = cfg.baseHp;
    cfg.skills.forEach(skill => { state.skillReadyAt[skill.id] = 0; });
    state.units.concat(state.enemies).forEach(entity => {
      cfg.effects.forEach(effect => { entity.skillReadyAt[effect.id] = 0; });
    });
    try { localStorage.removeItem(modStorageKey); }
    catch (error) {
      console.error("Không thể xóa thông số menu mod đã lưu.", error);
      modError.textContent = "Đã khôi phục mặc định trong trận nhưng không thể xóa bản lưu.";
      syncModForm();
      updateHud();
      updateSkillButtons();
      return;
    }
    syncModForm();
    updateHud();
    updateSkillButtons();
    renderSelection();
    saveGameState();
    showMessage("Đã khôi phục thông số mặc định.");
  }

  function renderSelection() {
    unitTray.querySelectorAll(".unit-card").forEach(card => {
      card.classList.toggle("active", card.dataset.unit === state.selected);
    });
    cellEls.forEach(cell => {
      const col = Number(cell.dataset.col), row = Number(cell.dataset.row);
      const can = state.selected && canPlace(col, row) &&
        state.coins >= unitDefs.get(state.selected).cost && !state.gameOver;
      cell.classList.toggle("valid-cell", Boolean(can));
      cell.classList.toggle("invalid-cell", Boolean(state.selected && !can));
    });
    if (state.selected) setHint(`${unitDefs.get(state.selected).name}: chọn ô trống (1 cột × 2 hàng)`);
    else if (!state.gameOver) setHint(state.waveActive
      ? "Chọn UPGRADE HUMAN hoặc tiếp tục chiến đấu"
      : "Chọn tướng rồi chọn ô trên sân");
  }
  function placeSelected(col, row) {
    if (!state.selected || state.gameOver) return;
    const def = unitDefs.get(state.selected);
    if (state.coins < def.cost) { showMessage("Không đủ COIN"); return; }
    if (row + 1 >= cfg.rows) { showMessage("Tướng cần đúng 2 ô theo chiều dọc"); return; }
    if (overlapsTower(col, row)) { showMessage("Không thể bố trí tướng lên vị trí của trụ"); return; }
    if (!canPlace(col, row)) { showMessage("Vị trí này đã có tướng hoặc không hợp lệ"); return; }
    state.coins = roundCoin(state.coins - def.cost);
    const now = performance.now();
    const humanStatMultiplier = Math.pow(1 + cfg.humanStatIncreasePerLevel, state.humanUpgradeLevel);
    state.units.push({
      kind: "unit", uid: state.nextUnitId++, type: def.id, col, row,
      hp: def.hp * humanStatMultiplier, maxHp: def.hp * humanStatMultiplier,
      atk: def.atk * humanStatMultiplier, sa: def.sa * humanStatMultiplier,
      rc: def.rc * humanStatMultiplier, def: def.def * humanStatMultiplier,
      skillIds: def.skillIds.slice(), skillReadyAt: {}, effects: [],
      nextAttackAt: now + 650, nextHealAt: now + 5000,
      nextSpecialAt: now + (def.specialInterval || 0) * 1000,
      specialDamage: (def.specialDamage || 0) * humanStatMultiplier
    });
    renderUnits();
    updateHud();
    renderSelection();
    showMessage(`${def.name} đã được bố trí`);
    saveGameState();
  }
  function renderEffects(entity, el) {
    const list = activeEffects(entity);
    if (!list.length) return;
    const indicator = document.createElement("span");
    indicator.className = "unit-effects";
    indicator.textContent = list.map(effect => effect.id === "STUN" ? "✦" : effect.id.slice(0, 2)).join(" ");
    el.appendChild(indicator);
  }
  function renderUnits() {
    unitsLayer.innerHTML = "";
    state.units.filter(alive).forEach(unit => {
      const def = unitDefs.get(unit.type);
      const el = document.createElement("div");
      el.className = "placed-unit";
      el.dataset.unitId = unit.uid;
      el.style.left = `${(unit.col + 0.5) * 100 / cfg.columns}%`;
      el.style.top = `${unit.row * 100 / cfg.rows}%`;
      el.style.width = `${100 / cfg.columns}%`;
      el.style.height = `${200 / cfg.rows}%`;
      el.title = `${def.name} · HP ${Math.ceil(unit.hp)}/${Math.ceil(unit.maxHp)} · ATK ${Math.ceil(unit.atk)}`;
      const img = document.createElement("img");
      img.src = def.asset;
      img.alt = def.name;
      img.draggable = false;
      const bar = document.createElement("span");
      bar.className = "unit-health";
      const fill = document.createElement("i");
      fill.style.width = `${Math.max(0, unit.hp / unit.maxHp * 100)}%`;
      bar.appendChild(fill);
      el.append(img, bar);
      renderEffects(unit, el);
      unitsLayer.appendChild(el);
    });
  }
  function renderEnemies() {
    road.innerHTML = "";
    state.enemies.filter(enemy => !enemy.defeated).forEach(enemy => {
      const el = document.createElement("div");
      el.className = "enemy";
      el.dataset.enemyId = enemy.eid;
      el.style.left = `${cellCenterX(enemy.lane)}%`;
      el.style.top = `${enemy.top}%`;
      el.style.height = `${enemy.height}%`;
      const img = document.createElement("img");
      const monster = monsterDefs.get(enemy.type);
      img.src = monster.asset;
      img.alt = monster.name;
      img.draggable = false;
      const bars = document.createElement("span");
      bars.className = "enemy-health-bars";
      [1, 2].forEach(phase => {
        const bar = document.createElement("span");
        const currentPhase = enemy.phase === phase;
        bar.className = `enemy-health${currentPhase ? " phase-current" : ""}` +
          `${phase === 2 ? " second-phase" : ""}`;
        const fill = document.createElement("i");
        const phaseHp = currentPhase ? enemy.hp : phase === 2 && !enemy.defeated ? enemy.maxHp : 0;
        fill.style.width = `${Math.max(0, phaseHp / enemy.maxHp * 100)}%`;
        bar.appendChild(fill);
        bars.appendChild(bar);
      });
      el.append(img, bars);
      renderEffects(enemy, el);
      road.appendChild(el);
    });
  }

  function clearProjectiles() {
    state.projectiles.forEach(projectile => projectile.element.remove());
    state.projectiles = [];
  }
  function spawnWave() {
    if (state.gameOver) return;
    state.wave += 1;
    state.waveActive = true;
    state.paused = false;
    state.countdownUntil = 0;
    state.enemies = [];
    state.roundDamageDealt = 0;
    clearProjectiles();
    const now = performance.now();
    const laneOrder = [2, 4, 6, 8, 10, 1, 3, 5, 7, 9, 11, 0, 5, 7, 3];
    const eligibleMonsters = cfg.monsters.filter(monster => {
      const demonNumber = Number.parseInt(monster.id.replace(/^M/i, ""), 10);
      return Number.isInteger(demonNumber) && demonNumber >= 1 && demonNumber <= 10 &&
        (state.wave >= 10 || demonNumber <= 5);
    });
    if (!eligibleMonsters.length) throw new Error("Không có Demon đủ điều kiện xuất hiện ở vòng này.");
    const count = state.wave >= 10 ? 5 : 3 + Math.floor(Math.random() * 3);
    const chosen = Array.from({ length: count }, () =>
      eligibleMonsters[Math.floor(Math.random() * eligibleMonsters.length)]);
    chosen.forEach((monster, index) => {
      const extraCount = state.monsterBonusCounts;
      const common = Math.pow(1.1, state.wave - 1);
      const demonNumber = Number.parseInt(monster.id.replace(/^M/i, ""), 10);
      const difficulty = Math.min(10, Math.max(1, demonNumber));
      const scaled = attr => monster[attr] *
        (attr === "atk" || attr === "def" ? difficulty * common :
          attr === "hp" ? difficulty : 1) *
        Math.pow(1.1, extraCount[attr] || 0);
      const hp = scaled("hp");
      state.enemies.push({
        kind: "enemy", eid: state.nextEnemyId++, type: monster.id,
        lane: laneOrder[(index + (state.wave - 1) * 2) % laneOrder.length],
        hp, maxHp: hp, atk: scaled("atk"), sa: scaled("sa"), rc: scaled("rc"), def: scaled("def"),
        coinReward: monster.coinReward, skillIds: monster.skills.slice(), skillReadyAt: {}, effects: [],
        nextHealAt: now + 5000, nextAttackAt: now + 1800 + (index % 3) * 350,
        nextSpecialAt: now + (monster.ultimateInterval || 0) * 1000, specialDamage: monster.ultimateDamage || 0,
        specialInterval: monster.ultimateInterval || 0, phase: 1, defeated: false, rewarded: false,
        top: 5 + (index % 2) * 8, height: 66
      });
    });
    renderEnemies();
    updateHud();
    updateWaveButton();
    showMessage(`ĐỢT ${state.wave} — ${state.enemies.length} Demon đã xuất hiện`, 2500);
    setHint("Tướng và quái chiến đấu theo chỉ số ATK, SA, DEF và kỹ năng");
    saveGameState();
  }
  function updateWaveButton() {
    if (state.gameOver) waveButton.textContent = "CHƠI LẠI";
    else if (state.paused) waveButton.textContent = "TIẾP TỤC";
    else if (state.waveActive) waveButton.textContent = "TẠM DỪNG";
    else if (state.countdownUntil > 0) waveButton.textContent = "ĐỢT ĐANG CHỜ";
    else waveButton.textContent = state.wave > 0 ? "START" : "START";
    skipButton.hidden = !(state.countdownUntil > 0 && !state.gameOver);
    if (state.countdownUntil > 0) {
      skipButton.textContent = `SKIP · ${fmtTime(state.countdownUntil - performance.now())}`;
      roundStatus.textContent = `ĐỢT TIẾP THEO · ${fmtTime(state.countdownUntil - performance.now())}s`;
    } else if (state.gameOver) roundStatus.textContent = "THẤT THỦ";
    else if (state.waveActive && state.paused) roundStatus.textContent = "TẠM DỪNG";
    else if (state.waveActive) roundStatus.textContent = "ĐANG CHIẾN ĐẤU";
    else roundStatus.textContent = state.wave ? "SẴN SÀNG" : "SẴN SÀNG";
  }
  function handleWaveButton() {
    if (state.gameOver) { resetGame(); return; }
    if (state.waveActive) {
      state.paused = !state.paused;
      updateWaveButton();
      saveGameState();
      showMessage(state.paused ? "Đã tạm dừng" : "Tiếp tục chiến đấu");
    } else if (state.countdownUntil <= 0) spawnWave();
  }

  function applySkillEffect(owner, definition, target, damage, now) {
    if (!alive(target) && definition.effect !== "LIFESTEAL") return;
    const id = definition.effect;
    if (id === "LIFESTEAL") {
      const amount = damage * definition.value / 100;
      healEntity(owner, amount, now);
    } else if (id === "CRITICAL") {
      return;
    } else if (id === "ARMOR_PENETRATION") {
      return;
    } else if (id === "TEAM_HEAL") {
      healEntity(target, definition.value, now);
    } else if (id === "CLR") {
      clearDebuffs(target, now);
    } else if (id === "ARMOR_REDUCTION" || id === "HEALING_REDUCTION" || id === "SLOW" ||
               id === "STUN" || id === "RATK" || id === "RDEF" || id === "SLOW_RESISTANCE") {
      applyStatus(target, id, definition.value, definition.duration, now);
    }
  }
  function skillDamageOptions(owner, now) {
    let penetration = 0, criticalMultiplier = 1, activeSkill = null;
    for (const id of owner.skillIds) {
      const definition = effectDefs.get(id);
      if (!definition || definition.deployment !== "PROJECTILE" ||
          (owner.skillReadyAt[id] || 0) > now || Math.random() >= definition.chance) continue;
      if (definition.effect === "ARMOR_PENETRATION") penetration = definition.value;
      if (definition.effect === "CRITICAL") criticalMultiplier = (definition.multiplier || definition.value) / 100;
      activeSkill = definition;
      break;
    }
    return { penetration, criticalMultiplier, activeSkill };
  }
  function projectileDuration(start, end, definition) {
    const distance = Math.hypot(
      (end.x - start.x) * gameScreen.clientWidth / 100,
      (end.y - start.y) * gameScreen.clientHeight / 100
    );
    return Math.max(280, distance /
      Math.max(100, definition && definition.speed ? definition.speed : 420) * 1000);
  }
  function createProjectile(owner, target, damage, definition, now, asset, special, applyDamage = true) {
    const start = pointFor(owner), end = pointFor(target);
    const element = document.createElement("img");
    element.className = `battle-projectile${special ? " ultimate-projectile" : ""}`;
    element.alt = "";
    element.draggable = false;
    element.addEventListener("error", () => showMessage(`Không tải được ảnh chiêu: ${asset}`));
    element.src = asset;
    element.style.left = `${start.x}%`;
    element.style.top = `${start.y}%`;
    element.style.transform = "translate(-50%, -50%)";
    effectsLayer.appendChild(element);
    const projectile = {
      owner, target, start, end, damage, definition, asset, special, startedAt: now,
      applyDamage, element, elapsed: 0, lastFrame: now,
      duration: projectileDuration(start, end, definition)
    };
    state.projectiles.push(projectile);
    projectile.frameId = requestAnimationFrame(frameTime => updateProjectile(projectile, frameTime));
  }
  function retargetBaseProjectile(projectile, now) {
    if (!state.waveActive || state.paused || projectile.owner.kind !== "enemy" ||
        projectile.target.kind !== "base") return;
    const target = selectTarget(projectile.owner);
    if (!target) return;
    projectile.start = {
      x: Number.parseFloat(projectile.element.style.left),
      y: Number.parseFloat(projectile.element.style.top)
    };
    projectile.target = target;
    projectile.end = pointFor(target);
    const attacker = {
      ...projectile.owner,
      atk: projectile.special ? projectile.owner.specialDamage : projectile.owner.atk
    };
    projectile.damage = damageAmount(attacker, target, 0, 1, now);
    projectile.elapsed = 0;
    projectile.lastFrame = now;
    projectile.duration = projectileDuration(projectile.start, projectile.end, projectile.definition);
  }
  function updateProjectile(projectile, frameTime) {
    if (!state.projectiles.includes(projectile)) return;
    if (state.gameOver) {
      projectile.element.remove();
      state.projectiles = state.projectiles.filter(item => item !== projectile);
      return;
    }
    retargetBaseProjectile(projectile, frameTime);
    if (state.waveActive && !state.paused) {
      projectile.elapsed += Math.min(50, Math.max(0, frameTime - projectile.lastFrame));
    }
    projectile.lastFrame = frameTime;
    const progress = Math.min(1, projectile.elapsed / projectile.duration);
    projectile.element.style.left = `${projectile.start.x + (projectile.end.x - projectile.start.x) * progress}%`;
    projectile.element.style.top = `${projectile.start.y + (projectile.end.y - projectile.start.y) * progress}%`;
    if (progress >= 1) {
      projectile.element.remove();
      state.projectiles = state.projectiles.filter(item => item !== projectile);
      resolveProjectile(projectile, frameTime);
      return;
    }
    projectile.frameId = requestAnimationFrame(() => updateProjectile(projectile, performance.now()));
  }
  function processProjectiles(now) {
    state.projectiles.slice().forEach(projectile => updateProjectile(projectile, now));
  }
  function resolveProjectile(projectile, now) {
    const { owner, target, definition } = projectile;
    if (!alive(owner) || target.kind !== "base" && !alive(target)) return;
    let amount = 0;
    if (projectile.applyDamage) {
      if (target.kind === "base") {
        damageBase(projectile.damage);
        amount = projectile.damage;
      } else amount = damageEntity(owner, target, projectile.damage, now);
    }
    if (definition && target.kind !== "base") applySkillEffect(owner, definition, target, amount, now);
    createImpact(projectile.end.x, projectile.end.y);
    if (target.kind === "enemy") renderEnemies();
    else if (target.kind === "unit") renderUnits();
  }
  function tryDeploySkill(owner, now) {
    for (const id of owner.skillIds) {
      const definition = effectDefs.get(id);
      if (!definition || definition.deployment === "PROJECTILE" ||
          (owner.skillReadyAt[id] || 0) > now || Math.random() >= definition.chance) continue;
      const faction = resolveTargetFaction(owner, definition.targetFaction);
      let targets = targetsFor(owner, faction);
      if (definition.deployment === "TARGET_POINT") {
        const center = pointFor(owner);
        targets = targets.filter(entity => {
          const point = pointFor(entity);
          return Math.hypot(point.x - center.x, point.y - center.y) <=
            definition.radius * Math.max(cfg.gridWidth / cfg.columns, (100 - cfg.gridTop) / cfg.rows);
        });
      }
      if (targets.length) {
        state.delayedEffects.push({ owner, definition, targets, faction, dueAt: now + definition.delay * 1000 });
        const point = pointFor(owner);
        createImpact(point.x, point.y);
        if (definition.cooldown > 0) owner.skillReadyAt[id] = now + definition.cooldown * 1000;
      }
      return;
    }
  }
  function processDelayedEffects(now) {
    state.delayedEffects = state.delayedEffects.filter(item => {
      if (item.dueAt > now) return true;
      item.targets.forEach(target => applySkillEffect(item.owner, item.definition, target, 0, now));
      if (item.faction === "HUMAN") renderUnits();
      else renderEnemies();
      return false;
    });
  }
  function useSkill(id) {
    if (state.gameOver) return;
    const skill = skillDefs.get(id);
    const now = performance.now();
    if (now < state.skillReadyAt[id]) { showMessage(`Kỹ năng ${skill.name} đang hồi`); return; }
    if (state.coins < skill.cost) { showMessage("Không đủ COIN"); return; }
    if (id === "heal" && !state.units.some(alive)) { showMessage("Chưa có tướng để hồi phục"); return; }
    if ((id === "burst" || id === "freeze") && !state.enemies.some(alive)) { showMessage("Chưa có quái trên đường"); return; }
    const value = skillValue(skill);
    state.coins = roundCoin(state.coins - skill.cost);
    state.skillReadyAt[id] = now + skill.cooldown * 1000;
    if (id === "heal") {
      state.units.forEach(unit => healEntity(unit, value, now));
      renderUnits();
      showMessage(`Hồi phục: tất cả tướng nhận tối đa ${formatCoin(value)} HP`);
    } else if (id === "burst") {
      state.enemies.forEach(enemy => damageEntity({ ...enemy, atk: value, kind: "unit" }, enemy, value, now));
      renderEnemies();
      showMessage(`Bộc phá: gây ${formatCoin(value)} sát thương lên mọi quái`);
      checkWaveClear(now);
    } else if (id === "freeze") {
      state.enemies.forEach(enemy => applyStatus(enemy, "STUN", 1, value, now));
      renderEnemies();
      showMessage(`Quái bị choáng trong ${formatCoin(value)} giây`);
    } else if (id === "coin") {
      state.coins = roundCoin(state.coins + value);
      showMessage(`Tiếp tế: nhận thêm ${formatCoin(value)} COIN`);
    }
    updateHud();
    updateSkillButtons();
    saveGameState();
  }
  function updateSkillButtons() {
    const now = performance.now();
    skillTray.querySelectorAll(".skill-button").forEach(button => {
      const id = button.dataset.skill, skill = skillDefs.get(id);
      const remaining = state.skillReadyAt[id] - now;
      const cooldown = button.querySelector(".skill-cooldown");
      button.classList.toggle("cooling", remaining > 0);
      cooldown.textContent = remaining > 0
        ? remaining < 1000 ? `${(Math.ceil(remaining / 10) / 100).toFixed(2)}s` : fmtTime(remaining)
        : "";
      button.title = `${skill.name} · ${skill.cost} COIN · ${skillEffectText(skill)} · Hồi chiêu ${skill.cooldown} giây`;
      button.setAttribute("aria-label", `${skill.name}: ${skillEffectText(skill)}`);
      button.disabled = remaining > 0 || state.coins < skill.cost || state.gameOver;
    });
  }
  function updateHud() {
    $("coinValue").textContent = `COIN ${formatCoin(state.coins)}`;
    const towerPercent = Math.max(0, state.baseHp / cfg.baseHp * 100);
    $("baseValue").textContent = `TRỤ ${Math.ceil(towerPercent)}%`;
    $("towerHealth").style.width = `${towerPercent}%`;
    $("waveValue").textContent = `ĐỢT ${state.wave}`;
    const totalEnemyHp = state.enemies.reduce((total, enemy) => total + enemy.maxHp * 2, 0);
    const remainingEnemyHp = state.enemies.reduce((total, enemy) => {
      if (enemy.defeated) return total;
      return total + Math.max(0, enemy.hp) + (enemy.phase === 1 ? enemy.maxHp : 0);
    }, 0);
    const progress = totalEnemyHp > 0
      ? Math.min(100, Math.max(0, (1 - remainingEnemyHp / totalEnemyHp) * 100))
      : state.wave > 0 && !state.waveActive ? 100 : 0;
    $("levelProgressLabel").textContent = `LV ${state.wave} · ${Math.round(progress)}%`;
    $("levelProgress").setAttribute("aria-valuenow", String(Math.round(progress)));
    $("levelProgressFill").style.width = `${progress}%`;
    const damageProgress = totalEnemyHp > 0
      ? Math.min(100, Math.max(0, state.roundDamageDealt / totalEnemyHp * 100))
      : 0;
    $("damageProgressLabel").textContent =
      `SÁT THƯƠNG ${formatCoin(state.roundDamageDealt)} · ${Math.round(damageProgress)}%`;
    $("damageProgress").setAttribute("aria-valuenow", String(Math.round(damageProgress)));
    $("damageProgressFill").style.width = `${damageProgress}%`;
    $("upgradeOpen").disabled = state.gameOver;
    updateWaveButton();
  }
  function checkWaveClear(now = performance.now()) {
    if (!state.waveActive || state.enemies.some(enemy => !enemy.defeated)) return;
    state.waveActive = false;
    state.paused = false;
    state.baseHp = Math.min(cfg.baseHp, state.baseHp + cfg.baseHp * cfg.baseRecoveryPercent / 100);
    const damageReward = roundCoin(state.roundDamageDealt * cfg.waveDamageRewardRate);
    state.coins = roundCoin(state.coins + damageReward);
    state.bestWave = Math.max(state.bestWave, state.wave);
    try { localStorage.setItem("lastBloomBestWave", String(state.bestWave)); } catch (_) {}
    const attribute = cfg.randomMonsterScalingAttributes[Math.floor(Math.random() * cfg.randomMonsterScalingAttributes.length)];
    state.monsterBonusCounts[attribute] += 1;
    state.countdownUntil = now + cfg.roundCountdownSeconds * 1000;
    clearProjectiles();
    renderEnemies();
    updateHud();
    showMessage(`Hoàn thành đợt ${state.wave}! +${formatCoin(damageReward)} COIN (30% sát thương) · Căn cứ hồi ${cfg.baseRecoveryPercent}%`, 3800);
    setHint("Đợt tiếp theo tự bắt đầu sau 30 giây — nhấn SKIP để tiếp tục ngay");
    saveGameState();
  }
  function damageBase(amount) {
    state.baseHp = Math.max(0, state.baseHp - amount);
    updateHud();
    if (state.baseHp <= 0) {
      state.gameOver = true;
      state.waveActive = false;
      state.paused = false;
      state.countdownUntil = 0;
      updateWaveButton();
      showMessage("TRỤ ĐÃ BỊ PHÁ HỦY", 5000);
      setHint(`Kết thúc · Kỷ lục ${state.bestWave} đợt`);
    }
    saveGameState();
  }
  function flashDemonPhase() {
    clearTimeout(state.phaseFlashTimer);
    gameScreen.classList.remove("phase-flash");
    void gameScreen.offsetWidth;
    gameScreen.classList.add("phase-flash");
    state.phaseFlashTimer = setTimeout(
      () => gameScreen.classList.remove("phase-flash"),
      cfg.phaseFlashDurationSeconds * 1000
    );
  }
  function selectTarget(entity) {
    if (entity.kind === "enemy") {
      return state.units.filter(alive)
        .sort((a, b) => Math.abs(a.col - entity.lane) - Math.abs(b.col - entity.lane))[0];
    }
    const def = unitDefs.get(entity.type);
    return state.enemies.filter(enemy => alive(enemy) && Math.abs(enemy.lane - entity.col) <= def.range)
      .sort((a, b) => Math.abs(a.lane - entity.col) - Math.abs(b.lane - entity.col))[0];
  }
  function tick(now) {
    if (state.countdownUntil > 0 && now >= state.countdownUntil && !state.gameOver) {
      spawnWave();
      state.lastTick = now;
      return;
    }
    if (state.gameOver || !state.waveActive || state.paused) {
      state.lastTick = now;
      return;
    }
    state.lastTick = now;
    if (state.projectiles.length) processProjectiles(now);
    if (state.delayedEffects.length) processDelayedEffects(now);
    let unitsChanged = false, enemiesChanged = false;
    let statusesChanged = false;
    [...state.units, ...state.enemies].forEach(entity => {
      const before = entity.effects.length;
      activeEffects(entity, now);
      if (entity.effects.length !== before) statusesChanged = true;
    });
    for (const unit of state.units) {
      if (!alive(unit) || isStunned(unit, now)) continue;
      if (now >= unit.nextHealAt) {
        healEntity(unit, unit.rc, now);
        unit.nextHealAt = now + 5000;
        unitsChanged = true;
      }
      if (now >= unit.nextAttackAt) {
        const target = selectTarget(unit);
        if (target) {
          const def = unitDefs.get(unit.type);
          const special = unit.specialDamage > 0 && now >= unit.nextSpecialAt;
          const baseDamage = special ? unit.specialDamage : damageAmount(unit, target, 0, 1, now);
          const options = skillDamageOptions(unit, now);
          const damage = special ? baseDamage : damageAmount(unit, target, options.penetration, options.criticalMultiplier, now);
          const skill = options.activeSkill;
          const attackAsset = special ? def.ultimateAsset : def.normalAsset;
          const skillAttackAsset = skill => skill && !special && def.skillNAsset ? def.skillNAsset : attackAsset;
          createProjectile(unit, target, damage, skill || null, now, skillAttackAsset(skill), special);
          if (skill && skill.cooldown > 0) unit.skillReadyAt[skill.id] = now + skill.cooldown * 1000;
          tryDeploySkill(unit, now);
          if (special) unit.nextSpecialAt = now + def.specialInterval * 1000;
          unit.nextAttackAt = now + attackInterval(unit, now);
        }
      }
    }
    for (const enemy of state.enemies) {
      if (!alive(enemy) || isStunned(enemy, now)) continue;
      if (now >= enemy.nextHealAt) {
        healEntity(enemy, enemy.rc, now);
        enemy.nextHealAt = now + 5000;
        enemiesChanged = true;
      }
      if (now >= enemy.nextAttackAt) {
        const target = selectTarget(enemy);
        const monster = monsterDefs.get(enemy.type);
        const special = enemy.specialDamage > 0 && now >= enemy.nextSpecialAt;
        const attack = { ...enemy, atk: special ? enemy.specialDamage : enemy.atk };
        const damage = target ? damageAmount(attack, target, 0, 1, now) : displayedStat(attack, "atk", now) * 0.8;
        const attackAsset = special ? monster.ultimateAsset : monster.normalAsset;
        if (target) {
          const skill = enemy.skillIds.map(id => effectDefs.get(id))
            .find(definition => definition && definition.deployment === "PROJECTILE" &&
              (enemy.skillReadyAt[definition.id] || 0) <= now && Math.random() < definition.chance);
          const options = skill ? { penetration: skill.effect === "ARMOR_PENETRATION" ? skill.value : 0,
            criticalMultiplier: skill.effect === "CRITICAL" ? (skill.multiplier || skill.value) / 100 : 1 } :
            { penetration: 0, criticalMultiplier: 1 };
          const actualDamage = damageAmount(attack, target, options.penetration, options.criticalMultiplier, now);
          const skillAttackAsset = skill && !special && monster.skillNAsset ? monster.skillNAsset : attackAsset;
          createProjectile(enemy, target, actualDamage, skill || null, now, skillAttackAsset, special);
          if (skill && skill.cooldown > 0) enemy.skillReadyAt[skill.id] = now + skill.cooldown * 1000;
        } else {
          const baseTarget = { kind: "base", lane: enemy.lane };
          createProjectile(enemy, baseTarget, damage, null, now, attackAsset, special);
        }
        if (special) enemy.nextSpecialAt = now + enemy.specialInterval * 1000;
        enemy.nextAttackAt = now + attackInterval(enemy, now);
      }
    }
    state.units = state.units.filter(alive);
    if (unitsChanged || statusesChanged) renderUnits();
    if (enemiesChanged || unitsChanged || statusesChanged ||
        state.enemies.some(enemy => !enemy.defeated && !alive(enemy))) renderEnemies();
    checkWaveClear(now);
    updateSkillButtons();
  }

  function openUpgrade() {
    if (state.gameOver) return;
    if (upgradeOverlay.hidden) {
      state.upgradeWasRunning = state.waveActive && !state.paused;
      if (state.upgradeWasRunning) state.paused = true;
    }
    const level = state.humanUpgradeLevel;
    const nextCost = upgradeCostForLevel(level);
    const totalIncrease = (Math.pow(1 + cfg.humanStatIncreasePerLevel, level) - 1) * 100;
    $("upgradeCharacter").textContent =
      `Cấp UP ${level} · Toàn phe HUMAN tăng ${totalIncrease.toFixed(2)}% chỉ số`;
    $("upgradeCost").textContent =
      `Lần tiếp theo: ${formatCoin(nextCost)} COIN · Tổng đã chi: ${formatCoin(cumulativeUpgradeCost(level))} COIN`;
    $("upgradeApply").disabled = state.coins < nextCost;
    $("upgradeError").textContent = "";
    renderSkillUpgrades();
    upgradeOverlay.hidden = false;
    updateWaveButton();
    saveGameState();
    $("upgradeClose").focus();
  }
  function closeUpgrade() {
    if (state.upgradeWasRunning && state.waveActive && !state.gameOver) state.paused = false;
    state.upgradeWasRunning = false;
    upgradeOverlay.hidden = true;
    updateWaveButton();
    saveGameState();
  }
  function renderSkillUpgrades() {
    const list = $("skillUpgradeList");
    list.innerHTML = "";
    ["heal", "burst", "freeze"].forEach(id => {
      const skill = skillDefs.get(id);
      if (!skill) return;
      const level = state.skillUpgradeLevels[id] || 0;
      const cost = upgradeCostForLevel(level);
      const row = document.createElement("div");
      row.className = "skill-upgrade-row";
      const info = document.createElement("div");
      info.className = "skill-upgrade-info";
      const title = document.createElement("strong");
      title.textContent = skill.name;
      const effect = document.createElement("span");
      const totalIncrease = (Math.pow(cfg.skillUpgradeEffectMultiplier, level) - 1) * 100;
      effect.textContent =
        `Cấp ${level} · Hiệu lực +${totalIncrease.toFixed(2)}% · Giá trị ${formatCoin(skillValue(skill))}`;
      const spent = document.createElement("span");
      spent.textContent =
        `Lần tới: ${formatCoin(cost)} COIN · Tổng đã chi: ${formatCoin(cumulativeUpgradeCost(level))} COIN`;
      info.append(title, effect, spent);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mod-apply";
      button.textContent = "UPGRADE";
      button.disabled = state.gameOver || state.coins < cost;
      button.addEventListener("click", () => applySkillUpgrade(id));
      row.append(info, button);
      list.appendChild(row);
    });
  }
  function applyHumanUpgrade() {
    if (state.gameOver || state.humanUpgradeLevel >= 1000) return;
    const cost = upgradeCostForLevel(state.humanUpgradeLevel);
    if (state.coins < cost) {
      $("upgradeError").textContent = "Không đủ COIN để nâng cấp.";
      return;
    }
    const multiplier = 1 + cfg.humanStatIncreasePerLevel;
    state.coins = roundCoin(state.coins - cost);
    state.humanUpgradeTotalSpent = roundCoin(state.humanUpgradeTotalSpent + cost);
    state.humanUpgradeLevel += 1;
    state.units.forEach(unit => {
      unit.hp = Math.min(unit.maxHp * multiplier, unit.hp * multiplier);
      unit.maxHp *= multiplier;
      ["atk", "sa", "rc", "def", "specialDamage"].forEach(stat => { unit[stat] *= multiplier; });
    });
    renderUnits();
    updateHud();
    openUpgrade();
    saveGameState();
    showMessage(`Toàn phe HUMAN đã nâng lên UP ${state.humanUpgradeLevel}`);
  }
  function applySkillUpgrade(id) {
    if (state.gameOver || !Object.prototype.hasOwnProperty.call(state.skillUpgradeLevels, id)) return;
    const level = state.skillUpgradeLevels[id];
    if (level >= 1000) return;
    const cost = upgradeCostForLevel(level);
    if (state.coins < cost) {
      $("upgradeError").textContent = "Không đủ COIN để nâng cấp kỹ năng.";
      return;
    }
    state.coins = roundCoin(state.coins - cost);
    state.skillUpgradeSpent[id] = roundCoin(state.skillUpgradeSpent[id] + cost);
    state.skillUpgradeLevels[id] += 1;
    $("upgradeError").textContent = "";
    updateHud();
    updateSkillButtons();
    renderSkillUpgrades();
    saveGameState();
    showMessage(`${skillDefs.get(id).name} đã tăng hiệu lực 1,37%`);
  }

  function resetGame() {
    try { localStorage.removeItem(gameStorageKeyForSlot(activeSaveSlotId)); }
    catch (error) { console.error("Không thể xóa tiến trình trận cũ.", error); }
    state.coins = cfg.coinStart;
    state.baseHp = cfg.baseHp;
    state.wave = 0;
    state.selected = null;
    state.units = [];
    state.enemies = [];
    clearProjectiles();
    state.delayedEffects = [];
    state.waveActive = false;
    state.paused = false;
    state.gameOver = false;
    state.countdownUntil = 0;
    state.nextUnitId = 1;
    state.nextEnemyId = 1;
    state.monsterBonusCounts = Object.fromEntries(cfg.randomMonsterScalingAttributes.map(key => [key, 0]));
    state.humanUpgradeLevel = 0;
    state.humanUpgradeTotalSpent = 0;
    state.skillUpgradeLevels = { heal: 0, burst: 0, freeze: 0 };
    state.skillUpgradeSpent = { heal: 0, burst: 0, freeze: 0 };
    state.roundDamageDealt = 0;
    cfg.skills.forEach(skill => { state.skillReadyAt[skill.id] = 0; });
    road.innerHTML = "";
    effectsLayer.innerHTML = "";
    renderUnits();
    renderEnemies();
    updateHud();
    updateSkillButtons();
    renderSelection();
    showMessage("Sân đã được đặt lại");
    saveGameState();
  }

  waveButton.addEventListener("click", handleWaveButton);
  skipButton.addEventListener("click", () => {
    if (state.countdownUntil > 0 && !state.gameOver) spawnWave();
  });
  modToggle.addEventListener("click", () => setModOpen(true));
  fullscreenToggle.addEventListener("click", toggleFullscreen);
  document.addEventListener("fullscreenchange", updateFullscreenToggle);
  $("modClose").addEventListener("click", () => setModOpen(false));
  modOverlay.addEventListener("click", event => { if (event.target === modOverlay) setModOpen(false); });
  modForm.addEventListener("submit", submitModForm);
  $("modReset").addEventListener("click", resetModSettings);
  $("saveSlotSelect").addEventListener("change", event => changeSaveSlot(event.target.value));
  $("saveBackupCreate").addEventListener("click", createSaveBackup);
  $("saveBackupRestore").addEventListener("click", restoreSaveBackup);
  $("saveExport").addEventListener("click", exportSaveJson);
  $("saveImportButton").addEventListener("click", () => $("saveImportFile").click());
  $("saveImportFile").addEventListener("change", event => {
    const file = event.target.files && event.target.files[0];
    if (file) importSaveJson(file);
  });
  $("saveClearAll").addEventListener("click", clearAllLocalGameData);
  idleAnimationFrequencyInput.addEventListener("input", () => {
    const frequency = Number(idleAnimationFrequencyInput.value);
    applyIdleAnimationFrequency(frequency);
    try {
      localStorage.setItem(idleAnimationStorageKey, String(frequency));
      idleAnimationStatus.textContent = "Đã lưu tự động.";
    } catch (error) {
      console.warn("Không thể lưu tần suất nhấp nhô.", error);
      idleAnimationStatus.textContent = "Không thể lưu cài đặt; thay đổi chỉ có hiệu lực trong phiên này.";
    }
  });
  uiTextSizeInput.addEventListener("input", () => {
    const size = Number(uiTextSizeInput.value);
    applyUiTextSize(size);
    try {
      localStorage.setItem(uiTextSizeStorageKey, String(size));
      uiTextSizeStatus.textContent = "Đã lưu tự động.";
    } catch (error) {
      console.warn("Không thể lưu cỡ chữ giao diện.", error);
      uiTextSizeStatus.textContent = "Không thể lưu; cỡ chữ chỉ có hiệu lực trong phiên này.";
    }
  });
  $("upgradeClose").addEventListener("click", closeUpgrade);
  $("upgradeOpen").addEventListener("click", openUpgrade);
  $("upgradeApply").addEventListener("click", applyHumanUpgrade);
  upgradeOverlay.addEventListener("click", event => { if (event.target === upgradeOverlay) closeUpgrade(); });
  buildModForm();
  renderCards();
  renderSkills();
  renderSelection();
  updateHud();
  updateSkillButtons();
  renderUnits();
  renderEnemies();
  saveGameState();
  updateSaveManagement();
  setInterval(() => tick(performance.now()), 100);
  setInterval(saveGameState, 1000);
  setInterval(() => {
    updateHud();
    updateSkillButtons();
  }, 250);
  window.addEventListener("keydown", event => {
    if (event.repeat) return;
    if (!modOverlay.hidden || !upgradeOverlay.hidden) {
      if (event.key === "Escape") {
        if (!upgradeOverlay.hidden) closeUpgrade();
        else setModOpen(false);
      }
      return;
    }
    const number = Number(event.key);
    if (number >= 1 && number <= 4) useSkill(cfg.skills[number - 1].id);
    if (event.key === " " && !event.target.closest("button")) {
      event.preventDefault();
      handleWaveButton();
    }
    if (event.key === "Escape") {
      state.selected = null;
      renderSelection();
    }
  });
})();
