/* ===== Shared behaviour for all notes pages ===== */

/* Theme — applied early in <head> too, this part wires the button. */
(function theme(){
  const btn = document.getElementById("theme");
  if (!btn) return;
  const label = () =>
    btn.textContent = document.documentElement.getAttribute("data-theme") === "dark"
      ? "Light mode" : "Dark mode";
  label();
  btn.onclick = () => {
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    const next = dark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("notes-theme", next); } catch (e) {}
    label();
  };
})();

/* Collapse / expand the sidebar on desktop (remembered across pages) */
(function collapse(){
  const body     = document.body;
  const collapseBtn = document.getElementById("collapseBtn");
  const reopenBtn   = document.getElementById("reopen");
  if (!collapseBtn && !reopenBtn) return;

  let saved = null;
  try { saved = localStorage.getItem("notes-nav"); } catch (e) {}
  if (saved === "collapsed") body.classList.add("nav-collapsed");

  const set = (collapsed) => {
    body.classList.toggle("nav-collapsed", collapsed);
    try { localStorage.setItem("notes-nav", collapsed ? "collapsed" : "open"); } catch (e) {}
  };
  collapseBtn?.addEventListener("click", () => set(true));
  reopenBtn?.addEventListener("click", () => set(false));

  /* [ toggles the sidebar — but not while typing in the filter box */
  document.addEventListener("keydown", (e) => {
    if (e.key !== "[" || e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName)) return;
    set(!body.classList.contains("nav-collapsed"));
  });
})();

/* Sidebar: scrollspy + filter + mobile drawer */
(function sidebar(){
  const aside   = document.querySelector("aside");
  const links   = [...document.querySelectorAll("aside nav a[href^='#']")];
  const search  = document.getElementById("search");
  const menuBtn = document.getElementById("menuBtn");
  const scrim   = document.querySelector(".scrim");

  /* highlight the section currently on screen */
  const sections = links
    .map(a => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);
  if (sections.length) {
    const obs = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) links.forEach(l =>
        l.classList.toggle("active", l.getAttribute("href") === "#" + e.target.id));
    }), { rootMargin: "0px 0px -75% 0px" });
    sections.forEach(s => obs.observe(s));
  }

  /* filter the topic list */
  if (search) search.addEventListener("input", e => {
    const q = e.target.value.toLowerCase().trim();
    links.forEach(l => l.classList.toggle("hidden", q && !l.textContent.toLowerCase().includes(q)));
    document.querySelectorAll("aside h2").forEach(h => {
      const nav = h.nextElementSibling;
      if (!nav || nav.tagName !== "NAV") return;
      const any = [...nav.children].some(a => !a.classList.contains("hidden"));
      h.classList.toggle("hidden", !any);
      nav.classList.toggle("hidden", !any);
    });
  });

  /* mobile drawer */
  const close = () => { aside?.classList.remove("open"); scrim?.classList.remove("open"); };
  menuBtn?.addEventListener("click", () => {
    aside?.classList.toggle("open");
    scrim?.classList.toggle("open", aside?.classList.contains("open"));
  });
  scrim?.addEventListener("click", close);
  links.forEach(l => l.addEventListener("click", () => {
    if (window.matchMedia("(max-width:880px)").matches) close();
  }));
  document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
})();

/* Interview Q&A pages: expand / collapse all answers */
(function qa(){
  const items = [...document.querySelectorAll("details.qa")];
  const btn = document.getElementById("toggleAll");
  const count = document.getElementById("qaCount");
  if (count) count.textContent = items.length + " questions";
  if (!btn || !items.length) return;
  const label = () => btn.textContent =
    items.every(d => d.open) ? "Collapse all" : "Expand all";
  btn.onclick = () => {
    const open = !items.every(d => d.open);
    items.forEach(d => d.open = open);
    label();
  };
  items.forEach(d => d.addEventListener("toggle", label));
  /* print everything expanded */
  window.addEventListener("beforeprint", () => items.forEach(d => d.open = true));
})();

/* LeetCode cheat sheet: tabs + "solved" tracking */
(function cheatSheet(){
  const tabs = [...document.querySelectorAll(".tab")];
  if (!tabs.length) return;
  const panels = tabs.map(t => document.getElementById(t.getAttribute("aria-controls")));
  const show = (i) => {
    tabs.forEach((t, j) => { t.setAttribute("aria-selected", String(i === j)); t.tabIndex = i === j ? 0 : -1; });
    panels.forEach((p, j) => p && (p.hidden = i !== j));
    const key = tabs[i].id.replace("tab-", "");                  // sidebar shows only this level's topics
    document.querySelectorAll("aside [data-tab]").forEach(el =>
      el.classList.toggle("tab-off", el.dataset.tab !== key));
    try { localStorage.setItem("cheat-tab", tabs[i].id); } catch (e) {}
  };
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => show(i));
    t.addEventListener("keydown", e => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const n = (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
        show(n); tabs[n].focus();
      }
    });
  });
  let saved = null;
  try { saved = localStorage.getItem("cheat-tab"); } catch (e) {}
  show(Math.max(0, tabs.findIndex(t => t.id === saved)));

  /* "Solved" checkbox on every problem, remembered in this browser */
  let done = {};
  try { done = JSON.parse(localStorage.getItem("cheat-solved") || "{}"); } catch (e) {}
  const items = [...document.querySelectorAll("details.lc")];
  const refresh = () => panels.forEach(p => {
    if (!p) return;
    const all = p.querySelectorAll("details.lc"), n = p.querySelectorAll("details.lc.done").length;
    const fill = p.querySelector(".progress .fill"), label = p.querySelector(".progress .count");
    if (fill) fill.style.width = all.length ? (100 * n / all.length) + "%" : "0";
    if (label) label.textContent = n + " / " + all.length + " solved";
  });
  items.forEach(d => {
    const id = d.id;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "solved";
    btn.innerHTML = '<span class="box" aria-hidden="true"></span>Solved';
    const set = (on) => {
      btn.setAttribute("aria-pressed", String(on));
      d.classList.toggle("done", on);
    };
    set(!!done[id]);
    btn.addEventListener("click", e => {
      e.preventDefault(); e.stopPropagation();                     // don't open/close the problem
      const on = btn.getAttribute("aria-pressed") !== "true";
      set(on);
      if (on) done[id] = true; else delete done[id];
      try { localStorage.setItem("cheat-solved", JSON.stringify(done)); } catch (e) {}
      refresh();
    });
    d.querySelector("summary").appendChild(btn);
  });
  refresh();
})();
