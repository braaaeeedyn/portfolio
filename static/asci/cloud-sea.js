/*
 * Sea of clouds: an ASCII loading screen.
 *
 *   <script src="ascii-stage.js"></script>
 *   <script src="cloud-sea.js"></script>
 *   <script>CloudSea.play().then(showThePage);</script>
 *
 * A Chinese ink-wash landscape in black, white and grey, with one red: the
 * ribbons in the hair of a figure in long black robes, who stands with their
 * back to us on a dark rocky slope at the lower left, looking right. At the
 * right edge, half out of the picture, a figure in white stands on a ledge of
 * rock. Between them granite pillars crowned with pines rise out of a sea of
 * cloud under a dark storm sky, and a flock of birds crosses it to the left.
 * A pine reaches in from the left edge, bare branches from the top right. The
 * wind blows from the right. The sea of cloud rises: it swallows the small
 * far peaks, then the two great pillars from the bottom up, their pines last,
 * and stops just below the figures' feet, so that the two face each other
 * across the white. Then it surges on over the slope, the ledge and the
 * figures, the ribbons last, fills the frame and thins away to show the page.
 * Five seconds (LENGTH, below).
 *
 * The camera never moves. The whole of it is a pure function of time:
 * createScene().render(t) fills a grid of characters and the colours behind
 * them, and the stage (ascii-stage.js) paints that grid on a canvas.
 */
const CloudSea = (() => {
  'use strict';
  const { code, clamp01, lerp, smooth, mulberry32, hash, noise } = AsciiStage;

  // The story's timeline, in the seconds of the user's description.
  const T = {
    rise: 2.0,   // the sea of cloud begins to rise
    far: 4.6,    // the small, distant peaks have gone under
    tops: 8.0,   // the two great pillars have gone, their pines last: the middle is white
    rest: 8.8,   // the cloud has stopped, just below the figures' feet
    over: 10.0,  // the clip ends, and the cloud surges up over the slope, the ledge and the figures
    flood: 10.7, // it fills the frame
    end: 11.4,   // and has thinned away to show the page
  };
  // It is played faster than that. LENGTH is how many seconds the whole of it
  // takes on screen, and SPEED how many times faster than the story that is.
  const LENGTH = 5, SPEED = T.end / LENGTH;

  // Ambient motion runs on screen time, so it stays as gentle as the
  // description has it however fast the story is told.
  const WIND = 0.8;    // waves a second running out along the ribbons, the hair and the hems
  const ROLL = 0.035;  // painting heights a second the nearest billows roll to the left; farther ones go slower
  const STORM = 0.012; // and the storm clouds overhead
  const BEAT = 0.42;   // seconds to a bird's wingbeat

  // Colours: neutral greys from ink to paper, the ribbons' red, and the white
  // of the cloud thinning away at the end. `swatch` adds a run of colours to
  // INK and gives the index of the first.
  const INK = ['#000000'];
  const swatch = (...colours) => INK.push(...colours) - colours.length;
  const NL = 48; // steps of grey
  const GREY = swatch(...Array.from({ length: NL }, (_, i) => '#' + Math.round(14 + ((250 - 14) * i) / (NL - 1)).toString(16).padStart(2, '0').repeat(3)));
  const RED = swatch('#5a0d14', '#8a1520', '#b61f2b', '#d9373d'); // the ribbons, from a fold in shadow to the lit side
  const THIN = swatch(...Array.from({ length: 8 }, (_, i) => `rgba(248,248,248,${((i + 1) / 9).toFixed(3)})`)) - 1; // the cloud thinning: THIN + 1, the faintest, to THIN + 8
  const tone = (L) => GREY + (L <= 0 ? 0 : L >= 1 ? NL - 1 : Math.round(L * (NL - 1)));
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  const [BAR, SLASH, BACK, LOW, DASH, HIGH, TICK, COMMA, DOT, WAVE, STAR, COLON, BANG] = code("|/\\_-'`,.~*:!");

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

  // The painting, in its own heights: 16 by 9, x across from its left edge, y
  // down from its top. The figure in black and the pillar behind them keep to
  // the left of the screen; the ledge, the figure in white and the other
  // pillar to the right; the middle, between XL and XR, narrows or widens with
  // the screen. A screen narrower than NARROW of the painting's heights (a
  // phone) shows it smaller, with more storm sky above and more slope below.
  const WP = 16 / 9, XL = 0.36, XR = 1.64, NARROW = 1;
  const HORIZON = 0.175; // where the sea of cloud meets the sky at the last, above every summit

  // Peaks, as the painting has them: [across, top, half width to the left and
  // to the right]. Far off, pale ranges fading into the distance; nearer, the
  // small spires between the pillars.
  const FAR_PEAKS = [[0.1, 0.212, 0.12, 0.13], [0.72, 0.3, 0.09, 0.1], [1.0, 0.33, 0.07, 0.08], [1.1, 0.29, 0.07, 0.1], [1.27, 0.262, 0.06, 0.08], [1.4, 0.218, 0.09, 0.1], [1.53, 0.265, 0.06, 0.07], [1.7, 0.29, 0.07, 0.1]];
  const MID_PEAKS = [[0.69, 0.478, 0.04, 0.045], [0.8, 0.445, 0.05, 0.05], [0.915, 0.468, 0.04, 0.045], [1.0, 0.508, 0.04, 0.05]];
  // The two great pillars and the lesser ones on their shoulders, the farther
  // first: [across, top, half width left, right, which figure's side it keeps to].
  const PILLARS = [[0.27, 0.305, 0.075, 0.065, 0], [0.655, 0.41, 0.05, 0.065, 0], [0.495, 0.212, 0.135, 0.14, 0], [1.2, 0.56, 0.06, 0.065, 1], [1.43, 0.31, 0.17, 0.22, 1]];

  // The sea of cloud is rows of billows, each lit on top and grey beneath,
  // each row nearer and so bigger than the one behind it, from where they
  // would vanish, VANISH painting heights down, just above the horizon. Each
  // row is GROW (in log) bigger than the one behind; a billow stands TALL of
  // its row and is BROAD times as wide as its row is high.
  const VANISH = 0.11, GROW = 0.2, TALL = 0.65, BROAD = 1.8;
  // It rises in four depths: in front of the far ranges, of the small spires,
  // of the pillars, and a front bank that comes up last, from below. Each
  // depth's crest is a rolling edge of its own billows: how fast they roll
  // (of ROLL), how wide and how high they are, and how soft the edge is
  // (painting heights).
  const SEA = [
    { roll: 0.35, wide: 0.03, amp: 0.016, soft: 0.01 },
    { roll: 0.55, wide: 0.042, amp: 0.024, soft: 0.014 },
    { roll: 0.8, wide: 0.06, amp: 0.036, soft: 0.018 },
    { roll: 1, wide: 0.08, amp: 0.04, soft: 0.022 },
  ];
  // How high each stands at story time s (painting heights from the top), at
  // its own pace: the far cloud fills to the horizon by T.far; the cloud round
  // the small spires has them under by then; the cloud before the pillars
  // creeps up their feet, then climbs them, and is at the horizon by T.tops.
  const START = [0.42, 0.575, 0.77];
  const LEVEL = [
    (s) => START[0] - (START[0] - HORIZON) * smooth(T.rise, T.far, s),
    (s) => START[1] - (START[1] - HORIZON) * smooth(T.rise, 6, s) ** 1.3,
    (s) => START[2] - (START[2] - HORIZON) * smooth(T.rise, T.tops, s) ** 2,
  ];
  // The front bank comes up from below and settles by T.rest, its crest just
  // below the feet of both figures: how far it has come, 0 to 1.
  const FRONT = (s) => { const q = clamp01((s - 2.6) / (T.rest - 2.6)); return 1 - (1 - q) ** 2; };

  // The flock, as the painting has it: [across, down, wingspan] in painting heights.
  const FLOCK = [
    [0.38, 0.159, 0.017], [0.471, 0.165, 0.019], [0.582, 0.173, 0.01], [0.673, 0.129, 0.027], [0.671, 0.197, 0.024], [0.797, 0.236, 0.019],
    [0.707, 0.287, 0.012], [0.757, 0.275, 0.01], [0.745, 0.33, 0.008], [0.819, 0.31, 0.019], [0.863, 0.28, 0.008], [0.903, 0.278, 0.015],
    [0.897, 0.296, 0.014], [0.942, 0.251, 0.015], [0.96, 0.284, 0.008], [0.967, 0.193, 0.015], [1.02, 0.209, 0.017], [1.065, 0.208, 0.019],
    [1.064, 0.231, 0.012], [1.093, 0.249, 0.012], [1.169, 0.191, 0.01], [1.214, 0.157, 0.017], [1.193, 0.268, 0.009], [1.272, 0.181, 0.019],
    [1.298, 0.133, 0.008], [1.341, 0.127, 0.01], [0.55, 0.215, 0.012], [1.13, 0.148, 0.011], [0.63, 0.25, 0.009], [0.86, 0.205, 0.011],
  ];
  const WINGS = code('v~^~'); // a wingbeat: up, level, down, level

  // The top of the dark slope, from the left edge: [across, down].
  const SLOPE = [[0, 0.745], [0.12, 0.764], [0.25, 0.787], [0.4, 0.8], [0.6, 0.815], [0.8, 0.836], [1.0, 0.864], [1.2, 0.902], [1.38, 0.955], [1.52, 1.02], [1.75, 1.12]];
  // The ledge, as how far in from the right edge its face is, going down: [down, in].
  const LEDGE = [[0.716, 0.15], [0.74, 0.155], [0.765, 0.15], [0.79, 0.134], [0.83, 0.118], [0.9, 0.1], [0.96, 0.075], [1.03, 0.04], [1.08, 0]];
  // The pine at the left edge: flat layers of needles [left end, right end,
  // top, thickness], and the crooked limbs that carry them [points...]. The
  // lower layers stop short of the ribbons, which stream across open cloud.
  const PADS = [[-0.03, 0.1, 0.245, 0.04], [-0.03, 0.14, 0.312, 0.045], [-0.02, 0.24, 0.395, 0.06], [0.02, 0.16, 0.55, 0.05], [0.06, 0.165, 0.615, 0.035]];
  const LIMBS = [
    [[-0.01, 0.52], [0.02, 0.47], [0.06, 0.445], [0.12, 0.43], [0.19, 0.435]],
    [[0.02, 0.47], [0.035, 0.4], [0.05, 0.35], [0.09, 0.335]],
    [[0.035, 0.4], [0.03, 0.31], [0.05, 0.27]],
    [[0.085, 0.77], [0.1, 0.69], [0.11, 0.62], [0.12, 0.585], [0.14, 0.578]],
    [[0.11, 0.62], [0.13, 0.63], [0.15, 0.634]],
  ];
  // Shrubs on the slope: [across, foot, size, in blossom].
  const SHRUBS = [[0.07, 0.995, 0.13, 1], [0.52, 0.8, 0.07, 0], [1.07, 0.89, 0.09, 0]];
  // The two red ribbons, tied at the back of the head: how far left they
  // stream, how far they hang, how many waves run along them, and a phase
  // (in the figure's heights).
  const RIBBONS = [[0.27, 0.46, 1.3, 0], [0.33, 0.3, 1.7, 2.1]];

  function createScene({ cols, rows, aspect = 2, seed = 1 }) {
    const rand = mulberry32(seed), R = (a, b) => a + (b - a) * rand();
    const H2 = rows * 2, N = cols * H2;     // the picture is cols x H2 half cells, each roughly square
    const U = rows * aspect, Wu = cols / U; // columns to one screen height, and the screen's width in screen heights
    const k = Math.min(1, Wu / NARROW), PH = k * H2, PU = k * U, Wv = cols / PU; // half rows and columns to a painting height; the screen's width in them
    const top0 = (H2 - PH) * 0.42; // the half row of the painting's top: on a narrow screen there is more sky above it and more slope below
    const colX = (x) => x * PU, rowY = (y) => top0 + y * PH;
    const X = (c) => (c + 0.5) / PU, Y = (h) => (h + 0.5 - top0) / PH;
    const m = (Wv - XL - (WP - XR)) / (XR - XL), mc = Math.min(1, m), slim = mc ** 0.7; // how far the middle is stretched; the pillars only close up
    const onRight = (x) => Wv - WP + x;
    const across = (x) => (x < XL ? x : x > XR ? onRight(x) : XL + (x - XL) * m);
    const besideLeft = (x) => XL + (x - XL) * mc, besideRight = (x) => onRight(XR) - (XR - x) * mc;
    const glyph = new Uint8Array(cols * rows), ink = new Uint8Array(cols * rows), bold = new Uint8Array(cols * rows), paint = new Uint8Array(N);
    const inside = (c, h) => c >= 0 && c < cols && h >= 0 && h < H2;

    // The grain of the brush: a fixed threshold for each half cell, for
    // dithering between the greys; and a plain ordered one for the cloud
    // thinning away at the end, which should be soft rather than grainy.
    const thr = new Float32Array(N), order = new Float32Array(N);
    for (let h = 0, p = 0; h < H2; h++) for (let c = 0; c < cols; c++, p++) {
      order[p] = (BAYER[(h & 3) * 4 + (c & 3)] + 0.5) / 16;
      thr[p] = (order[p] + 0.7 * hash(c, h + 7)) % 1;
    }

    // The storm sky: dark overhead, paling toward the far cloud, with heavier
    // masses that drift to the left.
    const o = R(0, 99), TS = cols + Math.ceil(STORM * LENGTH * PU) + 2;
    const skyTex = new Float32Array(TS * H2), skyBase = new Float32Array(H2), skyAmp = new Float32Array(H2);
    for (let h = 0; h < H2; h++) {
      const y = Y(h);
      skyBase[h] = 0.3 + 0.2 * smooth(-0.05, 0.15, y) + 0.32 * smooth(0.1, 0.34, y);
      skyAmp[h] = 0.34 * (1 - 0.6 * smooth(0.14, 0.36, y));
      for (let i = 0; i < TS; i++) {
        const x = (i + 0.5) / PU;
        skyTex[h * TS + i] = 0.55 * noise(o + x * 3.4, y * 10) + 0.3 * noise(o + x * 9, 7 + y * 24) + 0.15 * noise(x * 22, 3 + y * 52) - 0.5;
      }
    }

    // The peaks. Each depth has a table of lightness for every half cell (-1
    // where it has none), drawn farthest first so the nearer hide the farther.
    const farL = new Float32Array(N).fill(-1), midL = new Float32Array(N).fill(-1), nearL = new Float32Array(N).fill(-1);
    const peakId = new Uint16Array(N), pineAt = new Uint8Array(N);
    let ids = 0;
    // Fill a shape standing from `top` down past the foot of the painting:
    // edge(y, d, side) is its outline on that side (-1 left, 1 right) at depth d
    // below the top, and shade(x, y, d, side, edge, p) its lightness, with side
    // from -1 at its left edge to 1 at its right, and edge the columns in from
    // the outline. Shade may mark the half cell p as pine.
    function stand(table, top, edge, shade) {
      const id = ++ids;
      for (let h = Math.max(0, Math.ceil(rowY(top) - 0.5)); h < H2; h++) {
        const y = Y(h), d = y - top;
        if (y > 1.35) break;
        const l = edge(y, d, -1), r = edge(y, d, 1), mid = (l + r) / 2, half = Math.max(1e-4, (r - l) / 2);
        for (let c = Math.max(0, Math.ceil(colX(l) - 0.5)), e = Math.min(cols - 1, Math.floor(colX(r) - 0.5)); c <= e; c++) {
          const x = X(c), p = h * cols + c;
          peakId[p] = id; pineAt[p] = 0;
          table[p] = shade(x, y, d, (x - mid) / half, Math.min(x - l, r - x) * PU, p);
        }
      }
    }
    // A pale far peak: a pointed summit with ridged flanks, lit from the left.
    function ridge(table, x0, top, wl, wr) {
      const sd = R(0, 99);
      stand(table, top, (y, d, side) => x0 + side * (side < 0 ? wl : wr) * Math.min(1, d / 0.2) ** 0.8 * (1 + 0.3 * (noise(y * 25, sd + side * 5) - 0.5)),
        (x, y, d, side) => 0.69 - 0.05 * side + 0.07 * (noise(x * 34 + d * 30, y * 6 + sd) - 0.5) + 0.17 * smooth(0.03, 0.22, d));
    }
    // A clump of pine needles: a flat, ragged ellipse, centred at column cx and half row cy.
    const clump = (table, id, cx, cy, rx, ry, L) => {
      for (let h = Math.floor(cy - ry); h <= Math.ceil(cy + ry); h++) for (let c = Math.floor(cx - rx); c <= Math.ceil(cx + rx); c++) {
        const dx = (c + 0.5 - cx) / rx, dy = (h + 0.5 - cy) / ry;
        if (inside(c, h) && dx * dx + dy * dy <= 1 + 0.5 * (hash(c, h + 17) - 0.5)) { const p = h * cols + c; table[p] = L + 0.06 * (hash(c, h + 9) - 0.5); peakId[p] = id; pineAt[p] = 1; }
      }
    };
    // A pine whose foot is at (x, y), `size` tall: a crooked trunk leaning out
    // to one side, carrying flat clumps of needles in a wide, flat crown.
    function pine(table, id, x, y, size, lean, L) {
      const sx = size * PU, sy = size * PH, c0 = colX(x), h0 = rowY(y), tc = c0 + lean * sx * 0.6, th = h0 - sy * 0.7;
      for (let h = Math.floor(th); h < h0; h++) clump(table, id, lerp(c0, tc, (h0 - h) / (h0 - th)), h + 0.5, 0.5, 0.5, L);
      for (let j = 0, n = sx > 4 ? 4 : 3; j < n; j++) clump(table, id, tc + R(-0.55, 0.55) * sx, th + R(-0.2, 0.25) * sy, Math.max(0.8, R(0.28, 0.5) * sx), Math.max(0.55, R(0.1, 0.18) * sy), L);
    }
    // One column of granite: a rounded crown dark with pines, then a face of
    // broad slabs lit on their left, streaked by the brush and split by a few
    // dark crevices, pines clinging here and there; it pales toward its foot,
    // where the mist wraps it.
    function slab(table, x0, top, w, L0, pineL, summit) {
      const sd = R(0, 99), crown = Math.min(0.06, w * R(0.45, 0.7));
      const band = (x, y) => noise(x * 11 + 0.5 * noise(y * 4, sd), y * 1.1 + sd);
      stand(table, top, (y, d, side) => x0 + side * w * Math.min(1, d / (w * 1.3)) ** 0.6 * (1 + 0.35 * d) * (1 + 0.24 * (noise(y * 26, sd + side * 5) - 0.5)),
        (x, y, d, side, edge, p) => {
          if (d < crown * (0.7 + 0.6 * noise(x * 60, sd)) || noise(x * 40 + sd, y * 40) > 0.88) { pineAt[p] = 1; return pineL + 0.1 * (noise(x * 90, y * 50 + sd) - 0.5); }
          const b = band(x, y), lit = (band(x + 0.01, y) - band(x - 0.01, y)) * 1.2, crack = Math.abs(noise(x * 8 + sd, y * 0.9) - 0.5);
          const L = L0 + 0.22 * (b - 0.5) + lit - 0.06 * side + 0.06 * (noise(x * 70, y * 4 + sd) - 0.5) - 0.26 * (1 - smooth(0.012, 0.035, crack)) + 0.26 * smooth(0.12, 0.5, y - summit);
          return edge < 1 ? L - 0.1 : L;
        });
    }
    // A pillar: a tall column, and lower ones stepping down its shoulders
    // across [x0 - wl, x0 + wr], crowned with clumps of pine that make its top
    // ragged, and pines leaning out from its sides, `size` tall.
    function tower(table, x0, top, wl, wr, L0, pineL, crownR, flanks, size) {
      const wm = (wl + wr) * R(0.24, 0.3), xm = x0 + R(-0.3, 0.3) * wm, parts = [[xm, top, wm]];
      for (const side of [-1, 1]) {
        const reach = side < 0 ? wl : wr, end = x0 + side * reach;
        for (let edge = xm + side * wm * 0.7, t = top; side * (end - edge) > 0.012; ) {
          const w = Math.min(side * (end - edge), reach * R(0.22, 0.4));
          t += R(0.03, 0.08);
          parts.push([edge + side * w * 0.75, t, w]);
          edge += side * w * 1.5;
        }
      }
      parts.sort((a, b) => b[1] - a[1]); // the lowest first, so the taller stand in front of them
      const first = ids + 1;
      for (const [x, t, w] of parts) slab(table, x, t, w, L0, pineL, top);
      const last = ids, mine = (p) => peakId[p] >= first && peakId[p] <= last;
      for (const [x, t, w] of parts) for (let q = -0.85; q < 0.85; q += R(0.18, 0.4)) {
        const c = Math.floor(colX(x + q * w));
        if (c < 0 || c >= cols) continue;
        for (let h = Math.max(0, Math.floor(rowY(t) - 2)); h < H2; h++) if (mine(h * cols + c)) {
          const r = crownR * R(0.8, 1.3);
          clump(table, peakId[h * cols + c], colX(x + q * w), h + 0.5 - R(0, 1) * crownR, r * 1.5, r, pineL);
          break;
        }
      }
      for (let j = 0; j < flanks; j++) {
        const y = top + R(0.04, 0.3), h = Math.round(rowY(y)), side = rand() < 0.5 ? -1 : 1;
        if (h < 0 || h >= H2) continue;
        let c = Math.round(colX(xm) - 0.5);
        while (c >= 0 && c < cols && mine(h * cols + c)) c += side;
        if (c - side >= 0 && c - side < cols && mine(h * cols + c - side)) pine(table, peakId[h * cols + c - side], X(c - side), y, size * R(0.7, 1.1), side * R(0.7, 1.2), pineL);
      }
    }
    // Far ranges and small spires fill the middle, and on a wide screen more
    // of them fill the room the painting does not have.
    const far = FAR_PEAKS.map(([x, top, wl, wr]) => [across(x), top, wl * slim, wr * slim]);
    const mid = MID_PEAKS.map(([x, top, wl, wr]) => [across(x), top, wl * slim, wr * slim]);
    for (let x = XL + R(0, 0.2); m > 1 && x < onRight(XR); x += R(0.12, 0.24)) {
      if (!far.some((f) => Math.abs(f[0] - x) < 0.12)) far.push([x, R(0.24, 0.34), R(0.06, 0.1), R(0.06, 0.1)]);
      if (rand() < 0.5 && !mid.some((f) => Math.abs(f[0] - x) < 0.1)) mid.push([x + R(-0.05, 0.05), R(0.44, 0.52), R(0.035, 0.05), R(0.035, 0.05)]);
    }
    for (const [x, top, wl, wr] of far) { // each with a lower shoulder either side
      ridge(farL, x - wl * R(0.45, 0.7), top + R(0.03, 0.07), wl * 0.6, wl * 0.5);
      ridge(farL, x + wr * R(0.45, 0.7), top + R(0.02, 0.06), wr * 0.5, wr * 0.6);
      ridge(farL, x, top, wl, wr);
    }
    for (const [x, top, wl, wr] of mid) tower(midL, x, top, wl, wr, 0.5, 0.12, 0.007 * PH, 0, 0);
    for (let p = 0; p < N; p++) if (midL[p] >= 0) midL[p] = 0.4 + 0.5 * midL[p]; // farther off, the air pales them
    for (const [x, top, wl, wr, side] of PILLARS) tower(nearL, side ? besideRight(x) : besideLeft(x), top, wl * slim, wr * slim, 0.5, 0.12, 0.011 * PH, 3, 0.06);
    // Strokes on the peaks, where a whole cell is one peak: cracks down the
    // granite, and the needles of the pines.
    const markG = new Uint8Array(cols * rows), markL = new Float32Array(cols * rows), markW = new Uint8Array(cols * rows);
    for (let r = 0, i = 0; r < rows; r++) for (let c = 0; c < cols; c++, i++) {
      const p = r * 2 * cols + c, q = p + cols, n = hash(c, r + 101), g = hash(r, c + 202);
      for (const [table, layer, chance] of [[nearL, 3, 0.1], [midL, 2, 0.05], [farL, 1, 0]]) {
        if (table[p] < 0 && table[q] < 0) continue; // nothing at this depth: look farther
        if (table[p] < 0 || table[q] < 0 || peakId[p] !== peakId[q]) break; // an edge: leave it clean
        const L = (table[p] + table[q]) / 2;
        if (pineAt[p] && pineAt[q]) { if (n < 0.4) { markG[i] = g < 0.6 ? DASH : WAVE; markL[i] = L + 0.16; markW[i] = layer; } }
        else if (n < chance) { markG[i] = g < 0.6 ? BAR : g < 0.8 ? BANG : COLON; markL[i] = L - 0.17; markW[i] = layer; }
        break;
      }
    }

    // Billows side by side, each a rounded cap: how high each column stands
    // (0 to 1). `wrap` joins the ends, for a profile sampled round and round.
    const billows = (wide, n, wrap) => {
      const out = new Float32Array(n);
      for (let x = R(-wide, 0); x < n + (wrap ? -wide : wide); ) {
        const w = wide * R(0.6, 1.4), top = R(0.5, 1);
        for (let i = Math.ceil(x - w); i <= Math.floor(x + w); i++) {
          const j = wrap ? (i + n) % n : i, q = (i - x) / w;
          if (j >= 0 && j < n) out[j] = Math.max(out[j], top * Math.sqrt(Math.max(0, 1 - q * q)));
        }
        x += w * R(1.1, 1.6);
      }
      return out;
    };
    // The crest of each depth, and of the surge at the end, rolled to the left
    // by up to shiftMax columns.
    const shiftMax = Math.ceil(ROLL * LENGTH * PU) + 2, span = cols + shiftMax + 2;
    const crestShape = SEA.map((sea) => billows(sea.wide * PU, span)), floodShape = billows(0.11 * PU, span);
    // The rows of billows: where each half row is among them (in rows, from the
    // first big enough to see), and how grey a billow's underside is there,
    // fading toward the horizon, where the rows are too thin to show. Each row
    // samples one long profile of billows, the nearer rows stretching it wider;
    // so that all roll left at the speed their size gives them, every row
    // moves along the profile at the same pace, OMEGA.
    const vanishH = rowY(VANISH), B0 = 0.02 * PH, grow = Math.exp(GROW) - 1;
    const rowAt = new Float32Array(H2), under = new Float32Array(H2);
    for (let h = 0; h < H2; h++) {
      const rel = h + 0.5 - vanishH;
      rowAt[h] = rel > B0 ? Math.log(rel / B0) / GROW : -1;
      under[h] = 0.16 * smooth(1.5, 6, rel * grow);
    }
    const NR = Math.max(0, Math.ceil(rowAt[H2 - 1])) + 3, PM = 4095, profile = billows(8, PM + 1, true);
    const rowS = Array.from({ length: NR }, () => new Float32Array(cols));
    const rowStep = Float32Array.from({ length: NR }, (_, n) => 8 / Math.max(0.5, (BROAD * B0 * Math.exp(n * GROW) * grow * PU) / PH));
    const OMEGA = (8 * ROLL) / (BROAD * 0.15); // a row 0.15 painting heights high rolls ROLL painting heights a second
    // Inside, soft puffs lit from above, that roll left with the nearer billows.
    const TC = cols + shiftMax + 2, g = Math.max(1, Math.round(0.012 * PH));
    const puff = new Float32Array(TC * (H2 + 2 * g)), cloudTex = new Float32Array(TC * H2);
    for (let h = 0; h < H2 + 2 * g; h++) for (let i = 0; i < TC; i++) {
      const x = (i + 0.5) / PU, y = (h - g + 0.5) / PH;
      puff[h * TC + i] = 0.5 * noise(o + 30 + x * 6, y * 13) + 0.3 * noise(o + x * 15, 9 + y * 30) + 0.2 * noise(o + x * 34, 3 + y * 66);
    }
    for (let h = 0; h < H2; h++) for (let i = 0; i < TC; i++) {
      const lit = (puff[(h + 2 * g) * TC + i] - puff[h * TC + i]) * 3;
      cloudTex[h * TC + i] = Math.max(-0.6, Math.min(0.6, lit)) + (puff[(h + g) * TC + i] - 0.5) * 0.4;
    }
    // Where each depth's crest starts out, varying across the screen, and where
    // the front bank ends: just below the feet, from the figure in black to the
    // figure in white.
    const lilt = SEA.map((_, j) => Float32Array.from({ length: cols }, (_, c) => 0.07 * (noise(X(c) * 2.6 + j * 13, seed + j) - 0.5)));
    const ledgeX = Wv - LEDGE[0][1];
    const settle = Float32Array.from({ length: cols }, (_, c) => lerp(0.866, 0.772, clamp01((X(c) - 0.3) / (ledgeX - 0.3))));

    // The foreground, which never moves and stands in front of the cloud: the
    // slope, the rock at the left edge, the pine, the ledge, the shrubs. A
    // lightness for every half cell it covers (-1 where it has none), and its
    // own strokes.
    const fgL = new Float32Array(N).fill(-1), fgMark = new Uint8Array(cols * rows), fgInk = new Float32Array(cols * rows);
    const sd0 = R(0, 99), slopeTop = new Float32Array(cols);
    // Flat stones: the nearest and second nearest points of a jittered grid,
    // in the ground's own coordinates, where the stones grow larger nearer us.
    const stone = (gx, gy) => {
      const ix = Math.floor(gx), iy = Math.floor(gy);
      let d1 = 9, d2 = 9, id = 0, cy = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const px = ix + dx + 0.1 + 0.8 * hash(ix + dx, iy + dy + 500), py = iy + dy + 0.1 + 0.8 * hash(iy + dy + 900, ix + dx), dd = (gx - px) ** 2 + (gy - py) ** 2;
        if (dd < d1) { d2 = d1; d1 = dd; id = hash(ix + dx, iy + dy); cy = py; } else if (dd < d2) d2 = dd;
      }
      return [Math.sqrt(d2) - Math.sqrt(d1), id, gy - cy];
    };
    for (let c = 0; c < cols; c++) {
      const x = X(c), xr = x < XL ? x : XL + (x - XL) / m; // where that is in the painting
      let i = 1;
      while (i < SLOPE.length - 1 && xr > SLOPE[i][0]) i++;
      const [a, ya] = SLOPE[i - 1], [b, yb] = SLOPE[i];
      slopeTop[c] = ya + ((yb - ya) * (xr - a)) / (b - a) + 0.012 * (noise(x * 22, sd0) - 0.5) + 0.006 * (noise(x * 64, sd0 + 2) - 0.5);
      for (let h = Math.max(0, Math.ceil(rowY(slopeTop[c]) - 0.5)); h < H2; h++) {
        const y = Y(h), d = y - slopeTop[c], [gap, id, up] = stone(x / (0.05 * (1 + 2 * d)), Math.log(1 + 9 * d) * 5);
        let L = 0.16 + 0.2 * id - 0.08 * smooth(0, 0.35, d) + (up < -0.15 ? 0.09 : 0);
        if (gap < 0.12) L = 0.05;
        if (d * PH < 1.6) L = Math.max(L, 0.36 + 0.1 * id); // the lit crest of the slope
        fgL[h * cols + c] = L;
      }
    }
    for (let h = 0; h < H2; h++) { // the rock at the left edge, behind the lower pine
      const y = Y(h);
      if (y < 0.47) continue;
      const w = (0.045 + 0.035 * smooth(0.5, 0.76, y) + 0.012 * (noise(y * 30, sd0 + 5) - 0.5)) * Math.sqrt(clamp01((y - 0.47) / 0.025));
      for (let c = 0; c < Math.min(cols, colX(w)); c++) {
        const p = h * cols + c;
        if (fgL[p] >= 0) continue;
        const x = X(c);
        fgL[p] = 0.16 + 0.16 * (noise(x * 60, y * 5 + sd0) - 0.5) + (w - x < 0.008 ? 0.12 : 0) + 0.1 * smooth(0.6, 0.47, y);
        if ((h & 1) && hash(c, h + 31) < 0.12) { fgMark[(h >> 1) * cols + c] = hash(h, c) < 0.6 ? BAR : BANG; fgInk[(h >> 1) * cols + c] = 0.34; }
      }
    }
    for (let h = Math.max(0, Math.floor(rowY(LEDGE[0][0]))); h < H2; h++) { // the ledge, jutting in from the right edge over the cloud
      const y = Y(h);
      if (y > LEDGE[LEDGE.length - 1][0]) break;
      if (y < LEDGE[0][0]) continue;
      let i = 1;
      while (i < LEDGE.length - 1 && y > LEDGE[i][0]) i++;
      const [a, xa] = LEDGE[i - 1], [b, xb] = LEDGE[i], x0 = Wv - lerp(xa, xb, clamp01((y - a) / (b - a))) + 0.008 * (noise(y * 40, sd0 + 9) - 0.5);
      for (let c = Math.max(0, Math.ceil(colX(x0) - 0.5)); c < cols; c++) {
        const x = X(c), lip = y - LEDGE[0][0] - 0.004 * (noise(x * 50, sd0) - 0.5);
        if (lip < 0) continue;
        let L = 0.2 + 0.18 * (noise(x * 70 + sd0, y * 7) - 0.5) - 0.06 * smooth(0.75, 1, y);
        if (lip * PH < 1.4) L = 0.44; // the lit top
        else if (x - x0 < 0.006) L -= 0.08;
        fgL[h * cols + c] = L;
        if ((h & 1) && lip * PH > 3 && hash(c, h + 41) < 0.14) { fgMark[(h >> 1) * cols + c] = hash(h, c) < 0.5 ? BAR : COLON; fgInk[(h >> 1) * cols + c] = L + 0.16; }
      }
    }
    // The pine at the left edge: crooked limbs, then the layers of needles on
    // them, each a row of flat clumps with ragged edges, dark, their tops
    // catching the light and needles hanging below.
    const dab = (cx, cy, rad, L) => {
      for (let h = Math.floor(cy - rad); h <= Math.ceil(cy + rad); h++) for (let c = Math.floor(cx - rad); c <= Math.ceil(cx + rad); c++) {
        if (inside(c, h) && (c + 0.5 - cx) ** 2 + (h + 0.5 - cy) ** 2 <= rad * rad) fgL[h * cols + c] = L;
      }
    };
    for (const limb of LIMBS) for (let j = 1; j < limb.length; j++) {
      const [x0, y0] = limb[j - 1], [x1, y1] = limb[j], steps = Math.ceil(Math.hypot((x1 - x0) * PU, (y1 - y0) * PH) * 2) + 1;
      for (let s = 0; s <= steps; s++) dab(colX(lerp(x0, x1, s / steps)), rowY(lerp(y0, y1, s / steps)), Math.max(0.55, 0.011 * PH * (1 - j * 0.15)), 0.1);
    }
    const needles = new Uint8Array(N);
    for (const [x0, x1, top, thick] of PADS) {
      const n = Math.max(3, Math.round((x1 - x0) / 0.022)), step = (x1 - x0) / n;
      for (let j = 0; j < n; j++) {
        const q = (j + 0.5) / n, env = Math.sin(Math.PI * q) ** 0.6, cx = lerp(x0, x1, q) + R(-0.3, 0.3) * step;
        const rx = step * R(0.75, 1.25), ry = thick * (0.28 + 0.4 * env) * R(0.75, 1.2), cy = top + thick * (0.55 + R(-0.12, 0.12)) - ry * 0.25;
        for (let h = Math.floor(rowY(cy - ry)); h <= rowY(cy + ry); h++) for (let c = Math.floor(colX(cx - rx)); c <= colX(cx + rx); c++) {
          if (!inside(c, h)) continue;
          const dx = (X(c) - cx) / rx, dy = (Y(h) - cy) / ry, e = dx * dx + (dy > 0 ? dy * 1.7 : dy) ** 2; // flat beneath
          if (e > 1 + 0.5 * (hash(c, h + 5) - 0.5)) continue;
          const p = h * cols + c;
          fgL[p] = dy < -0.5 && hash(c, h + 23) < 0.5 ? 0.22 : 0.05 + 0.06 * hash(c, h + 29);
          needles[p] = 1;
          if ((h & 1) && dy < -0.3 && hash(c, h + 61) < 0.35) { fgMark[(h >> 1) * cols + c] = WAVE; fgInk[(h >> 1) * cols + c] = 0.36; }
        }
      }
    }
    for (let r = 0, i = 0; r < rows; r++) for (let c = 0; c < cols; c++, i++) { // needles hanging below the layers
      const p = r * 2 * cols + c;
      if (needles[p] && fgL[p + cols] < 0 && hash(c, r + 71) < 0.5) { fgMark[i] = hash(r, c + 3) < 0.5 ? BAR : COMMA; fgInk[i] = 0.08; }
    }
    // The shrubs: twigs fanning up from the foot, bare or tipped with pale blossom.
    for (const [x, foot, size, blossom] of SHRUBS) {
      const c0 = colX(across(x)), base = Math.max(foot, slopeTop[Math.max(0, Math.min(cols - 1, Math.floor(c0)))] + 0.012), r0 = rowY(base) / 2;
      for (let n = 0; n < 11; n++) {
        const a = -Math.PI / 2 + R(-1, 1), len = size * R(0.45, 1), c1 = c0 + Math.cos(a) * len * PU, r1 = r0 + (Math.sin(a) * len * PH) / 2;
        line(c0 + R(-0.5, 0.5), r0, c1, r1, (c, r, gl) => { if (c >= 0 && c < cols && r >= 0 && r < rows) { fgMark[r * cols + c] = gl; fgInk[r * cols + c] = blossom ? 0.5 : 0.58; } });
        const tc = Math.floor(c1), tr = Math.floor(r1);
        if (blossom && tc >= 0 && tc < cols && tr >= 0 && tr < rows) {
          fgMark[tr * cols + tc] = rand() < 0.6 ? STAR : HIGH; fgInk[tr * cols + tc] = 0.93;
          dab(c1, r1 * 2 + 0.5, Math.max(0.6, size * 0.08 * PH), 0.82);
        }
      }
    }

    // The bare branches reaching in from the top right corner: limbs that fork
    // into crooked twigs, [x0, y0, x1, y1, how far out each end is (0 to 1),
    // limb, depth]. They hang from the top of the screen, whatever its shape.
    const twigs = [], hang = -top0 / PH;
    const branch = (x, y, a, len, depth, limb, out) => {
      const x1 = x + Math.cos(a) * len, y1 = y + Math.sin(a) * len, o1 = Math.min(1, out + len / 0.35);
      twigs.push([x, y, x1, y1, out, o1, limb, depth]);
      if (depth >= 5) return;
      branch(x1, y1, a + R(-0.6, 0.6), len * R(0.65, 0.85), depth + 1, limb, o1);
      if (rand() < 0.85) branch(x1, y1, a + (rand() < 0.5 ? 1 : -1) * R(0.6, 1.3), len * R(0.45, 0.7), depth + 1, limb, o1);
    };
    branch(Wv + 0.01, hang + 0.14, Math.PI - 0.25, 0.12, 0, 0, 0);
    branch(Wv - 0.08, hang - 0.01, Math.PI - 1.3, 0.09, 1, 1, 0.1);
    branch(Wv + 0.01, hang + 0.25, Math.PI + 0.15, 0.08, 1, 2, 0.1);

    // The flock: each bird crosses to the left at its own steady pace, all of
    // them gone by story 5.0 s.
    const lastX = Math.max(...FLOCK.map(([x]) => across(x)));
    const flock = FLOCK.map(([x, y, wing]) => {
      const at = across(x), pace = Math.max(((lastX + 0.05) / 4.9) * R(0.82, 1), (at + wing + 0.03) / 4.95);
      return { x: at, y, pace, rise: R(-0.008, 0.005), phase: R(0, 1) };
    });

    // The two figures, in their own units: u across, v down from the top of
    // the head to the soles, in their heights. The figure in black stands on
    // the slope, facing right, the wind blowing their hem, hair and ribbons out
    // to the left. The figure in white stands on the ledge, facing left, cut
    // by the edge of the screen, drawn a little larger than the painting has
    // them so that a few columns of them still show.
    const HAIR = 1, ROBE = 2, FACE = 3;
    const bH = 0.3, bsx = bH * PU, bsy = bH * PH, bcx = colX(0.3), btop = rowY(0.535);
    function blackAt(u, v, ph) {
      if (((u - 0.004) / 0.048) ** 2 + ((v - 0.068) / 0.07) ** 2 < 1) return HAIR; // the head, from behind
      if (v > 0.09 && v < 0.5) { // the hair down the back, its ends lifting to the left
        const q = (v - 0.09) / 0.41, centre = -0.008 - 0.05 * q * q - 0.012 * q * Math.sin(ph - v * 12);
        if (Math.abs(u - centre) < (0.042 + 0.01 * smooth(0, 0.25, q)) * (1 - 0.75 * smooth(0.55, 1, q))) return HAIR;
      }
      if (v > 0.13 && v < 0.995 + 0.008 * Math.sin(ph * 1.2 + u * 25)) { // the robe, to the ground, its hem streaming left
        const sh = smooth(0.12, 0.22, v);
        const right = 0.04 + 0.035 * sh + 0.085 * Math.sqrt(Math.max(0, 1 - ((v - 0.44) / 0.17) ** 2)) + 0.03 * smooth(0.65, 1, v); // shoulder, the hanging sleeve, the skirt
        const left = -0.035 - 0.03 * sh - 0.3 * smooth(0.25, 1, v) ** 1.4 - 0.035 * Math.sin(ph - v * 8) * smooth(0.4, 1, v);
        if (u > left && u < right) return ROBE;
      }
      return 0;
    }
    const wH = 0.23, wsx = wH * PU, wsy = wH * PH, wcx = colX(Wv - 0.034), wtop = rowY(LEDGE[0][0] - wH);
    function whiteAt(u, v, ph) {
      if (((u - 0.012) / 0.026) ** 2 + ((v - 0.012) / 0.024) ** 2 < 1) return HAIR; // the hair tied up on top
      if (((u + 0.002) / 0.046) ** 2 + ((v - 0.078) / 0.062) ** 2 < 1) return u < -0.02 && v > 0.055 ? FACE : HAIR; // the head in profile, facing left
      if (v > 0.1 && v < 0.6 && u > 0.006 - 0.025 * smooth(0.3, 0.6, v) * (1 + 0.5 * Math.sin(ph - v * 9)) && u < 0.07) return HAIR; // hair down the back
      if (v > 0.13 && v < 1) { // the robe, flaring to the hem, its sleeve and hem blown forward to the left; its back is past the edge of the screen
        const left = -0.06 - 0.075 * smooth(0.13, 1, v) - 0.035 * Math.sqrt(Math.max(0, 1 - ((v - 0.47) / 0.14) ** 2)) - 0.025 * Math.sin(ph - v * 9) * smooth(0.45, 1, v);
        if (u > left && u < 0.15 + 0.05 * v) return ROBE;
      }
      return 0;
    }

    // Each frame: the lightness of every half cell, what it is, and a colour
    // that overrides it (the ribbons' red); the crest of each depth of cloud
    // in every column, in half rows; the crest of the surge at the end; how far
    // the cloud thinning away at the end has taken each half cell.
    const lum = new Float32Array(N), what = new Uint8Array(N), fix = new Uint8Array(N), alpha = new Float32Array(N);
    const crest = SEA.map(() => new Float32Array(cols)), flood = new Float32Array(cols);
    // What a half cell is: a peak at each depth is followed by the cloud in front of it.
    const SKY = 1, FAR = 2, FAR_C = 3, FRONT_C = 9, FG = 10, FIGURE = 11, RIBBON = 12, FLOOD = 13;
    const peaks = [farL, midL, nearL];
    const soft = SEA.map((sea) => Math.max(1, sea.soft * PH)), cap = SEA.map((sea) => sea.amp * PH * 1.2 + 1);
    const mistBand = [0.05 * PH, 0.06 * PH, 0.09 * PH], shadow = 0.03 * PH + 1, haze = 0.07 * PH;

    function drawFigures(t) {
      const ph = t * WIND * 2 * Math.PI;
      const mark = (L, heavy) => (c, r, gl) => {
        if (c < 0 || c >= cols || r < 0 || r >= rows) return;
        const i = r * cols + c;
        glyph[i] = gl; ink[i] = tone(L); bold[i] = heavy;
      };
      // The figure in black: hair, the long robe with its hanging sleeve.
      for (let h = Math.max(0, Math.floor(btop) - 1), h1 = Math.min(H2 - 1, Math.ceil(btop + bsy) + 1); h <= h1; h++) {
        const v = (h + 0.5 - btop) / bsy;
        for (let c = Math.max(0, Math.floor(bcx - 0.42 * bsx)), c1 = Math.min(cols - 1, Math.ceil(bcx + 0.2 * bsx)); c <= c1; c++) {
          const u = (c + 0.5 - bcx) / bsx, kind = blackAt(u, v, ph);
          if (!kind) continue;
          const p = h * cols + c;
          lum[p] = kind === HAIR ? 0.03 + (hash(c, h + 3) < 0.1 ? 0.06 : 0) : 0.08 + 0.05 * Math.sin(u * 70 + 3 * Math.sin(v * 6 - ph * 0.4)) * smooth(0.5, 0.9, v);
          what[p] = FIGURE; fix[p] = 0;
          glyph[(h >> 1) * cols + c] = 32;
        }
      }
      const at = (u, v) => [bcx + u * bsx, (btop + v * bsy) / 2];
      const trace = (pts, put) => { for (let j = 1; j < pts.length; j++) { const [a, b] = at(...pts[j - 1]), [c2, d2] = at(...pts[j]); line(a, b, c2, d2, put); } };
      if (bsy > 14) {
        trace([[0.075, 0.28], [0.15, 0.36], [0.16, 0.5], [0.1, 0.6]], mark(0.42, 0)); // the edge of the sleeve
        trace([[0.06, 0.62], [0.075, 0.8], [0.09, 0.98]], mark(0.3, 0)); // the front of the robe
        trace([[-0.06, 0.3], [-0.13, 0.6], [-0.22 - 0.02 * Math.sin(ph - 5), 0.95]], mark(0.2, 0)); // a fold blown back
      }
      if (bsy > 22) for (let j = 0; j < 4; j++) { // loose strands at the end of the hair
        const pts = [];
        for (let n = 0; n <= 4; n++) { const q = n / 4; pts.push([-0.03 - (0.06 * j) / 3 - 0.12 * q, 0.38 + 0.03 * j + 0.08 * q + 0.03 * q * Math.sin(ph * 1.2 - q * 5 + j)]); }
        trace(pts, mark(0.07, 1));
      }
      // The ribbons: two red strokes from the knot, lit and shadowed by turns
      // as they twist, with waves running out along them.
      const thick = Math.max(1, Math.round(bsy / 36));
      for (const [reach, drop, waves, phase] of RIBBONS) {
        const n = Math.ceil((reach + drop) * bsy * 2) + 4;
        for (let i = 0; i <= n; i++) {
          const q = i / n, w = ph * 1.25 - q * waves * 2 * Math.PI + phase;
          const [c, r] = at(-0.03 - reach * q + 0.018 * q * Math.sin(w), 0.1 + drop * q ** 1.1 + 0.022 * q * Math.sin(w + 1.2));
          for (let h = Math.floor(r * 2 - thick / 2 + 0.5), e = h + thick; h < e; h++) for (let cc = Math.floor(c - thick / 2 + 0.5), f = cc + thick; cc < f; cc++) {
            if (!inside(cc, h)) continue;
            const p = h * cols + cc;
            fix[p] = RED + (Math.cos(w) > 0 ? 2 : 1); what[p] = RIBBON; glyph[(h >> 1) * cols + cc] = 32;
          }
        }
      }
      // The figure in white: hair, a pale face, the robe with an ink outline and
      // folds, a shade greyer than the cloud so that it stands out from it.
      for (let h = Math.max(0, Math.floor(wtop) - 1), h1 = Math.min(H2 - 1, Math.ceil(wtop + wsy)); h <= h1; h++) {
        const v = (h + 0.5 - wtop) / wsy;
        for (let c = Math.max(0, Math.floor(wcx - 0.25 * wsx)); c < cols; c++) {
          const u = (c + 0.5 - wcx) / wsx, kind = whiteAt(u, v, ph);
          if (!kind) continue;
          const p = h * cols + c, edge = !whiteAt(u - 1 / wsx, v, ph);
          lum[p] = kind === HAIR ? 0.04 : kind === FACE ? 0.86 : edge ? 0.3 : 0.84 + 0.04 * Math.sin(u * 90 + v * 20) - 0.24 * smooth(0, 0.08, u);
          what[p] = FIGURE; fix[p] = 0;
          glyph[(h >> 1) * cols + c] = 32;
        }
      }
      const wat = (u, v) => [wcx + u * wsx, (wtop + v * wsy) / 2];
      if (wsy > 12) { const [a, b] = wat(-0.05, 0.3), [c2, d2] = wat(-0.09 - 0.01 * Math.sin(ph), 0.95); line(a, b, c2, d2, mark(0.62, 0)); }
    }

    function drawBranches(t) {
      const put = (L) => (c, r, gl) => { if (c >= 0 && c < cols && r >= 0 && r < rows) { const i = r * cols + c; glyph[i] = gl; ink[i] = tone(L); bold[i] = 1; } };
      for (const [x0, y0, x1, y1, o0, o1, limb, depth] of twigs) {
        const sway = (out) => 0.006 * out * out * Math.sin(t * 1.4 + limb * 2.1 + out * 1.7);
        const c0 = colX(x0 + sway(o0) * 0.4), h0 = rowY(y0 + sway(o0)), c1 = colX(x1 + sway(o1) * 0.4), h1 = rowY(y1 + sway(o1));
        if (depth === 0) { // the limb itself is thick enough to paint
          const steps = Math.ceil(Math.hypot(c1 - c0, h1 - h0)) + 1;
          for (let s = 0; s <= steps; s++) {
            const c = Math.floor(lerp(c0, c1, s / steps)), h = Math.floor(lerp(h0, h1, s / steps));
            if (inside(c, h)) { const p = h * cols + c; lum[p] = 0.1; what[p] = FG; }
          }
        }
        line(c0, h0 / 2, c1, h1 / 2, put(depth < 2 ? 0.08 : 0.15));
      }
    }

    function drawBirds(t, s) {
      for (const b of flock) {
        const x = b.x - b.pace * s, y = b.y + b.rise * s + 0.004 * Math.sin(t * 2.3 + b.phase * 6.28);
        const c = Math.floor(colX(x)), r = Math.floor(rowY(y) / 2);
        if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
        const i = r * cols + c, p = r * 2 * cols + c;
        if (what[p] >= FG || what[p + cols] >= FG) continue; // behind the branches and the pine
        glyph[i] = WINGS[Math.floor((t / BEAT + b.phase) * 4) & 3]; ink[i] = tone(0.06); bold[i] = 1;
      }
    }

    return {
      cols, rows, palette: INK, glyph, ink, bold, paint,
      render(t) { // t: seconds since the animation started
        glyph.fill(32); ink.fill(0); bold.fill(0); paint.fill(0); fix.fill(0); alpha.fill(1);
        if (t >= LENGTH) return this; // over: nothing is left on the page
        const s = t * SPEED; // where that is in the story
        // Where each depth's crest is in every column: its level, varying across
        // the screen until it has risen, and its billows, rolled to the left,
        // flattening as it nears the horizon.
        for (let j = 0; j < 4; j++) {
          const f = ROLL * SEA[j].roll * t * PU, fi = Math.floor(f), ff = f - fi, shape = crestShape[j], C = crest[j];
          const lv = j < 3 ? LEVEL[j](s) : 0, done = j < 3 ? (START[j] - lv) / (START[j] - HORIZON) : FRONT(s);
          for (let c = 0; c < cols; c++) {
            const y = j < 3 ? lv + lilt[j][c] * (1 - done) : lerp(1.15 + lilt[j][c], settle[c], done);
            const amp = SEA[j].amp * PH * (j < 3 ? (y - VANISH) / (START[j] - VANISH) : 1);
            C[c] = rowY(y) - amp * (shape[c + fi] + (shape[c + fi + 1] - shape[c + fi]) * ff);
          }
        }
        // The rows of billows, rolled to now.
        for (let n = 0, phase = OMEGA * t; n < NR; n++) {
          const S = rowS[n], st = rowStep[n], o2 = n * 397 + phase;
          for (let c = 0; c < cols; c++) { const x = c * st + o2, i = x | 0, f = x - i; S[c] = profile[i & PM] + (profile[(i + 1) & PM] - profile[i & PM]) * f; }
        }
        // The sea at a half cell: which row of billows it is in, and how far
        // down that billow, white at its top to grey just above the next; the
        // greys soften as the cloud settles, smooth and white.
        const ts = Math.floor(ROLL * 0.7 * t * PU), calm = 1 - 0.55 * smooth(T.tops, T.rest, s);
        const seaAt = (h, c) => {
          const v = rowAt[h], tx = 0.08 * cloudTex[h * TC + c + ts];
          if (v < 0) return 0.975 + tx;
          const k = v | 0, r = v >= k + 1 - TALL * rowS[k + 1][c] ? k + 1 : k, top = r - TALL * rowS[r][c];
          return 0.99 - under[h] * calm * smooth(0.3, 1, (v - top) / (r + 1 - TALL * rowS[r + 1][c] - top)) ** 1.5 + tx;
        };
        // Depth j of the cloud there: lit white just under its crest, and grey
        // just above the crest of the depth in front, so that each crest shows.
        const cloudAt = (j, c, hh, sea) => {
          const L = sea + (0.985 - sea) * (1 - smooth(0, cap[j], hh - crest[j][c]));
          return j < 3 ? L - 0.07 * (1 - smooth(0, shadow, crest[j + 1][c] - hh)) : L;
        };
        // Every half cell: the foreground if it is there; otherwise the nearest
        // depth of cloud that hides everything behind it (or the sky, hazy just
        // above the cloud), and then whatever stands in front of that, farthest
        // first: a peak, its foot dissolving into its cloud, and the soft crest
        // of the next cloud.
        const si = Math.floor(STORM * t * PU);
        for (let h = 0, p = 0; h < H2; h++) {
          const sky0 = skyBase[h], skyA = skyAmp[h], srow = h * TS + si, hh = h + 0.5;
          for (let c = 0; c < cols; c++, p++) {
            const f = fgL[p];
            if (f >= 0) { lum[p] = f; what[p] = FG; continue; }
            let j0 = 3;
            while (j0 >= 0 && hh < crest[j0][c] + soft[j0] * 0.5) j0--;
            let L, w, sea = -1;
            if (j0 >= 0) { sea = seaAt(h, c); L = cloudAt(j0, c, hh, sea); w = FAR_C + 2 * j0; }
            else { L = sky0 + skyA * skyTex[srow + c]; L += (0.84 - L) * 0.7 * (1 - smooth(0, haze, crest[0][c] - hh)); w = SKY; }
            for (let j = j0 + 1; j < 4; j++) {
              if (j < 3) {
                const v = peaks[j][p];
                if (v >= 0) { const e = crest[j][c] - hh + (cloudTex[h * TC + c + ts] - 0.1) * mistBand[j] * 0.5; L = v + (0.93 - v) * (1 - smooth(0, mistBand[j], e)); w = FAR + 2 * j; }
              }
              const a = (hh - crest[j][c]) / soft[j] + 0.5;
              if (a > 0) { if (sea < 0) sea = seaAt(h, c); L += (cloudAt(j, c, hh, sea) - L) * a; if (a > 0.5) w = FAR_C + 2 * j; }
            }
            lum[p] = L; what[p] = w;
          }
        }
        // Strokes on whatever the cloud has not covered, wisps rolling in the cloud.
        for (let r = 0, i = 0; r < rows; r++) for (let c = 0; c < cols; c++, i++) {
          const p = r * 2 * cols + c, a = what[p], b = what[p + cols];
          if (a !== b || a === SKY || a === FG) continue;
          if (markW[i] && a === markW[i] * 2) {
            const l = markW[i] - 1;
            if (crest[l][c] - (r * 2 + 1) > mistBand[l]) { glyph[i] = markG[i]; ink[i] = tone(markL[i]); }
          } else if (a & 1 && a >= FAR_C && a <= FRONT_C) {
            const slot = Math.floor((c + ts) / 3);
            if (hash(slot, r * 7) < 0.015) { glyph[i] = hash(slot, r + 9) < 0.6 ? WAVE : DASH; ink[i] = tone(lum[p] - 0.12); }
          }
        }
        drawBirds(t, s);
        for (let i = 0; i < cols * rows; i++) if (fgMark[i]) { glyph[i] = fgMark[i]; ink[i] = tone(fgInk[i]); bold[i] = 0; }
        drawBranches(t);
        drawFigures(t);
        if (s > T.over) { // the ending: the cloud surges up over everything, the ribbons last, fills the frame and thins away behind itself
          const u = clamp01((s - T.over) / (T.flood - T.over)) ** 1.3, amp = 0.07 * PH, fi = Math.floor(ROLL * t * PU);
          const lvl = H2 + amp + 3 - u * (H2 + amp + 6), capF = amp * 1.2 + 1, softF = 0.022 * PH + 1;
          for (let c = 0; c < cols; c++) flood[c] = lvl - amp * floodShape[c + fi];
          for (let h = 0, p = 0; h < H2; h++) for (let c = 0; c < cols; c++, p++) {
            const d = T.flood + 0.04 + 0.3 * (1 - (h + 0.5) / H2) + 0.12 * cloudTex[h * TC + c + ts];
            alpha[p] = 1 - smooth(d, d + 0.2, s);
            if (alpha[p] < 1) { what[p] = FLOOD; continue; } // thinning, long since under the cloud
            const below = h + 0.5 - flood[c];
            if (below > (what[p] === RIBBON ? 0.15 * PH : -softF / 2)) {
              const a = clamp01(below / softF + 0.5), sea = seaAt(h, c);
              lum[p] += (sea + (0.985 - sea) * (1 - smooth(0, capF, below)) - lum[p]) * a;
              if (a > 0.5) { what[p] = FLOOD; fix[p] = 0; }
            }
          }
          for (let r = 0, i = 0; r < rows; r++) for (let c = 0; c < cols; c++, i++) {
            const p = r * 2 * cols + c;
            if ((what[p] === FLOOD && what[p + cols] === FLOOD) || alpha[p] < 0.75) glyph[i] = 32;
          }
        }
        for (let p = 0; p < N; p++) { // into the palette, dithered like dry brush on paper
          if (alpha[p] < 1) { const a = Math.floor(alpha[p] * 8 + order[p]); paint[p] = a > 0 ? THIN + Math.min(8, a) : 0; continue; }
          if (fix[p]) { paint[p] = fix[p]; continue; }
          const l = Math.floor(lum[p] * (NL - 1) + thr[p]);
          paint[p] = GREY + (l < 0 ? 0 : l > NL - 1 ? NL - 1 : l);
        }
        return this;
      },
    };
  }

  // Play it on the stage. Resolves when it has finished. `seed` changes the
  // details, not the layout: the crags of the peaks and their pines, the lie
  // of the cloud and its billows, the shrubs and the bare branches.
  // `freezeAt` holds one moment (in seconds) on screen. Reduced motion holds
  // the opening, the whole landscape with the birds in the sky, before the
  // cloud rises.
  const film = { length: LENGTH, still: 1 / SPEED, createScene };
  return { play: (options) => AsciiStage.play(film, options), createScene };
})();
