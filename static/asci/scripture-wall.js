/*
 * Wall of scripture: an ASCII loading screen.
 *
 *   <script src="ascii-stage.js"></script>
 *   <script src="scripture-wall.js"></script>
 *   <script>ScriptureWall.play().then(showThePage);</script>
 *
 * Painterly, in charcoal, warm grey and cream. A tall figure in long, dark,
 * heavy robes stands with its back to us, seen from the knees up, a dark shape
 * against the light, its hair tied in a topknot with a very long, thin
 * ponytail. Behind it a towering wall of scripture, dozens of columns of small
 * brush-written characters on pale paper, is lit by a shaft of white light from
 * the top centre. Ragged dark banners fly across on a wind from the left, the
 * nearest large and blurred; orange embers drift up; mist lies round the
 * figure's feet. The figure tilts its head back to look up, and the characters
 * begin to glow gold, column by column outward from the one above its head,
 * while the camera pulls slowly back. The wind strengthens and sweeps every
 * banner out to the right, then drops, and the ponytail settles down the
 * figure's back. Then the wind rises once more: a last wave of dark banners
 * blows in from the left over everything, and its ragged tail leaves the page
 * behind. Five seconds (LENGTH, below).
 *
 * The scene is laid out in units of the source image's height, about the
 * middle of its 16:9 frame, and every layer stands at its own distance, so that
 * as the camera pulls back the near banners shrink most, then the figure, then
 * the wall. Each written character has a fixed place on the wall and a fixed
 * pair of glyphs, set on the grid through the camera, so it never changes. The
 * whole animation is a pure function of time: createScene().render(t) fills a
 * grid of characters and the colours behind them, and the stage
 * (ascii-stage.js) paints that grid on a canvas.
 */
const ScriptureWall = (() => {
  'use strict';
  const { code, clamp01, lerp, smooth, mulberry32, hash, noise } = AsciiStage;

  // The story's timeline, in the seconds of the user's description.
  const T = {
    look: 2,     // the figure starts to tilt its head back
    up: 3.5,     // it is looking up; the centre column starts to glow, and the camera to pull back
    gust: 5,     // the wind strengthens, and no more banners come in
    gale: 6.5,   // the wind at its strongest
    lit: 7,      // every column the camera will show is glowing
    clear: 7.8,  // the last banner has gone out at the right
    drop: 8,     // the wind drops
    calm: 9,     // and the ponytail has settled down the figure's back
    wave: 9.85,  // the wind rises once more, and a last wave of banners blows in from the left
    end: 11.2,   // its torn tail has gone out at the right, leaving the page
  };
  // It is played faster than that: LENGTH seconds on screen, SPEED times the story's pace.
  const LENGTH = 5, SPEED = T.end / LENGTH;

  // The camera holds until T.up, then pulls straight back at an even pace, so
  // that at PULLED the figure is SHRINK of its first size. A layer DEPTH times
  // as far off as the figure shrinks to DEPTH / (DEPTH + pull) about the middle
  // of the frame: the near banners shrink most, the wall least.
  const PULLED = 10, SHRINK = 0.85, EASE = 0.04;
  const pull = (s) => {
    const k = Math.max(0, s - T.up) / (PULLED - T.up); // an even pace, after the briefest easing in
    return ((1 / SHRINK - 1) * (k < EASE ? (k * k) / (2 * EASE) : k - EASE / 2)) / (1 - EASE / 2);
  };
  const scale = (depth, s) => depth / (depth + pull(s));
  const WALL = 1.6;   // the wall's distance, in the figure's: it ends at 90% of its first size
  const NEED = 1.05;  // the width, in frame heights, a narrow screen keeps in view: the figure and its streaming hair
  const DRIFT = 0.14; // frame heights a second a steady wind carries a banner at the figure's distance
  const MIST = 0.012; // and the mist, as a share of that

  // The wind, as how fast it carries the banners: steady, then a gale, then
  // nearly still. `travel` is how far it has carried them by time s, in
  // seconds of steady wind, tabulated from long before the film begins.
  const GALE = 8;
  const wind = (s) => 1 + (GALE - 1) * smooth(T.gust, T.gale, s) - (GALE - 0.2) * smooth(T.drop, T.calm, s);
  const FROM = -60, STEP = 1 / 64;
  const CARRIED = new Float32Array(Math.ceil((T.end - FROM) / STEP) + 2);
  for (let i = 1; i < CARRIED.length; i++) CARRIED[i] = CARRIED[i - 1] + wind(FROM + (i - 0.5) * STEP) * STEP;
  const travel = (s) => {
    const k = Math.max(0, Math.min(CARRIED.length - 1.001, (s - FROM) / STEP)), i = k | 0;
    return FROM + lerp(CARRIED[i], CARRIED[i + 1], k - i);
  };
  // How hard the wind pulls the ponytail and the robe out to the right: 1 as in
  // the source image, more in the gale, nothing once it drops, and up again for the last gust.
  const tug = (s) => 1 + 0.7 * smooth(T.gust, T.gale, s) - 1.7 * smooth(T.drop, T.calm - 0.3, s) + 1.4 * smooth(T.wave, T.wave + 0.6, s);

  // Colours. `swatch` adds a run of colours to INK and gives the index of the first.
  const INK = ['#000000'];
  const swatch = (...colours) => INK.push(...colours) - colours.length;
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const along = (stops, x) => { // the colour at x on a ramp of [place, colour] stops
    let i = 1;
    while (i < stops.length - 1 && x > stops[i][0]) i++;
    const [a, from] = stops[i - 1], [b, to] = stops[i], k = clamp01((x - a) / (b - a)), A = rgb(from), B = rgb(to);
    return A.map((v, j) => v + (B[j] - v) * k);
  };
  // Charcoal through warm grey to the cream-white of the light, and gold at the
  // same lightness for the glow. Every colour but the embers is a mix of the two.
  const GREY = [[0, '#0c0b0a'],[0.15, '#1c1b1a'], [0.3, '#33302c'], [0.46, '#565049'], [0.62, '#817870'], [0.76, '#ada395'], [0.89, '#d8cebd'], [1, '#faf4e8']];
  const GILT = [[0, '#110d06'], [0.15, '#2a1f0b'], [0.3, '#4c3612'], [0.46, '#7a5a1c'], [0.62, '#a87d28'], [0.76, '#d0a13e'], [0.89, '#ecc66c'], [1, '#fff0c2']];
  const NL = 28, NC = 4; // steps of lightness, and steps from grey to gold
  const TONE = swatch(...Array.from({ length: NL * NC }, (_, i) => {
    const L = Math.floor(i / NC) / (NL - 1), k = (i % NC) / (NC - 1), g = along(GREY, L), y = along(GILT, L);
    return '#' + g.map((v, j) => Math.round(v + (y[j] - v) * k).toString(16).padStart(2, '0')).join('');
  }));
  const EMBER = swatch('#9a3d18', '#cc541c', '#ec7426', '#ff9a3e', '#ffc777'); // a spark, from dim to its hottest
  const tone = (L, C = 0) => TONE + Math.max(0, Math.min(NL - 1, Math.round(L * (NL - 1)))) * NC + Math.max(0, Math.min(NC - 1, Math.round(C * (NC - 1))));
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  const [BAR, SLASH, BACK, LOW, DASH, HIGH, TICK, COMMA, DOT, WAVE, STAR] = code("|/\\_-'`,.~*");
  // The written characters: two dense brush strokes side by side make one
  // square character. Pairs that would read as words, faces, arrows or code are left out.
  const SIGNS = '[= [+ [| {= {+ {| (+ |+ |] |} +] +} +| +) +[ +{ ]= ]+ ]| }= }+ }| )+ /+ /] /} \\+ \\] +/ +\\ [/ {\\ ]\\ }/ ;+ ;] ;} !+ !] !} [! {! ]! }! [; {;'
    .split(' ').map(code);

  // The figure, in frame heights: x across from the middle of the frame, y
  // down from its top. The back of the head (a full oval, the hair over it)
  // and the topknot (an ellipse) are [middle x, middle y, half width, half height], the neck [middle x, half
  // width, top, bottom]; the robe is its outline [y, left edge, right edge],
  // from the collar over the shoulders and down the wide sleeves to the hem.
  const HEAD = [0, 0.394, 0.029, 0.036], KNOT = [0.003, 0.347, 0.015, 0.014], NECK = [0.001, 0.017, 0.42, 0.46];
  const ROBE = [[0.446, -0.024, 0.028], [0.456, -0.048, 0.05], [0.466, -0.07, 0.068], [0.477, -0.088, 0.084], [0.49, -0.102, 0.096], [0.507, -0.112, 0.106],
    [0.55, -0.118, 0.116], [0.62, -0.124, 0.126], [0.7, -0.136, 0.144], [0.8, -0.148, 0.162], [0.9, -0.152, 0.178], [1.05, -0.152, 0.198], [1.3, -0.156, 0.216], [3, -0.164, 0.236]];
  const MIDDLE = -0.002; // the middle of its back
  const TAIL = 0.62, LINKS = 32, THICK = 0.012; // the ponytail's length, the links it is drawn in, and its width at the root
  const FOLDS = [[-0.004, 0.5, 0, 1.25, 0.24], [-0.078, 0.53, -0.094, 0.9, 0.26], [0.074, 0.53, 0.09, 0.9, 0.22]]; // [x, y, x, y, lightness]: down the back and beside the sleeves

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
    const H2 = rows * 2, N = cols * H2, CELLS = cols * rows;
    const glyph = new Uint8Array(CELLS), ink = new Uint8Array(CELLS), bold = new Uint8Array(CELLS), paint = new Uint8Array(N);

    // The frame of the source image is a 16:9 box one unit tall. It fills the
    // height of a wide screen and is cut at the sides of a narrower one, down to
    // NEED units across; on a narrower screen still (a phone) it is NEED units
    // across, with more wall above it and more mist below.
    const U = Math.min(rows * aspect, cols / NEED), Uh = (2 * U) / aspect; // columns, and half rows, to a unit
    const cx = cols / 2, cy = Math.max(0, H2 - Uh) * 0.6 + Uh / 2;         // the middle of the box, which the camera pulls back from
    const edge = cx / U, high = -cy / Uh, low = (H2 - cy) / Uh;             // the screen's sides, top and bottom, in units from there
    const atC = (x, sc) => cx + x * sc * U, atH = (y, sc) => cy + y * sc * Uh; // a point x or y units from the middle, at that scale, in columns or half rows

    // The wall, worked out once over all of it the camera will ever show: a
    // value for each cell and half row as they are at the start, X columns
    // across and Y half rows down from the middle. How light it is, and how
    // much of that light is the shaft from the top centre (which shimmers).
    const least = scale(WALL, T.end);
    const X0 = Math.floor(-cx / least) - 4, Y0 = Math.floor(-cy / least) - 4;
    const TW = Math.ceil(cx / least) + 6 - X0, TH = Math.ceil((H2 - cy) / least) + 6 - Y0;
    const SP = Math.max(4, Math.min(7, Math.round(U * 0.062))); // columns from one column of writing to the next
    const light = new Float32Array(TW * TH), beam = new Float32Array(TW * TH);
    for (let j = 0, p = 0; j < TH; j++) {
      const y = 0.5 + (Y0 + j) / Uh; // frame heights down from the top of the box
      for (let i = 0; i < TW; i++, p++) {
        const X = X0 + i, x = X / U, sheet = Math.round(X / SP); // each column is written on a sheet of its own
        const ray = Math.exp(-((x / (0.09 + 0.13 * clamp01(y + 0.1))) ** 2)) * (1 - 0.6 * smooth(-0.1, 0.95, y)); // the shaft, widening and fading as it comes down
        let L = 0.27 + 0.53 * Math.exp(-((x / 0.7) ** 2)) + 0.16 * ray;
        L -= 0.14 * smooth(0.45, 1.15, y) * (1 - Math.exp(-((x / 0.5) ** 2))) + 0.07 * smooth(1, 1.8, Math.abs(x)); // shadow in the lower corners and far to the sides
        L += 0.03 * (hash(sheet, seed + 3) - 0.5) + 0.03 * (noise(x * 22 + 5, y * 3) - 0.5); // sheet by sheet the paper differs, and it has a grain
        if (SP * (0.5 - Math.abs(X / SP - sheet)) < 0.8 && hash(sheet, seed + 5) < 0.35) L -= 0.04; // a seam between two sheets
        light[p] = L; beam[p] = ray;
      }
    }
    // The writing. Column k stands at X = k * SP; down it, a character every
    // 2.5 rows, so that even with the camera at its farthest a blank row stays
    // between them, in passages with a gap of a character or three between.
    const signs = [];
    for (let k = Math.ceil((X0 + 2) / SP); k * SP < X0 + TW - 3; k++) {
      for (let Y = Y0 + R(0, 5), left = 4 + ((rand() * 18) | 0); Y < Y0 + TH - 2; Y += 5) {
        if (left-- > 0) signs.push({ k, X: k * SP, Y, pair: SIGNS[(rand() * SIGNS.length) | 0], wet: R(-0.04, 0.04) });
        else if (rand() < 0.45) left = 6 + ((rand() * 18) | 0);
      }
    }
    // The glow: column k starts at T.up + |k| * PER and takes FADE to come up,
    // so that the farthest columns the camera will ever show are lit by T.lit.
    const reach = Math.max(1, Math.floor((cx + 1) / (SP * least)));
    const FADE = 0.45, PER = (T.lit - FADE - T.up) / reach;
    const glow = (k, s) => smooth(0, FADE, s - T.up - Math.abs(k) * PER);

    // The banners: long ragged strips of dark cloth, each at its own distance
    // (the near ones in front of the figure, along the top and bottom, large
    // and blurred; the rest behind it) and carried at the wind's pace over that
    // distance. They come in from the left at random until T.gust, and none
    // after; one that comes in late goes fast enough to be out at the right by
    // T.clear. Measures are as they look at the start, in frame heights.
    const banners = [];
    for (const near of [false, true]) {
      const gap = near ? 3.4 : 2.6 / (low - high); // seconds between one coming in and the next
      for (let s0 = FROM + R(0, gap); s0 < T.gust; s0 += gap * R(0.4, 1.6)) {
        const D = near ? R(0.42, 0.78) : R(1.08, 1.5), len = near ? R(0.9, 1.5) : R(0.36, 0.7) / D;
        const enter = -edge / scale(D, s0), leave = edge / scale(D, T.clear) + len + 0.02;
        const v = Math.max(DRIFT / D, (leave - enter) / (travel(T.clear) - travel(s0)));
        const x0 = enter - v * travel(s0); // its leading end is at x0 + v * travel(s)
        if (x0 + v * travel(0) - len > edge) continue; // gone before the film begins
        const th = near ? R(0.05, 0.085) : R(0.02, 0.036) / D; // half its width
        banners.push({
          near, D, len, th, v, x0,
          y: near ? (rand() < 0.5 ? lerp(high - 0.04, high + 0.18, rand()) : lerp(low - 0.18, low + 0.04, rand())) : lerp(high + 0.04, low - 0.06, rand()),
          slope: near ? R(-0.3, 0.3) : R(-0.12, 0.25), bend: R(-0.3, 0.3), amp: th * R(0.2, 0.5), wave: len * R(0.5, 1), crawl: R(0.04, 0.1), ph: R(0, 6.28),
          twist: len * R(0.5, 1.1), turn: R(0, 6.28), cut: th * R(1, 3) * (rand() < 0.5 ? 1 : -1), tear: R(0.2, 0.4), tongues: 2 + ((rand() * 2) | 0),
          rag: 1 / (th * R(1.5, 3)), L: near ? R(0.035, 0.075) : 0.11 + 0.4 * (D - 1.08) + R(-0.02, 0.02), blur: near ? 0.008 + 0.025 * (0.8 - D) : 0, id: banners.length + 1,
        });
      }
    }
    banners.sort((a, b) => b.D - a.D); // the farthest first

    // Embers: sparks that rise from low in the frame, more on the right, drift
    // with the wind and flicker; each comes back somewhere new when it dies.
    const sparks = [];
    for (let n = Math.round(32 * 2 * edge * (low - high)); n > 0; n--) {
      sparks.push({ id: n, at: R(0, 40), life: R(2.4, 4), rise: R(0.07, 0.14), drift: R(0.012, 0.03), sway: R(0.003, 0.012), freq: R(1.5, 3.2), ph: R(0, 6.28), flick: R(5, 9), heat: R(0.55, 1) });
    }
    // The mist's texture, on the screen, wide enough to slide right with the wind for the whole film.
    const shiftMax = Math.ceil(MIST * travel(T.end) * U) + 2, MW = cols + shiftMax, o = R(0, 99);
    const mist = new Float32Array(MW * H2);
    for (let h = 0; h < H2; h++) for (let i = 0; i < MW; i++) {
      const x = (i - shiftMax) / U, y = h / Uh;
      mist[h * MW + i] = 0.6 * noise(o + x * 6, y * 9) + 0.4 * noise(o + x * 15, 3 + y * 21);
    }
    // The last wave: strips of dark cloth one above another, filling the
    // height, each with a pointed, ragged leading end and a torn tail.
    const strips = [];
    for (let j = 0, n = Math.max(4, Math.round(H2 / 14)); j < n; j++) strips.push({
      edge: j === n - 1 ? 1e9 : ((j + 1 + R(-0.2, 0.2)) / n) * H2, lag: R(0, 0.26), len: R(0.7, 0.95), tip: R(0.08, 0.2), point: R(-0.6, 0.6),
      fray: R(0.04, 0.12), L: R(0.045, 0.11), amp: R(0.6, 2), k: R(0.07, 0.15), ph: R(0, 6.28),
    });
    const TRIP = 1.06 + Math.max(...strips.map((st) => st.lag + st.len + st.fray)); // screen widths the wave travels

    // Each frame: every half cell's lightness, how gold it is and how much of
    // the shaft's light falls on it; what part of the figure is there; the wave's
    // cloth, and where the page shows. Every glyph's lightness and gold, an
    // ember's own colour, and who owns it.
    const lum = new Float32Array(N), gold = new Float32Array(N), glare = new Float32Array(N);
    const part = new Uint8Array(N), cloth = new Uint8Array(N), gone = new Uint8Array(N), fire = new Uint8Array(N); // fire: an ember's own colour in a half cell
    const inkL = new Float32Array(CELLS), inkC = new Float32Array(CELLS), inkE = new Uint8Array(CELLS), own = new Uint8Array(CELLS);
    const WRIT = 1, BACKS = 2, FIGURE = 3, SPARK = 4, FRONT = 5; // owners, back to front: the writing, banners behind the figure, the figure, embers, near banners
    const ROBED = 1, HEADED = 2, KNOTTED = 3; // parts of the figure
    const thr = new Float32Array(N); // a fixed dither threshold for each half cell, mostly random so no pattern shows in the smooth wall
    for (let h = 0, p = 0; h < H2; h++) for (let c = 0; c < cols; c++, p++) thr[p] = ((BAYER[(h & 3) * 4 + (c & 3)] + 0.5) / 16 + 0.7 * hash(c, h + 7)) % 1;
    const ti = new Int32Array(cols), tf = new Float32Array(cols), rays = new Float32Array(cols), mx = new Float32Array(cols);
    const tj = new Int32Array(H2), tg = new Float32Array(H2), my = new Float32Array(H2), mz = new Float32Array(H2), hit = new Float32Array(H2);
    const bound = new Float32Array(strips.length), pts = new Float32Array((LINKS + 1) * 2);
    const set = (c, r, ch, L, layer, heavy = 0) => {
      if (c < 0 || c >= cols || r < 0 || r >= rows) return;
      const i = r * cols + c;
      glyph[i] = ch; inkL[i] = L; inkC[i] = 0; inkE[i] = 0; own[i] = layer; bold[i] = heavy;
    };

    function drawWall(s) {
      const sc = scale(WALL, s);
      for (let c = 0; c < cols; c++) {
        const X = (c + 0.5 - cx) / sc, x = X / U;
        ti[c] = Math.floor(X - X0); tf[c] = X - X0 - ti[c];
        rays[c] = 0.07 * (noise(x * 16 + 3, s * 0.5) - 0.5) + 0.04 * (noise(x * 41 + 9, s * 0.9 + 5) - 0.5); // the shaft shimmers: faint rays brighten and fade
      }
      for (let h = 0; h < H2; h++) { const Y = (h + 0.5 - cy) / sc - Y0; tj[h] = Math.floor(Y); tg[h] = Y - tj[h]; }
      for (let h = 0, p = 0; h < H2; h++) {
        const a0 = tj[h] * TW, v = tg[h];
        for (let c = 0; c < cols; c++, p++) {
          const a = a0 + ti[c], b = a + TW, u = tf[c];
          const L = lerp(light[a] + (light[a + 1] - light[a]) * u, light[b] + (light[b + 1] - light[b]) * u, v);
          const g = lerp(beam[a] + (beam[a + 1] - beam[a]) * u, beam[b] + (beam[b + 1] - beam[b]) * u, v);
          lum[p] = L + rays[c] * g; gold[p] = 0; glare[p] = g;
        }
      }
      for (const w of signs) { // the characters: dark ink, then gold, with a faint warmth round it, once their column lights
        const c0 = Math.round(cx + w.X * sc - 1), r = Math.floor((cy + w.Y * sc) / 2);
        if (r < 0 || r >= rows || c0 < -1 || c0 >= cols) continue;
        const g = glow(w.k, s);
        for (let j = 0; j < 2; j++) {
          const c = c0 + j;
          if (c < 0 || c >= cols) continue;
          const i = r * cols + c, p = r * 2 * cols + c, wall = lum[p + cols];
          const dark = lerp(wall * 0.2, wall, 0.42 * smooth(0.62, 0.97, wall)) + w.wet, gilt = lerp(0.9, 0.62, smooth(0.5, 0.95, wall));
          glyph[i] = w.pair[j]; inkL[i] = lerp(dark, gilt, g) + 0.4 * g * (1 - g); inkC[i] = g; own[i] = WRIT; bold[i] = 1;
          if (g > 0) { lum[p] += 0.03 * g; lum[p + cols] += 0.03 * g; gold[p] = gold[p + cols] = 0.3 * g; }
        }
      }
    }

    function drawBanner(b, s) {
      const sc = scale(b.D, s), lead = b.x0 + b.v * travel(s), soft = b.blur * sc; // where its leading end is, and its blur, in frame heights
      if ((lead - b.len) * sc > edge + 0.05 || lead * sc < -edge - 0.05) return;
      const layer = b.near ? FRONT : BACKS, spread = Math.max(0.5, soft * Uh);
      const cA = Math.max(0, Math.floor(atC(lead - b.len, sc) - spread * 3)), cB = Math.min(cols - 1, Math.ceil(atC(lead, sc) + spread * 3));
      for (let c = cA; c <= cB; c++) {
        const u = lead - (c + 0.5 - cx) / U / sc, f = u / b.len; // how far behind its leading end this column is
        const ends = soft ? clamp01((Math.min(u, b.len - u) * sc) / (3 * soft) + 0.5) : f >= 0 && f <= 1 ? 1 : 0;
        if (ends <= 0) continue;
        const ph = ((u - b.crawl * s) / b.wave) * 6.283 + b.ph, ff = clamp01(f); // ripples run back along it
        const mid = b.y + b.slope * (b.len / 2 - u) + (b.bend * (u - b.len / 2) ** 2) / b.len + b.amp * Math.sin(ph);
        const turn = Math.cos(((u - b.crawl * s * 0.6) / b.twist) * Math.PI + b.turn); // twisting in the wind, it narrows to show its edge and turns its other face
        const half = b.th * (0.5 + 0.5 * Math.abs(turn)), rough = 0.12 + 0.3 * smooth(0.5, 1, ff); // the more ragged toward its torn end
        let top = mid - half * (1 + rough * (noise(u * b.rag + b.id * 7.3, 1.5) - 0.5) * 2);
        let bottom = mid + half * (1 + rough * (noise(u * b.rag + b.id * 7.3, 6.5) - 0.5) * 2);
        if (u < Math.abs(b.cut)) { if (b.cut > 0) bottom = lerp(top, bottom, u / b.cut); else top = lerp(bottom, top, -u / b.cut); } // its leading end is cut on a slant
        const yT = atH(top, sc), yB = atH(bottom, sc), shade = b.L + (turn < 0 ? 0.04 : 0) + 0.03 * Math.cos(ph);
        const torn = smooth(1 - b.tear, 1 - b.tear * 0.7, ff); // how far its trailing end has split
        const hA = Math.max(0, Math.floor(yT - spread * 1.5)), hB = Math.min(H2 - 1, Math.ceil(yB + spread * 1.5));
        let first = -1, last = -1;
        for (let h = hA; h <= hB; h++) {
          const y = h + 0.5;
          let a = soft ? clamp01(Math.min(y - yT, yB - y) / spread + 0.5) * ends : y >= yT && y <= yB ? 1 : 0;
          if (a > 0 && torn > 0) { // the trailing end: tongues of different lengths, each narrowing to a point
            const q = ((y - yT) / Math.max(0.5, yB - yT)) * b.tongues, j = Math.min(b.tongues - 1, Math.floor(q)), tip = 1 - b.tear * 0.85 * hash(j, b.id + 300);
            const d = 0.5 * (1 - smooth(tip - b.tear * 0.45, tip, ff)) - 0.08 * torn - Math.abs(q - j - 0.5); // how far inside this tongue, in tongue widths
            a *= soft ? clamp01((d * (yB - yT)) / b.tongues / spread + 0.5) : d > 0 ? 1 : 0;
          }
          hit[h] = a;
          if (a <= 0) continue;
          if (first < 0) first = h;
          last = h;
          const p = h * cols + c;
          const L = b.near ? shade : lerp(shade + (y - yT < 1 ? 0.08 : 0), lum[p], 0.6 * (b.D - 1.08) * (0.4 + glare[p])); // the farther ones are paler in the light
          lum[p] = lerp(lum[p], L, a); gold[p] *= 1 - a;
          if (a > 0.5) fire[p] = 0;
        }
        if (first < 0) continue;
        for (let r = first >> 1; r <= last >> 1; r++) { // what it does to the glyph behind it
          const i = r * cols + c, k = Math.max(r * 2 >= hA ? hit[r * 2] : 0, r * 2 + 1 <= hB ? hit[r * 2 + 1] : 0);
          if (!own[i] || own[i] >= layer || k <= 0) continue;
          if (k > 0.5) { glyph[i] = 32; own[i] = 0; } else { inkL[i] = lerp(inkL[i], b.L, k); inkC[i] *= 1 - k; }
        }
        if (b.near) { // streaks inside it: the blur of its speed
          for (let r = (first >> 1) + 1; r < last >> 1; r++) if (hash(Math.floor(u * U * 0.25), r * 31 + b.id) < 0.07) set(c, r, hash(r, b.id) < 0.5 ? DASH : WAVE, shade + 0.08, layer);
        }
      }
    }

    function drawFigure(s) {
      const sc = scale(1, s), tilt = smooth(T.look, T.up, s), P = tug(s), Y = (y) => atH(y - 0.5, sc);
      // Tilting back to look up, the head sinks into the collar, hiding the
      // neck, and the topknot tips back toward us, down over the crown, so that
      // it no longer stands up above the head.
      const hy = HEAD[1] + 0.018 * tilt, ky = lerp(KNOT[1], hy - 0.024, tilt), kw = KNOT[2] + 0.002 * tilt, kh = KNOT[3] + 0.003 * tilt;
      const cA = Math.max(0, Math.floor(atC(-0.22, sc))), cB = Math.min(cols - 1, Math.ceil(atC(0.5, sc)));
      const hA = Math.max(0, Math.floor(Y(ky - kh)) - 1), hB = Math.min(H2 - 1, Math.ceil(Y(ROBE[ROBE.length - 1][0])));
      for (let h = hA; h <= hB; h++) {
        const y = 0.5 + (h + 0.5 - cy) / Uh / sc; // frame heights down from the top of the frame
        let xl = 1, xr = -1;
        if (y >= ROBE[0][0] && y <= ROBE[ROBE.length - 1][0]) {
          let j = 1;
          while (y > ROBE[j][0]) j++;
          const [ya, la, ra] = ROBE[j - 1], [yb, lb, rb] = ROBE[j], k = (y - ya) / (yb - ya);
          xl = lerp(la, lb, k) + 0.006 * P * smooth(0.6, 0.95, y) * Math.sin(y * 38 - s * 4.2); // the robe ripples on the windward side
          xr = lerp(ra, rb, k) + P * smooth(0.55, 0.95, y) * (0.012 + 0.01 * Math.sin(y * 31 - s * 5.1)) // and streams out on the other,
            + P * 0.16 * smooth(0.84, 1.1, y) * (0.75 + 0.25 * Math.sin(s * 3.7 + y * 20)) * (0.7 + 0.3 * noise(y * 60, s * 2)); // its hem most of all
        }
        for (let c = cA; c <= cB; c++) {
          const x = (c + 0.5 - cx) / U / sc;
          part[h * cols + c] = x >= xl && x <= xr ? ROBED
            : ((x - KNOT[0]) / kw) ** 2 + ((y - ky) / kh) ** 2 <= 1 ? KNOTTED
              : Math.abs((x - HEAD[0]) / HEAD[2]) ** 3 + Math.abs((y - hy) / HEAD[3]) ** 3 <= 1 || (Math.abs(x - NECK[0]) <= NECK[1] && y >= NECK[2] && y <= NECK[3]) ? HEADED : 0;
        }
      }
      for (let h = hA; h <= hB; h++) for (let c = cA; c <= cB; c++) { // dark against the light, lit along its top and edges
        const p = h * cols + c, what = part[p];
        if (!what) continue;
        const x = (c + 0.5 - cx) / U / sc, y = 0.5 + (h + 0.5 - cy) / Uh / sc;
        const above = h > 0 ? part[p - cols] : 0, above2 = h > 1 ? part[p - 2 * cols] : 0, inside = c > 0 && c < cols - 1 && part[p - 1] && part[p + 1];
        let L;
        if (what === ROBED) {
          if (y < 0.53 && (!above || !above2)) L = (x < MIDDLE ? 0.56 : 0.46) - (above ? 0.24 : 0); // the tops of the shoulders catch the light, the left more
          else if (!inside && y < 0.95) L = x < MIDDLE ? 0.36 : 0.28;                          // and so does its outline
          else { // the sleeves lighter than the back, the left more, with a crease between; the skirt lit from the mist below
            const d = Math.abs(x - MIDDLE), arm = smooth(0.074, 0.09, d) * (1 - smooth(0.8, 0.95, y));
            L = 0.085 + (x < MIDDLE ? 0.1 : 0.06) * arm - 0.045 * Math.exp(-(((d - 0.072) / 0.007) ** 2)) * (1 - smooth(0.8, 0.9, y)) + 0.07 * smooth(0.72, 1.05, y);
          }
        } else if (what === HEADED) L = !above ? 0.3 + 0.3 * tilt : !inside ? 0.2 : 0.06; // the face turned up to the light lights the top of the head
        else L = !above ? 0.45 : part[p - cols] !== KNOTTED || part[p - 1] !== KNOTTED || part[p + 1] !== KNOTTED ? 0.1 + 0.22 * tilt : 0.08; // the topknot: its top in the light, its edge against the head once it has tipped back over it
        lum[p] = L; gold[p] = 0;
        const i = (h >> 1) * cols + c;
        if (own[i] && own[i] < FIGURE) { glyph[i] = 32; own[i] = 0; }
      }
      for (const [x0, y0, x1, y1, L] of FOLDS) { // folds in the robe
        line(atC(x0, sc), Y(y0) / 2, atC(x1, sc), Y(y1) / 2, (c, r, ch) => {
          if (c < 0 || c >= cols || r < 0 || r >= rows || part[r * 2 * cols + c] !== ROBED || part[(r * 2 + 1) * cols + c] !== ROBED) return;
          set(c, r, ch, L, FIGURE);
        });
      }
      // The hair, drawn in strokes: near-black against the light, with a sheen where it lies on the robe.
      const hair = (heavy) => (c, r, ch) => {
        if (c < 0 || c >= cols || r < 0 || r >= rows) return;
        set(c, r, ch, part[r * 2 * cols + c] || part[(r * 2 + 1) * cols + c] ? 0.27 : 0.04, FIGURE, heavy);
      };
      for (let j = 0; j < 2; j++) { // the two ends of the band round the topknot
        const x = KNOT[0] + kw * 0.7, y = ky + kh * 0.3, l = 0.045 - 0.012 * j;
        const a = lerp(1.3, 0.05 + 0.25 * j, Math.min(P, 1)) + 0.3 * Math.min(P, 1) * Math.sin(s * 6.5 + j * 2);
        line(atC(x, sc), Y(y) / 2, atC(x + Math.cos(a) * l, sc), Y(y + Math.sin(a) * l) / 2, hair(0));
      }
      // The ponytail, from under the topknot: down the back and then out on the
      // wind as in the source image (P = 1), lifted further in the gale, and
      // hanging straight down the back once the wind has dropped, after a swing.
      const since = Math.max(0, s - T.drop), swing = 0.3 * Math.exp(-since * 1.6) * Math.sin(since * 5.5) * smooth(0, 0.4, since);
      const angle = (q, extra) => {
        const shape = 1.55 - 0.42 * smooth(0.12, 0.22, q) - 0.5 * smooth(0.55, 0.75, q) - 0.25 * smooth(0.8, 0.95, q); // its line in the source image, q of the way along: down the head, steeply across the back, then out
        return Math.max(-0.3, Math.PI / 2 - (Math.PI / 2 - shape) * Math.min(P, 1) - Math.max(0, P - 1) * 0.5 * smooth(0.1, 0.6, q)
          + Math.min(P, 1.2) * (0.17 * q * Math.sin(q * 11 - s * 2.4) + extra) + swing * q);
      };
      const link = TAIL / LINKS, split = Math.round(LINKS * 0.78), wide = THICK * sc * U >= 0.6;
      pts[0] = KNOT[0] + 0.004; pts[1] = ky + kh * 0.6;
      for (let n = 1; n <= split; n++) {
        const a = angle((n - 0.5) / LINKS, 0);
        pts[n * 2] = pts[n * 2 - 2] + Math.cos(a) * link; pts[n * 2 + 1] = pts[n * 2 - 1] + Math.sin(a) * link;
      }
      for (let n = 0; n < split; n++) {
        const xa = pts[n * 2], ya = pts[n * 2 + 1], xb = pts[n * 2 + 2], yb = pts[n * 2 + 3];
        if (wide) for (let k = 0; k < 4; k++) { // its body: a dark rope, where it is half a cell or more wide
          const c = Math.floor(atC(lerp(xa, xb, k / 4), sc)), h = Math.floor(Y(lerp(ya, yb, k / 4)));
          if (c < 0 || c >= cols || h < 0 || h >= H2) continue;
          lum[h * cols + c] = 0.03; gold[h * cols + c] = 0;
          const i = (h >> 1) * cols + c;
          if (own[i] && own[i] < FIGURE) { glyph[i] = 32; own[i] = 0; }
        }
        line(atC(xa, sc), Y(ya) / 2, atC(xb, sc), Y(yb) / 2, hair(1));
      }
      for (let w = 0; w < 4; w++) { // its end frays into wisps that spread apart
        let x = pts[split * 2], y = pts[split * 2 + 1];
        const spread = (w - 1.5) * 0.09, end = LINKS * (0.98 + 0.07 * hash(w, seed + 41));
        for (let n = split; n < end; n++) {
          const a = angle((n + 0.5) / LINKS, spread * smooth(split, LINKS, n)), nx = x + Math.cos(a) * link, ny = y + Math.sin(a) * link;
          line(atC(x, sc), Y(y) / 2, atC(nx, sc), Y(ny) / 2, hair(0));
          x = nx; y = ny;
        }
      }
    }

    // Mist round the figure's feet and across the lower middle, and on a tall
    // screen thickening below the frame. Its texture slides right with the wind.
    function drawHaze(s) {
      const sc = scale(1, s), shift = MIST * travel(s) * U, si = Math.floor(shift), sf = shift - si;
      for (let c = 0; c < cols; c++) mx[c] = Math.exp(-((((c + 0.5 - cx) / U / sc) / 0.5) ** 2));
      for (let h = 0; h < H2; h++) { const y = 0.5 + (h + 0.5 - cy) / Uh / sc; my[h] = 1.15 * smooth(0.55, 1, y); mz[h] = 1.4 * smooth(0.95, 1.4, y); }
      for (let h = 0, p = 0; h < H2; h++) {
        if (my[h] <= 0 && mz[h] <= 0) { p += cols; continue; }
        const row = h * MW + shiftMax - si;
        for (let c = 0; c < cols; c++, p++) {
          let a = Math.min(1, my[h] * mx[c] + mz[h]);
          if (a <= 0.01) continue;
          const j = row + c, tex = mist[j] + (mist[j - 1] - mist[j]) * sf;
          a = Math.min(1, a * (0.5 + 0.5 * smooth(0.2, 0.8, tex))) * (part[p] ? 0.55 + 0.32 * mz[h] : 1); // the figure stands in it, so less of it is in front, until it thickens below the frame
          lum[p] = lerp(lum[p], 0.88, a); gold[p] *= 1 - a;
          if (h & 1) { // the glyph in this cell fades into the mist with it
            const i = (h >> 1) * cols + c;
            if (glyph[i] > 32) { if (a > 0.7) { glyph[i] = 32; own[i] = 0; } else { inkL[i] = lerp(inkL[i], 0.88, a * 0.8); inkC[i] *= 1 - a; } }
          }
        }
      }
    }

    function drawEmbers(s) {
      const sc = scale(1, s), carried = travel(s);
      for (const e of sparks) {
        const t = s + e.at, n = Math.floor(t / e.life), age = t - n * e.life, k = age / e.life;
        const heat = smooth(0, 0.12, k) * (1 - smooth(0.6, 1, k)) * e.heat * (0.62 + 0.38 * Math.sin(t * e.flick + e.ph));
        if (heat < 0.18) continue;
        const x = lerp(-edge - 0.1, edge, hash(n, e.id * 7 + 1) ** 0.55) + e.drift * (carried - travel(s - age)) + e.sway * Math.sin(age * e.freq + e.ph);
        const y = lerp(-0.05, low + 0.08, hash(n, e.id * 7 + 2) ** 0.6) - e.rise * age;
        const c = Math.floor(atC(x, sc)), hh = atH(y, sc), r = Math.floor(hh / 2);
        if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
        const i = r * cols + c, colour = EMBER + Math.min(4, Math.floor(heat * 5));
        if (heat > 0.5) fire[Math.floor(hh) * cols + c] = colour - 1; // a hot one is a speck of colour, with a spark on it
        glyph[i] = heat > 0.85 ? STAR : hh - r * 2 < 1 ? HIGH : DOT; inkE[i] = heat > 0.5 ? EMBER + 4 : colour; own[i] = SPARK; bold[i] = 0;
      }
    }

    // The ending: the wave comes in from the left. Ahead of it the scene goes
    // on; behind its torn tail nothing is left, and the page shows.
    function drawWave(s) {
      const k = clamp01((s - T.wave) / (T.end - T.wave)), go = TRIP * k * (0.7 + 0.3 * k); // how far it has come, in screen widths
      cloth.fill(0);
      for (let c = 0; c < cols; c++) {
        const x = (c + 0.5) / cols;
        for (let j = 0; j < strips.length; j++) bound[j] = strips[j].edge + strips[j].amp * Math.sin(c * strips[j].k + strips[j].ph - go * 12);
        for (let h = 0, j = 0, upper = 0; h < H2; h++) {
          while (h + 0.5 > bound[j]) upper = bound[j++];
          const st = strips[j], v = ((h + 0.5 - upper) / Math.max(1, Math.min(H2, bound[j]) - upper)) * 2 - 1; // -1 at the strip's top edge, 1 at its bottom
          if (x >= go - st.lag - st.tip * (Math.abs(v - st.point) / 1.6) ** 1.3 - 0.015 * hash(h, j + 40)) continue; // not here yet: a torn point leads it
          const p = h * cols + c;
          fire[p] = 0;
          if (x < go - st.lag - st.len + st.fray * hash(Math.floor((v + 1) * 2.5), j + 70)) { gone[p] = 1; continue; } // its torn tail has passed
          lum[p] = st.L + 0.035 * Math.cos((x - go) * cols * 0.2 + h * 0.06 + st.ph) + (v < -0.75 ? 0.07 : 0); gold[p] = 0; cloth[p] = 1;
        }
      }
      for (let r = 0, i = 0; r < rows; r++) for (let c = 0; c < cols; c++, i++) {
        const a = r * 2 * cols + c, b = a + cols;
        if (!(cloth[a] | cloth[b] | gone[a] | gone[b])) continue;
        glyph[i] = 32; own[i] = 0;
        if (cloth[a] && cloth[b] && hash(Math.floor((c - go * cols) / 2), r * 13) < 0.08) set(c, r, hash(r, c) < 0.5 ? DASH : WAVE, lum[b] + 0.12, FRONT);
      }
    }

    return {
      cols, rows, palette: INK, glyph, ink, bold, paint,
      render(t) { // t: seconds since the animation started
        glyph.fill(32); ink.fill(0); bold.fill(0); paint.fill(0); own.fill(0); inkE.fill(0); part.fill(0); gone.fill(0); fire.fill(0);
        if (t >= LENGTH) return this; // over: nothing is left on the page
        const s = t * SPEED; // where that is in the story
        drawWall(s);
        for (const b of banners) if (!b.near) drawBanner(b, s);
        drawFigure(s);
        drawHaze(s);
        drawEmbers(s);
        for (const b of banners) if (b.near) drawBanner(b, s);
        if (s > T.wave) drawWave(s);
        for (let p = 0; p < N; p++) { // into the palette, dithered
          if (gone[p]) continue;
          if (fire[p]) { paint[p] = fire[p]; continue; }
          const l = Math.floor(lum[p] * (NL - 1) + thr[p]), g = gold[p] > 0 ? Math.floor(gold[p] * (NC - 1) + ((thr[p] + 0.5) % 1)) : 0;
          paint[p] = TONE + (l < 0 ? 0 : l > NL - 1 ? NL - 1 : l) * NC + (g > NC - 1 ? NC - 1 : g);
        }
        for (let i = 0; i < CELLS; i++) if (glyph[i] > 32) ink[i] = inkE[i] || tone(inkL[i], inkC[i]);
        return this;
      },
    };
  }

  // Play it on the stage. Resolves when it has finished. `seed` changes the
  // details, not the layout: the writing, the banners, the embers and the mist.
  // `freezeAt` holds one moment (in seconds) on screen. Reduced motion holds
  // the opening: the figure before the wall, banners flying.
  const film = { length: LENGTH, still: 1.4 / SPEED, createScene };
  return { play: (options) => AsciiStage.play(film, options), createScene };
})();
