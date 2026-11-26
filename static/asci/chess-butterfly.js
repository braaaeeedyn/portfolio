/*
 * The falling king: an ASCII loading screen for the stage.
 *
 *   <script src="ascii-stage.js"></script>
 *   <script src="chess-butterfly.js"></script>
 *   <script>ChessButterfly.play().then(showThePage);</script>
 *
 * In black-and-white ink, a man with long black hair sits on a tufted leather
 * sofa behind a chessboard, his head resting on one hand, the wall behind him
 * written over in columns of brush strokes between stalks of bamboo. The white
 * pieces glow, and light him from below. With one finger he slides the tallest
 * of them a square toward us, a small cyan butterfly riding on it, and lifts
 * the finger clear. The black king topples onto its side and rocks still. The
 * butterfly takes off and climbs past his face and out of the top of the
 * picture; his eyes follow it up and his smile widens. Then the drawing lifts
 * away upward after it in strokes of ink and grey wash, from the bottom up and
 * his upturned face last, to show the page. It lasts five seconds (LENGTH).
 *
 * The scene is laid out in the pixels of its square reference picture (REF),
 * x to the right and y down, and seen through a camera that never moves: a
 * wider screen shows more of the room to either side of the square, a taller
 * one more wall above it and more board below. What does not move is painted
 * once, in createScene; render(t) draws the rest over it as a pure function
 * of time.
 */
const ChessButterfly = (() => {
  'use strict';
  const { code, clamp01, lerp, smooth, mulberry32, hash, noise } = AsciiStage;

  // The story's timeline, in seconds at the pace it was written.
  const T = {
    push: 2,     // his finger starts sliding the tall white piece toward us
    stop: 4,     // it has come one square
    lifted: 4.9, // and his finger is clear of it
    tip: 5,      // the black king starts to lean
    land: 5.8,   // and hits the board
    still: 6.4,  // it has rocked once and lies still
    fly: 6.5,    // the butterfly takes off
    out: 9,      // and has gone out of the top of the picture
    hold: 10,    // he holds still, eyes up, until here
    end: 11.2,   // and by now the drawing has lifted away
  };
  // It is played faster than that. LENGTH is how many seconds the whole of it
  // takes on screen, and SPEED how many times faster than the story that is.
  const LENGTH = 5, SPEED = T.end / LENGTH;

  // Colours. The palette is black, white and neutral grey, but for the butterfly.
  const INK = ['#000000'];
  const swatch = (...colours) => INK.push(...colours) - colours.length;
  const grey = (v, a = 1) => {
    const n = Math.round(Math.max(0, Math.min(255, v)));
    return a < 1 ? `rgba(${n},${n},${n},${a.toFixed(3)})` : '#' + n.toString(16).padStart(2, '0').repeat(3);
  };
  // One ramp of greys, from the black of his robe to the white of the glowing pieces. `d`, from an
  // ordered dither, mixes neighbouring steps.
  const GREYS = 32, GREY = swatch(...Array.from({ length: GREYS }, (_, i) => grey(5 + 250 * (i / (GREYS - 1)) ** 1.1)));
  const tone = (v, d = 0.5) => GREY + Math.max(0, Math.min(GREYS - 1, Math.floor(v * (GREYS - 1) + d)));
  // His skin, shadow to light: the brief's pale ramp with the colour taken out. The white pieces light
  // it, so it is set each frame, a little brighter as their glow swells. Then its finest lines.
  const SKIN_KEYS = [98, 124, 149, 172, 194, 214, 232, 247], SKINS = SKIN_KEYS.length;
  const SKIN = swatch(...SKIN_KEYS.map((v) => grey(v))), LINE = swatch(grey(70)), LIPS = swatch(grey(112), grey(194)); // the line of his lips, and the shade under them
  const flesh = (level, d = 0.5) => SKIN + Math.max(0, Math.min(SKINS - 1, Math.floor(level + d)));
  // The glow about the white pieces, in six strengths of white laid over whatever is there, and the
  // tall piece's own, which brightens as it comes forward. Set each frame, as the glow pulses.
  const HALOS = 6, HALO = swatch(...Array(HALOS).fill('#fff')), BRIGHT = swatch(...Array(HALOS).fill('#fff'));
  // The butterfly: its body, the rims of its wings, and its wings, which are clear, over dark, mid and light ground.
  const BODY = swatch('#e8ffff'), RIM = swatch('#80f0ff'), WINGS = swatch('#13606b', '#278f9d', '#56c9d7', '#a6eef6');
  const GLOW = swatch(...[0.07, 0.13, 0.2].map((a) => `rgba(80,230,255,${a})`)); // the light it gives
  const TRAIL = swatch(...[0.5, 0.34, 0.2, 0.1].map((a) => `rgba(110,238,255,${a})`)); // its trail, fading
  // The drawing as it lifts away: ink and grey wash, each in four strengths.
  const LIFTS = 4, LIFT = swatch(...[0.7, 0.48, 0.3, 0.14].map((a) => grey(16, a)), ...[0.7, 0.48, 0.3, 0.14].map((a) => grey(165, a)));
  const LIGHT = INK.map((c) => (c.length === 7 ? parseInt(c.slice(1, 3), 16) / 255 : 0.5)); // how light each colour is

  const [BAR, SLASH, BACK, LOW, DASH, HIGH, TICK, COMMA, DOT, RING] = code('|/\\_-\'`,.o');
  const [BANG, EQUAL, TILDE, COLON] = code('!=~:');
  const STROKES = code('|!;:-=+/\\()[]{}<>^~'); // what brush calligraphy is written in: strokes, never letters
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16); // an ordered dither, 4 by 4

  const REF = 736; // the side of the square reference picture, whose pixels the scene is laid out in

  // A closed outline drawn smoothly through control points [x, y, x, y, ...], with its bounding box.
  function outline(ctrl, steps = 5) {
    const n = ctrl.length / 2, p = [];
    for (let i = 0; i < n; i++) for (let s = 0; s < steps; s++) {
      const t = s / steps;
      for (let d = 0; d < 2; d++) {
        const a = ctrl[((i + n - 1) % n) * 2 + d], b = ctrl[i * 2 + d], c = ctrl[((i + 1) % n) * 2 + d], e = ctrl[((i + 2) % n) * 2 + d];
        p.push(b + 0.5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - e + t * (3 * (b - c) + e - a))));
      }
    }
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); }
    return { p, x0, x1, y0, y1 };
  }
  const within = (o, x, y) => { // inside the outline, by the even-odd rule
    if (x < o.x0 || x > o.x1 || y < o.y0 || y > o.y1) return false;
    const p = o.p;
    let inside = false;
    for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
      if ((p[i + 1] > y) !== (p[j + 1] > y) && x < ((p[j] - p[i]) * (y - p[i + 1])) / (p[j + 1] - p[i + 1]) + p[i]) inside = !inside;
    }
    return inside;
  };
  const segment = (x, y, x0, y0, x1, y1) => { // how far (x, y) is from a straight line between two points
    const dx = x1 - x0, dy = y1 - y0, f = clamp01(((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy || 1));
    return Math.hypot(x - x0 - dx * f, y - y0 - dy * f);
  };
  const rim = (o, x, y) => { // how far (x, y) is from the outline
    const p = o.p;
    let best = Infinity;
    for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) best = Math.min(best, segment(x, y, p[j], p[j + 1], p[i], p[i + 1]));
    return best;
  };
  // An open line drawn smoothly through control points, as a list of points.
  function path(ctrl, steps = 4) {
    const n = ctrl.length / 2, p = [];
    const at = (i, d) => ctrl[Math.max(0, Math.min(n - 1, i)) * 2 + d];
    for (let i = 0; i < n - 1; i++) for (let s = 0; s < (i === n - 2 ? steps + 1 : steps); s++) {
      const t = s / steps;
      for (let d = 0; d < 2; d++) {
        const a = at(i - 1, d), b = at(i, d), c = at(i + 1, d), e = at(i + 2, d);
        p.push(b + 0.5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - e + t * (3 * (b - c) + e - a))));
      }
    }
    return p;
  }

  // Him, in reference pixels. His head, his hair and the hand under his chin are drawn HEAD times as
  // large as in the reference (about PIVOT, and DROP lower) so that his face has the cells to show
  // where his eyes look.
  const HEAD = 1.16, PIVOT = [400, 150], DROP = 9;
  const bigX = (x) => PIVOT[0] + (x - PIVOT[0]) * HEAD, bigY = (y) => PIVOT[1] + (y - PIVOT[1]) * HEAD + DROP;
  const big = (ctrl) => ctrl.map((v, i) => (i & 1 ? bigY(v) : bigX(v)));
  const HAIR_BACK = outline(big([400, 22, 442, 26, 469, 44, 484, 72, 490, 112, 492, 165, 495, 225, 497, 282, 490, 326, 472, 336, 452, 300,
    440, 262, 360, 262, 347, 300, 331, 334, 306, 342, 290, 326, 284, 262, 282, 200, 283, 140, 288, 96, 301, 63, 326, 40, 361, 25]));
  const FACE = outline(big([381, 77, 401, 74, 423, 79, 438, 93, 446, 116, 447, 140, 443, 160, 432, 180, 414, 197, 396, 206, 381, 204,
    365, 194, 351, 180, 342, 160, 339, 134, 344, 110, 355, 93, 367, 83]));
  const FACE_MID = [bigX(394), bigY(140)], FACE_HALF = (FACE.x1 - FACE.x0) / 2;
  const LOCKS = [ // the hair either side of his face, parted in the middle
    outline(big([396, 73, 376, 84, 358, 104, 347, 130, 343, 160, 341, 186, 334, 176, 333, 140, 338, 110, 352, 88, 374, 74])),
    outline(big([404, 73, 424, 82, 439, 98, 448, 122, 451, 148, 446, 138, 440, 112, 428, 92, 412, 80])),
  ];
  const FIST = outline(big([416, 153, 436, 145, 453, 150, 464, 165, 467, 186, 460, 204, 444, 214, 425, 214, 411, 204, 408, 184, 411, 166]));
  const FIST_CREASES = [[438, 168, 463, 167], [436, 186, 466, 187], [440, 202, 459, 204]].map(big); // between the fingers curled under his jaw
  const ARM = outline([423, 222, 461, 216, 475, 262, 479, 306, 461, 332, 441, 324, 432, 282]); // the bare forearm below that fist
  const SLEEVE = outline([437, 313, 463, 291, 489, 285, 521, 297, 549, 323, 563, 361, 573, 406, 541, 426, 496, 411, 457, 373]);
  const ROBE = outline([218, 232, 262, 218, 312, 226, 366, 300, 432, 242, 470, 252, 505, 273, 540, 302, 560, 342, 570, 396, 610, 430,
    650, 500, 676, 600, 692, 730, 104, 730, 112, 600, 121, 480, 133, 380, 149, 316, 181, 262]);
  const CHEST = outline([346, 212, 406, 218, 430, 246, 371, 400, 361, 400, 326, 238], 3); // his throat, and the chest his collar opens on
  const BANDS = [[322, 232, 364, 402], [436, 242, 368, 402]]; // the two edges of the white inner robe, crossing at his chest
  const EYES = [[bigX(369), bigY(119), -1], [bigX(423), bigY(133), 1]]; // the middle of each, and which way is out
  // His eyes lie along a line turned TILT, as his head leans. EYE_W is half the width of each, and EYE_H
  // the measure of their heights: a little more than in the reference, so that a look up shows.
  const TILT = 0.25, TC = Math.cos(TILT), TS = Math.sin(TILT), EYE_W = 20 * HEAD, EYE_H = 26 * HEAD, IRIS = 8 * HEAD;
  const MOUTH = [bigX(388), bigY(171)], NOSE = [bigX(396), bigY(127), bigX(393), bigY(150), bigX(389), bigY(156)];
  const FOLDS = [ // creases in his robe
    [200, 268, 168, 360, 156, 470, 150, 560], [244, 262, 214, 322, 204, 360], [300, 520, 316, 600],
    [482, 300, 512, 360, 528, 420], [560, 430, 520, 520, 500, 600], [588, 452, 584, 540, 590, 610], [618, 470, 640, 560, 652, 610],
    [430, 420, 448, 500, 452, 580],
  ];
  const SHEEN = [[384, 30, 330, 70, 302, 160], [404, 26, 452, 60, 476, 140], [394, 30, 360, 60, 330, 120], [300, 180, 296, 250, 300, 330],
    [486, 170, 490, 240, 486, 320], [414, 28, 440, 50, 462, 110]].map((p) => path(big(p), 3)); // light caught along his hair
  const STRANDS = [ // strands of hair that stir, over his cheeks and straying out over the wall: from root to end, and how much they move
    [big([372, 80, 356, 104, 346, 136, 343, 170]), 1], [big([424, 80, 440, 100, 447, 128, 448, 150]), 0.8],
    [big([300, 70, 276, 150, 266, 240, 270, 320]), 1.4], [big([480, 70, 502, 150, 510, 240, 505, 320]), 1.2],
  ].map(([pts, amp]) => [path(pts, 3), amp]);

  // The hand he reaches out with, in reference pixels from the tip of its pointing finger: the back of
  // the hand, three fingers curled under it and the one that points, with the creases between them; and
  // the cuff of its sleeve. It is shaded once, on a lattice HAND_STEP pixels apart: in HAND_MAP, -1 where
  // there is nothing, a level of SKIN on the hand (lit from below, by the piece it touches), or
  // SLEEVE_DARK or SLEEVE_LIT; in HAND_INK, how far each point is from an ink line (its outline or a crease).
  const HAND = outline([-186, -170, -176, -182, -151, -188, -119, -185, -86, -173, -58, -158, -40, -138, -28, -110, -18, -78, -9, -44, -2, -18,
    2, 0, -2, 7, -15, 2, -27, -22, -39, -50, -49, -72, -56, -82, -59, -64, -64, -42, -76, -30, -95, -27, -113, -30, -131, -36, -149, -48,
    -166, -68, -178, -95, -185, -130]);
  const CUFF = outline([-228, -212, -184, -194, -178, -132, -183, -60, -192, 40, -228, 32]);
  const CREASES = [[-156, -110, -131, -36], [-123, -120, -101, -30], [-89, -128, -71, -34], [-64, -138, -55, -80]];
  const KNUCKLE = (x) => lerp(-120, -142, clamp01((x + 186) / 126)); // the line of his knuckles, above which is the back of his hand
  const HAND_X = -236, HAND_Y = -214, HAND_STEP = 2, HAND_COLS = 122, HAND_ROWS = 132, SLEEVE_DARK = 20, SLEEVE_LIT = 21;
  const HAND_MAP = new Float32Array(HAND_COLS * HAND_ROWS).fill(-1), HAND_INK = new Float32Array(HAND_COLS * HAND_ROWS);
  for (let j = 0; j < HAND_ROWS; j++) for (let i = 0; i < HAND_COLS; i++) {
    const x = HAND_X + i * HAND_STEP, y = HAND_Y + j * HAND_STEP, at = j * HAND_COLS + i;
    if (within(HAND, x, y)) {
      const e = rim(HAND, x, y), crease = Math.min(...CREASES.map(([x0, y0, x1, y1]) => segment(x, y, x0, y0, x1, y1)));
      const pointing = y > -150 && x > -63 + 0.2 * (y + 138), knuckle = KNUCKLE(x);
      let level = pointing ? 4.7 + 1.6 * clamp01((y + 110) / 110) : y < knuckle ? 3.2 + 0.7 * clamp01((y + 190) / 60) : 4.5 + 1.6 * clamp01((y - knuckle) / 90);
      level -= 1.2 * (1 - smooth(0, 12, crease)) + 0.9 * (1 - smooth(0, 9, e)) + 1.3 * clamp01((-160 - x) / 26);
      HAND_MAP[at] = level; HAND_INK[at] = Math.min(e, crease);
    } else if (within(CUFF, x, y)) HAND_MAP[at] = rim(CUFF, x, y) < 4.5 && x > -194 ? SLEEVE_LIT : SLEEVE_DARK;
  }

  // The board, seen by a camera one camera height above it: the row of its horizon, its focal length
  // and the column straight ahead. A square is 0.9 camera heights, and the board is turned YAW; that
  // puts the pieces where the reference has them.
  const HORIZON = 555, FOCAL = 720, AHEAD = 400, SQUARE = 0.9, YAW = 0.087;
  const HOME = [398, 668]; // the middle of the square the tall white piece starts on (file 0, rank 0)
  const Z0 = FOCAL / (HOME[1] - HORIZON), X0 = ((HOME[0] - AHEAD) * Z0) / FOCAL, CY = Math.cos(YAW), SY = Math.sin(YAW);
  // The board's edges, in squares, and the far edge of the table. It runs on toward the camera past
  // the bottom of the square, so that a tall screen shows more of it.
  const FILES = [-3.5, 4.5], RANKS = [-7.5, 4.5], FAR = 4.95;
  const SPREAD = 2.8; // how far the light of a glowing piece spreads over the board, as a square of squares
  const world = (i, j) => [X0 + (i * CY - j * SY) * SQUARE, Z0 + (i * SY + j * CY) * SQUARE];
  // The pieces as they come off the lathe: half widths up their height, in camera heights, and what
  // stands on top: a ball, a mitre with a slit across it, a crown of three points, a cross.
  const KINDS = {
    pawn: { body: [[0, 0.32], [0.05, 0.32], [0.1, 0.25], [0.2, 0.18], [0.42, 0.115], [0.46, 0.2], [0.52, 0.2], [0.55, 0.1], [0.58, 0.1]], ball: [0.72, 0.165], top: 0.885 },
    bishop: { body: [[0, 0.35], [0.05, 0.35], [0.11, 0.27], [0.24, 0.18], [0.56, 0.11], [0.6, 0.2], [0.66, 0.2], [0.69, 0.1], [0.71, 0.1]], mitre: [0.88, 0.155, 0.19], ball: [1.11, 0.05], top: 1.16 },
    queen: { body: [[0, 0.36], [0.05, 0.36], [0.11, 0.28], [0.26, 0.19], [0.66, 0.12], [0.7, 0.21], [0.76, 0.21], [0.79, 0.11], [1.02, 0.19], [1.06, 0.215]], crown: [1.06, 1.18], ball: [1.24, 0.055], top: 1.295 },
    king: { body: [[0, 0.38], [0.05, 0.38], [0.12, 0.3], [0.29, 0.21], [0.77, 0.15], [0.81, 0.245], [0.87, 0.245], [0.9, 0.14], [1.2, 0.245], [1.25, 0.25], [1.29, 0.2], [1.32, 0.09]], cross: [1.32, 1.62, 0.13, 0.05], top: 1.62 },
  };
  // [kind, file, rank, white, how strongly it glows], back to front. The tall white piece and the black
  // king move, and are drawn each frame.
  const STILL = [['pawn', 1, 2, 0, 0], ['pawn', 4, 2, 1, 0.5], ['pawn', -1, 1, 0, 0], ['pawn', 4, 1, 1, 0.5], ['pawn', -2, 0, 1, 0.6],
    ['pawn', 1, -1, 1, 1], ['bishop', -2, -2, 1, 1]];
  const QUEEN = [0, 0], KING = [2, -1];

  // Bamboo in front of the wall: [across, at the height of his shoulders; lean, across per down; width;
  // how far back, from 0, near and black, to 1, lost in the mist]. These are the reference's; more
  // stand further along the wall either side.
  const STALKS = [[22, 0.02, 26, 0.04], [100, -0.06, 30, 0.02], [165, -0.01, 15, 0.45], [496, 0, 11, 0.62], [530, -0.02, 17, 0.45],
    [618, 0.07, 30, 0.06], [702, -0.03, 26, 0.32], [742, 0.01, 18, 0.55]];
  // Columns of brush calligraphy on the wall: [across, top, bottom, size of a mark], as in the reference.
  const SCRIPT = [[117, 135, 300, 24], [157, 84, 300, 26], [213, 48, 200, 21], [240, 62, 190, 19], [512, 8, 200, 25], [574, 196, 300, 15],
    [628, 14, 330, 30], [668, 62, 320, 25]];
  // The sofa, black tufted leather: its back and arm to our left, and to our right.
  const SOFA = [
    outline([-340, 720, -340, 372, -318, 332, -262, 314, 0, 311, 80, 314, 130, 322, 168, 340, 172, 720]),
    outline([528, 720, 528, 354, 585, 343, 625, 355, 650, 378, 662, 394, 720, 386, 800, 388, 862, 398, 886, 426, 890, 720]),
  ];
  const BUTTONS = [[-290, 380], [-226, 380], [-162, 380], [-98, 380], [-34, 380], [30, 380], [94, 380], [-258, 446], [-194, 446], [-130, 446],
    [-66, 446], [-2, 446], [62, 446], [126, 446], [-290, 512], [-226, 512], [-162, 512], [-98, 512], [-34, 512], [30, 512], [94, 512],
    [566, 372], [614, 378], [700, 440], [764, 430], [828, 440], [732, 506], [796, 500], [860, 506], [700, 572], [764, 566], [828, 572]];

  // The butterfly's wings, the right two (the left mirror them), in pixels from its body, up positive.
  const WING = [outline([1, 2, 8, 20, 20, 32, 31, 31, 29, 19, 15, 6]), outline([1, -1, 13, -2, 22, -11, 18, -22, 8, -19, 2, -9])];
  const BUTTERFLY = 1.4; // how much larger than those numbers it is drawn
  const TAIL = 0.13; // how long, as a share of the handover, a lifting stroke trails below the drawing

  function createScene({ cols, rows, aspect = 2, seed = 1 }) {
    const lines = rows * 2, cells = cols * rows;
    const glyph = new Uint8Array(cells).fill(32), ink = new Uint8Array(cells), bold = new Uint8Array(cells), wash = new Uint8Array(cells);
    const paint = new Uint8Array(cells * 2), owner = new Uint8Array(cells * 2); // what each half cell shows, and what it belongs to
    const palette = INK.slice();
    // A random source for each thing laid out by chance, so that each is the same on any screen.
    const draw = (n) => { const rand = mulberry32(seed * 7919 + n); return (a, b) => a + (b - a) * rand(); };
    const R = draw(1), RL = draw(2), RS = draw(3);

    // The square fills the screen's shorter side, in the middle. Distances on screen are in column
    // widths, a half row being `half` of them; `k` of them to a reference pixel.
    const half = aspect / 2, side = Math.min(cols, lines * half), k = side / REF;
    const ox = (cols - side) / 2, oy = (lines * half - side) / 2;
    const atX = (c) => (c - ox) / k, atY = (l) => (l * half - oy) / k; // a column, or a half row, as reference pixels
    const toC = (x) => ox + x * k, toL = (y) => (oy + y * k) / half;   // and back
    const minX = atX(0), maxX = atX(cols), minY = atY(0), maxY = atY(lines);
    const inkWidth = (0.52 * Math.max(1, half)) / k; // half the width of an ink line on skin, in reference pixels: a half cell across
    const dither = (c, l) => BAYER[(l & 3) * 4 + (c & 3)];
    const WALL = 1, STALK = 2, COUCH = 3, CLOAK = 4, HAIR = 5, FLESH = 6, CLOTH = 7, BOARD = 8, PIECE = 9, PALM = 10;
    const bit = (...list) => list.reduce((m, w) => m | (1 << w), 0);

    // Where a point of the board's plane is, from where it is seen: its file and rank.
    let fileAt = 0, rankAt = 0;
    const onBoard = (x, y) => {
      const dist = FOCAL / (y - HORIZON), dx = ((x - AHEAD) * dist) / FOCAL - X0, dz = dist - Z0;
      fileAt = (dx * CY + dz * SY) / SQUARE; rankAt = (-dx * SY + dz * CY) / SQUARE;
    };
    const seen = (i, j) => { const [X, Z] = world(i, j); return [AHEAD + (FOCAL * X) / Z, HORIZON + FOCAL / Z, FOCAL / Z]; }; // where, and how many reference pixels to a camera height there
    // What the board's plane is at a point: 0 a black square, 1 a white one, 2 the board's edge, 3 the table round it.
    const square = () => {
      if (fileAt > FILES[0] && fileAt < FILES[1] && rankAt > RANKS[0] && rankAt < RANKS[1]) return (Math.floor(fileAt + 0.5) + Math.floor(rankAt + 0.5)) & 1;
      return fileAt > FILES[0] - 0.14 && fileAt < FILES[1] + 0.14 && rankAt > RANKS[0] - 0.14 && rankAt < RANKS[1] + 0.14 ? 2 : 3;
    };
    const DARK = [0.02, 0.14, 0.08, 0.035], LIT = [0.15, 0.62, 0.3, 0.1]; // how light each of those is, unlit, and how much light adds
    // The light the white pieces throw on the board: [file, rank, strength]. The tall piece's moves with it, each frame.
    const pools = STILL.filter((p) => p[3]).map(([, i, j, , glow]) => [i, j, 0.55 + 0.45 * glow]);
    const pooled = (i, j) => { let light = 0; for (const [pi, pj, s] of pools) light += s * Math.exp(-((i - pi) ** 2 + (j - pj) ** 2) / SPREAD); return light; };

    // The wall: ink wash, dark overhead, with mist glowing through it to his left and, most of all, to his
    // right; and further along the wall, more patches of mist.
    function wallTone(x, y) {
      const right = Math.exp(-(((x - 660) / 210) ** 2) - ((y - 300) / 170) ** 2);
      const left = Math.exp(-(((x - 80) / 150) ** 2) - ((y - 250) / 110) ** 2);
      const out = smooth(380, 560, Math.abs(x - 368)) * smooth(0.35, 0.8, noise(x / 240 + 5, y / 260 + 1));
      const above = smooth(40, -240, y) * smooth(0.3, 0.78, noise(x / 210 + 2, y / 230 + 9)); // mist again, higher up the wall
      const streak = noise(x / 19, y / 240 + 3) - 0.5; // the wash, laid on in long upright strokes
      return clamp01(0.12 + 0.55 * right + 0.3 * left + 0.42 * out + 0.4 * above + 0.07 * streak - 0.1 * clamp01((170 - y) / 170));
    }

    // Bamboo, the reference's and more along the wall either side, and its leaves, which hang in fans
    // from the joints of the upper stalks.
    const stalks = STALKS.map(([x, lean, w, back]) => ({ x, lean, w, back, joint: R(68, 92), phase: R(0, 90) }));
    for (const way of [-1, 1]) for (let x = way < 0 ? -46 : 790; Math.abs(x - 368) < 1900; x += way * R(40, 88)) {
      stalks.push({ x, lean: R(-0.05, 0.05), w: R(12, 32), back: R(0, 1) ** 0.8 * 0.75, joint: R(68, 92), phase: R(0, 90) });
    }
    stalks.sort((a, b) => b.back - a.back); // far ones first, so the near ones are drawn over them
    const stalkAt = (s, y) => s.x + s.lean * (y - 300);
    const leaves = [];
    for (const s of stalks) for (let y = 300 - s.phase; y > -900; y -= s.joint) {
      if (RL(0, 1) > (y > 200 ? 0.3 : 0.6)) continue;
      const way = RL(-1, 1) < 0 ? -1 : 1, n = 2 + Math.floor(RL(0, 3));
      for (let j = 0; j < n; j++) {
        const a = RL(0.3, 1.25);
        leaves.push({ x: stalkAt(s, y), y, a: way > 0 ? a : Math.PI - a, len: RL(40, 78), w: RL(5, 9), back: s.back, phase: RL(0, 6.28) });
      }
    }
    const shown = leaves.filter((f) => f.x > minX - 90 && f.x < maxX + 90 && f.y > minY - 90 && f.y < maxY);
    // The calligraphy: the reference's columns, and more further along the wall.
    const script = SCRIPT.map((col) => col.slice());
    for (const way of [-1, 1]) for (let x = way < 0 ? -60 : 800; Math.abs(x - 368) < 1900; x += way * RS(55, 120)) {
      const top = RS(-120, 140);
      script.push([x, top, top + RS(120, 300), RS(16, 30)]);
    }
    for (const col of script) if (col[1] < 70 && minY < -40) col[1] = Math.max(minY + 20, col[1] - 260); // a tall screen shows more wall above: the writing goes on up it

    // ----- The picture, at rest -----
    let who = 0; // what the last colour found belongs to

    // Him: his skin lit from below and before him by the pieces, his robe and hair near black.
    function him(x, y, d) {
      if (x < 100 || x > 700 || y < 0 || y > 730) return 0;
      if (within(SLEEVE, x, y)) { who = CLOAK; return tone(0.035 + (rim(SLEEVE, x, y) < 4 && y < 340 ? 0.14 : 0), d); }
      if (within(FIST, x, y)) {
        who = FLESH;
        const f = (y - FIST.y0) / (FIST.y1 - FIST.y0), e = rim(FIST, x, y);
        return e < inkWidth ? LINE : flesh(3.4 + 1.9 * f - (e < 2 * inkWidth ? 0.7 : 0), d);
      }
      if (within(ARM, x, y)) { who = FLESH; return rim(ARM, x, y) < inkWidth * 0.8 ? LINE : flesh(4.2 - 1.2 * clamp01((x - 430) / 45) + 0.8 * clamp01((y - 230) / 90), d); }
      for (const lock of LOCKS) if (within(lock, x, y)) { who = HAIR; return tone(0.045, d); }
      if (within(FACE, x, y)) {
        who = FLESH;
        const f = (y - FACE.y0) / (FACE.y1 - FACE.y0), across = (x - FACE_MID[0]) / FACE_HALF, e = rim(FACE, x, y);
        if (e < inkWidth * 0.8 && f > 0.55) return LINE; // the line of his jaw
        return flesh(5.2 + 1.1 * f - 1.5 * clamp01(-across - 0.3) - 0.7 * clamp01(across - 0.5) - (f < 0.16 ? 0.8 : 0) - (e < 2 * inkWidth ? 0.7 : 0), d);
      }
      for (const [x0, y0, x1, y1] of BANDS) {
        const f = clamp01((y - y0) / (y1 - y0)), e = segment(x, y, x0, y0, x1, y1);
        if (e < 8.5 - 4 * f && y > y0 - 4 && y < y1 + 2) { who = CLOTH; return tone(e > 6.2 - 3 * f ? 0.42 : 0.84 + 0.1 * f, d); }
      }
      if (within(CHEST, x, y)) {
        who = FLESH;
        const under = y - bigY(205) - 0.25 * (x - 360); // how far below the shadow his jaw throws
        return flesh(under < 16 ? 1.6 : 3.4 + 1.4 * clamp01((y - 250) / 120) - (x < 350 ? 0.6 : 0), d);
      }
      if (within(HAIR_BACK, x, y)) {
        who = HAIR;
        const crown = Math.hypot((x - bigX(398)) / 1.25, y - bigY(118)) - 86 * HEAD; // a band of sheen round the crown
        return tone(0.04 + (Math.abs(crown) < 6 && y < bigY(100) ? 0.08 : 0), d);
      }
      if (within(ROBE, x, y)) {
        who = CLOAK;
        const lit = clamp01((y - 470) / 220) * 0.06 + (rim(ROBE, x, y) < 4 && y < 380 ? 0.1 : 0); // the pieces light it from below; the mist rims it above
        return tone(0.03 + lit + 0.03 * (noise(x / 26, y / 70) - 0.5), d);
      }
      return 0;
    }
    function sofa(x, y, d) {
      for (const o of SOFA) if (within(o, x, y)) {
        who = COUCH;
        const e = rim(o, x, y), top = y < o.y0 + 40;
        return tone(0.03 + (top && e < 10 ? 0.2 * (1 - e / 10) : 0) + 0.025 * (noise(x / 30, y / 30) - 0.5), d);
      }
      return 0;
    }
    function stalk(x, y, d) {
      for (let n = stalks.length - 1; n >= 0; n--) { // nearest first
        const s = stalks[n], u = (x - stalkAt(s, y)) / (s.w / 2);
        if (u <= -1 || u >= 1) continue;
        who = STALK;
        const wall = wallTone(x, y), body = lerp(0.04, wall * 0.82, s.back), edge = Math.abs(u) > 0.62 ? 0.08 + 0.18 * wall : 0;
        return tone(body + edge * (1 - s.back), d);
      }
      return 0;
    }

    // Paint the picture at rest, half cell by half cell: the board and the table round it (each half cell
    // of it the mean of four looks, so that its far squares do not break up), him, the sofa, bamboo, wall.
    const boardAt = [], boardData = []; // which half cells are board, and for each: unlit, lit, file, rank
    const looks = [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]].map(([a, b]) => [a / k, (b * half) / k]);
    for (let l = 0; l < lines; l++) {
      const y = atY(l + 0.5);
      for (let c = 0, i = l * cols; c < cols; c++, i++) {
        const x = atX(c + 0.5), d = dither(c, l);
        let colour = 0;
        if (y > HORIZON + 1) {
          onBoard(x, y);
          if (rankAt <= FAR) {
            const i0 = fileAt, j0 = rankAt;
            let dark = 0, lit = 0;
            for (const [a, b] of looks) { onBoard(x + a, y + b); const kind = rankAt > FAR ? 3 : square(); dark += DARK[kind] / 4; lit += LIT[kind] / 4; }
            boardAt.push(i); boardData.push(dark, lit, i0, j0);
            who = BOARD; colour = tone(dark + lit * Math.min(1.25, pooled(i0, j0)), d);
          }
        }
        if (!colour) colour = him(x, y, d) || sofa(x, y, d) || stalk(x, y, d);
        if (!colour) { who = WALL; colour = tone(wallTone(x, y), d); }
        paint[i] = colour; owner[i] = who;
      }
    }
    const boardCells = Int32Array.from(boardAt), boardInfo = Float32Array.from(boardData);

    // The pieces. How light a piece is at (u, v), across and up from the middle of its foot in camera
    // heights, `foot` being how far below that the round front of its foot shows; -1 where it is not.
    function lathe(P, white, u, v, foot) {
      const b = P.body, r0 = b[0][1];
      let r = -1, ring = false;
      if (v < 0) r = v >= -foot * Math.sqrt(Math.max(0, r0 * r0 - u * u)) && Math.abs(u) < r0 ? r0 : -1;
      else if (v <= b[b.length - 1][0]) {
        let n = 0;
        while (v > b[n + 1][0]) n++;
        const f = (v - b[n][0]) / (b[n + 1][0] - b[n][0]);
        r = lerp(b[n][1], b[n + 1][1], f);
        ring = Math.abs(b[n + 1][1] - b[n][1]) > 0.06 && f > 0.6; // the step onto a collar or the foot
        if (Math.abs(u) > r) r = -1;
      }
      let part = r >= 0 ? 1 : 0, across = r > 0 ? Math.abs(u) / r : 0; // 1 its body, 2 a ball, 3 a mitre, 4 a crown or cross, 5 the mitre's slit
      if (!part && P.ball && Math.hypot(u, v - P.ball[0]) < P.ball[1]) { part = 2; across = Math.hypot(u, v - P.ball[0]) / P.ball[1]; }
      if (!part && P.mitre) {
        const [my, mx, mh] = P.mitre;
        if ((u / mx) ** 2 + ((v - my) / mh) ** 2 < 1 || (v > my && v < P.ball[0] && Math.abs(u) < (mx * 0.7 * (P.ball[0] - v)) / (P.ball[0] - my))) {
          part = Math.abs((u - 0.02) * 0.8 - (v - my - 0.03) * 0.55) < 0.026 && v > my - 0.05 ? 5 : 3;
          across = Math.abs(u) / mx;
        }
      }
      if (!part && P.crown && v >= P.crown[0] && v < P.crown[1] + 0.01) {
        const w = b[b.length - 1][1], peak = Math.max(0, ...[-0.15, 0, 0.15].map((p) => 1 - Math.abs(u - p) / 0.07));
        if (Math.abs(u) < w && v < P.crown[0] + (P.crown[1] - P.crown[0]) * peak) { part = 4; across = Math.abs(u) / w; }
      }
      if (!part && P.crown && Math.abs(u) < 0.03 && v >= P.crown[1] && v < P.ball[0]) part = 4;
      if (!part && P.cross) {
        const [c0, c1, arm, stem] = P.cross;
        if (v >= c0 && v <= c1 && (Math.abs(u) < stem || (Math.abs(u) < arm && Math.abs(v - c1 + 0.12) < stem))) { part = 4; across = Math.abs(u) / arm; }
      }
      if (!part) return -1;
      if (white) {
        if (part === 5) return 0.5;
        return 0.99 - 0.28 * across ** 3 - (ring ? 0.2 : 0) - (across > 0.93 ? 0.22 : 0);
      }
      // Black and glossy: a rim of light all round it, brightest on the side toward the glowing pieces,
      // a streak of light down that side, and its collars catching light.
      const left = u < 0;
      return 0.06 + (across > 0.72 ? (left ? 0.66 : 0.42) * smooth(0.72, 0.95, across) : 0) + (left && across > 0.24 && across < 0.44 ? 0.26 : 0)
        + (ring ? 0.4 : 0) + (part !== 1 && across < 0.5 ? 0.22 : 0);
    }
    // Draw a piece of `kind` standing with the middle of its foot at (x, y) in reference pixels, `size` of
    // them to a camera height, turned `turn` (clockwise) about (px, py).
    function piece(P, white, x, y, size, turn = 0, px = x, py = y) {
      const reach = (P.top + 0.5) * size, cx = turn ? px : x, cy = turn ? py : y - (P.top * size) / 2;
      const c0 = Math.max(0, Math.floor(toC(cx - reach))), c1 = Math.min(cols - 1, Math.ceil(toC(cx + reach)));
      const l0 = Math.max(0, Math.floor(toL(cy - reach))), l1 = Math.min(lines - 1, Math.ceil(toL(cy + reach)));
      const cs = Math.cos(turn), sn = Math.sin(turn), foot = size / FOCAL; // seen from a camera height up, its round foot shows that much of its radius below its middle
      for (let l = l0; l <= l1; l++) {
        const y0 = atY(l + 0.5);
        for (let c = c0; c <= c1; c++) {
          let x0 = atX(c + 0.5), yy = y0;
          if (turn) { const dx = x0 - px, dy = y0 - py; x0 = px + dx * cs + dy * sn; yy = py - dx * sn + dy * cs; }
          const v = lathe(P, white, (x0 - x) / size, (y - yy) / size, foot);
          if (v < 0) continue;
          const i = l * cols + c;
          paint[i] = tone(v, dither(c, l)); owner[i] = PIECE; glyph[(l >> 1) * cols + c] = 32;
        }
      }
    }
    for (const [kind, i, j, white] of STILL) { const [x, y, size] = seen(i, j); piece(KINDS[kind], white, x, y, size); }

    // Characters: one in a cell if both its halves belong to one of `mask`.
    const ok = (c, r, mask) => c >= 0 && c < cols && r >= 0 && r < rows && (mask >> owner[r * 2 * cols + c]) & 1 && (mask >> owner[(r * 2 + 1) * cols + c]) & 1;
    function put(c, r, ch, colour, mask, heavy = 0) {
      if (!ok(c, r, mask)) return;
      const i = r * cols + c;
      glyph[i] = ch; ink[i] = colour; bold[i] = heavy;
    }
    // A line too thin to paint, as characters chosen by where it crosses each cell (as in plum-blossom.js).
    function thin(c0, r0, c1, r1, colour, mask, heavy = 0) {
      const dc = c1 - c0, dr = r1 - r0, wide = Math.abs(dc), high = Math.abs(dr), rising = dc * dr < 0;
      if (Math.max(c0, c1) < 0 || Math.min(c0, c1) >= cols || Math.max(r0, r1) < 0 || Math.min(r0, r1) >= rows) return;
      if (wide <= high * 1.3) { // steep: one character a row
        const lo = Math.max(0, Math.min(r0, r1)), hi = Math.min(rows, Math.max(r0, r1));
        for (let r = Math.floor(lo); r < hi; r++) {
          const ya = Math.max(lo, r), yb = Math.min(hi, r + 1), cover = yb - ya;
          if (cover < 0.25) continue;
          const ca = c0 + (dc * (ya - r0)) / dr, cb = c0 + (dc * (yb - r0)) / dr;
          const stub = cover < 0.6 ? ((ya + yb) / 2 - r > 0.5 ? (rising ? COMMA : DOT) : HIGH) : 0;
          put(Math.floor((ca + cb) / 2), r, stub || (Math.floor(ca) === Math.floor(cb) ? BAR : rising ? SLASH : BACK), colour, mask, heavy);
        }
      } else { // shallow: one character a column
        const lo = Math.max(0, Math.min(c0, c1)), hi = Math.min(cols, Math.max(c0, c1)), slope = high / wide;
        const level = (c) => { const y = r0 + (dr * (Math.min(hi, Math.max(lo, c + 0.5)) - c0)) / dc, f = y - Math.floor(y); return Math.floor(y) * 2 + (f < 0.25 ? 0 : f < 0.72 ? 1 : 2); };
        for (let c = Math.floor(lo); c < hi; c++) {
          const xa = Math.max(lo, c), xb = Math.min(hi, c + 1);
          if (xb - xa < 0.35) continue;
          const y = r0 + (dr * ((xa + xb) / 2 - c0)) / dc, r = Math.floor(y), f = y - r;
          if (slope > 0.6) put(c, r, rising ? SLASH : BACK, colour, mask, heavy);
          else if (slope > 0.2) put(c, r, f < 0.36 ? (rising ? HIGH : TICK) : f > 0.64 ? (rising ? COMMA : DOT) : DASH, colour, mask, heavy);
          else {
            const q = level(c), steps = level(c + (rising ? 1 : -1)) < q, lands = level(c + (rising ? -1 : 1)) > q;
            if (q % 2 === 0) put(c, q / 2 - 1, LOW, colour, mask, heavy);
            else put(c, (q - 1) / 2, steps ? (rising ? HIGH : TICK) : lands ? (rising ? COMMA : DOT) : DASH, colour, mask, heavy);
          }
        }
      }
    }
    const stroke = (pts, colour, mask, heavy = 0) => { // a line through points in reference pixels
      for (let n = 2; n < pts.length; n += 2) thin(toC(pts[n - 2]), toL(pts[n - 1]) / 2, toC(pts[n]), toL(pts[n + 1]) / 2, colour, mask, heavy);
    };
    const cellAt = (x, y) => [Math.floor(toC(x)), Math.floor(toL(y) / 2)];

    // The calligraphy: marks the size of a written character stacked down each column, each a cluster of
    // brush strokes, often with one across its top and one down its middle; dark on the mist, pale on the dark.
    for (const [x, top, bottom, size] of script) {
      if (x < minX - 40 || x > maxX + 40) continue;
      const w = Math.max(1, Math.round(size * k)), h = Math.max(1, Math.round((size * k) / (2 * half)));
      const c0 = Math.round(toC(x) - w / 2), step = Math.max(h + 1, Math.round((size * 1.3 * k) / (2 * half)));
      for (let r0 = Math.round(toL(top) / 2), mark = 0; r0 + h <= toL(bottom) / 2; r0 += step, mark++) {
        const pale = wallTone(x, atY((r0 + 0.5) * 2)) < 0.36;
        for (let dr = 0; dr < h; dr++) for (let dc = 0; dc < w; dc++) {
          const n = hash(Math.round(x) * 7 + dc, mark * 101 + dr);
          if (n > 0.7) continue;
          const across = dr === 0 && n < 0.25, down = dc === w >> 1 && n < 0.3;
          const ch = across ? (n < 0.1 ? EQUAL : n < 0.18 ? DASH : TILDE) : down ? (n < 0.15 ? BAR : BANG) : STROKES[Math.floor(hash(dc + mark, dr + Math.round(x)) * STROKES.length)];
          put(c0 + dc, r0 + dr, ch, tone(pale ? 0.62 + 0.15 * n : 0.1 + 0.12 * n), bit(WALL), n < 0.2 ? 1 : 0);
        }
      }
    }
    // The joints of the bamboo.
    for (const s of stalks) {
      if (s.x < minX - 60 || s.x > maxX + 60) continue;
      for (let y = 300 - s.phase + s.joint * Math.ceil((minY - 300 + s.phase) / s.joint); y < 640; y += s.joint) {
        const [c, r] = cellAt(stalkAt(s, y), y), w = Math.max(1, Math.round((s.w * k) / 2));
        for (let dc = -w + 1; dc < w; dc++) put(c + dc, r, s.back > 0.4 ? DASH : EQUAL, tone(lerp(0.2, wallTone(s.x, y) * 0.6, s.back)), bit(STALK));
      }
    }
    // The tufting of the sofa: buttons, and the creases running between them.
    for (const [x, y] of BUTTONS) {
      const [c, r] = cellAt(x, y);
      for (const [dx, dy] of [[32, 33], [-32, 33]]) stroke([x, y, x + dx, y + dy], tone(0.13), bit(COUCH));
      put(c, r, RING, tone(0.36), bit(COUCH), 1);
    }
    stroke(path([700, 402, 712, 440, 716, 500, 712, 600], 3), tone(0.3), bit(COUCH)); // the piping down the front of the arm
    stroke(path([-330, 452, 0, 452, 150, 452], 2), tone(0.24), bit(COUCH));        // the edge of the seat
    // His robe's creases, the light caught along his hair, the creases of the fist under his chin, his nose.
    for (const f of FOLDS) stroke(path(f, 3), tone(0.16), bit(CLOAK));
    for (const p of SHEEN) stroke(p, tone(0.2), bit(HAIR));
    for (const crease of FIST_CREASES) stroke(crease, LINE, bit(FLESH));
    stroke(NOSE, SKIN + 2, bit(FLESH));

    // The glow round the white pieces, as strengths 1 to HALOS in `into` for each cell.
    function glowAround(x, y, size, P, strength, into) {
      const my = y - P.top * size * 0.5, rx = (0.45 + 0.3 * strength) * size + 12, ry = (P.top * 0.55 + 0.25 * strength) * size + 12;
      const r0 = Math.max(0, Math.floor(toL(my - ry) / 2)), r1 = Math.min(rows - 1, Math.ceil(toL(my + ry) / 2));
      const c0 = Math.max(0, Math.floor(toC(x - rx))), c1 = Math.min(cols - 1, Math.ceil(toC(x + rx)));
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const q = ((atX(c + 0.5) - x) / rx) ** 2 + ((atY(r * 2 + 1) - my) / ry) ** 2;
        const level = Math.min(HALOS, Math.floor((1 - q) * HALOS * 0.999 + dither(c, r) - 0.5));
        if (level > into[r * cols + c]) into[r * cols + c] = level;
      }
    }
    const halo = new Uint8Array(cells), bright = new Uint8Array(cells);
    for (const [kind, i, j, white, glow] of STILL) if (white) { const [x, y, size] = seen(i, j); glowAround(x, y, size, KINDS[kind], glow, halo); }

    // The handover: each half cell lets go at its own moment, as a share of it: the bottom of the screen
    // first and the top last, ragged column by column, and his face, from the chin up, after everything.
    const release = new Float32Array(cells * 2);
    for (let l = 0; l < lines; l++) for (let c = 0; c < cols; c++) {
      const x = atX(c + 0.5), y = atY(l + 0.5);
      let at = 0.68 * (1 - l / lines) + 0.12 * (noise(c / 5 + 7, 3) - 0.5) + 0.06 * (hash(c, 17) - 0.5);
      if (within(FACE, x, y)) at = Math.max(at, 0.7 + 0.14 * clamp01((FACE.y1 - y) / (FACE.y1 - FACE.y0)));
      release[l * cols + c] = Math.max(0, Math.min(0.99 - TAIL * 1.4, at));
    }
    const trails = Float32Array.from({ length: cols }, (_, c) => (hash(c, 23) < 0.62 ? TAIL * (0.55 + 0.85 * hash(c, 29)) : 0)); // how long each column's stroke trails

    // Keep all that: render(t) starts each frame from it.
    const restPaint = paint.slice(), restOwner = owner.slice(), restGlyph = glyph.slice(), restInk = ink.slice(), restBold = bold.slice();
    const leafy = new Uint8Array(cells * 2); // which half cells a leaf covers, this frame

    // ----- What moves -----
    const queenAt = (s) => { // where the tall piece is: the middle of its foot, reference pixels to a camera height, and its file and rank
      const j = QUEEN[1] - smooth(T.push, T.stop, s);
      return [...seen(QUEEN[0], j), QUEEN[0], j];
    };
    const Q0 = queenAt(0), Q1 = queenAt(T.stop);
    const [KX, KY, KS] = seen(KING[0], KING[1]), FOOT = KINDS.king.body[0][1];
    // The king falls to our right, about the edge of its foot, and comes to lie on its foot and the rim of
    // its crown; it rocks once, and is still. Its turn, in radians, at story time s.
    const REST = Math.PI / 2 + Math.atan2(FOOT - 0.25, 1.25);
    function kingTurn(s) {
      if (s < T.tip) return 0;
      if (s < T.land) { const u = (s - T.tip) / (T.land - T.tip); return REST * (0.06 * u + 0.94 * u ** 3); }
      const u = (s - T.land) / (T.still - T.land);
      return REST - (u < 0.62 ? 0.16 * Math.sin((Math.PI * u) / 0.62) : u < 1 ? 0.03 * Math.sin((Math.PI * (u - 0.62)) / 0.38) : 0);
    }
    // The butterfly sits on the tall piece's crown, at his fingertip; its way out climbs from there past
    // his face and out of the top.
    const sitAt = (x, y, size) => [x + 0.1 * size, y - 1.42 * size];
    const PERCH = sitAt(Q1[0], Q1[1], Q1[2]);
    const FLIGHT = path([PERCH[0], PERCH[1], PERCH[0] + 40, PERCH[1] - 70, 506, 340, 512, 236, 486, 130, 446, 34, 414, -80, 400, -1400], 8);
    const flown = [0]; // the distance flown to each point of it
    for (let n = 2; n < FLIGHT.length; n += 2) flown.push(flown[flown.length - 1] + Math.hypot(FLIGHT[n] - FLIGHT[n - 2], FLIGHT[n + 1] - FLIGHT[n - 1]));
    const EXIT = (() => { let n = 0; while (FLIGHT[n * 2 + 1] > minY - 60 && n < flown.length - 1) n++; return flown[n]; })(); // how far it has flown when it is off the screen
    function flownTo(s) { // where the butterfly is at story time s, after it has taken off
      const u = clamp01((s - T.fly) / (T.out - T.fly)), along = EXIT * (0.55 * u * u + 0.45 * u);
      let n = 1;
      while (n < flown.length - 1 && flown[n] < along) n++;
      const f = clamp01((along - flown[n - 1]) / (flown[n] - flown[n - 1] || 1));
      return [lerp(FLIGHT[n * 2 - 2], FLIGHT[n * 2], f), lerp(FLIGHT[n * 2 - 1], FLIGHT[n * 2 + 1], f)];
    }

    // His eyes: `up`, from looking down at the board (0) to up after the butterfly (1), and `side`, to our
    // right or left (-1 to 1). Each is lids and the dark lashes along the upper one, around a dark iris
    // and the whites. The lash line is at least a half row thick, so that it never breaks up.
    const lash = Math.max(0.18, (1.1 * half) / k / EYE_H);
    function eyes(up, side) {
      for (const [ex, ey, out] of EYES) {
        const reach = EYE_W * 1.3;
        const l0 = Math.max(0, Math.floor(toL(ey - reach))), l1 = Math.min(lines - 1, Math.ceil(toL(ey + reach)));
        const c0 = Math.max(0, Math.floor(toC(ex - reach))), c1 = Math.min(cols - 1, Math.ceil(toC(ex + reach)));
        const iu = 0.25 * side, iv = lerp(-0.12, 0.2, up); // where the iris is
        for (let l = l0; l <= l1; l++) for (let c = c0; c <= c1; c++) {
          const i = l * cols + c;
          if (owner[i] !== FLESH) continue;
          const dx = atX(c + 0.5) - ex, dy = atY(l + 0.5) - ey, u = (dx * TC + dy * TS) / EYE_W, v = (dx * TS - dy * TC) / EYE_H;
          if (Math.abs(u) > 1.15) continue;
          const arch = Math.max(0, 1 - u * u), top = lerp(0.12, 0.4, up) * arch ** 0.6 + 0.07 * u * out, bottom = -0.16 * arch ** 0.8 + 0.03 * u * out;
          if (v > top && v < top + lash * (1 - 0.3 * u * u) && (Math.abs(u) < 1 || (u * out > 0 && v < top + lash * 0.7))) { paint[i] = tone(0.02); glyph[(l >> 1) * cols + c] = 32; continue; }
          if (Math.abs(u) >= 1 || v <= bottom || v > top) continue;
          const iris = Math.hypot((u - iu) * EYE_W, (v - iv) * EYE_H) / IRIS;
          paint[i] = iris < 1 ? tone(iris < 0.5 ? 0.01 : 0.07) : v > top - 0.07 ? SKIN + 4 : SKIN + 7;
          glyph[(l >> 1) * cols + c] = 32;
        }
      }
    }
    // His brows, raised a little as he looks up, and his mouth, a faint closed smile that widens.
    function brows(up) {
      for (const [ex, ey, out] of EYES) {
        const at = (u, v) => [ex + u * TC * EYE_W + v * TS * EYE_H, ey + u * TS * EYE_W - v * TC * EYE_H], lift = 0.66 + 0.14 * up;
        stroke([...at(-0.95 * out, lift - 0.04), ...at(0.1 * out, lift + 0.07), ...at(1 * out, lift + 0.02)], tone(0.1), bit(FLESH));
      }
    }
    function mouth(smile) {
      const w = (10 + 3 * smile) * HEAD, lift = (1.5 + 4.5 * smile) * HEAD;
      for (let n = -12; n <= 12; n++) {
        const u = (n / 12) * w, v = lift * (n / 12) ** 2, x = MOUTH[0] + u * TC + v * TS, y = MOUTH[1] + u * TS - v * TC;
        const c = Math.floor(toC(x)), l = Math.floor(toL(y));
        if (c < 0 || c >= cols || l < 0 || l + 1 >= lines || owner[l * cols + c] !== FLESH) continue;
        paint[l * cols + c] = LIPS;
        if (Math.abs(n) < 5 && owner[(l + 1) * cols + c] === FLESH) paint[(l + 1) * cols + c] = LIPS + 1;
      }
    }

    // The hand he reaches out with: its fingertip at (tx, ty), `g` times as large as at rest, `glow`
    // added to its light. Its ink lines are as wide as a half cell, so that they never break up.
    function hand(tx, ty, g, glow) {
      const l0 = Math.max(0, Math.floor(toL(ty + HAND_Y * g))), l1 = Math.min(lines - 1, Math.ceil(toL(ty + (HAND_Y + HAND_ROWS * HAND_STEP) * g)));
      const c0 = Math.max(0, Math.floor(toC(tx + HAND_X * g))), c1 = Math.min(cols - 1, Math.ceil(toC(tx + (HAND_X + HAND_COLS * HAND_STEP) * g)));
      const width = inkWidth / g;
      for (let l = l0; l <= l1; l++) {
        const j = Math.round(((atY(l + 0.5) - ty) / g - HAND_Y) / HAND_STEP);
        if (j < 0 || j >= HAND_ROWS) continue;
        for (let c = c0; c <= c1; c++) {
          const i = Math.round(((atX(c + 0.5) - tx) / g - HAND_X) / HAND_STEP);
          if (i < 0 || i >= HAND_COLS) continue;
          const v = HAND_MAP[j * HAND_COLS + i];
          if (v < 0) continue;
          const at = l * cols + c;
          if (v >= SLEEVE_DARK) { paint[at] = tone(v === SLEEVE_LIT ? 0.3 : 0.04); owner[at] = CLOAK; }
          else { paint[at] = HAND_INK[j * HAND_COLS + i] < width ? LINE : flesh(v + glow, dither(c, l)); owner[at] = PALM; }
          glyph[(l >> 1) * cols + c] = 32;
        }
      }
    }

    // The butterfly at (x, y), `size` times as large as it sits, its wings `open` (0 shut to 1 spread):
    // clear wings, tinted by what is behind them, with bright rims, a white body, and the light it gives.
    function butterfly(x, y, size, open) {
      const spread = 0.22 + 0.78 * open, reach = 34 * size, s = size;
      const l0 = Math.max(0, Math.floor(toL(y - reach))), l1 = Math.min(lines - 1, Math.ceil(toL(y + reach)));
      const c0 = Math.max(0, Math.floor(toC(x - reach))), c1 = Math.min(cols - 1, Math.ceil(toC(x + reach)));
      const gr0 = Math.max(0, Math.floor(toL(y - reach * 1.3) / 2)), gr1 = Math.min(rows - 1, Math.ceil(toL(y + reach * 1.3) / 2));
      const gc0 = Math.max(0, Math.floor(toC(x - reach * 1.3))), gc1 = Math.min(cols - 1, Math.ceil(toC(x + reach * 1.3)));
      for (let r = gr0; r <= gr1; r++) for (let c = gc0; c <= gc1; c++) {
        const q = Math.hypot(atX(c + 0.5) - x, atY(r * 2 + 1) - y) / (reach * 1.3), level = Math.floor((1 - q) * 3 + dither(c, r) - 0.5);
        if (level > 0) wash[r * cols + c] = GLOW + Math.min(2, level - 1);
      }
      for (let l = l0; l <= l1; l++) for (let c = c0; c <= c1; c++) {
        const u = Math.abs(atX(c + 0.5) - x) / s / spread, v = (y - atY(l + 0.5)) / s, i = l * cols + c;
        let hit = 0;
        for (const w of WING) if (within(w, u, v)) hit = rim(w, u, v) * s * spread < 2.4 ? 2 : 1;
        if (!hit) continue;
        paint[i] = hit === 2 ? RIM : WINGS + Math.min(3, Math.floor(LIGHT[paint[i]] * 4));
        owner[i] = PALM; glyph[(l >> 1) * cols + c] = 32;
      }
      const c = Math.floor(toC(x));
      for (let l = Math.floor(toL(y - 11 * s)); l <= toL(y + 9 * s); l++) if (l >= 0 && l < lines && c >= 0 && c < cols) paint[l * cols + c] = BODY;
    }

    // Leaves of bamboo, stirring; they hide the writing on the wall where they cover it.
    function drawLeaves(t) {
      leafy.fill(0);
      for (const f of shown) {
        const a = f.a + 0.05 * Math.sin(t * 2.1 + f.phase), ca = Math.cos(a), sa = Math.sin(a), colour = lerp(0.05, wallTone(f.x, f.y) * 0.78, f.back);
        const l0 = Math.max(0, Math.floor(toL(f.y - f.len))), l1 = Math.min(lines - 1, Math.ceil(toL(f.y + f.len)));
        const c0 = Math.max(0, Math.floor(toC(f.x - f.len))), c1 = Math.min(cols - 1, Math.ceil(toC(f.x + f.len)));
        for (let l = l0; l <= l1; l++) for (let c = c0; c <= c1; c++) {
          const i = l * cols + c;
          if (owner[i] !== WALL && owner[i] !== STALK) continue;
          const dx = atX(c + 0.5) - f.x, dy = atY(l + 0.5) - f.y, along = (dx * ca + dy * sa) / f.len, off = -dx * sa + dy * ca;
          if (along < 0 || along > 1 || Math.abs(off) > (f.w / 2) * Math.sin(Math.PI * along) ** 0.7) continue;
          paint[i] = tone(colour, dither(c, l)); leafy[i] = 1;
        }
      }
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (leafy[r * 2 * cols + c] && leafy[(r * 2 + 1) * cols + c]) glyph[r * cols + c] = 32;
    }
    // Strands of his hair, stirring.
    function drawStrands(t) {
      for (const [pts, amp] of STRANDS) {
        const moved = pts.slice();
        for (let n = 0; n < moved.length; n += 2) moved[n] += amp * 3 * Math.sin(t * 1.7 + amp * 4) * (n / moved.length) ** 1.5;
        stroke(moved, tone(0.1), bit(HAIR, FLESH, CLOTH, WALL, STALK));
      }
    }

    return {
      cols, rows, palette, glyph, ink, bold, paint, wash,
      render(t) { // t: seconds since the film started
        if (t >= LENGTH) { glyph.fill(32); ink.fill(0); bold.fill(0); paint.fill(0); wash.fill(0); return this; } // over: nothing is left on the page
        const s = t * SPEED; // where that is in the story
        paint.set(restPaint); owner.set(restOwner); glyph.set(restGlyph); ink.set(restInk); bold.set(restBold); wash.fill(0);

        // The glow of the white pieces swells and ebbs, slowly, and the tall one brightens as it comes forward.
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.6), forward = smooth(T.push, T.stop, s);
        for (let n = 0; n < HALOS; n++) {
          const a = 0.026 * (n + 1) * (0.82 + 0.3 * pulse);
          palette[HALO + n] = grey(255, a); palette[BRIGHT + n] = grey(255, Math.min(0.5, a * (1.2 + 0.6 * forward)));
        }
        SKIN_KEYS.forEach((v, n) => { palette[SKIN + n] = grey(v + (3 + 5 * forward) * pulse * (n / (SKINS - 1))); });

        drawLeaves(t);
        drawStrands(t);

        // The board under the light of the tall piece, which goes with it and brightens.
        const [qx, qy, qs, qi, qj] = queenAt(s), shine = 1.05 + 0.4 * forward;
        for (let n = 0; n < boardCells.length; n++) {
          const i = boardCells[n];
          if (owner[i] !== BOARD) continue;
          const f = boardInfo[n * 4 + 2] - qi, r = boardInfo[n * 4 + 3] - qj, near = f * f + r * r;
          if (near > 6 * SPREAD) continue;
          const light = Math.min(1.25, pooled(boardInfo[n * 4 + 2], boardInfo[n * 4 + 3]) + shine * Math.exp(-near / SPREAD));
          paint[i] = tone(boardInfo[n * 4] + boardInfo[n * 4 + 1] * light, dither(i % cols, (i / cols) | 0));
        }

        // His face: where he looks, and how he smiles.
        const [bx, by] = s > T.fly ? flownTo(s) : PERCH;
        const look = Math.atan2(by - EYES[1][1], bx - EYES[1][0]); // which way the butterfly is from his eye
        const up = s > T.out ? 1 : s > T.fly ? clamp01(0.5 - 0.6 * Math.sin(look)) * smooth(T.fly, T.fly + 0.6, s) : 0;
        eyes(up, s > T.fly && s < T.out ? 0.5 * Math.cos(look) : -0.15);
        brows(up);
        mouth(smooth(T.fly, T.out, s));

        // The tall piece and the hand on it, then the falling king.
        piece(KINDS.queen, 1, qx, qy, qs);
        const lift = smooth(T.stop, T.lifted, s) * 0.3 * qs; // about two centimetres
        hand(qx - 0.04 * qs, qy - 1.29 * qs - lift, qs / Q0[2], 0.5 * forward);
        piece(KINDS.king, 0, KX, KY, KS, kingTurn(s), KX + FOOT * KS, KY);

        // The butterfly: perched, its wings opening and shutting about once a second; then away, its trail fading.
        if (s < T.fly) butterfly(...sitAt(qx, qy, qs), (BUTTERFLY * qs) / Q1[2], 0.5 + 0.5 * Math.sin(t * Math.PI * 2));
        else if (s < T.out + 0.6) {
          for (let n = 16; n >= 1; n--) { // where it was over the last half second, faintest longest ago
            const back = s - n * 0.03;
            if (back < T.fly) continue;
            const [c, r] = cellAt(...flownTo(back)), level = Math.min(3, n >> 2);
            if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
            wash[r * cols + c] = TRAIL + level;
            if (n > 3 && n % 3 === 0) { glyph[r * cols + c] = n % 2 ? DOT : HIGH; ink[r * cols + c] = RIM; bold[r * cols + c] = 0; }
          }
          butterfly(bx, by, BUTTERFLY * lerp(1, 0.8, clamp01((s - T.fly) / 2)), 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 5.5));
        }

        // The glow about the white pieces, the tall one's brighter.
        bright.fill(0);
        glowAround(qx, qy, qs, KINDS.queen, 1 + 0.3 * forward, bright);
        for (let i = 0; i < cells; i++) {
          if (wash[i]) continue;
          if (bright[i] && bright[i] >= halo[i]) wash[i] = BRIGHT + bright[i] - 1;
          else if (halo[i]) wash[i] = HALO + halo[i] - 1;
        }

        // The handover: the drawing lets go from the bottom up, each column trailing a stroke of ink or wash
        // that thins to nothing as it is drawn up after the rest.
        if (s > T.hold) {
          const u = (s - T.hold) / (T.end - T.hold);
          for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            let gone = 0;
            for (let h = 0; h < 2; h++) {
              const i = (r * 2 + h) * cols + c, after = u - release[i];
              if (after <= 0) continue;
              gone++;
              if (after < trails[c]) {
                const level = Math.min(LIFTS - 1, Math.floor((after / trails[c]) * LIFTS));
                paint[i] = LIFT + level + (LIGHT[paint[i]] > 0.45 ? LIFTS : 0);
              } else paint[i] = 0;
            }
            if (!gone) continue;
            const at = r * cols + c;
            wash[at] = 0;
            if (gone === 2 && glyph[at] !== 32) glyph[at] = 32;
            const after = u - release[r * 2 * cols + c];
            if (gone === 2 && after < trails[c] * 0.6 && hash(c, r) < 0.14) { glyph[at] = [BAR, BANG, COLON][Math.floor(hash(r, c) * 3)]; ink[at] = LIFT + 1; bold[at] = 0; }
          }
        }
        return this;
      },
    };
  }

  // Held for a viewer who asks for less motion: the butterfly passing his face, its wings spread, the king
  // down, his eyes following it (story time 7.84 s).
  const film = { length: LENGTH, still: 3.5, grid: [110, 60], createScene };
  return { play: (options) => AsciiStage.play(film, options), createScene };
})();
