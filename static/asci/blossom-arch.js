/*
 * Under the blossom arch: an ASCII loading screen.
 *
 *   <script src="ascii-stage.js"></script>
 *   <script src="blossom-arch.js"></script>
 *   <script>BlossomArch.play().then(showThePage);</script>
 *
 * A Chinese ink-wash painting in white mist, grey-black ink, pink and red
 * blossom and a little gold. Two figures stand side by side with their backs
 * to us on a grey path under an arch of plum blossom, with tall pale
 * mountains in the mist beyond them. On the left the shorter one, in layered
 * white robes, long black hair blowing left and a pale oil-paper parasol
 * tilted back over the shoulder; on the right the taller one, in long black
 * robes with wide sleeves and thin gold trim, long black hair tied up at the
 * crown and hanging down the back. A breeze from the right ripples robes and
 * hair to the left, petals fall from the arch and the mist drifts left. They
 * take their first step together and walk away side by side; the mist rises
 * round them from the ground up, they turn to pale grey shadows and fade into
 * it together. The path lies empty under the falling petals, then a gust from
 * the arch thickens into a stream of petals that carries the picture away to
 * the left and thins to nothing to show the page. Five seconds (LENGTH, below).
 *
 * The camera never moves. The whole of it is a pure function of time:
 * createScene().render(t) fills a grid of characters and the colours behind
 * them, and the stage (ascii-stage.js) paints that grid on a canvas.
 */
const BlossomArch = (() => {
  'use strict';
  const { code, clamp01, lerp, smooth, mulberry32, hash, noise } = AsciiStage;

  // The story's timeline, in the seconds of the user's description.
  const T = {
    step: 2.0,   // both take their first step, at the same moment
    mist: 4.5,   // the mist starts thickening round them from the ground up
    pale: 8.0,   // they turn to pale grey silhouettes
    gone: 9.5,   // and have faded into the mist together: the path is empty
    gust: 9.6,   // a gust from the arch sends its petals streaming left
    full: 10.45, // the petals have covered the picture
    clear: 10.6, // and thin away, from the right, to show the page
    end: 11.3,
  };
  // It is played faster than that. LENGTH is how many seconds the whole of it
  // takes on screen, and SPEED how many times faster than the story that is.
  const LENGTH = 5, SPEED = T.end / LENGTH;

  const BREEZE = 0.3; // waves a second running out along their robes and hair
  const DRIFT = 0.02; // screen heights a second that the mist drifts to the left
  const PACE = 10;    // each second they walk 1/PACE of their first distance from us, so they are 70% of their size at 6.5 s

  // Colours. `swatch` adds a run of colours to INK and gives the index of the first.
  const INK = ['#000000'];
  const swatch = (...colours) => INK.push(...colours) - colours.length;
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const ramp = (stops, x) => { // the colour at x on a ramp of [place, colour] stops
    let i = 1;
    while (i < stops.length - 1 && x > stops[i][0]) i++;
    const [a, from] = stops[i - 1], [b, to] = stops[i], k = clamp01((x - a) / (b - a)), A = rgb(from), B = rgb(to);
    return '#' + A.map((v, j) => Math.round(v + (B[j] - v) * k).toString(16).padStart(2, '0')).join('');
  };
  // Ink on paper, from the cool grey-black of the ink to the white of the mist.
  const GREY = [[0, '#13121c'], [0.15, '#22212e'], [0.3, '#393845'], [0.45, '#5a5a66'], [0.6, '#83848e'], [0.75, '#acaeb5'], [0.88, '#d3d6d9'], [1, '#f3f6f5']];
  const NL = 32; // steps of grey
  const TONE = swatch(...Array.from({ length: NL }, (_, i) => ramp(GREY, i / (NL - 1))));
  const BLOOM = swatch('#5c1c3a', '#7a2149', '#972353', '#b3235c', '#c92d69', '#dc3f7a', '#e9588e', '#f271a1', '#f88bb3', '#fba3c4', '#fdbbd3', '#ffd2e2'); // the plum blossom's pinks, deep to pale
  const RED = swatch('#6e1222', '#931b2d', '#b5263a', '#d03d4b', '#e6636c', '#f28c90'); // red blossom, deep to light
  const GOLD = swatch('#5e4a26', '#8a6d33', '#b8933f', '#dcbd6c'); // the trim on the black robe, dull to bright
  const SKIN = swatch('#f7e6dc'); // a hand on the parasol's handle
  const SEAL = swatch('#7f1d1c', '#a52a26', '#bd3f35'); // the painter's seal: its rim, its body, a lighter fleck
  // The pink that floods the screen in the gust, in 16 strengths (FLOOD + 1 to
  // FLOOD + 16), as the plum blossom's does: a deep pink laid ever more thickly
  // over the scene, solid at 8, then paling to the final pink.
  const FLOOD = swatch(...Array.from({ length: 16 }, (_, i) => (i < 7 ? `rgba(150,34,88,${(i + 1) / 8})`
    : `rgb(${[150, 34, 88].map((v, j) => Math.round(v + ([247, 141, 180][j] - v) * ((i - 7) / 8))).join(',')})`))) - 1;
  const tone = (L) => TONE + Math.max(0, Math.min(NL - 1, Math.round(L * (NL - 1))));
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  const [BAR, SLASH, BACK, LOW, DASH, HIGH, TICK, COMMA, DOT, WAVE, STAR, COLON, RING, AT] = code("|/\\_-'`,.~*:o@");
  const PETAL = [HIGH, COMMA, TICK, DOT], WHOLE = [STAR, AT, STAR, RING], CORE = [AT, AT, STAR], BODY = [AT, STAR, STAR, RING], GRAIN = code(':!;');

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

  function createScene({ cols, rows, aspect = 2, seed = 1 }) {
    const rand = mulberry32(seed), R = (a, b) => a + (b - a) * rand();
    const H2 = rows * 2, N = cols * H2;     // the picture is cols x H2 half cells, each roughly square
    const U = rows * aspect, Wu = cols / U; // columns to one screen height, and the screen's width in screen heights
    const hw = Wu / 2;
    const X = (c) => (c + 0.5) / U - hw, Y = (h) => (h + 0.5) / H2; // a half cell's place, across from the middle and down from the top, in screen heights
    const C = (x) => (x + hw) * U; // and back from across to columns
    const glyph = new Uint8Array(cols * rows), ink = new Uint8Array(cols * rows), bold = new Uint8Array(cols * rows);
    const wash = new Uint8Array(cols * rows), paint = new Uint8Array(N);

    // The description is of an upright picture. On a wide screen that picture
    // fills the height and the world goes on to either side; on a narrow one it
    // is scaled by Z to fit the width, with more mist above and ground below.
    // FY places a height in the picture on the screen; BY one measured up from its foot.
    const Z = Math.min(1, Wu / 0.7), FY = (y) => 0.5 + (y - 0.5) * Z, BY = (y) => 1 - (1 - y) * Z;
    // The taller one's height when they start, where they stand, and the eye
    // level: walking away on level ground, they shrink toward it.
    const F0 = 0.46 * Z, FEET = FY(0.875), EYE = FY(0.5);

    // The grain of the brush: a fixed threshold for each half cell, for dithering between tones.
    const thr = new Float32Array(N);
    for (let h = 0, p = 0; h < H2; h++) for (let c = 0; c < cols; c++, p++) thr[p] = ((BAYER[(h & 3) * 4 + (c & 3)] + 0.5) / 16 + 0.7 * hash(c, h + 7)) % 1;
    const dither = (L, p) => { const l = Math.floor(L * (NL - 1) + thr[p]); return TONE + (l < 0 ? 0 : l > NL - 1 ? NL - 1 : l); };

    // ---- The still scene behind them: how light each half cell is before the
    // mist drifts over it, how much mist can lie over it, how far below the top
    // of the mist it is, and what it is.
    const base = new Float32Array(N), fogW = new Float32Array(N), rise = new Float32Array(N), kind = new Uint8Array(N);
    const SKY = 0, PEAK = 1, GROUND = 2;
    const mistTop = Float32Array.from({ length: cols }, (_, c) => EYE - 0.08 * Z + 0.07 * Z * (noise((X(c) * 3) / Z + 40, seed) - 0.5) + 0.03 * Z * (noise((X(c) * 9) / Z, seed + 3) - 0.5));
    for (let h = 0, p = 0; h < H2; h++) { // a pale sky, whitest down in the mist
      const y = Y(h);
      for (let c = 0; c < cols; c++, p++) {
        base[p] = lerp(0.86, 0.975, smooth(0, EYE, y)) + 0.025 * (noise(X(c) * 5 + 9, y * 8) - 0.5);
        fogW[p] = 1; rise[p] = y - mistTop[c];
      }
    }
    // Tall pale peaks: [across, top, half width at the foot on the left and on
    // the right, ink at the ridge]. Three stand behind the two of them as in the
    // picture, with a paler one far off between them; wider screens get more
    // ranges either side.
    const spires = [[-0.25, 0.16, 0.13, 0.1, 0.6], [0.03, 0.25, 0.07, 0.09, 0.76], [0.23, 0.12, 0.1, 0.15, 0.64], [-0.07, 0.33, 0.1, 0.06, 0.84]]
      .map(([x, top, wl, wr, L]) => [x * Z, FY(top), wl * Z, wr * Z, L]);
    for (const side of [-1, 1]) for (let x = side * 0.58; Math.abs(x) < hw + 0.2; x += side * R(0.42, 0.6)) {
      spires.push([x, R(0.12, 0.24), R(0.1, 0.16), R(0.1, 0.16), R(0.64, 0.74)]);
      if (rand() < 0.6) spires.push([x + side * R(0.12, 0.2), R(0.24, 0.34), R(0.06, 0.1), R(0.06, 0.1), R(0.78, 0.86)]);
    }
    spires.sort((a, b) => b[4] - a[4]); // the palest, farthest, first, so the darker stand in front
    for (const [x0, top, wl, wr, ridge] of spires) {
      const sd = rand() * 100, foot = EYE + 0.08 * Z;
      const jag = (y, o) => 1 + 0.35 * (noise((y * 14) / Z, sd + o) - 0.5) + 0.15 * (noise((y * 50) / Z, sd + o + 3) - 0.5); // crags and ledges along each flank
      for (let h = Math.max(0, Math.ceil(top * H2)); h < H2; h++) {
        const y = Y(h), k = (y - top) / (foot - top);
        if (k > 1.3) break;
        const w = Math.max(0, k) ** 0.5, left = x0 - wl * w * jag(y, 0), right = x0 + wr * w * jag(y, 9);
        for (let c = Math.max(0, Math.ceil(C(left) - 0.5)), e = Math.min(cols - 1, Math.floor(C(right) - 0.5)); c <= e; c++) {
          const p = h * cols + c, x = X(c), edge = Math.min(x - left, right - x) * U; // columns in from its outline
          // dark at the ridge and washing out into the mist below, streaked down its faces, the lit side to the left
          base[p] = lerp(ridge - 0.05 * clamp01((x0 - x) / wl), 0.965, smooth(0.1, 1.2, k)) + 0.07 * (noise((x * 55) / Z, (y * 4) / Z + sd) - 0.5) - (edge < 1.5 && k < 0.7 ? 0.05 : 0);
          kind[p] = PEAK;
        }
      }
    }
    // The ground, seen in perspective: the grey path they stand on, running off
    // into the mist, pale ground either side, and darker washes of ink nearer us.
    for (let h = 0; h < H2; h++) {
      const y = Y(h);
      if (y <= EYE + 0.004) continue;
      const q = (FEET - EYE) / (y - EYE); // how far off, as a multiple of where they stand
      for (let c = 0; c < cols; c++) {
        const p = h * cols + c, g = (X(c) * q) / Z; // across, at their distance
        const blot = noise(g * 6 + 30, q * 3), fine = noise(g * 24 + 3, q * 12 + 7), streak = noise(g * 40 + 9, q * 1.5);
        const way = Math.abs(g - 0.02) - 0.34 - 0.14 * (noise(q * 2.2, 17) - 0.5) - 0.08 * (blot - 0.5); // inside the path where negative
        const path = 0.66 + 0.16 * (blot - 0.5) + 0.08 * (fine - 0.5) + 0.12 * (streak - 0.5);
        let L = lerp(path, 0.87 + 0.12 * (blot - 0.5) + 0.05 * (fine - 0.5), smooth(-0.05, 0.07, way + 0.06 * (fine - 0.5)));
        L -= 0.12 * smooth(0.95, 0.6, q) * smooth(0.45, 0.75, blot);
        L = lerp(L, 0.965, smooth(1.1, 2.6, q));
        base[p] = L; kind[p] = GROUND; fogW[p] = 1 - Math.exp(-Math.max(0, q - 1.2) * 2.2); rise[p] = 1;
      }
    }
    // The scene's own strokes, where a whole cell is one thing: streaks down the
    // peaks, marks on the ground; and petals lying on the ground.
    const mark = new Uint8Array(cols * rows), markInk = new Uint8Array(cols * rows);
    for (let r = 0, i = 0; r < rows; r++) for (let c = 0; c < cols; c++, i++) {
      const p = (r * 2 + 1) * cols + c, k = kind[p], n = hash(c, r + 101), m = hash(r, c + 202);
      if (k !== kind[p - cols] || k === SKY) continue;
      if (k === PEAK && n < 0.1) { mark[i] = m < 0.7 ? BAR : m < 0.85 ? HIGH : COLON; markInk[i] = tone(base[p] - 0.14); }
      else if (k === GROUND && n < 0.08) { mark[i] = [LOW, DASH, DOT, COMMA, HIGH][(m * 5) | 0]; markInk[i] = tone(base[p] - 0.16); }
    }
    for (let n = Math.round((cols * rows) / 110); n--; ) {
      const c = (rand() * cols) | 0, r = Math.floor(lerp(EYE + 0.05, 0.999, rand() ** 0.7) * rows);
      if (r < rows) { mark[r * cols + c] = PETAL[(rand() * 4) | 0]; markInk[r * cols + c] = rand() < 0.55 ? RED + 1 + ((rand() * 3) | 0) : BLOOM + 5 + ((rand() * 4) | 0); }
    }
    // Splatters of ink flicked across the paper, along the bottom and up in the
    // sky, clear of the two of them: a drop and a spray of specks round it. They
    // have their own random numbers, so that they leave the rest of the picture as it is.
    const fleck = mulberry32(seed * 7 + 3);
    for (let n = Math.round(4 + (cols * rows) / 900); n--; ) {
      const x = lerp(-hw, hw, fleck()), y = fleck() < 0.6 ? lerp(FEET + 0.03, 1, fleck()) : lerp(0.03, EYE - 0.12, fleck());
      if (Math.abs(x) < 0.8 * F0) continue;
      for (let k = Math.round(3 + 5 * fleck()); k--; ) {
        const c = Math.floor(C(x) + (fleck() - 0.5) * (1 + k) * 1.4), r = Math.floor(y * rows + (k ? (fleck() - 0.5) * 2.4 : 0));
        if (c >= 0 && c < cols && r >= 0 && r < rows) { mark[r * cols + c] = k ? PETAL[(fleck() * 4) | 0] : RING; markInk[r * cols + c] = tone(0.12 + 0.2 * fleck()); }
      }
    }

    // ---- What stands in front of them, which never moves: the trunk of the
    // arch, the rocks along the bottom and the thin branch. The colour of each
    // half cell (0 where there is none of it), and its characters.
    const front = new Uint8Array(N), fGlyph = new Uint8Array(cols * rows), fInk = new Uint8Array(cols * rows), fBold = new Uint8Array(cols * rows);
    const solid = new Uint8Array(cols * rows); // 1 where both halves of a cell are in front: whatever is behind has no character there

    // Wood from (x0, y0) to (x1, y1), wa to wb wide: every half cell within its
    // width inked, lit from the upper left, with dry-brush streaks, and a
    // grain of characters that follows it.
    function limb(x0, y0, x1, y1, wa, wb) {
      const reach = Math.max(wa, wb) / 2 + 1 / H2, dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy || 1e-9;
      const grain = Math.abs(dx * U) <= Math.abs(dy * rows) * 1.3 ? BAR : Math.abs(dy * rows) > 0.35 * Math.abs(dx * U) ? (dx * dy < 0 ? SLASH : BACK) : DASH;
      for (let h = Math.max(0, Math.floor((Math.min(y0, y1) - reach) * H2)); h <= Math.min(H2 - 1, Math.ceil((Math.max(y0, y1) + reach) * H2)); h++) {
        for (let c = Math.max(0, Math.floor(C(Math.min(x0, x1) - reach))); c <= Math.min(cols - 1, Math.ceil(C(Math.max(x0, x1) + reach))); c++) {
          const px = X(c) - x0, py = Y(h) - y0, k = clamp01((px * dx + py * dy) / len2), ox = px - dx * k, oy = py - dy * k;
          const half = Math.max(lerp(wa, wb, k) / 2, 0.55 / H2);
          if (ox * ox + oy * oy > half * half) continue;
          const p = h * cols + c, lit = -(ox + oy) / (half * 1.42);
          front[p] = dither(0.06 + 0.08 * (lit + 1) + (noise(c * 0.35, h * 0.2 + 70) > 0.68 ? 0.1 : 0) + 0.04 * (hash(c, h + 31) - 0.5), p);
          const r = h >> 1, j = r * cols + c;
          if (hash(c, r + 41) < 0.4) { fGlyph[j] = hash(r, c + 43) < 0.15 ? GRAIN[(hash(c, r) * 3) | 0] : grain; fInk[j] = tone(0.3); fBold[j] = 1; }
        }
      }
    }

    // The arch: a dark trunk rising from the lower left and bending over the
    // top to the right, where it runs off the edge. Its knots are placed by the
    // screen's width, so that it always spans it.
    const edge = lerp(-0.015, 0.13, smooth(0.3, 0.9, hw)), xl = -hw + edge, xr = hw + 0.08, span = xr - xl;
    const top = 0.075, root = BY(0.93);
    const knots = [[xl, root], [xl + 0.05 * Z, lerp(root, top, 0.45)], [xl + 0.14 * Z, lerp(root, top, 0.82)],
      [xl + 0.28 * Z + 0.1 * span, top + 0.012], [xl + 0.55 * span, top - 0.004], [xl + 0.82 * span, top + 0.06 * Z], [xr, top + 0.27 * Z]];
    const pts = []; // a Catmull-Rom curve through the knots
    for (let i = 0; i < knots.length - 1; i++) {
      const a = knots[Math.max(0, i - 1)], b = knots[i], c = knots[i + 1], d = knots[Math.min(knots.length - 1, i + 2)];
      for (let j = 0; j < 30; j++) {
        const k = j / 30, k2 = k * k, k3 = k2 * k;
        pts.push([0, 1].map((e) => 0.5 * (2 * b[e] + (c[e] - a[e]) * k + (2 * a[e] - 5 * b[e] + 4 * c[e] - d[e]) * k2 + (3 * b[e] - a[e] - 3 * c[e] + d[e]) * k3)));
      }
    }
    pts.push(knots[knots.length - 1]);
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = cum[cum.length - 1];
    const spineAt = (a) => { // the point a of the way along the arch, and which way it runs there
      const s = a * total;
      let i = 1;
      while (i < pts.length - 1 && cum[i] < s) i++;
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], l = cum[i] - cum[i - 1] || 1, k = clamp01((s - cum[i - 1]) / l);
      return [lerp(x0, x1, k), lerp(y0, y1, k), (x1 - x0) / l, (y1 - y0) / l];
    };
    // its width: it flares at the root, swells where it bends over at the top right, and thins toward the end
    const girth = (a) => Z * (0.016 + 0.052 * (1 - a) ** 1.3 + 0.03 * Math.exp(-a / 0.05) + 0.012 * Math.exp(-(((a - 0.68) / 0.1) ** 2)));
    for (let i = 0; i < pts.length - 1; i++) limb(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], girth(cum[i] / total), girth(cum[i + 1] / total));
    // A thin bare branch lying across the lower right, up to the right edge, with a kink and a twig.
    const kink = [hw - 0.17 * Z, 1 - 0.21 * Z];
    limb(hw - 0.36 * Z, 1 + 0.01, kink[0], kink[1], 0.013 * Z, 0.009 * Z);
    limb(kink[0], kink[1], hw + 0.03, 1 - 0.43 * Z, 0.009 * Z, 0.005 * Z);
    limb(hw - 0.11 * Z, 1 - 0.29 * Z, hw - 0.15 * Z, 1 - 0.36 * Z, 0.004 * Z, 0.002 * Z);

    // Rocks along the bottom: [across, half width, top, how much of it is flat
    // on top]. Low ledges of dark ink, the lit side to the left, washed with
    // white. Two stand either side of the path as in the picture (kept on a
    // narrow screen, where they go to its corners), one at the trunk's root;
    // wider screens get a few more.
    const rocks = [[-0.42, 0.14, 0.84, 0.45], [-0.25, 0.06, 0.94, 0.3], [0.4, 0.12, 0.9, 0.45], [0.2, 0.05, 0.97, 0.3]]
      .map(([x, w, t, f]) => [Math.max(-hw + 0.5 * w * Z, Math.min(hw - 0.5 * w * Z, x * Z)), w * Z, BY(t), f]);
    rocks.push([xl + 0.02 * Z, 0.09 * Z, BY(0.88), 0.35]);
    for (const side of [-1, 1]) for (let x = side * 0.64 * Z; Math.abs(x) < hw + 0.1; x += side * R(0.3, 0.5)) rocks.push([x, R(0.05, 0.1), BY(R(0.88, 0.95)), R(0.2, 0.6)]);
    for (let c = 0; c < cols; c++) {
      const x = X(c);
      let crest = 2, which = null;
      for (const rock of rocks) {
        const [rx, rw, rt, flat] = rock, d = Math.abs(x - rx) / rw;
        if (d >= 1) continue;
        const y = rt + (1.03 - rt) * Math.max(0, (d - flat) / (1 - flat)) ** 1.4 + 0.018 * Z * (noise((x * 18) / Z, rx * 7) - 0.5);
        if (y < crest) { crest = y; which = rock; }
      }
      if (!which) continue;
      const lit = clamp01((which[0] - x) / which[1]);
      for (let h = Math.max(0, Math.floor(crest * H2)); h < H2; h++) {
        const y = Y(h);
        if (y < crest) continue;
        const p = h * cols + c;
        let L = 0.1 + 0.12 * noise((x * 26) / Z, (y * 22) / Z) + 0.09 * lit + 0.04 * (hash(c, h + 3) - 0.5);
        if ((y - crest) * H2 < 1.2) L = 0.38; // the top catches the light
        else if (noise((x * 12) / Z + 50, (y * 12) / Z + 50) > 0.72) L = 0.8; // a wash of white on the stone
        front[p] = dither(L, p);
        const r = h >> 1, j = r * cols + c;
        if (h & 1 && Y(h - 1) >= crest) { // a crack, a fleck of moss, a fallen petal
          const n = hash(c, r + 311), m = hash(r, c + 313);
          if (n < 0.1) { fGlyph[j] = [LOW, SLASH, BACK, DOT, COLON][(m * 5) | 0]; fInk[j] = tone(L + 0.16); }
          else if (n < 0.13) { fGlyph[j] = m < 0.5 ? COMMA : DOT; fInk[j] = RED + 2 + ((m * 7) % 3 | 0); }
        }
      }
    }
    for (let i = 0; i < cols * rows; i++) solid[i] = front[(((i / cols) | 0) * 2) * cols + (i % cols)] && front[(((i / cols) | 0) * 2 + 1) * cols + (i % cols)] ? 1 : 0;
    // The painter's seal, a small red block near the right edge.
    const sw = Math.max(2, Math.round(0.022 * Z * U)), sh = Math.max(3, Math.round(0.034 * Z * H2));
    const sc = cols - sw - Math.max(1, Math.round(0.02 * Z * U)), st = Math.max(0, Math.round((1 - 0.2 * Z) * H2) - sh), seal = [];
    for (let h = st; h < Math.min(H2, st + sh); h++) for (let c = Math.max(0, sc); c < sc + sw; c++) seal.push(h * cols + c, h === st || h === st + sh - 1 || c === sc || c === sc + sw - 1 ? SEAL : hash(c, h + 5) < 0.25 ? SEAL + 2 : SEAL + 1);

    // ---- The blossom on the arch, and its twigs, which sway. A twig leaves
    // the arch at (x, y), points along `angle` (radians, y down) for `len`,
    // bends by `bend` along its length and sways by `sway`. A puff of blossom
    // sits on the arch, or some way `at` along a twig `on`.
    const twigs = [], puffs = [];
    const twig = (x, y, angle, len, sway) => twigs.push({ x, y, angle, len, bend: R(0.1, 0.3) * (Math.cos(angle) > 0 ? 1 : -1), sway, phase: R(0, 6.28) }) - 1;
    const twigAt = (tw, k, s) => { // the point k of the way along a twig at time s
      const a = tw.angle + tw.sway * (Math.sin(s * 1.25 + tw.phase) + 0.4 * Math.sin(s * 2.9 + tw.phase * 2)) + tw.bend * k * 0.5;
      return [tw.x + Math.cos(a) * tw.len * k, tw.y + Math.sin(a) * tw.len * k];
    };
    // A puff: full flowers at the heart, looser toward the rim, lit from the
    // upper left, soft pink or now and then red. Every cell is one blossom:
    // [across, down, glyph, colour, colour behind it, bold, when the gust takes it].
    const puff = (x, y, radius, on = -1, at = 1, red = rand() < 0.15) => {
      const ry = Math.max(1.25, radius * rows), rx = Math.max(1.6, radius * U * 0.85), light = R(2, 4.5), cells = [];
      for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
        const e = Math.hypot(dx / rx, dy / ry) + R(-0.15, 0.15), rim = e >= 0.82 && dy !== 0;
        if (e > 1.12 || (rim && (Math.abs(dx) < rx * 0.4 || rand() < 0.35))) continue;
        const level = light - (dx / rx + dy / ry) * 1.6 + R(-1, 1);
        const colour = red ? RED + Math.max(1, Math.min(5, Math.round(level * 0.8))) : BLOOM + 4 + Math.max(0, Math.min(7, Math.round(level)));
        cells.push(dx, dy, e < 0.45 ? CORE[(rand() * 3) | 0] : !rim ? BODY[(rand() * 4) | 0] : dy < 0 ? DOT : dx < 0 ? TICK : HIGH,
          colour, rim ? 0 : Math.max(red ? RED : BLOOM, colour - 2), e < 0.45 ? 1 : 0, rand());
      }
      puffs.push({ x, y, on, at, cells });
    };
    // Clouds of it along the arch, each a handful of puffs, some red: few and
    // small up the trunk, thick and close over the top right, with bare wood between.
    for (let a = 0.12; a < 1; a += R(0.035, 0.08) / (0.6 + 0.8 * smooth(0.3, 0.7, a))) {
      const [x, y, tx, ty] = spineAt(a), size = lerp(0.55, 1.25, smooth(0.2, 0.7, a)) * R(0.7, 1.2), red = rand() < 0.22;
      for (let n = Math.round(R(3, 7) * size); n--; ) {
        const along = R(-0.045, 0.045) * size * Z, off = (rand() < 0.5 ? -1 : 1) * (girth(a) * 0.25 + R(0, 0.07) * size * Z);
        puff(x + tx * along + ty * off, y + ty * along - tx * off, R(0.028, 0.058) * Z * (0.75 + 0.25 * size), -1, 1, red ? rand() < 0.7 : rand() < 0.06);
      }
    }
    for (let a = 0.05; a < 0.24; a += R(0.05, 0.08)) { // short boughs off the rising trunk
      const [x, y] = spineAt(a), w = twig(x, y, -Math.PI / 2 + (rand() < 0.5 ? -1 : 1) * R(0.5, 1), R(0.08, 0.14) * Z, 0.03);
      puff(0, 0, R(0.025, 0.04) * Z, w, 0.6); puff(0, 0, R(0.03, 0.045) * Z, w, 1);
    }
    for (let a = 0.32; a < 1; a += R(0.05, 0.1)) { // and twigs hanging from it, longer toward the right where more blossom hangs
      const [x, y] = spineAt(a), w = twig(x, y + girth(a) / 3, Math.PI / 2 + R(0.05, 0.3), R(0.06, 0.14) * Z * (a > 0.72 ? 1.8 : 1), 0.06);
      puff(0, 0, R(0.018, 0.028) * Z, w, 0.5); puff(0, 0, R(0.02, 0.032) * Z, w, 0.8); puff(0, 0, R(0.024, 0.038) * Z, w, 1);
    }

    // Petals falling from the arch, a few at a time, down and to the left. Each
    // leaves a blossom at t0 and lies where it lands; some are already down.
    // Some are a whole half cell of colour, the rest a mark.
    const falling = [];
    for (let n = Math.max(12, Math.round((cols * rows) / 130)); n--; ) {
      const f = puffs[(rand() * puffs.length) | 0], [x0, y0] = f.on < 0 ? [f.x, f.y] : twigAt(twigs[f.on], f.at, 0);
      falling.push({
        t0: R(-10, T.end), x0: x0 + R(-0.02, 0.02) * Z, y0: y0 + R(-0.01, 0.02) * Z, vx: -R(0.015, 0.05), vy: R(0.05, 0.09),
        amp: R(0.004, 0.012), freq: R(1.5, 3), phase: R(0, 6.28), land: R(Math.max(y0 + 0.05, EYE + 0.04), 1.02),
        ink: rand() < 0.45 ? RED + 2 + ((rand() * 4) | 0) : BLOOM + 5 + ((rand() * 6) | 0), whole: rand() < 0.15, flat: rand() < 0.35,
      });
    }
    const gustX = (s) => (s > T.gust ? 0.9 * (s - T.gust) ** 2 : 0); // how far the gust has swept everything loose to the left

    // ---- The two of them, in their own units: u across from the middle of the
    // pair and v down from the top of the taller one's head to the ground, in
    // the taller one's heights. The black robe stands at BU, the white at WU,
    // and the shorter one is WS as tall.
    const BU = 0.22, WU = -0.2, WS = 0.86;
    const BHAIR = 1, BROBE = 2, BTRIM = 3, SOLE = 4, WHAIR = 5, WROBE = 6, WOUTER = 7, WLAYER = 8, CANOPY = 9, HAND = 10;
    const BLACKS = (1 << BROBE) | (1 << BTRIM), WHITES = (1 << WROBE) | (1 << WOUTER) | (1 << WLAYER);
    const TAILS = [[0.5, R(0.24, 0.32), R(0, 6.28)], [0.72, R(0.28, 0.36), R(0, 6.28)]]; // loose ends of the white robes: [how far down, how long, phase]
    const part = new Uint8Array(N), lum = new Float32Array(N), col = new Uint8Array(N), tex = new Float32Array(N), cover = new Float32Array(N);
    let ph = 0, lift = 0, right = 0; // the breeze's phase, how high the moving foot is, and which foot

    // The taller one, at a across from the middle of the back and b down from
    // the top of the head, in its heights.
    function black(a, b) {
      if (b < -0.04 || b > 1.06 || a < -0.48 || a > 0.5) return 0;
      if ((a / 0.03) ** 2 + ((b - 0.012) / 0.024) ** 2 < 1) return BHAIR; // the knot at the crown
      if ((a / 0.064) ** 2 + ((b - 0.078) / 0.066) ** 2 < 1) return BHAIR;
      const end = 0.52 + 0.015 * Math.sin(ph * 0.9 + 1); // the rest of the hair hangs straight down the back, its ends lifting left
      if (b > 0.07 && b < end) {
        const mid = -0.025 * smooth(0.3, end, b) * (1.2 + Math.sin(ph * 1.2 - b * 12));
        if (Math.abs(a - mid) < 0.054 + 0.022 * smooth(0.1, 0.2, b) - 0.05 * smooth(0.36, end, b)) return BHAIR;
      }
      if (b < 0.135 + 0.5 * Math.max(0, Math.abs(a) - 0.12) ** 1.2) return 0; // broad square shoulders, rounded at the ends
      // a wide left sleeve hanging from the shoulder out toward the other one,
      // rippling left in the breeze, its cuff slanting back up to the body
      const ripple = 0.02 * Math.sin(ph - b * 10) * smooth(0.25, 0.5, b);
      if (a < -0.1 && a > -0.16 - 0.26 * smooth(0.16, 0.5, b) - ripple && b < 0.5 + 0.1 * clamp01((a + 0.42) / 0.26)) return BROBE;
      // the robe: down the right arm nearly straight, then out to the ground,
      // trailing behind on the right; its hem ripples, flicks left, and lifts over the moving foot
      const hem = 1 + 0.012 * Math.sin(ph * 1.3 + a * 20) + 0.035 * smooth(0, 0.4, a) - ((a > 0) === !!right ? 0.025 * lift : 0);
      const left = -0.14 - 0.12 * smooth(0.45, 1, b) - 0.035 * smooth(0.8, 1, b) * (1.3 + Math.sin(ph * 1.3 - 1));
      const side = 0.15 + 0.03 * smooth(0.2, 0.55, b) + 0.1 * smooth(0.55, 1, b) + 0.12 * smooth(0.78, 1, b) + 0.008 * Math.sin(ph - b * 10 + 1);
      if (a >= left && a <= side && b <= hem) return BROBE;
      if (lift > 0.25 && b > hem && b < 1.035 && Math.abs(a - (right ? 0.05 : -0.05)) < 0.035) return SOLE; // the heel of the foot pushing off
      return 0;
    }

    // The shorter one, at a across and b down from the top of the head, in its own heights.
    function white(a, b) {
      if (b < -0.03 || b > 1.06 || a < -0.9 || a > 0.3) return 0;
      if ((a / 0.055) ** 2 + ((b - 0.078) / 0.075) ** 2 < 1) return WHAIR;
      if (((a - 0.115) / 0.034) ** 2 + ((b - 0.165) / 0.028) ** 2 < 1) return HAND; // on the parasol's handle, at the right shoulder
      if (a < 0.02) { // the hair streams out to the left from the back of the head
        const q = (0.02 - a) / 0.5;
        if (q <= 1 && Math.abs(b - (0.1 + 0.15 * q + 0.04 * q * Math.sin(ph * 1.15 - q * 7))) < 0.046 * (1 - q) ** 1.2 + 0.008) return WHAIR;
      }
      if (Math.abs(a) < 0.048 && b > 0.07 && b < 0.2) return WHAIR;
      if (b < 0.17 + 0.45 * Math.max(0, Math.abs(a) - 0.045) ** 1.1) return 0;
      // an inner robe to the ground, and over it an outer one the breeze carries out to the left
      const coreL = -0.1 - 0.06 * smooth(0.3, 1, b), coreR = 0.1 + 0.05 * smooth(0.3, 1, b) + 0.05 * smooth(0.18, 0.26, b) * (1 - smooth(0.36, 0.46, b));
      const hem = 1 + 0.01 * Math.sin(ph * 1.4 + a * 24) - ((a > -0.03) === !!right ? 0.025 * lift : 0);
      if (a >= coreL && a <= coreR && b <= hem) return b > 0.92 && a < 0.0 ? WLAYER : WROBE;
      if (lift > 0.25 && b > hem && b < 1.035 && Math.abs(a - (right ? 0.03 : -0.08)) < 0.035) return SOLE;
      const billow = 0.34 * smooth(0.22, 0.5, b) * (1 - 0.4 * smooth(0.6, 0.95, b)) * (1 + 0.18 * Math.sin(ph - b * 8));
      if (a < coreL && a > coreL - billow && b <= 0.95 - (0.3 * (coreL - a)) / Math.max(0.02, billow)) return WOUTER; // its lower edge sweeps up as it goes out
      for (const [b0, len, phase] of TAILS) { // two loose ends trailing out on the wind
        const q = (coreL - 0.02 - a) / len;
        if (q >= 0 && q <= 1 && Math.abs(b - (b0 + 0.07 * q + 0.035 * q * Math.sin(ph * 1.3 - q * 8 + phase))) < 0.034 * (1 - q) + 0.007) return WOUTER;
      }
      return 0;
    }

    // The parasol, tilted back over the right shoulder so that its top faces
    // us: an ellipse, higher on the right, that bobs with each step, with its
    // knob a little above the middle. Gives how far out a point is (1 at the rim).
    const PR = [0.27, 0.15], TILT = -0.25, knob = [0, 0];
    function canopy(a, b) {
      const ca = 0.02, cb = -0.035 - 0.025 * lift, tilt = TILT + 0.03 * lift * (right ? 1 : -1), cs = Math.cos(tilt), sn = Math.sin(tilt);
      knob[0] = ca - 0.015; knob[1] = cb - 0.035;
      const dx = a - ca, dy = b - cb;
      return ((dx * cs + dy * sn) / PR[0]) ** 2 + ((dy * cs - dx * sn) / PR[1]) ** 2;
    }

    // Where they are at time s: how many steps they have walked (easing into an
    // even pace of a step a second), how large that makes them, and where they stand.
    const walk = (s) => {
      const w = Math.max(0, s - T.step), walked = w < 0.5 ? w * w : w - 0.25, k = 1 / (1 + walked / PACE);
      return [w, walked, F0 * k, EYE + (FEET - EYE) * k];
    };
    // How far up them the mist has come, in their heights from the ground.
    const climbAt = (s) => -0.1 + 0.85 * smooth(T.mist, T.pale, s) + 0.3 * smooth(T.pale, T.gone, s);

    function drawFigures(s) {
      const [w, walked, unit, ground] = walk(s); // screen heights to one height of the taller one, and where they stand
      lift = w > 0 ? Math.sin(Math.PI * (walked % 1)) : 0; right = Math.floor(walked) % 2;
      ph = s * BREEZE * 2 * Math.PI;
      const bob = 0.012 * lift, shift = (right ? 1 : -1) * 0.008 * lift; // each step lifts them a little, and their weight goes onto the other foot
      // How much of the trim's gold and the parasol's ribs is lost, how far they
      // are pale grey shadows, how far gone; and how lost in the mist a part of
      // them `up` off the ground is.
      const climb = climbAt(s), dull = smooth(T.mist + 0.8, T.pale - 0.6, s), pale = smooth(T.pale, T.pale + 0.6, s), haze = smooth(T.pale + 0.4, T.gone, s);
      const fogOn = (up, p) => Math.max(haze, clamp01((climb - up) / 0.35 + (tex[p] - 0.5) * 1.6));
      const vOf = (h) => 1 + bob - (ground - Y(h)) / unit;
      const h0 = Math.max(0, Math.floor((ground - 1.12 * unit) * H2)), h1 = Math.min(H2 - 1, Math.ceil((ground + 0.08 * unit) * H2));
      const c0 = Math.max(0, Math.floor(C(-0.95 * unit))), c1 = Math.min(cols - 1, Math.ceil(C(0.78 * unit)));
      for (let h = h0; h <= h1; h++) {
        const v = vOf(h), wb = (v - 1) / WS + 1;
        for (let c = c0; c <= c1; c++) {
          const u = X(c) / unit - shift, wa = (u - WU) / WS;
          part[h * cols + c] = canopy(wa, wb) < 1 ? CANOPY : black(u - BU, v) || white(wa, wb);
        }
      }
      for (let h = h0; h <= h1; h++) for (let c = c0; c <= c1; c++) { // the gold trim: the hem and cuffs of the black robe, and its collar
        const p = h * cols + c;
        if (part[p] !== BROBE) continue;
        const a = X(c) / unit - shift - BU, b = vOf(h);
        if ((h + 1 < H2 && part[p + cols] !== BROBE && part[p + cols] !== BTRIM) || (b < 0.165 && Math.abs(a) < 0.1)) part[p] = BTRIM;
      }
      const edgeOf = (p, set) => !((set >> part[p - 1]) & 1) || !((set >> part[p + 1]) & 1) || !((set >> part[p - cols]) & 1) || !((set >> part[p + cols]) & 1);
      for (let h = h0; h <= h1; h++) { // their colours, as the story has them, lost in the mist from the ground up
        const v = vOf(h), up = 1 - v;
        for (let c = c0; c <= c1; c++) {
          const p = h * cols + c, what = part[p];
          if (!what) continue;
          const u = X(c) / unit - shift;
          let L = 0.05, gold = 0;
          if (what === BROBE) { // a wash of dark grey ink, lit from the left, with darker folds down it
            const a = u - BU, fold = Math.sin(a * 44 + Math.sin(v * 5 + 1) * 1.5);
            L = edgeOf(p, BLACKS) ? 0.1 : 0.2 + 0.12 * clamp01((0.15 - a) / 0.45) + 0.04 * (noise(c * 0.3, h * 0.12) - 0.5) - (fold > 0.7 ? 0.07 : 0);
          } else if (what === BTRIM) { L = 0.45; gold = GOLD + 2; }
          else if (what === WROBE || what === WOUTER || what === WLAYER) { // white silk with grey shadows, outlined in grey ink
            const a = (u - WU) / WS;
            L = edgeOf(p, WHITES | (1 << HAND)) ? 0.52 : what === WLAYER ? 0.78 : what === WOUTER ? 0.89 + 0.05 * noise(c * 0.4, h * 0.25) : 0.94 - 0.1 * clamp01((a + 0.02) / 0.14);
          } else if (what === CANOPY) { // oiled paper, pale and lit from the upper left, with a darker rim
            const a = (u - WU) / WS - 0.02, b = (v - 1) / WS + 1 + 0.035;
            L = edgeOf(p, 1 << CANOPY) ? 0.56 : 0.93 - 0.13 * clamp01(0.5 + a / PR[0] * 0.5 + b / PR[1] * 0.5);
          } else if (what === SOLE) L = 0.3;
          else if (what === HAND) { L = 0.9; gold = SKIN; }
          L = lerp(L, 0.74, pale);
          const f = fogOn(up, p);
          lum[p] += (L - lum[p]) * (1 - f);
          cover[p] = f;
          col[p] = gold && f < 0.3 && pale < 0.3 ? (gold === SKIN ? SKIN : dull < 0.35 ? gold : dull < 0.7 ? GOLD + 1 : 0) : 0;
        }
      }
      for (let h = h0; h <= h1; h++) for (let c = c0; c <= c1; c++) if (part[h * cols + c]) glyph[(h >> 1) * cols + c] = 32; // nothing behind them shows through

      // Their characters, each faded like the half cell it sits in: folds,
      // gold lines, hair, the parasol's ribs.
      const brush = (L, gold, need, heavy) => (c, r, ch) => {
        if (c < 0 || c >= cols || r < 0 || r >= rows) return;
        const p = (r * 2 + 1) * cols + c, i = r * cols + c;
        if (need && !((need >> part[p]) & 1) && !((need >> part[p - cols]) & 1)) return;
        const f = fogOn(1 - vOf(r * 2 + 1), p);
        if (f > 0.4 || pale > 0.45) return;
        glyph[i] = ch; ink[i] = gold || tone(lerp(L, lum[p], f * 1.5)); bold[i] = heavy;
      };
      const atB = (a, b) => [C((BU + a + shift) * unit), (ground - (1 - b + bob) * unit) * rows];
      const atW = (a, b) => [C((WU + a * WS + shift) * unit), (ground - (1 - (1 - WS + b * WS) + bob) * unit) * rows];
      const B = (a0, b0, a1, b1, put) => { const [c, r] = atB(a0, b0), [e, q] = atB(a1, b1); line(c, r, e, q, put); };
      const W = (a0, b0, a1, b1, put) => { const [c, r] = atW(a0, b0), [e, q] = atW(a1, b1); line(c, r, e, q, put); };
      const fold = brush(0.08, 0, BLACKS, 0), sheen = brush(0.24, 0, 1 << BHAIR, 0), loose = brush(0.06, 0, 0, 1);
      B(-0.1, 0.19, -0.15, 0.58, fold); B(-0.2, 0.26, -0.34, 0.47, fold); B(0.11, 0.58, 0.2, 0.96, fold); B(-0.13, 0.63, -0.2, 0.96, fold);
      if (dull < 0.6) { const trim = brush(0, GOLD + 3, BLACKS, 1); B(-0.06, 0.58, -0.09, 0.985, trim); B(0.04, 0.6, 0.065, 0.99, trim); }
      B(0, 0.1, -0.012, 0.46, sheen); B(0.03, 0.15, 0.026, 0.42, sheen);
      const lip = Math.sin(ph * 1.2); // loose strands of both heads of hair, lifting left
      B(-0.04, 0.1, -0.13, 0.14 + 0.02 * lip, loose); B(-0.04, 0.44, -0.1, 0.52 + 0.02 * lip, loose);
      W(-0.48, 0.24 + 0.03 * lip, -0.66, 0.27 + 0.05 * lip, loose); W(-0.4, 0.27, -0.56, 0.33 + 0.04 * lip, loose);
      const crease = brush(0.6, 0, WHITES, 0);
      W(0.04, 0.3, 0.0, 0.95, crease); W(-0.1, 0.32, -0.3, 0.6, crease); W(-0.12, 0.56, -0.4, 0.8, crease);
      if (dull < 0.6) { // the parasol's ribs, from the knob out to the rim
        const rib = brush(0.58, 0, 1 << CANOPY, 0), tilt = TILT + 0.03 * lift * (right ? 1 : -1), [ka, kb] = knob;
        for (let j = 0; j < 12; j++) {
          const q = (j / 12) * 2 * Math.PI + 0.2, ex = Math.cos(q) * PR[0] * 0.94, ey = Math.sin(q) * PR[1] * 0.94;
          W(ka, kb, 0.02 + ex * Math.cos(tilt) - ey * Math.sin(tilt), -0.035 - 0.025 * lift + ex * Math.sin(tilt) + ey * Math.cos(tilt), rib);
        }
        const [c, r] = atW(ka, kb);
        brush(0.3, 0, 1 << CANOPY, 1)(Math.floor(c), Math.floor(r), RING);
      }
    }

    // ---- Each frame: the light of every half cell, a colour where it is not
    // grey, the drifting mist's texture, and how hidden by mist it is.
    const reach = Math.ceil(DRIFT * T.end * U) + 2, TW = cols + reach, o = R(0, 99);
    const fogTex = new Float32Array(TW * H2);
    for (let h = 0; h < H2; h++) for (let i = 0; i < TW; i++) {
      const x = (i + 0.5) / U / Z, y = Y(h) / Z;
      fogTex[h * TW + i] = 0.55 * noise(o + x * 6, y * 14) + 0.3 * noise(o + x * 15, 9 + y * 32) + 0.15 * noise(o + x * 36, 3 + y * 70);
    }

    function drawBank(s) { // the mist thickening round them from the ground up, over everything behind them
      const amt = smooth(T.mist - 0.3, T.mist + 2, s);
      if (!amt) return;
      const [, , unit, ground] = walk(s), climb = climbAt(s);
      const crest = ground - (climb + 0.15) * unit, foot = ground + 0.04 * unit + 0.03 * Z, half = 0.9 * unit + 0.12 * Z;
      for (let h = Math.max(0, Math.floor((crest - 0.1) * H2)); h < Math.min(H2, Math.ceil((foot + 0.14) * H2)); h++) {
        const y = Y(h);
        for (let c = Math.max(0, Math.floor(C(-half - 0.15))); c < Math.min(cols, Math.ceil(C(half + 0.15))); c++) {
          const p = h * cols + c, tx = tex[p];
          const d = amt * smooth(crest - 0.08, crest + 0.06, y + 0.08 * (tx - 0.5)) * (1 - smooth(foot - 0.02, foot + 0.12, y)) * (1 - smooth(half * 0.5, half * 1.1, Math.abs(X(c)) + 0.1 * (tx - 0.5)));
          if (d <= 0) continue;
          lum[p] += (0.955 + 0.04 * tx - lum[p]) * d;
          if (d > cover[p]) cover[p] = d;
        }
      }
    }

    function drawPuffs(s) {
      const strip = s > T.gust ? s - T.gust : 0; // the gust strips the arch from the right
      for (const f of puffs) {
        const [x, y] = f.on < 0 ? [f.x, f.y] : twigAt(twigs[f.on], f.at, s);
        const c0 = Math.floor(C(x)), r0 = Math.floor(y * rows), gone = strip ? clamp01(strip * 2.2 - (1 - (x + hw) / Wu) * 1.2) : 0, cells = f.cells;
        for (let n = 0; n < cells.length; n += 7) {
          const c = c0 + cells[n], r = r0 + cells[n + 1];
          if (c < 0 || c >= cols || r < 0 || r >= rows || cells[n + 6] < gone) continue;
          const i = r * cols + c;
          if (cells[n + 4]) col[r * 2 * cols + c] = col[(r * 2 + 1) * cols + c] = cells[n + 4];
          glyph[i] = cells[n + 2]; ink[i] = cells[n + 3]; bold[i] = cells[n + 5];
        }
      }
    }

    function drawPetals(s, landed) { // the petals in the air, or those lying on the ground
      const swept = gustX(s);
      for (const p of falling) {
        const a = s - p.t0;
        if (a < 0) continue;
        const down = (p.land - p.y0) / p.vy, fly = Math.min(a, down);
        if ((a > down) !== landed) continue;
        const wob = p.amp * Math.min(1, fly), x = p.x0 + p.vx * fly + Math.sin(fly * p.freq + p.phase) * wob - swept;
        const y = Math.min(p.land, p.y0 + p.vy * fly + Math.cos(fly * p.freq * 0.7 + p.phase) * wob * 0.4);
        const c = Math.floor(C(x)), h = Math.floor(y * H2), r = h >> 1;
        if (c < 0 || c >= cols || h < 0 || h >= H2) continue;
        const i = r * cols + c;
        if (landed && (solid[i] || glyph[i] > 32)) continue;
        if (p.flat) col[h * cols + c] = p.ink;
        else { glyph[i] = (p.whole ? WHOLE : PETAL)[landed ? 3 : ((fly * 3 + p.phase) | 0) & 3]; ink[i] = p.ink; bold[i] = 0; }
      }
    }

    // The gale: every row is a stream of petals moving left at its own speed,
    // thickest where the gusts are, as the plum blossom's gale is. `d` is how
    // full a cell is: up to 1 it is the chance of a petal there, past 1 the cell
    // floods pink, and in the end it runs back down to nothing from the right,
    // which leaves the page showing.
    function drawGale(s) {
      const since = s - T.gust, rise = clamp01(since / (T.full - T.gust)) ** 1.5, fade = (s - T.clear) / (T.end - T.clear);
      for (let r = 0, i = 0; r < rows; r++) {
        const shift = cols * (0.32 + 0.3 * hash(r, 11)) * since + hash(r, 5) * 997;
        for (let c = 0; c < cols; c++, i++) {
          const from = 1 - c / cols, x = c + cols * 0.6 * since; // from: 0 at the right edge, where the gust comes from; gusts drift left with the wind
          const calm = 1 - noise(x * 0.025, r * 0.12) * 0.65 - noise(x * 0.09, r * 0.4 + 40) * 0.35; // 0 in the heart of a gust
          let d = rise * 3.6 - from * 0.7 - (r / rows) * 0.35 - calm;
          if (fade > 0) d = Math.min(d, 1.7 - 1.9 * smooth(0, 1, fade * 3.45 - from * 1.4 - calm * 0.7));
          const level = Math.round(smooth(0.95, 1.3, d) * 16);
          wash[i] = level ? FLOOD + level : 0;
          if (d <= 0) continue;
          const slot = Math.floor(c + shift), h = hash(slot, r), q = hash(slot, r + 4096);
          if (h < (d < 1.25 ? d : lerp(1, 0.1, smooth(1.25, 1.6, d)))) {
            if (q < smooth(0.35, 0.95, d)) { glyph[i] = BODY[(q * 977) & 3]; ink[i] = d > 1.3 ? BLOOM + 10 : h < 0.3 ? RED + 2 + ((h * 89) % 4 | 0) : BLOOM + 4 + ((h * 89) % 6 | 0); }
            else { glyph[i] = PETAL[((q * 977 + s * 5) | 0) & 3]; ink[i] = d > 1.3 ? BLOOM + 10 : BLOOM + 6 + ((h * 89) % 4 | 0); }
            bold[i] = 0;
          } else if (d > 0.95) glyph[i] = 32;
        }
      }
    }

    return {
      cols, rows, palette: INK, glyph, ink, bold, paint, wash,
      render(t) { // t: seconds since the animation started
        glyph.fill(32); ink.fill(0); bold.fill(0); paint.fill(0); wash.fill(0);
        if (t >= LENGTH) return this; // over: nothing is left on the page
        const s = t * SPEED; // where that is in the story
        if (s < T.full) { // once the petals cover everything there is nothing behind them to draw
          col.fill(0); part.fill(0);
          const fd = DRIFT * s * U, fi = Math.floor(fd), ff = fd - fi; // how far the mist has drifted, in columns
          for (let h = 0, p = 0; h < H2; h++) {
            for (let c = 0; c < cols; c++, p++) {
              const j = h * TW + c + fi, tx = fogTex[j] + (fogTex[j + 1] - fogTex[j]) * ff;
              const d = fogW[p] * smooth(-0.05, 0.07, rise[p] + 0.14 * (tx - 0.5));
              lum[p] = base[p] + (0.95 + 0.05 * tx - base[p]) * d; tex[p] = tx; cover[p] = d;
            }
          }
          drawBank(s);
          for (let i = 0, r = 0; r < rows; r++) for (let c = 0; c < cols; c++, i++) {
            if (mark[i] && Math.max(cover[r * 2 * cols + c], cover[(r * 2 + 1) * cols + c]) < 0.4) { glyph[i] = mark[i]; ink[i] = markInk[i]; }
          }
          drawPetals(s, true);
          if (s < T.gone) drawFigures(s);
          for (let p = 0; p < N; p++) if (front[p]) col[p] = front[p];
          for (let i = 0; i < cols * rows; i++) {
            if (fGlyph[i]) { glyph[i] = fGlyph[i]; ink[i] = fInk[i]; bold[i] = fBold[i]; }
            else if (solid[i]) glyph[i] = 32;
          }
          for (const tw of twigs) { // twigs, then their blossom
            const [x0, y0] = twigAt(tw, 0, s), [x1, y1] = twigAt(tw, 0.5, s), [x2, y2] = twigAt(tw, 1, s);
            const put = (c, r, ch) => { if (c >= 0 && c < cols && r >= 0 && r < rows) { const i = r * cols + c; glyph[i] = ch; ink[i] = tone(0.1); bold[i] = 1; } };
            line(C(x0), y0 * rows, C(x1), y1 * rows, put); line(C(x1), y1 * rows, C(x2), y2 * rows, put);
          }
          drawPuffs(s);
          drawPetals(s, false);
          const md = Math.floor(fd);
          for (let r = 0, i = 0; r < rows; r++) for (let c = 0; c < cols; c++, i++) { // wisps, drifting with the mist
            const p = (r * 2 + 1) * cols + c;
            if (glyph[i] !== 32 || col[p] || cover[p] < 0.6) continue;
            const slot = Math.floor((c + md) / 3);
            if (hash(slot, r * 7 + 3) < 0.035) { glyph[i] = hash(slot, r + 9) < 0.6 ? WAVE : DASH; ink[i] = tone(lum[p] - 0.1); }
          }
          for (let p = 0; p < N; p++) paint[p] = col[p] || dither(lum[p], p); // into the palette, dithered like dry brush on paper
          for (let k = 0; k < seal.length; k += 2) paint[seal[k]] = seal[k + 1];
        }
        if (s > T.gust) drawGale(s);
        return this;
      },
    };
  }

  // Play it on the stage. Resolves when it has finished. `seed` changes the
  // details, not the layout: the crags of the peaks, the rocks off to the
  // sides, the blossom and its twigs, the petals, the lie of the mist.
  // `freezeAt` holds one moment (in seconds) on screen. Reduced motion holds
  // the two of them standing under the arch before their first step.
  const film = { length: LENGTH, still: 1.2 / SPEED, createScene };
  return { play: (options) => AsciiStage.play(film, options), createScene };
})();
