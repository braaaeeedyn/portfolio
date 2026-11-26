/*
 * Zither in the lake pavilion: an ASCII loading screen, played by the stage.
 *
 *   <script src="ascii-stage.js"></script>
 *   <script src="zither-pavilion.js"></script>
 *   <script>ZitherPavilion.play().then(showThePage);</script>
 *
 * Night, and a calm lake under a sky full of stars. In the middle of the lake
 * is an island, its shore pale in the moonlight all the way round, with a
 * pine, a few rocks and a pavilion on it; a path of stepping stones and a
 * small footbridge join it to the bank. In the pavilion, by lantern light, a
 * man with his hair tied back in a ponytail plays a guqin. Each note he
 * plucks spreads from the pavilion as a ring, over the island and out across
 * the water. Where a ring comes ashore white flowers open in the grass, and
 * as the rings pass the lily pads their lotus buds open. Then the view swoops
 * up out of the lake along a curve, steep at first and bending over into a
 * glide, and comes to rest on the moon; and the night thins away round the
 * moon to show the page. It lasts five seconds (LENGTH).
 *
 * The picture is pixel art in the stage's half cells, with characters on top.
 * The whole world, the lake and the sky as far as the moon, is painted once
 * in createScene. render(t) lays the part the camera sees under what moves,
 * all in closed form, so any moment can be drawn directly.
 */
const ZitherPavilion = (() => {
  'use strict';
  const { code, clamp01, lerp, smooth, mulberry32, hash, noise } = AsciiStage;

  const LENGTH = 5; // seconds on screen

  // The story's timeline, in seconds at the pace it was written. It is played
  // SPEED times faster, so that on screen it takes LENGTH seconds.
  const T = {
    pluck: 0.3,  // the first note
    beat: 1,     // from one note to the next
    swoop: 5.5,  // the view leaves the lake
    moon: 10.3,  // and has come to rest on the moon
    thin: 11.7,  // the night starts to let the page through, from the corners in toward the moon
    fade: 12.35, // and then the moon does
    end: 13,
  };
  const SPEED = T.end / LENGTH;
  const NOTES = 8;      // how many notes he plays
  const BLOOMS = 3;     // how many of the rings open flowers on the bank
  const RIPPLE = 0.8;   // how fast a ring widens, in pavilion widths a second
  const REACH = 2.4;    // a ring is spent this many pavilion widths out, and land farther off flowers almost as soon
  const FLAT = [0.34, 0.5]; // the lake is seen from low down: a circle on it is this many times as tall as it is wide (wide screen; tall, which has height to spare)
  const ISLE = 1;       // the island's radius, in pavilion widths: it reaches well beyond the pavilion on every side
  const WAY = [2.85, 2]; // which way the bank lies nearest the island, and the footbridge runs to it: to the left on a wide screen, toward the viewer on a tall one (radians, from due right)
  const GAP = [0.42, 0.75]; // how much water lies between the island and the bank there, in pavilion widths (wide screen, tall: water toward the viewer looks narrow)
  const CURL = [0.28, 2]; // how fast the bank falls away from the island either side of that: curling round in front of it, and back toward the far shore
  const RISE = 1.25;    // how far the view climbs to the moon, in screens
  const BEND = 26;      // how far its path bends over: it leaves the lake 1 + BEND times as steeply as it reaches the moon
  const SHUTTER = 0.11; // while the view moves, a star is drawn out along what it crossed in this long
  const HANG = [7, 10]; // the lantern: how far to the right of the man it hangs, and how high its foot is above the floor (in 37ths of the pavilion's width)

  // Colours. Each ramp runs the way its comment reads, and gives the index of its first colour.
  const PALETTE = ['#000000']; // 0 is never drawn: it means nothing there
  const ramp = (...colours) => PALETTE.push(...colours) - colours.length;
  const SKY = ramp('#060a1b', '#091026', '#0d1731', '#121f3e', '#18294d', '#1f345d', '#2a436f', '#3a5686', '#52709f', '#7491bb'); // overhead, down to the glow on the horizon; then on into the light round the moon
  const MOON = ramp('#f4f1de', '#dcdccb', '#bfc5c6', '#a5aeb9'); // its face, the limb turned from the light, its seas, their depths
  const THIN = ramp('rgba(9,16,38,.78)', 'rgba(9,16,38,.56)', 'rgba(9,16,38,.36)', 'rgba(9,16,38,.18)'); // the night sky, letting the page through
  const WANE = ramp('rgba(244,241,222,.78)', 'rgba(244,241,222,.56)', 'rgba(244,241,222,.36)', 'rgba(244,241,222,.18)'); // and the moon
  const STARRY = ramp('#46598a', '#7e93c4', '#c5d3f4', '#ffffff', '#ffe6b0'); // stars: faint to bright, and a warm one
  const HILL = ramp('#162444', '#101b37'); // far, nearer
  const TREE = ramp('#16294a', '#0d1830', '#0a1226', '#0c1730'); // moonlit crowns, leaves, shade, and trees mirrored in the lake
  const MIST = ramp('#3d5a86');
  const LAKE = ramp('#213a66', '#1b3059', '#16284c', '#122040', '#0e1936', '#0b142d', '#080f24', '#060b1b'); // far to near, then two deeper for dark things mirrored
  const SHOAL = ramp('#1d3d5c'); // the shallows round the island
  const WAVE = ramp('#dbe8ff', '#93aedb', '#5874a6'); // a ring's crest, new to spent
  const GRASS = ramp('#1d3e3c', '#1a3836', '#163130', '#122a2b', '#0f2326'); // the bank: far to near
  const LIT = ramp('#27503f', '#69b08f'); // grass in the moon's full light, and grass as a ring passes through it
  const LIP = ramp('#3b6a57'); // the bank's grassy lip at the water, in the moonlight
  const ISLET = ramp('#1c3a36', '#24493c', '#55583a', '#3d7460'); // the island's grass: in shade, moonlit, in the lantern's light, and as a ring passes over it
  const RIM = ramp('#b3bdd2', '#8b96b1', '#4f5b79'); // the island's shore by moonlight: its edge toward the viewer, the rest of its edge, and the bank under the edge
  const ROCK = ramp('#232c45', '#4b5876', '#a7b4cf'); // shade, face, the edge that catches the moon
  const PINE = ramp('#10231f', '#1d3a32', '#46796a', '#2a2326', '#594a48'); // needles in shade, needles, needles in the moonlight; bark, bark in the moonlight
  const PATH = ramp('#7c87a1'); // stepping stones
  const DECK = ramp('#a58d6e', '#3a2c25'); // the footbridge: planks and rail by moonlight, posts
  const ROOF = ramp('#0f162b', '#19233f', '#2a3a5d', '#93a6c9', '#55637f', '#7a5a3c'); // shade, tiles, moonlit tiles, ridge toward the moon and away from it, the eave over the lantern
  const GOLD = ramp('#d8b25c');
  const RED = ramp('#3a1420', '#6c1f29', '#a93428', '#e4663c'); // beam, shade, lacquer, lantern-lit
  const STONE = ramp('#d6c8a6', '#8f8c93', '#55586a'); // the pavilion's base: its top by lantern light, by moonlight, and its side
  const GLOW = ramp('#7a4a26', '#4f3127', '#33222b', '#1e1826'); // the air inside, from beside the lantern to farthest from it
  const LAMP = ramp('#fff2bb', '#f6ab3f', '#8a2a22'); // the lantern: flame, paper, cap
  const ROBE = ramp('#a3a2c4', '#61668f', '#2b2f4d'); // toward the lantern, away from it, the opening of the collar
  const SKIN = ramp('#fbeee6', '#dcc3bb', '#7d5c5a'); // pale skin in the lantern's light, in shade, and the line of a downcast eye
  const HAIR = ramp('#141018', '#3a3242', '#c2453a'); // near black, its sheen, the band that ties it
  const QIN = ramp('#2b1711', '#86552c', '#ffe9ac'); // the zither's side, its face, and a string sounding
  const HOUSE = QIN + 3; // from ROOF up to here is the pavilion and all in it
  const WARM = [GLOW, GLOW + 1, LAMP, LAMP + 1, ROBE, SKIN, STONE, RED + 3]; // of those, what shines in the lantern's light
  const EMBER = ramp('#d39a52', '#8f6b4a'); // that light, mirrored in the lake
  const PAD = ramp('#1f5a48', '#16433a');
  const LOTUS = ramp('#cf3f7c', '#ec72a6', '#f8adc9', '#ffe6f0', '#ffd96c'); // bud, petals deep to pale, heart
  const WHITE = ramp('#ffffff', '#e6edff', '#fff1cb'); // a flower opening, open, and a creamy one
  const TILE = ramp('#31405f');

  const [TILDE, DASH, EQUAL, BAR, SLASH, OPEN, CLOSE, DOT, HIGH, COMMA, QUOTE, SEMI, STAR, PLUS, RING, AMP, PERCENT] = code('~-=|/().\',";*+o&%');
  const TUFT = [QUOTE, COMMA, HIGH, SEMI];
  const SEAS = [[-0.3, -0.35, 0.28], [0.18, -0.3, 0.2], [0.38, -0.02, 0.22], [0.7, -0.3, 0.11], [-0.6, 0, 0.25], [-0.2, 0.42, 0.2], [0.55, 0.25, 0.14]]; // the moon's seas: where on its face (in its radii, across and down), and how big
  const CRATERS = [[-0.08, 0.72, RING], [0.32, 0.6, DOT], [-0.52, 0.58, DOT], [0.12, 0.2, DOT], [0.72, 0.52, DOT]]; // and craters on the bright ground between them

  const WET = 1, TURF = 2, DRY = 3; // what a half cell of the lake is: water, the bank's grass, the island's grass
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const dith = (x, y) => (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16; // 0 to 1 in a fixed weave: two colours laid by it read as one between them

  // The view's way from the lake to the moon is the graph of a logarithm: when
  // it has climbed p of the way up (0 to 1) it has gone this far across (0 to
  // 1). It moves along that at a swoosh: up to speed in a moment, fastest in
  // its first third, then easing to rest.
  const across = (p) => ((1 + BEND) ** p - 1) / BEND;
  const swoosh = (s) => 1 - (1 - clamp01((s - T.swoop) / (T.moon - T.swoop)) ** 1.3) ** 3;

  // The man, seated on the floor facing us with the zither across his knees,
  // as pixel art: a letter to a pixel, his middle in the middle, the floor
  // under the last line. His hair is drawn back and tied high at the crown with
  // a band. The tail of it and his arms move, so they are drawn as he plays.
  const SITTER = [
    '.........hb........',
    '.......HHHHh.......',
    '.......HsSSH.......',
    '.......seSeS.......',
    '........sSS........',
    '......rrrcRRR......',
    '......rrrcRRR......',
    '......rrrRRRR......',
    '......rrrRRRR......',
    '.QQQQQQQQQQQQQQQQQ.',
    '.qqqqqqqqqqqqqqqqq.',
    '....rrrrrRRRRRR....',
    '...rrrrrrRRRRRRR...',
    '...rrrrrrRRRRRRR...',
  ];
  const INKS = { H: HAIR, h: HAIR + 1, b: HAIR + 2, S: SKIN, s: SKIN + 1, e: SKIN + 2, R: ROBE, r: ROBE + 1, c: ROBE + 2, Q: QIN + 1, q: QIN };
  const sitter = (j, i) => (j < -9 || j > 9 || i < 0 || i > 13 ? 0 : INKS[SITTER[13 - i][j + 9]] || 0); // j pixels right of his middle, i up from the floor
  const TAIL = [[2, 13], [3, 13], [3, 12], [4, 12], [4, 11], [4, 10], [4, 9], [4, 8], [4, 7]]; // the tail of his hair, from the knot over to his left and down behind his shoulder: [across, up]
  const lantern = (fx, fy) => {
    const a = Math.abs(fx - HANG[0]), up = fy - HANG[1];
    return up < -1 || a >= 1.5 ? 0 : up < 0 ? (a < 0.5 ? LAMP + 2 : 0) : up < 3 ? (a < 0.5 ? LAMP : LAMP + 1) : up < 4 ? LAMP + 2 : a < 0.5 ? HAIR : 0; // tassel, paper round the flame, cap, cord
  };
  // His arms: a sleeve from the shoulder (sx, 8.5) down to the wrist (hx, hy),
  // and the hand under it. 1 is the hand, 2 the sleeve.
  const arm = (fx, fy, hx, hy, sx) => {
    if (fy < hy - 1 || fy >= 9) return 0;
    if (fy < hy) return fx - hx >= -0.5 && fx - hx < 0.5 ? 1 : 0;
    const k = clamp01((fy - hy) / (8.5 - hy)), off = fx - lerp(hx, sx, k), wide = lerp(1.4, 1, k);
    return off >= -wide && off < wide ? 2 : 0;
  };

  // A pine, leaning out over the water: its trunk, and four flat sprays of
  // needles lit from above. fx is how far right of its foot, fy how far up,
  // in 37ths of the pavilion's width.
  const BOLE = [[0, 0], [-0.5, 4], [-2.5, 8.5], [-2, 11], [-3.5, 14.5]];
  const SPRAYS = [[-4.6, 8.6, 4.3, 1.5], [0.6, 10.8, 3.4, 1.25], [-4.8, 12.8, 3.8, 1.35], [-2.8, 15.4, 3.1, 1.3]]; // the middle of each, and how far it reaches across and up
  const pine = (fx, fy) => {
    for (const [cx, cy, rx, ry] of SPRAYS) {
      if (((fx - cx) / rx) ** 2 + ((fy - cy) / ry) ** 2 > 1) continue;
      return ((fx - cx) / rx) ** 2 + ((fy + 1 - cy) / ry) ** 2 > 1 ? PINE + 2 : fy < cy - ry * 0.3 ? PINE : PINE + 1;
    }
    for (let n = 1; n < BOLE.length; n++) {
      const [ax, ay] = BOLE[n - 1], [bx, by] = BOLE[n];
      if (fy < ay || fy >= by) continue;
      const mid = lerp(ax, bx, (fy - ay) / (by - ay));
      if (Math.abs(fx - mid) < lerp(1, 0.55, fy / 14.5)) return fx > mid ? PINE + 4 : PINE + 3;
    }
    return 0;
  };

  function createScene({ cols, rows, aspect = 2, seed = 1 }) {
    const lines = rows * 2, cells = cols * rows, ya = aspect / 2; // ya: how tall a half cell is, in cell widths
    const rand = mulberry32(seed), R = (a, b) => a + (b - a) * rand();
    const glyph = new Uint8Array(cells), ink = new Uint8Array(cells), bold = new Uint8Array(cells), paint = new Uint8Array(cells * 2);

    // The world is larger than the screen. The opening view of the lake is its
    // lower left corner, and the sky runs up and to the right as far as the moon.
    const DY = Math.round((lines * RISE) / 2) * 2; // how far the view climbs, in half cells: a whole number of cells, so the characters end where the paint does
    const DX = Math.round(Math.max(cols * 0.8, Math.min(cols * 2.2, DY * 1.4))); // and how far across it goes: enough to bend right over, on any shape of screen
    const WW = cols + DX, WR = rows + (DY >> 1), skyRows = DY >> 1;
    const world = new Uint8Array(WW * WR * 2); // the colour of every half cell of it
    const scene = world.subarray(DY * WW);     // the part level with the opening view: the lake, and the sky over it
    const chars = { glyph: new Uint8Array(WW * WR).fill(32), ink: new Uint8Array(WW * WR), bold: new Uint8Array(WW * WR) }; // its characters, where they never change
    const kind = new Uint8Array(WW * lines);   // WET, TURF or DRY
    const dist = new Float32Array(WW * lines); // how far a ring has spread from the pavilion when it gets there
    const crest = new Float32Array(WW * lines); // half the width of a ring's crest there
    const lean = new Uint8Array(WW * lines);   // where the crest there stands on end: 1 at the ring's left, 2 at its right
    const at = (x, y) => y * WW + x; // x across the world, y down from the top of the opening view
    const inside = (x, y) => x >= 0 && x < WW && y >= 0 && y < lines;
    const dot = (x, y, colour) => { if (inside(x, y)) { scene[at(x, y)] = colour; kind[at(x, y)] = 0; } };
    const mark = (c, r, ch, colour, heavy = 0) => { const i = (r + skyRows) * WW + c; chars.glyph[i] = ch; chars.ink[i] = colour; chars.bold[i] = heavy; };

    // Layout, in half cells. Everything is measured from the pavilion, and the
    // pavilion from the smaller side of the screen.
    const tall = clamp01((lines / cols - 0.6) / 1.2); // 0 on a wide screen, 1 on a phone held upright
    const W = Math.max(11, Math.round(Math.min(cols * 0.4, lines * 0.42)) | 1), half = W >> 1, u = W / 37; // the roof's width, odd; and the unit things in and round the pavilion are measured in, a 37th of that
    const pix = Math.round(u) >= 1 && Math.round(u) <= u * 1.08 ? Math.round(u) : u; // half cells to one of his pixels: a whole number where he still fits between the pillars, so that he stays crisp
    const slab = Math.max(1, Math.round(W * 0.055)), posts = Math.max(6, Math.round(W * 0.46)), roofH = Math.max(5, Math.round(W * 0.35)), knob = Math.max(1, Math.round(W * 0.08));
    const midX = cols >> 1, planeY = Math.round(lines * lerp(0.64, 0.57, tall)); // the middle of the island
    const baseY = planeY + Math.max(1, Math.round(W * 0.05)), floorY = baseY - slab, eaveY = floorY - posts;
    const farY = Math.max(3, Math.min(eaveY - roofH - knob + 4, Math.round(lines * lerp(0.42, 0.3, tall)))); // the far shore's waterline
    // The lake is a plane seen in perspective. A half cell (x, y) of it lies at
    // (U, V) on the plane, measured from the middle of the island in half
    // cells as they are there: U across, V toward the viewer.
    const flat = lerp(FLAT[0], FLAT[1], tall), K = lines * 1.1, RI = Math.min(W * ISLE, cols * 0.33), source = W * 0.42; // the island's radius; rings start from just outside the pavilion's base
    const onPlane = (U, V) => { const dy = (V * flat * K) / (K - V * flat); return [midX + (U * (K + dy)) / K, planeY + dy]; }; // where a point of the plane is on the screen
    const v = RIPPLE * W, gap = v * T.beat; // a ring's speed in half cells a second, and how far apart rings travel
    const moonX = DX + (cols >> 1) + 0.5, moonY = (rows >> 1) * 2 + 1 - DY, moonR = Math.max(3.5, Math.min(cols * 0.1, lines * 0.12)); // the moon: mid screen, when the view has come to rest
    const o = Array.from({ length: 6 }, () => R(0, 99)); // where each kind of unevenness starts

    // How bright the sky is at a half cell, on the scale of the SKY ramp: 0 overhead, 5 on the horizon, 9 beside the moon.
    const shine = (x, y) => {
      const high = (farY - y) / lines, base = high >= 0.9 ? 0 : 5 * (1 - high / 0.9) ** 1.6;
      return Math.min(9, base + 9 * Math.exp((1 - Math.hypot(x + 0.5 - moonX, (y + 0.5 - moonY) * ya) / moonR) * 0.85));
    };
    const face = (mx, my) => { // the moon's face at a point, in its radii from its middle
      let sea = 9;
      for (const [x, y, r] of SEAS) sea = Math.min(sea, Math.hypot(mx - x, my - y) / r);
      return sea < 0.55 ? MOON + 3 : sea < 1 ? MOON + 2 : my - mx > 0.95 ? MOON + 1 : MOON;
    };

    // Sky in clean bands, the moon, hills in two layers of haze, and the trees of the far shore.
    const woods = new Float32Array(WW);
    for (let x = 0; x < WW; x++) {
      const far = lines * (0.03 + 0.12 * noise(x / (lines * 0.2) + o[1], 1) ** 1.3 + 0.03 * noise(x / (lines * 0.06) + o[1], 2));
      const near = lines * (0.015 + 0.07 * noise(x / (lines * 0.28) + o[2], 3) + 0.015 * noise(x / (lines * 0.05) + o[2], 4));
      const wood = (woods[x] = lines * 0.02 * (1 + 1.6 * noise(x * 0.4 + o[3], 5)));
      for (let y = -DY; y < farY; y++) {
        const up = farY - y, mx = (x + 0.5 - moonX) / moonR, my = ((y + 0.5 - moonY) * ya) / moonR;
        world[(y + DY) * WW + x] = up <= wood ? (up <= 1 ? TREE + 2 : up > wood - 1 ? TREE : TREE + 1) : up <= near ? HILL + 1 : up <= far ? HILL
          : mx * mx + my * my <= 1 ? face(mx, my) : SKY + Math.round(shine(x, y));
      }
    }

    // Stars, wherever the sky is dark: fewer down in the haze and near the moon. The brighter ones twinkle.
    const twinkle = [];
    for (let r = 0; r < skyRows + (farY >> 1); r++) for (let c = 0; c < WW; c++) {
      const level = Math.max(world[r * 2 * WW + c], world[(r * 2 + 1) * WW + c]) - SKY, h = hash(c + seed * 311, r + 5000);
      if (level > 6 || h > 0.085 - 0.011 * level) continue;
      const size = hash(r + 7000, c + seed * 57), i = r * WW + c;
      chars.glyph[i] = size < 0.8 ? ((h * 9973) & 1 ? DOT : HIGH) : size < 0.93 ? PLUS : STAR;
      chars.ink[i] = STARRY + (size < 0.45 ? 0 : size < 0.8 ? 1 : size < 0.93 ? 2 : size < 0.98 ? 3 : 4);
      chars.bold[i] = size < 0.93 ? 0 : 1;
      if (size >= 0.8) twinkle.push({ c, r, k: size * 977 });
    }
    if (moonR >= 6) for (const [mx, my, ch] of CRATERS) {
      const c = Math.round(moonX - 0.5 + mx * moonR), r = Math.floor((moonY + (my * moonR) / ya) / 2), i = (r * 2 + DY) * WW + c;
      if (world[i] >= MOON && world[i] <= MOON + 1 && world[i + WW] >= MOON && world[i + WW] <= MOON + 1) mark(c, r, ch, MOON + 3);
    }

    // The lake, with the island in the middle of it and the bank beyond a
    // stretch of water: nearest the island one way, and curling round it from
    // there, in front of it and back toward the far shore.
    const rim = (a) => RI * (1 + 0.07 * Math.cos(3 * a + o[5]) + 0.04 * Math.cos(5 * a + o[4])); // how far the island reaches from its middle, each way
    const way = lerp(WAY[0], WAY[1], tall), wx = Math.cos(way), wy = Math.sin(way), bankAt = RI + W * lerp(GAP[0], GAP[1], tall);
    const onBank = (U, V) => {
      const turn = ((Math.atan2(V, U) - way + 3 * Math.PI) % (2 * Math.PI)) - Math.PI; // how far round from the nearest way that is
      return Math.hypot(U, V) > bankAt + W * (CURL[turn < 0 ? 0 : 1] * turn * turn + 0.18 * (noise(turn * 4 + o[0], 1) - 0.5));
    };
    const shoreY = new Int16Array(WW).fill(-1); // the island's near shore, in each column that has one
    let nearest = Infinity; // how far the bank is from the middle of the island, where it is nearest
    for (let y = farY; y < lines; y++) {
      const Z = K / (K + y - planeY), V = ((y - planeY) / flat) * Z, deep = (y - farY) / (lines - farY);
      for (let x = 0; x < WW; x++) {
        const i = at(x, y), U = (x - midX) * Z, d = Math.hypot(U, V) || 1e-6, edge = d < RI * 1.5 ? rim(Math.atan2(V, U)) : 0;
        const gx = (U / d) * Z, gy = ((V / d) * Z * Z) / flat - ((U / d) * U * Z) / K; // how fast that distance grows across and down the screen
        crest[i] = 0.72 * Math.hypot(gx, gy);
        lean[i] = Math.abs(gx) > 2.2 * Math.abs(gy) ? (gx < 0 ? 1 : 2) : 0;
        dist[i] = d - source;
        if (d < edge) { // the island: lantern light spills on the grass before the pavilion, and the moon's lies here and there
          const pool = Math.hypot((U - W * 0.04) / (W * 0.5), (V - W * 0.3) / (W * 0.3));
          scene[i] = pool < 1 - 0.3 * dith(x, y) ? ISLET + 2 : noise((U * 3) / W + o[2], (V * 3) / W) + U / (RI * 2.5) > 0.6 ? ISLET + 1 : ISLET;
          kind[i] = DRY; shoreY[x] = y;
        } else if (onBank(U, V)) {
          const haze = clamp01((Z - 0.8) / 0.55), spent = d > W * REACH;
          dist[i] = (spent ? W * REACH + (d - W * REACH) * 0.15 : d) - source;
          if (spent) crest[i] *= 0.15;
          const g = 3.6 - 3.4 * haze + (noise((U * 2.2) / W + o[0], (V * 2.2) / W) - 0.5) * 2.4;
          scene[i] = haze < 0.7 && noise((U * 1.3) / W + 50, (V * 1.3) / W + o[1]) > 0.66 ? LIT : GRASS + Math.max(0, Math.min(4, Math.round(g + (dith(x, y) - 0.5) * 0.35)));
          kind[i] = TURF; nearest = Math.min(nearest, d);
        } else {
          const streak = noise(x * 0.035 + o[4], y * 0.9), k = y - farY - 1; // long level streaks: the water is calm
          const mirrored = k >= 0 && k < woods[x] * 0.6 + 1 + streak * 1.5; // the far trees
          scene[i] = y === farY ? (hash(x >> 2, 7) < 0.85 ? MIST : LAKE) : mirrored ? TREE + 3 : d < edge + W * 0.07 ? SHOAL : LAKE + Math.max(0, Math.min(5, Math.round(deep * 5.3 - 0.3 + (streak - 0.5) * 0.9)));
          kind[i] = WET;
        }
      }
    }
    // Where land meets water: the island's shore pale in the moonlight all the
    // way round, with the bank under its near edge; and the bank's grassy lip.
    const wet = (i) => kind[i] === WET;
    for (let y = farY; y < lines - 1; y++) for (let x = 1; x < WW - 1; x++) {
      const i = at(x, y), k = kind[i];
      if (k === TURF && (wet(i - WW) || wet(i - 1) || wet(i + 1))) { scene[i] = LIP; kind[i] = 0; }
      else if (k === DRY && (wet(i - WW) || wet(i + WW) || wet(i - 1) || wet(i + 1))) {
        scene[i] = wet(i + WW) ? RIM : RIM + 1; kind[i] = 0;
        if (wet(i + WW)) { scene[i + WW] = RIM + 2; kind[i + WW] = 0; }
      }
    }

    // On the island: a pine toward the back on the left, rocks on the shore at
    // the right (each told by the way it lies from the middle, and half its
    // width and its height in 37ths of the pavilion's width), and stepping
    // stones from the pavilion's steps to the footbridge.
    {
      const [x0, y0] = onPlane(Math.cos(3.55) * RI * 0.72, Math.sin(3.55) * RI * 0.72), c0 = Math.round(x0), r0 = Math.round(y0);
      for (let up = 0; up < Math.ceil(17 * u); up++) for (let dx = -Math.ceil(9.5 * u); dx <= Math.ceil(4.5 * u); dx++) {
        const colour = pine(dx / u, (up + 0.5) / u);
        if (colour) dot(c0 + dx, r0 - up, colour);
      }
    }
    for (const [a, w, h] of [[0.42, 2.4, 4.6], [0.78, 3.2, 2.2], [5.8, 2.6, 3]]) {
      const [x0, y0] = onPlane(Math.cos(a) * rim(a) * 0.9, Math.sin(a) * rim(a) * 0.9), rw = Math.max(1, Math.round(w * u)), rh = Math.max(1, Math.round(h * u));
      const rock = (dx, up) => (dx / (rw + 0.5)) ** 2 + ((up + 0.5) / rh) ** 2 <= 1;
      for (let up = 0; up < rh; up++) for (let dx = -rw; dx <= rw; dx++) {
        if (rock(dx, up)) dot(Math.round(x0) + dx, Math.round(y0) - up, (!rock(dx, up + 1) && dx >= 0) || !rock(dx + 1, up) ? ROCK + 2 : dx > 0 || !rock(dx, up + 1) ? ROCK + 1 : ROCK);
      }
    }
    const foot = rim(way) * 0.96; // where the footbridge leaves the island
    {
      const e = baseY + 3 - planeY, P0 = [0, (e / flat) * (K / (K + e))], P2 = [wx * foot, wy * foot], P1 = [P2[0] * 0.3, Math.max(P0[1], P2[1]) * 1.25];
      const stones = Math.max(3, Math.round(Math.hypot(P2[0] - P0[0], P2[1] - P0[1]) / (W * 0.11)));
      for (let n = 0; n < stones; n++) {
        const t = n / stones, [x, y] = onPlane(lerp(lerp(P0[0], P1[0], t), lerp(P1[0], P2[0], t), t), lerp(lerp(P0[1], P1[1], t), lerp(P1[1], P2[1], t), t));
        for (let dx = 0; dx < Math.max(1, Math.round(W * 0.05)); dx++) if (kind[at(Math.round(x) + dx, Math.round(y))] === DRY) dot(Math.round(x) + dx, Math.round(y), PATH);
      }
    }

    // The footbridge: planks on a low arch with a rail along them, on posts,
    // from the island's shore to the bank, one column of it at a time.
    let reach = foot;
    while (reach < W * 8 && !onBank(wx * reach, wy * reach)) reach += 0.5;
    const span = new Map(); // each column the bridge crosses: the water's level under it, and how far along the bridge it is
    for (let p = foot; p <= reach; p += 0.2) {
      const [x, y] = onPlane(wx * p, wy * p), c = Math.round(x);
      if (!span.has(c)) span.set(c, [Math.round(y), (p - foot) / (reach - foot)]);
    }
    const arch = Math.max(1, W * 0.05), every = Math.max(3, Math.round(W * 0.09)); // how high it rises in the middle, and how far apart its posts are
    [...span.keys()].sort((a, b) => a - b).forEach((c, n, all) => {
      const [y, t] = span.get(c), deck = y - 1 - Math.round(arch * Math.sin(Math.PI * t)), post = n % every === 0 || n === all.length - 1;
      dot(c, deck, DECK);
      dot(c, deck - 2, DECK);
      if (post) { dot(c, deck - 1, DECK + 1); for (let k = deck + 1; k <= y; k++) dot(c, k, DECK + 1); }
      const shadow = at(c, 2 * y - deck);
      if (inside(c, 2 * y - deck) && wet(shadow) && scene[shadow] >= LAKE && scene[shadow] < LAKE + 6) scene[shadow] = LAKE + 7; // the planks, mirrored
    });

    // The pavilion, on the middle of the island. First the roof, column by
    // column: a hollow slope from the knob down to eaves that turn up at their
    // tips, its ridges and its right side catching the moon.
    for (let dx = -half; dx <= half; dx++) {
      const a = Math.abs(dx) / half, lift = W * 0.085 * clamp01((a - 0.6) / 0.4) ** 2;
      const bottom = Math.round(eaveY - lift), top = Math.min(bottom - 1, Math.round(eaveY - lift - 1.5 - (roofH - 1.5) * (1 - a) ** 1.6));
      for (let y = top; y < bottom; y++) {
        dot(midX + dx, y, y === top ? (dx > 0 ? ROOF + 3 : ROOF + 4) : y === bottom - 1 && a < 0.6 ? ROOF + 5 : dx < -half * 0.2 ? ROOF : dx > half * 0.35 ? ROOF + 2 : ROOF + 1);
      }
    }
    for (let y = eaveY - roofH - knob; y < eaveY - roofH; y++) for (let dx = y === eaveY - roofH - 1 && knob > 2 ? -1 : 0; dx <= (y === eaveY - roofH - 1 && knob > 2 ? 1 : 0); dx++) dot(midX + dx, y, GOLD);
    // Under it a beam on two pillars, and between them the lantern's light,
    // the lantern, and the man: he is drawn here without his arms or the tail of his hair.
    const pillar = Math.round(half * 0.64), thick = Math.max(1, Math.round(W * 0.055)), beam = Math.max(1, Math.round(W * 0.05)), plat = pillar + Math.max(1, Math.round(W * 0.06));
    for (let dx = -pillar; dx <= pillar; dx++) for (let y = eaveY; y < floorY; y++) {
      const fx = dx / u, fy = (floorY - y - 0.5) / u, inset = pillar - Math.abs(dx), far = Math.hypot(fx - HANG[0], fy - HANG[1] - 1.5);
      dot(midX + dx, y, y < eaveY + beam ? RED
        : inset < thick ? (dx < 0 ? (inset ? RED + 2 : RED + 1) : inset ? RED + 3 : RED + 2) // a pillar: the faces turned to the lantern are lit
        : lantern(fx, fy) || sitter(Math.floor(dx / pix + 0.5), Math.floor((floorY - y - 0.5) / pix)) || GLOW + (far < 3 ? 0 : far < 5.5 ? 1 : far < 9 ? 2 : 3));
    }
    for (let dx = -plat; dx <= plat; dx++) for (let y = floorY; y < baseY; y++) dot(midX + dx, y, y > floorY ? STONE + 2 : Math.abs(dx) <= pillar - thick ? STONE : STONE + 1); // its base of stone
    if (u > 0.6) for (let k = 0; k < 2; k++) for (let dx = -Math.round((3.5 + k) * u); dx <= Math.round((3.5 + k) * u); dx++) dot(midX + dx, baseY + k, STONE + 1 + k); // and two steps down to the grass

    // The pavilion is mirrored in the water before the island, about its own
    // foot, as a deeper tint in streaks, and its lantern-lit inside as glints.
    const mirror = (x, y) => { // what is mirrored at a half cell of water: 0 nothing, 1 something dark, 2 something in the lantern's light
      const from = 2 * baseY - y, c = shoreY[x] >= 0 && y > shoreY[x] && from >= 0 ? scene[at(x, from)] : 0;
      return WARM.includes(c) ? 2 : c >= ROOF && c < HOUSE ? 1 : 0;
    };
    for (let x = 0; x < WW; x++) for (let y = shoreY[x] + 1; shoreY[x] >= 0 && y < lines; y++) {
      const i = at(x, y), k = y - shoreY[x];
      if (kind[i] === WET && scene[i] >= LAKE && scene[i] < LAKE + 6 && mirror(x, y) === 1 && hash(k, x >> 3) > 0.3) scene[i] += k < 5 ? 2 : 1;
    }

    // Lily pads on open water round the island, most of them with a lotus bud.
    const ashore = T.pluck + (nearest - source) / v; // when the first ring reaches the bank
    const pads = [];
    for (let tries = 0; tries < 600 && pads.length < 13; tries++) {
      const a = R(0, 6.283), far = R(RI + W * 0.3, RI + W * 1.5), U = Math.cos(a) * far * 1.2, V = Math.sin(a) * far;
      const [px, py] = onPlane(U, V), Z = K / (K + py - planeY);
      const x = Math.round(px), top = Math.round(py / 2) * 2, r = Math.max(1, Math.round((W * 0.085) / Z)); // on an even line, so the flower above it fills one row of cells
      let free = top - 2 > farY + 2 && top + 1 < lines && x - r - 2 >= 0 && x + r + 2 < cols && !pads.some((p) => Math.abs(p.x - x) < r + p.r + 3 && Math.abs(p.top - top) < 5);
      for (let dx = -r - 2; free && dx <= r + 2; dx++) for (let y = top - 2; y <= top + 1; y++) if (kind[at(x + dx, y)] !== WET) free = false;
      if (!free) continue;
      const d = Math.hypot(U, V) - source, note = Math.max(0, Math.ceil((ashore - 0.3 - T.pluck - d / v) / T.beat)) + (rand() < 0.4 ? 1 : 0);
      pads.push({ x, top, r, big: r > 2, bud: pads.length % 4 !== 3, open: T.pluck + note * T.beat + d / v }); // it opens as a ring passes, and not before the first has reached the bank
    }
    for (const p of pads) {
      for (let dx = -p.r; dx <= p.r; dx++) dot(p.x + dx, p.top, p.r > 1 && dx === p.r - 1 ? PAD + 1 : PAD);
      if (p.big) for (let dx = 1 - p.r; dx < p.r; dx++) dot(p.x + dx, p.top + 1, PAD + 1);
    }
    const lotus = pads.filter((p) => p.bud);

    // Characters of the lake: tiles on the roof, leaves on the far shore,
    // marks on the water and what is mirrored in it, tufts in the grass. And
    // the flowers of the bank, which wait for a ring.
    const flowers = [];
    for (let r = 0, headAt = -2; r < rows; r++) for (let c = 0; c < WW; c++) {
      const a = at(c, r * 2), b = a + WW, top = scene[a], low = scene[b], h = hash(c + seed * 977, r);
      if (top >= ROOF && top <= ROOF + 2 && low >= ROOF && low <= ROOF + 2 && scene[a - WW] >= ROOF && scene[a - WW] <= ROOF + 4) {
        if ((c + r) & 1) mark(c, r, EQUAL, TILE);
      } else if (top >= TREE && top <= TREE + 2 && low >= TREE && low <= TREE + 2) {
        if (h < 0.3) mark(c, r, h < 0.15 ? AMP : PERCENT, TREE);
      } else if (kind[a] === WET && kind[b] === WET && ((top >= LAKE && top <= LAKE + 7) || top === SHOAL)) {
        const m = mirror(c, r * 2 + 1);
        if (m === 2) { if (h < 0.62) mark(c, r, h < 0.2 ? EQUAL : h < 0.4 ? TILDE : DASH, h < 0.3 ? EMBER : EMBER + 1); }
        else if (m) { if (h < 0.3) mark(c, r, h < 0.15 ? TILDE : DASH, LAKE + 7); }
        else if (top === SHOAL) continue;
        else if (h < 0.05) mark(c, r, h < 0.02 ? TILDE : DASH, top < LAKE + 2 ? top + 2 : top - 2); // the water is calm: a mark here and there,
        else if (h < 0.075 && top < LAKE + 4) mark(c, r, DOT, WAVE + 2); // and a star mirrored
      } else if (kind[a] === TURF && kind[b] === TURF) {
        const Z = K / (K + r * 2 + 1 - planeY), U = (c - midX) * Z, V = ((r * 2 + 1 - planeY) / flat) * Z;
        if (h < 0.06 + 0.38 * smooth(0.3, 0.72, noise((U * 2.4) / W + o[2], (V * 2.4) / W + 9))) { // flowers grow in drifts
          const k = hash(r, c + 4000), size = hash(c, r + 8000), head = size > 0.62 && headAt !== r * WW + c - 1;
          if (head) headAt = r * WW + c;
          flowers.push({
            c, r, open: T.pluck + ((k * BLOOMS) | 0) * T.beat + dist[a] / v + hash(r + 99, c) * 0.4,
            head, low: size > 0.81 ? 1 : 0, // a big one is a half cell of white, the upper or the lower. The rest are characters
            glyph: size < 0.1 ? PLUS : STAR, ink: size < 0.3 ? WHITE + 2 : WHITE + 1,
          });
        } else if (h > 0.76) mark(c, r, TUFT[(h * 997) & 3], top === LIT ? GRASS : top > GRASS + 1 ? top - 2 : top + 2); // a tuft, a little lighter than its grass, or darker where that is light
      } else if (kind[a] === DRY && kind[b] === DRY && top <= ISLET + 1 && h > 0.7) mark(c, r, TUFT[(h * 997) & 3], top === ISLET ? ISLET + 1 : ISLET);
    }
    flowers.sort((p, q) => p.open - q.open);

    // The last view, of the moon: how far each half cell of the screen is from it.
    const away = new Float32Array(cols * lines);
    let corner = 0; // the farthest any of the screen is
    for (let y = 0; y < lines; y++) for (let x = 0; x < cols; x++) corner = Math.max(corner, (away[y * cols + x] = Math.hypot(x + 0.5 - moonX + DX, (y + 0.5 - moonY - DY) * ya)));
    const VEIL = Math.max(2, corner * 0.07); // how far apart the steps of the night's edge are, as it thins

    // The view's path: `sofar[k]` is its length up to k / STEPS of the climb,
    // so that the view can be moved along it by distance.
    const STEPS = 96, sofar = new Float32Array(STEPS + 1);
    for (let k = 1; k <= STEPS; k++) sofar[k] = sofar[k - 1] + Math.hypot(DX * (across(k / STEPS) - across((k - 1) / STEPS)), DY / STEPS);
    const view = (s) => { // where the view is at story time s: half cells across and up from the opening view
      const far = sofar[STEPS] * swoosh(s);
      let k = 0;
      while (k < STEPS - 1 && sofar[k + 1] < far) k++;
      const p = (k + (far - sofar[k]) / (sofar[k + 1] - sofar[k])) / STEPS;
      return [DX * across(p), DY * p];
    };
    // The part of the pavilion his arms and the tail of his hair move in.
    const manTop = Math.max(eaveY + beam, Math.ceil(floorY - 0.5 - 14 * pix)), manBottom = Math.floor(floorY - 0.5 - 4 * pix) + 1, manWide = Math.min(pillar - thick, Math.ceil(9.5 * pix));
    const landfall = RI - source; // how far a ring has spread when it reaches the water

    return {
      cols, rows, palette: PALETTE, glyph, ink, bold, paint,
      render(t) { // t: seconds since the film started
        glyph.fill(32); ink.fill(0); bold.fill(0); paint.fill(0);
        if (!(t < LENGTH)) return this; // over: an empty frame, so the page shows
        const s = Math.max(0, t) * SPEED; // where that is in the story
        // The part of the world in view. Paint moves by half cells and
        // characters by whole rows, so while it climbs they are at most half a row apart.
        const [px, py] = view(s), cx = Math.round(px), cy = Math.round(py), down = (cy + 1) >> 1, row0 = skyRows - down;
        for (let y = 0; y < lines; y++) { const from = (DY - cy + y) * WW + cx; paint.set(world.subarray(from, from + cols), y * cols); }
        for (let r = 0; r < rows; r++) {
          const from = (row0 + r) * WW + cx;
          glyph.set(chars.glyph.subarray(from, from + cols), r * cols); ink.set(chars.ink.subarray(from, from + cols), r * cols); bold.set(chars.bold.subarray(from, from + cols), r * cols);
        }
        const put = (c, r, ch, colour, heavy) => { if (c >= 0 && c < cols && r >= 0 && r < rows) { const i = r * cols + c; glyph[i] = ch; ink[i] = colour; bold[i] = heavy; } };

        if (cy < lines - farY) { // the lake is in view
          const set = (x, y, colour) => { if (x >= cx && x < cx + cols && y + cy < lines) paint[(y + cy) * cols + x - cx] = colour; };

          // Rings: one for each note so far, a fixed distance apart. Over the
          // island's grass a ring is a passing gleam; on water a crest is a line
          // of light with a darker trough behind it, fading to a few characters
          // as it spends itself. In the bank's grass it is a gleam again.
          const lead = v * (s - T.pluck); // how far the first ring has spread
          if (lead > 0) for (let y = farY; y < lines - cy; y++) {
            const from = y * WW + cx, to = (y + cy) * cols, row = ((y + cy) >> 1) * cols;
            for (let x = 0; x < cols; x++) {
              const k = kind[from + x];
              if (!k) continue;
              const d = dist[from + x], n = Math.round((lead - d) / gap); // the ring nearest this half cell
              if (n < 0 || n >= NOTES || lead < n * gap) continue;
              const e = lead - n * gap - d, w = crest[from + x]; // how far behind that ring's crest it is (ahead, if negative)
              if (k === DRY) { if (e > -w && e <= w * 1.5) paint[to + x] = ISLET + 3; continue; }
              if (k === TURF) { if (n < BLOOMS && e > -w && e <= w * 2.5) paint[to + x] = LIT + 1; continue; }
              if (e <= -w) continue;
              const c = scene[from + x];
              if (e > w) { if (e <= w * 2.6 && d < landfall + W * 0.8 && c >= LAKE && c < LAKE + 7) paint[to + x] = c + 1; continue; }
              const spent = d < landfall + W * 0.45 ? 0 : d < landfall + W * 0.95 ? 1 : d < landfall + W * 1.45 ? 2 : 3;
              if (spent < 3) paint[to + x] = WAVE + spent; else if (d > landfall + W * 1.85) continue;
              const side = lean[from + x];
              if (hash(side ? y >> 1 : x + cx, n * 7 + 3) < 0.36) { glyph[row + x] = side ? (side === 1 ? OPEN : CLOSE) : TILDE; ink[row + x] = spent < 2 ? WHITE : WAVE + 1; bold[row + x] = 0; }
            }
          }

          // Flowers in the grass: a bud, half open, then a flash of white as each opens.
          for (const f of flowers) {
            const age = s - f.open, c = f.c - cx, r = f.r + down;
            if (age < 0) break;
            if (c < 0 || c >= cols || r >= rows) continue;
            if (f.head && age >= 0.42) { set(f.c, f.r * 2 + f.low, age < 0.9 ? WHITE : WHITE + 1); glyph[r * cols + c] = 32; continue; }
            put(c, r, age < 0.2 ? DOT : age < 0.42 ? RING : f.glyph, age < 0.9 ? WHITE : f.ink, age > 0.2 ? 1 : 0);
          }

          // Lotus on the lily pads: a bud that opens as a ring passes it.
          for (const p of lotus) {
            const age = s - p.open, y = p.top - 1, flash = age > 0.3 && age < 0.55;
            if (age < 0.12) { set(p.x, y, LOTUS); if (p.big) set(p.x, y - 1, LOTUS + 1); continue; }
            if (age < 0.3 || !p.big) { // half open (and as far as a small one goes)
              set(p.x - 1, y, LOTUS + 1); set(p.x, y, age < 0.3 ? LOTUS : LOTUS + 4); set(p.x + 1, y, LOTUS + 1); set(p.x, y - 1, age < 0.3 ? LOTUS + 1 : LOTUS + 2);
              continue;
            }
            for (let dx = -2; dx <= 2; dx++) set(p.x + dx, y, flash ? LOTUS + 3 : dx ? LOTUS + 3 - Math.abs(dx) : LOTUS + 4);
            for (let dx = -1; dx <= 1; dx++) set(p.x + dx, y - 1, flash || !dx ? LOTUS + 3 : LOTUS + 2);
            put(p.x - cx, (y + cy) >> 1, STAR, flash ? WHITE : LOTUS + 4, 1);
          }

          // The man plays. One hand lifts before each note and comes down on
          // it, and the string sounds; the other slides along the strings. The
          // tail of his hair swings a little as he moves.
          const beats = (s - T.pluck) / T.beat, since = beats - Math.floor(beats);
          const lift = Math.floor(beats) + 1 < NOTES ? 2.2 * smooth(0.45, 0.85, since) : 0, slide = 1.5 * Math.sin(s * 1.1), sounding = beats >= 0 && beats < NOTES && since < 0.3;
          const sway = Math.round(0.6 * Math.sin(s * 1.9));
          for (let y = manTop; y < manBottom; y++) for (let dx = -manWide; dx <= manWide; dx++) {
            const j = Math.floor(dx / pix + 0.5), i = Math.floor((floorY - y - 0.5) / pix), plucking = arm(j, i + 0.5, -5, 6 + lift, -3.2), stopping = arm(j, i + 0.5, 4.5 + slide, 6, 3.2);
            if (TAIL.some(([a, b]) => b === i && a + (b < 9 ? sway : 0) === j)) set(midX + dx, y, HAIR);
            else if (plucking || stopping) set(midX + dx, y, plucking === 1 || stopping === 1 ? SKIN : plucking ? ROBE + 1 : ROBE);
            else if (sounding && i === 4 && Math.abs(j) <= 8) set(midX + dx, y, QIN + 2);
          }
        }

        // Stars twinkle.
        for (const w of twinkle) {
          const k = Math.sin(s * 2.6 + w.k);
          if (k > 0.72) put(w.c - cx, w.r - row0, STAR, STARRY + 3, 1); else if (k < -0.72) put(w.c - cx, w.r - row0, DOT, STARRY + 1, 0);
        }

        // While the view moves fast each star is drawn out along the way it
        // has just come: up and to the right of it, the way the view is going.
        const [qx, qy] = view(s - SHUTTER), tc = Math.round(px - qx), tr = Math.round((py - qy) / 2), long = Math.max(tc, tr);
        if (long > 0) {
          const streak = tr * 2 * ya > tc * 3.5 ? BAR : tr * 2 * ya < tc * 0.55 ? DASH : SLASH;
          for (let r = 0; r < rows; r++) for (let c = cols - 1; c >= 0; c--) { // from the right, so that a streak just drawn is not taken for a star
            const i = r * cols + c, colour = ink[i];
            if (colour < STARRY || colour > STARRY + 4) continue;
            for (let n = 1; n <= long; n++) {
              const c2 = c + Math.round((tc * n) / long), r2 = r - Math.round((tr * n) / long), j = r2 * cols + c2;
              if (c2 >= cols || r2 < 0) break;
              if (glyph[j] !== 32 || paint[j * 2 - c2] > SKY + 9) continue; // only over open sky
              glyph[j] = streak; ink[j] = n * 2 > long ? STARRY : colour; bold[j] = 0;
            }
          }
        }

        // The ending. The night thins from the corners of the screen in toward
        // the moon, its stars going out a moment after; then the moon thins
        // too, until only the page is left.
        if (s > T.thin) {
          const hold = lerp(corner + VEIL, moonR - 6 * VEIL, clamp01((s - T.thin) / (T.end - T.thin))), waned = 5 * clamp01((s - T.fade) / (T.end - T.fade));
          for (let y = 0, i = 0; y < lines; y++) for (let x = 0; x < cols; x++, i++) {
            const lunar = paint[i] >= MOON && paint[i] <= MOON + 3, gone = lunar ? waned : (away[i] - hold) / VEIL;
            if (gone <= 0) continue;
            const step = Math.floor(gone + dith(x, y));
            if (step > 0) paint[i] = step > 4 ? 0 : (lunar ? WANE : THIN) + step - 1;
            if (!(y & 1) && gone > 1.5 + 3 * hash(x, y)) glyph[(y >> 1) * cols + x] = 32;
          }
        }
        return this;
      },
    };
  }

  const film = { length: LENGTH, still: 2, createScene };
  return { play: (options) => AsciiStage.play(film, options), createScene };
})();
