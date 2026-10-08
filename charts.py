"""Inline-SVG charts and schematics, generated from the real reported numbers.

Color rule from the design system: charts are cool-only. "Ours" is chrome indigo, baselines are
pale steel; warm colors are reserved for navigation/action and never appear in data marks.
"""
import math
import random

OURS = "#3d4f97"
MID = "#8ba1d4"
BASE = "#b9c0d3"
GRID = "#d5d9e4"
INK = "#21242e"
SOFT = "#4a4f63"
FONT = "font-family='Arial, Helvetica, sans-serif'"


def _t(x, y, s, size=11, anchor="start", weight="400", fill=INK, extra=""):
    return (f"<text x='{x:.1f}' y='{y:.1f}' {FONT} font-size='{size}' text-anchor='{anchor}' "
            f"font-weight='{weight}' fill='{fill}' {extra}>{s}</text>")


def legend(items, x, y):
    out, cx = [], x
    for name, color in items:
        out.append(f"<rect x='{cx}' y='{y - 9}' width='10' height='10' rx='1' fill='{color}'/>")
        out.append(_t(cx + 14, y, name, 11, fill=SOFT))
        cx += 22 + len(name) * 6.2
    return "".join(out)


def hbars(groups, vmax, fmt, series, title, width=640, label_w=150, bar_h=15, note=None,
          ticks=None):
    """Grouped horizontal bars. groups: [(label, [(series_key, value)])]; series: {key: (name, color)}."""
    inner_gap, group_gap, top = 3, 16, 50
    plot_w = width - label_w - 56
    y = top
    body = []
    for glabel, vals in groups:
        gh = len(vals) * (bar_h + inner_gap) - inner_gap
        body.append(_t(label_w - 10, y + gh / 2 + 4, glabel, 11.5, "end", "700"))
        for key, v in vals:
            name, color = series[key]
            w = max(1.5, plot_w * v / vmax)
            body.append(f"<rect class='bar' x='{label_w}' y='{y}' width='{w:.1f}' height='{bar_h}' rx='2' fill='{color}'>"
                        f"<title>{glabel} — {name}: {fmt(v)}</title></rect>")
            weight = "700" if color == OURS else "400"
            body.append(_t(label_w + w + 6, y + bar_h - 3.5, fmt(v), 11, weight=weight,
                           fill=OURS if color == OURS else SOFT))
            y += bar_h + inner_gap
        y += group_gap - inner_gap
    height = y + (18 if note else 4)
    grid = []
    for tv in (ticks or []):
        gx = label_w + plot_w * tv / vmax
        grid.append(f"<line x1='{gx:.1f}' x2='{gx:.1f}' y1='{top - 6}' y2='{y - group_gap + 4}' stroke='{GRID}' stroke-dasharray='2 3'/>")
        grid.append(_t(gx, height - 2 if not note else y + 2, fmt(tv), 9.5, "middle", fill=SOFT))
    head = _t(0, 13, title, 12, weight="700")
    leg = legend([series[k] for k in series], label_w, 36)
    foot = _t(0, height - 3, note, 10.5, fill=SOFT) if note else ""
    return (f"<svg viewBox='0 0 {width} {height}' role='img' aria-label='{title}'>"
            f"{head}{''.join(grid)}{leg}{''.join(body)}{foot}</svg>")


def line_chart(series, x_range, y_range, x_label, y_label, title, width=640, height=280,
               x_ticks=(), y_ticks=(), y_fmt=lambda v: f"{v:g}", marks=()):
    """series: [(name, [(x, y)], color, dash, label_at_index)]; marks: [(x, y, text)]."""
    L, R, T, B = 48, 112, 30, 40
    pw, ph = width - L - R, height - T - B
    x0, x1 = x_range
    y0, y1 = y_range

    def X(v):
        return L + pw * (v - x0) / (x1 - x0)

    def Y(v):
        return T + ph * (1 - (v - y0) / (y1 - y0))

    out = [f"<svg viewBox='0 0 {width} {height}' role='img' aria-label='{title}'>",
           _t(0, 14, title, 12, weight="700")]
    for tv in y_ticks:
        out.append(f"<line x1='{L}' x2='{L + pw}' y1='{Y(tv):.1f}' y2='{Y(tv):.1f}' stroke='{GRID}'/>")
        out.append(_t(L - 6, Y(tv) + 4, y_fmt(tv), 10, "end", fill=SOFT))
    for tv in x_ticks:
        out.append(f"<line x1='{X(tv):.1f}' x2='{X(tv):.1f}' y1='{T + ph}' y2='{T + ph + 4}' stroke='{SOFT}'/>")
        out.append(_t(X(tv), T + ph + 16, f"{tv:g}", 10, "middle", fill=SOFT))
    out.append(f"<line x1='{L}' x2='{L + pw}' y1='{T + ph}' y2='{T + ph}' stroke='{SOFT}'/>")
    out.append(_t(L + pw / 2, height - 4, x_label, 10.5, "middle", fill=SOFT))
    out.append(_t(12, T + ph / 2, y_label, 10.5, "middle", fill=SOFT,
                  extra=f"transform='rotate(-90 12 {T + ph / 2:.1f})'"))
    for name, pts, color, dash, li in series:
        d = "M" + " L".join(f"{X(a):.1f} {Y(b):.1f}" for a, b in pts)
        da = f" stroke-dasharray='{dash}'" if dash else ""
        cls = "" if dash else " class='draw' pathLength='1'"
        out.append(f"<path{cls} d='{d}' fill='none' stroke='{color}' stroke-width='2.4'{da} stroke-linejoin='round'/>")
        fill = color if color != BASE else SOFT
        if isinstance(li, tuple):
            lx, ly = pts[li[0]]
            dy = -14 if li[1] == "above" else 18
            out.append(_t(X(lx) + 4, Y(ly) + dy, name, 10.5, "start", "700", fill))
        elif li == "peak":
            lx, ly = max(pts, key=lambda p: p[1])
            out.append(_t(X(lx), Y(ly) - 8, name, 10.5, "middle", "700", fill))
        else:
            lx, ly = pts[li]
            out.append(_t(X(lx) + 6, Y(ly) + 4, name, 10.5, weight="700", fill=fill))
    for mx, my, text in marks:
        out.append(f"<circle cx='{X(mx):.1f}' cy='{Y(my):.1f}' r='3.5' fill='#fff' stroke='{INK}' stroke-width='1.5'/>")
        if text:
            out.append(_t(X(mx) - 7, Y(my) + 16, text, 10, "end", fill=INK))
    out.append("</svg>")
    return "".join(out)


# ----------------------------------------------------------------------------- Academy of Testers

SKILLS = ["Arithmetic &amp; %", "Algebra", "Linear fns", "Systems", "Quadratics", "Exponentials",
          "Data &amp; stats", "Geo &amp; trig"]


def radar(values, size=320, threshold=0.85, labels=True, dark=False):
    cx = cy = size / 2
    r = size / 2 - (58 if labels else 14)
    n = len(values)
    grid_c = "#4a5070" if dark else GRID
    lab_c = "#9fbee7" if dark else INK
    fill_c = "rgba(159,190,231,.35)" if dark else "rgba(61,79,151,.22)"
    stroke_c = "#9fbee7" if dark else OURS

    def pt(i, v):
        a = -math.pi / 2 + 2 * math.pi * i / n
        return cx + r * v * math.cos(a), cy + r * v * math.sin(a)

    pad = 40 if labels else 0
    out = [f"<svg viewBox='{-pad} 0 {size + 2 * pad} {size}' role='img' aria-label='Mastery radar across eight SAT math skills'>"]
    for ring in (0.25, 0.5, 0.75, 1.0):
        pts = " ".join(f"{x:.1f},{y:.1f}" for x, y in (pt(i, ring) for i in range(n)))
        out.append(f"<polygon points='{pts}' fill='none' stroke='{grid_c}'/>")
    for i in range(n):
        x, y = pt(i, 1)
        out.append(f"<line x1='{cx}' y1='{cy}' x2='{x:.1f}' y2='{y:.1f}' stroke='{grid_c}'/>")
    tpts = " ".join(f"{x:.1f},{y:.1f}" for x, y in (pt(i, threshold) for i in range(n)))
    out.append(f"<polygon points='{tpts}' fill='none' stroke='{stroke_c}' stroke-dasharray='4 3' stroke-opacity='.8'/>")
    vpts = " ".join(f"{x:.1f},{y:.1f}" for x, y in (pt(i, v) for i, v in enumerate(values)))
    out.append(f"<polygon points='{vpts}' fill='{fill_c}' stroke='{stroke_c}' stroke-width='2.2' stroke-linejoin='round'/>")
    for i, v in enumerate(values):
        x, y = pt(i, v)
        out.append(f"<circle cx='{x:.1f}' cy='{y:.1f}' r='3.2' fill='{stroke_c}'/>")
    if labels:
        for i, s in enumerate(SKILLS):
            x, y = pt(i, 1.17)
            anchor = "middle" if abs(x - cx) < 10 else ("start" if x > cx else "end")
            out.append(_t(x, y + 4, s, 10.5, anchor, "700", lab_c))
            vx, vy = pt(i, 1.17)
            out.append(_t(vx, vy + 16, f"{values[i]:.2f}", 10, anchor, fill=SOFT if not dark else "#7a8aba"))
    out.append("</svg>")
    return "".join(out)


def forgetting_chart():
    floor, lam = 0.20, 0.0112

    def curve(w0):
        return [(d, max(floor, min(w0, floor + (w0 - floor) * math.exp(-lam * d)))) for d in range(0, 181, 3)]

    return line_chart(
        [("mastered (0.90)", curve(0.90), OURS, None, (8, "above")),
         ("developing (0.60)", curve(0.60), MID, None, (4, "below")),
         ("floor 0.20", [(0, floor), (180, floor)], BASE, "4 3", -1)],
        (0, 180), (0, 1), "days since the skill was last practiced", "mastery weight",
        "Forgetting curve: w(t) = 0.20 + (w₀ − 0.20) · e^(−0.0112 t)",
        x_ticks=(0, 30, 60, 90, 120, 150, 180), y_ticks=(0, .25, .5, .75, 1),
        marks=[(62, 0.20 + 0.70 * math.exp(-lam * 62), "")])


def irt_info_chart():
    a, c = 1.0, 0.25

    def info(theta, b):
        p = c + (1 - c) / (1 + math.exp(-a * (theta - b)))
        if p <= c or p >= 1:
            return 0
        num = (p - c) / (1 - c)
        return a * a * num * num * (1 - p) / p

    xs = [i / 10 for i in range(-40, 41)]
    mk = lambda b: [(x, info(x, b)) for x in xs]  # noqa: E731
    peak = max(info(x, 0) for x in xs)
    th = math.log(0.45 / 0.55)
    return line_chart(
        [("easy (b = −1.5)", mk(-1.5), BASE, None, "peak"),
         ("medium (b = 0)", mk(0), MID, None, "peak"),
         ("hard (b = +1.5)", mk(1.5), OURS, None, "peak")],
        (-4, 4), (0, peak * 1.45), "student ability θ (logit of mastery weight)", "Fisher information",
        "3PL item information: which question tells us the most about this student?",
        x_ticks=(-4, -2, 0, 2, 4), y_ticks=(0, 0.1, 0.2, 0.3), y_fmt=lambda v: f"{v:.1f}",
        marks=[(th, info(th, 0), "")])


def frq_chart():
    series = {"b": ("Baseline (no rubric, no retrieval)", BASE), "g": ("RAG-grounded grader", OURS)}
    return hbars(
        [("English Lang + Lit", [("b", 0.974), ("g", 0.744)]),
         ("APUSH LEQ (held out)", [("b", 1.125), ("g", 0.875)])],
        1.25, lambda v: f"{v:.3f}", series,
        "Mean absolute error vs. official College Board scores (lower is better)",
        label_w=150, ticks=(0, 0.5, 1.0))


def qwk_chart():
    series = {"b": ("Baseline", BASE), "g": ("Grounded", OURS)}
    return hbars(
        [("English, QWK", [("b", 0.590), ("g", 0.624)]),
         ("APUSH, QWK", [("b", 0.521), ("g", 0.569)]),
         ("English, within-1", [("b", 0.77), ("g", 0.87)])],
        1.0, lambda v: f"{v:.2f}", series,
        "Agreement with official scores (higher is better)", label_w=150, ticks=(0, 0.5, 1.0))


# ----------------------------------------------------------------------------- SeismicSoCal

def seismogram(width=520, height=150, seed=7, dark=True, animate=True):
    rng = random.Random(seed)
    n = 520
    pts = []
    for i in range(n):
        t = i / n
        v = rng.gauss(0, 0.04)
        if t > 0.30:  # P arrival
            v += 0.32 * math.exp(-(t - 0.30) * 9) * math.sin(i * 0.9) + rng.gauss(0, 0.05) * math.exp(-(t - .3) * 4)
        if t > 0.48:  # S arrival + coda
            env = math.exp(-(t - 0.48) * 5.2)
            v += 0.95 * env * math.sin(i * 0.55 + rng.random() * 0.6) + rng.gauss(0, 0.12) * env
        pts.append(v)
    mid = height / 2
    d = "M" + " L".join(f"{width * i / (n - 1):.1f} {mid - v * (height * 0.44):.1f}" for i, v in enumerate(pts))
    line = "#9fbee7" if dark else OURS
    grid = "#3a3f50" if dark else GRID
    lab = "#7a8aba" if dark else SOFT
    anim = " class='anim anim-trace'" if animate else ""
    g = "".join(f"<line x1='{x}' x2='{x}' y1='0' y2='{height}' stroke='{grid}'/>" for x in range(0, width + 1, 52))
    g += f"<line x1='0' x2='{width}' y1='{mid}' y2='{mid}' stroke='{grid}'/>"
    px, sx = width * 0.30, width * 0.48
    marks = (f"<line x1='{px:.0f}' x2='{px:.0f}' y1='8' y2='{height - 8}' stroke='{lab}' stroke-dasharray='3 3'/>"
             + _t(px + 4, 16, "P", 11, weight="700", fill=lab)
             + f"<line x1='{sx:.0f}' x2='{sx:.0f}' y1='8' y2='{height - 8}' stroke='{lab}' stroke-dasharray='3 3'/>"
             + _t(sx + 4, 16, "S", 11, weight="700", fill=lab)
             + _t(width - 4, height - 6, "synthetic trace · 30 s window", 9.5, "end", fill=lab))
    return (f"<svg viewBox='0 0 {width} {height}' role='img' aria-label='Stylized seismogram with P and S arrivals'>"
            f"{g}{marks}<path{anim} d='{d}' fill='none' stroke='{line}' stroke-width='1.6' stroke-linejoin='round'/></svg>")


def seismic_chart():
    series = {"b": ("Classical seismology baseline", BASE), "d": ("Deep model (5-seed ensemble)", OURS)}
    return hbars(
        [("Detect · ROC-AUC", [("b", 0.816), ("d", 0.9998)]),
         ("Size · R²", [("b", 0.886), ("d", 0.951)])],
        1.0, lambda v: f"{v:.4f}" if 0.99 < v < 1 else f"{v:.3f}", series,
        "Held-out chronological test set, 2022–2026 (higher is better)", label_w=150,
        ticks=(0, 0.25, 0.5, 0.75, 1.0),
        note="95% CIs (event-clustered bootstrap): AUC 0.9997–0.9999 vs 0.805–0.828 · R² 0.943–0.959 vs 0.871–0.898")


def ablation_chart():
    series = {"g": ("Deep ensemble", OURS), "a": ("Ablation / baseline", BASE)}
    return hbars([("All stations", [("g", 0.951)]),
                  ("Live-like (10 km loc error, 3–6 stations)", [("g", 0.939)]),
                  ("Amplitude + distance baseline", [("a", 0.886)]),
                  ("Nearest single station only", [("a", 0.808)])],
                 1.0, lambda v: f"{v:.3f}", series,
                 "Magnitude R² on 937 held-out quakes: what the graph network earns", label_w=250,
                 ticks=(0, 0.5, 1.0))


def alert_timeline(width=640, height=170):
    """Median times after the quake's origin, from replayed archive days (HOW_IT_WORKS §5.7)."""
    L, R, y = 20, 24, 92
    pw = width - L - R

    def X(t):
        return L + pw * t / 60

    out = [f"<svg viewBox='0 0 {width} {height}' role='img' aria-label='Alert timeline after a quake begins'>",
           _t(0, 14, "When each message arrives (median seconds after the quake begins, 80 replayed days)", 12, weight="700"),
           f"<line x1='{L}' x2='{L + pw}' y1='{y}' y2='{y}' stroke='{SOFT}' stroke-width='1.5'/>"]
    for t in range(0, 61, 10):
        out.append(f"<line x1='{X(t):.1f}' x2='{X(t):.1f}' y1='{y}' y2='{y + 5}' stroke='{SOFT}'/>")
        out.append(_t(X(t), y + 18, f"{t} s", 10, "middle", fill=SOFT))
    out.append(f"<rect x='{X(25):.1f}' y='{y - 7}' width='{X(50) - X(25):.1f}' height='14' fill='{GRID}' opacity='.7'/>")
    marks = [(0, "Origin", "quake begins", BASE, "up"),
             (25, "Fast", "first notice, 2 s of P", MID, "up"),
             (31, "Standard", "first notice, 4 s of P", OURS, "down"),
             (50, "Confirmed", "full size, or retraction", OURS, "up")]
    for t, name, sub, color, side in marks:
        x = X(t)
        out.append(f"<circle cx='{x:.1f}' cy='{y}' r='6' fill='{color}' stroke='#fff' stroke-width='2'/>")
        anchor = "start" if t == 0 else ("end" if t >= 50 else "middle")
        if side == "up":
            out.append(_t(x, y - 30, name, 11.5, anchor, "700", OURS if color == OURS else INK))
            out.append(_t(x, y - 16, sub, 10, anchor, fill=SOFT))
        else:
            out.append(_t(x, y + 40, name, 11.5, anchor, "700", OURS))
            out.append(_t(x, y + 54, sub, 10, anchor, fill=SOFT))
    out.append(_t(width - R, height - 2, "Live adds ~2–5 s of SeedLink delay", 10, "end", fill=SOFT))
    out.append("</svg>")
    return "".join(out)


def seismic_system(width=680, height=330):
    """Offline / online / QuakeOps schematic for SeismicSoCal (replaces the v1 raster diagram)."""
    out = [f"<svg viewBox='0 0 {width} {height}' role='img' aria-label='SeismicSoCal system: offline training, online VM, QuakeOps loop'>"]

    def box(x, y, w, h, title, lines, hot=False):
        stroke = OURS if hot else "#9aa3bd"
        fill = "#eef1f9" if hot else "#f7f8fb"
        out.append(f"<rect x='{x}' y='{y}' width='{w}' height='{h}' fill='{fill}' stroke='{stroke}' stroke-width='1.4'/>")
        out.append(_t(x + 8, y + 16, title, 11, weight="700", fill=OURS if hot else INK))
        for i, ln in enumerate(lines):
            out.append(_t(x + 8, y + 31 + i * 13, ln, 9.8, fill=SOFT))

    def arrow(x1, y1, x2, y2, dash=False):
        d = " stroke-dasharray='4 3'" if dash else ""
        out.append(f"<line x1='{x1}' y1='{y1}' x2='{x2}' y2='{y2}' stroke='{SOFT}' stroke-width='1.3'{d} marker-end='url(#ah)'/>")

    out.append(f"<defs><marker id='ah' viewBox='0 0 8 8' refX='7' refY='4' markerWidth='7' markerHeight='7' orient='auto'>"
               f"<path d='M0 0 L8 4 L0 8 z' fill='{SOFT}'/></marker></defs>")
    out.append(_t(0, 13, "OFFLINE · PC (RTX 4060)", 10.5, weight="700", fill=SOFT))
    out.append(_t(352, 13, "ONLINE · Oracle A1 VM (systemd + Caddy)", 10.5, weight="700", fill=SOFT))
    box(0, 24, 150, 62, "Data", ["USGS catalogue M1+", "SCEDC waveforms,", "response removed"])
    box(170, 24, 160, 62, "build_dataset.py", ["6,243 events", "50,743 detect windows", "chronological 70/15/15"])
    box(0, 106, 150, 62, "Train (GPU)", ["Detect: CNN→Transformer", "Size: CNN→GNN→Transformer", "5 seeds, MLflow-tracked"], True)
    box(170, 106, 160, 62, "Replay harness", ["same engine, archived days", "calibrate on validation", "score test days once"], True)
    box(352, 24, 160, 62, "SeedLink", ["19 stations, real time", "per-station buffers", "data-quality gate"])
    box(532, 24, 148, 62, "pipeline.py", ["detect → pick → locate", "→ quick check → size", "→ decide (data time)"], True)
    box(352, 106, 160, 62, "server.py (API)", ["supervises the daemon", "/api/status /ca /health", "push registration"])
    box(532, 106, 148, 62, "FCM push", ["two-stage alerts", "+ home shaking (MMI)", "shadow mode switch"])
    box(352, 188, 160, 54, "Web + Android", ["React, Capacitor, native", "MMI computed on device"])
    box(532, 188, 148, 54, "Nightly crosscheck", ["live log vs USGS,", "+1 h chance baseline"])
    # QuakeOps band
    out.append(_t(0, 270, "QUAKEOPS · MLOps loop", 10.5, weight="700", fill=SOFT))
    steps = ["Dagster monthly", "train challenger", "gate G1–G6", "MLflow @champion", "VM pull (sha256)", "drift check"]
    sw, gap = 104, 11.2
    for i, st in enumerate(steps):
        x = i * (sw + gap)
        hot = i in (2, 3)
        out.append(f"<rect x='{x:.1f}' y='280' width='{sw}' height='30' fill='{'#eef1f9' if hot else '#f7f8fb'}' "
                   f"stroke='{OURS if hot else '#9aa3bd'}' stroke-width='1.3'/>")
        out.append(_t(x + sw / 2, 299, st, 10, "middle", "700" if hot else "400", OURS if hot else INK))
        if i:
            arrow(x - gap + 1, 295, x - 1, 295)
    arrow(150, 55, 168, 55)
    arrow(178, 86, 142, 104)
    arrow(150, 137, 168, 137)
    arrow(512, 55, 530, 55)
    arrow(606, 86, 606, 104)
    arrow(532, 137, 514, 137)
    arrow(432, 168, 432, 186)
    out.append("</svg>")
    return "".join(out)


# ----------------------------------------------------------------------------- BearLM

def recall_chart():
    series = {"d": ("Dense only", BASE), "h": ("Hybrid BM25 + dense", MID), "r": ("Hybrid + reranker", OURS)}
    return hbars(
        [("recall@1", [("d", .56), ("h", .60), ("r", .82)]),
         ("recall@3", [("d", .68), ("h", .78), ("r", .86)]),
         ("recall@5", [("d", .76), ("h", .84), ("r", .86)]),
         ("MRR", [("d", .644), ("h", .700), ("r", .840)])],
        1.0, lambda v: f"{v:.2f}", series,
        "Retrieval ablation · 50-question benchmark generated from real corpus chunks",
        label_w=110, bar_h=13, ticks=(0, 0.5, 1.0))


def ragas_chart():
    series = {"d": ("Dense only", BASE), "r": ("Hybrid + reranker + grounding", OURS)}
    return hbars(
        [("Faithfulness", [("d", .55), ("r", .83)]),
         ("Answer relevancy", [("d", .80), ("r", .97)])],
        1.0, lambda v: f"{v:.2f}", series, "RAGAS answer quality · local Llama 3.1 judge",
        label_w=130, ticks=(0, 0.5, 1.0))


def mini_bars(items, width=420, height=170, dark=True, title="", fmt=lambda v: f"{v:.2f}"):
    """Small vertical bar trio for hero screens. items: [(label, value, emphasized)]."""
    n = len(items)
    bw, gap, base = 70, 40, height - 30
    x0 = (width - (n * bw + (n - 1) * gap)) / 2
    lab = "#9fbee7" if dark else INK
    out = [f"<svg viewBox='0 0 {width} {height}' role='img' aria-label='{title}'>"]
    out.append(_t(width / 2, 14, title, 11, "middle", "700", lab))
    for i, (label, v, hot) in enumerate(items):
        h = (base - 34) * v
        x = x0 + i * (bw + gap)
        fill = "#9fbee7" if hot else "#4a5070"
        out.append(f"<rect class='vbar' x='{x:.0f}' y='{base - h:.0f}' width='{bw}' height='{h:.0f}' rx='2' fill='{fill}'/>")
        out.append(f"<text x='{x + bw / 2:.0f}' y='{base - h - 6:.0f}' font-family='VT323, monospace' font-size='22' text-anchor='middle' fill='{lab}'>{fmt(v)}</text>")
        out.append(_t(x + bw / 2, base + 16, label, 10, "middle", "700", "#7a8aba"))
    out.append(f"<line x1='20' x2='{width - 20}' y1='{base}' y2='{base}' stroke='#4a5070'/></svg>")
    return "".join(out)


# ----------------------------------------------------------------------------- Berkeley Lab

def patchtst_schematic(width=620, height=250, dark=False):
    rng = random.Random(3)
    ink = "#9fbee7" if dark else INK
    soft = "#7a8aba" if dark else SOFT
    box = "#2c3040" if dark else "#fff"
    edge = "#000" if dark else OURS
    # synthetic traffic-like series: daily cycle + weekly swell + spikes (schematic only)
    n, L = 96, 64
    ys = []
    for i in range(n):
        v = 0.45 + 0.22 * math.sin(i / 24 * 2 * math.pi * 2.0) + 0.08 * math.sin(i / 96 * 2 * math.pi) + rng.gauss(0, .04)
        if rng.random() < 0.05:
            v += rng.uniform(.2, .35)
        ys.append(max(.05, min(.98, v)))
    sx0, sy0, sw, sh = 20, 36, 380, 70

    def P(i, v):
        return sx0 + sw * i / (n - 1), sy0 + sh * (1 - v)

    look = "M" + " L".join("%.1f %.1f" % P(i, ys[i]) for i in range(L))
    fut = "M" + " L".join("%.1f %.1f" % P(i, ys[i]) for i in range(L - 1, n))
    out = [f"<svg viewBox='0 0 {width} {height}' role='img' aria-label='PatchTST patching schematic'>"]
    out.append(_t(sx0, 18, "1 · lookback window", 11, weight="700", fill=ink))
    out.append(_t(sx0 + sw * (L / n) + 8, 18, "forecast horizons", 11, weight="700", fill=soft))
    out.append(f"<rect x='{sx0}' y='{sy0 - 4}' width='{sw * (L - 1) / (n - 1):.1f}' height='{sh + 8}' fill='{'rgba(159,190,231,.10)' if dark else 'rgba(61,79,151,.06)'}'/>")
    for k in range(1, 8):
        x = sx0 + sw * (k * 8) / (n - 1)
        out.append(f"<line x1='{x:.1f}' x2='{x:.1f}' y1='{sy0 - 4}' y2='{sy0 + sh + 4}' stroke='{soft}' stroke-dasharray='2 3'/>")
    out.append(f"<path d='{look}' fill='none' stroke='{ink if dark else OURS}' stroke-width='1.8'/>")
    out.append(f"<path d='{fut}' fill='none' stroke='{soft}' stroke-width='1.6' stroke-dasharray='4 3'/>")
    # patches -> tokens
    ty = 140
    out.append(_t(sx0, ty - 8, "2 · split into patches → one token each", 11, weight="700", fill=ink))
    for k in range(8):
        x = sx0 + k * 47.5
        out.append(f"<rect x='{x:.1f}' y='{ty}' width='40' height='22' rx='2' fill='{box}' stroke='{edge}'/>")
        out.append(_t(x + 20, ty + 15, f"p{k + 1}", 10, "middle", "700", ink))
    # transformer
    out.append(f"<rect x='{sx0}' y='{ty + 38}' width='{8 * 47.5 - 7.5:.0f}' height='30' rx='3' fill='{'#3d4f97' if not dark else '#3d4f97'}' stroke='{edge}'/>")
    out.append(_t(sx0 + (8 * 47.5 - 7.5) / 2, ty + 58, "3 · Transformer encoder (channel-independent)", 11, "middle", "700", "#fff"))
    # heads
    hx = 430
    out.append(_t(hx, ty - 8, "4 · multi-horizon heads", 11, weight="700", fill=ink))
    for j, h in enumerate(("short horizon", "mid horizon", "long horizon")):
        y = ty + j * 30
        out.append(f"<rect x='{hx}' y='{y}' width='160' height='22' rx='2' fill='{box}' stroke='{edge}'/>")
        out.append(_t(hx + 80, y + 15, h, 10.5, "middle", "700", ink))
    out.append(f"<path d='M{sx0 + 8 * 47.5 - 4:.0f} {ty + 53} L{hx - 8} {ty + 53}' stroke='{soft}' stroke-width='1.5' marker-end='url(#ah)'/>")
    out.append(f"<defs><marker id='ah' viewBox='0 0 10 10' refX='9' refY='5' markerWidth='7' markerHeight='7' orient='auto'><path d='M0 0 L10 5 L0 10z' fill='{soft}'/></marker></defs>")
    out.append(_t(width - 4, height - 4, "schematic · not real data", 9.5, "end", fill=soft))
    out.append("</svg>")
    return "".join(out)


def rolling_cv_schematic(width=620, height=190):
    folds, x0, w = 5, 92, 500
    height += 6
    out = [f"<svg viewBox='0 0 {width} {height}' role='img' aria-label='Rolling-origin cross-validation schematic'>",
           _t(0, 14, "Rolling-origin (walk-forward) cross-validation", 12, weight="700"),
           legend([("train", MID), ("validate", OURS), ("unused future", "#eceef4")], x0, 34)]
    for f in range(folds):
        y = 48 + f * 26
        tr = w * (0.36 + 0.11 * f)
        te = w * 0.11
        out.append(_t(x0 - 10, y + 13, f"fold {f + 1}", 10.5, "end", "700"))
        out.append(f"<rect x='{x0}' y='{y}' width='{w}' height='18' rx='2' fill='#eceef4'/>")
        out.append(f"<rect x='{x0}' y='{y}' width='{tr:.0f}' height='18' rx='2' fill='{MID}'/>")
        out.append(f"<rect x='{x0 + tr:.0f}' y='{y}' width='{te:.0f}' height='18' rx='2' fill='{OURS}'/>")
    out.append(f"<path d='M{x0} {height - 8} L{x0 + w} {height - 8}' stroke='{SOFT}' marker-end='url(#ta)'/>"
               f"<defs><marker id='ta' viewBox='0 0 10 10' refX='9' refY='5' markerWidth='7' markerHeight='7' orient='auto'><path d='M0 0 L10 5 L0 10z' fill='{SOFT}'/></marker></defs>")
    out.append(_t(x0 + w / 2, height - 14, "time → never train on the future", 10, "middle", fill=SOFT))
    out.append("</svg>")
    return "".join(out)


# ----------------------------------------------------------------------------- CBU

# ----------------------------------------------------------------------------- NumIsToken

def latency_chart(width=620, height=150):
    x0, w = 150, 420
    vmax = 3.2

    def X(v):
        return x0 + w * v / vmax

    out = [f"<svg viewBox='0 0 {width} {height}' role='img' aria-label='Redemption action load time before and after'>",
           _t(0, 14, "Redemption action load time (lower is better)", 12, weight="700")]
    # before: range 2-3 s
    y = 40
    out.append(_t(x0 - 10, y + 15, "Before", 11.5, "end", "700"))
    out.append(f"<rect x='{x0}' y='{y}' width='{X(2) - x0:.0f}' height='20' rx='2' fill='{BASE}'/>")
    out.append(f"<rect x='{X(2):.0f}' y='{y}' width='{X(3) - X(2):.0f}' height='20' rx='2' fill='{BASE}' fill-opacity='.45'/>")
    out.append(f"<line x1='{X(2):.0f}' x2='{X(3):.0f}' y1='{y + 10}' y2='{y + 10}' stroke='{SOFT}' stroke-width='1.5'/>")
    out.append(_t(X(3) + 6, y + 15, "~2–3 s", 11, fill=SOFT))
    y = 76
    out.append(_t(x0 - 10, y + 15, "After", 11.5, "end", "700"))
    out.append(f"<rect x='{x0}' y='{y}' width='{X(0.3) - x0:.0f}' height='20' rx='2' fill='{OURS}'/>")
    out.append(_t(X(0.3) + 6, y + 15, "~300 ms  (−85%)", 11, weight="700", fill=OURS))
    for v in (0, 1, 2, 3):
        out.append(f"<line x1='{X(v):.0f}' x2='{X(v):.0f}' y1='34' y2='104' stroke='{GRID}' stroke-dasharray='2 3'/>")
        out.append(_t(X(v), 120, f"{v} s", 10, "middle", fill=SOFT))
    out.append("</svg>")
    return "".join(out)


def redemption_states(width=640, height=210):
    """Simplified illustration of resumable redemption state handling."""
    def box(x, y, label, sub, hot=False):
        fill = OURS if hot else "#fff"
        tc = "#fff" if hot else INK
        return (f"<rect x='{x}' y='{y}' width='118' height='44' rx='3' fill='{fill}' stroke='{OURS}' stroke-width='1.5'/>"
                + _t(x + 59, y + 19, label, 10.5, "middle", "700", tc)
                + _t(x + 59, y + 34, sub, 9.5, "middle", fill="#dfe4f2" if hot else SOFT))

    arrow = ("<defs><marker id='sa' viewBox='0 0 10 10' refX='9' refY='5' markerWidth='7' markerHeight='7' orient='auto'>"
             f"<path d='M0 0 L10 5 L0 10z' fill='{OURS}'/></marker></defs>")
    out = [f"<svg viewBox='0 0 {width} {height}' role='img' aria-label='Simplified resumable redemption flow'>", arrow,
           _t(0, 14, "Resumable redemption (simplified illustration)", 12, weight="700")]
    xs = [10, 168, 326, 484]
    labels = [("REQUESTED", "user starts"), ("PAYMENT PENDING", "provider call"),
              ("PAYMENT SETTLED", "funds confirmed"), ("COMPLETE", "tokens redeemed")]
    for (x, (l, s)) in zip(xs, labels):
        out.append(box(x, 40, l, s, hot=(l == "COMPLETE")))
    for a, b in zip(xs, xs[1:]):
        out.append(f"<line x1='{a + 120}' x2='{b - 4}' y1='62' y2='62' stroke='{OURS}' stroke-width='1.5' marker-end='url(#sa)'/>")
    out.append(box(247, 140, "INTERRUPTED", "was: stuck forever"))
    out.append(f"<path d='M227 86 C227 120 247 150 247 150' fill='none' stroke='{SOFT}' stroke-dasharray='4 3'/>")
    out.append(f"<path d='M385 86 C385 120 365 150 365 150' fill='none' stroke='{SOFT}' stroke-dasharray='4 3'/>")
    out.append(f"<path d='M247 162 C150 170 120 110 205 90' fill='none' stroke='{OURS}' stroke-width='1.8' marker-end='url(#sa)'/>")
    out.append(_t(120, 170, "resume from last", 10.5, "middle", "700", OURS))
    out.append(_t(120, 183, "durable state", 10.5, "middle", "700", OURS))
    out.append(_t(470, 160, "History + Detail services read the", 10, fill=SOFT))
    out.append(_t(470, 173, "persisted state, so the client can", 10, fill=SOFT))
    out.append(_t(470, 186, "pick up where a failed attempt left off", 10, fill=SOFT))
    out.append("</svg>")
    return "".join(out)


# ----------------------------------------------------------------------------- Kigumi Group

def coverage_chart():
    series = {"b": ("Before", BASE), "a": ("After my test suite", OURS)}
    return hbars([("Code coverage", [("b", 90), ("a", 98)]),
                  ("Uncovered code", [("b", 10), ("a", 2)])],
                 100, lambda v: f"{v:.0f}%", series,
                 "Backend test coverage", label_w=120, ticks=(0, 25, 50, 75, 100),
                 note="Uncovered code shrank from 10% to 2%: four fifths of the untested surface closed.")


def ai_pipeline(width=640, height=250):
    """Illustrative AI-assistant request path with the two failure classes marked."""
    ERR = "#e60012"

    def box(x, y, w, label, sub, hot=False):
        fill = OURS if hot else "#fff"
        tc = "#fff" if hot else INK
        return (f"<rect x='{x}' y='{y}' width='{w}' height='46' rx='3' fill='{fill}' stroke='{OURS}' stroke-width='1.5'/>"
                + _t(x + w / 2, y + 20, label, 10.5, "middle", "700", tc)
                + _t(x + w / 2, y + 35, sub, 9.5, "middle", fill="#dfe4f2" if hot else SOFT))

    def arrow(x1, y1, x2, y2):
        return (f"<line x1='{x1}' y1='{y1}' x2='{x2}' y2='{y2}' stroke='{OURS}' stroke-width='1.5' marker-end='url(#ka)'/>")

    def bad(x, y, n):
        return (f"<circle cx='{x}' cy='{y}' r='10' fill='{ERR}'/>"
                + _t(x, y + 4, n, 11, "middle", "700", "#fff"))

    out = [f"<svg viewBox='0 0 {width} {height}' role='img' aria-label='AI assistant request path with failure points'>",
           "<defs><marker id='ka' viewBox='0 0 10 10' refX='9' refY='5' markerWidth='7' markerHeight='7' orient='auto'>"
           f"<path d='M0 0 L10 5 L0 10z' fill='{OURS}'/></marker></defs>",
           _t(0, 14, "AI assistant request path (simplified illustration)", 12, weight="700")]
    out.append(box(0, 92, 110, "LEARNER", "asks the assistant"))
    out.append(box(140, 92, 130, "BACKEND", "AI assistant service", hot=True))
    out.append(box(300, 92, 130, "QUERY BUILD", "prompt formulation"))
    out.append(box(470, 44, 160, "GPT MODEL", "text answers"))
    out.append(box(470, 140, 160, "IMAGE MODEL", "image generation"))
    out.append(arrow(112, 115, 136, 115))
    out.append(arrow(272, 115, 296, 115))
    out.append(arrow(432, 108, 466, 72))
    out.append(arrow(432, 122, 466, 160))
    out.append(bad(205, 80, "1"))
    out.append(bad(365, 80, "2"))
    out.append(_t(0, 214, "1  Unstable backend connections dropped or stalled model calls", 10.5, weight="700", fill=INK))
    out.append(_t(0, 232, "2  Malformed query formulation sent bad requests to the GPT and image models", 10.5, weight="700", fill=INK))
    out.append("</svg>")
    return "".join(out)
