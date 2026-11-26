/*
 * Glass chimes: an ASCII loading screen for the stage.
 *
 *   <script src="ascii-stage.js"></script>
 *   <script src="glass-chimes.js"></script>
 *   <script>GlassChimes.play().then(showThePage);</script>
 *
 * A soft watercolour in pale pink, mint and blue. Two clear glass chimes
 * hang on fine gold chains among arching bamboo leaves, beside a thick teal
 * stalk. Blurred chimes and round spots of light lie behind them, and loose
 * leaves fall. A light breeze sways each chime at its own rhythm. One strong
 * gust from the left swings them three times as far, lifts the left chime's
 * paper strip almost level, bends the branches and sweeps a flurry of leaves
 * across; then the swings die away and the breeze is gentle again. A last
 * breeze breaks the picture into round spots of pastel light and carries
 * them off to the right with a flurry of leaves, to show the page. It lasts
 * five seconds (LENGTH, below).
 *
 * The world is the painting, in its own pixels, seen through a camera that
 * shows the whole of its portrait frame on a tall screen, comes closer on a
 * wide one so that the chimes read, and carries the washes, far chimes and
 * leaves on to the sides. The chimes are pendulums whose swings are worked
 * out once; everything else moves in closed form, so render(t) draws any
 * moment directly.
 */
const GlassChimes = (() => {
  'use strict';
  const { code, clamp01, lerp, smooth, mulberry32, hash, noise } = AsciiStage;
  // Value noise on its own leaves square blotches; two layers of it, one turned against the other, do not.
  const blot = (x, y) => 0.5 * noise(x, y) + 0.5 * noise(0.8 * x - 0.6 * y + 31.7, 0.6 * x + 0.8 * y + 12.3);

  // The story's timeline, in seconds at the pace it was written: the description's ten seconds, then the handover.
  const T = {
    gust: 4,    // a stronger gust reaches the chimes from the left
    lull: 6,    // it has passed, and the swings die away; by 9 the breeze is gentle again
    breeze: 10, // a last breeze carries the picture off
    end: 11.2,
  };
  // It is played faster than that. LENGTH is how many seconds the whole of it takes on screen, and
  // SPEED how many times faster than the story that is. The sway of the chimes, the falling leaves
  // and the shimmer of the light run on screen time, so they stay as gentle as the description asks.
  const LENGTH = 5, SPEED = T.end / LENGTH;

  // Colours. `swatch` adds a run of colours and gives the index of the first.
  const INK = ['#000000'];
  const swatch = (...colours) => INK.push(...colours) - colours.length;
  const hex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  // The wash's hues, from lilac through pink, blush, white, mint and aqua to blue, and the colour
  // each takes where its pigment pools.
  const HUE = [[226, 214, 238], [243, 211, 224], [247, 229, 236], [246, 248, 247], [216, 240, 231], [199, 233, 231], [208, 226, 243]];
  const POOL = [[198, 181, 218], [221, 182, 201], [229, 199, 211], [215, 225, 227], [170, 214, 202], [150, 206, 204], [170, 199, 226]];
  // The soft colours. Every colour the scene mixes for washes, blur, light, glass and paper is
  // matched to the nearest of these, so nothing dark or saturated can appear: each hue, and each
  // half step between two, in seven tones from pooled pigment to nearly white; then blurred far
  // bamboo, the grey-blue of glass edges, light with a touch of gold, and white.
  const SOFT_FROM = INK.length;
  for (let h = 0; h <= 12; h++) {
    const a = h >> 1, b = (h + 1) >> 1, base = [0, 1, 2].map((j) => (HUE[a][j] + HUE[b][j]) / 2), pool = [0, 1, 2].map((j) => (POOL[a][j] + POOL[b][j]) / 2);
    for (let v = 0; v < 7; v++) INK.push(hex(base.map((c, j) => (v < 3 ? lerp(pool[j], c, v / 3) : lerp(c, 255, (v - 3) / 3.6)))));
  }
  swatch('#7cb6b1', '#90c3be', '#a5cfc9', '#bad9d4'); // far bamboo
  swatch('#9bb4c1', '#b4c7d2', '#cddae2'); // glass
  swatch('#f8efd6', '#fcf6e6'); // warm light
  const WHITE = swatch('#ffffff');
  const SOFT_TO = INK.length;
  // The sharp colours, for what is in focus.
  const STALK = swatch('#4a828b', '#578f97', '#669ca2', '#78aaae', '#91bfc0', '#b0d4d2'); // the thick stalk, shadow to light
  const NODE = swatch('#d2e9e4', '#ecf7f4'); // its pale rings
  const LEAF = swatch('#2d6469', '#387278', '#478386', '#5e9693', '#86b7b0', '#b5d6cd'); // leaves, the darkest colour in the film, to a pale leaf
  const STEM = swatch('#5a9289', '#7aab9f'); // thin branches
  const GOLD = swatch('#b9985b', '#cdae6c', '#e0c78a', '#f2e2b4'); // chain, fleck, glint
  const RIM = swatch('#7f9dab', '#a2bbc6'); // the edge of clear glass
  const BEAD = swatch('#e8b2c1', '#92cfd5', '#e9eff3'); // pink, aqua and white beads
  const TUFT = swatch('#a9b9c4', '#c6d1d7'); // the pale tassel
  const PAPER = swatch('#b7b2cd'); // the edges of the paper strip
  const RGB = INK.map((h) => [1, 3, 5].map((j) => parseInt(h.slice(j, j + 2), 16)));

  // Every light colour, at four steps a channel from 128 up, mapped to its nearest soft colour.
  // Worked out once, on first use.
  let nearest = null;
  function matcher() {
    if (nearest) return nearest;
    nearest = new Uint8Array(32768);
    for (let i = 0; i < 32768; i++) {
      const r = 130 + (i >> 10) * 4, g = 130 + ((i >> 5) & 31) * 4, b = 130 + (i & 31) * 4;
      let best = 0, far = Infinity;
      for (let j = SOFT_FROM; j < SOFT_TO; j++) {
        const [R, G, B] = RGB[j], d = 3 * (r - R) ** 2 + 4 * (g - G) ** 2 + 2 * (b - B) ** 2;
        if (d < far) { far = d; best = j; }
      }
      nearest[i] = best;
    }
    return nearest;
  }
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5); // ordered dither, so a gradient is a fixed pattern and never flickers

  const [BAR, SLASH, BACK, LOW, DASH, HIGH, TICK, COMMA, DOT, OPEN, CLOSE, RING, BALL, STAR, EQUAL] = code("|/\\_-'`,.()oO*=");
  const SPECK = code(".'`,"); // gold leaf on the paper

  // The painting, in its own pixels: 736 wide and 1308 high. The world is laid out in these units,
  // and on screens of another shape it goes on past the painting's edges.
  const REF = 1308, PW = 736, NARROW = 575; // NARROW: the least of the painting's width any screen shows
  // A landscape screen shows only this stretch of its height, so that the chimes are large enough to
  // read: from a little above the right chime's clear bead to below the strip and the nearest leaves.
  const BAND = [160, 900];
  // Across the painting the wash runs from pink at the left, through white past the left chime and
  // mint by the right chime, to aqua and blue at the stalk and beyond (hues as in HUE, 0 to 6).
  const ACROSS = [[0, 1], [160, 1.5], [270, 2.6], [360, 3.2], [450, 3.9], [560, 4.6], [660, 5.2], [736, 5.6]];

  // The thick stalk: its middle at the top and at the bottom of the painting, its half width, and
  // the heights of its pale rings (with more above and below the frame, for tall screens).
  const STALK_AT = [617, 612], STALK_HALF = 31, RINGS = [-262, -15, 232, 478, 755, 1043, 1345, 1650, 1960];

  // The two chimes. Each hangs on a gold chain from a pivot above the frame: where it hangs across
  // the painting, its rhythm (seconds a swing, on screen) and where its sway starts,
  // what is threaded on the chain ([y, radius, colour] of each bead, top to bottom), its glass orb
  // ([y, radius]), and what hangs at the bottom from height `foot`: a paper strip or a tassel.
  const CHIMES = [
    { x: 322, period: 1.25, phase: 0.6, beads: [[104, 5, GOLD + 1], [462, 8, BEAD], [580, 9, BEAD + 1], [607, 9, BEAD + 2]], orb: [511, 31], foot: 652, strip: true },
    { x: 528, period: 1.42, phase: 2.4, beads: [[240, 16, RIM + 1], [412, 7, GOLD + 1], [470, 6, GOLD]], orb: [524, 48], foot: 578, strip: false },
  ];
  const PIVOT = -250, FAR_PIVOT = -350; // the height of the pivots above the frame: the chimes', and the far ones'
  const STRIP = [163, 40], TASSEL = [76, 13]; // length and width
  // Marks on the strip: where they are along it (0 at the top) and across it (-1 to 1), how big
  // (in the strip's lengths), and their colour: blue, pink, a deeper pink dot, lilac, gold leaf.
  const MARKS = [[0.28, -0.35, 0.12, [192, 211, 238]], [0.6, 0.35, 0.1, [242, 196, 210]], [0.53, 0.32, 0.035, [232, 166, 182]], [0.82, -0.25, 0.11, [212, 198, 232]], [0.16, 0.1, 0.1, [238, 220, 168]]];
  const FLECKS = [[0.08, -0.45], [0.15, 0.4], [0.22, -0.1], [0.31, 0.5], [0.4, -0.55], [0.47, 0.1], [0.63, -0.3], [0.76, 0.45], [0.9, -0.1]];
  const ORB_FLECKS = [[0.3, 0.2, 0.7], [-0.25, 1.4, 0.6], [0.05, 2.5, 0.75], [-0.45, 3.6, 0.5], [0.5, 4.6, 0.55], [-0.1, 5.5, 0.4]]; // gold inside the orbs: latitude, longitude, depth

  // Chimes far behind, out of focus: x, y and radius of the orb, and what hangs below it
  // (0 nothing, 1 a pale tassel, 2 a lilac tassel, 3 a paper strip).
  const FAR = [[240, 195, 33, 0], [113, 408, 34, 3], [468, 390, 28, 0], [570, 336, 26, 0], [718, 300, 44, 2], [712, 700, 30, 0], [112, 858, 26, 1], [236, 452, 16, 3]];

  // Bamboo branches, traced from the painting: each a stem, a line from above the frame (or from a
  // ring of the stalk), and its leaves as [base x, base y, tip x, tip y, tone 0 dark to 5 pale].
  const BRANCHES = [
    { flex: 0.26, stem: [[612, -90], [598, 0], [532, 68], [466, 132], [425, 186], [392, 238], [362, 296], [354, 342]], leaves: [
      [560, 14, 488, 146, 0], [466, 132, 350, 152, 2], [462, 130, 386, 200, 1], [392, 240, 236, 258, 1], [390, 242, 312, 310, 0],
      [398, 232, 400, 318, 1], [354, 342, 310, 428, 1], [356, 344, 352, 446, 4], [358, 342, 414, 414, 2]] },
    { flex: 0.3, stem: [[425, 186], [372, 236], [318, 280], [266, 326], [250, 360], [242, 396], [230, 432]], leaves: [
      [264, 327, 165, 346, 1], [262, 330, 200, 378, 3], [242, 396, 266, 466, 2], [242, 398, 150, 470, 4], [230, 432, 200, 497, 1]] },
    { flex: 0.12, stem: [[300, -80], [290, 0]], leaves: [[290, 2, 277, 108, 0], [282, 2, 236, 38, 2]] },
    { flex: 0.16, stem: [[230, -60], [204, 60], [176, 100], [150, 126]], leaves: [[204, 62, 186, 160, 1], [202, 64, 128, 98, 3], [150, 126, 132, 210, 2], [176, 100, 104, 128, 4]] },
    { flex: 0.2, stem: [[560, -80], [541, 0], [536, 76], [530, 168], [540, 230]], leaves: [
      [536, 76, 538, 2, 2], [534, 80, 528, 164, 1], [530, 168, 606, 136, 4], [530, 170, 476, 206, 2], [528, 172, 490, 258, 0], [556, 196, 562, 264, 1], [532, 268, 541, 389, 1]] },
    { flex: 0.14, stem: [[740, -80], [712, 30], [706, 92]], leaves: [[706, 92, 678, 228, 0], [708, 96, 736, 170, 3], [712, 30, 744, 10, 2]] },
    { flex: 0.32, stem: [[588, 482], [572, 560], [564, 634], [542, 700], [522, 762], [508, 840], [500, 900]], leaves: [
      [564, 634, 569, 720, 1], [566, 632, 662, 662, 0], [542, 700, 512, 758, 1], [540, 700, 446, 720, 4], [522, 762, 572, 796, 2],
      [520, 764, 544, 842, 4], [508, 840, 470, 902, 1], [506, 838, 404, 858, 4], [500, 900, 470, 1008, 4], [502, 900, 534, 978, 3]] },
  ];
  // The loose leaves in mid-air at the first frame: middle x, y, angle in degrees, length, tone.
  const LOOSE = [[232, 740, -17, 85, 0], [404, 746, 32, 95, 1], [66, 853, 26, 100, 1], [255, 957, 79, 105, 1], [188, 1053, 34, 68, 4],
    [420, 1101, -40, 112, 0], [540, 1011, -37, 70, 4], [411, 958, -12, 50, 4], [140, 1176, 62, 80, 2], [520, 1256, 111, 60, 2]];

  // Wind at story time s where the gust front reaches x: 1 is the breeze. The gust and the last
  // breeze travel right at FRONT painting pixels a story second, and reach the chimes on time.
  const GUST = 3.4, LAST = 1.6, FRONT = 2100;
  const wind = (s, x) => {
    const at = s - (x - 425) / FRONT;
    return 1 + 0.15 * Math.sin(1.3 * at + 0.4) + 0.1 * Math.sin(2.9 * at + 1.1)
      + GUST * smooth(T.gust - 0.15, T.gust + 0.35, at) * (1 - smooth(T.lull - 0.4, T.lull + 0.2, at))
      + LAST * smooth(T.breeze - 0.1, T.breeze + 0.5, at);
  };
  const late = (x) => (x - 425) / FRONT / SPEED; // how much later (seconds on screen) the wind reaches x than the chimes

  // A damped swing pulled toward a resting angle that moves with the wind, plus a push from outside,
  // tabulated over the film so that any moment is one lookup. Times are seconds on screen.
  const STEP = 1 / 120, STEPS = Math.ceil((LENGTH + 0.2) / STEP);
  function swing(rest, period, damp, push) {
    const w = (2 * Math.PI) / period, at = new Float32Array(STEPS + 1), acc = new Float32Array(STEPS + 1), dt = STEP / 8;
    let a = rest(0), v = 0;
    const pull = (tau) => -w * w * (a - rest(tau)) - 2 * damp * w * v + (push ? push(tau) : 0);
    for (let i = 0; i <= STEPS; i++) {
      at[i] = a; acc[i] = pull(i * STEP);
      for (let j = 0; j < 8; j++) { v += pull((i + j / 8) * STEP) * dt; a += v * dt; }
    }
    return { at, acc };
  }
  const look = (table, tau) => { const f = Math.max(0, Math.min(STEPS, tau / STEP)), i = Math.min(STEPS - 1, f | 0); return lerp(table[i], table[i + 1], f - i); };

  // Each chime sways a few degrees at its own rhythm, and the wind pushes it over, the gust about
  // three times as far. Its strip or tassel is lifted by the wind, lags the chain, and drops back
  // when the wind does. Worked out once for the whole film.
  const SWAY = 0.055, LEAN = 0.028;
  for (const ch of CHIMES) {
    const w = (2 * Math.PI) / ch.period, sw = swing((tau) => LEAN * (wind(tau * SPEED, ch.x) - 1), ch.period, 0.2);
    ch.angle = (tau) => SWAY * Math.sin(w * tau + ch.phase) + look(sw.at, tau);
    const accel = (tau) => -SWAY * w * w * Math.sin(w * tau + ch.phase) + look(sw.acc, tau);
    ch.lift = ch.strip
      ? swing((tau) => Math.min(1.36, Math.atan(0.07 * wind(tau * SPEED, ch.x) ** 2.6)) - 0.07, 0.55, 0.45, (tau) => -0.9 * accel(tau)).at // 0 in the usual breeze
      : swing((tau) => Math.atan(0.04 * wind(tau * SPEED, ch.x) ** 2.4), 0.45, 0.5, (tau) => -0.7 * accel(tau)).at;
    ch.rest = ch.angle(0);
  }
  // How far branches are bent by the wind (1 in the gust), and how far the wind has carried a light
  // leaf (painting pixels), both as felt at the chimes and shifted in time for anywhere else.
  const BEND = swing((tau) => (wind(tau * SPEED, 425) - 1) / GUST, 1.0, 0.42).at;
  const CARRY = new Float32Array(STEPS + 1);
  for (let i = 1; i <= STEPS; i++) CARRY[i] = CARRY[i - 1] + (wind((i - 0.5) * STEP * SPEED, 425) - 1) * 260 * STEP;

  function createScene({ cols, rows, aspect = 2, seed = 3 }) {
    const near = matcher(), rand = mulberry32(seed), R = (a, b) => a + (b - a) * rand();
    const lines = rows * 2, px = 2 / aspect, wide = cols * px, N = cols * rows, H = cols * lines;
    const glyph = new Uint8Array(N), ink = new Uint8Array(N), bold = new Uint8Array(N), paint = new Uint8Array(H);

    // The camera. On a screen the painting's shape or taller, its whole height fills the screen,
    // unless the screen is so narrow that less than NARROW of its width would show; then the width
    // decides and the world goes on above and below. The wider the screen, the closer the camera
    // comes, until from 5:4 on it shows the BAND around the chimes. A phone centres the painting's
    // middle; a wide screen centres the two chimes and the stalk, with the world going on at the sides.
    const zoom = smooth(PW / REF, 1.25, wide / lines);
    const k = Math.min(lines / lerp(REF, BAND[1] - BAND[0], zoom), wide / NARROW); // half rows to a painting pixel
    const span = wide / k, xL = lerp(380, 470, smooth(PW, PW * 1.6, span)) - span / 2, xR = xL + span;
    const yT = lerp(REF / 2, (BAND[0] + BAND[1]) / 2, zoom) - lines / k / 2, yB = yT + lines / k;
    // How much of the painting's height is in view, and from where to where. What lies along its top
    // or bottom (the light at the bottom, the loose leaves, what is added at the sides) is put in that.
    const viewTop = Math.max(0, yT), viewFoot = Math.min(REF, yB), viewed = (viewFoot - viewTop) / REF;
    const above = (y) => (viewFoot - y) / viewed; // how far y is above the bottom of the view, as if all the painting were in view
    const sx = (x) => (x - xL) * k, sy = (y) => (y - yT) * k; // a point of the painting on the screen, in half rows across and down
    const wx = (c) => xL + ((c + 0.5) * px) / k, wy = (l) => yT + (l + 0.5) / k; // the painting at the middle of a half cell

    // Match a colour to the soft colours at half cell i, dithered a little.
    const level = (v) => (v < 130 ? 0 : v >= 254 ? 31 : (v - 128) >> 2);
    const tone = (i, r, g, b) => {
      const d = BAYER[(((i / cols) | 0) & 3) * 4 + ((i % cols) & 3)] * 6;
      return near[(level(r + d) << 10) | (level(g + d) << 5) | level(b + d)];
    };

    // ---- The wash behind everything, worked out once: the painting's hues carried on past its
    // sides, wandering; pigment pooling softly; light from behind whitening the middle and the
    // bottom; then blurred bamboo far off, and blurred leaves.
    const hueAt = (x, y) => {
      let h = ACROSS[ACROSS.length - 1][1];
      for (let j = 1; j < ACROSS.length; j++) if (x < ACROSS[j][0]) { const [x0, h0] = ACROSS[j - 1], [x1, h1] = ACROSS[j]; h = lerp(h0, h1, clamp01((x - x0) / (x1 - x0))); break; }
      const side = x < 0 ? 1.3 + 1.6 * (noise(x / 460, 3.3) - 0.5) : 4.7 + 1.8 * (noise(x / 460, 7.7) - 0.5);
      h = lerp(h, side, x < 0 ? smooth(0, -200, x) : smooth(PW, PW + 200, x));
      h = lerp(h, 5.8, 0.65 * smooth(358, 58, above(y)) * (1 - smooth(350, 650, x)));
      h = lerp(h, 0.5, 0.4 * smooth(280, 0, y) * smooth(280, 0, x));
      return Math.max(0, Math.min(5.999, h + 0.9 * (blot(x / 330, y / 330 + 4) - 0.5)));
    };
    const bR = new Float32Array(H), bG = new Float32Array(H), bB = new Float32Array(H);
    for (let l = 0; l < lines; l++) for (let c = 0; c < cols; c++) {
      const x0 = wx(c), y0 = wy(l), x = x0 + 120 * (noise(x0 / 500, y0 / 500 + 40) - 0.5), y = y0 + 120 * (noise(x0 / 500 + 70, y0 / 500) - 0.5); // the wash wanders, so no grid shows in it
      const i = l * cols + c, h = hueAt(x, y), j = h | 0, f = h - j;
      const pool = 0.3 * smooth(0.5, 0.8, blot(x / 260 + 11, y / 210 + 3));
      const light = clamp01(0.42 * Math.exp(-(((x - 250) / 230) ** 2 + ((y - 430) / 430) ** 2)) + 0.25 * Math.exp(-(((x - 430) / 200) ** 2 + ((y - 30) / 180) ** 2))
        + 0.3 * smooth(308, 48, above(y)) * (1 - smooth(300, 650, x)) + (x < 0 || x > PW ? 0.3 * smooth(0.45, 0.85, noise(x / 480 + 21, y / 480)) : 0)
        + 0.12 * (noise(x / 150 + 5, y / 150 + 9) - 0.5));
      for (let ch = 0; ch < 3; ch++) {
        const v = lerp(lerp(HUE[j][ch], HUE[j + 1][ch], f), lerp(POOL[j][ch], POOL[j + 1][ch], f), pool);
        (ch === 0 ? bR : ch === 1 ? bG : bB)[i] = lerp(v, 255, light);
      }
    }
    const blend = (i, rgb, a) => { bR[i] += (rgb[0] - bR[i]) * a; bG[i] += (rgb[1] - bG[i]) * a; bB[i] += (rgb[2] - bB[i]) * a; };
    // Far bamboo: soft upright bands, a few, more of them to the right. The painting has one at its right edge.
    const far = [[713, 22, 0.42]];
    for (let x = PW + R(260, 420); x < xR + 60; x += R(260, 520)) far.push([x, R(12, 30), R(0.2, 0.4)]);
    for (let x = -R(250, 450); x > xL - 60; x -= R(420, 760)) far.push([x, R(10, 24), R(0.12, 0.25)]);
    for (const [x0, half, a] of far) {
      const knot = R(0, 230);
      for (let c = Math.max(0, Math.floor(sx(x0 - half * 2.5) / px)); c <= Math.min(cols - 1, sx(x0 + half * 2.5) / px); c++) {
        const e = (wx(c) - x0) / half;
        for (let l = 0; l < lines; l++) {
          const m = ((((wy(l) + knot) % 230) + 230) % 230) - 115; // a paler ring every 230 pixels
          blend(l * cols + c, [144, 195, 190], a * Math.exp(-e * e * 0.7) * (1 - 0.5 * Math.exp(-((m * k * 0.8) ** 2))));
        }
      }
    }
    // Blurred leaves, far off: in sprays at the top, and low down beside the stalk.
    const haze = [[40, 120, 0.4, 95], [20, 205, 0.1, 85], [80, 238, -0.5, 80], [100, 110, -0.3, 90], [680, 860, 0.5, 100], [655, 1190, -0.6, 90], [700, 1250, -1.2, 85], [460, 560, 1.4, 90], [470, 640, 1.9, 80]];
    for (let x = xL + R(0, 260); x < xR; x += R(260, 480)) {
      if (x > -60 && x < PW + 60) continue;
      const y0 = viewTop + R(-40, 330) * viewed;
      for (let j = 0, n = 3 + ((rand() * 3) | 0); j < n; j++) haze.push([x + R(-60, 60), y0 + R(0, 120), R(0.4, 2.6), R(70, 110)]);
    }
    for (const [x0, y0, a, len] of haze) {
      const ca = Math.cos(a), sa = Math.sin(a), thick = len * 0.16, reach = len / 2 + thick * 2;
      for (let l = Math.max(0, Math.floor(sy(y0 - reach))); l <= Math.min(lines - 1, sy(y0 + reach)); l++) {
        for (let c = Math.max(0, Math.floor(sx(x0 - reach) / px)); c <= Math.min(cols - 1, sx(x0 + reach) / px); c++) {
          const dx = wx(c) - x0, dy = wy(l) - y0, p = (dx * ca + dy * sa) / (len / 2), q = (dy * ca - dx * sa) / thick, e = Math.abs(p) + q * q * 0.5;
          if (e < 1.4) blend(l * cols + c, [140, 192, 200], 0.3 * (1 - smooth(0.5, 1.4, e)));
        }
      }
    }
    const ground = new Uint8Array(H);
    for (let i = 0; i < H; i++) ground[i] = tone(i, bR[i], bG[i], bB[i]);

    // ---- The thick stalk never moves, so its half cells and characters are worked out once. It is
    // lit from behind: both edges pale, a highlight down the left and shade to the right. Each ring
    // is a pale band with a dark line under it.
    const stalkAt = (y) => lerp(STALK_AT[0], STALK_AT[1], y / REF), RING_H = Math.max(6, 0.55 / k);
    const stalk = [], stalkMarks = [], bare = new Uint8Array(N).fill(1); // bare: cells where gold leaf may lie on the wash
    for (let l = 0; l < lines; l++) {
      const y = wy(l), mid = stalkAt(y);
      let dy = Infinity;
      for (const ry of RINGS) if (Math.abs(y - ry) < Math.abs(dy)) dy = y - ry;
      const bulge = Math.abs(dy) < RING_H * 1.5 ? 1.12 : 1;
      for (let c = Math.max(0, Math.floor(sx(mid - STALK_HALF * 1.2) / px)); c <= Math.min(cols - 1, sx(mid + STALK_HALF * 1.2) / px); c++) {
        const across = (wx(c) - mid) / STALK_HALF;
        if (Math.abs(across) > bulge) continue;
        let colour;
        if (Math.abs(dy) < RING_H) colour = NODE + (across < 0.1 ? 1 : 0);
        else if (dy > 0 && dy < RING_H * 2.4) colour = STALK;
        else {
          const v = 2.3 + 1.8 * Math.exp(-(((across + 0.4) / 0.22) ** 2)) - 1.5 * smooth(0.15, 0.8, across) + 1.2 * smooth(0.72, 1, Math.abs(across))
            + 1.1 * (noise(across * 3 + 9, y / 45) - 0.5) - 0.9 * Math.exp(-(((dy - RING_H * 3) / 40) ** 2)) + 0.6 * Math.exp(-(((dy + RING_H * 2) / 30) ** 2)); // shade under each ring, light over it
          colour = STALK + Math.max(0, Math.min(5, Math.floor(v + BAYER[(l & 3) * 4 + (c & 3)] * 0.9)));
        }
        stalk.push(l * cols + c, colour);
        bare[(l >> 1) * cols + c] = 0;
      }
    }
    for (let r = 0; r < rows; r++) { // a light bar down its highlight, and the rings marked across
      const mid = stalkAt(yT + (r * 2 + 1) / k);
      let ringed = false;
      for (const ry of RINGS) if (Math.abs(sy(ry) / 2 - r - 0.5) < 0.5) ringed = true;
      const from = Math.round(sx(mid - STALK_HALF * 0.85) / px), to = Math.round(sx(mid + STALK_HALF * 0.85) / px);
      if (ringed) for (let c = from; c <= to; c++) stalkMarks.push(c, r, EQUAL, STALK + 2);
      else stalkMarks.push(Math.floor(sx(mid - STALK_HALF * 0.4) / px), r, BAR, STALK + 5);
    }

    // ---- Gold leaf on the paper: specks in small clusters, fixed where they lie.
    const specks = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = wx(c), y = yT + (r * 2 + 1) / k;
      if (bare[r * cols + c] && hash(c * 7 + seed, r * 13 + 5) < 0.06 * smooth(0.62, 0.8, noise(x / 90 + seed, y / 90))) specks.push(r * cols + c, SPECK[(hash(c, r * 3 + seed) * 4) | 0], GOLD + 1 + (hash(r, c) < 0.4 ? 1 : 0));
    }

    // ---- Branches. A stem is a chain of straight runs from its anchor; the wind turns each run
    // toward the way it blows, more toward the tip. Each leaf is fixed to a point of its stem.
    const DOWNWIND = 0.5; // the way the wind bends things: right and a little down
    const grow = (stem, leaves, flex) => {
      const b = { flex, x: stem.map((p) => p[0]), y: stem.map((p) => p[1]), ang: [], len: [], cum: [0], leaves: [], phase: R(0, 6.28) };
      for (let i = 0; i + 1 < stem.length; i++) {
        const dx = stem[i + 1][0] - stem[i][0], dy = stem[i + 1][1] - stem[i][1];
        b.ang.push(Math.atan2(dy, dx)); b.len.push(Math.hypot(dx, dy)); b.cum.push(b.cum[i] + Math.hypot(dx, dy));
      }
      b.total = b.cum[b.cum.length - 1];
      b.px = new Float32Array(stem.length); b.py = new Float32Array(stem.length); b.turn = new Float32Array(stem.length - 1);
      for (const [x0, y0, x1, y1, shade] of leaves) { // which run it sits on, how far along, and how far off it
        let best = Infinity, seg = 0, f = 0;
        for (let i = 0; i + 1 < stem.length; i++) {
          const ex = stem[i + 1][0] - stem[i][0], ey = stem[i + 1][1] - stem[i][1], q = clamp01(((x0 - stem[i][0]) * ex + (y0 - stem[i][1]) * ey) / (ex * ex + ey * ey || 1));
          const d = Math.hypot(stem[i][0] + ex * q - x0, stem[i][1] + ey * q - y0);
          if (d < best) { best = d; seg = i; f = q; }
        }
        const ox = x0 - lerp(stem[seg][0], stem[seg + 1][0], f), oy = y0 - lerp(stem[seg][1], stem[seg + 1][1], f);
        b.leaves.push({ seg, f, ox, oy, a: Math.atan2(y1 - y0, x1 - x0), len: Math.hypot(x1 - x0, y1 - y0), shade, phase: R(0, 6.28), rate: R(0.4, 0.75) });
      }
      return b;
    };
    const branches = BRANCHES.map(({ stem, leaves, flex }) => grow(stem, leaves, flex));
    // On wide screens more branches arch in from above on either side, curving out and down.
    for (const side of [-1, 1]) {
      for (let x = side < 0 ? R(-160, -80) : PW + R(80, 160); side < 0 ? x > xL - 150 : x < xR + 150; x += side * R(250, 420)) {
        let a = side < 0 ? R(2.1, 2.6) : R(0.55, 1.05), x0 = x, y0 = viewTop - R(60, 110);
        const stem = [[x0, y0 - 60], [x0, y0]], leaves = [];
        for (let i = 0, runs = 3 + ((rand() * 3) | 0); i < runs; i++) {
          const l = R(70, 110);
          x0 += Math.cos(a) * l; y0 += Math.sin(a) * l;
          stem.push([x0, y0]);
          a = lerp(a, Math.PI / 2, 0.22); // drooping as it goes out
          if (i === 0) continue;
          for (let j = 0, n = 2 + ((rand() * 3) | 0); j < n; j++) {
            const la = lerp(a + R(-0.9, 0.9), Math.PI / 2, 0.35), ll = R(70, 112);
            leaves.push([x0, y0, x0 + Math.cos(la) * ll, y0 + Math.sin(la) * ll, (rand() * 4) | 0]);
          }
        }
        branches.push(grow(stem, leaves, R(0.18, 0.3)));
      }
    }
    // Pose a branch at time tau: bent by the wind that has reached it, swaying a little in the breeze.
    function pose(b, tau) {
      const g = look(BEND, tau - late(b.x[0])), bend = b.flex * g + 0.02 * Math.sin(tau * 2.7 + b.phase);
      let x = b.x[0], y = b.y[0];
      b.px[0] = x; b.py[0] = y; b.gust = clamp01(g);
      for (let i = 0; i < b.ang.length; i++) {
        const turn = bend * (b.cum[i + 1] / b.total) * Math.sin(DOWNWIND - b.ang[i]);
        b.turn[i] = turn;
        x += Math.cos(b.ang[i] + turn) * b.len[i]; y += Math.sin(b.ang[i] + turn) * b.len[i];
        b.px[i + 1] = x; b.py[i + 1] = y;
      }
    }

    // ---- Chimes far behind, out of focus, each on its own rhythm; more of them on wide screens.
    const backs = FAR.map(([x, y, r, hang]) => ({ x, y, r, hang }));
    for (const side of [-1, 1]) for (let x = side < 0 ? R(-160, -70) : PW + R(70, 160); side < 0 ? x > xL - 80 : x < xR + 80; x += side * R(130, 250)) {
      backs.push({ x, y: viewTop + R(120, 760) * viewed, r: R(20, 44), hang: (rand() * 4) | 0 });
    }
    for (const f of backs) {
      f.period = R(1.15, 1.9); f.phase = R(0, 6.28); f.lilac = rand() < 0.5;
      const sw = swing((tau) => LEAN * 0.8 * (wind(tau * SPEED, f.x) - 1), f.period, 0.22).at;
      f.angle = (tau) => 0.045 * Math.sin((tau * 6.28) / f.period + f.phase) + look(sw, tau);
      f.rest = f.angle(0);
    }
    // ---- Round spots of light across the bottom of the view, like sun on water: thickest at the
    // left of the painting, and carried on along the bottom of the wider world. They keep their
    // size on screen however close the camera comes.
    const spots = [];
    for (let x = xL - 40; x < xR + 40; x += R(26, 64) * viewed) {
      if (rand() > (x > 40 && x < 420 ? 0.95 : 0.35 + 0.5 * noise(x / 300, 41))) continue;
      spots.push({ x, y: R(viewFoot - 198 * viewed, Math.max(viewFoot - 18 * viewed, yB - 20)), r: R(22, 40) * viewed, warm: rand() < 0.3, phase: R(0, 6.28), rate: R(1.6, 3.2) });
    }

    // ---- Loose leaves fall slowly, rocking, drifting down and a little right. Each falls in a lane:
    // when it leaves the bottom another enters at the top, somewhere new. The first ten are where
    // the painting has them, in the stretch of it in view; more lanes on wider screens keep about ten
    // to the painting's width. They fall as slowly across the screen however close the camera comes.
    const FALL = 260 * viewed, DRIFT = 24 * viewed, TOP = yT - 140, CYCLE = yB - yT + 280; // painting pixels a second on screen; where a lane starts, and its length
    const lanes = [];
    for (let j = 0, n = Math.max(LOOSE.length, Math.round((LOOSE.length * span) / PW)); j < n; j++) {
      const [x, y, deg, len, shade] = j < LOOSE.length ? [LOOSE[j][0], viewTop + LOOSE[j][1] * viewed, ...LOOSE[j].slice(2)] : [R(xL, xR), R(TOP, TOP + CYCLE), R(-60, 60), R(60, 105), (rand() * 5) | 0];
      const f = { y, len, shade, rock: R(18, 34) * viewed, rate: R(2.4, 3.8), phase: R(0, 6.28), push: R(0.7, 1.2) * viewed, lane: j }, age = (y - TOP) / FALL;
      f.x0 = x - DRIFT * age - f.rock * Math.sin(age * f.rate + f.phase); // so that at the first frame it is where it was put
      f.a0 = (deg * Math.PI) / 180 - 0.45 * Math.cos(age * f.rate + f.phase);
      lanes.push(f);
    }
    // ---- The gust sweeps about fifteen more across from the left (more on wider screens), tumbling.
    const swept = [];
    for (let j = 0, n = Math.max(14, Math.round(15 * (span / PW) ** 0.6)); j < n; j++) {
      swept.push({ s0: T.gust + (xL - 425) / FRONT + R(-0.05, 1.45), y: R(yT + 0.04 * (yB - yT), yB - 0.1 * (yB - yT)), speed: FRONT * R(0.8, 1.2), dy: R(-90, 200),
        spin: R(4, 9) * (rand() < 0.5 ? -1 : 1), len: R(70, 110), shade: (rand() * 3) | 0, phase: R(0, 6.28) });
    }

    // ---- The handover. The last breeze's front crosses the screen from the left, and where it is
    // the picture breaks into round spots of the wash's own pastel colours, crowded but apart. Behind
    // it the picture is gone, so the page shows, and the spots are blown on to the right, each its own
    // way, shrinking to glints and to nothing at its own pace, so that they thin out over the page.
    // A flurry of leaves flies with the front.
    const GO = T.breeze + 0.08, SWEEP = T.end - 0.2 - GO; // when the front comes in at the left, and how long it takes to cross the screen (story seconds)
    const front = (s) => -0.15 + (1.6 * (s - GO)) / SWEEP; // how far across the screen it has come, as a fraction of its width
    const reach = (f) => GO + ((f + 0.15) * SWEEP) / 1.6; // and when it comes to f
    const LIGHT = Math.max(3.2, Math.min(lines, wide) / 14), VX = 0.45 * wide, VY = -0.09 * lines; // the spots' spacing (half rows), and how fast they drift (half rows a story second)
    const lights = [];
    for (let y = -LIGHT, row = 0; y < lines - VY * (T.end - GO) + LIGHT; y += LIGHT * 0.87, row++) { // packed in rows, each offset half a spot from the last
      for (let x = (row & 1) * LIGHT * 0.5 - VX * (T.end - GO) - LIGHT; x < wide + LIGHT; x += LIGHT) {
        const x0 = x + R(-0.3, 0.3) * LIGHT, y0 = y + R(-0.3, 0.3) * LIGHT, met = GO + (x0 + 0.15 * wide) / ((1.6 * wide) / SWEEP - VX);
        const c = Math.max(0, Math.min(cols - 1, Math.floor((x0 + VX * (met - GO)) / px))), l = Math.max(0, Math.min(lines - 1, Math.floor(y0 + VY * (met - GO))));
        let h = Math.max(0, Math.min(12, Math.round(2 * hueAt(wx(c), wy(l)) + R(-1.5, 1.5)))); // the wash's hue where the front meets it, give or take, in half steps
        if (h > 4 && h < 8) h = rand() < 0.5 ? 4 : 8; // blush or mint, never the white between them
        lights.push({ x0, y0, r: LIGHT * (0.16 + 0.42 * rand() ** 1.5), colour: SOFT_FROM + h * 7 + ((rand() * 3) | 0), stay: R(0.04, 0.4), fly: R(0.3, 1.2) * wide, rise: R(-0.35, 0.1) * lines }); // mostly small, a few large; one of the three deepest tones of its hue
      }
    }
    const freed = new Float32Array(H), freedCell = new Float32Array(N); // when each half cell, and each character, is taken: just behind the front, among the spots
    for (let l = 0; l < lines; l++) for (let c = 0; c < cols; c++) { // along a ragged, broken line, so that no straight edge is left standing
      freed[l * cols + c] = reach(((c + 0.5) * px) / wide + 0.07 + 0.12 * (noise(c / 9, l / 7 + 17) - 0.5) + 0.08 * (noise(c / 2.4, l / 2.8 + 31) - 0.5));
    }
    for (let i = 0; i < N; i++) { const c = i % cols, l = ((i / cols) | 0) * 2; freedCell[i] = Math.min(freed[l * cols + c], freed[(l + 1) * cols + c]); }
    const flurry = [];
    for (let j = 0, n = Math.round(12 + span / 80); j < n; j++) {
      flurry.push({ off: R(-0.3, 0.12), y: yT + (yB - yT) * R(0.05, 0.95), rise: R(-160, 40), spin: R(5, 11) * (rand() < 0.5 ? -1 : 1), len: R(60, 100), shade: (rand() * 3) | 0, phase: R(0, 6.28) });
    }

    // ---- Drawing.
    const cR = new Float32Array(H), cG = new Float32Array(H), cB = new Float32Array(H), touched = new Uint8Array(H), touches = new Int32Array(H);
    let nTouched = 0;
    const mix = (i, r, g, b, a) => { // lay a soft colour over half cell i
      cR[i] += (r - cR[i]) * a; cG[i] += (g - cG[i]) * a; cB[i] += (b - cB[i]) * a;
      if (!touched[i]) { touched[i] = 1; touches[nTouched++] = i; }
    };
    const put = (c, r, ch, colour, heavy = 0) => {
      if (c < 0 || c >= cols || r < 0 || r >= rows) return;
      const i = r * cols + c;
      glyph[i] = ch; ink[i] = colour; bold[i] = heavy;
    };
    // Visit every half cell within a box of the screen (in half rows), clipped to the screen.
    const box = (x0, y0, x1, y1, visit) => {
      const c1 = Math.min(cols - 1, Math.floor(x1 / px)), l1 = Math.min(lines - 1, Math.floor(y1));
      for (let l = Math.max(0, Math.floor(y0)); l <= l1; l++) for (let c = Math.max(0, Math.floor(x0 / px)); c <= c1; c++) visit(c, l, (c + 0.5) * px, l + 0.5);
    };

    // A line too thin to fill cells, drawn as slashes, bars and dashes, each glyph chosen by where the
    // line crosses its cell (as in plum-blossom.js). Coordinates in cells: columns across, rows down.
    function thin(c0, r0, c1, r1, colour, heavy = 0) {
      const dc = c1 - c0, dr = r1 - r0, across = Math.abs(dc), high = Math.abs(dr);
      const rising = dc * dr < 0;
      if (across <= high * 1.3) {
        const lo = Math.min(r0, r1), hi = Math.max(r0, r1);
        for (let r = Math.floor(lo); r < hi; r++) {
          const ya = Math.max(lo, r), yb = Math.min(hi, r + 1), cover = yb - ya;
          if (cover < 0.25) continue;
          const ca = c0 + (dc * (ya - r0)) / dr, cb = c0 + (dc * (yb - r0)) / dr;
          const stub = cover < 0.6 ? ((ya + yb) / 2 - r > 0.5 ? (rising ? COMMA : DOT) : HIGH) : 0;
          put(Math.floor((ca + cb) / 2), r, stub || (Math.floor(ca) === Math.floor(cb) ? BAR : rising ? SLASH : BACK), colour, heavy);
        }
      } else {
        const lo = Math.min(c0, c1), hi = Math.max(c0, c1), slope = high / across;
        const level = (c) => {
          const y = r0 + (dr * (Math.min(hi, Math.max(lo, c + 0.5)) - c0)) / dc, f = y - Math.floor(y);
          return Math.floor(y) * 2 + (f < 0.25 ? 0 : f < 0.72 ? 1 : 2);
        };
        for (let c = Math.floor(lo); c < hi; c++) {
          const xa = Math.max(lo, c), xb = Math.min(hi, c + 1);
          if (xb - xa < 0.35) continue;
          const y = r0 + (dr * ((xa + xb) / 2 - c0)) / dc, r = Math.floor(y), f = y - r;
          if (slope > 0.6) put(c, r, rising ? SLASH : BACK, colour, heavy);
          else if (slope > 0.2) put(c, r, f < 0.36 ? (rising ? HIGH : TICK) : f > 0.64 ? (rising ? COMMA : DOT) : DASH, colour, heavy);
          else {
            const q = level(c), steps = level(c + (rising ? 1 : -1)) < q, lands = level(c + (rising ? -1 : 1)) > q;
            if (q % 2 === 0) put(c, q / 2 - 1, LOW, colour, heavy);
            else put(c, (q - 1) / 2, steps ? (rising ? HIGH : TICK) : lands ? (rising ? COMMA : DOT) : DASH, colour, heavy);
          }
        }
      }
    }
    const line = (x0, y0, x1, y1, colour, heavy) => thin(sx(x0) / px, sy(y0) / 2, sx(x1) / px, sy(y1) / 2, colour, heavy); // in painting pixels

    // A bamboo leaf from its base at (x, y) along angle a, `len` long: a narrow painted blade, widest
    // a third of the way out and paler toward its end, which runs on into a long point drawn as a
    // stroke of characters. A leaf too small to paint is all stroke.
    function leaf(x, y, a, len, shade) {
      const ca = Math.cos(a), sa = Math.sin(a), X = sx(x), Y = sy(y), L = len * k, half = len * 0.065 * k;
      if (half < 0.4) { line(x, y, x + ca * len, y + sa * len, LEAF + Math.min(5, shade + 1), 1); return; }
      const m = half + 1;
      box(Math.min(X, X + ca * L) - m, Math.min(Y, Y + sa * L) - m, Math.max(X, X + ca * L) + m, Math.max(Y, Y + sa * L) + m, (c, l, hx, hy) => {
        const dx = hx - X, dy = hy - Y, p = (dx * ca + dy * sa) / L;
        if (p <= 0.02 || p >= 0.84 || Math.abs(dy * ca - dx * sa) > Math.max(0.5, half * Math.sin(Math.PI * (p / 0.84) ** 0.62))) return;
        paint[l * cols + c] = LEAF + Math.min(5, shade + (p > 0.55 ? 1 : 0));
        glyph[(l >> 1) * cols + c] = 32;
      });
      line(x + ca * len * 0.8, y + sa * len * 0.8, x + ca * len, y + sa * len, LEAF + Math.min(5, shade + 1), 0);
    }

    function drawBranches(tau) {
      for (const b of branches) {
        pose(b, tau);
        for (let i = 0; i + 1 < b.px.length; i++) line(b.px[i], b.py[i], b.px[i + 1], b.py[i + 1], STEM + (i & 1), 0);
        for (const f of b.leaves) {
          const turn = b.turn[f.seg], ct = Math.cos(turn), st = Math.sin(turn);
          const x = lerp(b.px[f.seg], b.px[f.seg + 1], f.f) + f.ox * ct - f.oy * st, y = lerp(b.py[f.seg], b.py[f.seg + 1], f.f) + f.ox * st + f.oy * ct;
          const flutter = 0.06 * Math.sin(tau * f.rate * 6.28 + f.phase) + 0.16 * b.gust * Math.sin(tau * 15 + f.phase * 3);
          leaf(x, y, f.a + turn + flutter + 0.5 * b.gust * Math.sin(0.35 - f.a), f.len, f.shade); // in the gust a leaf streams out with the wind
        }
      }
    }

    // Chimes far behind: a soft ball of glass with a pale rim and a highlight, a faint chain, and
    // whatever hangs below it, all blurred.
    function drawBacks(tau) {
      for (const f of backs) {
        const a = f.angle(tau), sa = Math.sin(a), ca = Math.cos(a), along = f.y - FAR_PIVOT;
        const X = sx(f.x + along * (sa - Math.sin(f.rest))), Y = sy(FAR_PIVOT + along * ca), r = Math.max(1.2, f.r * k), blur = r * 0.4 + 0.8;
        if (X < -r * 3 || X > wide + r * 3) continue;
        for (let l = Math.max(0, Math.floor(sy(FAR_PIVOT))); l < Y - r; l += 2) { // a faint chain, up out of the frame
          const c = Math.floor((X + (l + 0.5 - Y) * (sa / ca)) / px);
          if (c >= 0 && c < cols) mix(l * cols + c, 220, 208, 180, 0.35);
        }
        const tint = f.lilac ? [204, 190, 226] : [190, 210, 224];
        box(X - r - blur, Y - r - blur, X + r + blur, Y + r + blur, (c, l, hx, hy) => {
          const dx = hx - X, dy = hy - Y, d = Math.hypot(dx, dy) / r, body = 1 - smooth(0.75, 1 + blur / r, d);
          if (body <= 0) return;
          const i = l * cols + c;
          mix(i, tint[0], tint[1], tint[2], 0.5 * body * Math.exp(-(((d - 0.85) / 0.32) ** 2)));
          mix(i, 255, 255, 255, 0.35 * body * (1 - d * d) + 0.7 * Math.exp(-((Math.hypot(dx + 0.35 * r, dy + 0.4 * r) / (0.3 * r)) ** 2)));
        });
        if (f.hang) { // below it, swinging with it
          const long = f.hang === 3 ? r * 3.2 : r * 1.7, thick = f.hang === 3 ? r * 0.85 : r * 0.32, hx0 = X + sa * (r + 1), hy0 = Y + ca * (r + 1);
          const colour = f.hang === 2 ? [196, 176, 224] : f.hang === 1 ? [232, 236, 240] : [250, 246, 250];
          box(hx0 - thick * 1.6 - long * Math.abs(sa), hy0 - 1, hx0 + thick * 1.6 + long * Math.abs(sa), hy0 + long * 1.2, (c, l, hx, hy) => {
            const p = (hy - hy0) / long, q = (hx - hx0 - (hy - hy0) * (sa / ca)) / thick;
            if (p >= 0 && p <= 1.2 && Math.abs(q) <= 1.6) mix(l * cols + c, colour[0], colour[1], colour[2], 0.6 * (1 - smooth(0.6, 1.5, Math.abs(q))) * (1 - smooth(0.75, 1.15, p)));
          });
        }
        if (r > 2.5 && hash(f.x | 0, 3) < 0.6) put(Math.floor((X - 0.35 * r) / px), Math.floor((Y - 0.4 * r) / 2), DOT, WHITE); // a faint glint
      }
    }

    function drawSpots(tau) {
      for (const p of spots) {
        const X = sx(p.x), Y = sy(p.y), r = Math.max(1.1, p.r * k), glow = 1 + 0.2 * Math.sin((tau * 6.28) / p.rate + p.phase);
        const [cr, cg, cb] = p.warm ? [253, 247, 228] : [255, 255, 255];
        box(X - r * 1.3, Y - r * 1.3, X + r * 1.3, Y + r * 1.3, (c, l, hx, hy) => {
          const d = Math.hypot(hx - X, hy - Y) / r;
          if (d < 1.3) mix(l * cols + c, cr, cg, cb, Math.min(0.9, glow * (0.45 + 0.15 * smooth(0.6, 0.9, d)) * (1 - smooth(0.9, 1.3, d))));
        });
      }
    }

    // The ring of a glass ball in characters: brackets and slashes where it crosses the middle of
    // each row, dashes where it crosses the middle of each column. A ball too small for that is one letter.
    function ring(X, Y, r, colour) {
      if (r < 2.2) { put(Math.floor(X / px), Math.floor(Y / 2), r < 1.5 ? RING : BALL, colour); return; }
      for (let row = Math.floor((Y - r) / 2); row <= Math.floor((Y + r) / 2); row++) { // its sides: where it crosses the middle of each row
        const dy = row * 2 + 1 - Y;
        if (Math.abs(dy) > r * 0.72) continue;
        const dx = Math.sqrt(r * r - dy * dy), steep = Math.abs(dy) < r * 0.45;
        put(Math.floor((X - dx) / px), row, steep ? OPEN : dy < 0 ? SLASH : BACK, colour); // the upper left leans like a slash
        put(Math.floor((X + dx) / px), row, steep ? CLOSE : dy < 0 ? BACK : SLASH, colour);
      }
      for (let c = Math.floor((X - r) / px); c <= Math.floor((X + r) / px); c++) { // its top and bottom: where it crosses the middle of each column
        const dx = (c + 0.5) * px - X;
        if (Math.abs(dx) > r * 0.7) continue;
        for (const side of [-1, 1]) {
          const y = (Y + side * Math.sqrt(r * r - dx * dx)) / 2, row = Math.floor(y), f = y - row;
          put(c, row, f < 0.3 ? HIGH : f < 0.7 ? DASH : LOW, colour);
        }
      }
    }
    // A clear glass ball: whatever is behind it, seen through it upside down and brightened; a
    // grey-blue rim; a highlight at the upper left and light gathered at its foot. Gold flecks
    // inside turn with it, and catch the light as they come round to face it.
    const under = new Uint8Array(H);
    function orb(X, Y, r, spin) {
      box(X - r, Y - r, X + r, Y + r, (c, l) => { under[l * cols + c] = paint[l * cols + c]; });
      box(X - r, Y - r, X + r, Y + r, (c, l, hx, hy) => {
        const dx = hx - X, dy = hy - Y, d = Math.hypot(dx, dy) / r;
        if (d > 1) return;
        const sc = Math.max(0, Math.min(cols - 1, Math.floor((X - dx * 0.65) / px))), sl = Math.max(0, Math.min(lines - 1, Math.floor(Y - dy * 0.65)));
        const [br, bg, bb] = RGB[under[sl * cols + sc]];
        const shine = Math.min(1, 0.3 + 0.95 * Math.exp(-((Math.hypot(dx + 0.38 * r, dy + 0.4 * r) / (0.24 * r)) ** 2)) + 0.5 * Math.exp(-((Math.hypot(dx - 0.2 * r, dy - 0.52 * r) / (0.28 * r)) ** 2)));
        const edge = 0.7 * smooth(0.66, 1, d);
        paint[l * cols + c] = tone(l * cols + c, lerp(lerp(br, 255, shine), 150, edge), lerp(lerp(bg, 255, shine), 176, edge), lerp(lerp(bb, 255, shine), 192, edge));
        glyph[(l >> 1) * cols + c] = 32;
      });
      ring(X, Y, r, RIM);
      if (r < 2.2) return;
      if (r >= 3) put(Math.floor((X - 0.38 * r) / px), Math.floor((Y - 0.4 * r) / 2), HIGH, WHITE);
      const shown = [];
      for (const [lat, lon, deep] of ORB_FLECKS) {
        const turn = lon + spin, fx = X + deep * r * Math.cos(lat) * Math.sin(turn), fy = Y + deep * r * Math.sin(lat), front = Math.cos(turn) > 0;
        const c = Math.floor(fx / px), row = Math.floor(fy / 2);
        if (Math.hypot((c + 0.5) * px - X, row * 2 + 1 - Y) > r * 0.8 + 0.3) continue;
        const glint = front && Math.cos(turn - 0.5) > 0.96;
        shown.push([glint ? 2 : front ? 1 : 0, c, row, glint ? STAR : front ? DOT : COMMA, glint ? GOLD + 3 : front ? GOLD + 1 : GOLD]);
      }
      shown.sort((p, q) => p[0] - q[0]).forEach(([lit, c, row, ch, colour]) => put(c, row, ch, colour, lit > 1 ? 1 : 0)); // a glint shows over a dull fleck in the same cell
    }

    // The paper strip, hanging from its top middle at (X, Y) at angle phi from straight down (to the
    // right). It twists, so it narrows and widens, and ripples along its length as it flutters. It
    // is translucent paper, nearly white over the wash, with soft round marks, fine edges drawn in
    // characters, and gold leaf.
    function strip(X, Y, phi, twist, ripple, tau) {
      const ux = Math.sin(phi), uy = Math.cos(phi), L = STRIP[0] * k, half = (STRIP[1] * k) / 2;
      const wave = (p) => ripple * L * p ** 1.5 * Math.sin(p * 7 - tau * 11);
      const width = (p) => half * Math.max(0.28, Math.abs(Math.cos(twist + p * 1.1)));
      const at = (p, q) => { const o = q * width(p) + wave(p); return [X + ux * p * L + uy * o, Y + uy * p * L - ux * o]; }; // on screen: p along the strip, q across it
      const ex = X + ux * L, ey = Y + uy * L, m = half + Math.abs(ripple) * L + 1;
      box(Math.min(X, ex) - m, Math.min(Y, ey) - m, Math.max(X, ex) + m, Math.max(Y, ey) + m, (c, l, hx, hy) => {
        const dx = hx - X, dy = hy - Y, p = (dx * ux + dy * uy) / L;
        if (p < 0 || p > 1) return;
        const w = width(p), q = (dx * uy - dy * ux - wave(p)) / w;
        if (Math.abs(q) > 1) return;
        const i = l * cols + c;
        let rr = lerp(cR[i], 253, 0.78), gg = lerp(cG[i], 251, 0.78), bb = lerp(cB[i], 253, 0.78);
        for (const [ma, mb, mr, rgb] of MARKS) { // round marks
          const e = Math.hypot((p - ma) / mr, ((q - mb) * w) / (mr * L));
          if (e < 1) { const a = 0.85 * (1 - e * e); rr = lerp(rr, rgb[0], a); gg = lerp(gg, rgb[1], a); bb = lerp(bb, rgb[2], a); }
        }
        paint[i] = tone(i, rr, gg, bb);
        glyph[(l >> 1) * cols + c] = 32;
      });
      for (let j = 0; j < 4; j++) for (const q of [-0.8, 0.8]) { // its long edges, bending as it ripples
        const [x0, y0] = at(j / 4, q), [x1, y1] = at((j + 1) / 4, q);
        thin(x0 / px, y0 / 2, x1 / px, y1 / 2, PAPER);
      }
      const [bx0, by0] = at(0.99, -0.8), [bx1, by1] = at(0.99, 0.8);
      thin(bx0 / px, by0 / 2, bx1 / px, by1 / 2, PAPER);
      FLECKS.forEach(([p, q], j) => {
        if (width(p) < half * 0.45) return;
        const [fx, fy] = at(p, q * 0.7);
        put(Math.floor(fx / px), Math.floor(fy / 2), j % 3 === 0 ? STAR : j % 3 === 1 ? DOT : HIGH, GOLD + 1 + (j & 1));
      });
    }

    // A chime at time tau: chain, beads, orb, and the strip or tassel, all on the chain's angle.
    function drawChime(ch, tau) {
      const a = ch.angle(tau), sa = Math.sin(a), ca = Math.cos(a), pivot = Math.min(PIVOT, yT - 60);
      const bx = ch.x - (ch.orb[0] - pivot) * Math.tan(ch.rest); // the pivot is placed so that the first frame matches the painting
      const at = (y) => { const d = (y - pivot) / Math.cos(ch.rest); return [bx + d * sa, pivot + d * ca]; };
      const parts = [...ch.beads.map(([y, r]) => [y, r]), ch.orb].sort((p, q) => p[0] - q[0]);
      let from = pivot;
      for (const [y, r] of parts) { // the chain, between the things threaded on it
        const [x0, y0] = at(from), [x1, y1] = at(y - r);
        if (y - r > from) line(x0, y0, x1, y1, GOLD + 1, 0);
        from = y + r;
      }
      const [fx, fy] = at(ch.foot), [lx, ly] = at(from);
      line(lx, ly, fx, fy, GOLD + 1, 0);
      for (const [y, r, colour] of ch.beads) { // a bead is a letter; one big enough is painted, and a clear one keeps its rim
        const [x, yy] = at(y), X = sx(x), Y = sy(yy), rr = r * k, clear = colour === RIM + 1;
        if (rr > 1.1) box(X - rr, Y - rr, X + rr, Y + rr, (c, l, hx, hy) => { if (Math.hypot(hx - X, hy - Y) <= rr) { paint[l * cols + c] = clear ? tone(l * cols + c, 236, 242, 246) : colour; glyph[(l >> 1) * cols + c] = 32; } });
        if (clear || rr <= 1.6) put(Math.floor(X / px), Math.floor(Y / 2), RING, clear ? RIM : colour);
      }
      const [ox, oy] = at(ch.orb[0]);
      orb(sx(ox), sy(oy), Math.max(1.5, ch.orb[1] * k), ch.phase * 2 + tau * 0.9);
      const lift = look(ch.lift, tau), gust = clamp01(look(BEND, tau - late(ch.x)));
      if (ch.strip) {
        const flutter = (0.03 + 0.1 * gust) * Math.sin(tau * 13 - 1.3) + (0.02 + 0.06 * gust) * Math.sin(tau * 21);
        const sway = 0.12 * (1 - 0.7 * gust) * Math.sin(tau * 3.3 - Math.PI / 2); // its own slow swing, which starts at its leftmost, as the painting has it
        const twist = 0.5 * Math.sin(tau * 2.1 + 0.4) + 0.25 * Math.sin(tau * 5.3) + 0.4 * gust * Math.sin(tau * 9);
        strip(sx(fx), sy(fy), a + lift + sway + flutter, twist, 0.012 + 0.05 * gust, tau);
      } else { // the tassel: a few pale strands from a gold cap
        const t = a + lift + (0.05 + 0.12 * gust) * Math.sin(tau * 11 + 2), L = TASSEL[0];
        for (let j = -1; j <= 1; j++) {
          const o = (j * TASSEL[1]) / 2, ex = fx + Math.sin(t) * L + Math.cos(t) * o * 1.3, ey = fy + Math.cos(t) * L - Math.sin(t) * o * 1.3;
          line(fx + Math.cos(t) * o * 0.5, fy - Math.sin(t) * o * 0.5, ex, ey, TUFT + (j === 0 ? 0 : 1), 0);
        }
        put(Math.floor(sx(fx) / px), Math.floor(sy(fy) / 2), RING, GOLD + 1);
      }
    }

    // Loose leaves rock from side to side as they fall, tilting with each swing, and the wind
    // carries them; the gust's leaves fly across, tumbling, so their length comes and goes.
    function drawLoose(tau, s) {
      for (const f of lanes) {
        const went = f.y - TOP + FALL * tau, lap = Math.floor(went / CYCLE), y = TOP + went - lap * CYCLE, age = (y - TOP) / FALL, born = tau - age;
        const x0 = lap ? xL + hash(f.lane * 31 + seed, lap) * span : f.x0, a0 = lap ? (hash(f.lane, lap * 7 + seed) - 0.5) * 1.6 : f.a0;
        const blown = (look(CARRY, tau - late(x0)) - look(CARRY, born - late(x0))) * f.push;
        const x = x0 + DRIFT * age + f.rock * Math.sin(age * f.rate + f.phase) + blown, a = a0 + 0.45 * Math.cos(age * f.rate + f.phase);
        leaf(x - (Math.cos(a) * f.len) / 2, y - (Math.sin(a) * f.len) / 2, a, f.len, f.shade);
      }
      for (const f of swept) {
        const age = s - f.s0, x = xL - 140 + f.speed * age, y = f.y + f.dy * age + 30 * Math.sin(5 * age + f.phase);
        if (age <= 0 || x > xR + 140) continue;
        const a = f.phase + f.spin * age, len = f.len * (0.35 + 0.65 * Math.abs(Math.cos(age * 3 + f.phase)));
        leaf(x - (Math.cos(a) * len) / 2, y - (Math.sin(a) * len) / 2, a, len, f.shade);
      }
    }

    // The handover, laid over the finished frame. A spot grows as the front comes to it, is whole
    // while the front is near, and shrinks as it falls behind; too small to paint, it is a glint of
    // its colour, `O`, `o` and then `.`, until it is gone.
    function carryOff(s) {
      const at = front(s), dx = VX * (s - GO), dy = VY * (s - GO);
      for (let i = 0; i < H; i++) if (s > freed[i]) paint[i] = 0;
      for (let i = 0; i < N; i++) if (s > freedCell[i]) glyph[i] = 32;
      for (const p of lights) {
        const e = at - (p.x0 + dx) / wide, loose = Math.max(0, e - 0.08), r = p.r * smooth(-0.05, 0.02, e) * (1 - smooth(0, p.stay, loose)); // formed at the front, gone at its own distance behind it
        const X = p.x0 + dx + p.fly * loose * loose, Y = p.y0 + dy + p.rise * loose; // once the front has passed, each is blown its own way
        if (r < 0.35 || X + r < 0 || X - r > wide || Y + r < 0 || Y - r > lines) continue;
        if (r < 2.2) { put(Math.floor(X / px), Math.floor(Y / 2), r < 0.8 ? DOT : r < 1.4 ? RING : BALL, p.colour); continue; }
        box(X - r, Y - r, X + r, Y + r, (c, l, hx, hy) => {
          if (Math.hypot(hx - X, hy - Y) > r) return;
          paint[l * cols + c] = p.colour;
          glyph[(l >> 1) * cols + c] = 32;
        });
      }
      for (const f of flurry) {
        const x = xL + span * (at + f.off), y = f.y + f.rise * (s - GO) + 25 * Math.sin(6 * (s - GO) + f.phase);
        if (x < xL - 150 || x > xR + 150) continue;
        const a = f.phase + f.spin * (s - GO), len = f.len * (0.4 + 0.6 * Math.abs(Math.cos(4 * (s - GO) + f.phase))); // tumbling, so its length comes and goes
        leaf(x - (Math.cos(a) * len) / 2, y - (Math.sin(a) * len) / 2, a, len, f.shade);
      }
    }

    return {
      cols, rows, palette: INK, glyph, ink, bold, paint,
      render(t) { // t: seconds since the film started
        glyph.fill(32); ink.fill(0); bold.fill(0); paint.fill(0);
        if (t >= LENGTH) return this; // over: an empty frame, so the page shows
        const s = t * SPEED; // where that is in the story
        // the soft layer: the wash, with the light spots and far chimes laid over it
        cR.set(bR); cG.set(bG); cB.set(bB);
        for (let j = 0; j < nTouched; j++) touched[touches[j]] = 0;
        nTouched = 0;
        drawSpots(t);
        drawBacks(t);
        paint.set(ground);
        for (let j = 0; j < nTouched; j++) { const i = touches[j]; paint[i] = tone(i, cR[i], cG[i], cB[i]); }
        for (let j = 0; j < specks.length; j += 3) { glyph[specks[j]] = specks[j + 1]; ink[specks[j]] = specks[j + 2]; }
        for (let j = 0; j < stalk.length; j += 2) paint[stalk[j]] = stalk[j + 1];
        for (let j = 0; j < stalkMarks.length; j += 4) put(stalkMarks[j], stalkMarks[j + 1], stalkMarks[j + 2], stalkMarks[j + 3]);
        drawBranches(t);
        for (const ch of CHIMES) drawChime(ch, t);
        drawLoose(t, s);
        if (s > T.breeze) carryOff(s);
        return this;
      },
    };
  }

  // Play it on the stage. Resolves when it has finished. `seed` changes the details at the sides of
  // wide screens, where loose leaves come in, the gold leaf and the handover's light and flurry, not
  // the painting's own layout. `freezeAt` holds one moment (in seconds) on screen. Reduced motion
  // holds the first frame, which is the painting.
  const film = { length: LENGTH, still: 0, grid: [110, 60], createScene };
  return { play: (options) => AsciiStage.play(film, options), createScene };
})();
