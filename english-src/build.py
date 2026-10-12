# Builds ../notes/english-communication.html from content.py.
# Run from anywhere:  python3 preparation/english-src/build.py
import os
from html import escape as e
from content import (CHAPTERS, SOCIAL, VOCAB, VOCAB_SAY, LINKERS, SOFTENERS, POWER_VERBS, PHRASAL, CORPORATE,
                     IDIOMS, GENZ, CONFUSED, PRONOUNCE, AVOID, FILLERS, PLAN)

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "notes", "english-communication.html")
TAG = {"F": ("Formal", "f"), "I": ("Informal", "i"), "B": ("Both", "b")}


def entry(phrase, meaning, example, tag, where, instead=""):
    label, cls = TAG[tag]
    swap = f'<p class="ph-swap"><span>Instead of</span> {e(instead)}</p>' if instead else ""
    return f'''<div class="ph">
  {swap}
  <div class="ph-top"><h4>{e(phrase)}</h4><span class="tg {cls}">{label}</span></div>
  <p class="ph-mean">{e(meaning)}</p>
  <p class="ph-ex">“{e(example)}”</p>
  <p class="ph-where"><b>Use it:</b> {e(where)}</p>
</div>'''


def table(head, rows, cls=""):
    th = "".join(f"<th>{e(h)}</th>" for h in head)
    body = "".join("<tr>" + "".join(f"<td>{e(c)}</td>" for c in r) + "</tr>" for r in rows)
    return f'<div class="table-wrap"><table class="{cls}"><tr>{th}</tr>{body}</table></div>'


nav_situations, nav_social, nav_words, body = [], [], [], []
n = 0


def chapters(items, nav, label):
    """Render phrase-card chapters, numbering on from the global counter."""
    global n
    for ch in items:
        n += 1
        nav.append(f'<a href="#s{n}">{n} · {e(ch["title"])}</a>')
        parts = [f'<section id="s{n}">', f'<h3>{n}. {e(ch["title"])}</h3>',
                 f'<div class="plain"><span class="plain-label">{label}</span><p>{e(ch["intro"])}</p></div>']
        for title, rows in ch["sections"]:
            parts.append(f'<h4>{e(title)}</h4><div class="ph-grid">')
            parts.extend(entry(*it) for it in rows)
            parts.append("</div>")
        parts.append("</section>")
        body.append("\n".join(parts))


body.append('<div class="part">Part 1 — Work Situations</div>')
chapters(CHAPTERS, nav_situations, "The principle")
body.append('<div class="part">Part 2 — Everyday &amp; Social (Informal, but Eloquent)</div>')
chapters(SOCIAL, nav_social, "The vibe")

extras = [
    ("Advanced Vocabulary",
     "Words that make you sound precise rather than ornate. Aim to own 3–5 a week — use each one in a real sentence before moving on. In \"Say it\", CAPITALS mark the stressed syllable.",
     table(["Word", "Say it", "Meaning", "Example"],
           [(w, VOCAB_SAY[w], m, ex) for w, m, ex in VOCAB], "ex-last say")),
    ("Linkers That Make You Articulate",
     "Articulate speakers connect ideas. These linkers turn a list of sentences into a line of reasoning.",
     table(["Linker", "Use it to…", "Example"], LINKERS, "ex-last")),
    ("Diplomatic Softeners",
     "The difference between blunt and polished is often one softening phrase. Use these when challenging seniors, clients or peers.",
     table(["Softener", "Why it works", "Example"], SOFTENERS, "ex-last")),
    ("Power Verbs for Your Wins",
     "For CVs, appraisals and interviews. Strong verbs + a number = credibility.",
     table(["Instead of", "Try", "Example"], POWER_VERBS, "ex-last")),
    ("Phrasal Verbs Natives Use",
     "Fluent professionals lean on phrasal verbs constantly. Mastering these makes your English sound natural, not textbook.",
     table(["Phrasal verb", "Meaning", "Example"], PHRASAL, "ex-last")),
    ("Corporate Vocabulary",
     "Know these to decode meetings instantly. Use sparingly — one or two per conversation keeps you sharp, not jargon-heavy.",
     table(["Term", "Meaning", "Example"], CORPORATE, "ex-last")),
    ("Idioms for the Workplace",
     "One well-timed idiom signals fluency. Make sure the context fits — a misused idiom is worse than none.",
     table(["Idiom", "Meaning", "Example"], IDIOMS, "ex-last")),
    ("Gen Z Terms (Informal Only)",
     "Useful for decoding younger colleagues and social media. Keep them out of emails, client calls and senior meetings.",
     table(["Term", "Meaning", "Example"], GENZ, "ex-last")),
    ("Commonly Confused Words",
     "Even fluent speakers slip on these. Getting them right quietly signals precision.",
     table(["Pair", "The rule", "Example"], CONFUSED, "ex-last")),
    ("Commonly Mispronounced Words",
     "Pronunciation is part of polish. These come up often at work and are frequently said incorrectly.",
     table(["Word", "Say it like", "Tip"], PRONOUNCE)),
    ("Phrases to Retire",
     "Common in Indian offices, but they read as dated or incorrect to global teams. Swap them for the modern version.",
     table(["Retire", "Say this instead"], AVOID, "avoid")),
    ("Fillers → Confident Bridges",
     "Fillers dilute authority. A short silent pause sounds more confident than any filler word.",
     table(["Filler habit", "Better choice"], FILLERS)),
]
body.append('<div class="part">Part 3 — Word Power</div>')
for title, intro, html in extras:
    n += 1
    nav_words.append(f'<a href="#s{n}">{n} · {e(title)}</a>')
    body.append(f'''<section id="s{n}">
<h3>{n}. {e(title)}</h3>
<div class="plain"><span class="plain-label">The principle</span><p>{e(intro)}</p></div>
{html}
</section>''')

plan_rows = "".join(
    f'<label class="day"><input type="checkbox" data-day="{d}"><span class="d">Day {d}</span>'
    f'<span class="t"><b>{e(topic)}</b>{e(task)}</span></label>' for d, topic, task in PLAN)

total = sum(len(items) for ch in CHAPTERS + SOCIAL for _, items in ch["sections"]) \
    + sum(len(x) for x in (VOCAB, LINKERS, SOFTENERS, POWER_VERBS, PHRASAL, CORPORATE, IDIOMS, GENZ, CONFUSED, PRONOUNCE))

page = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>English for Work &amp; Life</title>
<link rel="stylesheet" href="../assets/notes.css">
<script>
  try {{ document.documentElement.setAttribute("data-theme",
    localStorage.getItem("notes-theme") || "light"); }} catch (e) {{}}
</script>
<style>
/* Page-only styles: phrase cards, formal/informal tags, 30-day tracker */
:root{{ --tf:#2f5f9e; --tf-bg:#e7eefa; --ti:#b5485d; --ti-bg:#fbe9ed; --tb:#2f6f4e; --tb-bg:#e3f1e8; }}
html[data-theme="dark"]{{ --tf:#8fb4ee; --tf-bg:#22324a; --ti:#f09aac; --ti-bg:#43262d; --tb:#7fc8a0; --tb-bg:#21392b; }}
.ph-grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px;margin:10px 0 18px;}}
.ph{{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 14px;}}
.ph-top{{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;}}
.ph h4{{margin:0;font-size:15.5px;line-height:1.35;color:var(--text);text-transform:none;letter-spacing:0;}}
.ph-mean{{margin:5px 0 7px;color:var(--muted);font-size:14px;}}
.ph-ex{{margin:0 0 7px;font-family:Georgia,"Times New Roman",serif;font-style:italic;font-size:15px;}}
.ph-where{{margin:0;font-size:12.8px;color:var(--muted);}}
.ph-where b{{color:var(--text);font-weight:600;}}
.ph-swap{{margin:0 0 8px;font-size:12.8px;color:var(--muted);text-decoration:line-through;text-decoration-color:color-mix(in srgb,var(--ti) 60%,transparent);}}
.ph-swap span{{text-decoration:none;display:inline-block;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;color:var(--ti);margin-right:4px;}}
.tg{{font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:999px;white-space:nowrap;}}
.tg.f{{color:var(--tf);background:var(--tf-bg);}}
.tg.i{{color:var(--ti);background:var(--ti-bg);}}
.tg.b{{color:var(--tb);background:var(--tb-bg);}}
.legend{{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;font-size:13.5px;color:var(--muted);margin-top:8px;}}
table.say td:nth-child(2){{color:var(--tf);font-weight:600;white-space:nowrap;letter-spacing:.02em;}}
table.ex-last td:last-child{{font-family:Georgia,"Times New Roman",serif;font-style:italic;}}
table td:first-child{{font-weight:600;}}
table.avoid td:first-child{{text-decoration:line-through;color:var(--ti);font-weight:500;}}
table.avoid td:last-child{{color:var(--tb);font-weight:600;}}
.bar{{height:8px;background:var(--code-bg);border-radius:99px;overflow:hidden;margin:6px 0 14px;}}
.bar i{{display:block;height:100%;width:0;background:var(--accent);transition:width .3s;}}
.progress{{font-size:14px;color:var(--muted);}}
.days{{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px;}}
.day{{display:flex;gap:10px;align-items:flex-start;background:var(--panel);border:1px solid var(--line);
  border-radius:10px;padding:10px 12px;cursor:pointer;font-size:14px;}}
.day input{{margin-top:4px;accent-color:var(--accent);}}
.day .d{{font-weight:700;min-width:50px;color:var(--muted);}}
.day .t b{{display:block;}}
.day:has(input:checked){{opacity:.55;}}
.day:has(input:checked) .t{{text-decoration:line-through;}}
@media print{{.ph,.day{{break-inside:avoid;}}}}
</style>
</head>
<body>
<div class="scrim"></div>
<button class="icon-btn" id="reopen" title="Show sidebar ([)" aria-label="Show sidebar">☰</button>
<div class="layout">

<aside>
  <div class="sidebar-head">
    <a class="back-link" href="../index.html">← All topics</a>
    <button class="icon-btn" id="collapseBtn" title="Hide sidebar ([)" aria-label="Hide sidebar">‹</button>
  </div>
  <input id="search" type="text" placeholder="Filter topics…" autocomplete="off">

  <h2>Start Here</h2>
  <nav>
    <a href="#how">How to Use This Page</a>
  </nav>

  <h2>Work Situations</h2>
  <nav>
    {chr(10).join("    " + a for a in nav_situations).strip()}
  </nav>

  <h2>Everyday &amp; Social</h2>
  <nav>
    {chr(10).join("    " + a for a in nav_social).strip()}
  </nav>

  <h2>Word Power</h2>
  <nav>
    {chr(10).join("    " + a for a in nav_words).strip()}
  </nav>

  <h2>Practice</h2>
  <nav>
    <a href="#plan">30-Day Plan</a>
  </nav>
</aside>

<main>
<nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="../index.html">Home</a></li><li><a href="../index.html#aptitude">Aptitude</a></li><li><span>English for Work &amp; Life</span></li><li><span aria-current="page">Notes</span></li></ol></nav>
<header class="top">
  <h1>English for Work &amp; Life</h1>
  <div class="top-actions">
    <button class="ghost" id="menuBtn">☰ Topics</button>
    <button class="ghost" id="theme">Dark mode</button>
  </div>
</header>
<p class="sub">{total}+ polished phrases, power words and idioms for fluent speakers who want to sound sharper at work — and more expressive with friends and family. Every phrase shows the plain version it replaces.</p>

<section id="how">
<h3>How to Use This Page</h3>
<div class="plain"><span class="plain-label">The idea</span>
<p>You're already fluent. This page is about <b>range and precision</b> — swapping the default phrase for the one that sounds considered, confident and senior.</p>
<p class="analogy">Each card shows the plain line you probably use today, then the upgrade. Learn the swap, not the definition.</p></div>
<ol>
<li><b>Pick 3 swaps a day</b> from one section — or follow the 30-day plan at the end.</li>
<li><b>Say them aloud in your own context</b>: your project, your manager, your client.</li>
<li><b>Deploy one in a real conversation today.</b> Retrieval in context is what makes words stick.</li>
<li><b>Listen for them</b> in podcasts, earnings calls and senior colleagues — noticing reinforces memory.</li>
<li><b>Revise on Day 1, 3, 7 and 21.</b> Spaced repetition moves words into active vocabulary.</li>
</ol>
<div class="legend">Labels on every phrase:
  <span class="tg f">Formal</span> clients, seniors, emails
  <span class="tg i">Informal</span> friends, teammates
  <span class="tg b">Both</span> safe anywhere
</div>
<div class="note"><b>Remember:</b> polish isn't about big words. It's about the precise word, delivered without hesitation.</div>
</section>

{chr(10).join(body)}

<div class="part">Part 4 — Practice</div>
<section id="plan">
<h3>Your 30-Day Plan</h3>
<div class="plain"><span class="plain-label">In plain words</span>
<p>One deliberate practice task a day. Tick it off when done — your progress is saved in this browser.</p></div>
<div class="progress" id="progressText">0 of 30 days done</div>
<div class="bar"><i id="progressBar"></i></div>
<div class="days">{plan_rows}</div>
<div class="note"><b>Remember:</b> small daily practice beats one long weekend session. After Day 30, start again — round two is easier.</div>
</section>

</main>
</div>

<script src="../assets/notes.js"></script>
<script src="../assets/annotate.js"></script>
<script>
/* 30-day tracker: progress kept in this browser only */
(function plan() {{
  const boxes = [...document.querySelectorAll(".day input")];
  let done = {{}};
  try {{ done = JSON.parse(localStorage.getItem("english-plan") || "{{}}"); }} catch (e) {{}}
  function update() {{
    const c = boxes.filter(b => b.checked).length;
    document.getElementById("progressText").textContent = c + " of 30 days done";
    document.getElementById("progressBar").style.width = (c / 30 * 100) + "%";
  }}
  boxes.forEach(b => {{
    b.checked = !!done[b.dataset.day];
    b.addEventListener("change", () => {{
      done[b.dataset.day] = b.checked;
      try {{ localStorage.setItem("english-plan", JSON.stringify(done)); }} catch (e) {{}}
      update();
    }});
  }});
  update();
}})();
</script>
</body>
</html>
'''

with open(OUT, "w") as f:
    f.write(page)
print("wrote", os.path.normpath(OUT), "| sections:", n, "| phrases:", total)
