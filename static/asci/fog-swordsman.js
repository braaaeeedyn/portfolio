/*
 * Swordsman in the fog: an ASCII loading screen.
 *
 *   <script src="ascii-stage.js"></script>
 *   <script src="fog-swordsman.js"></script>
 *   <script>FogSwordsman.play().then(showThePage);</script>
 *
 * A Chinese ink-wash painting in grey, charcoal and off-white. A swordsman in
 * a wide bamboo hat and a deep blue-teal robe scattered with pale blossoms
 * stands with his back to us on a rock ledge. The wind comes from the right
 * and streams his hair and sleeve to the left. Ahead of him a bank of fog
 * fills the valley, and jagged peaks rise out of it. He walks straight on
 * into the fog, which closes round him from the ground up; his colours go,
 * he is a dark shadow, then a pale one, and then the fog has him, hat last.
 * The empty scene holds a moment, then the fog thickens over it and thins
 * away from the right to show the page. Five seconds (LENGTH, below).
 *
 * The camera never moves. The whole of it is a pure function of time:
 * createScene().render(t) fills a grid of characters and the colours behind
 * them, and the stage (ascii-stage.js) paints that grid on a canvas.
 */
const FogSwordsman = (() => {
  'use strict';
  const { code, clamp01, lerp, smooth, mulberry32, hash, noise } = AsciiStage;

  // The story's timeline, in the seconds of the user's description.
  const T = {
    step: 1.5,   // he takes his first step
    mist: 3.0,   // the fog starts closing round him from the ground up
    grey: 6.0,   // his colours start to go
    fade: 8.5,   // the grey shadow of him starts to go, hat last
    gone: 9.5,   // he has gone, and the empty scene holds
    thick: 9.8,  // thicker fog starts rolling in from the right over everything
    thin: 10.25, // and behind it, from the right, the fog thins away to show the page
    end: 11.2,   // the page is showing everywhere
  };
  // It is played faster than that. LENGTH is how many seconds the whole of it
  // takes on screen, and SPEED how many times faster than the story that is.
  const LENGTH = 5, SPEED = T.end / LENGTH;

  const WIND = 0.5;   // waves a second running out along his hair and sleeve
  const FOG = 0.024;  // screen heights a second that the fog drifts to the left
  const CLOUD = 0.01; // and the clouds on the peaks, more slowly
  const PACE = 13.5;  // each second he walks 1/PACE of his first distance from us, so he is 3/4 the size by T.grey

  // Colours. `swatch` adds a run of colours to INK and gives the index of the first.
  const INK = ['#000000'];
  const swatch = (...colours) => INK.push(...colours) - colours.length;
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const along = (stops, x) => { // the colour at x on a ramp of [place, colour] stops
    let i = 1;
    while (i < stops.length - 1 && x > stops[i][0]) i++;
    const [a, from] = stops[i - 1], [b, to] = stops[i], k = clamp01((x - a) / (b - a)), A = rgb(from), B = rgb(to);
    return A.map((v, j) => v + (B[j] - v) * k);
  };
  // Ink on paper, from charcoal black to the off-white of the fog; and the
  // robe's deep blue-teal at the same lightness, up to the pale white-blue of
  // its blossoms. Every colour in the picture but the seal is a mix of the two.
  const GREY = [[0, '#0f1113'], [0.15, '#212428'], [0.3, '#3a3e43'], [0.45, '#5a5e63'], [0.6, '#83878a'], [0.75, '#adb0af'], [0.88, '#d3d4cf'], [1, '#eeede6']];
  const TEAL = [[0, '#09131a'], [0.15, '#143246'], [0.3, '#214e68'], [0.45, '#3a6b86'], [0.6, '#638ea6'], [0.75, '#97b8ca'], [0.88, '#c5dae6'], [1, '#edf4f8']];
  const NL = 24, NC = 4; // steps of lightness, and steps from grey to the full teal
  const TONE = swatch(...Array.from({ length: NL * NC }, (_, i) => {
    const L = Math.floor(i / NC) / (NL - 1), C = (i % NC) / (NC - 1), g = along(GREY, L), b = along(TEAL, L);
    return '#' + g.map((v, j) => Math.round(v + (b[j] - v) * C).toString(16).padStart(2, '0')).join('');
  }));
  const SEAL = swatch('#7a1d1a', '#a22c25', '#b8392f'); // the painter's seal: its rim, its body, a lighter fleck
  const THIN = swatch(...Array.from({ length: 8 }, (_, i) => `rgba(236,235,228,${((i + 1) / 9).toFixed(3)})`)) - 1; // fog thinning away: THIN + 1, the faintest, to THIN + 8
  const tone = (L, C = 0) => TONE + Math.max(0, Math.min(NL - 1, Math.round(L * (NL - 1)))) * NC + Math.max(0, Math.min(NC - 1, Math.round(C * (NC - 1))));
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  const [BAR, SLASH, BACK, LOW, DASH, HIGH, TICK, COMMA, DOT, WAVE, STAR, COLON] = code("|/\\_-'`,.~*:");

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
    const X = (c) => (c + 0.5) / U - Wu / 2, Y = (h) => (h + 0.5) / H2; // a half cell's place, across from the middle and down from the top, in screen heights
    const glyph = new Uint8Array(cols * rows), ink = new Uint8Array(cols * rows), bold = new Uint8Array(cols * rows), paint = new Uint8Array(N);

    // He stands in the lower middle, 0.42 of the screen's height tall (less on
    // a narrow screen, so that his streaming sleeve fits). The eye is level with
    // his shoulders, so walking away on level ground he shrinks toward them.
    // The near ground is laid out round him at his size (z).
    const F0 = 0.42 * Math.min(1, Wu / 0.62), FEET = 0.93, EYE = FEET - 0.74 * F0, z = F0 / 0.42;

    // The still scene: how light each half cell is before fog and cloud drift
    // over it, how much of the fog bank can lie over it (little on the rocks and
    // the pine slope, which stand in front of it), how far below the top of the
    // bank it is, how much the clouds on the peaks can cover it, and what it is.
    const base = new Float32Array(N), fogW = new Float32Array(N), rise = new Float32Array(N), cloudW = new Float32Array(N), kind = new Uint8Array(N);
    const SKY = 0, PEAK = 1, GROUND = 2, HILL = 3, ROCK = 4;
    const fogTop = Float32Array.from({ length: cols }, (_, c) => EYE - 0.2 * z - 0.02 + 0.08 * (noise(X(c) * 4 + 40, seed) - 0.5) + 0.03 * (noise(X(c) * 11, seed + 3) - 0.5));
    // The crests of the pine slope on the left (steep beside him, then a ridge
    // running off left into the fog) and of the rocks on the right, and the near
    // lip of the ledge across the bottom.
    const hillTop = new Float32Array(cols).fill(2), rockTop = new Float32Array(cols).fill(2), lip = new Float32Array(cols);
    for (let c = 0; c < cols; c++) {
      const x = X(c), d = (-0.12 * z - x) / z, e = (x - 0.13 * z) / z;
      if (d > 0) hillTop[c] = (d < 0.27 ? 0.925 - d * 1.05 : 0.64 + 0.03 * Math.sin((d - 0.27) * 5) + 0.07 * smooth(0.4, 1.4, d)) + 0.012 * (noise(x * 30, seed) - 0.5);
      if (e > 0) rockTop[c] = (e < 0.25 ? 0.925 - e * 0.32 : 0.845 - 0.05 * (1 - Math.exp(0.5 - e * 2)) + 0.025 * Math.sin((e - 0.25) * 6)) + 0.02 * (noise(x * 22, seed + 9) - 0.5);
      lip[c] = 0.965 + 0.02 * (noise(x * 14, seed + 4) - 0.5);
    }
    for (let h = 0, p = 0; h < H2; h++) { // overcast sky, paler toward the fog, with drifts of cloud across the peaks
      const y = Y(h);
      for (let c = 0; c < cols; c++, p++) {
        const x = X(c), band = 0.2 + 0.08 * (noise(x * 3, seed + 11) - 0.5);
        base[p] = 0.72 + 0.12 * smooth(0, fogTop[c], y) + 0.04 * (noise(x * 7, y * 12 + 5) - 0.5);
        fogW[p] = 1; rise[p] = y - fogTop[c];
        cloudW[p] = (1 - smooth(0.02, 0.11, Math.abs(y - band))) * smooth(0.3, 0.6, noise(x * 2.5 + 7, seed + 2)) * (1 - smooth(fogTop[c] - 0.1, fogTop[c] - 0.02, y));
      }
    }
    // Peaks: [across, top, half width at the fog on the left and on the right,
    // ink at the ridge]. The great dark one stands behind him with a lesser one
    // on its shoulder, a pale far one on the left, two far ones on the right.
    // Wider screens get more ranges either side, each a tall spire with lower
    // ones on its flanks: darker and nearer on the left, paler on the right.
    const spires = [[-0.3, 0.1, 0.13, 0.1, 0.5], [0.34, 0.24, 0.1, 0.16, 0.58], [0.56, 0.15, 0.12, 0.1, 0.46], [0.07, -0.08, 0.5, 0.17, 0.13], [-0.14, 0.2, 0.07, 0.06, 0.24]];
    const range = (x, top, ink) => {
      spires.push([x, top, R(0.06, 0.12), R(0.06, 0.12), ink]);
      for (const side of [-1, 1]) spires.push([x + side * R(0.07, 0.14), top + R(0.06, 0.16), R(0.05, 0.1), R(0.05, 0.1), ink + R(-0.04, 0.08)]);
    };
    for (let x = -0.72; x > -Wu / 2 - 0.2; x -= R(0.32, 0.45)) range(x, R(-0.04, 0.16), R(0.18, 0.4));
    for (let x = 0.82; x < Wu / 2 + 0.2; x += R(0.32, 0.45)) range(x, R(0.04, 0.2), R(0.32, 0.56));
    spires.sort((a, b) => b[4] - a[4]); // the palest, farthest, first, so the darker stand in front
    for (const [x0, top, wl, wr, ridge] of spires) {
      const sd = rand() * 100, foot = fogTop[Math.max(0, Math.min(cols - 1, Math.round((x0 + Wu / 2) * U)))] + 0.05, bend = wl > 0.3 ? 0.9 : 0.6;
      const jag = (y, o) => 1 + 0.45 * (noise(y * 14, sd + o) - 0.5) + 0.2 * (noise(y * 60, sd + o + 3) - 0.5); // crags and ledges along each flank
      for (let h = Math.max(0, Math.ceil(top * H2)); h < H2; h++) {
        const y = Y(h), k = (y - top) / (foot - top);
        if (k > 1.6) break;
        const w = Math.max(0, k) ** bend, left = x0 - wl * w * jag(y, 0), right = x0 + wr * w * jag(y, 9);
        for (let c = Math.max(0, Math.ceil((left + Wu / 2) * U - 0.5)), e = Math.min(cols - 1, Math.floor((right + Wu / 2) * U - 0.5)); c <= e; c++) {
          const p = h * cols + c, x = X(c), edge = Math.min(x - left, right - x) * U; // columns in from its outline
          // dark at the ridge and washing out into mist below, with strokes running down the faces
          base[p] = lerp(ridge, 0.8, smooth(0.1, 1.2, k)) + 0.06 * (noise(x * 40, y * 9 + sd) - 0.5) - (edge < 1.5 ? 0.07 : 0);
          kind[p] = PEAK;
        }
      }
    }
    for (let h = 0, p = 0; h < H2; h++) { // the near ground: the slope on the left, the rocks on the right, and the ledge he stands on going off into the fog
      const y = Y(h);
      for (let c = 0; c < cols; c++, p++) {
        const x = X(c), d = (-0.12 * z - x) / z;
        if (y > lip[c] || (y > rockTop[c] && y < hillTop[c])) {
          base[p] = 0.12 + 0.1 * noise(x * 26, y * 30) + (y - Math.min(lip[c], rockTop[c]) < 0.012 ? 0.12 : 0); // the tops of the rocks catch the light
          kind[p] = ROCK; fogW[p] = 0; cloudW[p] = 0;
        } else if (y > hillTop[c]) { // dark at the crest; beyond the steep part the ridge washes down into the fog
          base[p] = 0.08 + 0.08 * noise(x * 30, y * 22) + 0.2 * smooth(0.5, 1.4, d);
          kind[p] = HILL; rise[p] = 1; cloudW[p] = 0;
          const solid = lerp(0.45, 0.04, smooth(0.25, 0.7, d)); // how deep below the crest the ink stays dark
          fogW[p] = Math.max(0.25 * smooth(0.8, 1, y), smooth(solid, solid + 0.3, y - hillTop[c]) * 0.75);
        } else if (y > EYE) {
          const q = (FEET - EYE) / (y - EYE), g = x * q; // how far off, as a multiple of where he starts, and across
          base[p] = 0.38 - 0.14 * smooth(0.1, 0.45, Math.abs(x) / z) + 0.1 * (noise(g * 16 + 30, q * 7) - 0.5) + 0.05 * (noise(g * 40, q * 20) - 0.5);
          kind[p] = GROUND; fogW[p] = 1 - Math.exp(-Math.max(0, q - 1) * 2.6); rise[p] = 1; cloudW[p] = 0;
        }
      }
    }
    // The scene's own strokes, where a whole cell is one thing: strokes down the
    // peaks and moss dots on their ridges, cracks in the rock.
    const mark = new Uint8Array(cols * rows), markL = new Float32Array(cols * rows);
    for (let r = 0, i = 0; r < rows; r++) for (let c = 0; c < cols; c++, i++) {
      const p = (r * 2 + 1) * cols + c, k = kind[p], L = base[p], n = hash(c, r + 101), m = hash(r, c + 202);
      if (k !== kind[p - cols] || k === SKY) continue;
      if (k === PEAK && n < 0.09) { mark[i] = r > 0 && kind[p - 3 * cols] !== PEAK ? (m < 0.5 ? DOT : TICK) : m < 0.6 ? BAR : m < 0.8 ? SLASH : BACK; markL[i] = L - 0.15; }
      else if (k === HILL && n < 0.1) { mark[i] = [TICK, COMMA, DOT, BACK][(m * 4) | 0]; markL[i] = L + 0.13; }
      else if (k === ROCK && n < 0.14) { mark[i] = [LOW, DASH, SLASH, BACK, DOT, COLON][(m * 6) | 0]; markL[i] = L + 0.15; }
      else if (k === GROUND && n < 0.12 && fogW[p] < 0.5) { mark[i] = [LOW, DASH, DOT, COMMA, HIGH][(m * 5) | 0]; markL[i] = L - 0.14; }
    }

    // Pines on the slope, standing in front of the fog: dark, pointed and
    // tiered, their boughs drooping and swept a little left by the wind, on a
    // short bare trunk. Each is a list of [across, up, which part (1 trunk,
    // 2 needles), how high up the tree] in half cells from its foot. The biggest
    // stand at the top of the slope, smaller and hazier ones along the ridge.
    const pines = [];
    const plant = (d, size, haze) => {
      const c = Math.round((-0.12 * z - d * z + Wu / 2) * U - 0.5);
      if (c < -6 || c > cols + 6) return;
      const tall = size * z * H2, wide = size * z * U * 0.3, lean = R(-0.1, 0.06), crown = tall * 0.85, tiers = Math.max(2, Math.round(crown / 3.2)), px = [];
      for (let k = 0; k <= tall; k++) {
        const at = Math.round(lean * k), down = (tall - k) / crown; // down: 0 at the tip, 1 at the lowest boughs
        if (down > 1) { px.push(at, -k, 1, k / tall); continue; }
        const half = wide * down * (0.5 + 0.5 * ((down * tiers) % 1)) * (0.85 + 0.3 * hash(k, c + 31)); // each tier widest at its foot
        for (let dx = Math.round(-half * 1.15); dx <= Math.round(half * 0.9); dx++) px.push(at + dx, -k, 2, k / tall);
      }
      const foot = hillTop[Math.max(0, Math.min(cols - 1, c))] + 0.01;
      pines.push({ c, h: Math.round(foot * H2), px, L: 0.06 + 0.55 * haze, amp: Math.min(1.2, tall / 14), phase: R(0, 6.28) });
    };
    for (const [d, size] of [[0.09, 0.08], [0.14, 0.11], [0.185, 0.13], [0.225, 0.16], [0.265, 0.18], [0.31, 0.13]]) plant(d, size * R(0.9, 1.1), 0);
    for (let d = 0.42; d < (Wu / 2 - 0.12 * z) / z + 0.1; d += R(0.12, 0.25)) { // clumps along the ridge, fading into the haze
      for (let n = 1 + ((rand() * 3) | 0); n--; d += R(0.025, 0.05)) plant(d, R(0.07, 0.13), 0.5 * smooth(0.35, 1.3, d));
    }

    // The fog and the clouds: soft textures, stretched by the wind, that slide left.
    const reach = Math.ceil(FOG * T.end * U) + 2, TW = cols + reach, o = R(0, 99);
    const fogTex = new Float32Array(TW * H2), cloudTex = new Float32Array(TW * H2);
    for (let h = 0; h < H2; h++) {
      const y = Y(h);
      for (let i = 0; i < TW; i++) {
        const x = (i + 0.5) / U;
        fogTex[h * TW + i] = 0.55 * noise(o + x * 6, y * 14) + 0.3 * noise(o + x * 15, 9 + y * 32) + 0.15 * noise(o + x * 36, 3 + y * 70);
        if (y < EYE) cloudTex[h * TW + i] = 0.6 * noise(o + 50 + x * 5, 20 + y * 12) + 0.4 * noise(o + x * 13, 5 + y * 28);
      }
    }
    // The grain of the brush: a fixed threshold for each half cell, for
    // dithering between the tones; and a plain ordered one for the fog thinning
    // away at the end, which should be soft rather than grainy.
    const thr = new Float32Array(N), order = new Float32Array(N);
    for (let h = 0, p = 0; h < H2; h++) for (let c = 0; c < cols; c++, p++) {
      order[p] = (BAYER[(h & 3) * 4 + (c & 3)] + 0.5) / 16;
      thr[p] = (order[p] + 0.7 * hash(c, h + 7)) % 1; // mostly random, so no regular pattern forms in the smooth sky
    }
    // The seal, a small red block near the bottom right corner.
    const sw = Math.max(2, Math.round(0.03 * U)), sh = Math.max(3, Math.round(0.042 * H2));
    const sc = cols - sw - Math.max(1, Math.round(0.03 * U)), st = H2 - sh - Math.max(2, Math.round(0.06 * H2)), seal = [];
    for (let h = st; h < st + sh; h++) for (let c = sc; c < sc + sw; c++) seal.push(h * cols + c, h === st || h === st + sh - 1 || c === sc || c === sc + sw - 1 ? SEAL : hash(c, h + 5) < 0.25 ? SEAL + 2 : SEAL + 1);

    // The swordsman, in his own units: u across from his middle and v down from
    // the top of his hat to his soles, in his heights. His hair frays into loose
    // strands at its end; the blossoms on his robe come in sprays.
    const strands = Array.from({ length: 6 }, (_, j) => ({ spread: (j - 2.5) * R(0.015, 0.03), reach: R(1.05, 1.25), phase: R(0, 6.28) })); // loose ends of the hair
    const blossoms = []; // [u, v, glyph]: a flower, or a petal near one
    for (const [u, v] of [[0.03, 0.3], [-0.03, 0.47], [0.05, 0.63], [-0.26, 0.48], [0.13, 0.4], [-0.09, 0.76], [0.1, 0.8]]) {
      for (let n = 2 + ((rand() * 2) | 0); n--; ) {
        const bu = u + R(-0.06, 0.06), bv = v + R(-0.06, 0.06);
        blossoms.push([bu, bv, STAR]);
        for (let m = (rand() * 3) | 0; m--; ) blossoms.unshift([bu + R(-0.04, 0.04), bv + R(-0.035, 0.035), [DOT, HIGH, COMMA][(rand() * 3) | 0]]);
      }
    }
    const body = (v) => -0.1 - 0.08 * smooth(0.15, 0.6, v) - 0.04 * smooth(0.6, 0.92, v); // the robe's left side, under the sleeve
    const SWORD = 1, BOOT = 2, SOLE = 3, ROBE = 4, HAIR = 5, HAT = 6, CHAPE = 7;

    // Each frame: the light, the colour, how hidden by fog, and the texture of the fog at every half cell; what part of him is there; who owns each cell's character.
    const lum = new Float32Array(N), chroma = new Float32Array(N), cover = new Float32Array(N), tex = new Float32Array(N), alpha = new Float32Array(N);
    const part = new Uint8Array(N), own = new Uint8Array(cols * rows);

    function drawPines(s) { // each sways a little in the wind, its tip the most
      for (const tree of pines) {
        const sway = tree.amp * Math.sin(s * 1.9 + tree.phase), px = tree.px;
        for (let k = 0; k < px.length; k += 4) {
          const c = tree.c + px[k] + Math.round(sway * px[k + 3] ** 1.5), h = tree.h + px[k + 1];
          if (c < 0 || c >= cols || h < 0 || h >= H2) continue;
          const p = h * cols + c, i = (h >> 1) * cols + c, what = px[k + 2];
          lum[p] = tree.L; chroma[p] = 0; cover[p] = 0;
          if (own[i] >= 10 + what) continue; // needles hide the trunk
          own[i] = 10 + what; ink[i] = tone(tree.L + 0.16);
          glyph[i] = what === 1 ? BAR : hash(c, h >> 1) < 0.3 ? DASH : 32; // a stroke of needles here and there
        }
      }
    }

    function drawFigure(s) {
      const w = Math.max(0, s - T.step), walked = w < 0.5 ? w * w : w - 0.25; // he eases into an even pace of a step a second
      const size = 1 / (1 + walked / PACE), sy = F0 * size * H2, sx = F0 * size * U; // half rows and columns to one of his heights
      const feet = (EYE + (FEET - EYE) * size) * H2, top = feet - sy;
      const lift = w > 0 ? Math.sin(Math.PI * (walked % 1)) : 0, right = Math.floor(walked) % 2; // how high the moving foot is, and which foot
      const cx = cols / 2 + (right ? -1 : 1) * 0.012 * sx * lift; // his weight goes onto the other foot
      const ph = s * WIND * 2 * Math.PI; // the wind's waves
      const climb = -0.06 + 0.5 * smooth(T.mist, T.grey, s) + 0.1 * smooth(T.grey, T.fade, s) + 0.6 * smooth(T.fade, T.gone, s); // how far up him the fog has come
      const grey = smooth(T.grey, T.grey + 1.3, s), bloom = smooth(T.grey, T.grey + 0.7, s), pale = smooth(T.grey + 1.3, T.fade, s);
      const haze = Math.max(0.12 * smooth(T.mist, T.grey, s), smooth(T.gone - 0.25, T.gone, s));
      const fogOn = (up, p) => Math.max(haze, clamp01((climb - up) / 0.16 + (tex[p] - 0.5) * 2.4)); // how lost in the fog a part of him `up` his heights off the ground is
      const at = (u, v) => [cx + u * sx, (top + v * sy) / 2]; // a point on him, in columns and rows
      part.fill(0);

      // The sword at his left hip, sheathed, tip down and a little left, with a
      // pale fitting at the tip; it swings as he steps.
      const tilt = 0.33 + (w > 0 ? 0.06 * Math.sin(Math.PI * walked) : 0), su = -0.17, sv = 0.5, tipU = su - 0.42 * Math.sin(tilt), tipV = sv + 0.42 * Math.cos(tilt);
      for (let k = 0, n = Math.ceil(0.42 * sy * 2), wd = Math.max(1, Math.round(0.018 * sx)); k <= n; k++) {
        const c = Math.floor(cx + lerp(su, tipU, k / n) * sx), h = Math.floor(top + lerp(sv, tipV, k / n) * sy);
        for (let j = 0; j < wd; j++) if (c + j >= 0 && c + j < cols && h >= 0 && h < H2) part[h * cols + c + j] = k / n > 0.93 ? CHAPE : SWORD;
      }
      for (const b of [0, 1]) { // boots under the hem: the moving one lifts and shows its sole
        const air = b === right ? lift : 0, u0 = b ? 0.035 : -0.085, v0 = 0.9 - 0.05 * air;
        for (let h = Math.floor(top + v0 * sy); h < top + (v0 + 0.1) * sy; h++) for (let c = Math.floor(cx + u0 * sx); c < cx + (u0 + 0.05) * sx; c++) {
          if (c >= 0 && c < cols && h >= 0 && h < H2) part[h * cols + c] = air > 0.3 && h >= top + (v0 + 0.065) * sy ? SOLE : BOOT;
        }
      }
      // His hair streams left from under the hat as one sheet, thinning as it
      // goes, with waves running out along it; past its end, loose strands,
      // too fine to paint, drawn in characters.
      const sheet = (q) => 0.12 + 0.1 * q + 0.05 * q * Math.sin(ph * 1.15 - q * 7); // the middle of the sheet, q of the way out
      const tips = [];
      for (const hair of strands) {
        const pts = [];
        for (let k = 0; k <= 8; k++) { // fanning out from the end of the sheet
          const q = lerp(0.85, hair.reach, k / 8);
          pts.push(0.05 - 0.47 * q, sheet(q) + hair.spread * (q - 0.85) * 3 + 0.012 * q * Math.sin(ph * 1.3 - q * 9 + hair.phase));
        }
        tips.push(pts);
      }
      const h0 = Math.max(0, Math.floor(top) - 1), h1 = Math.min(H2 - 1, Math.ceil(feet) + 1);
      const c0 = Math.max(0, Math.floor(cx - 0.52 * sx)), c1 = Math.min(cols - 1, Math.ceil(cx + 0.3 * sx));
      const sleeveEnd = 0.66 + 0.02 * Math.sin(ph + 2);
      const out = (v) => clamp01((v - 0.15) / 0.3) * (1 - clamp01((v - sleeveEnd + 0.1) / 0.1)); // how far the sleeve streams out at v: it hangs from his arm in a long slant
      for (let h = h0; h <= h1; h++) { // hat, hair falling down his back, and the robe, with the sleeve and hem rippling
        const v = (h + 0.5 - top) / sy;
        const left = Math.min(body(v), -0.12 - (0.3 + 0.035 * Math.sin(ph - v * 12)) * out(v)) - 0.02 * smooth(0.7, 0.92, v) * (1 + Math.sin(ph * 1.3 - v * 16));
        const rim = 0.15 + 0.05 * smooth(0.15, 0.35, v) - 0.04 * smooth(0.4, 0.95, v) + 0.015 * Math.sin(ph - v * 10 + 1) * smooth(0.2, 0.6, v);
        for (let c = c0; c <= c1; c++) {
          const u = (c + 0.5 - cx) / sx, p = h * cols + c, a = Math.abs(u - 0.02), hv = v + 0.015 * (u - 0.02) / 0.24; // hv: down the hat, which the wind tips down on the left
          const q = (0.05 - u) / 0.47; // how far out along the hair
          if (hv >= 0 && a <= 0.24 * Math.min(1, hv / 0.07) && hv <= 0.082 + 0.01 * (a / 0.24) ** 2) part[p] = HAT;
          else if (q < 1 && (q > 0 ? Math.abs(v - sheet(q)) < 0.055 * (1 - q) ** 1.3 + 0.006 : u < 0.085 && v > 0.06 && v < 0.15)) part[p] = HAIR;
          else if (v >= 0.1 + 0.9 * Math.max(0, a - 0.05) && u >= left && u <= rim &&
            v <= 0.925 + 0.015 * Math.sin(ph + u * 14) - 0.05 * smooth(-0.12, -0.26, u) - ((u > 0) === !!right ? 0.015 * lift : 0)) part[p] = ROBE; // the hem lifts on the windward side, and over the moving foot
        }
      }
      for (let h = h0; h <= h1; h++) { // his colours, as the story has them, lost in the fog from the ground up
        const v = (h + 0.5 - top) / sy, side = body(v);
        for (let c = c0; c <= c1; c++) {
          const p = h * cols + c, what = part[p];
          if (!what) continue;
          const u = (c + 0.5 - cx) / sx;
          let L = 0.07, C = 0;
          if (what === ROBE) {
            C = 1;
            if (!part[p - 1] || !part[p + 1] || !part[p - cols] || !part[p + cols]) L = 0.1; // an ink line round the robe
            else {
              L = 0.2 + 0.16 * clamp01((side - u) / 0.22) + 0.06 * smooth(0.22, 0.12, v); // the sleeve's thin silk is lighter where it streams out
              if (u > side ? Math.sin(u * 55 + 2 * Math.sin(v * 7 - ph * 0.5)) > 0.8 : Math.sin((u * 0.9 - v * 1.1) * 48 + ph * 0.7) > 0.7) L -= 0.06; // folds
            }
            L = lerp(L, 0.15, grey * 0.9);
          } else if (what === HAT) L = v + 0.015 * (u - 0.02) / 0.24 > 0.07 ? 0.12 : 0.26 + 0.07 * (hash(Math.floor(u * 70), Math.floor(v * 90)) - 0.5); // woven straw over a dark brim
          else if (what === SOLE || what === CHAPE) L = what === SOLE ? 0.3 : 0.45;
          else if (what === BOOT) L = 0.08;
          else if (what === SWORD) L = 0.06;
          L = lerp(L, 0.62, pale);
          const f = fogOn(1 - v, p);
          lum[p] += (L - lum[p]) * (1 - f); chroma[p] = C * (1 - grey) * (1 - f) ** 2; cover[p] = f; // the fog takes his colour before his shape, so its edge on him is grey, never a pale blue glow
        }
      }
      for (let h = h0; h <= h1; h++) for (let c = c0; c <= c1; c++) if (part[h * cols + c]) { const i = (h >> 1) * cols + c; glyph[i] = 32; own[i] = 2; }

      // His characters: folds, blossoms, the sword, hair and the hat's outline, each faded like the half cell it sits in.
      const brush = (L, C, need, heavy) => (c, r, ch) => {
        if (c < 0 || c >= cols || r < 0 || r >= rows) return;
        const p = (r * 2 + 1) * cols + c, i = r * cols + c;
        if (need && part[p] !== need && part[p - cols] !== need) return;
        const f = fogOn(1 - (r * 2 + 1 - top) / sy, p);
        if (f > 0.45) return;
        glyph[i] = ch; ink[i] = tone(lerp(lerp(L, 0.62, pale), 0.83 + 0.16 * tex[p], f), C * (1 - grey) * (1 - f) ** 2); bold[i] = heavy; own[i] = 2;
      };
      if (grey < 0.7) {
        const fold = (u0, v0, u1, v1, L) => { const [a, b] = at(u0, v0), [c, d] = at(u1, v1); line(a, b, c, d, brush(L, 1, ROBE, 0)); };
        const flap = 0.03 * Math.sin(ph - 5);
        fold(0.07, 0.36, 0.05 + 0.01 * Math.sin(ph), 0.88, 0.34);
        fold(-0.07, 0.42, -0.1, 0.86, 0.34);
        fold(-0.13, 0.24, -0.32 + flap, 0.5, 0.1);
        fold(-0.12, 0.34, -0.3 + flap, 0.6, 0.1);
      }
      if (bloom < 0.8) for (const [u0, v, ch] of blossoms) { // a blossom on the sleeve moves with it
        const u = u0 < body(v) ? u0 - 0.035 * Math.sin(ph - v * 12) * out(v) * clamp01((body(v) - u0) / 0.27) : u0, [c, r] = at(u, v);
        brush(lerp(0.88, 0.2, bloom), lerp(0.6, 1, bloom), ROBE, ch === STAR ? 1 : 0)(Math.floor(c), Math.floor(r), ch);
      }
      const [sa, sb] = at(su, sv), [ta, tb] = at(tipU, tipV);
      line(sa, sb, ta, tb, brush(0.42, 0, SWORD, 0)); // a glint along the dark sheath
      const strand = brush(0.06, 0, 0, 1);
      for (const pts of tips) for (let k = 1; k < 8; k++) {
        const [a, b] = at(pts[k * 2], pts[k * 2 + 1]), [c, d] = at(pts[k * 2 + 2], pts[k * 2 + 3]);
        line(a, b, c, d, strand);
      }
      const [lc, lr] = at(-0.22, 0.097), [ac, ar] = at(0.02, 0.005), [rc, rr] = at(0.26, 0.067), straw = brush(0.5, 0, 0, 0);
      line(lc, lr, ac, ar, straw); line(ac, ar, rc, rr, straw);
    }

    return {
      cols, rows, palette: INK, glyph, ink, bold, paint,
      render(t) { // t: seconds since the animation started
        glyph.fill(32); ink.fill(0); bold.fill(0); paint.fill(0); own.fill(0); alpha.fill(1);
        if (t >= LENGTH) return this; // over: nothing is left on the page
        const s = t * SPEED; // where that is in the story
        const fd = FOG * s * U, fi = Math.floor(fd), ff = fd - fi, cd = CLOUD * s * U, ci = Math.floor(cd), cf = cd - ci; // how far the fog and clouds have drifted, in columns
        for (let h = 0, p = 0; h < H2; h++) {
          for (let c = 0; c < cols; c++, p++) {
            const j = h * TW + c + fi, tx = fogTex[j] + (fogTex[j + 1] - fogTex[j]) * ff;
            let L = base[p], k = 0;
            if (cloudW[p]) {
              const m = h * TW + c + ci, cl = cloudTex[m] + (cloudTex[m + 1] - cloudTex[m]) * cf, a = cloudW[p] * smooth(0.4, 0.75, cl);
              L += (0.76 + 0.14 * cl - L) * a; k = a;
            }
            if (fogW[p]) {
              const d = fogW[p] * smooth(-0.05, 0.06, rise[p] + 0.12 * (tx - 0.5));
              L += (0.83 + 0.16 * tx - L) * d;
              if (d > k) k = d;
            }
            lum[p] = L; chroma[p] = 0; cover[p] = k; tex[p] = tx;
          }
        }
        drawPines(s);
        if (s < T.gone) drawFigure(s);
        if (s > T.thick - 0.15) { // the ending: thick fog rolls in from the right over everything, and thins away to nothing behind itself
          for (let h = 0, p = 0; h < H2; h++) for (let c = 0; c < cols; c++, p++) {
            const lag = 1 - (c + 0.5) / cols, n = tex[p] - 0.5; // lag: 0 at the right edge, where the fog comes from, 1 at the left
            const a = T.thick + 0.5 * lag + 0.3 * n, b = T.thin + 0.55 * lag + 0.2 * n, k = smooth(a, a + 0.3, s);
            lum[p] += (0.83 + 0.16 * tex[p] - lum[p]) * k; chroma[p] *= 1 - k;
            if (k > cover[p]) cover[p] = k;
            alpha[p] = 1 - smooth(b, b + 0.25, s);
          }
        }
        for (let r = 0, i = 0; r < rows; r++) for (let c = 0; c < cols; c++, i++) { // the scene's characters
          const p = (r * 2 + 1) * cols + c, k = Math.max(cover[p], cover[p - cols]);
          if (alpha[p] < 0.75) { glyph[i] = 32; continue; }
          if (own[i]) { if (own[i] > 2 && k > 0.55) glyph[i] = 32; continue; }
          if (mark[i] && k < 0.4) { glyph[i] = mark[i]; ink[i] = tone(lerp(markL[i], lum[p], k * 2)); }
          else if (k > 0.6) { // a wisp, drifting with the fog or the cloud it is in
            const high = rise[p] < 0, slot = Math.floor((c + (high ? cd : fd)) / 3);
            if (hash(slot, r * 7 + (high ? 500 : 3)) < 0.04) { glyph[i] = hash(slot, r + 9) < 0.6 ? WAVE : DASH; ink[i] = tone(lum[p] - 0.1); }
          }
        }
        for (let p = 0; p < N; p++) { // into the palette, dithered like dry brush on paper
          if (alpha[p] < 1) { const a = Math.floor(alpha[p] * 8 + order[p]); paint[p] = a > 0 ? THIN + Math.min(8, a) : 0; continue; }
          const l = Math.floor(lum[p] * (NL - 1) + thr[p]), C = chroma[p];
          paint[p] = TONE + (l < 0 ? 0 : l > NL - 1 ? NL - 1 : l) * NC + (C > 0 ? Math.min(NC - 1, Math.floor(C * (NC - 1) + ((thr[p] + 0.5) % 1))) : 0);
        }
        for (let k = 0; k < seal.length; k += 2) if (alpha[seal[k]] === 1 && cover[seal[k]] < 0.5) paint[seal[k]] = seal[k + 1];
        return this;
      },
    };
  }

  // Play it on the stage. Resolves when it has finished. `seed` changes the
  // details, not the layout: the crags of the peaks, the ranges and pines off
  // to the sides, the lie of the fog, the edges of the rock, his hair and the
  // sprays of blossom. `freezeAt` holds one moment (in seconds) on screen.
  // Reduced motion holds him standing on the ledge before his first step.
  const film = { length: LENGTH, still: 1 / SPEED, createScene };
  return { play: (options) => AsciiStage.play(film, options), createScene };
})();
