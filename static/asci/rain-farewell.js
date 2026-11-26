/*
 * Farewell in the rain: an ASCII loading screen.
 *
 *   <script src="ascii-stage.js"></script>
 *   <script src="rain-farewell.js"></script>
 *   <script>RainFarewell.play().then(showThePage);</script>
 *
 * A wuxia painting in misty greens, in steady slanting rain. A swordsman in
 * dark grey-blue robes stands with his back to us on the near bank of a still
 * green pond, a broad saber hanging from his left hand. Across the water a
 * woman in pale blue stands on a grassy bank among bamboo, under a
 * yellow-orange oil-paper umbrella. Two flocks of birds cross the pale sky and
 * are gone. She bows, dipping the umbrella and her head. A bank of mist rolls
 * in from the left along the far shore and takes her from the feet up, the
 * umbrella last, then thins and moves on: the bank where she stood is empty.
 * He lowers his head a little. Then a second bank of mist rolls in from the
 * left over everything and thins away to show the page. Five seconds (LENGTH,
 * below).
 *
 * The camera never moves. The whole of it is a pure function of time:
 * createScene().render(t) fills a grid of characters and the colours behind
 * them, and the stage (ascii-stage.js) paints that grid on a canvas.
 */
const RainFarewell = (() => {
  'use strict';
  const { code, clamp01, lerp, smooth, mulberry32, hash, noise } = AsciiStage;

  // The story's timeline, in the seconds of the user's description.
  const T = {
    bow: 2.5,    // she lowers her umbrella a little and dips her head, as if bowing
    bowed: 4.0,  // and holds the bow
    mist: 4.0,   // a bank of mist rolls in from the left along the far shore
    reach: 4.7,  // it reaches her, and rises over her from the feet up
    lower: 8.5,  // the bank where she stood is empty again, and he lowers his head
    roll: 10.0,  // the clip is over: a second bank of mist rolls in from the left over everything
    thin: 10.45, // and behind it, from the left, thins away to show the page
    end: 11.35,  // the page is showing everywhere
  };
  // It is played faster than that. LENGTH is how many seconds the whole of it
  // takes on screen, and SPEED how many times faster than the story that is.
  const LENGTH = 5, SPEED = T.end / LENGTH;

  const DRIFT = 0.025; // screen heights a second that the mist on the hills drifts to the right
  const ROLL = 0.1;    // and the billows of the bank, as it rolls along the far shore
  const RISE = 2.4;    // seconds the bank takes to rise to its full height where it has arrived
  const RAIN = 0.75;   // screen heights a second that the rain falls
  const SLANT = 0.5;   // columns the rain moves left for each row it falls: it comes from the upper right

  // Colours. `swatch` adds a run of colours to INK and gives the index of the first.
  const INK = ['#000000'];
  const swatch = (...colours) => INK.push(...colours) - colours.length;
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const PALE = rgb('#ccd9d1'); // the mist
  // Whatever the mist can lie over comes in four strengths of it: a colour,
  // then the same colour with more mist over it at +1, +2 and +3, so the next
  // colour of a ramp is at +4. Full mist is MIST. The strengths crowd toward
  // full, so that the heart of a bank is smooth rather than speckled.
  const LEVEL = [0, 0.3, 0.6, 0.85, 1];
  const misty = (...colours) => swatch(...colours.flatMap((hex) => [0, 1, 2, 3].map((k) =>
    '#' + rgb(hex).map((v, j) => Math.round(v + (PALE[j] - v) * LEVEL[k]).toString(16).padStart(2, '0')).join(''))));
  const FIRST = INK.length;
  const SKY = misty('#e4eff3', '#dce9eb', '#d3e2df'); // overcast, from the top down to the hills
  const HILL = misty('#bfcfca', '#b1c3bd', '#a0b6ab', '#92a99d', '#7e9784', '#6c8672'); // far hills lit and in shade, nearer hills, the wooded hill
  const TREE = misty('#55705a', '#46604a', '#384f3c'); // the trees along the far shore
  const POND = misty('#a2b4a0', '#8c9f88', '#76896f', '#62775a'); // the far reach of the water, palest far off
  const GRASS = misty('#9fb35e', '#7a9446', '#5c7638', '#43592b'); // the far bank: grass in the light, to the shade at the water's edge
  const CANE = misty('#8aa272', '#6c885a', '#526e43', '#3c5531'); // the bamboo behind her
  const ROBE = misty('#cbe4e9', '#a8cad3', '#83a9b5'); // her robes: lit, plain, in shadow
  const LOCK = misty('#141018', '#2a2230'); // her hair
  const FACE = misty('#f5e7e0'); // her skin, pale
  const PAPER = misty('#f3be57', '#e19c37', '#b8772c'); // the oil-paper umbrella: its lit top, its body, its rim and shaft
  const BLOOM = misty('#f3f7f0', '#d6e3d5'); // small white flowers and specks of light on the water
  const LAST = INK.length;
  const MIST = swatch('#ccd9d1');
  const WATER = swatch('#536a49', '#455b3c', '#384d30', '#2c4026', '#23341f'); // the near water, darker toward us
  const REED = swatch('#486636', '#36502a', '#273e1f', '#1a2c15', '#62804a'); // the bamboo along the right edge: lit edge, body, shade, joint, a leaf in the light
  const EARTH = swatch('#2f4423', '#22341b', '#182715', '#101b0e'); // the near bank and the grass at the right, its lit edge to deep shade
  const COAT = swatch('#0c131a', '#131c26', '#1b2632', '#273545', '#384b5e'); // his robes, deep fold to the light on his shoulders
  const MANE = swatch('#0b0f10', '#161d1e', '#2b3534'); // his hair, with its sheen
  const SASH = swatch('#4a5963');
  const STEEL = swatch('#1d2629', '#313d40', '#95a4a0'); // the saber: its back, its flat, its edge
  const HAND = swatch('#dcbcad', '#c29c8e'); // pale skin, in the soft light and in shade
  const SPECK = swatch('#f7fbf5'); // bright specks in the grass
  const BIRD = swatch('#3b4943');
  const BRUSH = swatch('#1c221f'); // the calligraphy's ink
  const SEAL = swatch('#9a2b25', '#b4403a', '#cb6251'); // the seal: its rim, its body, a lighter fleck
  const DROP = swatch('rgba(230,239,234,0.38)', 'rgba(240,246,242,0.68)'); // rain streaks, fainter and brighter
  const VEIL = swatch(...Array.from({ length: 8 }, (_, i) => `rgba(204,217,209,${((i + 1) / 8).toFixed(3)})`)) - 1; // the last bank: VEIL + 1, the thinnest, to VEIL + 8, solid
  // A colour with m more of the mist over it (0 to 1), dithered by d (0 to
  // 1). A colour may already have some mist in it: the far things do.
  const fog = (c, m, d) => {
    if (c < FIRST || c >= LAST || m <= 0) return c;
    const had = (c - FIRST) & 3, total = 1 - (1 - LEVEL[had]) * (1 - m);
    let q = had;
    while (q < 4 && total >= LEVEL[q + 1]) q++;
    if (q < 4 && (total - LEVEL[q]) / (LEVEL[q + 1] - LEVEL[q]) + d >= 1) q++;
    return q >= 4 ? MIST : c - had + q;
  };
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  const [BAR, SLASH, BACK, LOW, DASH, HIGH, TICK, COMMA, DOT, WAVE, STAR, RING, OPEN, SHUT, QUOTE, VEE, EQUAL] = code("|/\\_-'`,.~*o()\"v=");

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
    const H2 = rows * 2, N = cols * H2;     // the picture is cols x H2 half cells, each roughly square
    const U = rows * aspect, Wu = cols / U; // columns to one screen height, and the screen's width in screen heights
    const X = (c) => (c + 0.5) / U - Wu / 2, Y = (h) => (h + 0.5) / H2; // a half cell's place, across from the middle and down from the top, in screen heights
    const col = (x) => Math.floor((x + Wu / 2) * U), half = (y) => Math.floor(y * H2); // and the column and half row a point is in
    const glyph = new Uint8Array(cols * rows), ink = new Uint8Array(cols * rows), bold = new Uint8Array(cols * rows), wash = new Uint8Array(cols * rows), paint = new Uint8Array(N);

    // Where the two of them stand. The painting is tall and narrow; on a wider
    // screen they stand farther apart, with more of the pond, the far shore and
    // the bamboo round them, and on a screen narrower than the painting both
    // are smaller, and he stands nearer the middle, so that most of his saber
    // is still on screen. The bottom of the screen cuts him off at the knees.
    const small = Math.min(1, Math.sqrt(Wu / 0.62));
    const F = 0.82 * Math.max(0.7, small * small), MX = Math.max(-Math.min(0.22 * Wu, 0.5), 0.3 * F - Wu / 2), MTOP = 1.01 - 0.72 * F; // his height, where he stands, the top of his head
    const WH = 0.21 * Math.max(0.8, small), WX = Math.min(0.17 * Wu + 0.02, 0.42), YF = 0.505; // her height, where she stands, where her feet are

    // The lie of the land, column by column: the far and near edges of the
    // water (the far one juts toward us in the spit of grass she stands on,
    // and beyond her the bank comes round toward us), the back of the land on
    // the far side, and four skylines: far hills, nearer hills, the wooded
    // hill that rises behind her, and the trees along the far shore.
    const far = new Float32Array(cols), near = new Float32Array(cols), back = new Float32Array(cols), tops = [0, 1, 2, 3].map(() => new Float32Array(cols));
    // The bank of mist, column by column: when it arrives and when it has
    // thinned away, the line it lies on, how high it rises (highest where it
    // swallows her, umbrella and all), and how ragged its edges are (least
    // round her, so that it takes her evenly from the feet up).
    const arrive = new Float32Array(cols), clear = new Float32Array(cols), lies = new Float32Array(cols), heap = new Float32Array(cols), ragged = new Float32Array(cols);
    for (let c = 0; c < cols; c++) {
      const x = X(c), spit = smooth(WX - 0.24, WX - 0.1, x);
      far[c] = 0.468 + 0.008 * (noise(x * 9 + 3, seed) - 0.5) + 0.072 * spit + 0.33 * smooth(WX + 0.16, WX + 0.85, x);
      near[c] = 0.875 + 0.012 * (noise(x * 6, seed + 7) - 0.5) - 0.2 * smooth(WX - 0.3, WX + 0.75, x);
      back[c] = lerp(far[c] - 0.03, YF - 0.012 + 0.006 * (noise(x * 14, seed + 5) - 0.5), spit);
      tops[0][c] = 0.2 + 0.09 * (noise(x * 2.1 + 5, seed + 11) - 0.5) + 0.025 * (noise(x * 7 + 1, seed + 12) - 0.5);
      tops[1][c] = 0.29 + 0.07 * (noise(x * 3.2 + 9, seed + 13) - 0.5) + 0.02 * (noise(x * 9, seed + 14) - 0.5);
      tops[2][c] = 0.37 + 0.05 * (noise(x * 4.4 + 2, seed + 15) - 0.5) + 0.012 * (noise(x * 30, seed + 16) - 0.5) - 0.07 * Math.exp(-(((x - WX - 0.08) / 0.3) ** 2));
      tops[3][c] = back[c] - (0.02 + 0.05 * noise(x * 7 + 4, seed + 17) + 0.006 * noise(x * 40, seed + 18)) * (1 - spit);
      // The bank comes in at the left edge at T.mist, reaches her at T.reach
      // and goes on to the right more slowly. It thins away three seconds
      // after it came, and beyond her a little sooner, so that by T.lower
      // the far shore is clear to the right edge.
      arrive[c] = T.mist + (T.reach - T.mist) * clamp01((x + Wu / 2) / (WX + Wu / 2)) + Math.max(0, x - WX) / 0.5;
      clear[c] = x < WX ? arrive[c] + 3 : T.reach + 3 + 0.6 * (x - WX);
      lies[c] = Math.min(far[c], YF + 0.012) + 0.025;
      heap[c] = lerp(0.24, 0.36, smooth(WX - 0.5, WX - 0.05, x)); // in screen heights above the line it lies on
      ragged[c] = lerp(0.25, 1, smooth(0.06, 0.2, Math.abs(x - WX)));
    }

    // The still picture: the colour of every half cell before any mist drifts
    // over it, what it is, how much of the drifting mist can lie over it, and
    // how far above the line the bank lies on it is.
    const ground = new Uint8Array(N), kind = new Uint8Array(N), haze = new Float32Array(N), rise = new Float32Array(N), thr = new Float32Array(N);
    const SKIES = 1, HILLS = 2, TREES = 3, SHORE = 4, POOL = 5, BANK = 6, CANES = 7, REEDS = 8;
    for (let h = 0, p = 0; h < H2; h++) {
      const y = Y(h);
      for (let c = 0; c < cols; c++, p++) {
        const x = X(c), n = noise(x * 13 + 50, y * 17);
        const d = (thr[p] = ((BAYER[(h & 3) * 4 + (c & 3)] + 0.5) / 16 + 0.6 * hash(c, h + 7)) % 1) - 0.5; // the grain of the brush: mostly random, so no pattern forms
        let what, colour;
        if (y >= near[c]) { // the near bank: wet and dark, a little light along its edge
          what = BANK; colour = EARTH + Math.max(0, Math.min(3, Math.floor((y - near[c]) * 40 + 1 + 1.6 * (n - 0.5) + d * 0.8)));
        } else if (y >= back[c] && (y < far[c] || far[c] >= near[c])) { // grass: the strip of far shore, her spit of land, and the bank coming round at the right
          what = SHORE;
          const by = 1 - smooth(0.1, 0.24, Math.abs(x - WX)), deep = clamp01((y - back[c]) / 0.22) * 2 + (far[c] - y < 0.012 ? 1 : 0) + d * 0.9 + (1 - by) * 0.7;
          colour = GRASS + 4 * (by > 0.5 && n > 0.52 && y < back[c] + 0.04 ? 0 : Math.max(1, Math.min(3, Math.floor(1 + deep)))) + (by < 0.5 && y < 0.5 ? 1 : 0); // the grass in the light round her feet; far off along the shore it is misty
        } else if (y >= far[c]) { // the water, pale far off and dark near, with the far shore standing in it
          what = POOL;
          const j = (y - far[c]) / (near[c] - far[c]), mirror = y - far[c] < 0.015 + 0.5 * (far[c] - tops[3][c]);
          const tone = Math.max(0, Math.min(8, Math.floor(j ** 0.7 * 9 + d * 0.9 + (mirror ? 1.5 : 0) - (noise(x * 4 + 9, y * 70) > 0.7 ? 1 : 0))));
          colour = tone < 4 ? POND + 4 * tone : WATER + tone - 4;
        } else if (y >= tops[3][c]) { what = TREES; colour = TREE + 4 * (y - tops[3][c] < 0.01 ? 0 : y > back[c] - 0.012 ? 2 : 1); }
        else if (y >= tops[2][c]) { what = HILLS; colour = HILL + 4 * (n > 0.5 ? 4 : 5); }
        else if (y >= tops[1][c]) { what = HILLS; colour = HILL + 4 * (n > 0.5 ? 2 : 3); }
        else if (y >= tops[0][c]) { what = HILLS; colour = HILL + 4 * (n > 0.5 ? 0 : 1); }
        else { what = SKIES; colour = SKY + 4 * Math.max(0, Math.min(2, Math.floor(clamp01(y / tops[0][c]) * 2.6 + d * 0.8 + (n - 0.5)))); }
        ground[p] = colour; kind[p] = what;
        haze[p] = smooth(0.2, 0.36, y) * (1 - smooth(far[c] + 0.03, far[c] + 0.09, y)) * (1 - 0.7 * smooth(WX - 0.32, WX - 0.12, x));
        rise[p] = lies[c] - y;
      }
    }

    // Bamboo. A stalk is a column or a few of paint with a joint every so
    // often; over the stalks hang drooping masses of foliage, and from them
    // sprays of leaves (characters, which sway). The grove behind her stands
    // in the mist. The few stalks along the right edge are nearer, and darker.
    const sprays = []; // leaves, six numbers each: column, row, glyph, colour, how far it sways, and when
    function stalk(x, foot, top, wide, lean, tones, what, gap) { // tones: lit edge, body, shaded edge, joint
      const phase = R(0, gap);
      for (let h = Math.max(0, half(top)); h < Math.min(H2, half(foot)); h++) {
        const y = Y(h), c0 = col(x + lean * (foot - y)), joint = (y + phase) % gap < 1 / H2;
        for (let c = Math.max(0, c0); c < Math.min(cols, c0 + wide); c++) {
          const p = h * cols + c, j = c - c0;
          ground[p] = joint ? tones[3] : wide > 1 && j === 0 ? tones[0] : wide > 2 && j === wide - 1 ? tones[2] : tones[1];
          kind[p] = what;
        }
      }
    }
    // Foliage: drooping masses of leaves, taller than they are wide, over the
    // region from x0 to x1 and y0 to y1 (thinning toward its edges), pale at
    // their rims and dark at their hearts. Returns where it put them.
    function foliage(x0, x1, y0, y1, tones, what, o) {
      const leafy = [];
      for (let h = Math.max(0, half(y0)); h < Math.min(H2, half(y1)); h++) {
        const y = Y(h), v = 1 - smooth(y1 - 0.03, y1, y);
        for (let c = Math.max(0, col(x0)); c < Math.min(cols, col(x1) + 1); c++) {
          const x = X(c), crown = y0 + 0.1 * noise(x * 8 + o, 77); // the top of the leaves rises and falls along the grove
          const f = smooth(x0, x0 + 0.08, x) * v * smooth(crown, crown + 0.06, y) * (0.62 * noise(x * 17 + o, y * 6.5 + seed) + 0.38 * noise(x * 42 + o, y * 15 + 3));
          if (f < 0.4) continue;
          const p = h * cols + c;
          ground[p] = tones[f > 0.58 ? 2 : f > 0.48 ? 1 : 0]; kind[p] = what;
          if (f > 0.5) leafy.push(p);
        }
      }
      return leafy;
    }
    function spray(x, y, colours, long, sway) { // a few leaves drooping to either side of (x, y)
      const c0 = col(x), r0 = Math.floor(y * rows), when = R(0, 6.28); // the whole spray sways together
      for (let k = 0, n = 3 + ((rand() * 3) | 0); k < n; k++) {
        const dir = rand() < 0.5 ? -1 : 1, len = 2 + ((rand() * long) | 0), flat = rand() < 0.3, colour = colours[(rand() * colours.length) | 0];
        for (let j = 0; j < len; j++) sprays.push(c0 + dir * (j + 1), r0 + (flat ? j >> 1 : j) + (k >> 1), flat ? (j === len - 1 ? COMMA : DASH) : dir > 0 ? BACK : SLASH, colour, sway, when);
      }
    }
    const G0 = WX - 0.16; // the grove behind her: thin pale stalks, misty foliage over them
    for (let x = G0 + R(0, 0.02); x < Wu / 2 + 0.03; x += R(0.018, 0.06)) {
      if (rand() > smooth(G0 - 0.02, G0 + 0.1, x)) continue; // fewer toward its left end
      const shade = 4 * ((rand() * 3) | 0) + (rand() < 0.4 ? 1 : 0); // pale, middling or dark, some farther into the mist
      stalk(x, YF - 0.008, R(0.07, 0.2), 1, R(-0.04, 0.04), [CANE + shade, CANE + shade, CANE + shade, CANE + 12], CANES, R(0.045, 0.065));
    }
    for (const p of foliage(G0, Wu / 2 + 0.05, 0.07, YF, [CANE + 5, CANE + 8, CANE + 12], CANES, 7)) if (hash(p, 9) < 0.05) spray(X(p % cols), Y((p / cols) | 0), [CANE, CANE + 4, CANE + 12], 2, 0.55);
    const N0 = Math.max(WX + 0.6 * WH + 0.03, Wu / 2 - 0.14); // the bamboo along the right edge, nearer and darker
    for (let x = Wu / 2 + 0.01; x > N0; x -= R(0.035, 0.06)) stalk(x, 1.02, R(0.24, 0.34), Math.max(2, Math.round(0.022 * U)), -R(0.02, 0.07), [REED, REED + 1, REED + 2, REED + 3], REEDS, R(0.07, 0.1));
    if (N0 < Wu / 2) for (const p of foliage(N0 - 0.05, Wu / 2 + 0.05, 0.26, 0.8, [REED + 1, REED + 2, REED + 3], REEDS, 31)) if (hash(p, 11) < 0.05) spray(X(p % cols), Y((p / cols) | 0), [REED + 4, REED + 1, REED + 4], 3, 0.75);

    // The scene's own characters, where a whole cell is one thing: grass on
    // the far bank, foliage on the trees of the far shore, white flowers,
    // strokes and specks of light on the water, and on the near bank tufts of
    // grass and, toward the right, bright specks. Blades that sway are kept apart.
    const mark = new Uint8Array(cols * rows), tint = new Uint8Array(cols * rows), blades = [];
    for (let r = 0, i = 0; r < rows; r++) for (let c = 0; c < cols; c++, i++) {
      const p = (r * 2 + 1) * cols + c, k = kind[p], n = hash(c, r + 101), m = hash(r, c + 202), x = X(c), y = Y(r * 2 + 1);
      if (k !== kind[p - cols]) continue; // edges are left clean
      if (k === TREES && n < 0.1) { mark[i] = [COMMA, HIGH, QUOTE][(m * 3) | 0]; tint[i] = TREE + 8; }
      else if (k === SHORE && n < 0.16) { mark[i] = [COMMA, HIGH, QUOTE, TICK][(m * 4) | 0]; tint[i] = ground[p] <= GRASS + 4 ? GRASS + 8 : GRASS; }
      else if (k === POOL) {
        const j = (y - far[c]) / (near[c] - far[c]), lit = ground[p] < LAST ? Math.max(POND, ground[p] - 8) : POND + 8 + (ground[p] - WATER > 2 ? 4 : 0);
        if (j < 0.4 && noise(x * 18 + 3, y * 45) > 0.64 && n < 0.25) { mark[i] = m < 0.35 ? STAR : m < 0.6 ? RING : DOT; tint[i] = m < 0.6 ? BLOOM : BLOOM + 4; }
        else if (n < 0.05) { mark[i] = m < 0.5 ? DASH : m < 0.8 ? LOW : WAVE; tint[i] = lit; }
        else if (n < 0.065) { mark[i] = m < 0.5 ? HIGH : DOT; tint[i] = BLOOM; }
      } else if (k === BANK) {
        if (n < 0.13) blades.push(i, m * 6.28 + x * 3, m < 0.55 ? 1 : 0);
        else if (n < 0.13 + 0.1 * smooth(WX - 0.3, WX + 0.25, x)) { mark[i] = m < 0.4 ? DOT : m < 0.75 ? HIGH : STAR; tint[i] = SPECK; }
      }
    }

    // The mist: two soft textures, stretched along the wind, that slide to the
    // right, one for the mist on the hills and one for the billows of the bank.
    const reach = Math.ceil(Math.max(DRIFT, ROLL) * T.end * U) + 2, TW = cols + reach, o = R(0, 99);
    const hazeTex = new Float32Array(TW * H2), bankTex = new Float32Array(TW * H2);
    for (let h = 0; h < H2; h++) {
      const y = Y(h);
      for (let i = 0; i < TW; i++) {
        const x = (i + 0.5) / U;
        hazeTex[h * TW + i] = 0.55 * noise(o + x * 5, y * 16) + 0.3 * noise(o + x * 13, 9 + y * 36) + 0.15 * noise(o + x * 31, 3 + y * 70);
        bankTex[h * TW + i] = 0.6 * noise(o + 40 + x * 7, 20 + y * 14) + 0.4 * noise(o + x * 17, 5 + y * 30);
      }
    }

    // In the upper right, where the painting has its calligraphy: one run of
    // ink flowing down the paper, pressing and lifting, with two breaks and a
    // few flicks off it, so that it reads as brushwork and never as letters.
    // Under it the seal, a small red block with nothing in it. Neither moves.
    const over = new Uint8Array(N), shield = new Uint8Array(cols * rows); // their paint, and the cells they cover, where no rain or bird is drawn
    const inkX = Wu / 2 - Math.max(0.045, 3 / U), I0 = 0.035, I1 = 0.185, ph = R(0, 6.28);
    const inkAt = (y) => inkX + 0.006 * Math.sin(ph + ((y - I0) / (I1 - I0)) * 9);
    const dab = (x, y, w) => { const h = half(y); if (h >= 0 && h < H2) for (let c = Math.max(0, col(x - w)); c <= Math.min(cols - 1, col(x + w)); c++) over[h * cols + c] = BRUSH; };
    for (let y = I0; y < I1; y += 0.5 / H2) {
      const q = (y - I0) / (I1 - I0);
      if (Math.abs(q - 0.33) > 0.04 && Math.abs(q - 0.68) > 0.04) dab(inkAt(y), y, 0.0018 + 0.0045 * (0.5 + 0.5 * Math.sin(ph * 2 + q * 17)));
    }
    for (let n = 0; n < 3; n++) { // the flicks, falling steeply away to either side
      const y0 = R(I0 + 0.01, I1 - 0.03), x0 = inkAt(y0), dir = rand() < 0.5 ? -1 : 1;
      for (let j = 1; j <= 4; j++) dab(x0 + dir * j * 0.0025, y0 + j * 0.006, 0.0015);
    }
    const sw = Math.max(2, Math.round(0.022 * U)), sh = Math.max(3, Math.round(0.03 * H2)), sc = col(inkX) - (sw >> 1), st = half(I1 + 0.02);
    for (let h = st; h < Math.min(H2, st + sh); h++) for (let c = Math.max(0, sc); c < Math.min(cols, sc + sw); c++) {
      const n = hash(c, h + 5);
      over[h * cols + c] = h === st || h === st + sh - 1 || c === sc || c === sc + sw - 1 || n < 0.12 ? SEAL : n < 0.3 ? SEAL + 2 : SEAL + 1;
    }
    for (let p = 0; p < N; p++) if (over[p]) shield[((p / cols / 2) | 0) * cols + (p % cols)] = 1;

    // Two loose flocks of birds crossing the sky to the right, the higher one
    // above her and the lower one above the water, all off the right edge
    // before the story's fourth second, when the bank comes. Each bird: its
    // place in the flock, its height, and its wingbeat.
    const flocks = [[lerp(MX, WX, 0.85), 0.055, 7], [lerp(MX, WX, 0.35), 0.15, 6]].map(([x0, y0, n]) => {
      const birds = Array.from({ length: n }, (_, j) => [-j * R(0.022, 0.04) - R(0, 0.01), R(-0.018, 0.018), R(0, 6.28), R(5, 8)]);
      return { x0, y0, birds, v: (Wu / 2 + 2 / U - x0 - Math.min(...birds.map((b) => b[0]))) / 3.9 };
    });

    // The swordsman, in his own units: u across from his middle and v down
    // from the top of his head, in his heights. Seen from behind: long dark
    // hair, its upper part tied at the back of his head, hanging down his
    // back; layered robes with a sash; his arms hanging in wide sleeves. His
    // left hand (on our left) holds the hilt of a broad saber whose blade
    // points down toward the lower left corner. He never turns.
    const HU = -0.158, HV = 0.455, BL = Math.hypot(-0.4 - HU, 0.725 - HV), BX = (-0.4 - HU) / BL, BY = (0.725 - HV) / BL; // his hand, and the way to the point
    const HAIR = 1, TIE = 2, BODY = 3, SLEEVE = 4, BELT = 5, PALM = 6, FLAT = 7, SPINE = 8, GUARD = 9, EDGE = 10;
    const blade = (a) => 0.016 + 0.008 * a; // half the blade's breadth, a of the way from his hand to the point: a saber broadens toward its point
    const head = (low) => [0.068 + 0.03 * low, 0.071 - 0.008 * low]; // his head's middle and half height: lowered, it sinks and tips forward
    function man(u, v, s, low) {
      const pu = u - HU, pv = v - HV;
      if (pu * pu + pv * pv < 0.024 ** 2 || (u + HU) ** 2 + pv * pv < 0.021 ** 2) return PALM; // his hands
      const a = (pu * BX + pv * BY) / BL, b = pv * BX - pu * BY; // along the blade from his hand (0) to the point (1), and across it toward its edge
      if (a > -0.12 && a < 1) {
        const w = blade(a), fore = a < 0.86 ? w : w * Math.max(0, 1 - ((a - 0.86) / 0.14) ** 1.4), aft = a < 0.78 ? w : w * Math.max(0, 1 - (a - 0.78) / 0.22); // the point: the edge curves in to it, the back is cut
        if (a > 0.07 && b < fore && b > -aft) return b > fore - 0.011 ? EDGE : b < -aft + 0.007 ? SPINE : FLAT;
        if (a > 0.045 && a <= 0.07 ? Math.abs(b) < w + 0.01 : a <= 0.045 && Math.abs(b) < 0.01) return GUARD; // the guard, and the dark grip above his hand
      }
      const [hy, ry] = head(low);
      if ((u / 0.057) ** 2 + ((v - hy) / ry) ** 2 < 1) return Math.abs(u) < 0.02 && Math.abs(v - hy - 0.01) < 0.009 ? TIE : HAIR;
      const end = 0.3 + 0.022 * Math.sin(u * 95 + 1.3) + 0.008 * Math.sin(s * 1.6 + u * 50) + 0.02 * low; // the ragged ends of his hair, stirring
      if (v > hy && v < end && Math.abs(u - (0.006 * Math.sin(s * 1.1) * (v - hy)) / 0.25) < 0.052 + 0.02 * smooth(hy, 0.22, v)) return HAIR;
      if (v < 0.125 + 0.3 * Math.max(0, Math.abs(u) - 0.05) ** 1.2) return 0; // above the slope of his shoulders
      for (const side of [-1, 1]) { // his arms, from the shoulder to the wrist
        const k = clamp01(((u - side * 0.118) * side * 0.04 + (v - 0.17) * 0.27) / (0.04 ** 2 + 0.27 ** 2)), du = u - side * (0.118 + 0.04 * k), dv = v - 0.17 - 0.27 * k;
        if (du * du + dv * dv < (0.036 + 0.014 * k) ** 2) return SLEEVE;
      }
      const hem = v > 0.5 ? 0.006 * Math.sin(s * 2.1 + v * 24 + (u > 0 ? 1.7 : 0)) * smooth(0.5, 0.75, v) : 0; // the skirts of his robe stir
      if (Math.abs(u) < (v < 0.4 ? lerp(0.122, 0.112, (v - 0.15) / 0.25) : 0.112 + 0.055 * smooth(0.42, 0.78, v)) + hem) return v > 0.372 && v < 0.41 ? BELT : BODY;
      return 0;
    }

    // The woman, in her own units: u across from her middle and v down from
    // the top of her head to her feet, in her heights. She faces him across
    // the water, the umbrella's shaft in the hand of the arm whose wide sleeve
    // hangs in front of her, her long black hair down her back. Her face is a
    // pale shape with nothing in it. `bow` (0 to 1) lowers the umbrella and
    // tips it toward him, and dips her head. She never takes a step.
    const umbrella = (bow) => [0.1 - 0.08 * bow, -0.11 + 0.11 * bow, -0.18 + 0.5 * bow]; // the middle of its rim, and how far it is turned (radians, + dips the left end, toward him)
    const hand = (bow) => [-0.005 - 0.05 * bow, 0.3 + 0.05 * bow];
    function woman(u, v, bow) {
      const [cu, cv, th] = umbrella(bow), cs = Math.cos(th), sn = Math.sin(th), du = u - cu, dv = v - cv;
      const a = du * cs - dv * sn, b = -du * sn - dv * cs; // along the rim, and up from it toward the crown
      const dome = 0.19 * (1 - (a / 0.38) ** 2);
      if (Math.abs(a) < 0.38 && b > -0.016 && b < dome) return b < 0.016 ? PAPER + 8 : b > 0.45 * dome ? PAPER : PAPER + 4; // a shallow dome, paler toward its crown
      const lean = 0.06 * bow, hu = -0.01 - 0.06 * bow, hv = 0.075 + 0.07 * bow, [ku, kv] = hand(bow);
      if (((u - hu) / 0.066) ** 2 + ((v - hv) / 0.076) ** 2 < 1) return u - hu < -0.012 && v - hv > -0.03 + 0.04 * bow ? FACE : LOCK;
      if ((u - ku) ** 2 + (v - kv) ** 2 < 0.024 ** 2) return FACE; // her hand on the shaft
      const lu = -0.085 - lean, lv = 0.34 + 0.03 * bow;
      if (((u - lu) / 0.058) ** 2 + ((v - lv) / 0.12) ** 2 < 1) return u - lu < -0.015 ? ROBE : ROBE + 4; // the sleeve
      if (v > 0.14 && v <= 1) { // her robes, from narrow shoulders to a wide hem on the grass
        const mid = -lean * (1 - (v - 0.14) / 0.86), e = u - mid;
        const w = v < 0.2 ? lerp(0.065, 0.09, (v - 0.14) / 0.06) : v < 0.42 ? lerp(0.09, 0.07, (v - 0.2) / 0.22) : lerp(0.07, 0.135, ((v - 0.42) / 0.58) ** 1.3);
        if (Math.abs(e) < w) return e < -0.25 * w ? ROBE : e > 0.45 * w || (v > 0.45 && Math.sin(e * 95 + 1) > 0.75) ? ROBE + 8 : ROBE + 4;
      }
      if (v > hv && v < 0.6 && Math.abs(u - hu - 0.05 - 0.03 * (v - hv)) < 0.03 * (1 - smooth(0.45, 0.6, v)) + 0.008) return LOCK + 4; // her hair, behind her
      return 0;
    }

    // Each frame: the mist over every half cell (all of it, and the bank's
    // share), what of him is in each half cell, and how much of the picture is
    // left in each cell as the last bank thins away (1 is all of it).
    const mistM = new Float32Array(N), bankM = new Float32Array(N), part = new Uint8Array(N), left = new Float32Array(cols * rows);
    const mc0 = Math.max(0, col(MX - 0.45 * F)), mc1 = Math.min(cols - 1, col(MX + 0.22 * F)), mh0 = Math.max(0, half(MTOP - 0.01));
    const wc0 = Math.max(0, col(WX - 0.4 * WH)), wc1 = Math.min(cols - 1, col(WX + 0.52 * WH)), wh0 = Math.max(0, half(YF - 1.4 * WH)), wh1 = Math.min(H2 - 1, half(YF));
    let firstRow = rows; // the first row with water in it
    for (let c = 0; c < cols; c++) firstRow = Math.min(firstRow, Math.floor(far[c] * rows));
    const cell = (x, y) => [(x + Wu / 2) * U, y * rows]; // a point, in columns and rows
    const put = (colour) => (c, r, g) => { if (c >= 0 && c < cols && r >= 0 && r < rows) { glyph[r * cols + c] = g; ink[r * cols + c] = colour; } };

    // How far the bank has taken her at half cell (c, h): the bank's own rise
    // without its billows, so that it only ever grows and she never comes back.
    const taken = (c, h, s) => {
      const k = s - arrive[c];
      return k > 0 ? smooth(0, 0.35, k) * smooth(-0.025, 0.025, heap[c] * (0.25 + 0.75 * smooth(0, RISE, k)) - rise[h * cols + c] + 0.03 * (hash(c, h) - 0.5)) : 0;
    };
    function drawWoman(s) {
      if (s > T.reach + RISE) return; // the mist has all of her, and she is gone
      const bow = smooth(T.bow, T.bowed, s);
      for (let h = wh0; h <= wh1; h++) {
        const v = (Y(h) - YF) / WH + 1;
        for (let c = wc0; c <= wc1; c++) {
          const colour = woman((X(c) - WX) / WH, v, bow), p = h * cols + c;
          if (!colour) continue;
          const gone = taken(c, h, s);
          if (gone > 0.97) continue;
          paint[p] = fog(colour, Math.max(gone, bankM[p]), thr[p]);
          glyph[(h >> 1) * cols + c] = 32;
        }
      }
      const [cu, cv] = umbrella(bow), [ku, kv] = hand(bow), hm = half(YF - WH * 0.9), cm = col(WX + 0.05 * WH); // the shaft, as the mist at its middle has it
      const m = Math.max(taken(cm, hm, s), bankM[hm * cols + cm]);
      const [a0, b0] = cell(WX + ku * WH, YF + (kv - 1.02) * WH), [a1, b1] = cell(WX + cu * WH, YF + (cv - 1) * WH);
      if (m < 0.55) line(a0, b0, a1, b1, put(fog(PAPER + 8, m, 0.5)));
    }

    function drawMan(s) {
      const low = smooth(T.lower, T.roll - 0.1, s), [hy, ry] = head(low);
      for (let h = mh0; h < H2; h++) for (let c = mc0, v = (Y(h) - MTOP) / F; c <= mc1; c++) part[h * cols + c] = man((X(c) - MX) / F, v, s, low);
      for (let h = mh0; h < H2; h++) {
        const v = (Y(h) - MTOP) / F;
        for (let c = mc0; c <= mc1; c++) {
          const p = h * cols + c, what = part[p];
          if (!what) continue;
          const u = (X(c) - MX) / F, rim = c === mc0 || c === mc1 || !part[p - 1] || !part[p + 1] || !part[p - cols];
          if (what === HAIR) paint[p] = v < hy - 0.45 * ry ? MANE + 2 : Math.sin(u * 140 + 3 * Math.sin(v * 20)) > 0.6 ? MANE + 1 : MANE;
          else if (what === TIE) paint[p] = SASH;
          else if (what === BODY) paint[p] = rim ? COAT + 2 : v < 0.19 ? COAT + 3 : (v > 0.42 && Math.sin(u * 75 + 2 * Math.sin(v * 9)) > 0.72) || (Math.abs(u) < 0.007 && v > 0.5) ? COAT : COAT + 1;
          else if (what === SLEEVE) paint[p] = rim || v < 0.22 ? COAT + 4 : Math.sin((Math.abs(u) * 0.4 + v) * 55) > 0.8 ? COAT + 1 : COAT + 2;
          else if (what === BELT) paint[p] = v > 0.4 ? COAT : SASH;
          else if (what === PALM) paint[p] = v < HV - 0.008 ? HAND : HAND + 1;
          else paint[p] = what === EDGE ? STEEL + 2 : what === FLAT ? STEEL + 1 : STEEL;
        }
      }
      // His characters: strands of hair, folds of the robe and sleeves, and
      // the sash. His outline stays clean.
      for (let r = mh0 >> 1; r < rows; r++) for (let c = mc0; c <= mc1; c++) {
        const i = r * cols + c, top = part[r * 2 * cols + c], bot = part[(r * 2 + 1) * cols + c], n = hash(c, r + 909);
        if (!top && !bot) continue;
        glyph[i] = 32;
        if (top !== bot) continue;
        const u = (X(c) - MX) / F, v = ((r + 0.5) / rows - MTOP) / F;
        if (top === HAIR && n < 0.3) put(MANE + 2)(c, r, BAR);
        else if (top === BODY && v > 0.45 && n < 0.14) put(COAT + 3)(c, r, BAR);
        else if (top === SLEEVE && n < 0.2) put(COAT + 4)(c, r, u < 0 ? SLASH : BACK);
        else if (top === BELT && n < 0.4) put(COAT + 4)(c, r, EQUAL);
      }
    }

    return {
      cols, rows, palette: INK, glyph, ink, bold, paint, wash,
      render(t) { // t: seconds since the animation started
        glyph.fill(32); ink.fill(0); bold.fill(0); paint.fill(0); wash.fill(0);
        if (t >= LENGTH) return this; // over: nothing is left on the page
        const s = t * SPEED; // where that is in the story

        // The mist: what drifts over the hills, and the bank, which arrives at
        // each column in turn, lies low at first, rises over RISE seconds,
        // then thins away. Everything at its distance or farther is mixed with it.
        const hd = DRIFT * s * U, hi = Math.floor(hd), hf = hd - hi, bd = ROLL * s * U, bi = Math.floor(bd), bf = bd - bi;
        for (let h = 0, p = 0; h < H2; h++) {
          for (let c = 0; c < cols; c++, p++) {
            let m = 0, b = 0;
            if (haze[p] > 0) {
              const j = h * TW + c + reach - hi, tx = hazeTex[j] + (hazeTex[j - 1] - hazeTex[j]) * hf;
              m = haze[p] * (0.3 + 0.6 * smooth(0.3, 0.75, tx));
            }
            const r = rise[p];
            if (r > -0.07 && r < heap[c] + 0.05 && s > T.mist - 0.3) {
              const j = h * TW + c + reach - bi, tx = bankTex[j] + (bankTex[j - 1] - bankTex[j]) * bf, n = ragged[c] * (tx - 0.5), k = s - arrive[c] + 0.5 * n;
              if (k > 0) {
                const top = heap[c] * (0.25 + 0.75 * smooth(0, RISE, k)) + 0.05 * n;
                b = smooth(-0.02, 0.02, top - r) * smooth(-0.065, -0.01, r) * smooth(0, 0.35, k) * (1 - smooth(-0.4, 0.4, s - clear[c] + 0.6 * (tx - 0.5))) * (0.92 + 0.08 * smooth(0.25, 0.7, tx));
              }
            }
            bankM[p] = b; mistM[p] = 1 - (1 - m) * (1 - b);
            paint[p] = fog(ground[p], mistM[p], thr[p]);
          }
        }
        const misted = (c, r) => Math.max(mistM[r * 2 * cols + c], mistM[(r * 2 + 1) * cols + c]);

        for (let i = 0, r = 0, c = 0; i < mark.length; i++, c = c + 1 === cols ? 0 : c + 1, r += c ? 0 : 1) { // the scene's characters, fading in the mist
          if (!mark[i]) continue;
          const m = misted(c, r);
          if (m < 0.55) { glyph[i] = mark[i]; ink[i] = fog(tint[i], m, 0.5); }
        }
        for (let k = 0; k < blades.length; k += 3) { // grass on the near bank, swaying, bent a little by the wind from the right
          const i = blades[k], lean = Math.sin(s * 1.7 + blades[k + 1]);
          glyph[i] = blades[k + 2] ? (lean > 0.1 ? BACK : BAR) : lean > 0.5 ? COMMA : QUOTE;
          ink[i] = blades[k + 2] ? REED : REED + 1;
        }
        for (let r = firstRow; r < rows; r++) for (let bx = 0; bx * 7 < cols; bx++) { // rings where raindrops land on the water: a splash, a ring, wider, gone
          const phase = hash(bx, r + 41), n = Math.floor(s / 0.9 + phase), age = s - (n - phase) * 0.9;
          if (hash(bx * 31 + n, r + 77) > 0.16) continue;
          const c = bx * 7 + Math.floor(hash(n + 5, bx + r * 13) * 7), p = (r * 2 + 1) * cols + c;
          if (c >= cols || kind[p] !== POOL || kind[p - cols] !== POOL || mistM[p] > 0.5) continue;
          const j = (Y(r * 2 + 1) - far[c]) / (near[c] - far[c]), dot = put(fog(j < 0.35 ? BLOOM + 4 : POND + 4, mistM[p], 0.5));
          const ring = (cc, g) => { if (cc >= 0 && cc < cols && kind[p - c + cc] === POOL) dot(cc, r, g); };
          if (age < 0.12) ring(c, DOT);
          else if (age < 0.3 || j < 0.25) { if (age < 0.5) ring(c, RING); }
          else if (age < 0.52) { ring(c - 1, OPEN); ring(c, 32); ring(c + 1, SHUT); }
          else if (age < 0.72 && j > 0.55) { ring(c - 2, DASH); ring(c + 2, DASH); }
        }
        for (let k = 0; k < sprays.length; k += 6) { // bamboo leaves, swaying
          const c = sprays[k] + Math.round(sprays[k + 4] * Math.sin(s * 1.3 + sprays[k + 5])), r = sprays[k + 1];
          if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
          const m = misted(c, r);
          if (m < 0.55) put(fog(sprays[k + 3], m, 0.5))(c, r, sprays[k + 2]);
        }
        drawWoman(s);
        drawMan(s);
        if (s < 4.2) for (const f of flocks) for (const [dx, dy, phase, beat] of f.birds) { // the birds: wings up, then a downstroke
          const c = col(f.x0 + dx + f.v * s), r = Math.floor((f.y0 + dy + 0.004 * Math.sin(s * 2 + phase)) * rows), i = r * cols + c;
          if (c < 0 || c >= cols || r < 0 || r >= rows || shield[i]) continue;
          glyph[i] = Math.sin(s * beat + phase) > -0.3 ? VEE : DASH; ink[i] = BIRD; bold[i] = 1;
        }
        for (let p = 0; p < N; p++) if (over[p]) paint[p] = over[p]; // the calligraphy and the seal

        // The ending: a second bank of mist rolls in from the left over
        // everything, and behind it, from the left, thins away to show the page.
        left.fill(1);
        if (s > T.roll - 0.2) for (let r = 0, i = 0; r < rows; r++) for (let c = 0; c < cols; c++, i++) {
          const n = hazeTex[(r * 2 + 1) * TW + c] - 0.5, lag = (c + 0.5) / cols;
          const k = smooth(0, 0.25, s - T.roll - 0.5 * lag - 0.2 * n), a = 1 - smooth(0, 0.3, s - T.thin - 0.5 * lag - 0.2 * n);
          left[i] = a;
          if (a < 1) { paint[r * 2 * cols + c] = paint[(r * 2 + 1) * cols + c] = 0; wash[i] = Math.round(a * 8) ? VEIL + Math.round(a * 8) : 0; glyph[i] = 32; }
          else if (k > 0) { wash[i] = VEIL + Math.max(1, Math.round(k * 8)); if (k > 0.55) glyph[i] = 32; }
        }
        // The rain, over everything, steady from the upper right, until the picture has gone.
        const fall = RAIN * rows * s;
        for (let r = 0, i = 0; r < rows; r++) for (let c = 0; c < cols; c++, i++) {
          if (shield[i] || left[i] < 0.45) continue;
          const lane = Math.floor(c + SLANT * r), q = r - fall + hash(lane, 3) * 11, slot = Math.floor(q / 11), h = hash(lane, slot);
          if (h < 0.4 && q - slot * 11 < (h < 0.13 ? 3 : 2)) { glyph[i] = SLASH; ink[i] = DROP + (h < 0.13 ? 1 : 0); bold[i] = 0; }
        }
        return this;
      },
    };
  }

  // Play it on the stage. Resolves when it has finished. `seed` changes the
  // details, not the layout: the hills, the line of the shore, the bamboo, the
  // birds, the calligraphy, the billows of the mist. `freezeAt` holds one
  // moment (in seconds) on screen. Reduced motion holds the two of them facing
  // each other across the water, with the birds still in the sky.
  const film = { length: LENGTH, still: 1.5 / SPEED, createScene };
  return { play: (options) => AsciiStage.play(film, options), createScene };
})();
