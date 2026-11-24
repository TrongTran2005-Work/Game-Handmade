(() => {
  "use strict";
  const cfg = window.LAST_BLOOM_CONFIG;
  const storageKey = "lastBloomManagedGameDataV1";
  const maxNumber = 1000000;
  const supportedEffects = [
    "STUN", "LIFESTEAL", "ARMOR_REDUCTION", "HEALING_REDUCTION", "SLOW", "TEAM_HEAL",
    "CRITICAL", "ARMOR_PENETRATION", "SLOW_RESISTANCE", "CLR", "RATK", "RDEF"
  ];
  const imageFields = [
    ["asset", "Ảnh đại diện"],
    ["normalAsset", "Ảnh đánh thường"],
    ["skillNAsset", "Ảnh kỹ năng N"],
    ["ultimateAsset", "Ảnh kỹ năng U"]
  ];
  const numericFields = {
    characters: [
      ["hp", "HP", 1], ["atk", "ATK", 0], ["sa", "SA (đòn/giây)", 0.01],
      ["rc", "RC (hồi HP)", 0], ["def", "DEF", 0], ["cost", "COIN", 0],
      ["range", "Tầm đánh", 0], ["specialDamage", "Sát thương kỹ năng U", 0],
      ["specialInterval", "Hồi chiêu U (giây)", 0], ["additionalValue", "Thông số bổ sung", 0]
    ],
    monsters: [
      ["hp", "HP", 1], ["atk", "ATK", 0], ["sa", "SA (đòn/giây)", 0.01],
      ["rc", "RC (hồi HP)", 0], ["def", "DEF", 0], ["coinReward", "COIN thưởng", 0],
      ["ultimateDamage", "Sát thương kỹ năng U", 0], ["ultimateInterval", "Hồi chiêu U (giây)", 0],
      ["spawnChancePercent", "SPAWN_CHANCE (%)", 0], ["spawnMin", "SPAWN_QUANTITY tối thiểu", 1],
      ["spawnMax", "SPAWN_QUANTITY tối đa", 1]
    ]
  };
  const safeAsset = value => typeof value === "string" && value.length > 0 && value.length <= 450000 &&
    !/^\s*javascript:/i.test(value) &&
    (/^data:image\/(?:png|jpeg|webp|gif|svg\+xml);base64,[a-z0-9+/=]+$/i.test(value) ||
      /^(?!\s)(?!.*\s$)(?!\/\/)[\w./%#?&=:+-]+$/.test(value));
  const clone = value => JSON.parse(JSON.stringify(value));
  const baseConfig = clone(cfg);
  const byId = items => new Map(items.map(item => [item.id, item]));
  const emptyCategory = () => ({ custom: [], overrides: {}, removed: [] });
  const emptyStore = () => ({
    version: 1, characters: emptyCategory(), monsters: emptyCategory(),
    skills: emptyCategory(), mods: []
  });
  const cleanId = value => typeof value === "string" && /^[A-Z0-9_-]{1,32}$/.test(value);
  const validNumber = (value, min = 0, max = maxNumber) =>
    Number.isFinite(value) && value >= min && value <= max;
  let store = emptyStore();
  let loadError = "";
  let savedChanges = false;
  let currentCategory = "characters";
  let editingId = null;
  let editingModId = null;

  function validatePatch(patch, config) {
    const scopes = {
      resources: ["coinStart", "baseHp", "baseRecoveryPercent", "roundCountdownSeconds",
        "maxEnemiesOnMap", "upgradeCost", "upgradeCostStep", "coinPerRound"],
      characters: ["hp", "atk", "sa", "rc", "def", "cost", "specialDamage", "specialInterval", "range"],
      monsters: ["hp", "atk", "sa", "rc", "def", "ultimateDamage", "ultimateInterval", "spawnChance",
        "spawnMin", "spawnMax", "coinReward"],
      skills: ["value", "duration", "cooldown", "chance", "multiplier", "speed", "size", "radius", "delay"]
    };
    if (!patch || typeof patch !== "object" || Array.isArray(patch) ||
        Object.keys(patch).some(key => !Object.prototype.hasOwnProperty.call(scopes, key))) {
      throw new Error("Mod chỉ được chứa resources, characters, monsters hoặc skills.");
    }
    Object.keys(patch).forEach(scope => {
      const entries = patch[scope];
      if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
        throw new Error(`Phần ${scope} phải là một đối tượng JSON.`);
      }
      if (scope === "resources") {
        Object.keys(entries).forEach(key => {
          if (!scopes.resources.includes(key) || !validNumber(entries[key]) ||
              key === "baseHp" && entries[key] < 1 ||
              key === "baseRecoveryPercent" && entries[key] > 100 ||
              key === "roundCountdownSeconds" && entries[key] < 1 ||
              key === "maxEnemiesOnMap" && entries[key] < 1) {
            throw new Error(`Thông số resources.${key} không hợp lệ.`);
          }
        });
        return;
      }
      const collection = scope === "characters" ? config.unitTypes :
        scope === "monsters" ? config.monsters : config.effects;
      Object.keys(entries).forEach(id => {
        const values = entries[id];
        if (!cleanId(id) || !collection.some(item => item.id === id) ||
            !values || typeof values !== "object" || Array.isArray(values)) {
          throw new Error(`Không tìm thấy mục ${scope}.${id}.`);
        }
        Object.keys(values).forEach(key => {
          const value = values[key];
          if (!scopes[scope].includes(key) || !validNumber(value) ||
              key === "sa" && value < 0.01 ||
              key === "hp" && value < 1 ||
              key === "range" && value > config.columns ||
              key === "spawnChance" && value > 1 ||
              key === "chance" && value > 1 ||
              ["spawnMin", "spawnMax"].includes(key) && (!Number.isInteger(value) || value < 1) ||
              key === "baseRecoveryPercent" && value > 100) {
            throw new Error(`Thông số ${scope}.${id}.${key} không hợp lệ.`);
          }
        });
        const merged = Object.assign({}, collection.find(item => item.id === id), values);
        if (scope === "monsters" && merged.spawnMin > merged.spawnMax) {
          throw new Error(`spawnMin không thể lớn hơn spawnMax tại ${id}.`);
        }
      });
    });
    return true;
  }

  function applyCategory(baseItems, category, kind) {
    const removed = new Set(category.removed);
    const overrides = category.overrides;
    const result = baseItems.filter(item => !removed.has(item.id)).map(item => {
      const merged = Object.assign({}, item, overrides[item.id] || {});
      if ((kind === "characters" || kind === "monsters") && !merged.skillNAsset) {
        merged.skillNAsset = merged.normalAsset;
      }
      return merged;
    });
    const ids = new Set(result.map(item => item.id));
    category.custom.forEach(item => {
      if (!removed.has(item.id) && !ids.has(item.id)) {
        const custom = Object.assign({}, item);
        if ((kind === "characters" || kind === "monsters") && !custom.skillNAsset) {
          custom.skillNAsset = custom.normalAsset;
        }
        result.push(custom);
        ids.add(custom.id);
      }
    });
    return result;
  }

  function applyStoreToConfig(data, baseConfig) {
    const result = clone(baseConfig);
    result.unitTypes = applyCategory(result.unitTypes, data.characters, "characters");
    result.monsters = applyCategory(result.monsters, data.monsters, "monsters");
    result.effects = applyCategory(result.effects, data.skills, "skills");
    const removedCharacters = new Set(data.characters.removed);
    result.cardSlots = result.cardSlots.map(id => id && removedCharacters.has(id) ? null : id);
    const defaultIds = new Set(baseConfig.unitTypes.map(item => item.id));
    data.characters.custom.forEach(item => {
      if (!removedCharacters.has(item.id) && !defaultIds.has(item.id) && !result.cardSlots.includes(item.id)) {
        result.cardSlots.push(item.id);
      }
    });
    data.mods.filter(mod => mod.enabled).forEach(mod => {
      validatePatch(mod.patch, result);
      Object.keys(mod.patch).forEach(scope => {
        const entries = mod.patch[scope];
        if (scope === "resources") Object.assign(result, entries);
        else {
          const collection = scope === "characters" ? result.unitTypes :
            scope === "monsters" ? result.monsters : result.effects;
          Object.keys(entries).forEach(id => Object.assign(collection.find(item => item.id === id), entries[id]));
        }
      });
    });
    return result;
  }
  function applyEnabledModsToConfig() {
    store.mods.filter(mod => mod.enabled).forEach(mod => {
      Object.keys(mod.patch).forEach(scope => {
        const entries = mod.patch[scope];
        if (scope === "resources") Object.assign(cfg, entries);
        else {
          const collection = scope === "characters" ? cfg.unitTypes :
            scope === "monsters" ? cfg.monsters : cfg.effects;
          Object.keys(entries).forEach(id => Object.assign(collection.find(item => item.id === id), entries[id]));
        }
      });
    });
  }

  function validateEntity(item, kind, existingIds) {
    if (!item || !cleanId(item.id) || typeof item.name !== "string" ||
        !item.name.trim() || item.name.length > 60 ||
        existingIds.has(item.id)) throw new Error("Tên hoặc ID không hợp lệ / bị trùng.");
    if (kind === "characters" || kind === "monsters") {
      imageFields.forEach(([key, label]) => {
        if (!safeAsset(item[key])) throw new Error(`${label}: chọn ảnh hợp lệ hoặc nhập đường dẫn ảnh.`);
      });
      if (!["HUMAN", "DEMON"].includes(item.faction)) throw new Error("Faction không hợp lệ.");
      const numericKeys = kind === "characters"
        ? ["hp", "atk", "sa", "rc", "def", "cost", "range", "specialDamage", "specialInterval", "additionalValue"]
        : ["hp", "atk", "sa", "rc", "def", "coinReward", "ultimateDamage", "ultimateInterval",
          "spawnChance", "spawnMin", "spawnMax"];
      numericKeys.forEach(key => {
        const min = key === "hp" || key === "sa" || key === "spawnMin" || key === "spawnMax" ? 0.01 : 0;
        if (!validNumber(item[key], min)) throw new Error(`${key} phải từ ${min} đến ${maxNumber}.`);
      });
      if (kind === "characters" && item.range > cfg.columns) throw new Error("Tầm đánh không được vượt số cột.");
      if (kind === "monsters" && (item.spawnChance > 1 || item.spawnMin > item.spawnMax ||
          !Number.isInteger(item.spawnMin) || !Number.isInteger(item.spawnMax))) {
        throw new Error("SPAWN_CHANCE phải từ 0–100%; số lượng phải là số nguyên và tối thiểu không vượt tối đa.");
      }
      const skills = kind === "characters" ? item.skillIds : item.skills;
      if (!Array.isArray(skills) || skills.some(id => !cleanId(id))) {
        throw new Error("Danh sách kỹ năng không hợp lệ.");
      }
    } else {
      if (typeof item.effect !== "string" || !supportedEffects.includes(item.effect) ||
          !["PROJECTILE", "GLOBAL", "TARGET_POINT"].includes(item.deployment) ||
          !["HUMAN", "DEMON", "BOTH"].includes(item.userFaction) ||
          !["HUMAN", "DEMON", "OPPONENT", "USER_FACTION"].includes(item.targetFaction) ||
          !["TARGET", "GLOBAL", "USER_POINT"].includes(item.impact)) {
        throw new Error("Loại kỹ năng, mục tiêu hoặc hiệu ứng không hợp lệ.");
      }
      ["value", "duration", "cooldown", "chance", "speed", "size", "radius", "delay", "multiplier"]
        .forEach(key => {
          const value = item[key] === undefined ? 0 : item[key];
          if (!validNumber(value) || key === "chance" && value > 1) {
            throw new Error(`${key} không hợp lệ${key === "chance" ? " (0–100%)" : ""}.`);
          }
        });
      if (!safeAsset(item.iconAsset)) throw new Error("Ảnh biểu tượng kỹ năng không hợp lệ.");
    }
  }

  function validateStore(data) {
    if (!data || data.version !== 1 || !Array.isArray(data.mods)) throw new Error("Phiên bản dữ liệu không hợp lệ.");
    ["characters", "monsters", "skills"].forEach(kind => {
      const category = data[kind];
      if (!category || !Array.isArray(category.custom) || !Array.isArray(category.removed) ||
          !category.overrides || typeof category.overrides !== "object") {
        throw new Error(`Danh mục ${kind} bị sai định dạng.`);
      }
      const defaults = kind === "characters" ? cfg.unitTypes       : kind === "monsters" ? cfg.monsters : cfg.effects;
      const base = byId(defaults);
      const ids = new Set();
      category.custom.forEach(item => {
        validateEntity(item, kind, ids);
        ids.add(item.id);
        if (base.has(item.id)) throw new Error(`ID ${item.id} đã tồn tại trong cấu hình mặc định.`);
      });
      Object.keys(category.overrides).forEach(id => {
        const original = base.get(id);
        if (!original || !cleanId(id)) throw new Error(`Không tìm thấy mục mặc định ${id}.`);
        const merged = Object.assign({}, original, category.overrides[id]);
        if ((kind === "characters" || kind === "monsters") && !merged.skillNAsset) merged.skillNAsset = merged.normalAsset;
        if (kind === "characters" && merged.additionalValue === undefined) merged.additionalValue = 0;
        if (kind === "skills" && !merged.iconAsset) merged.iconAsset = "assets/skills/burst.svg";
        validateEntity(merged, kind, new Set());
      });
      category.removed.forEach(id => {
        if (!base.has(id) || !cleanId(id)) throw new Error(`Không thể xóa mục mặc định ${id}.`);
      });
    });
    const modIds = new Set();
    data.mods.forEach(mod => {
      if (!mod || !cleanId(mod.id) || modIds.has(mod.id) || typeof mod.name !== "string" ||
          !mod.name.trim() || mod.name.length > 60 || typeof mod.enabled !== "boolean" ||
          typeof mod.description !== "string" || mod.description.length > 300) {
        throw new Error("Một mod bị thiếu tên, ID hoặc cấu hình hợp lệ.");
      }
      modIds.add(mod.id);
      validatePatch(mod.patch, applyStoreToConfig(Object.assign({}, data, { mods: [] }), baseConfig));
    });
    applyStoreToConfig(data, baseConfig);
    return true;
  }

  function loadStore() {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        validateStore(parsed);
        store = parsed;
      }
      const adjusted = applyStoreToConfig(store, baseConfig);
      ["coinStart", "baseHp", "baseRecoveryPercent", "roundCountdownSeconds", "maxEnemiesOnMap",
        "cardSlots"].forEach(key => { cfg[key] = adjusted[key]; });
      cfg.unitTypes = adjusted.unitTypes;
      cfg.monsters = adjusted.monsters;
      cfg.effects = adjusted.effects;
    } catch (error) {
      loadError = `Không thể tải dữ liệu quản lý: ${error.message}. Bản lưu chưa bị ghi đè.`;
      console.error(loadError, error);
    }
  }

  function persist(candidate) {
    try {
      if (loadError) throw new Error("Bản lưu lỗi đang được giữ nguyên; không thể ghi đè an toàn.");
      validateStore(candidate);
      localStorage.setItem(storageKey, JSON.stringify(candidate));
      store = candidate;
      savedChanges = true;
      return true;
    } catch (error) {
      const errorId = document.getElementById("modManagementPanel").hidden
        ? "managementError" : "modManagementError";
      showError(errorId, `Không thể lưu thay đổi: ${error.message}`);
      console.error("Không thể lưu dữ liệu quản lý.", error);
      return false;
    }
  }

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function showError(id, text) {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
  }
  function addField(container, labelText, name, value, options = {}) {
    const label = node("label", "mod-field");
    label.appendChild(node("span", "", labelText));
    const input = node(options.select ? "select" : "input");
    if (options.select) {
      options.select.forEach(([optionValue, optionLabel]) => {
        const option = node("option", "", optionLabel);
        option.value = optionValue;
        input.appendChild(option);
      });
    } else {
      input.type = options.type || "text";
      if (input.type === "number") {
        input.min = options.min === undefined ? "0" : String(options.min);
        input.max = options.max === undefined ? String(maxNumber) : String(options.max);
        input.step = options.step || "any";
      }
      if (options.required) input.required = true;
      if (options.readOnly) input.readOnly = true;
      if (options.accept) input.accept = options.accept;
    }
    input.dataset.field = name;
    input.value = value === undefined || value === null ? "" : value;
    label.appendChild(input);
    container.appendChild(label);
    return input;
  }
  function skillOptions(selected) {
    const choices = node("fieldset", "management-skills");
    choices.appendChild(node("legend", "", "Skills trang bị"));
    cfg.effects.forEach(effect => {
      const label = node("label", "management-check");
      const input = node("input");
      input.type = "checkbox";
      input.value = effect.id;
      input.checked = selected.includes(effect.id);
      label.append(input, node("span", "", `${effect.name} (${effect.id})`));
      choices.appendChild(label);
    });
    return choices;
  }
  function imageUploadFields(container, item) {
    imageFields.forEach(([key, label]) => {
      addField(container, `${label} · đường dẫn`, key, item[key], { required: true });
      addField(container, `${label} · tải ảnh (PNG/JPG/WebP/GIF, tối đa 300 KB)`, `${key}File`, "",
        { type: "file", accept: "image/png,image/jpeg,image/webp,image/gif" });
    });
  }
  function currentItems(kind) {
    return kind === "characters" ? cfg.unitTypes : kind === "monsters" ? cfg.monsters : cfg.effects;
  }
  function defaultItems(kind) {
    return kind === "characters"     ? baseConfig.unitTypes : kind === "monsters" ? baseConfig.monsters : baseConfig.effects;
  }
  function renderList() {
    const list = document.getElementById("managementList");
    list.replaceChildren();
    const records = currentItems(currentCategory);
    const baseIds = new Set(defaultItems(currentCategory).map(item => item.id));
    records.forEach(item => {
      const row = node("article", "management-row");
      const summary = node("div", "management-row-summary");
      summary.append(node("strong", "", item.name), node("span", "", `${item.id} · ${baseIds.has(item.id) ? "Mặc định" : "Tùy chỉnh"}`));
      const actions = node("div", "management-row-actions");
      const edit = node("button", "mod-reset", "SỬA");
      edit.type = "button";
      edit.addEventListener("click", () => openEditor(item));
      const remove = node("button", "management-delete", "XÓA");
      remove.type = "button";
      remove.addEventListener("click", () => removeEntity(item.id));
      actions.append(edit, remove);
      row.append(summary, actions);
      list.appendChild(row);
    });
  }
  function renderCategory() {
    const titles = {
      characters: ["CHARACTER MANAGEMENT", "Quản lý ảnh, chỉ số, COIN và kỹ năng trang bị cho tướng."],
      monsters: ["MONSTER MANAGEMENT", "Quản lý chỉ số, kỹ năng và cấu hình xuất hiện của quái."],
      skills: ["SKILL MANAGEMENT", "Quản lý hiệu ứng kỹ năng có thể trang bị cho tướng và quái."]
    };
    document.getElementById("managementTitle").textContent = titles[currentCategory][0];
    document.getElementById("managementDescription").textContent = titles[currentCategory][1];
    document.getElementById("managementEditor").hidden = true;
    document.getElementById("managementList").hidden = false;
    document.getElementById("managementAdd").hidden = false;
    document.getElementById("managementApplyRow").hidden = !savedChanges;
    showError("managementError", loadError);
    renderList();
  }
  function restoreDefaults() {
    if (!window.confirm("Khôi phục dữ liệu mặc định? Các mục tùy chỉnh vẫn được giữ lại.")) return;
    const candidate = clone(store);
    candidate[currentCategory].overrides = {};
    candidate[currentCategory].removed = [];
    if (persist(candidate)) {
      document.getElementById("managementApplyRow").hidden = false;
      document.getElementById("managementNotice").textContent =
        "Đã khôi phục mục mặc định; mục tùy chỉnh được giữ nguyên.";
      renderList();
    }
  }

  function openEditor(item) {
    editingId = item ? item.id : null;
    const fields = document.getElementById("managementFields");
    fields.replaceChildren();
    const entityKind = currentCategory;
    const isSkill = entityKind === "skills";
    addField(fields, "ID", "id", item ? item.id : "", { required: true, readOnly: Boolean(item) });
    addField(fields, "Tên", "name", item ? item.name : "", { required: true });
    if (isSkill) {
      addField(fields, "Loại hiệu ứng", "effect", item ? item.effect : "STUN", {
        select: supportedEffects.map(value => [value, value])
      });
      addField(fields, "Loại triển khai", "deployment", item ? item.deployment : "PROJECTILE", {
        select: [["PROJECTILE", "PROJECTILE"], ["GLOBAL", "GLOBAL"], ["TARGET_POINT", "TARGET_POINT"]]
      });
      addField(fields, "Phe sử dụng", "userFaction", item ? item.userFaction : "BOTH", {
        select: [["BOTH", "BOTH"], ["HUMAN", "HUMAN"], ["DEMON", "DEMON"]]
      });
      addField(fields, "Mục tiêu", "targetFaction", item ? item.targetFaction : "OPPONENT", {
        select: [["OPPONENT", "OPPONENT"], ["HUMAN", "HUMAN"], ["DEMON", "DEMON"], ["USER_FACTION", "USER_FACTION"]]
      });
      addField(fields, "Điểm tác động", "impact", item ? item.impact : "TARGET", {
        select: [["TARGET", "TARGET"], ["GLOBAL", "GLOBAL"], ["USER_POINT", "USER_POINT"]]
      });
      [
        ["value", "Giá trị hiệu ứng"], ["duration", "Thời gian tác dụng (giây)"],
        ["cooldown", "Hồi chiêu (giây)"], ["chancePercent", "Xác suất (%)"],
        ["radius", "Phạm vi ảnh hưởng"], ["delay", "Độ trễ (giây)"],
        ["speed", "Tốc độ projectile"], ["size", "Kích thước"], ["multiplier", "Hệ số chí mạng (%)"]
      ].forEach(([key, label]) => {
        let value = item ? item[key === "chancePercent" ? "chance" : key] : 0;
        if (key === "chancePercent") value = (value || 0) * 100;
        addField(fields, label, key, value, { type: "number", step: "any" });
      });
      addField(fields, "Ảnh biểu tượng (đường dẫn)", "iconAsset",
        item && item.iconAsset ? item.iconAsset : "assets/skills/burst.svg");
      addField(fields, "Ảnh biểu tượng · tải ảnh (tối đa 300 KB)", "iconAssetFile", "",
        { type: "file", accept: "image/png,image/jpeg,image/webp,image/gif,image/svg+xml" });
    } else {
      addField(fields, "Phe", "faction", entityKind === "characters" ? "HUMAN" : "DEMON", {
        select: [["HUMAN", "HUMAN"], ["DEMON", "DEMON"]]
      });
      imageUploadFields(fields, item || {
        asset: "", normalAsset: "", skillNAsset: "", ultimateAsset: ""
      });
      (numericFields[entityKind]).forEach(([key, label, min]) => {
        let value = item ? item[key] : "";
        if (key === "spawnChancePercent") value = item ? item.spawnChance * 100 : "";
        addField(fields, label, key, value, { type: "number", min, step: "any" });
      });
      const selected = item ? (entityKind === "characters" ? item.skillIds : item.skills) : [];
      fields.appendChild(skillOptions(selected || []));
    }
    document.getElementById("managementList").hidden = true;
    document.getElementById("managementAdd").hidden = true;
    document.getElementById("managementEditor").hidden = false;
    showError("managementFormError", "");
    fields.querySelector('[data-field="id"]').focus();
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve("");
      if (!/^image\/(?:png|jpeg|webp|gif|svg\+xml)$/.test(file.type) || file.size > 300 * 1024) {
        return reject(new Error("Ảnh phải là PNG, JPG, WebP, GIF hoặc SVG và không vượt 300 KB."));
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error(`Không đọc được ảnh ${file.name}.`));
      reader.readAsDataURL(file);
    });
  }
  function verifyImage(source, label) {
    if (!safeAsset(source)) return Promise.reject(new Error(`${label} cần có ảnh hoặc đường dẫn hợp lệ.`));
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(`${label} không tải được. Kiểm tra tệp hoặc đường dẫn ảnh.`));
      image.src = source;
    });
  }
  async function collectEntity() {
    const fields = document.getElementById("managementFields");
    const get = name => fields.querySelector(`[data-field="${name}"]`);
    const item = { id: get("id").value.trim(), name: get("name").value.trim() };
    if (currentCategory === "skills") {
      ["effect", "deployment", "userFaction", "targetFaction", "impact", "iconAsset"].forEach(key => {
        item[key] = get(key).value.trim();
      });
      ["value", "duration", "cooldown", "radius", "delay", "speed", "size", "multiplier"]
        .forEach(key => { item[key] = Number(get(key).value || 0); });
      item.chance = Number(get("chancePercent").value) / 100;
      item.iconAsset = await readFile(get("iconAssetFile").files[0]) || item.iconAsset;
    } else {
      item.faction = get("faction").value;
      for (const [key] of imageFields) {
        item[key] = await readFile(get(`${key}File`).files[0]) || get(key).value.trim();
      }
      numericFields[currentCategory].forEach(([key]) => {
        const value = Number(get(key).value);
        item[key === "spawnChancePercent" ? "spawnChance" : key] =
          key === "spawnChancePercent" ? value / 100 : value;
      });
      const skills = [...fields.querySelectorAll(".management-skills input:checked")].map(input => input.value);
      if (currentCategory === "characters") item.skillIds = skills;
      else item.skills = skills;
    }
    return item;
  }

  function saveEntity(item) {
    const candidate = clone(store);
    const category = candidate[currentCategory];
    const base = new Map(defaultItems(currentCategory).map(entry => [entry.id, entry]));
    const existing = new Set(currentItems(currentCategory).map(entry => entry.id).filter(id => id !== editingId));
    validateEntity(item, currentCategory, existing);
    if (editingId && base.has(editingId)) category.overrides[editingId] = item;
    else if (editingId) {
      const index = category.custom.findIndex(entry => entry.id === editingId);
      if (index < 0) throw new Error("Không tìm thấy dữ liệu cần chỉnh sửa.");
      category.custom[index] = item;
    } else category.custom.push(item);
    if (persist(candidate)) {
      document.getElementById("managementEditor").hidden = true;
      document.getElementById("managementList").hidden = false;
      document.getElementById("managementAdd").hidden = false;
      document.getElementById("managementApplyRow").hidden = false;
      document.getElementById("managementNotice").textContent =
        "Đã lưu riêng trên thiết bị. Áp dụng cho trận mới để nạp cấu hình.";
      editingId = null;
      renderList();
    }
  }
  function removeEntity(id) {
    const base = new Map(defaultItems(currentCategory).map(item => [item.id, item]));
    if (currentCategory === "skills" &&
        (cfg.unitTypes.some(item => item.skillIds.includes(id)) ||
         cfg.monsters.some(item => item.skills.includes(id))) &&
        !window.confirm("Kỹ năng đang được trang bị. Xóa kỹ năng sẽ vô hiệu hóa tham chiếu đó; tiếp tục?")) return;
    if (!window.confirm(`Xóa ${id} khỏi danh sách hiện tại?`)) return;
    const candidate = clone(store);
    const category = candidate[currentCategory];
    if (base.has(id)) {
      if (currentCategory === "characters" || currentCategory === "monsters") {
        category.removed = [...new Set(category.removed.concat(id))];
        delete category.overrides[id];
      } else {
        category.removed = [...new Set(category.removed.concat(id))];
        delete category.overrides[id];
      }
    } else category.custom = category.custom.filter(item => item.id !== id);
    if (persist(candidate)) {
      document.getElementById("managementApplyRow").hidden = false;
      document.getElementById("managementNotice").textContent = "Đã lưu thao tác xóa; áp dụng cho trận mới để nạp cấu hình.";
      renderList();
    }
  }

  function renderMods() {
    const list = document.getElementById("modManagementList");
    list.replaceChildren();
    store.mods.forEach(mod => {
      const row = node("article", "management-row");
      const summary = node("div", "management-row-summary");
      summary.append(node("strong", "", mod.name), node("span", "", `${mod.id} · ${mod.enabled ? "ĐANG BẬT" : "ĐANG TẮT"}`));
      if (mod.description) summary.appendChild(node("p", "", mod.description));
      const actions = node("div", "management-row-actions");
      const toggleLabel = node("label", "management-check");
      const toggle = node("input");
      toggle.type = "checkbox";
      toggle.checked = mod.enabled;
      toggle.setAttribute("aria-label", `Bật ${mod.name}`);
      toggle.addEventListener("change", () => {
        const candidate = clone(store);
        const updated = candidate.mods.find(entry => entry.id === mod.id);
        updated.enabled = toggle.checked;
        if (persist(candidate)) {
          document.getElementById("modApplyRow").hidden = false;
          document.getElementById("modManagementNotice").textContent = "Đã lưu trạng thái mod; áp dụng để dùng trong trận mới.";
          renderMods();
        }
      });
      toggleLabel.append(toggle, node("span", "", "Bật"));
      const edit = node("button", "mod-reset", "SỬA");
      edit.type = "button";
      edit.addEventListener("click", () => openModEditor(mod));
      const remove = node("button", "management-delete", "GỠ");
      remove.type = "button";
      remove.addEventListener("click", () => {
        if (!window.confirm(`Gỡ mod ${mod.name}?`)) return;
        const candidate = clone(store);
        candidate.mods = candidate.mods.filter(entry => entry.id !== mod.id);
        if (persist(candidate)) {
          document.getElementById("modApplyRow").hidden = false;
          renderMods();
        }
      });
      actions.append(toggleLabel, edit, remove);
      row.append(summary, actions);
      list.appendChild(row);
    });
  }
  function openModEditor(mod) {
    editingModId = mod ? mod.id : null;
    const fields = document.getElementById("modFields");
    fields.replaceChildren();
    addField(fields, "ID (A–Z, 0–9, _ hoặc -)", "id", mod ? mod.id : "", {
      required: true, readOnly: Boolean(mod)
    });
    addField(fields, "Tên mod", "name", mod ? mod.name : "", { required: true });
    addField(fields, "Mô tả", "description", mod ? mod.description : "");
    const patchLabel = node("label", "mod-field management-json-label");
    patchLabel.appendChild(node("span", "", "Cấu hình JSON (resources / characters / monsters / skills)"));
    const textarea = node("textarea", "management-json");
    textarea.dataset.field = "patch";
    textarea.required = true;
    textarea.placeholder = '{\n  "resources": { "coinStart": 3000, "baseHp": 150 },\n  "characters": { "C1": { "atk": 30 } }\n}';
    textarea.value = JSON.stringify(mod ? mod.patch : {}, null, 2);
    patchLabel.appendChild(textarea);
    fields.appendChild(patchLabel);
    fields.appendChild(node("p", "management-json-help",
      'Ví dụ: {"resources":{"coinStart":3000},"characters":{"C1":{"atk":30}}}. ' +
      "Chỉ chỉnh chỉ số số học đã có; spawnChance trong JSON dùng tỷ lệ 0–1."));
    document.getElementById("modManagementList").hidden = true;
    document.getElementById("modAdd").hidden = true;
    document.getElementById("modEditor").hidden = false;
    showError("modFormError", "");
    fields.querySelector('[data-field="id"]').focus();
  }
  function saveMod(mod) {
    const candidate = clone(store);
    validatePatch(mod.patch, applyStoreToConfig(Object.assign({}, candidate, { mods: [] }), baseConfig));
    const index = candidate.mods.findIndex(entry => entry.id === editingModId);
    if (index >= 0) {
      mod.enabled = candidate.mods[index].enabled;
      candidate.mods[index] = mod;
    } else {
      if (candidate.mods.some(entry => entry.id === mod.id)) throw new Error("ID mod đã tồn tại.");
      mod.enabled = false;
      candidate.mods.push(mod);
    }
    if (persist(candidate)) {
      document.getElementById("modEditor").hidden = true;
      document.getElementById("modManagementList").hidden = false;
      document.getElementById("modAdd").hidden = false;
      document.getElementById("modApplyRow").hidden = false;
      document.getElementById("modManagementNotice").textContent = "Đã lưu mod. Bật mod và áp dụng để dùng trong trận mới.";
      editingModId = null;
      renderMods();
    }
  }

  function selectSettingsTab(tab) {
    currentCategory = ["characters", "monsters", "skills"].includes(tab) ? tab : currentCategory;
    document.querySelectorAll("[data-settings-tab]").forEach(button => {
      const active = button.dataset.settingsTab === tab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    const entity = document.getElementById("entityManagementPanel");
    const mods = document.getElementById("modManagementPanel");
    const game = document.getElementById("gameSettingsPanel");
    entity.hidden = !["characters", "monsters", "skills"].includes(tab);
    mods.hidden = tab !== "mods";
    game.hidden = tab !== "game";
    if (!entity.hidden) renderCategory();
    if (!mods.hidden) {
      showError("modManagementError", loadError);
      document.getElementById("modApplyRow").hidden = !savedChanges;
      renderMods();
    }
  }

  loadStore();
  window.LAST_BLOOM_APPLY_ENABLED_MODS = applyEnabledModsToConfig;
  window.LAST_BLOOM_SELECT_SETTINGS_TAB = selectSettingsTab;
  document.querySelectorAll("[data-settings-tab]").forEach(button =>
    button.addEventListener("click", () => selectSettingsTab(button.dataset.settingsTab)));
  document.getElementById("managementAdd").addEventListener("click", () => openEditor(null));
  document.getElementById("managementRestoreDefaults").addEventListener("click", restoreDefaults);
  document.getElementById("managementCancel").addEventListener("click", renderCategory);
  document.getElementById("managementEditor").addEventListener("submit", async event => {
    event.preventDefault();
    try {
      const item = await collectEntity();
      const assets = currentCategory === "skills" ? [["iconAsset", "Ảnh biểu tượng"]] : imageFields;
      for (const [key, label] of assets) await verifyImage(item[key], label);
      saveEntity(item);
    } catch (error) {
      showError("managementFormError", error.message);
    }
  });
  document.getElementById("modAdd").addEventListener("click", () => openModEditor(null));
  document.getElementById("modCancel").addEventListener("click", () => {
    document.getElementById("modEditor").hidden = true;
    document.getElementById("modManagementList").hidden = false;
    document.getElementById("modAdd").hidden = false;
  });
  document.getElementById("modEditor").addEventListener("submit", event => {
    event.preventDefault();
    const fields = document.getElementById("modFields");
    try {
      const mod = {
        id: fields.querySelector('[data-field="id"]').value.trim(),
        name: fields.querySelector('[data-field="name"]').value.trim(),
        description: fields.querySelector('[data-field="description"]').value.trim(),
        enabled: false,
        patch: JSON.parse(fields.querySelector('[data-field="patch"]').value)
      };
      saveMod(mod);
    } catch (error) {
      showError("modFormError", `Cấu hình mod không hợp lệ: ${error.message}`);
    }
  });
  document.getElementById("applySavedData").addEventListener("click", () => {
    if (window.LAST_BLOOM_CONFIRM_RELOAD && !window.LAST_BLOOM_CONFIRM_RELOAD()) return;
    location.reload();
  });
  document.getElementById("applyMods").addEventListener("click", () => {
    if (window.LAST_BLOOM_CONFIRM_RELOAD && !window.LAST_BLOOM_CONFIRM_RELOAD()) return;
    location.reload();
  });
  selectSettingsTab("game");
})();
