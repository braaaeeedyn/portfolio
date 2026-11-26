/*
 * Slash through the storm: an ASCII loading screen for the stage.
 *
 *   <script src="ascii-stage.js"></script>
 *   <script src="storm-slash.js"></script>
 *   <script>StormSlash.play().then(showThePage);</script>
 *
 * Seen from the ground, a swordsman in a white robe towers against a storm,
 * all in black, white and grey but for a blue tassel at his hip. The wind
 * tears at his ponytail, his sleeves and the clouds. He gathers himself and
 * cuts once, upward from low on the left to high on the right, and the
 * blade leaves a thin white arc. The wind drops dead. Then the clouds split
 * along the line of the cut and pull apart, and he stands dark against the
 * bright gap as the wind comes back, gently. The light in the gap widens
 * until it takes the whole frame, then thins away to the page, opening first
 * along the line of the cut. The whole of it lasts five seconds (LENGTH).
 *
 * The storm is two sheets of brushstroke noise worked out once and slid past
 * the screen; the swordsman is drawn fresh each frame from flat shapes, and
 * lit at the edges by whatever bright sky is next to them. Everything is a
 * pure function of time, so render(t) can draw any moment directly.
 */
const StormSlash = (() => {
  'use strict';
  const { code, clamp01, lerp, smooth, mulberry32, hash, noise } = AsciiStage;

  // The story's timeline, in seconds at the pace it was written.
  const T = {
    gather: 2.0, // he bends his knees, draws his open hand in and turns the blade edge up
    slash: 3.5,  // the cut, from low on the left...
    high: 4.0,   // ...to the sword held high; the wind drops dead
    split: 5.0,  // the clouds split along the line of the cut
    wind: 8.0,   // the wind comes back, gently
    light: 10.0, // the light in the gap takes the frame
    white: 10.6, // nothing is left but light, and it thins away to the page
    end: 11.2,
  };
  // It is played faster than that. LENGTH is how many seconds the whole of it
  // takes on screen, and SPEED how many times faster than the story that is.
  const LENGTH = 5, SPEED = T.end / LENGTH;
  const ARC = 0.5; // how long the white arc the blade leaves lasts

  // Colours: greys, and the one blue. `swatch` adds a run and gives the index of the first.
  const INK = ['#000000'];
  const swatch = (...colours) => INK.push(...colours) - colours.length;
  const GREY = swatch(...[12, 20, 27, 35, 44, 53, 63, 74, 85, 97, 109, 122, 135, 148, 161, 174, 187, 199, 211, 222, 232, 241, 248, 255]
    .map((v) => `rgb(${v},${v},${v})`)); // black to white
  const TOP = 23, WHITE = GREY + TOP;
  const BLUE = swatch('#2f4bff'); // the tassel: the one colour in the picture, and it never changes
  const GLOW = swatch('rgba(255,255,255,0.14)', 'rgba(255,255,255,0.3)'); // light about the arc

  const [BAR, SLASH, BACK, LOW, DASH, HIGH, TICK, COMMA, DOT, STAR, OPEN, CLOSE, QUOTE, WAVE] = code('|/\\_-\'`,.*[]"~');
  const STROKES = ['`-.', '-~', '`--.', '~-', '`~', '--.'].map(code); // brushstrokes in the cloud, sweeping down from the upper left
  const TUMBLE = code("~-,'v^"); // a small leaf turning over as it flies
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16); // ordered dither: a fixed pattern, so nothing flickers

  // How hard the wind blows at story time s: a gusting gale from the right, dead calm
  // from the end of the cut, then a gentle breeze.
  const wind = (s) => (s < T.split
    ? (1 + 0.22 * Math.sin(s * 2.3 + 0.4) + 0.12 * Math.sin(s * 5.7 + 1.1)) * (1 - smooth(T.high, T.high + 0.12, s))
    : 0.32 * smooth(T.wind, T.wind + 1.4, s) * (1 + 0.25 * Math.sin(s * 1.9)));
  // How far the wind has carried things by time s (tabulated): whatever it blows moves in
  // step with it, and stops dead when it does. Before the film the gale was already blowing.
  const STEP = 1 / 60, CARRIED = new Float32Array(Math.ceil(T.end / STEP) + 2);
  for (let i = 1; i < CARRIED.length; i++) CARRIED[i] = CARRIED[i - 1] + wind((i - 0.5) * STEP) * STEP;
  const carried = (s) => {
    if (s <= 0) return s;
    const k = Math.min(CARRIED.length - 1.001, s / STEP), i = k | 0;
    return lerp(CARRIED[i], CARRIED[i + 1], k - i);
  };
  // How far his hair and clothes stream out on the wind (1) rather than hang (0).
  const blow = (s) => (s < T.wind ? 1 - smooth(T.high, T.high + 0.3, s) : 0.4 * smooth(T.wind, T.wind + 1.6, s));
  // His moves, each 0 to 1: knees bent, open hand drawn in, blade turned edge up, the cut.
  const crouch = (s) => smooth(T.gather, T.gather + 1.2, s);
  const drawIn = (s) => smooth(T.gather + 0.1, T.gather + 1.1, s);
  const edgeUp = (s) => smooth(T.gather + 0.6, T.slash - 0.15, s);
  const cut = (s) => smooth(T.slash, T.high, s);

  // The picture is laid out in the units of the reference image, 0.5625 wide and 1 tall,
  // y down. Bending his knees lowers everything above his hem by up to SINK.
  const SINK = 0.018;
  const dropped = (y, k) => y + SINK * k * clamp01((0.935 - y) / 0.33);
  const bez = (P, k, out) => { // a point on a curve through three points
    const a = (1 - k) * (1 - k), b = 2 * k * (1 - k), c = k * k;
    out[0] = a * P[0][0] + b * P[1][0] + c * P[2][0];
    out[1] = a * P[0][1] + b * P[1][1] + c * P[2][1];
    return out;
  };
  const SHOULDER = [0.31, 0.47], UPPER = 0.118, FORE = 0.118; // his sword arm
  // The sword hand at his side, through the cut, and held high (knees bent). The blade is
  // 0.357 long at his side, pointing at the lower left corner, and looks 0.3 held high,
  // pointing at the upper right one (it leans away from us up there).
  const GRIP = [[0.247, 0.672], [0.262, 0.47], [0.335, 0.302]].map(([x, y]) => [x, dropped(y, 1)]);
  const START = [0.247 - 0.215, 0.672 + 0.285];
  const FINISH = [GRIP[2][0] + 0.3 * Math.cos(0.87), GRIP[2][1] - 0.3 * Math.sin(0.87)];
  // The cut runs along the line from START to FINISH, and the clouds split along it. The
  // point's path bows toward him, so the arc it leaves curves across his body.
  const CL = Math.hypot(FINISH[0] - START[0], FINISH[1] - START[1]);
  const ALONG = [(FINISH[0] - START[0]) / CL, (FINISH[1] - START[1]) / CL], ACROSS = [-ALONG[1], ALONG[0]]; // up the line, and across it to the lower right
  const BOW = 0.12;
  const TIP = [START, [(START[0] + FINISH[0]) / 2 + BOW * ACROSS[0], (START[1] + FINISH[1]) / 2 + BOW * ACROSS[1]], FINISH];
  // His ponytail, from where it comes out behind his neck to its tip, a length at a time: the
  // way it heads streaming on the wind and hanging still (radians from the right, y down),
  // how long it is, and how thick.
  const TAIL = [[2.86, 1.9, 0.036, 0.016], [2.94, 1.85, 0.041, 0.014], [2.85, 1.8, 0.042, 0.011], [2.73, 1.76, 0.033, 0.008], [2.36, 1.74, 0.022, 0.005]];

  // How bright the storm is at a point of the picture before its brushstrokes: brightest
  // in a band behind his head and shoulders, dark to the left and low on the right, and
  // darker away from him on a wide screen.
  function glowAt(x, y) {
    const band = x - 0.265 + (y - 0.33) * 0.15;
    return 0.4
      + 0.36 * Math.exp(-((band / 0.1) ** 2) - ((y - 0.33) / 0.3) ** 2)
      + 0.24 * Math.exp(-(((x - 0.47) / 0.07) ** 2) - ((y - 0.43) / 0.07) ** 2)
      + 0.2 * Math.exp(-(((x - 0.21) / 0.08) ** 2) - ((y - 0.57) / 0.07) ** 2)
      - 0.22 * smooth(0.12, -0.08, x) - 0.16 * smooth(0.6, 0.85, y) * smooth(0.42, 0.58, x)
      - 0.1 * smooth(0.3, 0.7, Math.abs(x - 0.28) - 0.28);
  }

  function createScene({ cols, rows, aspect = 2, seed = 1 }) {
    const rand = mulberry32(seed), R = (a, b) => a + (b - a) * rand();
    // World units are half rows, which are about square: a column is `px` of them wide.
    const lines = rows * 2, px = 2 / aspect, W = cols * px, H = lines, n = cols * rows, n2 = cols * lines;
    // The reference picture is the heart of the frame: as tall as the screen (a little of
    // its sky cut off), or as wide as a narrow screen, standing on the bottom edge in the
    // middle. A wider screen has more storm to either side, a taller one more above.
    const F = Math.min(H / 0.92, W / 0.575), ox = (W - 0.5625 * F) / 2, oy = H - F;
    const X = (x) => ox + x * F, Y = (y) => oy + y * F; // a point of the picture, in world units
    const glyph = new Uint8Array(n), ink = new Uint8Array(n), bold = new Uint8Array(n), wash = new Uint8Array(n);
    const paint = new Uint8Array(n2), lum = new Float32Array(n2), near = new Float32Array(n2);
    // What each half cell shows: sky (0), or what the thing in front of it is made of.
    const what = new Uint8Array(n2), CLOTH = 1, DARK = 2, SKIN = 3, STEEL = 4, TASSEL = 5, LAND = 6, HEM = 7;
    const front = new Uint8Array(n); // cells holding a character that stands in front of the sky (twigs, grass, leaves)

    // The storm: two sheets of brushstrokes, long along the stroke and thin across it, worked
    // out once over more than the screen. The light (glowAt, with a slow swell of its own)
    // stays where it is; the sheets slide left with the wind, the second faster, so the
    // clouds churn. MARKS are the characters carried with the first sheet.
    const M = 0.32 * F, slide = (carried(T.end) + 0.2) * 0.26 * F, tex = Math.max(1, F / 150);
    const TX = Math.ceil((W + slide + 2 * M) / tex) + 2, TY = Math.ceil((H + 2 * M) / tex) + 2;
    const sheetA = new Float32Array(TX * TY), sheetB = new Float32Array(TX * TY), light = new Float32Array(TX * TY);
    const BRUSH = 0.5, bc = Math.cos(BRUSH), bs = Math.sin(BRUSH); // the strokes sweep down to the right
    for (let j = 0; j < TY; j++) for (let i = 0; i < TX; i++) {
      const x = i * tex - M, y = j * tex - M, u = (x * bc + y * bs) / F, v = (y * bc - x * bs) / F, k = j * TX + i;
      sheetA[k] = 0.5 * noise(u / 0.3 + seed * 7, v / 0.09) + 0.3 * noise(u / 0.11 + 17, v / 0.033 + 9) + 0.2 * noise(u / 0.045 + 33, v / 0.014 + 41);
      sheetB[k] = 0.6 * noise(u / 0.18 + 71, v / 0.05 + 5 + seed * 3) + 0.4 * noise(u / 0.06 + 90, v / 0.018 + 77);
      if (x < W + M) light[k] = glowAt((x - ox) / F, (y - oy) / F) + 0.18 * (noise(x / (0.35 * F) + 300, y / (0.35 * F) + seed) - 0.5);
    }
    const sample = (table, x, y) => {
      const fx = Math.max(0, Math.min(TX - 1.001, (x + M) / tex)), fy = Math.max(0, Math.min(TY - 1.001, (y + M) / tex));
      const i = fx | 0, j = fy | 0, a = fx - i, k = j * TX + i;
      return lerp(lerp(table[k], table[k + 1], a), lerp(table[k + TX], table[k + TX + 1], a), fy - j);
    };
    const MX = Math.ceil((W + slide + 2 * M) / px) + 2, MY = Math.ceil((H + 2 * M) / 2) + 2;
    const MARKS = new Uint8Array(MX * MY);
    for (let j = 0; j < MY; j++) for (let i = 0; i < MX; i++) {
      if (hash(i + seed * 131, j) > 0.022) continue;
      const stroke = STROKES[(hash(j, i + 7) * STROKES.length) | 0];
      stroke.forEach((ch, k) => { if (i + k < MX) MARKS[j * MX + i + k] = ch; });
    }

    // The split runs along the line of the cut, out from where it crosses him to both ends.
    // Its edges are torn, and the two halves of the storm are pushed apart by `gap`.
    const LX = X(START[0]), LY = Y(START[1]), [DX, DY] = ALONG, [NX, NY] = ACROSS;
    let lo = Infinity, hi = -Infinity, far = 0;
    for (const [x, y] of [[0, 0], [W, 0], [0, H], [W, H]]) {
      const a = (x - LX) * DX + (y - LY) * DY, b = (x - LX) * NX + (y - LY) * NY;
      lo = Math.min(lo, a); hi = Math.max(hi, a); far = Math.max(far, Math.abs(b));
    }
    const heart = (X(0.36) - LX) * DX + (Y(0.5) - LY) * DY; // where the line passes him
    const RAG = [0, 1].map((side) => Float32Array.from({ length: Math.ceil(hi - lo) + 2 }, (_, k) => noise(k / (0.045 * F), 61 + side * 6 + seed)));
    const PARTED = 0.17 * F, WIDE = 0.23 * F, ALL = (far + 0.15 * F) / 0.8, RIM = 0.05 * F; // the gap's half width when the wind returns, when the light takes over, and past every corner (torn edges and all)
    const gap = (s) => (s < T.split ? 0 : s < T.wind ? PARTED * ((s - T.split) / (T.wind - T.split)) ** 1.15
      : s < T.light ? lerp(PARTED, WIDE, (s - T.wind) / (T.light - T.wind)) : lerp(WIDE, ALL, clamp01((s - T.light) / (T.white - T.light)) ** 2));

    function drawSky(s) {
      const d = carried(s), dA = d * 0.16 * F, dB = d * 0.26 * F, g = gap(s);
      const reach = s >= T.split ? ((s - T.split) / 0.35) * (hi - lo) : -1; // how far the split has run either way from him
      for (let l = 0; l < lines; l++) {
        const y = l + 0.5, r = l >> 1;
        for (let c = 0; c < cols; c++) {
          const x = (c + 0.5) * px, i = l * cols + c;
          let sx = x, sy = y, lit = 0;
          if (reach >= 0) {
            const along = (x - LX) * DX + (y - LY) * DY, across = (x - LX) * NX + (y - LY) * NY, side = across < 0 ? -1 : 1;
            const torn = RAG[side > 0 ? 1 : 0][Math.max(0, Math.min(RAG[0].length - 1, Math.round(along - lo)))];
            const open = Math.abs(along - heart) < reach ? Math.max(0.7, g * (0.8 + 0.4 * torn)) : 0;
            const out = Math.abs(across) - open; // how far into the cloud this is from the edge of the gap
            if (out < 0) { paint[i] = out < -1.5 ? WHITE : WHITE - 1; lum[i] = 1; continue; } // the gap: open sky
            sx = x - side * g * NX; sy = y - side * g * NY; // the halves are pushed apart
            if (out < RIM) lit = (1 - out / RIM) ** 2; // their torn edges catch the light
          }
          const v = sample(light, sx, sy) + 0.62 * (sample(sheetA, sx + dA, sy) - 0.5) + 0.34 * (sample(sheetB, sx + dB, sy) - 0.5) + 0.5 * lit;
          // painted in broad flat bands of every other grey, dithered only where one meets the next
          const level = 1 + 2 * Math.max(0, Math.min(9, Math.floor(v * 10.5 + 0.15 + 0.7 * BAYER[(l & 3) * 4 + (c & 3)])));
          lum[i] = v; paint[i] = GREY + level;
          if (l & 1) continue;
          const m = MARKS[Math.max(0, Math.min(MY - 1, Math.floor((sy + 1 + M) / 2))) * MX + Math.max(0, Math.min(MX - 1, Math.floor((sx + dA + M) / px)))];
          if (m) { glyph[r * cols + c] = m; ink[r * cols + c] = GREY + (level > 11 ? level - 5 : level + 5); }
        }
      }
    }

    // The ground the camera lies on: a dark ragged strip along the bottom, its grass
    // bent over by the wind.
    const ground = Float32Array.from({ length: cols }, (_, c) => Y(0.962) - 0.018 * F * noise(((c + 0.5) * px) / (0.06 * F), 5 + seed));
    function drawGround(s) {
      const bend = blow(s);
      for (let c = 0; c < cols; c++) {
        for (let l = Math.max(0, Math.ceil(ground[c] - 0.5)); l < lines; l++) {
          const i = l * cols + c;
          paint[i] = GREY + (hash(c >> 1, l >> 1) < 0.3 ? 2 : 1); what[i] = LAND; lum[i] = 0;
        }
        const r = Math.floor((ground[c] - 0.6) / 2), h = hash(c, 31 + seed);
        if (r < 0 || r >= rows || h > 0.5) continue;
        const sway = bend * (0.8 + 0.35 * Math.sin(s * 13 + c * 1.7)), i = r * cols + c;
        glyph[i] = sway > 0.5 ? BACK : h < 0.15 ? QUOTE : sway > 0.2 ? TICK : BAR; ink[i] = GREY + 1; bold[i] = 1; front[i] = 1;
      }
    }

    // A line of characters from (c0, r0) to (c1, r1), in cells, each chosen by where the line
    // crosses its cell, as the plum blossom draws its twigs. `keep(i)` may refuse a cell.
    function strokeLine(c0, r0, c1, r1, colour, heavy, keep) {
      const put = (c, r, ch) => {
        if (c < 0 || c >= cols || r < 0 || r >= rows) return;
        const i = r * cols + c;
        if (keep && !keep(i)) return;
        glyph[i] = ch; ink[i] = colour; bold[i] = heavy;
      };
      const dc = c1 - c0, dr = r1 - r0, wide = Math.abs(dc), high = Math.abs(dr), rising = dc * dr < 0;
      if (wide <= high * 1.3) { // steep: one character a row
        const a = Math.min(r0, r1), b = Math.max(r0, r1);
        for (let r = Math.floor(a); r < b; r++) {
          const ya = Math.max(a, r), yb = Math.min(b, r + 1), cover = yb - ya;
          if (cover < 0.25) continue;
          const ca = c0 + (dc * (ya - r0)) / dr, cb = c0 + (dc * (yb - r0)) / dr;
          const stub = cover < 0.6 ? ((ya + yb) / 2 - r > 0.5 ? (rising ? COMMA : DOT) : HIGH) : 0;
          put(Math.floor((ca + cb) / 2), r, stub || (Math.floor(ca) === Math.floor(cb) ? BAR : rising ? SLASH : BACK));
        }
      } else { // shallow: one character a column
        const a = Math.min(c0, c1), b = Math.max(c0, c1), slope = high / wide;
        for (let c = Math.floor(a); c < b; c++) {
          const xa = Math.max(a, c), xb = Math.min(b, c + 1);
          if (xb - xa < 0.35) continue;
          const y = r0 + (dr * ((xa + xb) / 2 - c0)) / dc, r = Math.floor(y), f = y - r;
          if (slope > 0.6) put(c, r, rising ? SLASH : BACK);
          else if (slope > 0.2) put(c, r, f < 0.36 ? (rising ? HIGH : TICK) : f > 0.64 ? (rising ? COMMA : DOT) : DASH);
          else put(c, r, f < 0.3 ? HIGH : f > 0.7 ? LOW : DASH);
        }
      }
    }

    // Bare branches: a thicket in the lower left, as in the picture, and more along the ground
    // on a wider screen. Each stem is a zigzag of straight runs, as the plum's wood is, with a
    // side twig off most joints. The wind bends a bush over to the left about its root, the
    // more the higher up, and shakes it.
    const twigs = [];
    function bush(fx, size) { // a bush rooted at picture x `fx`, `size` tall in picture units
      const root = { x: X(fx), y: Y(0.99), size: size * F, phase: R(0, 6.28) };
      for (let k = 0, stems = 2 + ((rand() * 3) | 0); k < stems; k++) {
        let x = root.x + R(-0.015, 0.015) * F, y = root.y, a = -Math.PI / 2 + R(-0.6, 0.45);
        const runs = 3 + ((rand() * 2) | 0), each = (size * F * R(0.7, 1)) / runs;
        for (let j = 0; j < runs; j++) {
          a += (j & 1 ? 1 : -1) * R(0.12, 0.32);
          const len = each * R(0.8, 1.2), x1 = x + Math.cos(a) * len, y1 = y + Math.sin(a) * len;
          twigs.push({ root, x0: x, y0: y, x1, y1, leaf: 0 });
          if (rand() < 0.7) {
            const b = a + (rand() < 0.5 ? -1 : 1) * R(0.45, 0.85), l2 = len * R(0.45, 0.85);
            twigs.push({ root, x0: x1, y0: y1, x1: x1 + Math.cos(b) * l2, y1: y1 + Math.sin(b) * l2, leaf: rand() < 0.4 ? TUMBLE[(rand() * 4) | 0] : 0 });
          }
          x = x1; y = y1;
        }
      }
    }
    for (const [fx, size] of [[0.02, 0.26], [0.09, 0.3], [0.155, 0.22]]) bush(fx, size);
    for (let fx = -0.06; X(fx) > -0.1 * F; fx -= R(0.08, 0.16)) if (rand() < 0.75) bush(fx, R(0.1, 0.26));
    for (let fx = 0.62; X(fx) < W + 0.1 * F; fx += R(0.1, 0.18)) if (rand() < 0.6) bush(fx, R(0.08, 0.22));
    const pose = [0, 0];
    function bent(t, x, y, bendBy) { // where a point of a bush is when the wind bends it
      const h = clamp01((t.root.y - y) / t.root.size), a = -bendBy * h * h, ca = Math.cos(a), sa = Math.sin(a);
      pose[0] = t.root.x + (x - t.root.x) * ca - (y - t.root.y) * sa;
      pose[1] = t.root.y + (x - t.root.x) * sa + (y - t.root.y) * ca;
      return pose;
    }
    function drawBranches(s) {
      const bend = blow(s), w = wind(s);
      for (const t of twigs) {
        const by = 0.3 * bend + 0.1 * w * Math.sin(s * 7 + t.root.phase);
        const [ax, ay] = bent(t, t.x0, t.y0, by), [bx, b2] = bent(t, t.x1, t.y1, by);
        strokeLine(ax / px, ay / 2, bx / px, b2 / 2, GREY + 1, 1, (i) => (front[i] = 1));
        if (t.leaf) {
          const c = Math.floor(bx / px), r = Math.floor(b2 / 2);
          if (c >= 0 && c < cols && r >= 0 && r < rows) { const i = r * cols + c; glyph[i] = t.leaf; ink[i] = GREY + 1; bold[i] = 1; front[i] = 1; }
        }
      }
    }

    // Leaves flying across from right to left, a few at a time: carried by the wind, they
    // hang where they are when it stops, sink slowly while it is calm, and drift on when it
    // comes back. A near one is a dark fleck of paint, a far one a character.
    const leaves = [], pace = 0.3 * F, span = (W + 0.2 * F) / pace;
    {
      const many = Math.max(4, Math.round((5 * W * H) / (0.5625 * F * F))), last = carried(T.end) + span;
      for (let k = 0, total = Math.round((many * last) / span); k < total; k++) {
        leaves.push({
          d0: R(-span, last - span), y0: R(-0.05, 0.92) * H, v: R(0.8, 1.25), tilt: R(-0.05, 0.25), amp: R(0.008, 0.03) * F,
          freq: R(2.5, 5), phase: R(0, 6.28), spin: R(3, 7), near: rand() < 0.3, sink: R(0.015, 0.04) * F,
        });
      }
    }
    function drawLeaves(s, nearOnes) {
      const d = carried(s), calm = Math.min(s, T.wind + 1) - T.split;
      for (const f of leaves) {
        if (f.near !== nearOnes) continue;
        const go = (d - f.d0) * f.v * pace;
        if (go < 0 || go > W + 0.2 * F) continue;
        const x = W + 0.1 * F - go, y = f.y0 + go * f.tilt + f.amp * Math.sin(d * f.freq + f.phase) + (calm > 0 ? f.sink * calm : 0);
        const c = Math.floor(x / px), l = Math.floor(y), turn = Math.floor(d * f.spin + f.phase * 3);
        if (c < 0 || c >= cols || l < 0 || l >= lines) continue;
        if (!nearOnes) {
          const i = (l >> 1) * cols + c;
          if (what[l * cols + c] && what[l * cols + c] !== LAND) continue; // behind him
          glyph[i] = TUMBLE[((turn % 6) + 6) % 6]; ink[i] = GREY + 1; bold[i] = 1; front[i] = 1;
          continue;
        }
        const flat = turn & 1; // edge on, or face on: two half cells across, or a block of four
        for (let dl = 0; dl <= (flat ? 0 : 1); dl++) for (let dc = -1; dc <= 0; dc++) {
          const cc = c + dc, ll = l + dl;
          if (cc < 0 || cc >= cols || ll >= lines) continue;
          paint[ll * cols + cc] = GREY + 1; what[ll * cols + cc] = LAND; glyph[(ll >> 1) * cols + cc] = 32;
        }
      }
    }

    // Painting things in front of the sky. Shapes are given in picture units, and fill the
    // half cells whose middles are inside them with a colour, or with what a function
    // tone(x, y) gives (0 leaves the half cell as it was), noting what they are made of.
    let top = lines, bottom = -1; // the lines the figure covers this frame
    function set(c, l, colour, kind) {
      const i = l * cols + c;
      paint[i] = colour; what[i] = kind; glyph[(l >> 1) * cols + c] = 32;
      if (l < top) top = l;
      if (l > bottom) bottom = l;
    }
    const cross = [];
    function poly(pts, tone, kind) {
      let y0 = Infinity, y1 = -Infinity;
      for (let k = 1; k < pts.length; k += 2) { y0 = Math.min(y0, pts[k]); y1 = Math.max(y1, pts[k]); }
      const l0 = Math.max(0, Math.ceil(Y(y0) - 0.5)), l1 = Math.min(lines - 1, Math.floor(Y(y1) - 0.5));
      for (let l = l0; l <= l1; l++) {
        const y = (l + 0.5 - oy) / F;
        cross.length = 0;
        for (let k = 0, m = pts.length; k < m; k += 2) {
          const ay = pts[k + 1], by = pts[(k + 3) % m];
          if ((ay <= y) !== (by <= y)) { const ax = pts[k], bx = pts[(k + 2) % m]; cross.push(ax + ((bx - ax) * (y - ay)) / (by - ay)); }
        }
        cross.sort((a, b) => a - b);
        for (let k = 0; k + 1 < cross.length; k += 2) {
          const c0 = Math.max(0, Math.ceil(X(cross[k]) / px - 0.5)), c1 = Math.min(cols - 1, Math.floor(X(cross[k + 1]) / px - 0.5));
          for (let c = c0; c <= c1; c++) {
            const colour = typeof tone === 'number' ? tone : tone(((c + 0.5) * px - ox) / F, y);
            if (colour) set(c, l, colour, kind);
          }
        }
      }
    }
    // A rod from a to b, ra and rb thick at its ends (never thinner than a half cell).
    // tone(k, side) is told how far along a point is and how far across (-1 to 1).
    function rod(ax, ay, bx, by, ra, rb, tone, kind) {
      const least = 0.56 / F, r = Math.max(ra, rb, least), du = bx - ax, dv = by - ay, len2 = du * du + dv * dv || 1e-12;
      const c0 = Math.max(0, Math.floor(X(Math.min(ax, bx) - r) / px)), c1 = Math.min(cols - 1, Math.ceil(X(Math.max(ax, bx) + r) / px));
      const l0 = Math.max(0, Math.floor(Y(Math.min(ay, by) - r))), l1 = Math.min(lines - 1, Math.ceil(Y(Math.max(ay, by) + r)));
      for (let l = l0; l <= l1; l++) {
        const y = (l + 0.5 - oy) / F;
        for (let c = c0; c <= c1; c++) {
          const x = ((c + 0.5) * px - ox) / F, k = clamp01(((x - ax) * du + (y - ay) * dv) / len2);
          const ou = x - ax - du * k, ov = y - ay - dv * k, rr = Math.max(least, lerp(ra, rb, k));
          if (ou * ou + ov * ov > rr * rr) continue;
          const colour = typeof tone === 'number' ? tone : tone(k, (ou * dv - ov * du) / (Math.sqrt(len2) * rr));
          if (colour) set(c, l, colour, kind);
        }
      }
    }
    function blob(cx, cy, rx, ry, tone, kind) {
      const l0 = Math.max(0, Math.floor(Y(cy - ry))), l1 = Math.min(lines - 1, Math.ceil(Y(cy + ry)));
      const c0 = Math.max(0, Math.floor(X(cx - rx) / px)), c1 = Math.min(cols - 1, Math.ceil(X(cx + rx) / px));
      for (let l = l0; l <= l1; l++) for (let c = c0; c <= c1; c++) {
        const x = ((c + 0.5) * px - ox) / F, y = (l + 0.5 - oy) / F;
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1) continue;
        const colour = typeof tone === 'number' ? tone : tone(x, y);
        if (colour) set(c, l, colour, kind);
      }
    }
    const trim = (pts, colour) => { for (let k = 0; k + 3 < pts.length; k += 2) rod(pts[k], pts[k + 1], pts[k + 2], pts[k + 3], 0.0028, 0.0028, colour, DARK); };

    // The second weapon, stuck in the ground at the lower right: it never moves.
    function drawWeapon() {
      rod(0.538, 1.02, 0.497, 0.78, 0.0065, 0.0055, (k, side) => (side > 0.4 ? GREY + 6 : GREY + 2), DARK); // the shaft
      blob(0.497, 0.78, 0.011, 0.007, GREY + 5, DARK);
      poly([0.489, 0.777, 0.473, 0.72, 0.478, 0.688, 0.493, 0.716, 0.507, 0.774], (x, y) => (x > 0.487 - (0.78 - y) * 0.12 ? GREY + 15 : GREY + 8), STEEL); // a broad blade, its edge in the light
    }

    // The swordsman. Each frame he is put together from flat shapes in the reference's
    // units, posed for the moment: knees, open hand, the sword arm through its cut, and
    // his hair and clothes streaming, hanging or fluttering with the wind.
    const hand = [0, 0], tip = [0, 0], dir = [0, 0], tailEnd = [0, 0, 0]; // (the end of his ponytail, and the way it points)
    let tipNow = null; // where the point is this frame, for its glint
    function figure(s) {
      const cr = crouch(s), inward = drawIn(s), bl = blow(s), w = wind(s), p = cut(s);
      const ex = smooth(T.split + 0.5, T.wind + 1, s); // he darkens to a silhouette as the gap opens behind him
      const dn = (y) => dropped(y, cr);
      const cloth = (k) => GREY + Math.max(3, Math.round(lerp(10, 18, k) - 9 * ex)); // his white robe, deep fold (0) to the light (1)
      const black = GREY + 1, skin = (k) => GREY + Math.max(3, Math.round(lerp(6, 12, k) - 4 * ex));
      const flap = (k, rate = 9) => w * Math.sin(s * rate + k); // a flutter, as strong as the wind
      const flare = 0.022 * bl + 0.006 * flap(0.5, 7.3); // his skirt blown out to the left
      const fl = (x, y) => x - flare * clamp01((y - 0.61) / 0.3) + 0.02 * (1 - bl) * clamp01((y - 0.61) / 0.3); // hanging straight when calm

      // The arm on the right of the frame, out to his side in its wide sleeve, with the open
      // hand; it turns in about the shoulder as he draws the hand in.
      const pivX = 0.425, pivY = dn(0.452), turn = 0.28 * inward, tc = Math.cos(turn), ts = Math.sin(turn);
      const arm = (pts) => {
        for (let k = 0; k < pts.length; k += 2) {
          const x = pts[k] - pivX, y = dn(pts[k + 1]) - pivY;
          pts[k] = pivX + x * tc - y * ts; pts[k + 1] = pivY + x * ts + y * tc;
        }
        return pts;
      };
      const f1 = 0.006 * flap(1), f2 = 0.006 * flap(2.2);
      poly(arm([0.42, 0.448, 0.455, 0.46, 0.495, 0.488, 0.53, 0.518, 0.556, 0.55, 0.545, 0.556, 0.5, 0.545, 0.46, 0.54, 0.425, 0.545, 0.418, 0.5]), cloth(0.3), CLOTH);
      poly(arm([0.425, 0.545, 0.46, 0.54, 0.5, 0.545, 0.545, 0.556, 0.557 + f1, 0.565, 0.562 + f1, 0.595, 0.556 + f2, 0.63, 0.54 + f2, 0.655, 0.512 + f2, 0.668, 0.48, 0.668, 0.455, 0.652, 0.44, 0.62, 0.428, 0.58]), cloth(0.9), CLOTH);
      trim(arm([0.425, 0.547, 0.46, 0.542, 0.5, 0.547, 0.545, 0.558, 0.557 + f1, 0.567]), black); // the black trim along its cuff
      // his forearm coming down out of it, the bandage round his wrist, and the open hand
      // hanging below the sleeve, fingers down
      const fore = arm([0.468, 0.552, 0.477, 0.606]), wrist = arm([0.477, 0.604, 0.479, 0.626]);
      rod(fore[0], fore[1], fore[2], fore[3], 0.009, 0.01, skin(0.3), SKIN);
      poly(arm([0.469, 0.624, 0.488, 0.624, 0.493, 0.66, 0.49, 0.7, 0.484, 0.707, 0.478, 0.7, 0.472, 0.664]), skin(0.3), SKIN);
      rod(wrist[0], wrist[1], wrist[2], wrist[3], 0.011, 0.011, cloth(1.2), CLOTH);

      // Legs below the hem, and the skirt: two white panels either side of a long black
      // one down the front, a black strip down the left edge, and the patterned black hem.
      poly([0.205, 0.9, 0.3, 0.9, 0.305, 1.02, 0.21, 1.02], GREY + 3, DARK);
      poly([0.36, 0.9, 0.435, 0.9, 0.445, 1.02, 0.365, 1.02], GREY + 3, DARK);
      poly([0.3, 0.9, 0.36, 0.9, 0.365, 1.02, 0.305, 1.02], black, DARK);
      const left = [[0.275, 0.618], [0.255, 0.645], [0.228, 0.7], [0.205, 0.76], [0.192, 0.8], [0.186, 0.86], [0.187, 0.905]].map(([x, y]) => [fl(x, y), dn(y)]);
      poly([0.287, dn(0.61), 0.33, dn(0.61), 0.33, 0.912, ...left.slice().reverse().flat()], (x, y) => cloth(x < 0.255 ? 0.75 : 0.95), CLOTH); // (both panels run in under the black one)
      poly([...left.slice(0, 5).flat(), ...left.slice(0, 5).reverse().map(([x, y]) => [x + 0.014, y + 0.004]).flat()], black, DARK);
      poly([0.372, dn(0.606), 0.398, dn(0.603), 0.41, dn(0.66), 0.428, dn(0.73), 0.455, dn(0.8), 0.48, dn(0.85), 0.502, 0.885, 0.495, 0.898, 0.47, 0.905, 0.43, 0.908, 0.398, 0.91, 0.35, 0.907, 0.35, dn(0.606)], (x, y) => cloth(x > 0.44 ? 0.7 : 0.85), CLOTH);
      poly([0.316, dn(0.606), 0.368, dn(0.604), 0.363, dn(0.75), 0.36, 0.9, 0.311, 0.905, 0.311, dn(0.75)], black, DARK);
      poly([left[6][0] + 0.002, 0.884, 0.306, 0.89, 0.368, 0.886, 0.43, 0.884, 0.47, 0.877, 0.499, 0.871, 0.505, 0.889, 0.47, 0.905, 0.43, 0.91, 0.368, 0.912, 0.306, 0.918, left[6][0], 0.91], black, HEM);

      // Torso, the black edge of his collar, the wide black belt, and the tassel hanging from it.
      poly([0.305, dn(0.468), 0.33, dn(0.452), 0.352, dn(0.447), 0.38, dn(0.442), 0.405, dn(0.445), 0.428, dn(0.452), 0.432, dn(0.49), 0.425, dn(0.53), 0.398, dn(0.56), 0.3, dn(0.565), 0.302, dn(0.52)],
        (x) => cloth(x > 0.37 ? 0.55 : 0.32), CLOTH);
      rod(0.375, dn(0.444), 0.322, dn(0.535), 0.0055, 0.0065, black, DARK);
      rod(0.322, dn(0.535), 0.312, dn(0.56), 0.0065, 0.0065, black, DARK);
      poly([0.288, dn(0.557), 0.392, dn(0.552), 0.396, dn(0.608), 0.286, dn(0.612)], (x, y) => (y < dn(0.568) && x > 0.33 ? GREY + 3 : black), DARK);
      const sway = 0.007 * bl + 0.004 * flap(4, 11);
      rod(0.379, dn(0.588), 0.382, dn(0.603), 0.0025, 0.0025, black, DARK);
      poly([0.378, dn(0.601), 0.391, dn(0.601), 0.395 - sway, dn(0.66), 0.388 - sway, dn(0.67), 0.382 - sway, dn(0.66)], BLUE, TASSEL);

      // His ponytail, streaming left from behind his neck, or hanging when the wind drops;
      // a wave runs down it as it flutters. Then his neck and head: the hair drawn back
      // tight, the band that ties it, and his face below, tilted down and in shadow.
      let tx = 0.338, ty = dn(0.446);
      rod(0.345, dn(0.385), tx, ty, 0.009, 0.012, black, DARK); // up behind his head, to the band
      TAIL.forEach(([streaming, hanging, len, thick], k) => {
        const a = lerp(hanging, streaming, bl) + 0.17 * w * Math.sin(s * 11 - k * 1.4) * (k + 1) / 3;
        const nx = tx + Math.cos(a) * len, ny = ty + Math.sin(a) * len;
        rod(tx, ty, nx, ny, thick, TAIL[k + 1] ? TAIL[k + 1][3] : thick * 0.4, (q, side) => (side < -0.4 ? GREY + 3 : black), DARK);
        tx = nx; ty = ny; tailEnd[2] = a;
      });
      tailEnd[0] = tx; tailEnd[1] = ty;
      poly([0.352, dn(0.432), 0.372, dn(0.43), 0.378, dn(0.455), 0.35, dn(0.458)], skin(0), SKIN);
      blob(0.349, dn(0.401), 0.034, 0.037, (x, y) => {
        if (((x - 0.36) / 0.02) ** 2 + ((y - dn(0.423)) / 0.022) ** 2 < 1 && x > 0.338) return skin(x > 0.365 ? 0.25 : 0.05); // the face
        return (x - 0.349) * 0.6 - (y - dn(0.401)) * 0.8 > 0.022 ? GREY + 3 : black; // the hair, a sheen where it faces the light
      }, DARK);
      rod(0.338, dn(0.381), 0.345, dn(0.377), 0.003, 0.003, GREY + 13 - Math.round(4 * ex), DARK); // the band

      // The sword arm. The hand goes along GRIP through the cut; the elbow bends out to his side.
      if (p > 0) { bez(GRIP, p, hand); bez(TIP, p, tip); }
      else { hand[0] = 0.247; hand[1] = dn(0.672); tip[0] = START[0]; tip[1] = START[1]; }
      const sx = SHOULDER[0], sy = dn(SHOULDER[1]), hx = hand[0] - sx, hy = hand[1] - sy, gap0 = Math.hypot(hx, hy) || 1e-6;
      const reach = Math.min(UPPER + FORE - 1e-4, gap0), ux = hx / gap0, uy = hy / gap0;
      const along = (UPPER * UPPER - FORE * FORE + reach * reach) / (2 * reach), off = Math.sqrt(Math.max(0, UPPER * UPPER - along * along));
      let ex1 = sx + ux * along + uy * off, ey1 = sy + uy * along - ux * off;
      if (sx + ux * along - uy * off < ex1) { ex1 = sx + ux * along - uy * off; ey1 = sy + uy * along + ux * off; } // the elbow out to his side
      const wx = lerp(ex1, hand[0], 0.85), wy = lerp(ey1, hand[1], 0.85);
      // the wide sleeve: along the arm, its open end hanging below the wrist and blown left
      const hangX = -0.042 * bl - 0.012 * flap(3), hangY = 0.022 + 0.026 * (1 - bl);
      const n1x = -(ey1 - sy), n1y = ex1 - sx, n1 = Math.hypot(n1x, n1y) || 1, n2x = -(wy - ey1), n2y = wx - ex1, n2 = Math.hypot(n2x, n2y) || 1;
      const a1 = 0.024 / n1, a2 = 0.034 / n2, a3 = 0.05 / n2;
      const sleeve = [sx + n1x * a1, sy + n1y * a1, ex1 + n1x * a1, ey1 + n1y * a1, wx + n2x * a2, wy + n2y * a2, wx + n2x * a3 + hangX, wy + n2y * a3 + hangY,
        wx - n2x * a2 + hangX * 0.6, wy - n2y * a2 + hangY, wx - n2x * a2, wy - n2y * a2, ex1 - n1x * a1, ey1 - n1y * a1, sx - n1x * a1, sy - n1y * a1];
      poly(sleeve, (x, y) => cloth(0.1 + 0.35 * clamp01((y - sy) / 0.2)), CLOTH); // in shadow against the bright band behind him, so it shows
      trim([sleeve[6], sleeve[7], sleeve[8], sleeve[9]], black); // the black trim round its open end
      // the sword: hilt behind the hand, the guard, the blade to the point
      const bx = tip[0] - hand[0], by = tip[1] - hand[1], blade = Math.hypot(bx, by) || 1e-6;
      dir[0] = bx / blade; dir[1] = by / blade;
      rod(hand[0] - dir[0] * 0.05, hand[1] - dir[1] * 0.05, hand[0], hand[1], 0.005, 0.005, GREY + 2, DARK);
      blob(hand[0], hand[1], 0.011, 0.011, skin(0.8), SKIN);
      const steel = GREY + Math.round(p > 0 ? lerp(TOP - 1, 3, ex) : lerp(14, 20, edgeUp(s))); // bright from the cut, then dark against the gap
      if (blade > 0.02) rod(hand[0] + dir[0] * 0.012, hand[1] + dir[1] * 0.012, tip[0], tip[1], 0.0045, 0.0035, steel, STEEL);
      rod(hand[0] + dir[0] * 0.011 - dir[1] * 0.012, hand[1] + dir[1] * 0.011 + dir[0] * 0.012, hand[0] + dir[0] * 0.011 + dir[1] * 0.012, hand[1] + dir[1] * 0.011 - dir[0] * 0.012, 0.004, 0.004, GREY + 3, DARK);
      tipNow = tip;
    }

    // Light on his edges: wherever a part of him meets bright sky, its edge catches the light,
    // white cloth most of all. Then the characters drawn on him: folds in his skirt, the hem's
    // pattern, and loose hair past the end of his ponytail.
    function rimLight(s) {
      const ex = smooth(T.split + 0.5, T.wind + 1, s), him = (i) => what[i] > 0 && what[i] !== LAND;
      for (let l = Math.max(1, top); l <= Math.min(lines - 3, bottom); l++) for (let c = 2; c < cols - 2; c++) {
        const i = l * cols + c, kind = what[i];
        if (!him(i) || kind === TASSEL) continue;
        // bright sky beside an edge of him, from either side or above, where he is at least three
        // half cells thick there: a thin part lit on both sides would turn into an outline
        let b = 0;
        if (!what[i - 1] && him(i + 1) && him(i + 2)) b = lum[i - 1];
        if (!what[i + 1] && him(i - 1) && him(i - 2)) b = Math.max(b, lum[i + 1]);
        if (!what[i - cols] && him(i + cols) && him(i + 2 * cols)) b = Math.max(b, lum[i - cols]);
        if (b < 0.58) continue;
        const k = clamp01((b - 0.58) / 0.37);
        const edge = kind === CLOTH ? lerp(15, TOP, k) : kind === STEEL ? TOP : lerp(4, 9, k) + 2 * ex;
        paint[i] = Math.max(paint[i], GREY + Math.round(edge));
      }
    }
    function marksOnHim(s) {
      const ex = smooth(T.split + 0.5, T.wind + 1, s), cr = crouch(s), bl = blow(s);
      const onCloth = (i) => what[(((i / cols) | 0) * 2) * cols + (i % cols)] === CLOTH && what[(((i / cols) | 0) * 2 + 1) * cols + (i % cols)] === CLOTH;
      const fold = GREY + Math.max(2, Math.round(10 - 5 * ex)), shift = -0.022 * bl + 0.02 * (1 - bl);
      for (const [x0, y0, x1, y1] of [[0.298, 0.625, 0.262 + shift * 0.6, 0.885], [0.285, 0.64, 0.226 + shift, 0.87], [0.386, 0.625, 0.424, 0.875], [0.396, 0.66, 0.458, 0.858]]) {
        strokeLine(X(x0) / px, Y(dropped(y0, cr)) / 2, X(x1) / px, Y(y1) / 2, fold, 0, onCloth);
      }
      for (let r = Math.max(0, top >> 1); r <= Math.min(rows - 1, bottom >> 1); r++) for (let c = 0; c < cols; c++) {
        const i = r * cols + c, a = what[r * 2 * cols + c], b = what[(r * 2 + 1) * cols + c];
        if (a === HEM && b === HEM) { glyph[i] = c & 1 ? CLOSE : OPEN; ink[i] = GREY + Math.round(9 - 4 * ex); bold[i] = 0; }
      }
      const [hx, hy, ha] = tailEnd, steep = Math.abs(Math.sin(ha)) > 0.8; // loose hair past the end of his ponytail, the way it points
      for (let k = 1; k <= 2; k++) {
        const c = Math.floor(X(hx) / px + Math.cos(ha) * k * 1.2), r = Math.floor((Y(hy) + Math.sin(ha) * k * 1.2 * px) / 2);
        if (c < 0 || c >= cols || r < 0 || r >= rows || what[r * 2 * cols + c] || what[(r * 2 + 1) * cols + c]) continue;
        glyph[r * cols + c] = steep ? BAR : k === 1 ? WAVE : DASH; ink[r * cols + c] = GREY + 1; bold[r * cols + c] = 1;
      }
    }

    // The arc: every half cell the outer part of the blade crosses during the cut, with the
    // moment it does, worked out once. It is a thin crescent, thickest in the middle.
    const arc = [];
    {
      const seen = new Uint8Array(n2), h = [0, 0], q = [0, 0], steps = Math.ceil(F * 6);
      for (let j = 0; j <= steps; j++) {
        const k = j / steps, p = k * k * (3 - 2 * k);
        bez(GRIP, p, h); bez(TIP, p, q);
        const len = Math.hypot(h[0] - q[0], h[1] - q[1]) || 1e-6, thick = Math.min(len * 0.6, 0.003 + 0.008 * Math.sin(Math.PI * p));
        for (let e = 0; e <= thick; e += 0.4 / F) {
          const c = Math.floor(X(q[0] + ((h[0] - q[0]) / len) * e) / px), l = Math.floor(Y(q[1] + ((h[1] - q[1]) / len) * e));
          if (c < 0 || c >= cols || l < 0 || l >= lines || seen[l * cols + c]) continue;
          seen[l * cols + c] = 1;
          arc.push({ i: l * cols + c, when: T.slash + k * (T.high - T.slash) });
        }
      }
    }
    function drawArc(s) {
      for (const a of arc) {
        const end = Math.max(a.when + ARC, T.high + 0.25) + 0.12 * hash(a.i, 5); // half a second, the newest part a little longer
        if (s < a.when || s > end) continue;
        paint[a.i] = WHITE; what[a.i] = 0;
        const c = a.i % cols, r = (a.i / cols / 2) | 0, i = r * cols + c;
        glyph[i] = 32; wash[i] = GLOW + 1;
        if (c > 0 && wash[i - 1] < GLOW + 1) wash[i - 1] = GLOW;
        if (c < cols - 1 && wash[i + 1] < GLOW + 1) wash[i + 1] = GLOW;
      }
    }
    // The glints: running along the blade as he turns its edge up, and at the point as it stops.
    function glints(s, hand) {
      const k = edgeUp(s);
      const put = (x, y) => {
        const c = Math.floor(X(x) / px), r = Math.floor(Y(y) / 2);
        if (c >= 0 && c < cols && r >= 0 && r < rows) { const i = r * cols + c; glyph[i] = STAR; ink[i] = WHITE; bold[i] = 1; }
      };
      if (k > 0 && k < 1) put(lerp(hand[0], START[0], k), lerp(hand[1], START[1], k));
      if (s >= T.high && s < T.high + 0.3) put(tipNow[0], tipNow[1]);
    }

    // The ending. The light in the gap eats in from every edge of whatever stands in front
    // of it, the thinnest things first, until there is nothing but light; then the light
    // thins away to the page, first along the line of the cut and then out from it, in
    // long streaks that run the way the cut did.
    const diag = Math.hypot(1, px);
    function takeover(s) {
      const e = 0.2 * F * smooth(T.light, T.white - 0.03, s) ** 1.6;
      for (let l = 0; l < lines; l++) for (let c = 0; c < cols; c++) {
        const i = l * cols + c;
        if (!what[i]) { near[i] = 0; continue; }
        let d = 1e9;
        if (c > 0) d = near[i - 1] + px;
        if (l > 0) d = Math.min(d, near[i - cols] + 1, c > 0 ? near[i - cols - 1] + diag : 1e9, c < cols - 1 ? near[i - cols + 1] + diag : 1e9);
        near[i] = d;
      }
      for (let l = lines - 1; l >= 0; l--) for (let c = cols - 1; c >= 0; c--) {
        const i = l * cols + c;
        if (!what[i]) continue;
        let d = near[i];
        if (c < cols - 1) d = Math.min(d, near[i + 1] + px);
        if (l < lines - 1) d = Math.min(d, near[i + cols] + 1, c < cols - 1 ? near[i + cols + 1] + diag : 1e9, c > 0 ? near[i + cols - 1] + diag : 1e9);
        near[i] = d;
        if (d <= e) { paint[i] = WHITE; what[i] = 0; }
      }
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (glyph[i] === 32) continue;
        const open = !what[r * 2 * cols + c] && !what[(r * 2 + 1) * cols + c];
        if (open && (!front[i] || e > 0.5 + 3 * hash(c, r))) { glyph[i] = 32; wash[i] = 0; }
      }
    }
    function release(s) {
      const k = 1.06 * smooth(T.white, T.end, s);
      glyph.fill(32); wash.fill(0);
      for (let l = 0; l < lines; l++) {
        const y = l + 0.5;
        for (let c = 0; c < cols; c++) {
          const x = (c + 0.5) * px, along = (x - LX) * DX + (y - LY) * DY, across = (x - LX) * NX + (y - LY) * NY;
          const streak = noise(along / (0.3 * F), across / (0.014 * F) + 3);
          paint[l * cols + c] = 0.55 * Math.min(1, Math.abs(across) / far) + 0.45 * streak < k ? 0 : WHITE;
        }
      }
    }

    return {
      cols, rows, palette: INK, glyph, ink, bold, paint, wash,
      render(t) { // t: seconds since the film started
        glyph.fill(32); ink.fill(0); bold.fill(0); paint.fill(0); wash.fill(0); what.fill(0); front.fill(0);
        if (t >= LENGTH) return this; // over: an empty frame, so the page shows
        const s = t * SPEED; // where that is in the story
        if (s >= T.white) { release(s); return this; }
        top = lines; bottom = -1;
        drawSky(s);
        drawBranches(s);
        drawGround(s);
        drawLeaves(s, false);
        drawWeapon();
        figure(s);
        rimLight(s);
        marksOnHim(s);
        glints(s, hand);
        drawLeaves(s, true);
        drawArc(s);
        if (s > T.light) takeover(s);
        return this;
      },
    };
  }

  // Play it on the stage. Resolves when it has finished. `seed` gives a different storm;
  // `freezeAt` holds one moment (in seconds) on screen instead of playing. Reduced motion
  // holds him in the storm before the cut.
  const film = { length: LENGTH, still: 0.45, createScene };
  return { play: (options) => AsciiStage.play(film, options), createScene };
})();
