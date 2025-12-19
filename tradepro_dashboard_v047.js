
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const STORAGE_KEY = "tpb_status_v1";
  const META_KEY = "tpb_branch_meta_v1";
  const DEFAULT_OWNER = "Emile";
  const RISK_DAYS = 7;
  const RISK_PROGRESS = 50;
  const SERVER_META = { revision: null, updated_at: null, updated_by: null, state: 'warn', label: 'Server' };
  let HAS_REFRESHED = false;
  
  let DIRTY = false;
  let SAVE_IN_FLIGHT = false;
  let AUTOSAVE_TIMER = null;
  let AUTOSAVE_INTERVAL = null;
  let LAST_REMOTE_CHECK_AT = 0;
  let DRAG_KEY = null;
  let PENDING_RESTORE = null;

  function markDirty() {
    DIRTY = true;
    // show unsaved state in the server pill
    SERVER_META.state = "warn";
    SERVER_META.label = "Unsaved";
    updateSavePill();
    requestAutosave("edit");
  }

  function clearDirty() {
    DIRTY = false;
    // leave label alone if it already says Saved ✓
    if (SERVER_META.label === "Unsaved") {
      SERVER_META.label = "Server";
    }
    updateSavePill();
    if (SERVER_META.revision == null) refreshServerMetaOnly();
  }

  function normalizePayload(payload) {
    if (Array.isArray(payload)) return payload[0] || {};
    return payload || {};
  }

  function normalizeRevision(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const str = String(value ?? "").trim();
    if (/^\d+$/.test(str)) return Number.parseInt(str, 10);
    return null;
  }

  function extractServerMeta(payload) {
    const root = normalizePayload(payload);
    const rootJson = root && typeof root.json === "object" ? root.json : null;
    const status = root && typeof root.status === "object" ? root.status : null;
    const meta = root && typeof root.meta === "object" ? root.meta : null;
    const statusMeta = status && typeof status.meta === "object" ? status.meta : null;
    const item0 = Array.isArray(root.items) ? root.items[0] : null;
    const itemJson = item0 && typeof item0.json === "object" ? item0.json : null;
    const itemStatus = item0 && typeof item0.status === "object" ? item0.status : null;
    const itemMeta = item0 && typeof item0.meta === "object" ? item0.meta : null;
    const itemJsonStatus = itemJson && typeof itemJson.status === "object" ? itemJson.status : null;
    const itemJsonMeta = itemJson && typeof itemJson.meta === "object" ? itemJson.meta : null;
    const rawRevision =
      root.revision ??
      root.rev ??
      rootJson?.revision ??
      rootJson?.rev ??
      status?.revision ??
      status?.rev ??
      meta?.revision ??
      meta?.rev ??
      statusMeta?.revision ??
      statusMeta?.rev ??
      item0?.revision ??
      item0?.rev ??
      itemJson?.revision ??
      itemJson?.rev ??
      itemStatus?.revision ??
      itemStatus?.rev ??
      itemMeta?.revision ??
      itemMeta?.rev ??
      itemJsonStatus?.revision ??
      itemJsonStatus?.rev ??
      itemJsonMeta?.revision ??
      itemJsonMeta?.rev ??
      null;
    return {
      revision: normalizeRevision(rawRevision),
      updated_at:
        root.updated_at ??
        rootJson?.updated_at ??
        status?.updated_at ??
        meta?.updated_at ??
        statusMeta?.updated_at ??
        item0?.updated_at ??
        itemJson?.updated_at ??
        itemStatus?.updated_at ??
        itemMeta?.updated_at ??
        itemJsonStatus?.updated_at ??
        itemJsonMeta?.updated_at ??
        null,
      updated_by:
        root.updated_by ??
        rootJson?.updated_by ??
        status?.updated_by ??
        meta?.updated_by ??
        statusMeta?.updated_by ??
        item0?.updated_by ??
        itemJson?.updated_by ??
        itemStatus?.updated_by ??
        itemMeta?.updated_by ??
        itemJsonStatus?.updated_by ??
        itemJsonMeta?.updated_by ??
        null
    };
  }

  async function refreshServerMetaOnly() {
    const cfg = getServerSettings();
    if (!cfg.readUrl) return;
    try {
      const res = await fetch(cfg.readUrl, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          ...(cfg.apiKey ? { "x-api-key": cfg.apiKey } : {})
        }
      });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      const meta = extractServerMeta(data);
      if (meta.revision != null) SERVER_META.revision = meta.revision;
      if (meta.updated_at != null) SERVER_META.updated_at = meta.updated_at;
      if (meta.updated_by != null) SERVER_META.updated_by = meta.updated_by;
      updateSavePill();
    } catch {
      // ignore meta refresh failures
    }
  }

  function requestAutosave(source) {
    const cfg = getServerSettings();
    if (!cfg.saveUrl || !cfg.apiKey) return;
    if (SAVE_IN_FLIGHT) return;

    if (AUTOSAVE_TIMER) clearTimeout(AUTOSAVE_TIMER);
    AUTOSAVE_TIMER = setTimeout(async () => {
      if (!DIRTY) return;
      await autosaveToServer();
    }, 1400);
  }

  async function autosaveToServer() {
    const cfg = getServerSettings();
    if (!cfg.saveUrl || !cfg.apiKey) return;
    if (SAVE_IN_FLIGHT) return;
    try {
      SERVER_META.state = "warn";
      SERVER_META.label = "Saving…";
      updateSavePill();
      await saveToServer({ isAuto: true });
    } catch (e) {
      // saveToServer already toasts on failure
    }
  }

  async function remoteHasNewerRevision() {
    const cfg = getServerSettings();
    if (!cfg.readUrl || !cfg.apiKey) return false;

    const now = Date.now();
    if (now - LAST_REMOTE_CHECK_AT < 15000) return false; // throttle
    LAST_REMOTE_CHECK_AT = now;

    try {
      const res = await fetch(cfg.readUrl, {
        method: "GET",
        headers: { "x-api-key": cfg.apiKey }
      });
      const dataRaw = await res.json().catch(() => ({}));
      const meta = extractServerMeta(dataRaw);
      const remoteRev = meta.revision ?? null;

      if (remoteRev != null && SERVER_META.revision != null && remoteRev > SERVER_META.revision) {
        toast("Server has a newer revision (rev " + remoteRev + "). Refresh first to avoid overwrite.", "warn");
        return true;
      }
    } catch (e) {
      // ignore remote check failures
    }
    return false;
  }

const PASS_KEY = "tpb_gate_ok_v1";

  const SV_SAVE_URL_KEY = "tpb_sv_save_url_v1";
  const SV_READ_URL_KEY = "tpb_sv_read_url_v1";
  const SV_API_KEY_KEY  = "tpb_sv_api_key_v1";
  const SV_UPDATED_BY_KEY = "tpb_sv_updated_by_v1";

  const PASSCODE = "tradepro";

  let STATE = {
    overall: {
      badge: "On Track",
      headline: "All systems operational",
      notes: "No blocking issues",
      summary: ""
    },
    branches: {},
    branchOrder: [],
    updatedAt: new Date().toISOString()
  };

  let META = { meta: {} };

  function saveLocal(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Failed to save to localStorage:", e);
    }
  }

  function loadMeta() {
    try {
      const raw = localStorage.getItem(META_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          const meta = parsed.meta && typeof parsed.meta === "object" ? parsed.meta : {};
          return { meta };
        }
      }
    } catch (e) {
      console.error("Failed to load metadata:", e);
    }
    return { meta: {} };
  }

  function saveMeta() {
    try {
      localStorage.setItem(META_KEY, JSON.stringify(META));
    } catch (e) {
      console.error("Failed to save metadata:", e);
    }
  }

  function normalizeTags(text) {
    return String(text || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
  }

  function parseDueDate(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const d = new Date(raw + "T00:00:00");
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

  function getRiskStatus(meta, branch) {
    const due = parseDueDate(meta.dueDate);
    if (!due) return { overdue: false, atRisk: false, daysLeft: null };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDay = new Date(due);
    dueDay.setHours(0, 0, 0, 0);
    const daysLeft = Math.round((dueDay - today) / 86400000);
    const progress = clamp(Number(branch?.progress ?? 0) || 0, 0, 100);
    const overdue = daysLeft < 0;
    const atRisk = !overdue && daysLeft <= RISK_DAYS && progress < RISK_PROGRESS;
    return { overdue, atRisk, daysLeft };
  }

  function getBranchMeta(key) {
    const meta = META.meta && META.meta[key] ? META.meta[key] : {};
    const tags = Array.isArray(meta.tags) ? meta.tags : normalizeTags(meta.tags || "");
    return {
      owner: meta.owner || DEFAULT_OWNER,
      tags,
      dueDate: meta.dueDate || "",
      priority: meta.priority || (STATE.branches[key] && STATE.branches[key].priority) || "Normal"
    };
  }

  function setBranchMeta(key, data) {
    if (!META.meta) META.meta = {};
    const existing = META.meta[key] && typeof META.meta[key] === "object" ? META.meta[key] : {};
    META.meta[key] = { ...existing, ...data };
    saveMeta();
  }

  function renameBranchMeta(oldKey, newKey) {
    if (!META.meta || !META.meta[oldKey]) return;
    META.meta[newKey] = META.meta[oldKey];
    delete META.meta[oldKey];
    saveMeta();
  }

  function persistLocal(){
    saveLocal(STATE);
  }

  function openNewBranch(ev) {
    try { ev?.preventDefault?.(); } catch {}
    const ov = $("ovNewBranch");
    if (!ov) return;
    $("nbKey").value = "";
    $("nbStatus").value = "Planned";
    $("nbProgress").value = 0;
    $("nbCheckpoints").value = "";
    ov.classList.add("show");
    ov.setAttribute("aria-hidden", "false");
    setTimeout(() => $("nbKey")?.focus?.(), 50);
  }

  function closeNewBranch(ev) {
    try { ev?.preventDefault?.(); ev?.stopPropagation?.(); } catch {}
    const ov = $("ovNewBranch");
    if (!ov) return;
    ov.classList.remove("show");
    ov.setAttribute("aria-hidden", "true");
  }

  function sanitizeBranchKey(raw) {
    const s = String(raw || "").trim();
    return s.toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+/, "")
      .replace(/-+$/, "");
  }

  function splitLinesToArray(text) {
    return String(text || "")
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean);
  }

  function normalizeCheckpointItem(item, fallbackDone = false) {
    if (!item) return null;
    if (typeof item === "string") {
      return { text: item, done: !!fallbackDone };
    }
    if (typeof item === "object" && item.text) {
      return { text: String(item.text).trim(), done: !!item.done };
    }
    return null;
  }

  function createBranchFromForm(ev){
    try { ev?.preventDefault?.(); } catch {}
    const rawKey = ($("nbKey")?.value || "").trim();
    const key = sanitizeBranchKey(rawKey);
    const status = ($("nbStatus")?.value || "Planned").trim() || "Planned";
    const progress = clampInt(($("nbProgress")?.value ?? "0"), 0, 100);
    const checkpointsRaw = splitLinesToArray($("nbCheckpoints")?.value || "");
    const checkpoints = checkpointsRaw.map(t => ({ text: t, done: false }));

    if (!key){
      toast("Please enter a branch key (letters/numbers/dashes/underscores).", "warn");
      try { $("nbKey")?.focus?.(); } catch {}
      return;
    }

    STATE.branches = STATE.branches && typeof STATE.branches === "object" ? STATE.branches : {};
    if (STATE.branches[key]){
      toast(`Branch "${key}" already exists. Pick a different key.`, "warn");
      try { $("nbKey")?.focus?.(); } catch {}
      return;
    }

    STATE.branches[key] = { status, priority: "Normal", progress, checkpoints };
    setBranchMeta(key, { owner: DEFAULT_OWNER, tags: [], dueDate: "", priority: "Normal" });
    STATE.branchOrder = normalizeBranchOrder(STATE.branches, STATE.branchOrder);
    STATE.updatedAt = new Date().toISOString();

    persistLocal();
    try { renderAll(); markDirty();
    } catch {}
    closeNewBranch();
    toast(`Created branch: ${key}`, "ok");
  }

  window.TPB_UI = {
    openNewBranch,
    closeNewBranch,
    createBranchFromForm,
  };

  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error("Failed to load from localStorage:", e);
    }
    return null;
  }

  function getServerSettings() {
    try {
      return {
        saveUrl: localStorage.getItem(SV_SAVE_URL_KEY) || "",
        readUrl: localStorage.getItem(SV_READ_URL_KEY) || "",
        apiKey: localStorage.getItem(SV_API_KEY_KEY) || "",
        updatedBy: localStorage.getItem(SV_UPDATED_BY_KEY) || "dashboard"
      };
    } catch {
      return { saveUrl: "", readUrl: "", apiKey: "", updatedBy: "dashboard" };
    }
  }

  function setServerSettings(cfg) {
    try {
      localStorage.setItem(SV_SAVE_URL_KEY, cfg.saveUrl || "");
      localStorage.setItem(SV_READ_URL_KEY, cfg.readUrl || "");
      localStorage.setItem(SV_API_KEY_KEY, cfg.apiKey || "");
      localStorage.setItem(SV_UPDATED_BY_KEY, cfg.updatedBy || "dashboard");
    } catch (e) {
      console.error("Failed to save server settings:", e);
    }
  }

  const gateOverlay = $("gate");
  const gateInput   = $("gateCode");
  const gateBtn     = $("gateBtn");
  const gateErr     = $("gateErr");

  function setGateError(msg) {
    if (!gateErr) return;
    gateErr.textContent = msg || "";
    gateErr.style.display = msg ? "block" : "none";
  }

  function lockApp() {
    try { localStorage.removeItem(PASS_KEY); } catch {}
    if (gateOverlay) gateOverlay.style.display = "flex";
    setGateError("");
    if (gateInput) gateInput.value = "";
    setTimeout(() => gateInput?.focus(), 0);
  }

  function unlockApp() {
    try { localStorage.setItem(PASS_KEY, "1"); } catch {}
    if (gateOverlay) gateOverlay.style.display = "none";
    setGateError("");
    renderAll();
    toast("Unlocked successfully");
  }

  function attemptUnlock() {
    const v = (gateInput?.value || "").trim();
    if (!v) {
      setGateError("Enter passcode.");
      gateInput?.focus();
      return;
    }
    if (v === PASSCODE) {
      unlockApp();
      return;
    }
    setGateError("Incorrect passcode.");
    gateInput?.select();
  }

  if (gateBtn) gateBtn.addEventListener("click", (e) => { e.preventDefault(); attemptUnlock(); });
  if (gateInput) gateInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); attemptUnlock(); } });

  try {
    const ok = localStorage.getItem(PASS_KEY);
    if (ok === "1") unlockApp(); else lockApp();
  } catch {
    lockApp();
  }

  function esc(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function clampInt(val, min, max) {
    const n = parseInt(val, 10);
    return clamp(Number.isFinite(n) ? n : 0, min, max);
  }

  function normalizeCheckpoints(text, prior = []) {
    const priorMap = new Map();
    prior.forEach(cp => {
      const key = (cp && cp.text) ? cp.text.trim() : String(cp || "").trim();
      if (key) priorMap.set(key.toLowerCase(), !!cp.done);
    });
    return String(text || "")
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean)
      .map(t => ({ text: t, done: priorMap.get(t.toLowerCase()) || false }));
  }

  function normalizeBranchOrder(branches, order) {
    const keys = Object.keys(branches || {});
    const list = Array.isArray(order) ? order.filter(k => keys.includes(k)) : [];
    keys.forEach(k => { if (!list.includes(k)) list.push(k); });
    return list;
  }

  function normalizeState(raw) {
    const safe = raw || {};
    const branches = safe.branches && typeof safe.branches === "object" ? safe.branches : {};
    Object.keys(branches).forEach(k => {
      const b = branches[k] || {};
      const cps = Array.isArray(b.checkpoints) ? b.checkpoints : [];
      const norm = cps
        .map(cp => normalizeCheckpointItem(cp))
        .filter(Boolean)
        .map(cp => ({ text: cp.text, done: !!cp.done }));
      branches[k].checkpoints = norm;
    });
    return {
      overall: safe.overall || STATE.overall,
      branches,
      branchOrder: normalizeBranchOrder(branches, safe.branchOrder),
      updatedAt: safe.updatedAt || new Date().toISOString()
    };
  }

  let toastTimeout;
  
  function setLoading(isLoading, label) {
    const el = document.getElementById("loadingOverlay");
    const txt = document.getElementById("loadingText");
    if (!el || !txt) return;
    if (isLoading) {
      txt.textContent = label || "Loading…";
      el.style.display = "flex";
    } else {
      el.style.display = "none";
    }
  }

function toast(msg, kind, opts) {
    const options = opts || {};
    const duration = Number.isFinite(options.duration) ? options.duration : 4000;

    document.querySelectorAll(".toast").forEach(t => {
      t.classList.remove("show");
      setTimeout(() => t.remove(), 350);
    });

    const el = document.createElement("div");
    el.className = "toast show";
    const k = String(kind || "").toLowerCase();
    const tag = k ? ` <span style="color:${k==='ok'?'var(--ok)':k==='warn'?'var(--warn)':k==='err'||k==='danger'?'var(--danger)':'var(--accent)'};font-weight:800">•</span>` : "";
    el.innerHTML = `<div class="t">${esc(msg)}${tag}</div>`;
    document.body.appendChild(el);

    let timer = null;
    const start = () => {
      stop();
      timer = setTimeout(() => {
        el.classList.remove("show");
        setTimeout(() => el.remove(), 350);
      }, duration);
    };
    const stop = () => { if (timer) { clearTimeout(timer); timer = null; } };

    el.addEventListener("mouseenter", stop);
    el.addEventListener("mouseleave", start);

    start();
  }

  function renderAll() {
    renderOverall();
    renderBranches();
    updateModePill();
  }

  function renderOverall() {
    const o = STATE.overall;
    const badge = $("overallBadge");
    const badge2 = $("overallBadge2");
    const headline = $("overallHeadline");
    const notes = $("overallNotes");
    const summary = $("overallSummary");
    const summaryPill = $("overallSummaryPill");
    const progressEl = $("overallProgress");
    const updated = $("updatedAt");

    if (badge) badge.textContent = o.badge || "-";
    if (badge2) badge2.textContent = o.badge || "-";
    if (headline) headline.textContent = o.headline || "-";
    if (notes) notes.textContent = o.notes || "-";
    if (summary) summary.textContent = o.summary || "";
    if (summaryPill) {
      const text = (o.summary || "").trim();
      if (text) {
        summaryPill.textContent = text;
        summaryPill.style.display = "inline-flex";
      } else {
        summaryPill.textContent = "";
        summaryPill.style.display = "none";
      }
    }
    if (progressEl) {
      const branches = Object.values(STATE.branches || {});
      if (!branches.length) {
        progressEl.textContent = "Overall progress: -";
      } else {
        const total = branches.reduce((sum, b) => {
          const val = clamp(Number(b?.progress ?? 0) || 0, 0, 100);
          return sum + val;
        }, 0);
        const avg = Math.round(total / branches.length);
        progressEl.textContent = `Overall progress: ${avg}%`;
      }
    }
    if (updated) {
      try {
        const d = new Date(STATE.updatedAt);
        updated.textContent = d.toLocaleString();
      } catch {
        updated.textContent = STATE.updatedAt || "-";
      }
    }
  }

  function getFilterValues() {
    return {
      search: ($("filterSearch")?.value || "").trim().toLowerCase(),
      status: ($("filterStatus")?.value || "").trim(),
      priority: ($("filterPriority")?.value || "").trim(),
      owner: ($("filterOwner")?.value || "").trim(),
      tag: ($("filterTag")?.value || "").trim()
    };
  }

  function setSelectOptions(select, values) {
    if (!select) return;
    const current = select.value || "";
    const options = ['<option value="">All</option>']
      .concat(values.map(v => `<option value="${esc(v)}">${esc(v)}</option>`));
    select.innerHTML = options.join("");
    select.value = values.includes(current) ? current : "";
  }

  function buildFilterOptions(keys) {
    const owners = new Set();
    const tags = new Set();
    keys.forEach(key => {
      const meta = getBranchMeta(key);
      owners.add(meta.owner || DEFAULT_OWNER);
      (meta.tags || []).forEach(t => tags.add(t));
    });
    setSelectOptions($("filterOwner"), Array.from(owners).sort((a, b) => a.localeCompare(b)));
    setSelectOptions($("filterTag"), Array.from(tags).sort((a, b) => a.localeCompare(b)));
  }

  function clearFilters() {
    const ids = ["filterSearch", "filterStatus", "filterPriority", "filterOwner", "filterTag"];
    ids.forEach(id => {
      const el = $(id);
      if (!el) return;
      if (el.tagName === "SELECT") {
        el.value = "";
      } else {
        el.value = "";
      }
    });
    renderBranches();
  }

  function branchMatchesFilters(key, branch, meta, filters) {
    const status = branch.status || "Planned";
    if (filters.status && status !== filters.status) return false;
    if (filters.priority && meta.priority !== filters.priority) return false;
    if (filters.owner && meta.owner !== filters.owner) return false;
    if (filters.tag) {
      const tagLower = filters.tag.toLowerCase();
      const tagsLower = (meta.tags || []).map(t => t.toLowerCase());
      if (!tagsLower.includes(tagLower)) return false;
    }
    if (filters.search) {
      const hay = [
        key,
        status,
        meta.owner,
        meta.priority,
        meta.dueDate,
        (meta.tags || []).join(" "),
        (branch.checkpoints || []).join(" ")
      ].join(" ").toLowerCase();
      if (!hay.includes(filters.search)) return false;
    }
    return true;
  }

  function getVisibleBranchKeys(keys) {
    const filters = getFilterValues();
    return keys.filter(key => {
      const b = STATE.branches[key] || {};
      const meta = getBranchMeta(key);
      return branchMatchesFilters(key, b, meta, filters);
    });
  }

  function renderProgressChart(keys) {
    const el = $("progressChart");
    if (!el) return;
    if (!keys.length) {
      el.innerHTML = '<p style="margin:0;color:var(--muted)">No branches to chart.</p>';
      return;
    }
    const buckets = [0, 0, 0, 0];
    keys.forEach(key => {
      const b = STATE.branches[key] || {};
      const p = clamp(Number(b.progress || 0) || 0, 0, 100);
      const idx = p <= 25 ? 0 : p <= 50 ? 1 : p <= 75 ? 2 : 3;
      buckets[idx] += 1;
    });
    const max = Math.max(...buckets, 1);
    const labels = ["0-25", "26-50", "51-75", "76-100"];
    const colors = ["#ef4444", "#f59e0b", "#facc15", "#22c55e"];
    el.innerHTML = labels.map((label, i) => {
      const width = Math.round((buckets[i] / max) * 100);
      return `
        <div class="chart-row">
          <div class="chart-label">${label}%</div>
          <div class="chart-bar"><i style="width:${width}%;background:${colors[i]}"></i></div>
          <div class="chart-count">${buckets[i]}</div>
        </div>
      `;
    }).join("");
  }

  function renderBranches() {
    const container = $("branches");
    if (!container) return;
    
    const keys = getOrderedBranchKeys();
    if (keys.length === 0) {
      container.innerHTML = '<p style="color:var(--muted)">No branches yet. Click "New Branch" to add one.</p>';
      renderProgressChart([]);
      return;
    }

    buildFilterOptions(keys);
    const visibleKeys = getVisibleBranchKeys(keys);

    if (visibleKeys.length === 0) {
      container.innerHTML = '<p style="color:var(--muted)">No matching branches. Clear filters to see all.</p>';
      renderProgressChart([]);
      return;
    }

    container.innerHTML = visibleKeys.map((key, idx) => {
      const b = STATE.branches[key];
      const meta = getBranchMeta(key);
      const ownerText = esc(meta.owner || DEFAULT_OWNER);
      const priorityText = esc(meta.priority || "Normal");
      const dueText = meta.dueDate ? esc(meta.dueDate) : "-";
      const tagsText = (meta.tags && meta.tags.length) ? meta.tags.map(t => esc(t)).join(", ") : "-";
      const risk = getRiskStatus(meta, b);
      const riskBadge = risk.overdue
        ? `<span class="risk-badge overdue">Overdue</span>`
        : risk.atRisk
          ? `<span class="risk-badge risk">At Risk</span>`
          : "";
      const statusHtml = `<div class="status"><span>${esc(b.status || "Planned")}</span>${riskBadge}</div>`;
      const isFirst = idx === 0;
      const isLast = idx === visibleKeys.length - 1;
      const ckpts = (b.checkpoints || []).map((c, i) => {
        const item = normalizeCheckpointItem(c) || { text: "", done: false };
        const checked = item.done ? "checked" : "";
        const cls = item.done ? "cp-text checked" : "cp-text";
        return `<li><input class="cp-check" type="checkbox" data-branch-key="${esc(key)}" data-cp-index="${i}" ${checked}/><span class="${cls}">${esc(item.text)}</span></li>`;
      }).join("");
      return `
        <div class="branch-item" data-branch-key="${esc(key)}">
          <div class="tr">
            <span class="drag-handle" draggable="true" title="Drag to reorder" aria-label="Drag to reorder">::</span>
            <div class="move-controls">
              <button class="btn small move-btn" type="button" data-move-branch="up" data-branch-key="${esc(key)}" ${isFirst ? "disabled" : ""} aria-label="Move branch up">▲</button>
              <button class="btn small move-btn" type="button" data-move-branch="down" data-branch-key="${esc(key)}" ${isLast ? "disabled" : ""} aria-label="Move branch down">▼</button>
            </div>
            <div class="area">${esc(key)}</div>
            ${statusHtml}
            <div class="bar"><i style="width:${b.progress || 0}%"></i></div>
            <button class="btn small" data-edit-branch="${esc(key)}">Edit</button>
          </div>
          <div class="branch-meta">Owner: ${ownerText} | Priority: ${priorityText} | Due: ${dueText} | Tags: ${tagsText}</div>
          ${ckpts ? `<ul class="ckpts">${ckpts}</ul>` : ""}
        </div>
      `;
    }).join("");

    renderProgressChart(visibleKeys);
  }


  function reorderBranches(dragKey, targetKey, insertBefore) {
    const order = getOrderedBranchKeys().filter(k => k !== dragKey);
    const targetIndex = order.indexOf(targetKey);
    if (targetIndex === -1) return;
    const insertIndex = insertBefore ? targetIndex : targetIndex + 1;
    order.splice(insertIndex, 0, dragKey);
    STATE.branchOrder = order;
    STATE.updatedAt = new Date().toISOString();
    saveLocal(STATE);
    renderAll();
    markDirty();
  }

  function moveBranchInView(key, direction) {
    const order = getOrderedBranchKeys();
    const visible = getVisibleBranchKeys(order);
    const idx = visible.indexOf(key);
    if (idx === -1) return;
    const swapKey = direction === "up" ? visible[idx - 1] : visible[idx + 1];
    if (!swapKey) return;
    const orderIdx = order.indexOf(key);
    const swapIdx = order.indexOf(swapKey);
    if (orderIdx === -1 || swapIdx === -1) return;
    const tmp = order[orderIdx];
    order[orderIdx] = order[swapIdx];
    order[swapIdx] = tmp;
    STATE.branchOrder = order;
    STATE.updatedAt = new Date().toISOString();
    saveLocal(STATE);
    renderAll();
    markDirty();
  }

  function clearBranchDragState(container) {
    if (!container) return;
    container.querySelectorAll(".branch-item.drag-over").forEach(el => el.classList.remove("drag-over"));
    container.querySelectorAll(".branch-item.dragging").forEach(el => el.classList.remove("dragging"));
  }

  function updateModePill() {
    const pill = $("localModePill");
    if (!pill) return;
    const cfg = getServerSettings();
    if (cfg.saveUrl) {
      pill.innerHTML = `Mode: <b>Server-backed</b>`;
    } else {
      pill.innerHTML = `Mode: <b>Local</b>`;
    }
  }

  function updateSavePill() {
    const el = document.getElementById("savePill");
    const revEl = document.getElementById("saveRev");
    const labelEl = document.getElementById("saveLabel");
    if (!el || !revEl || !labelEl) return;

    const rev = (SERVER_META.revision ?? "-");
    revEl.textContent = "rev " + rev;
    labelEl.textContent = SERVER_META.label || "Server";
    el.dataset.state = SERVER_META.state || "warn";
  }

  function markServerLoaded(meta) {
    if (meta && meta.revision != null) SERVER_META.revision = meta.revision;
    if (meta && meta.updated_at != null) SERVER_META.updated_at = meta.updated_at;
    if (meta && meta.updated_by != null) SERVER_META.updated_by = meta.updated_by;
    SERVER_META.state = "ok";
    SERVER_META.label = "Server";
    HAS_REFRESHED = true;
    clearDirty();
    updateSavePill();
    if (SERVER_META.revision == null) refreshServerMetaOnly();
  }

  function markServerSaved(meta) {
    if (meta && meta.revision != null) SERVER_META.revision = meta.revision;
    if (meta && meta.updated_at != null) SERVER_META.updated_at = meta.updated_at;
    if (meta && meta.updated_by != null) SERVER_META.updated_by = meta.updated_by;
    SERVER_META.state = "ok";
    SERVER_META.label = "Saved ✓";
    clearDirty();
    updateSavePill();
  }

  function markServerError() {
    SERVER_META.state = "err";
    SERVER_META.label = "Server";
    updateSavePill();
  }

  function openOverlay(id) {
    const el = $(id);
    if (el) el.classList.add("show");
  }

  function closeOverlay(id) {
    const el = $(id);
    if (el) el.classList.remove("show");
  }

  function openOverallEditor() {
    $("oBadge").value = STATE.overall.badge || "";
    $("oHeadline").value = STATE.overall.headline || "";
    $("oNotes").value = STATE.overall.notes || "";
    $("oSummary").value = STATE.overall.summary || "";
    $("oUpdatedAt").value = STATE.updatedAt || new Date().toISOString();
    openOverlay("ovOverall");
  }

  function saveOverallFromEditor() {
    STATE.overall.badge = ($("oBadge").value || "").trim();
    STATE.overall.headline = ($("oHeadline").value || "").trim();
    STATE.overall.notes = ($("oNotes").value || "").trim();
    STATE.overall.summary = ($("oSummary").value || "").trim();
    const customTime = ($("oUpdatedAt").value || "").trim();
    STATE.updatedAt = customTime || new Date().toISOString();
    saveLocal(STATE);
    renderAll();
    markDirty();
    closeOverlay("ovOverall");
    toast("Overall saved locally");
  }

  function getBranchKeys() {
    return getOrderedBranchKeys();
  }

  function getOrderedBranchKeys() {
    return normalizeBranchOrder(STATE.branches, STATE.branchOrder);
  }

  function fillBranchSelect(selected) {
    const sel = $("bKey");
    if (!sel) return;
    const keys = getBranchKeys();
    sel.innerHTML = keys.map(k => `<option value="${esc(k)}">${esc(k)}</option>`).join("");
    if (selected && keys.includes(selected)) sel.value = selected;
  }

  function renderBranchEditorCheckpoints(list) {
    const container = $("bCkptsList");
    if (!container) return;
    const cps = Array.isArray(list) ? list : [];
    container.innerHTML = cps.map((cp, idx) => {
      const item = normalizeCheckpointItem(cp) || { text: "", done: false };
      const checked = item.done ? "checked" : "";
      return `
        <div class="cp-row" data-cp-index="${idx}">
          <input class="cp-check" type="checkbox" ${checked} />
          <input type="text" class="cp-text-input" value="${esc(item.text)}" placeholder="Checkpoint" />
          <button class="cp-del" type="button" title="Remove">×</button>
        </div>
      `;
    }).join("");
  }

  function getBranchEditorCheckpointsFromDOM() {
    const container = $("bCkptsList");
    if (!container) return [];
    const rows = Array.from(container.querySelectorAll(".cp-row"));
    const result = [];
    rows.forEach(row => {
      const textInput = row.querySelector(".cp-text-input");
      const check = row.querySelector(".cp-check");
      const text = (textInput?.value || "").trim();
      if (text) result.push({ text, done: !!check?.checked });
    });
    return result;
  }

  function addBranchEditorCheckpoint(text = "") {
    const container = $("bCkptsList");
    if (!container) return;
    const idx = container.querySelectorAll(".cp-row").length;
    const checked = "";
    const row = document.createElement("div");
    row.className = "cp-row";
    row.setAttribute("data-cp-index", String(idx));
    row.innerHTML = `
      <input class="cp-check" type="checkbox" ${checked} />
      <input type="text" class="cp-text-input" value="${esc(text)}" placeholder="Checkpoint" />
      <button class="cp-del" type="button" title="Remove">×</button>
    `;
    container.appendChild(row);
    const input = row.querySelector(".cp-text-input");
    if (input) input.focus();
  }

  function openBranchEditor(key) {
    fillBranchSelect(key);
    const k = $("bKey").value;
    const b = STATE.branches[k] || { status: "Planned", progress: 0, checkpoints: [] };
    const meta = getBranchMeta(k);
    $("bRename").value = k || "";
    $("bStatus").value = b.status || "Planned";
    $("bPriority").value = meta.priority || "Normal";
    $("bOwner").value = meta.owner || DEFAULT_OWNER;
    $("bDueDate").value = meta.dueDate || "";
    $("bTags").value = (meta.tags || []).join(", ");
    $("bProgress").value = String(b.progress ?? 0);
    renderBranchEditorCheckpoints(b.checkpoints || []);
    openOverlay("ovBranch");
  }

  function saveBranchFromEditor() {
    const key = ($("bKey").value || "").trim();
    if (!key) {
      toast("Missing branch key");
      return;
    }
    const renameRaw = ($("bRename").value || "").trim();
    const nextKey = renameRaw ? sanitizeBranchKey(renameRaw) : key;
    if (!nextKey) {
      toast("Invalid branch key");
      return;
    }
    const owner = ($("bOwner").value || "").trim() || DEFAULT_OWNER;
    const tags = normalizeTags(($("bTags").value || "").trim());
    const dueDate = ($("bDueDate").value || "").trim();
    const priority = ($("bPriority").value || "Normal").trim() || "Normal";
    if (nextKey !== key && STATE.branches[nextKey]) {
      toast(`Branch "${nextKey}" already exists. Pick a different key.`, "warn");
      return;
    }
    if (!STATE.branches[key]) {
      STATE.branches[key] = { status: "Planned", progress: 0, checkpoints: [] };
    }
    if (nextKey !== key) {
      STATE.branches[nextKey] = STATE.branches[key];
      delete STATE.branches[key];
      if (Array.isArray(STATE.branchOrder)) {
        const idx = STATE.branchOrder.indexOf(key);
        if (idx !== -1) STATE.branchOrder[idx] = nextKey;
      }
      renameBranchMeta(key, nextKey);
    }

    STATE.branches[nextKey].status = ($("bStatus").value || "").trim();
    STATE.branches[nextKey].priority = priority;
    STATE.branches[nextKey].progress = clamp(Number($("bProgress").value || 0) || 0, 0, 100);
    STATE.branches[nextKey].checkpoints = getBranchEditorCheckpointsFromDOM();
    setBranchMeta(nextKey, { owner, tags, dueDate, priority });
    STATE.branchOrder = normalizeBranchOrder(STATE.branches, STATE.branchOrder);

    STATE.updatedAt = new Date().toISOString();
    saveLocal(STATE);
    renderAll();
    markDirty();
    closeOverlay("ovBranch");
    toast("Branch saved locally");
  }

  async function saveToServer(opts = {}) {
    const cfg = getServerSettings();
    if (!cfg.saveUrl) { 
      toast("Set Save URL first", "warn"); 
      openServerSettings(); 
      return; 
    }
    if (!cfg.apiKey) { 
      toast("Set API key first", "warn"); 
      openServerSettings(); 
      return; 
    }
    if (!HAS_REFRESHED) {
      toast("Refresh from Server first to load latest data.", "warn");
    }
    // Prevent accidental overwrite if server advanced elsewhere (manual saves only)
    if (!opts.isAuto && DIRTY) {
      const newer = await remoteHasNewerRevision();
      if (newer) return;
    }

    SAVE_IN_FLIGHT = true;

    const localSnapshot = JSON.parse(JSON.stringify(STATE));
    STATE.updatedAt = new Date().toISOString();

    const payload = {
      updated_by: cfg.updatedBy || "dashboard",
      status: STATE
    };

    try {
      const res = await fetch(cfg.saveUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": cfg.apiKey
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText}${txt ? " – " + txt : ""}`);
      }

      const data = await res.json().catch(() => ({}));

      if (data && data.status && typeof data.status === "object") {
        const server = data.status || {};
        const merged = {
          ...localSnapshot,
          ...server,
          overall: { ...(localSnapshot.overall || {}), ...(server.overall || {}) },
          branches: { ...(localSnapshot.branches || {}), ...(server.branches || {}) },
          updatedAt: server.updatedAt || localSnapshot.updatedAt || new Date().toISOString()
        };

        STATE = normalizeState(merged);
        saveLocal(STATE);
        renderAll();
        markServerSaved(extractServerMeta(data));
        toast("Saved to server", "ok");
        return;
      }

      STATE = localSnapshot;
      saveLocal(STATE);
      renderAll();
      const meta = extractServerMeta(data);
      markServerSaved({
        revision: meta.revision ?? null,
        updated_by: meta.updated_by ?? payload.updated_by,
        updated_at: meta.updated_at ?? STATE.updatedAt
      });
      toast("Saved (no status returned)", "ok");

    } catch (e) {
      STATE = localSnapshot;
      saveLocal(STATE);
      renderAll();
      markServerError();
      toast("Save failed: " + e.message, "danger");
    } finally {
      SAVE_IN_FLIGHT = false;
    }
  }

  async function refreshFromServer() {
    const cfg = getServerSettings();
    if (!cfg.readUrl) { 
      toast("Set Read URL first", "warn"); 
      openServerSettings(); 
      return; 
    }

    const localSnapshot = JSON.parse(JSON.stringify(STATE));

    try {
      console.log("Fetching from:", cfg.readUrl);
      
      const res = await fetch(cfg.readUrl, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          ...(cfg.apiKey ? { "x-api-key": cfg.apiKey } : {})
        }
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText}${txt ? ": " + txt : ""}`);
      }

      const data = await res.json().catch(() => ({}));
      console.log("Server response:", data);

      // Try multiple response formats
      let serverStatus = null;
      
      if (data.status && typeof data.status === "object") {
        // Format: { status: { overall, branches, ... } }
        serverStatus = data.status;
      } else if (data.overall || data.branches) {
        // Format: { overall, branches, ... } (direct status object)
        serverStatus = data;
      }

      if (serverStatus) {
        STATE = normalizeState(serverStatus);
        saveLocal(STATE);
        renderAll();
        markServerLoaded(extractServerMeta(data));
        toast("Refreshed from server", "ok");
        return;
      }

      throw new Error("No valid status data in response");
    } catch (e) {
      console.error("Refresh error:", e);
      STATE = localSnapshot;
      saveLocal(STATE);
      renderAll();
      markServerError();
      toast("Refresh failed: " + e.message, "danger");
    }
  }

  function openServerSettings() {
    const cfg = getServerSettings();
    $("svSaveUrl").value = cfg.saveUrl;
    $("svReadUrl").value = cfg.readUrl;
    $("svApiKey").value = cfg.apiKey;
    $("svUpdatedBy").value = cfg.updatedBy || "dashboard";
    openOverlay("ovServer");
  }

  function saveServerSettingsFromModal() {
    const saveUrl = ($("svSaveUrl").value || "").trim();
    const readUrl = ($("svReadUrl").value || "").trim();
    const apiKey = ($("svApiKey").value || "").trim();
    const updatedBy = ($("svUpdatedBy").value || "").trim() || "dashboard";

    if (!saveUrl || !readUrl || !apiKey) {
      toast("Save URL, Read URL, and API key are required.", "warn");
      return;
    }

    setServerSettings({ saveUrl, readUrl, apiKey, updatedBy });
    closeOverlay("ovServer");
    updateModePill();
    toast("Server settings saved", "ok");
  }

  function startImportServerSettings() {
    const input = $("svImportFile");
    if (input) input.click();
  }

  async function importServerSettingsFromFile(ev) {
    const input = ev?.target;
    const file = input?.files?.[0];
    if (input) input.value = "";
    if (!file) return;

    let raw = "";
    try {
      raw = await file.text();
    } catch {
      toast("Could not read settings file.", "warn");
      return;
    }

    let data = null;
    try {
      data = JSON.parse(raw);
    } catch {
      toast("Invalid JSON in settings file.", "warn");
      return;
    }

    const saveUrl = String(data.saveUrl || data.save_url || "").trim();
    const readUrl = String(data.readUrl || data.read_url || "").trim();
    const apiKey = String(data.apiKey || data.api_key || "").trim();
    const updatedBy = String(data.updatedBy || data.updated_by || "dashboard").trim() || "dashboard";

    if (!saveUrl || !readUrl || !apiKey) {
      toast("Backup missing Save URL, Read URL, or API key.", "warn");
      return;
    }

    $("svSaveUrl").value = saveUrl;
    $("svReadUrl").value = readUrl;
    $("svApiKey").value = apiKey;
    $("svUpdatedBy").value = updatedBy;
    toast("Settings loaded. Click Save settings to apply.", "ok");
  }

  async function testServerConnection() {
    const stored = getServerSettings();
    const readUrl = ($("svReadUrl")?.value || stored.readUrl || "").trim();
    const apiKey = ($("svApiKey")?.value || stored.apiKey || "").trim();
    if (!readUrl) {
      toast("Set Read URL first", "warn");
      return;
    }

    const start = performance.now();
    try {
      const res = await fetch(readUrl, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          ...(apiKey ? { "x-api-key": apiKey } : {})
        }
      });
      const ms = Math.round(performance.now() - start);
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText}${txt ? ": " + txt : ""}`);
      }
      const data = await res.json().catch(() => ({}));
      const meta = extractServerMeta(data);
      const revText = meta.revision != null ? `rev ${meta.revision}` : "rev -";
      toast(`Connection ok (${revText}, ${ms}ms)`, "ok");
    } catch (e) {
      toast("Connection failed: " + e.message, "danger");
    }
  }

  function openBackupModal(jsonText) {
    const box = $("backupSettingsText");
    if (box) box.value = jsonText || "";
    openOverlay("ovBackupSettings");
  }

  function copyBackupSettings() {
    const box = $("backupSettingsText");
    if (!box) return;
    const text = box.value || "";
    if (!text) {
      toast("Nothing to copy.", "warn");
      return;
    }

    const fallback = () => {
      box.focus();
      box.select();
      try {
        const ok = document.execCommand("copy");
        toast(ok ? "Backup copied to clipboard" : "Copy failed", ok ? "ok" : "warn");
      } catch {
        toast("Copy failed", "warn");
      }
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => toast("Backup copied to clipboard", "ok"),
        () => fallback()
      );
    } else {
      fallback();
    }
  }

  async function backupServerSettings() {
    const cfg = getServerSettings();
    if (!cfg.saveUrl || !cfg.readUrl || !cfg.apiKey) {
      toast("Save settings first to back them up.", "warn");
      return;
    }

    const payload = {
      saveUrl: cfg.saveUrl,
      readUrl: cfg.readUrl,
      apiKey: cfg.apiKey,
      updatedBy: cfg.updatedBy || "dashboard",
      exportedAt: new Date().toISOString()
    };

    const json = JSON.stringify(payload, null, 2);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `tpb_server_settings_${stamp}.json`;

    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: "JSON", accept: { "application/json": [".json"] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
        toast("Server settings backup saved", "ok");
        return;
      } catch (e) {
        if (e && e.name === "AbortError") {
          toast("Backup canceled", "warn");
          return;
        }
      }
    }

    try {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        link.remove();
      }, 0);
    } catch {
      // ignore download failures
    }

    openBackupModal(json);
    toast("Download may be blocked. Use copy backup.", "warn");
  }

  function setBackupsMenu(isOpen) {
    const wrap = $("backupsDropdown");
    const btn = $("btnBackups");
    if (!wrap || !btn) return;
    wrap.classList.toggle("open", !!isOpen);
    btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
  }

  function toggleBackupsMenu() {
    const wrap = $("backupsDropdown");
    if (!wrap) return;
    setBackupsMenu(!wrap.classList.contains("open"));
  }

  function openDashboardBackupModal(jsonText) {
    const box = $("dashboardBackupText");
    if (box) box.value = jsonText || "";
    openOverlay("ovDashboardBackup");
  }

  function copyDashboardBackup() {
    const box = $("dashboardBackupText");
    if (!box) return;
    const text = box.value || "";
    if (!text) {
      toast("Nothing to copy.", "warn");
      return;
    }

    const fallback = () => {
      box.focus();
      box.select();
      try {
        const ok = document.execCommand("copy");
        toast(ok ? "Backup copied to clipboard" : "Copy failed", ok ? "ok" : "warn");
      } catch {
        toast("Copy failed", "warn");
      }
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => toast("Backup copied to clipboard", "ok"),
        () => fallback()
      );
    } else {
      fallback();
    }
  }

  async function backupDashboardData() {
    const payload = {
      version: "V045",
      exportedAt: new Date().toISOString(),
      status: JSON.parse(JSON.stringify(STATE)),
      meta: (META && typeof META.meta === "object") ? META.meta : {}
    };

    const json = JSON.stringify(payload, null, 2);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `tpb_dashboard_backup_${stamp}.json`;

    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: "JSON", accept: { "application/json": [".json"] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
        toast("Dashboard backup saved", "ok");
        return;
      } catch (e) {
        if (e && e.name === "AbortError") {
          toast("Backup canceled", "warn");
          return;
        }
      }
    }

    try {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        link.remove();
      }, 0);
    } catch {
      // ignore download failures
    }

    openDashboardBackupModal(json);
    toast("Download may be blocked. Use copy backup.", "warn");
  }

  function openDashboardRestoreConfirm(summary) {
    const el = $("dashboardRestoreSummary");
    if (el) el.textContent = summary || "Backup details unavailable.";
    openOverlay("ovDashboardRestoreConfirm");
  }

  function confirmDashboardRestore() {
    if (!PENDING_RESTORE) {
      closeOverlay("ovDashboardRestoreConfirm");
      return;
    }
    STATE = normalizeState(PENDING_RESTORE.status);
    META = { meta: PENDING_RESTORE.meta || {} };
    saveLocal(STATE);
    saveMeta();
    renderAll();
    markDirty();
    PENDING_RESTORE = null;
    closeOverlay("ovDashboardRestoreConfirm");
    toast("Dashboard restored from backup", "ok");
  }

  function cancelDashboardRestore() {
    PENDING_RESTORE = null;
    closeOverlay("ovDashboardRestoreConfirm");
  }

  function startDashboardRestore() {
    const input = $("dashboardImportFile");
    if (input) input.click();
  }

  async function restoreDashboardFromFile(ev) {
    const input = ev?.target;
    const file = input?.files?.[0];
    if (input) input.value = "";
    if (!file) return;

    let raw = "";
    try {
      raw = await file.text();
    } catch {
      toast("Could not read backup file.", "warn");
      return;
    }

    let data = null;
    try {
      data = JSON.parse(raw);
    } catch {
      toast("Invalid JSON in backup file.", "warn");
      return;
    }

    const status =
      (data && typeof data.status === "object" && data.status) ||
      (data && typeof data.state === "object" && data.state) ||
      ((data && (data.overall || data.branches)) ? data : null);
    if (!status) {
      toast("Backup missing status data.", "warn");
      return;
    }

    const metaRoot = (data && typeof data.meta === "object") ? data.meta : {};
    const meta = (metaRoot && typeof metaRoot.meta === "object") ? metaRoot.meta : metaRoot;
    const metaSafe = (meta && typeof meta === "object" && !Array.isArray(meta)) ? meta : {};

    const normalized = normalizeState(status);
    const branchCount = Object.keys(normalized.branches || {}).length;
    const updatedAt = normalized.updatedAt || "-";
    const summary = `Branches: ${branchCount} • Updated: ${updatedAt}`;
    PENDING_RESTORE = { status: normalized, meta: metaSafe };
    openDashboardRestoreConfirm(summary);
  }
  function bind() {
    $("btnEditOverall")?.addEventListener("click", openOverallEditor);
    $("btnEditBranch")?.addEventListener("click", () => {
      const keys = getBranchKeys();
      if (keys.length === 0) {
        toast("No branches yet. Click New Branch to add one.", "warn");
        return;
      }
      openBranchEditor(keys[0]);
    });

    $("btnNewBranch")?.addEventListener("click", openNewBranch);
    $("nbClose")?.addEventListener("click", closeNewBranch);
    $("nbCancel")?.addEventListener("click", closeNewBranch);
    $("nbCreate")?.addEventListener("click", createBranchFromForm);
    $("nbKey")?.addEventListener("keydown", (e) => { if (e.key === "Enter") createBranchFromForm(); });
    $("nbProgress")?.addEventListener("keydown", (e) => { if (e.key === "Enter") createBranchFromForm(); });
    $("btnServerSettings")?.addEventListener("click", openServerSettings);
    $("btnSyncServer")?.addEventListener("click", saveToServer);
    $("btnRefreshServer")?.addEventListener("click", refreshFromServer);

    $("saveOverall")?.addEventListener("click", saveOverallFromEditor);
    document.querySelectorAll('[data-close="ovOverall"]').forEach(btn => {
      btn.addEventListener("click", () => closeOverlay("ovOverall"));
    });

    $("saveBranch")?.addEventListener("click", saveBranchFromEditor);
    $("bKey")?.addEventListener("change", () => {
      const key = $("bKey").value;
      if (key) openBranchEditor(key);
    });
    document.querySelectorAll('[data-close="ovBranch"]').forEach(btn => {
      btn.addEventListener("click", () => closeOverlay("ovBranch"));
    });

    $("btnCloseServer")?.addEventListener("click", () => closeOverlay("ovServer"));
    $("btnCancelServer")?.addEventListener("click", () => closeOverlay("ovServer"));
    $("btnImportServerSettings")?.addEventListener("click", startImportServerSettings);
    $("svImportFile")?.addEventListener("change", importServerSettingsFromFile);
    $("btnBackupServerSettings")?.addEventListener("click", backupServerSettings);
    $("btnTestServerSettings")?.addEventListener("click", testServerConnection);
    $("btnBackupCopy")?.addEventListener("click", copyBackupSettings);
    document.querySelectorAll('[data-close="ovBackupSettings"]').forEach(btn => {
      btn.addEventListener("click", () => closeOverlay("ovBackupSettings"));
    });
    $("btnSaveServerSettings")?.addEventListener("click", saveServerSettingsFromModal);

    const backupsDropdown = $("backupsDropdown");
    $("btnBackups")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleBackupsMenu();
    });
    $("btnDashboardBackup")?.addEventListener("click", () => {
      setBackupsMenu(false);
      backupDashboardData();
    });
    $("btnDashboardRestore")?.addEventListener("click", () => {
      setBackupsMenu(false);
      startDashboardRestore();
    });
    $("dashboardImportFile")?.addEventListener("change", restoreDashboardFromFile);
    $("btnDashboardBackupCopy")?.addEventListener("click", copyDashboardBackup);
    document.querySelectorAll('[data-close="ovDashboardBackup"]').forEach(btn => {
      btn.addEventListener("click", () => closeOverlay("ovDashboardBackup"));
    });
    $("btnDashboardRestoreConfirm")?.addEventListener("click", confirmDashboardRestore);
    $("btnDashboardRestoreCancel")?.addEventListener("click", cancelDashboardRestore);
    document.querySelectorAll('[data-close="ovDashboardRestoreConfirm"]').forEach(btn => {
      btn.addEventListener("click", cancelDashboardRestore);
    });
    document.addEventListener("click", (e) => {
      if (!backupsDropdown) return;
      if (!backupsDropdown.contains(e.target)) setBackupsMenu(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setBackupsMenu(false);
    });

    $("bCkptAdd")?.addEventListener("click", () => {
      const input = $("bCkptNew");
      const text = (input?.value || "").trim();
      addBranchEditorCheckpoint(text);
      if (input) input.value = "";
    });
    const ckptList = $("bCkptsList");
    ckptList?.addEventListener("click", (e) => {
      const del = e.target.closest(".cp-del");
      if (!del) return;
      const row = del.closest(".cp-row");
      if (row) row.remove();
    });

    const branchesEl = $("branches");
    branchesEl?.addEventListener("click", (e) => {
      const moveBtn = e.target.closest("[data-move-branch]");
      if (moveBtn) {
        const key = moveBtn.getAttribute("data-branch-key");
        const dir = moveBtn.getAttribute("data-move-branch");
        if (key && dir) moveBranchInView(key, dir);
        return;
      }
      const btn = e.target.closest("[data-edit-branch]");
      if (!btn) return;
      const key = btn.getAttribute("data-edit-branch");
      openBranchEditor(key);
    });
    branchesEl?.addEventListener("change", (e) => {
      const cp = e.target.closest(".cp-check");
      if (!cp) return;
      const key = cp.getAttribute("data-branch-key");
      const idx = Number(cp.getAttribute("data-cp-index") || "-1");
      if (!key || idx < 0) return;
      const branch = STATE.branches[key];
      if (!branch || !Array.isArray(branch.checkpoints)) return;
      if (!branch.checkpoints[idx]) return;
      branch.checkpoints[idx] = {
        text: branch.checkpoints[idx].text || String(branch.checkpoints[idx] || ""),
        done: cp.checked
      };
      STATE.updatedAt = new Date().toISOString();
      saveLocal(STATE);
      renderAll();
      markDirty();
    });
    $("filterSearch")?.addEventListener("input", renderBranches);
    $("filterStatus")?.addEventListener("change", renderBranches);
    $("filterPriority")?.addEventListener("change", renderBranches);
    $("filterOwner")?.addEventListener("change", renderBranches);
    $("filterTag")?.addEventListener("change", renderBranches);
    $("filterClear")?.addEventListener("click", clearFilters);
    if (branchesEl) {
      branchesEl.addEventListener("dragstart", (e) => {
        const handle = e.target.closest(".drag-handle");
        if (!handle) return;
        const item = handle.closest(".branch-item");
        if (!item) return;
        DRAG_KEY = item.getAttribute("data-branch-key");
        item.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", DRAG_KEY || "");
      });
      branchesEl.addEventListener("dragover", (e) => {
        const item = e.target.closest(".branch-item");
        if (!item || !DRAG_KEY) return;
        e.preventDefault();
        item.classList.add("drag-over");
      });
      branchesEl.addEventListener("dragleave", (e) => {
        const item = e.target.closest(".branch-item");
        if (!item) return;
        item.classList.remove("drag-over");
      });
      branchesEl.addEventListener("drop", (e) => {
        const item = e.target.closest(".branch-item");
        if (!item) return;
        e.preventDefault();
        const targetKey = item.getAttribute("data-branch-key");
        const dragKey = DRAG_KEY || e.dataTransfer.getData("text/plain");
        if (!dragKey || !targetKey || dragKey === targetKey) {
          clearBranchDragState(branchesEl);
          DRAG_KEY = null;
          return;
        }
        const rect = item.getBoundingClientRect();
        const insertBefore = e.clientY < rect.top + rect.height / 2;
        reorderBranches(dragKey, targetKey, insertBefore);
        clearBranchDragState(branchesEl);
        DRAG_KEY = null;
      });
      branchesEl.addEventListener("dragend", () => {
        clearBranchDragState(branchesEl);
        DRAG_KEY = null;
      });
    }

    $("btnAbout")?.addEventListener("click", () => {
      const el = $("howItWorks");
      if (el) {
        el.style.display = el.style.display === "none" ? "block" : "none";
      }
    });

  }

  async function init() {
    bind();

    const saved = loadLocal();
    if (saved) {
      STATE = normalizeState(saved);
    }
    META = loadMeta();

    const cfg = getServerSettings();
    if (cfg && cfg.readUrl) {
      setLoading(true, "Loading latest server data…");
      await refreshFromServer();
      setLoading(false);
    }

    
    // Autosave safety net (only saves when there are local changes)
    if (!AUTOSAVE_INTERVAL) {
      AUTOSAVE_INTERVAL = setInterval(() => { if (DIRTY) autosaveToServer(); }, 60000);
    }

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden" && DIRTY) autosaveToServer();
    });
    window.addEventListener("pagehide", () => { if (DIRTY) autosaveToServer(); });

    renderAll();
    updateSavePill();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

