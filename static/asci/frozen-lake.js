/*
 * The frozen lake: an ASCII loading screen.
 *
 *   <script src="ascii-stage.js"></script>
 *   <script src="frozen-lake.js"></script>
 *   <script>FrozenLake.play().then(showThePage);</script>
 *
 * Night, and a frozen lake under a full moon. Someone in white robes sits on
 * the ice with their back to us, long black hair down the middle of the back,
 * facing a waterfall that drops from a cliff of pines into mist. A tall dark
 * cliff stands at the left and a huge old tree in pale blossom spreads over
 * the right. Fine snow falls. One petal falls from the tree and lands on the
 * ice a body's length in front of the figure; a ring of pale light spreads
 * from it across the ice, lighting the cracks as it passes, and fades at the
 * shores. The camera tilts up and a little to the left until the moon is in
 * the middle of the frame, with blossom along its right edge. Then the snow
 * thickens into a flurry that carries the picture down and away, to show the
 * page. Five seconds (LENGTH, below).
 *
 * The world is painted once, in createScene, as two layers larger than the
 * screen: the sky, with the moon, the stars and the far mountains; and the
 * ground, everything from the cliffs to the ice. The tilt slides both past
 * the screen, the ground a little faster than the sky, as if the camera rose
 * a little as it tilted, so the figure leaves through the bottom as the moon
 * reaches the middle. What moves is drawn over them in closed form, so
 * render(t) is a pure function of time.
 */
const FrozenLake = (() => {
  'use strict';
  const { code, clamp01, lerp, smooth, mulberry32, hash, noise } = AsciiStage;

  // The story's timeline, in the seconds of the user's description.
  const T = {
    petal: 1.7,  // one petal lets go of the tree (the description's 2.5, brought forward so that the fall is slow enough to follow)
    land: 4.0,   // it touches the ice, and a ring of light starts out from it
    ring: 6.4,   // the ring has reached the far shore and faded
    tilt: 6.5,   // the camera starts to tilt up
    moon: 9.5,   // the moon is in the middle of the frame
    flurry: 9.8, // the snow starts to thicken
    sweep: 10.2, // and the flurry carries the picture away, from the top down
    end: 11.2,
  };
  // It is played faster than that: LENGTH seconds on screen, SPEED times the story's pace.
  const LENGTH = 5, SPEED = T.end / LENGTH;

  // The scene is laid out in frame heights, the height of the source image's
  // frame on a wide screen: u across from the figure's middle, v down from the
  // top of that frame. The ice is a plane seen from just above it; depth on it
  // is 1 where the figure sits, and a point (X, Z) on it is at u = X / Z.
  const WIDE = 1.25;      // a tall screen shows this many frame heights across: the moon, the figure and the tree
  const HORIZON = 0.6;    // eye level
  const SEAT = 0.76;      // where the figure sits on the ice
  const FIGURE = 0.24;    // the figure's height
  const MOON = [-0.374, 0.12, 0.055]; // the moon: across, down from the top of the screen (in screen heights, so that a tall screen has sky above it), and its radius
  const LAND = [-0.225, 1.45]; // where the petal lands, on the ice: a body's length beyond the figure, on the way to the waterfall
  const RHO = 2.75;       // how far the ring of light spreads, on the ice: from there to the far shore
  const FALLS = [[-0.45, -0.395], [-0.375, -0.335]]; // the waterfall's two streams, from and to
  const FOOT = [-0.39, 0.632]; // where they meet the lake, in the mist
  const FLOW = 9;         // rows a second the falling water's streaks move
  const CLOUD_DRIFT = 0.02; // frame heights a second the clouds by the moon drift right

  // The tree, drawn by hand: runs of [u, v, width]. The trunk, its roots, and
  // four great limbs from the fork. Boughs and twigs are grown from the limbs.
  const TRUNK = [[0.4, 0.73, 0.17], [0.38, 0.66, 0.125], [0.36, 0.58, 0.1], [0.35, 0.5, 0.09], [0.355, 0.445, 0.085]];
  const ROOTS = [
    [[0.335, 0.705, 0.05], [0.255, 0.722, 0.03], [0.175, 0.73, 0.012]],
    [[0.46, 0.7, 0.06], [0.55, 0.718, 0.035], [0.65, 0.728, 0.012]],
    [[0.41, 0.715, 0.05], [0.45, 0.742, 0.024]],
  ];
  const LIMBS = [
    [[0.355, 0.45, 0.07], [0.27, 0.4, 0.05], [0.16, 0.365, 0.038], [0.04, 0.335, 0.026], [-0.07, 0.318, 0.016], [-0.17, 0.32, 0.008]], // reaching left, over the figure
    [[0.345, 0.45, 0.06], [0.29, 0.34, 0.045], [0.24, 0.22, 0.034], [0.2, 0.08, 0.025], [0.18, -0.1, 0.016], [0.21, -0.36, 0.008]],
    [[0.365, 0.445, 0.06], [0.41, 0.31, 0.045], [0.43, 0.15, 0.033], [0.47, -0.02, 0.023], [0.52, -0.26, 0.014], [0.58, -0.5, 0.008]],
    [[0.385, 0.47, 0.055], [0.49, 0.41, 0.04], [0.6, 0.355, 0.03], [0.73, 0.322, 0.02], [0.89, 0.305, 0.01]], // reaching right
  ];
  // The lower edge of the crown of blossom, [u, v]: sprays hang low beside the figure, high over the trunk.
  const HEM = [[-0.19, 0.33], [-0.12, 0.41], [-0.04, 0.44], [0.06, 0.46], [0.14, 0.52], [0.22, 0.52], [0.28, 0.45], [0.34, 0.38], [0.48, 0.34], [0.7, 0.37], [0.9, 0.4], [3, 0.42]];
  // The figure seen from behind, [down from the top of the head, half width], in its heights:
  // round shoulders, wide sleeves hanging straight, and the robe spread on the ice.
  const OUTLINE = [[0.2, 0], [0.215, 0.08], [0.24, 0.15], [0.28, 0.2], [0.34, 0.225], [0.55, 0.245], [0.7, 0.27], [0.8, 0.32], [0.88, 0.4], [0.95, 0.5], [1, 0.53]];
  const SEAS = [[-0.35, -0.32, 0.3], [0.08, -0.4, 0.2], [0.32, -0.06, 0.24], [-0.12, 0.08, 0.22], [-0.52, 0.22, 0.17], [0.22, 0.45, 0.15]]; // the moon's seas: where on its face (in its radii) and how big
  // Thin clouds beside the moon: [across, down from it, half length, half thickness, slope], in frame heights.
  const CLOUDS = [[0.15, 0.03, 0.12, 0.022, 0.5], [0.22, 0.13, 0.1, 0.03, 0.3], [-0.16, 0.1, 0.12, 0.02, -0.15], [0.0, 0.2, 0.14, 0.025, 0.1], [-0.2, -0.06, 0.09, 0.018, 0.2]];
  // Snow at three depths, near first: [rows a second it falls, rows between flakes in a column, chance of one]
  const FLAKES = [[6.5, 15, 0.22], [4.2, 9, 0.28], [2.6, 7, 0.32]];

  // Colours. Each ramp runs the way its comment reads, and gives the index of its first colour.
  const PALETTE = ['#000000']; // 0 is never drawn: it means nothing there
  const ramp = (...colours) => PALETTE.push(...colours) - colours.length;
  const SKY = ramp('#020309', '#03050b', '#04070f', '#060a15', '#080d1b', '#0b1122', '#0e162a', '#121b33', '#17223d', '#1d2a48',
    '#273658', '#35476e', '#4b5f8a', '#6d82ae'); // from the top of the sky down to the haze on the horizon; then on into the moon's halo
  const MOONS = ramp('#f7f9fd', '#dee4ef', '#b8c1d3', '#939db3'); // its face, its limb, its seas, their depths
  const STARS = ramp('#3d4a6c', '#7183ad', '#c1cdec', '#ffffff'); // faint to bright
  const CLOUD = ramp('#0a0e1c', '#141a2e', '#252e49', '#3e4a6d'); // against the halo, against the dark, edges, edges by the moon
  const PEAK = ramp('#111a2f', '#19233e', '#253354', '#3b4d75', '#5b6f9c'); // far mountains: shade, face, moonlit face, snow in shade, snow
  const HAZE = ramp('#212c48', '#2b3958', '#37476a'); // the haze at their feet, thickening down to the far shore
  const ROCK = ramp('#020307', '#05070d', '#0a0e18', '#121a29', '#20293f'); // cliffs and boulders, deepest shadow to the edges the moon catches
  const SNOW = ramp('#4c5a7d', '#8493b6', '#c3cfe7', '#edf2fb'); // lying snow, in shade to moonlit
  const PINE = ramp('#020308', '#060912', '#0d1424'); // shade, needles, needles toward the moon
  const FALL = ramp('#f1f5fd', '#c5d1ea', '#8fa0c4', '#5a6b92'); // the waterfall, its heart to its edges
  const ICE = ramp('#1c2744', '#17213a', '#121a30', '#0e1526', '#0a0f1d', '#070b15', '#04060e'); // the lake, from the far shore to the near edge
  const MIRROR = ramp('#253050', '#334163', '#4a5a81', '#6a7ba3'); // things mirrored in it, dim to bright
  const BLUSH = ramp('#2b273e', '#453e5b'); // the blossom mirrored in it
  const CRACK = ramp('#4e5f88', '#8b9ec6', '#e2ecff'); // far, near, and lit by the ring
  const GLOW = ramp('#1f3258', '#2f4b82', '#6688c2', '#bcd4f8', '#eef6ff'); // the ring of light: the glow behind it, then its crest, faint to bright
  const RED = ramp('#86182d', '#b82842'); // the few red petals on the ice
  const BARK = ramp('#030409', '#070910', '#0d111b', '#18202f', '#2a3550', '#465479'); // shade to moonlit
  const BLOOM = ramp('#29233a', '#413956', '#5f5578', '#887b9f', '#b1a3c1', '#d4c8dc', '#ede4ef', '#fbf5fa'); // pale pink-white blossom, deep shade to moonlit
  const ROBE = ramp('#f1f4fb', '#d4dbea', '#aeb8ce', '#838eac', '#596384', '#343c57'); // white robes, moonlit to deep fold
  const SASH = ramp('#1a1f30');
  const HAIR = ramp('#0b0c13', '#161a26', '#2b3347'); // near black, and its cool sheen
  const FLAKE = ramp('#53628a', '#8999bf', '#c8d4ed', '#f4f8ff'); // snowflakes, far to near
  const PETAL = ramp('#fff3f8', '#f2cfe0'); // the one petal, and the same lying on the ice
  const MIST = ramp(...[0.08, 0.14, 0.21, 0.29, 0.38].map((a) => `rgba(196,212,238,${a})`)) - 1; // MIST + 1 to MIST + 5
  const SHINE = ramp('rgba(255,228,240,0.22)', 'rgba(255,228,240,0.1)'); // the faint light round the falling petal, beside it and corner to corner

  // What the ice mirrors each colour as: things that stand on the far shore,
  // the tree and the figure, dimmed; dark things are lost in the dark ice.
  const MIRRORED = PALETTE.map((c, k) => {
    if (!k || c[0] !== '#') return 0;
    const n = parseInt(c.slice(1), 16), lum = (0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255)) / 255;
    if (k >= BLOOM && k < BLOOM + 8) return lum > 0.55 ? BLUSH + 1 : lum > 0.3 ? BLUSH : 0;
    return lum > 0.7 ? MIRROR + 3 : lum > 0.45 ? MIRROR + 2 : lum > 0.25 ? MIRROR + 1 : lum > 0.14 ? MIRROR : 0;
  });
  // A mirrored colour seen further from what it mirrors: `steps` dimmer, or 0 once it is lost in the ice.
  const dimmed = (c, steps) => {
    const base = c >= BLUSH && c < BLUSH + 2 ? BLUSH : MIRROR;
    return c - base >= steps ? c - steps : 0;
  };

  const [DOT, TICK, HIGH, COMMA, BAR, SLASH, BACK, DASH, LOW, STAR, BANG, COLON, CARET] = code(".`',|/\\-_*!:^");
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const dith = (x, y) => (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16; // 0 to 1 in a fixed weave: two colours laid by it read as one between them
  const along = (table, x) => { // a line through [x, y] points, level past its ends
    let k = 1;
    while (k < table.length - 1 && table[k][0] < x) k++;
    const [x0, y0] = table[k - 1], [x1, y1] = table[k];
    return lerp(y0, y1, clamp01((x - x0) / (x1 - x0)));
  };

  // The figure, seen from behind, at (a, b): a across from its middle and b
  // down from the top of its head, both in its heights. Gives a colour, or 0.
  // `sway` swings the end of the hair; the edges of the sleeves stir by `flap`.
  function figureAt(a, b, sway, t, flap) {
    if (b < 0 || b > 1) return 0;
    const side = Math.abs(a), head = (a / 0.1) ** 2 + ((b - 0.085) / 0.085) ** 2;
    if (head < 1) return a < -0.02 && b < 0.08 && head > 0.35 ? HAIR + 2 : HAIR; // all hair, with a sheen where the moon catches it
    const hair = 0.05 - 0.008 * smooth(0.17, 0.5, b) - 0.042 * smooth(0.5, 0.66, b), swung = a - sway * smooth(0.25, 0.66, b); // straight down the middle of the back, to a point
    if (b > 0.1 && Math.abs(swung) < hair) return swung < -hair * 0.3 ? HAIR + 1 : HAIR;
    const stir = flap * smooth(0.5, 0.92, b) * Math.sin(t * (a < 0 ? 2.1 : 2.6) + b * 7 + (a < 0 ? 0 : 2));
    const outer = along(OUTLINE, b) + stir;
    if (b < OUTLINE[0][0] || side > outer || b > 1 - 0.05 * (a / 0.5) ** 2) return 0;
    if (b > 0.58 && b < 0.67 && side < 0.13) return SASH;
    let tone = 1.2 + 1.9 * (a / Math.max(0.1, outer)); // the moon is up to the left
    const fold = 0.15 + 0.03 * b; // where each sleeve hangs from the arm
    if (Math.abs(side - fold) < 0.018 && b > 0.36 && b < 0.86) tone += 1.3; // the fold between sleeve and body
    else if (side < fold && b > 0.67 && b < 0.88) tone += 0.6; // the lap, between the sleeves
    if (b > 0.88) tone -= 0.6; // the robe lying on the ice catches more light
    if (side > outer - 0.025) tone += a > 0 ? 1.2 : 0.5; // its edges turn away
    return ROBE + Math.max(0, Math.min(5, Math.round(tone)));
  }

  function createScene({ cols, rows, aspect = 2, seed = 1 }) {
    const lines = rows * 2, cells = cols * rows, ya = aspect / 2; // ya: how tall a half cell is, in cell widths
    const rand = mulberry32(seed), R = (a, b) => a + (b - a) * rand();
    const o = Array.from({ length: 16 }, () => R(0, 100)); // where each kind of unevenness starts
    const glyph = new Uint8Array(cells), ink = new Uint8Array(cells), bold = new Uint8Array(cells);
    const paint = new Uint8Array(cells * 2), wash = new Uint8Array(cells);
    const held = new Uint8Array(cells); // which halves of each cell the figure fills, this frame

    // Layout, in frame heights: U is one in columns, V in half rows. A wide
    // screen is one frame high; a tall one is WIDE frames across, its spare
    // height shared three to two between the sky and the lake.
    const U = Math.max(6, Math.min(lines * ya, cols / WIDE)), V = U / ya;
    const xf = cols / 2 + 0.05 * U, y0 = Math.max(0, lines - V) * 0.6;
    const X = (u) => xf + u * U, Y = (v) => y0 + v * V;
    const toU = (x) => (x + 0.5 - xf) / U, toV = (y) => (y + 0.5 - y0) / V; // the middle of a half cell
    const moonX = X(MOON[0]), moonY = lines * MOON[1], moonR = Math.max(1.6, MOON[2] * U);

    // The tilt ends with the moon in the middle of the screen. Each layer is
    // larger than the screen by as far as it slides: the sky DX columns right
    // and TS half rows down, the ground as far right and TG down. That is
    // further than the sky, as if the camera rose a little as it tilted, and
    // enough to take the figure out through the bottom of the frame.
    const DX = Math.max(0, Math.round(cols / 2 - moonX));
    const TS = Math.max(2, 2 * Math.round((lines / 2 - moonY) / 2));
    const TG = TS + 2 * Math.ceil(Math.max(0.2 * V, lines + 3 - Y(SEAT - FIGURE) - TS) / 2); // at least far enough that the waterfall goes too
    const W = cols + DX, SH = lines + TS, GH = lines + TG;

    // ---- The sky, as far up and to the left as the camera will look: its
    // glow, the moon in its halo, the far mountains, and the stars.
    const sky = new Uint8Array(W * SH), skyRows = SH >> 1;
    const sGlyph = new Uint8Array(W * skyRows).fill(32), sInk = new Uint8Array(W * skyRows), sBold = new Uint8Array(W * skyRows);
    const ridge = (u) => { // the far mountains' skyline
      const a = u * 3.1 + o[0], roll = noise(a, 1) * 0.6 + noise(a * 2.7, 2) * 0.4, crag = 1 - Math.abs(2 * noise(a * 6.3, 3) - 1);
      return 0.605 - 0.12 * (roll * 0.6 + crag * 0.4);
    };
    const lunar = (mx, my) => { // the moon's face, at a point in its radii from its middle
      let sea = 9;
      for (const [x, y, r] of SEAS) sea = Math.min(sea, Math.hypot(mx - x, my - y) / r);
      return sea < 0.55 ? MOONS + 3 : sea < 1 ? MOONS + 2 : mx * mx + my * my > 0.8 ? MOONS + 1 : MOONS;
    };
    function mountain(u, v, top, xs, ys) {
      const down = v - top, at = u - down * 0.9; // a face runs down to the right of its crest
      const haze = (v - 0.565) / 0.035 + dith(xs, ys) - 0.5;
      if (haze > 0) return HAZE + Math.min(2, Math.floor(haze));
      const lit = ridge(at - 0.005) > ridge(at + 0.005); // it rises to the right, so it faces the moon
      if (down < 0.007 + 0.02 * noise(at * 40 + o[1], v * 60)) return PEAK + (lit ? 4 : 3);
      return PEAK + (lit ? 2 : down > 0.05 ? 0 : 1);
    }
    const skyTop = toV(-TS), skyline = Float32Array.from({ length: W }, (_, xs) => ridge(toU(xs - DX)));
    for (let ys = 0; ys < SH; ys++) {
      const y = ys - TS, v = toV(y), k = clamp01((v - skyTop) / (HORIZON - skyTop)) ** 1.5;
      for (let xs = 0; xs < W; xs++) {
        const x = xs - DX, i = ys * W + xs;
        const mx = (x + 0.5 - moonX) / moonR, my = ((y + 0.5 - moonY) * ya) / moonR, d = Math.sqrt(mx * mx + my * my);
        if (d < 1) { sky[i] = lunar(mx, my); continue; }
        if (v > skyline[xs]) { sky[i] = mountain(toU(x), v, skyline[xs], xs, ys); continue; }
        const glow = 9.5 * k + 4.5 * Math.exp((1 - d) / 2.5) + 5 * Math.exp((1 - d) * 1.4); // dark overhead, paler toward the horizon and round the moon
        sky[i] = SKY + Math.max(0, Math.min(13, Math.floor(glow + dith(xs, ys) - 0.5)));
      }
    }
    const twinkle = []; // the brighter stars: [column, row, phase]
    for (let r = 0; r < skyRows; r++) for (let xs = 0; xs < W; xs++) {
      const a = sky[r * 2 * W + xs] - SKY, b = sky[(r * 2 + 1) * W + xs] - SKY;
      if (a < 0 || a > 9 || b < 0 || b > 9) continue; // open sky only: not the moon, its halo or the mountains
      const h = hash(xs + seed * 7919, r + 3000);
      if (h > 0.07 - 0.005 * Math.max(a, b)) continue; // fewer low down, in the haze
      const size = hash(r + 5000, xs + seed * 31), i = r * W + xs;
      sGlyph[i] = size < 0.6 ? DOT : size < 0.82 ? HIGH : STAR;
      sInk[i] = STARS + (size < 0.4 ? 0 : size < 0.75 ? 1 : size < 0.95 ? 2 : 3);
      sBold[i] = size >= 0.95 ? 1 : 0;
      if (size > 0.72) twinkle.push([xs, r, h * 997]);
    }

    // ---- The ground, as far up and to the left as the camera will look.
    const LAKE = 1, SHORE = 2, STONE = 3, WOOD = 4, BLOSSOM = 5, WATER = 6; // what each half cell of it is
    const ground = new Uint8Array(W * GH), kind = new Uint8Array(W * GH), groundRows = GH >> 1;
    const gGlyph = new Uint8Array(W * groundRows).fill(32), gInk = new Uint8Array(W * groundRows), gBold = new Uint8Array(W * groundRows);
    const mark = (c, r, g, colour, heavy = 0) => {
      if (c < 0 || c >= W || r < 0 || r >= groundRows) return;
      const i = r * W + c;
      gGlyph[i] = g; gInk[i] = colour; gBold[i] = heavy;
    };
    const openLeft = toU(-0.5), openRight = toU(cols - 0.5); // the edges of the opening view
    const faceU = Math.min(-0.58, openLeft + 0.3); // the left cliff's face: near the left edge, on a wide screen too
    const cliffTop = (u) => 0.055 + 0.035 * noise(u * 7 + o[2], 1) + 0.5 * Math.max(0, faceU - 0.22 - u); // its top falls away beyond the frame
    const cliffEdge = (v) => faceU + 0.06 * (noise(v * 6 + o[3], 2) - 0.5) + 0.03 * (noise(v * 21 + o[3], 5) - 0.5) - 0.1 * (1 - smooth(0.03, 0.24, v)); // its face, rounded over at the top
    const benchTop = (u) => 0.36 + 0.065 * smooth(-0.64, -0.42, u) + 0.32 * smooth(-0.26, -0.08, u) + 0.022 * (noise(u * 11 + o[4], 3) - 0.5); // the cliff the waterfall drops from, falling away to the right
    const shoreV = (u) => 0.638 + 0.012 * (noise(u * 9 + o[5], 4) - 0.5) + 0.1 * smooth(faceU + 0.2, faceU, u) + 0.07 * smooth(0.17, 0.34, u) + 0.025 * smooth(0.45, 0.75, u); // where the ice begins
    const bankV = (u) => 0.012 + 0.012 * noise(u * 14 + o[11], 5) + 0.075 * smooth(0.08, 0.32, u) * (0.6 + 0.4 * noise(u * 6 + o[14], 6)); // how high the far shore's bank rises above the ice: highest under the tree
    const shoreAt = new Float32Array(W), benchAt = new Float32Array(W), cliffAt = new Float32Array(W), bankAt = new Float32Array(W), edgeAt = new Float32Array(GH);
    for (let xg = 0; xg < W; xg++) { const u = toU(xg - DX); shoreAt[xg] = shoreV(u); benchAt[xg] = benchTop(u); cliffAt[xg] = cliffTop(u); bankAt[xg] = bankV(u); }
    for (let yg = 0; yg < GH; yg++) edgeAt[yg] = cliffEdge(toV(yg - TG));

    // Pines along the top of the waterfall's cliff, tallest in two groves: [u, foot, height, half width].
    const pines = [];
    for (let u = faceU - 0.1; u < -0.17; u += R(0.016, 0.034)) {
      const grove = Math.max(smooth(-0.66, -0.58, u) * (1 - smooth(-0.5, -0.44, u)), smooth(-0.33, -0.27, u) * (1 - smooth(-0.22, -0.17, u)));
      const h = R(0.025, 0.06) * (1 + 1.1 * grove);
      pines.push([u, benchTop(u) + 0.012, h, h * R(0.2, 0.26)]);
    }
    const pineAt = (u, v) => {
      for (const [pu, foot, h, w] of pines) {
        const k = (v - foot + h) / h, off = u - pu;
        if (k < 0 || k > 1 || Math.abs(off) > w) continue;
        const tier = (k * 4.5) % 1, half = w * k * (0.7 + 0.3 * tier); // its boughs in tiers
        if (Math.abs(off) < half) return off < 0 ? (tier > 0.7 && off < -half * 0.45 ? SNOW : PINE + 2) : PINE + 1;
      }
      return 0;
    };
    // Snow lying on the ice, as patches on its plane: [X, Z, radius across, radius deep].
    // They lie toward the shores, none where the figure sits or the petal lands.
    const drifts = [];
    for (let tries = 0; drifts.length < 6 && tries < 80; tries++) {
      const Z = lerp(0.75, 3.6, rand()), Xd = lerp(openLeft, openRight, rand()) * Z, rx = R(0.05, 0.12) * Z, rz = R(0.06, 0.12) * Z * Z;
      if ((Math.abs(Xd / Z) > 0.3 || Z > 2.2) && Math.hypot(Xd - LAND[0], Z - LAND[1]) > 0.4 + rx && Math.hypot(Xd, Z - 1) > 0.3 + rx) drifts.push([Xd, Z, rx, rz]);
    }
    const ice = (u, v, xg, yg) => {
      const Z = (SEAT - HORIZON) / (v - HORIZON), Xw = u * Z;
      if (v - shoreAt[xg] < 0.005 + 0.007 * noise(u * 30 + o[8], 6)) return SNOW + 1; // snow along the water's edge
      for (const [dx, dz, rx, rz] of drifts) {
        const e = ((Xw - dx) / rx) ** 2 + ((Z - dz) / rz) ** 2;
        if (e > 1.35) continue; // too far for its ragged edge to reach
        const ragged = e + 0.7 * (noise(Xw * 9 + o[9], Z * 9) - 0.5);
        if (ragged < 1) return SNOW + (ragged < 0.5 ? 1 : 0);
      }
      return ICE + Math.max(0, Math.min(6, Math.round(6 - clamp01((Math.log(Z) + 0.9) / 2.3) * 6 + (dith(xg, yg) - 0.5) * 0.9)));
    };
    const cliff = (u, v, xg, yg) => {
      const into = (edgeAt[yg] - u) * U, under = (v - cliffAt[xg]) * V; // columns in from its face, half rows down from its top
      if (under < 1.2 + 1.5 * noise(u * 20 + o[6], 7)) return SNOW + (into < 3 ? 2 : 1); // snow along the top
      const level = v * 32 + 0.8 * noise(u * 6 + o[7], 8), band = Math.floor(level), atTop = level - band; // its bands of rock, and how far down its band this half cell is
      const ledge = hash(band, 41) < 0.35 && into < 2 + 9 * hash(band, 43);
      if (ledge && atTop < 0.22) return SNOW + (into < 2 ? 2 : 1); // snow on a ledge, and the shadow under it
      if (ledge && atTop < 0.4) return ROCK;
      if (into < 1.2 && noise(v * 14 + o[10], 4) > 0.45) return ROCK + 4; // where the face juts, it catches the moon
      const grain = noise(xg * 0.25 + o[10], yg * 0.18);
      return ROCK + (grain > 0.72 ? 3 : grain > 0.5 ? 2 : grain > 0.25 ? 1 : 0);
    };
    for (let yg = 0; yg < GH; yg++) {
      const v = toV(yg - TG);
      for (let xg = 0; xg < W; xg++) {
        const u = toU(xg - DX), i = yg * W + xg, shore = shoreAt[xg], top = benchAt[xg];
        if (v >= shore) { kind[i] = LAKE; ground[i] = ice(u, v, xg, yg); continue; }
        if (u < edgeAt[yg] && v > cliffAt[xg]) { kind[i] = STONE; ground[i] = cliff(u, v, xg, yg); continue; }
        if (u > -0.3 && v > shore - bankAt[xg]) { // the far shore's bank: snow along its top, dark stones below
          const n = noise(u * 40 + o[12], v * 50), crest = v < shore - bankAt[xg] + 0.008;
          kind[i] = SHORE; ground[i] = crest ? SNOW + 1 : n > 0.42 ? ROCK + (n > 0.7 ? 1 : 2) : SNOW + (n < 0.25 ? 1 : 0);
          continue;
        }
        if (v > top) { // the cliff the waterfall drops from, and the waterfall
          const wob = 0.008 * (noise(v * 30 + o[13], 3) - 0.5), spread = 0.012 * smooth(top, shore, v); // ragged, and wider as it falls
          const fall = FALLS.find(([a, b]) => u > a - spread + wob && u < b + spread + wob);
          if (fall && v > top + 0.006) {
            const edge = Math.min(u - fall[0] + spread - wob, fall[1] + spread + wob - u) * U; // columns in from its side
            kind[i] = WATER; ground[i] = FALL + (edge < 0.8 ? 2 : v - top < 0.02 ? 0 : hash(xg, 17) > 0.65 ? 1 : 0);
          } else {
            kind[i] = STONE;
            ground[i] = v - top < 0.008 ? SNOW : ROCK + (noise(xg * 0.3 + o[13], yg * 0.2) > 0.6 ? 2 : 1);
          }
          continue;
        }
        const pine = v > top - 0.17 ? pineAt(u, v) : 0;
        if (pine) { kind[i] = STONE; ground[i] = pine; }
      }
    }
    for (const [pu, foot, h] of pines) mark(Math.floor(X(pu) + DX), (Math.floor(Y(foot - h) + TG) + 1) >> 1, CARET, SNOW + 1); // a pine's tip

    // Snowy boulders in the lower corners, the nearest biggest: [u, v, radius across, radius down].
    const boulders = [];
    for (let u = Math.min(openLeft, faceU) - 0.08; u < -0.4; u += R(0.06, 0.1)) {
      const corner = smooth(-0.45, -0.75, u);
      boulders.push([u, 0.755 + 0.06 * corner + R(0, 0.02), R(0.05, 0.085), R(0.03, 0.05) + 0.02 * corner]);
    }
    for (let u = R(0.47, 0.51); u < openRight + 0.08; u += R(0.06, 0.1)) {
      const corner = smooth(0.5, 0.7, u);
      boulders.push([u, 0.75 + 0.08 * corner + R(0, 0.02), R(0.05, 0.09), R(0.03, 0.05) + 0.02 * corner]);
    }
    boulders.sort((a, b) => a[1] - b[1]); // far ones first, so that near ones stand in front
    for (const [bu, bv, rx, ry] of boulders) {
      const x0 = Math.max(0, Math.floor(X(bu - rx * 1.2) + DX)), x1 = Math.min(W - 1, Math.ceil(X(bu + rx * 1.2) + DX));
      const yA = Math.max(0, Math.floor(Y(bv - ry * 1.2) + TG)), yB = Math.min(GH - 1, Math.ceil(Y(bv + ry * 0.5) + TG));
      for (let yg = yA; yg <= yB; yg++) for (let xg = x0; xg <= x1; xg++) {
        const du = (toU(xg - DX) - bu) / rx, dv = (toV(yg - TG) - bv) / ry;
        if (dv > 0.45 || du * du + dv * dv > 1 + 0.25 * (noise(du * 3 + bu * 50, dv * 3) - 0.5)) continue;
        const i = yg * W + xg;
        kind[i] = STONE;
        ground[i] = dv < -0.45 + 0.35 * (noise(du * 4 + bu * 30, 9) - 0.5) ? SNOW + (du < -0.2 ? 2 : 1) : ROCK + (dv > 0.2 ? 0 : du < -0.4 ? 3 : du < 0.2 ? 1 : 0); // a cap of snow; the rock lit at its left edge
      }
    }

    // ---- The tree. Wood first: runs thick enough fill their cells, lit from
    // the upper left; thinner ones are drawn as lines of characters.
    const twigs = []; // [column, row, column, row] in the ground's cells
    function stroke(pts) {
      for (let n = 1; n < pts.length; n++) {
        const [u0, v0, w0] = pts[n - 1], [u1, v1, w1] = pts[n];
        const x0 = X(u0) + DX, y0g = Y(v0) + TG, x1 = X(u1) + DX, y1g = Y(v1) + TG, r0 = (w0 * U) / 2, r1 = (w1 * U) / 2;
        if (r0 < 0.8) { twigs.push([x0, y0g / 2, x1, y1g / 2]); continue; }
        const dx = x1 - x0, dy = (y1g - y0g) * ya, len2 = dx * dx + dy * dy || 1e-9, reach = Math.max(r0, r1) * 1.15 + 1;
        const yA = Math.max(0, Math.floor(Math.min(y0g, y1g) - reach / ya)), yB = Math.min(GH - 1, Math.ceil(Math.max(y0g, y1g) + reach / ya));
        const xA = Math.max(0, Math.floor(Math.min(x0, x1) - reach)), xB = Math.min(W - 1, Math.ceil(Math.max(x0, x1) + reach));
        for (let yg = yA; yg <= yB; yg++) for (let xg = xA; xg <= xB; xg++) {
          const px = xg + 0.5 - x0, py = (yg + 0.5 - y0g) * ya;
          const k = clamp01((px * dx + py * dy) / len2), ox = px - dx * k, oy = py - dy * k;
          const half = lerp(r0, r1, k) * (0.88 + 0.24 * noise(xg * 0.4 + o[14], yg * 0.4)); // gnarled
          if (ox * ox + oy * oy > half * half) continue;
          const lit = -(ox * 0.8 + oy * 0.6) / half, i = yg * W + xg;
          kind[i] = WOOD; ground[i] = BARK + Math.max(0, Math.min(5, Math.round(1.3 + lit * 2.8 + (hash(xg, yg) - 0.5) * 1.1)));
        }
      }
    }
    const upward = (a, k) => -Math.PI / 2 + Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2)) * (1 - k); // a heading turned k of the way to straight up
    const boughs = []; // grown from the limbs' joints, each with a pair of twigs at its end
    for (const limb of LIMBS) for (let n = 1; n < limb.length - 1; n++) {
      const [ua, va] = limb[n - 1], [ub, vb, w] = limb[n], heading = Math.atan2(vb - va, ub - ua);
      for (const side of [-1, 1]) {
        if (rand() < 0.3) continue;
        const a = upward(heading + side * R(0.45, 0.95), 0.3), l = R(0.06, 0.13), ue = ub + Math.cos(a) * l, ve = vb + Math.sin(a) * l;
        boughs.push([[ub, vb, w * 0.55], [ue, ve, w * 0.2]]);
        for (const turn of [-0.5, 0.5]) {
          const b = a + turn + R(-0.2, 0.2), m = R(0.03, 0.06);
          boughs.push([[ue, ve, w * 0.2], [ue + Math.cos(b) * m, ve + Math.sin(b) * m, w * 0.08]]);
        }
      }
    }
    for (const [ub, vb, w] of LIMBS[0].slice(1, 5)) boughs.push([[ub, vb, w * 0.5], [ub + R(-0.03, 0.03), vb + R(0.07, 0.12), w * 0.15]]); // sprays hanging from the limb over the figure
    stroke(TRUNK); ROOTS.forEach(stroke); LIMBS.forEach(stroke); boughs.forEach(stroke);

    // How near each half cell is to a limb or bough, 1 on it to 0 at REACH:
    // the blossom grows thickest along them.
    const near = new Float32Array(W * GH), REACH = 0.075;
    const nearTo = (pts) => {
      for (let n = 1; n < pts.length; n++) {
        const [u0, v0] = pts[n - 1], [u1, v1] = pts[n], du = u1 - u0, dv = v1 - v0, len2 = du * du + dv * dv || 1e-9;
        const xA = Math.max(0, Math.floor(X(Math.min(u0, u1) - REACH) + DX)), xB = Math.min(W - 1, Math.ceil(X(Math.max(u0, u1) + REACH) + DX));
        const yA = Math.max(0, Math.floor(Y(Math.min(v0, v1) - REACH) + TG)), yB = Math.min(GH - 1, Math.ceil(Y(Math.max(v0, v1) + REACH) + TG));
        for (let yg = yA; yg <= yB; yg++) for (let xg = xA; xg <= xB; xg++) {
          const pu = toU(xg - DX) - u0, pv = toV(yg - TG) - v0, k = clamp01((pu * du + pv * dv) / len2), i = yg * W + xg;
          const ou = pu - du * k, ov = pv - dv * k;
          near[i] = Math.max(near[i], 1 - Math.sqrt(ou * ou + ov * ov) / REACH);
        }
      }
    };
    LIMBS.forEach(nearTo); boughs.forEach(nearTo);

    // The crown of blossom: sprays thickest along the limbs and boughs, with
    // the sky and the limbs showing through, inside an outline that hangs low
    // beside the figure and reaches up beyond the frame, leaning right as it
    // goes so that the last view, centred on the moon, has blossom along its
    // right edge. Above the limbs' reach it grows wild. Each clump is lit on
    // the side toward the moon.
    const sc = Math.max(1.5, 0.04 * U); // the size of a clump, in columns
    const clump = (x, y) => 0.7 * noise(x / sc + o[0], (y * ya) / sc + o[1]) + 0.3 * noise(x / (sc * 0.45) + o[2], (y * ya) / (sc * 0.45) + o[3]);
    const gTop = toV(-TG), uTop = Math.max(HEM[0][0], toU(0.78 * cols - DX));
    const reachL = (v) => (v >= 0.3 ? HEM[0][0] : lerp(HEM[0][0], uTop, clamp01((0.3 - v) / (0.3 - gTop))));
    const reachR = Math.max(0.92, toU(cols - DX) + 0.15);
    const crownBottom = Math.min(GH, Math.ceil(Y(0.6) + TG));
    for (let yg = 0; yg < crownBottom; yg++) {
      const v = toV(yg - TG), left = reachL(v) + 0.06 * (noise(v * 9 + o[4], 7) - 0.5), wild = 0.55 * smooth(-0.3, -0.6, v);
      for (let xg = Math.max(0, Math.floor(X(left) + DX)); xg < W; xg++) {
        const u = toU(xg - DX), hang = along(HEM, u) + 0.045 * smooth(0.5, 0.8, noise(u * 9 + o[5], 8)); // sprays hang lower here and there
        const e = Math.min(u - left, reachR - u, (hang - v) * 1.4);
        if (e <= 0) continue;
        const i = yg * W + xg, c = clump(xg, yg);
        const body = 0.55 * c + 0.42 * Math.max(near[i], wild) - 0.3 * (1 - smooth(0, 0.07, e)); // thinning out toward the outline
        const speck = body + 0.3 * (hash(xg * 3 + 1, yg * 7 + 2) - 0.5); // where it is thin it breaks up into single blossoms
        if (speck < 0.47 || (kind[i] === WOOD && speck < 0.8)) continue; // the limbs show through
        const lit = c - clump(xg - sc * 0.6, yg - (sc * 0.6) / ya); // brighter on the side toward the moon
        const tone = 3 + lit * 8 + (speck - 0.47) * 4 + 1.2 * smooth(0.25, -0.25, v) + (hash(xg + 7, yg * 3) - 0.5) * 1.6;
        kind[i] = BLOSSOM; ground[i] = BLOOM + Math.max(0, Math.min(7, Math.round(tone)));
      }
    }
    // Snow along the tops of the limbs and roots.
    for (let yg = 1; yg < GH; yg++) for (let xg = 1; xg < W - 1; xg++) {
      const i = yg * W + xg;
      if (kind[i] === WOOD && !kind[i - W] && kind[i - 1] === WOOD && kind[i + 1] === WOOD) ground[i] = SNOW + (hash(xg, yg) < 0.5 ? 2 : 1);
    }

    // ---- The ice mirrors what stands over it: the tree about its foot, and
    // everything on the far shore (the waterfall, the mist, the stones) about
    // the shore, dimming as it comes nearer.
    const yTree = Y(0.73) + TG;
    for (let yg = 0; yg < GH; yg++) for (let xg = 0; xg < W; xg++) {
      const i = yg * W + xg;
      if (kind[i] !== LAKE || ground[i] < ICE || ground[i] > ICE + 6) continue;
      const u = toU(xg - DX), v = toV(yg - TG), yt = Math.round(2 * yTree - yg - 1);
      let c = 0, far = 1;
      if (u > 0.1 && yt >= 0 && (kind[yt * W + xg] === WOOD || kind[yt * W + xg] === BLOSSOM)) { c = MIRRORED[ground[yt * W + xg]] || ICE + 6; far = (v - 0.73) / 0.3; }
      else {
        const ym = Math.round(2 * (Y(shoreAt[xg]) + TG) - yg - 1), ys = ym - TG + TS;
        if (ym >= 0 && ym < GH) c = MIRRORED[kind[ym * W + xg] ? ground[ym * W + xg] : ys >= 0 ? sky[ys * W + xg] : 0];
        far = (v - shoreAt[xg]) / 0.25;
      }
      if (c === ICE + 6) { if (dith(xg, yg) > far) ground[i] = c; } // dark wood: a shadow in the ice
      else if (c) ground[i] = dimmed(c, Math.floor(far * 4 + dith(xg, yg))) || ground[i];
    }

    // Cracks in the ice: straight runs on its plane, most of them running
    // away from us, each drawn as a line of characters. Each cell of one
    // remembers how far it is from where the petal lands, for the ring.
    const iceAt = (x, y) => { const Z = (SEAT - HORIZON) / Math.max(1e-3, (y - y0) / V - HORIZON); return [((x - xf) / U) * Z, Z]; }; // a point of the opening view, on the ice
    const crackCells = []; // [ground cell, distance]
    const onIce = (c, r) => c >= 0 && c < W && r >= 0 && r < groundRows && kind[2 * r * W + c] === LAKE && kind[(2 * r + 1) * W + c] === LAKE;
    const crack = (c, r, g, colour) => {
      if (!onIce(c, r)) return;
      if (gGlyph[r * W + c] === 32) { const [Xc, Zc] = iceAt(c + 0.5 - DX, 2 * r + 1 - TG); crackCells.push([r * W + c, Math.hypot(Xc - LAND[0], Zc - LAND[1])]); }
      mark(c, r, g, colour);
    };
    const line = (c0, r0, c1, r1, put) => { // a straight line of characters, each chosen by where the line crosses its cell
      const dc = c1 - c0, dr = r1 - r0, rising = dc * dr < 0;
      if (Math.abs(dc) <= Math.abs(dr) * 1.3) { // steep: one character a row
        const lo = Math.min(r0, r1), hi = Math.max(r0, r1);
        for (let r = Math.floor(lo); r < hi; r++) {
          const ra = Math.max(lo, r), rb = Math.min(hi, r + 1);
          if (rb - ra < 0.25) continue;
          const ca = c0 + (dc * (ra - r0)) / dr, cb = c0 + (dc * (rb - r0)) / dr;
          put(Math.floor((ca + cb) / 2), r, Math.floor(ca) === Math.floor(cb) ? BAR : rising ? SLASH : BACK);
        }
      } else { // shallow: one a column
        const lo = Math.min(c0, c1), hi = Math.max(c0, c1), slope = Math.abs(dr / dc);
        for (let c = Math.floor(lo); c < hi; c++) {
          const ca = Math.max(lo, c), cb = Math.min(hi, c + 1);
          if (cb - ca < 0.35) continue;
          const y = r0 + (dr * ((ca + cb) / 2 - c0)) / dc, r = Math.floor(y), f = y - r;
          if (slope > 0.6) put(c, r, rising ? SLASH : BACK);
          else if (slope > 0.2) put(c, r, f < 0.36 ? (rising ? HIGH : TICK) : f > 0.64 ? (rising ? COMMA : DOT) : DASH);
          else if (f < 0.25) put(c, r - 1, LOW);
          else put(c, r, f < 0.72 ? DASH : LOW);
        }
      }
    };
    const onScreen = (Xw, Z) => [X(Xw / Z) + DX, (Y(HORIZON + (SEAT - HORIZON) / Z) + TG) / 2]; // a point of the ice, in the ground's cells
    for (let n = 0; n < 20; n++) {
      let Z = lerp(0.4, 3, rand() ** 1.6), Xw = lerp(openLeft, openRight, rand()) * Z;
      let a = (rand() < 0.85 ? Math.PI / 2 : 0) + (rand() < 0.5 ? Math.PI : 0) + R(-0.8, 0.8);
      for (let k = 0, runs = 2 + ((rand() * 4) | 0); k < runs; k++) {
        const l = R(0.12, 0.4) * Z, Z1 = Z + Math.sin(a) * l, X1 = Xw + Math.cos(a) * l;
        if (Z1 < 0.3 || Z1 > 4) break;
        const [c0, r0] = onScreen(Xw, Z), [c1, r1] = onScreen(X1, Z1), colour = Math.min(Z, Z1) < 1.6 ? CRACK + 1 : CRACK;
        line(c0, r0, c1, r1, (c, r, g) => crack(c, r, g, colour));
        Xw = X1; Z = Z1; a += R(-0.6, 0.6);
      }
    }
    // A few tiny red petals on the ice near the figure.
    for (let n = 0, tries = 0; n < 7 && tries < 80; tries++) {
      const Z = R(0.84, 1.22), Xp = R(-0.3, 0.34) * Z;
      if (Math.hypot(Xp - LAND[0], Z - LAND[1]) < 0.16 || (Math.abs(Xp) < 0.13 && Math.abs(Z - 1) < 0.07)) continue;
      const [c, r] = onScreen(Xp, Z);
      if (!onIce(Math.floor(c), Math.floor(r))) continue;
      mark(Math.floor(c), Math.floor(r), r % 1 < 0.5 ? HIGH : COMMA, RED + (n & 1));
      n++;
    }

    // The scene's other characters, where a whole cell is one thing.
    for (let r = 0; r < groundRows; r++) for (let c = 0; c < W; c++) {
      const i = r * W + c, top = 2 * r * W + c, a = kind[top], b = kind[top + W], h = hash(c + 11, r + 13);
      if (gGlyph[i] !== 32) continue;
      const tone = Math.max(ground[top], ground[top + W]) - BLOOM;
      if (a === BLOSSOM && b === BLOSSOM) { if (h < 0.18) mark(c, r, h < 0.08 ? STAR : h < 0.14 ? HIGH : DOT, BLOOM + Math.min(7, tone + 2), tone >= 5 ? 1 : 0); }
      else if (a === BLOSSOM || b === BLOSSOM) { // the crown's ragged edges
        if (h < 0.4) mark(c, r, a === BLOSSOM ? (h < 0.2 ? HIGH : TICK) : h < 0.2 ? DOT : COMMA, Math.min(BLOOM + 7, ground[a === BLOSSOM ? top : top + W] + 1));
      } else if (a === WOOD && b === WOOD) { if (h < 0.08) mark(c, r, BAR, BARK + 3); } // the grain of the bark
      else if (a === STONE && b === STONE) {
        const upper = ground[top], lower = ground[top + W];
        if (upper >= SNOW && upper <= SNOW + 3 && lower >= ROCK && lower <= ROCK + 4 && h < 0.5) mark(c, r, DASH, SNOW + 2); // a snowy ledge
        else if (upper < SNOW && lower < SNOW && h < 0.035) mark(c, r, COLON, ROCK + 4);
      } else if (a === SHORE && b === SHORE && h < 0.12) mark(c, r, DOT, SNOW + 3);
    }
    // Twigs: dark lines across the blossom.
    for (const [c0, r0, c1, r1] of twigs) line(c0, r0, c1, r1, (c, r, g) => {
      if (c >= 0 && c < W && r >= 0 && r < groundRows && (kind[2 * r * W + c] === BLOSSOM || kind[(2 * r + 1) * W + c] === BLOSSOM)) mark(c, r, g, BARK + 1, 1);
    });

    // The falling water's cells, and the ring of light's: for every half cell
    // of the opening view on the ice, the nearest and farthest that any of it
    // is from where the petal lands, so that the ring's crest is one half cell
    // thick however far off it is.
    const flow = [];
    for (let r = 0; r < groundRows; r++) for (let c = 0; c < W; c++) if (kind[2 * r * W + c] === WATER && kind[(2 * r + 1) * W + c] === WATER) flow.push(r * W + c);
    const dLo = new Float32Array(cols * lines).fill(NaN), dHi = new Float32Array(cols * lines);
    for (let y = 0; y < lines; y++) for (let x = 0; x < cols; x++) {
      if (kind[(y + TG) * W + x + DX] !== LAKE) continue;
      let lo = Infinity, hi = 0;
      for (let k = 0; k < 4; k++) {
        const Z = (SEAT - HORIZON) / Math.max(1e-3, (y + (k >> 1) - y0) / V - HORIZON), dx = ((x + (k & 1) - xf) / U) * Z - LAND[0], dz = Z - LAND[1];
        const d = Math.sqrt(dx * dx + dz * dz);
        lo = Math.min(lo, d); hi = Math.max(hi, d);
      }
      dLo[y * cols + x] = lo; dHi[y * cols + x] = hi;
    }

    // The one petal's fall, in the opening view: from the crown's lower edge,
    // down in a slow curve that bows out to the left, to the ice.
    const landX = X(LAND[0] / LAND[1]), landY = Y(HORIZON + (SEAT - HORIZON) / LAND[1]);
    const fromX = X(-0.04), fromY = Y(along(HEM, -0.04) - 0.01);
    const heroAt = (s) => {
      const k = clamp01((s - T.petal) / (T.land - T.petal));
      return [lerp(fromX, landX, smooth(0, 1, k)) - 0.03 * U * Math.sin(Math.PI * k) + 0.01 * U * Math.sin(k * 10), lerp(fromY, landY, k)];
    };
    // Other petals drift down from the tree toward the left, in screen
    // seconds, and lie where they come down. None comes near the one petal's way.
    const drifting = [];
    for (let n = 0; n < 16; n++) {
      const u0 = R(0.06, Math.min(0.8, openRight)), q = {
        t0: R(-4, 4.2), x: X(u0), y: Y(R(0.3, along(HEM, u0))), vx: -R(0.03, 0.07) * U, vy: R(0.04, 0.08) * V,
        amp: R(0.006, 0.02) * U, freq: R(1.5, 3), phase: R(0, 6.28), down: Y(R(0.72, 0.95)), ink: BLOOM + 4 + (n % 2),
      };
      q.fall = (q.down - q.y) / q.vy;
      let clear = Math.hypot(q.x + q.vx * q.fall - landX, (q.down - landY) * ya) > 0.08 * U;
      for (let ts = T.petal / SPEED - 0.2; clear && ts < (T.land + 1) / SPEED; ts += 0.04) {
        const life = clamp01((ts - q.t0) / q.fall) * q.fall, px = q.x + q.vx * life, py = q.y + q.vy * life;
        for (let s = T.petal; clear && s <= T.land; s += 0.1) { const [hx, hy] = heroAt(s); clear = Math.hypot(px - hx, (py - hy) * ya) > 0.1 * U; }
      }
      if (clear) drifting.push(q);
    }
    const TUMBLE = [HIGH, TICK, COMMA, DOT]; // a petal turning over as it falls

    // How far the camera has tilted, 0 to 1: at constant speed, easing in and out over its first and last few percent.
    const tilted = (s) => {
      const k = clamp01((s - T.tilt) / (T.moon - T.tilt)), e = 0.06;
      return k < e ? (k * k) / (2 * e * (1 - e)) : k > 1 - e ? 1 - ((1 - k) * (1 - k)) / (2 * e * (1 - e)) : (k - e / 2) / (1 - e);
    };
    const fw = FIGURE * U, fh = FIGURE * V, crown = Y(SEAT - FIGURE); // the figure's size, and the top of its head
    const mistR0 = Math.max(0, (Math.floor(Y(0.5)) + TG) >> 1), mistR1 = Math.min(groundRows, (Math.ceil(Y(0.68)) + TG) >> 1);
    const mistC0 = Math.max(0, Math.floor(X(faceU)) + DX), mistC1 = Math.min(W, Math.ceil(X(0.32)) + DX);

    return {
      cols, rows, palette: PALETTE, glyph, ink, bold, paint, wash,
      render(t) { // t: seconds since the film started
        glyph.fill(32); ink.fill(0); bold.fill(0); paint.fill(0); wash.fill(0); held.fill(0);
        if (!(t < LENGTH)) return this; // over: an empty frame, so the page shows
        t = Math.max(0, t);
        const s = t * SPEED, p = tilted(s); // s: where that is in the story
        // Where each layer is: ox columns and os, og half rows from its top
        // left corner. Paint moves by half rows and characters by rows, so
        // while the camera moves they may be half a row apart.
        const ox = Math.round(DX * (1 - p)), os = Math.round(TS * (1 - p)), og = Math.round(TG * (1 - p));
        const rs = (os + 1) >> 1, rg = (og + 1) >> 1, gx = DX - ox, gy = TG - og; // gx, gy: how far the ground has slid, on screen

        // The sky, and the ground over it.
        for (let y = 0; y < lines; y++) {
          const from = (y + os) * W + ox, to = y * cols, g = (y + og) * W + ox;
          paint.set(sky.subarray(from, from + cols), to);
          for (let x = 0; x < cols; x++) if (ground[g + x]) paint[to + x] = ground[g + x];
        }
        for (let r = 0, i = 0; r < rows; r++) for (let c = 0; c < cols; c++, i++) {
          const gi = (r + rg) * W + c + ox, h = (2 * r + og) * W + c + ox;
          if (gGlyph[gi] !== 32) { glyph[i] = gGlyph[gi]; ink[i] = gInk[gi]; bold[i] = gBold[gi]; continue; }
          if (ground[h] || ground[h + W]) continue;
          const si = (r + rs) * W + c + ox;
          glyph[i] = sGlyph[si]; ink[i] = sInk[si]; bold[i] = sBold[si];
        }

        // Thin dark clouds drift slowly right beside the moon: darker than its
        // halo, with edges it lights; never over its face.
        const drift = CLOUD_DRIFT * U * t, mX = moonX + DX - ox, mY = moonY + TS - os; // the moon, on screen
        for (let y = Math.max(0, Math.floor(mY - 0.15 * V)); y < Math.min(lines, mY + 0.3 * V); y++) {
          const dv = (y + 0.5 - mY) / V;
          for (let x = Math.max(0, Math.floor(mX - 0.42 * U)); x < Math.min(cols, mX + 0.5 * U); x++) {
            if (ground[(y + og) * W + x + ox]) continue;
            const dx = x + 0.5 - mX, du = dx / U, dy = dv * V * ya, d = Math.sqrt(dx * dx + dy * dy) / moonR;
            if (d < 1.15) continue;
            let body = 0;
            for (const [cu, cv, len, thick, slope] of CLOUDS) {
              const at = du - drift / U - cu, run = at / len, across = (dv - cv - slope * at) / thick;
              body = Math.max(body, 1 - run * run - across * across);
            }
            if (body <= 0) continue;
            const wisp = body * (0.35 + 0.9 * noise((x - drift) / (0.035 * U) + o[6], (y * ya) / (0.012 * U) + o[7]));
            if (wisp < 0.42) continue;
            const i = y * cols + x;
            paint[i] = wisp < 0.5 ? (d < 3 ? SKY + 13 : CLOUD + 2) : d < 3.5 ? CLOUD + 1 : CLOUD + 2 - (wisp > 0.75 ? 1 : 0);
            const ci = (y >> 1) * cols + x;
            if (ink[ci] >= STARS && ink[ci] <= STARS + 3) glyph[ci] = 32; // a star behind it
          }
        }
        // The stars twinkle faintly.
        for (const [xs, r, phase] of twinkle) {
          const c = xs - ox, rr = r - rs;
          if (c < 0 || c >= cols || rr < 0 || rr >= rows) continue;
          const i = rr * cols + c;
          if (glyph[i] === 32 || ink[i] < STARS || ink[i] > STARS + 3) continue;
          const k = Math.sin(t * 2.1 + phase);
          if (k > 0.8) { glyph[i] = STAR; ink[i] = STARS + 3; bold[i] = 1; } else if (k < -0.75) { glyph[i] = DOT; ink[i] = STARS; bold[i] = 0; }
        }

        // The waterfall's streaks run down, and mist drifts at its foot and along the far shore.
        const fell = Math.floor(t * FLOW);
        for (const gi of flow) {
          const R0 = (gi / W) | 0, C0 = gi % W, r = R0 - rg, c = C0 - ox;
          if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
          const h = hash(C0, R0 - fell), i = r * cols + c;
          if (h < 0.42) { glyph[i] = h < 0.14 ? BAR : h < 0.26 ? BANG : h < 0.36 ? COLON : HIGH; ink[i] = h < 0.2 ? FALL + 2 : FALL + 1; bold[i] = 0; }
        }
        for (let r = mistR0; r < mistR1; r++) {
          const sr = r - rg;
          if (sr < 0 || sr >= rows) continue;
          const v = toV(2 * r + 1 - TG);
          for (let c = mistC0; c < mistC1; c++) {
            const sx = c - ox;
            if (sx < 0 || sx >= cols) continue;
            const u = toU(c - DX);
            const plume = Math.exp(-(((u - FOOT[0]) / 0.11) ** 2) - ((v - FOOT[1] + 0.012) / 0.05) ** 2);
            const band = Math.exp(-(((v - shoreAt[c] + 0.012) / 0.018) ** 2)) * smooth(-0.75, -0.5, u) * (1 - smooth(0, 0.3, u)) * 0.4;
            const m = (plume + band) * (0.25 + noise(c / (0.06 * U) - t * 0.35 + o[8], (2 * r) / (0.035 * V)));
            const level = Math.min(5, Math.floor(m * 6.5 - 0.6));
            if (level > 0) wash[sr * cols + sx] = MIST + level;
          }
        }

        // The figure's reflection in the ice under it, mirrored about where
        // it sits: the white robe dimming as it goes, the hair a dark stripe.
        const sway = (Math.sin(t * 1.3) * Math.max(0.7, 0.02 * fw)) / fw, flap = Math.max(0.6, 0.015 * fw) / fw;
        const fx0 = Math.floor(xf - fw * 0.52), fx1 = Math.ceil(xf + fw * 0.52), fy0 = Math.floor(crown), fy1 = Math.ceil(crown + fh * 1.9);
        for (let y = Math.ceil(crown + fh); y < fy1; y++) {
          const sy = y + gy, b = (y + 0.5 - crown) / fh, far = (b - 1) / 0.9;
          if (sy < 0 || sy >= lines) continue;
          for (let x = fx0; x <= fx1; x++) {
            const sx = x + gx, gi = (y + TG) * W + x + DX;
            if (sx < 0 || sx >= cols || kind[gi] !== LAKE || ground[gi] < ICE || ground[gi] > ICE + 6) continue;
            const m = figureAt((x + 0.5 - xf) / fw, 1.97 - b, sway, t, flap);
            if (!m) continue;
            const c = MIRRORED[m] ? dimmed(MIRRORED[m], Math.floor(far * 3.2 + dith(x, y))) : far < 0.75 ? ICE + 6 : 0;
            if (c) paint[sy * cols + sx] = c;
          }
        }

        // The ring of light: from where the petal touched, across the ice, a
        // bright crest with a short glow behind it, lighting each crack as it
        // passes. It runs out under the figure and off the near edge, and
        // fades as it reaches the far shore.
        if (s > T.land && s < T.ring) {
          const k = (s - T.land) / (T.ring - T.land), rho = RHO * k, strength = smooth(0, 0.04, k) * (1 - smooth(0.5, 1, k));
          const crest = GLOW + (strength > 0.7 ? 4 : strength > 0.4 ? 3 : 2);
          for (let i = 0; i < cols * lines; i++) {
            const lo = dLo[i];
            if (!(lo <= rho)) continue;
            const behind = (rho - dHi[i]) / (dHi[i] - lo + 1e-6); // half cells behind the crest
            if (behind <= 0) paint[i] = crest;
            else if (behind < 2.5 && strength > 0.25) paint[i] = behind < 1.2 && strength > 0.5 ? GLOW + 1 : GLOW;
          }
          for (const [gi, d] of crackCells) {
            const c = (gi % W) - ox, r = ((gi / W) | 0) - rg, since = ((rho - d) / RHO) * (T.ring - T.land); // story seconds since the ring passed it
            if (since < 0 || since > 0.7 || c < 0 || c >= cols || r < 0 || r >= rows) continue;
            const i = r * cols + c, lit = 1 - since / 0.7;
            ink[i] = lit > 0.45 ? CRACK + 2 : CRACK + 1; bold[i] = lit > 0.45 ? 1 : 0;
          }
        }

        // The figure. Its hair and the edges of its sleeves stir; nothing else moves.
        for (let y = fy0; y < Math.ceil(crown + fh); y++) {
          const sy = y + gy, b = (y + 0.5 - crown) / fh;
          if (sy < 0 || sy >= lines) continue;
          for (let x = fx0; x <= fx1; x++) {
            const sx = x + gx;
            if (sx < 0 || sx >= cols) continue;
            const m = figureAt((x + 0.5 - xf) / fw, b, sway, t, flap);
            if (m) { paint[sy * cols + sx] = m; held[(sy >> 1) * cols + sx] |= 1 + (sy & 1); }
          }
        }
        for (let r = Math.max(0, (fy0 + gy) >> 1); r <= Math.min(rows - 1, (Math.ceil(crown + fh) + gy) >> 1); r++) {
          for (let c = Math.max(0, fx0 + gx); c <= Math.min(cols - 1, fx1 + gx); c++) {
            const i = r * cols + c;
            if (!held[i]) continue;
            glyph[i] = 32; wash[i] = 0;
            const a = Math.abs((c - gx + 0.5 - xf) / fw), b = (2 * r + 1 - gy - crown) / fh;
            if (held[i] === 3 && fw >= 14 && Math.abs(a - 0.15 - 0.03 * b) < 0.025 && b > 0.4 && b < 0.84) { glyph[i] = BAR; ink[i] = ROBE + 3; } // a fold where the sleeve hangs
          }
        }

        // The one petal: the brightest small thing near the figure, with a
        // faint light round it, turning as it falls; then it lies on the ice.
        if (s > T.petal) {
          const falling = s < T.land + 0.25, [px, py] = s < T.land ? heroAt(s) : [landX, landY];
          const c = Math.floor(px + gx), y = Math.floor(py + gy), r = y >> 1;
          if (c >= 0 && c < cols && y >= 0 && y < lines) {
            const i = r * cols + c, turn = Math.floor(t * 7) & 1;
            if (falling) {
              paint[2 * r * cols + c] = turn ? PETAL : PETAL + 1; paint[(2 * r + 1) * cols + c] = turn ? PETAL + 1 : PETAL;
              glyph[i] = 32;
              for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
                const cc = c + dc, rr = r + dr;
                if ((dc || dr) && cc >= 0 && cc < cols && rr >= 0 && rr < rows && !held[rr * cols + cc]) wash[rr * cols + cc] = dc && dr ? SHINE + 1 : SHINE;
              }
            } else { paint[y * cols + c] = PETAL + 1; if (!held[i]) glyph[i] = 32; }
          }
        }
        // The other petals, drifting down to the left, and lying where they came down.
        for (const q of drifting) {
          const age = t - q.t0;
          if (age < 0) continue;
          const life = Math.min(age, q.fall), c = Math.floor(q.x + q.vx * life + q.amp * Math.sin(q.freq * life + q.phase) + gx), r = Math.floor(q.y + q.vy * life + gy) >> 1;
          if (c < 0 || c >= cols || r < 0 || r >= rows || held[r * cols + c]) continue;
          const i = r * cols + c;
          glyph[i] = age < q.fall ? TUMBLE[Math.floor(age * 5 + q.phase) & 3] : COMMA; ink[i] = q.ink; bold[i] = 0;
        }

        // Fine snow falls straight down at three depths, and slides down with
        // the ground while the camera tilts up. It thickens into a flurry at the end.
        const lift = (TG * p) / 2, thick = 1 + 2.2 * smooth(T.flurry, T.sweep, s);
        for (let r = 0, i = 0; r < rows; r++) for (let c = 0; c < cols; c++, i++) {
          for (let k = 0; k < FLAKES.length; k++) {
            const [speed, period, chance] = FLAKES[k], q = Math.floor(r - lift - speed * t), slot = Math.floor(q / period);
            if (q - slot * period !== Math.floor(hash(c * 3 + k, slot + 977) * period) || hash(c * 3 + k + 1, slot) > chance * thick) continue;
            const h = hash(c, slot);
            glyph[i] = k === 0 ? (h < 0.1 ? STAR : h < 0.75 ? HIGH : DOT) : k === 1 && h < 0.4 ? HIGH : DOT;
            ink[i] = FLAKE + 3 - k; bold[i] = 0;
            break;
          }
        }

        // The ending: the flurry carries the picture away, falling from the
        // top down. Its flakes stream through it; behind its ragged front only
        // a last few flakes are left, and then none.
        if (s > T.sweep) {
          const k = (s - T.sweep) / (T.end - T.sweep), band = 0.22 * lines, front = lerp(-0.1, 1.5, k) * lines, down = Math.floor(t * 36);
          for (let x = 0; x < cols; x++) {
            const edge = front + (noise(x * 0.07 + o[9], k * 2) - 0.5) * 0.26 * lines;
            for (let y = 0, end = Math.min(lines, Math.ceil(edge)); y < end; y++) {
              const into = (edge - y) / band, i = y * cols + x;
              if (into >= 1 || hash(x * 7 + 3, y) < into) paint[i] = 0; // the flurry has taken it
              if (into < 1.4 && hash(x * 13 + 5, y - down) < 0.2 * (1 - into / 1.4)) paint[i] = FLAKE + 1 + (hash(x, y - down) < 0.5 ? 1 : 0); // flakes streaming down through it
            }
            for (let r = 0; r < rows; r++) {
              const into = (edge - 2 * r - 1) / band, i = r * cols + x;
              if (into <= 0) break;
              wash[i] = 0;
              if (into >= 1 || hash(x * 11 + 1, r) < into) glyph[i] = 32;
              const h = hash(x * 5 + 2, r - (down >> 1));
              if (into < 1.4 ? h < 0.35 * (1 - into / 1.4) : h < 0.03 * (1 - k)) { glyph[i] = h < 0.01 ? STAR : h < 0.12 ? HIGH : DOT; ink[i] = FLAKE + 2 + (h < 0.05 ? 1 : 0); bold[i] = 0; }
            }
          }
        }
        return this;
      },
    };
  }

  // Play it on the stage. Resolves when it has finished. `seed` changes the
  // cracks, the snow on the ice, the boughs, the rocks, the stars and the
  // petals; reduced motion holds the ring of light round the fallen petal.
  const film = { length: LENGTH, still: 4.6 / SPEED, createScene };
  return { play: (options) => AsciiStage.play(film, options), createScene };
})();
