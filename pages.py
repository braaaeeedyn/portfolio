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
    "fairy": ("<svg class='tip-acc wings' viewBox='0 0 74 30' aria-hidden='true'>"
              "<g fill='rgba(201,160,255,.92)' stroke='#5a3a9a' stroke-width='1.1'>"
              "<path d='M13 18 Q0 4 4 1 Q12 0 15 14 Z'/><path d='M13 19 Q2 26 5 29 Q12 30 15 20 Z'/>"
              "<path d='M61 18 Q74 4 70 1 Q62 0 59 14 Z'/><path d='M61 19 Q72 26 69 29 Q62 30 59 20 Z'/></g>"
              + _star(6, 10, 1.4, fill="#fff") + _star(68, 10, 1.4, fill="#fff") + "</svg>"
              "<svg class='tip-acc hat crown-flowers' viewBox='0 0 30 12' aria-hidden='true'>"
              "<path d='M2 9 Q15 4 28 9' fill='none' stroke='#5a9a5a' stroke-width='1.6'/>"
              "<g stroke='#7a3a6a' stroke-width='.5'><circle cx='7' cy='7.2' r='2.6' fill='#ff9fd0'/>"
              "<circle cx='15' cy='5.4' r='3' fill='#d7b8ff'/><circle cx='23' cy='7.2' r='2.6' fill='#ff9fd0'/></g>"
              "<g fill='#ffe066'><circle cx='7' cy='7.2' r='.9'/><circle cx='15' cy='5.4' r='1'/><circle cx='23' cy='7.2' r='.9'/></g></svg>"),
    "dj": ("<svg class='tip-acc hat' viewBox='0 0 30 15' aria-hidden='true'>"
           "<path d='M1 11.6 Q5 10.4 8 11.4 L8 13 Q4 13.4 1 13 Z' fill='#21242e' stroke='#000' stroke-width='.7'/>"
           "<path d='M6 12 Q6 2.4 16 2.4 Q26 2.4 26 12 Z' fill='#3d4f97' stroke='#1f2a5c' stroke-width='.9'/>"
           "<path d='M8.6 8.2 Q10.4 9.4 12.2 8.2' fill='none' stroke='#9fbee7' stroke-width='.9'/>"
           "<path d='M16 2.4 V12' stroke='#2c3a78' stroke-width='.6'/><circle cx='16' cy='2.5' r='1' fill='#9fbee7'/>"
           "<path d='M26 9 Q29.5 10 28.6 13.6' fill='none' stroke='#21242e' stroke-width='1.1'/>"
           "<circle cx='28.4' cy='13.8' r='1.3' fill='#21242e'/></svg>"),
    "referee": ("<svg class='tip-acc hat' viewBox='0 0 28 14' aria-hidden='true'>"
                "<path d='M15 11.6 L27 11.8 Q26.6 13.6 22 13.4 L15 12.8 Z' fill='#21242e'/>"
                "<path d='M3 12 Q3 2 13 2 Q22 2 22 11.8 Z' fill='#f4f6fb' stroke='#21242e' stroke-width='.9'/>"
                "<path d='M6.2 11.8 V5.6 M10 11.8 V3 M14 11.8 V2.6 M18 11.8 V4.2' stroke='#21242e' stroke-width='1.8'/>"
                "<circle cx='12.5' cy='2.2' r='1' fill='#21242e'/></svg>"),
    "soldier": ("<svg class='tip-acc hat' viewBox='0 0 30 16' aria-hidden='true'>"
                "<path d='M2 12.4 Q2 2 15 2 Q28 2 28 12.4 Q22 14.2 15 14.2 Q8 14.2 2 12.4 Z' fill='#5b6b3a' stroke='#2c3418' stroke-width='.9'/>"
                "<g fill='#3f4a28'><ellipse cx='9' cy='7' rx='2.6' ry='1.5'/><ellipse cx='19' cy='5' rx='2.2' ry='1.2'/>"
                "<ellipse cx='22' cy='10' rx='2.4' ry='1.3'/><ellipse cx='13' cy='11' rx='1.8' ry='1'/></g>"
                "<g fill='#8a9a5a'><ellipse cx='15' cy='7.6' rx='1.8' ry='1'/><ellipse cx='6' cy='10.6' rx='1.5' ry='.9'/></g>"
                "<path d='M3.4 9.6 Q15 6.6 26.6 9.6' fill='none' stroke='#2c3418' stroke-width='.5' stroke-dasharray='1.2 1'/></svg>"),
    "gamer": ("<svg class='tip-acc hat' viewBox='0 0 24 12' aria-hidden='true' shape-rendering='crispEdges'>"
              "<path d='M2 4h2v2h2v-2h2v2h2v-4h4v4h2v-2h2v2h2v-2h2v8h-20z' fill='#ecab37' stroke='#7a5a10' stroke-width='.6'/>"
              "<rect x='10.5' y='6.5' width='3' height='3' fill='#e60012'/><rect x='5' y='7.5' width='2' height='2' fill='#9fbee7'/>"
              "<rect x='17' y='7.5' width='2' height='2' fill='#9fbee7'/><rect x='2' y='10' width='20' height='1.2' fill='#c98b20'/></svg>"),
    "gardener": ("<svg class='tip-acc hat' viewBox='0 0 34 15' aria-hidden='true'>"
                 "<ellipse cx='17' cy='11.6' rx='16' ry='3.2' fill='#e8cf8a' stroke='#8a6a2a' stroke-width='.8'/>"
                 "<path d='M8 11.2 Q8 2.4 17 2.4 Q26 2.4 26 11.2 Z' fill='#f0dca0' stroke='#8a6a2a' stroke-width='.8'/>"
                 "<path d='M8.4 9 Q17 11 25.6 9 L25.8 10.8 Q17 12.8 8.2 10.8 Z' fill='#4f9a5f'/>"
                 "<path d='M10 4.6 L24 4.6 M9 7 L25 7' stroke='#d8bd72' stroke-width='.5'/>"
                 "<g stroke='#7a3a6a' stroke-width='.4'><circle cx='24.6' cy='8.4' r='1.4' fill='#ff9fd0'/>"
                 "<circle cx='26.4' cy='9.6' r='1.4' fill='#ff9fd0'/><circle cx='24.2' cy='10.4' r='1.4' fill='#ff9fd0'/></g>"
                 "<circle cx='25' cy='9.5' r='.8' fill='#ffe066'/></svg>"),
}

WHISTLE = ("<path d='M9.8 7.8 Q11.6 6.4 11.4 4.4' fill='none' stroke='#60619c' stroke-width='.3'/>"
           "<rect x='8.6' y='7.6' width='2.6' height='1.5' rx='.6' fill='#cfd6e6' stroke='#21242e' stroke-width='.3'/>"
           "<circle cx='9.2' cy='8.35' r='.35' fill='#21242e'/>")

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

WAND = (  # carved wooden wand: ringed handle, tapering shaft, glowing star tip, trailing sparkles
    "<svg class='tip-prop tip-wand' viewBox='0 0 96 28' aria-hidden='true'>"
    "<defs><radialGradient id='wandglow'><stop offset='0' stop-color='#fff8c8' stop-opacity='.95'/>"
    "<stop offset='1' stop-color='#ffe680' stop-opacity='0'/></radialGradient></defs>"
    "<circle class='glow' cx='80' cy='14' r='12' fill='url(#wandglow)'/>"
    "<path d='M3 10.6 Q1 14 3 17.4 L24 16.6 L24 11.4 Z' fill='#4a2a12' stroke='#21140a' stroke-width='1'/>"
    "<path d='M7 10.9 V17.1 M12 11 V17 M17 11.1 V16.9' stroke='#c9a24a' stroke-width='1.4'/>"
    "<circle cx='3.6' cy='14' r='2.2' fill='#c9a24a' stroke='#5c4420' stroke-width='.8'/>"
    "<path d='M24 11.4 Q46 12.2 72 13.2 L72 14.8 Q46 15.8 24 16.6 Q26 14 24 11.4 Z' fill='#8a5a2b' stroke='#3b2410' stroke-width='.9' stroke-linejoin='round'/>"
    "<path d='M27 13 Q48 13.4 70 13.9' fill='none' stroke='#c08a52' stroke-width='.8'/>"
    "<circle cx='40' cy='14.4' r='1.1' fill='#5c3a18'/><circle cx='55' cy='13.6' r='.9' fill='#5c3a18'/>"
    + _star(80, 14, 6.5, "tipstar", "#fff3a6") +
    _star(90, 5, 2.6, "sparkle s1") + _star(92, 22, 2.1, "sparkle s2") + _star(86.5, 25.5, 1.6, "sparkle s3") +
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

BUTTERFLY = (  # fairy's butterfly: wings flap while it flits toward the target
    "<svg class='tip-prop tip-butterfly' viewBox='0 0 40 34' aria-hidden='true'>"
    "<g class='wl'><path d='M20 16 Q6 0 2 6 Q0 14 19 18 Z' fill='#c9a0ff' stroke='#5a3a9a' stroke-width='1'/>"
    "<path d='M19 18 Q4 22 7 30 Q12 34 20 20 Z' fill='#ff9fd0' stroke='#5a3a9a' stroke-width='1'/>"
    "<circle cx='8' cy='8' r='2' fill='#fff' opacity='.85'/></g>"
    "<g class='wr'><path d='M20 16 Q34 0 38 6 Q40 14 21 18 Z' fill='#c9a0ff' stroke='#5a3a9a' stroke-width='1'/>"
    "<path d='M21 18 Q36 22 33 30 Q28 34 20 20 Z' fill='#ff9fd0' stroke='#5a3a9a' stroke-width='1'/>"
    "<circle cx='32' cy='8' r='2' fill='#fff' opacity='.85'/></g>"
    "<ellipse cx='20' cy='18' rx='2' ry='8' fill='#3b2a5a'/>"
    "<path d='M19.4 10.6 Q16 4 14 3.4 M20.6 10.6 Q24 4 26 3.4' fill='none' stroke='#3b2a5a' stroke-width='.9' stroke-linecap='round'/>"
    "<circle cx='14' cy='3.4' r='1' fill='#3b2a5a'/><circle cx='26' cy='3.4' r='1' fill='#3b2a5a'/></svg>")

VINYL = (  # DJ: spinning record with sound waves pulsing toward the target (points right)
    "<svg class='tip-prop tip-vinyl' viewBox='0 0 60 34' aria-hidden='true'>"
    "<g class='disc'><circle cx='17' cy='17' r='15.5' fill='#21242e' stroke='#000' stroke-width='1'/>"
    "<circle cx='17' cy='17' r='12' fill='none' stroke='#3a3f50' stroke-width='.8'/>"
    "<circle cx='17' cy='17' r='9' fill='none' stroke='#3a3f50' stroke-width='.8'/>"
    "<circle cx='17' cy='17' r='5.4' fill='#e60012'/><path d='M17 12.6 A4.4 4.4 0 0 1 21.4 17' fill='none' stroke='#ffb3b8' stroke-width='1'/>"
    "<circle cx='17' cy='17' r='1.2' fill='#fff'/>"
    "<path d='M8 9 A12 12 0 0 1 14 5.4' fill='none' stroke='#6b7290' stroke-width='1.2' stroke-linecap='round'/></g>"
    "<g fill='none' stroke='#3d4f97' stroke-width='2.2' stroke-linecap='round'>"
    "<path class='w1' d='M37 10 Q41 17 37 24'/><path class='w2' d='M44 6.5 Q50 17 44 27.5'/><path class='w3' d='M51 3 Q59 17 51 31'/></g>"
    "</svg>")

REF_ARM = (  # referee: striped sleeve + glove pointing, with a pop-up check
    "<svg class='tip-prop tip-refarm' viewBox='0 0 74 34' aria-hidden='true'>"
    "<rect x='1' y='10' width='26' height='15' rx='2' fill='#f4f6fb' stroke='#21242e' stroke-width='1.4'/>"
    "<path d='M7 10 V25 M13 10 V25 M19 10 V25' stroke='#21242e' stroke-width='3'/>"
    "<g transform='translate(26 3)' fill='#fff' stroke='#21242e' stroke-width='2' stroke-linejoin='round'>"
    "<rect x='0' y='8' width='6' height='16' rx='2' fill='#dfe4f2'/><rect x='5' y='6' width='16' height='20' rx='6'/>"
    "<rect x='15' y='7' width='22' height='7' rx='3.5'/><rect x='15' y='13' width='9' height='5' rx='2.5'/>"
    "<rect x='15' y='17' width='8' height='5' rx='2.5'/><rect x='14' y='21' width='7' height='4.5' rx='2.2'/></g>"
    "<g class='check'><circle cx='66' cy='5.5' r='5' fill='#2e9e5b' stroke='#14532d' stroke-width='1'/>"
    "<path d='M63.6 5.6 L65.4 7.4 L68.6 3.8' fill='none' stroke='#fff' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/></g>"
    "</svg>")

BINOCULARS = (  # soldier: binoculars aimed at the target (points right)
    "<svg class='tip-prop tip-binos' viewBox='0 0 50 26' aria-hidden='true'>"
    "<rect x='2' y='2.5' width='8' height='8' rx='2' fill='#21242e'/><rect x='2' y='15.5' width='8' height='8' rx='2' fill='#21242e'/>"
    "<rect x='9' y='1' width='26' height='11' rx='2.5' fill='#5b6b3a' stroke='#2c3418' stroke-width='1.2'/>"
    "<rect x='9' y='14' width='26' height='11' rx='2.5' fill='#5b6b3a' stroke='#2c3418' stroke-width='1.2'/>"
    "<rect x='16' y='11' width='8' height='4' fill='#3f4a28' stroke='#2c3418' stroke-width='.8'/>"
    "<rect x='34' y='0' width='10' height='13' rx='2' fill='#3f4a28' stroke='#2c3418' stroke-width='1.2'/>"
    "<rect x='34' y='13' width='10' height='13' rx='2' fill='#3f4a28' stroke='#2c3418' stroke-width='1.2'/>"
    "<rect x='43' y='1.6' width='3' height='9.8' rx='1' fill='#9fbee7' stroke='#21242e' stroke-width='.8'/>"
    "<rect x='43' y='14.6' width='3' height='9.8' rx='1' fill='#9fbee7' stroke='#21242e' stroke-width='.8'/>"
    "<circle class='glint' cx='44.6' cy='4' r='1' fill='#fff'/></svg>")


def _gamepad(direction):
    """gamer: controller whose D-pad lights the arrow toward the target, with a pixel arrow beaming out."""
    down = direction == "down"
    lit = ("<rect class='lit' x='12.5' y='20' width='5' height='6' fill='#9fbee7'/>" if down else
           "<rect class='lit' x='12.5' y='8' width='5' height='6' fill='#9fbee7'/>")
    arrow = ("<path class='beam' d='M24 40 H32 V44 H36 L28 50 L20 44 H24 Z' fill='#9fbee7' stroke='#3d4f97' stroke-width='1'/>" if down else
             "<path class='beam' d='M24 10 H32 V6 H36 L28 0 L20 6 H24 Z' fill='#9fbee7' stroke='#3d4f97' stroke-width='1'/>")
    y0 = 0 if down else 10
    body = (f"<g transform='translate(0 {y0})'>"
            "<path d='M8 6 H48 Q56 6 56 16 Q57 30 50 32 Q45 33 40 26 H16 Q11 33 6 32 Q-1 30 0 16 Q0 6 8 6 Z' "
            "fill='#21242e' stroke='#000' stroke-width='1.2'/>"
            "<path d='M12.5 8 H17.5 V14.5 H24 V19.5 H17.5 V26 H12.5 V19.5 H6 V14.5 H12.5 Z' fill='#60619c' stroke='#000' stroke-width='.6'/>"
            f"{lit}"
            "<circle cx='42' cy='12.5' r='2.4' fill='#3d4f97'/><circle cx='47' cy='17' r='2.4' fill='#e60012'/>"
            "<circle cx='37' cy='17' r='2.4' fill='#9fbee7'/><circle cx='42' cy='21.5' r='2.4' fill='#60619c'/>"
            "<rect x='24' y='9.5' width='3.4' height='1.8' rx='.9' fill='#60619c'/><rect x='29' y='9.5' width='3.4' height='1.8' rx='.9' fill='#60619c'/></g>")
    return (f"<svg class='tip-prop tip-pad' viewBox='0 0 57 50' aria-hidden='true'>{body}{arrow}</svg>")


WATERCAN = (  # gardener: watering can tipping toward the target, drops falling (above only)
    "<svg class='tip-prop tip-can' viewBox='0 0 62 46' aria-hidden='true'>"
    "<path d='M10 9 Q20 -1 30 9' fill='none' stroke='#2f6e8a' stroke-width='2.6' stroke-linecap='round'/>"
    "<rect x='6' y='10' width='28' height='22' rx='4' fill='#5aa0c8' stroke='#21242e' stroke-width='1.4'/>"
    "<path d='M9 15 H31' stroke='#8cc4e0' stroke-width='1.4'/>"
    "<path d='M33 25 L52 13 L54 16 L35 29 Z' fill='#5aa0c8' stroke='#21242e' stroke-width='1.2' stroke-linejoin='round'/>"
    "<path d='M51 10 L58 16 L54 20 Z' fill='#2f6e8a' stroke='#21242e' stroke-width='1.1' stroke-linejoin='round'/>"
    "<g fill='#5aa0c8' stroke='#2f6e8a' stroke-width='.6'>"
    "<path class='drip d1' d='M56 23 Q58 26 56 27.5 Q54 26 56 23 Z'/>"
    "<path class='drip d2' d='M59.5 21 Q61.5 24 59.5 25.5 Q57.5 24 59.5 21 Z'/>"
    "<path class='drip d3' d='M53 24 Q55 27 53 28.5 Q51 27 53 24 Z'/></g></svg>")

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
    "fairy": (BUTTERFLY, "fairy", "", ("above", "side")),
    "dj": (VINYL, "dj", "", ("above", "side")),
    "referee": (REF_ARM, "referee", WHISTLE, ("above", "side")),
    "soldier": (BINOCULARS, "soldier", "", ("above", "side")),
    "gamer": (_gamepad, "gamer", "", ("above", "side")),
    "gardener": (WATERCAN, "gardener", "", ("above",)),
}
_PROP_CYCLE = ["hand", "fairy", "explorer", "dj", "wizard", "referee", "berkeley", "gamer", "arcade", "soldier",
               "scholar", "gardener", "detective", "builder", "pirate"]
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


def _mascot(character):
    _, hat, inside, _modes = PROPS[character]
    acc = HATS[hat] if hat else ""
    return f"<span class='tip-mascot' tabindex='0' aria-label='Mascot'>{acc}{_mascot_svg(inside)}</span>"


def chat(lines):
    """A tiny scripted conversation between characters, e.g.
    chat([("detective", "Isn't 0.550 basically a coin flip?"), ("explorer", "Pretty much.")])
    The first speaker sits on the left, the second on the right; site.js reveals messages one by one."""
    sides, rows = {}, []
    for character, text in lines:
        side = sides.setdefault(character, "left" if not sides else "right")
        rows.append(f"<div class='msg {side}'>{_mascot(character)}<p class='msg-bubble'>{text}</p></div>")
    return ("<div class='chat' role='group' aria-label='Mascot conversation'>" + "".join(rows) +
            "<button type='button' class='chat-replay' aria-label='Replay conversation'>&#8635; replay</button></div>")


def tip(text="", mode="above", pos="right", prop=None):
    """mode="above": mascot sits above the next element and points down at it.
    mode="side": used via beside(); mascot overlays the element's lower corner and points up into it.
    text is optional. prop picks a character (see PROPS); by default characters rotate through the page."""
    if prop is None or mode not in PROPS[prop][3]:
        prop = _next_prop(mode)
    mascot = _mascot(prop)
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
          "SeismicSoCal: not \"is the test AUC high?\" but \"would this live system have alerted correctly on real days?\""]),
        ("Know the field &amp; pick baselines", "Start from what practitioners already use, so a result means something.",
         ["STA/LTA for detection, amplitude + distance for magnitude, and a time-shifted chance baseline for every live precision.",
          "Persistence for forecasting (Berkeley Lab); a baseline random forest and predict-the-mean for inverse-FEA."]),
        ("Design the experiment", "Decide how results will be judged before running anything.",
         ["Chronological 70/15/15 splits, hard negatives split by date, thresholds calibrated on validation days and test days scored once.",
          "Leak-free, out-of-fold cross-validation, and a paired clean-vs-noisy design that isolates noise as the one variable."]),
        ("Collect &amp; check the data", "Most bad results start as bad data.",
         ["50,743 SCEDC waveform windows and 6,243 quakes labelled against the USGS catalogue, on one shared station list.",
          "A quality gate that drops gap-fill zeros, stuck runs, clipping and glitch spikes; three years of XCache logs explored before modelling."]),
        ("Run experiments &amp; ablations", "Change one thing at a time and see what actually carries the result.",
         ["A nearest-single-station ablation (R² 0.951 → 0.808) that proves the graph fusion matters; a 10-seed study; five alert variants replayed over 20 days.",
          f"A lookback sweep across forecast horizons, and {fea_ablation}."]),
        ("Analyze honestly", "Use metrics that can't be gamed, and write down the limits.",
         ["ROC-AUC and MCC on imbalanced data, event-clustered bootstrap CIs, and precision always next to its chance baseline.",
          "Known limits stated plainly, e.g. off-network quakes are located from one side, and sizes below M2 read high."]),
        ("Conclude &amp; communicate", "Say exactly what the evidence supports, to the people who need it.",
         ["The inverse-FEA ceiling is a data limit, with the measurement precision each target needs: written up for the team's IEEE paper.",
          "SeismicSoCal's results published with their baselines and CIs on the live site and its /health page."]),
        ("Iterate", "Every answer sets up the next question.",
         ["Score shadow mode against USGS before switching live pushes on; run the first gated monthly retrain.",
          "Test a ~120-day lookback at the 30-day horizon."]),
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
     [("projects/seismicsocal/", "SeismicSoCal", "0.9998 ROC-AUC live detector; MLflow-gated retraining + drift checks"),
      ("experience/lawrence-berkeley-lab/", "Berkeley Lab", "PatchTST beat persistence on every target, up to 24% lower RMSE"),
      ("projects/academy-of-testers/", "Academy of Testers", "BKT + IRT adaptive engine as pure, testable code")]),
    ("DS", "Data Scientist",
     "Design honest experiments and find out what the data can support.",
     [("experience/cbu-research/", "CBU Research", "7-model benchmark proved an R² ≈ 0.10 data ceiling"),
      ("experience/lawrence-berkeley-lab/", "Berkeley Lab", "rolling CV showing models under-predict rare peaks"),
      ("projects/seismicsocal/", "SeismicSoCal", "chronological splits, clustered-bootstrap CIs, precision vs. chance")]),
    ("DE", "Data Engineer",
     "Build pipelines that ingest messy sources reliably and reproducibly.",
     [("projects/bearlm/", "BearLM", "ETL over PDF / md / ipynb, ~10K records with retry/backoff"),
      ("projects/seismicsocal/", "SeismicSoCal", "19-station SeedLink stream, quality gating, Dagster retrain job"),
      ("experience/lawrence-berkeley-lab/", "Berkeley Lab", "reproducible Pandas pipelines over years of cache logs")]),
    ("DA", "Data Analyst",
     "Turn raw logs and metrics into clear charts and decisions.",
     [("experience/lawrence-berkeley-lab/", "Berkeley Lab", "seasonality, change-points and peaks in Matplotlib / Seaborn / Plotly"),
      ("experience/cbu-research/", "CBU Research", "paired clean-vs-noisy analysis that redirected the team"),
      ("projects/bearlm/", "BearLM", "SQLite usage analytics and weakest-area reporting")]),
    ("RES", "AI / ML Researcher",
     "Run rigorous experiments, find the real limits, and report them honestly.",
     [("experience/cbu-research/", "CBU Research", "IEEE inverse-FEA paper: proved an R² ≈ 0.10 data ceiling"),
      ("experience/lawrence-berkeley-lab/", "Berkeley Lab", "PatchTST + showing peaks aren't predictable from history alone"),
      ("projects/seismicsocal/", "SeismicSoCal", "deep vs. classical baselines, 10-seed study, replay acceptance test")]),
]

def roles_section(rel, resume):
    cards = []
    for ico, role, pitch, proofs in ROLES:
        cv = (f"<a class='role-cv' href='{rel}{resume}' target='_blank' rel='noopener' "
              f"title='Open my r&eacute;sum&eacute;'>PDF &darr;</a>")
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
        "<text x='14' y='66' font-size='30'>0.9998</text><text x='120' y='66' font-size='18' fill='#7a8aba'>quake detection ROC-AUC</text>"
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
         "Live quake detection on 19 stations: CNN→Transformer + GNN, two-stage alerts, MLOps."),
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
        ("experience/cbu-research/", "CBU", "California Baptist University · SeismicSoCal",
         "ML Research Intern · diagnosed an inverse-FEA data ceiling; 0.9998 ROC-AUC detection; live alert pipeline.",
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
        ("Ops &amp; MLOps", "MLflow, Dagster, Evidently, GitHub Actions, Docker, systemd, Caddy, Oracle Cloud, FCM push"),
    ])

    contact = f"""
<p>I'm looking for AI, machine learning and data roles (see <a href="#roles">roles I'm targeting</a>).
The fastest way to reach me is email.</p>
<div class="email-line"><code class="email-addr">{ctx["email"]}</code>
<button class="chip email-copy" type="button" data-copy="{ctx["email"]}">Copy</button>
<a class="chip" href="https://mail.google.com/mail/?view=cm&amp;to={ctx["email"]}" target="_blank" rel="noopener">Open in Gmail</a></div>
{rail_btns([("@", "Email me", "mailto:" + ctx["email"]), ("GH", "GitHub", ctx["github"]),
            ("IN", "LinkedIn", ctx["linkedin"])])}"""

    resumes = ("<p>A one-page PDF covering all of the roles above.</p>"
               + rail_btns([("CV", "R&eacute;sum&eacute; (PDF)", rel + ctx["resume"])]))

    education = spec([("School", "UC Berkeley"), ("Major", "Computer Science &amp; Data Science"),
                      ("Emphasis", "Applied Math &amp; Modeling"), ("Graduation", "Fall 2027"), ("GPA", "3.75 / 4.00")])

    main_html = (
        panel("roles", "Roles I'm targeting", roles_section(rel, ctx["resume"]), num=f"{len(ROLES):02d}", body_cls="panel-body")
        + panel("projects", "Featured projects", f"<div class='featured'>{feat_html}</div>", num="03",
                body_cls="panel-body")
        + panel("experience", "Experience", exp_html, cls="platinum", num=f"{len(exp):02d}", body_cls="panel-body tight")
        + panel("about", "About", about)
        + panel("skills", "Toolkit", skills, body_cls="panel-body"))

    rail = (
        panel("contact", "Contact", contact, dark=False)
        + panel("resumes", "R&eacute;sum&eacute;", resumes)
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
         "The learner uses the exam hubs, SAT adaptive practice and the AI features. In the AI grounding layer, Testy (AI chat) and FRQ grading share RAG retrieval: it embeds the query, loads candidates through chunk queries over the RAG chunks, and gets candidate pools from an in-memory corpus cache. Ingestion embeds and saves new chunks, then invalidates the affected cache pools. Everything persists to PostgreSQL behind the Spring API.")}"""

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
{chat([("hand", "Why does a wrong answer move mastery more than a right one?"),
       ("scholar", "Gains are damped to 25% of the step and losses to 50%, so one lucky guess can't fake mastery."),
       ("hand", "So mastery is easier to lose than to earn. Got it.")])}

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

    testy = f"""
<p><strong>Testy</strong> is the AI study assistant, built on the same retrieval-augmented generation (RAG) layer as
the essay grader. I added two safeguards to its retrieval to keep it <strong>helpful</strong> and <strong>fast</strong>.
Each one prevents a specific failure mode that a simple RAG setup runs into.</p>

<h3>Safeguard 1 · Irrelevant passages can't force a refusal</h3>
<p>A simple RAG chat always passes the <strong>closest few passages</strong> to the model, relevant or not, and tells
it to answer <em>only</em> from them. Together, those two choices make an assistant refuse any reasonable question
that's slightly off the syllabus. This is the failure mode it prevents:</p>
{flow([("Always top 4", "the closest passages are sent even when they don't match", False),
       ("Strict prompt", "\"answer only from these passages\"", False),
       ("Failure", "reasonable off-syllabus questions get refused", False)])}
<p>What Testy does instead:</p>
<ul>
<li><strong>Similarity cutoff:</strong> weakly related passages are dropped instead of being forced into the prompt.</li>
<li><strong>Course material as a reference, not a limit:</strong> the prompt tells the model to use the curriculum when
it applies and to answer from general knowledge when it doesn't.</li>
<li>So Testy stays <strong>grounded in the course when the course covers it</strong>, and <strong>doesn't refuse</strong>
reasonable questions when it doesn't.</li>
</ul>
{chat([("wizard", "Why doesn't Testy just answer only from the course material?"),
       ("scholar", "Then any question slightly off the syllabus would get refused, even good ones."),
       ("wizard", "So how does it stay grounded?"),
       ("scholar", "Weak matches are cut, and the course is used as a reference rather than a limit.")])}

<h3>Safeguard 2 · No repeated work on every message</h3>
<p>Embeddings are stored in Postgres as JSON float arrays of <strong>1,536 dimensions</strong>. Without a cache, every
question would reload and re-parse a whole subject's vectors. An <strong>in-memory caching layer in Spring Boot</strong>
prevents that:</p>
{tiles([("Subject embedding cache", "Keeps each subject's parsed embeddings in memory. It's cleared automatically when new content is ingested, so answers never use stale material."),
        ("Question embedding reuse", "Repeated questions reuse their embedding instead of calling the embedding API again."),
        ("Conversation context", "Carries each conversation's recent relevant passages forward, so vague follow-ups like \"why?\" still find the right material instead of retrieving nothing.")])}
{beside(image(rel, "aot-ai-chat.png", "Testy answering a history question. Questions can be scoped to a subject, and usage is rate-limited per user (the counter shows messages left this hour).", "Screenshot", alt="Testy AI study chat"), "Grounded when the course covers it, still helpful when it doesn't.", "right", prop="fairy")}"""

    platform = f"""
<p>Around the two ML systems sits the rest of a real product, which I built too:</p>
{tiles([("Exam hubs", "Browse AP and SAT, search and filter subjects, and drill into subject pages."),
        ("Resources", "Practice exams, unit overviews, topical review and video resources, with PDFs served inline."),
        ("Testy AI chat", "RAG study assistant that uses the curriculum when it applies, with caching and per-user rate limiting."),
        ("Flashcards", "Cards, stacks and per-card progress tracking."),
        ("Auth", "JWT access/refresh tokens, email verification, account lockout."),
        ("Streaks", "SAT streaks, streak repair and a focus mode with user preferences.")])}
<h3>Subject hubs</h3>
{image(rel, "aot-subject.png", "An AP subject hub (English Language): unit overviews, videos and reference sheets to learn the material, then practice questions, past exams, flash cards, AI-graded FRQ practice, mixed review and a timed mock exam that predicts a 1–5 score.", "Screenshot", alt="AP English Language subject hub")}
<h3>My AP Planner</h3>
{image(rel, "aot-ap-planner.png", "The AP planner: a mastery map for each of the student's classes, built from Unit Practice. A question counts as mastered after 3 correct answers (2 in a row), and mastery fades: every 2 weeks without a correct answer it slips a tier.", "Screenshot", alt="My AP Planner mastery map")}
"""

    main_html = (
        image(rel, "aot-home.png", "academyoftesters.com: pick AP (29 subjects: unit reviews, real 2025 free-response questions, timed mocks) or SAT (adaptive practice, topic lessons, full-length tests).", "Live site", alt="Academy of Testers homepage")
        + panel("overview", "Overview", overview, num="01")
        + panel("architecture", "System architecture", arch, num="02")
        + panel("radar", "The mastery radar", radar_sec, num="03")
        + panel("engine", "Adaptive engine, piece by piece", engine, num="04")
        + panel("frq", "RAG essay grader", frq, num="05")
        + panel("testy", "Testy: keeping RAG helpful and fast", testy, num="06")
        + panel("platform", "The rest of the platform", platform, num="07")
        + pager(rel, None, ("projects/seismicsocal/", "SeismicSoCal")))

    rail = (
        rail_btns([("WWW", "Live site", "https://academyoftesters.com"),
                   ("GH", "Source code", ctx["github"] + "/academy_of_testers")])
        + panel("toc-aot", "On this page", toc([("overview", "Overview"), ("architecture", "Architecture"),
                                               ("radar", "Mastery radar"), ("engine", "Adaptive engine"),
                                               ("frq", "RAG essay grader"), ("testy", "Testy AI assistant"),
                                               ("platform", "Platform")]),
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
        "field-teal", "PROJECT 02 · DEEP LEARNING · MLOPS · LIVE", "Seismic<br>SoCal",
        "A live system that listens to 19 seismometers across Southern California. Two neural networks turn the "
        "first seconds of ground motion into a detection, a location and a magnitude, and phones that follow nearby "
        "sensors get a two-stage alert. QuakeOps keeps the models tracked, gated and watched for drift.",
        ["Deployed live", "PyTorch", "CNN → Transformer · GNN", "MLflow · Dagster · Evidently"],
        C.seismogram(),
        go(site, "Open the live console", True) + go(site + "/health", "Model health", True)
        + go(rel + "experience/cbu-research/", "Research internship"))

    overview = f"""
{stats([("0.9998", "Detection ROC-AUC", "vs 0.816 STA/LTA"),
        ("0.951", "Magnitude R²", "vs 0.886 amp + distance"),
        ("93<small>%</small>", "Replay events real", "chance baseline 0%"),
        ("0", "False pushes in replay", "10 held-out days")])}
<hr class="dotted">
<p class="lede">Detect → Locate → Size → Alert. Every claim sits next to its classic-seismology baseline, a 95%
confidence interval and a replay of real days the system never trained on.</p>
<p>SeismicSoCal trains on <strong>26 years of Southern California data</strong> (USGS catalogue + SCEDC waveforms,
2000 → 2026): <strong>6,243 quakes (M2.0–7.1)</strong> for sizing and <strong>50,743 detection windows</strong>, including 2,062
<em>hard negatives</em>: real live-stream noise that once fooled a detector. Every split is chronological. A
SeedLink daemon runs the same engine 24/7 on a free Oracle VM, and a monthly MLOps loop decides whether a retrained
model is allowed to replace the live one.</p>
{bullets([
    "Built the detector as a <strong>CNN → Transformer</strong> on the 19 stations that actually stream, with the P-wave "
    "anywhere in the window and real live-noise false triggers as hard negatives: <strong>ROC-AUC 0.9998</strong> (95% CI "
    "0.9997–0.9999) vs. 0.816 for STA/LTA on 7,303 held-out windows.",
    "Sized quakes with a <strong>CNN → GNN → Transformer</strong> over the station graph: <strong>R² 0.951, MAE 0.10</strong> on 937 "
    "held-out quakes vs. 0.886 for amplitude + distance; a 10-seed study separates seed variance from sampling variance.",
    "Made a <strong>replay of archived days</strong> the acceptance test: 93% of confirmed events real (chance 0%), 5 pushes and "
    "0 false, median location error 2.5 km.",
    "Built <strong>QuakeOps</strong>: MLflow tracking and a champion/challenger registry, a Dagster retrain job, a six-rule "
    "statistical + replay promotion gate, Evidently drift checks and GitHub Actions deploys.",
])}
<p class="note"><strong>Scope:</strong> research demonstration, not an official warning system. It detects quakes
<em>after</em> they begin and alerts within tens of seconds; it does not predict them.</p>"""

    results = f"""
{tip("Deep beats classical on both tasks, and the confidence intervals don't overlap.")}
{fig(C.seismic_chart(), "Both models beat the classical baseline on a strictly chronological held-out test (2022–2026). CIs are bootstrapped and clustered by event, so a quake's correlated station windows resample together.")}
{table(["Task", "Architecture", "Deep model (95% CI)", "Classical baseline"],
       [["<b>Detect</b>: is it a quake?", "CNN → Transformer, single station, 30 s", "<span class='win'>AUC 0.9998</span> (0.9997–0.9999), MCC 0.886", "STA/LTA 0.816 (0.805–0.828)"],
        ["<b>Size</b>: how big?", "CNN → GNN → Transformer, multi-station", "<span class='win'>R² 0.951</span> (0.943–0.959), MAE 0.10", "amp + distance 0.886 (0.871–0.898)"],
        ["<b>Quick check</b>: worth a first alert?", "median of a·log peak + b·log dist + c, first 4 s of P", "MAE 0.24; passes 93% of M3+, 1.1% of &lt;M2.5", "n/a (it <em>is</em> the classic formula)"]])}
<h3>Detect, in plain English</h3>
<p>Every 2 seconds each sensor hands the model its last 30 seconds of ground motion, and the model decides whether an
earthquake is in it or just traffic, wind or sensor noise. It works wherever the quake starts in the window (AUC 0.9997
/ 0.9999 / 0.9997 with the P-wave at 2 / 12 / 22 s), and train, validation and test AUC match, so it isn't memorising.</p>
{beside(image(rel, "seismic-detect-evidence.png", "From the live site's Evidence panel: held-out ROC vs. STA/LTA on 7,303 windows (2022–2026), and AUC by where the P-wave falls in the 30 s window.", alt="Detection evidence: ROC vs STA/LTA and robustness to onset position"), "Near-perfect wherever the quake starts in the window.", "right")}
<h3>False triggers, at the threshold that actually runs</h3>
<p>The live trigger is 0.6, not the checkpoint's MCC-optimal 0.9987, so both are reported. A per-window trigger still
isn't an alert: it also needs a clean pick and two more stations that locate the same source.</p>
{table(["Threshold", "Test noise (n = 2,339)", "Held-out live noise, Oct 2–5 (n = 397)", "Event windows caught"],
       [["0.6 (live trigger)", "1.41%", "0.25%", "99.6%"], ["0.9987 (checkpoint MCC)", "0.00%", "0.25%", "91.9%"]],
       num_cols=(1, 2, 3))}
<h3>Size, technically</h3>
<p>Each station's 3-component window is normalised to unit peak, so the CNN reads <strong>shape</strong>; its log peak
velocity and log distance from the <em>located</em> epicentre are graph-node features, so the graph reads <strong>size</strong>.
Two graph-convolution layers over the 19-station network (Gaussian distance weights, σ = 50 km) and a Transformer across
stations feed the head. Training jitters the epicentre by ~8 km and the picks by ±0.5 s and drops stations at random, so
it learns under live conditions.</p>
{image(rel, "seismic-size-evidence.png", "From the live site. Top: predicted vs. catalogue magnitude on 937 held-out quakes (MAE 0.10 vs. 0.16), and error by size. Bottom: what the network fusion buys, and the live pipeline replayed on 20 days (quakes below M2 are outside training and read high, but stay under the M3.0 push floor).", alt="Size evidence: scatter, error by size, ablation, replayed live sizing")}
{beside(fig(C.ablation_chart(), "Only the nearest station: R² 0.808, worse than the classic formula. The graph fusion is the skill. Live-like conditions (10 km location error, 3–6 stations) cost just 0.012."), "Take away the graph and it loses to the classic formula.", "right")}
<h3>Seed variance vs. sampling variance</h3>
{table(["Magnitude model (937 held-out quakes)", "R²", "95% CI"],
       [["Single model, mean over 10 seeds", "0.949", "0.948–0.951 (t-interval over seeds)"],
        ["10-seed ensemble", "0.952", "0.944–0.959 (event bootstrap)"],
        ["Live 5-seed ensemble", "<span class='win'>0.951</span>", "0.943–0.959"],
        ["Amplitude + distance baseline", "0.886", "0.871–0.898"],
        ["Ensemble − baseline (paired)", "+0.067", "+0.056 … +0.079"]], num_cols=(1,))}
<p>The deep model's lead over the baseline is about 6× the width of either uncertainty. Ensembling adds only +0.003,
well inside the sampling CI, so the live system keeps 5 seeds rather than 10.</p>"""

    live = f"""
<p>The models run <strong>continuously on a live SeedLink stream</strong> with USGS out of the loop, and everything
runs on waveform (data) time, never wall-clock time. The same module, <code>pipeline.py</code>, runs live and in the
replay harness.</p>
{flow([("SeedLink", "19 stations, 300 s rolling 3-component buffers", False),
       ("Quality gate", "reject gap-fill zeros, stuck runs, clipping, lone spikes", False),
       ("Detect", "CNN→Transformer every 2 s per station; trigger at 0.6", True),
       ("Pick", "STA/LTA + AIC onset, SNR ≥ 3; the picker that aligned training", False),
       ("Locate", "grid search; ≥ 3 picks, RMS ≤ 1.5 s, no silent nearer station", True),
       ("Quick check", "first 2 or 4 s of P → provisional push", False),
       ("Size", "GNN ensemble on [P−5 s, P+25 s] from every station ≤ 200 km", True),
       ("Decide", "M ≥ 3.0 confirms, otherwise retracts", False)], dark=True)}
{tip("Every first notice is followed by a confirmation or a retraction that replaces it.", prop="dj")}
{fig(C.alert_timeline(), "Medians from replayed days. The first notice waits for the third station's pick; the confirmation waits for 25 s of P-wave at the nearest stations.", "Timeline")}
<h3>Why three stations</h3>
<p>With 3 picks, latitude, longitude and origin time are exactly determined, so a low misfit proves nothing on its
own. The <strong>negative evidence</strong> does the work: a real quake reaches nearer stations first, so a solution
whose closer stations stayed quiet is coincident noise. One or two stations become a <em>tentative</em> event: logged,
never pushed. Requiring four stations was tested on validation days: it confirmed 31 events instead of 86 and missed a
real out-of-network M3.6 that three stations caught.</p>
<h3>Two-stage alerts, with a speed the user picks</h3>
<p>Five variants of the first message were replayed over 20 days, and the trade-off became a setting instead of a
hidden constant:</p>
{table(["First-message variant", "Test days: sent / real M2.5+ / retracted / no quake", "Median after origin", "Quick-size MAE"],
       [["<b>Standard</b> (4 s of P, full response removal)", "6 / 6 / 1 / 0", "33.4 s", "0.21"],
        ["4 s, sensitivity-scaled (not offered)", "6 / 6 / 1 / 0", "27.7 s", "0.20"],
        ["<b>Fast</b> (2 s of P, sensitivity-scaled)", "7 / 6 / 2 / 0", "25.9 s", "0.26"],
        ["Push on location alone (rejected)", "72 / 8 / 67 / 5", "25.6 s", "–"]], num_cols=(2, 3))}
<p>Pushing on location alone would mean about 7 first messages a day, nearly all retracted. Both stages carry the same
notification tag, so the confirmation (<em>"M<i>x.x</i> earthquake confirmed"</em>, with the distance and expected shaking)
or the retraction (<em>"Update: smaller quake… you can disregard the earlier alert"</em>) replaces the first message in
the tray.</p>
<h3>Where it can see, and who gets alerted</h3>
<div class="fig-pair">
  {image(rel, "seismic-coverage.png", "The live coverage map, drawn from Census outlines: dark areas have 3+ stations within 100 km, so a quake there is located, sized and can alert; light areas reach 2 and are logged only. Zoom reveals more cities and boundaries.", "Live site", alt="Interactive coverage map of the 19 stations")}
  {image(rel, "seismic-alert-me.png", "Alert me near me: follow a region, switch single sensors off, and choose Standard or Fast. Coordinates never leave the device; only station codes and a push token are stored.", "Live site", alt="Alert me near me with regions and alert speed")}
</div>
<p>Users follow <strong>stations, not a location</strong>. A device is alerted when a confirmed quake is within 150 km of
a station it follows, with the distance measured from the located epicentre to that station.</p>"""

    replay = f"""
<p>A test AUC alone doesn't say whether a live system can be trusted, so the <strong>acceptance test is a replay</strong>:
the exact live engine runs over archived continuous data. Thresholds (trigger, pick SNR, misfit, station count, push floor)
were calibrated on 10 <em>validation</em> days and scored once on 10 held-out <em>test</em> days. Every precision is reported
next to a <strong>chance baseline</strong>: the same declarations shifted by an hour.</p>
{stats([("93<small>%</small>", "Confirmed events real", "chance 0%"),
        ("5 / 0", "Pushes / false pushes", "10 held-out days"),
        ("2.5<small>km</small>", "Median location error", "10 held-out days"),
        ("±0.13", "Pushed sizes vs catalogue", "e.g. 4.09 vs 4.0")])}
{chat([("detective", "How do you know an alert from this thing is real?"),
       ("referee", "It replayed 10 archived days it never trained on. 93% of confirmed events were real quakes; chance was 0%."),
       ("detective", "And the pushes?"),
       ("referee", "Five, all real quakes, each sized within 0.13 of the catalogue.")])}
<h3>Catch rate by size</h3>
{table(["Inside coverage, 20 replayed days", "M1–1.5", "M1.5–2", "M2–2.5", "M2.5–3", "M3+"],
       [["Confirmed", "9%", "48%", "81%", "75%", "86%"]], num_cols=(1, 2, 3, 4, 5))}
<p>The one in-coverage M3+ miss on the test days came 80 s after an M4.0 at the same spot, inside the window where coda
is absorbed so a big quake can't re-trigger itself: a known, logged cost. An event-centric test on 833 held-out quakes in
live geometry located 89% of them (median error 3.8 km) with magnitude MAE 0.135.</p>
<h3>Shadow mode before alerts</h3>
<p>After going live on Oct 5, 2026 the system runs in <strong>shadow mode</strong>: it detects, locates, sizes and logs
everything but sends no pushes. A nightly job scores the live log against USGS in three tiers (confirmed, pushed,
tentative), each with its own chance baseline. Pushes are switched on only once confirmed precision on live data clearly
beats chance and pushed magnitudes match the catalogue.</p>"""

    ops = f"""
<p>A model that's right today can quietly go stale. <strong>QuakeOps</strong> makes the system maintain itself, and a
retrained model can only replace the live one by proving, statistically and on replayed days, that it's at least as good.</p>
{flow([("Data", "monthly append; older months never change", False),
       ("Train", "challenger logged to MLflow with commit, data hash, seeds", False),
       ("Compare", "champion re-scored on the challenger's unseen test split", False),
       ("Replay", "10 held-out days, champion vs challenger", True),
       ("Gate", "six rules, every result logged", True),
       ("Promote", "@champion alias moves; VM pulls, verifies sha256", False)])}
{table(["Rule", "Detect", "Size"],
       [["G1 beats the classic baseline", "paired ΔAUC vs STA/LTA, CI low &gt; 0", "paired ΔR² vs amp + dist, CI low &gt; 0"],
        ["G2 non-inferior to the champion", "ΔAUC ≥ −0.001; ΔMCC ≥ −0.02; false triggers at the live 0.6 ≤ champion + 0.5 pp", "ΔR² ≥ −0.01 and CI high ≥ 0; ΔMAE ≤ +0.01"],
        ["G3 replay acceptance", "precision ≥ 0.85 and ≥ chance + 0.5; no false pushes; M3 recall ≥ champion", "same push checks; event-centric MAE ≤ champion + 0.02"],
        ["G4 tests", "pytest + daemon selftest", "same"],
        ["G5 lineage", "clean tree; commit, dataset version, seeds recorded", "same"],
        ["G6 reason to switch", "newer data, or a superiority CI &gt; 0", "same"]])}
<p class="note">A rule that can't be evaluated is logged as <strong>SKIPPED</strong>, never a silent pass. The gate never
edits the live operating thresholds: a detector that needs a new trigger fails G3, and recalibrating is a deliberate,
manual step.</p>
{tip("Every live model traces back to its commit, dataset and seeds.", prop="soldier")}
<div class="fig-pair">
  {image(rel, "seismic-health.png", "The live /health page: the serving version of each model, its held-out metrics with 95% CIs, the data version and commit it came from, per-station drift status and the promotion history.", "Live site", alt="SeismicSoCal model health page")}
  <div>
<h3>Watching the live stream for drift</h3>
<p>The daemon logs three scale-free features per station every 30 s (detector score, crest factor, high-frequency
share), computed on the model's own input so they're comparable with training. A daily <strong>Evidently</strong> job
compares each station with its training noise: ok, watch (1 feature drifted) or drifting (2+), with an email after two
drifting days in a row.</p>
<p>Drift features started logging on Oct 6, 2026, which is why the station pills still read "no data": the first
statuses arrive with the next daily run.</p>
<p class="note"><strong>Status, honestly:</strong> the registry, daily pull, drift logging, /health page and CI/CD deploys
are live. The gate has been checked on a dry run (champion vs. itself); the first end-to-end monthly retrain hasn't run yet.</p>
  </div>
</div>"""

    stack = f"""
<p>The whole service runs on an <strong>Oracle Cloud Always-Free Ampere A1</strong> (ARM64) VM for $0. Caddy provides
HTTPS and serves the site, systemd runs the API server, which supervises the SeedLink daemon and respawns it if the
stream drops, and separate timers run the nightly crosscheck and the daily QuakeOps pull + drift check. The Android
app is a Capacitor build of the same web app with FCM push and a forced-update gate for breaking releases.</p>
{fig(C.seismic_system(), "Offline, the PC builds datasets, trains on the GPU and replays archived days. Online, the VM runs the same engine on the live stream. QuakeOps connects them through the MLflow registry.", "Architecture")}
{tiles([("One station list", "network.py is imported by the builder, daemon, API, scorer and replay; every station must stream on the public relay."),
        ("Self-checking checkpoints", "Models carry their normalizers and station list; the daemon refuses a model trained on a different network."),
        ("Privacy by design", "Subscriptions store station codes, a push token and an alert speed. Never a location."),
        ("CI/CD", "GitHub Actions: ruff, 25 pytest tests, daemon selftest and site build on every change; tar deploy to the VM on main.")])}
{diagram(rel, "seismicsocal-architecture.webp", "earthquakeDiagram.png", "SeismicSoCal code-level architecture diagram",
         "Code-level view: the web and mobile console, the alert and operations services (API, FCM push, the QuakeOps promotion gate and registry), the live seismic engine, and the data and model modules that read the USGS catalogue and SCEDC archive.", scroll=True)}
<h3>Known limits</h3>
<ul>
<li><strong>Coverage:</strong> strongest where 3+ stations sit within ~100 km (LA basin, Inland Empire, Mojave, Ridgecrest,
Kern). Quakes outside the network are located from a one-sided set of stations and can be tens of km off.</li>
<li><strong>Latency:</strong> 25–60 s after origin. This is rapid detection, not pre-arrival warning (ShakeAlert's job).</li>
<li><strong>Locator:</strong> fixed 8 km depth and a 1-D travel-time model, with an empirical correction fitted on 31,427 picks.</li>
<li><strong>Small quakes:</strong> below M2 (outside the magnitude training range) sizes read slightly high; harmless for the M3 floor.</li>
</ul>"""

    main_html = (
        image(rel, "seismic-live-detect.png", "seismicsocal.duckdns.org: the Detect card, with the held-out AUC, its 95% CI and the STA/LTA baseline on one line, and the live SeedLink status in the corner.", "Live site", alt="SeismicSoCal live site")
        + panel("overview", "Overview", overview, num="01")
        + panel("results", "Results vs. classical seismology", results, num="02")
        + panel("live", "The live pipeline &amp; alerts", live, num="03")
        + panel("replay", "The acceptance test: replaying real days", replay, num="04")
        + panel("quakeops", "QuakeOps: production ML", ops, num="05")
        + panel("deploy", "Deployment &amp; architecture", stack, num="06")
        + pager(rel, ("projects/academy-of-testers/", "Academy of Testers"), ("projects/bearlm/", "BearLM")))

    rail = (
        rail_btns([("WWW", "Live console", site), ("OPS", "Model health", site + "/health"),
                   ("APK", "Android app", site + "/app"), ("GH", "Source code", ctx["github"] + "/earthquake")])
        + panel("toc-sz", "On this page", toc([("overview", "Overview"), ("results", "Results"),
                                              ("live", "Live pipeline"), ("replay", "Replay test"),
                                              ("quakeops", "QuakeOps"), ("deploy", "Deployment")]),
                body_cls="panel-body tight")
        + panel("spec-sz", "Spec sheet", spec([("Region", "Southern California"), ("Data", "USGS + SCEDC, 2000–2026"),
                                                ("Events", "6,243 (M2.0–7.1)"), ("Windows", "50,743 (detection)"),
                                                ("Split", "chronological 70/15/15"), ("Ensembles", "5 seeds"),
                                                ("Live since", "Oct 5, 2026"), ("Host", "Oracle A1 · systemd")]),
                body_cls="panel-body tight")
        + panel("stations", "19 stations", spec([("LA basin", "PASC · BFS"), ("Inland Empire", "SVD · DGR"),
                                                 ("San Diego / Imperial", "BAR · IKP · SWS · BEL"),
                                                 ("Mojave", "GSC · GMR · EDW2"), ("Ridgecrest", "LRL · MPM"),
                                                 ("Kern", "ISA · ARV"), ("Coast / offshore", "SMM · MPP · SNCC · CIA")]),
                body_cls="panel-body tight")
        + panel("stack-sz", "Stack", chips(["PyTorch", "ObsPy", "SeedLink", "NumPy / SciPy", "scikit-learn", "MLflow",
                                            "Dagster", "Evidently", "React", "TypeScript", "Vite", "Capacitor", "FCM",
                                            "Caddy", "systemd", "Oracle Cloud", "GitHub Actions", "pytest"]),
                body_cls="panel-body tight")
        + info("What is — STA/LTA?",
               "<p>The classic trigger: the ratio of short-term to long-term average signal energy. It's fast and "
               "simple, but it reacts to any burst of energy, which is why it scores 0.816 AUC here against the deep "
               "detector's 0.9998.</p>")
        + info("What is — a chance baseline?",
               "<p>Shift every declared event by an hour and score it again. Real detections stop matching the "
               "catalogue; coincidences in a busy catalogue don't. Precision only means something next to that number.</p>"))
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
{chat([("wizard", "What happens when the course materials don't cover the question?"),
       ("berkeley", "BearLM refuses instead of guessing, and every answer it does give cites its sources."),
       ("wizard", "No making things up, then. Respect.")])}
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
        "field-indigo", "INTERNSHIP · RESEARCH · ESNET", "Berkeley Lab",
        "Data Science &amp; Machine Learning Research Intern at Lawrence Berkeley National Laboratory (ESnet), "
        "forecasting traffic at the regional data caches that serve CMS physicists, and finding out how "
        "predictable that traffic really is.",
        ["Sep 2026 – present", "Berkeley, CA", "PatchTST · PyTorch · NeuralForecast"],
        C.patchtst_schematic(dark=True), small=False)

    summary = table(["Question", "How I tested it", "What I concluded"], [
        ["Can a deep forecaster beat the naive baseline at all?",
         "PatchTST vs. persistence and linear regression on a chronological hold-out",
         "Yes on the headline metric, but the average error hid that it smoothed over every spike"],
        ["How much history should the model see?",
         "Lookback sweep per horizon, scored with rolling-origin cross-validation",
         "Long context helps a day ahead; at a month ahead short windows win"],
        ["Is that result real or luck?",
         "Hyperparameter grid on the two finalists, then retraining on several random seeds",
         "Stable across seeds; the long window specifically controls large errors"],
        ["Are the missed peaks a training problem?",
         "Five losses from soft to strict, then deliberately high percentile forecasts",
         "No: every variant misses the same spikes, so the signal isn't in past traffic"],
        ["Does the right setup depend on the kind of traffic?",
         "Separate models for a calm era and an erratic era of the same cache",
         "Yes: calm traffic rewards longer history, erratic traffic rewards the last few days"],
    ])

    overview = f"""
<p class="lede">If the people who run a data cache know traffic will spike, they can provision for it. If they miss
the spike, everything downstream slows down.</p>
<p>My work has two halves. One is building a forecaster that beats a hard-to-beat naive baseline. The other is
finding out, with evidence, <em>how predictable the peaks are at all</em>, so the team designs features and models
around a real limit instead of chasing it. I present to the group every week, and each week's question comes out of
the last one's result.</p>
{bullets([
    "Implemented <strong>PatchTST</strong> (PyTorch / NeuralForecast) for multivariate forecasting of cache traffic at 1-, 7- and "
    "30-day horizons, choosing the lookback window with rolling cross-validation and <strong>beating a persistence baseline on "
    "every variable and horizon</strong>, by up to 24% RMSE.",
    "Showed that the missed traffic peaks are a <strong>predictability limit, not a modelling flaw</strong>: changing the loss or "
    "forecasting high on purpose missed the same spikes, which redirected the work toward new input signals.",
    "Built reproducible <strong>Pandas EDA pipelines</strong> over several years of XCache logs from three regional caches, and "
    "showed that the best amount of history depends on whether traffic is calm or erratic.",
])}
<h3>The research at a glance</h3>
{summary}"""

    problem = f"""
<p>Experiments like the Large Hadron Collider store their data at a few large sites, while the physicists analysing it
are spread across the country, and ESnet carries that traffic. Much of a popular dataset is read again and again, so
<strong>regional caches</strong> (XCache) keep copies close to the users: fewer repeated transfers, lower latency, less
wide-area traffic. Forecasting how hard each cache will be used is what lets operators size them.</p>
<p>The data is a daily record from three CMS caches (Southern California, Chicago and Boston) covering several years.
Each day has six variables: how many file accesses there were and how much data they moved, split into cache
<strong>hits</strong> (served locally) and <strong>misses</strong> (fetched over the network). Operators care most about the volume
served from the cache.</p>
<h3>Exploring before modelling</h3>
<p>I built <strong>reproducible Pandas pipelines</strong> that load, clean, resample and plot every site the same way and rerun
end to end on new data. Exploration shaped every later decision:</p>
{tiles([("Structure in the data", "Total accesses always equal hits plus misses, for counts and volumes, a constraint a model should respect."),
        ("Sites differ", "The largest cache has the most traffic and the best hit rate; the smallest is more volatile. One model shouldn't be assumed to fit every site, so sites are modelled separately."),
        ("Right-skewed peaks", "Most days are ordinary and a few are extreme. The rare tail is what operations care about most."),
        ("Change-points", "The level and variance of traffic shift over time, so old history can mislead. This later became its own experiment.")])}"""

    model = f"""
<p><strong>PatchTST</strong> treats a time series the way a vision transformer treats an image. It cuts the lookback
window into short overlapping <em>patches</em>, turns each into a token, and lets a Transformer attend across them. Each
variable is encoded separately with shared weights. Patching keeps local shape (a ramp, a burst) inside one token and
lets the model see a long history cheaply, which is why I chose it for multi-step forecasting.</p>
{beside(fig(C.patchtst_schematic(), "How PatchTST sees a lookback window: patches become tokens, a channel-independent Transformer encodes them, and heads emit forecasts at several horizons. Schematic only, not real data.", "Schematic"), "", "right")}
<h3>Step 1 · Set a bar worth clearing</h3>
<p>For traffic, "tomorrow looks like today" (<strong>persistence</strong>) is a strong baseline because most of the signal is
momentum and weekly rhythm. I compared PatchTST with persistence and a linear model on a <strong>chronological</strong>
hold-out (never a random split, which would leak the future), with early stopping on validation loss to avoid overfitting.</p>
<h3>Step 2 · Look past the headline number</h3>
<p>The first model beat both baselines on most variables, including the one operators care about. Plotting the forecasts
against reality told a different story: it tracked the typical level but <strong>smoothed straight through the spikes</strong>,
and on the low-volume miss variables it collapsed toward zero. Those variables only looked fine because their true values
are mostly near zero too.</p>
<p><strong>Conclusion:</strong> RMSE rewards being right on average, so a model that plays it safe near the typical value can
score well while missing every spike. From then on I judged every experiment on both the average error and the peaks.</p>
{image(rel, "lbnl-forecast-vs-actual.png", "Daily cache-hit volume over the test period: actual vs. the first PatchTST model. The forecast tracks the everyday level and rhythm but stays far below the rare spikes.", alt="Daily hit volume, actual vs PatchTST")}"""

    tuning = f"""
<p>I chose each hyperparameter deliberately rather than leaving defaults, and tested the one that mattered most, the
amount of history, as an experiment of its own.</p>
{tiles([("Lookback", "How many past days the model sees. Swept from a few days to most of a year, separately for each horizon."),
        ("Horizon", "1, 7 and 30 days, each evaluated on its own so a good short horizon can't hide a weak long one."),
        ("Scaling", "Each variable standardised, because counts and data volumes live on very different scales."),
        ("Loss", "MAE aims at the median and under-shoots bursts; MSE chases peaks but inflates typical-day error. Tested in between.")])}
<h3>Step 3 · Choose the lookback with rolling cross-validation</h3>
<p>A single test period can flatter one setting by chance, so every lookback was scored across many <strong>rolling
windows</strong>: train on the past, forecast the next block, slide forward, repeat. The persistence baseline was scored on the
identical windows, so every comparison is like for like.</p>
{beside(fig(C.rolling_cv_schematic(), "Rolling-origin cross-validation: each fold trains only on the past and validates on the next block, which mirrors how the model would actually be used.", "Schematic"), "Walk-forward only: no fold ever peeks at the future.", "right")}
<p><strong>What I saw:</strong> one day ahead, error was lowest with roughly three months of history, long enough to span
a monthly cycle. A week to a month of history did worst (too short to see a cycle, long enough to add noise), and among the
short windows, 3 days stood out. A week ahead, 3 days was best.</p>
{image(rel, "lbnl-lookback-relative.png", "Error for each lookback as a percentage above the best lookback at that horizon (0% = best). Computed from the rolling-CV sweeps for 1 and 7 days and the 30-day sweep; relative values only.", "Figure", alt="Error above the best lookback, by lookback and horizon")}
<p>At each variable's best setting, PatchTST beat persistence on every variable at both horizons, with the largest gains
on data volumes one day ahead and the smallest on miss counts a week ahead.</p>
{image(rel, "lbnl-vs-persistence.png", "RMSE improvement over persistence at each variable's best lookback, on the same rolling windows.", "Figure", alt="RMSE improvement over persistence by variable and horizon")}
<h3>Step 4 · Check the result isn't luck</h3>
<ul>
<li><strong>Head-to-head grid.</strong> I tuned model size and dropout for the two finalists (3 vs. 100 days of history). On
average error their configurations overlapped; on RMSE, which weights big misses, every 100-day configuration beat every 3-day
one. So long context specifically controls large errors.</li>
<li><strong>Seeds.</strong> Retraining the chosen model on several random seeds changed its error only slightly, so the choice is a
stable finding rather than a lucky initialisation.</li>
</ul>
{image(rel, "lbnl-grid-relative.png", "Each configuration's error as a percentage above the best one, averaged over the six variables. Dark = 100-day lookback.", "Figure", alt="Grid search, error relative to the best configuration")}
{image(rel, "lbnl-seed-spread.png", "Seed-to-seed spread (std / mean) of the chosen model over 5 seeds. Only the low-volume miss_size moves more than a few percent.", "Figure", alt="Seed-to-seed spread by variable")}
<h3>Step 5 · Push the horizon out to a month</h3>
<p>If long history helps a day ahead because it captures seasonality, it should help even more a month ahead. It didn't:
at 30 days the short windows won and the longest ones never did (the dashed line in the lookback chart above).</p>
{chat([("explorer", "So a longer lookback is always better?"),
       ("berkeley", "Not a month ahead. Short windows win there, and the longest ones never do."),
       ("explorer", "But long history wins a day ahead?"),
       ("berkeley", "Right, and the seed check says that's real. The seasonal advantage just doesn't carry out to 30 days.")])}"""

    peaks = f"""
<p>Every experiment so far tracked ordinary days well and <strong>under-predicted the rare peaks</strong>. Rather than keep
tuning, I turned the two obvious explanations into hypotheses and tested each directly.</p>
<h3>Hypothesis 1 · The loss function is to blame</h3>
<p>If training rewards average correctness, a stricter loss should chase peaks. I trained the same model under five losses
from softest to strictest (MAE, three Huber settings, MSE). All five produced nearly identical forecasts and missed the
same spikes by the same amount. Measured against the MAE-trained model, every stricter loss was equal or slightly worse,
on peak days too. <strong>Rejected.</strong></p>
{image(rel, "lbnl-loss-relative.png", "Each loss compared with the MAE-trained model (0 = same). If stricter losses chased peaks, the dark bars would be negative.", "Figure", alt="Change in error vs. the MAE loss")}
{beside(image(rel, "lbnl-loss-comparison.png", "Prediction vs. actual for five training losses (MAE, Huber δ = 0.5 / 1.0 / 2.0, MSE). The shaded areas are the peak gap: under every loss the largest spikes are still under-predicted.", alt="Prediction vs actual for five loss functions"), "Five losses, same story: the biggest spikes stay under-predicted.", "right")}
<h3>Hypothesis 2 · Just forecast high on purpose</h3>
<p>For provisioning, over-shooting is cheaper than falling short, so I trained <strong>percentile forecasts</strong> that aim
above the median. Raising the target added spare capacity on ordinary days but barely changed how often a busy day was
missed: the whole forecast shifted up without learning to see spikes coming. <strong>Rejected.</strong></p>
<h3>Conclusion · A limit on what history can predict</h3>
<p>If neither a stricter objective nor a deliberately high forecast catches the spikes, the information isn't in the past
traffic. The peaks are infrequent and rarely foreshadowed, so a model trained on history alone can't anticipate them. That
changed the team's question from <em>"which model predicts peaks?"</em> to <em>"what signal would make peaks predictable?"</em>,
and it now drives feature design: calendar features, rolling variance and recent miss activity.</p>"""

    regimes = f"""
<p>The most recent test period was far more erratic than earlier years, which raised a new question: is there one best
setup at all, or does it depend on the kind of traffic?</p>
<h3>Step 6 · Split by regime and compare</h3>
<p>I divided the longest-running cache's history into a calmer earlier era and an erratic recent era, trained a separate
model on each with the same chronological split, and repeated the lookback-by-horizon comparison inside both.</p>
{tiles([("Calm traffic", "The best amount of history grows with the horizon: short windows a day or a week ahead, and long history starts to pay off a month ahead."),
        ("Erratic traffic", "A window of the last few days wins almost everywhere. Rapid shifts make long history stale, so it turns into misleading noise."),
        ("Same model, different worlds", "Error was dramatically higher in the erratic era, so a single model judged on mixed data hides how differently it behaves in each.")])}
{image(rel, "lbnl-regimes.png", "For each era, every lookback's error divided by the best lookback for the same variable and horizon (1.0 = best, outlined). Ratios only: absolute errors differ hugely between the eras.", "Figure", alt="Heatmaps of error relative to the best lookback, calm vs erratic era")}
<p><strong>Conclusion:</strong> rather than one model for all traffic, <strong>detect the regime and use a model tuned for it</strong>.
The next step is a measurable seasonality or regime signal that says in advance whether traffic will be calm or erratic,
and fixing patch length and stride for each lookback.</p>"""

    main_html = (
        panel("overview", "Overview", overview, num="01")
        + panel("problem", "The problem &amp; the data", problem, num="02")
        + panel("model", "A baseline worth beating", model, num="03")
        + panel("tuning", "Choosing how much history to use", tuning, num="04")
        + panel("peaks", "Testing why peaks are missed", peaks, num="05")
        + panel("regimes", "Calm vs. erratic traffic", regimes, num="06")
        + pager(rel, ("projects/bearlm/", "BearLM"), ("experience/cbu-research/", "CBU Research")))

    rail = (
        panel("toc-lb", "On this page", toc([("overview", "Overview"), ("problem", "Problem &amp; data"),
                                             ("model", "Baseline"), ("tuning", "Lookback &amp; robustness"),
                                             ("peaks", "Peak hypotheses"), ("regimes", "Traffic regimes")]),
              body_cls="panel-body tight")
        + panel("spec-lb", "Spec sheet", spec([("Org", "Berkeley Lab · ESnet"), ("Role", "DS &amp; ML Research Intern"),
                                                ("Program", "Data Science Discovery"), ("Dates", "Sep 2026 – present"),
                                                ("Data", "XCache, 3 CMS caches"), ("Model", "PatchTST"),
                                                ("Baseline", "Persistence"), ("Validation", "Rolling-origin CV")]),
                body_cls="panel-body tight")
        + panel("stack-lb", "Stack", chips(["PyTorch", "NeuralForecast", "PyTorch Lightning", "Pandas", "NumPy",
                                            "Matplotlib", "Seaborn", "Plotly", "Jupyter"]),
                body_cls="panel-body tight")
        + info("What is — persistence?",
               "<p>The naive forecast: predict that the next value equals the last observed one. For traffic with "
               "strong momentum it's surprisingly hard to beat, which makes it the honest bar.</p>")
        + info("What is — XCache?",
               "<p>A regional data cache for scientific computing. When a physicist reads a file, a <b>hit</b> serves "
               "it from the nearby cache; a <b>miss</b> fetches it over the wide-area network and keeps a copy for "
               "the next reader.</p>"))
    return h, layout(main_html, rail)


# ============================================================================ CBU


def cbu(ctx):
    rel = ctx["rel"]
    full = _cbu_full(ctx["cbu_public"])
    h = hero(
        "field-ice", "INTERNSHIP · RESEARCH", "CBU Research",
        "Machine Learning Research Intern at California Baptist University. I diagnosed why a structural "
        "inverse-FEA predictor stalled, then built SeismicSoCal: live deep-learning earthquake detection, "
        "location, sizing and alerts for Southern California.",
        ["May 2026 – present", "Riverside, CA", "seismicsocal.duckdns.org"],
        (C.mini_bars(full.HERO_BARS, title=full.HERO_TITLE, fmt=lambda v: f"{v:.3f}") if full else C.seismogram()),
        go("#fea", "Inverse-FEA diagnosis") + go(rel + "projects/seismicsocal/", "SeismicSoCal case study")
        + go("https://seismicsocal.duckdns.org", "Live site", True))

    overview = f"""
{stats([("7", "ML models benchmarked", "inverse-FEA diagnosis"),
(full.STAT if full else ("~0.10", "R² ceiling", "a data limit, not a model limit")),
        ("0.9998", "Detection ROC-AUC", "vs 0.816 STA/LTA"),
        ("0.951", "Magnitude R²", "vs 0.886 baseline")])}
<hr class="dotted">
<p class="lede">Two research problems, one habit: find out what the data can actually support before promising anything.</p>
{bullets([
    "Diagnosed the root cause of a stalled <strong>inverse-FEA predictor</strong> by benchmarking 7 ML models (Random Forest, XGBoost, "
    "HGB/ExtraTrees ensembles, PCA pipelines), running paired clean-vs-noisy analysis and a noise-identifiability sweep. This proved the "
    "<strong>R² ≈ 0.10 ceiling was a data limitation rather than a model limitation</strong>, gave the team the measurement precision each "
    "target needs, and redirected them away from futile model tuning.",
    "Raised earthquake detection to <strong>0.9998 ROC-AUC (vs. 0.816 STA/LTA)</strong> and magnitude <strong>R² to 0.951 (vs. 0.886)</strong> by "
    "training PyTorch CNN→Transformer and CNN→GNN→Transformer ensembles on 50,743 windows and 6,243 quakes from 19 live stations, "
    "with chronological splits and event-clustered bootstrap CIs.",
    "Built and deployed a <strong>real-time SeedLink pipeline</strong> that detects, picks, locates (≥ 3 stations, negative evidence) and sizes "
    "quakes, then sends two-stage FCM alerts. On a replay of 10 held-out days: <strong>93% of confirmed events real (chance 0%), 0 false "
    "pushes</strong>, median location error 2.5 km.",
])}"""

    if full:
        fea = full.fea(rel, __import__(__name__))
    else:
        # Unpublished research: method only, no figures, no exact results beyond what the résumé states.
        fea = f"""
<p>An <strong>inverse finite-element</strong> problem runs simulation backwards: given a structure's measured
response, recover the material properties that produced it. Here, the measured shape of a deformed structure
(landmark positions, summarised with PCA) is used to predict the stiffness of several of its components. Two targets
were predicted well. One was stuck at <strong>R² ≈ 0.10</strong>, which was holding up the team's IEEE research paper, and
the instinct was to keep tuning models. I set out to find out whether tuning could help at all.</p>
<p class="note">This work is part of an unpublished paper, so its figures and detailed results are held back until
publication. The method is below.</p>
{flow([("Audit", "make the evaluation leak-free first", False),
       ("Benchmark", "7 models, same CV", False),
       ("Clean vs. noisy", "paired, one variable", True),
       ("Bottlenecks", "PCA? noisy inputs?", False),
       ("Sim-to-real", "train clean, test noisy", False),
       ("Noise sweep", "how much noise each target tolerates", True)])}

<h3>Step 1 · Make the evaluation trustworthy</h3>
<p>Before comparing models I fixed how they were judged, so a small difference couldn't be an artefact:</p>
{tiles([("Leak-free scaling", "Scalers fit on the training fold only, never on the rows being scored."),
        ("Out-of-fold scores", "Every reported R² comes from rows the model never trained on."),
        ("Predict-the-mean", "Each target is compared with a trivial baseline, the real test for a hard target."),
        ("Overfitting, measured", "Train-minus-out-of-fold gap reported per target, so a good score can be shown to be real.")])}
<p>I also dropped the chained setup (feeding one target's prediction into the next). The targets are drawn
independently, so chaining passes noise along rather than signal.</p>

<h3>Step 2 · Benchmark seven models</h3>
<p>If the bottleneck is the model, different inductive biases should give different answers. I benchmarked
<strong>seven model configurations</strong> under the same cross-validation: a baseline random forest, chained random
forests, and my own models, including boosted / ExtraTrees voting ensembles and PCA pipelines. Every one landed on the same
ceiling for the hard target, while the easier targets were predicted well by all of them.</p>
{tip("Seven very different models, one ceiling. That's the data talking.")}

<h3>Step 3 · Paired clean vs. noisy data</h3>
<p>The decisive test was to <strong>train on clean data and on noisy data side by side</strong>. If a target is recoverable
from clean data but not once realistic noise is added, then no model trained on noisy data will get it back, however
it's tuned. That's exactly what happened.</p>

<h3>Step 4 · Rule out the obvious bottlenecks</h3>
<ul>
<li><strong>Is PCA throwing the signal away?</strong> I bypassed it and trained on the raw landmark coordinates, alone and
alongside the PCA features. Neither rescued the hard target, so the signal isn't hiding in the discarded components.</li>
<li><strong>Are the noisiest inputs drowning it?</strong> I measured each landmark group's noise relative to its signal and
ran an ablation on only the cleanest group. Dropping the noisiest inputs didn't rescue the target either.</li>
</ul>

<h3>Step 5 · Sim-to-real</h3>
<p>The realistic deployment is a model trained on clean simulations and used on noisy measurements. Trained that way it
failed on every target until I mean-centred the noisy features onto the clean ones, which fixed a systematic offset and
recovered the easy targets. The hard target stayed unrecoverable.</p>

<h3>Step 6 · Turn "it doesn't work" into a spec</h3>
<p>Finally I rebuilt the feature generator, injected Gaussian landmark noise at increasing levels, re-projected through
the clean PCA and cross-validated each target. The result is an <strong>identifiability curve</strong>: the noise level at
which each target stops being predictable. At the real measurement noise the hard target is far past that point, and
the curve says how precise the measurements would need to be for it to work.</p>
{chat([("detective", "Could an eighth model have fixed it?"),
       ("scholar", "No. On clean data the target is recoverable. With the real measurement noise, no model gets it back."),
       ("detective", "So what does the team do instead?"),
       ("scholar", "Fix the measurements. The noise sweep says how much cleaner they need to be.")])}

<h3>The outcome</h3>
<p>Every line of evidence pointed the same way: the <strong>R² ≈ 0.10 ceiling was a data limitation, not a model
limitation</strong>. That redirected the team from model tuning to the inputs: what's measured, and at what signal
quality. In the meantime, the useful outputs are the targets that <em>are</em> identifiable, plus a calibrated prediction
interval (quantile models) for the hard one instead of a misleading point estimate. A negative result like this saves weeks.</p>"""

    seismic_sec = f"""
<p>The second half of the internship is <strong>SeismicSoCal</strong>, deep-learning seismology for Southern California,
deployed live. It listens to 19 stations in real time, detects, locates and sizes each quake, and sends two-stage
alerts to people who follow nearby sensors. Everything measured offline is exactly what runs live, and a replay of real
archived days is the acceptance test.</p>
{beside(fig(C.seismic_chart(), "Held-out chronological test (2022–2026). Detection AUC 0.9998 vs 0.816 STA/LTA; magnitude R² 0.951 vs 0.886 amplitude + distance, with non-overlapping 95% CIs."), "", "right")}
{flow([("Stream", "19 SeedLink stations", False), ("Detect", "CNN→Transformer, every 2 s", True),
       ("Locate", "≥ 3 picks, no silent nearer station", True), ("Size", "CNN→GNN→Transformer ensemble", False),
       ("Alert", "two-stage FCM push", False)], dark=True)}
{table(["Replay of 10 held-out days", "Result"],
       [["Confirmed events that were real quakes", "<span class='win'>93%</span> (chance baseline 0%)"],
        ["Push alerts / false", "<span class='win'>5 / 0</span>"],
        ["Median location error", "<span class='win'>2.5 km</span>"],
        ["Pushed magnitudes vs. catalogue", "within 0.13"]])}
<p>It is also a production ML system: <strong>QuakeOps</strong> tracks every training run in MLflow, only promotes a
retrained model through a six-rule statistical + replay gate, and checks the live stream for drift every day.</p>
<p>The case study covers <a href="{rel}projects/seismicsocal/#live">the live pipeline</a>, the
<a href="{rel}projects/seismicsocal/#replay">replay acceptance test</a> and <a href="{rel}projects/seismicsocal/#quakeops">QuakeOps</a>.</p>
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
                                                ("Models", "RF · XGB · HGB · CNN · GNN"), ("Deploy", "Oracle Cloud · systemd"),
                                                ("MLOps", "MLflow · Dagster · Evidently")]),
                body_cls="panel-body tight")
        + panel("stack-cb", "Stack", chips(["scikit-learn", "XGBoost", "PCA", "PyTorch", "ObsPy", "SeedLink", "NumPy",
                                            "MLflow", "Dagster", "Evidently", "GitHub Actions", "pytest", "FCM",
                                            "Caddy", "systemd", "Oracle Cloud"]),
                body_cls="panel-body tight")
        + info("What is — inverse FEA?",
               "<p>Finite-element analysis predicts how a structure responds to loads. The <i>inverse</i> problem "
               "infers the hidden properties or loads from a measured response, and it's only as good as the measurements.</p>")
        + info("What is — identifiability?",
               "<p>Whether the data could determine a quantity at all, for <i>any</i> model. If adding realistic noise "
               "erases a target that's recoverable from clean data, better models can't bring it back; better measurements can.</p>"))
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
{chat([("builder", "Does previewing a label use up a serial number?"),
       ("pirate", "Nope. Only Assign to item allocates the next number in the sequence."),
       ("builder", "So nobody wastes serials just by looking.")])}
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
        + pager(rel, ("experience/cbu-research/", "CBU Research"), ("experience/kigumi-group/", "Kigumi Group")))

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
{chat([("hand", "Why did the assistant only fail some of the time?"),
       ("arcade", "Two separate causes: unstable backend connections, and malformed queries sent to the GPT and image models."),
       ("hand", "Same symptom, different bugs. Sneaky.")])}
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
     "description": "Live deep-learning earthquake detection for Southern California: 0.9998 ROC-AUC detection, GNN magnitude R² 0.951, replay-tested two-stage alerts and MLflow-gated retraining."},
    {"path": "projects/bearlm", "key": "bearlm", "render": bearlm,
     "title": "BearLM · Braedyn Thompson",
     "description": "Fully local hybrid-search RAG over Berkeley CS/DS courses: recall@1 56% to 82%, RAGAS faithfulness 0.55 to 0.83."},
    {"path": "experience/lawrence-berkeley-lab", "key": "lawrence-berkeley-lab", "render": lbnl,
     "title": "Berkeley Lab Internship · Braedyn Thompson",
     "description": "PatchTST forecasting of XCache traffic at ESnet: rolling cross-validation, hypothesis tests on why peaks are missed, and regime-aware lookback selection."},
    {"path": "experience/cbu-research", "key": "cbu-research", "render": cbu,
     "title": "CBU Research Internship · Braedyn Thompson",
     "description": "Diagnosed an inverse-FEA data ceiling across 7 models with a noise-identifiability study, and built SeismicSoCal's live detection, location, sizing and alert pipeline."},
    {"path": "experience/numistoken", "key": "numistoken", "render": numis,
     "title": "NumIsToken Internship · Braedyn Thompson",
     "description": "Resumable redemptions via History and Detail services, a product serialization tool with barcode labels, and ~85% faster redemption actions."},
    {"path": "experience/kigumi-group", "key": "kigumi-group", "render": kigumi,
     "title": "Kigumi Group Internship · Braedyn Thompson",
     "description": "Backend SWE intern on KiguLab: test coverage 90% to 98% and fixed recurring GPT / image-model pipeline failures."},
]
