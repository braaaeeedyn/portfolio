/*
 * Baijiu toast: an ASCII loading screen for the stage (ascii-stage.js).
 *
 *   <script src="ascii-stage.js"></script>
 *   <script src="baijiu-toast.js"></script>
 *   <script>BaijiuToast.play().then(showThePage);</script>
 *
 * Two friends sit at a table on a terrace high above the sea in the late
 * afternoon, seen from the side with the camera level at the height of their
 * cups. Each brings a small porcelain cup in from their side and the cups
 * clink in the middle. From there the film is in slow motion: the baijiu
 * leaps out of both cups, necks and breaks into drops, the drops arc over the
 * cups, and a few fly at the camera and land on the lens. They run down it in
 * streaks, and the water running down the lens carries the picture away with
 * it until the page underneath is all that is left.
 *
 * The whole film is a pure function of time: createScene().render(t) draws
 * the frame for second t, whatever was drawn before.
 */
const BaijiuToast = (() => {
  'use strict';
  const { code, clamp01, lerp, smooth, mulberry32, hash, noise } = AsciiStage;

  const LENGTH = 5; // seconds on screen

  // The story's timeline, in seconds at the pace it was written. It is played
  // SPEED times faster, so that on screen it takes LENGTH.
  const T = {
    reach: 0.2,             // they start to bring their cups in
    clink: 1.7,             // the lips of the cups meet
    wash: 6.15,             // the water on the lens starts carrying the picture down
    end: 7,
  };
  const SPEED = T.end / LENGTH;

  // From the clink on, the film is in slow motion. `after` is how much time has passed in the world
  // since the clink, in real seconds: a rush as the splash breaks out, then SLOW seconds for every
  // second of the story. Before the clink the story's seconds are the world's (`world`).
  const SLOW = 0.12, RUSH = 0.05, EASE = 0.12;
  const after = (s) => (s <= T.clink ? 0 : SLOW * (s - T.clink) + RUSH * (1 - Math.exp(-(s - T.clink) / EASE)));
  const world = (s) => (s <= T.clink ? s : T.clink + after(s));

  // Colours. `swatch` adds a run of them and gives the index of the first.
  const INK = ['#000000']; // 0 is never drawn: it means nothing there
  const swatch = (...colours) => INK.push(...colours) - colours.length;
  const SKY = swatch('#2b5ca8', '#3a6db6', '#4b7ec2', '#5f8fcb', '#74a0d2', '#8ab0d6', '#a0bed8', '#b6cad8', '#cad3d4', '#dcd8cc', '#e9d8bf', '#f1d4ae'); // from high overhead down to the haze on the horizon
  const CLOUD = swatch('#fbf3ea', '#ece0d6', '#d5c9cb', '#b9b0bf'); // lit to shaded
  const ISLE = swatch('#b3bfd0', '#9eacc2', '#8b9bb6', '#7788a8'); // far islands in the haze, lit and in shade; nearer ones, lit and in shade
  const SEA = swatch('#c3cdd0', '#a3b8c4', '#83a2b8', '#678dab', '#51799c', '#40688c', '#33597d', '#284b6c'); // from the horizon down toward the foot of the cliff
  const GLINT = swatch('#fff8e8', '#d8eef5');
  const WOOD = swatch('#170a08', '#251210', '#351a14', '#48241a', '#5e2f20', '#7a3f2a', '#9c5638'); // the table, from shade to its lit edge
  const GLOSS = swatch('#6f6670', '#958c96', '#b7b0b6'); // the sky in its lacquer
  const CUP = swatch('#4f5d78', '#6a7892', '#8693aa', '#a3aebf', '#bec7d3', '#d4dbe3', '#e6eaee', '#f4f5f4', '#ffffff'); // white porcelain, from shade to light
  const COBALT = swatch('#1b3a8a', '#3a5cae'); // the lines painted round each cup
  const SKIN = swatch('#c99f91', '#e0bfb1', '#efd5c8', '#f7e6dc', '#fdf3ee'); // pale skin, from shade to light
  const LINE = swatch('#a87c70'), LIP = swatch('#d4868e', '#bf7480'); // lids, nostrils and the mouth; the lips, lower and upper
  const HAIR = swatch('#141018', '#231c26', '#3a3242', '#5a5064'); // near black, its sheen, the light along its edge
  const GOLD = swatch('#8e621c', '#d09a36', '#f0c860');
  const CRIMSON = swatch('#34090f', '#521219', '#741b25', '#962531', '#b8343a', '#d9564a'); // the robe on the left, from shade to light
  const INDIGO = swatch('#0f1326', '#19203c', '#263156', '#364574', '#4c5e92', '#7486b8'); // the robe on the right
  const RED = swatch('#b02a33');
  const INNER = swatch('#aaa4a3', '#d8d2cd', '#f7f3ed'); // the white robe each wears underneath, at the neck and wrist
  const HAZE = swatch(...[0.16, 0.3, 0.48, 0.66].map((a) => `rgba(255,251,240,${a})`)); // glare, see-through

  // What every colour turns into seen through clear liquid: mixed part of the way to another colour,
  // then set to the nearest colour there is.
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const RGB = INK.slice(0, HAZE).map(hex);
  const nearest = (r, g, b) => {
    let best = 1, least = Infinity;
    for (let k = 1; k < HAZE; k++) {
      const dr = r - RGB[k][0], dg = g - RGB[k][1], db = b - RGB[k][2], d = 3 * dr * dr + 6 * dg * dg + db * db;
      if (d < least) { least = d; best = k; }
    }
    return best;
  };
  const through = (mix, r, g, b) => Uint8Array.from(INK, (_, k) => (!k || k >= HAZE ? k : nearest(lerp(RGB[k][0], r, mix), lerp(RGB[k][1], g, mix), lerp(RGB[k][2], b, mix))));
  const LIFT = [0.14, 0.32, 0.58].map((mix) => through(mix, 236, 246, 252)), DIM = through(0.38, 14, 22, 52); // the body of the liquid, its lit edge; its far edge

  // An ordered dither: thresholds from -0.5 to 0.5 in a 4 by 4 tile.
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((k) => (k + 0.5) / 16 - 0.5);
  const [DOT, TICK, STAR, BAR, DASH, LOW, WAVE] = code(".'*|-_~");

  // Light comes from the upper left and from in front. x is to the right, y up, z toward the camera.
  const unit = (x, y, z) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };
  const SUN = unit(-0.5, 0.55, 0.67), GLEAM = unit(SUN[0], SUN[1], SUN[2] + 1); // and halfway between it and the camera, where a shine shows

  // The set, in cup heights (a cup is about 8 cm tall), from the point where the two lips meet: x to
  // the right, y up. The camera is level, a little above the lips, so the horizon is at its height.
  const EYE = 0.45, DIST = 13;    // the camera's height, and how far it stands from the plane the two of them sit in
  const TABLE = -2.1, DEPTH = 2.4; // the table top in that plane, and how far it reaches toward the camera and away
  const FAR_EDGE = EYE + ((TABLE - EYE) * DIST) / (DIST + DEPTH), NEAR_EDGE = EYE + ((TABLE - EYE) * DIST) / (DIST - DEPTH);
  const SLAB = 0.42;              // how thick the near edge of the table top looks
  const TOP = 3.78, SPAN = 6.85;  // on a wide screen the frame runs from TOP above the lips down SPAN, from their hair to the near edge of the table
  const NARROW = 9.2;             // and it is never narrower than this: both faces stay in, the backs of their heads go off the sides

  // A cup, in units of its own height, from the middle of its lip.
  const LIP_R = 0.58, FOOT = 0.22, HEEL = 0.09, BAND = 0.83;
  const girth = (v) => { // how wide the cup is, v of the way up: a round bowl on a small foot
    if (v < HEEL) return FOOT;
    const w = (v - HEEL) / (1 - HEEL);
    return FOOT * 0.92 + (LIP_R - FOOT * 0.92) * (0.72 * (1 - (1 - w) ** 1.7) ** (1 / 1.7) + 0.28 * w);
  };
  const flare = (v) => (v < HEEL ? 0 : Math.min(2.5, (girth(Math.min(1, v + 0.01)) - girth(Math.max(HEEL, v - 0.01))) / 0.02));
  const TILT = 0.12;              // how far each cup tips toward the other as they meet, in radians
  const START = [-2.55, -0.95];   // where the middle of a lip starts, the cup held low by the chest (for the one on the left)

  // The two of them, drawn for the one on the left, facing right; the one on the right is the mirror
  // image. In cup heights from the middle of the head, unless said otherwise.
  const HEAD = [-3.55, 2.15], HIP = -3.4; // the middle of the head as they sit (from where the lips meet), and the height they lean in from
  const SKULL = [-0.08, 0.12, 1.1, 1.15]; // its middle and its radii across and up
  // The face in profile, [height, how far forward], from the top of the forehead down to under the chin.
  const FRONT = [[0.95, 0.5], [0.85, 0.72], [0.7, 0.88], [0.5, 0.97], [0.32, 1.0], [0.24, 1.02], [0.14, 0.98], [0.04, 1.02],
    [-0.1, 1.12], [-0.24, 1.24], [-0.3, 1.27], [-0.35, 1.23], [-0.4, 1.12], [-0.44, 1.06], [-0.5, 1.07], [-0.56, 1.1],
    [-0.61, 1.06], [-0.64, 1.04], [-0.68, 1.07], [-0.74, 1.05], [-0.8, 0.98], [-0.88, 0.99], [-0.98, 1.02], [-1.08, 1.0],
    [-1.16, 0.9], [-1.21, 0.72]];
  // Where the hair starts, [height, how far forward]: drawn back from the forehead and the temple, in
  // front of the ear, then behind it down to the nape.
  const HAIRLINE = [[1.05, 0.6], [0.92, 0.62], [0.78, 0.55], [0.6, 0.42], [0.4, 0.33], [0.15, 0.3], [-0.1, 0.27], [-0.3, 0.2],
    [-0.45, -0.25], [-0.7, -0.42], [-1.0, -0.5]];
  const jaw = (x) => lerp(-0.92, -1.22, clamp01((x + 0.05) / 0.8)); // the underside of the jaw, back from the chin
  const NECK = [-0.5, -0.8, 0.12, -0.98, 0.22, -1.5, 0.32, -2.0, -0.7, -1.95, -0.6, -1.3];
  // The body in its robe: its front and its back, [height, how far forward], below the line of the shoulders.
  const CHEST = [[-1.8, 0.45], [-2.15, 0.72], [-2.6, 0.92], [-3.2, 1.02], [-4.2, 1.0], [-7, 0.95]];
  const SPINE = [[-1.45, -0.7], [-1.85, -0.98], [-2.4, -1.22], [-3.2, -1.32], [-4.2, -1.26], [-7, -1.2]];
  const COLLAR = [-0.72, -1.42, -0.3, -1.6, 0.12, -1.78, 0.45, -1.95, 0.68, -2.3, 0.85, -2.75, 0.95, -3.1]; // the robe's crossed collar
  const UNDER = [-0.66, -1.3, -0.25, -1.47, 0.15, -1.64, 0.42, -1.8, 0.62, -2.12, 0.78, -2.55]; // and the white collar under it
  // The ponytail: tied high at the back of the head, it falls behind the head and down the back.
  // [across, up, half its width] from the band down to its end.
  const TAIL = [[-0.75, 0.98, 0.15], [-1.0, 1.2, 0.2], [-1.32, 1.22, 0.24], [-1.55, 0.92, 0.26], [-1.68, 0.4, 0.27],
    [-1.72, -0.25, 0.26], [-1.66, -0.95, 0.23], [-1.52, -1.6, 0.18], [-1.44, -2.2, 0.11], [-1.4, -2.65, 0.03]];
  const WHO = [ // the one on the left, and the one on the right, who sits a little taller
    { f: 1, robe: CRIMSON, trim: GOLD + 1, band: GOLD + 2, lift: 0, phase: 0.4 },
    { f: -1, robe: INDIGO, trim: INNER + 1, band: RED, lift: 0.12, phase: 2.1 },
  ];

  // The liquid. Each cup throws STRANDS tongues of baijiu up over its lip, fanning out from the point
  // where the lips met, and a sheet of liquid joins each tongue to the next, and the two innermost to
  // each other, so that together they rise as one crown. Every bit of a tongue left the lip at its own
  // moment in the first POUR seconds after the clink and then flew free, so where it is at any moment
  // can be worked out directly. The first out is the fastest and goes highest, so a tongue stretches as
  // it rises. The sheet tears from the top down over the seconds in TEAR; where it has torn, each tongue
  // necks at CUTS (0 is its tip, 1 the last of it to leave the lip) and parts there into drops, which fly
  // on along the arcs the tongues were taking.
  const STRANDS = 3, POUR = 0.05, CUTS = [0, 0.3, 0.62, 1], TEAR = [0.075, 0.215];
  const GRAVITY = 120; // in cup heights a second, every second

  // x along a table of [height, x] pairs that runs from the top down.
  const profile = (table, y) => {
    if (y >= table[0][0]) return table[0][1];
    for (let i = 1; i < table.length; i++) if (y >= table[i][0]) {
      const [y0, x0] = table[i - 1], [y1, x1] = table[i];
      return lerp(x1, x0, (y - y1) / (y0 - y1));
    }
    return table[table.length - 1][1];
  };
  // Whether a point is inside a polygon given as x, y, x, y, ...
  const inside = (poly, x, y) => {
    let hit = false;
    for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
      const xi = poly[i], yi = poly[i + 1], xj = poly[j], yj = poly[j + 1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  };
  // How far a point is from the stroke between two others, and (in `along`) how far along it, 0 to 1.
  let along = 0;
  const off = (x, y, x0, y0, x1, y1) => {
    const dx = x1 - x0, dy = y1 - y0;
    along = clamp01(((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy || 1e-9));
    return Math.hypot(x - x0 - dx * along, y - y0 - dy * along);
  };
  // How far a point is from a line through points given as x, y, x, y, ...
  const offLine = (pts, x, y) => {
    let best = Infinity;
    for (let i = 2; i < pts.length; i += 2) best = Math.min(best, off(x, y, pts[i - 2], pts[i - 1], pts[i], pts[i + 1]));
    return best;
  };

  function createScene({ cols, rows, aspect = 2, seed = 5 }) {
    const rand = mulberry32(seed), R = (a, b) => a + (b - a) * rand();
    const lines = rows * 2, cells = cols * rows, dots = cols * lines;
    const glyph = new Uint8Array(cells), ink = new Uint8Array(cells), bold = new Uint8Array(cells), veil = new Uint8Array(cells);
    const paint = new Uint8Array(dots);
    const back = new Uint8Array(dots), backGlyph = new Uint8Array(cells).fill(32), backInk = new Uint8Array(cells); // what never changes

    // The camera: U columns to a cup height, and the point where the lips meet at column X0, line Y0
    // (a line is half a row). A tall screen has room to spare above and below; most of it goes to the sky.
    const K = 2 / aspect, high = lines / K; // K: how many lines are as tall as a column is wide
    const U = Math.max(1.5, Math.min(high / SPAN, cols / NARROW));
    const spare = high / U - SPAN;
    const X0 = cols / 2, Y0 = (TOP + spare * 0.85) * U * K;
    const xAt = (c) => (c + 0.5 - X0) / U, yAt = (l) => (Y0 - l - 0.5) / (U * K);
    const tall = 1 + Math.min(0.6, spare * 0.08); // on a tall screen the splash is thrown higher, into the sky above

    // Paint every half cell in the box (in cup heights) the colour `shade(x, y, l, c)` gives it, if any.
    function fill(x0, y0, x1, y1, shade) {
      const c0 = Math.max(0, Math.floor(X0 + x0 * U)), c1 = Math.min(cols - 1, Math.ceil(X0 + x1 * U));
      const l0 = Math.max(0, Math.floor(Y0 - y1 * U * K)), l1 = Math.min(lines - 1, Math.ceil(Y0 - y0 * U * K));
      for (let l = l0; l <= l1; l++) {
        const y = yAt(l);
        for (let c = c0; c <= c1; c++) {
          const colour = shade(xAt(c), y, l, c);
          if (colour) paint[l * cols + c] = colour;
        }
      }
    }
    const mark = (c, r, ch, colour, heavy = 0) => {
      if (c < 0 || c >= cols || r < 0 || r >= rows) return;
      const i = r * cols + c;
      glyph[i] = ch; ink[i] = colour; bold[i] = heavy;
    };

    // ---- what is behind them, which never changes: the sky, far islands, the sea, and the table.
    // The sky and the sea are seen by angle, so the horizon looks the same on any screen and a taller
    // one shows more of the deep blue overhead.
    {
      const ridge = (x, far) => { // how high the islands stand above the horizon at x: none behind the cups
        const k = far ? noise(x * 0.34 + 7.3, seed) : noise(x * 0.7 + 2.1, seed + 9), peak = 1 - Math.abs(2 * noise(x * (far ? 0.9 : 1.6) + 4, seed + 3) - 1);
        return Math.max(0, (far ? 0.85 : 0.42) * (k - 0.35) * (0.7 + 0.5 * peak)) * smooth(1.2, 2.6, Math.abs(x));
      };
      // Clouds stand on the horizon far out to sea, lit on top; high up, on a tall screen, there are a
      // few wisps. The sky behind the cups is left clear for the splash.
      const bank = (x) => 0.12 + 0.95 * Math.max(0, noise(x * 0.42 + 3.3, seed + 5) - 0.42) * (0.6 + 0.6 * noise(x * 1.7, seed + 6)) * smooth(1.4, 3.2, Math.abs(x));
      for (let l = 0; l < lines; l++) {
        const y = yAt(l), e = y - EYE;
        for (let c = 0; c < cols; c++) {
          const x = xAt(c), i = l * cols + c, d = BAYER[(l & 3) * 4 + (c & 3)];
          let colour;
          if (e >= 0) {
            const near = ridge(x, false), far = ridge(x, true), top = bank(x);
            if (e < near) colour = ISLE + (ridge(x - 0.08, false) < ridge(x + 0.08, false) ? 2 : 3);
            else if (e < far) colour = ISLE + (ridge(x - 0.08, true) < ridge(x + 0.08, true) ? 0 : 1);
            else if (e < top) colour = CLOUD + (top - e < 0.09 ? 0 : (top - e) / top + d * 0.4 < 0.55 ? 1 : 2);
            else {
              colour = SKY + Math.max(0, Math.min(11, Math.round(11 * (1 - clamp01(e / 5.5) ** 0.55) + d)));
              for (let k = 0; k < 4; k++) { // wisps, one layer above another
                const wisp = Math.abs(e - 4.3 - 1.9 * k - 0.5 * noise(x * 0.2, seed + 7 + k)) / (0.24 * smooth(0.45, 0.8, noise(x * 0.3 + 9 + k * 5.1, seed + 8)) + 1e-6);
                if (wisp < 1 + d * 0.8) colour = CLOUD + (wisp < 0.5 ? 1 : 2);
              }
            }
          } else if (y > FAR_EDGE) colour = SEA + Math.max(0, Math.min(7, Math.round(7.4 * clamp01(-e / 2.6) ** 0.7 + d)));
          else if (y > NEAR_EDGE) { // the table top, dark lacquered wood: along its far edge it catches the sky
            const k = (y - NEAR_EDGE) / (FAR_EDGE - NEAR_EDGE), grain = noise(x * 0.45, y * 9 + 3);
            colour = k > 0.93 + d * 0.06 ? GLOSS + 1 : k > 0.8 + d * 0.12 ? GLOSS : WOOD + 3 + (grain > 0.64 ? 1 : grain < 0.3 ? -1 : 0) + (k > 0.5 ? 1 : 0);
          } else if (y > NEAR_EDGE - SLAB) colour = y > NEAR_EDGE - 0.6 / (U * K) ? WOOD + 6 : WOOD + 2; // its near edge, lit along the top
          else if (y > NEAR_EDGE - SLAB - 0.55) colour = y < NEAR_EDGE - SLAB - 0.45 ? WOOD + 4 : WOOD + 1; // the apron under it, with a bead along its foot
          else colour = Math.abs(Math.abs(x) - 3.9) < 0.22 ? WOOD + 2 : WOOD; // the shade under the table, and its legs
          back[i] = colour;
        }
      }
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { // ripples on the sea, where a whole cell is sea
        const top = back[r * 2 * cols + c], low = back[(r * 2 + 1) * cols + c], i = r * cols + c;
        if (top < SEA || top >= GLINT || low < SEA || low >= GLINT) continue;
        const h = hash(c >> 1, r);
        if (h < 0.22) { backGlyph[i] = h < 0.15 ? WAVE : DASH; backInk[i] = low - 2 >= SEA ? low - 2 : low + 1; }
        else if (h < 0.24) { backGlyph[i] = TICK; backInk[i] = GLINT + 1; }
      }
    }

    // ---- the two of them. Each is drawn in their own coordinates (x toward the other), and `f` turns
    // those into the picture's: 1 for the one on the left, -1 for the one on the right.

    // Where everything is for one of them at story time s, in their own coordinates: the middle of the
    // lip of their cup (cx, cy) and how far it tips toward the other; the middle of their head, their
    // shoulder, elbow and wrist; how far they lean in, and how far the tail of their hair swings.
    function pose(who, s) {
      const p = after(s), q = clamp01((s - T.reach) / (T.clink - T.reach)), bounce = 1 - Math.exp(-p / 0.05);
      const go = 0.55 * q * q * (3 - 2 * q) + 0.45 * q ** 1.6, up = 1 - (1 - q) ** 2.4; // the cup rises first, and is still moving when it meets the other
      const tilt = TILT * smooth(0.35, 1, q) - 0.04 * bounce, ct = Math.cos(tilt), st = Math.sin(tilt);
      const cx = lerp(START[0], -LIP_R * Math.cos(TILT), go) - 0.07 * bounce, cy = lerp(START[1], LIP_R * Math.sin(TILT), up) - 0.025 * bounce;
      const lean = 0.02 + 0.03 * smooth(0, 1, q) - 0.01 * bounce; // they lean in as they reach
      const hy = HEAD[1] + who.lift, hx = HEAD[0] + lean * (hy - HIP);
      const sy = hy - 2.3, sx = HEAD[0] - 0.22 + lean * (sy - HIP); // the shoulder
      const wx = cx - 1.15 * ct - 0.55 * st, wy = cy + 1.15 * st - 0.55 * ct; // the wrist, at the outer side of the cup
      // the elbow: where an upper arm and a forearm of these lengths meet, below the line from shoulder to wrist
      const A = 2.15, B = 1.95, d = Math.min(A + B - 0.01, Math.hypot(wx - sx, wy - sy));
      const angle = Math.atan2(wy - sy, wx - sx) - Math.acos(Math.max(-1, Math.min(1, (A * A + d * d - B * B) / (2 * A * d))));
      const ex = Math.max(sx - 0.5, sx + A * Math.cos(angle)), ey = sy + A * Math.sin(angle);
      const swing = 0.05 * Math.sin(2.3 * world(s) + who.phase) - 0.12 * Math.sin(Math.PI * q); // it lags as they lean in
      return { cx, cy, tilt, ct, st, hx, hy, sx, sy, ex, ey, wx, wy, lean, swing };
    }

    // Their head, neck and body, and the tail of their hair: the colour at (bx, by) from the middle of
    // the head (in their own coordinates, leaning with them), or 0. `d` dithers the shading.
    function figure(who, P, bx, by, d) {
      const f = who.f;
      // the tail of the hair, and the band that ties it
      let best = Infinity, at = 0, half = 0, ox = 0, oy = 0;
      for (let k = 1; k < TAIL.length; k++) {
        const [ax, ay, aw] = TAIL[k - 1], [bx2, by2, bw] = TAIL[k], sa = P.swing * ((k - 1) / 9) ** 1.5, sb = P.swing * (k / 9) ** 1.5;
        const dist = off(bx, by, ax + sa, ay, bx2 + sb, by2), w = lerp(aw, bw, along);
        if (dist - w < best) { best = dist - w; at = (k - 1 + along) / (TAIL.length - 1); half = w; ox = bx - lerp(ax + sa, bx2 + sb, along); oy = by - lerp(ay, by2, along); }
      }
      if (best < 0) {
        if (at > 0.03 && at < 0.1) return who.band;
        const lit = (f * ox * SUN[0] + oy * SUN[1]) / (half || 1);
        return lit > 0.5 ? HAIR + 2 : lit > -0.1 ? HAIR + 1 : HAIR;
      }
      // the ear, which the hair is drawn back from
      const ex = (bx - 0.04) / 0.15, ey = (by + 0.2) / 0.26;
      if (ex * ex + ey * ey < 1) {
        const fold = ((bx - 0.07) / 0.08) ** 2 + ((by + 0.2) / 0.16) ** 2;
        return fold > 0.55 && fold < 1 && bx > 0.03 ? LINE : SKIN + 2;
      }
      // the head
      const sx = (bx - SKULL[0]) / SKULL[2], sy = (by - SKULL[1]) / SKULL[3], r2 = sx * sx + sy * sy;
      const front = profile(FRONT, by), face = by < 0.95 && by > -1.38 && bx > -0.2 && bx < front && by > jaw(bx);
      const edge = profile(HAIRLINE, by);
      if ((face || r2 <= 1) && bx >= edge) return skin(f, bx, by, front, d);
      if (r2 <= 1.07 && by > -0.95) { // hair, lit across the round of the head
        const nz = Math.sqrt(Math.max(0, 1 - r2)), lit = f * sx * SUN[0] + sy * SUN[1] + nz * SUN[2];
        return r2 > 0.9 && lit > 0.45 ? HAIR + 3 : lit > 0.72 ? HAIR + 2 : lit > 0.35 ? HAIR + 1 : HAIR;
      }
      // the collars, the neck, and the body in its robe
      if (offLine(UNDER, bx, by) < 0.075) return INNER + (f > 0 ? 1 : 2);
      if (offLine(COLLAR, bx, by) < 0.085) return who.trim;
      if (inside(NECK, bx, by)) return SKIN + (by > jaw(bx) - 0.16 ? 0 : 1) + (f < 0 && bx > 0.1 ? 1 : 0);
      const top = lerp(-1.45, -1.8, clamp01((bx + 0.7) / 1.15)), front2 = profile(CHEST, by), spine = profile(SPINE, by);
      if (by > top || bx > front2 || bx < spine) return 0;
      const across = (2 * (bx - spine)) / (front2 - spine) - 1, lit = f * across * SUN[0] * 0.9 + Math.sqrt(1 - across * across * 0.8) * SUN[2];
      return who.robe + Math.max(0, Math.min(5, Math.round(1.2 + lit * 3.2 + d * 0.5)));
    }

    // Their skin: lit across the round of the head, with the eye, brow, nostril, mouth and lips drawn in.
    function skin(f, bx, by, front, d) {
      if (off(bx, by, 0.64, 0.3, 0.95, 0.28) < 0.04) return HAIR + 1;  // brow
      if (off(bx, by, 0.7, 0.12, 0.94, 0.09) < 0.035) return HAIR;     // the upper lid, dark with lashes
      if (bx > 0.83 && bx < 0.94 && by < 0.085 && by > 0.02) return bx > 0.89 ? INNER + 2 : HAIR + 1; // the eye, open: its white and the dark of it
      if (((bx - 1.1) / 0.06) ** 2 + ((by + 0.37) / 0.035) ** 2 < 1) return LINE; // nostril
      if (off(bx, by, 0.9, -0.66, 1.04, -0.64) < 0.03) return LINE;            // the line of the mouth
      if (by < -0.52 && by > -0.73 && bx > front - 0.08) return by > -0.64 ? LIP + 1 : LIP;
      const nx = (bx - 0.15) / 1.3, ny = (by + 0.1) / 1.5, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      let tone = 1.9 + 3 * (f * nx * SUN[0] + ny * SUN[1] + nz * SUN[2]); // pale even where the light leaves it
      if (by - jaw(bx) < 0.08 && bx > -0.1) tone -= 1.1;                 // the shade under the jaw
      if (by < -0.4 && by > -0.48 && bx > 0.95) tone -= 0.8;             // under the nose
      return SKIN + Math.max(0, Math.min(4, Math.floor(tone + d * 0.3)));
    }

    // The arm that holds the cup, in its wide sleeve: the upper arm, the forearm, and the cloth that
    // hangs from the forearm down to the table. The colour at (x, y) in their own coordinates, or 0.
    function sleeve(who, P, x, y, d) {
      const robe = who.robe, f = who.f;
      const up = off(x, y, P.sx, P.sy, P.ex, P.ey), r1 = lerp(0.5, 0.46, along);
      const fore = off(x, y, P.ex, P.ey, P.wx, P.wy), t = along, r2 = lerp(0.46, 0.38, t);
      const len = Math.hypot(P.wx - P.ex, P.wy - P.ey), past = ((x - P.ex) * (P.wx - P.ex) + (y - P.ey) * (P.wy - P.ey)) / (len * len); // how far along the forearm, unclamped
      if (past > 1 + 0.02) return 0; // the cuff is cut square at the wrist
      if (fore < r2 || up < r1) {
        const cuff = past > 1 - 0.13 / len;
        if (cuff) return who.trim;
        // lit along its top, toward the light
        const top = up < r1 ? (y - lerp(P.sy, P.ey, along)) / r1 : (y - lerp(P.ey, P.wy, t)) / r2;
        return robe + Math.max(0, Math.min(5, Math.round(2.4 + top * 1.4 - f * 0.3 + d * 0.5)));
      }
      // the hanging cloth: below the forearm, as deep as the sleeve's bag hangs, resting on the table
      if (x < Math.min(P.ex, P.wx) - 0.35 || x > Math.max(P.ex, P.wx)) return 0;
      const k = clamp01((x - P.ex + 0.35) / (P.wx - P.ex + 0.35)), yf = lerp(P.ey, P.wy, clamp01((x - P.ex) / (P.wx - P.ex || 1e-9)));
      const depth = 0.45 + 1.25 * Math.sin(Math.PI * (0.1 + 0.84 * k)) ** 0.7;
      if (y > yf || yf - y > depth || y < TABLE) return 0;
      const fold = Math.abs(Math.sin((x - P.ex) * 5.2 + y * 1.2)), low = (yf - y) / depth;
      if (k > 0.97) return who.trim; // the lower edge of the cuff
      return robe + Math.max(0, Math.min(4, Math.round(2.2 - low * 1.4 - (fold < 0.25 ? 1 : 0) + d * 0.5)));
    }

    // Their cup and the hand round it, in the cup's own coordinates: u across toward the other cup, w up
    // its axis from the middle of its lip. The colour at (u, w), or 0. `peek` is how far the camera
    // looks down onto the lip: a level circle there is an ellipse that flat.
    function cupAndHand(who, P, u, w, d, peek) {
      const f = who.f;
      // the hand: the back of it at the outer side of the cup, fingers round the front, thumb on top
      const palm = ((u + 0.82) / 0.33) ** 2 + ((w + 0.5) / 0.3) ** 2;
      if (palm < 1) return SKIN + Math.max(0, Math.min(4, Math.round(2.3 + (w + 0.5) * 3 - f * (u + 0.82) * 1.5 + d)));
      if (off(u, w, -0.82, -0.5, -1.15, -0.55) < 0.19) return SKIN + 1; // the wrist
      if (off(u, w, -0.78, -0.27, -0.56, -0.12) < 0.075) return SKIN + (w > -0.18 ? 4 : 3); // the thumb
      for (let k = 0; k < 3; k++) {
        const fw = -0.42 - 0.165 * k, edge = -girth(1 + fw);
        if (off(u, w, edge - 0.05, fw, edge + 0.44 - 0.06 * k, fw + 0.02) < 0.074) return SKIN + (w > fw + 0.01 ? 3 : 1);
      }
      // the porcelain
      const v = 1 + w;
      if (v < 0 || v > 1 + LIP_R * peek) return 0;
      if ((u / LIP_R) ** 2 + (w / (LIP_R * peek || 1e-9)) ** 2 <= 1 && w > -LIP_R * peek * 0.4) { // into the cup, past the near lip: the far wall, and the baijiu mirroring the sky
        const pool = girth(0.93) - 0.04;
        return (u / pool) ** 2 + ((w + 0.07) / (pool * peek || 1e-9)) ** 2 <= 1 ? SKY + 9 : CUP + 5;
      }
      const g = girth(v);
      if (Math.abs(u) > g || v > 1) return 0;
      if (Math.abs(w - (BAND - 1 - peek * Math.sqrt(Math.max(0, g * g - u * u)))) < 0.55 / (U * K) && Math.abs(u) < g - 0.02) return COBALT + (f * u < 0 ? 1 : 0);
      if (Math.abs(v - 0.2) < 0.4 / (U * K) && Math.abs(u) < g - 0.02) return COBALT + (f * u < 0 ? 1 : 0);
      const nx = u / g, nz = Math.sqrt(Math.max(0, 1 - nx * nx)), m = flare(v), k = 1 / Math.sqrt(1 + m * m);
      const xl = (nx * P.ct - m * P.st) * k, yl = (-nx * P.st - m * P.ct) * k, z = nz * k, xw = f * xl; // which way the surface faces
      const lit = Math.max(0, xw * SUN[0] + yl * SUN[1] + z * SUN[2]), gloss = Math.max(0, xw * GLEAM[0] + yl * GLEAM[1] + z * GLEAM[2]) ** 40;
      if (gloss > 0.5) return CUP + 8;
      return CUP + Math.max(0, Math.min(8, Math.floor((0.15 + 0.9 * lit) * 9 + d * 0.8)) - (v < HEEL ? 1 : 0));
    }

    function person(who, s, layer) {
      const P = pose(who, s), f = who.f, flip = (x0, x1) => (f > 0 ? [x0, x1] : [-x1, -x0]);
      if (layer === 0) { // head and body
        const [a, b] = flip(P.hx - 1.95, P.hx + 1.45);
        fill(a, TABLE, b, P.hy + 1.6, (x, y, l, c) => {
          const lx = f * x, bx = lx - HEAD[0] - P.lean * (y - HIP), by = y - P.hy;
          return figure(who, P, bx, by, BAYER[(l & 3) * 4 + (c & 3)]);
        });
      } else if (layer === 1) { // the sleeve
        const [a, b] = flip(Math.min(P.sx, P.ex, P.wx) - 0.9, Math.max(P.sx, P.ex, P.wx) + 0.6);
        fill(a, TABLE, b, P.sy + 0.6, (x, y, l, c) => sleeve(who, P, f * x, y, BAYER[(l & 3) * 4 + (c & 3)]));
      } else { // the cup and the hand
        const peek = Math.max(0.02, (EYE - P.cy) / DIST) * 1.6; // a little more than true, so that a full cup shows it is full
        const [a, b] = flip(P.cx - 1.45, P.cx + 0.75);
        fill(a, P.cy - 1.15, b, P.cy + 0.25, (x, y, l, c) => {
          const dx = f * x - P.cx, dy = y - P.cy, u = dx * P.ct - dy * P.st, w = dx * P.st + dy * P.ct;
          return cupAndHand(who, P, u, w, BAYER[(l & 3) * 4 + (c & 3)], peek);
        });
      }
    }

    // ---- the liquid in the air. Every bit of it is a round tube or ball, so at each half cell it covers
    // it is known how thick it is there (`wet`, toward the camera), which way its surface faces (nx, ny)
    // and how big the tube or ball is (`rad`; 0 for the thin sheet): it can be lit, and seen through.
    const wet = new Float32Array(dots), nx = new Float32Array(dots), ny = new Float32Array(dots), rad = new Float32Array(dots);
    const scene = new Uint8Array(dots); // the picture behind the liquid
    const strands = [];
    for (const side of [-1, 1]) for (let k = 0; k < STRANDS; k++) {
      const rise = (2.3 - 0.45 * k) * tall * R(0.88, 1.08), lean = 0.03 + 0.2 * k + R(-0.03, 0.03); // how high its tip goes, and how far from straight up (outward) it leaves
      strands.push({
        side, lean, root: 0.05 + 0.13 * k + R(-0.015, 0.015), thick: R(0.1, 0.12) * (1 - 0.08 * k),
        speed: Math.sqrt(2 * GRAVITY * rise) / Math.cos(lean),
        parts: CUTS.slice(1).map((u) => lerp(TEAR[0], TEAR[1], u) + R(-0.012, 0.004)), // when it parts at each cut: as the tear reaches it
      });
    }
    const SHEETS = []; // the pairs of tongues a sheet joins
    for (let k = 0; k + 1 < STRANDS; k++) SHEETS.push([k, k + 1], [STRANDS + k, STRANDS + k + 1]);
    SHEETS.push([0, STRANDS]);
    const spray = Array.from({ length: 4 }, () => { // fine drops thrown off as the lips meet, slowed by the air
      const a = R(-1.3, 1.3), v = R(9, 20);
      return { vx: Math.sin(a) * v, vy: Math.cos(a) * v, drag: R(7, 14), r: R(0.035, 0.055) };
    });

    // Where the bit of a tongue that left the lip at `when` is, p seconds after the clink, and how fast it
    // is going: in `at`. False if it has not left yet, or has fallen back into a cup or past the table.
    const at = [0, 0, 0, 0];
    function spot(st, when, p) {
      const age = p - when;
      if (age < 0) return false;
      const k = when / POUR, v = st.speed * (1 - 0.62 * k ** 0.8), a = st.side * (st.lean + 0.15 * k);
      at[0] = st.side * st.root + Math.sin(a) * v * age; at[1] = Math.cos(a) * v * age - 0.5 * GRAVITY * age * age;
      at[2] = Math.sin(a) * v; at[3] = Math.cos(a) * v - GRAVITY * age;
      return at[1] > TABLE && (at[1] > -0.04 || Math.abs(at[0]) > 1.15);
    }
    // A tube of liquid from one point to another, its radius going from r0 to r1 (cup heights), rounded at
    // both ends: never thinner than a half cell. Where tubes cross, the one nearer the camera shows.
    function stroke(x0, y0, r0, x1, y1, r1) {
      const least = 0.6 / U, reach = Math.max(r0, r1, least), dx = x1 - x0, dy = y1 - y0;
      const c0 = Math.max(0, Math.floor(X0 + (Math.min(x0, x1) - reach) * U)), c1 = Math.min(cols - 1, Math.ceil(X0 + (Math.max(x0, x1) + reach) * U));
      const l0 = Math.max(0, Math.floor(Y0 - (Math.max(y0, y1) + reach) * U * K)), l1 = Math.min(lines - 1, Math.ceil(Y0 - (Math.min(y0, y1) - reach) * U * K));
      for (let l = l0; l <= l1; l++) {
        const y = yAt(l);
        for (let c = c0; c <= c1; c++) {
          const x = xAt(c), d = off(x, y, x0, y0, x1, y1), r = Math.max(least, lerp(r0, r1, along)), i = l * cols + c;
          if (d >= r || r * r - d * d <= wet[i] * wet[i]) continue;
          wet[i] = Math.sqrt(r * r - d * d); nx[i] = (x - x0 - dx * along) / r; ny[i] = (y - y0 - dy * along) / r; rad[i] = r;
        }
      }
    }
    // The thin sheet of liquid over the triangle between three points.
    function sheet(ax, ay, bx, by, cx, cy) {
      const c0 = Math.max(0, Math.floor(X0 + Math.min(ax, bx, cx) * U)), c1 = Math.min(cols - 1, Math.ceil(X0 + Math.max(ax, bx, cx) * U));
      const l0 = Math.max(0, Math.floor(Y0 - Math.max(ay, by, cy) * U * K)), l1 = Math.min(lines - 1, Math.ceil(Y0 - Math.min(ay, by, cy) * U * K));
      for (let l = l0; l <= l1; l++) {
        const y = yAt(l);
        for (let c = c0; c <= c1; c++) {
          const x = xAt(c), i = l * cols + c, e0 = (bx - ax) * (y - ay) - (by - ay) * (x - ax), e1 = (cx - bx) * (y - by) - (cy - by) * (x - bx), e2 = (ax - cx) * (y - cy) - (ay - cy) * (x - cx);
          if (!wet[i] && ((e0 >= 0 && e1 >= 0 && e2 >= 0) || (e0 <= 0 && e1 <= 0 && e2 <= 0))) { wet[i] = 1e-4; rad[i] = 0; }
        }
      }
    }
    // A drop of radius r: drawn out behind it along its path just after it parts, rounding up as it flies.
    function drop(x, y, vx, vy, r, since) {
      const v = Math.hypot(vx, vy) || 1, tail = r * (0.4 + 1.8 * Math.exp(-since / 0.03));
      stroke(x - (vx / v) * tail, y - (vy / v) * tail, r * 0.3, x, y, r);
    }

    // The liquid in the air, p seconds after the clink.
    function liquid(p) {
      wet.fill(0);
      const N = 16, out = Math.min(1, p / POUR), torn = clamp01((p - TEAR[0]) / (TEAR[1] - TEAR[0])); // how much of each tongue has left the lip, and how far down the sheets have torn
      for (const st of strands) {
        let cut = 0; // how many of its cuts have parted
        while (cut < st.parts.length && p >= st.parts[cut]) cut++;
        for (let j = 0; j < cut; j++) { // the drops it has parted into
          if (!spot(st, ((CUTS[j] + CUTS[j + 1]) / 2) * POUR, p)) continue;
          drop(at[0], at[1], at[2], at[3], st.thick * Math.sqrt((CUTS[j + 1] - CUTS[j]) * 8) * (j ? 1 : 1.15), p - st.parts[j]);
        }
        const from = CUTS[cut]; // and what is still whole: thinning as it stretches, necking where it will part next
        if (from >= out) continue;
        let x0 = 0, y0 = 0, r0 = -1;
        for (let i = 0; i <= N; i++) {
          const u = lerp(from, out, i / N);
          if (!spot(st, u * POUR, p)) { r0 = -1; continue; }
          let r = (st.thick * (1 + 0.9 * Math.exp(-(u - from) / 0.05))) / Math.sqrt(1 + (p - u * POUR) / 0.08); // with a bead at its end
          for (let j = cut; j < st.parts.length; j++) r *= 1 - 0.8 * smooth(st.parts[j] - 0.04, st.parts[j], p) * Math.exp(-(((u - CUTS[j + 1]) / 0.06) ** 2));
          if (r0 >= 0) stroke(x0, y0, r0, at[0], at[1], r);
          x0 = at[0]; y0 = at[1]; r0 = r;
        }
      }
      if (torn < out) for (const [a, b] of SHEETS) { // the sheets, below the tear, with a rim along it
        const A = strands[a], B = strands[b];
        for (let i = 0; i < 8; i++) {
          const u0 = lerp(torn, out, i / 8) * POUR, u1 = lerp(torn, out, (i + 1) / 8) * POUR;
          if (!spot(A, u0, p)) continue;
          const ax = at[0], ay = at[1];
          if (!spot(A, u1, p)) continue;
          const bx = at[0], by = at[1];
          if (!spot(B, u1, p)) continue;
          const cx = at[0], cy = at[1];
          if (!spot(B, u0, p)) continue;
          sheet(ax, ay, bx, by, cx, cy); sheet(ax, ay, cx, cy, at[0], at[1]);
          if (!i) stroke(ax, ay, 0.045, at[0], at[1], 0.045);
        }
      }
      for (const d of spray) {
        const age = p - 0.002, k = (1 - Math.exp(-d.drag * age)) / d.drag, x = d.vx * k, y = (d.vy + GRAVITY / d.drag) * k - (GRAVITY * age) / d.drag;
        if (age > 0 && y > -0.04) stroke(x, y, d.r, x, y, d.r);
      }
      // How clear liquid looks. Where it ends, it is bright on the side toward the light and dark on the
      // other, where it bends the light away, and a thread is bright all along. Inside, the thin sheet
      // only brightens what is behind it a little; a tube or a ball shows the picture behind it upside
      // down and drawn in, as a lens does, and the sun shines off it where its surface faces halfway
      // between the sun and the camera.
      scene.set(paint);
      for (let l = 0, i = 0; l < lines; l++) for (let c = 0; c < cols; c++, i++) {
        if (!wet[i]) continue;
        const under = scene[i], w = c > 0 && !wet[i - 1], e = c < cols - 1 && !wet[i + 1], n = l > 0 && !wet[i - cols], s = l < lines - 1 && !wet[i + cols];
        if (w || e || n || s) {
          const facing = (w ? 0.55 : 0) - (e ? 0.55 : 0) + (n ? 0.85 : 0) - (s ? 0.85 : 0);
          paint[i] = facing > 0.3 ? GLINT : facing < -0.3 ? DIM[under] : LIFT[2][under];
          continue;
        }
        const r = rad[i] * U, a = nx[i], b = ny[i], z = Math.sqrt(Math.max(0, 1 - a * a - b * b));
        if (!r) paint[i] = LIFT[0][under];
        else if (a * GLEAM[0] + b * GLEAM[1] + z * GLEAM[2] > 0.93) paint[i] = GLINT;
        else paint[i] = LIFT[1][scene[Math.min(lines - 1, Math.max(0, l + Math.round(b * r * K * 1.4))) * cols + Math.min(cols - 1, Math.max(0, c - Math.round(a * r * 1.4)))]];
      }
      for (let r = 0, i = 0; r < rows; r++) for (let c = 0; c < cols; c++, i++) { // no mark shows through the liquid
        if (glyph[i] > 32 && (wet[r * 2 * cols + c] || wet[(r * 2 + 1) * cols + c])) glyph[i] = 32;
      }
    }

    // The clink itself: a glint where the lips meet, and a moment of glare round it.
    function spark(s) {
      const k = (s - T.clink) / 0.3;
      if (k < 0 || k >= 1) return;
      const c = Math.floor(X0), r = Math.floor(Y0 / 2), reach = 1 + Math.round(2 * Math.sqrt(k)), colour = k < 0.5 ? CUP + 8 : GLINT + 1;
      mark(c, r, STAR, CUP + 8, 1);
      for (let j = Math.max(1, reach - 2); j <= reach; j++) {
        mark(c - j * 2, r, DASH, colour, 1); mark(c + j * 2, r, DASH, colour, 1);
        mark(c, r - j, BAR, colour, 1); mark(c, r + j, BAR, colour, 1);
      }
      const glare = 0.6 * U * (1 - 0.4 * k);
      for (let rr = Math.max(0, Math.floor(r - glare / aspect)); rr <= Math.min(rows - 1, Math.ceil(r + glare / aspect)); rr++) {
        for (let cc = Math.max(0, Math.floor(c - glare)); cc <= Math.min(cols - 1, Math.ceil(c + glare)); cc++) {
          const level = Math.round((1 - Math.hypot(cc - c, (rr - r) * aspect) / glare) * (1 - k) * 4.4);
          if (level > 0) veil[rr * cols + cc] = HAZE + Math.min(3, level - 1);
        }
      }
    }

    return {
      cols, rows, palette: INK, glyph, ink, bold, paint, veil,
      render(t) { // t: seconds since the film started
        glyph.set(backGlyph); ink.set(backInk); bold.fill(0); veil.fill(0);
        if (t >= LENGTH) { glyph.fill(32); paint.fill(0); return this; } // over: an empty frame, so the page shows
        const s = Math.max(0, t) * SPEED;
        paint.set(back);
        for (let layer = 0; layer < 3; layer++) for (const who of WHO) person(who, s, layer);
        for (let i = 0; i < cells; i++) { // the scene's marks show only where the background still does
          if (glyph[i] === 32) continue;
          const r = (i / cols) | 0, c = i % cols;
          if (paint[r * 2 * cols + c] !== back[r * 2 * cols + c] || paint[(r * 2 + 1) * cols + c] !== back[(r * 2 + 1) * cols + c]) glyph[i] = 32;
        }
        if (s > T.clink) liquid(after(s));
        spark(s);
        if (s > T.wash) { // for now: the picture is wiped away from the top
          const edge = ((s - T.wash) / (T.end - T.wash)) * lines * 1.05;
          for (let l = 0; l < Math.min(lines, edge); l++) paint.fill(0, l * cols, (l + 1) * cols);
          for (let r = 0; r < Math.min(rows, edge / 2); r++) { glyph.fill(32, r * cols, (r + 1) * cols); veil.fill(0, r * cols, (r + 1) * cols); }
        }
        return this;
      },
    };
  }

  const film = { length: LENGTH, still: 1.9, createScene };
  return { play: (options) => AsciiStage.play(film, options), createScene };
})();
