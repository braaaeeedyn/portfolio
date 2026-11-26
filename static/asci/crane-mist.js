/*
 * Cranes into the mist: an ASCII loading screen.
 *
 *   <script src="ascii-stage.js"></script>
 *   <script src="crane-mist.js"></script>
 *   <script>CraneMist.play().then(showThePage);</script>
 *
 * A painting in cold blue-grey, slate and misty white, seen through the black
 * lines of a window lattice. A figure in a deep navy cloak, with loose black
 * hair to the waist, stands with their back to us on a dark, glassy floor,
 * and a red-crowned crane stands beside them. Tall misty cliffs with thin
 * waterfalls rise ahead, dark branches with pale blossom reach in from the
 * left, and five cranes fly slowly toward the upper left. The wind comes from
 * the right. The standing crane bows, spreads its wings, takes two steps to
 * the right, lifts off and climbs, and the figure's head tips up to follow
 * it. All six fly away into the mountains, shrinking, and fade into the mist
 * one by one, the farthest first. Then the mist drifting in from the right
 * thickens over the whole scene, takes the lattice, ink and seals last, and
 * thins away to show the page. Five seconds (LENGTH, below).
 *
 * The camera never moves. The whole of it is a pure function of time:
 * createScene().render(t) fills a grid of characters and the colours behind
 * them, and the stage (ascii-stage.js) paints that grid on a canvas.
 */
const CraneMist = (() => {
  'use strict';
  const { code, clamp01, lerp, smooth, mulberry32, hash, noise } = AsciiStage;

  // The story's timeline, in the seconds of the user's description.
  const T = {
    bow: 2.0,   // the standing crane lowers its head
    open: 2.55, // it raises it again and spreads its wings
    step: 3.5,  // it takes two steps to the right
    lift: 4.4,  // it leaves the floor and climbs toward the upper centre
    join: 5.5,  // it has joined the five, and all six fly away into the mountains
    fade: 8.5,  // the farthest crane starts to fade into the mist
    gone: 9.5,  // the last has gone, and the figure stands alone, looking up
    thick: 9.8, // the mist drifting in from the right thickens over everything
    end: 11.3,  // and has thinned away behind itself to show the page
  };
  // It is played faster than that. LENGTH is how many seconds the whole of it
  // takes on screen, and SPEED how many times faster than the story that is.
  const LENGTH = 5, SPEED = T.end / LENGTH;

  const WIND = 0.55;  // waves a second running out along the hair and the cloak
  const MIST = 0.028; // screen heights a second that the mist drifts to the left
  const BEAT = 1.5;   // seconds to one wingbeat

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
  // The cold blue-grey of the mist and the cliffs, from black through slate to
  // misty white, and the deep navy of the cloak at the same lightness. Every
  // colour but the crowns and the seals is a mix of the two.
  const GREY = [[0, '#05070b'], [0.1, '#0f151d'], [0.22, '#1b2733'], [0.35, '#2c3d4c'], [0.48, '#435768'], [0.6, '#5f7384'], [0.72, '#8193a2'], [0.83, '#a6b5c1'], [0.92, '#ccd6de'], [1, '#f1f4f7']];
  const NAVY = [[0, '#04061a'], [0.1, '#080e2e'], [0.22, '#111c4e'], [0.35, '#1c2b70'], [0.48, '#2b3e8a'], [0.6, '#4255a1'], [0.72, '#6275b6'], [0.83, '#8b9acb'], [0.92, '#b8c2e1'], [1, '#eef1fa']];
  const NL = 26, NC = 4; // steps of lightness, and steps from grey to the full navy
  const TONE = swatch(...Array.from({ length: NL * NC }, (_, i) => {
    const L = Math.floor(i / NC) / (NL - 1), C = (i % NC) / (NC - 1), g = along(GREY, L), b = along(NAVY, L);
    return '#' + g.map((v, j) => Math.round(v + (b[j] - v) * C).toString(16).padStart(2, '0')).join('');
  }));
  const RED = swatch('#a3182a', '#d42a38'); // the cranes' crowns, in shade and lit
  const SEAL = swatch('#7a1a1d', '#b3282b', '#d0463f'); // the seals: rim, body, a lighter fleck
  const THIN = swatch(...Array.from({ length: 8 }, (_, i) => `rgba(226,232,238,${((i + 1) / 9).toFixed(3)})`)) - 1; // mist thinning away: THIN + 1, the faintest, to THIN + 8
  const tone = (L, C = 0) => TONE + Math.max(0, Math.min(NL - 1, Math.round(L * (NL - 1)))) * NC + Math.max(0, Math.min(NC - 1, Math.round(C * (NC - 1))));
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  const [BAR, SLASH, BACK, LOW, DASH, HIGH, TICK, COMMA, DOT, WAVE, STAR, COLON, BANG] = code("|/\\_-'`,.~*:!");

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

  // A red-crowned crane, in its own units: x forward, y up and z out to its
  // side, from the middle of its body; standing, it is 1 tall. Its neck is
  // four points from the root to the head, in poses it blends between, and
  // then the way its bill points.
  const NECK = {
    up: [[0.17, 0.06], [0.24, 0.2], [0.22, 0.36], [0.16, 0.47], [-0.55, 0.83]], // head turned back to the sky
    bow: [[0.17, 0.06], [0.3, 0.07], [0.4, -0.02], [0.45, -0.14], [0.3, -0.95]],
    show: [[0.17, 0.06], [0.26, 0.19], [0.31, 0.34], [0.35, 0.45], [0.55, 0.83]],
    reach: [[0.17, 0.06], [0.3, 0.13], [0.42, 0.22], [0.52, 0.28], [0.92, 0.38]],
    fly: [[0.17, 0.04], [0.32, 0.06], [0.46, 0.07], [0.6, 0.07], [1, -0.04]],
  };
  // The standing crane's neck through its take-off: [from this moment, blend to this pose].
  const NECKS = [[T.bow, 'up'], [T.bow + 0.45, 'bow'], [T.open + 0.1, 'bow'], [T.open + 0.6, 'show'], [T.step, 'show'], [T.step + 0.35, 'reach'], [T.lift, 'reach'], [T.lift + 0.45, 'fly']];
  // A wing spread full, as [along the body, out from it]: the white inner wing,
  // then the black tip beyond it. The first three points of each are its leading edge.
  const INNER = [[0.07, 0.06], [0.13, 0.42], [0.073, 0.6], [-0.217, 0.6], [-0.25, 0.5], [-0.22, 0.24], [-0.13, 0.06]];
  const TIP = [[0.073, 0.6], [-0.01, 0.86], [-0.17, 0.74], [-0.217, 0.6]];
  // The bushy black plumes over its tail: drooping while it stands, trailing flat in flight.
  const PLUMES = [[[-0.44, -0.15], [-0.41, -0.24], [-0.33, -0.3], [-0.25, -0.28]], [[-0.38, 0.01], [-0.37, -0.03], [-0.34, -0.06], [-0.3, -0.05]]];
  // The five in the air at the start, as the painting has them: the middle of
  // the body (across and down, in the painting's heights), how large (its
  // heights to a crane's), which way it heads (radians: 0 is to the right,
  // pi/2 straight away from us, pi to the left), and where in its wingbeat it is.
  const FLOCK = [[0.19, 0.265, 0.085, 2.25, 0.3], [0.345, 0.375, 0.14, 2.35, 2.1], [0.49, 0.365, 0.085, 2.3, 4.0], [0.49, 0.46, 0.045, 2.2, 1.2], [0.535, 0.555, 0.065, 2.3, 5.2]];

  function createScene({ cols, rows, aspect = 2, seed = 1 }) {
    const rand = mulberry32(seed), R = (a, b) => a + (b - a) * rand();
    const H2 = rows * 2, N = cols * H2;     // the picture is cols x H2 half cells, each roughly square
    const U = rows * aspect, Wu = cols / U; // columns to one screen height, and the screen's width in screen heights
    const X = (c) => (c + 0.5) / U - Wu / 2, Y = (h) => (h + 0.5) / H2; // a half cell's place, across from the middle and down from the top, in screen heights
    const colOf = (x) => (x + Wu / 2) * U; // and back: the column at x
    // The painting the user described is the heart of the picture: as tall as
    // the screen when there is room for its width, smaller on a narrow screen,
    // and standing on the bottom edge. px and py put a place in the painting
    // (in its heights, across from its left edge and down from its top) on screen.
    const k = Math.min(1, Wu / 0.56);
    const px = (x) => (x - 1 / 3) * k, py = (y) => 1 - (1 - y) * k;
    const glyph = new Uint8Array(cols * rows), ink = new Uint8Array(cols * rows), bold = new Uint8Array(cols * rows), paint = new Uint8Array(N);

    // The still scene: how light each half cell is, how much of the drifting
    // mist can lie over it, and what it is.
    const base = new Float32Array(N), mistW = new Float32Array(N), kind = new Uint8Array(N);
    const SKY = 0, CLIFF = 1, FALL = 2, FLOOR = 3;
    const floorH = Math.min(H2 - 2, Math.round(py(0.884) * H2)); // the half row where the floor begins
    const lightY = py(0.06);
    for (let h = 0, p = 0; h < H2; h++) { // a sky of mist, brightest in the upper centre where the light comes from
      const y = Y(h);
      for (let c = 0; c < cols; c++, p++) {
        const x = X(c), glow = Math.exp(-((x / 0.45) ** 2) - ((y - lightY) / 0.5) ** 2);
        base[p] = 0.58 + 0.32 * glow + 0.05 * (noise(x * 6 + 3, y * 9) - 0.5);
        const valley = Math.max(1 - smooth(0, 0.1 * k, Math.abs(y - py(0.6))), 1 - smooth(0, 0.08 * k, Math.abs(y - py(0.83))));
        mistW[p] = Math.max(valley * (0.55 + 0.45 * noise(x * 2.5, seed + 7)), 0.6 * glow);
        kind[p] = h < floorH ? SKY : FLOOR;
      }
    }
    // Cliffs, palest and farthest first: [across, top, half width at the top,
    // how fast they widen going down, how dark the top is]. The painting's own
    // stand where it has them; a wider screen has more on both sides, some
    // with waterfalls of their own.
    const cliffs = [[0.13, 0.05, 0.11, 0.08, 0.4], [0.4, 0.1, 0.06, 0.06, 0.74], [0.27, 0.2, 0.05, 0.07, 0.62], [0.5, 0.15, 0.04, 0.05, 0.7], [0.56, 0.26, 0.06, 0.08, 0.58], [0.64, 0.4, 0.07, 0.1, 0.5], [0.42, 0.52, 0.12, 0.25, 0.42], [0, 0.42, 0.09, 0.1, 0.34]]
      .map(([x, y, w, s, L]) => [px(x), py(y), w * k, s, L]);
    for (let x = px(0) - R(0.08, 0.16); x > -Wu / 2 - 0.2; x -= R(0.1, 0.22)) cliffs.push([x, R(0.05, 0.4), R(0.04, 0.09), R(0.04, 0.14), R(0.3, 0.72)]);
    for (let x = px(0.667) + R(0.05, 0.12); x < Wu / 2 + 0.2; x += R(0.1, 0.22)) cliffs.push([x, R(0.08, 0.45), R(0.04, 0.09), R(0.04, 0.14), R(0.38, 0.74)]);
    cliffs.sort((a, b) => b[4] - a[4]);
    const falls = [[0.29, 0.02, 0.15], [0.305, 0.4, 0.53], [0.345, 0.49, 0.64], [0.505, 0.54, 0.7], [0.565, 0.66, 0.82]].map(([x, a, b]) => [px(x), py(a), py(b)]);
    for (const [x0, top, w0, spread, L0] of cliffs) {
      const sd = rand() * 100, lit = x0 < 0 ? 1 : -1; // the face toward the middle is toward the light
      if (Math.abs(x0) > 0.36 * k && rand() < 0.55) { const a = top + R(0.04, 0.15); falls.push([x0 + R(-0.4, 0.4) * w0, a, a + R(0.1, 0.3)]); }
      for (let h = Math.max(0, Math.ceil(top * H2)); h < floorH; h++) {
        const y = Y(h), d = y - top, w = w0 * Math.sqrt(Math.min(1, d / (w0 * 1.6))) + spread * d;
        const l = x0 - w * (1 + 0.35 * (noise(y * 16, sd) - 0.5)), r = x0 + w * (1 + 0.35 * (noise(y * 16, sd + 5) - 0.5));
        for (let c = Math.max(0, Math.ceil(colOf(l) - 0.5)), e = Math.min(cols - 1, Math.floor(colOf(r) - 0.5)); c <= e; c++) {
          const p = h * cols + c, x = X(c), face = Math.max(-1, Math.min(1, (x - x0) / (w || 1)));
          base[p] = lerp(L0, 0.8, 0.8 * smooth(top + 0.1, top + 0.7, y)) + 0.1 * (noise(x * 28 + sd, y * 8) - 0.5) + 0.07 * face * lit - (Math.min(x - l, r - x) * U < 1.2 ? 0.05 : 0);
          kind[p] = CLIFF;
        }
      }
    }
    for (const [x, a, b] of falls) { // each waterfall is one column of running water
      const c = Math.round(colOf(x) - 0.5);
      if (c >= 0 && c < cols) for (let h = Math.max(0, Math.round(a * H2)); h < Math.min(floorH, b * H2); h++) kind[h * cols + c] = FALL;
    }
    // The scene's own strokes, where a whole cell is one thing: brush strokes
    // down the cliffs, and on the floor the seams of its tiles running away
    // toward the eye's height, with a few scuffs.
    const mark = new Uint8Array(cols * rows), markL = new Float32Array(cols * rows);
    const eye = py(0.6);
    for (let r = 0, i = 0; r < rows; r++) for (let c = 0; c < cols; c++, i++) {
      const p = (r * 2 + 1) * cols + c, kd = kind[p], n = hash(c, r + 101), m = hash(r, c + 202);
      if (kd !== kind[p - cols]) continue;
      if (kd === CLIFF && n < 0.045) { mark[i] = m < 0.5 ? BAR : m < 0.75 ? BANG : COLON; markL[i] = base[p] - 0.14; } // sparse, so the cliffs never read as rain
      else if (kd === FLOOR) {
        const x = X(c), far = 1 / Math.max(0.02, (r + 1) / rows - eye), fx = x * far / 0.5; // the tile column of that point of the floor
        if (Math.abs(fx - Math.round(fx)) * 0.5 < (0.6 * far) / U && n < 0.7) { mark[i] = Math.abs(x) < 1.5 / U ? BAR : x < 0 ? SLASH : BACK; markL[i] = 0.34; }
        else if (n < 0.06) { mark[i] = m < 0.5 ? DASH : LOW; markL[i] = 0.3; }
      }
    }

    // The mist: a soft texture, stretched by the wind, that slides left.
    const reach = Math.ceil(MIST * T.end * U) + 2, TW = cols + reach, o = R(0, 99);
    const mistTex = new Float32Array(TW * H2);
    for (let h = 0; h < H2; h++) {
      const y = Y(h);
      for (let i = 0; i < TW; i++) {
        const x = (i + 0.5) / U;
        mistTex[h * TW + i] = 0.55 * noise(o + x * 4.5, y * 9) + 0.3 * noise(o + x * 12, 9 + y * 26) + 0.15 * noise(o + x * 30, 3 + y * 60);
      }
    }
    // The grain of the brush: a fixed threshold for each half cell, for
    // dithering between the tones; and a plain ordered one for the mist
    // thinning away at the end, which should be soft rather than grainy.
    const thr = new Float32Array(N), order = new Float32Array(N);
    for (let h = 0, p = 0; h < H2; h++) for (let c = 0; c < cols; c++, p++) {
      order[p] = (BAYER[(h & 3) * 4 + (c & 3)] + 0.5) / 16;
      thr[p] = (order[p] + 0.7 * hash(c, h + 7)) % 1;
    }

    // Each frame: the light, the colour and how much drifting mist there is at
    // every half cell, the mist's texture there, how far the closing mist has
    // taken it, the lattice and the page; a colour that overrides the rest (the
    // red crowns); what of the figure is there; and who owns each character.
    const lum = new Float32Array(N), chroma = new Float32Array(N), cover = new Float32Array(N), tex = new Float32Array(N);
    const ended = new Float32Array(N), took = new Float32Array(N), alpha = new Float32Array(N);
    const fix = new Uint8Array(N), part = new Uint8Array(N), own = new Uint8Array(cols * rows), xs = [];

    // Fill a polygon, given as [column, half row, ...], calling dot(p, c, h)
    // for each half cell whose middle is inside it.
    function polygon(poly, dot) {
      let top = Infinity, bottom = -Infinity;
      for (let i = 1; i < poly.length; i += 2) { top = Math.min(top, poly[i]); bottom = Math.max(bottom, poly[i]); }
      const n = poly.length >> 1;
      for (let h = Math.max(0, Math.ceil(top - 0.5)), e = Math.min(H2 - 1, Math.floor(bottom - 0.5)); h <= e; h++) {
        const y = h + 0.5;
        xs.length = 0;
        for (let i = 0, j = n - 1; i < n; j = i++) {
          const yi = poly[i * 2 + 1], yj = poly[j * 2 + 1];
          if (yi > y !== yj > y) xs.push(poly[i * 2] + ((y - yi) / (yj - yi)) * (poly[j * 2] - poly[i * 2]));
        }
        xs.sort((a, b) => a - b);
        for (let m = 0; m + 1 < xs.length; m += 2) {
          for (let c = Math.max(0, Math.ceil(xs[m] - 0.5)), ce = Math.min(cols - 1, Math.floor(xs[m + 1] - 0.5)); c <= ce; c++) dot(h * cols + c, c, h);
        }
      }
    }
    // Fill a round-ended stroke from (c0, h0) with radius r0 to (c1, h1) with r1, in columns and half rows.
    function capsule(c0, h0, c1, h1, r0, r1, dot) {
      const dc = c1 - c0, dh = h1 - h0, l2 = dc * dc + dh * dh || 1e-9, rr = Math.max(r0, r1);
      for (let h = Math.max(0, Math.floor(Math.min(h0, h1) - rr)), he = Math.min(H2 - 1, Math.ceil(Math.max(h0, h1) + rr)); h <= he; h++) {
        for (let c = Math.max(0, Math.floor(Math.min(c0, c1) - rr)), ce = Math.min(cols - 1, Math.ceil(Math.max(c0, c1) + rr)); c <= ce; c++) {
          const qx = c + 0.5 - c0, qy = h + 0.5 - h0, f = clamp01((qx * dc + qy * dh) / l2), ox = qx - dc * f, oy = qy - dh * f, r = r0 + (r1 - r0) * f;
          if (ox * ox + oy * oy <= r * r) dot(h * cols + c, c, h);
        }
      }
    }

    // The tree: limbs reach in from the lower part of the left edge of the
    // screen and climb to the right, zigzagging and forking into twigs, with a
    // frosting of pale blossom along the upper ones. Wood is [x0, y0, x1, y1,
    // width at the base and at the tip, how far out along the tree the base and
    // the tip are (0 to 1, for the sway), which limb]; a blossom is [x, y, size,
    // how far out, which limb]. All in screen heights.
    const edgeX = -Wu / 2, spanT = Math.min(0.34 * k + 0.12 * Math.max(0, Wu - 0.7), (px(0.24) - edgeX) / 0.7), wood = [], blooms = []; // on a narrow screen it stops short of the figure
    const grow = (x, y, a, len, w, depth, limb, out, bend) => {
      const x1 = x + Math.cos(a) * len, y1 = y + Math.sin(a) * len, o1 = Math.min(1, out + len / spanT);
      wood.push([x, y, x1, y1, w, w * 0.65, out, o1, limb]);
      if (depth >= 2) for (let n = (rand() * 3) | 0; n--; ) { const f = R(0.2, 1); blooms.push([lerp(x, x1, f), lerp(y, y1, f) - 0.005 * k, R(0.5, 1), lerp(out, o1, f), limb]); }
      if (depth >= 4) { blooms.push([x1, y1 - 0.004 * k, R(0.7, 1.3), o1, limb]); return; }
      grow(x1, y1, a + bend * R(0.15, 0.4), len * R(0.65, 0.82), w * 0.65, depth + 1, limb, o1, -bend); // it carries on, bending the other way
      if (depth < 3 || rand() < 0.75) grow(x1, y1, a - R(0.45, 0.95) * (rand() < 0.8 ? 1 : -0.6), len * R(0.5, 0.72), w * 0.55, depth + 1, limb, o1, 1); // and forks, mostly upward
    };
    for (let i = 0; i < 4; i++) grow(edgeX - 0.02, py(0.5 + 0.1 * i) + R(-0.02, 0.02) * k, R(-0.95, -0.7) + 0.13 * i, spanT * R(0.3, 0.4), 0.022 * k, 0, i, 0, rand() < 0.5 ? 1 : -1);
    // A few pale petals let go of the blossom and drift off to the left.
    const petals = Array.from({ length: Math.round(6 + 6 * Math.min(2, Wu)) }, () => {
      const b = blooms[(rand() * blooms.length) | 0];
      return { x: b[0], y: b[1], every: R(2.5, 4.5), at: R(0, 5), vx: R(0.03, 0.07) * k, vy: R(0.008, 0.025) * k, amp: R(0.004, 0.01) * k, f: R(2, 4) };
    });

    // The overlays, which never move: the window lattice along the top, left
    // and right edges of the screen, a column of ink strokes in the upper right
    // where the painting has its calligraphy (strokes, not writing), and two red
    // seals with nothing in them. Paint is [half cell, colour], characters [cell, glyph, colour].
    const over = [], overG = [], L0 = -Wu / 2, R0 = Wu / 2;
    const rail = (x0, x1, h) => { if (h >= 0 && h < H2) for (let c = Math.max(0, Math.floor(colOf(x0))); c < Math.min(cols, Math.ceil(colOf(x1))); c++) over.push(h * cols + c, TONE); };
    for (let h = 0; h < Math.max(1, Math.round(0.026 * H2)); h++) rail(L0, R0, h);
    for (const y of [0.045, 0.068, 0.09]) { rail(L0, L0 + 0.21 * k + 0.04, Math.round(y * H2)); rail(R0 - 0.21 * k, R0, Math.round(y * H2)); }
    for (const y of [0.112, 0.136]) rail(L0, R0, Math.round(y * H2));
    for (const x of [L0 + 0.028, L0 + 0.054, R0 - 0.054, R0 - 0.028]) { const c = Math.max(0, Math.min(cols - 1, Math.floor(colOf(x)))); for (let h = 0; h < H2; h++) over.push(h * cols + c, TONE); }
    const drip = (x, y0, y1) => { const c = Math.floor(colOf(x)); if (c >= 0 && c < cols) for (let r = Math.max(0, Math.round(y0 * rows)); r < Math.min(rows, Math.round(y1 * rows)); r++) overG.push(r * cols + c, BAR, TONE); };
    for (let x = L0 + 0.08; x < L0 + 0.24 * k + 0.04; x += R(0.018, 0.032)) if (rand() < 0.7) drip(x, 0.14, 0.14 + R(0.03, 0.16));
    for (let x = R0 - 0.068; x > R0 - 0.068 - 0.05 * k; x -= R(0.01, 0.02)) for (let y = R(0.15, 0.35); y < 0.95; y += R(0.1, 0.3)) if (rand() < 0.45) drip(x, y, y + R(0.03, 0.09));
    // The calligraphy is one run of brushwork flowing down, pressing and
    // lifting, broken in two places: it reads as ink, never as letters.
    const inkX = R0 - 0.17 * Math.max(0.8, k), inkPh = R(0, 6.28), INK0 = 0.165, INK1 = 0.31;
    for (let y = INK0; y < INK1; y += 1 / H2) { // a half row at a time, the brush wandering a little and pressing harder or softer
      const q = (y - INK0) / (INK1 - INK0), x = inkX + 0.008 * Math.sin(inkPh + q * 9), half = 0.004 + 0.006 * (0.5 + 0.5 * Math.sin(inkPh * 2 + q * 17)), h = Math.floor(y * H2);
      if (Math.abs(q - 0.32) > 0.06 && Math.abs(q - 0.68) > 0.06) for (let c = Math.floor(colOf(x - half)); c <= Math.floor(colOf(x + half)); c++) if (c >= 0 && c < cols && h >= 0 && h < H2) over.push(h * cols + c, TONE);
    }
    for (let y = 0.17; y < 0.31; y += R(0.025, 0.04)) if (rand() < 0.6) { const c = Math.floor(colOf(inkX + 0.05)), r = Math.floor(y * rows); if (c >= 0 && c < cols && r < rows) overG.push(r * cols + c, rand() < 0.6 ? BAR : DASH, TONE); }
    const seal = (x, y, w, tall) => {
      const c0 = Math.round(colOf(x)), h0 = Math.round(y * H2), cw = Math.max(2, Math.round(w * U)), hh = Math.max(2, Math.round(tall * H2));
      for (let h = h0; h < h0 + hh; h++) for (let c = c0; c < c0 + cw; c++) {
        if (c < 0 || c >= cols || h < 0 || h >= H2) continue;
        const n = hash(c, h + 5);
        over.push(h * cols + c, h === h0 || h === h0 + hh - 1 || c === c0 || c === c0 + cw - 1 || n < 0.12 ? SEAL : n < 0.3 ? SEAL + 2 : SEAL + 1);
      }
    };
    seal(px(0.18), py(0.6), 0.018 * k, 0.045 * k);
    seal(inkX - 0.012, 0.335, 0.022, 0.026);

    // The figure, in their own units: u across from the middle of the back and
    // v down from the top of the head to the floor, in their heights.
    const FH = 0.335 * k, sx = FH * U, sy = FH * H2, fc = colOf(px(0.335)), ft = py(0.905) * H2 - sy;
    const strands = Array.from({ length: 5 }, () => { // loose hair streaming on past the end of the blown sheet of it
      const q = R(0.3, 0.95);
      return { u: -0.04 - 0.32 * q, v: 0.17 + 0.15 * q + R(-0.03, 0.03), reach: R(0.1, 0.26), lift: R(-0.03, 0.07), phase: R(0, 6.28) };
    });
    const HAIR = 1, CLOAK = 2;
    function shape(u, v, ph, tilt) { // what of the figure is at (u, v): nothing, hair or cloak
      if (((u - 0.006 - 0.02 * tilt) / 0.058) ** 2 + ((v - 0.066 - 0.03 * tilt) / (0.07 * (1 - 0.25 * tilt))) ** 2 < 1) return HAIR; // the head, tipping back as they look up
      if (v > 0.09 && v < 0.64) { // the hair down the back to the waist, its lower end blown left
        const q = (v - 0.09) / 0.55, mid = -0.09 * q ** 1.5 - 0.014 * q * Math.sin(ph * 1.1 - v * 14);
        if (Math.abs(u - mid) < (0.04 + 0.04 * smooth(0.16, 0.28, v)) * (1 - smooth(0.42, 0.64, v)) + 0.004) return HAIR;
      }
      const q = (-0.04 - u) / 0.32; // the hair streaming out to the left from behind the head and shoulders
      if (q > 0 && q < 1 && Math.abs(v - 0.17 - 0.15 * q - 0.03 * q * Math.sin(ph * 1.25 - q * 6)) < 0.05 * (1 - q) ** 1.4 + 0.004) return HAIR;
      if (v > 0.2 + 0.9 * Math.max(0, Math.abs(u) - 0.04) ** 1.5 && v < 0.975 + 0.012 * Math.sin(ph * 1.3 + u * 30)) { // the cloak, billowing out to the left
        const right = 0.1 + 0.055 * smooth(0.2, 0.45, v) + 0.006 * Math.sin(ph * 1.2 - v * 9);
        const left = -0.08 - 0.39 * clamp01((v - 0.21) / 0.39) ** 0.6 + 0.32 * smooth(0.6, 0.97, v) ** 0.8 + 0.035 * Math.sin(ph - v * 10) * smooth(0.25, 0.5, v) * (1 - smooth(0.85, 1, v));
        if (u >= left && u <= right) return CLOAK;
      }
      return 0;
    }
    function drawFigure(s) {
      const ph = s * WIND * 2 * Math.PI, tilt = smooth(T.step, T.join, s);
      const h0 = Math.max(0, Math.floor(ft) - 1), h1 = Math.min(H2 - 1, Math.ceil(ft + 1.4 * sy));
      const c0 = Math.max(0, Math.floor(fc - 0.52 * sx)), c1 = Math.min(cols - 1, Math.ceil(fc + 0.2 * sx));
      for (let h = h0; h <= h1; h++) {
        const v = (h + 0.5 - ft) / sy;
        for (let c = c0; c <= c1; c++) {
          const p = h * cols + c, u = (c + 0.5 - fc) / sx;
          if (v <= 1) { part[p] = shape(u, v, ph, tilt); continue; }
          part[p] = 0;
          if (kind[p] !== FLOOR) continue;
          const what = shape(u + 0.012 * Math.sin(h * 1.9 + ph), 2 - v, ph, tilt), a = 0.6 * (1 - (v - 1) / 0.4); // the reflection in the floor, rippled and fading
          if (what && a > 0) { lum[p] += ((what === CLOAK ? 0.11 : 0.03) - lum[p]) * a; chroma[p] = what === CLOAK ? 0.6 * a : 0; }
        }
      }
      for (let h = h0; h <= h1; h++) {
        const v = (h + 0.5 - ft) / sy;
        if (v > 1) break;
        for (let c = c0; c <= c1; c++) {
          const p = h * cols + c, what = part[p];
          if (!what) continue;
          const u = (c + 0.5 - fc) / sx;
          let L = 0.03, C = 0;
          if (what === HAIR) L += hash(c, h) < 0.1 ? 0.05 : 0; // a cool sheen here and there
          else {
            C = 1;
            if (!part[p - 1] || !part[p + 1] || !part[p - cols] || !part[p + cols]) L = 0.13; // a dark line round the cloak
            else {
              L = 0.2 + 0.12 * (1 - smooth(0.2, 0.95, v)); // lit from above
              const fold = u < -0.11 ? Math.sin(Math.atan2(v - 0.22, -(u + 0.06)) * 15 - ph * 0.8) : Math.sin(u * 60 + 2 * Math.sin(v * 7 - ph * 0.5));
              if (fold > 0.65) L -= 0.07; else if (fold < -0.9) L += 0.06;
            }
          }
          lum[p] = L; chroma[p] = C; cover[p] = 0; fix[p] = 0;
          const i = (h >> 1) * cols + c;
          glyph[i] = 32; own[i] = 2;
        }
      }
      const at = (u, v) => [fc + u * sx, (ft + v * sy) / 2];
      const pen = (L, C, heavy, need) => (c, r, ch) => {
        if (c < 0 || c >= cols || r < 0 || r >= rows) return;
        const p = (r * 2 + 1) * cols + c, i = r * cols + c;
        if (need && part[p] !== need && part[p - cols] !== need) return;
        glyph[i] = ch; ink[i] = tone(L, C); bold[i] = heavy; own[i] = 2;
      };
      const hair = pen(0.05, 0, 1, 0);
      for (const st of strands) { // loose strands past the end of the streaming hair
        let [a, b] = at(st.u, st.v);
        for (let j = 1; j <= 6; j++) {
          const q = j / 6, [c2, d2] = at(st.u - st.reach * q, st.v + st.lift * q + 0.035 * q * Math.sin(ph * 1.3 - q * 5 + st.phase));
          line(a, b, c2, d2, hair); a = c2; b = d2;
        }
      }
      const fold = pen(0.36, 1, 0, CLOAK);
      for (const [u0, v0, u1, v1] of [[-0.07, 0.26, -0.4, 0.56], [-0.06, 0.3, -0.3, 0.78], [-0.03, 0.34, -0.15, 0.92], [0.06, 0.3, 0.08, 0.94]]) {
        const [a, b] = at(u0, v0), [c2, d2] = at(u1 + 0.02 * Math.sin(ph - v1 * 8), v1);
        line(a, b, c2, d2, fold);
      }
      const sheen = pen(0.17, 0, 0, HAIR);
      for (const du of [-0.015, 0.02]) { const [a, b] = at(du, 0.12), [c2, d2] = at(du - 0.05, 0.5); line(a, b, c2, d2, sheen); }
    }

    // The cranes. Each is drawn in its own units, turned the way it heads and
    // laid on the screen at its size. A pose is: the middle of its body (c, h:
    // column and half row), its distance z and size sc = 1 / z (screen heights
    // to its height), heading, pitch and how steeply we look up at it, how far its wings are spread (0 to 1)
    // and raised (radians), its neck, its legs (hip, knee, foot and side, for
    // each), its plumes (0 drooping, 1 trailing), how far it has faded into the
    // mist, and, for a reflection, the half row of the floor it is mirrored in.
    const legOf = (fx, fy, z) => { // from the hip to the foot, with the knee (a crane's ankle) bent backward between
      const hx = 0.02, hy = -0.07, d = Math.hypot(fx - hx, fy - hy) || 1e-6, m = Math.sqrt(Math.max(0, 0.0484 - (d * d) / 4)); // each half is 0.22 long
      const nx = -(fy - hy) / d, ny = (fx - hx) / d, back = nx > 0 ? -m : m; // across the leg, toward its back
      return [hx, hy, (hx + fx) / 2 + nx * back, (hy + fy) / 2 + ny * back, fx, fy, z];
    };
    const TRAIL = [legOf(-0.74, -0.1, 0.03), legOf(-0.72, -0.13, -0.03)];
    // Until T.join the five fly slowly toward the upper left, the nearer the
    // faster across the screen. Then all six turn and fly straight away from
    // us into the mountains: each shrinks as its distance grows and closes on
    // the point it is heading for, V.
    const V = [px(0.335), py(0.3)];
    const AWAY = 7 / k, EASE = 0.6, SLOW = 0.8; // how fast the distance grows; how long they take to reach that speed, and to stop drifting sideways
    const birds = FLOCK.map(([x, y, size, yaw, phase]) => ({ x: px(x), y: py(y), z: 1 / (size * k), yaw, phase, vx: -0.17 * size * k, vy: -0.065 * size * k }));
    for (const b of birds) { b.jx = b.x + b.vx * T.join; b.jy = b.y + b.vy * T.join; b.jz = b.z; }
    // The standing crane: its size, where its feet are, which way it faces (to
    // the right and a little away), and how far each of its two steps takes it.
    const SIZE = 0.218 * k, stand = [px(0.445), py(0.9)], HEAD = 0.6, STRIDE = 0.17;
    const elevOf = (y) => 0.3 * clamp01((py(0.7) - y) / 0.35); // how steeply we look up at a crane at height y
    const liftAt = [stand[0] + 2 * STRIDE * Math.cos(HEAD) * SIZE, stand[1] - 0.012 * k - 0.48 * SIZE]; // the middle of its body as it leaves the floor
    const joinAt = [px(0.385), py(0.42)], joinZ = 1 / (0.1 * k);
    const P1 = [liftAt[0] + 0.05 * k, liftAt[1] - 0.07 * k], P2 = [joinAt[0] + 0.02 * k, joinAt[1] + 0.035 * k]; // its climb is a curve through these
    const six = { jx: joinAt[0], jy: joinAt[1], jz: joinZ, vx: (3 * (joinAt[0] - P2[0])) / (T.join - T.lift), vy: (3 * (joinAt[1] - P2[1])) / (T.join - T.lift) };
    const flown = [0, 0, 0];
    function away(b, s) { // where a crane is after T.join
      const t = s - T.join, z = b.jz + AWAY * (t - EASE * (1 - Math.exp(-t / EASE))), d = SLOW * (1 - Math.exp(-t / SLOW)), f = b.jz / z;
      flown[0] = V[0] + (b.jx + b.vx * d - V[0]) * f; flown[1] = V[1] + (b.jy + b.vy * d - V[1]) * f; flown[2] = z;
      return flown;
    }
    const yawAway = (b) => Math.PI / 2 + 0.3 * Math.max(-1, Math.min(1, (b.jx - V[0]) / 0.25)); // away from us, and toward V
    const flock = [...birds, six], when = flock.map((b) => away(b, T.fade)[2]);
    flock.forEach((b, i) => { b.gone = T.fade + 0.13 * when.filter((z) => z > when[i]).length; }); // the farthest fades first
    function flyer(b, s, P) {
      if (s < T.join) { P.c = colOf(b.x + b.vx * s); P.h = (b.y + b.vy * s) * H2; P.z = b.z; }
      else { away(b, s); P.c = colOf(flown[0]); P.h = flown[1] * H2; P.z = flown[2]; }
      const turn = smooth(T.join, T.join + 1.4, s);
      P.sc = 1 / P.z; P.yaw = lerp(b.yaw, yawAway(b), turn); P.pitch = lerp(0.2, 0.12, turn); P.elev = elevOf(P.h / H2);
      P.open = 1; P.flap = 0.25 + 0.65 * Math.cos((2 * Math.PI * s) / BEAT + b.phase);
      P.neck = NECK.fly; P.legs = TRAIL; P.trail = 1; P.fade = smooth(b.gone, b.gone + 0.35, s); P.mirror = -1;
    }
    function neckAt(s) {
      if (s <= NECKS[0][0]) return NECK.up;
      for (let j = 1; j < NECKS.length; j++) if (s < NECKS[j][0]) {
        const [t0, a] = NECKS[j - 1], [t1, b] = NECKS[j], w = smooth(t0, t1, s);
        return NECK[a].map((q, n) => [lerp(q[0], NECK[b][n][0], w), lerp(q[1], NECK[b][n][1], w)]);
      }
      return NECK.fly;
    }
    function standing(s, P) {
      const first = smooth(T.step, T.step + 0.45, s), second = smooth(T.step + 0.45, T.lift, s), body = STRIDE * (first + second);
      const up = (t0) => 0.1 * Math.sin(Math.PI * clamp01((s - t0) / 0.45)); // how high a stepping foot is lifted
      const feet = [[0.03 + 2 * STRIDE * first - body, -0.48 + up(T.step)], [-0.03 + 2 * STRIDE * second - body, -0.48 + up(T.step + 0.45)]];
      const floor = stand[1] - 0.012 * k * (first + second) / 2, u = clamp01((s - T.lift) / (T.join - T.lift)), w = smooth(0, 0.35, u);
      P.legs = feet.map(([fx, fy], j) => legOf(lerp(fx, TRAIL[j][4], w), lerp(fy, TRAIL[j][5], w), j ? -0.035 : 0.035)); // the legs swing back to trail as it climbs
      if (s < T.lift) { P.c = colOf(stand[0] + body * Math.cos(HEAD) * SIZE); P.h = (floor - 0.48 * SIZE) * H2; P.z = 1 / SIZE; }
      else if (s < T.join) {
        const a = 1 - u, b0 = a * a * a, b1 = 3 * a * a * u, b2 = 3 * a * u * u, b3 = u * u * u;
        P.c = colOf(b0 * liftAt[0] + b1 * P1[0] + b2 * P2[0] + b3 * joinAt[0]); P.h = (b0 * liftAt[1] + b1 * P1[1] + b2 * P2[1] + b3 * joinAt[1]) * H2;
        P.z = lerp(1 / SIZE, joinZ, u ** 1.2);
      } else { away(six, s); P.c = colOf(flown[0]); P.h = flown[1] * H2; P.z = flown[2]; }
      P.sc = 1 / P.z; P.floor = floor * H2; P.elev = elevOf(P.h / H2);
      P.yaw = lerp(HEAD, yawAway(six), smooth(0.1, 0.9, u));
      P.pitch = 0.42 * smooth(0, 0.25, u) - 0.25 * smooth(0.3, 1, u) - 0.05 * smooth(T.join, T.join + 1.4, s);
      P.open = smooth(T.open, T.open + 0.7, s);
      P.flap = s < T.step ? 0.95 : s < T.lift ? 0.6 + 0.35 * Math.cos((2 * Math.PI * (s - T.step)) / 0.9) // spread high, then a beat over its two steps
        : 0.2 + lerp(0.75, 0.65, smooth(T.join, T.join + 1, s)) * Math.cos((2 * Math.PI * (s - T.lift)) / BEAT); // then slow, strong beats, the first a downstroke
      P.neck = neckAt(s); P.trail = smooth(T.lift, T.lift + 0.5, s); P.fade = smooth(six.gone, six.gone + 0.35, s); P.mirror = -1;
    }

    const v3 = [0, 0, 0];
    function drawCrane(P) {
      const cw = Math.cos(P.yaw), sw = Math.sin(P.yaw), cp = Math.cos(P.pitch), sp = Math.sin(P.pitch), ce = Math.cos(P.elev), se = Math.sin(P.elev), ku = P.sc * U, kh = P.sc * H2;
      const flip = P.mirror >= 0, keep = 1 - P.fade;
      const at = (x, y, z) => { // a point of the crane on the screen, and how far beyond its middle; a crane overhead is seen from below
        const x2 = x * cp - y * sp, y2 = x * sp + y * cp, Z = x2 * sw + z * cw, h = P.h - (y2 * ce - Z * se) * kh;
        v3[0] = P.c + (x2 * cw - z * sw) * ku; v3[1] = flip ? 2 * P.mirror - h : h; v3[2] = y2 * se + Z * ce;
        return v3;
      };
      const poly = (pts) => pts.flatMap(([x, y, z]) => { at(x, y, z); return [v3[0], v3[1]]; });
      const dab = (L) => (p, c, h) => {
        if (flip) { // a reflection: only on the floor below its line, dark, and fading away from it
          const a = 0.5 * keep * (1 - (h - P.mirror) / Math.max(2, 0.7 * kh));
          if (kind[p] === FLOOR && h >= P.mirror && a > 0) lum[p] += (L * 0.75 - lum[p]) * a;
          return;
        }
        lum[p] += (L - lum[p]) * keep; chroma[p] *= P.fade; fix[p] = 0;
      };
      const white = dab(0.95), shade = dab(0.8), black = dab(0.05), legs = dab(0.1);
      const pen = (L, heavy) => (c, r, ch) => {
        if (flip || P.fade > 0.55 || c < 0 || c >= cols || r < 0 || r >= rows) return;
        const i = r * cols + c;
        glyph[i] = ch; ink[i] = tone(lerp(L, lum[(r * 2 + 1) * cols + c], P.fade)); bold[i] = heavy; own[i] = 2;
      };
      const trace = (pts, put) => { for (let j = 1; j < pts.length; j++) { at(...pts[j - 1]); const a = v3[0], b = v3[1] / 2; at(...pts[j]); line(a, b, v3[0], v3[1] / 2, put); } };
      const spread = (shape, side) => shape.map(([x, out]) => { // a wing, opened as far as it is and raised by the beat
        const o = 0.06 + (out - 0.06) * P.open;
        return [x - (1 - P.open) * 0.12 * out, 0.05 + o * Math.sin(P.flap), side * o * Math.cos(P.flap)];
      });
      const drawWing = (side, near) => {
        const inner = spread(INNER, side), tip = spread(TIP, side);
        polygon(poly(inner), near ? white : shade); polygon(poly(tip), black); // the far wing a little in shade
        if (kh >= 3) { trace(inner.slice(0, 3), pen(0.98, 1)); trace(tip.slice(0, 3), pen(0.04, 1)); } // a white leading edge, the black tip and its trailing feathers
        else { trace([inner[0], inner[2]], pen(0.98, 1)); trace(tip.slice(0, 2), pen(0.04, 1)); }
      };
      const drawBody = () => {
        const belly = P.h + 0.02 * kh, fill = (p, c, h) => (h > belly ? shade : white)(p, c, h);
        const ring = (f) => { const pts = []; for (let j = 0; j < 12; j++) pts.push(f(Math.cos((j * Math.PI) / 6), Math.sin((j * Math.PI) / 6))); return poly(pts); };
        polygon(ring((a, b) => [0.24 * a, 0.13 * b, 0]), fill); polygon(ring((a, b) => [0.24 * a, 0, 0.11 * b]), fill); polygon(ring((a, b) => [0, 0.13 * a, 0.11 * b]), fill);
        if (kh < 4) { at(0, 0, 0); const c = Math.floor(v3[0]), h = Math.floor(v3[1]); if (c >= 0 && c < cols && h >= 0 && h < H2) white(h * cols + c, c, h); } // too small to fill: one white dot
      };
      const drawPlumes = () => {
        at(-0.14, 0.03, 0);
        const a = v3[0], b = v3[1];
        PLUMES[0].forEach(([x, y], j) => {
          at(lerp(x, PLUMES[1][j][0], P.trail), lerp(y, PLUMES[1][j][1], P.trail), 0);
          capsule(a, b, v3[0], v3[1], Math.max(0.5, (0.045 - 0.025 * P.trail) * kh), Math.max(0.3, 0.015 * kh), black); // full while it stands, slim in flight
          if (kh >= 5) line(a, b / 2, v3[0], v3[1] / 2, pen(0.04, 1));
        });
      };
      const drawNeck = () => {
        const pts = P.neck, rn = Math.max(0.55, 0.032 * kh);
        for (let j = 1; j < 4; j++) {
          at(pts[j - 1][0], pts[j - 1][1], 0);
          const a = v3[0], b = v3[1];
          at(pts[j][0], pts[j][1], 0);
          capsule(a, b, v3[0], v3[1], rn, rn * 0.85, black);
          if (kh >= 4) line(a, b / 2, v3[0], v3[1] / 2, pen(0.05, 1));
        }
        const [hx, hy] = pts[3], [bx, by] = pts[4], bl = Math.hypot(bx, by) || 1;
        at(hx, hy, 0);
        const c = v3[0], h = v3[1], z = v3[2], rh = 0.05 * kh;
        if (kh >= 5) { at(hx + (bx / bl) * 0.15, hy + (by / bl) * 0.15, 0); line(c, h / 2, v3[0], v3[1] / 2, pen(0.62, 0)); } // the bill
        if (flip || keep < 0.6) return;
        at(0, 0, 0);
        if (z > 0 && Math.hypot(c - v3[0], h - v3[1]) < 1.5) return; // the head is behind the body
        if (rh < 0.8) { const cc = Math.floor(c), hh = Math.floor(h); if (cc >= 0 && cc < cols && hh >= 0 && hh < H2) fix[hh * cols + cc] = RED + 1; } // too small for a black head: a red dot
        else capsule(c, h, c, h, rh, rh, (p, cc, hh) => { black(p, cc, hh); if (hh + 0.5 < h - rh * 0.1) fix[p] = hh + 0.5 < h - rh * 0.6 ? RED + 1 : RED; }); // black, with its red crown on top
      };
      const drawLegs = () => {
        for (const g of P.legs) {
          const pts = [[g[0], g[1], g[6]], [g[2], g[3], g[6]], [g[4], g[5], g[6]]];
          if (kh >= 3) trace(pts, pen(0.1, 1));
          if (0.014 * kh >= 0.5) for (let j = 1; j < 3; j++) { at(...pts[j - 1]); const a = v3[0], b = v3[1]; at(...pts[j]); capsule(a, b, v3[0], v3[1], 0.014 * kh, 0.012 * kh, legs); } // painted only when thick enough to show
        }
      };
      const side = (s) => at(-0.05, 0.05, s * 0.4 * Math.cos(P.flap))[2], far = side(1) > side(-1) ? 1 : -1;
      const parts = [[side(far), () => drawWing(far, false)], [side(-far), () => drawWing(-far, true)], [0, drawBody], [at(0.35, 0.1, 0)[2], drawNeck], [at(-0.3, -0.2, 0)[2], drawLegs], [at(-0.25, -0.05, 0)[2], drawPlumes]];
      parts.sort((a, b) => b[0] - a[0]); // the farthest part first
      for (const [, draw] of parts) draw();
    }
    const poses = Array.from({ length: 7 }, () => ({}));
    function drawCranes(s) {
      birds.forEach((b, i) => flyer(b, s, poses[i]));
      standing(s, poses[5]);
      if (s < T.lift + 0.8) drawCrane(Object.assign(poses[6], poses[5], { mirror: poses[5].floor })); // its reflection, while it is near the floor
      for (const P of poses.slice(0, 6).sort((a, b) => b.z - a.z)) if (P.fade < 1) drawCrane(P);
    }

    function drawTree(s) {
      const sway = (o, limb) => 0.005 * k * o * o * Math.sin(s * 1.6 + limb * 1.9 + o * 2.4); // slight, and most at the tips
      const pen = (L) => (c, r, ch) => { if (c >= 0 && c < cols && r >= 0 && r < rows) { const i = r * cols + c; glyph[i] = ch; ink[i] = tone(L); bold[i] = 1; own[i] = 1; } };
      for (const [x0, y0, x1, y1, w0, w1, o0, o1, limb] of wood) {
        const a0 = sway(o0, limb), a1 = sway(o1, limb), c0 = colOf(x0 - a0 * 0.3), c1 = colOf(x1 - a1 * 0.3), h0 = (y0 + a0) * H2, h1 = (y1 + a1) * H2, L = 0.08 + 0.1 * o1;
        if (w0 * H2 > 1) capsule(c0, h0, c1, h1, (w0 * H2) / 2, Math.max(0.5, (w1 * H2) / 2), (p) => { lum[p] = L; cover[p] = 0; });
        else line(c0, h0 / 2, c1, h1 / 2, pen(L)); // too thin to paint: a line of characters
      }
      for (const [x, y, size, o, limb] of blooms) { // pale blossom, in small clusters
        const a = sway(o, limb), c = colOf(x - a * 0.3), h = (y + a) * H2, rad = Math.max(0.7, size * 0.014 * k * H2);
        capsule(c, h, c, h, rad, rad, (p, cc, hh) => { if (hash(cc, hh + 31) < 0.6) { lum[p] = 0.84 + 0.1 * hash(hh, cc); cover[p] = 0; } });
        const cc = Math.floor(c), r = Math.floor(h / 2);
        if (cc >= 0 && cc < cols && r >= 0 && r < rows && hash(cc, r + 7) < 0.35) { const i = r * cols + cc; glyph[i] = [STAR, TICK, DOT, COLON][(hash(r, cc) * 4) | 0]; ink[i] = tone(0.96); bold[i] = 0; own[i] = 1; }
      }
    }

    function drawPetals(s) {
      for (const q of petals) {
        const t = (s + q.at) % q.every;
        if (t > q.every * 0.85) continue;
        const c = Math.floor(colOf(q.x - q.vx * t + q.amp * Math.sin(t * q.f))), r = Math.floor((q.y + q.vy * t + q.amp * 0.6 * Math.cos(t * q.f * 0.7)) * rows);
        if (c < 0 || c >= cols || r < 0 || r >= rows || own[r * cols + c] === 2) continue;
        const i = r * cols + c;
        glyph[i] = [TICK, DOT, HIGH, COMMA][Math.floor(t * 4 + q.at) & 3]; ink[i] = tone(0.93); bold[i] = 0; own[i] = 1;
      }
    }

    return {
      cols, rows, palette: INK, glyph, ink, bold, paint,
      render(t) { // t: seconds since the animation started
        glyph.fill(32); ink.fill(0); bold.fill(0); paint.fill(0); own.fill(0); fix.fill(0); ended.fill(0); took.fill(0); alpha.fill(1);
        if (t >= LENGTH) return this; // over: nothing is left on the page
        const s = t * SPEED; // where that is in the story
        const fd = MIST * s * U, fi = Math.floor(fd), ff = fd - fi; // how far the mist has drifted, in columns
        for (let h = 0, p = 0; h < floorH; h++) for (let c = 0; c < cols; c++, p++) {
          const j = h * TW + c + fi, tx = mistTex[j] + (mistTex[j + 1] - mistTex[j]) * ff;
          let L = kind[p] === FALL ? 0.8 + 0.14 * hash(c, Math.floor(h - s * 9)) : base[p], m = 0; // a waterfall runs down
          if (mistW[p]) { m = mistW[p] * smooth(0.32, 0.72, tx); L += (0.84 + 0.12 * tx - L) * m; }
          lum[p] = L; chroma[p] = 0; cover[p] = m; tex[p] = tx;
        }
        for (let h = floorH, p = floorH * cols; h < H2; h++) { // the floor: dark glass, mirroring what stands beyond it
          const m = Math.max(0, 2 * floorH - 1 - h) * cols, dim = 0.55 - (0.25 * (h - floorH)) / Math.max(1, H2 - floorH);
          for (let c = 0; c < cols; c++, p++) { lum[p] = 0.12 + (lum[m + c] - 0.12) * dim + (h === floorH ? 0.1 : 0); chroma[p] = 0; cover[p] = 0; tex[p] = tex[m + c]; }
        }
        drawTree(s);
        drawCranes(s);
        drawFigure(s);
        drawPetals(s);
        if (s > T.thick - 0.1) { // the ending: the mist from the right thickens over the whole scene, then takes the lattice, ink and seals, then thins away behind itself
          for (let h = 0, p = 0; h < H2; h++) for (let c = 0; c < cols; c++, p++) {
            const lag = 1 - (c + 0.5) / cols, a = T.thick + 0.4 * lag + 0.2 * (tex[p] - 0.5), e = smooth(a, a + 0.25, s); // lag: 0 at the right edge, where the mist comes from
            lum[p] += (0.86 + 0.12 * tex[p] - lum[p]) * e; chroma[p] *= 1 - e;
            if (e > 0.5) fix[p] = 0;
            const b = T.thick + 0.55 + 0.25 * lag, d = T.thick + 0.85 + 0.3 * lag + 0.1 * (tex[p] - 0.5); // the overlays go once the figure is under the mist; the page shows by T.end
            ended[p] = e; took[p] = smooth(b, b + 0.2, s); alpha[p] = 1 - smooth(d, d + 0.25, s);
          }
        }
        for (let r = 0, i = 0; r < rows; r++) for (let c = 0; c < cols; c++, i++) { // the scene's characters
          const p = (r * 2 + 1) * cols + c, q = p - cols, gone = Math.max(ended[p], ended[q]), m = Math.max(cover[p], cover[q]);
          if (alpha[p] < 0.75 || gone > 0.55) { glyph[i] = 32; continue; }
          if (own[i]) continue;
          if (kind[p] === FALL && m < 0.5) { const f = hash(c, Math.floor(r - s * 4.5)); if (f < 0.5) { glyph[i] = f < 0.28 ? BAR : f < 0.42 ? COLON : TICK; ink[i] = tone(0.97); } }
          else if (mark[i] && m < 0.4) { glyph[i] = mark[i]; ink[i] = tone(lerp(markL[i], lum[p], m * 2)); }
          else if (m > 0.6 || gone > 0.3) { // a wisp, drifting with the mist it is in
            const slot = Math.floor((c + fd) / 3);
            if (hash(slot, r * 7 + 3) < 0.04) { glyph[i] = hash(slot, r + 9) < 0.6 ? WAVE : DASH; ink[i] = tone(lum[p] - 0.1); }
          }
        }
        for (let p = 0; p < N; p++) { // into the palette, dithered like dry brush
          if (alpha[p] < 1) { const a = Math.floor(alpha[p] * 8 + order[p]); paint[p] = a > 0 ? THIN + Math.min(8, a) : 0; continue; }
          if (fix[p]) { paint[p] = fix[p]; continue; }
          const l = Math.floor(lum[p] * (NL - 1) + thr[p]), C = chroma[p];
          paint[p] = TONE + (l < 0 ? 0 : l > NL - 1 ? NL - 1 : l) * NC + (C > 0 ? Math.min(NC - 1, Math.floor(C * (NC - 1) + ((thr[p] + 0.5) % 1))) : 0);
        }
        for (let j = 0; j < over.length; j += 2) { const p = over[j]; if (alpha[p] === 1 && took[p] <= order[p]) paint[p] = over[j + 1]; } // the overlays, until the mist takes them
        for (let j = 0; j < overG.length; j += 3) {
          const i = overG[j], p = (((i / cols) | 0) * 2 + 1) * cols + (i % cols);
          if (alpha[p] === 1 && took[p] < 0.4) { glyph[i] = overG[j + 1]; ink[i] = overG[j + 2]; bold[i] = 0; }
        }
        return this;
      },
    };
  }

  // Play it on the stage. Resolves when it has finished. `seed` changes the
  // details, not the layout: the cliffs off to the sides and their waterfalls,
  // the lie of the mist, the branches and their blossom, the hair's loose
  // strands and the ink strokes. `freezeAt` holds one moment (in seconds) on
  // screen. Reduced motion holds the standing crane with its wings spread.
  const film = { length: LENGTH, still: 3.3 / SPEED, createScene };
  return { play: (options) => AsciiStage.play(film, options), createScene };
})();
