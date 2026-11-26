/*
 * Meditation on the mountain peak: an ASCII loading screen for the stage.
 *
 *   <script src="ascii-stage.js"></script>
 *   <script src="peak-meditation.js"></script>
 *   <script>PeakMeditation.play().then(showThePage);</script>
 *
 * A young swordsman sits cross-legged on a flat rock at the edge of a peak,
 * a plum tree in blossom beside him and a sea of clouds below, in the blue
 * before sunrise: black robe open over white, wide sleeves, a sword on the
 * rock at his side, and a long tail of black hair, tied high with a green
 * cord, streaming in the wind. Qi rises from him with each breath and
 * spreads, the clouds begin to turn about the peak, and the sun breaks the
 * horizon and turns it all gold. The camera pushes in on his face; he opens
 * his eyes, narrow and red, under a scowl and a ragged fringe; it goes on
 * into one of them and holds there while the sunrise shows in it, until that
 * flares to white, and the white thins away to show the page.
 *
 * The scene is described in its own units (one is his height as he sits) and
 * looked at through a camera, so the same shapes serve from the wide shot to
 * his eye: each is drawn with whatever detail is large enough to show.
 */
const PeakMeditation = (() => {
  'use strict';
  const { code, clamp01, lerp, smooth, mulberry32, hash, noise } = AsciiStage;

  // The story's timeline, in seconds at the pace it was written.
  const T = {
    breath: 2.5, // one breath, out and in
    qi: 0.8,     // the first breath out that carries qi
    spread: 3.3, // the second, which sends it out over the clouds
    spiral: 3.6, // and they begin to turn about the peak
    sun: 5.4,    // the sun's edge breaks the horizon
    push: 7.2,   // the camera leaves the wide shot for his face
    gold: 7.6,   // the light has reached everything
    open: 9.4,   // his eyes begin to open
    seen: 10.2,  // they are open, and the camera goes on into the one nearer the sun
    eye: 11.05,  // close enough for the sunrise to show in it, and easing to a hold
    bloom: 14.15, // where the sunrise flares
    white: 14.8, // until there is only white
    end: 16,     // and the white has thinned away
  };
  // It is played faster than that. LENGTH is how many seconds the whole of it
  // takes on screen, and SPEED how many times faster than the story that is.
  const LENGTH = 5, SPEED = T.end / LENGTH;

  // Colours. Most are a ramp from shadow to light, written out once for the
  // blue before sunrise and once for the gold after it (the sky a third time,
  // in the middle, where the way from one to the other needs steering). The
  // palette is mixed afresh every frame: that is how the light changes over
  // the whole picture at once.
  const KEYS = [[[0, 0, 0]]]; // each entry's colour in each light; entry 0 means nothing there
  const rgb = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const ramp = (...lights) => {
    const at = KEYS.length, rows = lights.map((l) => (typeof l === 'string' ? l.split(' ').map(rgb) : l));
    rows[0].forEach((_, j) => KEYS.push(rows.map((row) => row[j])));
    return at;
  };
  // Things given in their own colours, as the blue before sunrise shows them (dim, cool and greyed)
  // and as the sunrise does (warm): how much of each of red, green and blue, what is added, and how far toward grey.
  const BLUE = [0.56, 0.6, 0.78, 6, 8, 24, 0.45], GOLD = [1.01, 0.96, 0.91, 8, 5, 0, 0];
  const lit = (list) => [BLUE, GOLD].map((light) => list.split(' ').map(rgb).map((c) => {
    const grey = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
    return c.map((v, j) => Math.min(255, Math.round(lerp(v, grey, light[6]) * light[j] + light[j + 3])));
  }));
  const SKY = ramp('0a1030 0d1538 111b42 16224d 1c2b59 243666 2e4274 3b5082', // from overhead down to the horizon
    '1a1f4e 26295e 393470 554080 794e8a a25f8e c8798a e79984', '2f4a94 4460a4 6276b0 8a8cb8 b4a2b4 d9b6a0 f2c688 ffd680');
  const GLOW = ramp('3d5284 485a86 596688 6f7488 8a8488', 'f09c74 f7b074 fcc67c ffda94 ffeebc', 'ffc468 ffd67c ffe494 fff1b8 fffae4'); // round the sun, outermost first
  const SUN = ramp('fffdf0 ffe9a0'); // its disc and rim
  const SEA = ramp('0f1736 172146 202d58 2b3b6c 3a4c82 4d6296', '3c3060 5a4072 7e5480 a66e88 cc8e8c ecb494'); // cloud the light has not reached
  const LIT = ramp('343646 46464e 5e5a50 7c7252 a09054 c6b062', '704458 a8625a d88856 f4ae58 ffd070 ffecaa'); // cloud that qi or sun has reached
  const FAR = ramp('16204a 1d2a58 263566', '4c3860 7a5074 a8727e'); // peaks standing out of the sea a long way off, nearest first
  // The plum tree, in the plum blossom's own colours: its wood, shadow to light; its blossom,
  // three shades in shadow and nine from deep to pale (one ramp of twelve), and the white of a petal.
  const BARK = ramp(...lit('2a1c18 3b2821 4a322a 5a3d32 7d5946 a57a62'));
  const BLOOM = ramp(...lit('5c1c3a 7a2149 972353 b3235c c92d69 dc3f7a e9588e f271a1 f88bb3 fba3c4 fdbbd3 ffd2e2 fff6fa'));
  const ROCK = ramp('060a18 0b1124 131b34 1e2948 2d3b60', '181024 2c1e32 54383a a6713e e8b25a');
  // Him. Everything from ROBE up to QI is part of him.
  const ROBE = ramp('07080e 0d0f18 151826 22283a 323a54', '0c0909 15100f 211816 452e24 8a5c36'); // his black robe: shade, cloth, its lit side, the light along its edge, the sun on it
  const INNER = ramp(...lit('c4beb8 e6e3de ffffff')); // the white robe and trousers under it
  const TRIM = ramp(...lit('6a1824 8e2432')); // the thin dark red edge of the white robe's collar
  const SASH = ramp('141826 242a3e', '1f1718 3a2c28');
  const GREEN = ramp(...lit('173a26 25603a 3f8f56')); // the cord in his hair and the tassel at his waist
  const SWORD = ramp(...lit('120e10 2c2224 5a4c46 a09080')); // black lacquer, its lit edge, dull iron, and the light on it
  const EMBLEM = ramp(...lit('9e1f4c d33a6c f06a96 ffe0e8')); // the plum blossom on his robe: petals in shade and lit, and its heart
  const SKIN = ramp(...lit('c99f91 e0bfb1 efd5c8 f7e6dc fdf3ee')); // pale, shadow to light
  const LINE = ramp(...lit('a87c70')); // fine lines: lids, nostrils, the line of his mouth
  const LIP = ramp(...lit('c27a82 d4868e')); // his thin lips: the upper, in shade, and the lower
  const HAIR = ramp('0a0910 121020 22223a 323c58 3a3a56', '141018 231c26 3a3242 8c5c44 5a4e6a'); // near black, its cool sheen, the sun along its edge, and the light along the locks of his fringe and the sheen's characters
  const EYE = ramp('cfc0bc f6efec'); // the whites of his eyes, in the shade of the lid and out of it
  const IRIS = ramp('2a0614 5e0a28 8e0e3c cc1452 ee2a68 ff5c8e fff4f6'); // red-magenta: pupil, rim, under the lid, iris, lit, brightest, and the light it catches
  const SHINE = ramp('d8782e ffc451 fff3c8'); // the sunrise in his eye: the glow round the sun, the sun and the horizon, its heart
  const QI = ramp('6a6040 a49050 d6c068', 'd49638 ffc74c fff0a0'); // faint to bright
  // Colours that are see-through, or are set by hand each frame.
  const STAR = KEYS.push([[200, 214, 255]], [[236, 240, 255]]) - 2;
  const RAY = KEYS.push([[255, 236, 170]]) - 1;
  const AURA = KEYS.push([[255, 206, 110]], [[255, 206, 110]], [[255, 206, 110]]) - 3;
  const VEIL = KEYS.push([[255, 253, 244]], [[255, 253, 244]], [[255, 253, 244]]) - 3;
  const WHITE = KEYS.push([[255, 253, 244]]) - 1;

  const [TILDE, DOT, PLUS, STARRY, BAR, SLASH, BACK, DASH, LOW, HIGH, TICK, COMMA] = code('~.+*|/\\-_\'`,');
  const [HASH, AT, EM, DOUBLEU, PERCENT, OPEN, CLOSE, RING] = code('#@MW%()o');
  const CRACKS = code('|/\\:\'.'), CORE = code('@@*'), BODY = code('@**o'), STRAY = code('*o'), PETAL = code("',`.");
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16); // an ordered dither, 4 by 4

  // The world. Units are his height as he sits; x is to the right and y is up,
  // from the middle of his seat on the rock.
  const HEAD_Y = 0.87;                    // the middle of his head
  const EYE_X = 0.043, EYE_Y = 0.881;     // the middle of each eye, either side of his nose
  const IRIS_X = 0.0417, IRIS_Y = 0.8798; // the middle of each iris, a little in from that: the one on our right is where the film ends
  const GLINT_X = 0.0028, GLINT_Y = 0.0014; // where the sun stands in each iris, from its middle
  const MOUTH_Y = 0.783;                  // the line of his mouth
  const CLOUD_Y = -2.1;                   // the top of the sea of clouds
  const PEAK_X = -0.85;                   // the axis of the peak, which the clouds turn about
  const LENS = 8;                         // how far off the camera stands in the wide shot
  const MIDDLE = -0.7;                    // what the wide shot is centred on: between him and his tree
  const PEAKS = [[-10, 20, 4.2, 2], [-27, 46, 6.2, 3], [9.5, 30, 3.2, 1.6], [24, 62, 7, 3.2]]; // far peaks: across and beyond ours, height, half width
  // The plum tree, rooted on the crag beside his rock. Its trunk and limbs are drawn by hand, as
  // in plum-blossom.js: zigzags of straight runs, each [heading in degrees (90 is straight up),
  // length]. Plum wood is angular, so the runs turn sharply.
  const ROOT = [-1.4, -0.24], TRUNK = [[98, 0.3], [72, 0.28], [110, 0.3], [82, 0.24]];
  const LIMBS = [ // [the joint of the trunk it leaves from, width, runs...]
    [4, 0.11, [40, 0.28], [16, 0.27], [44, 0.24], [20, 0.22], [36, 0.18]], // reaching out toward him
    [4, 0.1, [100, 0.28], [78, 0.27], [104, 0.25], [84, 0.2]],             // up
    [3, 0.11, [150, 0.3], [126, 0.27], [158, 0.26], [134, 0.22]],          // up and out over the drop
    [2, 0.08, [166, 0.27], [140, 0.24], [170, 0.24], [148, 0.2]],          // low, over the drop
  ];
  const CROWN = [-1.5, 1.3, 1.25, 0.95]; // what grows by rule stays inside this ellipse: middle, half width, half height
  const FOLDS = [[0.17, 0.66, 0.15, 0.3], [-0.17, 0.66, -0.16, 0.3]]; // creases down the front of his black robe
  // His tail of hair at rest: the line down its middle from where it is tied at his crown. The
  // wind blows from the left, so it streams away to the right in an S, and its end splits into strands.
  const TAIL = [[0, 1.07], [0.14, 1.13], [0.26, 1.04], [0.3, 0.88], [0.35, 0.71], [0.47, 0.58], [0.66, 0.5], [0.86, 0.49], [1.04, 0.55]];
  // His face and hair, measured from the middle of his head (y up). The face is narrow, its jaw
  // curving down to a rounded chin, and his head is tipped back a little, as if he looks down on
  // whoever is in front of him, so his features sit high and close together.
  const faceHalf = (y) => 0.094 * Math.max(0, 1 - (y / (y > 0 ? 0.13 : 0.143)) ** 2) ** (y > 0 ? 0.5 : 0.7); // half the width of his face
  // His fringe hangs in pointed locks to his eyes, parted to our right of the middle. Those on our
  // left are longer, down to his right eye and past it, but leave a gap over his brow, so that it
  // scowls as the other does, with one thin lock across it; those on our right stop at his brow,
  // so the eye the film ends in stays clear. Each lock is [where it leaves the hair above his
  // brow, where its point is (x, y), half its width at the top]; where two cross, the first is in front.
  const PART = 0.024, BANGS_Y = 0.105, BANGS = [
    [0.006, -0.002, -0.022, 0.011], // the long one between his eyes
    [0.014, 0.008, 0.03, 0.01],
    [0.034, 0.045, 0.047, 0.012],
    [-0.01, -0.016, 0.004, 0.011],
    [0.052, 0.066, 0.056, 0.013],
    [-0.034, -0.05, -0.006, 0.006], // the thin one, across his brow and eye
    [0.07, 0.085, 0.052, 0.012],
    [-0.052, -0.068, -0.004, 0.013],
    [-0.07, -0.09, 0.018, 0.012],
  ];
  // The jagged locks either side of his face, from his temples to his jaw: their inner and outer
  // edges, and where they end, in points.
  const lockIn = (y) => 0.077 - 0.006 * clamp01(-y / 0.12) + 0.002 * Math.sin(y * 80);
  const lockOut = (y) => 0.122 - 0.014 * clamp01(-y / 0.13);
  const lockEnd = (a) => -0.137 + 0.36 * (a - 0.07) + 0.042 * (((a - 0.07) / 0.022 + 1) % 1) ** 1.3;

  // How far a point is from the stroke between two others, and (in `along`) how far along it.
  let along = 0;
  const off = (x, y, x0, y0, x1, y1) => {
    const dx = x1 - x0, dy = y1 - y0;
    along = clamp01(((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy));
    return Math.hypot(x - x0 - dx * along, y - y0 - dy * along);
  };

  function createScene({ cols, rows, aspect = 2, seed = 1 }) {
    const lines = rows * 2, cells = cols * rows;
    const glyph = new Uint8Array(cells), ink = new Uint8Array(cells), bold = new Uint8Array(cells);
    const paint = new Uint8Array(cells * 2), wash = new Uint8Array(cells);
    const palette = KEYS.map(() => '#000');

    // The picture is measured in half rows, which are near enough square: a column is `unit` of them wide.
    const unit = 2 / aspect, W = cols * unit, cx = W / 2, cy = lines / 2;
    // The wide shot: half rows to the unit (on a narrow screen, as many as still fit him and his tree
    // across it), the row his seat is on, and the row of the horizon, which is level with the camera.
    const S0 = Math.min(lines * 0.24, W / 4.2), seat = lines * 0.63, hy = Math.min(lines * 0.27, seat - 1.45 * S0), F = S0 * LENS;
    // How far the camera closes in, as the log of its zoom: on his face, then into his eye, until
    // that is most of the screen across. The move into his eye is quick at first and then eases
    // to a hold, so the sunrise in it has time to be seen. Under those two moves the camera drifts
    // in all the time, so the push never quite stops.
    const FACE = Math.log(Math.min(W * 3.4, lines * 3.33) / S0), INTO = Math.log(Math.min(W * 13, lines * 28) / S0);
    const drift = (s) => 0.02 * Math.min(s, T.push) + 0.07 * Math.min(Math.max(0, s - T.push), T.seen - T.push) + 0.04 * Math.max(0, s - T.seen);
    const settle = (s) => smooth(0, 1, 1 - (1 - clamp01((s - T.seen) / (T.bloom - T.seen))) ** 3);
    const zoomAt = (s) => drift(s) + (FACE - drift(T.seen + 0.4)) * smooth(T.push, T.seen + 0.4, s)
      + (INTO - FACE + drift(T.seen + 0.4) - drift(T.bloom)) * settle(s);
    const sunX = cx + Math.min(W * 0.29, lines * 0.55), sunR = Math.max(2.2, lines * 0.052);

    // The sea of clouds is one sheet of lumps wrapped round the peak: across the sheet is the
    // angle about the peak and up it the log of the distance, so a lump keeps its shape at any
    // distance, and the far ones, being bigger, still show when perspective has flattened them.
    const TEX = 256, KNOTS = 22, lump = new Float32Array(TEX * TEX);
    const ROUND = TEX / (2 * Math.PI), OUT = 32; // across: cells to the radian; up: cells to each e-fold of distance
    const SPIN = 0.5, SLOW = 5; // radians a second the clouds by the peak turn, and how far out they turn at half that
    const PITCH = 3 / OUT, ARMS = 3, WIND = 2 / OUT; // how close the banks lie; the arms of the spiral, and how tightly they wind
    const knot = (i, j, n) => hash((((i % n) + n) % n) + seed * 131, j + n * 977);
    for (let j = 0; j < TEX; j++) for (let i = 0; i < TEX; i++) {
      let v = 0;
      for (let n = KNOTS, share = 0.65; n <= KNOTS * 2; n *= 2, share = 0.35) {
        const x = (i / TEX) * n, y = (j / TEX) * n, xi = Math.floor(x), yi = Math.floor(y), a = smooth(0, 1, x - xi), b = smooth(0, 1, y - yi);
        v += share * lerp(lerp(knot(xi, yi, n), knot(xi + 1, yi, n), a), lerp(knot(xi, yi + 1, n), knot(xi + 1, yi + 1, n), a), b);
      }
      lump[j * TEX + i] = v;
    }
    const lumpAt = (a, b) => { // `a` goes round and round, `b` stops at the ends
      a -= Math.floor(a / TEX) * TEX;
      b = b < 0 ? 0 : b > TEX - 1.001 ? TEX - 1.001 : b;
      const i = a | 0, j = b | 0, i1 = (i + 1) & (TEX - 1), f = a - i, g = b - j, p = j * TEX;
      return lerp(lerp(lump[p + i], lump[p + i1], f), lerp(lump[p + TEX + i], lump[p + TEX + i1], f), g);
    };

    // The camera, set afresh each frame: `S` half rows to the unit, and the point (fx, fy) of the
    // world on the screen at (gx, gy). `D` is how far off the peak is, `sea` the focal length
    // times the camera's height over the clouds, and `camU` where the camera is across the peak's axis.
    let S = S0, px = 1 / S0, fx = 0, fy = EYE_Y, gx = cx, gy = cy, D = LENS, sea = F, camU = 0;
    const col = (X) => (gx + (X - fx) * S) / unit, row = (Y) => (gy - (Y - fy) * S) / 2; // where a point of the world is, in columns and rows
    let viewL = 0, viewR = 0, viewB = 0, viewT = 0; // the part of the world on the screen
    let now = 0, lift = 0, open = 0, wing = 0; // the story's time; how far his shoulders are raised by the breath, and his eyes open; and how high his upper lids are where their lines sweep up
    const mouthLine = (x) => MOUTH_Y - 0.0016 * (x / 0.025) ** 2; // his mouth: a thin, flat line, a little down at the corners

    // Paint the half cells of a box of the world with whatever colour `shade` gives each (0 leaves it
    // alone). `shade` is told the point of the world, and the dither of the half cell it is in.
    function fill(X0, Y0, X1, Y1, shade) {
      const c0 = Math.max(0, Math.floor((gx + (X0 - fx) * S) / unit)), c1 = Math.min(cols - 1, Math.floor((gx + (X1 - fx) * S) / unit));
      const l0 = Math.max(0, Math.floor(gy - (Y1 - fy) * S)), l1 = Math.min(lines - 1, Math.floor(gy - (Y0 - fy) * S));
      for (let l = l0; l <= l1; l++) {
        const Y = fy + (gy - l - 0.5) / S;
        for (let c = c0, i = l * cols + c0; c <= c1; c++, i++) {
          const k = shade(fx + ((c + 0.5) * unit - gx) / S, Y, BAYER[(l & 3) * 4 + (c & 3)]);
          if (k) paint[i] = k;
        }
      }
    }

    // The crag: a tower of rock that splits upright, standing out of the clouds. Its foot is
    // round, so the clouds lap it lower in front than at the sides: a row of it shows only
    // where the sea seen along that row is further off than the rock. Its two sides, and how
    // far off the sea is, are worked out once for each row.
    let cragY = NaN, cragL = 0, cragR = 0, cragSea = 0;
    const crag = (X, Y) => {
      if (Y !== cragY) {
        const deep = -Y;
        cragY = Y;
        cragSea = sea / Math.max(1e-6, gy - (Y - fy) * S - hy);
        cragL = -2.32 - 0.13 * deep + 0.24 * (noise(deep * 2.1 + 3, 1) - 0.5);
        cragR = 0.6 + 0.17 * deep - 0.28 * Math.exp(-(((deep - 0.75) / 0.35) ** 2)) + 0.22 * (noise(deep * 2.4 + 9, 2) - 0.5);
      }
      const across = (X - PEAK_X) / 1.75;
      if (X < cragL || X > cragR || cragSea < D - 0.8 * Math.sqrt(Math.max(0, 1 - across * across)) + 0.16 * Math.abs(Math.sin(X * 2.9 + 0.4))) return 0;
      const top = X > -0.95 ? -0.28 : -0.2 + 0.03 * Math.sin(X * 9) + 0.14 * smooth(-1.95, -2.3, X);
      if (Y > top) return 0;
      if (X > -0.95 && Y > -0.42) return ROCK; // in the shade of the slab
      if (Y > top - Math.max(0.06, px)) return ROCK + 3; // its top takes the light of the sky
      if (cragR - X < 0.34) return ROCK + (cragR - X < 0.12 ? 4 : 3); // and so does the side toward the sun
      if (X - cragL < 0.22) return ROCK;
      const grain = noise(X * 3.4 + 1.5 * noise(X * 0.9, Y * 1.3 + 20), Y * 0.5);
      return ROCK + (grain > 0.62 ? 2 : grain > 0.36 ? 1 : 0);
    };
    // The flat rock he sits on, lying on the edge of the crag and reaching out over the drop.
    const slab = (X, Y) => {
      const deep = -Y;
      if (deep < 0 || deep > 0.3 + 0.03 * Math.sin(X * 7) || X < -0.97 + 0.3 * deep || X > 1.06 - 0.25 * deep - 1.1 * deep * deep) return 0;
      if (deep < Math.max(0.07, px * 0.9)) return ROCK + (X > 0.62 ? 4 : 3);
      if (X > 0.86 - 0.9 * deep) return ROCK + 3;
      return ROCK + (deep > 0.24 || noise(X * 1.6, Y * 16) > 0.6 ? 1 : 2);
    };

    // The plum tree. Boughs and twigs grow from the hand-drawn limbs by the rules plum-blossom.js
    // uses: a side bough at each elbow, carrying on the way the limb was going; a fork at each
    // limb's tip; short shoots straight up; twigs off the boughs; and a puff of blossom at the tip
    // of every bough and twig. It is all placed in the world once: runs of wood [x0, y0, x1, y1,
    // width at each end], puffs [middle x, y, radius, shade], and single blossoms [x, y, shade,
    // how far out in its puff, glyph, the zoom it comes in at]: about one to a cell in the wide
    // shot, and more coming in between them as the camera closes, so a puff stays full.
    const rand = mulberry32(seed * 7919 + 11), R = (a, b) => a + (b - a) * rand(), pick = (list) => list[(rand() * list.length) | 0];
    const DEG = Math.PI / 180, wood = [], puffs = [], flowers = [];
    const crowded = (0.9 * S0 * S0) / (2 * unit), petal = 0.6 / S0; // blossoms to the square unit, and how big one is
    const inCrown = (x, y) => ((x - CROWN[0]) / CROWN[2]) ** 2 + ((y - CROWN[1]) / CROWN[3]) ** 2 < 1 && (x < -0.5 || y > 1.25); // and clear of his head
    const skyward = (a, k) => a + Math.atan2(Math.cos(a), Math.sin(a)) * k; // turned part of the way toward straight up
    function puff(x, y, a, r) { // full flowers at the heart, looser toward the rim, lit from the sun's side
      const mx = x + Math.cos(a) * r * 0.45, my = y + Math.sin(a) * r * 0.45, tone = R(2.5, 4.5);
      puffs.push([mx, my, r, tone]);
      for (const need of [1, 2, 4]) for (let k = Math.max(need > 1 ? 0 : 3, Math.round(Math.PI * r * r * crowded * (need > 1 ? 0.75 * need * need : 1))); k > 0; k--) {
        const e = Math.sqrt(rand()) * 1.1, turn = R(0, 2 * Math.PI), dx = Math.cos(turn) * e, dy = Math.sin(turn) * e;
        flowers.push([mx + dx * r, my + dy * r * 0.9, Math.max(0, Math.min(8, Math.round(tone + (dx + 0.6 * dy) * 1.5 + R(-1, 1)))), e,
          e < 0.5 ? pick(CORE) : e < 0.9 ? pick(BODY) : dy > 0 ? DOT : dx < 0 ? TICK : HIGH, need]);
      }
    }
    function add(x, y, runs, width, depth) { // a branch from (x, y) along `runs` of [heading, length], then what grows from it
      const total = runs.reduce((sum, [, l]) => sum + l, 0), taper = [0.5, 0.3, 0.5, 0.7][depth]; // trunk, limb, bough, twig
      let s = 0;
      runs.forEach(([a, l], i) => {
        const x1 = x + Math.cos(a) * l, y1 = y + Math.sin(a) * l, w1 = width * lerp(1, taper, (s + l) / total);
        wood.push([x, y, x1, y1, width * lerp(1, taper, s / total), w1]);
        if (depth === 1 && rand() < 0.65) { const k = R(0.3, 0.7); sprout(lerp(x, x1, k), lerp(y, y1, k), Math.PI / 2 + R(-25, 25) * DEG, R(0.08, 0.15), 0, 3); }
        if (depth === 2) for (let k = 0.2; k < 0.85; k += 0.15) if (rand() < 0.3) flowers.push([lerp(x, x1, k) + R(-0.02, 0.02), lerp(y, y1, k) + R(-0.01, 0.03), Math.round(R(3, 5.5)), 1, pick(STRAY), 1]);
        if (depth === 1 || depth === 2) {
          if (i < runs.length - 1) sprout(x1, y1, a - Math.sign(Math.sin(runs[i + 1][0] - a)) * R(20, 45) * DEG, depth === 1 ? R(0.22, 0.34) : R(0.08, 0.14), w1 * 0.65, depth + 1);
          else if (depth === 1) for (const sign of [-1, 1]) sprout(x1, y1, a + sign * R(18, 40) * DEG, R(0.16, 0.26), w1 * 0.65, 2);
        }
        x = x1; y = y1; s += l;
      });
      if (depth >= 2) puff(x, y, runs[runs.length - 1][0], depth === 2 ? R(0.12, 0.17) : R(0.07, 0.1));
    }
    function sprout(x0, y0, heading, length, width, depth) { // a zigzag from (x0, y0), cut short at the edge of the crown
      const n = depth === 2 ? pick([2, 2, 3]) : 1, runs = [];
      let x = x0, y = y0, a = heading, side = pick([-1, 1]);
      for (let i = 0; i < n; i++, side = -side) {
        a = skyward(a + (i ? side * 28 * DEG * R(0.6, 1.3) : 0), depth === 2 ? 0.2 : 0.35);
        let l = (length / n) * R(0.8, 1.2);
        if (!inCrown(x + Math.cos(a) * l, y + Math.sin(a) * l)) l *= 0.5;
        if (!inCrown(x + Math.cos(a) * l, y + Math.sin(a) * l)) break;
        runs.push([a, l]); x += Math.cos(a) * l; y += Math.sin(a) * l;
      }
      if (runs.length) add(x0, y0, runs, width, depth);
    }
    const joints = [ROOT];
    for (const [a, l] of TRUNK) { const [x, y] = joints[joints.length - 1]; joints.push([x + Math.cos(a * DEG) * l, y + Math.sin(a * DEG) * l]); }
    add(ROOT[0], ROOT[1], TRUNK.map(([a, l]) => [a * DEG, l]), 0.24, 0);
    wood.push([ROOT[0] - 0.02, ROOT[1], ROOT[0] - 0.01, ROOT[1] + 0.12, 0.4, 0.24]); // the trunk flares where it grips the rock
    for (const [j, width, ...runs] of LIMBS) add(...joints[j], runs.map(([a, l]) => [a * DEG, l]), width, 1);
    flowers.sort((p, q) => q[3] - p[3]); // rims first, so that where puffs overlap the hearts stay whole
    const bloomed = Float32Array.from(flowers.flat()); // six numbers to a flower, which is quick to run through: a big screen has tens of thousands
    flowers.length = 0;
    // A few petals let go and drift on the air: [when, x, y, speed across, sinking, sway, its pace, phase, shade].
    const petals = [];
    for (let k = 0; k < 10; k++) {
      const [x, y, r] = puffs[(rand() * puffs.length) | 0];
      petals.push([R(-3, T.white - 2), x + R(-0.5, 0.5) * r, y + R(-0.5, 0.5) * r, R(0.14, 0.26), R(0.04, 0.09), R(0.03, 0.07), R(1.6, 2.6), R(0, 6.28), Math.round(R(4, 7))]);
    }

    // The tree's wood, lit from the sun's side. Wood less than a couple of pixels across is left to
    // `treeMarks`, which draws it as a line of characters.
    function treeWood() {
      for (const [x0, y0, x1, y1, w0, w1] of wood) {
        if (Math.max(w0, w1) * S < 2.2) continue;
        const reach = Math.max(w0, w1) / 2, len = Math.hypot(x1 - x0, y1 - y0), nx = (y0 - y1) / len, ny = (x1 - x0) / len, sun = nx * 0.8 + ny * 0.6 > 0 ? 1 : -1;
        fill(Math.min(x0, x1) - reach, Math.min(y0, y1) - reach, Math.max(x0, x1) + reach, Math.max(y0, y1) + reach, (X, Y) => {
          const d = off(X, Y, x0, y0, x1, y1), half = lerp(w0, w1, along) / 2;
          if (d > half) return 0;
          const side = (((X - x0) * nx + (Y - y0) * ny) * sun) / half; // from -1 in shade to 1 toward the sun
          return BARK + Math.max(0, Math.min(5, Math.round(2.2 + side * 2 + (noise(X * 30, Y * 30) - 0.5) * 1.4)));
        });
      }
    }
    // Its blossom: the body of each puff is painted two shades deeper than its flowers, and once
    // the camera is close enough for one of the first flowers to be bigger than a pixel, each of
    // those is painted too, and its character goes paler, to stand for its heart.
    const opened = () => petal * S > 1.2;
    function treeBlossom() {
      for (const [x, y, r, tone] of puffs) fill(x - r * 1.1, y - r, x + r * 1.1, y + r, (X, Y) => {
        const dx = (X - x) / r, dy = (Y - y) / (r * 0.9), e = Math.hypot(dx, dy) + 0.3 * (noise(X * 16, Y * 16) - 0.5);
        return e < 0.88 ? BLOOM + 1 + Math.max(0, Math.min(8, Math.round(tone + (dx + 0.6 * dy) * 1.5))) : 0;
      });
      if (opened()) for (let i = 0; i < bloomed.length; i += 6) {
        const x = bloomed[i], y = bloomed[i + 1], shade = bloomed[i + 2];
        if (bloomed[i + 5] === 1 && x > viewL - petal && x < viewR + petal && y > viewB - petal && y < viewT + petal) fill(x - petal, y - petal, x + petal, y + petal, (X, Y) => ((X - x) ** 2 + (Y - y) ** 2 < petal * petal ? BLOOM + 3 + shade : 0));
      }
    }

    // The man, from the front, sitting tall. His tail of hair, worked out once at rest: points
    // along it [x, y, which way is across it (x, y), how far along it, from 0 at the cord to 1].
    const tail = [];
    for (let k = 0; k < TAIL.length - 1; k++) for (let j = 0; j < 6 || (j === 6 && k === TAIL.length - 2); j++) {
      const t = j / 6, [p0, p1, p2, p3] = [k - 1, k, k + 1, k + 2].map((i) => TAIL[Math.max(0, Math.min(TAIL.length - 1, i))]);
      const at = (i) => 0.5 * (2 * p1[i] + (p2[i] - p0[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t * t + (3 * p1[i] - p0[i] - 3 * p2[i] + p3[i]) * t * t * t);
      tail.push([at(0), at(1), 0, 0, 0]);
    }
    tail.forEach((p, k) => {
      const q = tail[Math.max(0, k - 1)], r = tail[Math.min(tail.length - 1, k + 1)], d = Math.hypot(r[0] - q[0], r[1] - q[1]);
      p[2] = (q[1] - r[1]) / d; p[3] = (r[0] - q[0]) / d;
      p[4] = k ? tail[k - 1][4] + Math.hypot(p[0] - tail[k - 1][0], p[1] - tail[k - 1][1]) : 0;
    });
    for (const p of tail) p[4] /= tail[tail.length - 1][4];
    // The wind sends waves down it, growing toward its end, where it splits into strands that
    // spread and flick on their own. Each frame: its middle line, and each strand's [x, y, width, ...].
    const SPLIT = 0.66, tailX = new Float64Array(tail.length), tailY = new Float64Array(tail.length);
    const tailWidth = (u) => 0.038 + 0.044 * smooth(0, 0.14, u) - 0.026 * smooth(0.35, 0.72, u);
    const strands = [0, 1, 2, 3, 4].map((k) => ({ spread: (k - 2) / 2, end: 1 - 0.16 * hash(k + 3, seed), pts: [] }));
    function blowTail(s) {
      const gust = 0.85 + 0.15 * Math.sin(0.9 * s);
      tail.forEach(([x, y, nx, ny, u], k) => {
        const off = 0.065 * u ** 1.3 * gust * Math.sin(2 * Math.PI * (1.25 * u - s / 2.2) + 0.4);
        tailX[k] = x + nx * off; tailY[k] = y + ny * off;
      });
      strands.forEach(({ spread, end, pts }, k) => {
        pts.length = 0;
        tail.forEach(([, , nx, ny, u], i) => {
          if (u < SPLIT - 0.04 || u > end + 0.03) return;
          const q = clamp01((u - SPLIT) / (1 - SPLIT)), w = tailWidth(u);
          const side = spread * w * 0.5 * (1 + 1.8 * q) * smooth(SPLIT - 0.04, SPLIT + 0.04, u) + 0.018 * q * Math.sin(2 * Math.PI * (1.8 * u - s / 1.5) + 1.7 * k);
          pts.push(tailX[i] + nx * side, tailY[i] + ny * side, w * 0.3 * clamp01((end - u) / (end - SPLIT + 0.04)) ** 0.7);
        });
      });
    }
    // A length of it between two points, lit along the side toward the sun.
    function tube(x0, y0, x1, y1, r0, r1, nx, ny) {
      const toward = nx * 0.8 + ny * 0.6 > 0 ? 1 : -1, reach = Math.max(r0, r1, px * 0.5);
      fill(Math.min(x0, x1) - reach, Math.min(y0, y1) - reach, Math.max(x0, x1) + reach, Math.max(y0, y1) + reach, (X, Y) => {
        const d = off(X, Y, x0, y0, x1, y1), half = Math.max(lerp(r0, r1, along), px * 0.5);
        if (d > half) return 0;
        const side = (((X - x0) * nx + (Y - y0) * ny) * toward) / half;
        return HAIR + (side > 0.72 ? 3 : side > 0.15 ? 2 : side < -0.5 ? 0 : 1);
      });
    }
    function paintTail() {
      for (let k = 0; k + 1 < tail.length && tail[k][4] < SPLIT + 0.04; k++) {
        tube(tailX[k], tailY[k], tailX[k + 1], tailY[k + 1], tailWidth(tail[k][4]) / 2, tailWidth(tail[k + 1][4]) / 2, tail[k][2], tail[k][3]);
      }
      for (const { pts } of strands) for (let k = 0; k + 5 < pts.length && pts[k + 2] * S >= 1.2; k += 3) {
        const nx = pts[k + 1] - pts[k + 4], ny = pts[k + 3] - pts[k], d = Math.hypot(nx, ny) || 1;
        tube(pts[k], pts[k + 1], pts[k + 3], pts[k + 4], pts[k + 2] / 2, pts[k + 5] / 2, nx / d, ny / d);
      }
    }

    // His sword, lying on the rock at his side: a black lacquered scabbard, a dull iron guard, and a bound hilt.
    const sword = (X, Y) => {
      const mid = 0.017, thick = Math.max(0.016, px * 0.5);
      if (X > 0.875 && X < 0.893) return Math.abs(Y - mid) < Math.max(0.026, px * 0.6) ? SWORD + 3 : 0;
      if (Y < 0 || Math.abs(Y - mid) > thick * (X > 0.893 ? 0.8 : 1)) return 0;
      if (X > 1.015) return SWORD + 2; // its cap
      if (X > 0.893) return SWORD + (px < 0.008 && (Math.floor((X - 0.893) / 0.016 + (Y - mid) / 0.026) & 1) ? 1 : 0);
      return SWORD + (Y > mid + thick * 0.4 ? 1 : 0); // the scabbard, lit along its top
    };
    // His crossed legs, in white trousers, with the black robe falling open over his thighs to his knees.
    const legs = (X, Y) => {
      if (Y < 0 || Y > 0.21) return 0;
      const a = Math.abs(X), hem = 0.108 + 0.035 * smooth(0.2, 0.48, a);
      if (Y > hem && a > 0.062 && a < 0.5) return ROBE + (X > 0.22 ? 2 : X < -0.3 ? 0 : 1);
      if (Y > 0.1 && a <= 0.062) return INNER + 1; // the white robe, between the black one's edges
      const front = off(X, Y, -0.47, 0.105, 0.18, 0.04), lie = lerp(0.105, 0.04, along), back = off(X, Y, 0.47, 0.105, -0.18, 0.04);
      if (front < 0.058) return INNER + (Y - lie > 0.018 ? 2 : 1); // the shin in front, lit along its top
      if (back < 0.058) return INNER + (front < 0.058 + Math.max(0.012, px) ? 0 : 1); // the one behind, shaded where the other lies over it
      return 0;
    };
    // His body; the shoulders rise as he breathes in. The black robe hangs open over the white one,
    // which crosses at his chest, left over right, with a thin dark red edge to its collar. On his
    // left breast is a plum blossom: five round petals about a pale heart, or, too small for that, a fleck of pink.
    const blossom = (dx, dy) => {
      const R = 0.03, d = Math.hypot(dx, dy);
      if (R * S < 2.5) return d < Math.max(R * 0.7, px * 0.6) ? EMBLEM + 1 : 0;
      if (d < R * 0.24) return EMBLEM + 3;
      return d < R * (0.68 + 0.32 * Math.abs(Math.cos(2.5 * Math.atan2(dx, dy)))) ? EMBLEM + (dx > 0.004 ? 2 : 1) : 0;
    };
    const torso = (X, Y0) => {
      const Y = Y0 - lift * smooth(0.15, 0.7, Y0), a = Math.abs(X);
      if (Y > 0.76 || Y < 0.19) return 0;
      const half = Y > 0.69 ? 0.265 - 0.19 * ((Y - 0.69) / 0.07) ** 0.7 : lerp(0.205, 0.265, smooth(0.24, 0.69, Y));
      if (a >= half) return 0;
      const open = lerp(0.068, 0.125, clamp01((0.735 - Y) / 0.45)); // half the width the black robe hangs open by
      if (a > open) {
        const flower = blossom(X - 0.185, Y - 0.56);
        if (flower) return flower;
        if (a < open + 0.045) return ROBE + (a < open + Math.max(0.006, px * 0.7) ? 3 : 2); // its wide collar, the light along its edge
        const turn = X / half;
        return ROBE + (turn > 0.88 ? 3 : turn > 0.4 ? 2 : turn < -0.75 ? 0 : 1);
      }
      if (Y > 0.716) return Y < 0.738 ? INNER + 1 : 0; // the white collar, behind his neck
      if (Y < 0.28) return SASH + (X > 0.03 ? 1 : 0); // the sash it is tied with
      const v = 0.36 * (Y - 0.575), edge = Y > 0.575 ? Math.abs(a - v) : Math.abs(X + 0.36 * (0.575 - Y)); // how far from the edge of its collar
      if (px < 0.016 && edge < Math.max(0.0035, px * 0.6)) return TRIM + (X > 0 ? 1 : 0);
      if (Y > 0.575 && a < v) return SKIN + (X > 0.01 ? 2 : 1); // his chest
      return INNER + ((Y > 0.575 ? X > 0 : X > -0.36 * (0.575 - Y)) ? (X > 0.03 ? 2 : 1) : 0); // the panel on top, and the one under it
    };
    // A green tassel on a cord, hanging from his sash on our left and swaying a little in the wind.
    const tassel = (X, Y0) => {
      const Y = Y0 - lift * smooth(0.15, 0.7, Y0), x = X + 0.115 - (0.012 + 0.006 * Math.sin(now * 1.9)) * clamp01((0.22 - Y) / 0.15);
      if (Y > 0.235 || Y < 0.06) return 0;
      if (Y > 0.15) return Math.abs(x) < Math.max(0.004, px * 0.5) ? GREEN + 1 : 0; // the cord
      if (Math.hypot(x / 0.012, (Y - 0.146) / 0.01) < 1) return GREEN + 2; // its knot
      const w = lerp(0.01, 0.024, clamp01((0.14 - Y) / 0.07));
      return Y < 0.14 && Y > 0.066 + 0.005 * Math.sin(x * 300) && Math.abs(x) < Math.max(w, px * 0.5) ? GREEN + (x > 0 ? 1 : 0) : 0;
    };
    // His arms, in black sleeves so wide that they hang past his hands; the wind fills them, pushing
    // their hems to the right, and ripples along the hems. For each (his right, on our left, then his
    // left), set each frame: the corners of the hanging part, out from his middle, [where it leaves
    // his arm at the elbow, at the wrist, its hem outside, its hem inside].
    const sleeves = [[], []];
    function blowSleeves(s) {
      for (const k of [0, 1]) {
        const push = (k ? 1 : -1) * (0.035 + 0.02 * Math.sin(s * 1.3 + k * 2));
        sleeves[k] = [0.29, 0.41, 0.55, 0.255, 0.65 + push, 0.075 + 0.012 * Math.sin(s * 1.7 + k), 0.28 + push * 0.4, 0.115];
      }
    }
    const cross = (x0, y0, x1, y1, x, y) => (x1 - x0) * (y - y0) - (y1 - y0) * (x - x0); // below 0 when (x, y) is on the right of the line from one point to the other
    const arms = (X, Y0) => {
      const Y = Y0 - lift * smooth(0.15, 0.7, Y0), k = X < 0 ? 0 : 1, u = Math.abs(X);
      if (u < 0.17 || Y > 0.74 || Y < 0.03) return 0;
      const [ax, ay, bx, by, cx2, cy2, dx2, dy2] = sleeves[k];
      if (Math.hypot((u - 0.505) / 0.036, (Y - 0.205) / 0.026) < 1) return SKIN + 2 + k; // a hand, at the mouth of its sleeve, on his knee
      const hem = lerp(dy2, cy2, clamp01((u - dx2) / (cx2 - dx2))) + 0.011 * Math.sin(u * 26 - now * 3.4 + k * 2);
      const outside = -cross(bx, by, cx2, cy2, u, Y) / Math.hypot(cx2 - bx, cy2 - by), inside = -cross(dx2, dy2, ax, ay, u, Y) / Math.hypot(ax - dx2, ay - dy2);
      const bell = Y > hem && outside > 0 && inside > 0 && cross(ax, ay, bx, by, u, Y) < 0;
      if (!bell && off(u, Y, 0.255, 0.655, 0.36, 0.42) > 0.078 && off(u, Y, 0.36, 0.42, 0.49, 0.27) > 0.07) return 0;
      if (k) return ROBE + (outside < Math.max(0.012, px) ? 3 : outside < 0.11 || !bell ? 2 : 1); // on our right, toward the sun: lit along its outer edge
      return ROBE + (bell && inside < Math.max(0.012, px) ? 2 : bell && outside < 0.08 ? 0 : 1); // on our left, lit only along its inner edge
    };

    // What does not change along a row of his head is worked out once for it: the half width of
    // his face, the inner and outer edges of the locks beside it, and where each lock of his fringe
    // crosses the row, and the row a little above, whose shade falls on it. Close to, a lock of the
    // fringe keeps a pixel's width nearly to its point, so that it still reads as a lock. Further
    // off, its root is kept a pixel wide, so the roots make a band across his brow, and where the
    // rest is too thin to paint, it is left to `details` to draw as a line of characters.
    let headY = NaN, face = 0, inner = 0, outer = 0, across = 0;
    const bangs = new Float64Array(BANGS.length * 2), shaded = new Float64Array(BANGS.length * 2);
    const bangAlong = (x0, x1, t) => x0 + (x1 - x0) * t * (2 - t); // the middle of a lock, `t` of the way down it
    function crossing(y, out) {
      BANGS.forEach(([x0, x1, y1, w], k) => {
        const t = (BANGS_Y - y) / (BANGS_Y - y1), mid = bangAlong(x0, x1, t);
        let half = y > y1 && y < BANGS_Y ? w * (1 - t) ** 0.8 : -1;
        if (px < 0.006) { if (t < 0.85) half = Math.max(half, px * 0.45); } else if (half < px * 0.6) half = t < 0.4 ? px * 0.6 : -1;
        out[k * 2] = mid - half; out[k * 2 + 1] = mid + half;
      });
    }
    const bangAt = (x, row) => { // which lock of the fringe covers x on a row, or -1; and in `across`, where in it, from -1 on our left to 1 on our right
      for (let k = 0; k < row.length; k += 2) if (x > row[k] && x < row[k + 1]) { across = (2 * x - row[k] - row[k + 1]) / (row[k + 1] - row[k]); return k; }
      return -1;
    };
    // His face: pale, lit from our right and above, and shaded under his fringe and beside the
    // locks that frame it. Features come in as the camera closes: first the dark lines of his eyes,
    // then his brows, then the rest. His eyes are narrow and turn up at their outer corners, under
    // heavy lids; the brows above them slant down to his nose in a scowl that deepens as he looks up.
    const skin = (x, y, a, dither) => {
      const nx = x / 0.09, ny = (y + 0.03) / 0.17, u = (a - EYE_X) / 0.025, v = y - (EYE_Y - HEAD_Y);
      let tone = 1 + 3 * (nx * 0.55 + ny * 0.2 + 0.75 * Math.sqrt(Math.max(0, 1 - nx * nx - 0.6 * ny * ny)));
      if (y > BANGS_Y - 0.01 || (px < 0.006 && bangAt(x + 0.004, shaded) >= 0) || a > inner - 0.011) tone -= 0.9; // the shade his hair casts, down and away from the sun (the locks' own, only once it is more than a sliver)
      if (x < 0 && y < -0.06 && a > face - 0.01) tone -= 0.4; // and along his jaw, away from the sun
      if (px < 0.03 && u > -1.2 && u < 1.45 && v > -0.012 && v < 0.026) { // an eye
        const arch = Math.max(0, 1 - u * u), sag = 0.0042 * arch ** 0.9, low = 0.005 * u - sag, lid = 0.005 * u + lerp(0.0008 - sag, 0.0078 * arch ** 0.65, open);
        const heavy = Math.max(0.0034 * (0.55 + 0.45 * arch), px * 0.85);
        if (u < 1 && arch > 0 && v > lid && v <= lid + heavy) return HAIR; // the heavy line of the upper lid and its lashes
        if (u > 0.75) { // which sweeps on up past the outer corner
          const f = (u - 0.75) / 0.7;
          if (f < 1 && Math.abs(v - lerp(wing + heavy * 0.5, 0.017, f)) < Math.max(heavy * 0.5 * (1 - f) ** 0.8, px * 0.4)) return HAIR;
        }
        if (arch > 0 && v <= lid && v > low) { // the eye itself
          const ix = a - IRIS_X, iv = y + HEAD_Y - IRIS_Y, ir = Math.hypot(ix, iv), R = Math.max(0.0092, px * 0.55);
          if (ir >= R) return EYE + (v > lid - 0.0028 || u > 0.85 || u < -0.85 ? 0 : 1); // its white, in the shade of the lid
          const sx = x - Math.sign(x) * IRIS_X - GLINT_X, sy = iv - GLINT_Y, sun = Math.hypot(sx, sy); // from the sun that stands in it
          if (px > 0.0015) { if (sun < Math.max(0.0016, px * 0.7)) return IRIS + 6; } // the light it catches
          else { // which, close to, is the sunrise: a small gold sun just clear of a line of horizon, its glow about it and its road of light below; and a fleck of sky
            const under = -0.0019 - sy + 8 * sx * sx; // how far below the horizon, which bows with his eye
            if (sun < 0.0016) return SHINE + (sun < 0.0009 ? 2 : 1);
            if (Math.abs(under) < Math.max(0.0003, px * 0.5)) return SHINE + (Math.abs(sx) < 0.0045 ? 1 : 0);
            if (under > 0 && Math.abs(sx) < 0.0014 - 0.35 * under && Math.floor(under / Math.max(0.0006, px * 1.2)) & 1) return SHINE + 1;
            if (under < 0 && sun < 0.0027) return SHINE;
            if (Math.hypot(sx + GLINT_X + 0.0028, sy + GLINT_Y - 0.0028) < 0.0013) return IRIS + 6;
          }
          if (px < 0.006 && ir < 0.0036) return IRIS; // the pupil
          if (ir > R - Math.max(0.0016, px * 0.7)) return IRIS + 1;
          if (v > lid - 0.0035) return IRIS + 2; // under the heavy lid
          return IRIS + (iv > -0.0035 ? 3 : Math.hypot(ix - 0.002, iv + 0.0055) < 0.0035 ? 5 : 4); // lit from below
        }
        if (px < 0.006 && arch > 0 && u < 0.85 && v <= low && v > low - Math.max(0.0013, px * 0.6)) return LINE; // the lower lid
      }
      if (px < 0.012) { // a brow (smaller than this, it is only the characters `details` slants above his eye)
        const k = (a - 0.018) / 0.058, line = 0.032 + 0.022 * k - 0.004 * open * (1 - k);
        if (k > 0 && k < 1 && Math.abs(y - line) < Math.max(0.0026 * (1 - 0.5 * k), px * 0.5)) return HAIR;
      }
      if (px < 0.012 && a < 0.025) { // his mouth: a thin line between thin lips
        const k = x / 0.025, w = y + HEAD_Y - mouthLine(x);
        if (Math.abs(w) < Math.max(0.0009, px * 0.55)) return LINE;
        if (px < 0.006) {
          const up = 0.0018 * Math.sqrt(1 - k * k), lo = 0.0036 * (1 - k * k) ** 0.6;
          if (w > 0 && w < up) return LIP;
          if (w < 0 && w > -lo) return LIP + 1;
          if (w < -lo && w > -lo - 0.004 && k > -0.8 && k < 0.8) tone -= 0.6; // the shade under his lower lip
        }
      }
      if (px < 0.009 && a < 0.012 && y < 0.002 && y > -0.056) { // his nose, small and straight: the shade down one side, the light on its tip, and the nostrils that show as his head tips back
        if (((a - 0.0052) / Math.max(0.0024, px * 0.6)) ** 2 + ((y + 0.0485) / Math.max(0.0011, px * 0.5)) ** 2 < 1) return px > 0.003 ? LINE : SKIN;
        if (x < -0.0015 && x > -0.0055 - 0.004 * clamp01((-0.02 - y) / 0.025) && y < -0.004 && y > -0.047) tone -= 0.55;
        else if (((x - 0.002) / 0.0045) ** 2 + ((y + 0.041) / 0.0035) ** 2 < 1) tone += 0.5;
        else if (x > 0.0005 && x < 0.003 && y < -0.01 && y > -0.038) tone += 0.35;
        if (a < 0.007 && y < -0.0455 && y > -0.0505) tone -= 0.5; // the shade under it
      }
      if (y < -0.117 && y > -0.133 && ((x - 0.006) / 0.014) ** 2 + ((y + 0.125) / 0.008) ** 2 < 1) tone += 0.35; // the light on his chin
      return SKIN + Math.max(0, Math.min(4, Math.floor(tone + (dither - 0.5) * 0.4)));
    };
    // His head. His hair is drawn back into a high tail, tied at the crown with a green cord over a
    // small folded knot; his fringe hangs over his brow to his eyes; and jagged locks hang either
    // side of his face to his jaw.
    const head = (X, Y, dither) => {
      const x = X, y = Y - HEAD_Y, a = Math.abs(x);
      if (a > 0.17) return 0;
      if (y !== headY) { headY = y; face = faceHalf(y); inner = lockIn(y); outer = lockOut(y); crossing(y, bangs); crossing(y + 0.009, shaded); }
      if (y < 0.05 && a > inner && a < outer && y > lockEnd(a)) { // a lock beside his face, dark along its inner edge, with a sheen down it
        return HAIR + (a < inner + Math.max(0.006, px * 0.5) ? 0 : Math.abs(a - 0.1) < 0.006 && y > -0.07 ? 2 : 1);
      }
      if (a < face && y < BANGS_Y) { // his face, or a lock of his fringe over it: lit along its edge toward the sun, where it is wide enough to show that, and dark along the other
        const k = bangAt(x, bangs);
        if (k < 0) return skin(x, y, a, dither);
        const wide = bangs[k + 1] - bangs[k];
        return HAIR + (wide > px * 1.2 && across > Math.max(0, 1 - (2 * Math.max(0.0024, px)) / wide) ? 4 : across > 0.25 ? 2 : across < -0.55 ? 0 : 1);
      }
      if (Math.abs(y - 0.184) < Math.max(0.0075, px * 0.5) && Math.abs(x - 0.004) < 0.027) return GREEN + (x > 0.012 ? 2 : 1); // the cord
      const e = Math.sqrt((x / 0.118) ** 2 + ((y - 0.012) / 0.168) ** 2), turn = e > 0.7 ? Math.atan2(x, y - 0.012) : 0; // only its rim and its sheen want to know which way round
      if (y > -0.06 && e < 1 + 0.035 * (1 - Math.abs(Math.sin(turn * 6 + 0.3))) * smooth(0.5, 1.2, Math.abs(turn))) { // the hair on his head, ragged at the sides
        if (px < 0.008 && y > BANGS_Y - 0.004 && Math.abs(x - PART) < Math.max(0.0016, px * 0.45)) return SKIN + 1; // the parting
        if (x > 0 && e > 0.94) return HAIR + 3;
        if (y > 0.05 && x > -0.06 && Math.abs(e - 0.78) < Math.max(0.045, px * 0.6) && (px > 0.012 || noise(turn * 40, 3) > 0.4)) return HAIR + 2;
        return HAIR + 1;
      }
      if (((x - 0.002) / 0.03) ** 2 + ((y - 0.207) / 0.022) ** 2 < 1) return HAIR + (x > 0.008 && y > 0.2 ? 2 : 1); // the knot above it
      if (a < 0.04 && y < -0.06 && Y > 0.66) return SKIN + (y > -0.159 && faceHalf(y + 0.016) > a ? 0 : x > 0.012 ? 2 : 1); // his neck, in the shadow of his jaw just under it
      return 0;
    };

    // Everything behind him, wherever nothing has been painted yet: the sky and the sun above
    // the horizon, and below it the sea of clouds, a flat sheet seen in perspective from
    // `sea / F` above it.
    function backdrop(s) {
      const dawn = smooth(T.sun, T.gold, s), sunY = hy + sunR * (1.2 - 2 * smooth(T.sun - 1, T.sun + 4, s));
      const paling = 1.2 + 0.8 * (s / T.sun), glow = 0.95 * smooth(T.sun - 0.3, T.gold, s);
      const beams = smooth(T.sun + 0.2, T.sun + 1.6, s) * Math.hypot(W, lines) * 0.5;
      const since = Math.max(0, s - T.spiral), turned = SPIN * (since < 3 ? (since * since) / 6 : since - 1.5) * ROUND;
      const ring = s < T.spread ? 0 : 1.3 + (s - T.spread) * 3.2; // how far out the qi has gone: within it the clouds turn
      const reach = dawn > 0 ? Math.pow(dawn, 1.2) * Math.hypot(W, lines * 1.7) * 1.1 : -1e9; // how far over the sea the sunlight has come
      for (let l = 0; l < lines; l++) {
        const y = l + 0.5, below = y - hy;
        if (below <= 0) { // sky: bands, paler toward the horizon and toward where the sun will come up
          const high = (y / hy) * 7, low = (y / hy) * (y / hy) * paling, gy = below / (hy * 0.95);
          for (let c = 0, i = l * cols; c < cols; c++, i++) {
            if (paint[i]) continue;
            const dx = (c + 0.5) * unit - sunX, dy = y - sunY, near = dx * dx + dy * dy, dither = BAYER[(l & 3) * 4 + (c & 3)];
            if (near < sunR * sunR) { paint[i] = SUN + (near > (sunR - 1.1) * (sunR - 1.1) ? 1 : 0); continue; }
            let level = Math.floor((glow - Math.sqrt((dx / (W * 0.42)) ** 2 + gy * gy)) * 5 + dither);
            if (beams > 0 && near < beams * beams * (0.5 + dither)) { // rays, fanned out from the sun
              const a = Math.atan2(1 - dy, dx);
              if (Math.sin(a * 11 + 0.8) * Math.sin(a * 7 - 1.1) > 0.42) level++;
            }
            if (level >= 1) paint[i] = GLOW + Math.min(4, level - 1);
            else paint[i] = SKY + Math.max(0, Math.min(7, Math.floor(high + low * Math.exp(-((dx / (W * 0.3)) ** 2)) + (dither - 0.5) * 0.7 + 0.5)));
          }
          continue;
        }
        const d = sea / below, w = d - D, wide = d / F, flat = Math.log(d + 2) * OUT, hazy = 1 - smooth(0, lines * 0.1, below), road = 1 / (sunR * 1.5 + below * 0.25);
        for (let c = 0, i = l * cols; c < cols; c++, i++) {
          if (paint[i]) continue;
          const x = (c + 0.5) * unit, u = camU + (x - cx) * wide, r = Math.sqrt(u * u + w * w), dither = BAYER[(l & 3) * 4 + (c & 3)];
          const turning = r < ring - 0.6 * dither;
          let a = (u / (d + 2)) * ROUND, b = flat, band = flat * PITCH; // at rest: banks of cloud lying across the view
          if (turning) { // turning: the banks are arms wound round the peak, the inner ones further round
            a = Math.atan2(u, w) * ROUND - (turned * SLOW) / (r + SLOW); b = Math.log(r + 1) * OUT; band = (ARMS * a) / TEX + b * WIND;
          }
          // Each bank is light along its far edge, where its top shows, and dark at its foot, behind the next.
          const f = band + (turning ? 0.5 : 1.1) * Math.min(1, r * 0.4) * (lumpAt(a, b) - 0.5), part = f - Math.floor(f);
          let v = lerp(0.1 + 0.8 * part * Math.sqrt(Math.sqrt(part)), 0.72, hazy * 0.9);
          const aside = (x - sunX) * road;
          if (dawn > 0 && aside < 3 && aside > -3) v += 0.3 * dawn * Math.exp(-aside * aside); // the sun's road
          let lit = Math.sqrt((x - sunX) ** 2 + below * below * 2.89) < reach + (v - 0.5) * 30 + (dither - 0.5) * 8;
          if (!lit && ring > 0 && Math.abs(r - ring) < 0.1 + 0.035 * ring && dither < 1.4 - (s - T.spread) / 3.5) { lit = true; v = Math.max(v, 0.6); } // the qi, going out in a ring
          paint[i] = (lit ? LIT : SEA) + Math.max(0, Math.min(5, Math.floor(v * 6 + (dither - 0.5) * 0.4)));
          if (!(l & 1) && part > 0.8 && l + 1 < lines && !paint[i + cols]) { // a mark on a top, which moves as the cloud does
            const slot = 1.3 * (turning ? Math.pow(2, Math.ceil(Math.log2(Math.max(1, d / (r + 0.5))))) : 1);
            if (hash(Math.floor(a / slot), Math.floor(f) + 7) < 0.45) {
              const at = (l >> 1) * cols + c;
              glyph[at] = TILDE; ink[at] = (lit ? LIT : SEA) + 5; bold[at] = below > lines * 0.22 ? 1 : 0;
            }
          }
        }
      }
    }
    // Peaks standing out of the sea a long way off: the camera's own move slides them across the horizon.
    function farPeaks() {
      PEAKS.forEach(([u, w, high, half], k) => {
        const d = D + w, scale = F / d, mid = cx + (u - camU) * scale, foot = hy + sea / d, tip = foot - high * scale;
        for (let l = Math.max(0, Math.floor(tip)); l < Math.min(lines, foot); l++) {
          const q = (foot - l - 0.5) / (high * scale), wide = half * scale * Math.pow(1 - q, 0.75) * (0.8 + 0.4 * hash(l, k + seed * 7));
          const lean = (hash(k, 5) - 0.5) * half * scale * q;
          for (let c = Math.max(0, Math.ceil((mid + lean - wide) / unit - 0.5)); c < cols && (c + 0.5) * unit < mid + lean + wide; c++) {
            paint[l * cols + c] = FAR + Math.min(2, (d > 45 ? 2 : d > 25 ? 1 : 0) + ((c + 0.5) * unit > mid + lean + wide * 0.45 ? 1 : 0));
          }
        }
      });
    }

    // A character in a cell. With `only` set to a run of colours [first, past the last], it goes
    // only where both halves of the cell are painted from that run, in `colour` or else a shade
    // lighter than the paint. Otherwise it goes where nothing painted from `upTo` on is in front
    // of it: from ROBE that is him, and from ROCK the rock as well.
    let only = null, upTo = ROBE, wavy = false, bend = 0; // `wavy`: lie flat stretches of line down as ~, as qi wavers; `bend`: which way a steep one curves
    function mark(c, r, ch, colour, heavy) {
      if (c < 0 || c >= cols || r < 0 || r >= rows) return;
      const top = paint[r * 2 * cols + c], foot = paint[(r * 2 + 1) * cols + c];
      if (only ? top < only[0] || top >= only[1] || foot < only[0] || foot >= only[1] : top >= upTo || foot >= upTo) return;
      glyph[r * cols + c] = ch; ink[r * cols + c] = only && !colour ? Math.min(only[1] - 1, foot + 1) : colour; bold[r * cols + c] = heavy;
    }
    const put = (c, r, ch, colour) => { glyph[r * cols + c] = ch; ink[r * cols + c] = colour; bold[r * cols + c] = 0; };
    // A thin line from one place to another (in columns and rows), each glyph chosen by where the line crosses its cell.
    function thin(c0, r0, c1, r1, colour, heavy) {
      const dc = c1 - c0, dr = r1 - r0, wide = Math.abs(dc), high = Math.abs(dr), rising = dc * dr < 0;
      if (Math.max(c0, c1) < 0 || Math.min(c0, c1) >= cols || Math.max(r0, r1) < 0 || Math.min(r0, r1) >= rows) return;
      if (wide <= high * 1.3) { // steep: one glyph a row
        const lo = Math.max(0, Math.min(r0, r1)), hi = Math.min(rows, Math.max(r0, r1));
        for (let r = Math.floor(lo); r < hi; r++) {
          const ya = Math.max(lo, r), yb = Math.min(hi, r + 1), cover = yb - ya;
          if (cover < 0.25) continue;
          const ca = c0 + (dc * (ya - r0)) / dr, cb = c0 + (dc * (yb - r0)) / dr;
          const stub = cover < 0.6 ? ((ya + yb) / 2 - r > 0.5 ? (rising ? COMMA : DOT) : HIGH) : 0;
          mark(Math.floor((ca + cb) / 2), r, stub || (Math.floor(ca) === Math.floor(cb) ? (bend ? (bend > 0 ? CLOSE : OPEN) : BAR) : rising ? SLASH : BACK), colour, heavy);
        }
      } else { // shallow: one glyph a column
        const lo = Math.max(0, Math.min(c0, c1)), hi = Math.min(cols, Math.max(c0, c1)), slope = high / wide;
        const level = (c) => { // twice the row the line is on at column c: even at a row's edge, odd in its middle
          const y = r0 + (dr * (Math.min(hi, Math.max(lo, c + 0.5)) - c0)) / dc, f = y - Math.floor(y);
          return Math.floor(y) * 2 + (f < 0.25 ? 0 : f < 0.72 ? 1 : 2);
        };
        for (let c = Math.floor(lo); c < hi; c++) {
          const xa = Math.max(lo, c), xb = Math.min(hi, c + 1);
          if (xb - xa < 0.35) continue;
          const y = r0 + (dr * ((xa + xb) / 2 - c0)) / dc, r = Math.floor(y), f = y - r;
          if (slope > 0.6) mark(c, r, rising ? SLASH : BACK, colour, heavy);
          else if (slope > 0.2 || wavy) mark(c, r, slope <= 0.2 ? TILDE : f < 0.36 ? (rising ? HIGH : TICK) : f > 0.64 ? (rising ? COMMA : DOT) : DASH, colour, heavy);
          else { // nearly flat: __,--' in half-row steps, with a tick where it changes level
            const q = level(c), steps = level(c + (rising ? 1 : -1)) < q, lands = level(c + (rising ? -1 : 1)) > q;
            if (q % 2 === 0) mark(c, q / 2 - 1, LOW, colour, heavy);
            else mark(c, (q - 1) / 2, steps ? (rising ? HIGH : TICK) : lands ? (rising ? COMMA : DOT) : DASH, colour, heavy);
          }
        }
      }
    }

    // A line through points of the world [x, y, x, y, ...], drawn a cell or more at a time, so that
    // a steep stretch of it that curves can be told which way, and drawn ( or ).
    function stroke(pts, colour, heavy) {
      let c0 = col(pts[0]), r0 = row(pts[1]), pc = 0, pr = 0;
      for (let k = 2; k < pts.length; k += 2) {
        const c1 = col(pts[k]), r1 = row(pts[k + 1]), dc = c1 - c0, dr = r1 - r0;
        if (k + 2 < pts.length && Math.hypot(dc * unit, dr * 2) < 2.4) continue;
        const turn = pc * dr - pr * dc, size = Math.hypot(pc, pr) * Math.hypot(dc, dr);
        bend = size > 0 && Math.abs(turn) > 0.2 * size ? Math.sign(turn) * Math.sign(dr) : 0;
        thin(c0, r0, c1, r1, colour, heavy);
        pc = dc; pr = dr; c0 = c1; r0 = r1;
      }
      bend = 0;
    }
    // One character, again and again along a line of the world, one to a column, wherever he is:
    // the slant of his brows.
    function rake(x0, y0, x1, y1, ch, colour) {
      const c0 = col(x0), c1 = col(x1);
      for (let c = Math.max(0, Math.ceil(Math.min(c0, c1) - 0.5)); c < cols && c + 0.5 <= Math.max(c0, c1); c++) {
        const r = Math.floor(row(lerp(y0, y1, (c + 0.5 - c0) / (c1 - c0))));
        if (r < 0 || r >= rows) continue;
        const top = paint[r * 2 * cols + c], foot = paint[(r * 2 + 1) * cols + c];
        if ((top >= ROBE && top < QI) || (foot >= ROBE && foot < QI)) put(c, r, ch, colour);
      }
    }
    // Characters strewn over a box of the world, about one to every `per` cells at any zoom. They
    // sit on a lattice that doubles its density each time the camera doubles its zoom, each nudged
    // by a hash of where it is, so the ones already there stay put as more come in between them.
    function scatter(X0, Y0, X1, Y1, per, place) {
      const want = Math.log2(S / Math.sqrt(2 * unit * per)), L = Math.max(0, Math.min(10, Math.floor(want))), more = want - L, h = 2 ** -(L + 1);
      const x0 = Math.max(X0, fx - gx / S), x1 = Math.min(X1, fx + (W - gx) / S), y0 = Math.max(Y0, fy + (gy - lines) / S), y1 = Math.min(Y1, fy + gy / S);
      for (let j = Math.ceil(y0 / h); j * h <= y1; j++) for (let i = Math.ceil(x0 / h); i * h <= x1; i++) {
        const I = i * 2 ** (11 - L), J = j * 2 ** (11 - L), bits = I | J, own = bits ? 12 - Math.min(12, 31 - Math.clz32(bits & -bits)) : 0;
        if (own > L && hash(I, J) > more) continue; // one of the next lot, not in yet
        const nudge = 0.35 * 2 ** -own, c = Math.floor(col(I / 4096 + (hash(J, I) - 0.5) * nudge)), r = Math.floor(row(J / 4096 + (hash(I + 1, J + 1) - 0.5) * nudge));
        if (c >= 0 && c < cols && r >= 0 && r < rows) place(c, r, hash(I + 7, J));
      }
    }

    // Characters on the tree, behind him and the rock: its thin wood as lines, grain along its
    // thick wood, its blossom, and the petals it lets go.
    function treeMarks(s) {
      upTo = ROCK;
      for (const [x0, y0, x1, y1, w0, w1] of wood) if (Math.max(w0, w1) * S < 2.2) thin(col(x0), row(y0), col(x1), row(y1), BARK + 3, 1);
      only = [BARK, BARK + 6];
      for (const [x0, y0, x1, y1, w0, w1] of wood) {
        const w = Math.max(w0, w1) * S;
        if (w < 2.2) continue;
        const n = Math.min(15, 2 ** Math.ceil(Math.log2(w / 3 + 1)) - 1), len = Math.hypot(x1 - x0, y1 - y0), nx = (y0 - y1) / len, ny = (x1 - x0) / len;
        for (let k = 1; k <= n; k++) { // lines along it, nested so that each stays where it is as more come in
          const f = k / (n + 1) - 0.5;
          thin(col(x0 + nx * f * w0), row(y0 + ny * f * w0), col(x1 + nx * f * w1), row(y1 + ny * f * w1), 0, 1);
        }
      }
      only = null;
      const zoom = (S / S0) * 1.1, pale = opened() ? 2 : 0;
      for (let i = 0; i < bloomed.length; i += 6) {
        const x = bloomed[i], y = bloomed[i + 1], need = bloomed[i + 5];
        if (need <= zoom && x > viewL && x < viewR && y > viewB && y < viewT) mark(Math.floor(col(x)), Math.floor(row(y)), bloomed[i + 4], BLOOM + 3 + Math.min(9, bloomed[i + 2] + (need === 1 ? pale : 0)), bloomed[i + 3] < 0.5 ? 1 : 0);
      }
      for (const [born, x, y, vx, sink, sway, pace, phase, shade] of petals) {
        const age = s - born;
        if (age < 0) continue;
        const X = x + vx * age + sway * Math.sin(pace * age + phase), Y = y - sink * age + 0.5 * sway * Math.cos(0.7 * pace * age + phase);
        mark(Math.floor(col(X)), Math.floor(row(Y)), PETAL[((age * 3 + phase) | 0) & 3], BLOOM + 3 + shade, 0);
      }
      upTo = ROBE;
    }

    // Qi: threads of gold smoke. Each breath out sends up a sheaf of them from his head and
    // shoulders. A thread goes straight up its stem, then curls outward, the more so once the
    // qi has begun to spread, and wavers all the way. It is fixed by the numbers here, so
    // where it is at any moment can be worked out directly.
    const threads = [];
    for (let born = T.qi; born < T.white; born += T.breath) for (let j = 0; j < 5; j++) {
      const x0 = lerp(-0.34, 0.34, (j + rand()) / 5), a = Math.abs(x0);
      threads.push({ born: born + 0.5 * rand(), x0, y0: a < 0.11 ? 1.04 : 0.76 - 0.3 * (a - 0.11), side: x0 < 0 ? -1 : 1, stem: 0.4 + 1.3 * rand(),
        curl: 0.6 + 0.9 * rand(), lean: 0.6 + 0.6 * rand(), sway: 0.1 + 0.12 * rand(), wave: 2.2 + 2 * rand(), phase: 6.28 * rand(), pace: 0.75 + 0.4 * rand() });
    }
    const spot = [0, 0];
    function trace(th, a, age, flare) { // where the thread is, `a` along it from where it left him
      const turn = Math.min(flare * th.lean, Math.max(0, a - th.stem) / th.curl), rest = Math.max(0, a - th.stem - turn * th.curl);
      const waver = th.sway * (a / (a + 0.5)) * Math.sin(th.wave * a - 1.3 * age + th.phase);
      spot[0] = th.x0 + th.side * (th.curl * (1 - Math.cos(turn)) + rest * Math.sin(turn)) + waver;
      spot[1] = th.y0 + Math.min(a, th.stem) + th.curl * Math.sin(turn) + rest * Math.cos(turn);
    }
    function qi(s, fade) {
      const flare = lerp(0.12, 0.95, smooth(T.spread - 0.6, T.spread + 2.4, s));
      const beat = (s - T.qi) / T.breath, pulse = s < T.qi ? 0 : 0.45 + 0.55 * (1 - beat + Math.floor(beat)) ** 2;
      const round = (0.9 + 0.35 * pulse + 0.8 * smooth(T.spread, T.spread + 3, s)) * pulse * Math.min(1, fade * 3); // the glow about him swells with each breath out
      if (round > 0) for (let r = Math.max(0, Math.floor((gy - (0.55 + round * 1.05 - fy) * S) / 2)); r < rows; r++) {
        const Y = (fy + (gy - r * 2 - 1) / S - 0.55) / 1.05;
        if (Y < -round) break;
        for (let c = Math.max(0, Math.floor((gx - (fx + round * 0.85) * S) / unit)); c < cols; c++) {
          const X = (fx + ((c + 0.5) * unit - gx) / S) / 0.85;
          if (X > round) break;
          const level = Math.floor((1 - Math.hypot(X, Y) / round) * 3.2 + BAYER[(r & 3) * 4 + (c & 3)] * 0.8);
          const top = paint[r * 2 * cols + c], foot = paint[(r * 2 + 1) * cols + c];
          if (level > 0 && top < ROBE && foot < ROBE) wash[r * cols + c] = AURA + Math.min(2, level - 1);
        }
      }
      wavy = true;
      for (const th of threads) {
        const age = s - th.born, strength = (1 - age / 6.5) * fade;
        if (age <= 0 || strength <= 0) continue;
        const head = th.pace * age, tail = th.pace * Math.max(0, age - 2.2), steps = Math.min(140, Math.max(2, Math.ceil(((head - tail) * S) / 2.5)));
        for (let k = 0, c0 = 0, r0 = 0; k <= steps; k++) {
          trace(th, lerp(tail, head, k / steps), age, flare);
          const c1 = col(spot[0]), r1 = row(spot[1]), level = strength * (1 - (0.55 * k) / steps);
          if (k) thin(c0, r0, c1, r1, QI + (level > 0.6 ? 2 : level > 0.3 ? 1 : 0), level > 0.78 ? 1 : 0);
          c0 = c1; r0 = r1;
        }
      }
      wavy = false;
    }

    // Cracks in the rock. Each is a point of the world, drawn once the camera is close enough to
    // want it, so they stay put as the picture grows.
    const specks = [];
    for (let need = 1, n = 160; need < 16; need *= 2, n *= 4) for (let k = 0; k < n; k++) specks.push([lerp(-2.6, 1.2, rand()), lerp(CLOUD_Y, 0, rand()), need, rand()]);
    function texture(zoom) {
      if (viewB > 0) return;
      for (const [X, Y, need, h] of specks) {
        if (need > zoom * 1.2) break;
        const c = Math.floor(col(X)), r = Math.floor(row(Y));
        if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
        const top = paint[r * 2 * cols + c], foot = paint[(r * 2 + 1) * cols + c];
        if (foot >= ROCK && foot < ROCK + 5 && top >= ROCK && top < ROCK + 5) { glyph[r * cols + c] = CRACKS[(h * CRACKS.length) | 0]; ink[r * cols + c] = foot > ROCK + 2 ? ROCK + 1 : foot + 2; } // dark on lit rock, catching light in the shade
      }
    }
    // Stars, while the sky is dark; then the sun's first flash along the horizon, and its rays.
    function skyMarks(s) {
      const sunY = hy + sunR * (1.2 - 2 * smooth(T.sun - 1, T.sun + 4, s)), beams = smooth(T.sun + 0.2, T.sun + 1.6, s) * Math.hypot(W, lines) * 0.4;
      for (let r = 0; r * 2 + 1 < hy; r++) for (let c = 0, i = r * cols; c < cols; c++, i++) {
        const top = paint[r * 2 * cols + c], foot = paint[(r * 2 + 1) * cols + c];
        if (top < SKY || top >= SUN || foot < SKY || foot >= SUN) continue;
        const h = hash(c + seed * 57, r + 400);
        if (top < SKY + 7 && foot < SKY + 7) { // a star, which twinkles now and then
          if (h < 0.022) { glyph[i] = h < 0.003 ? STARRY : h < 0.008 ? PLUS : DOT; ink[i] = STAR + (hash(c, r + Math.floor(s * 1.5 + h * 3000)) < 0.35 ? 1 : 0); }
          continue;
        }
        const dx = (c + 0.5) * unit - sunX, dy = r * 2 + 1 - sunY, far = Math.hypot(dx, dy), a = Math.atan2(1 - dy, dx);
        if (h < 0.4 && far > sunR * 1.8 && far < beams && Math.sin(a * 11 + 0.8) * Math.sin(a * 7 - 1.1) > 0.42) {
          glyph[i] = Math.abs(dx) > far * 0.92 ? DASH : Math.abs(dx) < far * 0.38 ? BAR : dx * dy < 0 ? SLASH : BACK; ink[i] = RAY;
        }
      }
      const flash = Math.sin(Math.PI * clamp01((s - T.sun + 0.2) / 1.6)) * W * 0.17, r = Math.min(rows - 1, Math.floor(hy / 2));
      for (let c = Math.max(0, Math.ceil((sunX - flash) / unit)); c < cols && c * unit < sunX + flash; c++) {
        const i = r * cols + c, mid = Math.abs((c + 0.5) * unit - sunX) < unit * 0.6;
        glyph[i] = mid ? STARRY : DASH; ink[i] = GLOW + 4; bold[i] = mid ? 1 : 0;
      }
    }

    // Stray hairs standing out from his head: [where they start (x, y), which way they go (from
    // straight up, toward the right), how long, how they curl, the zoom they come in at].
    const fly = mulberry32(seed * 31 + 5), flyaways = [];
    for (let k = 0; k < 18; k++) {
      const t = lerp(-1.75, 1.75, fly());
      flyaways.push([0.122 * Math.sin(t), HEAD_Y + 0.012 + 0.172 * Math.cos(t), t + 0.3 + 0.7 * (fly() - 0.5), 0.008 + 0.014 * fly(), 2 * fly() - 1, k < 4 ? 1 : k < 9 ? 2 : 4]);
    }

    // Characters on him. The weave of his robe, and the mass and sheen of his hair, so that the two
    // blacks keep apart; creases down the robe and its sleeves; strands along his tail and out
    // into the ends it splits into, and stray hairs about his head; while his face is small, his
    // features as characters (the ends of the locks of his fringe, the slant of his brows, a comma
    // of a nose, the line of his mouth);
    // close to, his lashes, and the fibres of his irises and the rays of the sun in each; the
    // blossom on his robe and the strands of his tassel.
    function details() {
      const zoom = S / S0, up = (y) => y + lift * smooth(0.15, 0.7, y);
      scatter(-0.72, 0.02, 0.74, 0.8, 3, (c, r) => {
        const top = paint[r * 2 * cols + c], foot = paint[(r * 2 + 1) * cols + c];
        if (top >= ROBE && top < ROBE + 4 && foot >= ROBE && foot < ROBE + 4) put(c, r, EM, Math.max(top, foot) + 1);
      });
      scatter(-0.2, 0.38, 1.12, 1.12, 2.5, (c, r, h) => {
        const top = paint[r * 2 * cols + c], foot = paint[(r * 2 + 1) * cols + c], hairy = (k) => k >= HAIR && k < HAIR + 4;
        if (!hairy(top)) return;
        if (!hairy(foot)) { if (top === HAIR + 1 && foot >= SKIN && foot < SKIN + 5) put(c, r, DOUBLEU, HAIR); return; } // the points of his fringe
        if (top === HAIR + 2 || foot === HAIR + 2) put(c, r, h < 0.6 ? PERCENT : STARRY, HAIR + 4);
        else if ((top === HAIR + 1 || foot === HAIR + 1) && top !== HAIR + 3 && foot !== HAIR + 3) put(c, r, h < 0.75 ? HASH : AT, HAIR + 2); // not on the lines of his lids and brows
      });
      if (px < 0.035) {
        only = [ROBE, ROBE + 5];
        for (const [x0, y0, x1, y1] of FOLDS) thin(col(x0), row(up(y0)), col(x1), row(up(y1)), 0, 0);
        sleeves.forEach(([ax, ay, bx, by, cx2, cy2, dx2, dy2], k) => {
          for (const f of [0.3, 0.62, 0.86]) thin(col((k ? 1 : -1) * lerp(ax, bx, f)), row(up(lerp(ay, by, f))), col((k ? 1 : -1) * lerp(dx2, cx2, f)), row(up(lerp(dy2, cy2, f) + 0.02)), 0, 0);
        });
      }
      wavy = true;
      only = [HAIR, HAIR + 4];
      const n = Math.min(7, 2 ** Math.ceil(Math.log2((tailWidth(0.3) * S) / (3 * unit) + 1)) - 1), line = [];
      for (let j = 1; j <= n; j++) { // nested, so that each stays where it is as more come in
        const f = j / (n + 1) - 0.5;
        line.length = 0;
        for (let k = 0; k < tail.length && tail[k][4] < SPLIT + 0.04; k++) {
          const w = tailWidth(tail[k][4]) * f;
          line.push(tailX[k] + tail[k][2] * w, tailY[k] + tail[k][3] * w);
        }
        stroke(line, 0, 0);
      }
      for (const { pts } of strands) { // along a strand while it is wide enough to be painted, then over whatever is behind it
        let k = 0;
        line.length = 0;
        for (; k < pts.length && pts[k + 2] * S >= 1.2; k += 3) line.push(pts[k], pts[k + 1]);
        only = [HAIR, HAIR + 4];
        if (line.length > 2) stroke(line, 0, 0);
        line.length = 0;
        for (k = Math.max(0, k - 3); k < pts.length; k += 3) line.push(pts[k], pts[k + 1]);
        only = null;
        if (line.length > 2) stroke(line, HAIR + 1, 0);
      }
      wavy = false;
      for (const [x, y, turn, length, curl, need] of flyaways) {
        if (need > zoom) continue;
        const x1 = x + Math.sin(turn) * length * 0.55, y1 = y + Math.cos(turn) * length * 0.55, t = turn + curl * 0.8;
        stroke([x, y, x1, y1, x1 + Math.sin(t) * length * 0.45, y1 + Math.cos(t) * length * 0.45], HAIR + 1, 0);
      }
      if (px > 0.006 && px < 0.025) { // the ends of the locks of his fringe that are too thin to paint
        only = [SKIN, SKIN + 5];
        for (const [x0, x1, y1] of BANGS) {
          line.length = 0;
          for (let j = 0; j <= 8; j++) line.push(bangAlong(x0, x1, j / 8), HEAD_Y + BANGS_Y - (j / 8) * (BANGS_Y - y1));
          stroke(line, HAIR, 0);
        }
        only = null;
      }
      if (px > 0.005 && px < 0.022) for (const side of [-1, 1]) rake(side * 0.018, HEAD_Y + 0.032 - 0.004 * open, side * 0.076, HEAD_Y + 0.054, side < 0 ? BACK : SLASH, HAIR);
      if (px > 0.003 && px < 0.025) {
        const c = Math.floor(col(0.002)), r = Math.floor(row(HEAD_Y - 0.046));
        if (c >= 0 && c < cols && r >= 0 && r < rows) put(c, r, COMMA, LINE);
      }
      if (px > 0.0025 && px < 0.025) {
        only = [SKIN, LIP + 2];
        line.length = 0;
        for (let j = 0; j <= 12; j++) { const x = lerp(-0.025, 0.025, j / 12); line.push(x, mouthLine(x)); }
        stroke(line, LINE, 0);
      }
      if (px < 0.0012) for (const side of [-1, 1]) { // close to: the fibres of his irises, and the rays of the sun in each
        only = [IRIS + 1, IRIS + 5];
        for (let k = 0; k < 28; k++) {
          const a = ((k + 0.5) / 28) * 2 * Math.PI, dx = Math.cos(a), dy = Math.sin(a);
          thin(col(side * IRIS_X + 0.0042 * dx), row(IRIS_Y + 0.0042 * dy), col(side * IRIS_X + 0.0086 * dx), row(IRIS_Y + 0.0086 * dy), 0, 0);
        }
        only = [IRIS, SHINE + 3];
        for (let k = -2; k <= 2; k++) {
          const dx = Math.sin(k * 0.55), dy = Math.cos(k * 0.55), x = side * IRIS_X + GLINT_X, y = IRIS_Y + GLINT_Y;
          thin(col(x + 0.002 * dx), row(y + 0.002 * dy), col(x + 0.0034 * dx), row(y + 0.0034 * dy), SHINE + 2, 0);
        }
      }
      only = null;
      if (px < 0.012) { // lashes, standing off the heavy upper lids
        const grid = 2 ** Math.round(Math.log2(S / 2.4));
        for (let r = Math.max(0, Math.floor(row(EYE_Y + 0.03))); r < rows && r <= row(EYE_Y - 0.02); r++) for (let c = 0, i = r * cols; c < cols; c++, i++) {
          const top = paint[r * 2 * cols + c], foot = paint[(r * 2 + 1) * cols + c];
          if (foot !== HAIR || top < SKIN || top >= SKIN + 5) continue;
          const h = hash(Math.floor((fx + ((c + 0.5) * unit - gx) / S) * grid) + 77, 5);
          if (h < 0.55) put(c, r, h < 0.2 ? TICK : h < 0.4 ? HIGH : BAR, HAIR);
        }
      }
      const R = 0.03 * S, bc = Math.floor(col(0.185)), br = Math.floor(row(up(0.56)));
      if ((R < 2.5 || R > 6) && bc >= 0 && bc < cols && br >= 0 && br < rows) { glyph[br * cols + bc] = R < 2.5 ? STARRY : RING; ink[br * cols + bc] = EMBLEM + 3; bold[br * cols + bc] = 1; }
      if (px < 0.012) {
        only = [GREEN, GREEN + 3];
        const sway = (0.012 + 0.006 * Math.sin(now * 1.9)) * 0.5;
        for (const f of [-0.6, 0, 0.6]) thin(col(-0.115 + f * 0.012), row(up(0.138)), col(-0.115 + f * 0.024 + sway * 1.6), row(up(0.07)), 0, 0);
        only = null;
      }
    }

    // The ending. The sunrise in his eye flares, in a ragged star with glints of gold about its
    // edge, until the screen is white. His dark lids and lashes go white first, so that they do not
    // show through the light as grey.
    function bloom(s) {
      const k = (s - T.bloom) / (T.white - T.bloom), round = Math.hypot(W, lines) * (0.02 + 1.45 * k * k);
      const bx = gx + (IRIS_X + GLINT_X - fx) * S, by = gy - (IRIS_Y + GLINT_Y - fy) * S;
      for (let r = 0, i = 0; r < rows; r++) for (let c = 0; c < cols; c++, i++) {
        const dx = (c + 0.5) * unit - bx, dy = r * 2 + 1 - by, a = Math.atan2(dy, dx), under = paint[r * 2 * cols + c];
        const inside = round * (1 + 0.2 * Math.sin(a * 8 + 0.6) * Math.sin(a * 5 - 1)) - Math.sqrt(dx * dx + dy * dy); // how far inside the star
        const level = Math.floor((inside / (4 + round * 0.15)) * 3 + BAYER[(r & 3) * 4 + (c & 3)] + 1) + (under >= HAIR && under < EYE ? 2 : 0);
        if (level <= 0) continue;
        const h = hash(c, r + 31);
        wash[i] = level > 3 ? WHITE : VEIL + level - 1;
        if (level > 1) glyph[i] = 32;
        if (level < 3 && h < 0.16) { glyph[i] = h < 0.03 ? STARRY : h < 0.07 ? PLUS : h < 0.11 ? TICK : DOT; ink[i] = QI + (h < 0.07 ? 0 : 1); bold[i] = 0; }
      }
    }
    // and then the white thins like mist, in streaks that drift and rise, and the page shows through.
    function thinOut(s) {
      const k = (s - T.white) / (T.end - T.white), gone = lerp(-0.1, 1, Math.pow(k, 0.8));
      for (let l = 0; l < lines; l++) for (let c = 0, i = l * cols; c < cols; c++, i++) {
        const hold = lumpAt((c + 0.5) * unit * 0.35 + k * 30, l * 1.6 + k * lines * 0.5) - gone;
        if (hold > 0) paint[i] = hold > 0.09 ? WHITE : VEIL + Math.floor(hold / 0.03);
        if (!(l & 1) && hold > -0.03 && hold < 0.05 && hash(c, l) < 0.5) { glyph[(l >> 1) * cols + c] = hold > 0 ? TILDE : hash(l, c) < 0.5 ? DASH : DOT; ink[(l >> 1) * cols + c] = WHITE; }
      }
    }

    return {
      cols, rows, palette, glyph, ink, bold, paint, wash,
      render(t) { // t: seconds since the film started
        glyph.fill(32); ink.fill(0); bold.fill(0); paint.fill(0); wash.fill(0);
        if (t >= LENGTH) return this; // over: an empty frame, so the page shows
        const s = t * SPEED; // where that is in the story
        // The camera: his eyes come to the middle of the screen as it closes on his face, and then
        // the iris of the one on our right, as it goes on into that.
        const close = smooth(T.push - 1, T.seen, s), aim = smooth(T.seen, T.eye, s);
        S = S0 * Math.exp(zoomAt(s)); px = 1 / S;
        fx = IRIS_X * aim; fy = lerp(EYE_Y, IRIS_Y, aim);
        gx = lerp(cx + (fx - MIDDLE) * S0, cx, close); gy = lerp(seat - fy * S0, cy, close);
        D = F / S; sea = F * (fy + (gy - hy) / S - CLOUD_Y); camU = fx + (cx - gx) / S - PEAK_X;
        viewL = fx - gx / S; viewR = fx + (W - gx) / S; viewB = fy - (lines - gy) / S; viewT = fy + gy / S;
        now = s;
        lift = 0.012 * Math.cos(((s - T.qi) / T.breath) * 2 * Math.PI);
        open = smooth(T.open, T.seen, s);
        wing = 0.00375 + lerp(0.0008 - 0.0042 * 0.4375 ** 0.9, 0.0078 * 0.4375 ** 0.65, open); // three quarters of the way out, where the line of the lid sweeps on up

        const light = smooth(T.sun, T.gold, s), sky = clamp01(0.12 * (s / T.sun) + 0.88 * smooth(T.sun - 0.5, T.gold - 0.5, s));
        for (let k = 1; k < KEYS.length; k++) {
          const key = KEYS[k], at = (key.length - 1) * (k < SEA ? sky : light), j = Math.min(key.length - 1, at | 0), f = at - j;
          const a = key[j], b = key[Math.min(key.length - 1, j + 1)];
          palette[k] = `rgb(${Math.round(lerp(a[0], b[0], f))},${Math.round(lerp(a[1], b[1], f))},${Math.round(lerp(a[2], b[2], f))})`;
        }
        const dim = (k, alpha) => { palette[k] = `rgba(${KEYS[k][0].join(',')},${alpha.toFixed(3)})`; };
        dim(STAR, 0.6 * (1 - sky) ** 2); dim(STAR + 1, (1 - sky) ** 2); dim(RAY, 0.55 * light);
        [0.1, 0.19, 0.3].forEach((alpha, k) => dim(AURA + k, alpha * (0.75 + 0.25 * light)));
        [0.3, 0.55, 0.8].forEach((alpha, k) => dim(VEIL + k, alpha));
        if (s >= T.white) { thinOut(s); return this; }

        farPeaks();
        treeWood();
        treeBlossom();
        cragY = NaN; headY = NaN;
        fill(-3.6, -4.6, 1.9, -0.02, crag);
        fill(-1, -0.36, 1.1, 0, slab);
        blowTail(s);
        blowSleeves(s);
        paintTail();
        fill(0.43, -0.02, 1.04, 0.05, sword);
        fill(-0.6, 0, 0.6, 0.21, legs);
        fill(-0.28, 0.19, 0.28, 0.79, torso);
        fill(-0.17, 0.06, -0.06, 0.25, tassel);
        fill(-0.75, 0.03, 0.75, 0.76, arms);
        fill(-0.17, 0.6, 0.17, 1.1, head);
        backdrop(s);
        skyMarks(s);
        texture(S / S0);
        treeMarks(s);
        details();
        qi(s, 1 - smooth(6, 20, S / S0));
        if (s > T.bloom) bloom(s);
        return this;
      },
    };
  }

  const film = { length: LENGTH, still: 2.15, createScene };
  return { play: (options) => AsciiStage.play(film, options), createScene };
})();
