"""Builds the static portfolio into site/.

    python build.py                      # build site/
    python -m http.server 8765 -d site   # preview it at http://localhost:8765/

site/ is the ONLY thing that should ever be published. It gets the generated pages (one folder per
project / internship, so every page has a clean URL), assets/ and everything in static/. Nothing in
_private/ is ever copied, except restricted images when their flag below is switched on.

Folder layout
  assets/    css, js, images used by the pages (copied to site/assets/)
  static/    files copied as-is: résumés, full-size diagrams, NumIsToken mockups
  _private/  never published or committed: repo dumps, design guide, unused images, restricted figures

Shared chrome (masthead, dual nav, footer) lives here once; page bodies live in pages.py. Charts are
generated as inline SVG from the real reported metrics in charts.py.
"""
import shutil
from pathlib import Path

import pages

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "site"

# CBU inverse-FEA figures and exact results are unpublished research (IEEE paper in progress).
# Keep False until the PI / team approves them for the public web. While False, the CBU page shows a
# results-free write-up and the figures are never copied into site/.
CBU_FIGURES_PUBLIC = False

NAME = "Braedyn Thompson"
GITHUB = "https://github.com/braaaeeedyn"
EMAIL = "braedynthompson@berkeley.edu"
LINKEDIN = "https://www.linkedin.com/in/braedyn-thompson-67a396284/"
# One résumé per target track: (key, label, path)
RESUMES = [
    ("aiml", "AI / ML", "resumes/CV_BraedynThompson28AIML.pdf"),
    ("de", "Data Engineering", "resumes/CV_BraedynThompson28DE.pdf"),
    ("ds", "Data Science", "resumes/CV_BraedynThompson28DS.pdf"),
]

PROJECTS = [
    ("academy-of-testers", "Academy of Testers"),
    ("seismicsocal", "SeismicSoCal"),
    ("bearlm", "BearLM"),
]
EXPERIENCE = [
    ("lawrence-berkeley-lab", "Berkeley Lab"),
    ("cbu-seismicsocal", "CBU Research"),
    ("numistoken", "NumIsToken"),
    ("kigumi-group", "Kigumi Group"),
]

FONTS = ("https://fonts.googleapis.com/css2?family=Archivo+Black&family=Silkscreen"
         "&family=VT323&display=swap")

AVATAR = (
    # 12x12 pixel-art monogram "B" plate, drawn as an SVG so it scales crisply.
    "<svg class='avatar' viewBox='0 0 12 12' aria-hidden='true' shape-rendering='crispEdges'>"
    "<rect width='12' height='12' fill='#9fbee7'/>"
    "<rect x='0' y='9' width='12' height='3' fill='#7a8aba'/>"
    "<path fill='#21242e' d='M3 2h5v1h1v2h-1v1h1v2h-1v1h-5zM4 3v2h3v-2zM4 6v2h4v-2z'/>"
    "<rect x='9' y='2' width='1' height='1' fill='#e60012'/>"
    "</svg>"
)


def nav(rel, current):
    def cur(key):
        return " aria-current='page'" if key == current else ""

    links = [
        ("index.html", "Home", "home"),
        ("index.html#roles", "Roles", "roles"),
        ("index.html#projects", "Projects", "projects"),
        ("index.html#experience", "Experience", "experience"),
        ("index.html#contact", "Contact", "contact"),
    ]
    nav_html = "".join(f"<li><a href='{rel}{h}'{cur(k)}>{t}</a></li>" for h, t, k in links)
    sub = ["<span class='group'>Projects</span>"]
    sub += [f"<a href='{rel}projects/{s}/'{cur(s)}>{t}</a>" for s, t in PROJECTS]
    sub += ["<span class='group'>Internships</span>"]
    sub += [f"<a href='{rel}experience/{s}/'{cur(s)}>{t}</a>" for s, t in EXPERIENCE]
    return f"""
<header class="shell">
  <div class="masthead">
    <div class="mascot">
      <a class="avatar-link" href="{rel}index.html" aria-label="Home">{AVATAR}</a>
      <p class="bubble">Welcome to <b>{NAME}</b>'s portfolio!<br><a href="{rel}index.html#roles">See the roles I'm targeting &rarr;</a></p>
    </div>
    <div class="now">
      <span class="now-label">Now playing</span>
      <div class="now-chips">
        <span class="lcd-chip halftone"><span class="dot"></span>Berkeley Lab</span>
        <span class="lcd-chip halftone"><span class="dot"></span>SeismicSoCal</span>
        <span class="lcd-chip halftone"><span class="dot"></span>BearLM</span>
      </div>
    </div>
  </div>
  <nav class="navbar halftone" aria-label="Primary">
    <a class="logo-pill" href="{rel}index.html"><span>BRAEDYN</span></a>
    <ul class="nav-links">{nav_html}</ul>
    <div class="nav-utility">
      <a class="chip" href="{rel}index.html#resumes">R&eacute;sum&eacute;s</a>
      <a class="chip" href="{GITHUB}" rel="noopener">GitHub</a>
    </div>
  </nav>
  <nav class="subnav" aria-label="Pages">{''.join(sub)}</nav>
</header>"""


def footer(rel):
    return f"""
<footer class="shell footer-wrap">
  <div class="footer halftone chamfer">
    <div>
      &copy;2026 {NAME}. All projects, metrics and diagrams are my own work; numbers are reported
      from each project's evaluation harness on held-out data.
      <div class="links">
        <a href="mailto:{EMAIL}">Email</a>
        <a href="{GITHUB}" rel="noopener">GitHub</a>
        <a href="{LINKEDIN}" rel="noopener">LinkedIn</a>
        {''.join(f'<a href="{rel}{path}" target="_blank" rel="noopener">R&eacute;sum&eacute; ({label})</a>' for _, label, path in RESUMES)}
      </div>
    </div>
    <span class="badge"><strong>HAND-BUILT</strong>HTML &middot; CSS &middot; SVG</span>
  </div>
</footer>"""


def _ver(path):
    """Short content hash, appended to CSS/JS URLs so browsers fetch the new file after every change."""
    import hashlib
    return hashlib.md5((ROOT / path).read_bytes()).hexdigest()[:8]


def page(rel, key, title, description, hero, body):
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{description}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta name="theme-color" content="#21242e">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTS}">
<link rel="stylesheet" href="{rel}assets/css/site.css?v={_ver("assets/css/site.css")}">
<script>document.documentElement.classList.add("js")</script>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Crect width='12' height='12' rx='2' fill='%2321242e'/%3E%3Cpath fill='%23ecab37' d='M3 2h5v1h1v2h-1v1h1v2h-1v1h-5zM4 3v2h3v-2zM4 6v2h4v-2z'/%3E%3C/svg%3E">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
{nav(rel, key)}
<div class="shell">
{hero}
<main id="main">
{body}
</main>
</div>
{footer(rel)}
<script src="{rel}assets/js/site.js?v={_ver("assets/js/site.js")}"></script>
</body>
</html>
"""


def build():
    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(ROOT / "assets", OUT / "assets")
    shutil.copytree(ROOT / "static", OUT, dirs_exist_ok=True)
    if CBU_FIGURES_PUBLIC:
        for f in (ROOT / "_private" / "restricted-img").glob("cbu-*"):
            shutil.copy2(f, OUT / "assets" / "img" / "slots" / f.name)
    out = []
    for spec in pages.ALL:
        rel = "" if spec["path"] == "" else "../../"
        ctx = {"rel": rel, "github": GITHUB, "email": EMAIL, "linkedin": LINKEDIN, "resumes": RESUMES,
               "cbu_public": CBU_FIGURES_PUBLIC}
        hero, body = spec["render"](ctx)
        html = page(rel, spec["key"], spec["title"], spec["description"], hero, body)
        dest = OUT / spec["path"] / "index.html"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(html, encoding="utf-8")
        out.append(dest.relative_to(OUT).as_posix())
    print(f"built site/  (CBU figures public: {CBU_FIGURES_PUBLIC})", *out, sep="\n  ")


if __name__ == "__main__":
    build()
