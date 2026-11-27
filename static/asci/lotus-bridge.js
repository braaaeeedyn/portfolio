/*
 * The lotus bridge: an ASCII loading screen.
 *
 *   <script src="ascii-stage.js"></script>
 *   <script src="lotus-bridge.js"></script>
 *   <script>LotusBridge.play().then(showThePage);</script>
 *
 * A turquoise pond on a soft, misty morning. A long, low wooden footbridge on
 * thin posts crosses it, from a wooden hall with upturned eaves and a lattice
 * screen on the left to the right bank, where a pavilion stands among the
 * plants. Trees, a small waterfall and tall far peaks stand in the haze
 * behind; bamboo leans in from both sides and lotus leaves stand in the water
 * along the bottom. Two people stand on the bridge left of the middle, one in
 * white robes and one in dark clothes with red, and two smaller ones, one in
 * red, farther along. All four stand still; then the left pair walk side by
 * side toward the other two while the camera glides forward low over the
 * water, the lotus leaves passing out of the bottom of the picture and the
 * bamboo out of its sides. The camera stops well short of the bridge as the
 * pair stop a little way from the others. Then the low mist drifting over the
 * water rises, takes the picture and thins away to the page. Five seconds
 * (LENGTH, below).
 *
 * The world is set out in metres from where the camera starts: x across, y up
 * from the water, z ahead. The camera only moves straight ahead, so the far
 * layers (peaks, trees) are painted once and grow about the point ahead on the
 * horizon, nearer things are drawn through the lens each frame, and the water
 * is found along each half cell's ray. Every half cell is worked out in
 * colour, hazed by its distance, and then dithered onto the palette. The whole
 * film is a pure function of time: createScene().render(t) fills a grid of
 * characters and the colours behind them, and the stage (ascii-stage.js)
 * paints that grid on a canvas.
 */
const LotusBridge = (() => {
  'use strict';
  const { code, clamp01, lerp, smooth, mulberry32, hash } = AsciiStage;

  // The story's timeline, in the seconds of the user's description.
  const T = {
    glide: 2,    // the camera starts forward, and the left pair start to walk
    stop: 9,     // both have come to rest
    rise: 9.6,   // the low mist starts to rise over the water, from the right
    whole: 10.6, // it has taken the whole picture
    end: 11.4,   // and has thinned away to the page
  };
  // It is played faster than that. LENGTH is how many seconds the whole of it
  // takes on screen, and SPEED how many times faster than the story that is.
  const LENGTH = 5, SPEED = T.end / LENGTH;

  // The world, in metres: x across, y up from the water, z ahead of where the camera starts.
  const EYE = 0.5;   // the camera's height above the water
  const GLIDE = 7;   // how far it comes forward, which makes the bridge half as large again
  const WALK = 5.5;  // how far the left pair walk, a fifth of the bridge in the picture,
  const STEPS = 8;   // in this many steps
  const AIR = 80;    // metres of air that veil about two thirds of what is behind them
  const DRIFT = 0.5; // metres a second (on screen) the low mist drifts to the left
  // The bridge's deck runs along the front of the hall on the left, then out
  // across the pond to the right bank: its corners, as (x, z).
  const BRIDGE = [[-40, 20], [-9, 20], [13, 27]];
  const DECK = 1, BEAM = 0.72; // the height of the top of the deck, and of the underside of its beam
  const HALL = 21, PAV = 30, FALL = 33; // how far off the hall's front, the pavilion and the waterfall are
  // The lens and the source frame, in frame heights: across from its middle, down from its top.
  const LENS = 1.22;     // frame heights a metre spans, a metre off
  const HZ = 0.665;      // the horizon, level with the camera
  const SOURCE = 16 / 9; // the frame's width

  // How far along an even move of `far` metres from T.glide to T.stop it is at
  // story time s, getting up to speed in `a` seconds and coming to rest in `b`.
  function glide(s, far, a, b) {
    const span = T.stop - T.glide, w = Math.max(0, Math.min(span, s - T.glide)), v = far / (span - (a + b) / 2);
    return w < a ? (v * w * w) / (2 * a) : w < span - b ? v * (w - a / 2) : far - (v * (span - w) ** 2) / (2 * b);
  }

  // Colours. Scenery comes first and is found by colour: a half cell's colour
  // is worked out, dithered, and the nearest of these taken (see `nearest`).
  // The people and the glints on the water are set by name. `swatch` adds a
  // run of colours to INK and gives the index of the first.
  const INK = ['#000000'];
  const swatch = (...colours) => INK.push(...colours) - colours.length;
  const SKY = swatch('#79acd3', '#86b6d9', '#94c0de', '#a2c9e2', '#b1d2e6', '#bfdaea', '#cde2ed', '#d9e9ef'); // overhead, down to the horizon
  const CLOUD = swatch('#e6eef2', '#f1f6f8', '#fbfdfd');
  const HAZE = swatch('#c6d9dc', '#d3e2e3', '#dfeaea', '#ebf2f1'); // the air far things fade into, and the mist
  const PEAK = swatch('#8fa6b8', '#9cb1c2', '#aabdcc', '#b8c8d5'); // far rock in the haze, shade to light
  const PALE = swatch('#6f9493', '#7ca09c', '#8aaca6', '#99b8b1', '#a9c4bd'); // far trees in the haze
  const GREEN = swatch('#122519', '#1a3221', '#23402a', '#2e5640', '#3a6748', '#477851', '#56895a', '#689b63', '#7dad6f', '#94bf7f'); // leaves, deep shade to sunlit
  const CANE = swatch('#33583a', '#44703f', '#5a8748', '#749d55', '#92b468'); // bamboo in the light
  const LOTUS = swatch('#4c8a4f', '#64a159', '#80b866', '#a1cb7a', '#c2dc95', '#dcebb4');
  const WATER = swatch('#164d4d', '#1b6060', '#20736c', '#268676', '#2f9a82', '#3cad8f', '#51bd9e', '#6ccaae', '#8ad6c0', '#addfd0'); // deep to bright
  const WOOD = swatch('#2e2119', '#40301f', '#56402a', '#6e5236', '#886644', '#a37d57');
  swatch('#524b45', '#605749', '#716453', '#84725c', '#988167', '#ac9376'); // the same a little way off, in the haze
  const TILE = swatch('#344246', '#435357', '#556669', '#6a7b7d', '#8b9a9a');
  const STONE = swatch('#3a423e', '#4b5650', '#5e6a62', '#748077', '#8d988d');
  const MOSS = swatch('#4f6d3b', '#668843');
  const SCENERY = INK.length;
  const ROBE = swatch('#c5cfd1', '#e1e7e6', '#f6f8f6'); // white silk, shade to light
  const DARK = swatch('#2a2527', '#3d3436');
  const RED = swatch('#9c3036', '#c0463f', '#d9685a');
  const JADE = swatch('#a9c7c4', '#d0e3e0'); // a pale celadon robe
  const SKIN = swatch('#ecd5c9', '#fbefe8');
  const HAIR = swatch('#141018', '#231c26', '#3a3242');
  const GLINT = swatch('#e7faf3', '#ffffff');
  // The mist thinning away to the page at the end: MIST + 1, the faintest, to MIST + 8.
  const MIST = swatch(...Array.from({ length: 8 }, (_, i) => `rgba(228,237,237,${((i + 1) / 9).toFixed(3)})`)) - 1;
  const RGB = INK.map((c) => (c[0] === '#' ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) : [0, 0, 0]));

  // The nearest colour of the scenery to every colour, at five bits a channel
  // (green counts most, as it does to the eye). Made once, when first needed.
  let LUT = null;
  function nearest() {
    if (LUT) return LUT;
    LUT = new Uint8Array(32768);
    for (let i = 0; i < 32768; i++) {
      const r = (i >> 10) * 8 + 4, g = ((i >> 5) & 31) * 8 + 4, b = (i & 31) * 8 + 4;
      let best = 1, far = Infinity;
      for (let k = 1; k < SCENERY; k++) {
        const [R, G, B] = RGB[k], d = 2 * (r - R) * (r - R) + 4 * (g - G) * (g - G) + 3 * (b - B) * (b - B);
        if (d < far) { far = d; best = k; }
      }
      LUT[i] = best;
    }
    return LUT;
  }
  const q5 = (v) => (v <= 0 ? 0 : v >= 255 ? 31 : v >> 3);
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  const [BAR, SLASH, BACK, LOW, DASH, HIGH, TICK, COMMA, DOT, WAVE, EQUAL, HASH, STAR, PLUS, COLON, BANG] = code("|/\\_-'`,.~=#*+:!");

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

  // The bridge: how far off its deck is at x, and the x of each of its posts.
  const [[AX, AZ], [BX, BZ], [CX, CZ]] = BRIDGE;
  const zAt = (x) => (x <= BX ? BZ : BZ + ((x - BX) * (CZ - BZ)) / (CX - BX));
  const POSTS = [];
  for (let x = BX - 3; x > AX; x -= 3) POSTS.push({ x, z: AZ, top: BEAM, brace: false }); // under the walk along the hall
  for (let k = 0; k <= 9; k++) POSTS.push({ x: lerp(BX, CX, k / 9), z: lerp(BZ, CZ, k / 9), top: k % 2 ? BEAM : DECK + 0.38, brace: true }); // across the pond; every other one stands above the deck
  POSTS.sort((a, b) => b.z - a.z);

  // The four people: where they stand along the bridge (x), how far toward us
  // across the deck, how tall, which way they face (1 is right), what they
  // wear, and whether they walk. The farthest first.
  const PEOPLE = [
    { x: 8.5, near: -0.2, tall: 1.46, face: -1, wear: 'jade' },
    { x: 5.8, near: 0.15, tall: 1.52, face: -1, wear: 'red' },
    { x: -2.95, near: -0.25, tall: 1.7, face: 1, wear: 'dark', walks: true },
    { x: -3.9, near: 0.3, tall: 1.72, face: 1, wear: 'white', walks: true },
  ];

  // The hall on the left, on its front at z = HALL, in metres: which part is
  // at (x, y). Its upper roof, over a gallery closed by a lattice screen,
  // sweeps up at its right-hand corner; the lower roof, over the hall behind
  // it, does the same farther left. The pavilion on the right bank, on its
  // front at z = PAV, is built the same way.
  const ROOF = 1, TIP = 2, EAVE = 3, SHADE = 4, POST = 5, LATTICE = 6, WALL = 7, RAIL = 8, BASE = 9;
  function hallAt(x, y) {
    if (x > -3.5 || y < DECK || y > 8.1) return 0;
    const u = smooth(-8, -3.6, x), eave = 6.1 + 1.15 * u * u, top = 7.9 - 1.6 * smooth(-9.5, -3.6, x) ** 1.3;
    if (x > -17 && y >= eave && y <= Math.max(top, eave + 0.32)) return u > 0.82 ? TIP : y < eave + 0.3 ? EAVE : ROOF;
    const v = smooth(-10.8, -8.2, x), low = 4.3 + 0.75 * v * v, high = 5.75 - 1.25 * v ** 1.3;
    if (x < -8.2 && y >= low && y <= Math.max(high, low + 0.3)) return v > 0.82 ? TIP : y < low + 0.3 ? EAVE : ROOF;
    if (x >= -10.6) { // the gallery: its posts, the lattice screen with a rail along its top, a lintel, and the shade under the roof
      if (Math.abs(x + 10.45) < 0.15 || Math.abs(x + 7.4) < 0.15 || Math.abs(x + 4.35) < 0.15) return y < eave ? POST : 0;
      if (x > -4.2) return 0;
      return y < 3.5 ? LATTICE : y < 3.72 || Math.abs(y - eave + 0.55) < 0.13 ? RAIL : y < eave ? SHADE : 0;
    }
    if (y < low) return Math.abs(((((x + 40) % 2.6) + 2.6) % 2.6) - 1.3) < 0.13 ? POST : WALL;
    return x > -17 && y > high && y < eave ? WALL : 0;
  }
  function pavilionAt(x, y) {
    const u = Math.abs(x - 16) / 3.6;
    if (u > 1 || y < 1 || y > 7.8) return 0;
    const eave = 4.3 + 1.2 * smooth(0.5, 1, u) ** 2, top = Math.max(eave + 0.3, 7.7 - 3.2 * u ** 1.4);
    if (y > top) return 0;
    if (y >= eave) return u > 0.86 ? TIP : y < eave + 0.3 ? EAVE : ROOF;
    if (u > 0.82) return 0;
    if (y < 1.6) return BASE;
    for (const px of [-2.7, -0.95, 0.95, 2.7]) if (Math.abs(x - 16 - px) < 0.14) return POST;
    return y > eave - 0.35 ? RAIL : SHADE;
  }

  function createScene({ cols, rows, aspect = 2, seed = 1 }) {
    const rand = mulberry32(seed), R = (a, b) => a + (b - a) * rand();
    const H2 = rows * 2, N = cols * H2, cells = cols * rows, lut = nearest();
    const glyph = new Uint8Array(cells), ink = new Uint8Array(cells), bold = new Uint8Array(cells), paint = new Uint8Array(N);
    // This frame's colour of every half cell, 0 to 255 a channel; where
    // something keeps a colour of its own by name (the people, glints); and
    // where open water shows.
    const RC = new Float32Array(N), GC = new Float32Array(N), BC = new Float32Array(N), fix = new Uint8Array(N), wet = new Uint8Array(N);

    // The source frame fills the screen's height, and a wider screen sees more
    // to either side. A taller screen is sized to its width, a little larger so
    // that the bridge spans it, and sees more sky above and water below.
    const wide = cols / (rows * aspect), tall = clamp01((SOURCE - wide) / (SOURCE - 0.5));
    const FW = wide >= SOURCE ? rows * aspect : (cols * (1 + 0.35 * tall)) / SOURCE; // columns to a frame height
    const FH = (FW * 2) / aspect;                       // and half rows
    const Y0 = Math.min(0, (1 - H2 / FH) / 2);          // the frame height at the top of the screen
    const side = cols / 2 / FW;                         // frame heights from the middle to either edge
    const Xc = Float32Array.from({ length: cols }, (_, c) => (c + 0.5 - cols / 2) / FW); // each column's place in the frame
    const Yh = Float32Array.from({ length: H2 }, (_, h) => Y0 + (h + 0.5) / FH);         // and each half row's
    const colOf = (X) => cols / 2 + X * FW, rowOf = (Y) => (Y - Y0) * FH;               // and back again
    const hz = Math.max(0, Math.min(H2, Math.ceil(rowOf(HZ) - 0.5)));                    // the first half row below the horizon

    // A soft texture that repeats, for leaves, rock, ripples, cloud and mist:
    // TS texels square, read smoothly between them.
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
    const dither = Float32Array.from({ length: N }, (_, p) => (BAYER[((((p / cols) | 0) & 3) << 2) | (p % cols & 3)] + 0.5) / 16 - 0.5);

    // Colour. `lay` puts colour (r, g, b) over half cell p, covering it by a;
    // whatever mostly covers a half cell hides any character in its cell and
    // any colour kept there by name. `layInk` lays palette colour k seen
    // through f of the air, `keep` keeps colour k by name, and `along` gives
    // the colour x of the way along a ramp, smoothly between its colours.
    const [HR, HG, HB] = RGB[HAZE + 1];
    const airAt = (d) => 1 - Math.exp(-Math.max(0, d) / AIR); // how much of a thing d metres off the air hides
    function lay(p, r, g, b, a) {
      if (a >= 1) { RC[p] = r; GC[p] = g; BC[p] = b; } else { RC[p] += (r - RC[p]) * a; GC[p] += (g - GC[p]) * a; BC[p] += (b - BC[p]) * a; }
      if (a > 0.2) fix[p] = 0;
      if (a > 0.5) { wet[p] = 0; const h = (p / cols) | 0; glyph[(h >> 1) * cols + p - h * cols] = 32; }
    }
    const layInk = (p, k, f, a = 1) => { const [r, g, b] = RGB[k]; lay(p, r + (HR - r) * f, g + (HG - g) * f, b + (HB - b) * f, a); };
    const keep = (p, k) => { const [r, g, b] = RGB[k]; lay(p, r, g, b, 1); fix[p] = k; };
    const tone = [0, 0, 0];
    function along(K, n, x) {
      const i = Math.max(0, Math.min(n - 1.001, x)), j = Math.floor(i), f = i - j, A = RGB[K + j], B = RGB[K + j + 1];
      tone[0] = A[0] + (B[0] - A[0]) * f; tone[1] = A[1] + (B[1] - A[1]) * f; tone[2] = A[2] + (B[2] - A[2]) * f;
      return tone;
    }
    const layAlong = (p, K, n, x, f, a = 1) => { const [r, g, b] = along(K, n, x); lay(p, r + (HR - r) * f, g + (HG - g) * f, b + (HB - b) * f, a); };
    // Characters: `mark` sets one, and `over` gives a colour for one over half
    // cell p: that half cell's colour moved toward palette colour k by `by`.
    const inkOf = (r, g, b) => lut[(q5(r) << 10) | (q5(g) << 5) | q5(b)];
    const over = (p, k, by) => { const [r, g, b] = RGB[k]; return inkOf(RC[p] + (r - RC[p]) * by, GC[p] + (g - GC[p]) * by, BC[p] + (b - BC[p]) * by); };
    function mark(c, r, ch, colour, heavy = 0) { if (c >= 0 && c < cols && r >= 0 && r < rows) { const i = r * cols + c; glyph[i] = ch; ink[i] = colour; bold[i] = heavy; } }

    // A painted layer: everything at one distance as the camera sees it from
    // where it starts, without the air in front of it (added as the camera
    // comes on): its colour, how much of each half cell it covers, and its characters.
    const card = (D, air) => ({ D, air, r: new Float32Array(N), g: new Float32Array(N), b: new Float32Array(N), a: new Float32Array(N), mark: new Uint8Array(cells), tint: new Uint8Array(cells), h0: H2, h1: -1 });
    function dab(L, c, h, r, g, b, a) {
      if (c < 0 || c >= cols || h < 0 || h >= H2 || a <= 0) return;
      const p = h * cols + c, was = L.a[p] * (1 - a), sum = a + was;
      L.r[p] = (r * a + L.r[p] * was) / sum; L.g[p] = (g * a + L.g[p] * was) / sum; L.b[p] = (b * a + L.b[p] * was) / sum; L.a[p] = sum;
      if (h < L.h0) L.h0 = h;
      if (h > L.h1) L.h1 = h;
    }
    const markCard = (L, c, h, ch, k) => { const i = (h >> 1) * cols + c; if (c >= 0 && c < cols && h >= 0 && h < H2) { L.mark[i] = ch; L.tint[i] = k; } };

    // Tall, narrow rock peaks far off in the haze, lit from the right and
    // dissolving into the haze below: [across, top, half width at the foot]
    // in the source frame, and more beyond its sides for a wider screen.
    const peaks = card(900, 0);
    const PEAKS = [[-0.21, 0.24, 0.055], [-0.1, 0.29, 0.05], [0.235, 0.2, 0.045], [0.165, 0.145, 0.055]];
    for (const way of [-1, 1]) for (let x = 0.45 + R(0, 0.1); x < side + 0.1; x += R(0.14, 0.32)) PEAKS.unshift([way * x, R(0.2, 0.36), R(0.035, 0.065)]);
    for (const [x0, top, hw] of PEAKS) {
      const sd = R(0, 99), lean = R(-0.025, 0.025);
      for (let h = Math.max(0, Math.floor(rowOf(top))); h < Math.min(H2, rowOf(HZ)); h++) {
        const y = Yh[h], k = (y - top) / (HZ - top), mid = x0 + lean * k, fade = 1 - smooth(0.1, 0.62, k);
        const half = hw * Math.min(1, Math.sqrt(k * 5)) * (1 + 0.7 * k) * (1 + 0.4 * (tex(sd * 7 + y * 260, sd) - 0.5));
        for (let c = Math.max(0, Math.ceil(colOf(mid - half) - 0.5)); c <= Math.min(cols - 1, Math.floor(colOf(mid + half) - 0.5)); c++) {
          const across = (Xc[c] - mid) / half, streak = tex(Xc[c] * 520 + sd * 3, y * 26);
          const t = along(PEAK, 4, 1.5 + 1.5 * across + 1.8 * (streak - 0.5));
          dab(peaks, c, h, t[0], t[1], t[2], fade);
          if (h & 1 && fade > 0.85 && streak < 0.4 && hash(c, h + 31) < 0.5) markCard(peaks, c, h, BAR, PEAK);
        }
      }
    }

    // Trees behind the bridge, in two layers: hazy ones far off, and lush ones
    // nearer, in stands of [across, top, width] in the source frame, with more
    // beyond its sides for a wider screen. A stand is a dome of dark foliage
    // down to the water, heaped with round clumps of leaves, most of them near
    // its top, each lit on its upper right and shaded below; the low mist
    // hides the stand's foot.
    const far = card(80, 0.9), mid = card(44, 0.85);
    const canopy = new Float32Array(cols); // how high the stand reaches in each column
    function grove(L, x0, top, w, pale) {
      const foot = HZ + (LENS * EYE) / L.D, K = pale ? PALE : GREEN, n = pale ? 5 : 10, lo = pale ? 0.2 : 0.9, hi = pale ? 4 : 7.2;
      const clumps = [];
      for (let k = 0, m = Math.round(14 + 60 * w); k < m; k++) {
        const u = R(-1, 1), r = w * R(0.09, 0.17);
        clumps.push([x0 + u * w * 0.5, top + w * 0.35 * (1 - Math.sqrt(1 - u * u)) + r * 0.8 + R(0, 1) ** 1.7 * (foot - top) * 0.7, r, R(0, 999)]);
      }
      clumps.sort((a, b) => a[1] - b[1]);
      canopy.fill(foot);
      for (const [cx, cy, r] of clumps) {
        for (let c = Math.max(0, Math.ceil(colOf(cx - r) - 0.5)); c <= Math.min(cols - 1, Math.floor(colOf(cx + r) - 0.5)); c++) {
          canopy[c] = Math.min(canopy[c], cy - r * Math.sqrt(Math.max(0, 1 - ((Xc[c] - cx) / r) ** 2)));
        }
      }
      const haze = (h, t) => { const low = 0.8 * smooth(foot - 0.045, foot, Yh[h]); return [lerp(t[0], HR, low), lerp(t[1], HG, low), lerp(t[2], HB, low)]; };
      for (let c = 0; c < cols; c++) for (let h = Math.max(0, Math.ceil(rowOf(canopy[c]) + 0.5)); h <= Math.min(H2 - 1, rowOf(foot)); h++) {
        const [r, g, b] = haze(h, along(K, n, lo + 0.3 * (hi - lo) * tex(Xc[c] * 90 + x0 * 50, Yh[h] * 90)));
        dab(L, c, h, r, g, b, 1);
      }
      for (const [cx, cy, rad, salt] of clumps) {
        const bright = 0.3 * (1 - (cy - top) / (foot - top));
        for (let h = Math.max(0, Math.floor(rowOf(cy - rad))); h <= Math.min(H2 - 1, rowOf(cy + rad)); h++) {
          for (let c = Math.max(0, Math.floor(colOf(cx - rad))); c <= Math.min(cols - 1, colOf(cx + rad)); c++) {
            const dx = (Xc[c] - cx) / rad, dy = (Yh[h] - cy) / rad, e = dx * dx + dy * dy, nz = tex(Xc[c] * 200 + salt, Yh[h] * 200);
            if (e > 1 + 0.4 * (nz - 0.5)) continue;
            const lit = clamp01(0.3 + 0.35 * dx - 0.45 * dy + 0.2 * Math.sqrt(Math.max(0, 1 - e)) + bright + 0.45 * (nz - 0.5));
            const [r, g, b] = haze(h, along(K, n, lo + (hi - lo) * lit));
            dab(L, c, h, r, g, b, 1);
            if (!pale && h & 1 && hash(c, h + 77) < 0.05) markCard(L, c, h, lit > 0.5 ? COMMA : HIGH, inkOf(r * 0.75, g * 0.82, b * 0.75));
          }
        }
      }
    }
    const farFoot = HZ + (LENS * EYE) / far.D; // the far trees stand all along the water, with stands rising from them
    for (let c = 0; c < cols; c++) for (let h = Math.max(0, Math.floor(rowOf(0.38 + 0.06 * tex(Xc[c] * 40, 3)))); h <= Math.min(H2 - 1, rowOf(farFoot)); h++) {
      const t = along(PALE, 5, 0.5 + 1.4 * tex(Xc[c] * 90, Yh[h] * 90)), low = 0.8 * smooth(farFoot - 0.045, farFoot, Yh[h]);
      dab(far, c, h, lerp(t[0], HR, low), lerp(t[1], HG, low), lerp(t[2], HB, low), 1);
    }
    for (let x = -side - 0.1 + R(0, 0.06); x < side + 0.1; x += R(0.08, 0.15)) grove(far, x, R(0.26, 0.38), R(0.14, 0.24), true);
    const GROVES = [[-0.62, 0.2, 0.3], [-0.38, 0.17, 0.3], [-0.16, 0.3, 0.18], [0.04, 0.4, 0.2], [0.24, 0.3, 0.2], [0.42, 0.24, 0.24], [0.62, 0.26, 0.26], [0.8, 0.3, 0.22]];
    for (const way of [-1, 1]) for (let x = 0.98 + R(0, 0.08); x < side + 0.15; x += R(0.16, 0.28)) GROVES.push([way * x, R(0.2, 0.32), R(0.2, 0.3)]);
    for (const [x, top, w] of GROVES) grove(mid, x, top, w, false);

    // A painted layer as the camera sees it now: grown about the point ahead
    // on the horizon, and veiled by the air between.
    const map = new Int32Array(cols);
    function show(L, camZ) {
      if (L.h1 < L.h0) return;
      const k = L.D / (L.D - camZ), f = airAt(L.D - camZ) * L.air;
      for (let c = 0; c < cols; c++) { const m = Math.floor(colOf(Xc[c] / k)); map[c] = m >= 0 && m < cols ? m : -1; }
      const hA = Math.max(0, Math.floor(rowOf(HZ + (Yh[L.h0] - HZ) * k))), hB = Math.min(H2 - 1, Math.ceil(rowOf(HZ + (Yh[L.h1] - HZ) * k)));
      for (let h = hA; h <= hB; h++) {
        const h0 = Math.floor(rowOf(HZ + (Yh[h] - HZ) / k));
        if (h0 < L.h0 || h0 > L.h1) continue;
        for (let c = 0, p = h * cols; c < cols; c++, p++) {
          const m = map[c], q = h0 * cols + m;
          if (m < 0 || L.a[q] <= 0) continue;
          lay(p, L.r[q] + (HR - L.r[q]) * f, L.g[q] + (HG - L.g[q]) * f, L.b[q] + (HB - L.b[q]) * f, L.a[q]);
          const j = (h0 >> 1) * cols + m;
          if (h & 1 && L.mark[j] && L.a[q] > 0.9 && h0 > 0 && L.a[q - cols] > 0.9) {
            const [r, g, b] = RGB[L.tint[j]];
            mark(c, h >> 1, L.mark[j], inkOf(r + (HR - r) * f, g + (HG - g) * f, b + (HB - b) * f));
          }
        }
      }
    }

    // The sky: soft blue overhead, paling to the haze at the horizon and
    // brighter toward the sun at the upper right, with white clouds drifting
    // slowly to the left. All worked out once: the sky's colour in SKYC, the
    // sun's glow in SUN, and the clouds in CLOUDS, wider than the screen by as
    // far as they drift (DRIFTS columns).
    const SKYC = new Float32Array(hz * cols * 3), SUN = new Float32Array(hz * cols);
    const DRIFTS = Math.ceil(0.006 * T.end * FW) + 2, CW = cols + DRIFTS, CLOUDS = new Float32Array(hz * CW);
    for (let h = 0, p = 0; h < hz; h++) {
      const up = HZ - Yh[h];
      for (let c = 0; c < cols; c++, p++) {
        SUN[p] = Math.exp(-((Xc[c] - 0.75) ** 2 + (Yh[h] + 0.1) ** 2) / 0.35);
        SKYC.set(along(SKY, 8, 7.4 - 7.4 * smooth(0.02, 1.05, up) + 2.2 * SUN[p]), p * 3);
      }
      for (let i = 0; i < CW; i++) { const X = (i + 0.5 - cols / 2) / FW; CLOUDS[h * CW + i] = 0.65 * tex(X * 75 + 9, up * 210) + 0.35 * tex(X * 26 + 40, up * 70 + 13); }
    }
    function drawSky(s) {
      const sh = 0.006 * s * FW, k = Math.floor(sh), f = sh - k;
      for (let h = 0, p = 0; h < hz; h++) {
        const up = HZ - Yh[h], band = smooth(0.18, 0.42, up) * (1 - smooth(0.72, 1.15, up)), row = h * CW + k;
        for (let c = 0; c < cols; c++, p++) {
          let r = SKYC[p * 3], g = SKYC[p * 3 + 1], b = SKYC[p * 3 + 2];
          if (band > 0) {
            const n = CLOUDS[row + c] + (CLOUDS[row + c + 1] - CLOUDS[row + c]) * f, cover = band * smooth(0.5, 0.68, n);
            if (cover > 0) { const w = along(CLOUD, 3, 2 * smooth(0.55, 0.8, n) + SUN[p]); r += (w[0] - r) * cover; g += (w[1] - g) * cover; b += (w[2] - b) * cover; }
          }
          RC[p] = r; GC[p] = g; BC[p] = b;
        }
      }
    }

    // The pond, found along each half cell's ray down to it: clear emerald
    // close by, turquoise farther out, mirroring more of the bright haze the
    // farther it is. Its ripples are fixed to the water, so that they come on
    // as the camera does, and come in three sizes, each seen at the range it
    // suits: small ones close by, larger ones farther out. They drift gently
    // and catch the light, and glints twinkle, most of them toward the sun on
    // the right.
    const [CRR, CRG, CRB] = RGB[WATER + 9], [TRR, TRG, TRB] = RGB[WATER + 2];
    function drawWater(t, camZ) {
      const beat = Math.floor(t * 6);
      for (let h = hz; h < H2; h++) {
        const d = (LENS * EYE) / Math.max(1e-4, Yh[h] - HZ), z = camZ + d, r = h >> 1;
        const sheen = 0.1 + 0.62 * smooth(3, 32, d), sharp = 1 - smooth(5, 24, d), shine = 0.05 * smooth(0.5, 3, d) * (1 - smooth(8, 22, d));
        const small = 1 - smooth(0.8, 2.2, d), large = smooth(3, 9, d), medium = 1 - small - large; // how much of each size of ripple
        const kx = small > 0.5 ? 12 : 2.2, kz = small > 0.5 ? 25 : 2.6; // and the patches of water a ripple's mark may stand in
        const [r0, g0, b0] = along(WATER, 10, 3.6 + 2.6 * smooth(1, 16, d)), br = lerp(r0, HR, sheen), bg = lerp(g0, HG, sheen), bb = lerp(b0, HB, sheen);
        for (let c = 0, p = h * cols, patch = NaN; c < cols; c++, p++) {
          const x = (Xc[c] * d) / LENS, was = patch;
          let n = 0;
          if (small > 0) n += small * tex(x * 40 + t * 3, z * 90);
          if (medium > 0) n += medium * tex(x * 9 - t + 50, z * 18 + 30);
          if (large > 0) n += large * tex(x * 3.6 + t * 0.3, z * 2.6 + 70);
          const crest = smooth(0.55, 0.72, n) * sharp * 0.5, trough = smooth(0.45, 0.3, n) * sharp * 0.4;
          RC[p] = br + (CRR - br) * crest + (TRR - br) * trough; GC[p] = bg + (CRG - bg) * crest + (TRG - bg) * trough; BC[p] = bb + (CRB - bb) * crest + (TRB - bb) * trough;
          wet[p] = 1;
          patch = Math.floor(x * kx);
          if (crest > 0.3 && hash(c * 7 + beat * 131, h) < shine * smooth(-0.2, 0.6, Xc[c])) {
            keep(p, GLINT + 1);
            if (h & 1) mark(c, r, hash(h, c + beat) < 0.35 ? STAR : HIGH, GLINT + 1);
          } else if (h & 1 && d < 9 && crest > 0.15 && patch !== was && hash(patch, Math.floor(z * kz)) < 0.12) mark(c, r, hash(Math.floor(z * kz), 5) < 0.5 ? WAVE : DASH, over(p, GLINT + 1, 0.45));
        }
      }
    }

    // The waterfall on the right, behind the bridge: threads of white water
    // falling down a dark, mossy cliff among the trees, spreading as they fall,
    // into spray at its foot.
    // [middle, half width at its lip, height of its lip], in metres, clear of the right pair as the camera comes on
    const STRANDS = [[5.9, 0.18, 4.4], [6.8, 0.3, 5.2], [9.6, 0.25, 4.7], [12.2, 0.16, 3.6]];
    function drawFalls(t, camZ) {
      const d = FALL - camZ, sc = LENS / d, f = airAt(d), flow = Math.floor(t * 9);
      const c0 = Math.max(0, Math.floor(colOf(5 * sc))), c1 = Math.min(cols - 1, Math.ceil(colOf(12.5 * sc)));
      const h0 = Math.max(0, Math.floor(rowOf(HZ - (6.6 - EYE) * sc))), h1 = Math.min(H2 - 1, Math.floor(rowOf(HZ + EYE * sc)));
      for (let h = h0; h <= h1; h++) {
        const y = EYE + (HZ - Yh[h]) / sc;
        for (let c = c0, p = h * cols + c0; c <= c1; c++, p++) {
          const x = Xc[c] / sc, edge = Math.min(x - 5, 12.5 - x), n = tex(x * 14 + 5, y * 9);
          if (edge < 0 || y > 5.3 + 1.4 * (n - 0.5) - 2.8 * smooth(1.6, 0, edge)) continue;
          if (n > 0.5) layAlong(p, GREEN, 10, 1 + 9 * (n - 0.5), f); else layAlong(p, STONE, 5, 0.2 + 2.4 * n, f);
          let water = 0, glow = 0; // the falling water, and the spray hanging about it
          for (const [m, w, lip] of STRANDS) {
            const u = Math.abs(x - m) / (w * (1 + 0.8 * (1 - y / lip)));
            if (y < lip && u < 1) water = Math.max(water, Math.sqrt(1 - u * u) * smooth(lip, lip - 0.6, y) * smooth(0.3, 0.62, tex(x * 24 + m * 9, (y + t * 2.4) * 3)));
            glow = Math.max(glow, Math.exp(-(((x - m) / (2 * w + 0.5)) ** 2)) * smooth(lip + 0.3, lip - 1.5, y));
          }
          if (glow > 0.02) layAlong(p, HAZE, 4, 2.5, 0, 0.5 * glow);
          if (water > 0) layAlong(p, CLOUD, 3, 2.4 * water, f * 0.5, 0.85 * water);
          if (y < 1.6) layAlong(p, CLOUD, 3, 1.2, f * 0.6, 0.85 * (1 - y / 1.6) * smooth(0, 1.4, edge) * smooth(0.2, 0.6, tex(x * 5 - t * 0.6, y * 3 + 40)));
          if (water > 0.45 && h & 1 && y > 0.8 && hash(c, Math.floor((h >> 1) - t * 9) + 500) < 0.4) mark(c, h >> 1, hash(c, flow) < 0.6 ? BAR : COLON, over(p, GLINT + 1, 0.6));
        }
      }
    }

    // The hall and the pavilion, drawn through the lens: dark tiled roofs with
    // pale upturned corners, wood, and the hall's lattice screen, softened by
    // the air, and the pavilion paled further by the sun and the waterfall's
    // spray (`glare`). `high` is how high a tile is up its roof (0 to 1);
    // roofs have their tile courses, the screen its lattice, posts their grain.
    function build(p, part, x, high, f) {
      if (part === ROOF) layAlong(p, TILE, 5, 0.5 + 2.6 * high + ((((x * 3.2) % 1) + 1) % 1 < 0.35 ? -0.4 : 0), f);
      else if (part === SHADE) layAlong(p, WOOD, 6, 1.7 - 1.6 * high, f); // darkest up under the eaves
      else layInk(p, part === TIP ? TILE + 4 : part === EAVE ? WOOD + 2 : part === POST ? WOOD + 1 : part === LATTICE ? STONE + 3 : part === WALL ? WOOD + 2 : part === RAIL ? WOOD + 4 : STONE + 2, f);
    }
    const above = new Uint8Array(cols); // what was in the half row above, in each column
    function structure(D, x0, x1, y1, partAt, roofLow, roofHigh, glare, camZ) {
      const d = D - camZ, sc = LENS / d, f = lerp(airAt(d), 1, glare);
      const c0 = Math.max(0, Math.floor(colOf(x0 * sc))), c1 = Math.min(cols - 1, Math.ceil(colOf(x1 * sc)));
      const h0 = Math.max(0, Math.floor(rowOf(HZ - (y1 - EYE) * sc))), h1 = Math.min(H2 - 1, Math.ceil(rowOf(HZ - (DECK - EYE) * sc)));
      if (c1 < c0) return;
      above.fill(0);
      for (let h = h0; h <= h1; h++) {
        const y = EYE + (HZ - Yh[h]) / sc, high = clamp01((y - roofLow) / (roofHigh - roofLow));
        for (let c = c0, p = h * cols + c0; c <= c1; c++, p++) {
          const x = Xc[c] / sc, part = partAt(x, y);
          if (part) build(p, part, x, high, f);
          if (h & 1 && part && part === above[c]) {
            const r = h >> 1;
            if (part === LATTICE) mark(c, r, HASH, over(p, WOOD, 0.75));
            else if (part === ROOF && hash(c, r) < 0.4) mark(c, r, EQUAL, over(p, TILE, 0.5));
            else if (part === POST && sc * FW * 0.3 < 1.2) mark(c, r, BAR, over(p, WOOD, 0.6));
          }
          above[c] = part;
        }
      }
    }

    // Where the deck is in the column X: how far off, or 0 where there is none.
    function deckAt(X, camZ) {
      const u = (X * (BZ - camZ) - LENS * BX) / (LENS * (CX - BX) - X * (CZ - BZ));
      if (u >= 0 && u <= 1) return BZ + u * (CZ - BZ) - camZ;
      const x = (X * (AZ - camZ)) / LENS;
      return x <= BX && x >= AX ? AZ - camZ : 0;
    }
    // The bridge: its deck in warm brown, the top plank catching the light;
    // thin posts down into the water, braced in a V under the deck across the
    // pond, every other one standing a little above it.
    const UX = (CX - BX) / Math.hypot(CX - BX, CZ - BZ), UZ = (CZ - BZ) / Math.hypot(CX - BX, CZ - BZ);
    function drawBridge(camZ) {
      const f = airAt(BZ + 2 - camZ), dark = (() => { const [r, g, b] = RGB[WOOD + 1]; return inkOf(r + (HR - r) * f, g + (HG - g) * f, b + (HB - b) * f); })();
      for (let c = 0; c < cols; c++) {
        const d = deckAt(Xc[c], camZ);
        if (!d) continue;
        const top = rowOf(HZ - (LENS * (DECK - EYE)) / d), low = rowOf(HZ - (LENS * (BEAM - EYE)) / d);
        for (let h = Math.max(0, Math.floor(top)); h < Math.min(H2, Math.ceil(low)); h++) {
          const cover = Math.min(h + 1, low) - Math.max(h, top);
          if (cover > 0.2) layInk(h * cols + c, h < top + 0.7 ? WOOD + 5 : WOOD + 3, f, Math.min(1, cover * 1.4));
        }
      }
      const put = (c, r, g) => mark(c, r, g, dark);
      for (const post of POSTS) {
        const d = post.z - camZ, sc = LENS / d, cc = colOf(post.x * sc), w = 0.16 * sc * FW;
        if (cc < -3 || cc > cols + 3) continue;
        const top = rowOf(HZ - (post.top - EYE) * sc), foot = rowOf(HZ + EYE * sc);
        for (let c = Math.max(0, Math.floor(cc - w / 2)); c <= Math.min(cols - 1, Math.floor(cc + w / 2)); c++) {
          const cover = Math.min(c + 1, cc + w / 2) - Math.max(c, cc - w / 2);
          for (let h = Math.max(0, Math.floor(top)); h <= Math.min(H2 - 1, Math.floor(foot)); h++) layInk(h * cols + c, WOOD + 1, f, Math.min(1, cover * 1.6));
        }
        if (w < 1.2) for (let r = Math.max(0, Math.ceil(top / 2)); r < Math.min(rows, foot / 2); r++) put(Math.floor(cc), r, BAR);
        if (post.brace) for (const way of [-1, 1]) {
          const ex = post.x + way * 0.85 * UX, ez = post.z + way * 0.85 * UZ, es = LENS / (ez - camZ);
          line(cc, rowOf(HZ - (0.25 - EYE) * sc) / 2, colOf(ex * es), rowOf(HZ - (BEAM - EYE) * es) / 2, put);
        }
      }
    }

    // What colour a person is at (a, b): a metres ahead of their middle, the
    // way they face, and b up from the deck. `open` is how far apart their
    // feet are (0 to 1), and `sx` how far right of their middle that is on
    // screen, for the light from the right. Each has a ponytail tied high at
    // the back of the head; the face, turned from us, shows no more than skin.
    function person(who, a, b, open, sx) {
      const H = who.tall, head = H - 0.115, lit = sx > 0.06 ? 1 : sx < -0.05 ? -1 : 0;
      if ((a / 0.1) ** 2 + ((b - head) / 0.12) ** 2 < 1) return a > 0.045 && b < head + 0.01 ? SKIN + 1 : lit > 0 ? HAIR + 2 : HAIR;
      const tail = b - head - 0.03;
      if (tail < 0.03 && tail > -0.34 && Math.abs(a + 0.11 - 0.06 * tail) < 0.035) return HAIR + 1;
      const shoulder = H - 0.24, down = (shoulder - b) / shoulder; // 0 at the shoulders, 1 at the feet
      if (b > shoulder) return 0;
      if (who.wear === 'white') return b > 0.02 && Math.abs(a) < 0.15 + 0.11 * down ** 1.3 + (a < 0 ? 0.05 * down * down : 0) ? ROBE + 1 + lit : 0;
      if (who.wear === 'red') return b > 0.02 && Math.abs(a) < 0.13 + 0.13 * down ** 1.2 ? (b > H * 0.62 ? ROBE + 1 + Math.max(0, lit) : RED + 1 + Math.max(0, lit)) : 0;
      if (who.wear === 'jade') return b > 0.02 && Math.abs(a) < 0.14 + 0.08 * down ? JADE + Math.max(0, lit) : 0;
      if (b >= 0.48) return Math.abs(a) < 0.15 + 0.06 * down ? (b > 0.92 && b < 1.01 ? RED + 1 : b < 0.55 ? RED : DARK + Math.max(0, lit)) : 0; // a dark tunic with a red sash and a red hem
      return Math.abs(a - 0.11 * open) < 0.055 || Math.abs(a + 0.11 * open) < 0.055 ? DARK : 0; // and dark trousers
    }
    const votes = new Uint8Array(4);
    function drawPeople(s, camZ) {
      const walked = glide(s, WALK, 0.6, 0.8), spread = Math.abs(Math.sin((Math.PI * walked * STEPS) / WALK));
      for (const who of PEOPLE) {
        const x = who.x + (who.walks ? walked : 0), sc = LENS / (zAt(x) - who.near - camZ), open = who.walks ? spread : 0;
        const cx = colOf(x * sc), feet = rowOf(HZ - (DECK - EYE) * sc), perC = sc * FW, perH = sc * FH;
        const h0 = Math.max(0, Math.floor(feet - (who.tall + 0.05) * perH)), h1 = Math.min(H2 - 1, Math.floor(feet));
        for (let h = h0; h <= h1; h++) for (let c = Math.max(0, Math.floor(cx - 0.4 * perC)); c <= Math.min(cols - 1, Math.floor(cx + 0.4 * perC)); c++) {
          let n = 0;
          for (let k = 0; k < 4; k++) {
            const sx = (c + 0.25 + 0.5 * (k & 1) - cx) / perC, v = person(who, sx * who.face, (feet - h - 0.25 - 0.5 * (k >> 1)) / perH, open, sx);
            if (v) votes[n++] = v;
          }
          if (n < 2) continue;
          let best = votes[0], most = 0;
          for (let i = 0; i < n; i++) { let m = 0; for (let j = 0; j < n; j++) if (votes[j] === votes[i]) m++; if (m > most) { most = m; best = votes[i]; } }
          keep(h * cols + c, best);
        }
        if (!who.walks) continue;
        const r = (Math.ceil(feet - 0.5) - 1) >> 1, legs = who.wear === 'white' ? ROBE : DARK; // in the cell at their feet: a stride, or a step through
        if (spread > 0.55) { mark(Math.floor(cx - 0.5), r, SLASH, legs, 1); mark(Math.floor(cx + 0.5), r, BACK, legs, 1); }
        else if (spread < 0.3) mark(Math.floor(cx), r, BAR, legs, 1);
      }
    }

    // The water mirrors what stands behind it, upside down about the bridge's
    // waterline (or the far bank's, beyond the bridge's end): most at a glance
    // across the water and less looking down into it, wavering with the ripples.
    function drawMirror(t, camZ) {
      for (let c = 0; c < cols; c++) {
        const d = deckAt(Xc[c], camZ) || CZ + 3 - camZ, m = rowOf(HZ + (LENS * EYE) / d);
        for (let h = Math.max(hz, Math.ceil(m - 0.5)); h < H2; h++) {
          const p = h * cols + c, below = h + 0.5 - m, src = Math.floor(m - below), k = 0.6 * Math.exp(-below / (0.2 * FH));
          if (src < 0 || k < 0.03) break;
          if (!wet[p]) continue;
          const sc = Math.min(cols - 1, Math.max(0, c + Math.round(Math.sin(h * 0.9 + t * 2.3) * Math.min(1.5, below * 0.12)))), q = src * cols + sc;
          if (!wet[q]) { lay(p, RC[q] * 0.9, GC[q] * 0.93, BC[q] * 0.93, k); wet[p] = 1; }
        }
      }
    }

    // Low mist drifting slowly left over the water and under the bridge, in
    // sheets at several distances, thickest at the water: [metres off, how
    // high it reaches, how thick]. Wisps of it are drawn as ~.
    const SHEETS = [[36, 1.6, 0.85], [27, 1.15, 0.7], [19, 0.95, 0.55], [13, 0.7, 0.45]];
    const [MR, MG, MB] = RGB[HAZE + 2];
    function sheet(D, high, thick, n, t, camZ) {
      const d = D - camZ;
      if (d < 1) return;
      const sc = LENS / d, foot = Math.min(H2 - 1, Math.floor(rowOf(HZ + EYE * sc)));
      for (let h = Math.max(0, Math.floor(rowOf(HZ - (high * 1.3 - EYE) * sc))); h <= foot; h++) {
        const y = EYE + (HZ - Yh[h]) / sc, rise = 1 - smooth(high * 0.2, high * 1.3, y);
        if (rise <= 0) continue;
        for (let c = 0, p = h * cols; c < cols; c++, p++) {
          const x = Xc[c] / sc + DRIFT * t, a = thick * rise * smooth(0.28, 0.7, tex(x * 1.6 + n * 37, y * 2.6 + n * 19));
          if (a > 0.02) lay(p, MR, MG, MB, a);
          if (h & 1 && a > 0.3 && a < 0.7 && hash(Math.floor(x * sc * FW), (h >> 1) + n * 50) < 0.05) mark(c, h >> 1, WAVE, over(p, GLINT + 1, 0.5));
        }
      }
    }

    // The banks: mossy rocks along the water's edge, lit from the upper
    // right, with bushes of fern among them; the right bank runs back to the
    // pavilion, a dark bank comes close on the left, and rocks lie under the
    // walk along the hall. Each is [x, z, half width, height, a bush], in metres.
    const bankX = (z) => (z < 17 ? lerp(2.2, 7, (z - 3) / 14) : lerp(7, 11, (z - 17) / 13)); // the right bank's edge
    const STONES = [];
    for (let z = 3.2; z < 29; z += R(0.8, 1.4) * (0.55 + z / 14)) {
      const s = 0.6 + z / 20;
      STONES.push([bankX(z) + R(-0.25, 0.5) * s, z, R(0.35, 0.75) * s, R(0.3, 0.65) * s, 0]);
      if (rand() < 0.75) STONES.push([bankX(z) + R(0.5, 1.6) * s, z + R(0.2, 0.8), R(0.4, 0.9) * s, R(0.6, 1.5) * s, 1]);
    }
    for (let z = 2.6; z < 7.5; z += R(0.6, 1.1)) STONES.push([-R(2.3, 4.8) * (0.6 + z / 8), z, R(0.4, 0.8), R(0.3, 0.6), rand() < 0.3 ? 1 : 0]);
    for (let x = BX - 1; x > AX; x -= R(1.2, 2.6)) STONES.push([x, AZ - 0.4, R(0.5, 1.1), R(0.3, 0.6), 0]);
    function stone([x0, z, w, tall, bush], t, camZ) {
      const d = z - camZ;
      if (d < 0.3) return;
      const sc = LENS / d, f = airAt(d);
      const c0 = Math.max(0, Math.floor(colOf((x0 - w * 1.2) * sc))), c1 = Math.min(cols - 1, Math.ceil(colOf((x0 + w * 1.2) * sc)));
      const h0 = Math.max(0, Math.floor(rowOf(HZ - (tall * 1.25 - EYE) * sc))), h1 = Math.min(H2 - 1, Math.floor(rowOf(HZ + EYE * sc)));
      for (let h = h0; h <= h1; h++) {
        const y = EYE + (HZ - Yh[h]) / sc, v = y / tall;
        for (let c = c0, p = h * cols + c0; c <= c1; c++, p++) {
          const u = (Xc[c] / sc - x0) / w, n = tex((Xc[c] / sc) * 9 + z * 13, y * 9);
          if (v < 0 || u * u + v * v > 1 + (bush ? 0.7 : 0.25) * (n - 0.5)) continue;
          const lit = clamp01(0.45 + 0.4 * u + 0.4 * v + 0.35 * (n - 0.5));
          if (bush) layAlong(p, GREEN, 10, 0.8 + 4.6 * lit, f);
          else if (v > 0.55 && n > 0.45) layAlong(p, MOSS, 2, lit * 1.6, f);
          else layAlong(p, STONE, 5, 0.3 + 3.6 * lit, f);
          if (bush && h & 1 && hash(c, h + 900) < 0.3) mark(c, h >> 1, u < -0.3 ? BACK : u > 0.3 ? SLASH : HIGH, over(p, lit > 0.5 ? GREEN + 9 : GREEN, 0.5));
        }
      }
    }

    // Lotus leaves on thin stems in the water close by: round, seen almost
    // edge on from just above, pale yellow-green with a raised rim catching
    // the light from the right, and a darker lip in front. Each bobs very
    // slightly. [x, z, height above the water, radius], in metres; the
    // nearest are below the frame and show on a taller screen.
    const PADS = [[-0.62, 1.75, 0.12, 0.17], [-0.21, 1.95, 0.18, 0.22], [0.03, 1.84, 0.1, 0.14], [-0.62, 1.31, 0.15, 0.09], [-0.47, 1.58, 0.08, 0.11],
      [-0.93, 2.5, 0.2, 0.12], [-1.6, 2.6, 0.15, 0.14], [0.36, 2.9, 0.2, 0.11], [-0.6, 3.8, 0.22, 0.16], [0.75, 4.4, 0.18, 0.18], [-1.9, 4.9, 0.2, 0.2],
      [0.1, 6.2, 0.25, 0.22], [-0.25, 1.15, 0.12, 0.1], [0.3, 1.3, 0.15, 0.12], [-0.9, 1.2, 0.1, 0.12]];
    function pad([x0, z, y0, rad], k, t, camZ) {
      const d = z - camZ;
      if (d < 0.25) return;
      const y = y0 + 0.006 * Math.sin(t * 1.6 + k * 2.1), sc = LENS / d, f = airAt(d);
      const cx = colOf(x0 * sc), cy = rowOf(HZ + (EYE - y) * sc), ax = rad * sc * FW, ay = Math.max(0.55, (rad * (EYE - y) * sc * FH) / d), lip = Math.max(0.7, 0.035 * sc * FH);
      const foot = rowOf(HZ + EYE * sc), sw = Math.max(0.5, 0.012 * sc * FW) / 2;
      for (let h = Math.max(0, Math.floor(cy)); h <= Math.min(H2 - 1, Math.floor(foot)); h++) {
        for (let c = Math.max(0, Math.floor(cx - sw)); c <= Math.min(cols - 1, Math.floor(cx + sw)); c++) layAlong(h * cols + c, GREEN, 10, 3.5, f);
      }
      for (let h = Math.max(0, Math.floor(cy - ay)); h <= Math.min(H2 - 1, Math.floor(cy + ay + lip)); h++) {
        for (let c = Math.max(0, Math.floor(cx - ax)); c <= Math.min(cols - 1, Math.floor(cx + ax)); c++) {
          const u = (c + 0.5 - cx) / ax, v = h + 0.5 - cy;
          if (Math.abs(u) > 1) continue;
          const edge = ay * Math.sqrt(1 - u * u);
          if (v < -edge || v > edge + lip * Math.sqrt(1 - u * u)) continue;
          if (v <= edge) layAlong(h * cols + c, LOTUS, 6, 2.3 + 1.2 * u + 1.6 * smooth(0.5, 1, u * u + (v / ay) ** 2), f);
          else layAlong(h * cols + c, LOTUS, 6, 0.2 + 0.7 * (u + 1), f);
        }
      }
    }

    // Bamboo leaning in from both sides close by: [x at its foot, z, lean
    // (metres across for each metre up), radius, height, in the light], with
    // more beyond the frame's sides on a wider screen. A cane is lit on its
    // right edge and ringed at every node, and sways a little; twigs leave it
    // every so often in its upper part, each with a spray of slender leaves
    // that rustle.
    const CANES = [[-2.95, 4.2, 0.03, 0.065, 12, 0], [-3.35, 5.0, 0.08, 0.07, 12, 0], [-2.45, 4.8, 0.02, 0.05, 11, 0], [-4.3, 6.2, 0.42, 0.06, 11, 1],
      [3.45, 5.4, -0.03, 0.065, 12, 1], [3.95, 6.6, 0, 0.07, 12, 1], [4.6, 8.2, -0.6, 0.055, 10, 1]];
    for (const way of [-1, 1]) for (let X = 0.95 + R(0, 0.1); X < side + 0.15; X += R(0.1, 0.22)) { const z = R(4, 7); CANES.push([(way * X * z) / LENS, z, -way * R(0, 0.12), R(0.05, 0.07), 12, rand() < 0.5 ? 1 : 0]); }
    const SPRAYS = CANES.map(([x0, , , , top]) => {
      const leaves = [];
      for (let y = R(2.2, 3); y < top; y += R(0.35, 0.8)) {
        const way = (x0 < 0) === rand() < 0.7 ? 1 : -1, tx = way * R(0.25, 0.6), ty = R(0.1, 0.35); // twigs reach mostly toward the middle
        for (let k = 0, n = 3 + ((rand() * 4) | 0); k < n; k++) leaves.push([y, tx, ty, -Math.PI / 2 + way * R(0.2, 1.2), R(0.18, 0.32), R(0, 6.28), rand()]);
      }
      return leaves;
    });
    function cane(j, t, camZ) {
      const [x0, z, lean, rad, top, lit] = CANES[j], d = z - camZ;
      if (d < 0.4) return;
      const sc = LENS / d, w = rad * sc * FW, sway = 0.08 * Math.sin(t * 0.9 + j * 1.7), gap = 0.42 + 0.05 * (j % 3);
      const reach = 1.2 + Math.abs(lean) * top; // as far across as any of it goes from its foot
      if (colOf((x0 + reach) * sc) < 0 || colOf((x0 - reach) * sc) >= cols) return; // gone out of the picture
      const xAt = (y) => x0 + lean * y + sway * (y / top) ** 2;
      const stroke = Math.abs(lean * aspect) < 0.45 ? BAR : lean > 0 ? SLASH : BACK;
      let node = 0;
      for (let h = Math.max(0, Math.floor(rowOf(HZ - (top - EYE) * sc))); h <= Math.min(H2 - 1, Math.floor(rowOf(HZ + EYE * sc))); h++) {
        const y = EYE + (HZ - Yh[h]) / sc, cc = colOf(xAt(y) * sc), ring = (((y + j * 0.13) % gap) + gap) % gap / gap;
        const shade = ring < 0.05 ? -1.2 : ring < 0.1 ? 0.8 : 0;
        node = h & 1 ? node || shade < 0 : shade < 0;
        for (let c = Math.max(0, Math.floor(cc - w)); c <= Math.min(cols - 1, Math.floor(cc + w)); c++) {
          const cover = Math.min(c + 1, cc + w) - Math.max(c, cc - w), across = (c + 0.5 - cc) / Math.max(w, 0.5);
          if (cover <= 0.05) continue;
          if (lit) layAlong(h * cols + c, CANE, 5, 1.7 + 1.5 * across + shade, 0, Math.min(1, cover * 1.6));
          else layAlong(h * cols + c, GREEN, 10, 0.8 + 1.1 * across + shade, 0, Math.min(1, cover * 1.6));
        }
        if (h & 1) { const c = Math.floor(cc); if (c >= 0 && c < cols) mark(c, h >> 1, node ? EQUAL : stroke, over(h * cols + c, lit ? CANE : GREEN, 0.55)); }
      }
      for (const [y, tx, ty, ang, len, ph, k] of SPRAYS[j]) {
        const bx = xAt(y), ex = bx + tx, ey = y + ty, a = ang + 0.14 * Math.sin(t * 2.3 + ph), lx = ex + Math.cos(a) * len, ly = ey + Math.sin(a) * len;
        const c0 = colOf(ex * sc), h0 = rowOf(HZ - (ey - EYE) * sc), c1 = colOf(lx * sc), h1 = rowOf(HZ - (ly - EYE) * sc);
        if (Math.max(h0, h1) < 0 || Math.min(c0, c1) >= cols || Math.max(c0, c1) < 0) continue;
        const level = lit ? 3.5 + 3 * k : 1 + 2.2 * k, n = Math.ceil(Math.max(Math.abs(c1 - c0), Math.abs(h1 - h0)));
        for (let i = 0; i <= n; i++) {
          const c = Math.floor(lerp(c0, c1, i / n)), h = Math.floor(lerp(h0, h1, i / n));
          if (c >= 0 && c < cols && h >= 0 && h < H2) layAlong(h * cols + c, GREEN, 10, level, 0);
        }
        const leaf = (c, r, g) => { if (c >= 0 && c < cols && r >= 0 && r < rows) mark(c, r, g, over(r * 2 * cols + cols + c, GREEN, 0.6)); };
        line(colOf(bx * sc), rowOf(HZ - (y - EYE) * sc) / 2, c0, h0 / 2, leaf);
        line(c0, h0 / 2, c1, h1 / 2, leaf);
      }
    }

    // Everything at its own distance, drawn farthest first among the rest:
    // the waterfall, the pavilion, the hall, the bridge with the people on
    // it, the water's mirror of them, sheets of mist, stones and bushes, lotus
    // leaves and bamboo.
    const order = [
      [FALL, (s, t, camZ) => drawFalls(t, camZ)],
      [PAV, (s, t, camZ) => structure(PAV, 12, 20, 7.8, pavilionAt, 4.3, 7.7, 0.35, camZ)],
      [HALL, (s, t, camZ) => structure(HALL, -40, -3.5, 8.1, hallAt, 4.3, 7.9, 0, camZ)],
      [BZ + 0.2, (s, t, camZ) => { drawBridge(camZ); drawPeople(s, camZ); }],
      [BZ + 0.1, (s, t, camZ) => drawMirror(t, camZ)],
      ...SHEETS.map(([D, high, thick], n) => [D, (s, t, camZ) => sheet(D, high, thick, n, t, camZ)]),
      ...STONES.map((it) => [it[1], (s, t, camZ) => stone(it, t, camZ)]),
      ...PADS.map((it, k) => [it[1], (s, t, camZ) => pad(it, k, t, camZ)]),
      ...CANES.map((it, j) => [it[1], (s, t, camZ) => cane(j, t, camZ)]),
    ].sort((a, b) => b[0] - a[0]);

    // The handover. The low mist thickens over the water close by and rises,
    // the right first and in patches, over the bridge and the people and up
    // into the sky, until it is the whole picture. Then it thins away to the
    // page patch by patch, drifting left as it goes.
    const lag = new Float32Array(N);
    for (let h = 0, p = 0; h < H2; h++) for (let c = 0; c < cols; c++, p++) {
      lag[p] = clamp01(0.58 * (1 - (h + 0.5) / H2) + 0.22 * (0.5 - Xc[c] / side / 2) + 0.3 * (tex(Xc[c] * 60 + 300, Yh[h] * 90) - 0.5));
    }
    const MISTC = new Float32Array(N * 3); // the mist's colour in every half cell
    for (let h = 0, p = 0; h < H2; h++) for (let c = 0; c < cols; c++, p++) MISTC.set(along(HAZE, 4, 1.7 + 1.3 * tex(Xc[c] * 40, Yh[h] * 70 + 20)), p * 3);
    function rise(s) {
      const k = lerp(-0.1, 1.3, clamp01((s - T.rise) / (T.whole - T.rise)));
      for (let h = 0, p = 0; h < H2; h++) for (let c = 0; c < cols; c++, p++) {
        const a = smooth(lag[p], lag[p] + 0.3, k);
        if (a <= 0) continue;
        lay(p, MISTC[p * 3], MISTC[p * 3 + 1], MISTC[p * 3 + 2], a);
        if (a > 0.3) glyph[(h >> 1) * cols + c] = 32; // characters drawn before the mist would show dark through it
        if (h & 1 && a > 0.3 && a < 0.75 && hash(Math.floor(c / 3 + s * 4), h >> 1) < 0.1) mark(c, h >> 1, WAVE, over(p, GLINT + 1, 0.4));
      }
    }
    function thin(s) {
      const k = 1.45 * clamp01((s - T.whole) / (T.end - T.whole)), shift = (s - T.whole) * 14;
      for (let h = 0, p = 0; h < H2; h++) for (let c = 0; c < cols; c++, p++) {
        const f = clamp01((tex(Xc[c] * 40 + shift + 70, Yh[h] * 60 + 90) - 0.3) / 0.4), a = 1 - smooth(f, f + 0.4, k);
        if (a >= 1) { const o = dither[p] * 9; paint[p] = lut[(q5(MISTC[p * 3] + o) << 10) | (q5(MISTC[p * 3 + 1] + o) << 5) | q5(MISTC[p * 3 + 2] + o)]; continue; }
        const level = Math.floor(a * 8 + dither[p] + 0.5);
        paint[p] = level > 0 ? MIST + Math.min(8, level) : 0;
        if (h & 1 && a > 0.2 && a < 0.7 && hash(Math.floor(c / 3 + s * 6), h >> 1) < 0.12) mark(c, h >> 1, WAVE, MIST + 8);
      }
    }

    // Every half cell onto the palette: its colour dithered to the nearest of
    // the scenery's, or the colour it keeps by name.
    function settle() {
      for (let p = 0; p < N; p++) {
        if (fix[p]) { paint[p] = fix[p]; continue; }
        const o = dither[p] * 9;
        paint[p] = lut[(q5(RC[p] + o) << 10) | (q5(GC[p] + o) << 5) | q5(BC[p] + o)];
      }
    }

    return {
      cols, rows, palette: INK, glyph, ink, bold, paint,
      render(t) { // t: seconds since the film started
        glyph.fill(32); ink.fill(0); bold.fill(0); paint.fill(0);
        if (!(t < LENGTH)) return this; // over: nothing is left on the page
        const s = Math.max(0, t) * SPEED, camZ = glide(s, GLIDE, 0.4, 0.6); // where that is in the story, and how far the camera has come
        if (s >= T.whole) { thin(s); return this; }
        fix.fill(0); wet.fill(0);
        drawSky(s); drawWater(t, camZ);
        show(peaks, camZ); show(far, camZ); show(mid, camZ);
        for (const [, draw] of order) draw(s, t, camZ);
        if (s > T.rise) rise(s);
        settle();
        return this;
      },
    };
  }

  // Play it on the stage. Resolves when it has finished. `seed` changes the
  // details, not the layout: cloud, leaves, ripples, rocks and the far trees;
  // `freezeAt` holds one moment (in seconds) on screen instead of playing.
  // Reduced motion holds the opening view, the source image's framing.
  const film = { length: LENGTH, still: 1.2 / SPEED, createScene };
  return { play: (options) => AsciiStage.play(film, options), createScene };
})();
