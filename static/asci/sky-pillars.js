/*
 * Pillars in the sky: an ASCII loading screen.
 *
 *   <script src="ascii-stage.js"></script>
 *   <script src="sky-pillars.js"></script>
 *   <script>SkyPillars.play().then(showThePage);</script>
 *
 * A vast turquoise lake lies perfectly still, a mirror under gigantic, narrow
 * pillars of rock dressed in green, with white cloud wrapped round them at
 * different heights, temples on a hillside under the pillars on the right
 * and a band of bright mist along the horizon. Far out in the middle floats a
 * small dark boat with one figure standing on it. The boat glides straight
 * away, a thin V of wake breaking the mirror behind it, and the camera glides
 * after it, slower, so it shrinks into the mist and is gone. Still gliding,
 * the camera tilts up: the water leaves through the bottom of the frame and
 * the view climbs the pillars to their cloud-wrapped tops round open blue
 * sky. It rises on into the cloud, which closes over the sky, fills the frame
 * and thins away to the page. Five seconds (LENGTH).
 *
 * The world is in metres: x across, y up from the water, z ahead of where the
 * camera starts. All that stands up is a flat sheet at its own distance, and
 * the camera only glides straight ahead and tilts up, so along each half row
 * of the screen a sheet is met at one distance and fills a run of columns
 * between its edges. The sheets are laid nearest first, each showing only
 * where the nearer ones still let light through. The lake is a mirror: below
 * the horizon each half cell shows what its reflected ray meets. Colours are
 * worked out in RGB and set to the nearest colour of the palette through a
 * table. The whole film is a pure function of time: createScene().render(t)
 * fills a grid of characters and the colours behind them, and the stage
 * (ascii-stage.js) paints it.
 */
const SkyPillars = (() => {
  'use strict';
  const { code, clamp01, lerp, smooth, mulberry32, hash, noise } = AsciiStage;

  // The story's timeline, in the seconds of the user's description.
  const T = {
    glide: 1.5,  // the boat sets off straight away from us; the camera glides after it, slower
    mist: 6.0,   // the boat reaches the mist on the horizon, and the camera starts to tilt up
    gone: 7.0,   // the boat has faded from view in the mist
    top: 9.5,    // the camera looks up at the cloud-wrapped tops of the pillars round open sky
    close: 9.5,  // and rises on into the cloud, which closes over the sky from the corners in and fills the frame
    thin: 10.55, // then thins away to the page
    end: 11.7,
  };
  // It is played faster than that. LENGTH is how many seconds the whole of it
  // takes on screen, and SPEED how many times faster than the story that is.
  const LENGTH = 5, SPEED = T.end / LENGTH;

  // The world, in metres and seconds of the story.
  const DEG = Math.PI / 180;
  const EYE = 1;              // the camera's height over the water
  const LENS = 1.25;          // its focal length, in frame heights
  const DIP = 0.1;            // at first the horizon is this far below the middle of the frame, in frame heights
  const WIDE = 1;             // the least of the frame's width that is always on screen, in frame heights
  const DOLLY = 2;            // how fast the camera glides forward
  const BOAT = 40, SAIL = 11; // how far off the boat starts, and how fast it goes
  // Its wake: how fast the two arms part (metres across for each metre
  // behind the boat), and how much faster than the boat they reach back. A
  // real wake is wider and no longer than the boat's path, but seen from a
  // metre above the water that is a flat line on the horizon; this reads as a V.
  const SPREAD = 0.028, TRAIL = 3.2;
  const LOOK = 46 * DEG;      // how far up the camera ends up looking
  const DECK = 1600;          // the height of the clouds in the open sky
  const glide = (s, v) => { const w = Math.max(0, s - T.glide); return v * (w < 0.5 ? w * w : w - 0.25); }; // from rest, at v after half a second
  const MIST = BOAT + glide(T.mist, SAIL); // where the mist on the water begins: the boat gets there at T.mist
  const P0 = Math.atan(DIP / LENS);         // how far up the camera looks at first
  const pitch = (s) => P0 + (LOOK - P0) * smooth(T.mist, T.top + 0.3, s) + 0.08 * smooth(T.top, T.end + 1, s);
  // Ambient motion runs on screen time, so it stays as gentle as the description asks.
  const WIND = 3;             // metres a second the cloud bands drift right
  const FLOW = 9;             // metres a second the waterfalls fall

  // Colours. `swatch` adds a run of colours to INK and gives the index of the
  // first. The scene works in RGB and takes the nearest of these.
  const INK = ['#000000'];
  const swatch = (...colours) => INK.push(...colours) - colours.length;
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const ramp = (hexes) => (swatch(...hexes), Float32Array.from(hexes.flatMap(rgb))); // a run of colours to shade along, as RGB
  const SKYR = ramp(['#cad9e2', '#bcd0de', '#aec7da', '#a0bed7', '#92b5d3', '#84accf', '#77a3cb', '#6a9ac7', '#5e91c3']); // from the haze on the horizon up to overhead
  const CLOUD = INK.length;
  const CLOUDR = ramp(['#f6faf9', '#eaf1f0', '#dde8e8', '#cfdddf', '#bfd0d4', '#aec2c8', '#9cb1b9']); // white, down to the grey under a cloud
  const LEAFR = ramp(['#122924', '#173329', '#1d3e2f', '#244a34', '#2c5739', '#36653d', '#427342', '#508146', '#61904a', '#759f4e', '#8aad54', '#a1bc5c', '#b7ca69']); // deep shade to sunlit
  const ROCKR = ramp(['#222b2e', '#2e383b', '#3b4649', '#495457', '#596466', '#6a7476', '#7d8687', '#919999', '#a6adab', '#bbc1be']); // grey rock
  swatch('#e3ece7', '#d2ded9', '#c1d1cb'); // mist, greener than cloud
  swatch('#3e5e55', '#4e6d62', '#5f7d6f', '#718d7e', '#849e8e', '#97ae9e', '#aabeaf', '#becfc1'); // leaves in the haze
  swatch('#0d353f', '#11424c', '#165059', '#1c5e66', '#236d73', '#2c7c80', '#368b8b', '#429a96', '#51a8a1', '#63b5ac', '#78c1b7', '#8fccc2', '#a7d7cd', '#bfe1d8'); // the lake, deep teal to pale turquoise
  swatch('#b4cbc5', '#a3bfb8', '#92b3ab', '#81a79f', '#709b94'); // and the haze mirrored in it
  swatch('#3b8592', '#4b929d', '#5c9ea8', '#6eabb2', '#82b8bc', '#97c5c6', '#acd1cf'); // and the sky
  swatch('#13302b', '#193c33', '#20483b', '#285544', '#31624d', '#3c6f56', '#2f6a50', '#3a7658', '#3d6869', '#4a7a78', '#518985', '#5f9792'); // green pillars and grey rock mirrored in it
  const BOATC = ['#131e22', '#26353b', '#1c292e', '#141018'].map(rgb); // hull, robe, gunwale, hair
  swatch('#131e22', '#26353b', '#1c292e', '#141018', '#0b1316', '#324249');
  const OPAQUE = INK.length; // the scene's colours end here; after them come see-through ones
  const VEIL = swatch(...Array.from({ length: 8 }, (_, i) => `rgba(240,246,244,${((i + 1) / 9).toFixed(3)})`)) - 1; // the cloud thinning away: VEIL + 1 (faintest) to VEIL + 8
  const RGB = INK.map((hex) => (hex[0] === '#' ? rgb(hex) : [0, 0, 0]));
  const HAZE = [198, 214, 222];    // the haze along the horizon that far things fade into
  const GLOW = [242, 247, 245];    // the mist's light
  const TINT = [0.64, 0.82, 0.8]; // what the lake keeps of the light it mirrors
  const BODY = [40, 138, 142];    // and the turquoise of its own water

  // The nearest of the scene's colours to every colour, 32 levels to a channel.
  const LUT = new Uint8Array(1 << 15);
  for (let i = 0; i < LUT.length; i++) {
    const r = (i >> 10) * 8 + 4, g = ((i >> 5) & 31) * 8 + 4, b = (i & 31) * 8 + 4;
    let best = 1, near = Infinity;
    for (let k = 1; k < OPAQUE; k++) {
      const [pr, pg, pb] = RGB[k], dr = r - pr, dg = g - pg, db = b - pb, d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
      if (d < near) { near = d; best = k; }
    }
    LUT[i] = best;
  }
  const byte = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
  const nearest = (r, g, b) => LUT[((byte(r) >> 3) << 10) | ((byte(g) >> 3) << 5) | (byte(b) >> 3)];

  const [BAR, SLASH, BACK, LOW, DASH, HIGH, TICK, COMMA, DOT, WAVE, STAR, QUOTE, COLON, SEMI, EQ] = code("|/\\_-'`,.~*\":;=");
  const FLIP = Uint8Array.from({ length: 128 }, (_, k) => k); // a character as its reflection in the lake shows it
  for (const [a, b] of [[SLASH, BACK], [HIGH, COMMA], [TICK, DOT]]) { FLIP[a] = b; FLIP[b] = a; }
  FLIP[LOW] = DASH; FLIP[QUOTE] = COMMA;
  const FALLING = [BAR, COLON, BAR, HIGH, BAR, DOT]; // water falling, the pattern running down it
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const GRAIN = 8; // how far the dither shifts a colour (of 255) to mix it from the two nearest

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

  // The pillars of the source image: [how far off (m), where its top's middle
  // is across the frame at first (frame heights from the middle), how much of
  // it is bare rock (0 to 1), how much lighter it is, and its outline from the
  // water up: [height, half its width, how far its middle is shifted right],
  // in metres]. Each ends in a rounded top of trees.
  const PILLARS = [
    [150, -0.7, 0.15, 0.04, [[0, 24, -2], [14, 20, -1], [36, 15, 0], [62, 9, 0], [95, 7.5, -1], [130, 7, 0], [158, 4.5, 1]]], // far left
    [260, -0.3, 0.22, 0.02, [[0, 15, 9], [25, 14, 8], [55, 20, 4], [95, 29, 0], [140, 30, 0], [178, 25, -2], [205, 14, 0]]], // left of the middle, heavy at the top
    [460, -0.11, 0.2, 0, [[0, 20, 0], [50, 15, 0], [88, 9, 1], [100, 4, 2]]], // small ones far off in the haze
    [520, -0.5, 0.2, 0, [[0, 32, 0], [60, 20, 0], [105, 10, 0], [118, 4, 0]]],
    [500, 0.36, 0.2, 0, [[0, 25, 0], [50, 14, 0], [72, 5, 0]]],
    [210, 0.215, 0.35, -0.08, [[0, 22, 0], [40, 18, 0], [90, 17, -1], [140, 15, 0], [178, 11, 1], [188, 5, 0]]], // the tall dark one on the right
    [240, 0.86, 0.38, -0.02, [[0, 88, 0], [50, 84, 0], [110, 76, 6], [160, 62, 10], [205, 44, 14], [222, 22, 16]]], // the great mass on the right
  ];
  // Bands of cloud wrapped round them: [which pillar, height, half its depth,
  // how far it reaches past the pillar's left and right, how thick].
  const BANDS = [
    [0, 37, 5, 20, 40, 0.9], [0, 104, 5, 12, 32, 0.75], [0, 142, 6, 14, 36, 0.9],
    [1, 62, 5, 10, 30, 0.6], [1, 150, 7, 16, 42, 0.85], [1, 196, 6, 12, 36, 0.85],
    [5, 56, 6, 14, 36, 0.85], [5, 128, 5, 10, 30, 0.7], [5, 170, 6, 12, 40, 0.85],
    [6, 42, 6, 10, 30, 0.7], [6, 86, 8, 20, 40, 0.9], [6, 152, 7, 16, 40, 0.8], [6, 205, 7, 16, 40, 0.85],
  ];
  // Chunks of rock hanging in the air beside them: [how far off, across the
  // frame at first, the height of its lowest point, half its width, its height].
  const ROCKS = [[255, -0.15, 98, 2.6, 7], [255, -0.13, 114, 1.6, 4], [146, -0.52, 118, 1.8, 4.5], [205, 0.36, 140, 2.2, 5.5], [235, 0.37, 186, 2.6, 6], [255, -0.47, 168, 2, 5]];
  // Thin waterfalls on the pillars on the right: [which pillar, across (m), top, foot, half its width].
  const FALLS = [[6, 127, 150, 50, 1.1], [6, 104, 98, 36, 0.7], [5, 47, 112, 66, 0.6]];
  // The hillside under the pillars on the right: how far off it is, where it
  // begins (m across), and its temples: [across, tiers, half the width of the
  // lowest eaves, the height of a tier]. Pagodas have several tiers.
  const HILL = 135, HX = 16;
  const HOUSES = [[22, 1, 6, 4], [33, 1, 4.5, 4], [41.5, 4, 3, 4.5], [54, 1, 6, 4.5], [65, 2, 5.5, 4.5], [77, 1, 6.5, 5], [88, 3, 3.6, 4.5], [99, 1, 7, 5]];
  // The mist lying on the water, sheet behind sheet from where it begins: [how far beyond MIST, its height, how thick].
  const MISTS = [[0, 5, 0.45], [14, 9, 0.42], [45, 16, 0.45], [110, 28, 0.5], [230, 46, 0.6], [420, 70, 0.75]];

  // A temple, in metres from the middle of its foot: tiers of dark tiled roof,
  // each over a wall, their eaves sweeping up at the corners.
  const ROOF = 6, WALL = 7;
  function housePart(b, x, y) {
    const ax = Math.abs(x);
    for (let k = 0; k < b.tiers; k++) {
      const w = b.w * (1 - 0.17 * k), y0 = k * b.step, wall = b.step * (k ? 0.34 : 0.5), last = k === b.tiers - 1;
      if (y < y0) break;
      if (y < y0 + wall) return ax < w * 0.62 ? WALL : 0;
      const u = ax / w, sweep = 0.45 * (b.step - wall) * u ** 5, rise = (b.step - wall) * (last ? 1.35 : 1);
      if (u < 1 && y >= y0 + wall + sweep && y < y0 + wall + rise * (1 - u) ** 0.8 + sweep * 0.6) return ROOF;
      if (last && ax < 0.25 && y < y0 + wall + rise * 1.5) return ROOF; // the finial
    }
    return 0;
  }

  // The boat and its figure, seen from behind, in metres: x across from the
  // middle, y up from the water. 1 hull, 2 robe, 3 gunwale, 4 hair, 0 nothing.
  // `slim` (up to 1) widens the figure where it would be under a column wide.
  function boatPart(x, y, slim) {
    const ax = Math.abs(x);
    if (y < 0.5) return ax < 0.82 + 0.2 * (y / 0.5) ? (y > 0.4 ? 3 : 1) : 0; // the hull, flaring to its gunwale
    const fx = ax * slim;
    if (y < 1.35) return fx < 0.2 + 0.05 * ((1.35 - y) / 0.85) ? 2 : 0;     // the robe, to the ankles
    if (y < 1.74) return fx < 0.22 - 0.05 * ((y - 1.35) / 0.39) ? (fx < 0.04 && y > 1.55 ? 4 : 2) : 0; // shoulders, the ponytail falling down the back
    if ((x * slim / 0.1) ** 2 + ((y - 1.86) / 0.12) ** 2 < 1) return 4;      // the head, from behind: all hair
    return y < 2.02 && fx < 0.05 ? 4 : 0;                                      // the hair tied high at the back
  }

  function createScene({ cols, rows, aspect = 2, seed = 1 }) {
    const rand = mulberry32(seed), R = (a, b) => a + (b - a) * rand();
    const H2 = rows * 2, N = cols * H2, cells = cols * rows;
    const glyph = new Uint8Array(cells), ink = new Uint8Array(cells), bold = new Uint8Array(cells), paint = new Uint8Array(N);
    const own = new Uint8Array(cells); // cells that already have their character

    // The lens. The frame is FH half rows tall: as tall as the screen, unless
    // that would leave less than WIDE of its width across; a wider or taller
    // screen sees more of the world round it. A half cell is about square, q
    // columns tall. FR and FC: the half rows and columns to a unit of tangent.
    // The middle is a column's middle, so that the boat is one column wide.
    const q = aspect / 2, FH = Math.min(H2, cols / (WIDE * q)), FR = LENS * FH, FC = FR * q, cx = Math.floor(cols / 2) + 0.5, cy = H2 / 2;
    const U = Float32Array.from({ length: cols }, (_, c) => (c + 0.5 - cx) / FC); // each column's ray, across
    const V = Float32Array.from({ length: H2 }, (_, h) => (cy - h - 0.5) / FR);   // each half row's, up, before the camera tilts
    const NEAR = Float32Array.from(U, (u) => Math.exp(-6 * u * u));              // how near straight ahead each column looks, where the mist shines most
    const INV = new Float32Array(N), DITHER = new Float32Array(N); // one over the length of each half cell's ray; its step of the dither between colours
    for (let h = 0, p = 0; h < H2; h++) for (let c = 0; c < cols; c++, p++) {
      INV[p] = 1 / Math.sqrt(U[c] * U[c] + V[h] * V[h] + 1);
      DITHER[p] = ((BAYER[(h & 3) * 4 + (c & 3)] + 0.5) / 16 - 0.5) * GRAIN;
    }
    const DY = new Float32Array(H2), DZ = new Float32Array(H2); // this frame: each half row's ray, up and ahead, as the camera is tilted
    // A screen taller than the frame sees higher up at first, so there the
    // pillars are taller, to still rise out of the top of it.
    const TALL = Math.max(1, Math.tan(P0 + Math.atan(cy / FR) + 6 * DEG) / Math.tan(33 * DEG));

    // A soft texture that repeats, for leaves, cloud and mist: TS texels
    // square, read smoothly between them. Its largest blots are 16 texels.
    const TS = 128, TEX = new Float32Array(TS * TS);
    {
      const looped = (x, y, p, salt) => {
        const xi = Math.floor(x), yi = Math.floor(y), u = smooth(0, 1, x - xi), v = smooth(0, 1, y - yi);
        const at = (i, j) => hash((((i % p) + p) % p) + salt, ((j % p) + p) % p);
        return lerp(lerp(at(xi, yi), at(xi + 1, yi), u), lerp(at(xi, yi + 1), at(xi + 1, yi + 1), u), v);
      };
      let lo = Infinity, hi = -Infinity;
      for (let j = 0, k = 0; j < TS; j++) for (let i = 0; i < TS; i++, k++) {
        let n = 0;
        for (let o = 0, f = 8, a = 0.57; o < 3; o++, f *= 2, a /= 2) n += a * looped((i / TS) * f, (j / TS) * f, f, seed * 131 + o * 17);
        TEX[k] = n; lo = Math.min(lo, n); hi = Math.max(hi, n);
      }
      for (let k = 0; k < TEX.length; k++) TEX[k] = (TEX[k] - lo) / (hi - lo);
    }
    const tex = (u, v) => {
      const xi = Math.floor(u), yi = Math.floor(v), fx = u - xi, fy = v - yi;
      const x0 = xi & (TS - 1), x1 = (x0 + 1) & (TS - 1), y0 = (yi & (TS - 1)) * TS, y1 = ((yi + 1) & (TS - 1)) * TS;
      const a = TEX[y0 + x0], b = TEX[y0 + x1], c = TEX[y1 + x0];
      return a + (b - a) * fx + (c - a + (TEX[y1 + x1] - c - b + a) * fx) * fy;
    };

    // A shaded colour goes in S, red, green and blue, then how much it
    // covers; what it is goes in sm. (Fractions kept in plain variables shared
    // like this would each cost the browser a new object every time they changed.)
    const S = new Float64Array(4);
    let sm = 0;
    const pick = (ramp, l) => {
      const n = ramp.length / 3 - 1, x = (l < 0 ? 0 : l > 1 ? 1 : l) * n, i = x < n ? x | 0 : n - 1, f = x - i, j = i * 3;
      S[0] = ramp[j] + (ramp[j + 3] - ramp[j]) * f; S[1] = ramp[j + 1] + (ramp[j + 4] - ramp[j + 1]) * f; S[2] = ramp[j + 2] + (ramp[j + 5] - ramp[j + 2]) * f;
    };
    const toward = (c, k) => { S[0] += (c[0] - S[0]) * k; S[1] += (c[1] - S[1]) * k; S[2] += (c[2] - S[2]) * k; };
    // The open sky by how high it looks, from the horizon (0) to overhead
    // (1): its blue, how much of the mist's light there is in it, and how
    // much of it the clouds may cover (most of them low in the sky, so that
    // overhead stays open).
    const SKYN = 512, SKYL = new Float32Array(SKYN * 5);
    for (let i = 0; i < SKYN; i++) {
      const e = i / (SKYN - 1);
      pick(SKYR, Math.pow(e, 0.85));
      SKYL.set([S[0], S[1], S[2], Math.exp(-16 * e), smooth(0.012, 0.08, e) * (1 - 0.8 * smooth(0.25, 0.75, e))], i * 5);
    }

    // Everything that stands up, as sheets at their own distances: pillars and
    // floating rocks (STONE: an outline, one row of it to the half metre),
    // bands of cloud, mist lying on the water, and the hillside of temples.
    const STONE = 0, BAND = 1, MISTK = 2, HILLK = 3;
    const sheets = [];
    function stone(D, X, base, prof, bare, lit, bob) {
      const last = prof[prof.length - 1], top = last[0], cap = Math.max(2, last[1] * 1.2), n = Math.ceil((top + cap) * 2) + 1;
      const left = new Float32Array(n), right = new Float32Array(n), sd = R(0, 500);
      for (let i = 0; i < n; i++) {
        const y = i / 2;
        let k = 1;
        while (k < prof.length - 1 && prof[k][0] < y) k++;
        const [y0, w0, s0] = prof[k - 1], [y1, w1, s1] = prof[k], f = clamp01((y - y0) / (y1 - y0 || 1));
        const w = lerp(w0, w1, f) * (y > top ? Math.sqrt(Math.max(0, 1 - ((y - top) / cap) ** 2)) : 1), mid = X + lerp(s0, s1, f);
        const jag = (o) => 1 + 0.26 * (noise(y / 8, sd + o) - 0.5) + 0.18 * (noise(y / 2.2, sd + o + 7) - 0.5); // crags, and tufts of trees
        left[i] = mid - w * jag(0); right[i] = mid + w * jag(40);
      }
      return sheets.push({ kind: STONE, D, y0: base, y1: base + (n - 1) / 2, n, left, right, top, bare, lit, bob, falls: [], haze: 1 - Math.exp(-D / 1100), sx: R(0, TS), sy: R(0, TS) }) - 1;
    }
    const band = (D, yc, th, xl, xr, dense) => sheets.push({ kind: BAND, D, y0: yc - 1.8 * th, y1: yc + 1.8 * th, yc, th, xl, xr, dense, sx: R(0, TS), sy: R(0, TS) });
    const wrap = (k, y, th, l, r, dense) => { const L = sheets[k], i = Math.max(0, Math.min(L.n - 1, Math.round(y * 2))); band(L.D - 5, y, th, L.left[i] - l, L.right[i] + r, dense); };

    const pillar = PILLARS.map(([D, x, bare, lit, prof]) => stone(D, (x * D) / LENS, 0, prof.map(([y, w, m]) => [y * TALL, w, m]), bare, lit, null));
    for (const [k, y, th, l, r, dense] of BANDS) wrap(pillar[k], y * TALL, th, l, r, dense);
    for (const [k, x, top, foot, w] of FALLS) sheets[pillar[k]].falls.push(x, top * TALL, foot * TALL, w);
    for (const [D, x, y, w, tall] of ROCKS) stone(D, (x * D) / LENS, y * TALL, [[0, w * 0.15, 0], [tall * 0.5, w * 0.7, 0], [tall * 0.85, w, 0], [tall, w * 0.8, 0]], 1, 0.04, [R(1.8, 3), R(0.7, 1.1), R(0, 6.28)]);
    // The hillside reaches past the right of the widest screen.
    const span = Math.ceil((cx / FC) * HILL + 40), ground = new Float32Array(span), at = new Int16Array(span).fill(-1);
    for (let i = 0; i < span; i++) { const x = HX + i; ground[i] = 1 + 11 * smooth(HX, 110, x) + 40 * smooth(110, 260, x) + 6 * (noise(x / 22, 31) - 0.5) + 2 * (noise(x / 5, 37) - 0.5); }
    const houses = HOUSES.map(([x, tiers, w, step]) => ({ x, tiers, w, step }));
    for (let x = 108; x < HX + span - 10;) { const w = R(3.5, 7.5); houses.push({ x: x + w, tiers: rand() < 0.3 ? 3 : 1, w, step: R(4.2, 5.5) }); x += 2 * w + R(4, 12); }
    houses.forEach((b, k) => {
      b.y = ground[Math.min(span - 1, Math.round(b.x) - HX)] - 1; b.top = b.step * (b.tiers + 0.5) + 1;
      for (let i = Math.max(0, Math.floor(b.x - b.w - HX)); i <= Math.min(span - 1, Math.ceil(b.x + b.w - HX)); i++) at[i] = k; // which temple stands at each metre across
    });
    sheets.push({ kind: HILLK, D: HILL, y0: 0, y1: 100, xl: HX, xr: HX + span, n: span, ground, houses, at, sx: R(0, TS), sy: R(0, TS) });
    band(HILL - 4, 8, 3, 26, 70, 0.55); band(HILL - 4, 16, 3.5, 66, 118, 0.5); // mist wrapped round the temples
    const mists = MISTS.map(([d, top, dense]) => ({ kind: MISTK, D: MIST + d, y0: 0, y1: top * 1.3, top, dense, xl: -1e6, xr: 1e6, sx: R(0, TS), sy: R(0, TS), lo: new Float32Array(cols), hi: new Float32Array(cols), a: new Float32Array(cols), r: new Float32Array(cols), g: new Float32Array(cols), b: new Float32Array(cols) }));
    sheets.push(...mists);
    // Beyond the source image's edges, for wider screens: more pillars, each wrapped in cloud.
    const edge = (cx / FC) * LENS + 0.3; // frame heights from the middle to past the screen's edge
    for (const way of [-1, 1]) for (let x = way < 0 ? 0.98 : 1.42; x < edge + 0.4; x += R(0.16, 0.42)) {
      const D = R(170, 480), hw = R(9, 26), top = R(70, 200) * TALL;
      const k = stone(D, (way * x * D) / LENS, 0, [[0, hw * R(1.1, 1.5), 0], [top * 0.3, hw, R(-3, 3)], [top * 0.7, hw * R(0.7, 1.05), R(-4, 4)], [top, hw * R(0.4, 0.8), R(-4, 4)]], R(0.1, 0.45), R(-0.06, 0.03), null);
      for (let j = 0; j < 2; j++) wrap(k, R(0.25, 0.95) * top, R(5, 8), R(6, 16), R(20, 40), R(0.6, 0.9));
    }
    sheets.sort((a, b) => a.D - b.D); // laid nearest first
    sheets.forEach((L, i) => { L.id = i; L.gx = L.D / FC; L.gy = (2 * L.D) / FR; }); // and a patch about a cell on each, to pin characters to

    // Every frame: the colour the sheets give each half cell so far, and how
    // much light from behind them still gets through; the same in the lake's
    // mirror; the finished colour; what is in front in each half cell (-1:
    // sky or lake), where on it and what it is made of; how much cloud is in
    // front; and how much the wake stirs the water.
    const DR = new Float32Array(N), DG = new Float32Array(N), DB = new Float32Array(N), DT = new Float32Array(N);
    const MR = new Float32Array(N), MG = new Float32Array(N), MB = new Float32Array(N), MT = new Float32Array(N);
    const CR = new Float32Array(N), CG = new Float32Array(N), CB = new Float32Array(N);
    const TOP = new Int16Array(N), TX = new Float32Array(N), TY = new Float32Array(N), MAT = new Uint8Array(N), FOG = new Float32Array(N), STIR = new Float32Array(N);
    const MLEAF = 1, MROCK = 2, MFALL = 3, MCLOUD = 4, MMIST = 5, MHILL = 8; // and ROOF, WALL

    // A pillar or a rock at (X, y), y up from the bottom of its outline, whose
    // edges on that row are xl and xr: green over grey rock, a round column
    // lit from the upper left, `crown` lighter on its top and paler with
    // `fog`. Waterfalls run down it. Its reflection is plainer (`soft`).
    function shadeStone(L, X, y, xl, xr, crown, fog, t, soft) {
      const a = ((X - xl) / (xr - xl || 1)) * 2 - 1, lam = 0.62 * Math.sqrt(Math.max(0, 1 - a * a)) - 0.6 * a;
      const big = tex(X * 1.6 + L.sx, y * 0.9 + L.sy), fine = soft ? 0.5 : tex(X * 5 + L.sy, y * 4.4 + L.sx);
      const l = 0.6 * Math.max(0, lam) + 0.36 * (fine - 0.5) + crown;
      if (L.bob ? y < L.top * 0.75 : big < L.bare) { pick(ROCKR, l + 0.08); sm = MROCK; } else { pick(LEAFR, l); sm = MLEAF; }
      for (let f = 0; f < L.falls.length; f += 4) {
        const top = L.falls[f + 1], foot = L.falls[f + 2], d = Math.abs(X - L.falls[f]) / L.falls[f + 3];
        if (d >= 1 || y >= top || y <= foot) continue;
        const k = (1 - d * d) * (0.35 + 0.5 * tex(X * 3 + L.sx, (y + FLOW * t) * 0.7 + L.sy)) * smooth(foot, foot + 8, y) * (1 - smooth(top - 4, top, y));
        S[0] += (236 - S[0]) * k; S[1] += (244 - S[1]) * k; S[2] += (242 - S[2]) * k;
        if (k > 0.3) sm = MFALL;
      }
      toward(HAZE, fog);
    }
    // A band of cloud: a long streak that wavers and swells along its length,
    // billows drifting right through it, white on top and greyer underneath,
    // thinning at its ends.
    function shadeBand(L, X, Y, t) {
      const u = (X - WIND * t) * 0.7 + L.sx, v = (Y - L.yc - L.th * 0.8 * (tex(u, L.sy) - 0.5)) / (L.th * (0.45 + 0.9 * tex(u * 0.6, L.sy + 50)));
      if (v <= -1 || v >= 1) { S[3] = 0; return; }
      const n = tex(u * 2.6, Y * 2.2 + L.sy);
      S[3] = clamp01((1 - v * v) * 1.5 + (n - 0.5) * 1.8 - 0.35) * smooth(L.xl, L.xl + 14, X) * (1 - smooth(L.xr - 30, L.xr, X)) * L.dense;
      pick(CLOUDR, 0.12 - 0.3 * v + 0.45 * (0.5 - n)); sm = MCLOUD;
    }
    // The mist lying on the water is the same all the way up each column
    // but for how much there is, so it is worked out a column at a time: its
    // top rolls, lower off to the sides, and it is brightest straight ahead.
    // Its sheet then reaches only as high as its highest column.
    function mistColumns(L, t, camZ) {
      const dist = L.D - camZ, scale = 6 / L.top;
      L.y1 = 0;
      for (let c = 0; c < cols; c++) {
        const w = NEAR[c], roof = L.top * (0.5 + 0.8 * tex((U[c] * dist - 1.4 * t) * scale + L.sx, L.sy + 0.5 * t)) * (0.45 + 0.55 * w);
        L.lo[c] = roof * 0.2; L.hi[c] = roof; L.a[c] = L.dense * (0.55 + 0.45 * w); L.y1 = Math.max(L.y1, roof);
        pick(CLOUDR, 0.3 - 0.3 * w); toward(GLOW, 0.55 * w);
        L.r[c] = S[0]; L.g[c] = S[1]; L.b[c] = S[2];
      }
    }
    // The hillside: its temples, and trees down to the water.
    function shadeHill(L, X, Y, fog) {
      const i = Math.round(X) - HX, j = i < 0 ? 0 : i >= L.n ? L.n - 1 : i, k = L.at[j], b = k < 0 ? null : L.houses[k];
      if (b && Y >= b.y && Y < b.y + b.top) {
        const part = housePart(b, X - b.x, Y - b.y);
        if (part) { pick(ROCKR, part === ROOF ? 0.04 : 0.3); toward(HAZE, fog); sm = part; return; }
      }
      const g = L.ground[j];
      if (Y > g) { S[3] = 0; return; }
      pick(LEAFR, 0.22 + 0.5 * (tex(X * 2.2 + L.sx, Y * 2.6 + L.sy) - 0.5) + 0.2 * smooth(g - 4, g, Y));
      toward(HAZE, fog); sm = MHILL;
    }

    // Lay one sheet over the half cells whose rays meet it, straight on or
    // (mirror) reflected up off the lake, where the nearer sheets still let
    // light through. Along a half row it is met at one distance, so its edges
    // there give the run of columns it fills.
    function pass(L, t, camZ, mirror) {
      const dist = L.D - camZ, kind = L.kind;
      if (dist < 3) return;
      const lift = L.bob ? L.bob[0] * Math.sin(t * L.bob[1] + L.bob[2]) : 0, y0 = L.y0 + lift, y1 = L.y1 + lift;
      const Rr = mirror ? MR : DR, Rg = mirror ? MG : DG, Rb = mirror ? MB : DB, Rt = mirror ? MT : DT;
      for (let h = 0; h < H2; h++) {
        const dz = DZ[h], dy = DY[h];
        if (dz < 0.02 || (mirror && dy >= 0)) continue;
        const tt = dist / dz, Y = mirror ? -EYE - dy * tt : EYE + dy * tt;
        if (Y < 0 || Y < y0 || Y > y1) continue;
        const y = Y - y0;
        let xl = L.xl, xr = L.xr, fog = 0, crown = 0;
        if (kind === STONE) {
          const i = (y * 2) | 0;
          xl = L.left[i]; xr = L.right[i]; fog = L.haze + 0.3 * Math.exp(-Y / 26); crown = 0.12 + L.lit + 0.12 * smooth(L.top - 14, L.top, y);
        } else if (kind === HILLK) fog = 0.22 + 0.4 * Math.exp(-Y / 12);
        const c0 = Math.max(0, Math.ceil(cx + (xl / tt) * FC - 0.5)), c1 = Math.min(cols - 1, Math.floor(cx + (xr / tt) * FC - 0.5));
        for (let c = c0, p = h * cols + c0; c <= c1; c++, p++) {
          const light = Rt[p];
          if (light < 0.01) continue;
          const X = U[c] * tt;
          S[3] = 1;
          if (kind === STONE) shadeStone(L, X, y, xl, xr, crown, fog, t, mirror);
          else if (kind === BAND) shadeBand(L, X, Y, t);
          else if (kind === HILLK) shadeHill(L, X, Y, fog);
          else { const lo = L.lo[c], f = (Y - lo) / (L.hi[c] - lo); S[3] = L.a[c] * (f <= 0 ? 1 : f >= 1 ? 0 : 1 - f * f * (3 - 2 * f)); S[0] = L.r[c]; S[1] = L.g[c]; S[2] = L.b[c]; sm = MMIST; }
          const a = S[3];
          if (a < 0.004) continue;
          const w = light * a;
          Rr[p] += S[0] * w; Rg[p] += S[1] * w; Rb[p] += S[2] * w; Rt[p] = light - w;
          if (mirror) continue;
          if (kind === BAND) FOG[p] += (1 - FOG[p]) * a;
          if (a > 0.5 && TOP[p] < 0) { TOP[p] = L.id; TX[p] = X; TY[p] = y; MAT[p] = sm; }
        }
      }
    }

    // How much of the light the lake mirrors, by how steeply down we look at it.
    const mirrored = (steep) => Math.max(0.4, 0.92 - 1.2 * steep);
    // The open sky behind it all: blue, deeper overhead, with white cloud on
    // a deck high up, and the mist's light along the horizon. e: how high it looks.
    function sky(c, e, dy, dz, t) {
      const j = ((e < 0 ? 0 : e > 1 ? 1 : e) * (SKYN - 1) | 0) * 5;
      S[0] = SKYL[j]; S[1] = SKYL[j + 1]; S[2] = SKYL[j + 2];
      if (SKYL[j + 4] > 0) {
        const far = DECK / dy, n = tex(U[c] * far * 0.011 - t * 0.3, dz * far * 0.011), cover = smooth(0.5, 0.72, n) * SKYL[j + 4];
        if (cover > 0.004) { const r = S[0], g = S[1], b = S[2]; pick(CLOUDR, 0.1 + 0.6 * (0.72 - n)); S[0] = r + (S[0] - r) * cover; S[1] = g + (S[1] - g) * cover; S[2] = b + (S[2] - b) * cover; }
      }
      toward(GLOW, SKYL[j + 3] * (0.75 + 0.25 * NEAR[c]));
    }

    // Behind everything: the sky, the sky mirrored in the lake, and the lake,
    // which takes most of its colour from what it mirrors (more of it toward
    // the horizon) and the rest from its own turquoise, deeper nearer us.
    // Along the wake's two arms and between them the mirror is read from a
    // little way off, broken, its ripples catching the light or darker, and
    // the arms' crests are pale. Gives the first half row of water.
    function backdrop(s, t, camZ) {
      for (let h = 0; h < H2; h++) {
        const dy = DY[h], dz = DZ[h];
        for (let c = 0, p = h * cols; c < cols; c++, p++) {
          if (dy >= 0) {
            if (DT[p] < 0.004) { CR[p] = DR[p]; CG[p] = DG[p]; CB[p] = DB[p]; continue; }
            sky(c, dy * INV[p], dy, dz, t);
            CR[p] = DR[p] + DT[p] * S[0]; CG[p] = DG[p] + DT[p] * S[1]; CB[p] = DB[p] + DT[p] * S[2];
          } else if (MT[p] > 0.004) {
            sky(c, -dy * INV[p], -dy, dz, t);
            MR[p] += MT[p] * S[0]; MG[p] += MT[p] * S[1]; MB[p] += MT[p] * S[2];
          }
        }
      }
      let first = 0;
      while (first < H2 && DY[first] >= 0) first++;
      const Zb = BOAT + glide(s, SAIL), moved = Zb - BOAT, reach = Math.min(Zb - camZ - 2, TRAIL * moved + 2 * smooth(0, 1, moved));
      const calm = (1 - smooth(T.gone, T.gone + 2.5, s)) * smooth(0, 0.6, moved); // the wake builds as the boat gets going, and settles once it is gone
      for (let h = first; h < H2; h++) {
        const dy = DY[h], dz = DZ[h], far = -EYE / dy, Z = camZ + dz * far, l = Zb - Z;
        const steep = -dy * INV[h * cols + (cols >> 1)], fres = mirrored(steep);
        const br = BODY[0] - 30 * steep, bg = BODY[1] - 40 * steep, bb = BODY[2] - 30 * steep;
        const age = calm > 0 && l > 0 && l < reach ? calm * smooth(reach, reach - 6, l) * Math.exp(-l / 50) : 0, w = 0.06 + 0.008 * l; // how strong the wake is this far behind the boat, and how wide an arm
        for (let c = 0, p = h * cols; c < cols; c++, p++) {
          let from = p, glint = 0, A = 0;
          if (age > 0.02) {
            const ax = Math.abs(U[c] * far), arm = ax - SPREAD * l, crest = Math.exp(-(arm * arm) / (w * w));
            A = age * Math.min(1, crest + (arm < 0 ? 0.45 : 0));
            if (A > 0.03) {
              const ph = l * 1.3 - t * 5 + ax * 3;
              const c2 = Math.max(0, Math.min(cols - 1, c + Math.round(A * 2.4 * Math.sin(ph)))), h2 = Math.max(first, Math.min(H2 - 1, h + Math.round(A * 1.6 * Math.cos(ph * 0.8))));
              from = h2 * cols + c2; glint = A * 60 * Math.sin(ph + 1) + 70 * age * crest;
            }
          }
          STIR[p] = A;
          const r = lerp(br, MR[from] * TINT[0], fres) + glint, g = lerp(bg, MG[from] * TINT[1], fres) + glint, b = lerp(bb, MB[from] * TINT[2], fres) + glint;
          CR[p] = DR[p] + DT[p] * r; CG[p] = DG[p] + DT[p] * g; CB[p] = DB[p] + DT[p] * b;
        }
      }
      return first;
    }

    // The boat and its figure, dark against the mist, with a faint reflection
    // under it; once it is into the mist it fades into it. On the smallest
    // screens it keeps a least size, so that it is still a boat.
    function drawBoat(s, camZ, cp, sp) {
      const Zb = BOAT + glide(s, SAIL), fade = smooth(MIST, MIST + SAIL * (T.gone - T.mist) * 0.9, Zb);
      const zr = Zb - camZ, fwd = -EYE * sp + zr * cp, up = -EYE * cp - zr * sp;
      if (fade >= 1 || fwd < 1) return;
      const k = Math.max(FR / fwd, 1.1), kc = k * q, water = cy - (FR * up) / fwd, slim = Math.min(1, kc * 0.42); // half rows and columns to a metre there, its waterline's half row
      const c0 = Math.max(0, Math.floor(cx - 1.1 * kc)), c1 = Math.min(cols - 1, Math.ceil(cx + 1.1 * kc));
      const h0 = Math.max(0, Math.floor(water - 2.1 * k)), h1 = Math.min(H2 - 1, Math.ceil(water + 1.3 * k));
      for (let h = h0; h <= h1; h++) for (let c = c0; c <= c1; c++) {
        let hits = 0, part = 0;
        for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
          const got = boatPart((c + (i + 0.5) / 3 - cx) / kc, Math.abs((water - (h + (j + 0.5) / 3)) / k), slim);
          if (got) { hits++; part = got; }
        }
        if (hits < 3) continue;
        const p = h * cols + c, [r, g, b] = BOATC[part - 1], k2 = (1 - fade) * (h + 0.5 > water ? 0.45 : 1);
        CR[p] += (r - CR[p]) * k2; CG[p] += (g - CG[p]) * k2; CB[p] += (b - CB[p]) * k2;
        TOP[p] = -2;
      }
    }

    // The wake's crests as lines from the boat's stern back along each arm,
    // and a fainter one inside each, pale near the boat and fading into the
    // water behind it.
    function wakeLines(s, camZ, cp, sp) {
      const Zb = BOAT + glide(s, SAIL), moved = Zb - BOAT, reach = Math.min(Zb - camZ - 2, TRAIL * moved + 2 * smooth(0, 1, moved));
      const fade = (1 - smooth(T.mist, T.gone + 1.5, s)) * smooth(0.5, 4, moved);
      if (fade <= 0 || reach < 3) return;
      const at = (x, z) => { const zr = z - camZ, fwd = -EYE * sp + zr * cp, up = -EYE * cp - zr * sp; return [cx + (FC * x) / fwd, (cy - (FR * up) / fwd) / 2]; };
      let bright = 1; // how strong the crest being drawn is
      const put = (c, r, g) => {
        const h = 2 * r + 1;
        if (c < 0 || c >= cols || r < 0 || r >= rows || own[r * cols + c] || TOP[h * cols + c] !== -1 || DY[h] >= 0) return;
        const p = h * cols + c, l = Zb - camZ + (EYE / DY[h]) * DZ[h], k = bright * Math.min(1, 1.1 * fade * Math.exp(-l / 50)) * smooth(reach, reach - 6, l);
        if (k < 0.15) return;
        const i = r * cols + c;
        glyph[i] = (g === LOW || g === DASH) && hash(c, r) < 0.3 ? WAVE : g; ink[i] = nearest(lerp(CR[p], 240, k), lerp(CG[p], 248, k), lerp(CB[p], 246, k)); own[i] = 1;
      };
      for (const [part, strength] of [[1, 1], [0.75, 0.7]]) for (const way of [-1, 1]) {
        const [c0, r0] = at(0, Zb - 0.9), [c1, r1] = at(way * SPREAD * part * reach, Zb - reach);
        bright = strength;
        line(c0, r0 + 0.3, c1, r1 + 0.3, put);
      }
    }

    // The scene's characters, each pinned to a patch of about a cell on the
    // thing it marks, so that it moves with it: leaves on the pillars and the
    // hillside, cracks in the rock, wisps on the cloud, falling water, roof
    // tiles. A cell split between two things is left clean. Below the horizon
    // the lake mirrors them, turned over, except where the wake stirs it.
    const shade = (p, k) => (k > 0 ? nearest(CR[p] + (255 - CR[p]) * k, CG[p] + (255 - CG[p]) * k, CB[p] + (255 - CB[p]) * k) : nearest(CR[p] * (1 + k), CG[p] * (1 + k), CB[p] * (1 + k)));
    function marks(t, camZ, pt, first) {
      const cp = Math.cos(pt), sp = Math.sin(pt);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const i = r * cols + c, pa = 2 * r * cols + c, pb = pa + cols, id = TOP[pb];
        if (own[i] || id < 0 || id !== TOP[pa] || MAT[pa] !== MAT[pb]) continue;
        const L = sheets[id], m = MAT[pb], X = TX[pb], Y = (TY[pa] + TY[pb]) / 2;
        if (m === MFALL) {
          const k = Math.floor(((Y + FLOW * t) / L.gy) * 2);
          glyph[i] = FALLING[((k % 6) + 6) % 6]; ink[i] = shade(pb, 0.5);
          continue;
        }
        if (m === MCLOUD || m === MMIST) { // wisps drifting with it: the first two cells of a slot of five
          const u = (X - (m === MCLOUD ? WIND : 1.4) * t) / L.gx, slot = Math.floor(u / 5);
          if (u - slot * 5 < 2 && hash(slot + id * 977, Math.floor(Y / L.gy)) < (m === MCLOUD ? 0.1 : 0.03)) { glyph[i] = WAVE; ink[i] = shade(pb, -0.12); }
          continue;
        }
        // only in the cell that holds the middle of its patch, so it is drawn once
        const ix = Math.floor(X / L.gx), iy = Math.floor(Y / L.gy), roll = hash(ix + id * 7919, iy);
        const Ym = (iy + 0.5) * L.gy + L.y0 + (L.bob ? L.bob[0] * Math.sin(t * L.bob[1] + L.bob[2]) : 0), zr = L.D - camZ;
        const fwd = (Ym - EYE) * sp + zr * cp, up = (Ym - EYE) * cp - zr * sp;
        if (Math.floor(cx + (FC * (ix + 0.5) * L.gx) / fwd) !== c || Math.floor((cy - (FR * up) / fwd) / 2) !== r) continue;
        const lum = (CR[pb] + CG[pb] * 2 + CB[pb]) / 4;
        if (m === MLEAF || m === MHILL) {
          if (lum > 100 && roll < 0.28) { glyph[i] = roll < 0.12 ? STAR : roll < 0.2 ? QUOTE : HIGH; ink[i] = shade(pb, 0.22); }
          else if (roll < 0.24) { glyph[i] = roll < 0.1 ? SEMI : roll < 0.17 ? COMMA : DOT; ink[i] = shade(pb, -0.3); }
        } else if (m === MROCK) {
          if (roll < 0.22) { glyph[i] = roll < 0.13 ? BAR : roll < 0.18 ? COLON : roll < 0.2 ? SLASH : BACK; ink[i] = shade(pb, -0.32); }
        } else if (m === ROOF) { glyph[i] = TOP[pa - cols] === id && MAT[pa - cols] === ROOF ? EQ : DASH; ink[i] = shade(pb, 0.3); }
        else if (m === WALL && roll < 0.5) { glyph[i] = BAR; ink[i] = shade(pb, -0.35); }
      }
      // The lake mirrors them: a ray at angle a below the camera's aim sees
      // what one at -a - 2 * pitch sees above the water.
      for (let r = (first + 1) >> 1; r < rows; r++) {
        const rm = Math.floor((cy - Math.tan(-Math.atan((cy - 2 * r - 1) / FR) - 2 * pt) * FR) / 2), h = 2 * r + 1; // the row this one mirrors
        if (rm < 0 || rm >= rows) continue;
        const fres = mirrored(-DY[h] * INV[h * cols + (cols >> 1)]);
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c, j = rm * cols + c, pb = h * cols + c;
          if (own[i] || glyph[j] === 32 || TOP[pb] !== -1 || TOP[pb - cols] !== -1 || STIR[pb] > 0.08 || STIR[pb - cols] > 0.08) continue;
          const [r0, g0, b0] = RGB[ink[j]];
          glyph[i] = FLIP[glyph[j]]; ink[i] = nearest(lerp(BODY[0], r0 * TINT[0], fres), lerp(BODY[1], g0 * TINT[1], fres), lerp(BODY[2], b0 * TINT[2], fres));
        }
      }
    }

    // The handover: still rising, the camera goes up into the cloud. It
    // closes over the sky, a billowing front from the corners in, thicker
    // where the bands already are, and brightens to an even white as it
    // fills the frame, the white the thinning starts from. Where it has got
    // to, in `k`, runs evenly; the front reaches the middle of the edges at
    // about 0.4 and the middle of the frame at about 0.8, and the last gaps
    // close at 1.
    function closing(s, t) {
      const k = clamp01((s - T.close) / (T.thin - T.close)), grey = 1 - k * k;
      for (let h = 0; h < H2; h++) {
        const dy = DY[h], dz = DZ[h];
        for (let c = 0, p = h * cols; c < cols; c++, p++) {
          const inv = INV[p], n = tex(U[c] * inv * 40 - t * 1.5, dy * inv * 40 + dz * inv * 8);
          const rim = Math.hypot((c + 0.5 - cx) / cx, (h + 0.5 - cy) / cy); // 1 at the middle of each edge, more in the corners
          const cover = smooth(0, 0.16, rim * 1.2 + (n - 0.5) * 0.9 + FOG[p] * 0.4 + k * 3.16 - 2.55);
          if (cover <= 0) continue;
          pick(CLOUDR, (0.06 + 0.5 * (0.62 - n)) * grey);
          CR[p] += (S[0] - CR[p]) * cover; CG[p] += (S[1] - CG[p]) * cover; CB[p] += (S[2] - CB[p]) * cover;
          if (cover > 0.5) TOP[p] = -3;
        }
      }
    }

    // The cloud thins away to the page, the closing turned round: a hole
    // opens in the middle and spreads to the corners, its edge billowing and
    // thin, with wisps drifting right in it, until nothing is left by the
    // end. Where it has got to, in `k`, runs evenly, from just short of the
    // first holes to just past the last of the cloud.
    function thinning(s, t) {
      const k = 1.5 * clamp01((s - T.thin) / (T.end - 0.05 - T.thin)) - 0.1;
      const left = (c, h) => { // how much of the cloud is left in a half cell
        const o = 0.1 + 0.6 * Math.hypot((c + 0.5 - cx) / cx, (h + 0.5 - cy) / cy) + 0.4 * (tex(c * 0.5 - t * 6, h * 0.9) - 0.5);
        return 1 - smooth(o, o + 0.25, k);
      };
      for (let h = 0, p = 0; h < H2; h++) for (let c = 0; c < cols; c++, p++) {
        const level = Math.floor(left(c, h) * 9 + DITHER[p] / GRAIN + 0.5);
        paint[p] = level >= 9 ? CLOUD : level > 0 ? VEIL + level : 0;
      }
      for (let r = 0, i = 0; r < rows; r++) for (let c = 0; c < cols; c++, i++) {
        const a = left(c, 2 * r + 1), u = c - t * cols * 0.05, slot = Math.floor(u / 4);
        if (paint[(2 * r + 1) * cols + c] && a > 0.15 && a < 0.75 && u - slot * 4 < 1.5 && hash(slot, r + 77) < 0.3) { glyph[i] = WAVE; ink[i] = CLOUD; }
      }
    }

    return {
      cols, rows, palette: INK, glyph, ink, bold, paint,
      render(t) { // t: seconds since the animation started
        glyph.fill(32); ink.fill(0); bold.fill(0); paint.fill(0); own.fill(0);
        if (t >= LENGTH) return this; // over: nothing is left on the page
        const s = t * SPEED; // where that is in the story
        if (s >= T.thin) { thinning(s, t); return this; }
        const camZ = glide(s, DOLLY), p = pitch(s), cp = Math.cos(p), sp = Math.sin(p);
        for (let h = 0; h < H2; h++) { DY[h] = V[h] * cp + sp; DZ[h] = cp - V[h] * sp; }
        const lake = DY[H2 - 1] < 0; // is any water in view?
        DR.fill(0); DG.fill(0); DB.fill(0); DT.fill(1); MR.fill(0); MG.fill(0); MB.fill(0); MT.fill(1); TOP.fill(-1); FOG.fill(0); STIR.fill(0);
        for (const L of mists) mistColumns(L, t, camZ);
        for (const L of sheets) { pass(L, t, camZ, false); if (lake) pass(L, t, camZ, true); }
        const first = backdrop(s, t, camZ);
        drawBoat(s, camZ, cp, sp);
        if (s > T.close) closing(s, t);
        wakeLines(s, camZ, cp, sp);
        marks(t, camZ, p, first);
        for (let i = 0; i < N; i++) { const d = DITHER[i]; paint[i] = nearest(CR[i] + d, CG[i] + d, CB[i] + d); }
        return this;
      },
    };
  }

  // Play it on the stage. Resolves when it has finished. `seed` changes the
  // details, not the layout: the leaves and rock on the pillars, the cloud,
  // the pillars and temples off to the sides of a wide screen; `freezeAt`
  // holds one moment (in seconds) on screen instead of playing. Reduced
  // motion holds the opening view, the source image's framing.
  const film = { length: LENGTH, still: 1.1 / SPEED, createScene };
  return { play: (options) => AsciiStage.play(film, options), createScene };
})();
