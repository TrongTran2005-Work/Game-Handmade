(() => {
  "use strict";
  const cfg = window.LAST_BLOOM_CONFIG;
  const $ = id => document.getElementById(id);
  const gameScreen = $("gameScreen");
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
  const modOverlay = $("modOverlay");
  const modForm = $("modForm");
  const modGlobalFields = $("modGlobalFields");
  const modSkillFields = $("modSkillFields");
  const modEffectFields = $("modEffectFields");
  const modError = $("modError");
  const upgradeOverlay = $("upgradeOverlay");

  document.documentElement.style.setProperty("--grid-width", `${cfg.gridWidth}%`);
  document.documentElement.style.setProperty("--grid-height", `${cfg.gridHeight}%`);
  document.documentElement.style.setProperty("--grid-columns", cfg.columns);
  document.documentElement.style.setProperty("--grid-rows", cfg.rows);
  document.documentElement.style.setProperty("--road-height", `${cfg.roadHeight}%`);
  document.documentElement.style.setProperty("--grid-top", `${cfg.gridTop}%`);

  const unitDefs = new Map(cfg.unitTypes.map(unit => [unit.id, unit]));
  const monsterDefs = new Map(cfg.monsters.map(monster => [monster.id, monster]));
  const skillDefs = new Map(cfg.skills.map(skill => [skill.id, skill]));
  const effectDefs = new Map(cfg.effects.map(effect => [effect.id, effect]));
  const modStorageKey = "lastBloomModSettings";
  const upgradeMultipliers = { hp: 1.1, atk: 1.06, def: 1.08, sa: 1.1, rc: 1.1 };

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
  function isValidModSettings(settings) {
    const values = settings && [settings.coinStart, settings.baseHp];
    if (!values || !values.every(value => Number.isFinite(value) && value >= 0 && value <= 1000000) || settings.baseHp === 0) return false;
    return cfg.skills.every(skill => {
      const current = settings.skills && settings.skills[skill.id];
      return current && [current.cost, current.cooldown, current.value]
        .every(value => Number.isFinite(value) && value >= 0 && value <= 1000000);
    }) && cfg.effects.every(effect => {
      const current = settings.effects && settings.effects[effect.id];
      const values = current && [current.value, current.duration, current.cooldown, current.chance];
      return values && values.every(value => Number.isFinite(value) && value >= 0 && value <= 1000000) &&
        current.chance <= 1 && (!Number.isFinite(effect.multiplier) ||
          Number.isFinite(current.multiplier) && current.multiplier >= 0 && current.multiplier <= 1000000);
    });
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
      if (!isValidModSettings(parsedSettings)) throw new Error("Dữ liệu menu mod không hợp lệ.");
      applyModSettings(parsedSettings);
    }
  } catch (error) {
    console.warn("Không thể tải thông số menu mod đã lưu.", error);
  }

  const state = {
    coins: cfg.coinStart, baseHp: cfg.baseHp, wave: 0, bestWave: 0,
    selected: null, units: [], enemies: [], projectiles: [], delayedEffects: [], waveActive: false,
    paused: false, gameOver: false, countdownUntil: 0, nextUnitId: 1,
    nextEnemyId: 1, lastTick: performance.now(), messageTimer: null,
    skillReadyAt: {}, monsterBonusCounts: Object.fromEntries(cfg.randomMonsterScalingAttributes.map(key => [key, 0])),
    upgradeTarget: null, modWasRunning: false
  };
  cfg.skills.forEach(skill => { state.skillReadyAt[skill.id] = 0; });
  try { state.bestWave = Number(localStorage.getItem("lastBloomBestWave") || 0); } catch (_) {}

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
    if (enemy.rewarded || enemy.hp > 0) return;
    enemy.rewarded = true;
    state.coins += enemy.coinReward;
  }
  function damageEntity(attacker, target, rawDamage, now = performance.now(), armorPenetration = 0, criticalMultiplier = 1) {
    if (!alive(attacker) || !alive(target)) return 0;
    const damage = Math.max(1, rawDamage || damageAmount(attacker, target, armorPenetration, criticalMultiplier, now));
    target.hp = Math.max(0, target.hp - damage);
    if (target.kind === "enemy") awardKill(target);
    return damage;
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
    if (entity.kind === "base") return { x: cellCenterX(entity.lane), y: 97 };
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
  function canPlace(col, row) {
    return col >= 0 && col < cfg.columns && row >= 0 && row + 1 < cfg.rows && !occupied(col, row);
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
    if (skill.id === "heal") return `Hồi ${skill.value} HP cho tất cả tướng`;
    if (skill.id === "burst") return `Gây ${skill.value} sát thương lên mọi quái`;
    if (skill.id === "freeze") return `Choáng quái trong ${skill.value} giây`;
    return `Nhận thêm ${skill.value} COIN`;
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
    input.step = property === "cooldown" || property === "value" ? "0.1" : "1";
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
      ["Máu căn cứ tối đa", cfg.baseHp, "baseHp"],
      ["Máu căn cứ hiện tại", state.baseHp, "currentBaseHp"]
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
      modError.textContent = "Giá trị không hợp lệ. COIN và thông số kỹ năng phải từ 0 trở lên; máu căn cứ hiện tại không vượt mức tối đa.";
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
    else if (!state.gameOver) setHint(state.waveActive ? "Chọn UPGRADE trên tướng để nâng thuộc tính" : "Chọn tướng rồi chọn ô trên sân");
  }
  function placeSelected(col, row) {
    if (!state.selected || state.gameOver) return;
    const def = unitDefs.get(state.selected);
    if (state.coins < def.cost) { showMessage("Không đủ COIN"); return; }
    if (row + 1 >= cfg.rows) { showMessage("Tướng cần đúng 2 ô theo chiều dọc"); return; }
    if (!canPlace(col, row)) { showMessage("Vị trí này đã có tướng hoặc không hợp lệ"); return; }
    state.coins -= def.cost;
    const now = performance.now();
    state.units.push({
      kind: "unit", uid: state.nextUnitId++, type: def.id, col, row,
      hp: def.hp, maxHp: def.hp, atk: def.atk, sa: def.sa, rc: def.rc, def: def.def,
      skillIds: def.skillIds.slice(), skillReadyAt: {}, effects: [],
      nextAttackAt: now + 650, nextHealAt: now + 5000,
      nextSpecialAt: now + (def.specialInterval || 0) * 1000,
      specialDamage: def.specialDamage || 0, upgrades: 0
    });
    renderUnits();
    updateHud();
    renderSelection();
    showMessage(`${def.name} đã được bố trí`);
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
      const upgrade = document.createElement("button");
      upgrade.type = "button";
      upgrade.className = "unit-upgrade";
      upgrade.textContent = "UP";
      upgrade.title = `Nâng cấp ${def.name}`;
      upgrade.setAttribute("aria-label", `UPGRADE ${def.name}`);
      upgrade.addEventListener("click", event => {
        event.stopPropagation();
        openUpgrade(unit.uid);
      });
      el.append(img, bar, upgrade);
      renderEffects(unit, el);
      unitsLayer.appendChild(el);
    });
  }
  function renderEnemies() {
    road.innerHTML = "";
    state.enemies.filter(alive).forEach(enemy => {
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
      const bar = document.createElement("span");
      bar.className = "enemy-health";
      const fill = document.createElement("i");
      fill.style.width = `${Math.max(0, enemy.hp / enemy.maxHp * 100)}%`;
      bar.appendChild(fill);
      el.append(img, bar);
      renderEffects(enemy, el);
      road.appendChild(el);
    });
  }

  function weightedMonster() {
    const roll = Math.random();
    let total = 0;
    for (const monster of cfg.monsters) {
      total += monster.spawnChance;
      if (roll < total) return monster;
    }
    return cfg.monsters[cfg.monsters.length - 1];
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
    clearProjectiles();
    const now = performance.now();
    const laneOrder = [2, 4, 6, 8, 10, 1, 3, 5, 7, 9, 11, 0, 5, 7, 3];
    const chosen = [];
    cfg.monsters.forEach(monster => {
      if (Math.random() < monster.spawnChance) {
        const count = monster.spawnMin + Math.floor(Math.random() * (monster.spawnMax - monster.spawnMin + 1));
        for (let i = 0; i < count; i++) chosen.push(monster);
      }
    });
    if (!chosen.length) {
      const monster = weightedMonster();
      const count = monster.spawnMin + Math.floor(Math.random() * (monster.spawnMax - monster.spawnMin + 1));
      for (let i = 0; i < count; i++) chosen.push(monster);
    }
    chosen.slice(0, cfg.maxEnemiesOnMap).forEach((monster, index) => {
      const extraCount = state.monsterBonusCounts;
      const common = Math.pow(1.1, state.wave - 1);
      const scaled = attr => monster[attr] *
        (attr === "atk" || attr === "def" ? common : 1) *
        Math.pow(1.1, extraCount[attr] || 0);
      const hp = scaled("hp");
      state.enemies.push({
        kind: "enemy", eid: state.nextEnemyId++, type: monster.id,
        lane: laneOrder[(index + (state.wave - 1) * 2) % laneOrder.length],
        hp, maxHp: hp, atk: scaled("atk"), sa: scaled("sa"), rc: scaled("rc"), def: scaled("def"),
        coinReward: monster.coinReward, skillIds: monster.skills.slice(), skillReadyAt: {}, effects: [],
        nextHealAt: now + 5000, nextAttackAt: now + 1800 + (index % 3) * 350,
        nextSpecialAt: now + (monster.ultimateInterval || 0) * 1000, specialDamage: monster.ultimateDamage || 0,
        specialInterval: monster.ultimateInterval || 0,
        top: 5 + (index % 2) * 8, height: 66
      });
    });
    renderEnemies();
    updateHud();
    updateWaveButton();
    showMessage(`ĐỢT ${state.wave} — ${state.enemies.length} quái đã xuất hiện`, 2500);
    setHint("Tướng và quái chiến đấu theo chỉ số ATK, SA, DEF và kỹ năng");
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
  function createProjectile(owner, target, damage, definition, now, asset, special, applyDamage = true) {
    const start = pointFor(owner), end = pointFor(target);
    const distance = Math.hypot(
      (end.x - start.x) * gameScreen.clientWidth / 100,
      (end.y - start.y) * gameScreen.clientHeight / 100
    );
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
      duration: Math.max(280, distance /
        Math.max(100, definition && definition.speed ? definition.speed : 420) * 1000)
    };
    state.projectiles.push(projectile);
    projectile.frameId = requestAnimationFrame(frameTime => updateProjectile(projectile, frameTime));
  }
  function updateProjectile(projectile, frameTime) {
    if (!state.projectiles.includes(projectile)) return;
    if (state.gameOver) {
      projectile.element.remove();
      state.projectiles = state.projectiles.filter(item => item !== projectile);
      return;
    }
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
    state.coins -= skill.cost;
    state.skillReadyAt[id] = now + skill.cooldown * 1000;
    if (id === "heal") {
      state.units.forEach(unit => healEntity(unit, skill.value, now));
      renderUnits();
      showMessage(`Hồi phục: tất cả tướng nhận tối đa ${skill.value} HP`);
    } else if (id === "burst") {
      state.enemies.forEach(enemy => damageEntity({ ...enemy, atk: skill.value, kind: "enemy" }, enemy, skill.value, now));
      renderEnemies();
      showMessage(`Bộc phá: gây ${skill.value} sát thương lên mọi quái`);
      checkWaveClear(now);
    } else if (id === "freeze") {
      state.enemies.forEach(enemy => applyStatus(enemy, "STUN", 1, skill.value, now));
      renderEnemies();
      showMessage(`Quái bị choáng trong ${skill.value} giây`);
    } else if (id === "coin") {
      state.coins += skill.value;
      showMessage(`Tiếp tế: nhận thêm ${skill.value} COIN`);
    }
    updateHud();
    updateSkillButtons();
  }
  function updateSkillButtons() {
    const now = performance.now();
    skillTray.querySelectorAll(".skill-button").forEach(button => {
      const id = button.dataset.skill, skill = skillDefs.get(id);
      const remaining = state.skillReadyAt[id] - now;
      const cooldown = button.querySelector(".skill-cooldown");
      button.classList.toggle("cooling", remaining > 0);
      cooldown.textContent = remaining > 0 ? fmtTime(remaining) : "";
      button.title = `${skill.name} · ${skill.cost} COIN · ${skillEffectText(skill)} · Hồi chiêu ${skill.cooldown} giây`;
      button.setAttribute("aria-label", `${skill.name}: ${skillEffectText(skill)}`);
      button.disabled = remaining > 0 || state.coins < skill.cost || state.gameOver;
    });
  }
  function updateHud() {
    $("coinValue").textContent = `COIN ${Math.floor(state.coins)}`;
    $("baseValue").textContent = `CĂN CỨ ${Math.ceil(state.baseHp / cfg.baseHp * 100)}%`;
    $("waveValue").textContent = `ĐỢT ${state.wave}`;
    updateWaveButton();
  }
  function checkWaveClear(now = performance.now()) {
    if (!state.waveActive || state.enemies.some(alive)) return;
    state.waveActive = false;
    state.paused = false;
    state.baseHp = Math.min(cfg.baseHp, state.baseHp + cfg.baseHp * cfg.baseRecoveryPercent / 100);
    state.coins += cfg.coinPerRound;
    state.bestWave = Math.max(state.bestWave, state.wave);
    try { localStorage.setItem("lastBloomBestWave", String(state.bestWave)); } catch (_) {}
    const attribute = cfg.randomMonsterScalingAttributes[Math.floor(Math.random() * cfg.randomMonsterScalingAttributes.length)];
    state.monsterBonusCounts[attribute] += 1;
    state.countdownUntil = now + cfg.roundCountdownSeconds * 1000;
    clearProjectiles();
    renderEnemies();
    updateHud();
    showMessage(`Hoàn thành đợt ${state.wave}! +${cfg.coinPerRound} COIN · Căn cứ hồi ${cfg.baseRecoveryPercent}%`, 3200);
    setHint("Đợt tiếp theo tự bắt đầu sau 30 giây — nhấn SKIP để tiếp tục ngay");
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
      showMessage("CĂN CỨ ĐÃ THẤT THỦ", 5000);
      setHint(`Kết thúc · Kỷ lục ${state.bestWave} đợt`);
    }
  }
  function selectTarget(entity) {
    if (entity.kind === "enemy") {
      return state.units.filter(unit => alive(unit) && Math.abs(unit.col - entity.lane) <= (unitDefs.get(unit.type).range || 4))
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
          createProjectile(unit, target, damage, skill || null, now, attackAsset, special);
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
          createProjectile(enemy, target, actualDamage, skill || null, now, attackAsset, special);
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
    if (enemiesChanged || unitsChanged || statusesChanged || state.enemies.some(enemy => !alive(enemy))) renderEnemies();
    checkWaveClear(now);
    updateSkillButtons();
  }

  function unitUpgradeCost(unit) {
    return cfg.upgradeCost + unit.upgrades * cfg.upgradeCostStep;
  }
  function openUpgrade(uid) {
    const unit = state.units.find(item => item.uid === uid);
    if (!unit || state.gameOver) return;
    state.upgradeTarget = uid;
    const def = unitDefs.get(unit.type);
    $("upgradeCharacter").textContent = `${def.name} · HP ${Math.ceil(unit.hp)}/${Math.ceil(unit.maxHp)} · ATK ${Math.ceil(unit.atk)} · DEF ${Math.ceil(unit.def)}`;
    $("upgradeCost").textContent = `Chi phí: ${unitUpgradeCost(unit)} COIN`;
    $("upgradeError").textContent = "";
    upgradeOverlay.hidden = false;
    $("upgradeClose").focus();
  }
  function closeUpgrade() {
    upgradeOverlay.hidden = true;
    state.upgradeTarget = null;
  }
  function applyUpgrade() {
    const unit = state.units.find(item => item.uid === state.upgradeTarget);
    if (!unit) { closeUpgrade(); return; }
    const cost = unitUpgradeCost(unit);
    if (state.coins < cost) {
      $("upgradeError").textContent = "Không đủ COIN để nâng cấp.";
      return;
    }
    const stat = $("upgradeAttribute").value;
    const multiplier = upgradeMultipliers[stat];
    if (!multiplier) return;
    state.coins -= cost;
    if (stat === "hp") {
      const previousMax = unit.maxHp;
      unit.maxHp *= multiplier;
      unit.hp = Math.min(unit.maxHp, unit.hp + (unit.maxHp - previousMax));
    } else unit[stat] *= multiplier;
    unit.upgrades += 1;
    renderUnits();
    updateHud();
    openUpgrade(unit.uid);
    showMessage(`${unitDefs.get(unit.type).name} đã nâng cấp ${stat.toUpperCase()}`);
  }

  function resetGame() {
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
    cfg.skills.forEach(skill => { state.skillReadyAt[skill.id] = 0; });
    road.innerHTML = "";
    effectsLayer.innerHTML = "";
    renderUnits();
    updateHud();
    updateSkillButtons();
    renderSelection();
    showMessage("Sân đã được đặt lại");
  }

  waveButton.addEventListener("click", handleWaveButton);
  skipButton.addEventListener("click", () => {
    if (state.countdownUntil > 0 && !state.gameOver) spawnWave();
  });
  modToggle.addEventListener("click", () => setModOpen(true));
  $("modClose").addEventListener("click", () => setModOpen(false));
  modOverlay.addEventListener("click", event => { if (event.target === modOverlay) setModOpen(false); });
  modForm.addEventListener("submit", submitModForm);
  $("modReset").addEventListener("click", resetModSettings);
  $("upgradeClose").addEventListener("click", closeUpgrade);
  $("upgradeApply").addEventListener("click", applyUpgrade);
  upgradeOverlay.addEventListener("click", event => { if (event.target === upgradeOverlay) closeUpgrade(); });
  buildModForm();
  renderCards();
  renderSkills();
  renderSelection();
  updateHud();
  updateSkillButtons();
  renderUnits();
  setInterval(() => tick(performance.now()), 100);
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
