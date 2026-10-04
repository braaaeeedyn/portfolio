"""Page bodies. Each page is a dict with path/key/title/description and a render(ctx) -> (hero, body).

Image slots: slot("aot-radar", ...) renders a frame that loads assets/img/slots/aot-radar.{webp,png,jpg}
if it exists, otherwise a labelled placeholder. Drop screenshots in with those names and rebuild is
not even needed.
"""
from pathlib import Path

import charts as C

# ============================================================================ building blocks


def panel(pid, title, body, cls="", num="", dark=False, body_cls="panel-body prose"):
    n = f"<span class='num'>{num}</span>" if num else ""
    bar_cls = "label-bar dark halftone" if dark else "label-bar"
    idattr = f" id='{pid}'" if pid else ""
    return (f"<section class='panel {cls}'{idattr} aria-labelledby='{pid}-h'>"
            f"<h2 class='{bar_cls}' id='{pid}-h'><span class='glyph'></span>{title}{n}</h2>"
            f"<div class='{body_cls}'>{body}</div></section>")


def slot(rel, name, title, hint, ratio="16 / 9", contain=False):
    cls = "slot is-empty contain" if contain else "slot is-empty"
    return (f"<figure class='{cls}' data-src='{rel}assets/img/slots/{name}' style='--ratio:{ratio}'>"
            f"<div class='frame'><img alt='{title}' loading='lazy'>"
            f"<div class='placeholder'><span class='ph-badge'>IMAGE SLOT</span>"
            f"<span class='ph-title'>{title}</span>"
            f"<span class='ph-file'>assets/img/slots/{name}.png</span>"
            f"<span class='ph-hint'>{hint}</span></div></div>"
            f"<figcaption><b>Screenshot</b>{title}</figcaption></figure>")



# Mascot callout: the masthead "B" mascot pops up with a speech bubble and something that points at
# the content. Each "character" is an accessory worn on the mascot plus a pointer prop. Characters rotate
# through the page so they don't all look the same; site.js adds random idle tricks and hover moves.

def _mascot_svg(inside=""):
    return ("<svg class='tip-avatar' viewBox='0 0 12 12' aria-hidden='true' shape-rendering='crispEdges'>"
            "<rect width='12' height='12' fill='#9fbee7'/><rect x='0' y='9' width='12' height='3' fill='#7a8aba'/>"
            "<path fill='#21242e' d='M3 2h5v1h1v2h-1v1h1v2h-1v1h-5zM4 3v2h3v-2zM4 6v2h4v-2z'/>"
            "<rect x='9' y='2' width='1' height='1' fill='#e60012'/>"
            f"<g shape-rendering='geometricPrecision'>{inside}</g></svg>")


def _star(x, y, r=3.0, cls="", fill="#ffe680"):
    a, b = r, r * .28
    return (f"<path class='{cls}' transform='translate({x} {y})' fill='{fill}' stroke='#7a5a10' stroke-width='.4' "
            f"d='M0 {-a} L{b} {-b} L{a} 0 L{b} {b} L0 {a} L{-b} {b} L{-a} 0 L{-b} {-b} Z'/>")


# ---------------------------------------------------------------- accessories (worn on the mascot)
HATS = {
    "scholar": ("<svg class='tip-acc hat' viewBox='0 0 24 14' aria-hidden='true'>"
                "<path d='M12 1 L23 5.5 L12 10 L1 5.5 Z' fill='#21242e' stroke='#000' stroke-width='.8' stroke-linejoin='round'/>"
                "<path d='M6 7.6 V11 Q12 13.6 18 11 V7.6 L12 10 Z' fill='#3d4f97' stroke='#000' stroke-width='.8'/>"
                "<path d='M12 5.5 L19.5 7.5 V11' fill='none' stroke='#ecab37' stroke-width='.9'/>"
                "<circle cx='19.5' cy='11.6' r='1.1' fill='#ecab37'/></svg>"),
    "explorer": ("<svg class='tip-acc hat' viewBox='0 0 28 15' aria-hidden='true'>"
                 "<ellipse cx='14' cy='12' rx='13' ry='2.6' fill='#c9ad74' stroke='#5c4420' stroke-width='.8'/>"
                 "<path d='M5 12 Q5 2 14 2 Q23 2 23 12 Z' fill='#e2c98f' stroke='#5c4420' stroke-width='.8'/>"
                 "<path d='M5.6 9.4 Q14 11.4 22.4 9.4 L22.7 11.2 Q14 13.2 5.3 11.2 Z' fill='#6b4a1e'/>"
                 "<circle cx='14' cy='2.4' r='1' fill='#c9ad74' stroke='#5c4420' stroke-width='.5'/></svg>"),
    "wizard": ("<svg class='tip-acc hat tall' viewBox='0 0 26 26' aria-hidden='true'>"
               "<ellipse cx='13' cy='22.5' rx='12' ry='2.6' fill='#3d4f97' stroke='#1f2a5c' stroke-width='.8'/>"
               "<path d='M5 22.5 Q9 13 12 7 Q14.5 2.5 19 1.5 Q16 5 16.5 9 Q18.5 16 21 22.5 Z' fill='#4b5fb3' stroke='#1f2a5c' stroke-width='.8' stroke-linejoin='round'/>"
               + _star(11.5, 15.5, 2.2) + _star(16, 11, 1.5) + _star(8.5, 19.8, 1.2) + "</svg>"),
    "arcade": ("<svg class='tip-acc phones' viewBox='0 0 34 30' aria-hidden='true'>"
               "<path d='M6 18 Q6 2 17 2 Q28 2 28 18' fill='none' stroke='#21242e' stroke-width='3'/>"
               "<path d='M6 18 Q6 2 17 2 Q28 2 28 18' fill='none' stroke='#60619c' stroke-width='1.2'/>"
               "<rect x='1' y='14' width='7' height='11' rx='2.5' fill='#3d4f97' stroke='#21242e' stroke-width='1.2'/>"
               "<rect x='26' y='14' width='7' height='11' rx='2.5' fill='#3d4f97' stroke='#21242e' stroke-width='1.2'/>"
               "<rect x='2.6' y='16.5' width='2' height='6' rx='1' fill='#9fbee7'/>"
               "<rect x='29.4' y='16.5' width='2' height='6' rx='1' fill='#9fbee7'/></svg>"),
    "detective": ("<svg class='tip-acc hat' viewBox='0 0 30 19' aria-hidden='true'>"
                  "<rect x='7.4' y='9.5' width='3.4' height='7' rx='1.4' fill='#6e5f4d' stroke='#3b3026' stroke-width='.7'/>"
                  "<rect x='19.2' y='9.5' width='3.4' height='7' rx='1.4' fill='#6e5f4d' stroke='#3b3026' stroke-width='.7'/>"
                  "<path d='M7 11 Q7 2.6 15 2.6 Q23 2.6 23 11 Z' fill='#857360' stroke='#3b3026' stroke-width='.8'/>"
                  "<path d='M7.6 6.5 H22.4 M7.2 9 H22.8 M10.5 3.6 V11 M15 2.7 V11 M19.5 3.6 V11' stroke='#5c4d3c' stroke-width='.55'/>"
                  "<path d='M8.6 5.2 H21.4 M12.7 3 V11 M17.3 3 V11' stroke='#b3a189' stroke-width='.4'/>"
                  "<path d='M7.4 10.4 Q3 10.6 0.8 13.4 Q5 13.6 9.4 11.8 Z' fill='#77675a' stroke='#3b3026' stroke-width='.7'/>"
                  "<path d='M22.6 10.4 Q27 10.6 29.2 13.4 Q25 13.6 20.6 11.8 Z' fill='#77675a' stroke='#3b3026' stroke-width='.7'/>"
                  "<path d='M12.6 2.9 Q15 0.4 17.4 2.9 M15 1.7 L13.6 0.6 M15 1.7 L16.4 0.6' fill='none' stroke='#3b3026' stroke-width='.7'/></svg>"),
    "builder": ("<svg class='tip-acc hat' viewBox='0 0 26 14' aria-hidden='true'>"
                "<path d='M1 11.5 H25 Q25 13.4 23 13.4 H3 Q1 13.4 1 11.5 Z' fill='#e0a800' stroke='#6b4f00' stroke-width='.8'/>"
                "<path d='M4 11.5 Q4 2 13 2 Q22 2 22 11.5 Z' fill='#f5c518' stroke='#6b4f00' stroke-width='.8'/>"
                "<path d='M11.6 2.3 H14.4 V11.5 H11.6 Z' fill='#e0a800' stroke='#6b4f00' stroke-width='.5'/>"
                "<path d='M6.5 6 Q8 4 10 3.4' fill='none' stroke='#fff3b0' stroke-width='.9' stroke-linecap='round'/></svg>"),
    "pirate": ("<svg class='tip-acc hat' viewBox='0 0 30 15' aria-hidden='true'>"
               "<path d='M1 8 Q8 13 15 12.6 Q22 13 29 8 Q26 3.4 22 4.6 Q18 0.6 15 1 Q12 0.6 8 4.6 Q4 3.4 1 8 Z' fill='#21242e' stroke='#000' stroke-width='.8'/>"
               "<path d='M2.6 8.3 Q8 11.6 15 11.3 Q22 11.6 27.4 8.3' fill='none' stroke='#ecab37' stroke-width='.9'/>"
               "<circle cx='15' cy='6.4' r='1.9' fill='#fff'/>"
               "<path d='M14.2 6.2 h.5 M15.3 6.2 h.5 M13.6 8.6 L16.4 9.6 M16.4 8.6 L13.6 9.6' stroke='#21242e' stroke-width='.45'/></svg>"),
    "berkeley": ("<svg class='tip-acc hat' viewBox='0 0 28 14' aria-hidden='true'>"
                 "<path d='M14 11.4 L27 11.6 Q26.6 13.6 22 13.4 L14 12.8 Z' fill='#002247' stroke='#000d1f' stroke-width='.7'/>"
                 "<path d='M3 12 Q3 2 13 2 Q21 2 21 11.6 Z' fill='#003262' stroke='#000d1f' stroke-width='.8'/>"
                 "<path d='M3.4 10.6 Q12 12 20.8 10.4' fill='none' stroke='#fdb515' stroke-width='.9'/>"
                 "<circle cx='12' cy='2.3' r='1' fill='#fdb515'/>"
                 "<text x='11.6' y='9.4' text-anchor='middle' font-family='Georgia, serif' font-weight='700' font-style='italic' "
                 "font-size='7' fill='#fdb515'>C</text></svg>"),
}

EYEPATCH = ("<path d='M1 2.6 L11 5.4' stroke='#21242e' stroke-width='.45'/>"
            "<ellipse cx='4.3' cy='3.9' rx='1.7' ry='1.5' fill='#21242e'/>")

# ---------------------------------------------------------------- pointer props (each points RIGHT by default)
HAND = ("<svg class='tip-prop tip-hand' viewBox='0 0 40 30' aria-hidden='true'>"
        "<g fill='#fff' stroke='#21242e' stroke-width='2' stroke-linejoin='round'>"
        "<rect x='1' y='8' width='7' height='16' rx='2' fill='#dfe4f2'/>"
        "<rect x='6' y='6' width='16' height='20' rx='6'/>"
        "<rect x='16' y='7' width='22' height='7' rx='3.5'/>"
        "<rect x='16' y='13' width='9' height='5' rx='2.5'/>"
        "<rect x='16' y='17' width='8' height='5' rx='2.5'/>"
        "<rect x='15' y='21' width='7' height='4.5' rx='2.2'/>"
        "<path d='M9 9 C11 3 17 3 18 8' fill='#fff'/>"
        "</g></svg>")

LENS = ("<svg class='tip-prop tip-lens' viewBox='0 0 40 40' aria-hidden='true'>"
        "<path d='M24 24 L36 36' stroke='#21242e' stroke-width='5.5' stroke-linecap='round'/>"
        "<path d='M25.5 25.5 L35 35' stroke='#3d4f97' stroke-width='2.4' stroke-linecap='round'/>"
        "<circle cx='15' cy='15' r='11.5' fill='rgba(159,190,231,.35)' stroke='#21242e' stroke-width='3.2'/>"
        "<circle cx='15' cy='15' r='9' fill='none' stroke='#fff' stroke-width='1.2' opacity='.8'/>"
        "<path d='M9 11 Q11 7.5 15 7' fill='none' stroke='#fff' stroke-width='2' stroke-linecap='round'/>"
        "</svg>")

COMPASS = ("<svg class='tip-prop tip-compass' viewBox='0 0 40 40' aria-hidden='true'>"
           "<circle cx='20' cy='20' r='17.5' fill='#c9a24a' stroke='#21242e' stroke-width='2.4'/>"
           "<circle cx='20' cy='20' r='13.5' fill='#fffaf0' stroke='#8a6a3a' stroke-width='1'/>"
           "<path d='M20 7.5v3 M20 29.5v3 M7.5 20h3 M29.5 20h3' stroke='#21242e' stroke-width='1.3'/>"
           "<g class='needle'><path d='M20 8.5 L23 20 L17 20 Z' fill='#e60012'/><path d='M20 31.5 L23 20 L17 20 Z' fill='#3d4f97'/></g>"
           "<circle cx='20' cy='20' r='2' fill='#21242e'/><circle cx='20' cy='1.6' r='1.8' fill='#c9a24a' stroke='#21242e' stroke-width='1'/>"
           "</svg>")

WAND = ("<svg class='tip-prop tip-wand' viewBox='0 0 74 16' aria-hidden='true'>"
        "<path d='M2 6.2 L54 7 V9 L2 9.8 Q0.6 8 2 6.2 Z' fill='#21242e'/>"
        "<path d='M8 6.4 V9.6 M12 6.5 V9.5' stroke='#ecab37' stroke-width='1.1'/>"
        "<path d='M54 6.6 H61 V9.4 H54 Z' fill='#fff' stroke='#21242e' stroke-width='.8'/>"
        + _star(66, 4, 3, "sparkle s1") + _star(70.5, 10.5, 2.3, "sparkle s2") + _star(64.5, 13, 1.7, "sparkle s3") +
        "</svg>")


def _sign(direction):
    arrow = "▼" if direction == "down" else "▲"
    return ("<svg class='tip-prop tip-sign' viewBox='0 0 56 58' aria-hidden='true'>"
            "<rect x='25.5' y='24' width='5' height='33' rx='1.5' fill='#60619c' stroke='#21242e' stroke-width='1.2'/>"
            "<rect x='2' y='2' width='52' height='24' rx='3' fill='#21242e' stroke='#000' stroke-width='1.4'/>"
            "<rect x='4.5' y='4.5' width='47' height='19' rx='2' fill='none' stroke='#3d4f97' stroke-width='1'/>"
            f"<text x='28' y='19.5' text-anchor='middle' font-family='VT323, monospace' font-size='16' fill='#9fbee7'>LOOK {arrow}</text>"
            "</svg>")


FLASH = ("<svg class='tip-prop tip-flash' viewBox='0 0 84 30' aria-hidden='true'>"
         "<path class='beam' d='M40 9.5 L84 1 L84 29 L40 20.5 Z' fill='rgba(255,246,190,.6)'/>"
         "<rect x='2' y='10' width='28' height='10' rx='2.5' fill='#21242e' stroke='#000' stroke-width='1'/>"
         "<path d='M8 10.6 V19.4 M12 10.6 V19.4 M16 10.6 V19.4' stroke='#60619c' stroke-width='1.2'/>"
         "<path d='M30 9 L40 6.5 V23.5 L30 21 Z' fill='#3d4f97' stroke='#21242e' stroke-width='1.2' stroke-linejoin='round'/>"
         "<rect x='39' y='7' width='2.4' height='16' rx='1' fill='#fff6be' stroke='#21242e' stroke-width='.8'/>"
         "<rect x='20' y='8' width='4' height='3' rx='1' fill='#e60012'/>"
         "</svg>")

CRANE = ("<svg class='tip-prop tip-crane' viewBox='0 0 56 62' aria-hidden='true'>"
         "<path d='M0 4 H50 V10 H0 Z' fill='#f5c518' stroke='#6b4f00' stroke-width='1'/>"
         "<path d='M2 10 L8 4 L14 10 L20 4 L26 10 L32 4 L38 10 L44 4 L50 10' fill='none' stroke='#6b4f00' stroke-width='.9'/>"
         "<rect x='42' y='10' width='6' height='4' fill='#21242e'/>"
         "<g class='drop'><path class='cable' d='M45 14 V40' stroke='#21242e' stroke-width='1.3'/>"
         "<g class='hook'><rect x='42' y='39' width='6' height='5' rx='1' fill='#60619c' stroke='#21242e' stroke-width='1'/>"
         "<path d='M45 44 V50 Q45 55 40.5 55 Q37 55 37 51.5' fill='none' stroke='#21242e' stroke-width='2.6' stroke-linecap='round'/></g></g>"
         "</svg>")

SPYGLASS = ("<svg class='tip-prop tip-spy' viewBox='0 0 70 18' aria-hidden='true'>"
            "<g class='seg3'><rect x='40' y='5' width='22' height='8' rx='1.5' fill='#c9a24a' stroke='#5c4420' stroke-width='1'/>"
            "<rect x='60' y='4' width='5' height='10' rx='1.5' fill='#9fbee7' stroke='#21242e' stroke-width='1'/>"
            "<circle class='glint' cx='63' cy='7' r='1.2' fill='#fff'/></g>"
            "<g class='seg2'><rect x='22' y='3.5' width='22' height='11' rx='1.5' fill='#b8893a' stroke='#5c4420' stroke-width='1'/>"
            "<path d='M24 3.5 V14.5' stroke='#e6c47a' stroke-width='1'/></g>"
            "<rect x='2' y='2' width='24' height='14' rx='2' fill='#6b4a1e' stroke='#21242e' stroke-width='1.2'/>"
            "<path d='M6 2 V16 M20 2 V16' stroke='#c9a24a' stroke-width='1.4'/>"
            "</svg>")

PENNANT = ("<svg class='tip-prop tip-pennant' viewBox='0 0 58 34' aria-hidden='true'>"
           "<rect x='1' y='1' width='4' height='32' rx='1.6' fill='#fdb515' stroke='#6b4f00' stroke-width='.8'/>"
           "<g class='flag'><path d='M5 4 L56 17 L5 30 Z' fill='#003262' stroke='#000d1f' stroke-width='1' stroke-linejoin='round'/>"
           "<path d='M5 7.6 V26.4' stroke='#fdb515' stroke-width='2.2'/>"
           "<text x='22' y='20.6' text-anchor='middle' font-family='Georgia, serif' font-weight='700' font-style='italic' "
           "font-size='10.5' fill='#fdb515'>Cal</text></g>"
           "</svg>")

# name -> (pointer svg or fn(direction), hat key, extra drawn on the mascot, allowed modes)
PROPS = {
    "hand": (HAND, None, "", ("above", "side")),
    "scholar": (LENS, "scholar", "", ("above", "side")),
    "explorer": (COMPASS, "explorer", "", ("above", "side")),
    "wizard": (WAND, "wizard", "", ("above", "side")),
    "arcade": (_sign, "arcade", "", ("above", "side")),
    "detective": (FLASH, "detective", "", ("above", "side")),
    "builder": (CRANE, "builder", "", ("above",)),
    "pirate": (SPYGLASS, "pirate", EYEPATCH, ("above", "side")),
    "berkeley": (PENNANT, "berkeley", "", ("above", "side")),
}
_PROP_CYCLE = ["hand", "explorer", "wizard", "berkeley", "arcade", "scholar", "detective", "builder", "pirate"]
_prop_i = [0]


def _next_prop(mode):
    for _ in range(len(_PROP_CYCLE)):
        name = _PROP_CYCLE[_prop_i[0] % len(_PROP_CYCLE)]
        _prop_i[0] += 1
        if mode in PROPS[name][3]:
            return name
    return "hand"


def _pointer(prop, direction):
    # outer span sets direction, middle span plays one-off tricks (site.js), the svg itself idles
    svg = PROPS[prop][0]
    svg = svg(direction) if callable(svg) else svg
    return f"<span class='tip-hand-wrap {prop} {direction}'><span class='tip-spin'>{svg}</span></span>"


def tip(text="", mode="above", pos="right", prop=None):
    """mode="above": mascot sits above the next element and points down at it.
    mode="side": used via beside(); mascot overlays the element's lower corner and points up into it.
    text is optional. prop picks a character (see PROPS); by default characters rotate through the page."""
    if prop is None or mode not in PROPS[prop][3]:
        prop = _next_prop(mode)
    _, hat, inside, _modes = PROPS[prop]
    acc = HATS[hat] if hat else ""
    mascot = (f"<span class='tip-mascot' tabindex='0' aria-label='Mascot'>{acc}{_mascot_svg(inside)}</span>")
    bubble = f"<p class='tip-bubble'>{text}</p>" if text else ""
    if mode == "side":
        parts = [bubble, _pointer(prop, "up"), mascot] if pos == "right" else [mascot, _pointer(prop, "up"), bubble]
        return f"<div class='tip side {pos} prop-{prop}' role='note'>{''.join(parts)}</div>"
    return f"<div class='tip above prop-{prop}' role='note'>{mascot}{bubble}{_pointer(prop, 'down')}</div>"


def beside(html, text="", pos="right", prop=None):
    """Wrap an element so the mascot overlays its lower-left/right corner, pointing up at it."""
    return f"<div class='tip-anchor {pos}'>{html}{tip(text, 'side', pos, prop)}</div>"


_SLOTS = __import__("pathlib").Path(__file__).resolve().parent / "assets" / "img" / "slots"


def image(rel, file, caption, label="Figure", alt=None, phone=False):
    """A real image at its own aspect ratio. width/height come from the file so the layout doesn't jump,
    and small screenshots are never stretched past their real size."""
    from PIL import Image as _I
    src = _SLOTS / file
    if not src.exists():  # restricted figures live outside the published tree
        src = _SLOTS.parents[2] / "_private" / "restricted-img" / file
    w, h = _I.open(src).size
    alt = alt or caption.split(".")[0]
    cls = "fig-img phone" if phone else "fig-img"
    return (f"<figure class='fig'><div class='fig-body'><img class='{cls}' src='{rel}assets/img/slots/{file}' "
            f"width='{w}' height='{h}' style='max-width:min(100%,{w}px)' alt=\"{alt}\" loading='lazy'></div>"
            f"<figcaption><b>{label}</b>{caption}</figcaption></figure>")


def fig(svg, caption, label="Figure"):
    return (f"<figure class='fig'><div class='fig-body'>{svg}</div>"
            f"<figcaption><b>{label}</b>{caption}</figcaption></figure>")


def diagram(rel, img, full, alt, caption, scroll=False):
    cls = "diagram scroll" if scroll else "diagram"
    return (f"<figure class='fig'><div class='{cls}'><img src='{rel}assets/img/{img}' alt='{alt}' loading='lazy'></div>"
            f"<div class='diagram-actions'><a class='chip' href='{rel}{full}' target='_blank' rel='noopener'>Open full size</a></div>"
            f"<figcaption><b>Architecture</b>{caption}</figcaption></figure>")


def _cbu_full(cbu_public):
    """The restricted CBU write-up lives in _private/cbu_full.py (git-ignored). Returns None when
    publishing isn't approved."""
    if not cbu_public:
        return None
    import importlib.util
    path = Path(__file__).resolve().parent / "_private" / "cbu_full.py"
    if not path.exists():
        raise SystemExit("CBU_FIGURES_PUBLIC is True but _private/cbu_full.py is missing. Move the approved "
                         "CBU write-up and figures into the public tree first (see README).")
    spec = importlib.util.spec_from_file_location("cbu_full", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def research_steps(cbu_public):
    full = _cbu_full(cbu_public)
    fea_ablation = full.ABLATION if full else "an ablation on only the cleanest inputs for the inverse-FEA model"
    steps = [
        ("Frame the question", "Turn a vague problem into one that evidence can answer.",
         ["CBU: is the R² ≈ 0.10 ceiling a model problem or a data problem?",
          "SeismicSoCal: can a learned detector tell real quakes from noise better than the classic STA/LTA trigger?"]),
        ("Know the field &amp; pick baselines", "Start from what practitioners already use, so a result means something.",
         ["STA/LTA for detection, amplitude + distance for magnitude, a GMPE-style estimate for shaking.",
          "Persistence for forecasting (Berkeley Lab), a baseline random forest for inverse-FEA."]),
        ("Design the experiment", "Decide how results will be judged before running anything.",
         ["Chronological 70/15/15 splits and walk-forward folds, so no model ever sees the future.",
          "Thresholds tuned on validation only; a paired clean-vs-noisy design that isolates noise as the one variable."]),
        ("Collect &amp; check the data", "Most bad results start as bad data.",
         ["5,800+ SCEDC waveform windows labelled against the USGS catalog.",
          "A quality gate that drops gap-fill zeros, flat runs, clipping and glitch spikes; three years of XCache logs explored before modelling."]),
        ("Run experiments &amp; ablations", "Change one thing at a time and see what actually carries the result.",
         ["5-seed ensembles for stability; a nearest-single-station ablation (R² 0.84 → 0.42) that proves the graph fusion matters.",
          f"A lookback sweep across forecast horizons, and {fea_ablation}."]),
        ("Analyze honestly", "Use metrics that can't be gamed, and write down the limits.",
         ["ROC-AUC and MCC on imbalanced data instead of accuracy; MCC instead of recall for alerts.",
          "Known limits stated plainly, e.g. the magnitude model under-predicts the very largest events."]),
        ("Conclude &amp; communicate", "Say exactly what the evidence supports, to the people who need it.",
         ["The inverse-FEA ceiling is a data limit: written up for the team's IEEE paper, and it redirected their effort.",
          "SeismicSoCal's results published next to their baselines on the live site."]),
        ("Iterate", "Every answer sets up the next question.",
         ["Test a ~120-day lookback at the 30-day horizon.",
          "Wire the early-warning model into live alerts and extend coverage statewide."]),
    ]
    cards = "".join(
        f"<li class='step'><span class='step-n halftone'>{i + 1:02d}</span><div class='step-body'>"
        f"<h4>{t}</h4><p class='step-what'>{w}</p><ul class='step-eg'>{''.join(f'<li>{e}</li>' for e in eg)}</ul>"
        f"</div></li>" for i, (t, w, eg) in enumerate(steps))
    return (f"<ol class='steps'>{cards}</ol>"
            "<p class='steps-loop'><span class='disc'></span>Step 8 feeds straight back into step 1.</p>")


def stats(items):
    cells = "".join(
        f"<div class='stat halftone'><span class='v'>{v}</span><span class='k'>{k}</span>"
        + (f"<span class='b'>{b}</span>" if b else "") + "</div>"
        for v, k, b in items)
    return f"<div class='stats'>{cells}</div>"


def bullets(items):
    rows = "".join(
        f"<li class='row'><span class='row-ico'>{i + 1:02d}</span><p>{t}</p></li>" for i, t in enumerate(items))
    return f"<ul class='rows bullet-rows'>{rows}</ul>"


def flow(steps, dark=False):
    cells = "".join(
        f"<div class='flow-step{' hot' if hot else ''}'><span class='n'>{i + 1:02d}</span>"
        f"<span class='t'>{t}</span><span class='d'>{d}</span></div>"
        for i, (t, d, hot) in enumerate(steps))
    return f"<div class='flow{' dark' if dark else ''}'>{cells}</div>"


def tiles(items):
    return "<div class='tiles'>" + "".join(
        f"<div class='tile'><span class='t'>{t}</span><span class='d'>{d}</span></div>" for t, d in items) + "</div>"


def chips(items):
    return "<div class='stack-chips'>" + "".join(f"<span>{s}</span>" for s in items) + "</div>"


def spec(items):
    return "<ul class='spec'>" + "".join(
        f"<li><span class='k'>{k}</span><span class='v'>{v}</span></li>" for k, v in items) + "</ul>"


def toc(items):
    return "<ul class='toc'>" + "".join(f"<li><a href='#{a}'>{t}</a></li>" for a, t in items) + "</ul>"


def info(tab, body):
    return f"<div class='info-box'><span class='info-tab'>{tab}</span><div class='info-body'>{body}</div></div>"


def rail_btns(items):
    out = []
    for ico, label, href in items:
        ext = " rel='noopener' target='_blank'" if href.startswith("http") else ""
        out.append(f"<a class='rail-btn halftone' href='{href}'{ext}><span class='ico'>{ico}</span>{label}"
                   f"<span class='arrow-chip'></span></a>")
    return f"<div class='rail-btns'>{''.join(out)}</div>"


def table(head, rows, num_cols=()):
    th = "".join(f"<th class='num'>{h}</th>" if i in num_cols else f"<th>{h}</th>" for i, h in enumerate(head))
    trs = ""
    for r in rows:
        trs += "<tr>" + "".join(
            f"<td class='num'>{c}</td>" if i in num_cols else f"<td>{c}</td>" for i, c in enumerate(r)) + "</tr>"
    return f"<div class='table-wrap'><table class='data'><thead><tr>{th}</tr></thead><tbody>{trs}</tbody></table></div>"


def hero(field, eyebrow, title, tagline, tags, art, ctas="", small=False):
    tag_html = "".join(f"<span class='tag'>{t}</span>" for t in tags)
    disp = "display sm" if small else "display"
    return f"""
<div class="hero-wrap">
  <section class="hero chamfer {field}">
    <div class="hero-grid">
      <div>
        <span class="hero-eyebrow">{eyebrow}</span>
        <h1 class="{disp}">{title}</h1>
        <p class="tagline">{tagline}</p>
        <div class="hero-meta">{tag_html}</div>
        {f'<div class="hero-cta">{ctas}</div>' if ctas else ''}
      </div>
      <div class="hero-art"><div class="screen">{art}</div></div>
    </div>
  </section>
</div>"""


def go(href, label, ext=False):
    e = " target='_blank' rel='noopener'" if ext else ""
    return f"<a class='go' href='{href}'{e}><span class='disc'></span>{label}</a>"


def pager(rel, prev, nxt):
    def a(item, cls, d):
        if not item:
            return "<span></span>"
        href, t = item
        return f"<a class='{cls} halftone' href='{rel}{href}'><span class='dir'>{d}</span><span class='t'>{t}</span></a>"
    return f"<nav class='pager' aria-label='More work'>{a(prev, 'prev', '&larr; PREVIOUS')}{a(nxt, 'next', 'NEXT &rarr;')}</nav>"


def layout(main_html, rail_html):
    return (f"<div class='layout'><div class='col'>{main_html}</div>"
            f"<aside class='col rail' aria-label='Page details'>{rail_html}</aside></div>")


# ============================================================================ HOME

# Roles I'm targeting, each backed by the work that shows the skill. (href, where, proof)
ROLES = [
    ("AI", "AI Engineer",
     "Ship LLM features that are grounded, measurable and hard to break.",
     [("projects/bearlm/", "BearLM", "local RAG, hybrid search + reranking, RAGAS faithfulness 0.55 → 0.83"),
      ("projects/academy-of-testers/", "Academy of Testers", "RAG essay grader, ~23% lower error vs. College Board scores"),
      ("experience/kigumi-group/", "Kigumi Group", "fixed recurring GPT / image-model pipeline failures")]),
    ("ML", "Machine Learning Engineer",
     "Train models that beat a real baseline, then run them in production.",
     [("projects/seismicsocal/", "SeismicSoCal", "CNN → Transformer + GNN, 0.992 ROC-AUC, live 24/7 daemon"),
      ("experience/lawrence-berkeley-lab/", "Berkeley Lab", "PatchTST forecasting, up to 24% lower RMSE"),
      ("projects/academy-of-testers/", "Academy of Testers", "BKT + IRT adaptive engine as pure, testable code")]),
    ("DS", "Data Scientist",
     "Design honest experiments and find out what the data can support.",
     [("experience/cbu-seismicsocal/", "CBU Research", "7-model benchmark proved an R² ≈ 0.10 data ceiling"),
      ("experience/lawrence-berkeley-lab/", "Berkeley Lab", "rolling CV showing models under-predict rare peaks"),
      ("projects/seismicsocal/", "SeismicSoCal", "chronological splits, MCC/AUC on imbalanced data, ablations")]),
    ("DE", "Data Engineer",
     "Build pipelines that ingest messy sources reliably and reproducibly.",
     [("projects/bearlm/", "BearLM", "ETL over PDF / md / ipynb, ~10K records with retry/backoff"),
      ("projects/seismicsocal/", "SeismicSoCal", "real-time SeedLink streaming from 10 stations, quality gating"),
      ("experience/lawrence-berkeley-lab/", "Berkeley Lab", "reproducible Pandas pipelines over 3 years of logs")]),
    ("DA", "Data Analyst",
     "Turn raw logs and metrics into clear charts and decisions.",
     [("experience/lawrence-berkeley-lab/", "Berkeley Lab", "seasonality, change-points and peaks in Matplotlib / Seaborn / Plotly"),
      ("experience/cbu-seismicsocal/", "CBU Research", "paired clean-vs-noisy analysis that redirected the team"),
      ("projects/bearlm/", "BearLM", "SQLite usage analytics and weakest-area reporting")]),
    ("RES", "AI / ML Researcher",
     "Run rigorous experiments, find the real limits, and report them honestly.",
     [("experience/cbu-seismicsocal/", "CBU Research", "IEEE inverse-FEA paper: proved an R² ≈ 0.10 data ceiling"),
      ("experience/lawrence-berkeley-lab/", "Berkeley Lab", "PatchTST forecasting + the peak-predictability ceiling"),
      ("projects/seismicsocal/", "SeismicSoCal", "CNN → Transformer + GNN vs. classical baselines, with ablations")]),
]

# Which résumé best fits each role (keys from build.RESUMES)
ROLE_RESUME = {"AI": "aiml", "ML": "aiml", "RES": "aiml", "DS": "ds", "DA": "ds", "DE": "de"}


def roles_section(rel, resumes):
    paths = {k: (label, path) for k, label, path in resumes}
    cards = []
    for ico, role, pitch, proofs in ROLES:
        label, path = paths[ROLE_RESUME[ico]]
        cv = (f"<a class='role-cv' href='{rel}{path}' target='_blank' rel='noopener' "
              f"title='Open my {label} r&eacute;sum&eacute;'>PDF &darr;</a>")
        links = "".join(
            f"<a class='proof' href='{rel}{href}'><span><span class='proof-where'>{where}</span>"
            f"<span class='proof-what'>{what}</span></span><span class='arrow-chip'></span></a>"
            for href, where, what in proofs)
        cards.append(f"<article class='role'><header class='role-head halftone'><span class='role-ico'>{ico}</span>"
                     f"<h3>{role}</h3>{cv}</header><p class='role-pitch'>{pitch}</p>"
                     f"<div class='proofs'><span class='proof-label'>Shown in</span>{links}</div></article>")
    return ("<p class='roles-intro'>The roles below are where I want to work next. Each one links to the projects "
            "and internships that show the skills it needs.</p>"
            f"<div class='roles'>{''.join(cards)}</div>")



def home(ctx):
    rel = ctx["rel"]
    art = (
        "<svg viewBox='0 0 420 220' role='img' aria-label='Headline results'>"
        "<text x='14' y='26' font-family='Silkscreen, monospace' font-size='12' fill='#7a8aba'>SYSTEM CHECK . . . OK</text>"
        "<g font-family='VT323, monospace' fill='#9fbee7'>"
        "<text x='14' y='66' font-size='30'>0.992</text><text x='120' y='66' font-size='18' fill='#7a8aba'>quake detection ROC-AUC</text>"
        "<text x='14' y='106' font-size='30'>0.82</text><text x='120' y='106' font-size='18' fill='#7a8aba'>BearLM recall@1 (from 0.56)</text>"
        "<text x='14' y='146' font-size='30'>-23%</text><text x='120' y='146' font-size='18' fill='#7a8aba'>AP essay grading error</text>"
        "<text x='14' y='186' font-size='30'>-85%</text><text x='120' y='186' font-size='18' fill='#7a8aba'>redemption load time</text>"
        "</g><rect x='14' y='200' width='10' height='14' fill='#9fbee7'><animate attributeName='opacity' values='1;0;1' dur='1.1s' repeatCount='indefinite'/></rect></svg>")
    h = hero(
        "field-lavender", "PLAYER 1 · PORTFOLIO", "Braedyn<br>Thompson",
        "I build machine-learning systems end to end: the data pipeline, the model, the honest "
        "evaluation, and the product people actually use.",
        ["Machine learning", "Data science", "RAG / LLMs", "Full-stack"], art,
        go("#projects", "See the projects") + go("#experience", "Internships"))

    feats = [
        ("projects/academy-of-testers/", "field-lavender", "Academy of<br>Testers", "academyoftesters.com",
         "Adaptive SAT engine (BKT + IRT) and a RAG essay grader cutting AP scoring error ~23%."),
        ("projects/seismicsocal/", "field-teal", "Seismic<br>SoCal", "seismicsocal.duckdns.org",
         "Live earthquake detection on 10 SeedLink stations: CNN→Transformer + GNN, push alerts."),
        ("projects/bearlm/", "field-red", "BearLM", "fully local RAG",
         "Zero-cost cited Q&amp;A over ~10K Berkeley CS/DS chunks. recall@1 56% → 82%."),
    ]
    feat_html = "".join(
        f"<a class='feat halftone' href='{rel}{href}'><div class='feat-thumb {field}'>"
        f"<span class='display'>{name}</span></div><div class='feat-cap'><span class='u'>{url}</span>"
        f"<span class='s'>{s}</span><span class='go-line'>Open case study<span class='arrow-chip'></span></span></div></a>"
        for href, field, name, url, s in feats)

    exp = [
        ("experience/lawrence-berkeley-lab/", "LBL", "Lawrence Berkeley National Laboratory",
         "Data Science &amp; ML Research Intern · PatchTST forecasting of XCache traffic, up to 24% lower RMSE than persistence.",
         "SEP 2026 – NOW"),
        ("experience/cbu-seismicsocal/", "CBU", "California Baptist University · SeismicSoCal",
         "ML Research Intern · diagnosed an inverse-FEA data ceiling; 0.992 ROC-AUC detection; live alert daemon.",
         "MAY 2026 – NOW"),
        ("experience/numistoken/", "NIT", "NumIsToken",
         "Full-Stack Software Engineering Intern · resumable redemptions; serialization tool; load time ~2–3 s → ~300 ms.",
         "SEP 2025 – JUN 2026"),
        ("experience/kigumi-group/", "KG", "The Kigumi Group · KiguLab",
         "Backend Software Engineer Intern · coverage 90% → 98%; fixed recurring AI assistant pipeline failures.",
         "JUN 2025 – SEP 2025"),
        ("projects/bearlm/", "BLM", "BearLM",
         "Data &amp; AI Engineer · local hybrid-search RAG; RAGAS faithfulness 0.55 → 0.83.",
         "AUG 2026 – NOW"),
        ("projects/academy-of-testers/", "AOT", "Academy of Testers",
         "ML &amp; AI Software Developer · adaptive learning engine + RAG essay grading.",
         "JAN 2023 – JUN 2026"),
    ]
    exp_html = "<div class='rows'>" + "".join(
        f"<a class='row' href='{rel}{href}'><span class='row-ico halftone'>{ico}</span>"
        f"<span><span class='row-title'>{t}</span><span class='row-sub'>{s}</span></span>"
        f"<span class='row-meta'>{d}</span></a>" for href, ico, t, s, d in exp) + "</div>"

    about = """
<p class="lede">I like problems where the honest answer matters more than the impressive one.</p>
<p>Across forecasting, seismology, retrieval and ed-tech, my work follows the same loop: build a
reproducible pipeline, pick a baseline worth beating, evaluate on data the model has never seen
(chronological splits, held-out sets, ablations), and then ship the thing as a real product with a
real user surface.</p>
<p>Sometimes the honest result is a ceiling. At CBU I showed an inverse-FEA predictor was stuck because of
the <em>data</em>, not the model, and that redirected the team toward fixing the inputs instead of
tuning models that had nothing left to find.</p>"""

    skills = tiles([
        ("ML &amp; deep learning", "PyTorch, scikit-learn, XGBoost, CNN / Transformer / GNN, PatchTST, neuralforecast"),
        ("LLMs &amp; retrieval", "RAG, LangChain, Ollama, Llama 3.1, embeddings, BM25 + vector hybrid search, rerankers, RAGAS"),
        ("Data", "Pandas, ETL pipelines, EDA, rolling CV, Matplotlib, Seaborn, Plotly, SQL"),
        ("Backend", "Python, FastAPI, Java / Spring Boot, PostgreSQL, Flyway, SQLite, Chroma"),
        ("Frontend", "React, TypeScript, Vite, Tailwind, Capacitor (Android), hand-built SVG"),
        ("Ops", "Docker, systemd, Caddy, Oracle Cloud, Render, Vercel, FCM push"),
    ])

    contact = f"""
<p>I'm looking for AI, machine learning and data roles (see <a href="#roles">roles I'm targeting</a>).
The fastest way to reach me is email.</p>
{rail_btns([("@", "Email me", "mailto:" + ctx["email"]), ("GH", "GitHub", ctx["github"]),
            ("IN", "LinkedIn", ctx["linkedin"])])}"""

    resumes = ("<p>Pick the version that matches the role. Each is a one-page PDF.</p>"
               + rail_btns([("CV", f"{label} r&eacute;sum&eacute;", rel + path) for _, label, path in ctx["resumes"]]))

    education = spec([("School", "UC Berkeley"), ("Major", "Computer Science &amp; Data Science"),
                      ("Emphasis", "Applied Math &amp; Modeling"), ("Graduation", "Fall 2027"), ("GPA", "3.75 / 4.00")])

    main_html = (
        panel("roles", "Roles I'm targeting", roles_section(rel, ctx["resumes"]), num=f"{len(ROLES):02d}", body_cls="panel-body")
        + panel("projects", "Featured projects", f"<div class='featured'>{feat_html}</div>", num="03",
                body_cls="panel-body")
        + panel("experience", "Experience", exp_html, cls="platinum", num=f"{len(exp):02d}", body_cls="panel-body tight")
        + panel("about", "About", about)
        + panel("skills", "Toolkit", skills, body_cls="panel-body"))

    rail = (
        info("What is — this site?",
             "<p>A portfolio styled like a 2001 game-console web page: periwinkle metal plates, carbon "
             "command bars, and orange only where it moves you forward.</p><p>Every number on it comes "
             "from a held-out evaluation in the project's own repo.</p>")
        + panel("contact", "Contact", contact, dark=False)
        + panel("resumes", "R&eacute;sum&eacute;s", resumes)
        + panel("education", "Education", education, body_cls="panel-body tight")
        + panel("timeline", "Timeline", """
<ul class="timeline">
<li><span class="when">SEP 2026</span>Berkeley Lab · Data Science &amp; ML Research Intern</li>
<li><span class="when">AUG 2026</span>BearLM · Data &amp; AI Engineer</li>
<li><span class="when">MAY 2026</span>CBU · ML Research Intern (SeismicSoCal)</li>
<li><span class="when">SEP 2025</span>NumIsToken · Full-Stack SWE Intern</li>
<li><span class="when">JUN 2025</span>The Kigumi Group · Backend SWE Intern (Hong Kong)</li>
<li><span class="when">JAN 2023</span>Academy of Testers · ML &amp; AI Software Developer</li>
</ul>""", body_cls="panel-body"))
    return h, layout(main_html, rail)


# ============================================================================ ACADEMY OF TESTERS


def aot(ctx):
    rel = ctx["rel"]
    sample = [0.78, 0.86, 0.71, 0.52, 0.44, 0.63, 0.81, 0.38]
    h = hero(
        "field-lavender", "PROJECT 01 · ED-TECH · ML", "Academy of<br>Testers",
        "A full-stack AP/SAT study platform with an adaptive learning engine that models what each "
        "student knows, and a RAG essay grader calibrated against official College Board scores.",
        ["Jan 2023 – Jun 2026", "ML &amp; AI Software Developer", "Berkeley, CA"],
        C.radar(sample, 300, labels=False, dark=True),
        go("https://academyoftesters.com", "Visit academyoftesters.com", True)
        + go(ctx["github"] + "/academy_of_testers", "Source on GitHub", True))

    overview = f"""
{tip("Start here: grading error down ~23% against official College Board scores.")}
{stats([("-23<small>%</small>", "AP grading error (MAE)", "vs. naive LLM grader"),
        ("0.62", "QWK vs. official scores", "English Lang + Lit, n=39"),
        ("8", "skills in the mastery model", "SAT math radar axes"),
        ("4", "models fused", "BKT · IRT · decay · prereq graph")])}
<hr class="dotted">
<p class="lede">Most test-prep sites hand every student the same practice set. Academy of Testers
tries to work out what <em>this</em> student knows and ask the question that will teach us the most.</p>
<p>The platform covers AP and SAT: curated practice exams, subject resources, unit overviews, an AI
study assistant, and two ML systems I designed and built. The first is an <strong>adaptive SAT math engine</strong>
that tracks mastery of 8 skills. The second is a <strong>retrieval-augmented essay grader</strong> for AP
free-response questions.</p>
{bullets([
    "Architected an adaptive learning engine that models per-student skill mastery by combining "
    "<strong>Bayesian Knowledge Tracing</strong> with <strong>Item Response Theory</strong>, selecting questions to maximize "
    "information gain at the learner's estimated ability. I extended the 8-skill model with <strong>forgetting-curve decay</strong> "
    "and <strong>prerequisite-graph penalty propagation</strong>, and it powers the mastery radar.",
    "Improved AP essay-grading consistency, measured as a <strong>~23% reduction in scoring error (QWK 0.62)</strong> "
    "against official College Board scores, by building a RAG pipeline. It embeds each free response, retrieves "
    "rubric clauses and score-banded exemplars from a Postgres vector store by cosine similarity, and "
    "returns calibrated results as constrained JSON.",
])}"""

    arch = f"""
<p>A monorepo with a <strong>Spring Boot 3.2 / Java 17</strong> API, a <strong>React 18 + TypeScript + Vite</strong>
frontend, and <strong>PostgreSQL 16</strong>. Flyway migrations are the only way the schema changes. The frontend
deploys to Vercel and the API and database run on Render. Three subsystems hang off the student: the
study experiences, the AI services (chat + FRQ grading over a shared RAG layer) and the SAT adaptive engine.</p>
{diagram(rel, "aot-architecture.webp", "academyoftestersDiagram.png", "Academy of Testers architecture diagram",
         "Student-facing web routes call the platform API. AI chat and FRQ grading share RAG retrieval over a chunk store, and the SAT adaptive engine (diagnostic, sessions, mastery tracking) persists learning state to PostgreSQL.")}"""

    radar_sec = f"""
<p>Each student gets a vector of eight mastery weights, one per SAT math skill. Every weight is a
probability that the skill is learned. The radar shows that vector directly. The dashed ring is the
<strong>0.85 mastery threshold</strong>, and the engine aims practice at the gaps inside it.</p>
{beside(image(rel, "aot-radar.png", "The mastery map on the SAT dashboard. Solid dots are current mastery; hollow outer dots are each skill's peak, so the gap between them is what the forgetting curve has taken back. The dashed outer ring is the mastery target.", "Screenshot", alt="SAT mastery radar"), "Solid = where you are now. Hollow = your best. The gap is forgetting.", "right")}
<p>After every adaptive session the same radar comes back with the session's result, so students see exactly
which skills moved.</p>
{image(rel, "aot-end-adaptive-session.png", "End of an adaptive session: the score for the session and the updated eight-skill radar, with options to practice again or return to the dashboard.", "Screenshot", alt="Session complete screen with radar")}
<p>The radar is hand-rolled SVG plus the <code>motion</code> package, themed through CSS variables so it picks up
every site theme. There's no charting library. The client does <strong>no model math</strong>: weights arrive
already decayed from the server, so a stray <code>Math.exp</code> in the frontend would be a bug.</p>"""

    engine = f"""
<p>The engine lives in <code>com.aot.sat.engine</code> as <strong>pure functions</strong>: no Spring, no repositories,
no <code>now()</code>. Clocks and data are passed in, so the whole model can be tested without a database.
Five pieces fit together:</p>
{flow([("Diagnostic", "24 items: 8 skills × easy/med/hard → prior-blended starting weights", False),
       ("BKT update", "Bayesian posterior on each answer + learning transition", True),
       ("Prereq penalty", "a miss bleeds into upstream skills (κ = 0.35)", False),
       ("Forgetting", "lazy exponential decay toward a 0.20 floor", False),
       ("IRT selection", "gap + Fisher info − recency, softmax top-5", True)])}

<h3>1 · Bayesian Knowledge Tracing</h3>
<p>Standard four-parameter BKT (P(T)=0.10, P(S)=0.10, P(G)=0.25 for 4-option multiple choice). Each answer
gives a Bayesian posterior and then a learning transition. Then I <strong>damp the step</strong>: only 25% of an upward
move is applied, but 50% of a downward one, so <em>mastery is easier to lose than to earn</em>. One lucky guess
can't push a student over the threshold.</p>
{table(["Starting at w = 0.40", "BKT posterior", "+ learning", "Damped step", "New weight"],
       [["Correct answer", "0.706", "0.735", "25% of +0.335", "<b>0.484</b>"],
        ["Wrong answer", "0.082", "0.173", "50% of −0.227", "<b>0.287</b>"]], num_cols=(1, 2, 4))}
<p class="note">Worked from the engine's constants. A wrong answer drops the weight by 0.113, which is about
1.4× the gain from a right one.</p>

<h3>2 · Prerequisite-graph propagation</h3>
<p>Skills form a directed graph (e.g. linear functions depend on algebra). When a student misses a question,
part of that drop flows <strong>one level upstream</strong> to each prerequisite. Correct answers don't propagate.</p>
<div class="formula halftone">w<sub>prereq</sub> ← clamp( w<sub>prereq</sub> − <span class="k">κ</span> · σ<sub>edge</sub> · Δ<sub>skill</sub> )     <span class="c">// κ = 0.35, depth 1, no recursion</span>
<span class="c">// the miss above (Δ = 0.113) costs a full-strength prerequisite 0.040</span></div>

<h3>3 · Forgetting curve</h3>
<p>Weights decay exponentially toward a floor of 0.20, and the decay is applied <strong>lazily on read</strong>.
<code>MasteryService</code> is the only place weights are read, so a stale value can't leak out. Decay can
only pull a weight down. A weight already below the floor never drifts <em>up</em> toward it.</p>
{beside(fig(C.forgetting_chart(), "With λ = 0.0112/day, the part of a weight above the floor halves roughly every 62 days (marked point), so a skill mastered in the fall is flagged for review well before spring."), "Skills fade without practice. This is the exact curve the engine uses.", "right")}

<h3>4 · IRT question selection</h3>
<p>Each mastery weight maps to an ability θ on the logit scale. Every item has 3PL parameters (a, b, c), and
its <strong>Fisher information</strong> at the student's θ measures how much the answer will tell us. Each
candidate's score blends three terms:</p>
<div class="formula halftone">score = <span class="k">0.45</span> · skill_gap(w)  +  <span class="k">0.40</span> · info(θ; a,b,c) / info<sub>max</sub>  −  <span class="k">0.15</span> · e^(−days_since_seen / 7)
<span class="c">// then sample from the top 5 with a softmax (τ = 0.15), so identical states don't repeat questions</span></div>
{beside(fig(C.irt_info_chart(), "Fisher information under the 3PL model (a = 1, c = 0.25). The marked student (w = 0.45, θ ≈ −0.20) learns the most from medium items. Easy items tell us almost nothing about them."), "", "left")}

<h3>5 · Data hygiene</h3>
<ul>
<li><strong>The client never sees answers</strong>: <code>correctIndex</code>, explanation, <code>irt_b</code> and difficulty are
withheld until after submission. Knowing an item's difficulty changes how students answer, which would
contaminate the data used to recalibrate <code>irt_b</code>.</li>
<li><strong>Question IDs are permanent</strong>, because the response history references them forever.</li>
<li>The question bank's source of truth is reviewable JSON. A deterministic, idempotent normalizer turns
raw practice tests into that JSON, and a generator emits the Flyway seed migration from it.</li>
</ul>
<h3>What a session looks like</h3>
<p>Each question is tagged with the skill it tests. After answering, the student sees right or wrong and a
worked explanation; the weight updates happen on the server. The session bar has a timer, pause, end, and the
same tools as the real test.</p>
<div class="fig-pair">
  {image(rel, "aot-adaptive-session.png", "A question from an adaptive SAT Math session (question 5 of 10, tagged Exponential Functions), answered correctly with its worked explanation. Math renders as LaTeX.", "Screenshot", alt="Adaptive session question")}
  {image(rel, "aot-adaptive-resources.png", "Test-day tools inside a session: a graphing calculator and the official-style reference sheet, open alongside the question.", "Screenshot", alt="Calculator and reference sheet in a session")}
</div>"""

    frq = f"""
<p>AP free-response essays are graded on detailed rubrics, and an LLM that's simply asked to grade
an essay 0–6 drifts. The grader <strong>grounds</strong> every call in the rubric, the matching rubric
clauses, and real scored student exemplars, then checks itself against official College Board scores.</p>
{flow([("Embed", "the student response + rubric as the retrieval query", False),
       ("Retrieve", "pool of 16 chunks by cosine similarity, filtered by subject/prompt", True),
       ("Diversify", "stratify by score band → inject 9 (low / mid / high anchors)", True),
       ("Grade", "GPT-4o, temperature 0, calibrated anti-compression prompt", False),
       ("Constrain", "JSON response format → per-row points + cited ref_ids", False)])}
<h3>Vectors in Postgres, no vector DB</h3>
<p>The corpus is small (AP rubrics, a handful of exemplars per prompt, per-skill curriculum). So embeddings
live in Postgres as JSON float arrays, and cosine ranking runs in a small pure-Java <code>VectorMath</code> engine
over rows pre-filtered by metadata (corpus, subject, prompt, score band). No pgvector extension is needed,
and swapping to pgvector later would only change the repository layer. Every chunk carries a unique
<code>ref_id</code> that the model must quote, and each retrieval is logged with rank and similarity for weekly spot checks.</p>
<h3>Why diversify by score band?</h3>
<p>Nearest-neighbor retrieval naturally returns mid-band essays, the ones most similar to a typical
response. The grader then <em>compresses</em> scores toward the middle. Pulling a wider pool and stratifying it so the prompt
always sees low, mid and high anchors fixed most of that compression.</p>
<h3>Evaluation: a real A/B against official scores</h3>
<p>The harness extracts verbatim student responses and their official scores from College Board
"Sample Responses + Scoring Commentary" packets. It keeps only typed responses and drops scanned
handwriting and garbled OCR. Then it grades each one twice: a <strong>baseline</strong> arm with no rubric and no retrieval, and
the <strong>grounded</strong> arm. Test essays (2023/2024) never touch the RAG corpus (2025), so nothing leaks.</p>
<div class="fig-pair">
  {fig(C.frq_chart(), "MAE fell 24% on English and 22% on APUSH, a subject and rubric the grader was never tuned on.")}
  {fig(C.qwk_chart(), "Quadratic weighted kappa rose on both sets. Within-one-point agreement on English went from 77% to 87%.")}
</div>
{tip("APUSH is the honest test: never tuned on, and error still fell 22%.")}
{table(["Set", "n", "Arm", "MAE", "Exact", "Within-1", "QWK"],
       [["English Lang + Lit", "39", "baseline", "0.974", "33%", "77%", "0.590"],
        ["", "", "<span class='win'>grounded</span>", "<span class='win'>0.744</span>", "<span class='win'>38%</span>", "<span class='win'>87%</span>", "<span class='win'>0.624</span>"],
        ["APUSH LEQ (held out)", "8", "baseline", "1.125", "25%", "75%", "0.521"],
        ["", "", "<span class='win'>grounded</span>", "<span class='win'>0.875</span>", "<span class='win'>38%</span>", "75%", "<span class='win'>0.569</span>"]],
       num_cols=(1, 3, 4, 5, 6))}
<p class="note"><strong>Reported honestly:</strong> the samples are small (39 + 8), the English set was tuned over about
four passes, and APUSH is the clean, untuned check. Packets don't include source passages, so both
arms grade without them. That's fine for the A/B difference, but these aren't production accuracy numbers.
After this run the grader config was frozen.</p>
<h3>Where students use it</h3>
{beside(image(rel, "aot-frq-grader.png", "The FRQ practice screen for a real 2025 AP English Language synthesis question: the official prompt PDF on the left, and on the right the rubric rows (thesis, evidence & commentary, sophistication), a suggested 55-minute timer, the response box and Grade my answer. Tabs open the scoring guide and scored samples, and drafts save as you type.", "Screenshot", alt="AP FRQ practice and grading screen"), "Real 2025 prompt on the left, rubric rows and AI grading on the right.", "left")}"""

    platform = f"""
<p>Around the two ML systems sits the rest of a real product, which I built too:</p>
{tiles([("Exam hubs", "Browse AP and SAT, search and filter subjects, and drill into subject pages."),
        ("Resources", "Practice exams, unit overviews, topical review and video resources, with PDFs served inline."),
        ("AI study chat", "Curriculum-grounded assistant on the same RAG layer, with per-user rate limiting."),
        ("Flashcards", "Cards, stacks and per-card progress tracking."),
        ("Auth", "JWT access/refresh tokens, email verification, account lockout."),
        ("Streaks", "SAT streaks, streak repair and a focus mode with user preferences.")])}
<h3>Subject hubs</h3>
{image(rel, "aot-subject.png", "An AP subject hub (English Language): unit overviews, videos and reference sheets to learn the material, then practice questions, past exams, flash cards, AI-graded FRQ practice, mixed review and a timed mock exam that predicts a 1–5 score.", "Screenshot", alt="AP English Language subject hub")}
<h3>My AP Planner</h3>
{image(rel, "aot-ap-planner.png", "The AP planner: a mastery map for each of the student's classes, built from Unit Practice. A question counts as mastered after 3 correct answers (2 in a row), and mastery fades: every 2 weeks without a correct answer it slips a tier.", "Screenshot", alt="My AP Planner mastery map")}
<h3>Testy, the AI study assistant</h3>
{beside(image(rel, "aot-ai-chat.png", "Testy answering a history question. Questions can be scoped to a subject, and usage is rate-limited per user (the counter shows messages left this hour).", "Screenshot", alt="Testy AI study chat"), "", "right")}"""

    main_html = (
        image(rel, "aot-home.png", "academyoftesters.com: pick AP (29 subjects: unit reviews, real 2025 free-response questions, timed mocks) or SAT (adaptive practice, topic lessons, full-length tests).", "Live site", alt="Academy of Testers homepage")
        + panel("overview", "Overview", overview, num="01")
        + panel("architecture", "System architecture", arch, num="02")
        + panel("radar", "The mastery radar", radar_sec, num="03")
        + panel("engine", "Adaptive engine, piece by piece", engine, num="04")
        + panel("frq", "RAG essay grader", frq, num="05")
        + panel("platform", "The rest of the platform", platform, num="06")
        + pager(rel, None, ("projects/seismicsocal/", "SeismicSoCal")))

    rail = (
        rail_btns([("WWW", "Live site", "https://academyoftesters.com"),
                   ("GH", "Source code", ctx["github"] + "/academy_of_testers")])
        + panel("toc-aot", "On this page", toc([("overview", "Overview"), ("architecture", "Architecture"),
                                               ("radar", "Mastery radar"), ("engine", "Adaptive engine"),
                                               ("frq", "RAG essay grader"), ("platform", "Platform")]),
                body_cls="panel-body tight")
        + panel("spec-aot", "Spec sheet", spec([("Role", "ML &amp; AI Developer"), ("Dates", "Jan 2023 – Jun 2026"),
                                                 ("Backend", "Spring Boot 3.2"), ("Frontend", "React + TS"),
                                                 ("Database", "PostgreSQL 16"), ("LLM", "GPT-4o (grader)"),
                                                 ("Hosting", "Vercel + Render")]), body_cls="panel-body tight")
        + panel("stack-aot", "Stack", chips(["Java 17", "Spring Boot", "PostgreSQL", "Flyway", "React", "TypeScript",
                                             "Vite", "Tailwind", "OpenAI", "Embeddings", "JWT", "Docker"]),
                body_cls="panel-body tight")
        + info("What is — BKT + IRT?",
               "<p><b>BKT</b> estimates whether a skill is learned from a sequence of right and wrong answers, "
               "allowing for slips and guesses.</p><p><b>IRT</b> models how likely a student of ability θ is to "
               "answer a given item, which tells you which item is most informative to ask next.</p>"))
    return h, layout(main_html, rail)


# ============================================================================ SEISMICSOCAL


def seismic(ctx):
    rel = ctx["rel"]
    site = "https://seismicsocal.duckdns.org"
    h = hero(
        "field-teal", "PROJECT 02 · DEEP LEARNING · LIVE", "Seismic<br>SoCal",
        "Deep-learning seismology for Southern California. It detects an earthquake, sizes it and "
        "estimates shaking on a live 10-station waveform stream, then push-alerts nearby subscribers.",
        ["Deployed live", "PyTorch", "CNN → Transformer · GNN", "Oracle Cloud"],
        C.seismogram(),
        go(site, "Open the live console", True) + go(rel + "experience/cbu-seismicsocal/", "Research internship"))

    overview = f"""
{stats([("0.992", "Detection ROC-AUC", "vs 0.550 STA/LTA"),
        ("0.840", "Magnitude R²", "vs 0.749 amp+distance"),
        ("0.760", "Alert MCC", "vs 0.655 GMPE-style"),
        ("10", "SeedLink stations", "CI / SCEDC network, live")])}
<hr class="dotted">
<p class="lede">Detect → Size → Warn. Each step is a model, each is compared with the classic seismology
baseline on held-out real waveforms, and the whole chain runs live, 24/7, on a free cloud VM.</p>
<p>SeismicSoCal trains on <strong>5,800+ multi-station SCEDC waveform windows</strong> and 1,126 magnitude events
from 2000–2025. Every split is <strong>chronological</strong> (70/15/15 by event time), because a random split leaks the
future into training. A daemon streams 10 SoCal stations over SeedLink, runs detection continuously, confirms
events across stations, sizes them, and sends Firebase push alerts to the Android app.</p>
<p class="note"><strong>Scope:</strong> this is a research prototype, not an official warning system. It does
detection, characterization and rapid shaking estimation. It does not predict earthquakes, because short-term
prediction is an unsolved problem.</p>"""

    results = f"""
{tip("Deep models beat every classical baseline. Detection: 0.992 vs 0.550.")}
{fig(C.seismic_chart(), "All three models beat the classical baseline on a held-out chronological test set. Detection: 880 windows / 255 events. Magnitude: 5-seed ensemble. Alerts: threshold tuned on validation, not test.")}
{table(["Task", "Architecture", "Deep model", "Baseline"],
       [["<b>Detect</b>: is it a quake?", "CNN → Transformer, single station", "<span class='win'>AUC 0.992</span>, MCC 0.930", "STA/LTA 0.550"],
        ["<b>Size</b>: how big?", "CNN → GNN → Transformer, multi-station", "<span class='win'>R² 0.840</span>, MAE 0.12", "amp + distance 0.749"],
        ["<b>Warn</b>: how hard will it shake?", "CNN → GNN → Transformer on first ~8 s", "<span class='win'>MCC 0.760</span>, recall 0.76 @ precision 0.82", "GMPE-style 0.655"]])}
<h3>Why MCC and AUC, not accuracy</h3>
<p>Earthquake windows are rare, so an "always no" detector looks very accurate. I report ROC-AUC and MCC for
detection, R²/MAE against a physics baseline for magnitude, and <strong>MCC rather than recall</strong> for
alerts. Recall is easy to game once you can move the threshold. The baseline reaches similar recall only by
false-alarming about twice as often.</p>
<h3>Detect, in plain English</h3>
<p>Give it 30 seconds of shaking recorded by a sensor and it decides whether a real earthquake is happening,
or whether it's just ordinary background noise like traffic or wind. It has learned what genuine quakes look like,
so it spots ones the older, simpler alarm would miss. On earthquakes it had never seen before, it makes the right
call about 99% of the time.</p>
{beside(image(rel, "seismic-detect-roc.png", "Held-out test set. Top left: ROC curve, deep detector vs. STA/LTA (0.550). Top right: test AUC for each of 5 seeds, mean 0.992 ± 0.007. Bottom: a real event at CI.TOW2 the deep model caught (P = 1.00) and STA/LTA missed, and a noise window where STA/LTA false-alarmed but the deep model correctly said no (P = 0.00).", alt="Detection ROC, per-seed AUC, and example event and noise windows"), "It catches the quake STA/LTA missed and ignores the noise STA/LTA flagged.", "right")}
<h3>Size, technically</h3>
<p><strong>Network-magnitude regression.</strong> Per-station 3-component waveforms feed a CNN feature extractor,
then a graph convolution across the 10-station network, then a transformer, then a magnitude head. On 1,126 SoCal
events (2000–2025), the 5-seed ensemble scores <strong>R² = 0.840 (MAE 0.12)</strong> against an amplitude + distance
linear baseline at R² = 0.749. A nearest-single-station ablation drops to R² +0.42, which isolates the multi-station
graph fusion as the source of the skill.</p>
{image(rel, "seismic-magnitude-scatter.png", "Predicted vs. USGS catalog magnitude on held-out California events: deep multi-station ensemble (R² 0.840, left) vs. the amplitude + distance physics baseline (R² 0.749, right). Both under-predict the largest event (M5.8 → M5.2 deep, M5.1 baseline), the known limit noted below.", alt="Predicted vs true magnitude scatter, deep ensemble vs baseline")}"""

    models = f"""
<p>All three models share one idea: a <strong>1-D CNN</strong> turns raw waveform into local features, and a
<strong>Transformer encoder</strong> reasons over time. Where several stations matter, a <strong>graph network</strong>
fuses them along the real station geometry.</p>
<h3>Detect · CNN → Transformer</h3>
<p>A 30-second, 100 Hz vertical window (3,000 samples) goes through four strided Conv1d blocks (16→64 channels),
then a 2-layer, 4-head Transformer encoder, then mean pooling and a detection head. It learns waveform shape that a
threshold-on-energy detector like STA/LTA can't see. Mean AUC across 5 seeds is 0.992 ± 0.007.</p>
<h3>Size · CNN → GNN → Transformer</h3>
<p>Each station's 3-component trace is embedded by a CNN, tagged with log-distance, and passed through two
<strong>graph-convolution</strong> layers over a normalized adjacency built from station coordinates. A masked Transformer
then attends across the stations that actually recorded the event, and a hybrid head adds network amplitude features.</p>
{beside(fig(C.ablation_chart(), "Using only the nearest station drops R² from 0.840 to 0.42. The multi-station graph fusion is what beats the baseline."), "Take away the graph network and R² falls from 0.84 to 0.42.", "right")}
<h3>Warn · early-warning ensemble</h3>
<p>The same backbone sees only the <strong>first ~8 seconds after the P-wave</strong> and predicts the peak ground velocity
that arrives later. On the continuous value it ties the physics baseline (R² 0.728 vs 0.720). On the decision
that matters, whether shaking will cross a notable threshold, it wins clearly: MCC 0.760 vs 0.655.</p>
<p class="note"><strong>Known limits:</strong> the magnitude regressor under-predicts the very largest events, and
a five-variant fine-tune search (augmentation, cosine LR, Huber, dropout, physics blend) found no reliable
gain over 0.840. That points to a real ceiling for this data.</p>"""

    live = f"""
<p>The models run <strong>continuously on a live stream</strong>. USGS isn't in the loop, so the detector fires on the
raw waveforms.</p>
{flow([("SeedLink", "10 CI/SCEDC stations stream into rolling per-station buffers", False),
       ("Quality gate", "drop gap-fill zeros, flat runs, clipping and glitch spikes before scoring", False),
       ("Detect", "CNN→Transformer on sliding 30 s windows, all stations", True),
       ("Confirm", "graded multi-station coincidence + geographic move-out check", True),
       ("Size", "GNN magnitude ensemble on confirmed events", False),
       ("Alert", "one combined FCM push per subscribed device", False)], dark=True)}
{tip("This check is what stops phones buzzing on sensor noise.")}
<h3>Killing false alarms: graded coincidence</h3>
<ul>
<li><strong>Confirmed</strong>: at least 2 stations trigger (p ≥ 0.60) within 12 s, cluster within 150 km of the strongest
one, <em>and</em> pass a move-out check. The arrival-time differences must be physically possible given the
distance between stations (slowest wave 2 km/s, plus 4 s of pick jitter). Only confirmed events are sized and pushed.</li>
<li><strong>Tentative</strong>: a lone station above a higher 0.85 bar is logged as a possible false alarm but not
pushed, because lone live triggers are almost always telemetry noise.</li>
<li>Two far-apart stations glitching in the same 12-second window are independent noise, not one source.
The 150 km coherence check catches what move-out alone can't.</li>
<li>Every declaration goes to an audit log, and a scheduled job cross-checks it against the official catalog.</li>
</ul>
<h3>Alerts by station, not location</h3>
<p>Users subscribe to <strong>sensor stations</strong>, not coordinates. Signup ranks the 10 stations by distance and
auto-selects the nearest 3 within 150 km. Each one can be toggled. No latitude or longitude is stored, only station
codes and a push token. A shaking model turns magnitude and distance into the plain-language intensity in the alert text.</p>
{beside(image(rel, "seismic-near-me.png", "Alert me near me, in the Android app: find sensors by city or your location, then subscribe or unsubscribe station by station. It's labelled as rapid detection, not an official warning.", "Screenshot", alt="Alert me near me station subscription screen", phone=True), "Subscribe to sensors, not a location.", "right")}"""

    stack = f"""
<p>The whole service runs on an <strong>Oracle Cloud Always-Free Ampere A1</strong> (ARM64) VM. <strong>Caddy</strong>
provides automatic HTTPS and the static site, and a <strong>systemd</strong> unit runs the stdlib-Python backend, which
auto-spawns the SeedLink daemon and respawns it if the stream drops. A separate systemd timer runs the
catalog cross-check.</p>
{tiles([("Backend", "Python stdlib HTTP server: stations, geocode, push registration, status, contact, biggest SoCal quakes."),
        ("Frontend", "React + Vite console: Detect/Size/Warn carousel with evidence, quake browser, near-me signup."),
        ("Mobile", "Capacitor Android app built against the live backend, downloadable from /app."),
        ("Push", "Firebase Cloud Messaging, with one combined message per device personalised by station distance.")])}
{diagram(rel, "seismicsocal-architecture.webp", "earthquakeDiagram.png", "SeismicSoCal architecture diagram",
         "Offline: SCEDC waveforms labelled against the USGS catalog train the detection, EEW and magnitude models. Online: the live watcher streams SeedLink, runs detection and sizing, and sends FCM alerts. The React console and mobile clients talk to the API server.")}
{image(rel, "seismic-console.png", "The live console's Detect card with its evidence open: the headline 0.992 ROC-AUC vs. STA/LTA, the plain-English explanation, and the same held-out evidence figure shown above.", "Live site", alt="SeismicSoCal Detect card with evidence")}"""

    main_html = (
        image(rel, "seismic-hero.png", "seismicsocal.duckdns.org: three deep models on real held-out waveforms (1,126 events, 10 stations, M 3.5–7.1), each tested against the classic seismology baseline, with the live SeedLink status in the corner.", "Live site", alt="SeismicSoCal live site")
        + panel("overview", "Overview", overview, num="01")
        + panel("results", "Results vs. classical seismology", results, num="02")
        + panel("models", "The three models", models, num="03")
        + panel("live", "Live detection daemon", live, num="04")
        + panel("deploy", "Deployment &amp; architecture", stack, num="05")
        + pager(rel, ("projects/academy-of-testers/", "Academy of Testers"), ("projects/bearlm/", "BearLM")))

    rail = (
        rail_btns([("WWW", "Live console", site), ("APK", "Android app", site + "/app"),
                   ("GH", "Source code", ctx["github"] + "/earthquake")])
        + panel("toc-sz", "On this page", toc([("overview", "Overview"), ("results", "Results"), ("models", "Models"),
                                              ("live", "Live daemon"), ("deploy", "Deployment")]),
                body_cls="panel-body tight")
        + panel("spec-sz", "Spec sheet", spec([("Region", "Southern California"), ("Data", "SCEDC, 2000–2025"),
                                                ("Events", "1,126 (magnitude)"), ("Windows", "5,863 (detection)"),
                                                ("Split", "chronological 70/15/15"), ("Ensembles", "5 seeds"),
                                                ("Host", "Oracle A1 · systemd")]), body_cls="panel-body tight")
        + panel("stations", "Stations", chips(["CCC", "CLC", "TOW2", "WBM", "PASC", "SVD", "RIO", "MWC", "DGR", "BAK"]),
                body_cls="panel-body tight")
        + panel("stack-sz", "Stack", chips(["PyTorch", "ObsPy", "SeedLink", "scikit-learn", "NumPy", "React", "Vite",
                                            "Capacitor", "FCM", "Caddy", "systemd", "Oracle Cloud"]), body_cls="panel-body tight")
        + info("What is — STA/LTA?",
               "<p>The classic trigger: the ratio of short-term to long-term average signal energy. It's fast and "
               "simple, but it reacts to any burst of energy, which is why it scores only 0.550 AUC here.</p>"))
    return h, layout(main_html, rail)


# ============================================================================ BEARLM


def bearlm(ctx):
    rel = ctx["rel"]
    h = hero(
        "field-red", "PROJECT 03 · RAG · LOCAL LLM", "BearLM",
        "A fully local, zero-cost Q&amp;A assistant over UC Berkeley CS and Data Science courses. Every answer is "
        "cited to the exact PDF page, and it refuses when the material doesn't cover the question.",
        ["Aug 2026 – present", "Data &amp; AI Engineer", "$0 / query"],
        C.mini_bars([("dense", .56, False), ("hybrid", .60, False), ("+rerank", .82, True)],
                    title="recall@1 · retrieval ablation"),
        go(ctx["github"] + "/bearlm", "Source on GitHub", True))

    overview = f"""
{stats([("0.82", "recall@1", "from 0.56 dense-only"),
        ("0.83", "RAGAS faithfulness", "from 0.55"),
        ("0.97", "Answer relevancy", "from 0.80"),
        ("10K", "chunks indexed", "10 courses · 768-dim")])}
<hr class="dotted">
<p class="lede">Course Q&amp;A bots fail in two ways: they retrieve the wrong passage, or they make up an answer
when there isn't a right one. BearLM is built to fix both.</p>
<p>BearLM runs entirely on one machine with <strong>LangChain, Ollama, Llama 3.1 8B, nomic-embed-text and Chroma</strong>,
so it needs no API keys and has no cloud bill. It covers CS61A, CS61B, CS70, CS188, CS189, Data 8, Data 100, Data 101,
Data 144 and generative ML. Beyond the shared corpus, <strong>Projects</strong> let you bring your own PDFs and hold
multi-turn, grounded conversations over them.</p>
{bullets([
    "Built a fully local, zero-cost RAG Q&amp;A assistant (LangChain, Ollama, Llama 3.1 8B, nomic-embed-text, Chroma) over "
    "~10K chunks spanning UC Berkeley CS/DS courses. I blended keyword and meaning-based search (<strong>BM25 + vector "
    "embeddings</strong>) with reranking to pull the most relevant sources, lifting <strong>recall@1 from 56% to 82%</strong> and recall@5 to 86%.",
    "Reduced hallucinated answers by grounding every response strictly in its retrieved sources. That combines a relevance filter "
    "that scores and drops weak matches, query rewriting for sharper retrieval, strict context-only prompting, and clickable "
    "page-level citations, raising <strong>RAGAS faithfulness from 0.55 to 0.83</strong> (0.97 relevance).",
    "Engineered an ETL pipeline that ingests mixed file types (PDF, Markdown, Jupyter), token-chunks them with metadata, and "
    "batch-embeds ~10K records with <strong>retry/backoff</strong> into Chroma, BM25 and SQLite for hybrid search and analytics.",
])}
{beside(image(rel, "bearlm-ask.png", "The Ask page: a grounded answer to \"What is an Index Scan?\" with its sources as clickable course · section tags (Data 101, GenML). Above, the Improve prompt button and the query-rewrite toggle; below, the live course list in the corpus.", "Screenshot", alt="BearLM Ask page with cited answer"), "Every answer lists exactly where it came from.", "right")}"""

    retrieval = f"""
{flow([("Rewrite", "optional LLM query rewrite for a sharper search string", False),
       ("BM25", "keyword recall: exact terms, function names, notation", False),
       ("Dense", "nomic-embed-text vectors in Chroma: meaning and paraphrase", False),
       ("RRF fuse", "Reciprocal Rank Fusion (k = 60) merges both lists", True),
       ("Rerank", "bge-reranker-base cross-encoder: 15 candidates → top 4", True)])}
<h3>Why hybrid?</h3>
<p>Course questions mix two kinds of language. Some are exact: "<code>__init__</code>", "Dijkstra", a
specific CS61B lab name. Others are conceptual: "why does this recursion blow up?" Dense vectors are good
with paraphrase and bad with rare exact terms. BM25 is the reverse. Reciprocal Rank Fusion combines them
without having to calibrate their scores against each other, and a cross-encoder reranker then reads each
question/passage pair together to pick the best four.</p>
{tip("The reranker is the big jump: recall@1 from 0.60 to 0.82.")}
{fig(C.recall_chart(), "Each stage measurably helps. Hybrid search lifts recall, and the reranker sharpens the top rank (recall@1 0.60 → 0.82, MRR 0.70 → 0.84).")}
<h3>A benchmark with exact gold labels</h3>
<p>Instead of hand-labelling relevance, the eval set is <strong>generated from real corpus chunks</strong>. Each
question is written from one specific chunk, so that chunk's <code>(course, section, chunk_id)</code> is the exact
answer key. recall@k then asks a precise question: did retrieval surface the true source? It's a synthetic
benchmark with real gold labels, 50 questions across the courses.</p>"""

    grounding = f"""
<p>Better retrieval isn't enough on its own. The generator also has to <em>stay inside</em> what was retrieved.
Four defenses work together:</p>
{tiles([("Confidence gate", "The cross-encoder scores every chunk. Below 0.02 it's dropped, and if nothing clears the bar, BearLM refuses instead of guessing."),
        ("Strict prompt", "Answer only from the context, otherwise return an exact refusal string. Temperature 0, 8K context."),
        ("Query rewriting", "Optionally rewrites vague questions into sharper retrieval queries, and the UI shows which query was used."),
        ("Page citations", "Deduplicated (course, section) citations that open the source PDF at the cited page.")])}
{beside(fig(C.ragas_chart(), "RAGAS with a local Llama 3.1 judge. Better context in gives better-grounded answers out: faithfulness 0.55 → 0.83, relevancy 0.80 → 0.97."), "", "left")}
<p class="note"><strong>Reported honestly:</strong> the RAGAS runs are small (n = 6) with a small local judge, and on one
hybrid sample the judge couldn't produce parseable output, so RAGAS dropped it. The retrieval ablation (n = 50) is the
stronger evidence. The gate threshold is calibrated to bge's sigmoid scores (off-topic ≈ 0.0, real matches ≥ ~0.04).
"Summarize this doc" questions skip the gate, since they don't match any single passage.</p>"""

    etl = f"""
{flow([("Extract", "PDF (pdfplumber), Markdown, Jupyter .ipynb, some sources are cloned course repos", False),
       ("Chunk", "token-length RecursiveCharacterTextSplitter (tiktoken) + {course, section, source, chunk_id}", False),
       ("Embed", "batched nomic-embed-text with retry and exponential backoff", True),
       ("Load", "Chroma vectors · BM25 index · SQLite analytics", False)])}
<p>Re-ingesting rebuilds the whole store, about 10.4K chunks. On Windows, firing thousands of embedding
requests at a local server runs into socket exhaustion (<code>WSAENOBUFS</code>), so embedding is batched with
retry and backoff. The pipeline then finishes reliably instead of dying halfway through. The BM25 index (~40 s
to build over 10K docs) is pre-warmed on a background thread at startup and cached.</p>
<p>A <code>BACKEND=local|openai</code> flag keeps the original OpenAI + MongoDB Atlas path working for
side-by-side comparison. Local costs <strong>$0.0000/query</strong> against roughly $0.0006 for OpenAI, with a median
answer time of about 6 s on an 8 GB RTX 4060.</p>
{tip()}
{diagram(rel, "bearlm-architecture.webp", "bearlmDiagram.png", "BearLM architecture diagram",
         "The learner uses the web and Projects interfaces through a FastAPI HTTP API. Answer orchestration (rag.py) combines hybrid retrieval, confidence reranking and the answer model over Ollama. Corpus ingestion extracts, splits and embeds course materials into vector collections.", scroll=True)}"""

    product = f"""
<p>BearLM is a full product, not just a script: a FastAPI backend and a hand-built vanilla-JS frontend
(marked, DOMPurify, KaTeX, all vendored locally) that renders Markdown tables, code blocks and LaTeX.</p>
{tiles([("Projects", "Bring your own PDFs, keep multiple persistent chats, and get project-first answers that fall back to the course corpus."),
        ("Corpus scoping", "Per-project checkboxes choose which courses an answer may fall back on."),
        ("Chat with a PDF", "Ad-hoc single-document sessions, strictly grounded with no fallback."),
        ("Analytics", "SQLite usage stats, most-cited courses, unanswered questions, and auto-generated practice questions for the weakest area.")])}
<h3>Projects</h3>
{image(rel, "bearlm-projects.png", "A Projects workspace (Data101): multiple saved chats in the sidebar, Reset context, and corpus-fallback scoping. With no PDFs in the project, the answer is marked From course corpus and cites its sections.", "Screenshot", alt="BearLM Projects workspace")}
<h3>Analytics</h3>
{beside(image(rel, "bearlm-analytics.png", "The analytics page: questions asked, courses cited, answered vs. no-source counts, the course that needs the most help (with its hot-spot topics and a Generate practice questions button), and most-cited courses.", "Screenshot", alt="BearLM analytics page"), "It spots the weakest course and writes practice questions for it.", "left")}"""

    main_html = (
        panel("overview", "Overview", overview, num="01")
        + panel("retrieval", "Hybrid retrieval", retrieval, num="02")
        + panel("grounding", "Anti-hallucination", grounding, num="03")
        + panel("etl", "Ingestion pipeline &amp; architecture", etl, num="04")
        + panel("product", "The product", product, num="05")
        + pager(rel, ("projects/seismicsocal/", "SeismicSoCal"), ("experience/lawrence-berkeley-lab/", "Berkeley Lab")))

    rail = (
        rail_btns([("GH", "Source code", ctx["github"] + "/bearlm")])
        + panel("toc-bl", "On this page", toc([("overview", "Overview"), ("retrieval", "Hybrid retrieval"),
                                              ("grounding", "Anti-hallucination"), ("etl", "Ingestion"), ("product", "Product")]),
                body_cls="panel-body tight")
        + panel("spec-bl", "Spec sheet", spec([("Generator", "Llama 3.1 8B"), ("Embeddings", "nomic-embed-text"),
                                                ("Vector store", "Chroma"), ("Keyword", "BM25 (rank_bm25)"),
                                                ("Reranker", "bge-reranker-base"), ("Eval", "recall@k · MRR · RAGAS"),
                                                ("Cost", "$0 / query")]), body_cls="panel-body tight")
        + panel("courses", "Courses indexed", chips(["CS61A", "CS61B", "CS70", "CS188", "CS189", "Data 8", "Data 100",
                                                     "Data 101", "Data 144", "GenML"]), body_cls="panel-body tight")
        + panel("stack-bl", "Stack", chips(["Python 3.13", "LangChain", "Ollama", "Chroma", "FastAPI", "SQLite",
                                            "sentence-transformers", "RAGAS", "uv", "Vanilla JS", "KaTeX"]), body_cls="panel-body tight")
        + info("What is — recall@k?",
               "<p>The share of questions where the true source chunk appears in the top <i>k</i> retrieved results. "
               "recall@1 = 0.82 means the first passage BearLM reads is the right one 82% of the time.</p>"))
    return h, layout(main_html, rail)


# ============================================================================ BERKELEY LAB


def lbnl(ctx):
    rel = ctx["rel"]
    h = hero(
        "field-indigo", "INTERNSHIP · RESEARCH", "Berkeley Lab",
        "Data Science &amp; Machine Learning Research Intern at Lawrence Berkeley National Laboratory, "
        "forecasting XCache traffic so the people who run the cache can plan for load before it arrives.",
        ["Sep 2026 – present", "Berkeley, CA", "PatchTST · PyTorch"],
        C.patchtst_schematic(dark=True), small=False)

    overview = f"""
{stats([("-24<small>%</small>", "RMSE vs persistence", "best target"),
        ("3<small>yr</small>", "of XCache traffic logs", "EDA + forecasting"),
        ("All", "targets beat baseline", "every horizon"),
        ("Multi", "horizon forecasts", "tuned lookback windows")])}
<hr class="dotted">
<p class="lede">XCache is a data cache layer for large scientific workflows. If you know traffic will spike,
you can provision for it. If you miss the spike, everything downstream slows down.</p>
<p>My work had two halves. One was building a forecaster that beats the hard-to-beat naive baseline. The other was
finding out, with evidence, <em>how predictable the peaks are at all</em>, so the team designs features and models
around a real ceiling instead of chasing it.</p>
{bullets([
    "Implemented <strong>PatchTST</strong> (PyTorch / neuralforecast) for multivariate time-series forecasting of cache-traffic "
    "signals across multiple horizons, tuning lookback windows and <strong>beating a persistence baseline on all targets by up to 24% RMSE</strong>.",
    "Exposed the ceiling on peak-load predictability and guided feature and model design by building reproducible <strong>Pandas EDA "
    "pipelines over 3 years of XCache traffic logs</strong>. I visualized seasonality, change-points and right-skewed peaks with "
    "Matplotlib, Seaborn and Plotly, and used <strong>rolling cross-validation</strong> to show that models under-predict rare peaks.",
])}"""

    model = f"""
<p><strong>PatchTST</strong> treats a time series the way a vision transformer treats an image. It cuts the lookback
window into short <em>patches</em>, turns each patch into a token, and lets a Transformer attend across patches.
Each channel is handled independently with shared weights. Patching keeps local shape (a ramp, a burst) intact
inside one token and cuts the sequence length the attention has to cover.</p>
{beside(fig(C.patchtst_schematic(), "How PatchTST sees a lookback window: patches become tokens, a channel-independent Transformer encodes them, and heads emit forecasts at several horizons. Schematic only, not real data.", "Schematic"), "", "right")}
<h3>The baseline that's hard to beat</h3>
<p>For traffic, "tomorrow looks like today" (<strong>persistence</strong>) is a strong baseline. Most of the
signal is momentum and daily rhythm. A model that can't beat persistence on every horizon isn't worth deploying,
so persistence was the bar for every target.</p>
{tip("Persistence is hard to beat. PatchTST beat it on every target.")}
{fig(C.rmse_gauge(), "Persistence indexed to 100. PatchTST beat it on every target; the largest margin was 24% lower RMSE.")}
<h3>What I tuned</h3>
<ul>
<li><strong>Lookback window length</strong> per horizon. Longer windows capture weekly structure, while shorter ones adapt faster to change-points.</li>
<li>Forecast horizons from short to long, with a separate evaluation for each so a good short horizon can't hide a weak long one.</li>
<li>Evaluation that is <strong>always walk-forward</strong>. No fold ever trains on data that comes after its test window.</li>
</ul>
{image(rel, "lbnl-forecast-vs-actual.png", "Daily hit_size (TB) over the test period: actual vs. PatchTST. The forecast tracks the everyday level and rhythm, but the rare spikes (some above 200 TB) are far above the prediction.", alt="Daily hit_size, actual vs PatchTST")}

<h3>Lookback depends on the horizon</h3>
<p>The best lookback window isn't fixed. At 1-day and 7-day horizons a <strong>~100-day lookback</strong> wins, which
reflects real seasonality. At a <strong>30-day horizon</strong> that advantage disappears:</p>
{tip("At 30 days out, short lookbacks win. 100–300 days never does.")}
{table(["Feature", "3", "7", "14", "28", "40", "60", "80", "100", "120", "150", "200", "300"],
       [["access_count", "<span class='win'>11,641</span>", "11,858", "12,915", "13,219", "12,774", "12,601", "12,150", "11,917", "11,803", "12,506", "12,327", "12,898"],
        ["access_size", "<span class='win'>28.51</span>", "29.52", "31.47", "33.36", "32.11", "33.08", "32.01", "32.18", "33.45", "33.44", "32.15", "34.23"],
        ["hit_count", "<span class='win'>10,708</span>", "10,880", "11,358", "12,264", "11,815", "11,669", "11,010", "10,955", "10,988", "11,745", "11,786", "12,117"],
        ["hit_size", "<span class='win'>27.95</span>", "29.02", "30.64", "32.72", "31.46", "32.59", "31.36", "31.56", "32.90", "32.93", "31.85", "33.75"],
        ["miss_count", "1,475", "1,444", "1,677", "<span class='win'>1,300</span>", "1,768", "1,704", "1,697", "1,879", "1,737", "2,030", "1,896", "2,640"],
        ["miss_size", "0.860", "0.785", "1.030", "<span class='win'>0.715</span>", "0.956", "0.962", "0.936", "1.009", "1.030", "1.049", "1.080", "1.673"]],
       num_cols=tuple(range(1, 13)))}
<p class="note">RMSE by lookback window (days) at a 30-day forecast horizon, per feature; lower is better and the best per
feature is highlighted.</p>
<p><strong>Long lookback doesn't help at 30 days.</strong> A 3-day lookback wins on 4 of the 6 features and 28 days wins
the other 2; 100–300-day lookbacks are never the best. The ~100-day seasonal advantage seen at the 1- and 7-day horizons
doesn't carry over to a 30-day forecast. The shape of the error curve does hint that a lookback around 120 days could
do better, which is worth testing next.</p>"""

    eda = f"""
<p>Before modelling, I built <strong>reproducible Pandas pipelines</strong> over three years of XCache logs:
loading, cleaning, resampling, and a fixed set of diagnostic views that rerun end to end on new data.</p>
{tiles([("Seasonality", "Daily and weekly rhythm in request volume, which is what persistence and the model both exploit."),
        ("Change-points", "Regime shifts where the level or variance of traffic jumps, so a window from before is misleading after."),
        ("Right-skewed peaks", "Most hours are ordinary and a few are extreme. The tail is what operations care about most."),
        ("Rolling CV", "Walk-forward folds that show where errors concentrate over time.")])}
{beside(fig(C.rolling_cv_schematic(), "Rolling-origin cross-validation: each fold trains only on the past and validates on the next block, which mirrors how the model would actually be used.", "Schematic"), "Walk-forward only: no fold ever peeks at the future.", "right")}
<h3>The finding: a ceiling on peaks</h3>
<p>Across folds the models track the baseline load well but <strong>systematically under-predict rare peaks</strong>.
Peaks are right-skewed, infrequent, and often not foreshadowed in the lookback window, so a model trained to
minimize average error learns to hedge toward the typical level. That changed the question the team asked. Instead of
"which architecture predicts peaks?", it became "what signal would make peaks predictable?", and that question drives feature design.</p>
<h3>Does the loss function fix it?</h3>
<p>One natural fix is to change what the model is trained to minimise. I compared five losses, from the softest
(MAE) through Huber at three thresholds to the strictest (MSE), on hit_size with a 100-day lookback at a 1-day
horizon.</p>
{beside(image(rel, "lbnl-loss-comparison.png", "hit_size, prediction vs. actual for five training losses (MAE, Huber δ = 0.5 / 1.0 / 2.0, MSE), lookback 100, 1-day horizon. The shaded areas are the peak gap: under every loss the largest spikes are still under-predicted.", alt="Prediction vs actual for five loss functions"), "Five losses, same story: the biggest spikes stay under-predicted.", "right")}"""

    main_html = (
        panel("overview", "Overview", overview, num="01")
        + panel("model", "Forecasting with PatchTST", model, num="02")
        + panel("eda", "EDA &amp; the predictability ceiling", eda, num="03")
        + pager(rel, ("projects/bearlm/", "BearLM"), ("experience/cbu-seismicsocal/", "CBU Research")))

    rail = (
        panel("toc-lb", "On this page", toc([("overview", "Overview"), ("model", "PatchTST forecasting"), ("eda", "EDA &amp; ceiling")]),
              body_cls="panel-body tight")
        + panel("spec-lb", "Spec sheet", spec([("Org", "Lawrence Berkeley National Lab"), ("Role", "DS &amp; ML Research Intern"),
                                                ("Dates", "Sep 2026 – present"), ("Model", "PatchTST"),
                                                ("Baseline", "Persistence"), ("Validation", "Rolling-origin CV")]),
                body_cls="panel-body tight")
        + panel("stack-lb", "Stack", chips(["PyTorch", "neuralforecast", "Pandas", "NumPy", "Matplotlib", "Seaborn", "Plotly"]),
                body_cls="panel-body tight")
        + info("What is — persistence?",
               "<p>The naive forecast: predict that the next value equals the last observed one. For traffic with "
               "strong momentum it's surprisingly hard to beat, which makes it the honest bar.</p>"))
    return h, layout(main_html, rail)


# ============================================================================ CBU


def cbu(ctx):
    rel = ctx["rel"]
    full = _cbu_full(ctx["cbu_public"])
    h = hero(
        "field-ice", "INTERNSHIP · RESEARCH", "CBU Research",
        "Machine Learning Research Intern at California Baptist University. I diagnosed why a structural "
        "inverse-FEA predictor stalled, then built the deep-learning detection and alerting system behind SeismicSoCal.",
        ["May 2026 – present", "Riverside, CA", "seismicsocal.duckdns.org"],
        (C.mini_bars(full.HERO_BARS, title=full.HERO_TITLE, fmt=lambda v: f"{v:.3f}") if full else C.seismogram()),
        go(rel + "projects/seismicsocal/", "SeismicSoCal case study") + go("https://seismicsocal.duckdns.org", "Live site", True))

    overview = f"""
{stats([("7", "ML models benchmarked", "inverse-FEA diagnosis"),
(full.STAT if full else ("~0.10", "R² ceiling", "a data limit, not a model limit")),
        ("0.992", "Detection ROC-AUC", "vs 0.550 baseline"),
        ("0.840", "Magnitude R²", "GNN ensemble")])}
<hr class="dotted">
{bullets([
    "Diagnosed the root cause of a stalled <strong>inverse-FEA predictor</strong> by benchmarking 7 ML models (Random Forest, XGBoost, "
    "HGB/ExtraTrees ensembles, PCA pipelines) and running paired clean-vs-noisy signal analysis. This proved the "
    "<strong>R² ≈ 0.10 ceiling was a data limitation rather than a model limitation</strong> and redirected the team away from futile model tuning.",
    "Raised earthquake-detection accuracy to <strong>0.992 ROC-AUC (vs. 0.550 baseline)</strong> and magnitude-estimation <strong>R² to 0.840</strong> by "
    "training PyTorch CNN→Transformer and GNN ensembles on 5,800+ multi-station SCEDC waveform windows.",
    "Built a <strong>real-time daemon streaming 10 SeedLink stations</strong> that runs continuous CNN→Transformer detection plus GNN-fused "
    "multi-station magnitude estimation. It confirms events with graded multi-station coincidence and geographic move-out checks before "
    "dispatching FCM push alerts, and it's deployed on an Oracle Cloud VM under systemd.",
])}"""

    if full:
        fea = full.fea(rel, __import__(__name__))
    else:
        # Unpublished research: method only, no figures, no exact results beyond what the résumé states.
        fea = f"""
<p>An <strong>inverse finite-element</strong> problem runs simulation backwards: given a structure's measured
response, recover the material properties that produced it. One target in the model behind the team's IEEE
research paper was stuck at <strong>R² ≈ 0.10</strong>, and the instinct was to keep tuning models. I set out to find
out whether tuning could help at all.</p>
<p class="note">This work is part of an unpublished paper, so its figures and detailed results are held back until
publication. The method is below.</p>

<h3>Step 1 · Benchmark seven models</h3>
<p>If the bottleneck is the model, different inductive biases should give different answers. I benchmarked
<strong>seven model configurations</strong> under the same cross-validation: a baseline random forest, chained random
forests, and my own models, including boosted / ExtraTrees ensembles and PCA pipelines. Every one landed on the same
ceiling for the hard target, while the easier targets were predicted well by all of them.</p>
{tip("Seven very different models, one ceiling. That's the data talking.")}

<h3>Step 2 · Paired clean vs. noisy data</h3>
<p>The decisive test was to <strong>train on clean data and on noisy data side by side</strong>. If a target is recoverable
from clean data but not once realistic noise is added, then no model trained on noisy data will get it back, however
it's tuned. That's exactly what happened.</p>

<h3>Step 3 · Where the noise lives</h3>
<p>Next I measured how much noise each group of measurements carries relative to its signal, and ran an ablation
using only the cleanest inputs. Dropping the noisiest inputs didn't rescue the target.</p>

<h3>Step 4 · How fragile is each target?</h3>
<p>Finally I swept the amount of measurement noise and tracked R² for each target: an identifiability curve showing how
much noise each target can tolerate. At the real measurement noise, the hard target can't be recovered.</p>

<h3>The outcome</h3>
<p>Every line of evidence pointed the same way: the <strong>R² ≈ 0.10 ceiling was a data limitation, not a model
limitation</strong>. That redirected the team from model tuning to the inputs: what's measured, and at what signal
quality. A negative result like this saves weeks.</p>"""

    seismic_sec = f"""
<p>The second half of the internship became <strong>SeismicSoCal</strong>, deep-learning seismology for Southern
California, now deployed live. The full case study has the details. In short:</p>
{beside(fig(C.seismic_chart(), "Held-out chronological test set. Detection 0.992 vs 0.550 STA/LTA, magnitude R² 0.840 vs 0.749, early-warning alert MCC 0.760 vs 0.655."), "", "right")}
{flow([("Stream", "10 SeedLink stations", False), ("Detect", "CNN→Transformer, continuous", True),
       ("Confirm", "coincidence + move-out", True), ("Size", "GNN ensemble", False), ("Push", "FCM alerts", False)], dark=True)}
<p style="margin-top:12px">{go(rel + "projects/seismicsocal/", "Read the full SeismicSoCal case study")}</p>"""

    approach = f"""
<p>Both halves of this internship (and my other research) follow the same loop. Here is each step, with what it
looked like in practice.</p>
{tip("Research is a loop, not a line.", prop="scholar")}
{research_steps(ctx["cbu_public"])}"""

    main_html = (
        panel("overview", "Overview", overview, num="01")
        + panel("fea", "Diagnosing the inverse-FEA ceiling", fea, num="02")
        + panel("seismic", "Building SeismicSoCal", seismic_sec, num="03")
        + panel("approach", "How I approach research", approach, cls="platinum", num="04")
        + pager(rel, ("experience/lawrence-berkeley-lab/", "Berkeley Lab"), ("experience/numistoken/", "NumIsToken")))

    rail = (
        rail_btns([("WWW", "SeismicSoCal live", "https://seismicsocal.duckdns.org"),
                   ("CS", "Case study", rel + "projects/seismicsocal/")])
        + panel("toc-cb", "On this page", toc([("overview", "Overview"), ("fea", "Inverse-FEA diagnosis"),
                                              ("seismic", "SeismicSoCal"), ("approach", "Approach")]), body_cls="panel-body tight")
        + panel("spec-cb", "Spec sheet", spec([("Org", "California Baptist Univ."), ("Role", "ML Research Intern"),
                                                ("Dates", "May 2026 – present"), ("Location", "Riverside, CA"),
                                                ("Models", "RF · XGB · CNN · GNN"), ("Deploy", "Oracle Cloud · systemd")]),
                body_cls="panel-body tight")
        + panel("stack-cb", "Stack", chips(["scikit-learn", "XGBoost", "PyTorch", "ObsPy", "SeedLink", "NumPy", "FCM", "systemd"]),
                body_cls="panel-body tight")
        + info("What is — inverse FEA?",
               "<p>Finite-element analysis predicts how a structure responds to loads. The <i>inverse</i> problem "
               "infers the hidden properties or loads from a measured response, and it's only as good as the measurements.</p>"))
    return h, layout(main_html, rail)


# ============================================================================ NUMISTOKEN


def numis(ctx):
    rel = ctx["rel"]
    h = hero(
        "field-carbon", "INTERNSHIP · FULL-STACK", "NumIsToken",
        "Full-Stack Software Engineering Intern. I made token redemptions recoverable, built the product "
        "serialization tool for admins, and cut redemption action load times by about 85%.",
        ["Sep 2025 – Jun 2026", "Berkeley, CA", "Backend · Docker"],
        C.mini_bars([("before", 1.0, False), ("after", 0.12, True)], title="relative load time · redemption actions"))

    overview = f"""
{stats([("-85<small>%</small>", "Redemption load time", "~2–3 s → ~300 ms"),
        ("0", "Unrecoverable stuck redemptions", "a whole failure class removed"),
        ("NUMI", "Serial + barcode labels", "admin serialization tool"),
        ("Docker", "Production packaging", "containerized + deployed")])}
<hr class="dotted">
{bullets([
    "Enabled resumable redemptions for previously unrecoverable transactions by building <strong>Redemption History and Detail "
    "services</strong> with robust state management and payment-resumption logic, <strong>eliminating a class of stuck-transaction failures</strong>.",
    "Reduced redemption action load times by <strong>~85% (~2–3 s to ~300 ms)</strong> by removing redundant function calls to streamline "
    "backend lifecycle APIs, then containerizing and deploying backend services with <strong>Docker</strong> for production readiness.",
])}"""

    resumable = f"""
<p>A redemption is a multi-step transaction: the user starts it, a payment step runs, and tokens are
redeemed. If anything failed between steps (a dropped connection, a closed tab, a provider timeout),
the transaction got <strong>stuck</strong>. There was no record a user or the system could use to finish it.</p>
{tip("Before this, an interrupted redemption was stuck for good.")}
{fig(C.redemption_states(), "Simplified illustration of the idea, not the production schema: every step's state is persisted, so an interrupted redemption can be found and resumed from its last durable state.", "Illustration")}
<h3>What I built</h3>
<ul>
<li><strong>Redemption History service</strong>: a durable, queryable record of each user's redemptions and where each one stands.</li>
<li><strong>Redemption Detail service</strong>: the full state of one redemption, with enough context to resume it.</li>
<li><strong>Payment-resumption logic</strong>: continue an interrupted redemption from its last confirmed state instead of
restarting it or abandoning it, guarding against acting twice on the same payment.</li>
</ul>
<p>The result is that a whole <strong>class</strong> of failures disappeared. It wasn't one bug fix. The system can now
recover from any interruption between steps.</p>
<h3>The history views</h3>
<p>These are the style guides for the account's history views: a list of past submissions with their status, and a
detail page that tracks each one through <strong>Submitted → Received → Missing Documents → Minted</strong>, flags any
action the user needs to take, and lists the items and return address.</p>
<div class="fig-pair">
  {image(rel, "numis-submission-history.webp", "Submission history: each submission with its ID, item, quantity, date and status. Tabs switch between wallet info, submission history and redemption history.", "Style guide", alt="Submission history list style guide")}
  {image(rel, "numis-submission-detail.webp", "Submission detail: a status tracker, an action-needed alert when documents are missing, the item table and the return address.", "Style guide", alt="Submission detail style guide")}
</div>
<p class="note">Style-guide mockups with placeholder data, not production screenshots.
Open the interactive versions: <a href="user_submission_list.html" target="_blank" rel="noopener">history list</a> ·
<a href="user_submission_detail.html" target="_blank" rel="noopener">submission detail</a>.</p>"""

    serial = f"""
<p>Every physical item that becomes a NumisToken (a graded coin, a medal or a bullion bar) needs a unique serial
number and a physical barcode label. I built the <strong>product serialization tool</strong> admins use to do both
in one step.</p>
{beside(image(rel, "numis-serialization-prod.png", "The production serialization screen for admins: product details and the submission item ID, then the serial, its Code 128 barcode and the ZPL for the Zebra printer. Preview format uses a placeholder sequence and allocates nothing; Assign to item saves the serial on the submission item and advances the counter; Load label reprints an existing serial.", "Production", alt="Production product serialization screen"), "One form in; a unique serial, a barcode label and printer-ready ZPL out.", "right")}
<p>I designed the screen first as a standalone mockup, then built it into the admin app:</p>
{image(rel, "numis-serialization.webp", "The original design mockup: the same inputs, a 4″ × 2″ label preview and the ZPL output, laid out side by side.", "Design mockup", alt="Serialization screen design mockup")}
<h3>How a serial is built</h3>
<div class="formula halftone">NUMI-<span class="k">{{Category}}</span>-<span class="k">{{Material}}</span>-<span class="k">{{Weight}}</span>-<span class="k">{{OriginalSN}}</span>-<span class="k">{{Sequence}}</span>
<span class="c">// e.g. NUMI-C-G-1OZ-SN78432-0000000001   (coin · gold · 1 oz · grading-cert SN · 1st in its prefix)</span></div>
<ul>
<li><strong>Category and material codes</strong>: C/M/B for coin, medal or bar, and G/S/P/C for gold, silver, platinum or copper.</li>
<li><strong>Weight</strong> as a value plus unit (OZ, G or KG).</li>
<li><strong>Original serial number</strong> from the grading certificate or mint (1–20 letters and digits), or <code>NOSN</code> for ungraded items.</li>
<li><strong>A sequence number</strong>, zero-padded to 10 digits and counted separately for each category + material prefix.
It's only allocated when a serial is assigned to a submission item, so previews never burn numbers.</li>
</ul>
<h3>From serial to printed label</h3>
<ul>
<li>A live <strong>4″ × 2″ label preview</strong> with a <strong>Code 128 barcode</strong> of the serial.</li>
<li><strong>ZPL output</strong> for Zebra label printers, with copy to clipboard.</li>
<li><strong>Load label</strong> to reprint the label for a serial that already exists.</li>
<li>Validation on required fields and the serial-number format, so a bad label can't be printed.</li>
</ul>
<p class="note">Open the <a href="NumisToken_Serialization_Screen.html" target="_blank" rel="noopener">interactive design mockup</a>
(front-end only: its sequence counter runs in the browser, while the production tool allocates it on the backend).</p>"""

    perf = f"""
<p>Redemption actions felt slow, taking two to three seconds per action. Profiling the lifecycle APIs showed the time
wasn't going into real work. It went into <strong>redundant function calls</strong>: the same lookups and checks repeated
across the lifecycle of a single request.</p>
{beside(fig(C.latency_chart(), "Streamlining the backend lifecycle APIs took redemption actions from about 2–3 seconds to about 300 ms, roughly an 85% reduction."), "", "right")}
<h3>Then: production-ready packaging</h3>
<p>With the services faster and recoverable, I <strong>containerized the backend services with Docker</strong> and deployed
them. That gave the same build in development and production, reproducible environments, and a clean path to deploy.</p>"""

    main_html = (
        image(rel, "numis-hero.webp", "The NumIsToken home screen: tokenize a coin or go to OpenSea, with live gold and silver prices in the top bar.", "Live site", alt="NumIsToken home screen")
        + panel("overview", "Overview", overview, num="01")
        + panel("resumable", "Resumable redemptions", resumable, num="02")
        + panel("serial", "Product serialization tool", serial, num="03")
        + panel("perf", "~85% faster redemption actions", perf, num="04")
        + pager(rel, ("experience/cbu-seismicsocal/", "CBU Research"), ("experience/kigumi-group/", "Kigumi Group")))

    rail = (
        panel("toc-nt", "On this page", toc([("overview", "Overview"), ("resumable", "Resumable redemptions"),
                                            ("serial", "Serialization tool"), ("perf", "Performance")]), body_cls="panel-body tight")
        + panel("spec-nt", "Spec sheet", spec([("Org", "NumIsToken"), ("Role", "Full-Stack SWE Intern"),
                                                ("Dates", "Sep 2025 – Jun 2026"), ("Location", "Berkeley, CA"),
                                                ("Focus", "Backend + admin tools"), ("Deploy", "Docker")]), body_cls="panel-body tight")
        + panel("stack-nt", "Stack", chips(["Backend APIs", "State management", "Payments", "Serialization", "Code 128", "ZPL / Zebra", "Docker"]),
                body_cls="panel-body tight")
        + info("What is — a stuck transaction?",
               "<p>A multi-step operation that stops partway, for example after payment but before completion, with no "
               "durable record of where it stopped. It can't safely be retried or finished.</p>"))
    return h, layout(main_html, rail)



# ============================================================================ KIGUMI GROUP


def kigumi(ctx):
    rel = ctx["rel"]
    h = hero(
        "field-sky", "INTERNSHIP · BACKEND · AI", "Kigumi Group",
        "Backend Software Engineer Intern in Hong Kong on KiguLab, a digital wellbeing and AI ethics "
        "curriculum for students. I hardened the AI assistant pipeline behind it and pushed test coverage to 98%.",
        ["Jun 2025 – Sep 2025", "Hong Kong", "Backend · Testing · LLM pipelines"],
        C.mini_bars([("before", .90, False), ("after", .98, True)], title="backend code coverage", fmt=lambda v: f"{v * 100:.0f}%"),
        go("https://kigulab.com", "Visit KiguLab", True) + go("https://www.kigumigroup.com", "The Kigumi Group", True))

    overview = f"""
{stats([("98<small>%</small>", "Code coverage", "up from 90%"),
        ("-80<small>%</small>", "Untested code", "10% → 2% uncovered"),
        ("2", "Failure classes fixed", "connections · query formulation"),
        ("2", "Model families", "GPT + image generation")])}
<hr class="dotted">
<p class="lede">An AI assistant for kids' education has to work every time. A student who gets an error
or a garbled answer usually doesn't try again.</p>
<p><strong>The Kigumi Group</strong> builds <strong>KiguLab</strong>, a digital wellbeing and AI-ethics curriculum for ages
8–21. It covers digital wellbeing, critical thinking, ethical AI companionship, cyber resilience and
privacy, through short "edutainment" lessons in English, Thai and Chinese, with AI tutors that teach
alongside human coaches. I worked on the backend behind the AI assistant.</p>
{bullets([
    "Increased code coverage from <strong>90% to 98%</strong> and resolved <strong>recurring AI assistant pipeline failures</strong> caused by "
    "unstable backend connections and malformed query formulation to the image-generation and GPT models. I did this by writing "
    "<strong>unit and integration tests</strong> and diagnosing issues through <strong>targeted debugging</strong>, which improved reliability and response consistency.",
])}
{image(rel, "kigulab-home.png", "The KiguLab landing page: digital wellbeing and AI-ethics lessons for ages 8–21.", "Screenshot", alt="KiguLab landing page")}"""

    pipeline = f"""
<p>The assistant takes a learner's message, builds a query, and sends it to either a <strong>GPT model</strong> for
text or an <strong>image-generation model</strong> for pictures. Failures kept coming back, and they came from two
different places:</p>
{tip("Two failure classes that looked alike from outside, with two different fixes.")}
{fig(C.ai_pipeline(), "Simplified illustration of the request path, not the production architecture. The red markers are the two failure classes I tracked down.", "Illustration")}
<h3>1 · Unstable backend connections</h3>
<p>Some model calls dropped or stalled because the connection between the backend and the model services
wasn't reliable. To the learner this looked random: the same question would work once and fail the next time.</p>
<h3>2 · Malformed query formulation</h3>
<p>Other failures came from the request itself. Queries to the GPT and image models were sometimes put together
wrongly, so the model got a bad request and either errored or answered inconsistently.</p>
<h3>How I fixed them</h3>
<ul>
<li><strong>Targeted debugging</strong> to separate the two failure classes, since they looked alike from the outside but
needed different fixes.</li>
<li><strong>Integration tests</strong> that exercise the real request path to the models, so connection and
request-shape problems show up in testing instead of in front of a student.</li>
<li><strong>Unit tests</strong> on how queries are formed, so a malformed request is caught by a test before it ships.</li>
</ul>
<p>The result was fewer pipeline failures and more consistent responses from the assistant.</p>
{beside(image(rel, "kigulab-assistant.png", "Kigu, KiguLab's AI Buddy, inside a lesson: it opens the course, asks a reflection question and takes the student's answer. This is the assistant whose backend pipeline I made reliable.", "Screenshot", alt="Kigu, the KiguLab AI Buddy, in a lesson"), "This is the assistant whose pipeline I fixed.", "left")}"""

    testing = f"""
<p>Coverage was already 90%, and the last 10% is usually the hardest: error paths, edge cases, and code
that talks to external services. That's also where the pipeline bugs were.</p>
{beside(fig(C.coverage_chart(), "Coverage went from 90% to 98%. Put the other way, the untested part of the backend shrank by 80%."), "Coverage from 90% to 98%: the hardest 8%.", "left")}
<ul>
<li><strong>Unit tests</strong> for backend logic in isolation, including how queries to the models are built.</li>
<li><strong>Integration tests</strong> for the joins between components, where unstable connections and bad requests actually fail.</li>
<li>The failures I diagnosed were pinned down by tests, which guards against regressions.</li>
</ul>"""

    main_html = (
        panel("overview", "Overview", overview, num="01")
        + panel("pipeline", "Fixing the AI assistant pipeline", pipeline, num="02")
        + panel("testing", "From 90% to 98% coverage", testing, num="03")
        + pager(rel, ("experience/numistoken/", "NumIsToken"), ("index.html", "Back to home")))

    rail = (
        rail_btns([("WWW", "KiguLab", "https://kigulab.com"), ("KG", "The Kigumi Group", "https://www.kigumigroup.com")])
        + panel("toc-kg", "On this page", toc([("overview", "Overview"), ("pipeline", "AI pipeline fixes"),
                                              ("testing", "Test coverage")]), body_cls="panel-body tight")
        + panel("spec-kg", "Spec sheet", spec([("Org", "The Kigumi Group"), ("Product", "KiguLab"),
                                                ("Role", "Backend SWE Intern"), ("Dates", "Jun 2025 – Sep 2025"),
                                                ("Location", "Hong Kong"), ("Coverage", "90% → 98%")]),
                body_cls="panel-body tight")
        + panel("stack-kg", "Stack", chips(["Backend services", "Unit tests", "Integration tests", "GPT models",
                                            "Image generation", "Debugging"]), body_cls="panel-body tight")
        + info("What is — code coverage?",
               "<p>The share of the codebase that runs during the test suite. It doesn't prove the code is correct, "
               "but code no test runs is code nobody has checked.</p>"))
    return h, layout(main_html, rail)


# ============================================================================ registry

ALL = [
    {"path": "", "key": "home", "render": home,
     "title": "Braedyn Thompson · Portfolio",
     "description": "Machine learning, data and full-stack work: adaptive learning, live earthquake detection, local RAG, and forecasting research."},
    {"path": "projects/academy-of-testers", "key": "academy-of-testers", "render": aot,
     "title": "Academy of Testers · Braedyn Thompson",
     "description": "Adaptive SAT engine (BKT + IRT + forgetting + prerequisite graph) and a RAG AP essay grader that cut scoring error ~23%."},
    {"path": "projects/seismicsocal", "key": "seismicsocal", "render": seismic,
     "title": "SeismicSoCal · Braedyn Thompson",
     "description": "Live deep-learning earthquake detection for Southern California: 0.992 ROC-AUC detection, GNN magnitude R² 0.840, push alerts."},
    {"path": "projects/bearlm", "key": "bearlm", "render": bearlm,
     "title": "BearLM · Braedyn Thompson",
     "description": "Fully local hybrid-search RAG over Berkeley CS/DS courses: recall@1 56% to 82%, RAGAS faithfulness 0.55 to 0.83."},
    {"path": "experience/lawrence-berkeley-lab", "key": "lawrence-berkeley-lab", "render": lbnl,
     "title": "Berkeley Lab Internship · Braedyn Thompson",
     "description": "PatchTST forecasting of XCache traffic beating persistence by up to 24% RMSE, plus EDA exposing the peak-predictability ceiling."},
    {"path": "experience/cbu-seismicsocal", "key": "cbu-seismicsocal", "render": cbu,
     "title": "CBU Research Internship · Braedyn Thompson",
     "description": "Diagnosed an inverse-FEA data ceiling across 7 models, and built SeismicSoCal's deep detection and live alert daemon."},
    {"path": "experience/numistoken", "key": "numistoken", "render": numis,
     "title": "NumIsToken Internship · Braedyn Thompson",
     "description": "Resumable redemptions via History and Detail services, a product serialization tool with barcode labels, and ~85% faster redemption actions."},
    {"path": "experience/kigumi-group", "key": "kigumi-group", "render": kigumi,
     "title": "Kigumi Group Internship · Braedyn Thompson",
     "description": "Backend SWE intern on KiguLab: test coverage 90% to 98% and fixed recurring GPT / image-model pipeline failures."},
]
