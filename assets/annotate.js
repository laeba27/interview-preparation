/* ===== Private highlights & notes — no login =====
   Select text → pick a colour or "Note". Click a highlight to edit or delete it.
   "My notes" (bottom-right) lists everything on the page, holds a page note,
   and shows the sync code that carries your notes to another device.

   Saved instantly in this browser, then synced to /api/annotations when the
   site runs on Vercel with storage configured. Anchors store the quoted text
   plus a little context, so highlights survive edits to the page. */
(function annotate(){
  const main = document.querySelector("main");
  if (!main || !window.getSelection) return;

  const API = "/api/annotations";
  const COLORS = ["yellow", "green", "blue", "pink"];
  const CONTEXT = 32;                                   // chars of prefix/suffix kept per highlight
  const SKIP = "svg, script, style, textarea, input, button, .ann-ui";

  /* ---------- storage helpers ---------- */
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };
  const randomHex = bytes => [...crypto.getRandomValues(new Uint8Array(bytes))]
    .map(b => b.toString(16).padStart(2, "0")).join("");

  // Page id: last two path parts, e.g. "interview-questions/bookleaf-fullstack"
  const PAGE = location.pathname.replace(/\.html$/, "").split("/").filter(Boolean).slice(-2)
    .join("/").toLowerCase().replace(/[^a-z0-9/_-]/g, "-").slice(0, 120) || "home";
  const LOCAL_KEY = "ann:" + PAGE;

  let user = ls.get("ann-user");
  if (!/^[a-f0-9]{32,64}$/.test(user || "")) { user = randomHex(32); ls.set("ann-user", user); }

  const emptyDoc = () => ({ items: [], pageNote: "", pageNoteUpdated: 0 });
  let doc = (() => { try { return { ...emptyDoc(), ...JSON.parse(ls.get(LOCAL_KEY)) }; } catch (e) { return emptyDoc(); } })();
  const live = () => doc.items.filter(i => !i.deleted);

  /* ---------- merging (last edit wins per item) ---------- */
  function merge(a, b) {
    const byId = new Map();
    [...a.items, ...b.items].forEach(i => {
      const cur = byId.get(i.id);
      if (!cur || (i.updated || 0) > (cur.updated || 0)) byId.set(i.id, i);
    });
    const newer = (b.pageNoteUpdated || 0) > (a.pageNoteUpdated || 0) ? b : a;
    return { items: [...byId.values()], pageNote: newer.pageNote || "", pageNoteUpdated: newer.pageNoteUpdated || 0 };
  }

  /* ---------- sync ---------- */
  let remoteOff = location.protocol === "file:";       // opened from disk: device-only
  let dirty = false, pushTimer = null;

  async function pull() {
    const res = await fetch(`${API}?page=${encodeURIComponent(PAGE)}`, { headers: { "X-Ann-User": user } });
    if (res.status === 503 || res.status === 404) { remoteOff = true; throw new Error("off"); }
    if (!res.ok) throw new Error(res.status);
    return { ...emptyDoc(), ...(await res.json()) };
  }

  async function push() {
    if (remoteOff) return status();
    status("Syncing…");
    try {
      doc = merge(doc, await pull());                   // never clobber edits from another device
      ls.set(LOCAL_KEY, JSON.stringify(doc));
      const res = await fetch(`${API}?page=${encodeURIComponent(PAGE)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Ann-User": user },
        body: JSON.stringify(doc),
      });
      if (!res.ok) throw new Error(res.status);
      dirty = false;
    } catch (e) { /* stays dirty; retried on the next save or when back online */ }
    status();
  }

  function save() {
    ls.set(LOCAL_KEY, JSON.stringify(doc));
    dirty = true;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, 1200);
    refreshPanel();
    status();
  }

  async function initialSync() {
    if (remoteOff) return status();
    try {
      const before = JSON.stringify(doc);
      doc = merge(doc, await pull());
      ls.set(LOCAL_KEY, JSON.stringify(doc));
      if (JSON.stringify(doc) !== before) { render(); refreshPanel(); }
      if (doc.items.length || doc.pageNote) push();    // send anything made offline
    } catch (e) {}
    status();
  }
  addEventListener("online", () => dirty && push());
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && dirty && push());

  /* ---------- text index: flat text of a root + where each text node starts ---------- */
  function indexOf(root) {
    const nodes = [];
    let text = "";
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.parentElement && n.parentElement.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    for (let n = walker.nextNode(); n; n = walker.nextNode()) { nodes.push({ node: n, start: text.length }); text += n.nodeValue; }
    return { nodes, text };
  }

  // Convert a DOM boundary point into an offset in the flat text
  function offsetOf(idx, container, offset) {
    const hit = idx.nodes.find(x => x.node === container);
    if (hit) return hit.start + offset;
    const child = container.childNodes[offset];
    const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;
    const after = child
      ? n => n === child || child.contains(n) || (child.compareDocumentPosition(n) & FOLLOWING)
      : n => !container.contains(n) && (container.compareDocumentPosition(n) & FOLLOWING);
    const first = idx.nodes.find(x => after(x.node));
    return first ? first.start : idx.text.length;
  }

  const scopeOf = node => {
    const el = node.nodeType === 1 ? node : node.parentElement;
    return (el && el.closest("main section[id]")) || main;
  };

  /* ---------- painting highlights ---------- */
  function wrap(idx, s, e, item) {
    idx.nodes.forEach(({ node, start }) => {
      const end = start + node.nodeValue.length;
      if (end <= s || start >= e) return;
      let target = node;
      const from = Math.max(s - start, 0), to = Math.min(e - start, node.nodeValue.length);
      if (to < target.nodeValue.length) target.splitText(to);
      if (from > 0) target = target.splitText(from);
      if (!target.nodeValue.trim()) return;           // don't wrap whitespace between blocks
      const mark = document.createElement("mark");
      mark.className = `ann-hl ann-${item.color}${item.note ? " ann-has-note" : ""}`;
      mark.dataset.ann = item.id;
      if (item.note) mark.title = item.note;
      target.parentNode.insertBefore(mark, target);
      mark.appendChild(target);
    });
  }

  function locate(item) {
    for (const root of [document.getElementById(item.scope), main]) {
      if (!root || !main.contains(root)) continue;
      const idx = indexOf(root);
      let best = -1, bestScore = -1;
      for (let at = idx.text.indexOf(item.exact); at !== -1; at = idx.text.indexOf(item.exact, at + 1)) {
        let score = 0;
        const pre = idx.text.slice(Math.max(0, at - CONTEXT), at);
        const suf = idx.text.slice(at + item.exact.length, at + item.exact.length + CONTEXT);
        for (let i = 1; i <= Math.min(pre.length, item.prefix.length) && pre.at(-i) === item.prefix.at(-i); i++) score++;
        for (let i = 0; i < Math.min(suf.length, item.suffix.length) && suf[i] === item.suffix[i]; i++) score++;
        if (score > bestScore) { best = at; bestScore = score; }
      }
      if (best !== -1) return { idx, s: best, e: best + item.exact.length };
    }
    return null;
  }

  function render() {
    main.querySelectorAll("mark.ann-hl").forEach(m => {
      const parent = m.parentNode;
      while (m.firstChild) parent.insertBefore(m.firstChild, m);
      parent.removeChild(m);
      parent.normalize();
    });
    live().forEach(item => {
      const where = locate(item);
      if (where) wrap(where.idx, where.s, where.e, item);
    });
  }

  /* ---------- UI helpers ---------- */
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html) n.innerHTML = html; return n; };
  const swatches = (onPick, current) => {
    const wrapEl = el("div", "ann-swatches");
    COLORS.forEach(c => {
      const b = el("button", `ann-sw ann-${c}${c === current ? " on" : ""}`);
      b.type = "button"; b.title = c; b.setAttribute("aria-label", `Highlight ${c}`);
      b.addEventListener("mousedown", ev => ev.preventDefault());   // keep the text selection
      b.addEventListener("click", () => onPick(c));
      wrapEl.appendChild(b);
    });
    return wrapEl;
  };
  function placeNear(box, rect) {
    box.style.visibility = "hidden"; box.style.display = "block";
    const w = box.offsetWidth, h = box.offsetHeight, gap = 8;
    let top = rect.top - h - gap;
    if (top < 70 || matchMedia("(pointer: coarse)").matches) top = rect.bottom + gap;   // below on touch / near header
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - w / 2), innerWidth - w - 8);
    box.style.top = `${Math.min(top, innerHeight - h - 8)}px`; box.style.left = `${left}px`;
    box.style.visibility = "";
  }

  /* ---------- selection toolbar ---------- */
  const bar = el("div", "ann-ui ann-bar");
  document.body.appendChild(bar);
  let pending = null;

  function selectionInfo() {
    const sel = getSelection();
    if (!sel.rangeCount || sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    if (!main.contains(range.commonAncestorContainer)) return null;
    const anc = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
    if (anc.closest(SKIP)) return null;
    const root = scopeOf(range.commonAncestorContainer);
    const idx = indexOf(root);
    let s = offsetOf(idx, range.startContainer, range.startOffset);
    let e = offsetOf(idx, range.endContainer, range.endOffset);
    while (s < e && /\s/.test(idx.text[s])) s++;
    while (e > s && /\s/.test(idx.text[e - 1])) e--;
    if (e - s < 2 || e - s > 3000) return null;
    return {
      rect: range.getBoundingClientRect(),
      item: {
        exact: idx.text.slice(s, e),
        prefix: idx.text.slice(Math.max(0, s - CONTEXT), s),
        suffix: idx.text.slice(e, e + CONTEXT),
        scope: root === main ? "" : root.id,
      },
    };
  }

  function create(color, withNote) {
    if (!pending) return;
    const now = Date.now();
    const item = { id: randomHex(8), color, note: "", created: now, updated: now, ...pending.item };
    doc.items.push(item);
    getSelection().removeAllRanges();
    hideBar();
    render(); save();
    if (withNote) openEditor(item.id);
  }

  bar.appendChild(swatches(c => create(c, false)));
  const noteBtn = el("button", "ann-btn", "✎ Note");
  noteBtn.type = "button";
  noteBtn.addEventListener("mousedown", ev => ev.preventDefault());
  noteBtn.addEventListener("click", () => create("yellow", true));
  bar.appendChild(noteBtn);

  const hideBar = () => { bar.style.display = "none"; pending = null; };
  let selTimer = null;
  document.addEventListener("selectionchange", () => {
    clearTimeout(selTimer);
    selTimer = setTimeout(() => {
      pending = selectionInfo();
      pending ? placeNear(bar, pending.rect) : hideBar();
    }, 220);
  });
  addEventListener("scroll", () => { if (pending) { const r = getSelection().rangeCount && getSelection().getRangeAt(0).getBoundingClientRect(); r && placeNear(bar, r); } }, { passive: true });

  /* ---------- editor for an existing highlight ---------- */
  const pop = el("div", "ann-ui ann-pop");
  document.body.appendChild(pop);
  let editing = null, noteTimer = null;

  function openEditor(id) {
    const item = doc.items.find(i => i.id === id);
    const mark = main.querySelector(`mark[data-ann="${id}"]`);
    if (!item || !mark) return;
    editing = id;
    pop.innerHTML = "";
    pop.appendChild(swatches(c => { item.color = c; item.updated = Date.now(); render(); save(); openEditor(id); }, item.color));
    const ta = el("textarea", "ann-note");
    ta.placeholder = "Add a note…";
    ta.value = item.note || "";
    ta.addEventListener("input", () => {
      clearTimeout(noteTimer);
      noteTimer = setTimeout(() => {
        item.note = ta.value; item.updated = Date.now();
        main.querySelectorAll(`mark[data-ann="${id}"]`).forEach(m => {
          m.classList.toggle("ann-has-note", !!item.note); m.title = item.note;
        });
        save();
      }, 400);
    });
    const row = el("div", "ann-row");
    const del = el("button", "ann-btn ann-danger", "Delete");
    del.type = "button";
    del.addEventListener("click", () => { item.deleted = true; item.updated = Date.now(); closeEditor(); render(); save(); });
    const done = el("button", "ann-btn", "Done");
    done.type = "button";
    done.addEventListener("click", closeEditor);
    row.append(del, done);
    pop.append(ta, row);
    placeNear(pop, mark.getBoundingClientRect());
    if (!item.note) ta.focus();
  }
  function closeEditor() {
    if (!editing) return;
    clearTimeout(noteTimer);
    const ta = pop.querySelector("textarea"), item = doc.items.find(i => i.id === editing);
    if (ta && item && ta.value !== (item.note || "")) {           // flush a pending note edit
      item.note = ta.value; item.updated = Date.now(); render(); save();
    }
    pop.style.display = "none"; editing = null;
  }

  main.addEventListener("click", ev => {
    const mark = ev.target.closest("mark.ann-hl");
    if (!mark || !getSelection().isCollapsed) return;
    ev.preventDefault();                                          // don't toggle a <summary> underneath
    openEditor(mark.dataset.ann);
  });
  document.addEventListener("mousedown", ev => { if (editing && !pop.contains(ev.target) && !ev.target.closest("mark.ann-hl")) closeEditor(); });
  document.addEventListener("keydown", ev => { if (ev.key === "Escape") { closeEditor(); hideBar(); closePanel(); } });

  /* ---------- "My notes" panel ---------- */
  const fab = el("button", "ann-ui ann-fab");
  fab.type = "button";
  const panel = el("div", "ann-ui ann-panel");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "My notes");
  document.body.append(fab, panel);

  panel.innerHTML = `
    <div class="ann-panel-head"><b>My notes</b><button type="button" class="ann-x" aria-label="Close">✕</button></div>
    <label class="ann-label" for="annPageNote">Notes for this page</label>
    <textarea id="annPageNote" class="ann-note" placeholder="Anything you want to remember about this page…"></textarea>
    <div class="ann-label">Highlights</div>
    <div class="ann-list"></div>
    <details class="ann-sync">
      <summary>Sync &amp; backup <span class="ann-status"></span></summary>
      <p>No account needed. This code is your key — paste it on another device to see the same notes. Keep it private.</p>
      <div class="ann-code-row"><input class="ann-code" readonly aria-label="Your sync code"><button type="button" class="ann-btn ann-copy">Copy</button></div>
      <div class="ann-code-row"><input class="ann-new-code" placeholder="Paste a sync code" aria-label="Paste a sync code"><button type="button" class="ann-btn ann-use">Use</button></div>
      <div class="ann-code-row"><button type="button" class="ann-btn ann-export">Export all</button><label class="ann-btn ann-import">Import<input type="file" accept="application/json" hidden></label></div>
    </details>`;

  const list = panel.querySelector(".ann-list");
  const pageNote = panel.querySelector("#annPageNote");
  const statusEl = panel.querySelector(".ann-status");
  const codeEl = panel.querySelector(".ann-code");

  function status(text) {
    statusEl.textContent = text || (remoteOff ? "· this device only" : dirty ? "· not synced yet" : "· synced");
  }

  function refreshPanel() {
    const items = live();
    fab.textContent = items.length ? `✎ My notes · ${items.length}` : "✎ My notes";
    if (document.activeElement !== pageNote) pageNote.value = doc.pageNote || "";
    codeEl.value = user;
    list.innerHTML = "";
    if (!items.length) { list.appendChild(el("p", "ann-empty", "Select any text on the page to highlight it or add a note.")); return; }
    // Order by position on the page
    const pos = id => { const m = main.querySelector(`mark[data-ann="${id}"]`); return m ? m.getBoundingClientRect().top + scrollY : Infinity; };
    items.sort((a, b) => pos(a.id) - pos(b.id)).forEach(item => {
      const row = el("button", "ann-item");
      row.type = "button";
      const q = el("span", `ann-quote ann-${item.color}`);
      q.textContent = item.exact.length > 140 ? item.exact.slice(0, 140) + "…" : item.exact;
      row.appendChild(q);
      if (item.note) { const n = el("span", "ann-item-note"); n.textContent = item.note; row.appendChild(n); }
      if (pos(item.id) === Infinity) row.appendChild(el("span", "ann-item-note", "(text not found on the page any more)"));
      row.addEventListener("click", () => jumpTo(item.id));
      list.appendChild(row);
    });
  }

  function jumpTo(id) {
    const mark = main.querySelector(`mark[data-ann="${id}"]`);
    if (!mark) return;
    let d = mark.closest("details");
    while (d) { d.open = true; d = d.parentElement.closest("details"); }
    if (matchMedia("(max-width: 880px)").matches) closePanel();
    mark.scrollIntoView({ block: "center", behavior: "smooth" });
    main.querySelectorAll(`mark[data-ann="${id}"]`).forEach(m => {
      m.classList.remove("ann-flash"); void m.offsetWidth; m.classList.add("ann-flash");
    });
  }

  const openPanel = () => { refreshPanel(); panel.classList.add("open"); };
  function closePanel() { panel.classList.remove("open"); }
  fab.addEventListener("click", () => panel.classList.contains("open") ? closePanel() : openPanel());
  panel.querySelector(".ann-x").addEventListener("click", closePanel);

  let pageNoteTimer = null;
  pageNote.addEventListener("input", () => {
    clearTimeout(pageNoteTimer);
    pageNoteTimer = setTimeout(() => { doc.pageNote = pageNote.value; doc.pageNoteUpdated = Date.now(); save(); }, 500);
  });

  panel.querySelector(".ann-copy").addEventListener("click", ev => {
    navigator.clipboard?.writeText(user).then(() => { ev.target.textContent = "Copied"; setTimeout(() => ev.target.textContent = "Copy", 1500); });
  });

  panel.querySelector(".ann-use").addEventListener("click", async () => {
    const input = panel.querySelector(".ann-new-code");
    const code = input.value.trim().toLowerCase();
    if (!/^[a-f0-9]{32,64}$/.test(code)) { input.value = ""; input.placeholder = "That doesn't look like a sync code"; return; }
    if (!confirm("Switch to this sync code? Your notes on this device will be merged into it.")) return;
    user = code; ls.set("ann-user", code); input.value = "";
    await initialSync(); render(); refreshPanel(); push();
  });

  panel.querySelector(".ann-export").addEventListener("click", () => {
    const pages = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("ann:")) { try { pages[k.slice(4)] = JSON.parse(ls.get(k)); } catch (e) {} }
    }
    const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), pages }, null, 2)], { type: "application/json" });
    const a = el("a"); a.href = URL.createObjectURL(blob); a.download = "my-notes-backup.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  panel.querySelector(".ann-import input").addEventListener("change", async ev => {
    const file = ev.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      Object.entries(data.pages || {}).forEach(([page, d]) => {
        if (!d || !Array.isArray(d.items)) return;
        const key = "ann:" + page;
        let cur = emptyDoc();
        try { cur = { ...cur, ...JSON.parse(ls.get(key)) }; } catch (e) {}
        ls.set(key, JSON.stringify(merge(cur, { ...emptyDoc(), ...d })));
      });
      doc = { ...emptyDoc(), ...JSON.parse(ls.get(LOCAL_KEY) || "{}") };
      render(); save();
    } catch (e) { alert("That file isn't a notes backup."); }
    ev.target.value = "";
  });

  /* ---------- go ---------- */
  render();
  refreshPanel();
  status();
  initialSync();
})();
