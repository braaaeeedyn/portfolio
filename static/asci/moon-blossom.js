/*
 * Blossom under the moon: an ASCII loading screen.
 *
 *   <script src="ascii-stage.js"></script>
 *   <script src="moon-blossom.js"></script>
 *   <script>MoonBlossom.play().then(showThePage);</script>
 *
 * An old blossom tree stands on a low islet in front of an enormous full moon,
 * the only light, sitting on the horizon of a dark lake. Stars and soft blue
 * star clouds circle the moon, thin gold streaks hang down the sky like
 * curtains, sparkling ribbons of light wave above the horizon and short
 * streaks of light rise off the water by the islet. The water ripples toward
 * the camera, breaking and re-forming the moon's broad reflection, and a few
 * petals drift down from the canopy onto it. The camera holds, then pushes
 * slowly toward the tree. A breeze from the left sways the canopy and lifts a
 * long curved band of petals off it, across the face of the moon; the band
 * sinks and scatters onto the water on the right, and the canopy settles,
 * still in bloom. Then a thicker band of petals blows in from beyond the left
 * of the frame, drags the picture along with it to the right and covers it,
 * and thins away to the page. Five seconds (LENGTH, below).
 *
 * The scene is set out in the source image's frame. The camera only moves
 * straight toward the foot of the tree, so everything that stands up is a flat
 * layer at its own distance, seen growing about that point, the nearer the
 * faster; the water is found along each half cell's ray. The whole film is a
 * pure function of time: createScene().render(t) fills a grid of characters
 * and the colours behind them, and the stage (ascii-stage.js) paints that grid.
 */
const MoonBlossom = (() => {
  'use strict';
  const { code, clamp01, lerp, smooth, mulberry32, hash, noise } = AsciiStage;

  // The story's timeline, in the seconds of the user's description.
  const T = {
    push: 2.0,   // the camera starts its push toward the tree
    breeze: 5.0, // a breeze from the left: the canopy sways right and a band of petals lifts off it
    lull: 7.5,   // the breeze dies: the band sinks and scatters onto the water
    calm: 9.0,   // the canopy is still again, in full bloom
    hand: 9.7,   // a thicker band of petals blows in from the left and carries the picture away
    end: 11.2,
  };
  // It is played faster than that. LENGTH is how many seconds the whole of it
  // takes on screen, and SPEED how many times faster than the story that is.
  const LENGTH = 5, SPEED = T.end / LENGTH;

  // The source image's frame, in frame heights: x across from its middle, y
  // down from its top. It is 16:9. A wider screen sees more of the world to
  // the sides; a narrower one keeps the tree and the moon across its width
  // (KEEP) and sees more sky above and more water below.
  const WIDE = 16 / 9;
  const HZ = 0.69;                     // the horizon
  const MOON = [-0.189, 0.448, 0.395]; // its centre across and down, and its radius
  const ROOT = [-0.236, 0.69];         // the foot of the trunk
  const TOP = 0.19;                    // the top of the crown
  const KEEP = [-0.84, 0.36];          // the tree and the moon, from side to side
  // The camera moves straight toward the foot of the trunk, low over the water.
  // Distances are in tree distances: the tree is 1 off, the moon a little
  // farther and the stars far beyond, so the tree grows fastest. LE is the
  // camera's height over the water, in frame heights at the tree.
  const PUSH = 1 - 1 / 1.3; // how far the camera has come at 10 s, when the tree looks 1.3 times larger
  const DMOON = 1.16, DSKY = 2.6, LE = 0.035;
  const dolly = (s) => { const w = Math.max(0, s - T.push), e = 0.4; return (PUSH / (10 - T.push - e / 2)) * (w < e ? (w * w) / (2 * e) : w - e / 2); };
  const grown = (D, cz) => D / (D - cz); // how much larger a thing D off looks once the camera has come cz

  // Colours. `swatch` adds a run of colours to INK and gives the index of the first.
  const INK = ['#000000'];
  const swatch = (...colours) => INK.push(...colours) - colours.length;
  const run = (n, ...stops) => Array.from({ length: n }, (_, i) => { // n colours, evenly through the stops
    const x = (i / (n - 1)) * (stops.length - 1), j = Math.min(stops.length - 2, x | 0);
    return '#' + stops[j].map((v, k) => Math.round(lerp(v, stops[j + 1][k], x - j)).toString(16).padStart(2, '0')).join('');
  });
  const NL = 24, NIGHT = swatch(...run(NL, [3, 4, 10], [9, 13, 30], [20, 30, 62], [48, 62, 104], [112, 128, 168], [196, 205, 224], [255, 255, 255])); // black, deep navy, moonlight, white
  const NB = 10, NEBULA = swatch(...run(NB, [12, 20, 46], [20, 38, 80], [34, 62, 118], [56, 96, 162], [104, 146, 208], [170, 202, 240])); // star cloud, navy to soft blue
  const BL = 14, BLOOM = swatch(...run(BL, [38, 30, 50], [88, 70, 92], [146, 120, 140], [198, 172, 188], [236, 218, 228], [255, 247, 250])); // blossom, deep shade to white-pink
  const WOOD = swatch('#05060c', '#0a0d18', '#121626', '#1b2135'); // the trunk and the islet, black to deep navy
  const GL = 6, GOLD = swatch(...run(GL, [70, 54, 28], [134, 104, 50], [198, 160, 86], [244, 220, 150]));
  const FL = 12, FLOOD = swatch(...Array.from({ length: FL }, (_, i) => `rgba(250,234,241,${((i + 1) / FL).toFixed(3)})`)) - 1; // the last band of petals, thinning
  const night = (L) => NIGHT + Math.max(0, Math.min(NL - 1, Math.round(L * (NL - 1))));
  const bloom = (tone) => BLOOM + Math.max(0, Math.min(BL - 1, Math.round(tone)));

  const [BAR, SLASH, BACK, LOW, DASH, HIGH, TICK, COMMA, DOT, WAVE, EQ, STAR, PLUS, RING, AT, QUOTE] = code("|/\\_-'`,.~=*+o@\"");
  const PETAL = code("',`."), WHOLE = code('*o*@');
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const fbm = (x, y) => 0.5 * noise(x, y) + 0.3 * noise(x * 2.1 + 7, y * 2.1 + 3) + 0.2 * noise(x * 4.3 + 1, y * 4.3 + 9);

  // The tree, drawn from the source image: the trunk and its limbs as points
  // [across, down, thickness] from the foot up and out. The first two limbs
  // are the long ones reaching left and right below the crown; the rest are
  // twigs climbing into it, which the crown hides but for their lower ends.
  const TRUNK = [[-0.236, 0.69, 0.07], [-0.228, 0.655, 0.046], [-0.219, 0.615, 0.04], [-0.226, 0.585, 0.038], [-0.244, 0.556, 0.036], [-0.259, 0.533, 0.033], [-0.255, 0.508, 0.03]];
  const LIMBS = [
    [[-0.259, 0.53, 0.026], [-0.29, 0.523, 0.022], [-0.319, 0.521, 0.019], [-0.356, 0.526, 0.017], [-0.393, 0.536, 0.015], [-0.43, 0.551, 0.014], [-0.467, 0.561, 0.012],
      [-0.504, 0.566, 0.011], [-0.533, 0.564, 0.01], [-0.556, 0.559, 0.009], [-0.578, 0.554, 0.008], [-0.607, 0.536, 0.007], [-0.652, 0.511, 0.006], [-0.7, 0.49, 0.005], [-0.745, 0.47, 0.004]],
    [[-0.25, 0.505, 0.022], [-0.215, 0.502, 0.019], [-0.193, 0.506, 0.017], [-0.156, 0.521, 0.016], [-0.133, 0.546, 0.015], [-0.108, 0.551, 0.013], [-0.067, 0.541, 0.012],
      [-0.015, 0.533, 0.011], [0.044, 0.529, 0.009], [0.104, 0.532, 0.008], [0.163, 0.526, 0.006], [0.222, 0.514, 0.005], [0.26, 0.5, 0.004]],
    [[-0.255, 0.508, 0.014], [-0.27, 0.47, 0.011], [-0.3, 0.42, 0.008], [-0.33, 0.37, 0.006], [-0.36, 0.32, 0.004]],
    [[-0.252, 0.51, 0.014], [-0.24, 0.46, 0.011], [-0.225, 0.4, 0.008], [-0.215, 0.33, 0.006], [-0.2, 0.27, 0.004]],
    [[-0.215, 0.502, 0.012], [-0.18, 0.47, 0.009], [-0.14, 0.43, 0.007], [-0.09, 0.39, 0.005], [-0.05, 0.36, 0.004]],
    [[-0.393, 0.536, 0.008], [-0.42, 0.5, 0.006], [-0.46, 0.45, 0.005], [-0.5, 0.4, 0.004]],
    [[-0.578, 0.554, 0.006], [-0.6, 0.52, 0.005], [-0.63, 0.47, 0.004]],
    [[-0.067, 0.541, 0.008], [-0.04, 0.5, 0.006], [0, 0.46, 0.005], [0.04, 0.43, 0.004]],
    [[0.104, 0.532, 0.006], [0.12, 0.5, 0.005], [0.15, 0.47, 0.004]],
  ];
  const MAIN = [TRUNK, LIMBS[0], LIMBS[1]], TWIGS = LIMBS.slice(2);
  // The crown's outline: along its top from the tip of the left limb, over
  // the flat top to the tip of the right one, then back along its underside.
  const CROWN = [
    [-0.79, 0.455], [-0.78, 0.43], [-0.75, 0.415], [-0.715, 0.41], [-0.68, 0.42], [-0.655, 0.44], [-0.645, 0.4], [-0.635, 0.355], [-0.61, 0.325], [-0.575, 0.3],
    [-0.53, 0.272], [-0.46, 0.236], [-0.385, 0.222], [-0.31, 0.212], [-0.252, 0.2], [-0.2, 0.193], [-0.16, 0.205], [-0.126, 0.23], [-0.09, 0.262], [-0.052, 0.296],
    [0.007, 0.345], [0.059, 0.375], [0.133, 0.39], [0.18, 0.41], [0.207, 0.43], [0.244, 0.46], [0.275, 0.49], [0.292, 0.512],
    [0.27, 0.532], [0.207, 0.537], [0.13, 0.55], [0.059, 0.55], [-0.02, 0.54], [-0.089, 0.535], [-0.13, 0.52], [-0.163, 0.503], [-0.2, 0.474],
    [-0.274, 0.47], [-0.348, 0.49], [-0.422, 0.5], [-0.48, 0.506], [-0.519, 0.516], [-0.56, 0.53], [-0.607, 0.546], [-0.66, 0.54], [-0.72, 0.52], [-0.756, 0.49],
  ];
  const inCrown = (x, y) => {
    let inside = false;
    for (let i = 0, j = CROWN.length - 1; i < CROWN.length; j = i++) {
      const [xi, yi] = CROWN[i], [xj, yj] = CROWN[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  const CROWN_AREA = Math.abs(CROWN.reduce((a, [x, y], i) => { const [u, v] = CROWN[(i + 1) % CROWN.length]; return a + x * v - u * y; }, 0)) / 2;
  const lifted = (y) => clamp01((ROOT[1] - y) / (ROOT[1] - TOP)); // 0 at the foot of the trunk, 1 at the top of the crown

  // The islet: a low strip of rock and grass along the horizon, a rock round
  // the foot of the trunk and another to the right of it. Its height over the
  // horizon at x, in frame heights.
  const ISLE = [-0.64, 0.15];
  const ROCKS = [[-0.245, 0.036, 0.1], [-0.03, 0.03, 0.05], [-0.5, 0.014, 0.05], [0.08, 0.012, 0.04]]; // [across, height, half width]
  const isleTop = (x) => {
    let h = 0.008 + 0.007 * noise(x * 45, 3.3);
    for (const [c, high, w] of ROCKS) h = Math.max(h, high * (1 - ((x - c) / w) ** 2) * (0.85 + 0.3 * noise(x * 90, c * 7)));
    return h * smooth(ISLE[0], ISLE[0] + 0.07, x) * smooth(ISLE[1], ISLE[1] - 0.06, x);
  };

  // How hard the breeze leans on the crown at story time s: nothing, then a
  // gusting push to the right, then a swing back that dies away.
  const gust = (s) => {
    if (s <= T.breeze) return 0;
    const u = Math.min(s, T.lull), g = smooth(T.breeze, T.breeze + 0.6, u) * (0.85 + 0.15 * Math.sin((u - T.breeze) * 5.2));
    return s < T.lull ? g : g * Math.exp(-(s - T.lull) / 0.42) * Math.cos((s - T.lull) * 4);
  };
  // How far a point (x, y) of the tree is pushed to the right at story time s
  // (and screen time t): the crown and the far tips move most, the foot of the
  // trunk not at all, and the gust reaches the left of the tree first. LEAN is
  // how far the gust pushes the top of the crown, in frame heights.
  const LEAN = 0.045;
  const sway = (x, y, s, t) => {
    const lift = lifted(y);
    return (lift ** 1.6 + 0.6 * Math.abs(x - ROOT[0]) * lift) * (LEAN * gust(s - (x + 0.85) * 0.3) + 0.0035 * Math.sin(t * 1.3 + x * 4 + y * 3));
  };

  // The way the breeze carries the band of petals: up off the crown, over the
  // face of the moon and down past its right edge toward the water.
  const STREAM = [[-0.52, 0.31], [-0.36, 0.222], [-0.17, 0.168], [0.02, 0.172], [0.2, 0.226], [0.35, 0.31], [0.47, 0.43], [0.56, 0.57], [0.62, 0.7]];

  // The breeze that carries the band, and how much of it has blown by story
  // time s (in seconds of full breeze), tabulated every 1/60 s.
  const breeze = (s) => smooth(T.breeze, T.breeze + 0.4, s) * (1 - smooth(T.lull - 0.4, T.lull + 0.6, s)) * (1 + 0.15 * Math.sin(s * 3.7));
  const BLOWN = new Float32Array(Math.ceil(T.end * 60) + 2);
  for (let i = 1; i < BLOWN.length; i++) BLOWN[i] = BLOWN[i - 1] + breeze(i / 60) / 60;
  const blown = (s) => { const k = Math.max(0, Math.min(BLOWN.length - 2, s * 60)), i = k | 0; return lerp(BLOWN[i], BLOWN[i + 1], k - i); };
  const FLOW = 0.33; // frame heights along the stream for a second of full breeze

  // Ripples on the water: [wavelength, height, wobble across, how far it bends]
  // in tree distances. They roll toward the camera at RIPPLE a second.
  const WAVES = [[0.022, 0.5, 9, 1.4], [0.011, 0.35, 19, 1.8], [0.0055, 0.22, 41, 2.2]];
  const RIPPLE = 0.006;
  // Where the short streaks of light rise off the water: [across, distance, lean].
  const SPARKS = [[-0.13, 0.97, -0.25], [-0.09, 0.95, -0.3], [0.02, 0.97, 0], [0.065, 0.96, 0.05], [0.11, 0.98, 0.1], [0.21, 0.93, 0.15], [0.6, 0.95, 0], [0.63, 0.93, 0.1], [-0.72, 0.96, 0], [-0.87, 0.97, 0.05]];
  // The ribbons of light over the horizon: [side, height, wave height, wavelength, phase].
  const RIBBONS = [[-1, 0.648, 0.03, 0.42, 0], [-1, 0.664, 0.02, 0.3, 2.6], [1, 0.638, 0.042, 0.56, 0.4], [1, 0.66, 0.026, 0.38, 3.1]];
  // The gold streaks down the sky: x = a + b (y - c)^2, curving the other way above c, down to y = d.
  const CURTAINS = [[0.33, 0.9, -0.08, 0.5], [0.37, 0.85, -0.1, 0.47], [0.43, 0.75, -0.04, 0.41], [-0.7, -0.85, -0.12, 0.38], [-0.76, -0.7, -0.05, 0.3],
    [0.98, 0.6, -0.15, 0.45], [-1.02, -0.6, -0.15, 0.42], [1.2, 0.7, -0.2, 0.5], [-1.24, -0.7, -0.2, 0.48]];

  function createScene({ cols, rows, aspect = 2, seed = 1 }) {
    const rand = mulberry32(seed), R = (a, b) => a + (b - a) * rand();
    const H2 = rows * 2, N = cols * H2, cells = cols * rows;
    const glyph = new Uint8Array(cells), ink = new Uint8Array(cells), bold = new Uint8Array(cells), paint = new Uint8Array(N), wash = new Uint8Array(cells);
    const kind = new Uint8Array(N); // what each half cell shows
    const SKY = 0, LUNA = 1, WATER = 2, ISLET = 3, BARK = 4, CROWNK = 5;

    // Fit the frame to the screen: FW columns and FH half rows to a frame height.
    const sq = aspect / 2, A = cols / (H2 * sq), keep = KEEP[1] - KEEP[0], fits = A >= keep;
    const FW = fits ? H2 * sq : cols / keep, FH = FW / sq;
    const mid = fits ? Math.max(KEEP[1] - A / 2, Math.min(0, KEEP[0] + A / 2)) : (KEEP[0] + KEEP[1]) / 2; // the frame's x at the middle of the screen
    const top = fits ? 0 : (H2 / FH - 1) * 0.45; // frame heights of sky above the frame
    const Xc = Float32Array.from({ length: cols }, (_, c) => mid + (c + 0.5 - cols / 2) / FW);
    const Yh = Float32Array.from({ length: H2 }, (_, h) => (h + 0.5) / FH - top);
    const colOf = (x) => cols / 2 + (x - mid) * FW, rowOf = (y) => (y + top) * FH; // a column, a half row
    const yOfRow = (r) => (2 * r + 1) / FH - top; // the middle of a row of cells, in the frame
    const hz = Math.max(0, Math.min(H2, Math.ceil(rowOf(HZ) - 0.5))); // the first half row below the horizon
    const area = WIDE * FW * (FH / 2); // cells in the source frame: things are counted in proportion to it
    const big = FH > 180; // on a very fine grid a petal is a whole cell, not half of one
    const order = new Float32Array(N); // a fixed threshold in each half cell, for dithering between colours
    for (let h = 0, p = 0; h < H2; h++) for (let c = 0; c < cols; c++, p++) order[p] = (BAYER[(h & 3) * 4 + (c & 3)] + 0.5) / 16;
    const sd = seed * 17.31;

    const put = (c, r, g, colour, heavy = 0) => { if (c >= 0 && c < cols && r >= 0 && r < rows) { const i = r * cols + c; glyph[i] = g; ink[i] = colour; bold[i] = heavy; } };
    const sky2 = (c, r) => kind[2 * r * cols + c] === SKY && kind[(2 * r + 1) * cols + c] === SKY; // both halves of a cell are open sky

    // A line too thin to fill cells, drawn in slashes, bars and dashes chosen
    // by where it crosses each cell, as the plum blossom draws its twigs.
    // Columns and rows; set(c, r, glyph) sets each character.
    function line(c0, r0, c1, r1, set) {
      const dc = c1 - c0, dr = r1 - r0, wide = Math.abs(dc), high = Math.abs(dr), rising = dc * dr < 0;
      if (wide <= high * 1.3) { // steep: one glyph per row
        const lo = Math.min(r0, r1), hi = Math.max(r0, r1);
        for (let r = Math.max(-1, Math.floor(lo)); r < Math.min(hi, rows + 1); r++) {
          const ya = Math.max(lo, r), yb = Math.min(hi, r + 1), part = yb - ya;
          if (part < 0.25) continue;
          const ca = c0 + (dc * (ya - r0)) / dr, cb = c0 + (dc * (yb - r0)) / dr;
          const stub = part < 0.6 ? ((ya + yb) / 2 - r > 0.5 ? (rising ? COMMA : DOT) : HIGH) : 0;
          set(Math.floor((ca + cb) / 2), r, stub || (Math.floor(ca) === Math.floor(cb) ? BAR : rising ? SLASH : BACK));
        }
        return;
      }
      const lo = Math.min(c0, c1), hi = Math.max(c0, c1), slope = high / wide; // shallow: one glyph per column
      for (let c = Math.max(-1, Math.floor(lo)); c < Math.min(hi, cols + 1); c++) {
        const xa = Math.max(lo, c), xb = Math.min(hi, c + 1);
        if (xb - xa < 0.35) continue;
        const y = r0 + (dr * ((xa + xb) / 2 - c0)) / dc, r = Math.floor(y), f = y - r;
        if (slope > 0.6) set(c, r, rising ? SLASH : BACK);
        else if (slope > 0.2) set(c, r, f < 0.36 ? (rising ? HIGH : TICK) : f > 0.64 ? (rising ? COMMA : DOT) : DASH);
        else if (f < 0.3) set(c, r - 1, LOW);
        else set(c, r, f > 0.7 ? LOW : DASH);
      }
    }

    // The sky as it stands before the camera moves: black overhead, deep navy
    // and misty toward the horizon, brightest under the moon, darker in a ring
    // round it, with soft blue star clouds streaming round it on both sides.
    const cloud = (x, y) => { // how much star cloud there is at (x, y), 0 to 1
      const dx = x - MOON[0], dy = y - MOON[1], r = Math.hypot(dx, dy) / MOON[2], a = Math.atan2(dy, dx);
      const off = (a0) => Math.abs(Math.atan2(Math.sin(a - a0), Math.cos(a - a0)));
      const left = Math.exp(-(((r - 1.5 + 0.2 * Math.sin(a)) / 0.17) ** 2)) * smooth(1.3, 0.5, off(Math.PI));
      const right = Math.exp(-(((r - 1.22) / 0.13) ** 2)) * smooth(1.15, 0.4, off(-0.3));
      const corner = 0.8 * Math.exp(-(((x - 0.8) / 0.12) ** 2) - (((y - 0.15 + 0.12 * (x - 0.8)) / 0.035) ** 2));
      const beyond = smooth(0.85, 1.15, Math.abs(x)) * smooth(0.55, 0.8, fbm(x * 2.2 + sd, y * 2.2)) * 0.6; // more of it out past the frame's sides
      const streak = fbm(a * 3.2 + sd, r * 11); // streaked along the way it curves
      return clamp01(Math.max(left, right, corner, beyond) * (0.1 + 1.1 * smooth(0.35, 0.78, streak)));
    };
    const skyPaint = new Uint8Array(cols * hz);
    for (let h = 0; h < hz; h++) for (let c = 0; c < cols; c++) {
      const x = Xc[c], y = Yh[h], p = h * cols + c, d = order[p];
      const r = Math.hypot(x - MOON[0], y - MOON[1]) / MOON[2], up = clamp01((HZ - y) / HZ);
      let L = 0.05 + 0.19 * (1 - up) ** 2.2 + 0.24 * Math.exp(-(((y - HZ) / 0.035) ** 2) - (((x - MOON[0]) / 0.8) ** 2));
      L *= 1 - 0.45 * smooth(1.6, 1.02, r) * smooth(HZ - 0.03, HZ - 0.15, y);
      const n = cloud(x, y);
      skyPaint[p] = n > 0.1 + 0.3 * d ? NEBULA + Math.max(0, Math.min(NB - 1, Math.floor(n * 4.6 + L * 3 + d - 0.2)))
        : NIGHT + Math.max(0, Math.min(NL - 1, Math.floor(L * (NL - 1) + d)));
    }
    const srcC = new Int32Array(cols);
    function drawSky(cz) { // the sky, grown a little about the point ahead as the camera comes on
      const k = grown(DSKY, cz);
      for (let c = 0; c < cols; c++) srcC[c] = Math.max(0, Math.min(cols - 1, Math.floor(colOf(ROOT[0] + (Xc[c] - ROOT[0]) / k))));
      for (let h = 0; h < hz; h++) {
        const from = Math.max(0, Math.min(hz - 1, Math.floor(rowOf(HZ + (Yh[h] - HZ) / k)))) * cols;
        for (let c = 0, p = h * cols; c < cols; c++, p++) { paint[p] = skyPaint[from + srcC[c]]; kind[p] = SKY; }
      }
    }

    // The stars, in the sky as it stands before the camera moves: thicker in
    // the star clouds, where they are blue-white sparks; a few warm ones.
    const stars = [];
    for (let i = 0, n = Math.round((cols * hz) / 2 / 14); i < n; i++) {
      const x = R(Xc[0], Xc[cols - 1]), y = R(Yh[0], HZ - 0.03), m = cloud(x, y);
      if (Math.hypot(x - MOON[0], y - MOON[1]) < MOON[2] * 1.03 || rand() > 0.2 + 1.6 * m) continue;
      const g = rand(), w = rand();
      stars.push({ x, y, g: g < 0.62 ? DOT : g < 0.74 ? HIGH : g < 0.8 ? TICK : g < 0.9 ? PLUS : STAR, ink: m > 0.25 ? NEBULA + 7 + ((w * 3) | 0) : w < 0.08 ? GOLD + 4 + ((w * 20) & 1) : night(0.62 + 0.38 * w), beat: R(0, 9) });
    }
    function drawStars(t, cz) { // twinkling faintly, each on its own slow beat
      const k = grown(DSKY, cz);
      for (const s of stars) {
        const c = Math.floor(colOf(ROOT[0] + (s.x - ROOT[0]) * k)), r = Math.floor(rowOf(HZ + (s.y - HZ) * k) / 2);
        if (c < 0 || c >= cols || r < 0 || r >= rows || !sky2(c, r)) continue;
        const dim = hash(Math.floor(t * 2.2 + s.beat), (s.beat * 1000) | 0) < 0.3;
        put(c, r, dim && s.g !== DOT ? DOT : s.g, dim ? Math.max(NIGHT + 10, s.ink - 3) : s.ink);
      }
    }
    // Thin gold streaks hanging down the sky like curtains, swaying very slowly,
    // with a glint of light sliding down each.
    function drawGold(t, cz) {
      const k = grown(DSKY, cz);
      CURTAINS.forEach(([a, b, c, d], n) => {
        const glint = c + ((t * 0.12 + n * 0.37) % 1) * (d - c + 0.4);
        const set = (col, row, g) => { if (col >= 0 && col < cols && row >= 0 && row < rows && sky2(col, row)) put(col, row, g, GOLD + (Math.abs(yOfRow(row) - glint) < 0.05 ? 4 : 1 + ((n + row) % 3 === 0 ? 1 : 0))); };
        let px = 0, py = 0;
        for (let j = 0; j <= 40; j++) {
          const y = lerp(c - 0.6, d, j / 40), x = a + b * (y - c) ** 2 * Math.sign(y - c) + 0.012 * Math.sin(t * 0.4 + n) * (y - c);
          const sx = colOf(ROOT[0] + (x - ROOT[0]) * k), sy = rowOf(HZ + (y - HZ) * k) / 2;
          if (j && hash(n, j) < smooth(c - 0.55, c - 0.2, y)) line(px, py, sx, sy, set); // breaking up toward its top, high above the frame
          px = sx; py = sy;
        }
      });
    }

    // The moon's face: faint grey seas on a white disc, MT texels across.
    const MT = 64, MARIA = new Float32Array(MT * MT);
    for (let j = 0; j < MT; j++) for (let i = 0; i < MT; i++) {
      const u = ((i + 0.5) / MT) * 2 - 1, v = ((j + 0.5) / MT) * 2 - 1;
      MARIA[j * MT + i] = smooth(0.5, 0.72, fbm(u * 2.4 + 3.1 + sd, v * 2.4 + 8.7)) * smooth(0.6, -0.4, v);
    }
    function drawMoon(cz) { // the same white at every moment; it only grows as the camera comes on
      const k = grown(DMOON, cz), cx = ROOT[0] + (MOON[0] - ROOT[0]) * k, cy = HZ + (MOON[1] - HZ) * k, rad = MOON[2] * k, glow = 0.03;
      const h0 = Math.max(0, Math.floor(rowOf(cy - rad - glow))), h1 = Math.min(hz - 1, Math.ceil(rowOf(cy + rad + glow)));
      const c0 = Math.max(0, Math.floor(colOf(cx - rad - glow))), c1 = Math.min(cols - 1, Math.ceil(colOf(cx + rad + glow)));
      for (let h = h0; h <= h1; h++) for (let c = c0, p = h * cols + c0; c <= c1; c++, p++) {
        const dx = Xc[c] - cx, dy = Yh[h] - cy, d = Math.hypot(dx, dy);
        if (d < rad) {
          const i = Math.min(MT - 1, ((dx / rad + 1) * MT) >> 1), j = Math.min(MT - 1, ((dy / rad + 1) * MT) >> 1);
          paint[p] = NIGHT + NL - 1 - Math.floor(MARIA[j * MT + i] * 2.4 + hash(i, j + 50)); kind[p] = LUNA;
        } else if (d < rad + glow) {
          const g = Math.exp(-(d - rad) / 0.009);
          if (g > 0.12) paint[p] = night(lerp(0.12, 0.85, g) + (order[p] - 0.5) / NL);
        }
      }
    }

    // The water: each half cell below the horizon looks at the point its ray
    // reaches, `dist` tree distances off and X across.
    const wDist = new Float32Array(H2), wFoot = new Float32Array(H2), wX = new Float32Array(N), wave = new Float32Array(N);
    for (let h = hz; h < H2; h++) {
      const dy = Math.max(1e-4, Yh[h] - HZ);
      wDist[h] = LE / dy; wFoot[h] = LE / (dy * dy) / FH; // and how much farther the next half row down is
      for (let c = 0; c < cols; c++) wX[h * cols + c] = ROOT[0] + (Xc[c] - ROOT[0]) * wDist[h];
    }
    // Dark water rippling toward the camera, calmer in patches. Down the
    // middle lies the moon's broad reflection: near the camera it breaks into
    // streaks where the ripples face the moon; far off, where the ripples are
    // too fine to see, it lies in broken lines of light that come and go.
    function drawWater(t, cz) {
      const kM = grown(DMOON, cz), mx = ROOT[0] + (MOON[0] - ROOT[0]) * kM, mw = MOON[2] * kM * 0.9;
      for (let h = hz; h < H2; h++) {
        const dist = wDist[h], foot = wFoot[h], Z = cz + dist, dy = Yh[h] - HZ;
        const base = 0.03 + 0.1 * Math.exp(-dy / 0.04), shine = lerp(0.6, 0.98, Math.exp(-dy / 0.05)), near = clamp01(1 - (foot / WAVES[0][0]) * 1.6);
        for (let c = 0, p = h * cols; c < cols; c++, p++) {
          const X = wX[p];
          let lift = 0;
          for (const [lam, high, wob, bend] of WAVES) {
            const a = 1 - (foot / lam) * 1.6; // a ripple too fine for the half row to show fades out
            if (a > 0) lift += high * a * a * Math.sin(((Z + RIPPLE * t) / lam) * 6.2832 + bend * 6 * noise(X * wob, Z * wob * 0.4 + lam * 999));
          }
          if (near > 0) lift *= 0.35 + 1.1 * noise(X * 8 + 3, Z * 24);
          wave[p] = lift;
          const e = Math.abs(Xc[c] - mx) / mw;
          let glint = 0;
          if (e < 1.25) {
            const band = smooth(1.05, 0.5, e + 0.35 * (noise(X * 16, 5.5) - 0.5));
            const far = near < 1 ? 0.25 + 0.75 * smooth(0.38, 0.62, noise(X * 45 + 9, h * 0.9 + t * 0.6)) : 0;
            glint = band * lerp(far, smooth(0.05, 0.55, lift), near);
          }
          paint[p] = night(base + 0.07 * lift + shine * glint + (order[p] - 0.5) / NL); kind[p] = WATER;
        }
      }
      for (let r = Math.ceil(hz / 2), beat = Math.floor(t * 2.5); r < rows; r++) { // the glints of the reflection, and ripple crests, where a whole cell is water
        const a = 2 * r * cols, b = a + cols;
        for (let c = 0; c < cols; c++) {
          if (kind[a + c] !== WATER || kind[b + c] !== WATER) continue;
          const lift = (wave[a + c] + wave[b + c]) / 2, L = Math.max(paint[a + c], paint[b + c]) - NIGHT;
          if (L > NL * 0.62) { if (hash(c, r * 13 + beat) < 0.3) put(c, r, lift > 0.3 ? EQ : DASH, NIGHT + NL - 1); }
          else if (lift > 0.3 && noise(wX[b + c] * 40, (cz + wDist[2 * r + 1]) * 25) > 0.5) put(c, r, WAVE, NIGHT + Math.min(NL - 1, L + 4));
          else if (wFoot[2 * r + 1] > 0.012 && hash(c * 7 + beat, r) < 0.025) put(c, r, WAVE, NIGHT + Math.min(NL - 1, L + 3)); // far off, a glint here and there
        }
      }
    }

    // Sparkling ribbons of light waving over the horizon at the far left and
    // far right: thin lines drawn in characters, the waves flowing from left
    // to right, sparks glinting along them.
    function drawRibbons(t, k) {
      RIBBONS.forEach(([side, y0, amp, lam, ph], n) => {
        let fade = 0;
        const set = (c, r, g) => {
          if (c < 0 || c >= cols || r < 0 || r >= rows || !sky2(c, r)) return;
          const spark = hash(c * 3 + n, Math.floor(t * 3 + c * 0.13)) < 0.05 * fade;
          put(c, r, spark ? STAR : g, spark ? NIGHT + NL - 1 : night(0.45 + 0.4 * fade));
        };
        let pc = 0, pr = 0;
        for (let c = 0; c <= cols; c++) { // through the left edge of each column
          const x = ROOT[0] + (mid + (c - cols / 2) / FW - ROOT[0]) / k, r = rowOf(HZ + (y0 + amp * Math.sin(((x - 0.05 * t) / lam) * 6.2832 + ph) - HZ) * k) / 2;
          fade = side < 0 ? smooth(-0.56, -0.72, x) : smooth(0.15, 0.3, x);
          if (c && fade > 0) line(pc, pr, c, r, set);
          pc = c; pr = r;
        }
      });
    }

    // The islet: dark rock and grass, tufts along its top against the moon.
    function drawIslet(k) {
      for (let c = 0; c < cols; c++) {
        const x = ROOT[0] + (Xc[c] - ROOT[0]) / k;
        if (x < ISLE[0] || x > ISLE[1]) continue;
        const high = isleTop(x), h0 = Math.max(0, Math.ceil(rowOf(HZ - high * k) - 0.5)), h1 = Math.min(H2 - 1, Math.floor(rowOf(HZ + LE * k) - 0.5));
        for (let h = h0; h <= h1; h++) { const p = h * cols + c; paint[p] = WOOD + (h === h0 ? 3 : 1 + ((h - h0) & 1)); kind[p] = ISLET; }
        for (let r = (h0 + 1) >> 1; 2 * r + 1 <= h1; r++) put(c, r, 32, 0); // no glints of the water on it
        const g = hash(Math.floor(x * 260), 41), r = h0 >> 1;
        if (h0 > 0 && g < 0.55) put(c, h0 & 1 ? r : r - 1, g < 0.2 ? QUOTE : g < 0.35 ? HIGH : g < 0.45 ? COMMA : BAR, WOOD + 1, 1);
      }
    }

    // The tree's wood, swayed and grown: thick wood fills its cells, dark,
    // grained along its length and rimmed with moonlight where the moon is
    // behind it; thinner wood is a dark line of slashes and bars.
    const toX = (x, y, s, t, k) => ROOT[0] + (x + sway(x, y, s, t) - ROOT[0]) * k, toY = (y, k) => HZ + (y - HZ) * k;
    const grain = new Uint8Array(cells);
    function drawWood(list, s, t, k) {
      for (const pts of list) for (let n = 1; n < pts.length; n++) {
        const [xa, ya, wa] = pts[n - 1], [xb, yb, wb] = pts[n];
        const x0 = toX(xa, ya, s, t, k), y0 = toY(ya, k), x1 = toX(xb, yb, s, t, k), y1 = toY(yb, k), w0 = (wa * k) / 2, w1 = (wb * k) / 2;
        if (Math.max(w0, w1) * 2 * FW < 1.6) { line(colOf(x0), rowOf(y0) / 2, colOf(x1), rowOf(y1) / 2, (c, r, g) => put(c, r, g, WOOD, 1)); continue; }
        const dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy || 1e-9, reach = Math.max(w0, w1);
        const along = Math.abs(dx * FW) <= Math.abs(dy * FH) * 0.7 ? BAR : dx * dy < 0 ? SLASH : BACK;
        const h0 = Math.max(0, Math.floor(rowOf(Math.min(y0, y1) - reach))), h1 = Math.min(H2 - 1, Math.ceil(rowOf(Math.max(y0, y1) + reach)));
        const c0 = Math.max(0, Math.floor(colOf(Math.min(x0, x1) - reach))), c1 = Math.min(cols - 1, Math.ceil(colOf(Math.max(x0, x1) + reach)));
        for (let h = h0; h <= h1; h++) for (let c = c0; c <= c1; c++) {
          const px = Xc[c] - x0, py = Yh[h] - y0, f = clamp01((px * dx + py * dy) / len2), ox = px - dx * f, oy = py - dy * f, w = lerp(w0, w1, f);
          if (ox * ox + oy * oy > w * w) continue;
          const p = h * cols + c;
          paint[p] = WOOD + ((ox + oy) / w < -0.3 ? 2 : 1); kind[p] = BARK; grain[(h >> 1) * cols + c] = along;
        }
      }
    }
    function woodGlyphs(r0, r1, moonBehind) { // grain inside thick wood, and moonlight along its edges
      for (let r = Math.max(0, r0); r <= Math.min(rows - 1, r1); r++) for (let c = 0; c < cols; c++) {
        const i = r * cols + c, b = (2 * r + 1) * cols + c;
        if (kind[b] !== BARK || !grain[i]) continue;
        const lEdge = c > 0 && kind[b - 1] !== BARK, rEdge = c < cols - 1 && kind[b + 1] !== BARK;
        if ((lEdge || rEdge) && moonBehind(c, r)) put(c, r, grain[i], night(0.72));
        else put(c, r, hash(c, r) < 0.55 ? grain[i] : 32, WOOD + 3, 1);
      }
    }

    // The crown's body as it stands before the camera moves: a solid fill a
    // little inside its outline (the clumps make the edge), darker toward its
    // underside, with soft patches of light and shade. A tone for each half
    // cell, or -1 outside it.
    const body = new Float32Array(N).fill(-1);
    for (let h = Math.max(0, Math.floor(rowOf(TOP - 0.02))); h <= Math.min(H2 - 1, Math.ceil(rowOf(0.58))); h++) {
      for (let c = Math.max(0, Math.floor(colOf(-0.82))); c <= Math.min(cols - 1, Math.ceil(colOf(0.32))); c++) {
        const x = Xc[c], y = Yh[h], e = 0.016;
        if (inCrown(x, y) && inCrown(x - e, y) && inCrown(x + e, y) && inCrown(x, y - e) && inCrown(x, y + e)) body[h * cols + c] = 4.6 + 2.6 * lifted(y + 0.12) + 1.6 * (fbm(x * 16 + sd, y * 16) - 0.5);
      }
    }
    // Clumps of blossom on it, sorted highest first, so that each lower
    // clump's lit top lies over the shade at the bottom of the one above.
    // Each clump's edge is lumpy.
    const clumps = [];
    {
      const rc = Math.max(0.022, 2.6 / FH), want = Math.round((1.5 * CROWN_AREA) / (Math.PI * rc * rc));
      for (let tries = 0; clumps.length < want && tries < want * 40; tries++) {
        const x = R(-0.8, 0.3), y = R(TOP - 0.01, 0.56);
        if (!inCrown(x, y)) continue;
        clumps.push({ x, y, r: rc * R(0.75, 1.25), tone: 5.6 + 2.8 * lifted(y + 0.12) + R(-0.7, 0.7), lumps: Float32Array.from({ length: 9 }, () => R(-1, 1)) });
      }
      clumps.forEach((k, i) => { k.lumps[8] = k.lumps[0]; k.id = i; });
      clumps.sort((a, b) => a.y - b.y);
    }
    const owner = new Int32Array(N), spot = new Float32Array(clumps.length * 3); // which clump holds each half cell (-1: the body); where each clump is now
    const swing = new Float32Array(cols * 3); // for each column: the gust there, and the two halves of the crown's slow sway
    function drawCrown(s, t, k) {
      const h0 = Math.max(0, Math.floor(rowOf(toY(TOP - 0.05, k)))), h1 = Math.min(H2 - 1, Math.ceil(rowOf(toY(0.6, k))));
      const c0 = Math.max(0, Math.floor(colOf(ROOT[0] + (-0.86 - ROOT[0]) * k))), c1 = Math.min(cols - 1, Math.ceil(colOf(ROOT[0] + (0.4 - ROOT[0]) * k)));
      for (let c = c0; c <= c1; c++) {
        const x = ROOT[0] + (Xc[c] - ROOT[0]) / k;
        swing[c * 3] = LEAN * gust(s - (x + 0.85) * 0.3); swing[c * 3 + 1] = Math.sin(t * 1.3 + x * 4); swing[c * 3 + 2] = Math.cos(t * 1.3 + x * 4);
      }
      for (let h = h0; h <= h1; h++) { // the body, swayed with the clumps
        const y = HZ + (Yh[h] - HZ) / k, lift = lifted(y), lp = lift ** 1.6, sy = Math.sin(y * 3), cy = Math.cos(y * 3), hs = Math.floor(rowOf(y));
        if (hs < 0 || hs >= H2) continue;
        for (let c = c0; c <= c1; c++) {
          const x = ROOT[0] + (Xc[c] - ROOT[0]) / k, cs = Math.floor(colOf(x - (lp + 0.6 * Math.abs(x - ROOT[0]) * lift) * (swing[c * 3] + 0.0035 * (swing[c * 3 + 1] * cy + swing[c * 3 + 2] * sy))));
          const tone = cs >= 0 && cs < cols ? body[hs * cols + cs] : -1, p = h * cols + c;
          if (tone >= 0) { paint[p] = bloom(tone + order[p] - 0.5); kind[p] = CROWNK; owner[p] = -1; }
        }
      }
      clumps.forEach((q, n) => {
        const cx = toX(q.x, q.y, s, t, k), cy = toY(q.y, k), rr = q.r * k;
        spot[n * 3] = cx; spot[n * 3 + 1] = cy; spot[n * 3 + 2] = rr;
        const ha = Math.max(0, Math.floor(rowOf(cy - rr * 1.2))), hb = Math.min(H2 - 1, Math.ceil(rowOf(cy + rr * 1.2)));
        const ca = Math.max(0, Math.floor(colOf(cx - rr * 1.2))), cb = Math.min(cols - 1, Math.ceil(colOf(cx + rr * 1.2)));
        for (let h = ha; h <= hb; h++) for (let c = ca, p = h * cols + ca; c <= cb; c++, p++) {
          const dx = (Xc[c] - cx) / rr, dy = (Yh[h] - cy) / rr, e2 = dx * dx + dy * dy;
          if (e2 > 1.44) continue;
          const ax = Math.abs(dx), ay = Math.abs(dy), turn = ax + ay ? (dy >= 0 ? (dx >= 0 ? dy / (ax + ay) : 2 - dy / (ax + ay)) : (dx < 0 ? 2 + ay / (ax + ay) : 4 - ay / (ax + ay))) * 2 : 0; // 0 to 8 round the clump
          const j = Math.min(7, turn | 0), e = Math.sqrt(e2) * (1 - 0.16 * lerp(q.lumps[j], q.lumps[j + 1], turn - j));
          if (e > 1) continue;
          paint[p] = bloom(q.tone - 1.9 * dy - 0.6 * e + order[p] - 0.5); kind[p] = CROWNK; owner[p] = n;
        }
      });
      for (let h = Math.max(1, h0); h <= Math.min(H2 - 2, h1); h++) for (let c = Math.max(1, c0); c <= Math.min(cols - 2, c1); c++) { // the rim: moonlight through the edge of the crown
        const p = h * cols + c;
        if (kind[p] !== CROWNK) continue;
        const up = kind[p - cols], l = kind[p - 1], rt = kind[p + 1];
        if (up === LUNA || l === LUNA || rt === LUNA) paint[p] = Math.min(BLOOM + BL - 1, paint[p] + 4);
        else if (up === SKY || l === SKY || rt === SKY) paint[p] = Math.min(BLOOM + BL - 1, paint[p] + 2);
      }
      for (let r = h0 >> 1; r <= h1 >> 1; r++) for (let c = c0; c <= c1; c++) { // blossom: a full flower at the heart of a clump, a few petals catching the light on top
        const a = 2 * r * cols + c, b = a + cols, n = kind[b] === CROWNK ? owner[b] : kind[a] === CROWNK ? owner[a] : -1;
        if (n < 0) continue;
        const q = clumps[n], cx = spot[n * 3], cy = spot[n * 3 + 1], rr = spot[n * 3 + 2];
        const dc = c - Math.floor(colOf(cx)), dr = r - Math.floor(rowOf(cy) / 2), dx = (Xc[c] - cx) / rr, dy = (yOfRow(r) - cy) / rr, e = Math.hypot(dx, dy);
        const g = hash(q.id * 977 + dc + 40, dr + 40), tone = q.tone - 1.9 * dy;
        if (e < 0.7) glyph[r * cols + c] = 32; // the twigs behind are hidden in the heart of a clump
        if (e < 0.42) { if (g < 0.5) put(c, r, g < 0.25 ? AT : STAR, bloom(tone + 3), 1); }
        else if (e < 0.85) { if (g < 0.16) put(c, r, g < 0.08 ? STAR : RING, bloom(tone + 2)); else if (g > 0.9) put(c, r, COMMA, bloom(tone - 3)); }
        else if (dy < 0 ? g < 0.35 : g < 0.12) put(c, r, dy < 0 ? (g < 0.2 ? HIGH : DOT) : COMMA, dy < 0 ? bloom(tone + 4) : bloom(tone - 3));
      }
    }

    // Petals. A few drift down from the crown onto the water all the time,
    // more lie on the water already, and in the breeze a band of them lifts
    // off the top of the crown, streams over the face of the moon and sinks
    // onto the water on the right. A petal on the water floats where it came
    // down, drifting slowly toward the camera with the ripples. Each is a
    // pale pixel, darker against the moon behind it, some with a tumbling mark.
    //
    // The band's stream, squeezed from the right on a screen too narrow to
    // show the band come down onto the water, stored as points every DU frame
    // heights along it, with the way to its left.
    const DU = 0.01, PATH = [];
    {
      const x0 = STREAM[0][0], x1 = STREAM[STREAM.length - 1][0];
      const squeeze = Math.min(1, (ROOT[0] + (Xc[cols - 1] - ROOT[0]) / grown(1, dolly(T.calm)) - 0.04 - x0) / (x1 - x0));
      const way = STREAM.map(([x, y]) => [x0 + (x - x0) * squeeze, y]), last = way.length - 1;
      const cr = (a, b, c, d, f) => 0.5 * (2 * b + (c - a) * f + (2 * a - 5 * b + 4 * c - d) * f * f + (3 * b - a - 3 * c + d) * f * f * f);
      const fine = [];
      for (let i = 0; i < last; i++) for (let j = 0; j < 40; j++) {
        const a = way[Math.max(0, i - 1)], b = way[i], c = way[i + 1], d = way[Math.min(last, i + 2)], f = j / 40;
        fine.push([cr(a[0], b[0], c[0], d[0], f), cr(a[1], b[1], c[1], d[1], f)]);
      }
      fine.push(way[last]);
      let along = 0, next = 0;
      for (let i = 1; i < fine.length; i++) {
        const [xa, ya] = fine[i - 1], [xb, yb] = fine[i], l = Math.hypot(xb - xa, yb - ya);
        while (next <= along + l) { const f = (next - along) / l; PATH.push([lerp(xa, xb, f), lerp(ya, yb, f), (ya - yb) / l, (xb - xa) / l]); next += DU; }
        along += l;
      }
    }
    const at = [0, 0, 0, 0]; // a point on the stream and the way to its left (y down), as `pathAt` leaves it
    const pathAt = (u) => {
      const k = Math.max(0, u / DU), i = Math.min(PATH.length - 2, k | 0), f = k - i, a = PATH[i], b = PATH[i + 1];
      for (let j = 0; j < 4; j++) at[j] = lerp(a[j], b[j], f);
    };
    const joinAt = (x) => { let i = 0; while (i < PATH.length - 1 && PATH[i][0] < x) i++; return i * DU; }; // how far along the stream it is above x
    const fly = [0, 0]; // where a petal of the band is, as `flight` leaves it
    const onWater = (X, Z, cz) => { const d = Z - cz; return d > 1e-3 ? [ROOT[0] + (X - ROOT[0]) / d, HZ + LE / d] : null; };
    const settle = (p, sx, sy, cz) => { const d = LE / (sy - HZ); p.X = ROOT[0] + (sx - ROOT[0]) * d; p.Z = cz + d; }; // where a petal coming down at (sx, sy) lies on the water
    // Where a petal of the band is at story time s, as the crown's layer stands before the camera moves.
    function flight(p, s) {
      const go = (blown(s) - blown(p.t0)) * FLOW * p.push, j = smooth(0, 0.09, go), late = Math.max(0, s - T.lull + 0.2), age = s - p.t0, wob = Math.min(1, age * 2) * p.amp;
      pathAt(p.u0 + go);
      fly[0] = lerp(p.x, at[0] + at[2] * p.off, j) + p.spread * 0.06 * late + 0.006 * wob * Math.sin(age * p.freq + p.phase);
      fly[1] = lerp(p.y, at[1] + at[3] * p.off, j) + p.sink * 0.2 * late ** 1.5 + 0.004 * wob * Math.cos(age * p.freq * 0.7 + p.phase);
    }
    const lower = clumps.filter((q) => q.y > 0.4), upper = clumps.filter((q) => q.y < 0.37);
    const drifters = [];
    for (let i = 0, n = Math.max(5, Math.min(26, Math.round(area / 600))); i < n; i++) {
      const q = lower[(rand() * lower.length) | 0];
      const p = { x: q.x + R(-1, 1) * q.r, y: q.y + R(0, 0.8) * q.r, t0: lerp(-2.4, LENGTH - 0.6, (i + rand()) / n), fall: R(0.07, 0.1), dx: R(0.02, 0.06),
        amp: R(0.5, 1.5), freq: R(2, 4), phase: R(0, 6.28), land: R(HZ + LE + 0.01, HZ + 0.13), whole: rand() < 0.25, tl: Infinity };
      for (let a = 0; p.t0 + a < LENGTH; a += 0.02) {
        const t = p.t0 + a, k = grown(1, dolly(t * SPEED)), sy = HZ + (p.y + p.fall * a - HZ) * k;
        if (sy >= p.land) { p.tl = t; settle(p, ROOT[0] + (p.x + p.dx * a - ROOT[0]) * k, sy, dolly(t * SPEED)); break; }
      }
      drifters.push(p);
    }
    const floaters = []; // already on the water in the lower left
    for (let i = 0, n = Math.max(8, Math.min(140, Math.round(area / 260))); i < n; i++) {
      const sx = R(Math.max(Xc[0], -1.3), -0.3), sy = R(HZ + 0.11, Math.max(1, Yh[H2 - 1])), p = { whole: rand() < 0.3, phase: R(0, 6.28) };
      settle(p, sx, sy, 0);
      floaters.push(p);
    }
    const band = [];
    for (let i = 0, n = Math.max(60, Math.min(900, Math.round(area * 0.05))); i < n; i++) {
      const q = upper[(rand() * upper.length) | 0], a = R(0, 6.28), d = Math.sqrt(rand()) * q.r;
      const x = q.x + Math.cos(a) * d, y = q.y + Math.sin(a) * d * 0.8;
      const p = { x, y, t0: T.breeze + 0.1 + (x + 0.85) * 0.3 + 1.1 * rand() ** 1.3, u0: joinAt(x), off: (rand() + rand() + rand() - 1.5) * 0.035, push: R(0.85, 1.15),
        amp: R(0.5, 1.5), freq: R(3, 6), phase: R(0, 6.28), sink: R(0.7, 1.3), spread: R(-0.3, 1), land: R(HZ + LE + 0.03, Math.max(0.98, HZ + 0.3)), whole: rand() < 0.2, mark: rand() < 0.35, sl: Infinity };
      for (let s = p.t0; s < T.end; s += 0.02) {
        flight(p, s);
        const k = grown(1, dolly(s)), sy = HZ + (fly[1] - HZ) * k;
        if (sy >= p.land) { p.sl = s; settle(p, ROOT[0] + (fly[0] - ROOT[0]) * k, sy, dolly(s)); break; }
      }
      band.push(p);
    }
    function speck(x, y, p, beat, dark, pale) { // a petal at (x, y) in the frame
      const c = Math.floor(colOf(x)), h = Math.floor(rowOf(y));
      if (c < 0 || c >= cols || h < 0 || h >= H2) return;
      const i = h * cols + c, lit = kind[i] === LUNA, colour = lit ? dark : pale;
      paint[i] = colour;
      if (big) paint[(h ^ 1) * cols + c] = colour;
      if (p.whole || p.mark) put(c, h >> 1, (p.whole ? WHOLE : PETAL)[beat & 3], lit ? colour - 3 : colour + 2, p.whole ? 1 : 0);
    }
    function floating(p, [x, y], t) { // a petal lying on the water: a bigger mark nearer the camera
      const c = Math.floor(colOf(x)), h = Math.floor(rowOf(y)), near = (y - HZ) / 0.3;
      if (c < 0 || c >= cols || h < 0 || h >= H2) return;
      paint[h * cols + c] = bloom(near > 0.5 ? 11 : near > 0.2 ? 10 : 8);
      if (near > 0.4) put(c, h >> 1, near > 0.65 && p.whole ? RING : Math.sin(t * 1.7 + p.phase) > 0 ? DASH : COMMA, bloom(12), near > 0.65 ? 1 : 0);
    }
    function drawPetals(s, t, cz, k) {
      for (const p of floaters) {
        const w = onWater(p.X, p.Z - 0.004 * t, cz);
        if (w) floating(p, w, t);
      }
      for (const p of drifters) {
        const a = t - p.t0;
        if (a < 0) continue;
        if (t >= p.tl) { const w = onWater(p.X, p.Z - 0.004 * (t - p.tl), cz); if (w) floating(p, w, t); continue; }
        speck(ROOT[0] + (p.x + p.dx * a + 0.008 * Math.sin(a * p.freq + p.phase) - ROOT[0]) * k, HZ + (p.y + p.fall * a - HZ) * k, p, (a * 3 + p.phase) | 0, bloom(6), bloom(11));
      }
      for (const p of band) {
        if (s < p.t0) continue;
        if (s >= p.sl) { const w = onWater(p.X, p.Z - (0.004 * (s - p.sl)) / SPEED, cz); if (w) floating(p, w, t); continue; }
        flight(p, s);
        const tint = p.phase > 3 ? 1 : 0;
        speck(ROOT[0] + (fly[0] - ROOT[0]) * k, HZ + (fly[1] - HZ) * k, p, ((s - p.t0) * 2 + p.phase) | 0, bloom(6 + tint), bloom(10 + tint));
      }
    }

    // Short streaks of light rising slowly off the water by the islet and
    // fading out at about the height of the trunk; each comes back elsewhere.
    const sparks = SPARKS.map(([x, z, lean]) => ({ x, z, lean, every: R(2.2, 3.4), phase: R(0, 4) }));
    for (const way of [-1, 1]) for (let x = WIDE / 2 + R(0.03, 0.2); x < Math.abs(way > 0 ? Xc[cols - 1] : Xc[0]); x += R(0.25, 0.5)) { // more on a wider screen
      sparks.push({ x: way * x, z: R(0.92, 0.98), lean: R(-0.1, 0.1), every: R(2.2, 3.4), phase: R(0, 4) });
    }
    function drawSparks(t, cz) {
      sparks.forEach((q, n) => {
        const life = (t + q.phase) / q.every, round = Math.floor(life), a = life - round, d = q.z - cz;
        const x = q.x + (hash(n, round) - 0.5) * 0.05, lift = 0.012 + 0.15 * a, tall = 0.04 + 0.02 * hash(round, n), glow = (1 - a) ** 0.7 * smooth(0, 0.1, a);
        if (glow < 0.15) return;
        const set = (c, r, g) => put(c, r, g, night(0.55 + 0.45 * glow), glow > 0.6 ? 1 : 0);
        const xb = ROOT[0] + (x - ROOT[0]) / d, yb = HZ + (LE - lift) / d, yt = HZ + (LE - lift - tall) / d;
        line(colOf(xb), rowOf(yb) / 2, colOf(xb + (q.lean * tall) / d), rowOf(yt) / 2, set);
      });
    }

    // The last band of petals: it blows in from beyond the left of the frame,
    // its front bowed forward, petals racing ahead of it. Under its leading
    // edge the picture is dragged along to the right; behind it the petals
    // close up solid and the picture is gone; then they thin out, and what is
    // left behind them is the page.
    const DEEP = 0.8, yMid = (Yh[0] + Yh[H2 - 1]) / 2, yHalf = (Yh[H2 - 1] - Yh[0]) / 2;
    const qs = new Float32Array(N); // how far behind the front edge each half cell is
    function drawHandover(s) {
      const since = s - T.hand, front = lerp(Xc[0] - 0.05, Xc[cols - 1] + DEEP + 0.25, since / (T.end - T.hand));
      for (let h = 0; h < H2; h++) {
        const y = Yh[h], edge = front - 0.22 * ((y - yMid) / yHalf) ** 2, speed = 0.7 + 0.5 * hash(h, 3);
        for (let c = cols - 1; c >= 0; c--) { // right to left, so the picture can be dragged from cells not yet touched
          const p = h * cols + c, q0 = edge - Xc[c];
          if (q0 < -0.06) { qs[p] = -1; continue; }
          if (q0 > DEEP + 0.06) { qs[p] = q0; paint[p] = 0; continue; }
          const q = (qs[p] = q0 + 0.12 * (noise(Xc[c] * 5 - s * 2, y * 6) - 0.5));
          if (q <= 0) continue;
          if (q > 0.26) paint[p] = 0;
          else if (q > 0.04) { const from = c - Math.round((q - 0.04) ** 2 * FW * 1.6); if (from >= 0) paint[p] = paint[h * cols + from]; }
          const dense = smooth(0, 0.14, q) * (1 - smooth(0.42, DEEP, q)), g = hash(Math.floor((Xc[c] - speed * since) * FW), h + 777);
          if (g < dense * 0.45) paint[p] = bloom(9 + ((g * 97) % 4 | 0));
        }
      }
      for (let r = 0; r < rows; r++) {
        const speed = 0.9 + 0.6 * hash(r, 5);
        for (let c = cols - 1; c >= 0; c--) {
          const i = r * cols + c, q = qs[(2 * r + 1) * cols + c];
          if (q <= 0) continue;
          if (q > 0.26) glyph[i] = 32;
          else if (q > 0.04) { const from = c - Math.round((q - 0.04) ** 2 * FW * 1.6); if (from >= 0) { glyph[i] = glyph[i - c + from]; ink[i] = ink[i - c + from]; bold[i] = bold[i - c + from]; } }
          const cover = smooth(0.08, 0.24, q) * (1 - smooth(0.36, 0.62, q));
          wash[i] = cover > 0.04 ? FLOOD + Math.max(1, Math.min(FL, Math.round(cover * FL))) : 0;
          const dense = smooth(0, 0.14, q) * (1 - smooth(0.42, DEEP, q)), slot = Math.floor((Xc[c] - speed * since) * FW * 0.8), g = hash(slot, r + 999);
          if (g < dense * 0.4) put(c, r, g < 0.12 ? WHOLE[slot & 3] : PETAL[(slot + Math.floor(s * 6)) & 3], bloom(g < 0.12 ? 7 + (slot & 3) : 10 + (slot % 3)), g < 0.06 ? 1 : 0);
        }
      }
    }

    return {
      cols, rows, palette: INK, glyph, ink, bold, paint, wash,
      render(t) { // t: seconds since the animation started
        glyph.fill(32); ink.fill(0); bold.fill(0); paint.fill(0); wash.fill(0); grain.fill(0);
        if (t >= LENGTH) return this; // over: nothing is left on the page
        const s = t * SPEED, cz = dolly(s), k = grown(1, cz); // s: where that is in the story
        drawSky(cz); drawMoon(cz); drawWater(t, cz);
        drawWood(TWIGS, s, t, k); drawCrown(s, t, k); drawWood(MAIN, s, t, k); drawIslet(k);
        const kM = grown(DMOON, cz), mx = ROOT[0] + (MOON[0] - ROOT[0]) * kM, my = HZ + (MOON[1] - HZ) * kM, mr = MOON[2] * kM;
        woodGlyphs(Math.floor(rowOf(toY(0.45, k)) / 2), Math.ceil(rowOf(toY(0.72, k)) / 2), (c, r) => Math.hypot(Xc[c] - mx, yOfRow(r) - my) < mr * 1.05);
        drawRibbons(t, k); drawStars(t, cz); drawGold(t, cz);
        drawSparks(t, cz); drawPetals(s, t, cz, k);
        if (s > T.hand) drawHandover(s);
        return this;
      },
    };
  }

  // Play it on the stage. Resolves when it has finished. `seed` changes the
  // details, not the layout: the clumps of blossom, the stars, the petals;
  // `freezeAt` holds one moment (in seconds) on screen instead of playing.
  // Reduced motion holds the band of petals crossing the moon.
  const film = { length: LENGTH, still: 7.2 / SPEED, createScene };
  return { play: (options) => AsciiStage.play(film, options), createScene };
})();
