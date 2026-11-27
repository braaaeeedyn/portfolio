/*
 * Sword beneath the blossom: an ASCII loading screen.
 *
 *   <script src="ascii-stage.js"></script>
 *   <script src="grave-sword.js"></script>
 *   <script>GraveSword.play().then(showThePage);</script>
 *
 * Seen from the ground, looking steeply up: an enormous cherry tree whose
 * pink canopy fills the top of the frame from edge to edge, its gnarled trunk
 * rising from the bottom, a sword standing upright in the ground in front of
 * it with a cyan band glowing on its guard, and a rounded gravestone beside
 * the sword with a name carved along its top. Black fragments of rock hang in
 * the air as if the ground has just been struck. They drift outward in slow
 * motion; then time runs at its normal speed and they arc out and fall out of
 * the frame. The tree shudders once. A heavy shower of petals falls toward the
 * camera, thickest half way through, then thins. One last petal drifts down,
 * settles on the guard beside the cyan band, rests and slides off. Then one
 * last heavy fall of petals toward the camera carries the picture away to
 * show the page, the cyan band last. Five seconds (LENGTH, below). The camera
 * never moves, and nor do the sword and the gravestone.
 *
 * The picture is laid out in the source image's 16:9 frame and drawn like a
 * cel: flat colours with sharp outlines of characters. What falls toward the
 * camera is worked out in perspective: seen from below, a petal falling
 * straight down moves out from the point overhead and grows as it comes. The
 * whole film is a pure function of time: createScene().render(t) fills a grid
 * of characters and the colours behind them, and the stage (ascii-stage.js)
 * paints that grid on a canvas.
 */
const GraveSword = (() => {
  'use strict';
  const { code, clamp01, lerp, smooth, mulberry32, hash, noise } = AsciiStage;

  // The story's timeline, in the seconds of the user's description.
  const T = {
    slow: 1.25,  // the slow motion ends and the fragments fly (the description has 1.0: the first frame needs a moment to register)
    shock: 1.5,  // the tree shudders once from the shock...
    still: 3.0,  // ...and is still again
    shower: 3.0, // the canopy starts to shed
    peak: 5.0,   // the shower is at its thickest
    clear: 3.5,  // no fragment is left in the air
    few: 8.0,    // only a few petals are still falling
    drop: 7.2,   // the one petal leaves the canopy (the description has 8.0: on screen its drift needs half a second to follow)
    touch: 8.3,  // it touches the guard beside the cyan band
    slip: 8.95,  // it slides off
    quiet: 9.5,  // the air is nearly clear
    hand: 10.0,  // one last heavy fall of petals toward the camera carries the picture away
    end: 11.0,
  };
  // It is played faster than that. LENGTH is how many seconds the whole of it
  // takes on screen, and SPEED how many times faster than the story that is.
  const LENGTH = 5, SPEED = T.end / LENGTH;

  // Colours, only the description's: pink blossom, grey-brown wood, grey stone
  // and sky, black rock, grey steel, a red-brown hilt and one cyan accent.
  // `swatch` adds a run of colours and gives the index of the first.
  const INK = ['#000000'];
  const swatch = (...colours) => INK.push(...colours) - colours.length;
  const PINK = swatch('#94507f', '#b0629a', '#cb76ae', '#e28cc0', '#eea7cf', '#f6c2de', '#fbd9ea', '#fff0f7'); // blossom: deepest shade, bright pink, pale pink, nearly white
  const BARK = swatch('#1a1416', '#2a2124', '#3d3335', '#54494a', '#6f6263', '#8e8080'); // grey-brown wood, shadow to light
  const SKY = swatch('#7c8088', '#959aa1', '#adb1b7', '#c4c7cc', '#d9dbde'); // overcast cloud, dark to light
  const STONE = swatch('#2b2b2f', '#3c3c41', '#505056', '#68686e', '#86868c'); // the gravestone and the rocks, dark to light
  const ROCK = swatch('#0a090b', '#19181c', '#2c2b31'); // the black fragments: body, shaded face, lit face
  const WHITE = swatch('#f6f6f8'); // glints among them
  const STEEL = swatch('#18191d', '#4a4f57', '#7b828c', '#a9b0b9', '#dde2e7'); // the blade: outline, then dark to bright
  const HILT = swatch('#2b1512', '#552821', '#7a392c', '#9c5140'); // red-brown wrapping, dark to light
  const GUARD = swatch('#121316', '#22252a', '#383c42');
  const CYAN = swatch('#33d3ea', '#a6f7ff'); // the band on the guard, and its brightest line
  const GLOW = swatch('#1d4049'); // its light on the dark guard around it: rewritten every frame as it pulses

  const [BAR, SLASH, BACK, LOW, DASH, HIGH, TICK, COMMA, DOT, LEFT, RIGHT, CARET, STAR, EQUALS, COLON, PLUS, BANG] = code("|/\\_-'`,.()^*=:+!");
  const PETAL = code("',`."); // a petal too small to draw, tumbling
  const CARVED = code("+=!|;~+="); // a whole carved mark in one cell, for a name with room for no more

  // The source image's frame, in frame heights: X across from its middle, Y
  // down from its top (it is 16:9, so X runs from -8/9 to 8/9). A wider screen
  // sees more of the world at the sides; a narrower one keeps KEEP across its
  // width and sees more of the canopy above and of the ground below.
  const KEEP = [-0.62, 0.42]; // the trunk's foot, the gravestone and the sword
  const ABOVE = 0.6;          // the share of a tall screen's extra height that goes above the frame
  const GROUND = 1.27;        // where the ground starts, below the frame: only a tall screen sees it
  const ZENITH = -0.45;       // the point straight overhead, above the frame. What falls toward the camera comes out from it.
  // The canopy's lower edge, [X, Y] from far left to far right.
  const UNDER = [[-2.4, 0.12], [-1.7, 0.28], [-1.25, 0.42], [-0.89, 0.555], [-0.75, 0.6], [-0.6, 0.62], [-0.48, 0.65],
    [-0.38, 0.68], [-0.25, 0.7], [0.1, 0.7], [0.3, 0.71], [0.4, 0.645], [0.5, 0.62], [0.6, 0.575], [0.75, 0.545],
    [0.89, 0.5], [1.25, 0.4], [1.7, 0.28], [2.4, 0.12]];
  // The trunk's edges, [Y, X] down its left and right sides, out to its roots
  // below the frame. Above TRUNK_TOP it has split into limbs.
  const TRUNK_L = [[0.16, -0.2], [0.25, -0.2], [0.3, -0.21], [0.4, -0.235], [0.5, -0.27], [0.6, -0.31], [0.7, -0.36],
    [0.8, -0.42], [0.9, -0.5], [1.0, -0.59], [1.1, -0.7], [1.2, -0.84], [1.3, -1.0]];
  const TRUNK_R = [[0.16, 0.05], [0.25, 0.1], [0.3, 0.11], [0.4, 0.115], [0.5, 0.11], [0.6, 0.12], [0.7, 0.145],
    [0.8, 0.18], [0.9, 0.235], [1.0, 0.31], [1.1, 0.38], [1.2, 0.48], [1.3, 0.6]];
  const TRUNK_TOP = 0.16;
  // The limbs, from inside the top of the trunk out under the canopy: [width
  // at the trunk, width at the tip, points...]. They are made crooked, and
  // twigs grow from them, by rule.
  const LIMBS = [
    [0.085, 0.03, [-0.08, 0.3], [-0.115, 0.17], [-0.13, 0.05], [-0.15, -0.12], [-0.16, -0.4], [-0.17, -0.9]], // the leader, straight up
    [0.06, 0.012, [-0.12, 0.26], [-0.2, 0.15], [-0.27, 0.06], [-0.37, -0.06], [-0.5, -0.25], [-0.68, -0.55]], // up and to the left
    [0.055, 0.01, [-0.15, 0.32], [-0.27, 0.27], [-0.4, 0.235], [-0.58, 0.21], [-0.8, 0.22], [-1.1, 0.19], [-1.5, 0.14]], // out to the left
    [0.035, 0.008, [-0.22, 0.47], [-0.36, 0.44], [-0.5, 0.45], [-0.66, 0.48], [-0.85, 0.5], [-1.1, 0.42]], // low on the left
    [0.06, 0.012, [-0.02, 0.27], [0.06, 0.15], [0.14, 0.06], [0.25, -0.06], [0.4, -0.26], [0.6, -0.55]], // up and to the right
    [0.055, 0.01, [0.04, 0.33], [0.17, 0.3], [0.3, 0.26], [0.47, 0.22], [0.7, 0.22], [1, 0.19], [1.4, 0.13]], // out to the right
    [0.033, 0.008, [0.08, 0.47], [0.22, 0.45], [0.38, 0.47], [0.56, 0.46], [0.78, 0.45], [1.05, 0.4]], // low on the right
  ];
  // The gravestone: its rounded top, [X, Y] from left to right, and its straight sides.
  const STONE_TOP = [[-0.367, 0.71], [-0.33, 0.672], [-0.28, 0.645], [-0.22, 0.63], [-0.16, 0.628], [-0.11, 0.638], [-0.08, 0.655], [-0.062, 0.685]];
  const stoneLeft = (Y) => -0.367 - (Y - 0.71) * 0.172, stoneRight = (Y) => -0.062 + (Y - 0.685) * 0.02;
  const NAME = [[-0.34, 0.8], [-0.125, 0.728]]; // the line the carved name runs along, from its first mark to its last
  // The sword stands in the ground below the frame, its point down. Seen from
  // below it leans a little toward the point overhead, and its near end, the
  // blade, is drawn wider than the hilt.
  const axis = (Y) => -0.085 + (1 - Y) * 0.108;
  const bladeWidth = (Y) => 0.04 + (Y - 0.6) * 0.072;
  const GUARD_AT = 0.483, GUARD_R = [0.044, 0.03]; // the guard: its middle, and its radii across and down
  const HILT_TOP = 0.235, CAP_TOP = 0.205, HILT_W = 0.011; // where the wrapping ends and the cap begins, the top of the cap, half the hilt's width
  const RINGS = [0.297, 0.368]; // dark bands round the hilt
  const SWORD_Z = 1.25, STONE_Z = 1.6; // how far off the sword and the gravestone are, in the units petals fall in
  const PETAL_SIZE = 0.06; // how long a petal looks one unit off, in frame heights
  // The biggest fragments, where the source image has them: [X, Y, radius].
  const BOULDERS = [[-0.667, 0.117, 0.033], [0.272, 0.15, 0.042], [-0.478, 0.322, 0.033], [0.144, 0.572, 0.037],
    [0.344, 0.683, 0.04], [0.067, 0.71, 0.033], [-0.2, 0.82, 0.042], [-0.522, 0.767, 0.025], [-0.6, 0.583, 0.021],
    [-0.272, 0.35, 0.016], [-0.839, 0.7, 0.019], [-0.8, 0.735, 0.015], [0.155, 0.25, 0.016], [-0.167, 0.517, 0.015],
    [-0.333, 0.94, 0.019], [-0.222, 0.97, 0.024], [0.85, 0.93, 0.014], [-0.41, 0.645, 0.015]];

  // Piecewise-linear interpolation through [x, y] pairs in order of x.
  const curve = (pts, x) => {
    if (x <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0); }
    }
    return pts[pts.length - 1][1];
  };
  const under = (X) => curve(UNDER, X) + 0.025 * (noise(X * 11, 1.5) - 0.5);
  const trunkL = (Y) => curve(TRUNK_L, Y) + 0.022 * (noise(Y * 9, 3.3) - 0.5);
  const trunkR = (Y) => curve(TRUNK_R, Y) + 0.022 * (noise(Y * 9, 7.7) - 0.5);
  const groundAt = (X) => GROUND + 0.014 * (noise(X * 9, 5) - 0.5);
  // Craggy grey rock beneath the sky in the lower left, as in the source image, and far off to the right on a wide screen.
  const moundTop = (X) => (X < 0.9 ? 0.83 + Math.max(0, X + 0.7) * 1.5 : 1.02 - (X - 0.9) * 0.25)
    + 0.07 * (noise(X * 5, 2) - 0.5) - 0.035 * Math.abs(2 * noise(X * 17, 4) - 1);

  // The overcast sky, in flat bands of grey: billows lit along their tops, darker beneath.
  function skyTone(X, Y) {
    const billow = (y) => noise(X * 2.6 + 7, y * 5.2) * 0.6 + noise(X * 6 + 3, y * 11 + 2) * 0.28 + noise(X * 15, y * 26 + 5) * 0.12;
    const n = billow(Y), v = n + (billow(Y - 0.035) - n) * -1.6 + 0.22 * clamp01((Y - 0.5) / 0.6) - 0.06;
    return v < 0.3 ? 0 : v < 0.4 ? 1 : v < 0.5 ? 2 : v < 0.6 ? 3 : 4;
  }

  // The glyph for an outline whose outward normal is (nx, ny), y down.
  const edge = (nx, ny) => {
    const ax = Math.abs(nx), ay = Math.abs(ny);
    if (ay > ax * 2.2) return ny < 0 ? DASH : LOW;
    if (ax > ay * 2.2) return nx < 0 ? LEFT : RIGHT;
    return nx * ny > 0 ? SLASH : BACK;
  };

  // A line too thin to fill cells, drawn as slashes, bars and dashes chosen by
  // where it crosses each cell, as the plum blossom draws its twigs. Columns
  // and rows; `put(c, r, glyph)` does the drawing.
  function line(c0, r0, c1, r1, put) {
    const dc = c1 - c0, dr = r1 - r0, wide = Math.abs(dc), high = Math.abs(dr);
    const rising = dc * dr < 0; // climbs to the right, like a slash
    if (wide <= high * 1.3) { // steep: one glyph per row
      const lo = Math.min(r0, r1), hi = Math.max(r0, r1);
      for (let r = Math.floor(lo); r < hi; r++) {
        const ya = Math.max(lo, r), yb = Math.min(hi, r + 1), cover = yb - ya;
        if (cover < 0.25) continue;
        const ca = c0 + (dc * (ya - r0)) / dr, cb = c0 + (dc * (yb - r0)) / dr;
        const stub = cover < 0.6 ? ((ya + yb) / 2 - r > 0.5 ? (rising ? COMMA : DOT) : HIGH) : 0;
        put(Math.floor((ca + cb) / 2), r, stub || (Math.floor(ca) === Math.floor(cb) ? BAR : rising ? SLASH : BACK));
      }
    } else { // shallow: one glyph per column
      const lo = Math.min(c0, c1), hi = Math.max(c0, c1), slope = high / wide;
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
        else { // nearly flat: __,--' in half-row steps, with a tick where the line changes level
          const q = level(c), steps = level(c + (rising ? 1 : -1)) < q, lands = level(c + (rising ? -1 : 1)) > q;
          if (q % 2 === 0) put(c, q / 2 - 1, LOW);
          else put(c, (q - 1) / 2, steps ? (rising ? HIGH : TICK) : lands ? (rising ? COMMA : DOT) : DASH);
        }
      }
    }
  }

  // The fragments' own clock: slow motion until T.slow, then normal speed.
  const SLOWMO = 0.08, RAMP = [T.slow - 0.1, T.slow + 0.2];
  const tau = (s) => {
    const [a, b] = RAMP, k = clamp01((s - a) / (b - a));
    const caught = s > b ? (b - a) / 2 + (s - b) : (b - a) * (k ** 3 - k ** 4 / 2); // the integral of the ramp up to speed
    return SLOWMO * s + (1 - SLOWMO) * caught;
  };
  // The shudder: how strongly the tree is shaking at story time s, and the phase of the shake.
  const shudder = (s) => { const k = clamp01((s - T.shock - 0.08) / (T.still - T.shock - 0.08)); return smooth(T.shock, T.shock + 0.08, s) * (1 - k) * (1 - k); };
  const shakeAt = (s) => 2 * Math.PI * 2.4 * (s - T.shock);

  // How fast petals leave the canopy at story time s, before it is scaled to
  // a count of petals. Each takes a second or so to fall out of sight, so it
  // peaks a little before T.peak for the air to be thickest then, and has
  // nearly stopped a little before T.few.
  const intensity = (s) => {
    const peak = T.peak - 0.6, few = T.few - 0.6, none = T.quiet - 0.5;
    return s < 1.8 ? 0
      : s < T.shower ? 0.08 * smooth(1.8, 2.4, s) // a few shaken loose by the shudder
        : s < peak ? lerp(0.08, 1, smooth(T.shower, peak, s))
          : s < few ? lerp(1, 0.06, (s - peak) / (few - peak))
            : s < none ? (0.06 * (none - s)) / (none - few) : 0;
  };

  function createScene({ cols, rows, aspect = 2, seed = 1 }) {
    const rand = mulberry32(seed), R = (a, b) => a + (b - a) * rand();
    const N = cols * rows, lines = rows * 2;
    const glyph = new Uint8Array(N), ink = new Uint8Array(N), bold = new Uint8Array(N);
    const paint = new Uint8Array(N * 2);
    const palette = INK.slice(); // this scene's own copy: the glow changes as it pulses

    // Lay the frame on the screen. u: rows to a frame height; ku: columns to one.
    const u = Math.min(rows, cols / aspect / (KEEP[1] - KEEP[0])), ku = u * aspect;
    const hw = cols / ku / 2; // half the screen's width, in frame heights
    const xc = Math.min(KEEP[0] + hw, Math.max(KEEP[1] - hw, 0)); // the X in the middle of the screen
    const top = (rows - u) * ABOVE; // the row the top of the frame is on
    const colOf = (X) => (X - xc) * ku + cols / 2, rowOf = (Y) => Y * u + top; // continuous: cell c spans c to c + 1
    const Xs = Float64Array.from({ length: cols }, (_, c) => xc + (c + 0.5 - cols / 2) / ku); // the middle of each column
    const Ys = Float64Array.from({ length: lines }, (_, l) => ((l + 0.5) / 2 - top) / u); // the middle of each half row
    const left = xc - hw, right = xc + hw, high = -top / u, low = (rows - top) / u; // the screen's edges, in frame heights
    const inGrid = (c, r) => c >= 0 && c < cols && r >= 0 && r < rows;

    // Static layers are drawn once into full-size arrays and kept as lists of
    // what they cover, to lay over the frame each time. A glyph of 32 hides
    // whatever glyph is under it; 0 leaves it.
    const layer = () => ({ paint: new Uint8Array(N * 2), glyph: new Uint8Array(N), ink: new Uint8Array(N), bold: new Uint8Array(N) });
    const pack = (L) => {
      const hi = [], hc = [], ci = [], cg = [], ck = [], cb = [];
      for (let i = 0; i < N * 2; i++) if (L.paint[i]) { hi.push(i); hc.push(L.paint[i]); }
      for (let i = 0; i < N; i++) if (L.glyph[i]) { ci.push(i); cg.push(L.glyph[i]); ck.push(L.ink[i]); cb.push(L.bold[i]); }
      return { hi: Int32Array.from(hi), hc: Uint8Array.from(hc), ci: Int32Array.from(ci), cg: Uint8Array.from(cg), ck: Uint8Array.from(ck), cb: Uint8Array.from(cb) };
    };
    const blit = (P, shift = 0) => { // lay a packed layer over the frame, moved `shift` columns
      for (let j = 0; j < P.hi.length; j++) {
        const i = P.hi[j], c = (i % cols) + shift;
        if (c >= 0 && c < cols) paint[i + shift] = P.hc[j];
      }
      for (let j = 0; j < P.ci.length; j++) {
        const i = P.ci[j], c = (i % cols) + shift;
        if (c >= 0 && c < cols) { glyph[i + shift] = P.cg[j]; ink[i + shift] = P.ck[j]; bold[i + shift] = P.cb[j]; }
      }
    };
    const putter = (L, colour, heavy = 0) => (c, r, g) => { if (inGrid(c, r)) { const i = r * cols + c; L.glyph[i] = g; L.ink[i] = colour; L.bold[i] = heavy; } };

    // The sky, the low rock in the lower left, the deep shade inside the
    // canopy that shows between its clumps and, on a tall screen, the ground.
    const back = new Uint8Array(N * 2), backGlyph = new Uint8Array(N).fill(32), backInk = new Uint8Array(N);
    for (let c = 0; c < cols; c++) {
      const X = Xs[c], mound = moundTop(X), ground = groundAt(X), shade = under(X) - 0.06;
      for (let l = 0; l < lines; l++) {
        const Y = Ys[l];
        back[l * cols + c] = Y >= ground ? BARK + 1 + (noise(X * 30, Y * 40) > 0.62 ? 1 : 0)
          : Y >= mound ? STONE + (Y < mound + 0.02 ? 3 : noise(X * 14, Y * 14) > 0.58 ? 2 : 1)
            : Y < shade ? PINK + (noise(X * 9, Y * 9) > 0.5 ? 2 : 1) : SKY + skyTone(X, Y);
      }
    }
    { // the rock's outline, and rubble on the ground
      const B = { glyph: backGlyph, ink: backInk, bold: new Uint8Array(N) };
      for (let c = 0; c < cols - 1; c++) line(c + 0.5, rowOf(moundTop(Xs[c])), c + 1.5, rowOf(moundTop(Xs[c + 1])), putter(B, STONE));
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const Y = (r + 0.5 - top) / u, h = hash(c, r + 911);
        if (Y > groundAt(Xs[c]) + 0.6 / u && h < 0.16) { backGlyph[r * cols + c] = h < 0.05 ? CARET : h < 0.1 ? DOT : COMMA; backInk[r * cols + c] = h < 0.08 ? ROCK : STONE + 3; }
      }
    }

    // The trunk: flat patches of grey-brown, lit from the upper left, with
    // bark furrows running up it toward the point overhead, a hollow knot with
    // a lit burl above it, and dark outlines down both sides.
    const trunk = layer();
    {
      const KNOT = [-0.1, 0.375, 0.026, 0.021], BURL = [-0.075, 0.315, 0.06, 0.036];
      for (let l = 0; l < lines; l++) {
        const Y = Ys[l];
        if (Y < TRUNK_TOP) continue;
        const a = trunkL(Y), b = trunkR(Y);
        for (let c = Math.max(0, Math.floor(colOf(a))); c < cols && Xs[c] <= b; c++) {
          const X = Xs[c];
          if (X < a || Y >= groundAt(X)) continue;
          const q = (X - a) / (b - a), qn = q + 0.16 * (noise(Y * 7, q * 3 + 11) - 0.5), plate = noise(q * 6 + 1, Y * 8);
          let tone = q < 0.04 || q > 0.96 ? 0 : qn < 0.14 ? 2 : qn < 0.52 ? 4 : qn < 0.74 ? 3 : 2;
          if (tone > 1 && plate > 0.66) tone++; // bark plates catching the light
          if (tone > 1 && plate < 0.3) tone--;
          const kn = Math.hypot((X - KNOT[0]) / KNOT[2], (Y - KNOT[1]) / KNOT[3]), bu = Math.hypot((X - BURL[0]) / BURL[2], (Y - BURL[1]) / BURL[3]);
          if (kn < 1) tone = 0;
          else if (kn < 1.4) tone = Y > KNOT[1] ? 4 : 1; // the lip of the hollow is lit below and shaded above
          else if (bu < 1) tone = bu > 0.8 && Y > BURL[1] ? 2 : 5;
          trunk.paint[l * cols + c] = BARK + Math.min(5, tone);
          if (l & 1) trunk.glyph[(l >> 1) * cols + c] = 32; // it hides what is behind it
        }
      }
      const furrow = putter(trunk, BARK + 1), outline = putter(trunk, BARK, 1);
      for (let f = 0; f < 9; f++) { // furrows, broken here and there
        const q = (f + 0.5) / 9 + R(-0.03, 0.03), wave = R(0, 6.28);
        let pc = -1, pr = 0;
        for (let Y = TRUNK_TOP + 0.02; Y < GROUND + 0.05; Y += 0.7 / u) {
          const X = trunkL(Y) + q * (trunkR(Y) - trunkL(Y)) + 0.01 * Math.sin(Y * 22 + wave);
          if (Y >= groundAt(X)) break;
          const c = colOf(X), r = rowOf(Y);
          if (pc >= 0 && noise(f * 3.1, Y * 7) > 0.36) line(pc, pr, c, r, furrow);
          pc = c; pr = r;
        }
      }
      for (const side of [trunkL, trunkR]) { // the outline down each side
        let pc = -1, pr = 0;
        for (let Y = TRUNK_TOP + 0.04; Y < GROUND + 0.05; Y += 0.5 / u) {
          const X = side(Y);
          if (Y >= groundAt(X)) break;
          const c = colOf(X) + (side === trunkL ? 0.4 : -0.4), r = rowOf(Y);
          if (pc >= 0) line(pc, pr, c, r, outline);
          pc = c; pr = r;
        }
      }
      for (let k = 0; k < 24; k++) { // the rim of the hollow
        const a = (k / 24) * Math.PI * 2, c = Math.floor(colOf(KNOT[0] + Math.cos(a) * KNOT[2] * 1.2)), r = Math.floor(rowOf(KNOT[1] + Math.sin(a) * KNOT[3] * 1.2));
        outline(c, r, edge(Math.cos(a), Math.sin(a)));
      }
    }

    // The gravestone: a flat grey face with a lit bevel along its rounded top
    // and left side, outlined in dark grey, and a name of abstract carved
    // marks along its top. It marks the half cells it covers in `front`, so
    // that what passes behind it is hidden.
    const front = new Uint8Array(N * 2); // 1: the gravestone, 2: the sword
    const stone = layer();
    {
      const RIM = 0.011, topAt = (X) => curve(STONE_TOP, X);
      for (let l = 0; l < lines; l++) {
        const Y = Ys[l], a = stoneLeft(Y), b = stoneRight(Y);
        if (Y < 0.62) continue;
        for (let c = Math.max(0, Math.floor(colOf(a))); c < cols && Xs[c] <= b; c++) {
          const X = Xs[c];
          if (X < a || Y < topAt(X) || Y >= groundAt(X)) continue;
          const tone = Y - topAt(X) < RIM || X - a < RIM * 1.3 ? 4 : b - X < RIM ? 1 : Y - topAt(X) < RIM * 2.2 ? 2 : Y < 0.88 ? 3 : 2;
          stone.paint[l * cols + c] = STONE + tone;
          front[l * cols + c] = 1;
          if (l & 1) stone.glyph[(l >> 1) * cols + c] = 32;
        }
      }
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { // grain in the stone
        const i = r * cols + c, h = hash(c + 77, r);
        if (stone.glyph[i] === 32 && h < 0.05) { stone.glyph[i] = h < 0.02 ? DOT : h < 0.035 ? COMMA : COLON; stone.ink[i] = STONE + (h < 0.03 ? 2 : 4); }
      }
      const outline = putter(stone, STONE, 1);
      for (let i = 0; i < STONE_TOP.length - 1; i++) {
        const [x0, y0] = STONE_TOP[i], [x1, y1] = STONE_TOP[i + 1];
        line(colOf(x0), rowOf(y0) + 0.3, colOf(x1), rowOf(y1) + 0.3, outline);
      }
      line(colOf(stoneLeft(0.71)) + 0.4, rowOf(0.71), colOf(stoneLeft(GROUND)) + 0.4, rowOf(GROUND), outline);
      // The name: fourteen marks in two groups of seven, each group level and
      // the second higher, stepping up the line of the top, cut dark into the
      // face. Each is a box of cells crossed by two to four straight strokes
      // or, where there is room for only one cell, a single stroke, so that
      // they read as script but never as letters. They are the same for every
      // seed and every moment.
      const pick = mulberry32(1977), [[ax, ay], [bx, by]] = NAME, span = colOf(bx) - colOf(ax);
      const w = Math.max(1, Math.floor(((span - 2) / 14) * 0.8)), h = w === 1 ? 1 : Math.min(w + 1, Math.round(0.034 * u)); // a mark's box, in cells: narrow and tall
      const step = w > 1 ? w + 1 : 1, first = Math.round(colOf(ax) + span / 2 - (14 * step + w) / 2); // side by side, with a space between the two groups
      const level = [0.25, 0.75].map((f) => Math.round(rowOf(lerp(ay, by, f)) - h / 2)); // the row each group is on
      for (let k = 0; k < 14; k++) {
        const c0 = first + k * step + (k >= 7 ? w : 0), r0 = level[k >= 7 ? 1 : 0];
        const cut = new Uint8Array(w * h); // what crosses each cell: 1 a stroke across, 2 a stroke down, 4 a dot, 8 a stroke of another shape
        if (w === 1) cut[0] = 8;
        else {
          for (let m = 0, n = 2 + Math.floor(pick() * 3); m < n; m++) {
            const kind = m === 0 ? 1 : m === 1 ? 2 : pick() < 0.2 ? 4 : pick() < 0.5 ? 1 : 2;
            if (kind === 1) { const y = Math.floor(pick() * h), a = Math.floor(pick() * w * 0.4), b = w - Math.floor(pick() * w * 0.4); for (let x = a; x < b; x++) cut[y * w + x] |= 1; }
            else if (kind === 2) { const x = Math.floor(pick() * w), a = Math.floor(pick() * h * 0.4), b = h - Math.floor(pick() * h * 0.3); for (let y = a; y < b; y++) cut[y * w + x] |= 2; }
            else cut[Math.floor(pick() * h) * w + Math.floor(pick() * w)] |= 4;
          }
        }
        const double = pick() < 0.35, tall = pick() < 0.3, one = CARVED[Math.floor(pick() * CARVED.length)]; // some strokes are doubled, some broken
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const v = cut[y * w + x], c = c0 + x, r = r0 + y;
          if (v && inGrid(c, r) && front[r * 2 * cols + c] === 1) outline(c, r, v & 8 ? one : (v & 3) === 3 ? PLUS : v & 1 ? (double ? EQUALS : DASH) : v & 2 ? (tall ? BANG : BAR) : HIGH);
        }
      }
    }

    // The sword: a grey blade with dark outlines, a ridge and a bright edge, a
    // dark guard with the cyan band along its top and the band's light on the
    // guard around it, a red-brown wrapped hilt with darker bands, and a dark
    // cap. It is in front of everything but what falls toward the camera.
    const sword = layer(), band = [], bandCells = [], halo = [];
    const gx = axis(GUARD_AT), gy = GUARD_AT;
    {
      const guardAt = (X, Y) => Math.hypot((X - gx) / GUARD_R[0], (Y - gy) / GUARD_R[1]);
      const isBand = (X, Y) => { const e = guardAt(X, Y); return e <= 1 && (Y - gy) / GUARD_R[1] < -0.05 && e > 0.66; };
      const set = (l, c, colour) => { sword.paint[l * cols + c] = colour; front[l * cols + c] = 2; if (l & 1) sword.glyph[(l >> 1) * cols + c] = 32; };
      for (let l = 0; l < lines; l++) {
        const Y = Ys[l];
        if (Y < CAP_TOP) continue;
        const mid = axis(Y);
        for (let c = Math.max(0, Math.floor(colOf(mid - 0.08))); c < cols && Xs[c] <= mid + 0.08; c++) {
          const X = Xs[c];
          if (Y >= groundAt(X)) continue;
          const e = guardAt(X, Y);
          if (e <= 1) { // the guard, and the band of light along its top
            if (isBand(X, Y)) { set(l, c, CYAN); band.push(l * cols + c); }
            else {
              set(l, c, e > 0.84 && Y > gy ? GUARD : X - gx < -GUARD_R[0] * 0.5 ? GUARD + 2 : GUARD + 1);
              const near = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dc, dl]) => isBand(X + dc / ku, Y + dl / (2 * u)));
              if (near) halo.push(l * cols + c);
            }
          } else if (Y > gy) { // the blade
            const half = bladeWidth(Y) / 2, d = X - mid;
            if (Math.abs(d) <= half) set(l, c, d > half * 0.5 ? STEEL + 4 : d > -half * 0.3 ? STEEL + 3 : STEEL + 2);
          } else if (Y >= HILT_TOP) { // the wrapped hilt
            const d = X - mid;
            if (Math.abs(d) <= HILT_W) set(l, c, Y > gy - GUARD_R[1] - 0.016 || RINGS.some((y) => Math.abs(Y - y) < 0.006) ? HILT + 1 : d < 0 ? HILT + 3 : HILT + 2);
          } else if (Math.abs(X - mid) <= HILT_W * 1.25) set(l, c, Y < CAP_TOP + 0.009 ? GUARD + 2 : GUARD + 1); // the cap
        }
      }
      const dark = putter(sword, STEEL, 1);
      const bladeTop = gy + GUARD_R[1] * 0.8, bladeEnd = Math.min(low + 0.05, GROUND);
      for (const side of [-1, 1]) {
        line(colOf(axis(bladeTop) + (side * bladeWidth(bladeTop)) / 2) - side * 0.45, rowOf(bladeTop),
          colOf(axis(bladeEnd) + (side * bladeWidth(bladeEnd)) / 2) - side * 0.45, rowOf(bladeEnd), dark);
      }
      if (bladeWidth(0.8) * ku > 4.5) line(colOf(axis(bladeTop + 0.03)), rowOf(bladeTop + 0.03), colOf(axis(bladeEnd)), rowOf(bladeEnd), putter(sword, STEEL + 1)); // the ridge, where the blade is wide enough to show one
      const wrap = putter(sword, HILT, 1);
      for (let r = Math.ceil(rowOf(HILT_TOP)); r < rowOf(gy - GUARD_R[1]); r++) { // the wrapping crosses the hilt
        const Y = (r + 0.5 - top) / u, c = Math.floor(colOf(axis(Y)));
        wrap(c, r, Y > gy - GUARD_R[1] - 0.016 || RINGS.some((y) => Math.abs(Y - y) < 0.008) ? EQUALS : r & 1 ? BACK : SLASH);
      }
      const rim = putter(sword, GUARD + 2, 1);
      for (let k = 0; k < 32; k++) { // the guard's outline, round its underside
        const a = (k / 32) * Math.PI * 2;
        if (Math.sin(a) < 0.45) continue;
        rim(Math.floor(colOf(gx + Math.cos(a) * GUARD_R[0])), Math.floor(rowOf(gy + Math.sin(a) * GUARD_R[1] * 1.05)), edge(Math.cos(a), Math.sin(a)));
      }
      for (const i of band) { // the band's cells carry its brightest line
        const cell = ((i / cols) >> 1) * cols + (i % cols);
        if (!bandCells.includes(cell)) bandCells.push(cell);
      }
      for (const i of bandCells) { sword.glyph[i] = EQUALS; sword.ink[i] = CYAN + 1; sword.bold[i] = 1; }
    }
    const trunkP = pack(trunk), stoneP = pack(stone), swordP = pack(sword);

    // How freely the canopy moves at a point: not at all at the top of the trunk.
    const reachOf = (X, Y) => clamp01(Math.hypot((X + 0.1) * 0.9, (Y - 0.22) * 1.1) / 0.75);
    const phaseOf = (X, Y) => 1.9 * X + 1.3 * Y;
    // How far the wind and the shudder carry a point of the tree, in frame
    // heights: a gentle sway on the screen's clock, and the one shudder, part
    // of the story, on the story's. The whole tree shakes a little with it,
    // and the canopy more, the farther out the more.
    const sway = [0, 0];
    function swayAt(reach, phase, t, s) {
      const env = shudder(s), w = shakeAt(s);
      sway[0] = reach * (0.008 * Math.sin(1.8 * t + phase) + 0.004 * Math.sin(2.9 * t + 1.6 * phase + 1) + 0.03 * env * Math.sin(w + 0.6 * phase)) + 0.006 * env * Math.sin(w);
      sway[1] = reach * (0.0025 * Math.sin(1.3 * t + 0.7 * phase) + 0.016 * env * Math.sin(w * 1.13 + phase + 1.2));
      return sway;
    }

    // The canopy: clumps of blossom, each a flat-shaded blob lit from the upper
    // left with a deeper underside outlined in deep pink, paler high up and
    // pinker low down. They are drawn top first, so lower ones overlap them as
    // they do seen from below. Most are behind the limbs; some far out are in front.
    const clumps = [];
    function clump(X, Y, ry) {
      const rx = ry * 1.25, cc = colOf(X), rr = rowOf(Y), c0 = Math.floor(cc), r0 = Math.floor(rr), rxc = rx * ku, ryr = ry * u;
      const a = R(0, 6.28), b = R(0, 6.28), ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
      const tone = Math.max(2, Math.min(5, Math.round(lerp(4.9, 2.5, clamp01(Y / 0.65)) + R(-0.8, 0.8))));
      // How far out the point (nx, ny) is, as a share of the clump's lumpy edge in its direction (over 1 is outside). The edge is at
      // 1 + 0.13 sin(3 phi + a) + 0.07 sin(5 phi + b), written out with the multiple-angle formulas: this runs for every cell of over a thousand clumps.
      const out = (nx, ny) => {
        const d = Math.hypot(nx, ny) || 1e-9, c = nx / d, s = ny / d, c2 = c * c, s2 = s * s;
        return d / (1 + 0.13 * (s * (3 - 4 * s2) * ca + c * (4 * c2 - 3) * sa) + 0.07 * (s * (16 * s2 * s2 - 20 * s2 + 5) * cb + c * (16 * c2 * c2 - 20 * c2 + 5) * sb));
      };
      const outside = (x, y) => out((x - cc) / rxc, (y - rr) / ryr) > 1;
      const halves = [], cells = [], outlined = ryr >= 1.4;
      for (let l = Math.floor((rr - ryr * 1.25) * 2); l <= (rr + ryr * 1.25) * 2; l++) {
        const ny = ((l + 0.5) / 2 - rr) / ryr;
        for (let c = Math.floor(cc - rxc * 1.25); c <= cc + rxc * 1.25; c++) {
          const nx = (c + 0.5 - cc) / rxc, e = out(nx, ny);
          if (e > 1) continue;
          const lit = -(0.55 * nx + 0.85 * ny);
          const t = e > 0.82 && ny > 0.2 ? tone - 2 : lit < -0.3 ? tone - 1 : lit > 0.75 && e < 0.7 ? tone + 2 : lit > 0.4 ? tone + 1 : tone;
          halves.push(c - c0, l - 2 * r0, PINK + Math.max(0, Math.min(7, t)));
        }
      }
      for (let r = Math.floor(rr - ryr * 1.25); r <= rr + ryr * 1.25; r++) {
        const ny = (r + 0.5 - rr) / ryr;
        for (let c = Math.floor(cc - rxc * 1.25); c <= cc + rxc * 1.25; c++) {
          const nx = (c + 0.5 - cc) / rxc, e = out(nx, ny);
          if (e > 1) continue;
          const lit = -(0.55 * nx + 0.85 * ny), h = rand();
          let g = 32, k = 0;
          if (outlined && ny > 0.25 && (outside(c + 0.5, r + 1.5) || outside(c + (nx < 0 ? -0.5 : 1.5), r + 0.5))) { g = edge(nx, ny); k = PINK + Math.max(0, tone - 3); } // the edge of its underside, outlined
          else if (h < 0.11) { g = lit > 0.1 ? (h < 0.05 ? STAR : HIGH) : h < 0.08 ? COMMA : DOT; k = PINK + Math.max(0, Math.min(7, lit > 0.1 ? tone + 3 : tone - 2)); } // blossoms catching the light, and shadow between them
          cells.push(c - c0, r - r0, g, k);
        }
      }
      return { X, Y, rx, c: c0, r: r0, halves: Int16Array.from(halves), cells: Int16Array.from(cells), reach: reachOf(X, Y), phase: phaseOf(X, Y) };
    }
    for (const [step, size] of [[0.075, 0.058], [0.045, 0.027]]) { // big clumps, and smaller ones among them
      for (let Y = high - 0.08; Y < 0.8; Y += step * 0.72) {
        for (let X = left - 0.15; X < right + 0.15; X += step) {
          const x = X + R(-0.45, 0.45) * step, y = Y + R(-0.4, 0.4) * step * 0.72, ry = size * R(0.75, 1.25);
          if (y < under(x) - ry * 0.3) clumps.push(clump(x, y, ry));
        }
      }
    }
    clumps.sort((p, q) => p.Y - q.Y);
    const behind = [], before = []; // behind the limbs and the trunk, and in front of them
    for (const k of clumps) {
      const overTrunk = k.Y > 0.26 && k.X + k.rx > trunkL(k.Y) - 0.02 && k.X - k.rx < trunkR(k.Y) + 0.02;
      (rand() < 0.35 && k.reach > 0.45 && !overTrunk ? before : behind).push(k);
    }
    function drawClumps(list, t, s) {
      for (const k of list) {
        swayAt(k.reach, k.phase, t, s);
        const c0 = k.c + Math.round(sway[0] * ku), r0 = k.r + Math.round(sway[1] * u), l0 = r0 * 2, H = k.halves, G = k.cells;
        for (let j = 0; j < H.length; j += 3) {
          const c = c0 + H[j], l = l0 + H[j + 1];
          if (c >= 0 && c < cols && l >= 0 && l < lines) paint[l * cols + c] = H[j + 2];
        }
        for (let j = 0; j < G.length; j += 4) {
          const c = c0 + G[j], r = r0 + G[j + 1];
          if (c >= 0 && c < cols && r >= 0 && r < rows) { const i = r * cols + c; glyph[i] = G[j + 2]; ink[i] = G[j + 3]; bold[i] = 0; }
        }
      }
    }

    // The limbs and their twigs: crooked polylines that sway with the canopy around them.
    const limbs = [];
    const addLimb = (pts, w0, w1) => {
      const n = pts.length, len = [0];
      for (let i = 1; i < n; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      limbs.push({
        n, X: pts.map((p) => p[0]), Y: pts.map((p) => p[1]), w: len.map((d) => lerp(w0, w1, (d / len[n - 1]) ** 0.8)),
        reach: pts.map(([x, y]) => reachOf(x, y)), phase: pts.map(([x, y]) => phaseOf(x, y)), px: new Float64Array(n), py: new Float64Array(n),
      });
      return limbs[limbs.length - 1];
    };
    for (const [w0, w1, ...given] of LIMBS) {
      const pts = [given[0]];
      for (let i = 1; i < given.length; i++) { // a kink half way along each run
        const [x0, y0] = given[i - 1], [x1, y1] = given[i], k = R(-0.22, 0.22);
        pts.push([(x0 + x1) / 2 - (y1 - y0) * k, (y0 + y1) / 2 + (x1 - x0) * k], given[i]);
      }
      const lw = addLimb(pts, w0, w1).w;
      for (let i = 2; i < pts.length - 1; i++) { // twigs, to alternate sides
        if (rand() < 0.35) continue;
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], heading = Math.atan2(y1 - y0, x1 - x0) + (i % 2 ? 1 : -1) * R(0.45, 0.9);
        const len = R(0.06, 0.14), bend = R(-0.3, 0.3);
        const mid = [x0 + Math.cos(heading) * len * 0.5, y0 + Math.sin(heading) * len * 0.5], tip = [mid[0] + Math.cos(heading + bend) * len * 0.5, mid[1] + Math.sin(heading + bend) * len * 0.5];
        if (tip[1] < under(tip[0])) addLimb([pts[i], mid, tip], lw[i] * 0.45, 0.004);
      }
    }
    const woodLine = (colour) => (c, r, g) => { if (inGrid(c, r)) { const i = r * cols + c; glyph[i] = g; ink[i] = colour; bold[i] = 1; } };
    const darkWood = woodLine(BARK), midWood = woodLine(BARK + 1);
    function segment(x0, y0, x1, y1, w0, w1) {
      const c0 = colOf(x0), r0 = rowOf(y0), c1 = colOf(x1), r1 = rowOf(y1);
      if (Math.max(w0, w1) * ku < 1.4) { line(c0, r0, c1, r1, midWood); return; } // a twig: a line of glyphs
      const dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy || 1e-9, reach = Math.max(w0, w1) / 2, ll = Math.sqrt(len2);
      let nx = -dy / ll, ny = dx / ll;
      if (nx * 0.55 + ny * 0.85 > 0) { nx = -nx; ny = -ny; } // (nx, ny) points to the lit side, up and to the left
      const la = Math.max(0, Math.floor(rowOf(Math.min(y0, y1) - reach) * 2)), lb = Math.min(lines - 1, rowOf(Math.max(y0, y1) + reach) * 2);
      const ca = Math.max(0, Math.floor(colOf(Math.min(x0, x1) - reach))), cb = Math.min(cols - 1, colOf(Math.max(x0, x1) + reach));
      for (let l = la; l <= lb; l++) {
        const Y = Ys[l];
        for (let c = ca; c <= cb; c++) {
          const px = Xs[c] - x0, py = Y - y0, k = clamp01((px * dx + py * dy) / len2), ox = px - dx * k, oy = py - dy * k;
          const h = lerp(w0, w1, k) / 2;
          if (ox * ox + oy * oy > h * h) continue;
          const side = (ox * nx + oy * ny) / h; // 1 on the lit edge, -1 on the shaded one
          paint[l * cols + c] = BARK + (side > 0.3 ? 4 : side > -0.45 ? 3 : 2);
          if (l & 1) glyph[(l >> 1) * cols + c] = 32;
        }
      }
      for (const sgn of [1, -1]) { // dark outlines along both edges
        const o0 = ((sgn * w0) / 2) * 0.85, o1 = ((sgn * w1) / 2) * 0.85;
        line(colOf(x0 + nx * o0), rowOf(y0 + ny * o0), colOf(x1 + nx * o1), rowOf(y1 + ny * o1), sgn > 0 ? midWood : darkWood);
      }
    }
    function drawLimbs(t, s) {
      for (const b of limbs) {
        for (let i = 0; i < b.n; i++) { swayAt(b.reach[i], b.phase[i], t, s); b.px[i] = b.X[i] + sway[0]; b.py[i] = b.Y[i] + sway[1]; }
        for (let i = 0; i < b.n - 1; i++) segment(b.px[i], b.py[i], b.px[i + 1], b.py[i + 1], b.w[i], b.w[i + 1]);
      }
    }

    // The fragments of rock: jagged black shards in flat facets, those facing
    // the light a little less black and edged in grey, flung out from where
    // the ground was struck, at the foot of the sword below the frame. Slow at
    // first, then on arcs out through the bottom and sides (never the top),
    // all gone by T.clear. Most are in front of the sword and the gravestone.
    const struck = [axis(1.08), 1.08], te = tau(T.clear - 0.1);
    const rocks = [], glints = [];
    function fling(x, y, r) {
      const dx = x - struck[0], dy = y - struck[1], d = Math.hypot(dx, dy) || 1, speed = R(0.28, 0.6), g0 = R(0.9, 1.3);
      const room = y - high - r - 0.03; // it may not rise out of the top of the screen
      const vy = -Math.min((-dy / d) * speed * 0.8, room > 0 ? Math.sqrt(2 * g0 * room) : 0);
      const g = Math.max(g0, (2 * (low + r * 2 + 0.03 - y - vy * te)) / (te * te)); // out through the bottom by T.clear, if not the sides
      return { x, y, r, vx: (dx / d) * speed * 1.35 + R(-0.05, 0.05), vy, g };
    }
    const rock = (x, y, r, near) => { // a shard: a polygon of K corners round its middle, at uneven angles and distances
      const K = 5 + Math.floor(rand() * 3), at = Array.from({ length: K }, (_, k) => ((k + R(-0.3, 0.3)) / K) * Math.PI * 2), far = at.map(() => R(0.5, 1));
      rocks.push({
        ...fling(x, y, r), rot: R(0, 6.28), spin: R(1.2, 3.5) * (rand() < 0.5 ? -1 : 1), tumble: R(1.5, 4), tp: R(0, 6.28),
        grow: R(0, 0.25), front: near || rand() < 0.7, at, px: at.map((a, k) => Math.cos(a) * far[k]), py: at.map((a, k) => Math.sin(a) * far[k]),
      });
    };
    for (const [x, y, r] of BOULDERS) rock(x, y, r, true); // as in the source image, all in front
    const area = (right - left) * (Math.min(low, 1.05) - Math.max(high, -0.15));
    for (let i = 0, n = Math.round(24 * area); i < n; i++) { // dozens more, smaller, thicker near the sword
      const x = rand() < 0.5 ? R(left, right) : axis(0.8) + R(-0.5, 0.5), y = rand() < 0.6 ? R(Math.max(high, -0.1), Math.min(low, 1.02)) : R(0.45, Math.min(low, 1.02));
      rock(x, y, 0.004 + 0.013 * rand() ** 2);
    }
    for (let i = 0, n = Math.round(9 * area); i < n; i++) {
      const x = R(left, right), y = R(Math.max(high, 0.2), Math.min(low, 1.02));
      glints.push({ ...fling(x, y, 0.005), glyph: [HIGH, DOT, STAR][i % 3] });
    }
    const lit = new Int8Array(8), facetX = new Float64Array(8), facetY = new Float64Array(8); // per facet, for the shard being drawn: its tone, and which way it faces
    function drawRock(f, tt) {
      const sc = 1 + f.grow * tt, rr = f.r * sc, cx = f.x + f.vx * tt, cy = f.y + f.vy * tt + 0.5 * f.g * tt * tt;
      if (cy - rr > low || cx + rr < left || cx - rr > right) return;
      const ang = f.rot + f.spin * tt, ca = Math.cos(ang), sa = Math.sin(ang), tum = 0.7 + 0.3 * Math.abs(Math.cos(f.tp + f.tumble * tt));
      const hide = f.front ? 3 : 1, K = f.at.length;
      for (let k = 0; k < K; k++) { // each facet, from the middle out to one edge, is flat: lit if that edge faces the light, up and to the left
        const j = (k + 1) % K, nx = f.py[j] - f.py[k], ny = f.px[k] - f.px[j], n = Math.hypot(nx, ny) || 1, X = (nx * ca - ny * sa) / n, Y = (nx * sa + ny * ca) / n;
        const toward = -0.6 * X - 0.8 * Y;
        lit[k] = toward > 0.35 ? 2 : toward > -0.2 ? 1 : 0; facetX[k] = X; facetY[k] = Y;
      }
      const facet = (X, Y) => { // the facet (X, Y) is on, or -1 outside the shard
        const dx = X - cx, dy = Y - cy, px = (dx * ca + dy * sa) / (tum * rr), py = (-dx * sa + dy * ca) / rr;
        let phi = Math.atan2(py, px), k = K - 1;
        if (phi < f.at[0]) phi += Math.PI * 2;
        while (k > 0 && f.at[k] > phi) k--;
        const j = (k + 1) % K;
        return (f.px[j] - f.px[k]) * (py - f.py[k]) - (f.py[j] - f.py[k]) * (px - f.px[k]) >= 0 ? k : -1;
      };
      if (rr * u < 0.45) { // smaller than a cell: one mark
        const c = Math.floor(colOf(cx)), r = Math.floor(rowOf(cy));
        if (!inGrid(c, r) || front[r * 2 * cols + c] >= hide) return;
        glyph[r * cols + c] = [CARET, HIGH, DOT, COMMA][Math.floor(ang * 2) & 3]; ink[r * cols + c] = ROCK; bold[r * cols + c] = 1;
        return;
      }
      const la = Math.max(0, Math.floor(rowOf(cy - rr) * 2)), lb = Math.min(lines - 1, rowOf(cy + rr) * 2);
      const ca0 = Math.max(0, Math.floor(colOf(cx - rr))), cb0 = Math.min(cols - 1, colOf(cx + rr));
      for (let l = la; l <= lb; l++) {
        for (let c = ca0; c <= cb0; c++) {
          const i = l * cols + c, k = facet(Xs[c], Ys[l]);
          if (k < 0 || front[i] >= hide) continue;
          const edgeLit = lit[k] === 2 && facet(Xs[c] + facetX[k] * 0.6 / ku, Ys[l] + facetY[k] * 0.3 / u) < 0; // the lit edge itself catches the light
          paint[i] = edgeLit ? STONE + 1 : ROCK + lit[k];
        }
      }
      for (let r = Math.max(0, Math.floor(rowOf(cy - rr))); r <= Math.min(rows - 1, rowOf(cy + rr)); r++) {
        const Y = (r + 0.5 - top) / u;
        for (let c = ca0; c <= cb0; c++) {
          const i = r * cols + c, k = facet(Xs[c], Y);
          if (k < 0 || front[r * 2 * cols + c] >= hide) continue;
          const rim = lit[k] === 2 && rr * u >= 1.2 && facet(Xs[c] + facetX[k] / ku, Y + facetY[k] / u) < 0; // a lit edge, outlined where the shard is big enough
          glyph[i] = rim ? edge(facetX[k], facetY[k]) : 32; ink[i] = STONE + 2; bold[i] = 1;
        }
      }
    }

    // Petals. Each leaves the canopy at t0 from (x0, y0) on the screen, z0
    // away, and falls toward the camera at v. Seen from below, a point falling
    // straight down moves out from the point overhead, (zx, zy), and grows as
    // it comes: at story time s it is at zenith + (p0 - zenith) * m, m = z0 / z,
    // and it looks PETAL_SIZE / z long.
    const zy = Math.min(ZENITH, high - 0.12), zx = axis(zy);
    const cdf = [0];
    for (let s = 0; s < T.quiet; s += 0.01) cdf.push(cdf[cdf.length - 1] + intensity(s + 0.005) * 0.01);
    const when = (p) => { // the moment by which a share p of all the shower's petals have let go
      const target = p * cdf[cdf.length - 1];
      let lo = 0, hi = cdf.length - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cdf[mid] < target) lo = mid; else hi = mid; }
      return (lo + (target - cdf[lo]) / (cdf[hi] - cdf[lo] || 1)) * 0.01;
    };
    // They leave the canopy anywhere from near the point overhead, out of
    // sight above the top of a wide screen, to its lower edge, and only those
    // that will fall into view are kept. Those from high up come in at the
    // top already near and large, and cross quickly; those from low down are
    // far and small, and soon fall out of the bottom. From CLEAR on, none
    // passes near the sword, so that the eye finds the one petal on its guard.
    const CLEAR = T.drop - 0.2;
    const enters = (x, y) => { const m = Math.max(1, (high - zy) / (y - zy)), X = zx + (x - zx) * m; return X > left - 0.05 && X < right + 0.05; };
    const petals = [];
    for (let i = 0, n = Math.round(750 * (right - left) * (low - high)); i < n; i++) {
      const t0 = when((i + rand()) / n), z0 = R(1.5, 3.2), size = PETAL_SIZE / z0, v = R(0.8, 1.2);
      let x0, y0, end;
      for (;;) {
        x0 = R(left - 0.1, right + 0.1); y0 = R(zy + 0.14, under(x0) - 0.01);
        if (!enters(x0, y0)) continue;
        const ex = x0 - zx, ey = y0 - zy;
        let m = (low - zy) / (ey - 1.4 * size); // how far out it is when it has left the screen, flutter and all: out of the bottom...
        if (ex > 2.2 * size) m = Math.min(m, (right - zx) / (ex - 2.2 * size)); else if (ex < -2.2 * size) m = Math.min(m, (left - zx) / (ex + 2.2 * size)); // ...or a side
        end = t0 + (z0 - z0 / Math.max(1, m)) / v;
        // Seen from below, it moves straight out from the point overhead, as the sword's line does, so it is nearest the sword when it is farthest off.
        const at = Math.max(t0, CLEAR);
        if (end > CLEAR && (Math.abs(x0 - axis(y0)) * z0) / (z0 - v * (at - t0)) < 0.22) continue;
        break;
      }
      petals.push({
        t0, x0, y0, z0, v, end, tone: [4, 5, 6, 6, 7, 7, 7][Math.floor(rand() * 7)],
        sway: R(0.6, 1.6), freq: R(2.5, 5), phase: R(0, 6.28), rot: R(0, 6.28), spin: R(-3, 3), flipF: R(3, 7),
      });
    }

    // Draw a petal at (X, Y), `len` long in frame heights, turned to `angle`,
    // its width squeezed by `flip` as it tumbles: a flat oval with a notch at
    // its tip, paler on one side and deeper at its base, outlined in deeper
    // pink once it is large. Half cells marked in `front` at or above `hide`
    // are in front of it.
    function drawPetal(X, Y, len, angle, flip, tone, hide, spin) {
      const cc = colOf(X), rr = rowOf(Y);
      if (cc < -len * ku || cc > cols + len * ku || rr < -len * u || rr > rows + len * u) return;
      if (len * u < 0.3) { // much smaller than a cell: a mark that tumbles
        const c = Math.floor(cc), r = Math.floor(rr);
        if (!inGrid(c, r) || front[r * 2 * cols + c] >= hide || front[(r * 2 + 1) * cols + c] >= hide) return;
        glyph[r * cols + c] = PETAL[Math.floor(spin) & 3]; ink[r * cols + c] = PINK + Math.min(7, tone + 2); bold[r * cols + c] = 0;
        return;
      }
      const a = len / 2, b = Math.max(0.25, Math.abs(flip)) * len * 0.31, ca = Math.cos(angle), sa = Math.sin(angle);
      const la = Math.max(0, Math.floor((rr - a * u) * 2)), lb = Math.min(lines - 1, (rr + a * u) * 2);
      const c0 = Math.max(0, Math.floor(cc - a * ku)), c1 = Math.min(cols - 1, cc + a * ku);
      let drawn = false;
      const shape = (X1, Y1) => {
        const dx = X1 - X, dy = Y1 - Y, p = dx * ca + dy * sa, q = -dx * sa + dy * ca, e = (p / a) ** 2 + (q / b) ** 2;
        return e > 1 || (p > a * 0.62 && Math.abs(q) < b * 0.28) ? -1 : e; // the notch at its tip
      };
      for (let l = la; l <= lb; l++) {
        for (let c = c0; c <= c1; c++) {
          const i = l * cols + c;
          if (front[i] >= hide || shape(Xs[c], Ys[l]) < 0) continue;
          const dx = Xs[c] - X, dy = Ys[l] - Y, p = dx * ca + dy * sa, q = -dx * sa + dy * ca;
          paint[i] = PINK + Math.max(0, Math.min(7, q * flip < 0 ? tone + 1 : p < -a * 0.55 ? tone - 2 : tone));
          glyph[(l >> 1) * cols + c] = 32; // whatever was drawn in its cell is behind it, petals' outlines and all
          drawn = true;
        }
      }
      if (!drawn) { // too thin to cover the middle of any half cell: paint the one it is in
        const c = Math.floor(cc), l = Math.floor(rr * 2);
        if (c >= 0 && c < cols && l >= 0 && l < lines && front[l * cols + c] < hide) paint[l * cols + c] = PINK + tone;
        return;
      }
      if (len * u < 4) return; // a smaller one has too few cells to give any to an outline
      const dx1 = 1 / ku, dy1 = 1 / u; // a cell across and a row down, in frame heights
      for (let r = Math.max(0, Math.floor(rr - a * u)); r <= Math.min(rows - 1, rr + a * u); r++) { // the outline, round its outermost cells
        const Y1 = (r + 0.5 - top) / u;
        for (let c = c0; c <= c1; c++) {
          const X1 = Xs[c];
          if (front[r * 2 * cols + c] >= hide || shape(X1, Y1) < 0) continue;
          if (shape(X1 - dx1, Y1) >= 0 && shape(X1 + dx1, Y1) >= 0 && shape(X1, Y1 - dy1) >= 0 && shape(X1, Y1 + dy1) >= 0) continue;
          const dx = X1 - X, dy = Y1 - Y, p = dx * ca + dy * sa, q = -dx * sa + dy * ca;
          const gp = p / (a * a), gq = q / (b * b), nx = gp * ca - gq * sa, ny = gp * sa + gq * ca, nl = Math.hypot(nx, ny) || 1;
          const i = r * cols + c;
          glyph[i] = edge(nx / nl, ny / nl); ink[i] = PINK + Math.max(0, tone - 5); bold[i] = 0;
        }
      }
    }
    function drawPetals(s) {
      for (const p of petals) {
        if (s < p.t0 || s >= p.end) continue;
        const age = s - p.t0, z = p.z0 - p.v * age, m = p.z0 / z, len = PETAL_SIZE / z, fl = len * p.sway;
        const X = zx + (p.x0 - zx) * m + fl * Math.sin(age * p.freq + p.phase), Y = zy + (p.y0 - zy) * m + fl * 0.5 * Math.cos(age * p.freq * 0.7 + p.phase);
        drawPetal(X, Y, len, p.rot + p.spin * age, Math.cos(age * p.flipF + p.phase), p.tone, z > STONE_Z ? 1 : z > SWORD_Z ? 2 : 3, age * 6 + p.phase);
      }
    }

    // The one petal that settles on the guard beside the cyan band: it drifts
    // down over the trunk, rocking, lands on the guard's right shoulder, rests,
    // slides along the rim and drops off.
    const HERO = 0.04, landA = -0.4, offA = 0.55, rimAt = (a) => [gx + Math.cos(a) * GUARD_R[0] * 1.02, gy + Math.sin(a) * GUARD_R[1] * 1.15];
    const [lx, ly] = rimAt(landA), [ox, oy] = rimAt(offA), start = [lx + 0.06, Math.max(0.2, high + 0.04)];
    function hero(s) {
      if (s < T.drop) return;
      let X, Y, angle, flip, len = HERO;
      if (s < T.touch) {
        const k = (s - T.drop) / (T.touch - T.drop), e = 1 - (1 - k) ** 2;
        X = lerp(start[0], lx, e) + 0.03 * (1 - k) * Math.sin(k * 9); Y = lerp(start[1], ly, e);
        angle = 0.5 * Math.sin(k * 7) * (1 - k) + 0.3 * k; flip = lerp(Math.cos(k * 8), 1, k * k);
      } else if (s < T.slip) {
        X = lx; Y = ly; flip = 1;
        angle = 0.3 + 0.12 * Math.exp(-(s - T.touch) * 10) * Math.sin((s - T.touch) * 30); // it settles
      } else if (s < T.slip + 0.4) {
        const k = ((s - T.slip) / 0.4) ** 2, [x, y] = rimAt(lerp(landA, offA, k));
        X = x; Y = y; flip = 1; angle = lerp(0.3, 1.2, k);
      } else {
        const a = s - T.slip - 0.4; // it drops toward the ground, and so toward the camera: out from the point overhead, growing
        X = ox + 0.03 * a + 0.012 * Math.sin(a * 5); Y = oy + 0.05 * a + 0.45 * a * a; angle = 1.2 + a * 2; flip = Math.cos(a * 6); len = HERO * (1 + 0.8 * a);
      }
      drawPetal(X, Y, len, angle, flip, 5, 3, s * 5);
    }

    // The last heavy fall: petals near the camera come out from the point
    // overhead on a front that sweeps the screen, and where it has passed the
    // page shows. It sets out from the point overhead at START, out of sight
    // above the screen, so that the petals ahead of it fall into view from
    // the top; it reaches the screen at T.hand and has crossed it by DONE.
    // Distances from the point overhead are measured with X squeezed by KX,
    // so that it reaches the sides and the bottom together. The cyan band
    // goes last, from its ends in.
    const KX = 0.75, rof = (X, Y) => Math.hypot((X - zx) * KX, Y - zy);
    const r0 = rof(Math.max(left, Math.min(right, zx)), high); // the nearest the screen comes to the point overhead
    const r1 = Math.max(rof(left, low), rof(right, low), rof(left, high), rof(right, high)) + 0.25; // beyond its farthest corner, by more than a petal
    const DONE = T.end - 0.35, k0 = (r0 / r1) ** (2 / 3), START = T.hand - ((DONE - T.hand) * k0) / (1 - k0);
    const reach = (s) => r1 * clamp01((s - START) / (DONE - START)) ** 1.5; // how far out the front is at story time s: faster and faster, as things coming nearer do
    const wipe = new Float32Array(N);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const Y = (r + 0.5 - top) / u, d = rof(Xs[c], Y), phi = Math.atan2(Y - zy, (Xs[c] - zx) * KX);
      const ragged = 1 + 0.1 * (noise(phi * 13 + 3, d * 7) - 0.5) + 0.06 * (noise(phi * 5, 1) - 0.5); // a scalloped edge, like the petals that make it
      wipe[r * cols + c] = Math.max(T.hand + 0.03, START + (DONE - START) * clamp01((d * ragged) / r1) ** (2 / 3));
    }
    const alone = bandCells.map((i) => wipe[i]); // when the front leaves the band alone in its cells
    const cs = bandCells.map((j) => j % cols), mid = (Math.min(...cs) + Math.max(...cs)) / 2, wing = Math.max(1, (Math.max(...cs) - Math.min(...cs)) / 2);
    for (const i of bandCells) wipe[i] = T.end - 0.02 - 0.15 * clamp01(Math.abs((i % cols) - mid) / wing); // the band goes from its ends in
    const aMin = Math.atan2(high - zy, (right - zx) * KX) - 0.1, aMax = Math.atan2(high - zy, (left - zx) * KX) + 0.1;
    const hand = Array.from({ length: Math.round(70 * (aMax - aMin)) }, () => ({ // most of them on the front, hiding its edge; the rest ahead of it and trailing it
      a: R(aMin, aMax), lag: rand() < 0.55 ? R(-0.05, 0.05) : R(-0.2, 0.25), k: R(0.11, 0.21), tone: [4, 5, 6, 6, 7, 7, 7][Math.floor(rand() * 7)],
      rot: R(0, 6.28), spin: R(-4, 4), flipF: R(4, 8),
    }));
    function handover(s) {
      for (let i = 0; i < N; i++) {
        if (wipe[i] > s) continue;
        glyph[i] = 32; ink[i] = 0; bold[i] = 0;
        const c = i % cols, l = ((i / cols) | 0) * 2;
        paint[l * cols + c] = 0; paint[(l + 1) * cols + c] = 0;
      }
      bandCells.forEach((i, j) => { // what shares the band's cells goes with the front
        if (alone[j] > s) return;
        const c = i % cols, l = ((i / cols) | 0) * 2;
        paint[l * cols + c] = 0; paint[(l + 1) * cols + c] = 0;
      });
      for (const p of hand) {
        const at = s - p.lag;
        if (at < START) continue;
        const d = reach(at), X = zx + (d * Math.cos(p.a)) / KX, Y = zy + d * Math.sin(p.a), age = at - START;
        drawPetal(X, Y, p.k * d, p.rot + p.spin * age, Math.cos(age * p.flipF + p.rot), p.tone, 3, age * 8);
      }
      for (const i of band) { const cell = ((i / cols) >> 1) * cols + (i % cols); if (wipe[cell] > s) paint[i] = CYAN; }
      for (const i of bandCells) if (wipe[i] > s) { glyph[i] = EQUALS; ink[i] = CYAN + 1; bold[i] = 1; }
    }

    return {
      cols, rows, palette, glyph, ink, bold, paint,
      render(t) { // t: seconds since the animation started
        if (t >= LENGTH) { glyph.fill(32); ink.fill(0); bold.fill(0); paint.fill(0); return this; } // over: nothing is left on the page
        const s = t * SPEED; // where that is in the story
        paint.set(back); glyph.set(backGlyph); ink.set(backInk); bold.fill(0);
        const shake = Math.round(0.006 * shudder(s) * Math.sin(shakeAt(s)) * ku); // the trunk shakes too, a little
        drawClumps(behind, t, s); blit(trunkP, shake); drawLimbs(t, s); drawClumps(before, t, s);
        blit(stoneP); blit(swordP);
        const pulse = 0.5 + 0.5 * Math.sin((t * Math.PI * 2) / 2.2); // a slow, soft pulse on the screen's clock
        palette[GLOW] = `rgb(${Math.round(lerp(28, 40, pulse))},${Math.round(lerp(62, 92, pulse))},${Math.round(lerp(72, 104, pulse))})`;
        for (const i of halo) paint[i] = GLOW;
        if (s < T.clear + 0.2) {
          const tt = tau(s);
          for (const f of rocks) drawRock(f, tt);
          for (const g of glints) {
            const c = Math.floor(colOf(g.x + g.vx * tt)), r = Math.floor(rowOf(g.y + g.vy * tt + 0.5 * g.g * tt * tt));
            if (inGrid(c, r)) { glyph[r * cols + c] = g.glyph; ink[r * cols + c] = WHITE; bold[r * cols + c] = 1; }
          }
        }
        drawPetals(s);
        hero(s);
        if (s >= START - 0.2) handover(s); // the petals ahead of the front set out before it
        return this;
      },
    };
  }

  // Play it on the stage. Resolves when it has finished. `seed` changes the
  // canopy's clumps, the smaller fragments and the petals; `freezeAt` holds one
  // moment (in seconds) on screen instead of playing. Reduced motion holds the
  // first moment, the fragments hanging in the air.
  const film = { length: LENGTH, still: 0.1, grid: [150, 60], createScene };
  return { play: (options) => AsciiStage.play(film, options), createScene };
})();
