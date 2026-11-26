/*
 * Pagoda at dawn: an ASCII loading screen.
 *
 *   <script src="ascii-stage.js"></script>
 *   <script src="pagoda-dawn.js"></script>
 *   <script>PagodaDawn.play().then(showThePage);</script>
 *
 * A watercolour and ink-wash landscape on pale pink-white paper, tall like a
 * hanging scroll. A large soft pink-red sun stands on the left, its foot
 * behind pale grey-blue mountains that fade into mist; a dark pagoda of three
 * upturned roofs and a thin spire rises from a wooded hill in the middle with
 * mist round its foot; tall rocky cliffs stand to the right, flat-topped pines
 * on dark rocks to the left; a calm pale lake fills the lower half, mirroring
 * the far shore, with dark rocks in the water and ink rocks and grasses in the
 * foreground; branches of pink and red blossom hang from the top and reach in
 * from the right. Petals fall the whole time, down and a little left, and
 * those that reach the lake lie on it and ring it with ripples. The camera
 * holds, then glides at an even speed straight toward the pagoda, low over the
 * lake, until it is half as large again: the rocks slide out of the bottom,
 * the branches out of the top and the right, the mountains barely move. It
 * stops with the pagoda in the middle and the sun to its upper left. Then the
 * mist on the far shore rises and spreads into a wash the colour of the paper,
 * drifting left, and thins away to the page, the spire last. Five seconds
 * (LENGTH, below).
 *
 * The scene is a stack of flat painted layers, each at its own distance, over
 * a lake. The camera moves straight toward the pagoda, so every layer grows
 * about the pagoda's middle, the faster the nearer it is, and the lake is
 * found along each half cell's ray. The whole film is a pure function of
 * time: createScene().render(t) fills a grid of characters and the colours
 * behind them, and the stage (ascii-stage.js) paints that grid on a canvas.
 */
const PagodaDawn = (() => {
  'use strict';
  const { code, clamp01, lerp, smooth, mulberry32, hash, noise } = AsciiStage;

  // The story's timeline, in the seconds of the user's description.
  const T = {
    push: 2,   // the camera starts forward, straight toward the pagoda
    stop: 9,   // and stops, the pagoda half as large again, in the middle
    rise: 9.6, // the mist on the far shore rises and spreads over the scene
    end: 11.2, // and has thinned away to the page, the spire last
  };
  // It is played faster than that. LENGTH is how many seconds the whole of it
  // takes on screen, and SPEED how many times faster than the story that is.
  const LENGTH = 5, SPEED = T.end / LENGTH;

  // The painting is tall, twice as high as it is wide. Places in it are in
  // frame heights: x across from the pagoda, y down from the painting's top.
  const AT = 0.41;                // where the pagoda stands across the painting, in its widths
  const fx = (f) => (f - AT) / 2; // a place across the painting, given in its widths, as x
  const PY = 0.46;                // the pagoda's middle: the camera moves straight toward it
  const HZ = 0.62;                // the horizon, level with the camera
  const SHORE = 0.69;             // the far shore of the lake
  const DISC = [fx(0.22), 0.3625, 0.058]; // the sun: across, down, radius
  const RISE = 0.2 * DISC[2];     // it climbs a tenth of its height over the clip
  // How far off things are, in multiples of the pagoda's distance: the far
  // range, the cliffs, the pagoda on its hill, the far shore, the blossom
  // tree, the rocks in front.
  const FAR = 3, CLIFF = 1.6, HILL = 1, BANK = 0.8, TREE = 0.42, NEAR = 0.26;
  const PUSH = 1 / 3;              // how far the camera comes: the pagoda grows 1 / (1 - PUSH), half as large again
  const EYE = (SHORE - HZ) * BANK; // the camera's height over the water, in the same measure
  const DRIFT = 0.016;             // frame heights a second the mist drifts left
  const SWAY = 0.005;              // how far the tips of the branches sway, in frame heights
  const PW = 0.045;                // the pagoda's unit, half the span of its top roof, in frame heights

  // How far the camera has come at story time s, as a share of PUSH: still,
  // then an even glide that eases in and out over EASE of it.
  const EASE = 0.06;
  const glide = (s) => {
    const u = clamp01((s - T.push) / (T.stop - T.push)), e = EASE;
    return (u < e ? (u * u) / (2 * e) : u <= 1 - e ? u - e / 2 : 1 - e - (1 - u) ** 2 / (2 * e)) / (1 - e);
  };
  const sunY = (s) => DISC[1] - RISE * clamp01(s / T.end);

  // Colours. Each ramp runs from its deepest colour to the paper in NL steps,
  // so paint thins toward the paper wherever it is thin, and mist over a thing
  // is that thing's own ramp run toward the paper. `swatch` adds a run of
  // colours to INK and gives the index of the first.
  const INK = ['#000000'];
  const swatch = (...colours) => INK.push(...colours) - colours.length;
  const PAPER = [251, 237, 231];
  const NL = 16;
  const ramp = (...stops) => {
    const S = [...stops.map(([at, hex]) => [at, [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))]), [1, PAPER]];
    return swatch(...Array.from({ length: NL }, (_, n) => {
      const x = n / (NL - 1);
      let i = 1;
      while (i < S.length - 1 && x > S[i][0]) i++;
      const [a, A] = S[i - 1], [b, B] = S[i], k = clamp01((x - a) / (b - a));
      return '#' + A.map((v, j) => Math.round(v + (B[j] - v) * k).toString(16).padStart(2, '0')).join('');
    }));
  };
  const SKY = ramp([0, '#c39aa5'], [0.45, '#dcc1c6'], [0.8, '#f2e1de']); // the sky's pink washes, and the lake
  const SUN = ramp([0, '#d8707c'], [0.3, '#eba0a6'], [0.62, '#f4c4c4']); // the sun
  const MOUNT = ramp([0, '#4c5566'], [0.3, '#7b8292'], [0.55, '#a4a9b7'], [0.8, '#d8d0d6']); // grey-blue mountains
  const ROCK = ramp([0, '#0e0d12'], [0.2, '#29282e'], [0.42, '#4b4b53'], [0.62, '#77787e'], [0.82, '#b6b3b6']); // ink: rocks, wood, the pagoda
  const PINE = ramp([0, '#232a24'], [0.25, '#3f4c3e'], [0.5, '#66705b'], [0.74, '#a2a793']); // muted green pines
  const PINK = ramp([0, '#9a4c61'], [0.3, '#c98395'], [0.62, '#e8b6c0']); // pink blossom
  const RED = ramp([0, '#6a1825'], [0.22, '#a32433'], [0.42, '#cf3845'], [0.68, '#ec949b']); // red blossom
  const WHITE = swatch('#fffaf7'); // specks, and wisps of mist
  const WASH = swatch(...Array.from({ length: 8 }, (_, i) => `rgba(${PAPER},${((i + 1) / 8).toFixed(3)})`)) - 1; // the paper thinning away: WASH + 1, faintest, to WASH + 8
  const shade = (base, tone) => base + Math.max(0, Math.min(NL - 1, Math.round(tone * (NL - 1)))); // a colour along a ramp
  const paler = (colour, f) => { const base = colour - ((colour - 1) % NL), n = colour - base; return base + Math.round(n + (NL - 1 - n) * f); }; // that colour, a share f of the way to the paper
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  const [BAR, SLASH, BACK, LOW, DASH, HIGH, TICK, COMMA, DOT, WAVE, STAR, RING, FULL, COLON, OPEN, SHUT] = code("|/\\_-'`,.~*o@:()");
  const PETAL = [HIGH, COMMA, TICK, DOT]; // a petal turning over as it falls

  // The blossom tree as the painting has it, in its widths across and its
  // heights down: the trunk down the right side, then the limbs, each [width
  // where it starts, at its tip (in frame heights), how much of its blossom is
  // red, how thick its blossom is, then its points]. On a wider screen the
  // whole tree keeps to the screen's top right corner.
  const LIMBS = [
    [0.026, 0.017, 0.5, 0.3, 0.8, -0.03, 0.83, 0.05, 0.88, 0.085, 0.905, 0.13, 0.915, 0.17, 0.895, 0.205, 0.885, 0.225, 0.91, 0.26, 0.93, 0.29, 0.945, 0.325, 0.965, 0.355, 0.99, 0.375, 1.06, 0.395],
    [0.012, 0.003, 0.35, 1, 0.82, 0.02, 0.74, 0.012, 0.66, 0.022, 0.6, 0.038, 0.54, 0.058, 0.5, 0.075, 0.45, 0.083, 0.4, 0.092, 0.36, 0.104,
      0.32, 0.112, 0.275, 0.12, 0.225, 0.13, 0.167, 0.137, 0.108, 0.144, 0.05, 0.154, 0, 0.167, -0.05, 0.185],
    [0.009, 0.003, 0.3, 1.3, 0.91, 0.165, 0.85, 0.172, 0.78, 0.176, 0.72, 0.18, 0.66, 0.172, 0.6, 0.166, 0.55, 0.17, 0.5, 0.18],
    [0.006, 0.002, 0.4, 1, 0.7, 0.18, 0.66, 0.2, 0.62, 0.225, 0.58, 0.255, 0.55, 0.28, 0.52, 0.31, 0.5, 0.34],
    [0.008, 0.002, 0.75, 1.2, 0.93, 0.275, 0.88, 0.28, 0.83, 0.283, 0.78, 0.287, 0.73, 0.29, 0.68, 0.298, 0.63, 0.31, 0.6, 0.325, 0.57, 0.345],
    [0.007, 0.002, 0.6, 1.2, 1.06, 0.4, 0.98, 0.415, 0.92, 0.43, 0.86, 0.44, 0.8, 0.45, 0.75, 0.465, 0.72, 0.48],
    [0.01, 0.002, 0.85, 1.4, 1.06, 0.505, 1, 0.525, 0.95, 0.55, 0.9, 0.58, 0.86, 0.61, 0.82, 0.632, 0.78, 0.645, 0.72, 0.656, 0.66, 0.665, 0.6, 0.68],
    [0.005, 0.002, 0.85, 1.4, 0.86, 0.61, 0.83, 0.64, 0.8, 0.67, 0.77, 0.7, 0.74, 0.73],
  ];

  // The pagoda, in its unit (PW) across from its middle and down from PY:
  // its three roofs, each [apex, eave, how far its tips turn up, half its
  // span, half the width of the storey under it]; the foot of its posts in
  // the mist; the tip and the foot of its spire.
  const ROOFS = [[-0.67, -0.12, 0.2, 0.99, 0.6], [0.29, 0.55, 0.22, 1.06, 0.7], [0.86, 1.02, 0.16, 1.1, 0.58]];
  const FOOT = 1.45, TIP = -1.8, MAST = -0.62;

  // A line too thin to fill cells, drawn in slashes, bars and dashes chosen by
  // where it crosses each cell, as the plum blossom draws its twigs. Columns
  // and rows; put(c, r, glyph) sets each character. `joined` says which ends
  // go on into another stretch of the same line (1 its start, 2 its end):
  // a part of a row there gets a whole stroke, not a stub, so a crooked line
  // stays unbroken.
  function line(c0, r0, c1, r1, put, joined = 0) {
    const dc = c1 - c0, dr = r1 - r0, wide = Math.abs(dc), high = Math.abs(dr), rising = dc * dr < 0;
    if (wide <= high * 1.3) { // steep: one glyph per row
      const lo = Math.min(r0, r1), hi = Math.max(r0, r1), first = dr >= 0 ? 1 : 2, last = 3 - first;
      for (let r = Math.floor(lo); r < hi; r++) {
        const ya = Math.max(lo, r), yb = Math.min(hi, r + 1), part = yb - ya, joint = (ya === lo && joined & first) || (yb === hi && joined & last);
        if (part < 0.25 && !joint) continue;
        const ca = c0 + (dc * (ya - r0)) / dr, cb = c0 + (dc * (yb - r0)) / dr;
        const stub = part < 0.6 && !joint ? ((ya + yb) / 2 - r > 0.5 ? (rising ? COMMA : DOT) : HIGH) : 0;
        put(Math.floor((ca + cb) / 2), r, stub || (Math.floor(ca) === Math.floor(cb) ? BAR : rising ? SLASH : BACK));
      }
      return;
    }
    const lo = Math.min(c0, c1), hi = Math.max(c0, c1), slope = high / wide; // shallow: one glyph per column
    const level = (c) => { // twice the row the line is on at column c: even is a row edge, odd a row middle
      const y = r0 + (dr * (Math.min(hi, Math.max(lo, c + 0.5)) - c0)) / dc, f = y - Math.floor(y);
      return Math.floor(y) * 2 + (f < 0.25 ? 0 : f < 0.72 ? 1 : 2);
    };
    for (let c = Math.floor(lo); c < hi; c++) {
      const xa = Math.max(lo, c), xb = Math.min(hi, c + 1);
      if (xb - xa < 0.35) continue;
      const y = r0 + (dr * ((xa + xb) / 2 - c0)) / dc, r = Math.floor(y), f = y - r;
      if (slope > 0.6) put(c, r, rising ? SLASH : BACK);
      else if (slope > 0.2) put(c, r, f < 0.36 ? (rising ? HIGH : TICK) : f > 0.64 ? (rising ? COMMA : DOT) : DASH);
      else { // nearly flat: __,--' in half-row steps
        const q = level(c), steps = level(c + (rising ? 1 : -1)) < q, lands = level(c + (rising ? -1 : 1)) > q;
        if (q % 2 === 0) put(c, q / 2 - 1, LOW);
        else put(c, (q - 1) / 2, steps ? (rising ? HIGH : TICK) : lands ? (rising ? COMMA : DOT) : DASH);
      }
    }
  }

  // For the stretch of a crooked line that ends at its point j (counting x
  // and y), out of n numbers: which of its ends go on into more of the line.
  const joins = (j, n) => (j > 2 ? 1 : 0) | (j < n - 2 ? 2 : 0);

  // Smooth noise with more detail in it, 0 to 1, that never repeats.
  const fbm = (x, y) => noise(x, y) * 0.55 + noise(x * 2.03 + 17.1, y * 2.03 + 3.7) * 0.3 + noise(x * 4.1 + 5.3, y * 4.1 + 41.2) * 0.15;

  function createScene({ cols, rows, aspect = 2, seed = 1 }) {
    const rand = mulberry32(seed), R = (a, b) => a + (b - a) * rand();
    const H2 = rows * 2, N = cols * H2, cells = cols * rows;
    const glyph = new Uint8Array(cells), ink = new Uint8Array(cells), bold = new Uint8Array(cells), paint = new Uint8Array(N);

    // Fit the painting to the screen. Its full height fills the screen. A
    // screen a little narrower than it crops its sides; one narrower still
    // shrinks it to fit, with more sky above and lake below. On a narrow
    // screen the painting is centred, as it was painted; on a wide one the
    // pagoda is, and the world goes on to either side.
    const wide = (2 * cols) / (H2 * aspect);                          // the screen's width, in its heights
    const FH = H2 * Math.min(1, wide / 0.46), FW = (FH * aspect) / 2; // half rows, and columns, to a frame height
    const Y0 = 0.5 - H2 / FH / 2;                                     // the painting's y at the top of the screen
    const PC = cols / 2 - 0.045 * FW * clamp01((0.75 - wide) / 0.25); // the pagoda's column
    const XL = -PC / FW, XR = (cols - PC) / FW;                       // the screen's edges, as x
    const Xc = Float32Array.from({ length: cols }, (_, c) => (c + 0.5 - PC) / FW); // each column's x, as first seen
    const Yh = Float32Array.from({ length: H2 }, (_, h) => Y0 + (h + 0.5) / FH);   // and each half row's y
    const colOf = (x) => PC + x * FW, rowOf = (y) => (y - Y0) * FH;               // and back: a column, a half row
    const SHIFT = XR - fx(1);                                         // how far right the tree is moved to keep to the screen's corner

    // A soft texture that repeats every TS texels, for the mist and ripples,
    // which change every frame: cloud(x, y) has a blotch about every 1 in x and y.
    const TS = 256, TEX = new Float32Array(TS * TS);
    {
      const looped = (x, y, per, salt) => {
        const xi = Math.floor(x), yi = Math.floor(y), u = smooth(0, 1, x - xi), v = smooth(0, 1, y - yi);
        const at = (i, j) => hash((((i % per) + per) % per) + salt, ((j % per) + per) % per);
        return lerp(lerp(at(xi, yi), at(xi + 1, yi), u), lerp(at(xi, yi + 1), at(xi + 1, yi + 1), u), v);
      };
      for (let j = 0; j < TS; j++) for (let i = 0; i < TS; i++) {
        let n = 0;
        for (let o = 0, f = 16, a = 0.57; o < 3; o++, f *= 2, a /= 2) n += a * looped((i / TS) * f, (j / TS) * f, f, seed * 131 + o * 17);
        TEX[j * TS + i] = n;
      }
    }
    const cloud = (x, y) => {
      const u = x * 16, v = y * 16, xi = Math.floor(u), yi = Math.floor(v), fu = u - xi, fv = v - yi;
      const x0 = xi & (TS - 1), x1 = (xi + 1) & (TS - 1), y0 = (yi & (TS - 1)) * TS, y1 = ((yi + 1) & (TS - 1)) * TS;
      return lerp(TEX[y0 + x0] + (TEX[y0 + x1] - TEX[y0 + x0]) * fu, TEX[y1 + x0] + (TEX[y1 + x1] - TEX[y1 + x0]) * fu, fv);
    };

    // The grain of the brush: a fixed threshold in each half cell for laying
    // tones between the steps of a ramp, another for how much of a thin wash
    // shows, and a plain ordered one for the paper thinning away at the end.
    const thr = new Float32Array(N), cut = new Float32Array(N), order = new Float32Array(N);
    for (let h = 0, p = 0; h < H2; h++) for (let c = 0; c < cols; c++, p++) {
      order[p] = (BAYER[(h & 3) * 4 + (c & 3)] + 0.5) / 16;
      thr[p] = (order[p] + 0.7 * hash(c, h + 7)) % 1;
      cut[p] = hash(c + 911, h + 3);
    }

    // Each frame, every half cell has a ramp, a tone along it, what is seen
    // there (the layers below, far to near) and how much mist lies over it;
    // in the ending, also how much of the paper is kept there (0 to 8, or 9
    // where it has not begun to thin).
    const mat = new Uint8Array(N), tone = new Float32Array(N), who = new Uint8Array(N), fog = new Float32Array(N), kept = new Uint8Array(N);
    const SKYK = 1, SUNK = 2, FARK = 3, CLIFFK = 4, PAGODAK = 5, SPIREK = 6, HILLK = 7, BANKK = 8, LAKEK = 9, PETALK = 10, TREEK = 11, NEARK = 12;
    // What a painted texel is, for the characters laid on it.
    const ROCKY = 1, NEEDLES = 2, LEAVES = 3, BUDS = 4, WET = 5;
    // Something to set characters with: put(c, r, glyph) in this colour.
    const putter = (colour, heavy) => (c, r, g) => {
      if (c < 0 || c >= cols || r < 0 || r >= rows) return;
      const i = r * cols + c;
      glyph[i] = g; ink[i] = colour; bold[i] = heavy;
    };
    const INKED = putter(shade(ROCK, 0.02), 1); // the darkest ink

    // ---- The sky, too far off to change as the camera comes on: the paper,
    // pink washes of cloud in its upper half, faint level streaks low down,
    // a warm glow about the sun, and pink specks.
    const skyTone = new Float32Array(N);
    for (let h = 0, p = 0; h < H2; h++) for (let c = 0; c < cols; c++, p++) {
      const x = Xc[c], y = Yh[h], wash = fbm(x / 0.13 + 3, y / 0.09 + 7) + 0.25 * (fbm(x / 0.035 + 50, y / 0.025 + 9) - 0.5);
      let L = 0.975 - 0.04 * smooth(0.3, -0.05, y) - 0.36 * smooth(0.42, 0.03, y) * smooth(0.5, 0.82, wash);
      L -= 0.05 * smooth(0.28, 0.36, y) * smooth(0.46, 0.4, y) * smooth(0.55, 0.75, fbm(x / 0.25 + 30, y / 0.007));
      skyTone[p] = L - 0.07 * Math.exp(-Math.max(0, Math.hypot(x - DISC[0], y - DISC[1]) / DISC[2] - 1) / 0.6);
    }
    const specks = []; // cells of sky with a pink speck: cell, glyph, colour
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const h = hash(c + 71, r + 5003);
      if (h < 0.012 && Yh[2 * r] < 0.5) specks.push(r * cols + c, h < 0.005 ? HIGH : DOT, h < 0.004 ? shade(RED, 0.4) : shade(PINK, 0.3 + 30 * h));
    }

    // ---- Painted layers: everything at one distance, as the camera first
    // sees it, in texels `ss` to a half cell each way. A texel holds a ramp,
    // a tone along it, how fully it is covered (out of 255) and what kind of
    // thing is there. `marks` are the layer's own characters, five numbers
    // each: x, y, glyph, colour, and whether it shows only on the layer's own
    // paint (1) or wherever nothing nearer is (0). `inks` are its lines of
    // ink, drawn afresh each frame at the layer's size so they stay whole as
    // it grows: points, then what draws them.
    const layer = (D, ss) => {
      const tw = cols * ss, th = H2 * ss, n = tw * th;
      return { D, ss, tw, th, mat: new Uint8Array(n), tone: new Uint8Array(n), cover: new Uint8Array(n), kind: new Uint8Array(n), j0: th, j1: -1, marks: [], inks: [] };
    };
    const texel = (L, x, y) => {
      const i = Math.floor((x - XL) * FW * L.ss), j = Math.floor((y - Y0) * FH * L.ss);
      return i < 0 || i >= L.tw || j < 0 || j >= L.th ? -1 : j * L.tw + i;
    };
    function dab(L, i, j, m, tn, a, kind) { // lay paint of ramp m and tone tn over a texel, covering it by a
      if (a <= 0 || i < 0 || i >= L.tw || j < 0 || j >= L.th) return;
      const q = j * L.tw + i, old = L.cover[q] / 255, keep = old * (1 - Math.min(1, a));
      if (L.mat[q] === m && old) L.tone[q] = Math.round(255 * clamp01((tn * a + (L.tone[q] / 255) * keep) / (a + keep)));
      else if (a >= keep) { L.mat[q] = m; L.tone[q] = Math.round(255 * clamp01(tn)); L.kind[q] = kind; }
      L.cover[q] = Math.round(255 * Math.min(1, a + keep));
      if (j < L.j0) L.j0 = j;
      if (j > L.j1) L.j1 = j;
    }
    // Fill a shape row by row: edges(y) sets span to its left and right
    // edges at height y (or returns false), look(x, y, across) sets dye to
    // its [ramp, tone, cover] there, `across` running from -1 at its left
    // edge to 1 at its right.
    const span = [0, 0], dye = [0, 0, 0];
    function shape(L, kind, top, bottom, edges, look) {
      const jA = Math.max(0, Math.floor((top - Y0) * FH * L.ss)), jB = Math.min(L.th - 1, Math.ceil((bottom - Y0) * FH * L.ss));
      for (let j = jA; j <= jB; j++) {
        const y = Y0 + (j + 0.5) / (FH * L.ss);
        if (!edges(y)) continue;
        const [xl, xr] = span, iA = Math.max(0, Math.ceil((xl - XL) * FW * L.ss - 0.5)), iB = Math.min(L.tw - 1, Math.floor((xr - XL) * FW * L.ss - 0.5));
        for (let i = iA; i <= iB; i++) {
          const x = XL + (i + 0.5) / (FW * L.ss);
          look(x, y, ((x - xl) / (xr - xl || 1)) * 2 - 1);
          dab(L, i, j, dye[0], dye[1], dye[2], kind);
        }
      }
    }
    const pen = (L, pts, tn, heavy = 1) => L.inks.push(pts, putter(shade(ROCK, tn), heavy));
    // The characters of a layer, one chance in each cell whose two halves are
    // one kind of thing: choose(kind, x, y, tone, h) gives [glyph, colour] or nothing.
    function markUp(L, choose) {
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const qa = texel(L, Xc[c], Yh[2 * r]), qb = texel(L, Xc[c], Yh[2 * r + 1]);
        if (qa < 0 || qb < 0 || L.cover[qa] < 230 || L.cover[qb] < 230 || L.kind[qa] !== L.kind[qb]) continue;
        const m = choose(L.kind[qb], Xc[c], (Yh[2 * r] + Yh[2 * r + 1]) / 2, L.tone[qb] / 255, hash(c + seed * 31, r + 17 * L.kind[qb]));
        if (m) L.marks.push(Xc[c], (Yh[2 * r] + Yh[2 * r + 1]) / 2, m[0], m[1], 1);
      }
    }

    // A skyline across the screen: through the points the painting has (in
    // its widths across and its heights down), and beyond them a range of
    // peaks by chance between lo and hi, about `per` apart, blending in over
    // the last 0.06.
    const skyline = (pts, sd, lo, hi, per) => (x) => {
      const a = fx(pts[0][0]), b = fx(pts[pts.length - 1][0]), u = x / per;
      const ridge = 1 - Math.abs(2 * noise(u, sd) - 1), swell = noise(u * 0.37 + 11, sd + 5);
      const free = lerp(lo, hi, clamp01(1.1 - 0.75 * ridge ** 2 - 0.45 * swell)) + 0.006 * (noise(x * 40, sd + 3) - 0.5);
      if (x <= a || x >= b) return free;
      let i = 1;
      while (i < pts.length - 1 && x > fx(pts[i][0])) i++;
      const [f0, y0] = pts[i - 1], [f1, y1] = pts[i], drawn = lerp(y0, y1, (x - fx(f0)) / (fx(f1) - fx(f0))) + 0.004 * (noise(x * 60, sd + 3) - 0.5);
      return lerp(free, drawn, Math.min(smooth(a, a + 0.06, x), smooth(b, b - 0.06, x)));
    };
    // Mountains below a skyline: fill each column from its top down to where
    // the haze has taken it; look(x, y, top, slope) sets dye.
    function range(L, top, haze, look) {
      for (let i = 0; i < L.tw; i++) {
        const x = XL + (i + 0.5) / (FW * L.ss), y0 = top(x), slope = top(x + 0.004) - top(x - 0.004);
        for (let j = Math.max(0, Math.ceil((y0 - Y0) * FH * L.ss - 0.5)); j < L.th; j++) {
          const y = Y0 + (j + 0.5) / (FH * L.ss);
          if (y > haze) break;
          look(x, y, y0, slope);
          dab(L, i, j, dye[0], dye[1], dye[2], ROCKY);
        }
      }
    }

    // ---- The far range: pale lavender-grey peaks across the middle of the
    // painting, low under the sun so they hide its foot, fading into haze.
    const far = layer(FAR, 1);
    const farTop = skyline([[-0.08, 0.385], [0, 0.38], [0.05, 0.395], [0.1, 0.405], [0.17, 0.408], [0.24, 0.398], [0.3, 0.39], [0.34, 0.383],
      [0.38, 0.378], [0.43, 0.392], [0.5, 0.386], [0.57, 0.372], [0.62, 0.38], [0.68, 0.39], [0.76, 0.4], [0.9, 0.39], [1.08, 0.396]], seed * 7 + 1, 0.372, 0.415, 0.16);
    range(far, farTop, 0.5, (x, y, top, slope) => {
      dye[0] = MOUNT; dye[1] = 0.8 + 0.04 * (slope > 0 ? 1 : -0.5) + 0.04 * (fbm(x * 40, y * 25) - 0.5) + 0.16 * smooth(top, top + 0.07, y);
      dye[2] = 1 - smooth(top + 0.035, top + 0.085, y);
    });

    // ---- Nearer mountains: tall rocky cliffs on the right, streaked down
    // their faces and inked along their ridges, and a softer range to the
    // left; both fade into the mist.
    const cliff = layer(CLIFF, 1);
    const cliffTop = skyline([[-0.06, 0.36], [0, 0.375], [0.03, 0.39], [0.06, 0.425], [0.1, 0.435], [0.13, 0.43], [0.17, 0.44], [0.21, 0.445], [0.25, 0.452],
      [0.29, 0.47], [0.33, 0.52], [0.45, 0.56], [0.53, 0.5], [0.57, 0.465], [0.6, 0.45], [0.63, 0.42], [0.66, 0.39], [0.69, 0.365], [0.715, 0.352], [0.74, 0.357],
      [0.77, 0.375], [0.8, 0.384], [0.82, 0.37], [0.85, 0.33], [0.88, 0.305], [0.92, 0.29], [0.96, 0.283], [1, 0.29], [1.06, 0.31]], seed * 7 + 2, 0.4, 0.48, 0.22);
    range(cliff, cliffTop, 0.64, (x, y, top, slope) => {
      const streak = fbm(x * 55, y * 6), soft = x < fx(0.4) ? 0.08 : 0, outside = x < fx(-0.06) || x > fx(1.06) ? 0.06 : 0; // softer and paler on the left, and beyond the painting
      dye[0] = MOUNT;
      dye[1] = 0.5 + soft + outside + (0.16 - outside) * (streak - 0.5) + 0.05 * (slope > 0 ? 1 : -1) + 0.1 * smooth(top, top + 0.08, y) - 0.14 * smooth(top + 0.01, top, y);
      dye[1] = lerp(dye[1], 0.97, smooth(0.5, 0.62, y));
      dye[2] = 1 - smooth(0.58, 0.64, y);
    });
    markUp(cliff, (kind, x, y, tn, h) => {
      if (tn > 0.72) return null;
      if (fbm(x * 55, y * 6) < 0.4 && h < 0.3) return [BAR, shade(MOUNT, tn - 0.22)];
      return h < 0.05 ? [cliffTop(x + 0.004) > cliffTop(x - 0.004) ? BACK : SLASH, shade(MOUNT, tn - 0.18)] : null;
    });

    // Shapes for the nearer layers. A boulder: a rounded dome, its left
    // shoulder full and its right sloping away, then widening a little and
    // leaning as it goes down; lit softly from the upper left, darker down its
    // right side and in clefts down its face; outlined in broken ink up its
    // left side, over its top and part way down its right. `pale` lightens
    // its top, as the ink-wash rocks in front are.
    function boulder(L, cx, top, bottom, hw, lean, base, pale = 0) {
      const sd = R(0, 99), steep = R(0.6, 0.9);
      const edge = (y, side) => { // its left (side -1) or right (1) edge at height y
        const k = clamp01((y - top) / (bottom - top)), dome = clamp01((y - top) / (hw * (side < 0 ? 1.5 : 2)));
        return cx + lean * k * hw + side * hw * (0.22 + 0.78 * (side < 0 ? Math.sqrt(dome) : dome ** steep) + 0.22 * k) * (1 + 0.28 * (noise(y * 60 + side * 7, sd) - 0.5));
      };
      shape(L, ROCKY, top, bottom, (y) => { span[0] = edge(y, -1); span[1] = edge(y, 1); return span[1] > span[0]; }, (x, y, across) => {
        const k = (y - top) / (bottom - top), lit = smooth(0.5, -0.8, across) * smooth(0.8, 0, k);
        dye[0] = ROCK;
        dye[1] = base + 0.3 * lit + pale * smooth(0.3, 0, k) + 0.08 * (fbm(x * 120 + sd, y * 60) - 0.5) - 0.14 * smooth(0.6, 1, across) - 0.16 * smooth(0.6, 0.72, fbm((x - cx) * 70 + sd, y * 9));
        dye[2] = 1;
      });
      if (hw * FW < 2) return; // too small for an outline
      const pts = [], foot = top + (bottom - top) * 0.75;
      for (let j = 6; j >= 0; j--) { const y = top + ((foot - top) * j) / 6; pts.push(edge(y, -1), y); }
      for (let j = 1; j <= 4; j++) { const y = top + ((foot - top) * 0.55 * j) / 4; pts.push(edge(y, 1), y); }
      for (let j = 0, run = []; j < pts.length; j += 2) { // broken where the brush lifted
        run.push(pts[j], pts[j + 1]);
        if (j + 2 >= pts.length || (run.length >= 6 && rand() < 0.25)) { if (run.length >= 4) pen(L, run, 0.03); run = []; }
      }
    }
    // A soft round blot of colour, for crowns of trees, bushes and blossom.
    function blot(L, kind, x0, y0, r, m, base, most) {
      const sd = R(0, 99);
      shape(L, kind, y0 - r, y0 + r, (y) => {
        const k = 1 - ((y - y0) / r) ** 2;
        if (k <= 0) return false;
        const w = r * Math.sqrt(k) * (1 + 0.35 * (noise(y * 250, sd) - 0.5));
        span[0] = x0 - w; span[1] = x0 + w;
        return true;
      }, (x, y) => {
        const d = Math.hypot(x - x0, y - y0) / r;
        dye[0] = m; dye[1] = base + 0.16 * smooth(0, 1, d) * smooth(y0 + r, y0 - r, y) + 0.1 * (fbm(x * 220 + sd, y * 220) - 0.5);
        dye[2] = most * smooth(1, 0.6, d + 0.25 * (fbm(x * 90 + sd, y * 90) - 0.5));
      });
    }
    // A clump of pine needles: flat on top, rounded below, pale on top and
    // dark beneath.
    function clump(L, x0, y0, wx, wy, base) {
      const sd = R(0, 99);
      shape(L, NEEDLES, y0 - wy, y0 + wy, (y) => {
        const v = (y - y0) / wy, k = v < 0 ? 1 - v ** 4 : 1 - v * v;
        if (k <= 0) return false;
        const w = wx * Math.sqrt(k) * (1 + 0.3 * (noise(y * 300, sd) - 0.5));
        span[0] = x0 - w; span[1] = x0 + w;
        return true;
      }, (x, y) => {
        dye[0] = PINE; dye[1] = base + 0.3 * smooth(y0 + wy * 0.3, y0 - wy, y) + 0.1 * (fbm(x * 200 + sd, y * 200) - 0.5);
        dye[2] = 1;
      });
    }
    // A pine with a flat top: a crooked trunk of ink from the root up, and
    // level pads of needles, each a row of clumps on a bough. Places in frame
    // heights.
    function pine(L, trunk, pads, base) {
      pen(L, trunk, 0.04);
      const tx = trunk[trunk.length - 2], ty = trunk[trunk.length - 1];
      for (const [x0, y0, wx, wy] of pads) {
        const n = Math.max(2, Math.round(wx / 0.009));
        for (let j = 0; j < n; j++) clump(L, x0 + wx * 0.8 * (((j + 0.5) / n) * 2 - 1), y0 + R(-0.35, 0.35) * wy, (wx / n) * R(1.2, 1.6), wy * R(0.9, 1.3), base + R(-0.04, 0.04));
        if (Math.abs(x0 - tx) > wx * 0.4 || y0 > ty + 0.01) pen(L, [tx, ty, (tx + x0) / 2, (ty + y0) / 2 + 0.004, x0, y0 + wy * 0.5], 0.06);
      }
    }
    const inPainting = (pts) => pts.map((v, i) => (i & 1 ? v : fx(v))); // points given in the painting's widths, as x

    // ---- The pagoda's hill: crowns of misty trees round its foot, on a
    // mound going down into the mist; beyond the painting, a few more clumps
    // of trees far off in the mist.
    const hill = layer(HILL, 2);
    shape(hill, LEAVES, 0.505, 0.62, (y) => { const w = 0.1 * Math.sqrt(smooth(0.505, 0.6, y)); span[0] = fx(0.4) - w * 1.1; span[1] = fx(0.4) + w; return w > 0; }, (x, y) => {
      dye[0] = PINE; dye[1] = lerp(0.6, 0.96, smooth(0.52, 0.6, y)) + 0.08 * (fbm(x * 80, y * 40) - 0.5); dye[2] = 1 - smooth(0.58, 0.62, y);
    });
    for (const [f, y, r, tn] of [[0.3, 0.528, 0.016, 0.36], [0.335, 0.52, 0.02, 0.3], [0.37, 0.53, 0.016, 0.34], [0.455, 0.533, 0.015, 0.38], [0.49, 0.54, 0.018, 0.42],
      [0.35, 0.552, 0.017, 0.4], [0.42, 0.556, 0.016, 0.36], [0.47, 0.562, 0.015, 0.44]]) blot(hill, LEAVES, fx(f), y, r, PINE, tn, 1);
    for (const way of [-1, 1]) for (let x = way < 0 ? fx(-0.1) - R(0, 0.1) : fx(1.12) + R(0, 0.1); way < 0 ? x > XL - 0.05 : x < XR + 0.05; x += way * R(0.18, 0.34)) {
      for (let k = 0; k < 3; k++) blot(hill, LEAVES, x + R(-0.03, 0.03), R(0.54, 0.565), R(0.012, 0.022), PINE, R(0.5, 0.62), 0.9);
    }
    markUp(hill, (kind, x, y, tn, h) => (tn < 0.6 && h < 0.12 ? [h < 0.06 ? WAVE : COLON, shade(PINE, tn - 0.16)] : null));

    // ---- The far shore: on the left a dark boulder and rocks running down
    // to the water, with flat-topped pines, green bushes and a little red
    // tree; to the right of the pagoda a great rounded rock with dark trees
    // on its flank; beyond the painting, more rocks and pines along the shore.
    const bank = layer(BANK, 2);
    boulder(bank, fx(0.595), 0.522, 0.7, 0.054, 0, 0.54);
    for (const [f, y, r] of [[0.47, 0.565, 0.016], [0.51, 0.578, 0.018], [0.45, 0.592, 0.015], [0.55, 0.6, 0.014]]) blot(bank, LEAVES, fx(f), y, r, PINE, 0.24, 1);
    boulder(bank, fx(0.37), 0.655, 0.705, 0.03, 0.4, 0.46);
    boulder(bank, fx(0.29), 0.625, 0.705, 0.03, 0.2, 0.44);
    boulder(bank, fx(0.215), 0.598, 0.705, 0.03, 0.1, 0.42);
    boulder(bank, fx(0.1), 0.565, 0.705, 0.036, 0, 0.38);
    for (const [f, y, r] of [[0.16, 0.628, 0.012], [0.2, 0.64, 0.014], [0.25, 0.645, 0.013], [0.29, 0.655, 0.01], [0.13, 0.65, 0.01]]) blot(bank, LEAVES, fx(f), y, r, PINE, 0.42, 1);
    blot(bank, BUDS, fx(0.27), 0.616, 0.009, RED, 0.32, 0.9);
    pine(bank, inPainting([0.12, 0.575, 0.13, 0.545, 0.135, 0.512]), [[fx(0.09), 0.512, 0.035, 0.009], [fx(0.16), 0.505, 0.03, 0.008], [fx(0.07), 0.53, 0.02, 0.007]], 0.3);
    pine(bank, inPainting([0.215, 0.61, 0.235, 0.565, 0.245, 0.5]), [[fx(0.22), 0.49, 0.03, 0.008], [fx(0.28), 0.484, 0.028, 0.008], [fx(0.3), 0.505, 0.018, 0.007]], 0.32);
    pine(bank, inPainting([0.3, 0.63, 0.31, 0.585, 0.33, 0.54]), [[fx(0.34), 0.532, 0.03, 0.008], [fx(0.37), 0.548, 0.018, 0.006]], 0.34);
    pine(bank, inPainting([0.345, 0.675, 0.35, 0.645]), [[fx(0.36), 0.639, 0.018, 0.006]], 0.34);
    for (const way of [-1, 1]) { // beyond the painting: low rocks along the shore, in twos, with a pine or bushes
      for (let x = way < 0 ? fx(-0.08) - R(0, 0.08) : fx(1.12) + R(0, 0.08); way < 0 ? x > XL - 0.1 : x < XR + 0.1; x += way * R(0.26, 0.46)) {
        const top = R(0.605, 0.64), hw = R(0.035, 0.06);
        boulder(bank, x + way * hw * R(0.8, 1.3), top + R(0.015, 0.03), 0.705, hw * R(0.5, 0.8), R(-0.3, 0.3), R(0.48, 0.56));
        boulder(bank, x, top, 0.705, hw, R(-0.3, 0.3), R(0.42, 0.5));
        if (rand() < 0.6) { // a pine on the rock
          const lean = R(-0.02, 0.02), up = top - R(0.045, 0.075);
          const pads = [[x - R(0.005, 0.02), up - 0.004, R(0.02, 0.032), 0.008], [x + R(0.01, 0.03), up + 0.012, R(0.015, 0.024), 0.007]];
          pine(bank, [x, top + 0.01, x + lean, (top + up) / 2, x - lean * 0.5, up], pads, R(0.32, 0.4));
        } else for (let k = 0; k < 3; k++) blot(bank, LEAVES, x + R(-hw, hw), top + R(-0.005, 0.02), R(0.012, 0.02), PINE, R(0.32, 0.44), 1);
      }
    }
    markUp(bank, (kind, x, y, tn, h) => {
      if (kind === ROCKY) return h < 0.05 ? [h < 0.03 ? (h < 0.015 ? SLASH : BACK) : COLON, shade(ROCK, tn - 0.16)] : h < 0.065 ? [DOT, WHITE] : null;
      if (kind === NEEDLES) return h < 0.22 ? [h < 0.12 ? WAVE : DASH, shade(PINE, tn - 0.16)] : null;
      if (kind === BUDS) return h < 0.5 ? [STAR, shade(RED, 0.3)] : null;
      return h < 0.1 ? [h < 0.05 ? WAVE : COLON, shade(PINE, tn - 0.14)] : null;
    });

    // ---- The rocks in front: in the water at the lower left, three dark
    // rocks, the tallest with a red shrub on it, faintly mirrored; in the
    // lower right, ink rocks pale on top and dark beneath; beyond the
    // painting, a few more in the water and along the bottom.
    const near = layer(NEAR, 2);
    const wet = (cx, hw, y) => shape(near, WET, y, y + 0.045, (yy) => { const w = hw * (1 - (yy - y) / 0.05); span[0] = cx - w; span[1] = cx + w; return w > 0; }, (x, yy) => {
      dye[0] = MOUNT; dye[1] = 0.72 + 0.14 * smooth(y, y + 0.045, yy); dye[2] = cloud(x / 0.06, yy / 0.004) > 0.45 ? 0.85 * smooth(y + 0.045, y, yy) : 0; // a reflection, broken by ripples
    });
    wet(fx(0.035), 0.022, 0.84); wet(fx(0.13), 0.026, 0.84); wet(fx(0.22), 0.016, 0.835);
    boulder(near, fx(0.035), 0.72, 0.842, 0.022, 0.15, 0.36, 0.2);
    boulder(near, fx(0.13), 0.8, 0.842, 0.027, 0, 0.4, 0.2);
    boulder(near, fx(0.22), 0.815, 0.836, 0.016, 0, 0.44);
    for (let k = 0; k < 9; k++) blot(near, BUDS, fx(R(0.02, 0.12)), R(0.712, 0.742), R(0.004, 0.008), RED, R(0.18, 0.4), 0.95);
    pen(near, inPainting([0.05, 0.75, 0.04, 0.725, 0.02, 0.712]), 0.06);
    pen(near, inPainting([0.06, 0.748, 0.09, 0.73, 0.12, 0.722]), 0.06);
    for (const [f, top, hw, lean] of [[0.5, 0.9, 0.065, 0.2], [0.68, 0.872, 0.07, -0.1], [0.9, 0.8, 0.075, 0.1], [1.02, 0.752, 0.04, -0.2]]) boulder(near, fx(f), top, 1.14, hw, lean, 0.34, 0.34);
    for (let x = fx(-0.08) - R(0, 0.1); x > XL - 0.05; x -= R(0.25, 0.45)) { // beyond the painting: a few rocks together in the water to the left
      const foot = R(0.83, 0.85);
      for (let j = 0, m = 1 + Math.floor(rand() * 3), cx = x; j < m; j++) {
        const hw = R(0.012, 0.03);
        wet(cx, hw, foot - 0.003); boulder(near, cx, foot - hw * R(1, 2.2), foot, hw, R(-0.2, 0.2), R(0.36, 0.46), 0.2);
        cx -= hw + R(0.015, 0.035);
      }
    }
    for (let x = fx(1.14) + R(0, 0.04); x < XR + 0.08; x += R(0.15, 0.26)) boulder(near, x, R(0.84, 0.92), 1.14, R(0.06, 0.1), R(-0.2, 0.2), 0.38, 0.34); // and along the bottom to the right
    markUp(near, (kind, x, y, tn, h) => {
      if (kind === ROCKY) return h < 0.07 ? [h < 0.045 ? (h < 0.022 ? SLASH : BACK) : COLON, shade(ROCK, tn - 0.2)] : h < 0.09 ? [DOT, WHITE] : null;
      if (kind === BUDS) return h < 0.6 ? [h < 0.3 ? STAR : DOT, shade(RED, 0.28)] : null;
      if (kind === WET) return h < 0.15 ? [DASH, shade(MOUNT, 0.6)] : null;
      return null;
    });
    // Grasses and twigs on the rocks in front, too thin to paint: [base, a
    // bend, tip], in frame heights, and red buds on the twigs. The grasses
    // grow in tufts on the rocks' shoulders, each blade leaning its own way.
    const BLADES = [], BUDDED = [];
    for (const [f0, y0] of [[0.57, 0.89], [0.75, 0.865], [0.84, 0.83], [0.97, 0.78]]) for (let k = 0; k < 4; k++) {
      const f = f0 + R(-0.02, 0.02), y = y0 + R(-0.004, 0.006), up = R(0.03, 0.07), lean = R(-0.05, 0.03);
      BLADES.push(fx(f), y, fx(f + lean * 0.4), y - up * 0.6, fx(f + lean), y - up);
    }
    for (const [f, y, g, top] of [[0.62, 0.885, 0.6, 0.77], [0.66, 0.88, 0.72, 0.79], [0.37, 1.02, 0.39, 0.87], [0.33, 1.02, 0.3, 0.9], [0.42, 1.0, 0.45, 0.89]]) {
      BLADES.push(fx(f), y, fx((f + g) / 2 + R(-0.01, 0.01)), (y + top) / 2, fx(g), top);
      for (let k = 0; k < 6; k++) { const u = R(0.3, 1); BUDDED.push(lerp(fx(f), fx(g), u) + R(-0.004, 0.004), lerp(y, top, u)); }
    }
    for (let x = fx(1.1); x < XR; x += R(0.08, 0.16)) for (let k = 0; k < 3; k++) {
      const y = R(0.84, 0.87), up = R(0.03, 0.06), lean = R(-0.025, 0.015);
      BLADES.push(x, y, x + lean * 0.4, y - up * 0.6, x + lean, y - up);
    }

    // ---- The blossom tree: its limbs, the twigs that grow from them, every
    // blossom, and a soft wash of pink round the blossom. Kept to the screen's
    // top right corner; on a wider screen more limbs reach in from the top.
    const limbs = []; // { pts: [x, y, ...], hang: [...], w0, w1, phase }
    const twigs = []; // { pts, hang, phase }
    const blooms = []; // x, y, size, colour, glyph, hang, phase: seven numbers each
    const canopy = layer(TREE, 2);
    const at = (f) => fx(f) + SHIFT, down = (y) => Y0 + y;
    function addLimb(pts, w0, w1, red, thick, phase) {
      const hang = [], n = pts.length / 2;
      let total = 0;
      for (let k = 1; k < n; k++) total += Math.hypot(pts[2 * k] - pts[2 * k - 2], pts[2 * k + 1] - pts[2 * k - 1]);
      for (let k = 0, s = 0; k < n; k++) { if (k) s += Math.hypot(pts[2 * k] - pts[2 * k - 2], pts[2 * k + 1] - pts[2 * k - 1]); hang.push(s / total); }
      limbs.push({ pts, hang, w0, w1, phase });
      if (!thick) return;
      for (let k = 1; k < n; k++) { // twigs along it, hanging down or reaching up, every so often
        const x0 = pts[2 * k - 2], y0 = pts[2 * k - 1], x1 = pts[2 * k], y1 = pts[2 * k + 1], len = Math.hypot(x1 - x0, y1 - y0);
        for (let u = R(0, 0.02); u < len; u += R(0.012, 0.028) / thick) {
          const x = lerp(x0, x1, u / len), y = lerp(y0, y1, u / len), h0 = lerp(hang[k - 1], hang[k], u / len);
          const drop = rand() < 0.75, a = drop ? R(1.1, 2.0) : R(-2.2, -0.9), l = R(0.012, drop ? 0.06 : 0.035);
          const tw = [x, y], th = [h0];
          let tx = x, ty = y, ang = a;
          for (let j = 0, m = 2 + (rand() < 0.5 ? 1 : 0); j < m; j++) {
            ang += R(-0.4, 0.4); tx += (Math.cos(ang) * l) / m; ty += (Math.sin(ang) * l) / m;
            tw.push(tx, ty); th.push(h0 + 0.4 * ((j + 1) / m));
          }
          twigs.push({ pts: tw, hang: th, phase: phase + R(-0.5, 0.5) });
          const flowers = Math.round(R(1, 4) * thick);
          for (let j = 0; j < flowers; j++) { // along the twig and at its tip
            const v = j === 0 ? 1 : R(0.3, 1), seg = Math.min(tw.length / 2 - 2, Math.floor(v * (tw.length / 2 - 1))), w = v * (tw.length / 2 - 1) - seg;
            bloom(lerp(tw[2 * seg], tw[2 * seg + 2], w) + R(-0.003, 0.003), lerp(tw[2 * seg + 1], tw[2 * seg + 3], w) + R(-0.003, 0.003), red, h0 + 0.4 * v, phase);
          }
        }
        if (thick > 1) for (let u = R(0, 0.02); u < len; u += R(0.01, 0.02) / thick) { // and on the limb itself
          bloom(lerp(x0, x1, u / len) + R(-0.006, 0.006), lerp(y0, y1, u / len) + R(-0.008, 0.004), red, lerp(hang[k - 1], hang[k], u / len), phase);
        }
      }
    }
    function bloom(x, y, red, hang, phase) {
      const isRed = rand() < red, size = R(0.0035, 0.0065), tn = isRed ? R(0.28, 0.45) : R(0.3, 0.5), g = rand();
      blooms.push(x, y, size, shade(isRed ? RED : PINK, tn), g < 0.35 ? FULL : g < 0.75 ? STAR : g < 0.9 ? RING : DOT, hang, phase);
      blot(canopy, BUDS, x, y, size * R(1.6, 3.2), isRed && rand() < 0.4 ? RED : PINK, isRed ? 0.5 : R(0.5, 0.62), R(0.45, 0.75));
    }
    for (const [w0, w1, red, thick, ...pts] of LIMBS) addLimb(pts.map((v, i) => (i & 1 ? down(v) : at(v))), w0, w1, red, thick, R(0, 6.28));
    for (let k = 0; k < 70; k++) { // the dense blossom in the top right corner
      const f = R(0.48, 1.04), y = R(-0.02, 0.2) + (f < 0.62 ? 0.04 : 0);
      blot(canopy, BUDS, at(f), down(y), R(0.012, 0.035), PINK, R(0.5, 0.66), R(0.3, 0.55));
      if (rand() < 0.5) bloom(at(f), down(y), f > 0.7 && y > 0.1 ? 0.7 : 0.35, 0.5, 0);
    }
    for (let x = at(-0.05) - R(0.12, 0.2); x > XL - 0.05; x -= R(0.3, 0.45)) { // more limbs reaching in from the top on a wide screen
      const way = rand() < 0.6 ? -1 : 1, pts = [x, Y0 - 0.02];
      let px = x, py = Y0 - 0.02, ang = Math.PI / 2 + way * R(0.7, 1.05); // down and to one side, drooping as it goes
      while (py < Y0 + R(0.12, 0.2) && pts.length < 24) { ang -= way * R(-0.05, 0.16); px += Math.cos(ang) * 0.03; py += Math.sin(ang) * 0.03; pts.push(px, py); }
      addLimb(pts, 0.009, 0.002, R(0.3, 0.6), 1, R(0, 6.28));
    }

    // ---- The petals that fall the whole time, down and a little left, each
    // at its own distance; those that reach the lake lie on it. Each comes
    // down from the branches above the frame, so none appears in mid air: by
    // the first frame some are part way down and a few already lie on the
    // water.
    const petals = [];
    for (let k = 0, n = Math.round((XR - XL + 0.6) * 16); k < n; k++) {
      const D = R(0.24, 0.8), red = rand() < 0.4, tn = red ? R(0.32, 0.45) : R(0.3, 0.45);
      const y = Y0 - R(0.01, 0.05), fall = R(0.025, 0.04) / D, water = HZ + EYE / D; // water: its y at the petal's distance, as first seen
      petals.push({ D, t0: R(-3 - (water - y) / fall, LENGTH), x: R(XL, XR + 0.25), y, fall, left: R(0.008, 0.016) / D,
        amp: R(0.002, 0.006), freq: R(1.5, 3), phase: R(0, 6.28), ramp: red ? RED : PINK, tn, colour: shade(red ? RED : PINK, tn - 0.2), water,
        front: D > TREE ? PETALK : D > NEAR ? TREEK : NEARK }); // what can hide it: anything nearer than this
    }

    // ---- Each frame.
    const colT = new Int32Array(cols);
    // Lay a painted layer over the frame, grown k times about the pagoda.
    function lay(L, id, k) {
      if (L.j1 < 0) return;
      const ss = L.ss, tw = L.tw;
      for (let c = 0; c < cols; c++) colT[c] = Math.floor((Xc[c] / k - XL) * FW * ss);
      for (let h = 0; h < H2; h++) {
        const j = Math.floor((PY + (Yh[h] - PY) / k - Y0) * FH * ss);
        if (j < L.j0 || j > L.j1) continue;
        for (let c = 0, p = h * cols, q = j * tw; c < cols; c++, p++) {
          const i = colT[c];
          if (i < 0 || i >= tw) continue;
          const a = L.cover[q + i];
          if (a === 0 || a < cut[p] * 255) continue;
          mat[p] = L.mat[q + i]; tone[p] = L.tone[q + i] / 255; who[p] = id; fog[p] = 0;
          glyph[(h >> 1) * cols + c] = 32;
        }
      }
    }
    // A layer's lines of ink, at its size.
    function pens(L, k) {
      const I = L.inks;
      for (let n = 0; n < I.length; n += 2) {
        const pts = I[n];
        for (let j = 2; j < pts.length; j += 2) {
          const c0 = colOf(pts[j - 2] * k), r0 = rowOf(PY + (pts[j - 1] - PY) * k) / 2, c1 = colOf(pts[j] * k), r1 = rowOf(PY + (pts[j + 1] - PY) * k) / 2;
          if (Math.max(c0, c1) < 0 || Math.min(c0, c1) >= cols || Math.max(r0, r1) < 0 || Math.min(r0, r1) >= rows) continue;
          line(c0, r0, c1, r1, I[n + 1], joins(j, pts.length));
        }
      }
    }
    // A layer's own characters, where they still show.
    function place(L, id, k) {
      const M = L.marks;
      for (let n = 0; n < M.length; n += 5) {
        const c = Math.floor(colOf(M[n] * k)), h = Math.floor(rowOf(PY + (M[n + 1] - PY) * k)), r = h >> 1;
        if (c < 0 || c >= cols || h < 0 || r >= rows) continue;
        const i = r * cols + c, a = 2 * r * cols + c, b = a + cols;
        if (glyph[i] !== 32 || (M[n + 4] ? who[a] !== id || who[b] !== id : who[a] > id || who[b] > id)) continue;
        const f = Math.max(fog[a], fog[b]);
        if (f > 0.55) continue;
        glyph[i] = M[n + 2]; ink[i] = M[n + 3] === WHITE ? WHITE : paler(M[n + 3], f); bold[i] = 0;
      }
    }

    // The sun, rising slowly: a soft disc of pink-red, mottled as watercolour
    // is, paler toward its foot where the haze lies over it.
    function sun(s) {
      const [sx, , r] = DISC, sy = sunY(s);
      const hA = Math.max(0, Math.floor(rowOf(sy - r)) - 1), hB = Math.min(H2 - 1, Math.ceil(rowOf(sy + r)) + 1);
      const cA = Math.max(0, Math.floor(colOf(sx - r)) - 1), cB = Math.min(cols - 1, Math.ceil(colOf(sx + r)) + 1);
      for (let h = hA; h <= hB; h++) for (let c = cA, p = h * cols + cA; c <= cB; c++, p++) {
        const dx = (Xc[c] - sx) / r, dy = (Yh[h] - sy) / r, d = Math.hypot(dx, dy);
        if (d >= 1 || smooth(1, 0.93, d) < cut[p]) continue;
        mat[p] = SUN; tone[p] = 0.27 + 0.2 * (fbm(dx * 3.2 + 40, dy * 3.2 + 40) - 0.5) + 0.06 * (fbm(dx * 9 + 9, dy * 9) - 0.5) + 0.2 * smooth(0.1, 1, dy);
        who[p] = SUNK;
      }
    }

    // The pagoda, drawn afresh at its size each frame. Which part of it is at
    // (u, v), in its unit across from its middle and down from PY.
    const SPIRE = 1, ROOF = 2, EAVE = 3, WALL = 4, RAIL = 5, POSTS = 6;
    const PART_TONE = [0, 0.1, 0.16, 0.04, 0.56, 0.3, 0.62];
    const roofAt = (a, [apex, eave, flick]) => { // a roof's top and the underside of its eave, a share a of the way out to its tip
      const up = flick * smooth(0.7, 1, a) ** 2;
      return [apex + (eave - 0.24 - apex) * (1 - (1 - a) ** 1.7) - up, eave - 0.1 * smooth(0.5, 1, a) - up];
    };
    function pagodaPart(u, v) {
      const a = Math.abs(u);
      if (v < MAST) return v > TIP && a < 0.05 + 0.05 * (v - TIP) * (Math.cos((v - TIP) * 37) > 0.5) ? SPIRE : 0; // a thin mast ringed toward its foot
      for (let n = 0; n < 3; n++) {
        const roof = ROOFS[n], [, eave, , half, wall] = roof;
        if (a < half) { const [top, low] = roofAt(a / half, roof); if (v >= top && v <= low) return v > low - 0.09 ? EAVE : ROOF; }
        const below = n < 2 ? ROOFS[n + 1][0] : FOOT;
        if (v > eave - 0.15 && v < below + 0.1 && a < wall) {
          if (n === 2) return POSTS; // its foot, posts standing in the mist
          const s = (v - eave) / (below - eave);
          return s > 0.5 && s < 0.72 ? RAIL : WALL;
        }
      }
      return 0;
    }
    function pagoda(k) {
      const w = PW * k, hP = rowOf(PY), wc = w * FW, wh = w * FH;
      const hA = Math.max(0, Math.floor(hP + TIP * wh)), hB = Math.min(H2 - 1, Math.ceil(hP + FOOT * wh));
      const cA = Math.max(0, Math.floor(PC - 1.2 * wc)), cB = Math.min(cols - 1, Math.ceil(PC + 1.2 * wc));
      for (let h = hA; h <= hB; h++) for (let c = cA, p = h * cols + cA; c <= cB; c++, p++) {
        const u = (c + 0.5 - PC) / wc, v = (h + 0.5 - hP) / wh, part = pagodaPart(u, v);
        if (!part) continue;
        mat[p] = ROCK; tone[p] = PART_TONE[part] + (part === ROOF ? 0.08 * smooth(0.3, -1, u) : 0); who[p] = PAGODAK; fog[p] = 0;
      }
      // the spire's column, which the ending keeps to the last, and its mast in ink
      const sc = Math.floor(PC);
      for (let h = Math.max(0, Math.floor(hP + TIP * wh)); h < Math.min(H2, hP + MAST * wh); h++) who[h * cols + sc] = SPIREK;
      line(PC, (hP + TIP * wh) / 2, PC, (hP + MAST * wh) / 2, INKED);
      if (wc < 2.5) return;
      // each eave in ink, tip to tip, turning up at the ends
      for (const roof of ROOFS) {
        let pc = 0, pr = 0;
        for (let j = 0; j <= 16; j++) {
          const a = j / 8 - 1, [, low] = roofAt(Math.abs(a), roof), c = PC + a * roof[3] * wc, r = (hP + (low + 0.05) * wh) / 2;
          if (j) line(pc, pr, c, r, INKED);
          pc = c; pr = r;
        }
      }
      // and the posts of its two storeys
      for (let n = 0; n < 2; n++) {
        const [, eave, , , wall] = ROOFS[n], below = ROOFS[n + 1][0];
        for (let r = Math.ceil((hP + (eave + 0.1) * wh) / 2 - 0.5); (2 * r + 1 - hP) / wh < below - 0.04; r++) {
          for (let j = -2; j <= 2; j++) INKED(Math.floor(PC + j * 0.45 * wall * wc), r, BAR);
        }
      }
    }

    // A band of mist at the distance of a layer grown k times, its thickest
    // at y = mid, drifting left: tone toward the paper, and characters under
    // it paler or gone.
    function mist(k, t, top, mid, bottom, most, grain, salt) {
      const hA = Math.max(0, Math.floor(rowOf(PY + (top - PY) * k))), hB = Math.min(H2 - 1, Math.ceil(rowOf(PY + (bottom - PY) * k)));
      for (let h = hA; h <= hB; h++) {
        const y = PY + (Yh[h] - PY) / k, rise = y < mid ? smooth(top, mid, y) : smooth(bottom, mid, y);
        if (rise <= 0) continue;
        for (let c = 0, p = h * cols; c < cols; c++, p++) {
          const x = Xc[c] / k + DRIFT * t, n = cloud(x / grain + salt, y / (grain * 0.45)) - 0.5, n2 = cloud(x / (grain * 3) + 7, y / grain + salt) - 0.5;
          const m = Math.min(1, most * rise * (0.62 + 1.3 * n + 0.5 * n2));
          if (m <= 0) continue;
          tone[p] += (1 - tone[p]) * m; fog[p] = Math.max(fog[p], m);
          const i = (h >> 1) * cols + c;
          if (h & 1 && glyph[i] !== 32) { if (m > 0.6) glyph[i] = 32; else if (ink[i] < WHITE) ink[i] = paler(ink[i], m); }
        }
      }
    }

    // The lake: each half cell below the far shore is the point on the water
    // its ray reaches. It is pale as the sky it mirrors; the far shore stands
    // in it upside down, paler and broken into level streaks that waver; its
    // ripple lines move gently and come on as the camera does; and the sun is
    // a faint pink smear in it.
    function lake(s, t, camZ) {
      const E = 1 + (camZ * (HZ - PY)) / EYE, hS = rowOf(PY + (SHORE - PY) * (BANK / (BANK - camZ)));
      const sy = 2 * HZ - sunY(s), [sx, , sr] = DISC;
      for (let h = Math.max(0, Math.ceil(hS - 0.5)); h < H2; h++) {
        const y = Yh[h], d = (EYE * E) / (y - HZ), Z = camZ + d, below = (h + 0.5 - hS) / FH, gap = (EYE * E) / ((y - HZ) ** 2 * FH);
        const fine = smooth(0.03, 0.012, gap), hm = Math.floor(2 * hS - h - 0.5), fade = Math.exp(-below / 0.09);
        const wob = Math.round(1.3 * Math.sin(h * 0.9 + t * 2.3) * Math.min(1, below * 25));
        for (let c = 0, p = h * cols; c < cols; c++, p++) {
          const X = Xc[c] * d, lines = Z * 45 + 0.6 * cloud(X * 3 + 0.02 * t, Z * 4) + 0.08 * Math.sin(t * 0.8 + X * 40);
          const ripple = (1 - smooth(0.04, 0.12, Math.abs((lines % 1) - 0.5))) * fine;
          let m = SKY, tn = 0.95 - 0.05 * smooth(0.8, 1.1, y) - 0.04 * ripple;
          if (hm >= 0 && hm < H2) {
            const q = hm * cols + Math.min(cols - 1, Math.max(0, c + wob)), w = who[q];
            if (w >= FARK && w < LAKEK) {
              const show = 0.8 * fade * smooth(0.35, 0.6, cloud(X * 1.2 + 0.02 * t, Z * 30));
              if (show > 0.04) { m = mat[q]; tn = lerp(1, lerp(tone[q], 1, 0.45), show); }
            }
          }
          const ex = (Xc[c] - sx) / (sr * 0.9), ey = (y - sy) / (sr * 0.6), e = ex * ex + ey * ey;
          if (e < 1 && m === SKY && cloud(Xc[c] / 0.05, y / 0.004) > 0.35 + 0.3 * e) { m = SUN; tn = 0.72 + 0.12 * e; }
          else if (ripple * 0.7 > cut[p] && m === SKY) { m = MOUNT; tn = 0.82; }
          mat[p] = m; tone[p] = tn; who[p] = LAKEK; fog[p] = 0;
        }
        if (h & 1 && fine > 0.5) for (let c = 0, i = (h >> 1) * cols; c < cols; c++, i++) { // marks on the ripples
          const X = Xc[c] * d + 0.004 * t, lane = Math.floor(Z * 45), slot = Math.floor(X / 0.01);
          if (glyph[i] === 32 && X / 0.01 - slot < 0.4 && hash(slot, lane) < 0.09) { glyph[i] = hash(lane, slot) < 0.5 ? WAVE : DASH; ink[i] = shade(MOUNT, 0.62); bold[i] = 0; }
        }
      }
    }

    // The blossom tree, at distance TREE, swaying a little: its wash, its
    // limbs (painted where they are thick, drawn in ink where thin), twigs
    // and blossom.
    const BARK = putter(shade(ROCK, 0.06), 1), GRAIN = putter(shade(ROCK, 0.3), 0);
    const swayX = (hang, phase, t) => SWAY * hang * Math.sin(t * 1.3 + phase), swayY = (hang, phase, t) => 0.35 * SWAY * hang * Math.sin(t * 1.1 + phase + 1);
    function tree(t, k) {
      lay(canopy, TREEK, k);
      const sx = (x) => colOf(x * k), sy = (y) => rowOf(PY + (y - PY) * k);
      for (const { pts, hang, phase } of twigs) for (let j = 2; j < pts.length; j += 2) {
        const a = j / 2 - 1, b = j / 2;
        line(sx(pts[j - 2] + swayX(hang[a], phase, t)), sy(pts[j - 1] + swayY(hang[a], phase, t)) / 2,
          sx(pts[j] + swayX(hang[b], phase, t)), sy(pts[j + 1] + swayY(hang[b], phase, t)) / 2, BARK, joins(j, pts.length));
      }
      for (const { pts, hang, w0, w1, phase } of limbs) for (let j = 2; j < pts.length; j += 2) {
        const a = j / 2 - 1, b = j / 2, wa = lerp(w0, w1, hang[a]) * k, wb = lerp(w0, w1, hang[b]) * k;
        const ax = (pts[j - 2] + swayX(hang[a], phase, t)) * k, ay = PY + (pts[j - 1] + swayY(hang[a], phase, t) - PY) * k;
        const bx = (pts[j] + swayX(hang[b], phase, t)) * k, by = PY + (pts[j + 1] + swayY(hang[b], phase, t) - PY) * k;
        if (Math.max(wa, wb) * FW < 1.6) { line(colOf(ax), rowOf(ay) / 2, colOf(bx), rowOf(by) / 2, BARK, joins(j, pts.length)); continue; }
        const reach = Math.max(wa, wb) / 2, dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1e-12;
        const cA = Math.max(0, Math.floor(colOf(Math.min(ax, bx) - reach))), cB = Math.min(cols - 1, Math.ceil(colOf(Math.max(ax, bx) + reach)));
        const hA = Math.max(0, Math.floor(rowOf(Math.min(ay, by) - reach))), hB = Math.min(H2 - 1, Math.ceil(rowOf(Math.max(ay, by) + reach)));
        for (let h = hA; h <= hB; h++) for (let c = cA; c <= cB; c++) {
          const px = Xc[c] - ax, py = Yh[h] - ay, q = clamp01((px * dx + py * dy) / len2), ox = px - dx * q, oy = py - dy * q, r = lerp(wa, wb, q) / 2;
          if (ox * ox + oy * oy > r * r) continue;
          const p = h * cols + c;
          mat[p] = ROCK; tone[p] = 0.1 - (0.08 * (ox + oy)) / r + 0.06 * (hash(c, h + 5) - 0.5); who[p] = TREEK; fog[p] = 0;
          glyph[(h >> 1) * cols + c] = 32;
        }
        if (Math.max(wa, wb) * FW > 3) line(colOf(ax), rowOf(ay) / 2, colOf(bx), rowOf(by) / 2, GRAIN);
      }
      for (let n = 0; n < blooms.length; n += 7) {
        const hang = blooms[n + 5], phase = blooms[n + 6], size = blooms[n + 2] * k;
        const x = (blooms[n] + swayX(hang, phase, t)) * k, y = PY + (blooms[n + 1] + swayY(hang, phase, t) - PY) * k;
        const c = Math.floor(colOf(x)), h = Math.floor(rowOf(y));
        if (c < -20 || c >= cols + 20 || h < -40 || h >= H2 + 40) continue;
        if (size * FW > 1.2) { // near enough to be a round of colour
          const rc = size * FW, rh = size * FH;
          for (let hh = Math.max(0, Math.floor(h - rh)); hh <= Math.min(H2 - 1, h + rh); hh++) for (let cc = Math.max(0, Math.floor(c - rc)); cc <= Math.min(cols - 1, c + rc); cc++) {
            const d = Math.hypot((cc + 0.5 - colOf(x)) / rc, (hh + 0.5 - rowOf(y)) / rh);
            if (d > 1) continue;
            const p = hh * cols + cc;
            mat[p] = blooms[n + 3] - ((blooms[n + 3] - 1) % NL); tone[p] = ((blooms[n + 3] - 1) % NL) / (NL - 1) + 0.12 * d; who[p] = TREEK; fog[p] = 0;
            glyph[(hh >> 1) * cols + cc] = 32;
          }
        }
        if (c < 0 || c >= cols || h < 0 || h >= H2) continue;
        const i = (h >> 1) * cols + c;
        glyph[i] = size * FW > 1.2 ? FULL : blooms[n + 4]; ink[i] = size * FW > 1.2 ? paler(blooms[n + 3], -0.4) : blooms[n + 3]; bold[i] = blooms[n + 4] === FULL ? 1 : 0;
      }
    }

    // Grasses and twigs on the rocks in front.
    const BLADE = putter(shade(ROCK, 0.04), 1), BUD = shade(RED, 0.3);
    function grasses(t, k) {
      for (let n = 0; n < BLADES.length; n += 6) {
        const bend = 0.002 * Math.sin(t * 1.2 + n);
        for (let j = 0; j < 4; j += 2) {
          const x0 = BLADES[n + j] + (j ? bend * 0.5 : 0), x1 = BLADES[n + j + 2] + bend * (j ? 1 : 0.5);
          line(colOf(x0 * k), rowOf(PY + (BLADES[n + j + 1] - PY) * k) / 2, colOf(x1 * k), rowOf(PY + (BLADES[n + j + 3] - PY) * k) / 2, BLADE, j ? 1 : 2);
        }
      }
      for (let n = 0; n < BUDDED.length; n += 2) {
        const c = Math.floor(colOf(BUDDED[n] * k)), r = Math.floor(rowOf(PY + (BUDDED[n + 1] - PY) * k) / 2);
        if (c >= 0 && c < cols && r >= 0 && r < rows) { const i = r * cols + c; glyph[i] = n % 6 ? DOT : HIGH; ink[i] = BUD; bold[i] = 0; }
      }
    }

    // The falling petals, and the rings round those lying on the lake; each
    // hidden by anything nearer than itself, and gone once the camera has
    // passed it.
    function petalsAt(t, camZ) {
      const E = 1 + (camZ * (HZ - PY)) / EYE;
      for (const P of petals) {
        const age = t - P.t0;
        if (age < 0 || P.D - camZ < 0.03) continue;
        const k = P.D / (P.D - camZ), landed = P.y + P.fall * age >= P.water, when = landed ? (P.water - P.y) / P.fall : age;
        const x0 = P.x - P.left * when + P.amp * Math.sin(P.freq * when + P.phase) * (landed ? 0 : 1), y0 = landed ? P.water : P.y + P.fall * age;
        const x = x0 * k, y = PY + (y0 - PY) * k, c = Math.floor(colOf(x)), h = Math.floor(rowOf(y)), r = h >> 1;
        if (c < 0 || c >= cols || h < 0 || h >= H2) continue;
        const i = r * cols + c, size = ((0.004 * k) / P.D) * FW;
        if (who[2 * r * cols + c] > P.front || who[(2 * r + 1) * cols + c] > P.front) continue;
        if (size > 1) { mat[h * cols + c] = P.ramp; tone[h * cols + c] = P.tn; } // near enough to be a fleck of colour
        if (!landed) { glyph[i] = size > 2.2 ? STAR : PETAL[Math.floor(age * 3 + P.phase) & 3]; ink[i] = P.colour; bold[i] = 1; continue; }
        glyph[i] = COMMA; ink[i] = P.colour; bold[i] = 1; // lying on the water
        const ring = age - when;
        if (ring > 1.8) continue;
        const rx = (0.003 + 0.016 * (1 - Math.exp(-ring * 1.6))) * (k / P.D) * FW; // the ring's half width in columns
        if (rx < 1.2) continue;
        const colour = shade(MOUNT, 0.5 + 0.35 * (ring / 1.8));
        for (const way of [-1, 1]) {
          const cc = Math.round(colOf(x) + way * rx), e = r * cols + cc;
          if (cc >= 0 && cc < cols && glyph[e] === 32 && who[2 * r * cols + cc] === LAKEK) { glyph[e] = way < 0 ? OPEN : SHUT; ink[e] = colour; bold[e] = 0; }
        }
        const ry = rx * ((EYE * E) / (P.D - camZ)) * (FH / FW); // how many half rows its front and back are from it
        if (ry >= 1) for (let cc = Math.ceil(colOf(x) - rx * 0.7); cc <= colOf(x) + rx * 0.7; cc++) for (const way of [-1, 1]) {
          const hh = Math.round(rowOf(y) + way * ry * Math.sqrt(1 - ((cc + 0.5 - colOf(x)) / rx) ** 2));
          if (cc >= 0 && cc < cols && hh >= 0 && hh < H2 && who[hh * cols + cc] === LAKEK) { mat[hh * cols + cc] = MOUNT; tone[hh * cols + cc] = 0.6 + 0.3 * (ring / 1.8); }
        }
      }
    }

    // The ending. The mist on the far shore rises and spreads, up the hills
    // and down over the lake, until the whole picture is a wash the colour of
    // the paper, the pagoda last; then that wash thins away to the page in
    // drifting cloudy holes, from the right across to the left as the mist
    // goes, the pagoda's place last of all and the spire, which stands out of
    // the mist to the end, after it.
    const yEnd = PY + ((SHORE - PY) * BANK) / (BANK - PUSH); // the far shore, once the camera has stopped
    const WISP = putter(WHITE, 0);
    function ending(s, t) {
      const u = (s - T.rise) / (T.end - T.rise), last = smooth(0.88, 0.99, u);
      for (let h = 0, p = 0; h < H2; h++) {
        const y = Yh[h], dy = y < yEnd ? (yEnd - y) / (yEnd - Y0 + 0.01) : (y - yEnd) / (Y0 + H2 / FH - yEnd + 0.01);
        for (let c = 0; c < cols; c++, p++) {
          kept[p] = 9;
          if (who[p] === SPIREK) { if (last > order[p]) kept[p] = 0; continue; }
          const x = Xc[c], drift = x + DRIFT * 8 * t, n = cloud(drift / 0.1, y / 0.04) - 0.5, big = cloud(drift / 0.3 + 5, y / 0.15 + 9) - 0.5;
          const centre = Math.exp(-((x / 0.12) ** 2) - ((y - PY) / 0.14) ** 2);
          const comes = Math.max(0, 0.45 * dy + 0.18 * centre + 0.1 * n); // when the mist gets here
          const thins = Math.max(comes + 0.16, 0.34 + 0.28 * (XR - x) / (XR - XL) + 0.22 * big + 0.14 * centre); // and when the wash here thins
          const cover = smooth(comes, comes + 0.16, u), gone = smooth(thins, thins + 0.1, u);
          tone[p] += (1 - tone[p]) * cover;
          if (gone > 0) kept[p] = Math.min(8, Math.floor((1 - gone) * 8 + order[p]));
          if (h & 1) {
            const i = (h >> 1) * cols + c;
            if (cover > 0.5) glyph[i] = 32;
            if (cover > 0.2 && cover < 0.6 && hash(Math.floor((drift * FW) / 3), h) < 0.12) WISP(c, h >> 1, WAVE); // wisps along its front
          }
        }
      }
    }

    return {
      cols, rows, palette: INK, glyph, ink, bold, paint,
      render(t) { // t: seconds since the animation started
        glyph.fill(32); ink.fill(0); bold.fill(0); paint.fill(0);
        if (t >= LENGTH) return this; // over: nothing is left on the page
        const s = t * SPEED, camZ = PUSH * glide(s); // s: where that is in the story; camZ: how far the camera has come
        const grow = (D) => D / (D - camZ), kNear = camZ < NEAR * 0.9 ? grow(NEAR) : 0;
        mat.fill(SKY); tone.set(skyTone); who.fill(SKYK); fog.fill(0);
        sun(s);
        lay(far, FARK, grow(FAR));
        lay(cliff, CLIFFK, grow(CLIFF));
        pagoda(grow(HILL));
        lay(hill, HILLK, grow(HILL));
        mist(grow(HILL), t, 0.47, 0.53, 0.6, 0.85, 0.1, 3);
        lay(bank, BANKK, grow(BANK));
        pens(bank, grow(BANK));
        lake(s, t, camZ);
        mist(grow(BANK), t, 0.6, 0.675, 0.74, 1, 0.08, 11);
        tree(t, grow(TREE));
        if (kNear) { lay(near, NEARK, kNear); pens(near, kNear); grasses(t, kNear); place(near, NEARK, kNear); }
        place(bank, BANKK, grow(BANK));
        place(hill, HILLK, grow(HILL));
        place(cliff, CLIFFK, grow(CLIFF));
        for (let n = 0; n < specks.length; n += 3) {
          const i = specks[n], a = 2 * Math.floor(i / cols) * cols + (i % cols);
          if (glyph[i] === 32 && who[a] === SKYK && who[a + cols] === SKYK) { glyph[i] = specks[n + 1]; ink[i] = specks[n + 2]; bold[i] = 0; }
        }
        petalsAt(t, camZ);
        const end = s > T.rise;
        if (end) ending(s, t);
        for (let p = 0; p < N; p++) {
          if (end && kept[p] < 9) { paint[p] = kept[p] ? WASH + kept[p] : 0; continue; }
          const l = Math.floor(tone[p] * (NL - 1) + thr[p]);
          paint[p] = mat[p] + (l < 0 ? 0 : l > NL - 1 ? NL - 1 : l);
        }
        if (end) for (let i = 0; i < cells; i++) { const a = 2 * Math.floor(i / cols) * cols + (i % cols); if (!paint[a] && !paint[a + cols]) glyph[i] = 32; }
        return this;
      },
    };
  }

  // Play it on the stage. Resolves when it has finished. `seed` changes the
  // details, not the layout: the washes, the mountains and rocks beyond the
  // painting's edges, the twigs and blossom, the petals; `freezeAt` holds one
  // moment (in seconds) on screen instead of playing. Reduced motion holds
  // the opening view, the painting as it was painted.
  const film = { length: LENGTH, still: 0.5, grid: [150, 60], createScene };
  return { play: (options) => AsciiStage.play(film, options), createScene };
})();
