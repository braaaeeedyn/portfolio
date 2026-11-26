/*
 * Butterfly in the snow: an ASCII loading screen.
 *
 *   <script src="ascii-stage.js"></script>
 *   <script src="snow-butterfly.js"></script>
 *   <script>SnowButterfly.play().then(showThePage);</script>
 *
 * Seen from high above and in front, on bright snow in cold winter light from
 * the upper right: a tall man in pale green-white robes and a thick white fur
 * collar stands on the left with his eyes closed, under a brown oil-paper
 * umbrella with snow on it, and his vivid red cloak streams out to the right
 * in the wind. At his lower right a small white-haired child with two pointed
 * animal ears, in red over green, reaches up on tiptoe for a glowing green
 * butterfly. The butterfly flies one slow clockwise circle round the child's
 * head, and the child turns in little hops to follow it, leaving marks in the
 * snow; the child jumps, closes both hands just under it and misses. The
 * butterfly spirals up and out of the top trailing green light, while the man
 * slowly opens his eyes and turns his head to look down at the child, his
 * smile widening. The child lowers both arms and looks up after it. Then the
 * wind lifts a flurry of snow and red petals from the left that carries the
 * picture off to the right and thins away to show the page. Plum branches
 * cross the top and reach in from the lower left, close to the camera and out
 * of focus. The camera never moves.
 *
 * The whole of it lasts five seconds (LENGTH, below) and is a pure function of
 * time: createScene().render(t) fills a grid of characters and the colours
 * behind them, and the stage (ascii-stage.js) paints that grid on a canvas.
 */
const SnowButterfly = (() => {
  'use strict';
  const { code, clamp01, lerp, smooth, mulberry32, hash, noise } = AsciiStage;

  // The story's timeline, in the seconds of the user's description.
  const T = {
    circle: 1.5, // the butterfly sets off round the child, who turns to follow it in little hops
    jump: 4.0,   // the child crouches, jumps, closes both hands just under it and misses
    rise: 5.5,   // the butterfly spirals up and out of the top; he opens his eyes and looks down at the child
    lower: 8.0,  // the child lowers both arms and looks up after it
    gust: 9.9,   // the wind lifts a flurry of snow and petals from the left that carries the picture off
    end: 11.3,
  };
  // It is played faster than that. LENGTH is how many seconds the whole of it
  // takes on screen, and SPEED how many times faster than the story that is.
  // The falling snow, the cloak and the wingbeat keep to screen time, so that
  // they stay as slow (or as quick) as the description has them.
  const LENGTH = 5, SPEED = T.end / LENGTH;
  const TRAIL = 0.4 * SPEED; // how far back the butterfly's trail of light reaches, in story seconds
  const DEG = Math.PI / 180;

  // Colours. `swatch` adds a run of colours to INK and gives the index of the first.
  const INK = ['#000000'];
  const swatch = (...colours) => INK.push(...colours) - colours.length;
  const SNOW = swatch('#465779', '#566a8d', '#6b83a3', '#86a0b9', '#a2bccd', '#bdd2dd', '#d5e4ea', '#e8f0f2', '#f6f9f9', '#ffffff'); // deep blue shadow to sunlit, then a glint
  const ICE = swatch('#8fb6cc', '#a9cde0', '#c2e0ee', '#d9eef6', '#f0fafd'); // the strip of ice across the top, darker to the glint on it
  const REED = swatch('#55493f', '#3b332d'); // dry reeds standing out of the snow at the edge of the ice
  const ROBE = swatch('#4f7069', '#668a80', '#81a397', '#9fbcaf', '#bdd3c6', '#d6e4d8', '#e9f0e3', '#f8f8ea'); // his pale green-white robes, deep fold to sunlit cream
  const FUR = swatch('#9db0bb', '#bccbd3', '#d8e2e7', '#eef3f5', '#ffffff'); // white fur and white hair, shadow to light
  const CLOAK = swatch('#5e0f20', '#7c1529', '#9d1c33', '#bd243e', '#d8344c', '#ea5463', '#f4818a', '#f9b0b4'); // the red cloak, deep fold to the sheen of the light on it
  const PAPER = swatch('#4e3322', '#69462e', '#84593a', '#9d6d47', '#b48257', '#c99a6c', '#dbb489'); // the oil-paper umbrella, its ribs to its sunlit panels
  const GRIP = swatch('#211a18', '#3b302b'); // its handle
  const HAIR = swatch('#141018', '#231c26', '#3a3242', '#5a5470'); // his black hair, with its cool sheen
  const SKIN = swatch('#fbf4f2', '#f4e7e2', '#ead6cf', '#dabfb6', '#c39f97'); // pale skin, cooled by the winter light
  const LINE = swatch('#a87c70'), LIP = swatch('#d4868e'), MOUTH = swatch('#9a4552'); // fine lines, lips, the child's open mouth
  const BELT = swatch('#262c36', '#3c4652', '#5f6b78');
  const PINK = swatch('#b84676', '#dc6f9c', '#f2a3c3'); // the tassel at his belt
  const KIMONO = swatch('#6a1b1f', '#8e2a29', '#b03b33', '#cc5442', '#e07a62'); // the child's red outer robe
  const GREEN = swatch('#1f3d36', '#2d5547', '#40705b'); // and the green under it
  const SHOE = swatch('#29222a');
  const EAR = swatch('#efc0c8'); // the inside of the child's ears
  const WOOD = swatch('#231a20', '#32252c', '#45343c', '#5b4850'); // the near plum branches, out of focus
  const BLOOM = swatch('#7d1526', '#a51d33', '#c92c44', '#e44b5f', '#f27c8a'); // plum blossom and its petals
  const WING = swatch('#36c47d', '#66eba2', '#aaffd0', '#effff5'); // the butterfly, the one green light
  const GLEAM = swatch('#2aa56b', '#45c886', '#6fe4a7', '#b0fbd3'); // its trail, fading
  const GLOW = swatch('rgba(110,255,175,0.08)', 'rgba(110,255,175,0.16)', 'rgba(140,255,195,0.27)'); // the light it gives off
  const SEAL = swatch('#b3302c');
  const HAZE = swatch('rgba(40,30,38,0.22)', 'rgba(205,45,70,0.2)'); // the blur round the near branches and round their blossoms
  const FLURRY = swatch(...Array.from({ length: 10 }, (_, i) => `rgba(247,250,252,${((i + 1) / 10).toFixed(2)})`)) - 1; // the closing flurry: FLURRY + 1, thinnest, to FLURRY + 10, solid white

  const [BAR, SLASH, BACK, LOW, DASH, HIGH, TICK, COMMA, DOT, RING, AT, STAR, OPEN, SHUT, EQUAL, HASH] = code("|/\\_-'`,.o@*()=#");
  const WINGS = [code('}{'), code(')('), code('||'), code(')(')]; // the butterfly's wingbeat
  const FLAKES = code(".'.*"), PETAL = code("',`."), STREAK = code("-~-=_-'.");
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  // Where things are, in the painting's own pixels (it is 736 wide and 1242
  // tall): x across from its left edge, y down from its top. The camera looks
  // down from high up in front, so a step toward the camera shows as K of a
  // step down the screen.
  const BOX = [0, 190, 736, 1135]; // the part always in view: from the umbrella's crown to below his feet
  const K = 0.4;

  // The man. He never moves but for his head, the ends of his hair, his
  // sleeves and his hem stirring in the wind. His head is drawn HEAD[2] times
  // larger than painted, about the middle of his neck, so that his eyes can
  // be seen to open on a desktop screen.
  const HEAD = [244, 440, 1.25];
  const SKULL = [240, 396, 36, 54];  // his hair round his head: middle, half width, half height
  const FACE = [243, 406, 21, 30];   // his face, the same
  const LOCKS = [[204, 388, 222, 388, 216, 450, 212, 505, 206, 548, 190, 552, 186, 505, 192, 450], // his hair falling over his shoulders
    [262, 388, 278, 390, 284, 440, 290, 490, 292, 536, 280, 540, 274, 490, 266, 440]];
  const SKIRT = [182, 612, 290, 614, 320, 650, 355, 700, 395, 760, 430, 830, 455, 900, 465, 958, 450, 980, 410, 1005, 360, 1030, 310, 1048,
    275, 1058, 232, 1062, 190, 1056, 160, 1045, 155, 1010, 152, 940, 157, 850, 165, 760, 175, 680];
  const TORSO = [196, 462, 282, 462, 292, 614, 182, 614];
  const LSLEEVE = [120, 482, 175, 488, 186, 560, 190, 650, 194, 755, 150, 766, 100, 752, 90, 690, 84, 610, 82, 568, 96, 520];
  const RSLEEVE = [292, 486, 340, 500, 400, 530, 455, 560, 492, 605, 503, 655, 490, 712, 452, 736, 400, 740, 360, 732, 325, 700, 302, 640];
  const SASH = [186, 578, 284, 574, 287, 610, 184, 613];
  const LAPELS = [204, 430, 300, 424, 252, 512]; // the crossed collars of his robes, a V under his chin
  const FURS = [[156, 440, 44, 34], [230, 452, 58, 20], [326, 422, 64, 56], [352, 478, 40, 26]]; // his fur collar, in puffs: middle, half width, half height
  const SHOES = [[221, 1076, 22, 24], [355, 975, 11, 16]];
  const CANOPY = [95, 335, 205, 95, -22 * DEG]; // the umbrella: middle, half length, half width, tilt
  const APEX = [40, 318];                       // where its ribs meet
  const SHAFT = [40, 440, 85, 645];             // its handle, from under the canopy down past his hand
  const FIST = [67, 565, 13, 11];               // his hand on it
  // The cloak: a line from his shoulders out to its end, and its half width along it.
  const CAPE = [[290, 432, 40], [420, 452, 85], [600, 535, 116], [736, 556, 104], [830, 566, 86], [884, 572, 30]];
  const CHILD = [525, 922, 250]; // where the child's feet first stand, and the child's height, ears and all
  const STAMP = [389, 954, 405, 977]; // the seal

  // The near plum branches, each [width at its base, at its tip, then the
  // points it passes through]. They come in from beyond the painting, so that
  // a wider or taller screen sees more of them.
  const BOUGHS = [
    [26, 7, -60, -150, 60, -40, 170, 12, 300, 32, 420, 55, 500, 95, 590, 128, 680, 182, 790, 236, 870, 300],
    [44, 18, -260, -90, -90, 5, 40, 48, 120, 72, 180, 98],
    [13, 5, -160, 92, -40, 112, 60, 125, 180, 118, 330, 105, 410, 96],
    [15, 5, -140, 186, -20, 210, 60, 228, 170, 246, 270, 262, 345, 300],
    [20, 7, 1080, -160, 960, -40, 870, 40, 800, 100, 735, 130],
    [18, 6, -560, 1190, -300, 965, -150, 862, -20, 864, 60, 922, 105, 976, 128, 1050, 150, 1130, 175, 1250, 190, 1420],
    [7, 3, 105, 976, 160, 1000, 250, 1040, 310, 1075, 365, 1112],
  ];

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
    const N = cols * rows, H2 = rows * 2;
    const glyph = new Uint8Array(N), ink = new Uint8Array(N), bold = new Uint8Array(N), wash = new Uint8Array(N);
    const paint = new Uint8Array(N * 2), who = new Uint8Array(N * 2), depth = new Float32Array(N * 2);

    // Layout. The painting's always-seen part is as large as the screen
    // allows, in the middle. A wider screen sees more snow, ice and branches
    // at the sides, a taller one more above and below. A half cell is A times
    // as tall as it is wide, so a painting pixel is S half rows tall and SA
    // columns wide.
    const A = aspect / 2, S = Math.min(H2 / (BOX[3] - BOX[1]), cols / ((BOX[2] - BOX[0]) * A)), SA = S * A;
    const x0 = (BOX[0] + BOX[2]) / 2 - cols / 2 / SA, y0 = (BOX[1] + BOX[3]) / 2 - rows / S; // the painting's point at the screen's top left corner
    const X = (c) => x0 + (c + 0.5) / SA, Y = (h) => y0 + (h + 0.5) / S; // the painting's point at the middle of a column, a half row
    const top = y0, left = x0, right = x0 + cols / SA;

    // Every half cell whose middle is inside a box, a polygon or a capsule:
    // fn(c, h, x, y). Each is at least a half cell across, so nothing thin is lost on a small screen.
    function box(xa, ya, xb, yb, fn) {
      const c0 = Math.max(0, Math.ceil((xa - x0) * SA - 0.5)), c1 = Math.min(cols - 1, Math.floor((xb - x0) * SA - 0.5));
      const h0 = Math.max(0, Math.ceil((ya - y0) * S - 0.5)), h1 = Math.min(H2 - 1, Math.floor((yb - y0) * S - 0.5));
      for (let h = h0; h <= h1; h++) for (let c = c0, y = Y(h); c <= c1; c++) fn(c, h, X(c), y);
    }
    const cross = new Float64Array(64);
    function poly(pts, fn) {
      let ya = Infinity, yb = -Infinity;
      for (let i = 1; i < pts.length; i += 2) { ya = Math.min(ya, pts[i]); yb = Math.max(yb, pts[i]); }
      const n = pts.length >> 1, h0 = Math.max(0, Math.ceil((ya - y0) * S - 0.5)), h1 = Math.min(H2 - 1, Math.floor((yb - y0) * S - 0.5));
      for (let h = h0; h <= h1; h++) {
        const y = Y(h);
        let k = 0;
        for (let i = 0, j = n - 1; i < n; j = i++) {
          const yi = pts[i * 2 + 1], yj = pts[j * 2 + 1];
          if ((yi > y) === (yj > y)) continue;
          const x = pts[i * 2] + ((y - yi) / (yj - yi)) * (pts[j * 2] - pts[i * 2]);
          let m = k++;
          for (; m > 0 && cross[m - 1] > x; m--) cross[m] = cross[m - 1];
          cross[m] = x;
        }
        for (let m = 0; m + 1 < k; m += 2) {
          const c0 = Math.max(0, Math.ceil((cross[m] - x0) * SA - 0.5)), c1 = Math.min(cols - 1, Math.floor((cross[m + 1] - x0) * SA - 0.5));
          for (let c = c0; c <= c1; c++) fn(c, h, X(c), y);
        }
      }
    }
    function capsule(xa, ya, xb, yb, ra, rb, fn) { // fn also gets how far along (0 to 1) and how far out to the left of the way it runs (-1 to 1)
      const r = Math.max(ra, rb, 0.55 / S), dx = xb - xa, dy = yb - ya, l2 = dx * dx + dy * dy || 1e-9;
      box(Math.min(xa, xb) - r, Math.min(ya, yb) - r, Math.max(xa, xb) + r, Math.max(ya, yb) + r, (c, h, x, y) => {
        const k = clamp01(((x - xa) * dx + (y - ya) * dy) / l2), ex = x - xa - dx * k, ey = y - ya - dy * k, w = Math.max(lerp(ra, rb, k), 0.55 / S);
        if (ex * ex + ey * ey <= w * w) fn(c, h, x, y, k, (ex * dy - ey * dx) / (w * Math.sqrt(l2)));
      });
    }
    const dot = (c, h, colour, part) => { const p = h * cols + c; paint[p] = colour; who[p] = part; glyph[(h >> 1) * cols + c] = 32; }; // whatever is painted over loses the character it had
    const put = (c, r, g, colour, heavy = 0) => { if (c >= 0 && c < cols && r >= 0 && r < rows) { const i = r * cols + c; glyph[i] = g; ink[i] = colour; bold[i] = heavy; } };
    const dither = (c, h) => ((BAYER[(h & 3) * 4 + (c & 3)] + 0.5) / 16 - 0.5) * 0.6; // small, so that it only breaks up the edges between tones
    const cellOf = (x) => (x - x0) * SA, rowOf = (y) => ((y - y0) * S) / 2; // a point's column and row, unrounded

    // ---- The ground, worked out once: snow, its shadows, the strip of ice
    // across the top with reeds along it, and petals lying about.
    const iceTop = (x) => 214 + 26 * Math.sin(x / 270 + 0.8) + 30 * noise(x / 150, 3.1);
    const iceBot = (x) => 318 + 30 * Math.sin(x / 240 + 2.1) + 34 * noise(x / 130, 7.7);
    const seg = (x, y, ax, ay, bx, by) => { // distance from (x, y) to the segment a-b
      const dx = bx - ax, dy = by - ay, k = clamp01(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy));
      return Math.hypot(x - ax - dx * k, y - ay - dy * k);
    };
    // How deep in shadow the snow is at (x, y), 0 sunlit to 1 deepest. The
    // sun is at the upper right, so shadows fall toward the lower left.
    function shadow(x, y) {
      const far = clamp01(1 - (y - 150) / 900); // features shrink with distance
      let sh = 0.1 * noise(x / (150 - 70 * far), y / (90 - 40 * far));
      sh = Math.max(sh, 0.2 * smooth(0.6, 0.76, noise(x / (190 - 60 * far) + 9, y / (105 - 35 * far) + 4))); // soft hollows
      sh = Math.max(sh, 0.5 * (1 - smooth(0.75, 1.05, Math.hypot((x - 40) / 190, (y - 770) / 120)))); // the umbrella's
      sh = Math.max(sh, 0.72 * (1 - smooth(0.7, 1.1, seg(x, y, 250, 1060, 40, 1320) / 95))); // his
      // the trees behind the camera; past the bottom of the painting (a tall screen) the sun gets through them more
      const low = smooth(1050, 1110, y + 90 * (noise(x / 160, 2.5) - 0.5)) * lerp(0.82, 0.45, smooth(-0.05, 0.05, noise(x / 90 + 4, y / 40) - 0.7 + 0.24 * smooth(1240, 1460, y)));
      sh = Math.max(sh, low);
      if (x > 300 && y > 900) for (let k = 0; k < 4; k++) { // long shadows of branches out of sight, across the sunlit snow at the lower right
        const yb = 925 + k * 52 + 38 * Math.sin(x / 118 + k * 1.7) + 0.12 * (x - 500);
        if (Math.abs(y - yb) < 7 + 3 * Math.sin(x / 47 + k)) sh = Math.max(sh, 0.38);
      }
      const bank = iceBot(x);
      if (y < bank + 34) sh = Math.max(sh, 0.32 * (1 - (y - bank) / 34)); // the bank drops to the ice
      return sh;
    }
    const ground = new Uint8Array(N * 2), still = new Uint8Array(N).fill(32), stillInk = new Uint8Array(N);
    const ICY = 1, FIELD = 2, BANK = 3;
    const kind = new Uint8Array(N * 2);
    for (let h = 0, p = 0; h < H2; h++) {
      const y = Y(h);
      for (let c = 0; c < cols; c++, p++) {
        const x = X(c), d = dither(c, h), a = iceTop(x), b = iceBot(x);
        let colour, what = FIELD;
        if (y < a) { // the far bank, mostly in shade, with lumps of snow in the sun
          const lump = smooth(-0.04, 0.04, noise(x / 110 + 3, y / 45 + 1) - 0.6 - 0.1 * smooth(a - 40, a, y));
          const sh = lerp(0.45 + 0.25 * noise(x / 90, y / 40) + 0.15 * smooth(150, -150, y), 0.12, lump);
          colour = SNOW + Math.max(0, Math.min(8, Math.round((1 - sh) * 8 + d))); what = BANK;
        } else if (y < b) { // the ice, with glints along it and snowy rocks in it
          const rock = noise(x / 34 + 11, y / 16 + 5);
          if (rock > 0.74) colour = SNOW + (noise(x / 20, y / 12 + 3) > 0.55 && rock < 0.8 ? 5 : 8);
          else colour = ICE + Math.max(0, Math.min(3, Math.floor(1.5 + 2.6 * (noise(x / 70, y / 14) - 0.5) + d + (y - a < 10 ? -1 : 0))));
          if (rock <= 0.74 && noise(x / 40 + 7, y / 7) > 0.74) colour = ICE + 4;
          what = ICY;
        } else colour = SNOW + Math.max(0, Math.min(8, Math.round((1 - shadow(x, y)) * 8 + d)));
        ground[p] = colour; kind[p] = what;
      }
    }
    // The ground's own characters: grain in the snow, glints on the ice,
    // reeds along its banks and red petals lying about. Sparse: the snow is smooth.
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c, p = r * 2 * cols + c, x = X(c), y = (Y(r * 2) + Y(r * 2 + 1)) / 2, n = hash(c + 17 * seed, r + 31);
      const upper = ground[p], lower = ground[p + cols];
      if (kind[p] !== kind[p + cols]) continue;
      if (kind[p] === ICY) {
        if (upper >= ICE && n < 0.06) { still[i] = n < 0.02 ? EQUAL : DASH; stillInk[i] = n < 0.035 ? ICE + 4 : ICE; }
      } else if (n < 0.022 * (y < iceTop(x) ? 0.5 : 1)) { // grain, a step darker than the snow it lies on
        still[i] = PETAL[(n * 1000) & 3]; stillInk[i] = Math.max(SNOW, Math.min(upper, lower) - 2);
      } else if (n > 0.985 && lower - SNOW < 7) { still[i] = n > 0.995 ? STAR : HIGH; stillInk[i] = SNOW + 9; } // a glint in the shade
      const petal = hash(c * 3 + seed, r * 7 + 11), near = 1 + 2 * smooth(800, 1150, y) * smooth(500, 100, x);
      if (kind[p] === FIELD && petal < 0.006 * near) { still[i] = petal < 0.0015 * near ? STAR : PETAL[(petal * 9000) & 3]; stillInk[i] = BLOOM + 2 + ((petal * 3e4) & 1); }
    }
    for (let x = Math.floor(left / 40) * 40; x < right; x += 40) { // a few clumps of reeds along both banks
      for (const edge of [iceTop, iceBot]) {
        const n = hash(Math.round(x / 40) + 5 * seed, edge === iceTop ? 3 : 9);
        if (n > 0.09) continue;
        const bx = x + 40 * n, by = edge(bx) + (edge === iceTop ? 4 : -2), tall = 30 + 50 * hash(Math.round(x), 7);
        for (let j = 0; j < 3; j++) {
          const lean = (j - 1) * 0.25 + 0.15;
          line(cellOf(bx + j * 6), rowOf(by), cellOf(bx + j * 6 + lean * tall), rowOf(by - tall * (0.6 + 0.2 * j)), (c, r, g) => {
            if (c >= 0 && c < cols && r >= 0 && r < rows) { still[r * cols + c] = g; stillInk[r * cols + c] = REED + (j & 1); }
          });
        }
      }
    }

    // ---- The near plum branches, grown once from BOUGHS (and, on a screen
    // wider than the painting, more of the same at the sides): wood, caps of
    // snow on the level parts, twigs, blossoms and buds.
    const wood = [], blooms = []; // wood: [x0, y0, x1, y1, r0, r1, snow?, sway arm]; blooms: [x, y, radius, tone, sway arm]
    const boughs = BOUGHS.map((b) => b.slice());
    for (const side of [-1, 1]) { // more at the sides, hanging in from above and reaching toward the middle
      for (let x = side < 0 ? -330 : 1010; side < 0 ? x > left - 250 : x < right + 250; x += side * R(250, 340)) {
        const sx = x, sy = Math.min(-150, top - 60), ex = x - side * R(240, 380), ey = R(200, 290), n = 6, pts = [R(14, 22), R(4, 7)];
        for (let i = 0; i <= n; i++) { // a zigzag that droops between its ends
          const k = i / n, wob = i && i < n ? R(-1, 1) * 22 : 0;
          pts.push(lerp(sx, ex, k) + wob * 0.6, lerp(sy, ey, k ** 0.8) + 60 * Math.sin(Math.PI * k) + wob);
        }
        boughs.push(pts);
      }
    }
    for (const [w0, w1, ...pts] of boughs) {
      const n = pts.length / 2 - 1, base = [pts[0], pts[1]];
      let total = 0;
      for (let i = 0; i < n; i++) total += Math.hypot(pts[i * 2 + 2] - pts[i * 2], pts[i * 2 + 3] - pts[i * 2 + 1]);
      for (let i = 0, run = 0; i < n; i++) {
        const xa = pts[i * 2], ya = pts[i * 2 + 1], xb = pts[i * 2 + 2], yb = pts[i * 2 + 3], l = Math.hypot(xb - xa, yb - ya);
        const ra = lerp(w0, w1, run / total) / 2, rb = lerp(w0, w1, (run + l) / total) / 2, level = Math.abs(yb - ya) < Math.abs(xb - xa) * 0.9;
        wood.push([xa, ya, xb, yb, ra, rb, level && ra > 3.5, Math.hypot(xa - base[0], ya - base[1])]);
        run += l;
        if (rand() < 0.7) blooms.push([xb + R(-4, 4), yb + R(-6, 2), R(7, 11), (rand() * 4) | 0, run]); // a blossom at the joint
        if (ra < 3 || rand() < 0.25) continue;
        // a twig from the middle of this run, with a blossom at its tip and buds along it
        const k = R(0.3, 0.7), tx = lerp(xa, xb, k), ty = lerp(ya, yb, k), dir = Math.atan2(yb - ya, xb - xa) + (rand() < 0.5 ? -1 : 1) * R(35, 70) * DEG;
        let qx = tx, qy = ty, d = dir;
        for (let j = 0; j < 2; j++) {
          const tl = R(30, 60), nx = qx + Math.cos(d) * tl, ny = qy + Math.sin(d) * tl;
          wood.push([qx, qy, nx, ny, 2.2 - j * 0.6, 1.6 - j * 0.6, false, Math.hypot(nx - base[0], ny - base[1])]);
          blooms.push([lerp(qx, nx, 0.5) + R(-3, 3), lerp(qy, ny, 0.5) + R(-3, 3), R(4, 6), 0, Math.hypot(nx - base[0], ny - base[1])]);
          qx = nx; qy = ny; d += R(-30, 30) * DEG;
        }
        blooms.push([qx, qy, R(8, 12), 1 + ((rand() * 3) | 0), Math.hypot(qx - base[0], qy - base[1])]);
      }
    }
    // The branches sway very slightly: each turns a little about its base.
    // `arm` (how far from the base) sets how far a point is carried.
    const sway = (arm, t) => arm * 0.004 * Math.sin(t * 1.1 + arm * 0.004);

    // ---- Things that fall: snow, slowly and drifting right, at three
    // distances; and a few petals let go by the branches above.
    const flakes = Array.from({ length: Math.round(N * 0.008) }, () => {
      const nearer = rand();
      return { x: R(0, cols), y: R(0, rows), fall: rows * (0.07 + 0.09 * nearer), drift: R(0.3, 0.6), wob: R(0.3, 1.2), freq: R(1, 2.5), ph: R(0, 6.28), g: nearer > 0.9 ? 3 : nearer > 0.6 ? 1 : 0 };
    });
    const tops = blooms.filter((b) => b[1] < 320);
    const petals = Array.from({ length: Math.max(3, Math.round(cols * 0.04)) }, () => {
      const b = tops.length ? tops[(rand() * tops.length) | 0] : [R(left, right), 100];
      return { x: b[0], y: b[1], t0: R(-4, 4), fall: R(55, 95), drift: R(40, 80), wob: R(8, 20), freq: R(1.5, 3), ph: R(0, 6.28), tone: 2 + ((rand() * 2) | 0) };
    });

    // ---- The man.
    const hk = HEAD[2], headX = (x) => HEAD[0] + (x - HEAD[0]) / hk, headY = (y) => HEAD[1] + (y - HEAD[1]) / hk; // a point on screen, back where it was painted on his head
    const MAN = [Math.min(FIST[0] - 20, 60), (SKULL[1] - SKULL[3] - HEAD[1]) * hk + HEAD[1] - 10, 520, 1110]; // the box he stands in
    const P_SKIRT = 1, P_SLEEVE = 2, P_SASH = 3, P_TASSEL = 4, P_FUR = 5, P_LAPEL = 6, P_LOCK = 7, P_HAIR = 8, P_FACE = 9, P_SHAFT = 10, P_HAND = 11, P_SHOE = 12, P_CLOAK = 13, P_CANOPY = 14;
    const moved = new Float64Array(64);
    const stir = (pts, from, amp, t, ph) => { // a copy of pts whose points beyond `from` (down the screen) flutter to the right
      for (let i = 0; i < pts.length; i += 2) {
        const k = Math.max(0, pts[i + 1] - from) / 100;
        moved[i] = pts[i] + amp * k * (0.6 + Math.sin(t * 1.7 + ph + pts[i + 1] * 0.02)); moved[i + 1] = pts[i + 1];
      }
      return moved.subarray(0, pts.length);
    };
    function drawMan(s, t) {
      const open = smooth(5.6, 7.0, s), turn = smooth(5.9, 7.4, s), smile = smooth(6.4, 7.9, s);
      for (const [x, y, rx, ry] of SHOES) box(x - rx, y - ry, x + rx, y + ry, (c, h, px, py) => {
        if (((px - x) / rx) ** 2 + ((py - y) / ry) ** 2 < 1) dot(c, h, py < y - ry * 0.3 ? HAIR + 1 : HAIR, P_SHOE);
      });
      // his robes: the left panel of his coat in shade, the inner robe, the right panel in the sun
      poly(stir(SKIRT, 900, 5, t, 0), (c, h, x, y) => {
        const xo = 232 + (y - 612) * 0.09, xr = 300 + (y - 612) * 0.25, d = dither(c, h);
        const fold = Math.sin(x * 0.11 + 3 * noise(y / 80, x / 40)) > 0.86 ? -1 : 0;
        const tone = x < xo ? 1.6 + 1.6 * clamp01((x - 160) / (xo - 160)) : x < xr ? 4.6 - (x - xo < 8 ? 1 : 0) : 6.4 - (x - xr < 10 ? 1.4 : 0);
        dot(c, h, ROBE + Math.max(0, Math.min(7, Math.round(tone + d + fold))), P_SKIRT);
      });
      poly(TORSO, (c, h, x, y) => dot(c, h, ROBE + (x > 255 ? 6 : 4), P_SKIRT));
      poly(stir(LSLEEVE, 700, 3, t, 2), (c, h, x, y) => {
        const tone = x > 178 ? 6 : 1.5 + 3 * clamp01((x - 84) / 100) - (y > 740 ? 1 : 0) + (Math.sin(x * 0.16 + y * 0.012) > 0.9 ? -1 : 0);
        dot(c, h, ROBE + Math.max(0, Math.min(7, Math.round(tone + dither(c, h)))), P_SLEEVE);
      });
      poly(stir(RSLEEVE, 560, 4, t, 4), (c, h, x, y) => {
        const inside = x < 345 && y > 665, tone = inside ? 1.4 : y < 575 ? 7 : y < 650 ? 6 - (y - 575) / 75 : 4.6 - (y - 650) / 50;
        dot(c, h, ROBE + Math.max(0, Math.min(7, Math.round(tone + dither(c, h) + (Math.sin((x - y) * 0.07) > 0.92 ? -1 : 0)))), P_SLEEVE);
      });
      poly(SASH, (c, h) => dot(c, h, BELT + ((c + (h >> 1)) % 3 === 0 ? 1 : 0), P_SASH));
      const swing = 3 * Math.sin(t * 2.2);
      capsule(278, 610, 279 + swing * 0.3, 650, 1.6, 1.6, (c, h) => dot(c, h, PINK, P_TASSEL));
      capsule(279 + swing * 0.3, 652, 280 + swing, 700, 5, 8, (c, h, x, y, k, o) => dot(c, h, PINK + (o < -0.2 ? 2 : 1), P_TASSEL));
      for (const [cx, cy, rx, ry] of FURS) box(cx - rx * 1.15, cy - ry * 1.15, cx + rx * 1.15, cy + ry * 1.15, (c, h, x, y) => { // fluffy: its edge rises and falls round it
        const dx = (x - cx) / rx, dy = (y - cy) / ry, a = Math.atan2(dy, dx), e = Math.hypot(dx, dy) / (1 + 0.1 * Math.sin(a * 9 + cx) + 0.05 * Math.sin(a * 17));
        if (e < 1) dot(c, h, FUR + Math.max(0, Math.min(4, Math.round(2.5 + (dx * 0.6 - dy * 0.8) * 1.6 - (e > 0.82 ? 1 : 0) + dither(c, h)))), P_FUR);
      });
      poly(LAPELS, (c, h, x, y) => dot(c, h, x > 250 ? ROBE + 6 : ROBE + 4, P_LAPEL));
      // his head, drawn larger than painted (see HEAD): hair, face, the hair framing it, his features
      const fx = FACE[0] + 5 * turn, fy = FACE[1] + 2 * turn, part = fx - 1 + 4 * turn;
      const big = (y0r) => HEAD[1] + (y0r - HEAD[1]) * hk, wide = (x0r) => HEAD[0] + (x0r - HEAD[0]) * hk;
      box(wide(SKULL[0] - SKULL[2]), big(SKULL[1] - SKULL[3]), wide(SKULL[0] + SKULL[2]), big(SKULL[1] + SKULL[3]), (c, h, X1, Y1) => {
        const x = headX(X1), y = headY(Y1), dx = (x - SKULL[0] - 2 * turn) / SKULL[2], dy = (y - SKULL[1]) / SKULL[3];
        if (dx * dx + dy * dy > 1) return;
        const fdy = (y - fy) / FACE[3], hw = FACE[2] * Math.sqrt(Math.max(0, 1 - fdy * fdy)) * (fdy > 0 ? 1 - 0.3 * fdy * fdy : 1), ex = x - fx;
        const fringe = y - (fy - FACE[3]) < 6 + 0.55 * Math.abs(x - part) || (Math.abs(ex) > FACE[2] * 0.9 && y < fy);
        if (Math.abs(ex) < hw && Math.abs(fdy) < 1 && !fringe) { // the face, lit from the upper right, shaded under his hair
          const under = y - (fy - FACE[3]) < 10 + 0.55 * Math.abs(x - part);
          dot(c, h, SKIN + (under ? 3 : ex < -hw * 0.55 ? 2 : ex > hw * 0.3 ? 0 : 1), P_FACE);
        } else dot(c, h, HAIR + (dx * 0.5 - dy * 0.85 > 0.62 ? 2 : Math.sin(x * 0.5 + dy * 3) > 0.7 ? 1 : 0), P_HAIR);
      });
      for (const [i, lock] of LOCKS.entries()) {
        for (let j = 0; j < lock.length; j += 2) { // larger with his head, the ends stirring to the right
          moved[j] = wide(lock[j] + 2 * turn) + Math.max(0, lock[j + 1] - 470) * 0.06 * (1 + Math.sin(t * 1.9 + i * 2)); moved[j + 1] = big(lock[j + 1]);
        }
        poly(moved.subarray(0, lock.length), (c, h, x, y) => dot(c, h, HAIR + (Math.sin(x * 0.45 + y * 0.05) > 0.6 ? 2 : (x + y) % 9 < 4 ? 1 : 0), P_LOCK));
      }
      drawFeatures(fx, fy, open, turn, smile);
      // the umbrella's handle, and his hand on it
      capsule(SHAFT[0], SHAFT[1], SHAFT[2], SHAFT[3], 4, 4, (c, h, x, y, k, o) => dot(c, h, GRIP + (o < 0 ? 1 : 0), P_SHAFT));
      box(FIST[0] - FIST[2], FIST[1] - FIST[3], FIST[0] + FIST[2], FIST[1] + FIST[3], (c, h, x, y) => {
        const dx = (x - FIST[0]) / FIST[2], dy = (y - FIST[1]) / FIST[3];
        if (dx * dx + dy * dy < 1) dot(c, h, SKIN + (dx < -0.2 || dy > 0.4 ? 3 : 1), P_HAND);
      });
      // His characters: the edges of the panels of his coat and a fold or two,
      // strands in his hair, the pile of his fur, the weave of his belt.
      const edge = (xa, ya, xb, yb, colour) => line(cellOf(xa), rowOf(ya), cellOf(xb), rowOf(yb), (c, r, g) => {
        const p = r * 2 * cols + c;
        if (c >= 0 && c < cols && r >= 0 && r < rows && who[p] === P_SKIRT && who[p + cols] === P_SKIRT) put(c, r, g, colour);
      });
      edge(234, 630, 274, 1050, ROBE + 1); edge(302, 640, 400, 1000, ROBE + 3); edge(196, 680, 186, 1030, ROBE + 1); edge(360, 760, 398, 960, ROBE + 4);
      const r0 = Math.max(0, Math.floor(rowOf(MAN[1]))), r1 = Math.min(rows - 1, Math.floor(rowOf(MAN[3])));
      const c0 = Math.max(0, Math.floor(cellOf(MAN[0]))), c1 = Math.min(cols - 1, Math.floor(cellOf(MAN[2])));
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const p = r * 2 * cols + c, what = who[p], n = hash(c, r + 333);
        if (!what || who[p + cols] !== what) continue;
        if (what === P_FUR && n < 0.2) put(c, r, n < 0.07 ? AT : n < 0.14 ? RING : STAR, FUR + 1);
        else if (what === P_LOCK && n < 0.5) put(c, r, n < 0.3 ? BAR : n < 0.4 ? OPEN : SHUT, HAIR + 3);
        else if (what === P_SASH) put(c, r, c % 3 ? EQUAL : HASH, BELT + 2);
        else if (what === P_SLEEVE && n < 0.05) put(c, r, X(c) < 200 ? SHUT : OPEN, ROBE + 2);
      }
    }
    // His eyes, the line of his mouth and (when there is room) his nose, worked
    // out where they were painted and drawn HEAD[2] times larger. Where his
    // face is only a few cells across they are drawn cell by cell instead, so
    // that the opening always shows: a closed eye is a dark line along the
    // bottom of its cells, an opening one fills them, and an open one has a
    // catch of light in it.
    function drawFeatures(fx, fy, open, turn, smile) {
      const big = (y) => HEAD[1] + (y - HEAD[1]) * hk, wide = (x) => HEAD[0] + (x - HEAD[0]) * hk;
      const small = S * hk < 0.3, thin = 0.55 / (S * hk);
      for (const side of [-1, 1]) {
        const ex = fx + side * 10.5 + (side < 0 ? 3.5 : 2) * turn, ey = fy - 7 + 2.5 * turn, ew = side > 0 ? 7.5 - 1.5 * turn : 7.5;
        if (small) {
          const bridge = Math.floor(cellOf(wide(fx + 2.75 * turn))), r = Math.floor(rowOf(big(ey))); // the bridge of his nose stays skin, so his eyes never join
          let ca = Math.round(cellOf(wide(ex - ew))), cb = Math.max(ca + 1, Math.round(cellOf(wide(ex + ew))));
          if (side < 0) { cb = Math.min(cb, bridge); ca = Math.min(ca, cb - 1); } else { ca = Math.max(ca, bridge + 1); cb = Math.max(cb, ca + 1); }
          for (let c = ca; c < cb; c++) {
            if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
            const iris = c === cb - 1; // he looks down to his right, at the child
            if (open < 0.35) { dot(c, r * 2 + 1, HAIR, P_FACE); continue; } // closed: the line of his lashes, low
            dot(c, r * 2, HAIR, P_FACE); // open: the lashes lifted, and under them the eye, dark where he looks
            dot(c, r * 2 + 1, iris ? HAIR + 1 : SKIN, P_FACE);
            if (open > 0.7 && iris) put(c, r, DOT, SKIN); // the light caught in it
          }
          continue;
        }
        const lift = 6 * open; // the upper lid rises as he opens his eyes
        box(wide(ex - ew), big(ey - lift - 3), wide(ex + ew), big(ey + 3), (c, h, X1, Y1) => {
          const x = headX(X1), y = headY(Y1), k = (x - ex) / ew;
          if (Math.abs(k) > 1) return;
          const arc = Math.sqrt(1 - k * k), lash = ey + 1.2 * (1 - arc) - lift * arc; // the line of the lashes: the upper lid
          if (Math.abs(y - lash) < Math.max(1.2, thin)) dot(c, h, HAIR, P_FACE);
          else if (open > 0.3 && y > lash && y < ey + 1.5 * arc) { // the eye itself: dark, looking down to the right, with a glint
            const glint = Math.hypot(x - ex - ew * 0.25, y - lash - 2.2) < Math.max(1.3, thin);
            dot(c, h, glint && open > 0.8 ? SKIN : k > -0.55 ? HAIR + 1 : SKIN + 2, P_FACE);
          }
        });
      }
      const mx = fx + 2 + 3.5 * turn, my = fy + 17 + 2.5 * turn, mw = 4.5 + 3.5 * smile;
      if (small) { // a short line of lip that grows a cell wider and lifts at its ends as he smiles
        const ca = Math.round(cellOf(wide(mx - mw))), cb = Math.max(ca + 1, Math.round(cellOf(wide(mx + mw)))), h = Math.floor((big(my) - y0) * S);
        for (let c = ca; c < cb; c++) if (c >= 0 && c < cols && h >= 1 && h < H2) dot(c, smile > 0.5 && cb - ca > 2 && (c === ca || c === cb - 1) ? h - 1 : h, LIP, P_FACE);
      } else box(wide(mx - mw), big(my - 4), wide(mx + mw), big(my + 3), (c, h, X1, Y1) => { // a gentle closed smile, widening
        const x = headX(X1), y = headY(Y1), k = (x - mx) / mw;
        if (Math.abs(k) > 1) return;
        if (Math.abs(y - (my + 1.2 - (1 + 1.5 * smile) * k * k)) < Math.max(0.9, thin)) dot(c, h, Math.abs(k) > 0.6 ? LINE : LIP, P_FACE);
      });
      if (S * hk > 0.2) capsule(wide(fx + 2 + 4 * turn), big(fy + 5 + 2 * turn), wide(fx + 3 + 4 * turn), big(fy + 8 + 2 * turn), 0.8 * hk, 0.8 * hk, (c, h) => dot(c, h, SKIN + 3, P_FACE)); // the shadow of his nose
    }

    // ---- The cloak, streaming out to the right from behind his shoulders in
    // slow waves that travel along it.
    const capeAt = (x) => { // its line and half width at x, as it lies at rest
      let i = 0;
      while (i < CAPE.length - 2 && x > CAPE[i + 1][0]) i++;
      const [ax, ay, aw] = CAPE[i], [bx, by, bw] = CAPE[i + 1], k = clamp01((x - ax) / (bx - ax)), e = k * k * (3 - 2 * k);
      return [lerp(ay, by, e), lerp(aw, bw, e)];
    };
    function drawCloak(t) {
      const end = CAPE[CAPE.length - 1][0] + 10 * Math.sin(t * 1.3);
      const c0 = Math.max(0, Math.ceil(cellOf(CAPE[0][0]) - 0.5)), c1 = Math.min(cols - 1, Math.floor(cellOf(end) - 0.5));
      for (let c = c0; c <= c1; c++) {
        const x = X(c), [mid, hw] = capeAt(x), along = clamp01((x - 300) / 450), ph = x * 0.016 - t * 2.3;
        const amp = 4 + 18 * along, m = mid + amp * 0.5 * Math.sin(ph * 0.7 + 0.5);
        const up = m - hw + amp * Math.sin(ph), down = m + hw + amp * 0.8 * Math.sin(ph - 1.2);
        const h0 = Math.max(0, Math.ceil((up - y0) * S - 0.5)), h1 = Math.min(H2 - 1, Math.floor((down - y0) * S - 0.5));
        const fold = (y) => Math.sin(x * 0.028 - t * 2.3 + ((y - up) / (down - up)) * 2.6 + 1.5 * noise(x / 120, 3)); // its folds travel along it with the waves
        const fall = down + 20 + 55 * along; // its shadow on the snow, a band just under it that moves with it
        for (let h = h1 + 1, hs = Math.min(H2 - 1, Math.floor((fall - y0) * S)); h <= hs; h++) {
          const p = h * cols + c;
          if (h >= 0 && !who[p] && paint[p] >= SNOW && paint[p] < SNOW + 10) paint[p] = Math.max(SNOW + 3, paint[p] - (Y(h) > fall - 15 ? 1 : 3));
        }
        for (let h = h0; h <= h1; h++) {
          const y = Y(h), v = (y - up) / (down - up); // 0 at its upper edge, 1 at its lower
          const tone = v < 0.06 ? 6 : 3.4 + 1.7 * fold(y) - 1.6 * v + (v > 0.9 ? -1 : 0);
          dot(c, h, CLOAK + Math.max(0, Math.min(7, Math.round(tone + dither(c, h)))), P_CLOAK);
        }
        // the creases between its folds, and the sheen on them, in characters
        for (let r = Math.ceil(rowOf(up) + 0.3); r < Math.floor(rowOf(down) - 0.3); r++) {
          if (r < 0 || r >= rows) continue;
          const y = Y(r * 2) + 0.5 / S, f = fold(y), n = hash(c, r + 71);
          if (Math.abs(f) < 0.16 && n < 0.6) put(c, r, SLASH, CLOAK + 1);
          else if (f > 0.93 && n < 0.25) put(c, r, n < 0.12 ? HIGH : DASH, CLOAK + 7);
        }
      }
    }

    // ---- The umbrella, which he never moves: worked out once.
    const shade = new Uint8Array(N * 2), shadeGlyph = new Uint8Array(N), shadeInk = new Uint8Array(N);
    {
      const [cx, cy, a, b, tilt] = CANOPY, cs = Math.cos(tilt), sn = Math.sin(tilt), RIBS = 12, step = (2 * Math.PI) / RIBS;
      const rim = (ang) => { // how far from the apex the rim is, this way
        let lo = 0, hi = 2 * a;
        for (let j = 0; j < 24; j++) {
          const m = (lo + hi) / 2, x = APEX[0] + Math.cos(ang) * m - cx, y = APEX[1] + Math.sin(ang) * m - cy;
          if (((x * cs + y * sn) / a) ** 2 + ((-x * sn + y * cs) / b) ** 2 < 1) lo = m; else hi = m;
        }
        return lo;
      };
      box(cx - a, cy - a, cx + a, cy + a, (c, h, x, y) => {
        const lx = (x - cx) * cs + (y - cy) * sn, ly = -(x - cx) * sn + (y - cy) * cs, e = (lx / a) ** 2 + (ly / b) ** 2;
        if (e > 1) return;
        const ang = Math.atan2(y - APEX[1], x - APEX[0]), dist = Math.hypot(x - APEX[0], y - APEX[1]), f = (ang / step + RIBS) % RIBS, off = Math.min(f % 1, 1 - (f % 1));
        const p = h * cols + c, d = dither(c, h);
        // snow lies along its far rim, heaped at its upper end and on its crown
        const heap = noise(x / 42, y / 28);
        if ((ly < -b * (0.3 + 0.25 * heap) && e > 0.3) || (lx > a * (0.55 + 0.2 * heap)) || dist < 20) {
          const under = (ly > -b * (0.36 + 0.25 * heap) && lx < a * 0.6) || (lx > a * 0.55 && lx < a * (0.62 + 0.2 * heap) && ly > -b * 0.3);
          shade[p] = FUR + (under ? 1 : heap > 0.6 ? 3 : 4); return;
        }
        if (off * step * dist < Math.max(1.6, 0.5 / S)) { shade[p] = PAPER + 1; return; } // a rib
        const lit = Math.cos(ang + 40 * DEG); // panels facing the sun at the upper right are lighter
        shade[p] = PAPER + Math.max(1, Math.min(6, Math.round(3.6 + 1.5 * lit + ((Math.floor(f) & 1) ? 0.35 : -0.35) - (e > 0.9 ? 1.4 : 0) + d)));
      });
      for (let i = 0; i < RIBS; i++) { // the outer half of each rib in characters, where they are far enough apart
        const ang = i * step, out = rim(ang), dx = Math.cos(ang), dy = Math.sin(ang);
        line(cellOf(APEX[0] + dx * out * 0.5), rowOf(APEX[1] + dy * out * 0.5), cellOf(APEX[0] + dx * out * 0.94), rowOf(APEX[1] + dy * out * 0.94), (c, r, g) => {
          if (c < 0 || c >= cols || r < 0 || r >= rows) return;
          const p = r * 2 * cols + c;
          if (shade[p] >= PAPER && shade[p] < PAPER + 7 && shade[p + cols] >= PAPER && shade[p + cols] < PAPER + 7) { shadeGlyph[r * cols + c] = g; shadeInk[r * cols + c] = PAPER; }
        });
      }
    }
    const shaded = new Uint8Array(N); // the cells the umbrella covers
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) shaded[r * cols + c] = shade[r * 2 * cols + c] || shade[(r * 2 + 1) * cols + c] ? 1 : 0;

    // ---- The child. In its own units: heights from the ground (u), across
    // to its right (r) and ahead of it (f), in child heights. It faces `phi`
    // (0 toward the camera, positive turning to our right), looks up by
    // `pitch`, and stands at (x, z) on the ground from where it started,
    // `lift` above it. Its hands are given as (r, u, f).
    const [CX, CY, CU] = CHILD;
    const pose = { x: 0, z: 0, lift: 0, phi: 0, look: 0, pitch: 0, hands: [0, 0, 0, 0, 0, 0] };
    // Its little hops while the butterfly goes round: each lifts it a little,
    // turns it a fifth of the way round and sets it down a step from where it was.
    const HOPS = [1.62, 2.12, 2.62, 3.12, 3.62], AIR = 0.3;
    const SPOTS = [[0, 0], [0.04, 0.03], [0.02, 0.08], [-0.04, 0.07], [-0.05, 0.01], [-0.01, -0.01]];
    const facing = (k) => (45 - 72 * k) * DEG; // after k hops
    const V = [0.3, 0.98, 0.1], CLAP = [0.03, 1.02, 0.15], DOWN = [0.17, 0.33, 0.05]; // its hands raised, closed together, lowered
    function setPose(s) {
      let k = 0, f = 0, x = SPOTS[0][0], z = SPOTS[0][1], lift = 0;
      for (; k < HOPS.length && s >= HOPS[k] + AIR; k++);
      if (k < HOPS.length && s > HOPS[k]) { // in the air
        const p = (s - HOPS[k]) / AIR;
        f = smooth(0, 1, p); lift = 0.08 * Math.sin(Math.PI * p);
        x = lerp(SPOTS[k][0], SPOTS[k + 1][0], p); z = lerp(SPOTS[k][1], SPOTS[k + 1][1], p);
      } else { x = SPOTS[k][0]; z = SPOTS[k][1]; }
      pose.phi = lerp(facing(k), facing(k + 1), f);
      pose.x = x; pose.z = z;
      // on tiptoe and stretching at first; the jump; landing; after that, standing
      lift += 0.03 * smooth(0, 0.9, s) * (1 - smooth(1.4, 1.6, s)) + 0.012 * Math.sin(s * 5.5) * (1 - smooth(1.2, 1.5, s));
      const crouch = smooth(4.0, 4.28, s) * (1 - smooth(4.28, 4.36, s)), land = smooth(5.04, 5.12, s) * (1 - smooth(5.12, 5.42, s));
      const air = clamp01((s - 4.34) / 0.7);
      lift += 0.34 * 4 * air * (1 - air) - 0.05 * crouch - 0.05 * land;
      pose.lift = lift;
      // where it looks: up at the butterfly, its head turning to follow it as it climbs
      pose.pitch = (s < T.rise ? 30 : 30 + 25 * smooth(T.rise, T.lower, s)) * DEG;
      pose.look = s > T.rise ? 20 * DEG * Math.sin((s - T.rise) * 2.4) * (1 - smooth(T.lower, T.lower + 1, s)) : 0;
      // its hands: raised and reaching, then closing together at the top of the jump and opening again, then lowered
      const clap = smooth(4.5, 4.64, s) * (1 - smooth(4.8, 5.05, s)), drop = smooth(T.lower, T.lower + 1, s);
      const reach = 0.035 * Math.sin(s * 6.2) * (1 - smooth(1.2, 1.5, s));
      for (const side of [0, 1]) {
        const sg = side ? -1 : 1, H = pose.hands;
        H[side * 3] = sg * lerp(lerp(V[0], CLAP[0], clap), DOWN[0], drop);
        H[side * 3 + 1] = lerp(lerp(V[1] + (side ? reach : 0) - 0.08 * crouch, CLAP[1], clap), DOWN[1], drop);
        H[side * 3 + 2] = lerp(lerp(V[2], CLAP[2], clap), DOWN[2], drop);
      }
    }
    // Marks left in the snow where it landed, each [x, z, when].
    const marks = [];
    for (let k = 0; k <= HOPS.length; k++) {
      const [x, z] = SPOTS[k], a = facing(k), rx = -Math.cos(a), rz = Math.sin(a), when = k ? HOPS[k - 1] + AIR : -1;
      for (const sg of [-1, 1]) marks.push([x + sg * 0.06 * rx + R(-0.01, 0.01), z + sg * 0.06 * rz + R(-0.01, 0.01), when]);
    }
    for (const sg of [-1, 1]) marks.push([SPOTS[5][0] + sg * 0.07 + R(-0.01, 0.01), SPOTS[5][1] + 0.03, 5.04]); // where it came down from the jump
    function drawMarks(s) {
      for (const [x, z, when] of marks) {
        if (s < when) continue;
        const c = Math.floor(cellOf(CX + x * CU)), r = Math.floor(rowOf(CY + z * CU * K));
        if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
        const p = r * 2 * cols + c;
        paint[p + cols] = Math.max(SNOW + 3, Math.min(paint[p + cols], SNOW + 5));
        put(c, r, RING, SNOW + 3);
      }
    }
    // Its shadow on the snow, toward the lower left: it stays on the ground when the child jumps.
    function drawChildShadow() {
      const ox = CX + pose.x * CU - (0.1 + 0.25 * Math.max(0, pose.lift)) * CU, oy = CY + pose.z * CU * K + (0.03 + 0.08 * Math.max(0, pose.lift)) * CU;
      const rx = 0.24 * CU * (1 - 0.3 * Math.max(0, pose.lift)), ry = 0.075 * CU;
      box(ox - rx, oy - ry, ox + rx, oy + ry, (c, h, x, y) => {
        const e = ((x - ox) / rx) ** 2 + ((y - oy) / ry) ** 2, p = h * cols + c;
        if (e < 1 && paint[p] >= SNOW && paint[p] < SNOW + 10) paint[p] = Math.max(SNOW + 1, paint[p] - (e < 0.55 ? 3 : 2));
      });
    }
    function drawChild(s, t) {
      const { lift, phi, pitch, look, hands } = pose;
      const fx = Math.sin(phi), fz = Math.cos(phi), rx = -fz, rz = fx;
      const ox = CX + pose.x * CU, oy = CY + pose.z * CU * K, oz = pose.z;
      const SX = (r, f) => ox + (r * rx + f * fx) * CU, SY = (r, u, f) => oy - (u + lift) * CU + (r * rz + f * fz) * CU * K, SZ = (r, f) => oz + r * rz + f * fz;
      // depth: nearer wins in each half cell
      box(ox - 0.7 * CU, oy - (1.5 + lift) * CU, ox + 0.7 * CU, oy + 0.25 * CU, (c, h) => { depth[h * cols + c] = -1e9; });
      const at = (c, h, colour, z, part) => { const p = h * cols + c; if (z > depth[p]) { depth[p] = z; dot(c, h, colour, part); } };
      // its robe: a cone from its shoulders to a wide hem, red over green, the green showing down its front
      const HEM = 0.06, NECK = 0.58;
      box(ox - 0.24 * CU, oy - (NECK + lift + 0.05) * CU, ox + 0.24 * CU, oy - (lift - 0.1) * CU, (c, h, x, y) => {
        const u = (oy - y) / CU - lift, w = lerp(0.2, 0.1, clamp01((u - HEM) / (NECK - HEM))) + 0.012 * Math.sin(t * 3 + u * 20) * (u < 0.3 ? 1 : 0);
        const nx = (x - ox) / (w * CU);
        if (Math.abs(nx) >= 1) return;
        const nz = Math.sqrt(1 - nx * nx);
        if (u < HEM && HEM - u > nz * w * K) return; // below the near edge of the hem
        if (u > NECK && u - NECK > nz * w * K) return; // above its shoulders
        const nf = nx * fx + nz * fz, nr = nx * rx + nz * rz, d = dither(c, h);
        let colour;
        if (u > NECK - 0.05) colour = FUR + (nx > 0 ? 3 : 1); // the white fur at its collar
        else if (Math.abs(nr) < 0.24 && nf > 0) colour = GREEN + Math.max(0, Math.min(2, Math.round(1 + nx + d)));
        else colour = KIMONO + Math.max(0, Math.min(4, Math.round(1.8 + 1.5 * nx + d - (u < 0.14 ? 1 : 0))));
        at(c, h, colour, oz + nz * w, P_SKIRT);
      });
      // its feet, under the hem
      for (const sg of [-1, 1]) {
        const x = SX(sg * 0.055, 0.03), y = SY(sg * 0.055, 0.01, 0.03), z = SZ(sg * 0.055, 0.03);
        box(x - 0.04 * CU, y - 0.03 * CU, x + 0.04 * CU, y + 0.03 * CU, (c, h, px, py) => {
          if (((px - x) / (0.04 * CU)) ** 2 + ((py - y) / (0.03 * CU)) ** 2 < 1) at(c, h, SHOE, z, P_SHOE);
        });
      }
      // its head: a ball of white hair with its face on the side it looks toward
      const hf = 0.01, hu = 0.74, HR = 0.145, hx = SX(0, hf), hy = SY(0, hu, hf), hz = SZ(0, hf), rH = HR * CU; // a big head, as small children have
      const yaw = phi + look, cp = Math.cos(pitch), sp = Math.sin(pitch);
      const F3 = [Math.sin(yaw) * cp, sp, Math.cos(yaw) * cp], U3 = [-Math.sin(yaw) * sp, cp, -Math.cos(yaw) * sp], R3 = [-Math.cos(yaw), 0, Math.sin(yaw)];
      box(hx - rH, hy - rH, hx + rH, hy + rH, (c, h, x, y) => {
        const dx = (x - hx) / rH, dy = (hy - y) / rH, d2 = dx * dx + dy * dy;
        if (d2 >= 1) return;
        const nz = Math.sqrt(1 - d2), nf = dx * F3[0] + dy * F3[1] + nz * F3[2], nu = dx * U3[0] + dy * U3[1] + nz * U3[2], nr = dx * R3[0] + nz * R3[2];
        let colour = FUR + (d2 > 0.8 ? (dx + dy > 0 ? 1 : 0) : Math.max(0, Math.min(4, Math.round(1.6 + 1.8 * (0.5 * dx + 0.6 * dy + 0.4 * nz) + dither(c, h))))); // a grey rim keeps the white hair off the white snow
        let part = P_HAIR;
        if (nf > 0.38 && nu < 0.22 + 0.08 * Math.cos(nr * 22)) { // its face, under a ragged white fringe
          part = P_FACE;
          colour = SKIN + (dx < -0.35 ? 2 : 1);
          if (nf > 0.5 && ((Math.abs(nr) - 0.36) / 0.13) ** 2 + (nu / 0.11) ** 2 < 1) colour = HAIR + 1; // its eyes
          if ((nr / 0.15) ** 2 + ((nu + 0.42) / 0.12) ** 2 < 1) colour = MOUTH; // its open, happy mouth
        }
        at(c, h, colour, hz + nz * HR, part);
      });
      // its ears: two small white points on top, pink inside when they face us
      for (const sg of [-1, 1]) {
        const tilt = (u, f) => [hu + (u - hu) * cp - (f - hf) * sp, hf + (u - hu) * sp + (f - hf) * cp]; // tipped back with its head as it looks up
        const [bu, bf] = tilt(hu + 0.11, -0.01), [tu, tf] = tilt(hu + 0.28, -0.03);
        const pts = [[sg * 0.035, bu, bf], [sg * 0.135, bu - 0.01, bf], [sg * 0.105, tu, tf]].map(([r, u, f]) => [SX(r, f), SY(r, u, f)]);
        const z = SZ(sg * 0.08, bf) + 0.02, inner = F3[2] > 0.15, mid = (pts[0][0] + pts[1][0]) / 2;
        poly(pts.flat(), (c, h, x, y) => {
          const k = clamp01((pts[0][1] - y) / (pts[0][1] - pts[2][1] + 1e-9));
          at(c, h, inner && Math.abs(x - mid) < (1 - k) * 0.03 * CU && k < 0.75 ? EAR : x < mid ? FUR + 1 : FUR + 3, z, P_HAIR);
        });
      }
      // its arms in wide red sleeves, with white fur at the cuffs and its small hands
      for (const side of [0, 1]) {
        const sg = side ? -1 : 1, sr = sg * 0.1, hr = hands[side * 3], hu2 = hands[side * 3 + 1], hf2 = hands[side * 3 + 2];
        const ax = SX(sr, 0), ay = SY(sr, 0.53, 0), az = SZ(sr, 0), bx = SX(hr, hf2), by = SY(hr, hu2, hf2), bz = SZ(hr, hf2);
        capsule(ax, ay, bx, by, 0.045 * CU, 0.06 * CU, (c, h, x, y, k, o) => {
          at(c, h, k > 0.8 ? FUR + (o < 0 ? 1 : 2) : KIMONO + (o < -0.1 ? 3 : 2), lerp(az, bz, k) + 0.05, P_SLEEVE);
        });
        const ex = bx + (bx - ax) * 0.14, ey = by + (by - ay) * 0.14;
        box(ex - 0.035 * CU, ey - 0.035 * CU, ex + 0.035 * CU, ey + 0.035 * CU, (c, h, x, y) => {
          if (Math.hypot(x - ex, y - ey) < Math.max(0.033 * CU, 0.55 / S)) at(c, h, y > ey ? SKIN + 3 : SKIN + 2, bz + 0.07, P_HAND);
        });
      }
      return [hx, hy];
    }

    // ---- The butterfly. Where it is at story time s, from where the child
    // first stood, in child heights: across (x), up (y) and toward us (z).
    const B = [0, 0, 0];
    const exitAt = (CY - top) / CU + 0.5; // high enough to be past the top of the screen
    function fly(s) {
      const hx = 0.33 + 0.03 * Math.sin(s * 4.1), hy = 1.12 + 0.025 * Math.sin(s * 5.3 + 1), hz = 0.1 + 0.02 * Math.sin(s * 3.2); // hovering just above the raised hands
      if (s < T.circle) { B[0] = hx; B[1] = hy; B[2] = hz; return; }
      if (s < T.jump) { // one slow circle, clockwise seen from above, at the height of the child's head
        const p = (s - T.circle) / (T.jump - T.circle), a = (135 + 360 * (p - 0.03 * Math.sin(2 * Math.PI * p))) * DEG, k = smooth(T.circle, T.circle + 0.6, s);
        B[0] = lerp(hx, 0.36 * Math.sin(a), k); B[1] = lerp(hy, 0.72 + 0.025 * Math.sin(s * 6), k); B[2] = lerp(hz, -0.36 * Math.cos(a), k); return;
      }
      if (s < T.rise) { // it floats up just out of reach, and darts higher as the hands close under it
        const up = smooth(4.0, 4.5, s), dart = smooth(4.62, 4.95, s), w = 0.02 * Math.sin(s * 5);
        B[0] = lerp(0.255, 0.12, up) + 0.1 * dart + w; B[1] = lerp(0.72, 1.44, up) + 0.33 * dart + w; B[2] = lerp(0.255, 0.15, up) - 0.05 * dart; return;
      }
      // a gentle spiral, still clockwise, widening as it climbs out of the top
      const p = (s - T.rise) / (T.lower - T.rise), a = (45 + 500 * p) * DEG, rad = lerp(0.12, 0.5, p), k = smooth(T.rise, T.rise + 0.5, s);
      B[0] = lerp(0.22, 0.12 + 0.3 * p + rad * Math.sin(a), k); B[1] = lerp(1.77, lerp(1.77, exitAt, p ** 1.6), k); B[2] = lerp(0.1, -rad * Math.cos(a), k);
    }
    const onScreen = (out) => { out[0] = cellOf(CX + B[0] * CU); out[1] = rowOf(CY - B[1] * CU + B[2] * CU * K); out[2] = B[2]; return out; };
    const here = [0, 0, 0], was = [0, 0, 0];
    const hidden = (c, r, z) => { // behind the child?
      if (c < 0 || c >= cols || r < 0 || r >= rows) return true;
      const p = r * 2 * cols + c;
      return depth[p] > z + 0.04 && depth[p + cols] > z + 0.04 && depth[p] > -1e8;
    };
    function drawButterfly(s, t) {
      if (s > T.lower + TRAIL) return;
      // the trail: where it was over the last moments, drifting right on the wind and fading
      for (let j = 1, n = 36; j <= n; j++) {
        const a0 = ((j - 1) / n) * TRAIL, a1 = (j / n) * TRAIL;
        fly(s - a0); onScreen(was); was[0] += 0.9 * a0 * SA * 12; was[1] -= 0.25 * a0;
        fly(s - a1); onScreen(here); here[0] += 0.9 * a1 * SA * 12; here[1] -= 0.25 * a1;
        const age = j / n, colour = GLEAM + (age < 0.25 ? 3 : age < 0.5 ? 2 : age < 0.75 ? 1 : 0), z = (was[2] + here[2]) / 2;
        if (age > 0.75 && j & 1) continue; // its oldest part is only dotted
        line(was[0], was[1], here[0], here[1], (c, r, g) => {
          if (hidden(c, r, z) || (glyph[r * cols + c] > 32 && ink[r * cols + c] >= WING && ink[r * cols + c] < GLEAM + 4)) return;
          put(c, r, age > 0.75 ? DOT : g, colour);
        });
      }
      if (s > T.lower) return;
      fly(s); onScreen(here);
      const c = Math.floor(here[0] - 0.5), r = Math.floor(here[1]);
      // its glow, on whatever is round it
      for (let dr = -3; dr <= 3; dr++) for (let dc = -6; dc <= 6; dc++) {
        const cc = c + dc, rr = r + dr, e = Math.hypot(dc / (2 * A), dr);
        if (cc < 0 || cc >= cols || rr < 0 || rr >= rows || e > 3.2) continue;
        wash[rr * cols + cc] = Math.max(wash[rr * cols + cc], GLOW + (e < 1.1 ? 2 : e < 2.1 ? 1 : 0));
      }
      const beat = WINGS[Math.floor(t * 18) & 3];
      for (let j = 0; j < 2; j++) {
        if (hidden(c + j, r, here[2])) continue;
        put(c + j, r, beat[j], WING + 3, 1);
        const p = r * 2 * cols + c + j;
        paint[p] = WING + 1; paint[p + cols] = WING;
      }
    }

    // ---- The near branches, out of focus: soft dark wood with a haze round
    // it, caps of snow, and blossoms, each with a red haze. They sway a little.
    function drawBranches(t) {
      for (const [xa, ya, xb, yb, ra, rb, snowy, arm] of wood) {
        const sa = sway(arm, t), sb = sway(arm + Math.hypot(xb - xa, yb - ya), t); // carried down a little, and to the right
        const ax = xa + sa * 0.3, ay = ya + sa, bx = xb + sb * 0.3, by = yb + sb;
        const nx = -(by - ay), ny = bx - ax, nl = Math.hypot(nx, ny) || 1; // the side of the wood facing up
        const upx = ny < 0 ? nx / nl : -nx / nl, upy = ny < 0 ? ny / nl : -ny / nl;
        capsule(ax, ay, bx, by, ra + 1.2 / S, rb + 1.2 / S, (c, h) => { const i = (h >> 1) * cols + c; if (!wash[i]) wash[i] = HAZE; });
        capsule(ax, ay, bx, by, ra, rb, (c, h, x, y, k) => {
          const mx = lerp(ax, bx, k), my = lerp(ay, by, k), o = ((x - mx) * upx + (y - my) * upy) / lerp(ra, rb, k); // -1 under it to 1 on top
          const p = h * cols + c;
          paint[p] = snowy && o > 0.15 && noise(x / 30, y / 20) > 0.32 ? FUR + (o > 0.6 ? 4 : 3) : WOOD + (o > 0.4 ? 2 : o > -0.3 ? 1 : 0);
          who[p] = 0; glyph[(h >> 1) * cols + c] = 32;
        });
        if (snowy) capsule(ax + upx * ra * 0.9, ay + upy * ra * 0.9, bx + upx * rb * 0.9, by + upy * rb * 0.9, ra * 0.7, rb * 0.7, (c, h, x, y) => {
          if (noise(x / 30, y / 20) > 0.38) paint[h * cols + c] = FUR + 4; // snow heaped on top
        });
      }
      for (const [x, y, rad, tone, arm] of blooms) {
        const sy = sway(arm, t), bx = x + sy * 0.3, by = y + sy;
        if (bx < left - rad || bx > right + rad || by < top - rad) continue;
        const rr = Math.max(rad, 0.6 / S);
        box(bx - rr - 1.2 / S, by - rr - 1.2 / S, bx + rr + 1.2 / S, by + rr + 1.2 / S, (c, h, px, py) => {
          const e = Math.hypot(px - bx, py - by) / rr, p = h * cols + c;
          if (e < 1) { paint[p] = BLOOM + Math.min(4, tone + (e < 0.45 ? 1 : 0)); glyph[(h >> 1) * cols + c] = 32; }
          else if (e < 1 + 1.2 / (S * rr)) { const i = (h >> 1) * cols + c; if (wash[i] !== HAZE) wash[i] = HAZE + 1; }
        });
        if (rad > 7.5 && rr * S > 0.9) put(Math.floor(cellOf(bx)), Math.floor(rowOf(by)), tone > 1 ? AT : STAR, BLOOM + 4);
      }
    }

    // ---- Falling snow and petals, in screen time: they keep falling
    // through the whole film, and through the flurry at the end.
    function drawFall(t) {
      for (const f of flakes) {
        const r = Math.floor((((f.y + f.fall * t) % (rows + 2)) + rows + 2) % (rows + 2)) - 1;
        const c = Math.floor((((f.x + f.fall * f.drift * t * A + f.wob * Math.sin(t * f.freq + f.ph)) % cols) + cols) % cols);
        if (r < 0 || r >= rows) continue;
        const i = r * cols + c;
        if (glyph[i] > 32 && (ink[i] >= WING && ink[i] < GLEAM + 4 || who[r * 2 * cols + c] === P_FACE)) continue; // not over the butterfly, its trail or a face
        put(c, r, FLAKES[f.g], SNOW + 9, f.g === 3 ? 1 : 0);
      }
      for (const q of petals) {
        const age = ((t - q.t0) % 6 + 6) % 6, x = q.x + q.drift * age + q.wob * Math.sin(age * q.freq + q.ph), y = q.y + q.fall * age;
        const c = Math.floor(cellOf(x)), r = Math.floor(rowOf(y));
        if (c >= 0 && c < cols && r >= 0 && r < rows) put(c, r, PETAL[Math.floor(age * 5 + q.ph) & 3], BLOOM + q.tone);
      }
    }

    // ---- The ending. The wind lifts a flurry of snow and red petals from
    // the left. Its front runs to the right across the screen: ahead of it
    // the picture, then a thickening squall that smears the picture to the
    // right and turns white, then the squall thinning away over the page.
    const smear = new Uint8Array(cols * 2), smearG = new Uint8Array(cols), smearI = new Uint8Array(cols);
    function drawFlurry(s, t) {
      const front = lerp(-0.3, 1.9, (s - T.gust) / (T.end - T.gust));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) { // keep this row as it was, to smear it
          smear[c] = paint[r * 2 * cols + c]; smear[cols + c] = paint[(r * 2 + 1) * cols + c]; smearG[c] = glyph[r * cols + c]; smearI[c] = ink[r * cols + c];
        }
        for (let c = cols - 1; c >= 0; c--) {
          const i = r * cols + c, d = front - c / cols - 0.14 * noise(c * 0.06 - s * 2, r * 0.18);
          if (d <= 0) continue;
          const shift = d < 0.32 ? Math.round(((d / 0.32) ** 2) * cols * 0.08) : 0, from = Math.max(0, c - shift);
          if (d < 0.32) { // the squall: the picture carried right and whitening
            paint[r * 2 * cols + c] = smear[from]; paint[(r * 2 + 1) * cols + c] = smear[cols + from];
            glyph[i] = d < 0.16 ? smearG[from] : 32; ink[i] = smearI[from];
            wash[i] = FLURRY + Math.max(1, Math.round((d / 0.32) * 10));
          } else { // over the page: the white thinning away
            paint[r * 2 * cols + c] = paint[(r * 2 + 1) * cols + c] = 0; glyph[i] = 32;
            const left2 = 1 - (d - 0.32) / 0.4;
            wash[i] = left2 > 0 ? FLURRY + Math.max(1, Math.round(left2 * 10)) : 0;
          }
          const n = hash(Math.floor(c - t * cols * 0.9), r + 7 * seed), dense = d < 0.32 ? 0.12 + 0.5 * (d / 0.32) : 0.62 * Math.max(0, 1 - (d - 0.32) / 0.4);
          if (n < dense) { // streaks of snow, and petals
            const petal = n < dense * 0.12;
            put(c, r, petal ? PETAL[(Math.floor(n * 977 + t * 6)) & 3] : STREAK[(Math.floor(n * 9973)) & 7], petal ? BLOOM + 2 + (c & 1) : SNOW + 9 - (r + c) % 2 * 3);
          }
        }
      }
    }

    return {
      cols, rows, palette: INK, glyph, ink, bold, paint, wash,
      render(t) { // t: seconds since the film started
        glyph.fill(32); ink.fill(0); bold.fill(0); paint.fill(0); wash.fill(0);
        if (t >= LENGTH) return this; // over: nothing is left on the page
        const s = t * SPEED; // where that is in the story
        paint.set(ground); glyph.set(still); ink.set(stillInk); who.fill(0);
        setPose(s);
        drawChildShadow(); drawMarks(s);
        drawCloak(t);
        drawMan(s, t);
        for (let p = 0; p < N * 2; p++) if (shade[p]) { paint[p] = shade[p]; who[p] = P_CANOPY; }
        for (let i = 0; i < N; i++) if (shaded[i]) { glyph[i] = shadeGlyph[i] || 32; ink[i] = shadeInk[i]; }
        drawChild(s, t);
        drawButterfly(s, t);
        drawBranches(t);
        box(STAMP[0], STAMP[1], STAMP[2], STAMP[3], (c, h) => { paint[h * cols + c] = SEAL; glyph[(h >> 1) * cols + c] = 32; });
        drawFall(t);
        if (s > T.gust) drawFlurry(s, t);
        return this;
      },
    };
  }

  // Play it on the stage. Resolves when it has finished. `seed` changes the
  // details (the snow's grain, the reeds, the twigs and blossoms on the near
  // branches, the falling snow and petals), not the layout or the story.
  // `freezeAt` holds one moment (in seconds) on screen. Reduced motion holds
  // the first scene: the child on tiptoe reaching for the butterfly.
  const film = { length: LENGTH, still: 1 / SPEED, grid: [110, 52], createScene };
  return { play: (options) => AsciiStage.play(film, options), createScene };
})();
