const fs = require("fs");
const vm = require("vm");

const html = fs.readFileSync("tradepro_dashboard_v032_test.html", "utf8");
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) {
  throw new Error("Unable to find script tag in test HTML.");
}
const script = scriptMatch[1];

class ClassList {
  constructor() { this._set = new Set(); }
  add(cls) { this._set.add(cls); }
  remove(cls) { this._set.delete(cls); }
  contains(cls) { return this._set.has(cls); }
}

class ElementStub {
  constructor(id) {
    this.id = id || "";
    this.style = {};
    this.dataset = {};
    this.classList = new ClassList();
    this.children = [];
    this.value = "";
    this.textContent = "";
    this.innerHTML = "";
  }
  appendChild(el) { this.children.push(el); return el; }
  setAttribute() {}
  getAttribute() { return null; }
  addEventListener() {}
  remove() {}
  closest() { return null; }
  focus() {}
  select() {}
}

const elementStore = new Map();
const documentStub = {
  readyState: "complete",
  visibilityState: "visible",
  body: new ElementStub("body"),
  getElementById(id) {
    if (!elementStore.has(id)) elementStore.set(id, new ElementStub(id));
    return elementStore.get(id);
  },
  createElement(tag) { return new ElementStub(tag); },
  querySelectorAll() { return []; },
  addEventListener() {}
};

const localStorageStub = {
  _data: new Map(),
  getItem(key) { return this._data.has(key) ? this._data.get(key) : null; },
  setItem(key, value) { this._data.set(key, String(value)); },
  removeItem(key) { this._data.delete(key); }
};

const intervals = [];
const context = {
  window: {},
  document: documentStub,
  localStorage: localStorageStub,
  console,
  setTimeout,
  clearTimeout,
  setInterval: (...args) => {
    const id = setInterval(...args);
    intervals.push(id);
    return id;
  },
  clearInterval,
  fetch: async () => { throw new Error("fetch disabled in tests"); }
};
context.window = context;
context.window.document = documentStub;
context.window.localStorage = localStorageStub;
context.window.addEventListener = () => {};

vm.createContext(context);
vm.runInContext(script, context);

const api = context.window.__TPB_TEST__;
if (!api) {
  throw new Error("Test API was not initialized.");
}

const results = [];
const push = (name, pass, detail) => {
  results.push({ name, pass: !!pass, detail: detail || "" });
};
const assert = (cond, name, detail) => {
  if (cond) push(name, true, detail);
  else push(name, false, detail);
};

try {
  api.reset();
  const state0 = api.getState();
  assert(Object.keys(state0.branches || {}).length === 0, "initial empty branches");

  api.createBranch("alpha", "In Progress", 10, "Normal", []);
  api.createBranch("beta", "Planned", 50, "High", []);
  api.createBranch("gamma", "Active", 90, "Low", []);

  const progressText = context.document.getElementById("overallProgress").textContent || "";
  assert(progressText.indexOf("Overall progress: 50%") !== -1, "overall progress average", progressText);

  api.reorder("gamma", "alpha", true);
  const order1 = api.getOrder();
  assert(order1[0] === "gamma", "drag reorder moves gamma to top", JSON.stringify(order1));

  api.renameBranch("beta", "beta-2");
  const order2 = api.getOrder();
  assert(order2.includes("beta-2") && !order2.includes("beta"), "rename updates key", JSON.stringify(order2));

  api.updateBranch("alpha", { status: "Blocked", priority: "Critical" });
  const state1 = api.getState();
  const alpha = state1.branches?.alpha;
  assert(alpha && alpha.status === "Blocked" && alpha.priority === "Critical", "edit branch fields persist");
} catch (e) {
  push("unexpected error", false, e && e.message ? e.message : String(e));
}

intervals.forEach(clearInterval);

console.log(JSON.stringify(results, null, 2));
