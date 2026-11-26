/*
 * The ice lotus: an ASCII loading screen for the stage (ascii-stage.js).
 *
 *   <script src="ascii-stage.js"></script>
 *   <script src="ice-lotus.js"></script>
 *   <script>IceLotus.play().then(showThePage);</script>
 *
 * A young man with long black hair, in a black robe, holds a glowing ice-blue
 * lotus in front of his chest, on a near-black ground with faint dark red
 * brush slashes behind him. The flower is the only light, and it lights his
 * face from below. He blinks, then lowers his eyes to the flower as it opens
 * wider and glows brighter. Its petals let go one at a time, from the outside
 * in, each breaking into shards of light that float straight up past his face
 * and fade; the light on him goes with them. With only the stem left in his
 * hand he looks back up, with the same slight smile, as his face sinks into
 * the dark. Then the dark lifts away upward like smoke, from the bottom, to
 * show the page. The whole thing lasts five seconds (LENGTH, below).
 *
 * The scene is described in the pixels of the reference picture (736 by 1307,
 * x to the right and y down) and seen through a camera that fits that tall
 * frame to the screen. What does not move is worked out once per half cell:
 * what is there, how dark it is unlit, and how much the flower's light reaches
 * it. Each frame mixes in the flower's light of the moment and draws what
 * moves: the flower, its shards, his eyes, a few strands of hair.
 */
const IceLotus = (() => {
  'use strict';
  const { code, clamp01, lerp, smooth, mulberry32, hash, noise } = AsciiStage;

  // The story's timeline, in seconds at the pace it was written: the user's
  // ten, and one more in which the dark lifts away.
  const T = {
    blink: 1.15, // he blinks
    lower: 2.1,  // he starts to lower his eyes to the flower
    down: 3.1,   // and is looking at it
    bloom: 2,    // the petals start to open wider and the glow to brighten
    full: 4,     // as wide and as bright as they get
    shed: 4.15,  // the first outer petal breaks; the others follow one at a time
    inner: 6.95, // then the inner petals go,
    heart: 7.95, // and the white centre
    raise: 8.55, // he starts to raise his eyes
    up: 9.2,     // and is looking at the camera again
    gone: 9.45,  // the last shards have faded
    lift: 10,    // the dark starts to lift away
    end: 11,
  };
  // It is played faster than that. LENGTH is how many seconds the whole of it
  // takes on screen, and SPEED how many times faster than the story that is.
  const LENGTH = 5, SPEED = T.end / LENGTH;
  const PULSE = 2; // seconds on screen for one slow pulse of the glow

  // Colours. Each run is a ramp from shadow to light; `swatch` adds one and
  // gives the index of its first colour.
  const INK = ['#000000'];
  const swatch = (...colours) => INK.push(...colours) - colours.length;
  const NIGHT = swatch('#06080a', '#090c10', '#0c1015', '#10151b', '#141b23', '#19222d', '#1f2b38'); // the near-black ground, and the flower's glow in the air near it
  const DARK = swatch('#020304', '#050608', '#080a0e', '#0d1117', '#131921', '#1a222d', '#22303e', '#2b3d50', '#354b63'); // his black hair and robe, unlit, then caught by the flower's light
  const SKIN = swatch('#08090b', '#121316', '#1d1e21', '#2a2b2e', '#3a3b3d', '#4d4f50', '#636665', '#7c807e', '#969c9a', '#b1b9b8', '#cbd4d3', '#e2e9e8', '#f3f7f6'); // pale grey-white, cooler as it brightens
  const ICE = swatch('#0a111c', '#132644', '#193356', '#204268', '#28527a', '#31638b', '#3c769c', '#4b8aac', '#5d9ebb', '#78b4ca', '#9bcad9', '#c2e1ea', '#e4f4f6', '#ffffff'); // the flower, deep blue to the white of its heart
  const RED = swatch('#16070a', '#1d080c', '#25090e', '#2e0b11'); // the brush slashes
  const SMOKE = swatch(...Array.from({ length: 8 }, (_, i) => `rgba(6,8,10,${((i + 1) / 9).toFixed(3)})`)); // the dark thinning away at the end, faintest first
  const RAMP = { night: [NIGHT, 6], dark: [DARK, 8], skin: [SKIN, 12], ice: [ICE, 13], red: [RED, 3] }; // first colour, and steps after it

  const [BAR, SLASH, BACK, DASH, LOW, QUOTE] = code('|/\\-_"');
  const SHARDS = code("'^*`|:."), STAMEN = code(':*\'"*:.'), SPECK = code(".'`");
  const FACE_SKIN = 1, HAIR = 2; // what a half cell is, where it matters
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const DEG = Math.PI / 180;

  // The world: the reference picture, in its own pixels. FRAME is what must be
  // on screen, from the top of his hair to the end of the stem: its middle,
  // width and height. HEART is the heart of the flower, where the light comes from.
  const FRAME = [368, 652, 760, 1130];
  const HEART = [362, 742];

  // His hair, row by row: [y, x] down its outer edges, and down its inner
  // edges, where it parts over his brow and frames his face and neck.
  const OUTER_L = [[190, 262], [250, 238], [300, 222], [400, 197], [500, 172], [600, 145], [700, 115], [800, 85], [900, 62]];
  const OUTER_R = [[190, 545], [250, 565], [300, 578], [400, 598], [500, 616], [600, 635], [700, 660], [800, 685], [900, 702]];
  const INNER_L = [[226, 398], [238, 381], [255, 368], [280, 352], [305, 336], [325, 323], [380, 323], [430, 327], [470, 331], [500, 334], [540, 324], [620, 300], [700, 284], [800, 272], [960, 262]];
  const INNER_R = [[226, 414], [238, 436], [255, 450], [280, 457], [300, 464], [330, 484], [380, 486], [430, 482], [470, 476], [500, 472], [540, 482], [620, 497], [700, 507], [800, 515], [960, 522]];
  const edge = (table, y) => {
    if (y <= table[0][0]) return table[0][1];
    for (let i = 1; i < table.length; i++) {
      if (y < table[i][0]) { const [y0, x0] = table[i - 1], [y1, x1] = table[i]; return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0); }
    }
    return table[table.length - 1][1];
  };
  // Loose strands at the outer edges of his hair, each [x, y, ...] from its
  // root, and how far its end sways.
  const STRANDS = [
    [[250, 230, 226, 330, 200, 450, 176, 560], 12],
    [[556, 228, 584, 330, 606, 450, 626, 560], 12],
  ];

  // His face, in its own frame: he tips his head a little toward his left, so
  // u runs across his face and v down it, from between his eyes and nose.
  const FACE = [403, 365], TILT = 8 * DEG, FC = Math.cos(TILT), FS = Math.sin(TILT);
  const EYE_U = 50, EYE_V = -31, EYE_W = 21; // where his eyes are, and half the width of each
  // The line of his jaw: from each cheek to the point of his chin.
  const CHIN = [389, 498], CHEEK_L = [331, 432], CHEEK_R = [474, 425];
  const jawAt = (x) => { // the row of his jaw under x
    const k = x < CHIN[0] ? (CHIN[1] - CHEEK_L[1]) / (CHIN[0] - CHEEK_L[0]) : (CHIN[1] - CHEEK_R[1]) / (CHEEK_R[0] - CHIN[0]);
    return CHIN[1] + 6 - Math.sqrt((Math.abs(x - CHIN[0]) * k) ** 2 + 36);
  };
  // His collar crosses below his throat: the edge of each side, [x, y] at its top and at the V.
  const COLLAR_L = [318, 540, 393, 630], COLLAR_R = [480, 545, 397, 632];
  const shoulder = (x) => 545 + 0.0012 * (x - 400) ** 2; // the top of his robe where the hair does not cover it

  // His hand, holding the stem below the flower, its back to us: his thumb
  // up the stem, then his fingers curled round it, the first of them reaching
  // out under the flower; each [knuckle x, y, middle joint x, y, tip x, y,
  // radius at the knuckle]. Then the back of his hand, and his wrist, running
  // down and away to the left, into his sleeve past the middle of it.
  const FINGERS = [
    [282, 1010, 312, 984, 338, 966, 13],
    [300, 992, 420, 1004, 482, 1024, 15],
    [298, 1022, 396, 1032, 404, 1064, 15],
    [296, 1058, 370, 1068, 364, 1104, 14],
    [292, 1090, 338, 1100, 332, 1124, 12],
  ];
  const PALM = [[300, 980], [308, 1060], [300, 1120], [262, 1172], [205, 1216], [178, 1160], [235, 1080], [270, 1012]];
  const WRIST = [236, 1170, 104, 1368, 40];
  const STEM = [348, 800, 322, 1212, 10]; // its top, where the flower was, and its cut end; its half width

  // The red brush slashes behind him: [x0, y0, x1, y1, width, strength], each
  // laid down from its first end, so it thins and breaks up toward its last.
  const SLASHES = [
    [250, 120, 70, 462, 24, 1], [204, 214, 120, 372, 12, 0.75], [170, 64, 128, 146, 9, 0.6], [100, 380, 52, 452, 11, 0.6],
    [518, 4, 380, 88, 14, 0.75],
    [690, 102, 566, 238, 18, 0.85], [640, 142, 596, 196, 9, 0.6], [732, 352, 610, 404, 13, 0.7],
  ];

  // The flower. Its petals grow in rings round the heart, and are worked out
  // in 3D (x to the right, y up, z toward the camera, in pixels of the
  // picture) and seen from above at LOOK, then drawn flat on the picture.
  // Each ring: [petals, their rise above level as in the picture and when
  // fully open (degrees), length, half width, how far out from the middle
  // they start, how far round the first one is (degrees), how bright, and how
  // much of the light each gives]. Then the white heart: [lift above the
  // base, half width, half height on the picture].
  const LOOK = 24 * DEG, LC = Math.cos(LOOK), LS = Math.sin(LOOK);
  const RINGS = [
    [8, -18, -22, 318, 100, 40, 22.5, 0.47, 0.035],
    [8, 30, 16, 236, 84, 28, 0, 0.6, 0.03],
    [6, 60, 44, 156, 62, 14, 0, 0.7, 0.04],
  ];
  const BULB = [24, 78, 44], BULB_LIGHT = 0.24;
  // The order the petals go in. Outer ring: by where round it they are
  // (0 is the one toward the camera's right), alternating sides so that each
  // break shows on its own; the two at the back, half hidden, last. Then the
  // middle ring and the inner ring, quickly, sides first.
  const ORDER = [[6, 1, 7, 2, 5, 0, 4, 3], [2, 6, 1, 7, 0, 3, 5, 4], [1, 5, 0, 2, 4, 3]];
  const GAP = [0.34, 0.1, 0.1], START = [T.shed, T.inner, T.inner + 0.45]; // story seconds between breaks, and when each ring starts
  const FLARE = [0.32, 0.2, 0.2, 0.25]; // how long a petal (or the heart) glows harder before it breaks
  const SPLIT = [11, 9, 7, 16]; // how many shards it breaks into

  // How far (x, y) is from the segment (x0, y0)-(x1, y1); `along` is set to
  // how far along it the nearest point is, from 0 to 1.
  let along = 0;
  const off = (x, y, x0, y0, x1, y1) => {
    const dx = x1 - x0, dy = y1 - y0;
    along = clamp01(((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy || 1));
    return Math.hypot(x - x0 - dx * along, y - y0 - dy * along);
  };
  const inPolygon = (x, y, poly) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };

  // How the light goes: the slow pulse (on screen time), the brightening as
  // the flower opens, and how open it is.
  const pulse = (t) => 1 + 0.1 * Math.sin((2 * Math.PI * t) / PULSE);
  const opening = (s) => smooth(T.bloom, T.full, s);

  function createScene({ cols, rows, aspect = 2, seed = 1 }) {
    const lines = rows * 2, cells = cols * rows, halves = cells * 2;
    const glyph = new Uint8Array(cells), ink = new Uint8Array(cells), bold = new Uint8Array(cells), paint = new Uint8Array(halves);
    const rand = mulberry32(seed * 7919 + 17);
    const R = (a, b) => a + (b - a) * rand();

    // The camera: S half rows to a pixel of the picture. The tall frame fills
    // the height of a wide screen and the width of a tall one, and the ground,
    // the slashes and his robe go on beyond it. A column is `unit` half rows wide.
    const unit = 2 / aspect, W = cols * unit;
    const S = Math.min(lines / FRAME[3], W / FRAME[2]), px = 1 / S; // px: the size of a half row, in pixels of the picture
    const xAt = (c) => FRAME[0] + ((c + 0.5) * unit - W / 2) * px; // the middle of column c
    const yAt = (l) => FRAME[1] + (l + 0.5 - lines / 2) * px;      // the middle of half row l
    const colOf = (x) => Math.floor(((x - FRAME[0]) * S + W / 2) / unit);
    const lineOf = (y) => Math.floor((y - FRAME[1]) * S + lines / 2);
    const top = Math.max(yAt(0), 0); // the highest row of the picture on screen
    // Small on the screen, his eyes are drawn taller than in the picture, so they still read.
    const big = Math.max(1, Math.min(1.45, 0.15 / S));

    // More slashes where a wide screen shows the ground beyond the frame: one
    // to every stretch of it, now and then two, in the same hand.
    const slashes = SLASHES.slice();
    for (let k = 0; -60 - k * 260 > xAt(0) - 300 || 796 + k * 260 < xAt(cols - 1) + 300; k++) {
      for (const side of [-1, 1]) {
        const at = side < 0 ? -60 - k * 260 : 796 + k * 260, h = (j) => hash(k * 2 + (side > 0) + seed * 31, j);
        for (let n = 0; n < 1 + (h(0) < 0.35); n++) {
          const x = at + side * 100 * h(1 + n), y = 40 + 560 * h(3 + n), len = 130 + 190 * h(5 + n), a = (118 + 34 * h(9 + n)) * DEG;
          slashes.push([x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, 8 + 14 * h(11 + n), 0.5 + 0.4 * h(13 + n)]);
        }
      }
    }
    // A brush slash at (x, y): its red, 0 for none. The bristles leave streaks
    // along it, and it runs dry and breaks up toward its end. `boxes` holds
    // the box round each, to pass by quickly.
    const boxes = slashes.map(([x0, y0, x1, y1, w]) => { const m = w + px * 0.3 + 1; return [Math.min(x0, x1) - m, Math.min(y0, y1) - m, Math.max(x0, x1) + m, Math.max(y0, y1) + m]; });
    const slashAt = (s, x, y, k) => {
      const [x0, y0, x1, y1, w, strength] = s, d = off(x, y, x0, y0, x1, y1), a = along;
      const half = w * (0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, 0.15 + a * 1.1)) ** 0.5) * (1 - 0.45 * a);
      if (d > half + px * 0.3) return 0;
      const len = Math.hypot(x1 - x0, y1 - y0), across = ((x - x0) * (y1 - y0) - (y - y0) * (x1 - x0)) / len / w;
      const dry = noise(across * 5 + k * 7.3, a * 3 + k), streak = noise(across * 11 + k * 3.1, a * 1.5);
      if (dry * 0.7 + streak * 0.3 < 0.3 + 0.38 * a ** 1.5) return 0;
      return strength * (0.5 + 0.5 * streak);
    };

    // What is at each half cell before anything moves: the ramp it is painted
    // from, how far up it that is unlit (`base`), how far the flower's light
    // takes it (`lit`, at the flower's ordinary brightness), whether it is the
    // skin of his face or neck or his hair (`kind`), whether it is his hand,
    // which is in front of the flower, and how much it is dithered.
    const first = new Uint8Array(halves), span = new Uint8Array(halves), base = new Float32Array(halves), lit = new Float32Array(halves);
    const kind = new Uint8Array(halves), front = new Uint8Array(halves), dither = new Float32Array(halves);
    let ramp = RAMP.night, b0 = 0, l0 = 0, k0 = 0, f0 = 0, d0 = 1;
    const set = (r, b, l, k = 0, f = 0, d = 1) => { ramp = r; b0 = b; l0 = l; k0 = k; f0 = f; d0 = d; };

    const fingerAt = (x, y) => { // how much of the flower's light falls on his hand at (x, y), or -1 if it is not his hand
      for (let i = 0; i < FINGERS.length; i++) {
        const [x0, y0, x1, y1, x2, y2, r0] = FINGERS[i];
        let d = off(x, y, x0, y0, x1, y1), a = along * 0.6, sx = x0, sy = y0, ex = x1, ey = y1;
        const d2 = off(x, y, x1, y1, x2, y2);
        if (d2 < d) { d = d2; a = 0.6 + 0.4 * along; sx = x1; sy = y1; ex = x2; ey = y2; }
        const r = r0 * (1 - 0.4 * a);
        if (d < r) {
          const above = ((x - sx) * (ey - sy) - (y - sy) * (ex - sx)) / Math.hypot(ex - sx, ey - sy) / r; // 1 along its upper side, -1 under it
          if (above < -0.55 && d > r - Math.max(4, px * 0.9)) return 0.3; // the crease under it
          return (0.95 - 0.08 * i) * (0.82 + 0.18 * above);
        }
      }
      if (inPolygon(x, y, PALM)) return 0.62 - 0.25 * clamp01((y - 1040) / 150) + 0.15 * clamp01((300 - x) / 60);
      const d = off(x, y, WRIST[0], WRIST[1], WRIST[2], WRIST[3]);
      if (d < WRIST[4] && along < 0.6) return 0.42 - 0.4 * along + 0.12 * clamp01((WRIST[0] - 20 - x) / 30);
      return -1;
    };

    function place(x, y) {
      const d = Math.hypot(x - HEART[0], y - HEART[1]);
      const glow = Math.exp(-((Math.hypot((x - HEART[0]) / 1.45, y - HEART[1]) / 230) ** 2)); // the flower's glow in the air about it
      const reach = 0.92 / (1 + (d / 514) ** 2); // how strongly its light falls on skin at this distance
      // His hand, lit from the flower above it, and his sleeve.
      if (x > 50 && x < 500 && y > 945 && y < 1420) {
        const hand = fingerAt(x, y);
        if (hand >= 0) return set(RAMP.skin, 0.03, 0.88 * hand, 0, 1, 0.5);
        if (off(x, y, WRIST[0], WRIST[1], WRIST[2], WRIST[3]) < WRIST[4] + 8 && along >= 0.6) return set(RAMP.dark, 0.06, along < 0.65 ? 0.5 : 0); // its edge catching the light
      }
      // The stem, blue, lit near the flower and darker toward its cut end, which is frayed and pale.
      const sd = off(x, y, STEM[0], STEM[1], STEM[2], STEM[3]);
      if (sd < STEM[4] * (along > 0.95 ? 0.8 + noise(x * 0.4, 9) * 0.5 : 1)) {
        const lip = along > 0.955 ? 0.2 : 0, side = (x - lerp(STEM[0], STEM[2], along)) / STEM[4];
        return set(RAMP.ice, 0.02, (0.42 - 0.14 * along + lip) * (1 + 0.35 * side), 0, 0, 0.5);
      }
      const inL = edge(INNER_L, y), inR = edge(INNER_R, y);
      const between = y > 226 && x > inL && x < inR;
      if (between && y < jawAt(x)) { // his face
        const fx = x - FACE[0], fy = y - FACE[1], u = fx * FC + fy * FS, v = fy * FC - fx * FS, au = Math.abs(u);
        let form = 1 - 0.15 * (au / 70) ** 3 - 0.25 * Math.exp(-Math.min(x - inL, inR - x) / 12); // turning away at its edges, and in the shadow of his hair
        if (px < 7 && au > 28 && au < 70 && Math.abs(v - (-64 + 0.004 * (au - 48) ** 2)) < 3.5) return set(RAMP.dark, 0.02, 0.1); // his brows, when there is room for them above his eyes
        const k = (u + 6) / 30, mouth = 71 - 0.6 * fx * FS - 7 * k * k; // the line of his mouth, more nearly level than his eyes, its corners turned up in a slight smile
        if (Math.abs(k) < 1 && Math.abs(v - mouth) < Math.max(2.2, px * 0.5)) return set(RAMP.skin, 0.03, reach * (0.55 + 0.35 * k * k), FACE_SKIN, 0, 0);
        if (u > -22 && u < 10 && v > mouth + 5 && v < mouth + 12) form *= 1.08; // the light on his lower lip
        if (((u + 4) / 8) ** 2 + ((v - 38) / 5) ** 2 < 1) form *= 1.15;      // and on the tip of his nose
        if (u > -12 && u < 3 && Math.abs(v - 46) < Math.max(2, px * 0.45)) form *= 0.72; // his nostrils
        if (Math.abs(y - jawAt(x)) < Math.max(4, px * 0.55) && x < CHIN[0] + 30) form *= 0.75; // the inked edge of his jaw
        return set(RAMP.skin, 0.03, reach * form, FACE_SKIN, 0, 0.45);
      }
      const neckL = Math.max(343 - 0.12 * Math.max(0, y - 520), COLLAR_L[0] + ((y - COLLAR_L[1]) * (COLLAR_L[2] - COLLAR_L[0])) / (COLLAR_L[3] - COLLAR_L[1]));
      const neckR = Math.min(456 + 0.12 * Math.max(0, y - 520), COLLAR_R[0] + ((y - COLLAR_R[1]) * (COLLAR_R[2] - COLLAR_R[0])) / (COLLAR_R[3] - COLLAR_R[1]));
      if (y > 226 && x > neckL && x < neckR && x > inL && x < inR && y < 640) { // his neck, in shadow just under his jaw on the side away from the light
        const under = smooth(0, 50, y - jawAt(x)), shade = x < 400 ? 0.55 + 0.45 * under : 0.78 + 0.22 * under;
        return set(RAMP.skin, 0.03, reach * shade, FACE_SKIN, 0, 0.45);
      }
      // His hair: a dome over his head, then long and straight past his
      // shoulders, framing his face and neck. Its strands fan out from the crown.
      const dome = y < 236 && ((x - 402) / 150) ** 2 + ((y - 236) / 144) ** 2 < 1 + 0.06 * noise(x * 0.05, 3);
      const fall = y >= 190 && y < 905 + 50 * noise(x * 0.04, 5) && x > edge(OUTER_L, y) - 6 * noise(y * 0.05, 1) && x < edge(OUTER_R, y) + 6 * noise(y * 0.05, 2) && !between;
      if (dome || fall) {
        const fan = Math.atan2(x - 402, y - 110), streak = noise(fan * 46, y * 0.004 + 3) ** 2;
        return set(RAMP.dark, 0.02 + 0.16 * streak, glow * (0.35 + 0.6 * streak), HAIR);
      }
      // His robe: plain black, with a lapel either side of the V of the collar.
      if ((y > shoulder(x) || between) && Math.abs(x - 400) < 470 + Math.max(0, y - 800) * 0.15) {
        const lapel = y > 540 && (Math.abs(off(x, y, ...COLLAR_L) - 14) < 12 || Math.abs(off(x, y, ...COLLAR_R) - 14) < 12) ? 0.06 : 0;
        return set(RAMP.dark, 0.08 + lapel, glow * 0.7);
      }
      // The ground, and the slashes on it.
      for (let k = 0; k < slashes.length; k++) {
        const b = boxes[k];
        if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
        const r = slashAt(slashes[k], x, y, k);
        if (r) return set(RAMP.red, r, 0, 0, 0, 0.6);
      }
      return set(RAMP.night, 1 / 6, glow * 0.5); // flat, but for the glow
    }

    for (let l = 0; l < lines; l++) {
      const y = yAt(l);
      for (let c = 0; c < cols; c++) {
        const h = l * cols + c;
        place(xAt(c), y);
        first[h] = ramp[0]; span[h] = ramp[1]; base[h] = b0; lit[h] = l0; kind[h] = k0; front[h] = f0;
        dither[h] = 0.5 + (BAYER[(l & 3) * 4 + (c & 3)] - 0.5) * d0;
      }
    }

    // Characters that do not move, and how each is coloured: the ramp, its
    // tone unlit and how the flower's light changes it. One that the light
    // makes fainter is the outline of his face, which only shows in the dark.
    const still = new Uint8Array(cells), sFirst = new Uint8Array(cells), sSpan = new Uint8Array(cells), sBase = new Float32Array(cells), sLit = new Float32Array(cells);
    const late = new Float32Array(cells); // how much later than the rest a character goes, as the dark lifts
    const keep = (c, r, ch, rp, b, l, last = 0) => {
      if (c < 0 || c >= cols || r < 0 || r >= rows) return;
      const i = r * cols + c;
      if (front[r * 2 * cols + c] || front[(r * 2 + 1) * cols + c]) return; // nothing shows through his hand
      still[i] = ch; sFirst[i] = rp[0]; sSpan[i] = rp[1]; sBase[i] = b; sLit[i] = l; late[i] = last;
    };
    // A line of characters through points of the picture [x, y, ...]: steep
    // stretches one character to a row, shallow ones one to a column, each
    // chosen by the way the line runs through its cell.
    const strokeGlyphs = (pts, put) => {
      for (let i = 0; i + 3 < pts.length; i += 2) {
        const c0 = ((pts[i] - FRAME[0]) * S + W / 2) / unit, r0 = ((pts[i + 1] - FRAME[1]) * S + lines / 2) / 2;
        const c1 = ((pts[i + 2] - FRAME[0]) * S + W / 2) / unit, r1 = ((pts[i + 3] - FRAME[1]) * S + lines / 2) / 2;
        const dc = c1 - c0, dr = r1 - r0;
        if (Math.abs(dc) <= Math.abs(dr) * 1.5) { // steep
          const ch = Math.abs(dc) < Math.abs(dr) * 0.35 ? BAR : dc * dr < 0 ? SLASH : BACK;
          for (let r = Math.round(Math.min(r0, r1)); r < Math.round(Math.max(r0, r1)); r++) put(Math.floor(c0 + (dc * (r + 0.5 - r0)) / dr), r, ch);
        } else { // shallow
          const ch = Math.abs(dr) < Math.abs(dc) * 0.25 ? LOW : dc * dr < 0 ? SLASH : BACK;
          for (let c = Math.round(Math.min(c0, c1)); c < Math.round(Math.max(c0, c1)); c++) put(c, Math.floor(r0 + (dr * (c + 0.5 - c0)) / dc), ch);
        }
      }
    };
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = (r * 2) * cols + c, b = a + cols, x = xAt(c), y = FRAME[1] + (r * 2 + 1 - lines / 2) * px;
        if (first[a] !== first[b] || front[a] !== front[b]) continue;
        const h = hash(c + seed * 977, r);
        if (kind[a] === HAIR && h < 0.22) { // strands in his hair, fanning from the crown, catching the light
          const fan = Math.atan2(x - 402, y - 110);
          keep(c, r, Math.abs(fan) < 0.3 ? BAR : fan < 0 ? SLASH : BACK, RAMP.dark, base[a] + 0.22, lit[a] * 1.6);
        } else if (first[a] === RED && h < 0.3) keep(c, r, SLASH, RAMP.red, Math.min(1, base[a] + 0.35), 0, 0.12); // the bristles of the slashes
      }
    }
    // The outline of his face: down each cheek from his hair and along his jaw
    // to his chin. It only shows once his face has gone dark, faintly.
    const faint = (c, r, ch) => keep(c, r, ch, RAMP.dark, 0.55, -1.1, 0.16);
    strokeGlyphs([331, 392, CHEEK_L[0], CHEEK_L[1], CHIN[0] - 2, CHIN[1] - 2], faint);
    strokeGlyphs([474, 392, CHEEK_R[0], CHEEK_R[1], CHIN[0] + 2, CHIN[1] - 2], faint);
    // The stem's light line, and its frayed end.
    strokeGlyphs([STEM[0] - 1, STEM[1] + 20, STEM[2] - 1, STEM[3] - 24], (c, r, ch) => keep(c, r, ch, RAMP.ice, 0.02, 0.6));
    keep(colOf(STEM[2]), Math.floor(lineOf(STEM[3] - 6) / 2), QUOTE, RAMP.ice, 0.02, 0.7);

    // The flower's petals, in 3D, each with the ring it is in, which way round
    // it points, and when it goes.
    const pieces = [];
    RINGS.forEach(([n, rise, open, length, width, out, turn, light, weight], ring) => {
      for (let k = 0; k < n; k++) {
        const az = (turn + (360 * k) / n) * DEG, at = ORDER[ring].indexOf(k);
        pieces.push({ ring, az, rise: rise * DEG, open: open * DEG, length, width, out, light, weight, breaks: START[ring] + GAP[ring] * at + R(-0.02, 0.02) });
      }
    });
    const bulb = { ring: 3, az: 0, weight: BULB_LIGHT, breaks: T.heart, light: 0.9 };
    pieces.push(bulb);
    pieces.forEach((p, i) => { p.id = i; });
    // Where a petal is, with the flower `o` of the way open: its base on the
    // picture, the way it points, its length and half width there, and how
    // near the camera its middle is.
    const pose = (p, o) => {
      if (p === bulb) {
        p.x = HEART[0]; p.y = HEART[1] - BULB[0] * LC; p.rx = BULB[1] * (1 + 0.06 * o); p.ry = BULB[2] * (1 + 0.06 * o); p.depth = BULB[0] * LS;
        return p;
      }
      const e = lerp(p.rise, p.open, o), L = p.length * (1 + 0.05 * o), sa = Math.sin(p.az), ca = Math.cos(p.az);
      const bx = p.out * sa, bz = p.out * ca, tx = bx + L * Math.cos(e) * sa, ty = L * Math.sin(e), tz = bz + L * Math.cos(e) * ca;
      p.x = HEART[0] + bx; p.y = HEART[1] + bz * LS;
      const ex = HEART[0] + tx - p.x, ey = HEART[1] - (ty * LC - tz * LS) - p.y;
      p.len = Math.hypot(ex, ey); p.ux = ex / p.len; p.uy = ey / p.len;
      p.half = p.width * (1 + 0.05 * o) * (0.5 + 0.5 * Math.hypot(ca, sa * LS));
      p.depth = ((bz + tz) / 2) * LC + (ty / 2) * LS;
      return p;
    };
    for (const p of pieces) pose(p, 0.5);
    const drawOrder = pieces.slice().sort((p, q) => p.depth - q.depth); // farthest first
    const profile = (u) => (u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u ** 0.75) ** 0.6); // a petal's width along it: narrow at its base, widest before the middle, pointed

    // The petal or heart `p` (as last posed) at (x, y): its tone, 0 to 1 (and
    // white past that), or -1 where it is not. `atU` and `atV` are set to where
    // in it that is: along it from the base, and across it from -1 to 1, and
    // `atW` to its half width there.
    let atU = 0, atV = 0, atW = 0;
    const shadeAt = (p, x, y, rim) => {
      const bloom = 0.45 * Math.exp(-(((x - HEART[0]) / 190) ** 2 + ((y - HEART[1] + 15) / 115) ** 2)); // the white glow round the heart
      if (p === bulb) { // deeper below its middle, where it fills in between the bases of the petals
        const dx = (x - p.x) / p.rx, dy = (y - p.y) / (y > p.y ? p.ry * 1.4 : p.ry), e = dx * dx + dy * dy;
        if (e >= 1) return -1;
        atU = dx; atV = dy;
        return 0.86 + 0.12 * noise(x * 0.12, y * 0.2) + 0.1 * (1 - e);
      }
      const dx = x - p.x, dy = y - p.y, u = (dx * p.ux + dy * p.uy) / p.len, v = dx * -p.uy + dy * p.ux;
      if (u <= 0 || u >= 1) return -1;
      const w = p.half * profile(u), a = Math.abs(v);
      if (a >= w) return -1;
      atU = u; atV = v / w; atW = w;
      const fill = p.light + 0.26 * (1 - u) ** 1.3 - 0.14 * u * u + 0.08 * (noise(atV * 4 + p.id * 5.7, u * 3) - 0.5) + bloom;
      if (w - a < rim || (1 - u) * p.len < rim * 1.3) return Math.max(fill + 0.25, 0.82); // its edge, outlined in white light
      return fill;
    };
    const bounds = (p, lift) => { // the box of the picture the piece covers: x0, y0, x1, y1
      if (p === bulb) return [p.x - p.rx, p.y - p.ry - lift, p.x + p.rx, p.y + p.ry * 1.4];
      const tx = p.x + p.ux * p.len, ty = p.y + p.uy * p.len, h = p.half;
      return [Math.min(p.x, tx) - h, Math.min(p.y, ty) - h - lift, Math.max(p.x, tx) + h, Math.max(p.y, ty) + h];
    };

    // Each piece breaks into shards: seeds scattered over it as it is when it
    // breaks (fully open), each the middle of one shard (and where that is on
    // the grid, c and l). A shard starts up after a moment, gathers speed
    // going straight up, shrinks to a speck, and fades near the top of the
    // frame. Its light still falls on him until it rises above his head.
    for (const p of pieces) {
      pose(p, 1);
      const n = SPLIT[p.ring];
      p.cell = Math.sqrt((p === bulb ? Math.PI * p.rx * p.ry : p.len * p.half * 1.3) / n); // about how far across each shard is
      p.shards = [];
      for (let k = 0; k < n; k++) {
        let x, y;
        if (p === bulb) { const a = R(0, 2 * Math.PI), r = Math.sqrt(R(0.05, 0.95)); x = p.x + Math.cos(a) * r * p.rx; y = p.y + Math.sin(a) * r * p.ry; }
        else { const u = ((k + R(0.15, 0.85)) / n) * 0.86 + 0.1, v = R(-0.7, 0.7) * profile(u) * p.half; x = p.x + p.ux * u * p.len - p.uy * v; y = p.y + p.uy * u * p.len + p.ux * v; }
        p.shards.push({
          x, y, c: ((x - FRAME[0]) * S + W / 2) / unit, l: (y - FRAME[1]) * S + lines / 2,
          wait: R(0, p.ring ? 0.12 : 0.18), rise: R(60, 120), pull: R(240, 360), sway: R(0, 6.28), glyph: SHARDS[(rand() * SHARDS.length) | 0], spark: SHARDS[(rand() * SHARDS.length) | 0],
        });
      }
    }
    const moveC = new Float32Array(16), moveL = new Float32Array(16), scale = new Float32Array(16), bright = new Float32Array(16); // each shard of a piece, this frame
    const fadeTop = Math.max(top + 30, 100); // shards fade out by here, near the top of the frame
    // Where shard `f` of piece `p` is at story time s, and how bright: sets shX, shY, shB. Returns its age.
    let shX = 0, shY = 0, shB = 0;
    const flight = (p, f, s, faster = 1) => {
      const age = s - p.breaks - f.wait, a = Math.max(0, age);
      shX = f.x + 3 * Math.sin(a * 5 + f.sway) * Math.min(1, a);
      shY = f.y - (f.rise * a + 0.5 * f.pull * a * a) * faster;
      shB = (0.6 + 0.4 * Math.exp(-a / 0.15)) * smooth(fadeTop, fadeTop + 280, shY) * (1 - smooth(T.gone - 0.4, T.gone, s));
      return age;
    };

    // Specks of light rising a little way off the edges of the petals that
    // point up, and fading, each on its own slow loop in screen time.
    const upward = pieces.filter((p) => p !== bulb && p.uy < -0.2);
    const specks = Array.from({ length: 40 }, () => ({ p: upward[(rand() * upward.length) | 0], u: R(0.6, 0.98), side: rand() < 0.5 ? -1 : 1, loop: R(1.5, 2.4), shift: R(0, 3), up: R(40, 100), glyph: SPECK[(rand() * SPECK.length) | 0] }));

    // His eyes, drawn afresh each frame over his face: how open they are (0
    // shut) and how far down they look (1 at the flower). Each lid is a curve
    // across the eye; the upper one is a heavy dark line of lashes.
    const eyeBox = [];
    for (const side of [-1, 1]) {
      const cu = side * EYE_U, du = EYE_W + 10, corners = [[cu - du, EYE_V - 34 * big], [cu + du, EYE_V - 34 * big], [cu - du, EYE_V + 16 * big], [cu + du, EYE_V + 16 * big]];
      const xs = corners.map(([u, v]) => FACE[0] + u * FC - v * FS), ys = corners.map(([u, v]) => FACE[1] + u * FS + v * FC);
      eyeBox.push([side, Math.max(0, colOf(Math.min(...xs))), Math.min(cols - 1, colOf(Math.max(...xs))), Math.max(0, lineOf(Math.min(...ys))), Math.min(lines - 1, lineOf(Math.max(...ys)))]);
    }
    const lash = Math.max(5 * big, px * 0.95);
    // What is at (u, v) of eye `side`: -1 skin, 0 lashes, 1 iris, 2 the white of the eye.
    const eyeAt = (side, u, v, open, down) => {
      const n = ((u - side * EYE_U) / EYE_W) * side; // -1 at the inner corner, 1 at the outer
      if (n < -1 || n > (px < 6 ? 1.25 : 1)) return -1;
      const arch = n < 1 ? (1 - n * n) ** 0.5 : 0, upper = EYE_V - big * (10 * arch + 1.5 * n), lower = EYE_V + big * 5 * arch ** 1.3;
      if (n > 1) return Math.abs(v - (upper - lash * 0.3 + (n - 1) * 12)) < lash * 0.45 ? 0 : -1; // close to, the lashes sweep on past the outer corner
      const lid = lerp(lower, upper, open * (1 - 0.55 * down));
      if (v <= lid && v > lid - lash * (0.55 + 0.45 * arch)) return 0;
      if (v > lid && v < lower) return Math.hypot(u - side * (EYE_U - 3), v - (EYE_V - big * (1.5 - 7 * down))) < 10 * big ? 1 : 2;
      return -1;
    };

    const pieceOf = new Int16Array(halves); // which piece of the flower each half cell shows, -2 a shard, or -1
    const rib = new Uint8Array(halves); // whether a half cell of a petal is on the rib down its middle
    // At the end the dark lifts away like smoke, from the bottom up, thinning
    // to the page in strands that wind upward. `smokeAt` is how thick the
    // smoke is at (x, y) of the picture, 0 to 1; `gone` how far each half cell
    // has thinned, this frame.
    const smokeAt = (x, y) => noise(x / 55 + 1.8 * noise(x / 160 + 3.1, y / 140), y / 260);
    const gone = new Float32Array(halves);

    return {
      cols, rows, palette: INK, glyph, ink, bold, paint,
      render(t) { // t: seconds since the film started
        glyph.fill(32); ink.fill(0); bold.fill(0); paint.fill(0);
        if (t >= LENGTH) return this; // over: nothing is left on the page
        const s = t * SPEED, o = opening(s), glowNow = pulse(t) * (1 + 0.35 * o);

        // How much light the flower gives: each piece its share, a little more
        // as it glows hard just before it breaks. Once it has broken, its
        // shards give less, and less as they fade and rise above his head.
        let flower = 0;
        for (const p of pieces) {
          const flare = FLARE[p.ring], k = (s - p.breaks + flare) / flare;
          if (k < 1) flower += p.weight * (1 + (k > 0 ? 0.5 * k : 0));
          else for (const f of p.shards) { flight(p, f, s); flower += (p.weight / p.shards.length) * 0.8 * shB * smooth(150, 330, shY); }
        }
        const L = flower * glowNow; // 1 is the light in the picture as it starts

        // Everything that does not move, in the light of the moment.
        for (let h = 0; h < halves; h++) {
          const k = ((base[h] + lit[h] * L) * span[h] + dither[h]) | 0;
          paint[h] = first[h] + (k < 0 ? 0 : k > span[h] ? span[h] : k);
        }

        // His eyes: the blink, lowered to the flower, raised again.
        const tb = T.blink / SPEED, open = 1 - smooth(tb - 0.05, tb, t) + smooth(tb + 0.14, tb + 0.22, t);
        const down = smooth(T.lower, T.down, s) - smooth(T.raise, T.up, s);
        for (const [side, c0, c1, l0, l1] of eyeBox) {
          for (let l = l0; l <= l1; l++) {
            const y = yAt(l) - FACE[1];
            for (let c = c0; c <= c1; c++) {
              const h = l * cols + c;
              if (kind[h] !== FACE_SKIN) continue;
              const x = xAt(c) - FACE[0], what = eyeAt(side, x * FC + y * FS, y * FC - x * FS, open, down);
              if (what < 0) continue;
              const k = ((base[h] + lit[h] * L * 0.85) * 12 + 0.5) | 0;
              paint[h] = what === 0 ? DARK : what === 1 ? DARK + 2 : SKIN + Math.max(0, Math.min(12, k - 1));
            }
          }
        }

        // The flower, farthest petals first.
        pieceOf.fill(-1);
        const rim = px * 0.95;
        for (const p of drawOrder) {
          const flare = FLARE[p.ring], k = (s - p.breaks + flare) / flare;
          if (k >= 1) continue;
          pose(p, o);
          const hard = k > 0 ? k : 0, lift = 10 * hard * hard;
          const [x0, y0, x1, y1] = bounds(p, lift);
          const ca = Math.max(0, colOf(x0)), cb = Math.min(cols - 1, colOf(x1)), la = Math.max(0, lineOf(y0)), lb = Math.min(lines - 1, lineOf(y1));
          for (let l = la; l <= lb; l++) {
            const y = yAt(l) + lift;
            for (let c = ca; c <= cb; c++) {
              const h = l * cols + c;
              if (front[h]) continue;
              let tone = shadeAt(p, xAt(c), y, rim);
              if (tone < 0) continue;
              tone = tone * (0.9 + 0.1 * glowNow) + 0.3 * hard;
              if (hard && p !== bulb && Math.abs(noise(atU * 7 + p.id, atV * 2.2 + p.id) - 0.5) < 0.05 + 0.04 * hard) tone = 1.1; // cracks of light just before it breaks
              const kk = (tone * 13 + 0.5 + (dither[h] - 0.5) * 0.7) | 0;
              paint[h] = ICE + (kk < 0 ? 0 : kk > 13 ? 13 : kk);
              pieceOf[h] = p.id;
              rib[h] = p !== bulb && atU > 0.18 && atU < 0.8 && Math.abs(atV) * atW < px * 0.35 ? 1 : 0;
            }
          }
        }

        // Shards of the pieces that have broken: each piece's own pixels,
        // split among the shards they are nearest to, moved up with their
        // shard and shrunk toward its middle; white where it broke.
        for (const p of pieces) {
          if (s < p.breaks || s > T.gone) continue;
          pose(p, 1);
          const n = p.shards.length;
          let any = false;
          for (let k = 0; k < n; k++) {
            const f = p.shards[k], age = flight(p, f, s);
            moveC[k] = ((shX - f.x) * S) / unit; moveL[k] = (shY - f.y) * S;
            scale[k] = 1 - 0.85 * smooth(0, 0.3, age); bright[k] = shB;
            if (shB > 0.12 && scale[k] * p.cell > px * 0.8) any = true;
          }
          if (!any) continue;
          const [x0, y0, x1, y1] = bounds(p, 0);
          const ca = Math.max(0, colOf(x0)), cb = Math.min(cols - 1, colOf(x1)), la = Math.max(0, lineOf(y0)), lb = Math.min(lines - 1, lineOf(y1));
          for (let l = la; l <= lb; l++) {
            const y = yAt(l);
            for (let c = ca; c <= cb; c++) {
              const x = xAt(c);
              if (shadeAt(p, x, y, 0) < 0) continue;
              let best = 0, near = Infinity, next = Infinity;
              for (let k = 0; k < n; k++) {
                const f = p.shards[k], d = (x - f.x) ** 2 + (y - f.y) ** 2;
                if (d < near) { next = near; near = d; best = k; } else if (d < next) next = d;
              }
              const sc = scale[best], b = bright[best], f = p.shards[best];
              if (b < 0.12 || sc * p.cell < px * 0.8) continue;
              const tc = Math.floor(f.c + (c + 0.5 - f.c) * sc + moveC[best]), tl = Math.floor(f.l + (l + 0.5 - f.l) * sc + moveL[best]);
              if (tc < 0 || tc >= cols || tl < 0 || tl >= lines) continue;
              const kk = Math.round(b * (Math.sqrt(next) - Math.sqrt(near) < rim * 1.6 ? 13 : 10.5));
              paint[tl * cols + tc] = ICE + Math.max(2, Math.min(13, kk));
              pieceOf[tl * cols + tc] = -2;
            }
          }
        }

        // Characters. First those that do not move, in the light of the moment.
        for (let i = 0; i < cells; i++) {
          if (!still[i]) continue;
          const r = (i / cols) | 0, h = r * 2 * cols + (i % cols);
          if (pieceOf[h] !== -1 || pieceOf[h + cols] !== -1) continue;
          const k = Math.round((sBase[i] + sLit[i] * L) * sSpan[i]);
          if (k < 1) continue; // gone dark against what is behind it: the outline of his face, while his face is still lit
          glyph[i] = still[i]; ink[i] = sFirst[i] + (k < 0 ? 0 : k > sSpan[i] ? sSpan[i] : k);
        }
        // The flower's: the rib down the middle of each petal, and the dense white of its heart.
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const h = r * 2 * cols + c, id = pieceOf[h];
            if (id < 0 || pieceOf[h + cols] !== id) continue;
            const p = pieces[id], i = r * cols + c, g = hash(c * 3 + id, r * 5 + 1);
            if (p === bulb) {
              if (g < 0.7) { glyph[i] = STAMEN[(g * 70) % STAMEN.length | 0]; ink[i] = g < 0.35 ? ICE + 13 : ICE + 11; bold[i] = 1; }
            } else if (rib[h] || rib[h + cols]) {
              glyph[i] = Math.abs(p.ux) < 0.4 ? BAR : Math.abs(p.uy) < 0.35 ? DASH : p.ux * p.uy < 0 ? SLASH : BACK;
              ink[i] = Math.min(ICE + 13, Math.max(paint[h], paint[h + cols]) + 2);
            }
          }
        }
        // Strands of hair, swaying very slightly.
        for (let j = 0; j < STRANDS.length; j++) {
          const [pts, sway] = STRANDS[j], moved = pts.slice(), n = pts.length / 2;
          for (let k = 1; k < n; k++) moved[k * 2] += sway * (k / (n - 1)) ** 2 * Math.sin(t * 2.1 + j * 1.7);
          strokeGlyphs(moved, (c, r, ch) => {
            if (c < 0 || c >= cols || r < 0 || r >= rows) return;
            const i = r * cols + c, h = r * 2 * cols + c;
            if (first[h] === SKIN || pieceOf[h] !== -1) return;
            glyph[i] = ch; ink[i] = DARK + Math.min(8, Math.round((0.2 + lit[h] * L * 1.6) * 8));
          });
        }
        // Specks of light rising off the petals.
        for (const sp of specks) {
          const k = Math.floor((t + sp.shift) / sp.loop), f = (t + sp.shift) / sp.loop - k, p = sp.p;
          if ((t - f * sp.loop) * SPEED > p.breaks - FLARE[p.ring] || s > p.breaks - FLARE[p.ring]) continue;
          pose(p, o);
          const u = sp.u * (0.85 + 0.15 * hash(k, 3)), w = p.half * profile(u) * sp.side;
          const x = p.x + p.ux * u * p.len - p.uy * w, y = p.y + p.uy * u * p.len + p.ux * w - sp.up * f;
          const c = colOf(x), r = lineOf(y) >> 1;
          if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
          const i = r * cols + c, a = Math.sin(Math.PI * f);
          if (a < 0.25) continue;
          glyph[i] = sp.glyph; ink[i] = ICE + 10 + Math.round(a * 3); bold[i] = 0;
        }
        // The shards' own glints, and a spark flying ahead of each.
        for (const p of pieces) {
          if (s < p.breaks || s > T.gone) continue;
          for (const f of p.shards) {
            for (const faster of [1, 1.4]) {
              flight(p, f, s, faster);
              if (shB < 0.15) continue;
              const c = colOf(shX + (faster > 1 ? 8 : 0)), r = lineOf(shY) >> 1;
              if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
              const i = r * cols + c;
              glyph[i] = faster > 1 ? f.spark : f.glyph; ink[i] = ICE + Math.min(13, 7 + Math.round(shB * (faster > 1 ? 5 : 6.5))); bold[i] = shB > 0.7 ? 1 : 0;
            }
          }
        }

        // The end: the dark lifts away upward like smoke, from the bottom, in
        // strands that wind upward as they thin to the page; the red slashes
        // and the outline of his face go last.
        if (s > T.lift) {
          const e = (s - T.lift) / (T.end - T.lift), rise = 600 * e; // how far through the lifting, and how far the strands have risen
          for (let l = 0, h = 0; l < lines; l++) {
            const at = e * 2.05 - 1.3 + (l + 0.5) / lines; // how far past this row the lifting is, before the strands
            if (at < -0.2) { gone.fill(-1, h, h + cols); h += cols; continue; }
            const y = yAt(l) + rise;
            for (let c = 0; c < cols; c++, h++) {
              const f = (gone[h] = at - 0.4 * (smokeAt(xAt(c), y) - 0.5)) - (first[h] === RED ? 0.12 : 0);
              if (f <= 0) continue;
              const k = Math.floor((1 - f / 0.35) * 9 + BAYER[(l & 3) * 4 + (c & 3)]); // 9: still all there; 1 to 8: smoke, thinner and thinner
              paint[h] = k >= 9 ? paint[h] : k < 1 ? 0 : SMOKE + k - 1;
            }
          }
          for (let i = 0; i < cells; i++) if (glyph[i] > 32 && gone[(((i / cols) | 0) * 2 + 1) * cols + (i % cols)] > late[i]) glyph[i] = 32;
        }
        return this;
      },
    };
  }

  // Play it on the stage. Resolves when it has finished. `seed` changes the
  // shards, the specks and the slashes beyond the frame; `freezeAt` holds one
  // moment (in seconds) on screen. Reduced motion holds the first look: the
  // flower glowing in his hands, his eyes on the camera.
  const film = { length: LENGTH, still: 1.6 / SPEED, grid: [110, 60], createScene };
  return { play: (options) => AsciiStage.play(film, options), createScene };
})();
