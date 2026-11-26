/*
 * Toward the gate of light: an ASCII loading screen.
 *
 *   <script src="ascii-stage.js"></script>
 *   <script src="ascend-gate.js"></script>
 *   <script>AscendGate.play().then(showThePage);</script>
 *
 * An ink-wash painting in black, white and greys. Two black rock spires lean
 * together under a white sun, and a beam of light falls through the narrow gap
 * between them onto a great gate standing in a sea of clouds. Two flocks of
 * white birds circle the spires; cliffs with temples, a pine on its rock and
 * boulders stand in the clouds to either side. A lone figure seen from behind,
 * topknot, loose hair, dark robes and a long sash all streaming right in the
 * wind, walks away from us across a misty plain that mirrors it, toward the
 * gate. The camera holds, then follows behind, a little slower, so the figure
 * shrinks as the gate grows. The beam widens until the gate is a black
 * silhouette, its light spreads out over the clouds, the spires and last the
 * figure, the frame is white, and the white breaks into mist and thins away to
 * the page. Five seconds (LENGTH, below).
 *
 * The scene is set out in metres from where the camera starts: x across, y up
 * from the plain, z ahead. The camera only ever moves straight ahead, so each
 * thing that stands up is a flat painted layer at its own distance, which the
 * camera sees grow about the point ahead on the horizon, the faster the nearer
 * it is; the plain is found along each half cell's ray. The whole film is a
 * pure function of time: createScene().render(t) fills a grid of characters
 * and the colours behind them, and the stage (ascii-stage.js) paints that grid.
 */
const AscendGate = (() => {
  'use strict';
  const { code, clamp01, lerp, smooth, mulberry32, hash, noise } = AsciiStage;

  // The story's timeline, in the seconds of the user's description.
  const T = {
    move: 1.5,   // the camera starts forward behind the figure
    swell: 5.0,  // the beam starts to grow wider and brighter
    spread: 8.0, // its light spreads out from the gate: the clouds, then the spires
    thin: 8.9,   // the figure, black against it, thins
    white: 9.5,  // and is gone: the frame is solid white
    mist: 10.0,  // the white breaks into mist and thins away to the page
    end: 11.0,
  };
  // It is played faster than that. LENGTH is how many seconds the whole of it
  // takes on screen, and SPEED how many times faster than the story that is.
  const LENGTH = 5, SPEED = T.end / LENGTH;

  // The painting's portrait frame, in frame heights: across from its middle,
  // down from its top. It fills the screen's height; a wider screen sees more
  // of the world to either side.
  const HZ = 0.745;  // the horizon: level with the figure's head, because the camera is
  const TOP = 0.04;  // bare cloud at the very top, left off the screen
  const LENS = 0.6;  // frame heights a metre spans, a metre off
  const SUN = [0.002, 0.112, 0.034]; // across, down, radius
  // The world, in metres and seconds of the story.
  const EYE = 1.75;  // the camera's height, and the figure's
  const NEAR = 6;    // how far ahead of the camera the figure is at first
  const PACE = 0.7;  // the figure walks a step a second
  const DOLLY = 0.6; // and the camera follows a little slower
  const GATE = 27;   // how far off the gate stands
  const BEAM = 30;   // and the beam, just behind it
  const WIND = 0.5;  // metres a second the clouds and the mist drift to the right

  // How far the camera has come at story time s: still, then an even glide.
  const dolly = (s) => { const w = Math.max(0, s - T.move); return DOLLY * (w < 0.4 ? (w * w) / 0.8 : w - 0.2); };

  // Colours: greys from ink black to paper white, and the white thinning away
  // at the end (MIST + 1, the faintest, to MIST + 8). `swatch` adds a run of
  // colours to INK and gives the index of the first.
  const INK = ['#000000'];
  const swatch = (...colours) => INK.push(...colours) - colours.length;
  const NL = 40;
  const GREY = swatch(...Array.from({ length: NL }, (_, i) => '#' + Math.round(12 + (243 * i) / (NL - 1)).toString(16).padStart(2, '0').repeat(3)));
  const MIST = swatch(...Array.from({ length: 8 }, (_, i) => `rgba(255,255,255,${((i + 1) / 9).toFixed(3)})`)) - 1;
  const grey = (L) => GREY + Math.max(0, Math.min(NL - 1, Math.round(L * (NL - 1))));
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  const [BAR, SLASH, BACK, LOW, DASH, HIGH, TICK, COMMA, DOT, WAVE, VEE, CARET, COLON, OPEN, SHUT] = code("|/\\_-'`,.~v^:()");

  // A line too thin to fill cells, drawn in slashes, bars and dashes chosen by
  // where it crosses each cell, as the plum blossom draws its twigs. Columns
  // and rows; put(c, r, glyph) sets each character.
  function line(c0, r0, c1, r1, put) {
    const dc = c1 - c0, dr = r1 - r0, wide = Math.abs(dc), high = Math.abs(dr), rising = dc * dr < 0;
    if (wide <= high * 1.3) { // steep: one glyph per row
      const lo = Math.min(r0, r1), hi = Math.max(r0, r1);
      for (let r = Math.floor(lo); r < hi; r++) {
        const ya = Math.max(lo, r), yb = Math.min(hi, r + 1), part = yb - ya;
        if (part < 0.25) continue;
        const ca = c0 + (dc * (ya - r0)) / dr, cb = c0 + (dc * (yb - r0)) / dr;
        const stub = part < 0.6 ? ((ya + yb) / 2 - r > 0.5 ? (rising ? COMMA : DOT) : HIGH) : 0;
        put(Math.floor((ca + cb) / 2), r, stub || (Math.floor(ca) === Math.floor(cb) ? BAR : rising ? SLASH : BACK));
      }
      return;
    }
    const lo = Math.min(c0, c1), hi = Math.max(c0, c1), slope = high / wide; // shallow: one glyph per column
    for (let c = Math.floor(lo); c < hi; c++) {
      const xa = Math.max(lo, c), xb = Math.min(hi, c + 1);
      if (xb - xa < 0.35) continue;
      const y = r0 + (dr * ((xa + xb) / 2 - c0)) / dc, r = Math.floor(y), f = y - r;
      if (slope > 0.6) put(c, r, rising ? SLASH : BACK);
      else if (slope > 0.2) put(c, r, f < 0.36 ? (rising ? HIGH : TICK) : f > 0.64 ? (rising ? COMMA : DOT) : DASH);
      else if (f < 0.3) put(c, r - 1, LOW);
      else put(c, r, f > 0.7 ? LOW : DASH);
    }
  }

  // The spires as outlines in the frame, from the tip down into the clouds:
  // each edge a list of [down, across]. Their inner edges stand almost
  // upright with the narrow gap between; the outer ones fall away in ledges.
  const SPIRES = [
    { left: [[0.116, -0.035], [0.17, -0.052], [0.24, -0.068], [0.31, -0.088], [0.38, -0.102], [0.52, -0.114]],
      right: [[0.116, -0.035], [0.14, -0.022], [0.19, -0.015], [0.3, -0.012], [0.52, -0.013]] },
    { left: [[0.283, -0.12], [0.33, -0.138], [0.37, -0.165], [0.52, -0.178]], right: [[0.283, -0.12], [0.32, -0.106], [0.52, -0.102]] }, // a lesser one on its shoulder
    { left: [[0.19, 0.016], [0.215, 0.01], [0.3, 0.009], [0.52, 0.01]],
      right: [[0.19, 0.015], [0.215, 0.035], [0.25, 0.05], [0.28, 0.082], [0.3, 0.09], [0.34, 0.11], [0.355, 0.128], [0.39, 0.138], [0.42, 0.158], [0.44, 0.162], [0.47, 0.18], [0.52, 0.186]] },
  ];
  const edgeAt = (pts, y) => {
    let i = 1;
    while (i < pts.length - 1 && y > pts[i][0]) i++;
    const [y0, x0] = pts[i - 1], [y1, x1] = pts[i];
    return x0 + (x1 - x0) * clamp01((y - y0) / (y1 - y0));
  };

  // Banks of cloud drifting right, each at its own distance: [metres off, the
  // height of its top, how far the top rises and falls, metres to a billow,
  // lightness, how solid the top is, how solid deeper in, metres down to
  // there, and how clear it is in the middle of the picture (0 not at all)].
  const BANKS = [
    [320, 151, 22, 60, 0.86, 0.97, 0.45, 30, 0], // round the feet of the spires
    [95, 31, 3, 18, 0.8, 0.92, 0.5, 8, 0.7],     // round the cliffs to the sides
    [40, 9.2, 1.2, 6, 0.9, 0.9, 0.85, 3, 0],     // behind the gate, where the beam lands
    [26, 3.9, 0.6, 4, 0.93, 0.97, 0.95, 1.5, 0], // over the foot of the gate
    [15, 1.95, 0.35, 3, 0.86, 0.75, 0.7, 0.8, 0], // low mist where the plain meets the clouds
  ];

  // The gate, in metres across from its middle and up from the plain: a wide
  // roof sweeping up at the corners, two dragons on its ridge, a deep lintel,
  // and two thick pillars carved with coils, standing in the cloud. Which part
  // is at (x, y): 0 none, then the parts below.
  const ROOF = 1, EAVE = 2, LINTEL = 3, PILLAR = 4, COIL = 5;
  const RIDGE = 3.9, POST = 1.92; // half the roof's span, and how far out each pillar stands
  const eave = (u) => 7.5 + 1.7 * u ** 3; // the underside of the roof, u of the way out to a corner
  function gatePart(x, y) {
    const ax = Math.abs(x), u = ax / RIDGE;
    if (u <= 1) {
      const low = eave(u), high = low + 0.12 + 1.0 * (1 - u * u);
      if (y >= low && y <= high) return y < low + 0.28 ? EAVE : ROOF;
      const d = Math.abs(ax - 2); // a dragon on the ridge, its head turned up
      if (d < 0.26 && y > high && y < high + 0.6 * (1 - d / 0.26) + 0.08 * Math.sin(ax * 11)) return ROOF;
    }
    if (y >= 6.5 && y < 7.5 && ax <= 2.65 - 0.2 * (7.5 - y)) return LINTEL;
    const p = Math.abs(ax - POST), coil = y > 4.1 && y < 6.5 ? 0.18 * Math.abs(Math.sin(y * 5.4 + (x > 0 ? 1 : 0))) : 0;
    const w = 0.34 + 0.11 * smooth(4.8, 0, y);
    if (y < 6.5 && p <= w + coil) return p > w ? COIL : PILLAR;
    return 0;
  }

  function createScene({ cols, rows, aspect = 2, seed = 1 }) {
    const rand = mulberry32(seed), R = (a, b) => a + (b - a) * rand();
    const H2 = rows * 2, N = cols * H2, cells = cols * rows;
    const glyph = new Uint8Array(cells), ink = new Uint8Array(cells), bold = new Uint8Array(cells), paint = new Uint8Array(N);
    const FH = H2 / (1 - TOP), FW = (FH * aspect) / 2; // half rows, and columns, to one frame height
    const side = cols / 2 / FW; // frame heights from the middle to either edge of the screen
    const Xc = Float32Array.from({ length: cols }, (_, c) => (c + 0.5 - cols / 2) / FW); // each column's place in the frame
    const Yh = Float32Array.from({ length: H2 }, (_, h) => TOP + (h + 0.5) / FH);    // and each half row's
    const colOf = (x) => cols / 2 + x * FW, rowOf = (y) => (y - TOP) * FH;           // and back: a column, a half row
    const hz = Math.max(0, Math.min(H2, Math.ceil(rowOf(HZ) - 0.5))); // the first half row below the horizon

    // A soft texture that repeats, for cloud and mist: TS texels square, read smoothly between them.
    const TS = 128, TEX = new Float32Array(TS * TS);
    const looped = (x, y, p, salt) => {
      const xi = Math.floor(x), yi = Math.floor(y), u = smooth(0, 1, x - xi), v = smooth(0, 1, y - yi);
      const at = (i, j) => hash((((i % p) + p) % p) + salt, ((j % p) + p) % p);
      return lerp(lerp(at(xi, yi), at(xi + 1, yi), u), lerp(at(xi, yi + 1), at(xi + 1, yi + 1), u), v);
    };
    for (let j = 0; j < TS; j++) for (let i = 0; i < TS; i++) {
      let n = 0;
      for (let o = 0, f = 8, a = 0.57; o < 3; o++, f *= 2, a /= 2) n += a * looped((i / TS) * f, (j / TS) * f, f, seed * 131 + o * 17);
      TEX[j * TS + i] = n;
    }
    const tex = (u, v) => {
      const xi = Math.floor(u), yi = Math.floor(v), fx = u - xi, fy = v - yi;
      const x0 = xi & (TS - 1), x1 = (xi + 1) & (TS - 1), y0 = (yi & (TS - 1)) * TS, y1 = ((yi + 1) & (TS - 1)) * TS;
      return lerp(TEX[y0 + x0] + (TEX[y0 + x1] - TEX[y0 + x0]) * fx, TEX[y1 + x0] + (TEX[y1 + x1] - TEX[y1 + x0]) * fx, fy);
    };
    // The grain of the brush: a fixed threshold in each half cell for
    // dithering between greys, and a plain ordered one for the white thinning
    // away at the end, which should be soft rather than grainy.
    const thr = new Float32Array(N), order = new Float32Array(N);
    for (let h = 0, p = 0; h < H2; h++) for (let c = 0; c < cols; c++, p++) {
      order[p] = (BAYER[(h & 3) * 4 + (c & 3)] + 0.5) / 16;
      thr[p] = (order[p] + 0.7 * hash(c, h + 7)) % 1;
    }

    // The sky, too far off to change as the camera comes on: white round the
    // sun, greyer toward the top corners, paler again down toward the clouds,
    // and streaks of cloud swirling round the sun. Its strokes run along them.
    const skyL = new Float32Array(N), skyMark = new Uint8Array(cells), skyInk = new Float32Array(cells);
    const STREAK = [DASH, BACK, BAR, SLASH]; // a line across the screen, turned by 0, 45, 90 and 135 degrees (y down)
    for (let h = 0, p = 0; h < H2; h++) for (let c = 0; c < cols; c++, p++) {
      const x = Xc[c], y = Yh[h], dx = x - SUN[0], dy = (y - SUN[1]) * 1.6, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const u = (a / (2 * Math.PI) + 0.5) * TS * 3 + d * 90, n = tex(u, d * 150), fine = tex(u * 0.5 + 30, d * 420);
      let L = 0.68 + 0.32 * Math.exp(-d / 0.16) - 0.3 * smooth(0.25, 0.8, d) * (1 - smooth(0.35, 0.62, y)) + 0.1 * smooth(0.45, 0.72, y);
      L += (0.2 * (smooth(0.4, 0.68, n) - 0.5) + 0.08 * (fine - 0.5)) * smooth(0.05, 0.15, d); // streaked bands of cloud
      L = Math.max(L, 1 - 0.55 * smooth(SUN[2] * 0.9, SUN[2] * 3.2, d)); // the sun and its glow
      skyL[p] = L;
      const turn = a + Math.PI / 2 - 0.3; // the way the streaks run here
      if (h & 1 && Math.abs(Math.sin(turn)) < 0.5 && Math.abs(fine - 0.6) < 0.03 && d > 0.08 && hash(c, h + 31) < 0.3) { // a stroke along a streak, where it runs level enough
        const i = (h >> 1) * cols + c;
        skyMark[i] = Math.abs(Math.sin(turn)) < 0.2 ? (hash(h, c) < 0.5 ? DASH : WAVE) : STREAK[(Math.round(turn / (Math.PI / 4)) % 4 + 4) % 4];
        skyInk[i] = L + (L > 0.7 ? -0.14 : 0.14);
      }
    }

    // A painted layer: everything at one distance, as the camera sees it from
    // where it starts. lum is how light each half cell is, alpha how much of it
    // is covered, mark the layer's own strokes and markL their lightness.
    const layer = (D) => ({ D, lum: new Float32Array(N), alpha: new Float32Array(N), mark: new Uint8Array(cells), markL: new Float32Array(cells), h0: H2, h1: -1 });
    const far = layer(320), cliffs = layer(95), mid = layer(45), rocks = layer(30), near = layer(20);
    function dab(L, c, h, a, l) { // lay paint of lightness l over a half cell, covering it by a
      if (c < 0 || c >= cols || h < 0 || h >= H2 || a <= 0) return;
      const p = h * cols + c, b = L.alpha[p] * (1 - a), sum = a + b;
      L.lum[p] = (l * a + L.lum[p] * b) / sum; L.alpha[p] = sum;
      if (h < L.h0) L.h0 = h;
      if (h > L.h1) L.h1 = h;
    }
    const stroke = (L, l) => (c, r, g) => { if (c >= 0 && c < cols && r >= 0 && r < rows) { L.mark[r * cols + c] = g; L.markL[r * cols + c] = l; } };
    // Fill a shape row by row: span(y) gives its left and right edges in the
    // frame at height y (or nothing), shade(x, y, across) its lightness and
    // cover there, `across` running from -1 at its left edge to 1 at its right.
    // Strokes go in whole cells inside it, where hash allows, `odds` of them.
    const span = [0, 0], shade = [0, 0];
    function shape(L, top, bottom, edges, look, odds, strokeAt) {
      for (let h = Math.max(0, Math.floor(rowOf(top))); h < Math.min(H2, rowOf(bottom) + 1); h++) {
        const y = Yh[h];
        if (!edges(y)) continue;
        const [xl, xr] = span;
        for (let c = Math.max(0, Math.ceil(colOf(xl) - 0.5)); c <= Math.min(cols - 1, Math.floor(colOf(xr) - 0.5)); c++) {
          look(Xc[c], y, ((Xc[c] - xl) / (xr - xl || 1)) * 2 - 1);
          dab(L, c, h, shade[1], shade[0]);
          if (h & 1 && shade[1] > 0.9 && L.alpha[p0(c, h - 1)] > 0.9 && hash(c, h + 101) < odds) strokeAt(c, h >> 1, Xc[c], y, shade[0]);
        }
      }
    }
    const p0 = (c, h) => Math.max(0, h) * cols + c;

    // The spires: near black, streaked down their faces, the faces either side
    // of the gap lit by the beam and the tips by the sun, melting into cloud.
    for (const [n, sp] of SPIRES.entries()) {
      const sd = R(0, 99), inner = n === 0 ? 1 : n === 2 ? -1 : 0; // which of its edges faces the gap
      const jag = (y, o, quiet) => (quiet ? 0.0012 : 0.011) * (noise(y * 70, sd + o) - 0.5) + (quiet ? 0 : 0.007 * (noise(y * 230, sd + o + 5) - 0.5)); // crags and ledges, but a clean gap
      shape(far, sp.left[0][0], 0.52, (y) => { span[0] = edgeAt(sp.left, y) + jag(y, 0, inner < 0); span[1] = edgeAt(sp.right, y) + jag(y, 9, inner > 0); return true; },
        (x, y, across) => {
          const gap = inner ? (1 - inner * across) * (span[1] - span[0]) * FW / 2 : 99; // columns in from the edge facing the gap
          let L = 0.05 + 0.07 * noise(x * 170 + sd, y * 9) + 0.22 * Math.exp(-gap / 0.8) + 0.16 * smooth(0.24, 0.12, y) * smooth(-0.3, -1, across);
          L = lerp(L, 0.7, smooth(0.42, 0.51, y));
          shade[0] = L; shade[1] = 1 - smooth(0.47, 0.52, y);
        }, 0.13, (c, r, x, y, L) => stroke(far, L + 0.12)(c, r, hash(r, c + 7) < 0.65 ? BAR : x < (span[0] + span[1]) / 2 ? SLASH : BACK));
    }
    // Farther ranges off to the sides, pale in the haze, for wider screens.
    for (const way of [-1, 1]) for (let x = 0.24 + R(0, 0.05); x < side + 0.1; x += R(0.06, 0.26)) {
      const tip = R(0.27, 0.45), wl = R(0.04, 0.14), wr = R(0.04, 0.14), ink = R(0.4, 0.6), sd = R(0, 99), x0 = way * x, steep = R(0.12, 0.3);
      shape(far, tip, 0.52, (y) => { const k = (y - tip) / steep; span[0] = x0 - wl * k * (1 + 0.5 * (noise(y * 40, sd) - 0.5)); span[1] = x0 + wr * k * (1 + 0.5 * (noise(y * 40, sd + 3) - 0.5)); return k > 0; },
        (x, y) => { shade[0] = lerp(ink + 0.06 * (noise(x * 90, y * 12 + sd) - 0.5), 0.74, smooth(tip, 0.5, y)); shade[1] = 1 - smooth(0.46, 0.52, y); }, 0.06,
        (c, r, x, y, L) => stroke(far, L - 0.1)(c, r, x < x0 ? SLASH : BACK));
    }

    // A pillar of rock with a rounded top, standing up out of the clouds, paler
    // on the side toward the light and washing out into the haze below.
    function pillar(L, x0, top, w, ink) {
      const sd = R(0, 99), cap = R(0.8, 2.4), round = R(0.3, 0.6); // how far down its top is rounded, and how bluntly
      shape(L, top, HZ, (y) => {
        const k = y - top, half = w * clamp01(k / (w * cap)) ** round * (1 + 0.8 * k) * (1 + 0.35 * (noise(y * 45, sd) - 0.5));
        span[0] = x0 - half; span[1] = x0 + half;
        return half > 0;
      }, (x, y, across) => {
        shade[0] = lerp(ink + 0.08 * (noise(x * 140 + sd, y * 12) - 0.5) + 0.1 * smooth(0.3, 1, -across * Math.sign(x0)), 0.74, smooth(top + 0.03, top + 0.3, y));
        shade[1] = 1;
      }, 0.1, (c, r, x, y, l) => stroke(L, l - 0.08)(c, r, BAR));
    }
    // A temple: tiers of dark tiled roofs, their corners swept up, each over a
    // paler wall with lit windows. y0 is the lowest eave.
    function temple(L, x0, y0, w, tiers, ink) {
      for (let k = 0; k < tiers; k++) {
        const hw = w * (1 - 0.3 * k), low = y0 - k * w * 0.8, rise = hw * 0.45, wall = hw * (k ? 0.35 : 0.9);
        shape(L, low, low + wall, () => { span[0] = x0 - hw * 0.66; span[1] = x0 + hw * 0.66; return true; },
          () => { shade[0] = ink + 0.2; shade[1] = 1; }, 0.3, (c, r) => stroke(L, 0.8)(c, r, hash(c, r) < 0.6 ? DOT : COLON));
        shape(L, low - rise, low, (y) => {
          const q = (y - low + rise) / rise, half = hw * (0.22 + 0.78 * q + 0.22 * smooth(0.5, 0.85, q) * (1 - smooth(0.85, 1, q)));
          span[0] = x0 - half; span[1] = x0 + half;
          return true;
        }, () => { shade[0] = ink - 0.04; shade[1] = 1; }, 0.5, (c, r, x) => stroke(L, ink + 0.16)(c, r, x < x0 ? SLASH : BACK));
      }
    }
    // A boulder rising out of the clouds: rounded above, leaning, lit on its upper left.
    function boulder(L, x0, top, bottom, w, lean, ink) {
      const sd = R(0, 99);
      shape(L, top, bottom, (y) => {
        const k = (y - top) / (bottom - top), half = w * (0.3 + 0.7 * Math.sqrt(Math.min(1, k * 2.5))) * (1 + 0.25 * (noise(y * 60, sd) - 0.5));
        span[0] = x0 + lean * k * w - half; span[1] = x0 + lean * k * w + half;
        return true;
      }, (x, y, across) => {
        const k = (y - top) / (bottom - top);
        shade[0] = lerp(ink + 0.07 * (noise(x * 150 + sd, y * 30) - 0.5) + 0.16 * smooth(-0.2, -0.9, across) * smooth(0.6, 0, k), 0.8, smooth(0.3, 1, k));
        shade[1] = 1 - smooth(0.6, 1, k);
      }, 0.09, (c, r, x, y, l) => stroke(L, l + 0.1)(c, r, hash(c, r + 3) < 0.5 ? SLASH : BACK));
    }
    // An oval pad, for the pine's needles.
    const pad = (L, x0, y0, wx, wy, ink) => shape(L, y0 - wy, y0 + wy, (y) => {
      const k = 1 - ((y - y0) / wy) ** 2;
      span[0] = x0 - wx * Math.sqrt(Math.max(0, k)) * 1.1; span[1] = x0 + wx * Math.sqrt(Math.max(0, k)) * 0.9;
      return k > 0;
    }, (x, y) => { shade[0] = ink + 0.1 * smooth(y0, y0 - wy, y); shade[1] = 1; }, 0, () => {});

    // The source image's sides, as it frames them: on the left a dark cliff
    // with temples, the pine on its rock, boulders; on the right cliffs with
    // temples and boulders. Each at its own distance, so they part as the
    // camera comes on.
    pillar(cliffs, -0.27, 0.39, 0.03, 0.1); temple(cliffs, -0.262, 0.456, 0.03, 1, 0.08);
    temple(cliffs, -0.226, 0.502, 0.027, 2, 0.14);
    pillar(cliffs, -0.2, 0.5, 0.025, 0.25); temple(cliffs, -0.187, 0.535, 0.017, 1, 0.2);
    pillar(cliffs, 0.262, 0.42, 0.04, 0.12); temple(cliffs, 0.255, 0.462, 0.035, 2, 0.1);
    pillar(cliffs, 0.215, 0.475, 0.03, 0.28); pillar(cliffs, 0.175, 0.47, 0.03, 0.22); temple(cliffs, 0.17, 0.476, 0.028, 1, 0.14);
    pillar(cliffs, 0.205, 0.55, 0.035, 0.32); temple(cliffs, 0.19, 0.545, 0.014, 2, 0.2);
    boulder(mid, -0.155, 0.568, 0.65, 0.032, 0, 0.16); temple(mid, -0.173, 0.585, 0.013, 1, 0.12); temple(mid, -0.135, 0.578, 0.011, 1, 0.12);
    const trunk = [[-0.155, 0.578], [-0.148, 0.556], [-0.154, 0.538], [-0.15, 0.518]]; // the pine, twisted, leaning a little left
    for (let k = 1; k < trunk.length; k++) {
      const [x0, y0] = trunk[k - 1], [x1, y1] = trunk[k];
      line(colOf(x0), rowOf(y0) / 2, colOf(x1), rowOf(y1) / 2, stroke(mid, 0.12));
      for (let j = 0; j <= 8; j++) dab(mid, Math.floor(colOf(lerp(x0, x1, j / 8))), Math.floor(rowOf(lerp(y0, y1, j / 8))), 1, 0.12);
    }
    line(colOf(-0.151), rowOf(0.56) / 2, colOf(-0.134), rowOf(0.552) / 2, stroke(mid, 0.12)); // its low branch
    for (const [x, y, wx, wy] of [[-0.153, 0.508, 0.026, 0.0065], [-0.127, 0.514, 0.018, 0.006], [-0.143, 0.525, 0.017, 0.005], [-0.116, 0.527, 0.009, 0.004], [-0.131, 0.551, 0.009, 0.0035]]) pad(mid, x, y, wx, wy, 0.1);
    boulder(near, -0.236, 0.604, 0.74, 0.04, -0.2, 0.12);
    boulder(rocks, -0.251, 0.529, 0.64, 0.027, 0.1, 0.17); boulder(rocks, 0.252, 0.64, 0.725, 0.022, -0.3, 0.14); boulder(rocks, 0.18, 0.668, 0.725, 0.04, 0.4, 0.2);
    boulder(mid, -0.174, 0.692, 0.725, 0.018, 0, 0.22); boulder(mid, -0.126, 0.682, 0.725, 0.024, 0, 0.2);
    // Beyond the image's edges, for wider screens: more cliffs with temples,
    // and boulders in the clouds at all distances.
    for (const way of [-1, 1]) {
      for (let x = 0.33 + R(0, 0.05); x < side + 0.12; x += R(0.2, 0.36)) {
        const top = R(0.34, 0.56), w = R(0.035, 0.085), ink = R(0.22, 0.42);
        pillar(cliffs, way * x, top, w, ink);
        if (rand() < 0.45) temple(cliffs, way * x + R(-0.3, 0.3) * w, top + R(0.02, 0.05), Math.min(0.05, w * R(0.6, 0.9)), rand() < 0.35 ? 2 : 1, ink - 0.06);
      }
      for (let x = 0.3 + R(0, 0.06); x < side + 0.15; x += R(0.14, 0.3)) {
        const n = (rand() * 3) | 0;
        boulder([near, rocks, mid][n], way * x, R(0.55, 0.69), 0.74, R(0.015, 0.06) * [1.3, 1, 0.7][n], R(-0.6, 0.6), R(0.1, 0.18) + 0.09 * n);
      }
    }

    // Each frame: how light every half cell is, what is there (and for a
    // painted layer, which of its half cells), how far the light has taken it;
    // and which cells' characters something has already drawn.
    const lum = new Float32Array(N), kind = new Uint8Array(N), from = new Int32Array(N), white = new Float32Array(N), own = new Uint8Array(cells);
    const SKY = 0, GROUND = 6, BANK = 7, GATEK = 12, BEAMK = 13, FIG = 14; // 1 to 5: the painted layers, far to near; BANK + n: a bank of cloud
    const LAYERS = [far, cliffs, mid, rocks, near], map = new Int32Array(cols);
    const grow = (D, camZ) => D / (D - camZ); // how much larger a thing D metres off looks once the camera has come camZ

    function lay(n, camZ) { // a painted layer, as the camera sees it now
      const L = LAYERS[n - 1], k = grow(L.D, camZ);
      for (let c = 0; c < cols; c++) map[c] = Math.floor(colOf(Xc[c] / k));
      const hA = Math.max(0, Math.floor(rowOf(HZ + (Yh[L.h0] - HZ) * k))), hB = Math.min(H2 - 1, Math.ceil(rowOf(HZ + (Yh[L.h1] - HZ) * k)));
      for (let h = hA; h <= hB; h++) {
        const h0 = Math.floor(rowOf(HZ + (Yh[h] - HZ) / k));
        if (h0 < L.h0 || h0 > L.h1) continue;
        for (let c = 0, p = h * cols; c < cols; c++, p++) {
          const q = h0 * cols + map[c], a = L.alpha[q];
          if (a <= 0) continue;
          lum[p] += (L.lum[q] - lum[p]) * a;
          if (a > 0.5) { kind[p] = n; from[p] = q; }
        }
      }
    }

    // The plain: misty, wet enough to mirror the light, darker near the
    // camera; its mist drifts right. Each half cell is the point on the plain
    // its ray reaches.
    function plain(s, camZ) {
      for (let h = hz; h < H2; h++) {
        const dy = Yh[h] - HZ, dist = (LENS * EYE) / dy, z = camZ + dist, near = smooth(0.005, 0.22, dy);
        for (let c = 0, p = h * cols; c < cols; c++, p++) {
          const x = (Xc[c] * dist) / LENS - WIND * s;
          const n = tex(x * 2.2, z * 7), m = tex(x * 0.6 + 50, z * 2.5 + 20);
          lum[p] = lerp(0.8, 0.42, near) + 0.24 * (m - 0.5) + 0.1 * (n - 0.5) + 0.28 * Math.exp(-((Xc[c] / (0.025 + 0.12 * dy)) ** 2)) * (1 - 0.6 * near);
          kind[p] = GROUND;
        }
      }
    }

    // A bank of cloud: its top billows and drifts right, it is most solid
    // just under the top, and it reaches down to the plain.
    function bank(n, s, camZ) {
      const [D, top, amp, billow, light, solid, body, depth, clear] = BANKS[n], dist = D - camZ, k = D / dist;
      for (let c = 0; c < cols; c++) {
        const x = (Xc[c] * dist) / LENS - WIND * s; // metres across at the bank, as it has drifted
        const crest = top + amp * (2 * tex((x / billow) * 16, n * 23 + 5) - 1);
        const middle = clear ? 1 - clear * (1 - smooth(0.06, 0.2, Math.abs(Xc[c] / k))) : 1;
        const h1 = Math.min(H2 - 1, Math.floor(rowOf(HZ + (LENS * EYE) / dist)));
        for (let h = Math.max(0, Math.floor(rowOf(HZ - (LENS * (crest - EYE)) / dist))); h <= h1; h++) {
          const under = crest - EYE + ((Yh[h] - HZ) * dist) / LENS; // metres below its top
          if (under < 0) continue;
          const t = tex((x / billow) * 40 + 7, (under / billow) * 30 + n * 31);
          const a = Math.min(1, middle * lerp(solid, body, smooth(depth * 0.3, depth, under)) * smooth(0, 0.3 * amp + 0.15, under) * (0.7 + 0.6 * t));
          const p = h * cols + c;
          lum[p] += (light + 0.14 * (t - 0.5) - lum[p]) * a;
          if (a > 0.6) kind[p] = BANK + n;
        }
      }
    }

    // The beam: a bright core falling through the gap and widening toward the
    // gate, a glow about it, and a blaze where it lands behind the gate. It
    // shimmers, and from T.swell grows wider and brighter.
    function beam(s, camZ) {
      const k = grow(BEAM, camZ), swell = smooth(T.swell, T.spread, s), wide = 1 + 3.5 * swell;
      const gy = HZ - (LENS * (4 - EYE)) / (BEAM - camZ), blaze = (0.05 + 0.32 * swell * swell) * k; // where it lands, and how far its blaze reaches
      const reach = Math.max(blaze * 2.2, 0.03 * k * wide + 0.08);
      const c0 = Math.max(0, Math.floor(colOf(-reach))), c1 = Math.min(cols - 1, Math.ceil(colOf(reach)));
      for (let h = 0; h < H2; h++) {
        const y0 = HZ + (Yh[h] - HZ) / k, gd = (Yh[h] - gy) / blaze; // y0: the same height in the first frame
        const v = smooth(0.1, 0.27, y0) * (1 - smooth(0.7, 0.78, y0)) * (0.93 + 0.07 * Math.sin(s * 3.9 - y0 * 55)) * (0.85 + 0.15 * swell);
        const hw = (0.0035 + 0.017 * smooth(0.25, 0.68, y0)) * k * wide * (1 + 0.12 * Math.sin(s * 2.7 + y0 * 31)), halo = hw * 2.2 + 0.006;
        for (let c = c0, p = h * cols + c0; c <= c1; c++, p++) {
          const ax = Math.abs(Xc[c]), core = ax < hw;
          const glow = Math.min(1, v * (core ? 1 : 0.8 * Math.exp(-(ax - hw) / halo)) + (0.6 + 0.4 * swell) * Math.exp(-((Xc[c] / blaze) ** 2 + gd * gd)));
          lum[p] += (1 - lum[p]) * glow;
          if (core && v > 0.5) kind[p] = BEAMK;
        }
      }
    }

    // The gate, seen from where the camera is now: dark grey in the mist, paler
    // toward its foot, going black against the light as the beam swells. Its
    // eaves are drawn in a line of ink, its carved coils in brackets.
    const edge = [];
    for (let j = 0; j <= 24; j++) { const x = RIDGE * (j / 12 - 1); edge.push(x, eave(Math.abs(x) / RIDGE)); }
    function gate(s, camZ) {
      const scale = LENS / (GATE - camZ), dark = smooth(T.swell, T.spread - 0.5, s);
      const c0 = Math.max(0, Math.floor(colOf(-(RIDGE + 0.3) * scale))), c1 = Math.min(cols - 1, Math.ceil(colOf((RIDGE + 0.3) * scale)));
      const h0 = Math.max(0, Math.floor(rowOf(HZ - (10 - EYE) * scale))), h1 = Math.min(H2 - 1, Math.ceil(rowOf(HZ + EYE * scale)));
      for (let h = h0; h <= h1; h++) {
        const y = EYE - (Yh[h] - HZ) / scale;
        for (let c = c0; c <= c1; c++) {
          const x = Xc[c] / scale, part = gatePart(x, y);
          if (!part) continue;
          const p = h * cols + c;
          const L = part === EAVE ? 0.12 : part === ROOF ? 0.2 : part === LINTEL ? 0.16 : part === COIL ? 0.25 : 0.19 + 0.06 * (noise(x * 3, y * 0.6) - 0.5);
          lum[p] = lerp(lerp(L, 0.55, 0.3 * smooth(4.5, 1.5, y)), 0.03, dark); kind[p] = GATEK;
        }
      }
      if (dark > 0.7) return;
      const put = (c, r, g) => { const i = r * cols + c; if (c >= 0 && c < cols && r >= 0 && r < rows && (kind[(2 * r + 1) * cols + c] === GATEK || kind[2 * r * cols + c] === GATEK)) { glyph[i] = g; ink[i] = grey(0.04); own[i] = 1; } };
      for (let j = 2; j < edge.length; j += 2) line(colOf(edge[j - 2] * scale), rowOf(HZ - (edge[j - 1] - EYE) * scale) / 2 - 0.25, colOf(edge[j] * scale), rowOf(HZ - (edge[j + 1] - EYE) * scale) / 2 - 0.25, put);
      for (let r = Math.floor(h0 / 2); r <= h1 >> 1; r++) for (let c = c0; c <= c1; c++) {
        const p = (2 * r + 1) * cols + c;
        if (kind[p] === GATEK && gatePart(Xc[c] / scale, EYE - (Yh[2 * r + 1] - HZ) / scale) === COIL) put(c, r, Xc[c] < 0 === Math.abs(Xc[c] / scale) > POST ? OPEN : SHUT);
      }
    }

    // The figure, in metres: x across from its middle, y up from its soles,
    // seen from behind. Its loose strands of hair, the tails of its robe and
    // the long end of its sash stream right, waves running out along them.
    const strands = Array.from({ length: 5 }, (_, j) => [1.67 - j * 0.03, R(0.3, 0.52), R(0, 6.28)]); // [where it leaves the head, reach, phase]
    const tails = [[0.97, 0.6, 0.42, 0.05, R(0, 6.28)], [0.88, 0.46, 0.5, 0.04, R(0, 6.28)]];   // from the right hip: [height, reach, drop, half width, phase]
    const SASH = 1.8, sashPhase = R(0, 6.28); // how far the sash's end flies out, in metres
    const HAIR = 1, ROBE = 2, UNDER = 3, BELT = 4, LEG = 5;
    const part = new Uint8Array(N);
    let box = [0, -1, 0, -1], feet = 0, mid0 = 0, perC = 1, perH = 1, wave = 0; // this frame: the figure's columns and half rows, its soles' half row, middle column, columns and half rows to a metre, the wind's phase
    // How wide the figure still is as the light takes it: it narrows to a thin
    // black stroke, holds a moment, and goes.
    const thinness = (s) => 1 - 0.78 * smooth(T.thin, T.thin + 0.3, s) - 0.22 * smooth(T.white - 0.18, T.white - 0.02, s);
    const toSeg = (x, y, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, k = clamp01(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)); return [Math.hypot(x - ax - dx * k, y - ay - dy * k), k]; };
    function partAt(x, y, lift, right) {
      if ((x / 0.095) ** 2 + ((y - 1.585) / 0.115) ** 2 < 1 || (x / 0.05) ** 2 + ((y - 1.72) / 0.045) ** 2 < 1) return HAIR; // the head, and the knot on top
      if (y > 1.43 && y < 1.5 && Math.abs(x) < 0.045) return HAIR;
      if (y >= 0.99 && y < 1.07 && Math.abs(x) < 0.17) return BELT;
      if (y >= 1.05 && y < 1.47 && Math.abs(x) < 0.08 + 0.15 * smooth(1.47, 1.38, y) - 0.09 * smooth(1.35, 1.08, y)) return ROBE; // broad shoulders, a narrow waist
      for (const way of [-1, 1]) { // the sleeves, held a little out from the body, the right one pushed by the wind
        const [d, k] = toSeg(x, y, way * 0.2, 1.4, way * 0.31 + (way > 0 ? 0.03 * Math.sin(wave) : 0), 0.88);
        if (d < lerp(0.05, 0.07, k) || Math.hypot(x - way * 0.32, y - 0.83) < 0.03) return ROBE;
      }
      for (const [at, reach, drop, w, phase] of tails) { // tails of the robe, streaming out from the hip
        const u = (x - 0.12) / reach;
        if (u > 0 && u < 1 && Math.abs(y - (at - drop * u ** 1.6 + 0.05 * u * Math.sin(wave * 1.4 - u * 6 + phase))) < w * (1 - 0.75 * u)) return ROBE;
      }
      const u = (x - 0.15) / SASH; // the sash's long end, a ribbon flying out on the wind, never thinner than a half cell
      if (u > 0 && u < 1 && Math.abs(y - (0.98 - 0.35 * u + 0.2 * u * u + 0.26 * u * Math.sin(wave * 1.1 - u * 8 + sashPhase))) < Math.max(0.55 / perH, 0.02 + 0.03 * Math.sin(Math.PI * u))) return BELT;
      const q = (1.05 - y) / 0.77, hem = 0.28 + 0.04 * Math.sin(wave * 1.3 + x * 14) - 0.08 * clamp01((x - 0.12) / 0.3);
      if (y < 1.05 && y >= hem && x > -(0.14 + 0.15 * q) && x < 0.14 + 0.15 * q + 0.2 * q * q * (1 + 0.3 * Math.sin(wave - q * 5))) { // the skirts, flaring right
        return y > 0.36 + 0.18 * clamp01((x - 0.05) / 0.25) + 0.03 * Math.sin(wave + x * 12) ? ROBE : UNDER; // the outer robe over a paler under-robe
      }
      for (const way of [-1, 1]) { // the legs under the hem, the foot in the air lifted
        const up = way > 0 === !!right ? 0.12 * lift : 0;
        if (y < hem && y > up && Math.abs(x - way * 0.065) < 0.04) return LEG;
      }
      return 0;
    }
    function figureShape(s, camZ) {
      const d = NEAR + PACE * s - camZ, scale = LENS / d;
      const step = Math.floor(s), f = s - step, lift = Math.sin(Math.PI * f), right = step & 1; // the foot in the air, and how high
      const t = thinness(s), bob = 0.02 * Math.cos(2 * Math.PI * f);
      wave = s * 2 * Math.PI * 0.55;
      perC = scale * FW; perH = scale * FH; mid0 = cols / 2 + (right ? -1 : 1) * 0.025 * lift * perC; feet = rowOf(HZ + EYE * scale); // its weight goes onto the planted foot
      box = [Math.max(0, Math.floor(mid0 - 0.5 * perC)), Math.min(cols - 1, Math.ceil(mid0 + (SASH + 0.2) * perC)), Math.max(0, Math.floor(feet - 1.85 * perH)), Math.min(H2 - 1, Math.ceil(feet))];
      for (let h = box[2]; h <= box[3]; h++) {
        const y = (feet - h - 0.5) / perH, yb = y - bob * smooth(0.2, 0.6, y);
        for (let c = box[0], p = h * cols + c; c <= box[1]; c++, p++) part[p] = t > 0.04 ? partAt((c + 0.5 - mid0) / perC / t, yb, lift, right) : 0;
      }
    }
    // The plain mirrors it faintly beneath its feet, rippled.
    function reflection(s) {
      const tall = feet - box[2];
      for (let h = Math.max(0, Math.ceil(feet)); h < Math.min(H2, feet + tall); h++) {
        const m = Math.floor(2 * feet - h - 1), k = (h - feet) / tall, wob = Math.round(0.7 * Math.sin(h * 1.7 + s * 5));
        if (m < box[2] || m > box[3]) continue;
        for (let c = box[0]; c <= box[1]; c++) {
          const src = c + wob;
          if (src >= box[0] && src <= box[1] && part[m * cols + src]) lum[h * cols + c] = lerp(lum[h * cols + c], 0.2, 0.6 * (1 - k) ** 1.5);
        }
      }
    }
    // Near black, going wholly black against the light; strands of hair and
    // the sash drawn in characters, too fine to paint, and the fold of the robe.
    function figurePaint(s) {
      const black = smooth(T.swell + 1.5, T.spread + 0.4, s), t = thinness(s);
      for (let h = box[2]; h <= box[3]; h++) for (let c = box[0], p = h * cols + c; c <= box[1]; c++, p++) {
        const what = part[p];
        if (!what) continue;
        lum[p] = lerp(what === UNDER ? 0.14 : what === BELT ? 0.15 : what === HAIR ? 0.05 : 0.08, 0.02, black); kind[p] = FIG;
        const i = (h >> 1) * cols + c;
        glyph[i] = 32; own[i] = 2;
      }
      if (t < 0.45) return;
      const at = (x, y) => [mid0 + x * t * perC, (feet - y * perH) / 2];
      const put = (L, curl) => (c, r, g) => { // hair curls: where a strand runs level it is a ~
        if (c >= 0 && c < cols && r >= 0 && r < rows) { const i = r * cols + c; glyph[i] = curl && (g === DASH || g === LOW) ? WAVE : g; ink[i] = grey(L); bold[i] = 1; own[i] = 2; }
      };
      const trail = (pts, L, curl) => { for (let k = 2; k < pts.length; k += 2) { const [a, b] = at(pts[k - 2], pts[k - 1]), [c, d] = at(pts[k], pts[k + 1]); line(a, b, c, d, put(L, curl)); } };
      for (const [y0, reach, phase] of strands) trail(Array.from({ length: 14 }, (_, k) => { const u = (k >> 1) / 6; return k & 1 ? y0 - 0.14 * u * u + 0.06 * u * Math.sin(wave * 1.6 - u * 7 + phase) : 0.06 + reach * u; }), 0.04, true);
      if (perC > 7) trail([0.03, 0.98, 0.06, 0.45], 0.2, false); // a fold down the robe
    }
    // With each step, mist swirls up round the foot coming down, stays where
    // it rose as the figure walks on, and drifts off right.
    function puffs(s, camZ) {
      for (let n = Math.floor(s) - 1; n <= Math.floor(s); n++) {
        const a = s - n, fade = (1 - a / 1.8) ** 1.5 * (1 - smooth(T.spread - 0.5, T.spread, s));
        if (a > 1.8 || fade <= 0) continue;
        const d = NEAR + PACE * n - camZ, sc = LENS / d, rx = 0.2 + 0.35 * a, ry = 0.08 + 0.14 * a;
        const cx = cols / 2 + ((n & 1 ? 0.065 : -0.065) + WIND * a * 0.5) * sc * FW, cy = rowOf(HZ + (EYE - ry * 0.6) * sc), wx = rx * sc * FW, wy = ry * sc * FH;
        for (let h = Math.max(0, Math.floor(cy - wy)); h <= Math.min(H2 - 1, cy + wy); h++) for (let c = Math.max(0, Math.floor(cx - wx)); c <= Math.min(cols - 1, cx + wx); c++) {
          const dx = (c + 0.5 - cx) / wx, dy = (h + 0.5 - cy) / wy, r = Math.hypot(dx, dy);
          if (r >= 1) continue;
          const swirl = tex(((Math.atan2(dy, dx) + a * 2.5) / (2 * Math.PI)) * TS + n * 37, r * 24 + n * 11), p = h * cols + c;
          lum[p] += (0.88 - lum[p]) * Math.min(1, fade * 0.8 * (1 - r) * (0.4 + swirl));
        }
        if (fade > 0.3) for (let j = 0; j < 3; j++) { // curls of it
          const ang = j * 2.1 + a * 3 + n, c = Math.floor(cx + Math.cos(ang) * wx * 0.7), r = Math.floor((cy + Math.sin(ang) * wy * 0.6) / 2);
          if (c >= 0 && c < cols && r >= 0 && r < rows) { const i = r * cols + c; glyph[i] = WAVE; ink[i] = grey(0.93); bold[i] = 0; own[i] = 2; }
        }
      }
    }

    // Two loose flocks of small white birds, each circling its spire, hidden
    // when they pass behind it.
    const birds = [];
    for (const [cx, cy, rx, ry, turn] of [[-0.095, 0.33, 0.085, 0.035, 1], [0.14, 0.315, 0.12, 0.045, -1]]) {
      for (let j = 0; j < Math.max(8, Math.min(26, Math.round(rows * 0.5))); j++) birds.push([cx * R(0.85, 1.1), cy + R(-0.025, 0.025), rx * R(0.5, 1.2), ry * R(0.6, 1.3), R(0, 6.28), turn * R(0.22, 0.38), R(0, 6.28)]);
    }
    function flocks(s, camZ) {
      const k = grow(far.D, camZ);
      for (const [cx, cy, rx, ry, a0, w, flap] of birds) {
        const a = a0 + w * s, c = Math.floor(colOf((cx + rx * Math.cos(a)) * k)), h = Math.floor(rowOf(HZ + (cy + ry * Math.sin(a) * 0.6 + 0.004 * Math.sin(s * 2 + flap) - HZ) * k));
        if (c < 0 || c >= cols || h < 0 || h >= H2) continue;
        const p = h * cols + c, i = (h >> 1) * cols + c;
        if ((Math.sin(a) > 0 && kind[p] === 1) || white[p] > 0.4 || own[i]) continue;
        glyph[i] = (s * 2.6 + flap) % 1 < 0.55 ? VEE : CARET; ink[i] = GREY + NL - 1; own[i] = 1; // wings up, wings down
      }
    }

    // Light over the scene. As the beam swells its blaze brightens everything
    // round the gate but the gate itself; from T.spread it spreads out from the
    // gate over all of it, along the clouds and up the spires faster than down
    // across the plain, with a soft, misty edge.
    let farthest = 0;
    for (const [x, y] of [[side, TOP], [side, 1]]) farthest = Math.max(farthest, Math.hypot(x * 0.8, (y - 0.62) * (y > 0.62 ? 1.6 : 0.9)));
    function light(s, camZ) {
      const gy = HZ - (LENS * (4 - EYE)) / (BEAM - camZ), reach = (farthest + 0.15) * smooth(T.spread, T.thin, s), swell = smooth(T.swell, T.spread, s);
      const blaze = 0.5 * swell * swell, wide = 0.12 + 0.25 * swell;
      for (let h = 0, p = 0; h < H2; h++) {
        const dy = Yh[h] - gy, fy = dy * (dy > 0 ? 1.6 : 0.9);
        for (let c = 0; c < cols; c++, p++) {
          const d = Math.hypot(Xc[c] * 0.8, fy);
          if (blaze > 0 && kind[p] !== GATEK) lum[p] += (1 - lum[p]) * blaze * Math.exp(-((d / wide) ** 2));
          const W = reach > 0 ? smooth(-0.08, 0.02, reach - d - 0.22 * (tex(Xc[c] * 40 + s * 6, Yh[h] * 60) - 0.5)) : 0;
          white[p] = W;
          lum[p] += (1 - lum[p]) * W;
        }
      }
    }

    // The scene's own characters, where a whole cell is one thing and nothing
    // nearer has drawn there: the strokes of the sky and the painted layers,
    // shifted with the light; wisps drifting with the clouds and the plain's
    // mist; and a line of light down the beam until it swells.
    function strokes(s, camZ) {
      const swell = smooth(T.swell, T.spread, s);
      for (let r = 0, i = 0; r < rows; r++) for (let c = 0; c < cols; c++, i++) {
        const a = 2 * r * cols + c, b = a + cols, what = kind[b];
        if (own[i] === 1 && Math.max(white[a], white[b]) > 0.35) { glyph[i] = 32; own[i] = 0; }
        if (own[i] || what !== kind[a] || white[b] > 0.35) continue;
        if (what === SKY) { if (skyMark[i]) { glyph[i] = skyMark[i]; ink[i] = grey(skyInk[i] + lum[b] - skyL[b]); } }
        else if (what <= 5) {
          const L = LAYERS[what - 1], q = from[b], j = (((q / cols) | 0) >> 1) * cols + (q % cols);
          if (L.mark[j]) { glyph[i] = L.mark[j]; ink[i] = grey(L.markL[j] + lum[b] - L.lum[q]); }
        } else if (what === GROUND) {
          const dist = (LENS * EYE) / (Yh[2 * r + 1] - HZ), x = (Xc[c] * dist) / LENS - WIND * s, lane = Math.floor((camZ + dist) * 1.6);
          if (hash(Math.floor(x / 0.3), lane) < 0.04) { glyph[i] = hash(lane, 3) < 0.5 ? DASH : WAVE; ink[i] = grey(lum[b] + 0.13); }
        } else if (what >= BANK && what < GATEK) { // a wisp is the first two cells of a slot of five
          const n = what - BANK, u = c - (WIND * s * LENS * FW) / (BANKS[n][0] - camZ), slot = Math.floor(u / 5);
          if (u - slot * 5 < 2 && hash(slot, r * 7 + n) < 0.07) { glyph[i] = WAVE; ink[i] = grey(lum[b] - 0.12); }
        } else if (what === BEAMK && c === cols >> 1 && swell < 0.6) { glyph[i] = BAR; ink[i] = GREY + NL - 1; bold[i] = 1; }
      }
    }

    // The end: the white breaks into mist and thins away to the page, from
    // the edges of the screen in to where the gate stood, never dimming first.
    const fray = new Float32Array(N);
    let lo = Infinity, hi = -Infinity;
    for (let h = 0, p = 0; h < H2; h++) for (let c = 0; c < cols; c++, p++) {
      const e = Math.min(c + 0.5, cols - c - 0.5) / (cols / 2), f = Math.min(h + 0.5, H2 - h - 0.5) / (H2 / 2);
      fray[p] = 0.5 * Math.min(e, f) + 0.5 * (1 - Math.hypot(Xc[c] / side, (Yh[h] - 0.62) / 0.6)) + 0.5 * (tex(c * 0.35, h * 0.7) - 0.5);
      lo = Math.min(lo, fray[p]); hi = Math.max(hi, fray[p]);
    }
    for (let p = 0; p < N; p++) fray[p] = (fray[p] - lo) / (hi - lo);
    function ending(s) {
      const k = clamp01((s - T.mist) / (T.end - T.mist)) * 1.42;
      for (let p = 0; p < N; p++) {
        const a = 1 - smooth(fray[p], fray[p] + 0.4, k);
        paint[p] = a >= 1 ? GREY + NL - 1 : Math.min(8, Math.floor(a * 8 + order[p])) > 0 ? MIST + Math.min(8, Math.floor(a * 8 + order[p])) : 0;
      }
      if (k > 0) for (let r = 0, i = 0; r < rows; r++) for (let c = 0; c < cols; c++, i++) { // wisps, drifting right as they go
        const a = 1 - smooth(fray[(2 * r + 1) * cols + c], fray[(2 * r + 1) * cols + c] + 0.4, k), u = c - (s - T.mist) * cols * 0.12, slot = Math.floor(u / 4);
        if (a > 0.12 && a < 0.7 && u - slot * 4 < 1 && hash(slot, r + 77) < 0.3) { glyph[i] = WAVE; ink[i] = GREY + NL - 1; }
      }
    }

    return {
      cols, rows, palette: INK, glyph, ink, bold, paint,
      render(t) { // t: seconds since the animation started
        glyph.fill(32); ink.fill(0); bold.fill(0); paint.fill(0); own.fill(0);
        if (t >= LENGTH) return this; // over: nothing is left on the page
        const s = t * SPEED; // where that is in the story
        if (s >= T.white) { if (s >= T.mist) ending(s); else paint.fill(GREY + NL - 1); return this; }
        const camZ = dolly(s);
        lum.set(skyL); kind.fill(SKY); white.fill(0);
        plain(s, camZ); // then everything that stands up, farthest first
        lay(1, camZ); bank(0, s, camZ); lay(2, camZ); bank(1, s, camZ); lay(3, camZ); bank(2, s, camZ); lay(4, camZ);
        beam(s, camZ); gate(s, camZ); bank(3, s, camZ); lay(5, camZ); bank(4, s, camZ);
        figureShape(s, camZ); reflection(s); light(s, camZ); figurePaint(s); puffs(s, camZ);
        flocks(s, camZ); strokes(s, camZ);
        for (let p = 0; p < N; p++) { const l = Math.floor(lum[p] * (NL - 1) + thr[p]); paint[p] = GREY + (l < 0 ? 0 : l > NL - 1 ? NL - 1 : l); }
        return this;
      },
    };
  }

  // Play it on the stage. Resolves when it has finished. `seed` changes the
  // details, not the layout: the cloud, the cliffs and boulders off to the
  // sides, the birds, the figure's hair; `freezeAt` holds one moment (in
  // seconds) on screen instead of playing. Reduced motion holds the opening
  // view, the source image's framing.
  const film = { length: LENGTH, still: 1.2 / SPEED, grid: [110, 52], createScene };
  return { play: (options) => AsciiStage.play(film, options), createScene };
})();
