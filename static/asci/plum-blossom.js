/*
 * Plum blossom: an ASCII loading screen.
 *
 *   <script src="ascii-stage.js"></script>
 *   <script src="plum-blossom.js"></script>
 *   <script>PlumBlossom.play().then(showThePage);</script>
 *
 * On a clear day in the mountains a plum tree grows and blooms on a patch of
 * land in a small lake. A breeze starts taking the blossoms, the wind rises
 * until petals fill the screen solid pink, and then they blow away to show
 * whatever page is underneath. The whole thing lasts five seconds (LENGTH,
 * below).
 *
 * There are two views. The default is flat, like a drawing. With
 * PlumBlossom.play({ view: '3d' }) the same tree is grown in the round and
 * the camera circles it.
 *
 * The whole animation is a pure function of time: createScene().render(t)
 * fills a grid of characters and the colours behind them, and the stage
 * (ascii-stage.js) paints that grid on a canvas.
 */
const PlumBlossom = (() => {
  'use strict';
  const { code, clamp01, lerp, smooth, mulberry32, hash, noise } = AsciiStage;

  // The story's timeline, in seconds at the pace it was written.
  const T = {
    grow: 4.6,    // the tree is fully grown
    breeze: 5.3,  // wind arrives and blossoms start to let go
    storm: 8.8,   // a wall of petals comes in from the left
    pink: 11.2,   // every cell is solid pink
    reveal: 11.9, // the pink starts blowing away
    end: 13.2,
  };
  // It is played faster than that. LENGTH is how many seconds the whole of it
  // takes on screen, and SPEED how many times faster than the story that is.
  const LENGTH = 5, SPEED = T.end / LENGTH;

  // Colours. A cell holds indexes into INK: one for its glyph, one for each
  // half of the cell behind it, and one for the pink that floods over it.
  // `swatch` adds a run of colours and gives the index of the first.
  const INK = ['#000000'];
  const swatch = (...colours) => INK.push(...colours) - colours.length;
  const BARK = swatch('#2a1c18', '#3b2821', '#4a322a', '#5a3d32', '#7d5946', '#a57a62'); // shadow to light
  const SHADE = swatch('#5c1c3a', '#7a2149', '#972353'); // blossom in the shade. PINK follows it, so the two are one ramp of twelve
  const PINK = swatch('#b3235c', '#c92d69', '#dc3f7a', '#e9588e', '#f271a1', '#f88bb3', '#fba3c4', '#fdbbd3', '#ffd2e2'); // blossom, deep to pale
  const WHITE = swatch('#fff6fa');
  const SKY = swatch('#3a86e0', '#4792e5', '#559de9', '#64a9ed', '#74b4f0', '#85bff3', '#97caf5', '#aad5f7', '#bddff9', '#d0e9fb'); // from overhead down to the horizon
  const SUN = swatch('#fff9d6');
  // the far mountains lit and in shade, their snow lit and in shade; then the nearer mountains the same
  const ROCK = swatch('#a3bbe3', '#8ea8d8', '#f7faff', '#dbe6f6', '#7d99cc', '#6683bd', '#eef4fd', '#c9d8ef');
  const HILL = swatch('#6fae8f', '#5b9a82'); // far hills, lit and in shade
  const LEAF = swatch('#74c365', '#57ad58', '#3f964a', '#2c7d3d', '#1f6632'); // forest, from the sunlit tops of the farthest bank to the depths of the nearest
  const TURF = swatch('#8fd65a', '#77c64e'); // meadow
  const SAND = swatch('#e3d49a');
  const LAKE = swatch('#7fdcec', '#63cde9', '#4bbde5', '#39abdf', '#2c98d6', '#2386cb', '#1c75bd'); // from the far bank to the near edge
  const SHOAL = swatch('#9be8ee');
  const GLASS = swatch('#5fc2a2', '#2f8a80', '#4f9fb0'); // the far bank mirrored in the lake: meadow, forest, hills
  const ISLE = swatch('#86d45a', '#69bf4b', '#4a9a3f'); // the tree's patch of land: grass in the sun, grass, grass in shade
  const GOLD = swatch('#ffe66b'), GLINT = swatch('#d2f3fa'); // wild flowers, and light on the water
  // The pink that floods the screen in the storm, in 16 strengths (FLOOD + 1
  // to FLOOD + 16): a deep pink laid ever more thickly over the scene, solid
  // at 8, then paling to the final pink. Going by way of the deep pink keeps
  // the flood from greying out.
  const FLOOD = swatch(...Array.from({ length: 16 }, (_, i) => (i < 7 ? `rgba(150,34,88,${(i + 1) / 8})`
    : `rgb(${[150, 34, 88].map((v, j) => Math.round(v + ([247, 141, 180][j] - v) * ((i - 7) / 8))).join(',')})`))) - 1;

  const [BAR, SLASH, BACK, LOW, DASH, HIGH, TICK, COMMA, DOT, RING] = code('|/\\_-\'`,.o');
  const CORE = code('@@*'), BODY = code('@**o'), STRAY = code('*o'), PETAL = code("',`."), WHOLE = code('*@*o');
  const GRAIN = code(':!;');
  const [WAVE, FIR, TUFT, STAR, COLON] = code('~^"*:');

  // How grown the tree is (0 to 1) at time t: a hesitant start, a slow finish.
  const growth = (t) => { const x = clamp01(t / T.grow); return 0.45 * x + 0.55 * x * x * (3 - 2 * x); };

  // Wind strength at time t: still air, then a gusting breeze, then a gale.
  const wind = (t) =>
    smooth(T.grow - 0.3, T.breeze + 1, t) *
    (1 + 0.35 * Math.sin(t * 2.1 + 0.6) + 0.2 * Math.sin(t * 5.3 + 1.7)) *
    (1 + 4 * smooth(T.storm - 1.5, T.pink - 0.5, t) ** 2);

  // The trunk and limbs are drawn by hand: each is a zigzag of straight runs,
  // given as [heading in degrees (90 is straight up), length], in units where
  // the tree is about 1 tall. Plum wood is angular, so the runs turn sharply.
  // Boughs, twigs and blossom are then grown by rule.
  const TRUNK = [[100, 0.09], [68, 0.1], [104, 0.1]];
  const LIMBS = [ // [limb it leaves (-1 is the trunk), how far along that, width, runs...]
    [-1, 1, 0.045, [136, 0.12], [160, 0.12], [130, 0.13], [156, 0.12], [124, 0.11]],
    [0, 0.1, 0.034, [112, 0.13], [132, 0.12], [104, 0.13], [126, 0.12], [106, 0.11]],
    [-1, 1, 0.042, [92, 0.13], [74, 0.12], [98, 0.13], [78, 0.12], [94, 0.11]],
    [-1, 1, 0.045, [68, 0.13], [46, 0.12], [72, 0.13], [50, 0.12], [70, 0.11]],
    [3, 0.1, 0.034, [48, 0.12], [28, 0.13], [52, 0.12], [30, 0.12], [54, 0.1]],
    [-1, 0.62, 0.042, [36, 0.12], [18, 0.13], [44, 0.12], [20, 0.13], [42, 0.11], [22, 0.1]],
  ];
  // The crown everything grows inside: an ellipse [centre x, centre y, radius x, radius y],
  // and in the 3D view an ellipsoid with the last number as its radius in depth.
  const CROWN = [0.06, 0.52, 0.76, 0.56, 0.7];

  // The 3D view grows the same tree in the round. Its limbs are the hand-drawn
  // ones, each swung about the trunk: [limb, degrees it is swung (0 would leave
  // it flat on the page), how far up the trunk if not where it was drawn]. A
  // drawing has no limbs toward or away from the viewer, so two are used twice.
  const ROUND = [[0, -25], [1, 70], [2, 90], [3, -60], [4, 50], [5, -15], [5, 195, 0.5], [0, -85, 0.85]];
  // The camera circles the tree, level with the middle of the crown, and the
  // wind blows across the picture and slightly toward the camera.
  const SPIN = 0.16; // how fast the camera goes round, in radians a second
  const AWAY = 3.2;  // how far off it stands, in tree heights
  const DRAW = 0.35; // how far the wind is turned toward it, in radians

  // What stands beyond the lake, farthest first: two ranges of mountains, far
  // hills, and three banks of forest, one behind the other. Each is a skyline:
  // [how far off it is, given as the focal length it is seen at in tree sizes
  // (the farther, the faster it slides past as the camera turns), its lowest
  // and highest points, crests to the radian, craggy or rolling, the height
  // its snow starts at, seed]. Heights above the horizon are parts of the sky.
  // Negative ones are below it, as parts of the way down to the far shore.
  const SKYLINE = [
    [3.2, 0.25, 0.85, 3.1, 1, 0.5, 11],
    [2.95, 0.12, 0.5, 4.3, 1, 0.36, 23],
    [2.6, 0.05, 0.2, 5.5, 0, 9, 37],
    [2.2, 0.02, 0.1, 7, 0, 9, 53],
    [2.0, -0.38, -0.08, 8, 0, 9, 71],
    [1.85, -0.8, -0.48, 9, 0, 9, 89],
  ];
  // A skyline's height, 0 to 1, at x: rolling, or with sharp crests on it.
  const skyline = (x, y, craggy) => {
    const roll = noise(x, y) * 0.65 + noise(x * 2.7, y + 5) * 0.35;
    if (!craggy) return roll;
    const fold = 1 - Math.abs(2 * noise(x * 2.3, y + 9) - 1), fine = 1 - Math.abs(2 * noise(x * 6.1, y + 13) - 1);
    return clamp01(roll * 0.4 + fold ** 1.5 * 0.45 + fine * 0.15);
  };

  // Turn the vector v by the rotation r, whose direction is the axis and whose length is the angle.
  const turned = (vx, vy, vz, rx, ry, rz, out) => {
    const q = rx * rx + ry * ry + rz * rz, a = Math.sqrt(q), c = Math.cos(a);
    const s = a > 1e-6 ? Math.sin(a) / a : 1, m = a > 1e-6 ? (1 - c) / q : 0.5, d = (rx * vx + ry * vy + rz * vz) * m;
    out[0] = vx * c + (ry * vz - rz * vy) * s + rx * d;
    out[1] = vy * c + (rz * vx - rx * vz) * s + ry * d;
    out[2] = vz * c + (rx * vy - ry * vx) * s + rz * d;
  };

  // Build the tree at rest, in screen units: rows, y down, root at (rootX, ground),
  // S rows to the unit, with the hand-drawn wood stretched upward by `tall`.
  // Every run of wood has a heading in its own upright plane. On the flat tree
  // that plane is the page. Given `swing` (a second random source) the planes
  // are turned about the vertical, each by its own yaw, and the tree has depth:
  // z, toward the viewer. Returns the branches (parents first) and every blossom.
  function buildTree(rand, S, tall, aspect, rootX, ground, swing) {
    const R = (a, b) => a + (b - a) * rand();
    const pick = (list) => list[(rand() * list.length) | 0];
    const DEG = Math.PI / 180, UP = -90 * DEG;
    const yaw = (mid, play) => (swing ? (mid + (2 * swing() - 1) * play) * DEG : 0); // within `play` degrees of `mid`
    const TAPER = [0.62, 0.3, 0.5, 0.7]; // tip width over base width: trunk, limb, bough, twig
    const tree = [], blooms = [];
    const inCrown = (x, y, z) => {
      const nx = (x - rootX) / S, ny = (ground - y) / (S * tall), nz = z / S;
      return ny > 0.2 && ((nx - CROWN[0]) / CROWN[2]) ** 2 + ((ny - CROWN[1]) / CROWN[3]) ** 2 + (nz / CROWN[4]) ** 2 < 1;
    };
    const skyward = (a, k) => a + Math.atan2(Math.sin(UP - a), Math.cos(UP - a)) * k;
    const shade = (tone) => PINK + Math.max(0, Math.min(7, Math.round(tone + R(-1, 1)))); // the palest pink is kept for the flash of a blossom opening

    // A puff of blossom at a branch tip: full flowers at the heart, looser
    // toward the rim, lit from the upper left. Every cell is one blossom.
    function puff(id, radius) {
      const b = tree[id], a = b.ang[b.ang.length - 1];
      const rx = radius * aspect * 0.85, ry = radius, tone = R(3, 5), wait = R(0.15, 0.6);
      const cx = Math.round(Math.cos(a) * rx * 0.5), cy = Math.round(Math.sin(a) * ry * 0.5); // sits just past the tip
      for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
        for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
          const e = Math.hypot(dx / rx, dy / ry) + R(-0.12, 0.12), rim = e >= 0.85 && dy !== 0;
          if (e > 1.12 || (rim && (Math.abs(dx) < rx * 0.45 || rand() < 0.3))) continue; // the rim is only its corners
          blooms.push({
            b: id, s: b.total, dx: cx + dx, dy: cy + dy, e, body: !rim, wait: wait + Math.max(0, e) * 0.35,
            glyph: e < 0.5 ? pick(CORE) : !rim ? pick(BODY) : dy < 0 ? DOT : dx < 0 ? TICK : HIGH,
            ink: shade(tone - (dx / rx + dy / ry) * 1.6),
          });
        }
      }
    }

    // Single blossoms sitting on the bare wood of a bough.
    function stray(id) {
      const b = tree[id];
      for (let s = b.total * 0.2; s < b.total * 0.85; s += S * 0.012) {
        if (rand() > 0.22) continue;
        blooms.push({ b: id, s, dx: pick([-1, 0, 1]), dy: pick([-1, 0]), e: 1, wait: R(0.3, 0.9), glyph: pick(STRAY), ink: shade(R(3, 5.5)) });
      }
    }

    // Add a branch from (x, y, z) along `runs` of [heading, length, yaw], then whatever grows from it.
    function add(parent, at, x, y, z, runs, width, depth) {
      const b = { parent, at, x, y, z, depth, ang: [], yaw: [], len: [], cum: [0], w0: width, w1: width * TAPER[depth], phase: R(0, 6.28) };
      const pts = [[x, y, z]];
      for (const [a, l, w] of runs) {
        b.ang.push(a); b.yaw.push(w); b.len.push(l); b.cum.push(b.cum[b.cum.length - 1] + l);
        const flat = Math.cos(a) * l;
        pts.push([(x += flat * Math.cos(w)), (y += Math.sin(a) * l), (z += flat * Math.sin(w))]);
      }
      const n = runs.length, id = tree.push(b) - 1;
      b.total = b.cum[n];
      b.mean = Math.atan2(y - b.y, x - b.x);
      b.reach = [x - b.x, y - b.y, z - b.z]; // from base to tip
      b.px = new Float32Array(n + 1);
      b.py = new Float32Array(n + 1);
      b.near = new Float32Array(n + 1); // how near the camera each joint is, and how large that makes it:
      b.size = new Float32Array(n + 1).fill(1); // on the flat tree, no nearer and no larger
      if (depth === 3) puff(id, Math.max(1.25, S * R(0.03, 0.042))); // any smaller and a puff is one row: a word, not a flower
      if (depth === 2) { puff(id, Math.max(1.5, S * R(0.038, 0.055))); stray(id); }
      if (depth === 0 || depth === 3) return id;
      for (let i = 0; i < n; i++) {
        const [x0, y0, z0] = pts[i], [x1, y1, z1] = pts[i + 1];
        if (depth === 1 && rand() < 0.65) { // a shoot straight up from the middle of a limb's run
          const k = R(0.3, 0.7);
          sprout(id, b.cum[i] + b.len[i] * k, lerp(x0, x1, k), lerp(y0, y1, k), lerp(z0, z1, k),
            UP + R(-25, 25) * DEG, S * R(0.05, 0.1), 0, 3, yaw(0, 180));
        }
        const w = lerp(b.w0, b.w1, b.cum[i + 1] / b.total) * 0.65;
        if (i < n - 1) { // an elbow: the side branch carries on the way this one was heading
          const turn = Math.sin(b.ang[i + 1] - b.ang[i]);
          sprout(id, b.cum[i + 1], x1, y1, z1, b.ang[i] - Math.sign(turn) * R(20, 45) * DEG,
            S * (depth === 1 ? R(0.12, 0.2) : R(0.05, 0.09)), w, depth + 1, b.yaw[i] + yaw(0, 70));
        } else if (depth === 1) { // a limb's tip forks into two boughs
          for (const sign of [-1, 1]) {
            sprout(id, b.total, x1, y1, z1, b.ang[i] + sign * R(18, 40) * DEG, S * R(0.1, 0.16), w, 2, b.yaw[i] - sign * yaw(35, 20));
          }
        }
      }
      return id;
    }

    // Grow a zigzag from (x, y, z) and add it, cut short at the edge of the crown.
    function sprout(parent, at, x0, y0, z0, heading, length, width, depth, w) {
      const n = depth === 2 ? pick([2, 2, 3]) : 1, runs = [];
      let x = x0, y = y0, z = z0, a = heading, side = pick([-1, 1]);
      for (let i = 0; i < n; i++, side = -side) {
        a = skyward(a + (i ? side * 28 * DEG * R(0.6, 1.3) : 0), depth === 2 ? 0.2 : 0.35);
        if (i) w += yaw(0, 25);
        let l = (length / n) * R(0.8, 1.2);
        const inside = () => inCrown(x + Math.cos(a) * l * Math.cos(w), y + Math.sin(a) * l, z + Math.cos(a) * l * Math.sin(w));
        if (!inside()) l *= 0.5;
        if (!inside()) break;
        runs.push([a, l, w]);
        x += Math.cos(a) * l * Math.cos(w);
        y += Math.sin(a) * l;
        z += Math.cos(a) * l * Math.sin(w);
      }
      if (runs.length) add(parent, at, x0, y0, z0, runs, width, depth);
    }

    const scaled = (runs, mid, play) => runs.map(([a, l]) => {
      const dx = Math.cos(a * DEG) * l * S, dy = -Math.sin(a * DEG) * l * S * tall;
      return [Math.atan2(dy, dx), Math.hypot(dx, dy), yaw(mid, play)];
    });
    const limbs = [];
    add(-1, 0, rootX, ground, 0, scaled(TRUNK, 0, 180), 0.11 * S, 0);
    for (const [j, turn, leaves] of swing ? ROUND : LIMBS.map((_, j) => [j, 0])) {
      const [from, where, width, ...runs] = LIMBS[j];
      const id = from < 0 ? 0 : limbs[from], parent = tree[id], at = parent.total * (leaves ?? where);
      let x = parent.x, y = parent.y, z = parent.z;
      for (let i = 0; i < parent.len.length; i++) { // walk along the parent to where this limb leaves it
        const l = Math.max(0, Math.min(parent.len[i], at - parent.cum[i])), flat = Math.cos(parent.ang[i]) * l;
        x += flat * Math.cos(parent.yaw[i]);
        y += Math.sin(parent.ang[i]) * l;
        z += flat * Math.sin(parent.yaw[i]);
      }
      limbs.push(add(id, at, x, y, z, scaled(runs, turn, 18), width * S, 1));
    }
    blooms.sort((p, q) => q.e - p.e); // drawn rim first, so where puffs overlap the hearts stay whole
    return { tree, blooms };
  }

  function createScene({ cols, rows, aspect = 2, seed = 13, view }) {
    const round = /^3d$/i.test(view);
    const rand = mulberry32(seed);
    const R = (a, b) => a + (b - a) * rand();
    const glyph = new Uint8Array(cols * rows), ink = new Uint8Array(cols * rows), wash = new Uint8Array(cols * rows);
    const bold = new Uint8Array(cols * rows); // wood is set in bold, and so is the heart of each puff
    const rank = new Float32Array(cols * rows); // what holds each cell: the thicker wood wins and, in 3D, whatever is nearer
    const paint = new Uint8Array(cols * rows * 2); // the colour behind each half cell, top halves on the even lines
    const deep = new Float32Array(cols * rows); // 3D: how near the thing that fills each cell is
    const mark = new Uint8Array(cols * rows), tint = new Uint8Array(cols * rows); // the scene's own glyphs and their colours, for cells the tree leaves empty
    const kind = new Uint8Array(rows * 2), tops = new Float32Array(SKYLINE.length), here = new Int32Array(SKYLINE.length); // one column of the scene: what is in each half row, and how high each skyline stands there
    // Size the tree to the screen. World units are rows: one is `aspect` columns wide.
    // The crown takes three quarters of the width; on a tall screen the limbs
    // reach higher to use the room, and the whole scene sits in the middle.
    const lap = round ? 0.15 : 0.1; // room below the root for the front of its patch of land and the water before it
    const room = (rows - 3.5) / (CROWN[1] + CROWN[3] + lap);
    const S = Math.min(room, ((cols / aspect) * 0.74) / (2 * CROWN[2])), tall = Math.min(1.7, room / S);
    const ground = Math.min(rows - 2, Math.round((rows + (CROWN[1] + CROWN[3] - lap) * S * tall) / 2) + 1);
    const rootX = (cols / aspect) * 0.47 - CROWN[0] * S;
    const { tree, blooms } = buildTree(rand, S, tall, aspect, rootX, ground, round ? mulberry32(seed + 0x3d) : null);

    // Growth schedule: a branch starts when its parent's tip reaches it, and
    // then takes time in proportion to its length. g runs from 0 to 1.
    const PACE = [0.75, 0.5, 0.8, 1.1]; // time per length: trunk, limb, bough, twig
    const passed = (b, s) => b.g0 + (b.g1 - b.g0) * (1 - Math.sqrt(1 - Math.min(0.999, s / b.total))); // g when b's tip is s along
    let last = 0;
    for (const b of tree) {
      b.g0 = b.parent < 0 ? 0 : passed(tree[b.parent], b.at);
      b.g1 = b.g0 + (b.total / S) * PACE[b.depth] + 0.02;
      last = Math.max(last, b.g1);
    }
    for (const b of tree) { b.g0 /= last; b.g1 /= last; }
    const whenGrown = (g) => {
      let lo = 0, hi = T.grow;
      for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (growth(mid) < g) lo = mid; else hi = mid; }
      return hi;
    };
    for (const f of blooms) f.open = whenGrown(passed(tree[f.b], f.s)) + f.wait;

    // Where every branch is, at growth g and time t. Wind bends each branch
    // toward the right, and a branch carries everything that grows from it.
    const FLEX = [0, 0.016, 0.05, 0.11];
    const grow = (b, g) => { const k = (g - b.g0) / (b.g1 - b.g0); return (b.grown = k <= 0 ? 0 : b.total * (k >= 1 ? 1 : k * (2 - k))); };
    function poseFlat(g, t) {
      for (const b of tree) {
        const n = b.len.length;
        if (!grow(b, g)) continue;
        let x = b.x, y = b.y;
        b.turn = 0;
        if (b.parent >= 0) {
          const p = tree[b.parent], [px, py, i] = at(p, b.at);
          x = px; y = py;
          b.turn = p.turn + (p.bend * (i + 1)) / p.len.length;
        }
        const w = Math.min(3, wind(t - b.x * 0.012)); // gusts travel left to right through the crown
        b.bend = FLEX[b.depth] * w * (0.5 * Math.sin(t * 3.3 + b.phase) - Math.sin(b.mean + b.turn));
        b.px[0] = x; b.py[0] = y;
        for (let i = 0; i < n; i++) {
          const a = b.ang[i] + b.turn + (b.bend * (i + 1)) / n;
          b.px[i + 1] = x += Math.cos(a) * b.len[i];
          b.py[i + 1] = y += Math.sin(a) * b.len[i];
        }
      }
    }
    // The point a distance s along a posed branch, which run it is on, and how far through that run.
    function at(b, s) {
      let i = 0;
      while (i < b.len.length - 1 && s > b.cum[i + 1]) i++;
      const f = (s - b.cum[i]) / b.len[i];
      return [lerp(b.px[i], b.px[i + 1], f), lerp(b.py[i], b.py[i + 1], f), i, f];
    }

    // The same pose in 3D, worked out as the camera sees it: x across from the
    // root, y down, z toward the camera. The camera going round the tree is the
    // tree turning, so the camera's angle is added to the yaw of every run. A
    // turn or a bend is now a small rotation, and `look` sets a point in
    // perspective on the page.
    const away = AWAY * S, eye = ground - CROWN[1] * S * tall, windX = Math.cos(DRAW), windZ = Math.sin(DRAW);
    const spinAt = (t) => SPIN * (t - T.breeze - 0.7); // square on to the tree as built at the moment reduced motion holds still
    const seen = [0, 0, 0], v = [0, 0, 0]; // seen: x and y on the page (in rows), and how large
    function look(x, y, z) {
      const k = away / (away - z);
      seen[0] = rootX + x * k; seen[1] = eye + (y - eye) * k; seen[2] = k;
    }
    // The scene is seen from above the water, so the lake lies flat between the
    // horizon and the bottom of the screen with the tree's patch of land in the
    // middle of it. In 3D the eye is the camera. The drawing looks from lower.
    const u = S * tall, crest = ground - (CROWN[1] + CROWN[3]) * u; // rows to one unit of the tree's height, and the row of the top of its crown
    const horizon = round ? eye : ground - 0.3 * u, above = Math.max(0.5, ground - horizon); // the row level with the eye, and how far that is above the water
    const sky = Math.max(2, horizon - crest); // skylines are measured in parts of this: the rows from the top of the crown down to the horizon
    const isle = 0.55 * S, shore = 3.6 * S; // how far from the trunk the land ends, and the lake
    const span = (above * away) / (away + shore); // rows from the horizon down to the far shore
    const turns = round ? [spinAt(0), spinAt(T.pink)] : [0, 0]; // how far round the camera gets
    // Each skyline is worked out once, two heights to the column, for every
    // direction the camera will look in. Far things slide to the right as the
    // camera goes round, so the direction seen in a column is x / F - spin.
    const lines = SKYLINE.map(([focal, low, high, crests, craggy, snow, seed], l) => {
      const F = Math.max(1, focal * S), per = 2 * F * aspect, from = -rootX / F - turns[1] - 0.3;
      const top = new Float32Array(Math.ceil((cols / aspect / F + turns[1] - turns[0] + 0.6) * per) + 18);
      for (let i = 0; i < top.length; i++) {
        const a = (from + i / per) * crests;
        top[i] = lerp(low, high, skyline(a, seed, craggy)) * (low < 0 ? span / sky : 1) + (l > 2 ? 0.03 * (1 - Math.abs(2 * noise(a * 9, seed + 3) - 1)) : 0); // forest has treetops
      }
      return { F, per, from, top, snow };
    });
    const pan = new Float32Array(rows); // how many columns the water in each row slides for a radian of the camera's turn
    for (let r = 0; r < rows; r++) pan[r] = away * (1 - (r + 0.5 - horizon) / above) * aspect;

    if (round) for (const b of tree) {
      const [x, y, z] = b.reach, l = Math.hypot(x, y, z);
      b.aim = [Math.hypot(x, z) / l, y / l, Math.atan2(z, x)]; // the way it points at rest: how level, how steep, its yaw
      b.joint = new Float32Array(3 * b.len.length + 3); // x, y, z of every joint
      b.turn = [0, 0, 0]; b.bend = [0, 0, 0];
    }
    function poseRound(g, t) {
      const spin = spinAt(t);
      for (const b of tree) {
        const n = b.len.length, J = b.joint, tw = b.turn, bw = b.bend;
        if (!grow(b, g)) continue;
        let x = 0, y = b.y, z = 0;
        tw.fill(0);
        if (b.parent >= 0) {
          const p = tree[b.parent], [, , i, f] = at(p, b.at), P = p.joint, share = (i + 1) / p.len.length;
          x = lerp(P[i * 3], P[i * 3 + 3], f); y = lerp(P[i * 3 + 1], P[i * 3 + 4], f); z = lerp(P[i * 3 + 2], P[i * 3 + 5], f);
          for (let j = 0; j < 3; j++) tw[j] = p.turn[j] + p.bend[j] * share;
        }
        // the bend is about the axis that carries the branch round toward the wind
        turned(b.aim[0] * Math.cos(b.aim[2] + spin), b.aim[1], b.aim[0] * Math.sin(b.aim[2] + spin), tw[0], tw[1], tw[2], v);
        const ax = v[1] * windZ, ay = v[2] * windX - v[0] * windZ, az = -v[1] * windX;
        const w = FLEX[b.depth] * Math.min(3, wind(t - (rootX + x) * 0.012));
        const rock = 1 + (0.5 * Math.sin(t * 3.3 + b.phase)) / Math.max(0.05, Math.hypot(ax, ay, az));
        bw[0] = w * rock * ax; bw[1] = w * rock * ay; bw[2] = w * rock * az;
        J[0] = x; J[1] = y; J[2] = z;
        for (let i = 0; i < n; i++) {
          const share = (i + 1) / n, flat = Math.cos(b.ang[i]), yaw = b.yaw[i] + spin;
          turned(flat * Math.cos(yaw), Math.sin(b.ang[i]), flat * Math.sin(yaw), tw[0] + bw[0] * share, tw[1] + bw[1] * share, tw[2] + bw[2] * share, v);
          J[i * 3 + 3] = x += v[0] * b.len[i]; J[i * 3 + 4] = y += v[1] * b.len[i]; J[i * 3 + 5] = z += v[2] * b.len[i];
        }
        for (let i = 0; i <= n; i++) {
          look(J[i * 3], J[i * 3 + 1], J[i * 3 + 2]);
          b.px[i] = seen[0]; b.py[i] = seen[1]; b.near[i] = J[i * 3 + 2]; b.size[i] = seen[2];
        }
      }
    }
    const pose = round ? poseRound : poseFlat;

    // Blossoms let go of a petal or two, then leave whole. Flights are closed
    // form, so any moment can be drawn without stepping a simulation.
    const carried = new Float32Array(Math.ceil(T.end * 60) + 2); // columns a loose petal has been blown by each 1/60 s
    for (let i = 1; i < carried.length; i++) carried[i] = carried[i - 1] + (wind(i / 60) * cols * 0.1) / 60;
    const drift = (t) => { const k = Math.min(carried.length - 2, t * 60), i = k | 0; return lerp(carried[i], carried[i + 1], k - i); };

    const leaving = [];
    for (const f of blooms) {
      f.gone = Math.max(f.open + 0.6, lerp(T.breeze + 0.8, T.storm + 1.6, rand() ** 0.38)); // few at first, most as the gale arrives
      leaving.push({ f, t0: f.gone, whole: true });
      if (rand() < 0.6) leaving.push({ f, t0: lerp(T.breeze + 0.3, f.gone, Math.sqrt(rand())), whole: false });
    }
    leaving.sort((a, b) => a.t0 - b.t0);
    // In 3D a petal flies through the tree's own space (x across, y down, z
    // toward where the camera stands when it is square on), along the wind of
    // the moment it let go. Where it is at time t goes into `spot`.
    const spot = [0, 0, 0];
    function fly(p, t) {
      const age = t - p.t0, ease = age - 0.3 * (1 - Math.exp(-age / 0.3));
      const blown = (((drift(t) - p.d0) / aspect) * p.push * ease) / age, wob = Math.min(1, age) * p.amp;
      const side = (Math.sin(age * p.freq + p.phase) * wob) / aspect;
      spot[0] = p.x + p.ux * blown - p.uz * side;
      spot[1] = p.y + p.fall * ease + blown * p.tilt + Math.cos(age * p.freq * 0.7 + p.phase) * wob * 0.4;
      spot[2] = p.z + p.uz * blown + p.ux * side;
    }
    const petals = [];
    for (let t = T.breeze, k = 0; k < leaving.length; t += 0.05) {
      pose(1, t);
      for (; k < leaving.length && leaving[k].t0 < t + 0.05; k++) {
        const { f, t0, whole } = leaving[k], b = tree[f.b], [x, y, i, j] = at(b, f.s);
        const p = {
          t0, whole, d0: drift(t0),
          x: x * aspect + f.dx + 0.5, y: y + f.dy + 0.5,
          push: R(0.7, 1.3), fall: rows * R(0.03, 0.09), tilt: R(-0.1, 0.06),
          amp: R(0.4, 1.4), freq: R(2.5, 5), phase: R(0, 6.28),
          ink: whole ? f.ink : PINK + 3 + ((rand() * 4) | 0),
        };
        petals.push(p);
        if (!round) continue;
        const J = b.joint, spin = spinAt(t), c = Math.cos(spin), s = Math.sin(spin);
        const xs = lerp(J[i * 3], J[i * 3 + 3], j) + f.dx / aspect, zs = lerp(J[i * 3 + 2], J[i * 3 + 5], j);
        p.x = xs * c + zs * s; p.y = lerp(J[i * 3 + 1], J[i * 3 + 4], j) + f.dy; p.z = zs * c - xs * s;
        p.ux = Math.cos(DRAW - spin); p.uz = Math.sin(DRAW - spin);
        p.fall *= 2.2; // it falls faster, and comes down on the grass or the water at `land`, if it gets there
        p.land = Infinity;
        for (let a = 0.1, was = p.y; t0 + a < T.pink; a += 0.1, was = spot[1]) {
          fly(p, t0 + a);
          if (spot[1] >= ground) { p.land = t0 + a - (0.1 * (spot[1] - ground)) / (spot[1] - was); break; }
        }
      }
    }
    const specks = []; // tufts of grass and wild flowers on the tree's patch of land, set on the ground so that they turn with it
    for (let i = 0; i < S * S * 0.045; i++) {
      const far = rand() ** 0.6 * isle * 0.8, a = R(0, 6.28), h = rand(), hue = rand();
      specks.push({
        x: Math.cos(a) * far, z: Math.sin(a) * far,
        glyph: h < 0.45 ? TUFT : h < 0.62 ? COMMA : h < 0.74 ? HIGH : STAR,
        ink: h < 0.74 ? (hue < 0.5 ? ISLE + 2 : LEAF + 1) : hue < 0.45 ? GOLD : hue < 0.8 ? WHITE : PINK + 4,
      });
    }
    // How many steps lighter something is for being `near` rows closer to the
    // camera than the trunk (darker, if it is behind). On the flat tree: none.
    const lighter = (near, dark, light) => Math.round(Math.max(-1, Math.min(1, near / (CROWN[2] * S))) * (near < 0 ? dark : light));
    const rose = (level, tone) => (round ? SHADE + Math.max(0, Math.min(11, level + 3 + tone)) : PINK + level);

    function put(c, r, ch, colour, width, heavy = 0) {
      if (c < 0 || c >= cols || r < 0 || r >= ground) return;
      const i = r * cols + c;
      if (width < rank[i]) return;
      rank[i] = width; glyph[i] = ch; ink[i] = colour; bold[i] = heavy;
    }
    // Fill a whole cell with a colour, behind whatever glyph is in it. In 3D only the nearest fill shows.
    function block(c, r, colour, near) {
      const i = r * cols + c;
      if (round && near < deep[i]) return;
      deep[i] = near;
      paint[r * 2 * cols + c] = paint[(r * 2 + 1) * cols + c] = colour;
    }

    // A branch too thin to fill cells is drawn as a line of slashes, bars and
    // dashes, choosing each glyph by where the line crosses its cell.
    function thin(c0, r0, c1, r1, colour, width, heavy = 0) {
      const dc = c1 - c0, dr = r1 - r0, wide = Math.abs(dc), high = Math.abs(dr);
      const rising = dc * dr < 0; // climbs to the right, like a slash
      if (wide <= high * 1.3) { // steep: one glyph per row
        const lo = Math.min(r0, r1), hi = Math.max(r0, r1);
        for (let r = Math.floor(lo); r < hi; r++) {
          const ya = Math.max(lo, r), yb = Math.min(hi, r + 1), cover = yb - ya;
          if (cover < 0.25) continue;
          const ca = c0 + (dc * (ya - r0)) / dr, cb = c0 + (dc * (yb - r0)) / dr;
          const stub = cover < 0.6 ? ((ya + yb) / 2 - r > 0.5 ? (rising ? COMMA : DOT) : HIGH) : 0;
          put(Math.floor((ca + cb) / 2), r, stub || (Math.floor(ca) === Math.floor(cb) ? BAR : rising ? SLASH : BACK), colour, width, heavy);
        }
      } else { // shallow: one glyph per column
        const lo = Math.min(c0, c1), hi = Math.max(c0, c1), slope = high / wide;
        const level = (c) => { // twice the row the line is on at column c: even is a row edge, odd a row middle
          const y = r0 + (dr * (Math.min(hi, Math.max(lo, c + 0.5)) - c0)) / dc, f = y - Math.floor(y);
          return Math.floor(y) * 2 + (f < 0.25 ? 0 : f < 0.72 ? 1 : 2);
        };
        for (let c = Math.floor(lo); c < hi; c++) {
          const xa = Math.max(lo, c), xb = Math.min(hi, c + 1);
          if (xb - xa < 0.35) continue;
          const y = r0 + (dr * ((xa + xb) / 2 - c0)) / dc, r = Math.floor(y), f = y - r;
          if (slope > 0.6) put(c, r, rising ? SLASH : BACK, colour, width, heavy);
          else if (slope > 0.2) put(c, r, f < 0.36 ? (rising ? HIGH : TICK) : f > 0.64 ? (rising ? COMMA : DOT) : DASH, colour, width, heavy);
          else { // nearly flat: __,--' in half-row steps, with a tick where the line changes level
            const q = level(c), steps = level(c + (rising ? 1 : -1)) < q, lands = level(c + (rising ? -1 : 1)) > q;
            if (q % 2 === 0) put(c, q / 2 - 1, LOW, colour, width, heavy);
            else put(c, (q - 1) / 2, steps ? (rising ? HIGH : TICK) : lands ? (rising ? COMMA : DOT) : DASH, colour, width, heavy);
          }
        }
      }
    }

    // Thick wood fills every cell within its width, with grain that follows
    // the limb and light falling from the upper left.
    function thick(x0, y0, x1, y1, wa, wb, near) {
      const dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy || 1e-9, reach = Math.max(wa, wb) / 2;
      const lean = dx * dy < 0 ? SLASH : BACK, steep = Math.abs(dx * aspect) <= Math.abs(dy) * 1.3;
      for (let r = Math.floor(Math.min(y0, y1) - reach); r <= Math.max(y0, y1) + reach; r++) {
        // the grain follows the limb: a bar where its centre stays in one column across this row
        const centre = (y) => Math.floor((x0 + (dx * (y - y0)) / dy) * aspect);
        const grain = steep && centre(r) === centre(r + 1) ? BAR : lean;
        for (let c = Math.floor((Math.min(x0, x1) - reach) * aspect); c <= (Math.max(x0, x1) + reach) * aspect; c++) {
          const px = (c + 0.5) / aspect - x0, py = r + 0.5 - y0;
          const k = clamp01((px * dx + py * dy) / len2), ox = px - dx * k, oy = py - dy * k;
          const half = lerp(wa, wb, k) / 2;
          if (ox * ox + oy * oy > half * half) continue;
          const lit = -(ox + oy) * 0.7 / half, tone = Math.max(0, Math.min(5, Math.round(2.4 + lit * 2.2 + (hash(c, r + 77) - 0.5) * 1.4)));
          put(c, r, hash(c, r) < 0.16 ? GRAIN[(hash(r, c) * 3) | 0] : grain, BARK + tone, near + half * 2, 1);
          if (c >= 0 && c < cols && r >= 0 && r < ground) block(c, r, BARK + (tone >> 1), near + half * 2);
        }
      }
    }

    // The scene behind the tree at time t: the colour of every half cell, and
    // the scene's own glyphs (in `mark` and `tint`, shown wherever the tree
    // leaves a cell empty). Above the horizon it is sky and skylines. Below it
    // every half cell is a point on the flat ground, found by looking through
    // it from the eye: lake, the tree's patch of land, or the far bank.
    const SKIES = 0, PEAK = 1, HILLS = 2, WOOD = 3, MEAD = 4, WATER = 5, MIRROR = 6, SHALLOW = 7, BEACH = 8, GRASS = 9;
    const EDGE = 0.022; // how much of a bank of forest, from its top down, is in the sun (in parts of the sky)
    function drawScene(t) {
      const spin = round ? spinAt(t) : 0, cs = Math.cos(spin), sn = Math.sin(spin);
      const first = Math.max(0, Math.min(rows * 2, Math.ceil(horizon * 2 - 0.5))); // the first half row whose middle is below the horizon
      const sunC = (0.3 * rootX + away * spin) * aspect, sunR = Math.max(1.6, 0.085 * u), sunY = Math.max(sunR + 1, crest * 0.55 + 0.12 * u);
      const nearest = (rows - horizon) / above, farthest = away / (away + shore); // how large the nearest water on screen is drawn, and the farthest
      const beat = Math.floor(t * 3); // light on the water twinkles in steps
      mark.fill(0);
      for (let c = 0; c < cols; c++) {
        const xr = (c + 0.5) / aspect - rootX; // rows across from the root
        for (let l = 0; l < lines.length; l++) {
          const L = lines[l];
          here[l] = Math.max(9, Math.min(L.top.length - 10, Math.round((xr / L.F - spin - L.from) * L.per)));
          tops[l] = L.top[here[l]];
        }
        for (let h = 0; h < first; h++) { // sky, and what stands against it
          const y = (h + 0.5) / 2, up = (horizon - y) / sky, grain = (((c & 1) * 2 + (h & 1) * 3) % 4) * 0.1 - 0.15;
          let colour, what = SKIES;
          if (up < tops[3]) { what = WOOD; colour = LEAF + (up > tops[3] - EDGE ? 0 : 1); }
          else if (up < tops[2]) { what = HILLS; colour = HILL + (lines[2].top[here[2] + 3] >= lines[2].top[here[2] - 3] ? 0 : 1); }
          else if (up < tops[1] || up < tops[0]) { // a mountain: lit from the left, each ridge running down to the right
            const l = up < tops[1] ? 1 : 0, L = lines[l], j = Math.max(4, Math.min(L.top.length - 5, here[l] - Math.round((tops[l] - up) * sky * aspect * 1.6)));
            what = PEAK; colour = ROCK + l * 4 + (up > L.snow + 0.05 * hash(j >> 2, l) ? 2 : 0) + (L.top[j + 4] < L.top[j - 4] ? 1 : 0);
          } else {
            const d = Math.hypot((c + 0.5 - sunC) / aspect, y - sunY) / sunR;
            colour = d < 1 ? SUN : SKY + Math.max(0, Math.min(9, Math.floor(clamp01(y / horizon) ** 1.25 * 9.5 + grain + (d < 1.7 ? 2 : d < 2.5 ? 1 : 0))));
          }
          kind[h] = what; paint[h * cols + c] = colour;
        }
        let lakeFrom = -1, open = true; // where this column first reaches the water, and whether it is still on the far side of the tree's land
        for (let h = first; h < rows * 2; h++) { // the ground
          const y = (h + 0.5) / 2, k = (y - horizon) / above, z = away * (1 - 1 / k), x = xr / k, rho = Math.hypot(x, z) || 1e-9;
          const wx = (x * cs + z * sn) / rho, wz = (z * cs - x * sn) / rho; // which way that is from the trunk, on the ground as it lies (the camera's turn undone)
          const grain = (((c & 1) * 2 + (h & 1) * 3) % 4) * 0.1 - 0.15;
          const edge = rho < isle * 1.6 ? isle * (0.86 + 0.28 * noise(3 + wx * 1.3, 3 + wz * 1.3)) : 0;
          let colour, what;
          if (rho < edge) { // the tree's patch of land
            const patch = noise(40 + (wx * rho * 2.7) / S, 40 + (wz * rho * 2.7) / S);
            const shadow = Math.hypot((wx * rho - 0.1 * S) / (0.36 * S), (wz * rho) / (0.25 * S)) < 1;
            what = rho > edge * 0.88 && z > -0.3 * edge ? BEACH : GRASS;
            colour = what === BEACH ? SAND : ISLE + (shadow ? 2 : patch > 0.55 ? 0 : 1);
            open = false;
          } else if (rho < edge * 1.35) { what = SHALLOW; colour = SHOAL; open = false; }
          else {
            const bank = rho > shore * 0.8 ? shore * (0.82 + 0.36 * noise(7 + wx * 1.6, 7 + wz * 1.6)) : Infinity;
            if (rho >= bank) { // the far bank: a strip of meadow at the water's edge, then forest, bank behind bank
              const up = (horizon - y) / sky, n = up < tops[5] ? 2 : up < tops[4] ? 1 : 0; // which bank of forest: each has a sunlit top, and the nearest is deepest at its foot
              what = rho < bank * 1.1 ? MEAD : WOOD;
              colour = what === MEAD ? TURF + (noise((here[3] >> 1) * 0.35, 5) > 0.5 ? 1 : 0) : LEAF + n + (n && up > tops[3 + n] - EDGE ? 0 : n === 2 && up < tops[5] - 4 * EDGE ? 2 : 1);
            } else {
              if (lakeFrom < 0) lakeFrom = y;
              const depth = clamp01((k - farthest) / (nearest - farthest)) ** 0.7 * 6.6 + grain, m = y - lakeFrom;
              what = WATER; colour = LAKE + Math.max(0, Math.min(6, Math.floor(depth)));
              if (open && m < 3.5 && hash(h, (c - Math.round(pan[h >> 1] * spin)) >> 2) > 0.12 + m * 0.2) { // the far bank stands in the water, squeezed and broken by ripples
                const from = lakeFrom - m * 4, upside = (horizon - from) / sky; // the row that is mirrored here
                if (from >= horizon || upside < tops[3]) { what = MIRROR; colour = GLASS + (m < 0.5 ? 0 : 1); }
                else if (upside < tops[2]) { what = MIRROR; colour = GLASS + 2; }
                else if (upside < tops[1] || upside < tops[0]) colour = Math.max(LAKE, colour - 2);
              }
            }
          }
          kind[h] = what; paint[h * cols + c] = colour;
        }
        for (let r = 0; r < rows; r++) { // the scene's glyphs, where a whole cell is one thing: an edge is left clean
          const what = kind[r * 2 + 1], i = r * cols + c, fill = paint[(r * 2 + 1) * cols + c];
          if (what !== kind[r * 2] || what === SKIES || what === GRASS || what === HILLS) continue;
          if (what === PEAK) { // strokes that follow the faces
            const l = fill >= ROCK + 4 ? 1 : 0;
            if (hash(here[l] >> 1, r + 300) < 0.07) { mark[i] = (fill - ROCK) & 1 ? BACK : SLASH; tint[i] = ROCK + ((fill - ROCK) ^ 1); }
          } else if (what === WOOD) { // treetops
            if (hash(here[3] >> 1, r + 500) < 0.25) { mark[i] = FIR; tint[i] = fill === LEAF ? LEAF + 2 : fill - 1; }
          } else if (what === MEAD) { // wild flowers
            const h = hash(here[3] >> 1, r + 700);
            if (h < 0.4) { mark[i] = h < 0.22 ? STAR : TUFT; tint[i] = h < 0.12 ? GOLD : h < 0.22 ? WHITE : LEAF + 1; }
          } else if (what === BEACH || what === SHALLOW) {
            if (hash(c, r + 900) < 0.14) { mark[i] = what === BEACH ? COLON : DOT; tint[i] = what === BEACH ? BARK + 5 : GLINT; }
          } else { // water: ripples that drift, and the sun's light coming across it
            const slid = c - pan[r] * spin - t * 0.8, slot = Math.floor(slid / 3), h = hash(slot, r + 1100);
            if (Math.abs(c - sunC) < Math.min(1.5 + (r - horizon) * 0.45, sunR * aspect * 1.6) && hash(c, r * 31 + beat) < 0.3) { mark[i] = hash(c, r + beat) < 0.4 ? STAR : HIGH; tint[i] = GLINT; }
            else if (h < 0.13 && slid - slot * 3 < 1 + h * 20) { mark[i] = h < 0.09 ? WAVE : DASH; tint[i] = what === MIRROR ? LAKE + 1 : fill - LAKE < 2 ? GLINT : fill - 2; }
          }
        }
      }
      for (const k of specks) { // tufts and flowers on the tree's patch of land
        const zc = k.x * sn + k.z * cs, size = away / (away - zc);
        const c = Math.floor((rootX + (k.x * cs - k.z * sn) * size) * aspect), r = Math.floor(horizon + above * size);
        if (c >= 0 && c < cols && r >= 0 && r < rows) { mark[r * cols + c] = k.glyph; tint[r * cols + c] = k.ink; }
      }
    }

    function drawTree(g, t) {
      const spin = spinAt(t), cs = Math.cos(spin), sn = Math.sin(spin); // 3D: how far round the camera has come
      rank.fill(round ? -Infinity : 0);
      for (const b of tree) {
        if (!b.grown) continue;
        const ripe = 0.4 + 0.6 * smooth(0, 0.45, g - b.g0); // wood thickens after it has grown
        const width = (s) => ripe * (b.w1 + (b.w0 - b.w1) * (1 - s / b.total) ** (b.depth === 1 ? 2 : 1) +
          (b.depth ? 0 : b.w0 * 0.9 * Math.exp(-s / (b.total * 0.12)))); // limbs slim quickly; the trunk flares at the root
        for (let i = 0; i < b.len.length && b.cum[i] < b.grown; i++) {
          const f = Math.min(1, (b.grown - b.cum[i]) / b.len[i]);
          const x0 = b.px[i], y0 = b.py[i], x1 = lerp(x0, b.px[i + 1], f), y1 = lerp(y0, b.py[i + 1], f);
          const wa = width(b.cum[i]) * b.size[i], wb = width(b.cum[i] + b.len[i] * f) * lerp(b.size[i], b.size[i + 1], f);
          const strokes = Math.round((wa + wb) / 2), near = lerp(b.near[i], b.near[i + 1], f / 2); // nearer wood is lighter, and hides what is behind
          if (wa * aspect < 1.7) thin(x0 * aspect, y0, x1 * aspect, y1, BARK + 3 + lighter(near, 2, 2), near + wa, 1); // bold: a dark line needs the weight to show against the scene
          else if (Math.abs(x1 - x0) * aspect <= Math.abs(y1 - y0) * 2.4) thick(x0, y0, x1, y1, wa, wb, near);
          else for (let j = 0; j < Math.max(1, strokes); j++) { // thick but shallow: parallel strokes a row apart, light on top
            const o = j - (Math.max(1, strokes) - 1) / 2;
            thin(x0 * aspect, y0 + o, x1 * aspect, y1 + o, BARK + (strokes > 1 ? Math.max(0, 4 - 2 * j) : 3), near + wa, 1);
          }
        }
      }
      for (const f of blooms) {
        const b = tree[f.b];
        if (t < f.open || t >= f.gone || b.grown < Math.min(f.s, b.total)) continue;
        const [x, y, j, k] = at(b, f.s), c = Math.floor(x * aspect) + f.dx, r = Math.floor(y) + f.dy;
        if (c < 0 || c >= cols || r < 0 || r >= ground) continue;
        const age = t - f.open, i = r * cols + c, near = lerp(b.near[j], b.near[j + 1], k), tone = lighter(near, 5, 2);
        const front = near + 2.5 - 2 * Math.min(1, f.e), colour = rose(f.ink - PINK, tone); // 3D: a puff is a ball, nearest at its heart
        if (f.body && age >= 0.26) block(c, r, Math.max(SHADE, colour - 2), front); // the body of a puff is solid: a deeper pink behind its blossoms
        if (round) { // 3D: only the nearest thing in a cell shows
          if (front < rank[i]) continue;
          rank[i] = front;
        }
        glyph[i] = age < 0.12 ? DOT : age < 0.26 ? RING : f.glyph; // bud, half open, then a flash as it opens
        ink[i] = age < 0.12 ? rose(0, tone) : age < 0.26 ? rose(2, tone) : age < 0.38 ? (tone < 0 ? rose(8, tone * 2) : WHITE) : colour;
        bold[i] = f.e < 0.5 && age >= 0.26 && tone > -2 ? 1 : 0; // the heart of a puff is set bold, unless it is far off
      }
      const blownNow = drift(t);
      if (round) for (const p of petals) { // 3D: petals fly through the tree and in front of it, and lie where they land
        if (t <= p.t0) break;
        const when = Math.min(t, p.land);
        fly(p, when);
        if (t > p.land) { // lying where it came down, until the gale sweeps it along
          const swept = (Math.max(0, blownNow - drift(Math.max(p.land, T.storm - 1))) * 0.5) / aspect;
          spot[0] += p.ux * swept; spot[1] = ground; spot[2] += p.uz * swept;
        }
        const z = spot[0] * sn + spot[2] * cs;
        look(spot[0] * cs - spot[2] * sn, spot[1], z);
        const c = Math.floor(seen[0] * aspect), r = Math.floor(seen[1]), i = r * cols + c;
        if (c < 0 || c >= cols || r < 0 || r >= rows || z > away * 0.55 || z < rank[i]) continue; // not when it is right in front of the lens
        rank[i] = z;
        const big = seen[2] > 1.15 || (p.whole && seen[2] > 0.92); // close to the camera a petal is a bigger mark, and far off a blossom is a smaller one
        glyph[i] = (big ? WHOLE : PETAL)[((when - p.t0) * 5 + p.phase) & 3];
        ink[i] = rose(p.ink - PINK, lighter(z, 5, 2));
        bold[i] = seen[2] > 1.3 ? 1 : 0;
      }
      else for (const p of petals) {
        const age = t - p.t0;
        if (age <= 0) break;
        const ease = age - 0.3 * (1 - Math.exp(-age / 0.3)); // a petal takes a moment to get up to speed
        const blown = ((blownNow - p.d0) * p.push * ease) / age, wob = Math.min(1, age) * p.amp;
        const c = Math.floor(p.x + blown + Math.sin(age * p.freq + p.phase) * wob);
        const r = Math.floor(p.y + p.fall * ease + blown * p.tilt + Math.cos(age * p.freq * 0.7 + p.phase) * wob * 0.4);
        if (c < 0 || c >= cols || r < 0 || r >= ground || glyph[r * cols + c] > 32) continue; // petals pass behind the tree
        const i = r * cols + c, beat = (age * 5 + p.phase) | 0;
        glyph[i] = (p.whole ? WHOLE : PETAL)[beat % 4];
        ink[i] = p.ink;
      }
    }

    // The gale: every row is a stream of petals moving right at its own speed,
    // thickest where the gusts are. `d` is how full a cell is: up to 1 it is the
    // chance of a petal there, past 1 the cell floods pink, and in the reveal it
    // runs back down to nothing, which leaves the page showing.
    function drawGale(t) {
      const since = t - T.storm, rise = clamp01(since / (T.pink - T.storm)) ** 1.5;
      const fade = (t - T.reveal) / (T.end - T.reveal);
      for (let r = 0, i = 0; r < rows; r++) {
        const shift = cols * (0.32 + 0.3 * hash(r, 11)) * since + hash(r, 5) * 997;
        for (let c = 0; c < cols; c++, i++) {
          const x = c - cols * 0.6 * since; // gusts drift right with the wind
          const calm = 1 - noise(x * 0.025, r * 0.12) * 0.65 - noise(x * 0.09, r * 0.4 + 40) * 0.35; // 0 in the heart of a gust
          let d = rise * 3.2 - (c / cols) * 0.7 - calm;
          if (fade > 0) d = Math.min(d, 1.7 - 1.9 * smooth(0, 1, fade * 3.45 - (c / cols) * 1.4 - calm * 0.7));
          const level = Math.round(smooth(0.95, 1.3, d) * 16);
          wash[i] = level ? FLOOD + level : 0;
          if (d <= 0) continue;
          const slot = Math.floor(c - shift), h = hash(slot, r), k = hash(slot, r + 4096);
          if (h < (d < 1.25 ? d : lerp(1, 0.1, smooth(1.25, 1.6, d)))) {
            if (k < smooth(0.35, 0.95, d)) { // a whole blossom
              glyph[i] = BODY[(k * 977) & 3];
              ink[i] = d > 1.3 ? PINK + 7 : PINK + 1 + ((h * 89) % 7 | 0);
            } else { // a petal, tumbling
              glyph[i] = PETAL[((k * 977 + t * 5) | 0) & 3];
              ink[i] = d > 1.3 ? PINK + 7 : PINK + 4 + ((h * 89) % 4 | 0);
            }
            bold[i] = 0;
          } else if (d > 0.95) glyph[i] = 32;
        }
      }
    }

    return {
      cols, rows, palette: INK, glyph, ink, bold, paint, wash,
      render(t) { // t: seconds since the animation started
        glyph.fill(32); ink.fill(0); bold.fill(0); paint.fill(0); wash.fill(0);
        if (t >= LENGTH) return this; // over: nothing is left on the page
        const s = t * SPEED, g = growth(s); // s: where that is in the story
        if (s < T.pink) { // once the pink is solid there is nothing behind it to draw
          deep.fill(-Infinity);
          drawScene(s); pose(g, s); drawTree(g, s);
          for (let i = 0; i < mark.length; i++) if (mark[i] && glyph[i] === 32 && deep[i] === -Infinity) { glyph[i] = mark[i]; ink[i] = tint[i]; }
        }
        if (s > T.storm) drawGale(s);
        return this;
      },
    };
  }

  // Play it on the stage. Resolves when it has finished. `view: '3d'` plays
  // the 3D view; `seed` grows a different tree; `freezeAt` holds one moment
  // (in seconds) on screen instead of playing. Reduced motion holds the tree
  // in bloom.
  const film = { length: LENGTH, still: (T.breeze + 0.7) / SPEED, createScene };
  return { play: (options) => AsciiStage.play(film, options), createScene };
})();
