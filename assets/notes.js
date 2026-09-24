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
