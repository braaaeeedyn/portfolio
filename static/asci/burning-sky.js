/*
 * Beneath the burning sky: an ASCII loading screen.
 *
 *   <script src="ascii-stage.js"></script>
 *   <script src="burning-sky.js"></script>
 *   <script>BurningSky.play().then(showThePage);</script>
 *
 * A figure in torn robes stands with its back to us on a cracked plain,
 * facing a sun at the heart of a vortex of cloud. An army lines the horizon
 * and rocks hang in the air. The camera holds, pushes in toward the figure's
 * back, passes it on its right, tilts up over the army and flies up the
 * vortex straight at the sun, until the sun's light fills the screen. Then
 * the light burns away from the edges to show the page. Five seconds
 * (LENGTH, below).
 *
 * The scene is built in three dimensions, in metres: the figure stands at the
 * origin facing +z, toward the sun, with y up and x to its right. Every half
 * cell is a ray from the camera through a wide, slightly fisheye lens
 * (stereographic), and the ground, the army and the clouds are found along
 * it; the figure, the rocks, the spears and the banners are projected through
 * the same lens. The whole animation is a pure function of time:
 * createScene().render(t) fills a grid of characters and the colours behind
 * them, and the stage (ascii-stage.js) paints that grid on a canvas.
 */
const BurningSky = (() => {
  'use strict';
  const { code, clamp01, lerp, smooth, mulberry32, hash, noise } = AsciiStage;

  // The story's timeline, in seconds at the pace it was written.
  const T = {
    push: 1.5,   // the camera starts forward, toward the figure's back
    pass: 4.0,   // it passes the figure, on the figure's right
    climb: 5.0,  // the figure is behind it; it tilts up and climbs over the army
    tunnel: 6.5, // it flies up the vortex, aimed at the sun
    swell: 8.5,  // the sun swells
    solid: 9.0,  // until its light fills the screen
    end: 10,     // and that light has burnt away from the edges, leaving the page
  };
  // It is played faster than that: LENGTH seconds on screen, SPEED times the story's pace.
  const LENGTH = 5, SPEED = T.end / LENGTH;

  // Colours: gold, amber and orange for the light; bronze and dark brown for the
  // clouds; deep red-brown and black for the ground and every silhouette.
  // `swatch` adds a run of colours and gives the index of the first.
  const INK = ['#000000'];
  const swatch = (...colours) => INK.push(...colours) - colours.length;
  const SKY = swatch('#1d0e07', '#2a150a', '#381d0d', '#482611', '#5a3015', '#6e3b19', '#85481e', '#9e5724',
    '#b8692b', '#d07e33', '#e4963d', '#f2ae4b', '#fac564', '#ffdc8a', '#ffeeba'); // cloud and light, from the dark corners to the gold-white by the sun
  const TOP_TONE = 14;
  const SUN = swatch('#fff7e0', '#ffe8a8'); // the sun's disc, and the ring round it
  const EARTH = swatch('#0d0504', '#170807', '#220c09', '#2e110c', '#3b170f', '#4b1e13', '#5d2717', '#72321c'); // the red-brown ground, from underfoot to the dust at the horizon
  const SHADE = swatch('#070403', '#0e0705', '#241209', '#311a0e', '#3f2214', '#4f2c19'); // silhouettes: the figure, the rocks, then the army rank by rank back into the dust
  const RIM = swatch('#4a230f', '#7a3d14'); // silhouette edges lit by the sun, faint and brighter
  const DUST = swatch('rgba(226,128,48,0.12)', 'rgba(232,140,54,0.21)', 'rgba(238,154,62,0.3)', 'rgba(244,168,72,0.4)') - 1; // golden dust round the army: DUST + 1 to DUST + 4
  const GLOW = swatch('#fff4d4'); // the sun's light when it fills the screen
  const EMBER = swatch('#ff8f1f', '#ffab38', '#ffca60'); // the edge of that light as it burns away
  const VEIL = swatch('rgba(255,244,212,0)'); // the light rising over everything as the sun swells: set every frame

  const [BAR, SLASH, BACK, DASH, LOW, WAVE, TICK, HIGH, COMMA, DOT, STAR] = code("|/\\-_~`',.*");
  const STREAK = [DASH, BACK, BAR, SLASH]; // a line across the screen, turned by 0, 45, 90 and 135 degrees (y down)
  const SPARK = code(".'`,*");

  // The world, in metres and radians.
  const DEG = Math.PI / 180;
  const RISE = 35.7 * DEG;                       // the sun's height above the horizon
  const SY = Math.sin(RISE), SZ = Math.cos(RISE); // the way to the sun: straight ahead and up (x is 0)
  const FOV = 50 * DEG;                           // what the middle square of the screen sees, from its middle to its edge
  const LIFT = 17.7 * DEG;                        // the sun starts this far above the middle: a third of the way down the square
  const EYE = 0.8, SHOULDER = 1.45;               // the camera's height at first (the source image is taken from the hip), and as it pushes in
  const BACKOFF = 4.5;                            // how far behind the figure it starts
  const SIDE = 0.9;                               // how far to the figure's right it passes
  const BEND = 5.5, CURVE = 14;                   // the climb starts this far along, just past the figure, on a curve of this radius
  const TUBE = 25;                                // the vortex: a tube of cloud this wide round the line the camera ends up flying, toward the sun
  const RANKS = [10, 11.2, 12.6, 14.2];           // the army's ranks: circles round the figure, nearest first
  const GAP = 35 * DEG;                           // no army within this angle of straight behind the figure, where the camera starts
  const TWIST = 1 / 2500;                         // the vortex's spiral: how far round its pattern turns for each metre toward the sun

  // How fast the camera goes, in metres a second of the story: from standing
  // still to a rush into the sun. Tabulated as the distance travelled.
  const PACE = [[T.push, 0], [2.5, 0.9], [3.25, 1.8], [4, 2.8], [4.5, 3.6], [5, 5.5], [5.75, 12], [6.5, 24], [7.5, 60], [8.5, 150], [T.end, 600]];
  const STEP = 1 / 240;
  const TRAVEL = new Float32Array(Math.ceil(T.end / STEP) + 2);
  for (let i = 1, k = 0; i < TRAVEL.length; i++) {
    const t = (i - 0.5) * STEP;
    while (k < PACE.length - 2 && t > PACE[k + 1][0]) k++;
    const [t0, v0] = PACE[k], [t1, v1] = PACE[k + 1];
    TRAVEL[i] = TRAVEL[i - 1] + (t < t0 ? 0 : lerp(v0, v1, clamp01((t - t0) / (t1 - t0)))) * STEP;
  }
  const travelled = (t) => { const k = Math.max(0, Math.min(TRAVEL.length - 2, t / STEP)), i = k | 0; return lerp(TRAVEL[i], TRAVEL[i + 1], k - i); };

  // Where the camera is after travelling l metres: straight on from behind the
  // figure, rising to shoulder height and drifting out to the figure's right;
  // past it, up a curve onto the vortex's axis (which starts at AXIS and runs
  // toward the sun), and up that.
  const AXIS = [SIDE, SHOULDER + CURVE * (1 - SZ), BEND - BACKOFF + CURVE * SY];
  function place(l, out) {
    if (l <= BEND) {
      const z = l - BACKOFF;
      out[0] = SIDE * smooth(-BACKOFF, -0.6, z); out[1] = lerp(EYE, SHOULDER, smooth(-BACKOFF, -1.6, z)); out[2] = z;
      return;
    }
    const a = Math.min(RISE, (l - BEND) / CURVE), on = Math.max(0, l - BEND - CURVE * RISE);
    out[0] = SIDE; out[1] = SHOULDER + CURVE * (1 - Math.cos(a)) + on * SY; out[2] = BEND - BACKOFF + CURVE * Math.sin(a) + on * SZ;
  }
  // How far the camera is tilted up: at first the sun sits a third of the way
  // down the screen; from the climb on it is dead centre.
  const pitch = (t) => RISE - LIFT * (1 - smooth(4.7, 6.4, t));
  // The sun's radius, in radians: steady, a little larger in the vortex, then swelling past the screen's corners.
  const sunSize = (t) => (3.2 + 2.6 * smooth(T.tunnel, T.swell, t)) * DEG + 2.6 * smooth(T.swell, T.solid, t) ** 2.2;

  function createScene({ cols, rows, aspect = 2, seed = 3 }) {
    const rand = mulberry32(seed), R = (a, b) => a + (b - a) * rand();
    const lines = rows * 2, N = cols * lines, half = aspect / 2; // half cells: each is `half` columns tall
    const palette = INK.slice(); // this scene's own copy: the veil changes every frame
    const glyph = new Uint8Array(cols * rows), ink = new Uint8Array(cols * rows), bold = new Uint8Array(cols * rows);
    const wash = new Uint8Array(cols * rows), veil = new Uint8Array(cols * rows), paint = new Uint8Array(N);
    const far = new Float32Array(N);    // how far off the thing seen in each half cell is
    const kind = new Uint8Array(N);     // what it is: one of the kinds below
    const edge = new Float32Array(N);   // on cloud, how strongly an edge lit by the sun shows; on the ground, how near a ridge's crest (-1: a crack)
    const dust = new Float32Array(N);   // how much golden dust the ray passes through
    const mark = new Int32Array(N);     // which patch of cloud or ground it is, so that their glyphs move with them
    const near = new Float32Array(cols * rows); // how far off the glyph in each cell is, so that the nearest one wins
    const CLOUD = 0, LIGHT = 1, GROUND = 2, ARMY = 3, ROCK = 7, FIGURE = 8; // ARMY + rank for each rank

    // The lens. The screen's middle square (as wide as the shorter of its width
    // and height) sees FOV either way from the middle; a wider or taller screen
    // sees farther round, squeezed toward its edges as a fisheye squeezes. Each
    // half cell's ray, in the camera's own frame: x right, y up, z ahead.
    const side = Math.min(cols, rows * aspect) / 2, cx = cols / 2, cy = (rows * aspect) / 2, lens = Math.tan(FOV / 2);
    const rayX = new Float32Array(N), rayY = new Float32Array(N), rayZ = new Float32Array(N);
    const order = new Float32Array(N); // the ending: when each half cell burns, from 0 (the corners) to 1 (the middle)
    let first = Infinity, last = -Infinity;
    for (let h = 0, i = 0; h < lines; h++) for (let c = 0; c < cols; c++, i++) {
      const X = (c + 0.5 - cx) / side, Y = (cy - (h + 0.5) * half) / side, r = Math.hypot(X, Y);
      const th = 2 * Math.atan(r * lens), k = r > 1e-9 ? Math.sin(th) / r : 0;
      rayX[i] = X * k; rayY[i] = Y * k; rayZ[i] = Math.cos(th);
      order[i] = -Math.hypot((X * side) / cx, (Y * side) / cy) + 0.3 * noise(X * 2.6 + 9, Y * 2.6 + 3) + 0.05 * hash(c, h);
      first = Math.min(first, order[i]); last = Math.max(last, order[i]);
    }
    for (let i = 0; i < N; i++) order[i] = (order[i] - first) / (last - first);

    // The camera: where it is and how far it is tilted up (it never turns
    // sideways). `now` is this frame's; `before` is a moment earlier, for the
    // streaks behind rocks.
    const now = { x: 0, y: 0, z: 0, cp: 1, sp: 0 }, before = { ...now }, spot = [0, 0, 0];
    function pose(t, view) {
      place(travelled(t), spot);
      const p = pitch(t);
      view.x = spot[0]; view.y = spot[1]; view.z = spot[2]; view.cp = Math.cos(p); view.sp = Math.sin(p);
    }
    // Where the point (x, y, z) is seen from `view`: out[0] its column, out[1]
    // its half row, out[2] how many columns a metre spans there, out[3] how far
    // off it is. False if it is too far round behind the camera to draw.
    function project(x, y, z, out, view = now) {
      const qx = x - view.x, qy = y - view.y, qz = z - view.z;
      const b = qy * view.cp - qz * view.sp, f = qy * view.sp + qz * view.cp, d = Math.sqrt(qx * qx + qy * qy + qz * qz);
      if (d < 1e-3 || f < -0.7 * d) return false;
      const k = 1 / ((d + f) * lens), w = (qx * qx + b * b) / ((d + f) * (d + f));
      out[0] = cx + qx * k * side; out[1] = (cy - b * k * side) / half; out[2] = (side * (1 + w)) / (2 * lens * d); out[3] = d;
      return true;
    }

    // The clouds are a pattern on the inside wall of the vortex: TU texels
    // round it, and along it toward the sun STRIDE metres to the texel,
    // repeating every TV texels. Lumps of cloud, drawn out toward the sun.
    const TU = 256, TV = 512, STRIDE = 0.8, ROUND = 30, ALONG = 30; // ROUND lumps fit round it, ALONG along one repeat
    const cloud = new Float32Array(TU * TV);
    const looped = (x, y, px, py, salt) => { // smooth noise that repeats every px by py
      const xi = Math.floor(x), yi = Math.floor(y), u = smooth(0, 1, x - xi), v = smooth(0, 1, y - yi);
      const at = (i, j) => hash((((i % px) + px) % px) + salt, ((j % py) + py) % py);
      return lerp(lerp(at(xi, yi), at(xi + 1, yi), u), lerp(at(xi, yi + 1), at(xi + 1, yi + 1), u), v);
    };
    for (let j = 0; j < TV; j++) for (let i = 0; i < TU; i++) {
      let n = 0;
      for (let o = 0, f = 1, a = 0.57; o < 3; o++, f *= 2, a /= 2) n += a * looped((i / TU) * ROUND * f, (j / TV) * ALONG * f, ROUND * f, ALONG * f, seed * 977 + o * 131);
      cloud[j * TU + i] = n;
    }
    const shape = (n) => smooth(0.42, 0.62, n), core = (n) => smooth(0.5, 0.85, n); // where there is cloud, and how deep into it
    // The light between the clouds, by the angle from the sun: gold-white beside
    // it, darkening to brown toward the corners. Tabulated by sin(angle / 2).
    const AIR = new Float32Array(1025), FADE = new Float32Array(1025);
    for (let k = 0; k <= 1024; k++) {
      const angle = 2 * Math.asin(k / 1024);
      AIR[k] = 12.6 - 10.5 * Math.pow(Math.min(angle, 2.2) / 1.6, 0.7);
      FADE[k] = smooth(0.12, 0.45, angle); // close to the sun the clouds melt into its light
    }
    // The glow of the dusty air over the horizon, by how far a ray points above
    // or below it; and a sine, for the shimmer. Tabulated: every half cell needs them.
    const HAZE = Float32Array.from({ length: 1024 }, (_, k) => Math.exp(-k / 1024 / 0.09));
    const SINE = Float32Array.from({ length: 1024 }, (_, k) => Math.sin((k / 1024) * 2 * Math.PI)), TURN = 1024 / (2 * Math.PI);
    // The pattern u turns round and v texels along, smooth between texels: how
    // much cloud there is, and (left in `rim`) how strongly an edge there faces
    // the sun, where the cloud ends a few texels farther toward it.
    const RIM_STEP = 3 / STRIDE, field = new Float32Array(TU * TV * 2);
    for (let j = 0; j < TV; j++) for (let i = 0; i < TU; i++) {
      const y = j + RIM_STEP, j0 = Math.floor(y), f = y - j0, ahead = lerp(cloud[(j0 % TV) * TU + i], cloud[((j0 + 1) % TV) * TU + i], f);
      field[(j * TU + i) * 2] = cloud[j * TU + i]; field[(j * TU + i) * 2 + 1] = Math.max(0, shape(cloud[j * TU + i]) - shape(ahead));
    }
    let rim = 0;
    const sample = (u, v) => {
      const x = u * TU, xi = Math.floor(x), yi = Math.floor(v), fx = x - xi, fy = v - yi;
      const i = (xi & (TU - 1)) * 2, i1 = ((xi + 1) & (TU - 1)) * 2, j = (yi & (TV - 1)) * TU * 2, j1 = ((yi + 1) & (TV - 1)) * TU * 2;
      const a = j + i, b = j + i1, c = j1 + i, d = j1 + i1;
      rim = lerp(field[a + 1] + (field[b + 1] - field[a + 1]) * fx, field[c + 1] + (field[d + 1] - field[c + 1]) * fx, fy);
      return lerp(field[a] + (field[b] - field[a]) * fx, field[c] + (field[d] - field[c]) * fx, fy);
    };
    // The ground's ripples and cracks need two noises in every half cell it
    // covers: the stage's `noise`, read from a table of its lattice instead of hashing.
    const LATTICE = Float32Array.from({ length: 1 << 16 }, (_, k) => hash(k & 255, k >> 8));
    const groundNoise = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), u = smooth(0, 1, x - xi), v = smooth(0, 1, y - yi);
      const a = (xi & 255) | ((yi & 255) << 8), b = ((xi + 1) & 255) | ((yi & 255) << 8), c = (xi & 255) | (((yi + 1) & 255) << 8), d = ((xi + 1) & 255) | (((yi + 1) & 255) << 8);
      return lerp(lerp(LATTICE[a], LATTICE[b], u), lerp(LATTICE[c], LATTICE[d], u), v);
    };

    // The army: ranks standing on circles round the figure, each a skyline of
    // shoulders, heads and helmets (SPAN heights to the turn, by the angle from
    // straight ahead). Spears and banners are strokes of their own.
    const SPAN = 2048, skyline = RANKS.map(() => new Float32Array(SPAN)), spears = [], banners = [];
    const index = (a) => Math.floor((a / (2 * Math.PI) + 0.5) * SPAN) & (SPAN - 1);
    RANKS.forEach((radius, rank) => {
      const line = skyline[rank], per = SPAN / (2 * Math.PI * radius); // samples to the metre along the rank
      const raise = (at, x0, x1, top) => { // lift the skyline from x0 to x1 metres either side of the angle `at` to top(x)
        for (let s = Math.floor(x0 * per); s <= x1 * per; s++) { const j = (index(at) + s) & (SPAN - 1); line[j] = Math.max(line[j], top(s / per)); }
      };
      for (let a = -Math.PI + GAP + R(0, 0.3) / radius; a < Math.PI - GAP; ) {
        const big = rand() < 0.06 ? 1.3 : 1, w = R(0.24, 0.32) * big, body = R(1.45, 1.7) * big, head = R(0.13, 0.16) * big, helm = rand();
        const at = a + w / radius, crown = body + 0.06 + head * 1.1;
        raise(at, -w, w, (x) => body - 0.1 - 0.3 * (x / w) ** 2); // shoulders
        raise(at, -head, head, (x) => body + 0.06 + Math.sqrt(Math.max(0, head * head - x * x)) * 1.1); // a head
        if (helm < 0.25) raise(at, -head * 0.6, head * 0.6, (x) => crown + 0.14 * (1 - Math.abs(x) / (head * 0.6))); // a pointed helm
        else if (helm < 0.45) raise(at, -head * 1.3, head * 1.3, (x) => crown - 0.03 + 0.06 * (1 - (x / (head * 1.3)) ** 2)); // a broad crest
        const by = at + ((rand() < 0.5 ? -1 : 1) * w * 0.8) / radius; // a hand at the soldier's side
        const x = Math.sin(by) * radius, z = Math.cos(by) * radius, tx = Math.cos(by), tz = -Math.sin(by);
        if (rank && rand() < 0.05) { // a banner, its flag flying to one side along the rank
          const fly = rand() < 0.5 ? -1 : 1;
          banners.push({ x, z, tx: tx * fly, tz: tz * fly, rank, top: R(2.8, 3.3), w: R(0.6, 0.9), h: R(0.35, 0.5), phase: R(0, 6.28) });
        } else if (rand() < 0.2) spears.push({ x, z, tx, tz, rank, lean: R(-0.2, 0.2), tip: R(2.3, 2.9) });
        a += (2 * w + R(-0.04, 0.12)) / radius;
      }
    });
    const top = Math.max(...skyline.map((line) => line.reduce((m, y) => Math.max(m, y), 0))); // the army's tallest point
    // Golden dust hanging round the army: motes that drift and bob.
    const motes = Array.from({ length: 150 }, () => ({
      a: R(-Math.PI + GAP, Math.PI - GAP), r: R(6.5, 16), y: 0.15 + 3 * rand() ** 2, drift: R(-0.02, 0.02), bob: R(0, 6.28),
      glyph: SPARK[(rand() * 4) | 0], tone: 10 + ((rand() * 3) | 0),
    }));

    // Rocks hanging in the air: some about the start, and more beside the
    // camera's climb, to streak past. All of them are to the left and right in
    // the opening view, clear of the sun and the figure; none is in the
    // camera's way, or out beyond the vortex's wall. Each is a jagged outline
    // that drifts up and turns slowly.
    const path = [];
    for (let t = 0; t <= T.solid; t += 0.05) { place(travelled(t), spot); path.push(t, spot[0], spot[1], spot[2]); }
    const rocks = [];
    const addRock = (x, y, z, size) => {
      const lift = R(0.08, 0.3), ax = x - AXIS[0], ay = y - AXIS[1], az = z - AXIS[2], along = ay * SY + az * SZ;
      if (y < size + 0.4 || Math.abs(x) < 0.47 * (z + BACKOFF) || ax * ax + ay * ay + az * az - along * along > (TUBE - size - 1) ** 2) return false;
      for (let i = 0; i < path.length; i += 4) if (Math.hypot(path[i + 1] - x, path[i + 2] - y - lift * path[i], path[i + 3] - z) < size + 1.5) return false;
      const n = 5 + ((rand() * 4) | 0);
      rocks.push({ x, y, z, size, lift, shape: Float32Array.from({ length: n }, () => R(0.5, 1)), spin: R(0, 6.28), turn: R(-0.35, 0.35), tumble: R(0, 6.28), roll: R(-0.6, 0.6) });
      return true;
    };
    for (let k = 0, tries = 0; k < 40 && tries < 500; tries++) { // about the start, left and right in turn
      const az = (k & 1 ? 1 : -1) * R(26, 85) * DEG, el = R(1, 38) * DEG, d = 8 * Math.exp(R(0, Math.log(7)));
      if (addRock(Math.sin(az) * Math.cos(el) * d, EYE + Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d - BACKOFF, d * R(0.008, 0.035))) k++;
    }
    for (let k = 0, tries = 0; k < 26 && tries < 500; tries++) { // beside the climb, just wide of the opening view's middle, larger the farther on
      const l = R(6, 45);
      place(l, spot);
      const wide = 0.49 * (spot[2] + BACKOFF) + R(0.3, 5);
      if (addRock((k & 1 ? 1 : -1) * wide, spot[1] + R(-2, 4), spot[2] + R(-2, 2), R(0.15, 0.45) * (1 + l / 25))) k++;
    }

    // The figure, seen from behind: chains of points, each with a radius,
    // drawn as runs of capsules. The body, arms and hands hold still; the hair,
    // the sleeves, the hems and the torn strips move with the wind, which
    // rushes out from the sun: toward the camera, and out to both sides.
    const chains = [];
    const chain = (n, r0, r1, move) => chains.push({ n, move, pts: new Float32Array(3 * n), rad: Float32Array.from({ length: n }, (_, j) => lerp(r0, r1, j / (n - 1))) });
    const still = (r0, r1, ...pts) => { chain(pts.length / 3, r0, r1, null); chains[chains.length - 1].pts.set(pts); };
    const set = (p, j, x, y, z) => { p[j * 3] = x; p[j * 3 + 1] = y; p[j * 3 + 2] = z; };
    still(0.1, 0.1, 0, 1.6, 0.02, 0, 1.71, 0.02);      // head
    still(0.06, 0.07, 0, 1.47, 0, 0, 1.6, 0.02);        // neck
    still(0.17, 0.15, 0, 1.36, 0, 0, 0.98, 0);          // body
    still(0.075, 0.075, -0.19, 1.41, 0, 0.19, 1.41, 0); // shoulders
    for (const s of [-1, 1]) { // arms held out from the body, hands open and low
      still(0.065, 0.045, s * 0.2, 1.41, 0, s * 0.43, 1.17, 0.04, s * 0.66, 0.95, 0.07);
      still(0.04, 0.032, s * 0.66, 0.95, 0.07, s * 0.73, 0.87, 0.08);
      for (const [fx, fy, fz] of [[0.5, -1, -0.1], [0.2, -1, 0.05], [-0.1, -1, 0.15], [-0.5, -0.6, 0.25]]) // fingers spread, the thumb turned in
        still(0.016, 0.01, s * 0.73, 0.87, 0.08, s * (0.73 + fx * 0.1), 0.87 + fy * 0.1, 0.08 + fz * 0.1);
    }
    // Wild, tangled hair: tendrils that rise from the head and curl, whipped
    // outward to both sides by the wind.
    for (let k = 0; k < 64; k++) {
      const out = k & 1 ? 1 : -1, a = R(0.1, 1.5), sx = out * Math.cos(a), sy = Math.sin(a), sz = R(-0.4, 0.2); // where it leaves the head: from its side to its crown
      const len = R(0.07, 0.12), curl = (rand() < 0.5 ? -1 : 1) * R(0.3, 0.75), phase = R(0, 6.28), whip = R(2.2, 3.8);
      chain(6, 0.04, 0.01, (t, p) => {
        let x = sx * 0.1, y = 1.66 + sy * 0.11, z = 0.02 + sz * 0.1, dx = sx, dy = sy;
        set(p, 0, x, y, z);
        for (let j = 1; j < 6; j++) {
          const turn = curl * (0.4 + 0.15 * j) + 0.25 * Math.sin(t * whip + phase + j * 1.3), c = Math.cos(turn), s = Math.sin(turn);
          const ex = dx * c - dy * s + out * 0.25, ey = dx * s + dy * c, l = Math.hypot(ex, ey); // curling more toward the tip, and pulled outward
          dx = ex / l; dy = ey / l;
          set(p, j, (x += dx * len), (y += dy * len), (z -= len * 0.3));
        }
      });
    }
    // The robe: panels from the waist to the ground, the hem torn into points;
    // over it a shorter, more ragged cloak from the shoulders; wide sleeves.
    for (let k = 0; k < 9; k++) {
      const f = k / 8 - 0.5, fx = f * 0.9 + R(-0.04, 0.04), fy = R(0, 0.2), fz = R(-0.09, -0.01), phase = R(0, 6.28);
      chain(3, 0.08, 0.045, (t, p) => {
        const sway = Math.sin(t * 2.6 + phase), lift = 0.5 + 0.5 * Math.sin(t * 3.3 + phase * 1.7);
        set(p, 0, f * 0.34, 1.12, 0); set(p, 1, f * 0.62 + sway * 0.015, 0.6, -0.03); set(p, 2, fx + sway * 0.04, fy + lift * 0.04, fz - lift * 0.08);
      });
    }
    for (let k = 0; k < 5; k++) {
      const f = k / 4 - 0.5, end = R(0.4, 0.8), phase = R(0, 6.28);
      chain(3, 0.08, 0.025, (t, p) => {
        const flap = Math.sin(t * 3 + phase);
        set(p, 0, f * 0.3, 1.4, -0.12); set(p, 1, f * 0.46, (1.4 + end) / 2, -0.16 - 0.03 * flap); set(p, 2, f * (0.62 + 0.1 * flap), end + 0.04 * flap, -0.22 - 0.06 * flap);
      });
    }
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { // rags hanging from the forearms, clear of the body
      const at = 0.55 + 0.2 * k, len = R(0.12, 0.22), phase = R(0, 6.28);
      const x = s * lerp(0.2, 0.66, at), y = lerp(1.41, 0.95, at), z = lerp(0, 0.07, at);
      chain(3, 0.04, 0.01, (t, p) => {
        const flap = Math.sin(t * 3.4 + phase);
        set(p, 0, x, y, z); set(p, 1, x + s * len * (0.35 + 0.1 * flap), y - len * 0.55, z - len * 0.25); set(p, 2, x + s * len * (0.8 + 0.2 * flap), y - len * (0.9 - 0.15 * flap), z - len * 0.45);
      });
    }
    // Torn strips of cloth streaming out to both sides, longest to the left:
    // [where each is attached, x y z; the way it streams, x y z; length; half its width].
    const STRIPS = [
      [-0.66, 0.95, 0.07, -1, -0.3, -0.35, 1.9, 0.1], [-0.34, 0.72, -0.04, -1, -0.35, -0.3, 1.5, 0.1], [-0.5, 1.15, -0.06, -1, 0.05, -0.5, 1.2, 0.08],
      [0.66, 0.95, 0.07, 1, -0.2, -0.4, 1.3, 0.1], [0.32, 0.7, -0.04, 1, -0.35, -0.35, 1.0, 0.09], [0.45, 1.3, -0.08, 1, 0.1, -0.45, 1.5, 0.07],
    ];
    for (const [ax, ay, az, hx, hy, hz, length, width] of STRIPS) {
      const m = Math.hypot(hx, hy, hz), phase = R(0, 6.28);
      chain(10, width, width * 0.25, (t, p) => {
        for (let j = 0; j < 10; j++) {
          const f = j / 9, l = f * length, wave = Math.sin(6.28 * (f - t * 0.9) + phase) * f * length * 0.09;
          set(p, j, ax + (hx / m) * l, ay + (hy / m) * l + wave, az + (hz / m) * l + wave * 0.6 * Math.cos(phase + f * 3));
        }
      });
    }

    // A glyph in cell (c, r) for something `d` metres off: it shows if nothing
    // nearer fills the cell or holds a glyph there.
    function put(c, r, g, colour, d) {
      if (c < 0 || c >= cols || r < 0 || r >= rows) return;
      const i = r * cols + c, top = 2 * r * cols + c;
      if (d >= near[i] || (d >= far[top] && d >= far[top + cols])) return;
      near[i] = d; glyph[i] = g; ink[i] = colour; bold[i] = 1; // bold: a dark line needs the weight to show against the light
    }
    // Something too thin to fill a half cell is a line of glyphs, each chosen
    // by where the line crosses its cell: | / \ for steep runs, _ - ' , . for
    // shallow ones. Ends in cells: c columns, r rows.
    function line(c0, r0, c1, r1, colour, d) {
      const dc = c1 - c0, dr = r1 - r0, wide = Math.abs(dc), high = Math.abs(dr), rising = dc * dr < 0;
      if (wide <= high * 1.3) { // steep: one glyph a row
        const lo = Math.min(r0, r1), hi = Math.max(r0, r1);
        for (let r = Math.floor(lo); r < hi; r++) {
          const ya = Math.max(lo, r), yb = Math.min(hi, r + 1), cover = yb - ya;
          if (cover < 0.25) continue;
          const ca = c0 + (dc * (ya - r0)) / dr, cb = c0 + (dc * (yb - r0)) / dr;
          const stub = cover < 0.6 ? ((ya + yb) / 2 - r > 0.5 ? (rising ? COMMA : DOT) : HIGH) : 0;
          put(Math.floor((ca + cb) / 2), r, stub || (Math.floor(ca) === Math.floor(cb) ? BAR : rising ? SLASH : BACK), colour, d);
        }
        return;
      }
      const lo = Math.min(c0, c1), hi = Math.max(c0, c1), slope = high / wide; // shallow: one glyph a column
      for (let c = Math.floor(lo); c < hi; c++) {
        const xa = Math.max(lo, c), xb = Math.min(hi, c + 1);
        if (xb - xa < 0.35) continue;
        const y = r0 + (dr * ((xa + xb) / 2 - c0)) / dc, r = Math.floor(y), f = y - r;
        if (slope > 0.6) put(c, r, rising ? SLASH : BACK, colour, d);
        else if (slope > 0.2) put(c, r, f < 0.36 ? (rising ? HIGH : TICK) : f > 0.64 ? (rising ? COMMA : DOT) : DASH, colour, d);
        else if (f < 0.3) put(c, r - 1, LOW, colour, d);
        else put(c, r, f > 0.7 ? LOW : DASH, colour, d);
      }
    }
    // A capsule from a to b (each as `project` gives it) with radii ra and rb
    // in metres: filled, at least a half cell thick, where it is thicker than
    // `solid` columns, nearer things hiding farther ones; a line of glyphs where not.
    function capsule(a, ra, b, rb, colour, what, solid = 0.5) {
      let r0 = ra * a[2], r1 = rb * b[2]; // radii in columns
      if (Math.max(r0, r1) < solid) return line(a[0], a[1] / 2, b[0], b[1] / 2, colour, Math.min(a[3], b[3]));
      r0 = Math.max(r0, 0.5); r1 = Math.max(r1, 0.5);
      const x0 = a[0], y0 = a[1] * half, dx = b[0] - x0, dy = b[1] * half - y0, len2 = dx * dx + dy * dy || 1e-9;
      const c0 = Math.max(0, Math.floor(Math.min(x0 - r0, x0 + dx - r1))), c1 = Math.min(cols - 1, Math.floor(Math.max(x0 + r0, x0 + dx + r1)));
      const h0 = Math.max(0, Math.floor(Math.min(y0 - r0, y0 + dy - r1) / half)), h1 = Math.min(lines - 1, Math.floor(Math.max(y0 + r0, y0 + dy + r1) / half));
      for (let h = h0; h <= h1; h++) {
        const py = (h + 0.5) * half - y0;
        for (let c = c0, i = h * cols + c0; c <= c1; c++, i++) {
          const px = c + 0.5 - x0, k = clamp01((px * dx + py * dy) / len2), ox = px - dx * k, oy = py - dy * k, r = r0 + (r1 - r0) * k;
          if (ox * ox + oy * oy > r * r) continue;
          const d = a[3] + (b[3] - a[3]) * k;
          if (d >= far[i]) continue;
          far[i] = d; kind[i] = what; paint[i] = colour; dust[i] = 0;
        }
      }
    }
    // A run of capsules along points of a chain (x, y, z three to a point),
    // split where the lens bends a long run.
    const A = new Float32Array(4), B = new Float32Array(4), C = new Float32Array(4), D = new Float32Array(4);
    function run(p, rad, n, colour, what, solid) {
      let ok = project(p[0], p[1], p[2], A);
      for (let j = 1; j < n; j++) {
        const okB = project(p[j * 3], p[j * 3 + 1], p[j * 3 + 2], B);
        if (ok && okB) {
          const split = Math.min(6, Math.ceil(Math.hypot(B[0] - A[0], (B[1] - A[1]) * half) / 8));
          if (split <= 1) capsule(A, rad[j - 1], B, rad[j], colour, what, solid);
          else {
            C.set(A);
            for (let m = 1; m <= split; m++) {
              const f = m / split, q = (j - 1) * 3;
              if (!project(lerp(p[q], p[q + 3], f), lerp(p[q + 1], p[q + 4], f), lerp(p[q + 2], p[q + 5], f), D)) break;
              capsule(C, lerp(rad[j - 1], rad[j], (m - 1) / split), D, lerp(rad[j - 1], rad[j], f), colour, what, solid);
              C.set(D);
            }
          }
        }
        A.set(B); ok = okB;
      }
    }
    // Fill an outline of n corners (xs in columns, ys in half rows) at distance d.
    function polygon(xs, ys, n, colour, d, what) {
      let c0 = Infinity, c1 = -Infinity, h0 = Infinity, h1 = -Infinity;
      for (let k = 0; k < n; k++) { c0 = Math.min(c0, xs[k]); c1 = Math.max(c1, xs[k]); h0 = Math.min(h0, ys[k]); h1 = Math.max(h1, ys[k]); }
      for (let h = Math.max(0, Math.floor(h0)); h <= Math.min(lines - 1, h1); h++) {
        for (let c = Math.max(0, Math.floor(c0)); c <= Math.min(cols - 1, c1); c++) {
          const x = c + 0.5, y = h + 0.5, i = h * cols + c;
          let inside = false;
          for (let k = 0, m = n - 1; k < n; m = k++) if (ys[k] > y !== ys[m] > y && x < xs[k] + ((xs[m] - xs[k]) * (y - ys[k])) / (ys[m] - ys[k])) inside = !inside;
          if (inside && d < far[i]) { far[i] = d; kind[i] = what; paint[i] = colour; dust[i] *= 0.5; }
        }
      }
    }

    // The world behind everything else: for every half cell, where its ray
    // meets the ground, the army or the vortex's wall, or reaches the sun.
    function drawWorld(t) {
      const { x: ox, y: oy, z: oz, cp, sp } = now;
      const ax = ox - AXIS[0], ay = oy - AXIS[1], az = oz - AXIS[2], along = ay * SY + az * SZ; // the camera, from the start of the vortex's axis
      const px = ax, py = ay - along * SY, pz = az - along * SZ, pc = px * px + py * py + pz * pz - TUBE * TUBE; // and off it
      const turn = t / T.end / 8;   // the vortex turns an eighth of the way round, clockwise as we see it
      const sunR = sunSize(t), inside = 1.5 * smooth(6, 7.6, t) + TOP_TONE * smooth(T.swell, T.solid, t); // the sun's radius; the light inside the vortex, which turns gold-white as the sun swells
      const disc = Math.sin(Math.min(Math.PI / 2, sunR / 2)) * 1024, ring = Math.sin(Math.min(Math.PI / 2, sunR * 0.725)) * 1024; // the sun's disc and the ring round it, as the tables measure angles
      const flat = Math.hypot(ox, oz), reach = flat < RANKS[0] ? RANKS[0] - flat : Math.max(0, flat - RANKS[RANKS.length - 1]); // how far across the ground the nearest rank is
      const settle = 1 - smooth(3, 12, oy); // the dust is thinner seen from above it
      for (let h = 0, i = 0; h < lines; h++) for (let c = 0; c < cols; c++, i++) {
        const dx = rayX[i], dy = rayY[i] * cp + rayZ[i] * sp, dz = rayZ[i] * cp - rayY[i] * sp, across = Math.sqrt(dx * dx + dz * dz);
        const grain = (((c & 1) * 2 + (h & 1) * 3) % 4) * 0.17 - 0.25; // ordered dither between neighbouring tones
        let hit = Infinity, what = CLOUD;
        if (dy < 0) { // the ground, if the ray reaches it inside the vortex
          const g = -oy / dy, wx = ox + g * dx - AXIS[0], wy = -AXIS[1], wz = oz + g * dz - AXIS[2], ws = wy * SY + wz * SZ;
          if (wx * wx + wy * wy + wz * wz - ws * ws < TUBE * TUBE) { hit = g; what = GROUND; }
        }
        // the army: only for rays still below its tallest point where they reach the nearest rank
        if (across > 1e-6 && (dy < 0 ? hit * across > reach : oy + (reach / across) * dy < top)) {
          const b = ox * dx + oz * dz, a2 = across * across;
          for (let k = 0; k < RANKS.length; k++) {
            const disc = b * b - a2 * (flat * flat - RANKS[k] * RANKS[k]);
            if (disc <= 0) continue;
            const root = Math.sqrt(disc);
            for (let s = -1; s <= 1; s += 2) {
              const tt = (-b + s * root) / a2, y = oy + tt * dy;
              if (tt <= 0.05 || tt >= hit || y < 0 || y >= top) continue;
              if (y < skyline[k][index(Math.atan2(ox + tt * dx, oz + tt * dz))]) { hit = tt; what = ARMY + k; break; }
            }
          }
        }
        const toSun = dy * SY + dz * SZ, k = Math.min(1023.99, Math.sqrt(Math.max(0, (1 - toSun) / 2)) * 1024), j = k | 0, f = k - j; // sin(angle from the sun / 2), for the tables
        let colour, haze;
        edge[i] = 0;
        if (k < ring) { colour = k < disc ? SUN : SUN + 1; what = LIGHT; hit = Infinity; haze = 0; }
        else if (what === CLOUD) { // where the ray meets the vortex's wall: how far up its axis, and how far round
          const qx = dx, qy = dy - toSun * SY, qz = dz - toSun * SZ, a2 = qx * qx + qy * qy + qz * qz, b = px * qx + py * qy + pz * qz;
          hit = a2 > 1e-9 ? (-b + Math.sqrt(Math.max(0, b * b - a2 * pc))) / a2 : 1e6;
          const s = along + hit * toSun, round = Math.atan2((py + hit * qy) * SZ - (pz + hit * qz) * SY, px + hit * qx) / (2 * Math.PI);
          const u = round + turn + TWIST * (s - along), v = s / STRIDE, n = sample(u, v), body = shape(n);
          const low = settle * HAZE[Math.min(1023, (Math.abs(dy) * 1024) | 0)], clear = lerp(FADE[j], FADE[j + 1], f) * (1 - low); // near the horizon, seen from near the ground: bright dusty air over the army
          const lit = Math.min(1, clear * rim * 3); // the edge of a cloud that faces the sun
          const shimmer = 0.85 + 0.15 * SINE[((t * 4.4 + u * 37 + v * 0.3) * TURN) & 1023];
          const tone = lerp(AIR[j], AIR[j + 1], f) + inside + 3.5 * low - (3.5 * body + 2.5 * core(n)) * clear + 6 * lit * shimmer;
          colour = SKY + Math.max(0, Math.min(TOP_TONE, Math.floor(tone + grain)));
          edge[i] = lit; haze = 0.6 * low; mark[i] = (Math.floor(u * 160) & 255) + 256 * (Math.floor(v / 2) & 1023);
        } else if (what === GROUND) { // flat, cracked earth in ripples, darkest underfoot, hazy far off
          const gx = ox + hit * dx, gz = oz + hit * dz, off = hit * across, sharp = 1 - smooth(4, 16, off);
          const ridge = sharp > 0 ? SINE[((gz * 4.4 + gx * 0.8 + groundNoise(gx * 0.35 + 50, gz * 0.35) * 5) * TURN) & 1023] * sharp : 0;
          const crack = sharp > 0.3 && Math.abs(groundNoise(gx * 1.4 + 9, gz * 1.4 + 4) - 0.5) < 0.03;
          const tone = 1.2 + 6 * smooth(0.5, 20, off) + (ridge > 0.5 ? 2 * ridge : ridge < -0.5 ? 0.6 * ridge : 0) - (crack ? 1.5 : 0);
          colour = EARTH + Math.max(0, Math.min(7, Math.floor(tone + grain)));
          edge[i] = crack ? -1 : ridge; haze = 0.6 * smooth(5, 18, off); mark[i] = (Math.floor(gx * 3) & 1023) + 1024 * (Math.floor(gz * 3) & 1023);
        } else { colour = SHADE + 2 + what - ARMY; haze = 0.3 * smooth(5, 18, hit * across); } // the army, paler rank by rank into the dust
        paint[i] = colour; kind[i] = what; far[i] = hit; dust[i] = haze * settle;
      }
    }

    // The army's spears and banners: a spear is held upright at a soldier's
    // side; a banner is a pole with a swallow-tailed flag flying along the rank.
    const fx = new Float32Array(5), fy = new Float32Array(5);
    function drawGear(t) {
      for (const s of spears) {
        if (project(s.x, 0.9, s.z, A) && project(s.x + s.tx * s.lean, s.tip, s.z + s.tz * s.lean, B)) capsule(A, 0.025, B, 0.015, SHADE + 2 + s.rank, ARMY + s.rank);
      }
      for (const f of banners) {
        if (!project(f.x, 0.9, f.z, A) || !project(f.x, f.top, f.z, B)) continue;
        const colour = SHADE + 2 + f.rank, d = B[3], wave = Math.sin(t * 2.3 + f.phase), rx = f.x / RANKS[f.rank], rz = f.z / RANKS[f.rank];
        capsule(A, 0.03, B, 0.025, colour, ARMY + f.rank);
        const ex = f.x + f.tx * f.w + rx * 0.12 * wave, ey = f.top + 0.05 * wave, ez = f.z + f.tz * f.w + rz * 0.12 * wave; // the free end, lifting and rippling
        const corners = [f.x, f.top, f.z, ex, ey, ez, lerp(f.x, ex, 0.72), ey - f.h / 2, lerp(f.z, ez, 0.72), ex, ey - f.h, ez, f.x, f.top - f.h, f.z];
        let ok = true;
        for (let k = 0; k < 5 && ok; k++) { ok = project(corners[k * 3], corners[k * 3 + 1], corners[k * 3 + 2], C); fx[k] = C[0]; fy[k] = C[1]; }
        if (ok) polygon(fx, fy, 5, colour, d, ARMY + f.rank);
      }
    }

    // Rocks: each a dark, jagged outline, turning and tumbling, lit along the
    // side that faces the sun; a speck where it is too small for that. One the
    // camera rushes past leaves a streak.
    function drawRocks(t, sunRow) {
      for (const k of rocks) {
        const y = k.y + k.lift * t;
        if (!project(k.x, y, k.z, A)) continue;
        const rad = k.size * A[2];
        if (project(k.x, y - k.lift * 0.12, k.z, B, before) && Math.hypot(A[0] - B[0], (A[1] - B[1]) * half) > 2.5) line(B[0], B[1] / 2, A[0], A[1] / 2, RIM, A[3] + k.size);
        if (rad < 0.5) { put(Math.floor(A[0]), Math.floor(A[1] / 2), rad < 0.25 ? DOT : HIGH, SHADE + 1, A[3]); continue; }
        const spin = k.spin + k.turn * t, squash = 0.5 + 0.5 * Math.abs(Math.cos(k.tumble + k.roll * t)), cs = Math.cos(spin), sn = Math.sin(spin);
        const n = k.shape.length, sx = cx - A[0], sy = (sunRow - A[1]) * half, sl = Math.hypot(sx, sy) || 1;
        for (let h = Math.max(0, Math.floor(A[1] - rad / half)); h <= Math.min(lines - 1, A[1] + rad / half); h++) {
          for (let c = Math.max(0, Math.floor(A[0] - rad)); c <= Math.min(cols - 1, A[0] + rad); c++) {
            const ex = c + 0.5 - A[0], ey = (h + 0.5 - A[1]) * half, lx = (ex * cs + ey * sn) / rad, ly = (ey * cs - ex * sn) / (rad * squash), d = Math.hypot(lx, ly);
            if (d > 1) continue;
            const a = (Math.atan2(ly, lx) / (2 * Math.PI) + 1) * n, j = Math.floor(a) % n, outline = lerp(k.shape[j], k.shape[(j + 1) % n], a - Math.floor(a));
            const i = h * cols + c;
            if (d > outline || A[3] >= far[i]) continue;
            const facing = (ex * sx + ey * sy) / (sl * rad);
            far[i] = A[3]; kind[i] = ROCK; dust[i] = 0;
            paint[i] = facing > 0.4 && d > outline - 0.4 ? RIM + (facing > 0.7 ? 1 : 0) : SHADE + 1;
          }
        }
      }
    }

    // The figure: near black, the sun behind it catching its upper edges where
    // it is thick enough to have them; thin strands and strips stay black. Its
    // hair is solid where it is a quarter of a column thick, so that the
    // tendrils hold together.
    function drawFigure(t) {
      for (const ch of chains) {
        if (ch.move) ch.move(t, ch.pts);
        run(ch.pts, ch.rad, ch.n, SHADE, FIGURE, 0.25);
      }
      for (let i = cols; i < N - 2 * cols; i++) {
        if (kind[i] === FIGURE && kind[i + cols] === FIGURE && kind[i + 2 * cols] === FIGURE && kind[i - cols] !== FIGURE && kind[i - cols] !== ROCK) paint[i] = RIM + 1;
      }
    }

    // Golden motes hanging in the dust round the army.
    function drawMotes(t) {
      for (const m of motes) {
        const a = m.a + m.drift * t;
        if (!project(Math.sin(a) * m.r, m.y + 0.06 * Math.sin(t * 1.4 + m.bob), Math.cos(a) * m.r, A)) continue;
        const c = Math.floor(A[0]), h = Math.floor(A[1]), i = (h >> 1) * cols + c;
        if (c < 0 || c >= cols || h < 0 || h >= lines || A[3] >= far[h * cols + c] || glyph[i] !== 32) continue;
        glyph[i] = m.glyph; ink[i] = SKY + m.tone; near[i] = A[3];
      }
    }

    // The scene's own glyphs, wherever nothing nearer has put one: on the
    // clouds, streaks running out from the sun, bright along their sunlit
    // edges and dark through their bodies; ridges and cracks on the ground.
    // Each is pinned to its patch of cloud or ground, and a cell split between
    // two things is left clean.
    function worldGlyphs(sunRow) {
      for (let r = 0, i = 0; r < rows; r++) for (let c = 0; c < cols; c++, i++) {
        const top = 2 * r * cols + c, low = top + cols, what = kind[low];
        if (glyph[i] !== 32 || kind[top] !== what || what > GROUND) continue;
        const h = hash(mark[low], 11);
        if (what === CLOUD) {
          const e = Math.max(edge[top], edge[low]), tone = paint[low] - SKY;
          const bright = e > 0.3 && h < 0.75, dark = e < 0.05 && tone > 1 && tone < 8 && h < 0.16;
          if (!bright && !dark) continue;
          const out = Math.atan2((r + 0.5) * aspect - sunRow * half, c + 0.5 - cx); // the way out from the sun, y down
          glyph[i] = STREAK[(Math.round(out / (Math.PI / 4)) + 8) % 4]; ink[i] = bright ? SKY + Math.min(TOP_TONE, tone + 3) : SKY + tone - 2;
        } else if (what === GROUND) {
          if (edge[low] === -1) { if (h < 0.6) { glyph[i] = h < 0.3 ? DOT : COMMA; ink[i] = EARTH; } }
          else if (edge[low] > 0.6 && h < 0.55) { glyph[i] = far[low] > 9 ? DASH : WAVE; ink[i] = Math.min(EARTH + 7, paint[low] + 2); }
        }
      }
    }

    // The thin beam of light through the sun, and the bright point below it.
    function drawSun(t, sunRow) {
      if (t > T.swell) return;
      const radius = ((Math.tan(sunSize(t) / 2) / lens) * side * (1 + Math.tan((RISE - pitch(t)) / 2) ** 2)) / half; // in half rows
      const c = Math.floor(cx), point = Math.floor((sunRow + radius * 3.5) / 2);
      for (let r = Math.max(0, Math.floor((sunRow - radius * 3.3) / 2)); r <= Math.min(rows - 1, (sunRow + radius * 3.9) / 2); r++) {
        const i = r * cols + c;
        if (kind[(2 * r + 1) * cols + c] !== CLOUD || r === point) continue; // light against the sky: not over the disc, or anything in front
        glyph[i] = BAR; ink[i] = Math.abs(r * 2 + 1 - sunRow) < radius * 2.2 ? SUN : SKY + TOP_TONE; bold[i] = 1;
      }
      if (point >= 0 && point < rows && kind[(2 * point + 1) * cols + c] === CLOUD) {
        const i = point * cols + c;
        glyph[i] = STAR; ink[i] = SUN; bold[i] = 1; paint[2 * point * cols + c] = paint[(2 * point + 1) * cols + c] = SUN + 1;
      }
    }

    // The end: the sun's light fills the screen, then burns away from the
    // corners and edges inward, an ember-bright rim running ahead of the page
    // and sparks left behind it. It never dims: gold-white goes straight to the page.
    function burn(t) {
      const k = clamp01((t - T.solid - 0.06) / (T.end - T.solid - 0.06)), front = k * 1.22 - 0.08, band = 0.07;
      for (let i = 0; i < N; i++) {
        const b = order[i] - front;
        paint[i] = b >= band ? GLOW : b >= 0 ? EMBER + Math.min(2, Math.floor((b / band) * 3)) : 0;
      }
      for (let r = 0, i = 0; r < rows; r++) for (let c = 0; c < cols; c++, i++) {
        const gone = front - order[(2 * r + 1) * cols + c], h = hash(c + 4096, r);
        if (gone > 0 && gone < 0.14 && h < 0.4 * (1 - gone / 0.14)) { glyph[i] = SPARK[((h * 1000) % SPARK.length) | 0]; ink[i] = EMBER + (((h * 7919) % 3) | 0); }
      }
    }

    return {
      cols, rows, palette, glyph, ink, bold, paint, wash, veil,
      render(t) { // t: seconds since the animation started
        glyph.fill(32); ink.fill(0); bold.fill(0); paint.fill(0); wash.fill(0); veil.fill(0);
        palette[VEIL] = 'rgba(255,244,212,0)';
        if (t >= LENGTH) return this; // over: nothing is left on the page
        const s = t * SPEED; // where that is in the story
        if (s >= T.solid) { burn(s); return this; }
        pose(s, now); pose(s - 0.12, before);
        near.fill(Infinity);
        const sunRow = (cy - (Math.tan((RISE - pitch(s)) / 2) / lens) * side) / half; // the sun's half row: it is always in the middle column
        drawWorld(s); drawGear(s); drawRocks(s, sunRow); drawFigure(s); drawMotes(s); worldGlyphs(sunRow); drawSun(s, sunRow);
        for (let r = 0, i = 0; r < rows; r++) for (let c = 0; c < cols; c++, i++) { // the golden dust, over the paint and under the glyphs
          const level = Math.round((dust[2 * r * cols + c] + dust[(2 * r + 1) * cols + c]) * 2);
          if (level > 0) wash[i] = DUST + Math.min(4, level);
        }
        const glow = smooth(T.swell + 0.25, T.solid, s); // the sun's light rising over everything, the last step to gold-white
        if (glow > 0) { palette[VEIL] = `rgba(255,244,212,${glow.toFixed(3)})`; veil.fill(VEIL); }
        return this;
      },
    };
  }

  // Play it on the stage. Resolves when it has finished. `seed` changes the
  // clouds, the army, the rocks and the figure's hair; `freezeAt` holds one
  // moment (in seconds) on screen instead of playing. Reduced motion holds the
  // opening view.
  const film = { length: LENGTH, still: 0.6, createScene };
  return { play: (options) => AsciiStage.play(film, options), createScene };
})();
