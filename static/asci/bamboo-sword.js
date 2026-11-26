/*
 * Sword draw in the bamboo forest: an ASCII loading screen for the stage.
 *
 *   <script src="ascii-stage.js"></script>
 *   <script src="bamboo-sword.js"></script>
 *   <script>BambooSword.play().then(showThePage);</script>
 *
 * A swordsman in white robes, his hair tied back in a ponytail, stands in a
 * misty bamboo forest with a hand on the hilt of his sword while leaves fall
 * round him. He draws in one level slash that throws his ponytail out behind
 * him, an arc of pale blue qi leaves the blade and crosses the forest, and
 * after a beat of stillness the leaves come apart in two and the mist opens
 * along the line of the cut. He sheathes the sword, and at the click the
 * camera follows one half leaf down to the ground. Where it lands the picture
 * itself is cut along a level line and its two halves slide away to show the
 * page. The whole of it lasts five seconds (LENGTH, below).
 *
 * The forest is painted once, as a picture taller than the screen, and the
 * camera is a window on it that moves down in whole rows. Everything that
 * moves is a pure function of time, so render(t) can draw any moment directly.
 */
const BambooSword = (() => {
  'use strict';
  const { code, clamp01, lerp, smooth, mulberry32, hash, noise } = AsciiStage;

  // The story's timeline, in seconds at the pace it was written.
  const T = {
    slash: 2.5,   // the sword leaves the scabbard
    out: 2.8,     // the blade is at full reach: the slash took a third of a second
    arc: 4.4,     // the arc of qi has crossed the forest and gone
    cut: 5.3,     // after a beat of stillness the leaves come apart and the mist opens
    sheathe: 7.0, // he starts to bring the sword back
    click: 8.8,   // the guard meets the scabbard, and the camera lets go of him
    land: 10.8,   // the leaf it followed down touches the ground
    part: 10.95,  // the picture is cut along the line the leaf lies on
    end: 12.1,
  };
  // It is played faster than that. LENGTH is how many seconds the whole of it
  // takes on screen, and SPEED how many times faster than the story that is.
  const LENGTH = 5, SPEED = T.end / LENGTH;

  // Every colour. Cells hold an index into this list, and 0 means nothing there.
  const PALETTE = [
    '#000000',
    // 1-12 the air between the stalks, deep shade to lit mist: blue-green in the dark, yellow-green in the light
    '#06120e', '#091a15', '#0d241c', '#123024', '#183d2c', '#204c36', '#2b5d41', '#3a704e', '#4f865e', '#6c9c70', '#8fb389', '#b7cba5',
    // 13-20 bamboo, shadow to highlight: near stalks use the dark end, far ones the pale end
    '#040b08', '#08170e', '#0d2416', '#15351e', '#204b28', '#317036', '#559a4a', '#93c56f',
    // 21-27 the forest floor, shade to a patch of sun: dry leaves, so the green goes to brown
    '#0e130c', '#171e13', '#232918', '#343820', '#4b4b2a', '#676338', '#8a8550',
    // 28-33 his robes, deep fold to full light: the shadows are blue
    '#465570', '#6c7d9b', '#99a8c0', '#c3cedd', '#e4e9ef', '#fdfdf8',
    // 34-38 his skin, shadow to light: very pale, a little cooler in the shade of the leaves and warm where the light falls; 39 the fine line of an eye or a mouth
    '#c2a299', '#dcc3b8', '#eedad0', '#f8ebe2', '#fdf6ef', '#a27f75',
    '#141018', '#231c26', '#3a3242', // 40-42 hair: near black, with a cool sheen where the light catches it
    '#2c3e54', '#4a6582', // 43-44 sash
    '#5a1d1b', '#96362b', '#cc603e', '#e3c069', // 45-48 scabbard in red lacquer, and its gold fittings
    '#8497ad', '#d3e2ef', '#ffffff', // 49-51 steel
    '#3f8fcb', '#84c9f3', '#bfe8ff', '#f1fbff', // 52-55 qi, the blue of the arc
    '#4e8a34', '#7fb645', '#b5da62', '#ecf6ae', // 56-59 a falling leaf
    'rgba(206,228,216,0.07)', 'rgba(206,228,216,0.13)', 'rgba(206,228,216,0.2)', 'rgba(206,228,216,0.28)', 'rgba(206,228,216,0.37)', // 60-64 mist
    'rgba(150,212,255,0.16)', 'rgba(170,222,255,0.34)', // 65-66 the glow the arc leaves behind it
  ];
  const AIR = 1, CANE = 13, FLOOR = 21, ROBE = 28, SKIN = 34, LINE = 39, HAIR = 40, SASH = 43, LACQUER = 45, GOLD = 48, STEEL = 49, QI = 52, LEAF = 56, MIST = 60, GLOW = 65;

  const [BAR, SLASH, BACK, LOW, DASH, HIGH, TICK, COMMA, DOT, WAVE, EQUAL, VEE, STAR, NOSE] = code('|/\\_-\'`,.~=v*)');
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16); // ordered dither, so a gradient is a fixed pattern and never flickers

  function createScene({ cols, rows, aspect = 2, seed = 5 }) {
    const rand = mulberry32(seed), R = (a, b) => a + (b - a) * rand();
    // World units are half rows, which are roughly square: a column is `px` of them wide.
    const lines = rows * 2, px = 2 / aspect, W = cols * px;
    const S = Math.max(10, Math.min(lines * 0.66, W * 0.53)); // how tall he is: two thirds of the screen, less where the slash would not fit across it
    const cx = W * 0.27, G = Math.round(lines * 0.86); // where he stands: left of centre, facing the room his slash needs
    // The camera ends lower, with the ground well up the screen. If he would be cut at
    // the chest there, it goes on down until only the hem of his robe is in view.
    const whole = S * 1.12 <= lines * 0.6;
    const pan = Math.max(1, Math.round((G - (whole ? Math.max(lines * 0.45, S * 1.12) : S * 0.4)) / 2)); // in rows
    const WR = rows + pan, WL = WR * 2;
    const wPaint = new Uint8Array(cols * WL), wFront = new Uint8Array(cols * WR); // the forest; and the cells a stalk stands in: 1 at his distance, 2 nearer than him
    const wGlyph = new Uint8Array(cols * WR).fill(32), wInk = new Uint8Array(cols * WR), wBold = new Uint8Array(cols * WR);
    const dither = (v, c, l) => Math.floor(v + 0.15 + 0.7 * BAYER[(l & 3) * 4 + (c & 3)]); // a little of each band is left flat
    const mark = (c, r, ch, colour, heavy = 0) => {
      if (c < 0 || c >= cols || r < 0 || r >= WR) return;
      const i = r * cols + c;
      wGlyph[i] = ch; wInk[i] = colour; wBold[i] = heavy;
    };

    // Light comes down from the upper right in shafts.
    const SLANT = 0.42, horizon = G - S * 0.16; // the far edge of the floor, lost in mist
    const shafts = [];
    for (let i = 0, n = Math.max(2, Math.round(W / (S * 0.75))); i < n; i++) shafts.push({ x: W * 0.12 + ((i + R(0.2, 0.8)) / n) * (W * 0.9 + G * SLANT), w: S * R(0.09, 0.2), k: R(0.6, 1) });
    const beam = (x, y) => {
      let v = 0;
      for (const s of shafts) { const d = Math.abs(x + y * SLANT - s.x) / s.w; if (d < 1) v = Math.max(v, (1 - d * d) * s.k); }
      return v;
    };
    const crown = (x) => lines * 0.04 + Math.min(lines, S * 1.6) * (0.15 * noise(x / (S * 0.3), 77) + 0.05 * noise(x / (S * 0.06), 99)); // how far down the leaves hang at the top
    for (let l = 0; l < WL; l++) for (let c = 0; c < cols; c++) {
      const x = (c + 0.5) * px, y = l + 0.5, sun = beam(x, y);
      const glow = Math.exp(-(((y - (G - S * 0.72)) / Math.max(lines * 0.36, S * 0.6)) ** 2)); // mist gathers the light at about the height of his shoulders
      const air = 1.3 + 5.2 * glow * (0.45 + 0.55 * noise(x / (S * 0.8), y / (S * 1.5))) + 1.3 * (x / W) * glow
        + 5 * sun * (0.5 + 0.5 * noise(x / (S * 0.16), y / (S * 0.5) + 31)) * smooth(G + S * 0.3, 0, y);
      const near = (y - horizon) / (WL - horizon), deep = crown(x) - y;
      if (near > 0.05 * noise(x / (S * 0.05), 3.7)) { // the floor, its far edge ragged with undergrowth: pale and misty far off, dark close to, with patches of sun and a litter of dry leaves
        const patch = beam(x + (y - G) * 0.3, G) * smooth(0.4, 0.6, noise(x / (S * 0.3), y / (S * 0.1) + 5));
        const v = lerp(1.6, 3.6, smooth(0, 0.12, near)) - 2.1 * smooth(0.1, 0.5, near) + 2.8 * patch + 1.1 * (noise(x / 3.1, y / 1.7) - 0.5) + (hash(c, l) < 0.05 ? 1.3 : 0);
        wPaint[l * cols + c] = FLOOR + Math.max(0, Math.min(6, dither(v, c, l)));
      } else if (deep > 0) { // the canopy: dark masses of leaf, some of them catching the light, and specks of sky where a shaft comes through
        const sky = sun > 0.3 && hash(c >> 1, l >> 1) < 0.16 * sun, lit = noise(x / (S * 0.09), y / (S * 0.06) + 13);
        wPaint[l * cols + c] = AIR + (sky ? 10 + (hash(c, l) < 0.4 ? 1 : 0) : Math.max(0, Math.min(4, dither(0.3 + 3.4 * lit * lit + 1.5 * sun - 0.04 * deep, c, l))));
      } else wPaint[l * cols + c] = AIR + Math.max(0, Math.min(11, dither(air, c, l)));
    }
    const shade = (x0, y0, rx, ry) => { // a shadow lying on the floor
      for (let l = Math.max(0, Math.floor(y0 - ry)); l <= Math.min(WL - 1, y0 + ry); l++) for (let c = Math.max(0, Math.floor((x0 - rx) / px)); c <= Math.min(cols - 1, (x0 + rx) / px); c++) {
        const i = l * cols + c, e = (((c + 0.5) * px - x0) / rx) ** 2 + ((l + 0.5 - y0) / ry) ** 2;
        if (e < 1 && wPaint[i] >= FLOOR && wPaint[i] <= FLOOR + 6) wPaint[i] = Math.max(FLOOR, wPaint[i] - (e < 0.45 ? 3 : 2));
      }
    };

    // Bamboo. A stalk is a run of columns with a lit edge on the right and a node every so often.
    // `tones` are its shadow edge, body, lit edge, and the dark and light lines of a node.
    function stalk(x0, base, wide, lean, tones, gap, front) {
      const phase = R(0, gap), top = front ? 0 : crown(x0) * 0.5;
      shade(x0 - wide * px * 0.8, base, wide * px * 1.7, Math.max(1.2, wide * 0.45));
      for (let l = Math.floor(top); l < Math.min(WL, base); l++) {
        const left = Math.round((x0 + lean * (l - base)) / px - wide / 2), k = (l + phase) % gap;
        const sunlit = !front && beam(x0, l) * smooth(G, G - S * 0.5, l) > 0.5 ? 1 : 0; // a stalk standing in a shaft of light is a step paler
        for (let i = 0; i < wide; i++) {
          const c = left + i;
          if (c < 0 || c >= cols) continue;
          wPaint[l * cols + c] = (k < 1 ? tones[3] : k < 2 ? tones[4] : i === wide - 1 ? tones[2] : i === 0 && wide > 2 ? tones[0] : tones[1]) + sunlit;
          wFront[(l >> 1) * cols + c] = front ? 2 : 1;
        }
        if (l & 1 && wide > 1 && tones[5]) { // one character a row down the middle: a bar, or a node mark where the row holds one
          const node = k < 2 || (k + gap - 1) % gap < 2;
          mark(left + ((wide - 1) >> 1), l >> 1, node ? EQUAL : BAR, node ? tones[2] : tones[5], front ? 1 : 0);
        }
      }
    }
    for (let i = 0, n = Math.round(W / 3); i < n; i++) { // far stalks: thin, and only a step or two darker than the mist behind them
      const x0 = R(0, W), c = Math.floor(x0 / px), depth = rand(), base = horizon + R(-0.02, 0.06) * S, lean = R(-0.03, 0.03);
      for (let l = Math.floor(crown(x0) * 0.7); l < Math.min(WL, base); l++) {
        const cc = Math.round(c + lean * (l - base)), j = l * cols + cc;
        if (cc < 0 || cc >= cols || wPaint[j] < AIR || wPaint[j] >= AIR + 12) continue;
        wPaint[j] = Math.max(AIR, wPaint[j] - dither(0.9 + 2.2 * depth, cc, l));
      }
    }
    const reach = cx + S * 0.84; // how far right the point of the sword comes
    for (let i = 0, n = Math.max(3, Math.round(W / 12)); i < n; i++) { // stalks at about his distance: behind him, in front of the far mist
      let x0 = ((i + R(0.15, 0.85)) / n) * W;
      if (Math.abs(x0 - cx - S * 0.02) < S * 0.13) x0 += S * (x0 < cx ? -0.14 : 0.16); // none growing out of his head
      const pale = rand() < 0.45 ? 1 : 0, wide = Math.max(2, Math.round((S * R(0.038, 0.052)) / px));
      stalk(x0, horizon + R(0.04, 0.13) * S, wide, R(-0.025, 0.025), [CANE + 2 + pale, CANE + 3 + pale, CANE + 5 + pale, CANE + 1 + pale, CANE + 4 + pale, wide > 2 ? CANE + 4 + pale : 0], Math.round(S * R(0.2, 0.3)) + 3, false);
    }
    // Near stalks frame the shot and keep clear of the sword. Where the screen is too narrow
    // to leave the arc room between the sword and a stalk, that stalk is left out.
    const NEAR = [[W * 0.035, 0.42, 0.015], [W * 0.82, 0.42, -0.012], [W * 0.95, 0.2, -0.012]], nearWide = Math.max(3, Math.round((S * 0.095) / px));
    for (const [x0, deep, lean] of NEAR) {
      const jitter = R(-0.01, 0.01) * W, base = G + S * (deep + R(0, 0.1));
      if (x0 < cx || x0 - reach > S * 0.5) stalk(x0 + jitter, base, nearWide - (deep < 0.3 ? 1 : 0), lean, [CANE, CANE + 1, CANE + 5, CANE, CANE + 3, CANE + 3], Math.round(S * 0.34) + 4, true);
    }

    // Leaves: a spray is a few short strokes fanning down from a point.
    function spray(c, r, colour, heavy) {
      for (let k = 0, n = 3 + ((rand() * 3) | 0); k < n; k++) {
        const dir = (rand() * 3) | 0, len = 2 + ((rand() * 2) | 0), dc = dir === 0 ? -1 : 1, side = rand() < 0.5 ? -1 : 1;
        for (let j = 0; j < len; j++) {
          if (dir === 2) mark(c + side * (j + 1), r + k - 1, DASH, colour, heavy);
          else mark(c + dc * j + side, r + j + (k >> 1), dir ? BACK : SLASH, colour, heavy);
        }
      }
    }
    shafts.forEach((s, i) => { // each shaft of light has a few rays drawn down its edges
      for (let r = 0; r * 2 < G - S * 0.3; r++) for (const side of [-0.7, 0.1, 0.75]) {
        const c = Math.floor((s.x - (r * 2 + 1) * SLANT + side * s.w) / px), j = r * cols + c;
        if (c >= 0 && c < cols && !wFront[j] && r * 2 > crown(c * px) && hash(c + i * 31, r) < 0.4 * s.k) mark(c, r, SLASH, AIR + (side > 0.5 ? 9 : 10));
      }
    });
    for (let c = 0; c < cols; c += 2) { // the canopy is all leaf, thinning out where it hangs lowest
      const deep = crown((c + 0.5) * px) / 2;
      for (let r = 0; r < deep + 2; r++) if (rand() < (r < deep ? 0.3 : 0.12)) spray(c, r, CANE + (rand() < 0.3 ? 5 : rand() < 0.5 ? 4 : 3), 0);
    }
    for (let c = 0; c < cols; c++) { // litter on the floor: more of it, and larger, toward the camera
      for (let r = Math.ceil(horizon / 2) + 1; r < WR; r++) {
        const near = (r * 2 - horizon) / (WL - horizon), h = hash(c * 7 + 3, r * 13 + seed);
        if (wFront[r * cols + c] || h > 0.03 + 0.09 * near) continue;
        const k = (h * 9973) % 1;
        mark(c, r, k < 0.3 ? COMMA : k < 0.5 ? DOT : k < 0.65 ? TICK : k < 0.82 ? LOW : k < 0.95 ? WAVE : VEE, k > 0.95 ? LEAF : FLOOR + 4 + ((h * 631) % 3 | 0));
      }
    }
    shade(cx - S * 0.12, G + 1, S * 0.24, Math.max(1.5, S * 0.035)); // his own shadow, thrown behind him

    const glyph = new Uint8Array(cols * rows), ink = new Uint8Array(cols * rows), bold = new Uint8Array(cols * rows);
    const paint = new Uint8Array(cols * rows * 2), wash = new Uint8Array(cols * rows), veil = new Uint8Array(cols * rows);
    const solid = new Uint8Array(cols * rows); // the cells he is standing in this frame
    let top = 0; // the line of the forest at the top of the screen this frame

    // He is drawn in units of his own height: u to the right of his feet, v up from the ground.
    // `tone(u, v)` gives the colour of a point, or 0 where the shape is not.
    function shape(u0, v0, u1, v1, tone) {
      const c0 = Math.max(0, Math.floor((cx + u0 * S) / px)), c1 = Math.min(cols - 1, Math.ceil((cx + u1 * S) / px));
      const l0 = Math.max(0, Math.floor(G - v1 * S) - top), l1 = Math.min(lines - 1, Math.ceil(G - v0 * S) - top);
      for (let l = l0; l <= l1; l++) {
        const v = (G - (l + top + 0.5)) / S;
        for (let c = c0; c <= c1; c++) {
          const k = tone(((c + 0.5) * px - cx) / S, v);
          if (!k) continue;
          const i = (l >> 1) * cols + c;
          paint[l * cols + c] = k; glyph[i] = 32; solid[i] = 1;
        }
      }
    }
    // A limb from a to b, ra and rb thick at its ends. `tone(k, side)` is given how far
    // along a point is, and how far to the right of the way the limb is going (-1 to 1).
    function limb(ua, va, ub, vb, ra, rb, tone) {
      const du = ub - ua, dv = vb - va, len2 = du * du + dv * dv || 1e-9, r = Math.max(ra, rb);
      shape(Math.min(ua, ub) - r, Math.min(va, vb) - r, Math.max(ua, ub) + r, Math.max(va, vb) + r, (u, v) => {
        const k = clamp01(((u - ua) * du + (v - va) * dv) / len2), ou = u - ua - du * k, ov = v - va - dv * k, rr = lerp(ra, rb, k);
        return ou * ou + ov * ov > rr * rr ? 0 : tone(k, (ou * dv - ov * du) / (Math.sqrt(len2) * rr));
      });
    }
    function triangle(ua, va, ub, vb, uc, vc, tone) {
      const det = (vb - vc) * (ua - uc) + (uc - ub) * (va - vc) || 1e-9;
      shape(Math.min(ua, ub, uc), Math.min(va, vb, vc), Math.max(ua, ub, uc), Math.max(va, vb, vc), (u, v) => {
        const a = ((vb - vc) * (u - uc) + (uc - ub) * (v - vc)) / det, b = ((vc - va) * (u - uc) + (ua - uc) * (v - vc)) / det;
        return a < 0 || b < 0 || a + b > 1 ? 0 : tone(a, b);
      });
    }
    const sign = (u, v, ch, colour, heavy = 0) => { // a character at a point of his figure
      const c = Math.floor((cx + u * S) / px), r = (Math.floor(G - v * S) - top) >> 1;
      if (c < 0 || c >= cols || r < 0 || r >= rows) return;
      glyph[r * cols + c] = ch; ink[r * cols + c] = colour; bold[r * cols + c] = heavy;
    };
    const FOLDS = [0.27, 0.5, 0.71]; // how far across his skirt, back to front, each fold hangs
    // His ponytail, root to tip, a length at a time: the angle it hangs at while he is still (from
    // straight down, the more the further back), how long it is, and how thick at either end.
    const TAIL = [[1.4, 0.028, 0.015, 0.019], [0.75, 0.03, 0.019, 0.018], [0.3, 0.045, 0.018, 0.015], [0.05, 0.055, 0.015, 0.012], [-0.12, 0.065, 0.012, 0.008], [-0.25, 0.06, 0.008, 0.004]];
    const fine = (w) => Math.max(w, 0.56 / S); // half the width of a thin thing, never less than one half cell across
    const snap = (v) => (G - (Math.round(G - v * S - 0.5) + 0.5)) / S; // the height nearest v that runs through the middle of a line of half cells

    // The sword. Sheathed, it lies along AXIS through MOUTH on his far hip: the hilt forward
    // and up in front of him, the scabbard down and back behind him. Drawing it is two
    // movements, and sheathing it the same two backwards: `out`, the guard pulled along the
    // axis until the point is at the mouth, and `swing`, the blade brought round level.
    const SLOPE = 212 * Math.PI / 180, AXIS = [Math.cos(SLOPE), Math.sin(SLOPE)], MOUTH = [0.07, 0.555];
    const SHOULDER = [-0.005, 0.815], PULL = 0.22, LEVEL = snap(0.8);
    const sword = { u: 0, v: 0, du: 0, dv: 0, tu: 0, tv: 0, swing: 0, out: 0 }; // guard, the way it points, tip
    function wield(s) {
      let out = 0, swing = 0;
      if (s >= T.slash && s < T.out) { const d = (s - T.slash) / (T.out - T.slash); out = Math.min(1, d / 0.3); swing = smooth(0, 1, (d - 0.3) / 0.7); }
      else if (s >= T.out && s < T.sheathe) { out = 1; swing = 1; }
      else if (s >= T.sheathe && s < T.click) { const h = (s - T.sheathe) / (T.click - T.sheathe); out = 1 - smooth(0.55, 1, h); swing = 1 - smooth(0, 0.55, h); }
      const a = SLOPE + (2 * Math.PI - SLOPE) * swing, squash = lerp(1, 0.3, smooth(0, 0.35, swing)), len = swing ? lerp(PULL, 0.5, swing * swing) : PULL * out;
      const hu = Math.cos(a), hv = Math.sin(a) * squash, n = Math.hypot(hu, hv);
      sword.u = lerp(MOUTH[0] - AXIS[0] * PULL * out, 0.335, swing); sword.v = lerp(MOUTH[1] - AXIS[1] * PULL * out, LEVEL, swing);
      sword.du = hu / n; sword.dv = hv / n; sword.tu = sword.u + hu * len; sword.tv = sword.v + hv * len;
      sword.swing = swing; sword.out = out;
    }

    function figure(s) {
      wield(s);
      const since = s - T.slash, stir = since > 0 ? Math.exp(-since / 0.8) * smooth(0, 0.15, since) : 0; // the slash sets his robes moving, and they settle
      const lean = 0.05 * sword.swing; // he goes forward a little with the cut
      const sway = (v) => (0.008 + 0.05 * stir) * Math.sin(s * 1.3 - v * 7) * (1 - v / 0.6) ** 2;
      const bent = (v) => lean * Math.max(0, v - 0.6);
      const cloth = (f, fold) => ROBE + Math.max(0, (f > 0.8 ? 5 : f > 0.5 ? 4 : f > 0.22 ? 3 : 2) - fold); // lit from the front

      // scabbard: behind him, so only its tail shows
      limb(MOUTH[0], MOUTH[1], MOUTH[0] + AXIS[0] * 0.38, MOUTH[1] + AXIS[1] * 0.38, fine(0.013), fine(0.011), (k, side) => (k > 0.93 ? GOLD : side < -0.2 ? LACQUER + 2 : LACQUER + 1));
      // skirt, from the hem to the sash: it flares behind him and its folds deepen toward the ground
      const front = (v) => lerp(0.105, 0.062, v / 0.6) + sway(v) * 0.4, back = (v) => -0.062 - 0.135 * (1 - v / 0.6) ** 1.6 + sway(v);
      const crease = (at, v) => lerp(back(v), front(v), at + 0.03 * Math.sin(v * 9 + at * 20 + s * 0.8)); // where a fold runs
      shape(-0.3, 0, 0.16, 0.6, (u, v) => {
        const b = back(v), f = front(v);
        if (v > 0.6 || u < b || u > f || v < 0.014 + 0.012 * Math.sin(u * 70 + s * 1.2)) return 0;
        let fold = 0;
        for (const at of FOLDS) if (v < 0.3 + at * 0.36 && Math.abs(u - crease(at, v)) < fine(0.008)) fold = 1; // each fold is one unbroken line
        return cloth((u - b) / (f - b), fold);
      });
      for (let v = 0.05; v < 0.52; v += 2 / S) for (const at of FOLDS) { // and a line of characters down each fold, leaning the way it runs
        const u = crease(at, v), run = ((crease(at, v - 2 / S) - u) * S) / px;
        if (v < 0.26 + at * 0.36) sign(u, v, run > 0.5 ? BACK : run < -0.5 ? SLASH : BAR, ROBE + (at > 0.6 ? 2 : 1));
      }
      // torso
      shape(-0.1, 0.6, 0.16, 0.86, (u0, v) => {
        const u = u0 - bent(v), round = smooth(0.79, 0.86, v);
        const back = lerp(-0.062, -0.072, (v - 0.6) / 0.2) + 0.03 * round, front = lerp(0.062, 0.08, clamp01((v - 0.6) / 0.16)) - 0.05 * round;
        if (u < back || u > front) return 0;
        if (v < 0.618) return u > 0.01 ? SASH + 1 : SASH;
        const collar = Math.abs(u - lerp(0.075, 0.028, (v - 0.73) / 0.12)) < 0.009 && v > 0.73;
        return cloth((u - back) / (front - back), collar ? 2 : 0);
      });
      // neck and head: the face is the lower front of it, palest where it faces the light; the
      // rest is hair, drawn back tight, with a sheen where the top of his head faces the light
      const hu = 0.012 + bent(0.92), hv = 0.922;
      shape(hu - 0.03, 0.84, hu + 0.03, 0.88, (u, v) => (u > hu - 0.024 && u < hu + 0.02 ? SKIN + (u > hu - 0.006 ? 1 : 0) : 0));
      shape(hu - 0.07, 0.85, hu + 0.075, 1, (u, v) => {
        const du = u - hu, dv = v - hv, e = (du / 0.05) ** 2 + (dv / 0.064) ** 2;
        if ((du - 0.05) ** 2 / 0.012 ** 2 + (dv + 0.012) ** 2 / 0.012 ** 2 < 1) return SKIN + 4; // nose
        if (e > 1) return 0;
        if (dv > 0.02 + 0.3 * du || du < -0.016) return HAIR + (e > 0.5 && (0.6 * du) / 0.05 + (0.8 * dv) / 0.064 > 0.55 ? 2 : du < -0.025 && dv < 0.03 ? 0 : 1);
        if (S > 40 && Math.abs(du - 0.029) < fine(0.006) && Math.abs(dv - 0.004) < fine(0.006)) return HAIR; // eye
        if (S > 70 && Math.abs(du - 0.031) < fine(0.005) && Math.abs(dv + 0.036) < fine(0.003)) return LINE; // the corner of his mouth
        return SKIN + (du > 0.018 ? (dv > -0.03 ? 4 : 3) : du > -0.004 && dv > -0.045 ? 3 : 2);
      });
      // his ponytail, from the band that ties it high at the back of his head. It hangs still while
      // he waits; the slash throws it out behind him, and it swings back and settles, each length of
      // it a moment after the one above.
      let pu = hu - 0.04, pv = hv + 0.048, band;
      TAIL.forEach(([hang, len, r0, r1], k) => {
        const lag = since - 0.06 * k, a = hang + (lag > 0 ? (0.45 + 0.18 * k) * Math.exp(-lag / 0.55) * Math.sin(4.6 * lag) : 0);
        const nu = pu - Math.sin(a) * len, nv = pv - Math.cos(a) * len, lit = 0.6 * (nv - pv) - 0.8 * (nu - pu) > 0 ? 1 : -1; // which side of it faces the light
        limb(pu, pv, nu, nv, fine(r0), fine(r1), (q, side) => HAIR + (side * lit > 0.3 ? 2 : side * lit < -0.4 ? 0 : 1));
        if (!k) band = [lerp(pu, nu, 0.25), lerp(pv, nv, 0.25), Math.cos(a) * 0.017, -Math.sin(a) * 0.017];
        pu = nu; pv = nv;
      });
      const [bu, bv, bdu, bdv] = band;
      limb(bu - bdu, bv - bdv, bu + bdu, bv + bdv, fine(0.005), fine(0.005), (q) => ROBE + (q < 0.5 ? 5 : 3)); // the band, white like his robes
      // shoe
      shape(0.06, 0, 0.16, 0.03, (u, v) => (((u - 0.112) / 0.036) ** 2 + ((v - 0.012) / 0.013) ** 2 < 1 ? HAIR : 0));

      // sword in front of him: the hilt, the guard, and whatever of the blade is out of the scabbard
      const { u: gu, v: gv, du, dv, tu, tv } = sword;
      if (sword.out > 0) limb(gu, gv, tu, tv, fine(0.008), fine(0.006), (k, side) => (side > 0.3 && S > 70 ? STEEL : STEEL + 2));
      limb(gu, gv, gu - du * 0.1, gv - dv * 0.1, fine(0.011), fine(0.011), (k) => (k > 0.8 ? GOLD : HAIR + 1));
      limb(gu - dv * 0.022, gv + du * 0.022, gu + dv * 0.022, gv - du * 0.022, fine(0.008), fine(0.008), () => GOLD);

      // his near arm. At rest the hand lies on the end of the hilt; to draw, it closes round the
      // middle. The sleeve is wide, and hangs from the elbow like a banner.
      const hold = lerp(0.085, 0.05, Math.min(1, sword.out * 4)), rest = 0.012 * (1 - Math.min(1, sword.out * 4));
      const su = SHOULDER[0] + bent(SHOULDER[1]), sv = SHOULDER[1], au = gu - du * hold + dv * rest, av = gv - dv * hold - du * rest; // shoulder, hand
      const UPPER = 0.17, FORE = 0.16, far = Math.min(UPPER + FORE - 0.002, Math.hypot(au - su, av - sv));
      const ru = (au - su) / Math.hypot(au - su, av - sv), rv = (av - sv) / Math.hypot(au - su, av - sv);
      const along = (UPPER * UPPER - FORE * FORE + far * far) / (2 * far), off = Math.sqrt(Math.max(0, UPPER * UPPER - along * along));
      const eu = su + ru * along + rv * off, ev = sv + rv * along - ru * off; // elbow: always the lower of the two places it could be
      const fly = 0.07 * Math.sin(s * 1.1) - (since > 0 ? Math.exp(-since / 0.8) * Math.cos(4.4 * since + 0.3) * smooth(0, 0.15, since) : 0); // the sleeve is thrown forward by the slash, and swings back
      const drop = 0.14 + 0.05 * sword.swing, wu = au - ru * 0.025, wv = av - rv * 0.025; // wrist
      triangle(eu, ev, lerp(eu, wu, 0.6), lerp(ev, wv, 0.6), eu - 0.01 + Math.sin(fly) * drop, ev - Math.cos(fly) * drop, (a, b) => ROBE + (b > 0.7 ? 1 : b > 0.4 ? 2 : a > 0.5 ? 4 : 3));
      limb(su, sv, eu, ev, 0.046, 0.042, (k, side) => ROBE + (side < -0.25 ? 5 : side < 0.5 ? 4 : 2));
      limb(eu, ev, wu, wv, 0.04, 0.026, (k, side) => ROBE + (side < -0.3 ? 5 : side < 0.45 ? 4 : 2));
      limb(au, av, au + ru * 0.012, av + rv * 0.012, fine(0.017), fine(0.015), () => SKIN + 2); // a step darker than his face, so it stands apart from the white of his sleeve
    }
    // Glints, drawn after everything else so nothing covers them: at the point as the blade
    // stops, and at the guard for the click.
    function glints(s) {
      if (s >= T.out && s < T.out + 0.35) sign(sword.tu + 0.01, sword.tv, STAR, STEEL + 2, 1);
      if (s >= T.click && s < T.click + 0.4) sign(MOUTH[0] + 0.012, MOUTH[1] + 0.02, STAR, STEEL + 2, 1);
    }

    // The slash, as what it leaves behind. The sweep of the blade is tabulated once: every
    // half cell it passes over, with when in the slash it passed and how far out along the blade.
    const tipX = cx + S * 0.835, slashY = G - LEVEL * S; // where the point of the sword ends up, and the level of the cut
    const swept = [];
    {
      const seen = new Uint8Array(cols * lines), steps = Math.ceil(S * 3), along = Math.ceil(S * 0.6);
      for (let i = 0; i <= steps; i++) {
        wield(lerp(T.slash, T.out, i / steps));
        for (let j = 0; j <= along && sword.swing > 0; j++) {
          const q = j / along, c = Math.floor((cx + lerp(sword.u, sword.tu, lerp(0.6, 1, q)) * S) / px), l = Math.floor(G - lerp(sword.v, sword.tv, lerp(0.6, 1, q)) * S);
          if (c < 0 || c >= cols || l < 0 || l >= lines || seen[l * cols + c]) continue;
          seen[l * cols + c] = 1;
          swept.push({ at: l * cols + c, when: i / steps, q });
        }
      }
    }
    function trace(s) {
      const d = Math.min(1, (s - T.slash) / (T.out - T.slash)), thin = smooth(0.25, 1.3, s - T.out); // the trace is held, then wears away toward the blade
      if (d <= 0 || thin >= 1) return;
      for (const p of swept) {
        if (p.when > d) continue;
        // brightest out toward the point and where the blade has only just been: white at the blade, blue back at his hip
        const k = 0.25 + 0.5 * p.q + 0.45 * (1 - d + p.when) - 1.4 * thin - 0.2 * BAYER[((p.at / cols) & 3) * 4 + (p.at % cols & 3)];
        if (k < 0.2) continue;
        paint[p.at] = QI + (k > 0.98 ? 3 : k > 0.72 ? 2 : k > 0.45 ? 1 : 0);
        glyph[((p.at / cols) >> 1) * cols + (p.at % cols)] = 32;
      }
    }
    // The arc of qi: a thin crescent that leaves the blade and crosses the forest to the right,
    // behind the near stalks. A glow lingers where it has just been, and the line of the cut is
    // drawn out behind it.
    function arc(s) {
      const far = (s - T.out + 0.05) / (T.arc - T.out + 0.05);
      if (far <= 0 || far >= 1.25) return;
      const flat = 0.42, tips = 0.9; // how squat the crescent is, and how far round toward its ends it goes
      const nose = (at) => lerp(tipX + S * 0.08, W + S * 0.75, at), size = (at) => S * lerp(0.3, 0.62, Math.min(1, at)); // where its point is when it is `at` of the way across, and how big it has grown
      const edge = (at, l) => { // where its leading edge crosses line l then, or NaN
        const r = size(at), k = (l + 0.5 - slashY) / (r * flat);
        return Math.abs(k) > tips ? NaN : nose(at) - r * (1 - Math.sqrt(1 - k * k));
      };
      const reach = size(far) * flat;
      if (far <= 1.1) for (let l = Math.max(0, Math.floor(slashY - reach)); l <= Math.min(lines - 1, slashY + reach); l++) {
        const x1 = edge(far, l), next = edge(far, l + (l + 0.5 < slashY ? -1 : 1)), was = edge(Math.max(0, far - 0.05), l);
        if (x1 !== x1) continue;
        const x0 = Math.min(x1 - 1.6 * px, next === next ? next : x1 - 3 * px), lead = Math.floor(x1 / px); // each line reaches back to where the next one out begins, so the curve is unbroken
        const c0 = Math.floor(x0 / px), g = was === was ? Math.floor(Math.min(was, x0) / px) : c0;
        for (let c = Math.max(0, g); c <= Math.min(cols - 1, lead); c++) {
          const i = (l >> 1) * cols + c;
          if (wFront[i] === 2) continue;
          if (c >= c0) { paint[l * cols + c] = QI + (c >= lead - 1 ? 3 : 2); glyph[i] = 32; solid[i] = 1; }
          else if (!solid[i]) veil[i] = Math.max(veil[i], GLOW + (c - g >= (c0 - g) / 2 ? 1 : 0)); // the glow, over the mist and fading back toward where it was a moment ago
        }
        if (l & 1 && lead >= 0 && lead < cols && wFront[(l >> 1) * cols + lead] !== 2) { // its leading edge again in characters, each leaning the way the curve runs
          const lean = Math.abs(l - slashY) < 1.5 ? NOSE : x1 - next > 1.5 * px ? (l < slashY ? HIGH : LOW) : l < slashY ? BACK : SLASH;
          glyph[(l >> 1) * cols + lead] = lean; ink[(l >> 1) * cols + lead] = QI + 1; bold[(l >> 1) * cols + lead] = 1;
        }
      }
      const row = Math.floor(slashY / 2), fade = 1 - smooth(1, 1.25, far), head = nose(far) - S * 0.2;
      for (let c = Math.max(0, Math.ceil(tipX / px)); c < Math.min(cols, head / px); c++) { // the wake: dashes along the line of the cut, thinning out behind
        const i = row * cols + c, back = (head - c * px) / (W * 0.5);
        if (wFront[i] === 2 || solid[i] || hash(c, 29) > fade * (0.8 - 0.55 * back)) continue;
        glyph[i] = DASH; ink[i] = QI + (back < 0.1 ? 3 : back < 0.3 ? 2 : 1); bold[i] = back < 0.1 ? 1 : 0;
      }
    }

    // Falling leaves. Each swings from side to side as it comes down, and tilts with the swing.
    // When the cut reaches it, it becomes two halves that drift apart. One that has come to
    // the ground lies flat there.
    const leaves = [];
    for (let i = 0, n = Math.max(7, Math.min(60, Math.round((W * lines) / 760))); i < n; i++) {
      const x = R(0.03, 0.97) * W, near = rand() < 0.5;
      leaves.push({
        x, y: R(-0.3, 0.8) * lines, fall: lines * R(0.03, 0.06), swing: S * R(0.03, 0.07), rate: R(1.2, 2), phase: R(0, 6.28), turn: R(-0.8, 0.8),
        len: S * (near ? R(0.12, 0.15) : R(0.085, 0.105)), near, tone: near ? 1 : 0,
        cut: T.cut + (0.5 * Math.abs(x - tipX)) / W, lie: G + S * (near ? R(0.05, 0.45) : R(-0.1, 0)), spin: R(0.5, 1.2) * (rand() < 0.5 ? -1 : 1),
      });
    }
    // The one the camera follows is nearer than the rest, and is cut just past the point of
    // the sword. After the click it keeps its place on the screen while the camera comes down.
    const after = G - pan * 2, landLine = Math.round(lerp(after, lines, 0.42)), landX = Math.max(W * 0.08, Math.min(W * 0.92, cx + S * 0.45));
    const hero = { near: true, hero: true, len: S * 0.2, tone: 2, fall: lines * 0.028, swing: S * 0.05, rate: 1.5, phase: 0.6, turn: 0.2, cut: T.cut, spin: -0.8, lie: pan * 2 + landLine };
    leaves.push(hero);
    // A leaf is a lozenge, long and thin, lighter along its upper side. A half leaf is one end of it, cut square across.
    function drawLeaf(x, y, a, len, half, colour, front, flat) {
      const ca = Math.cos(a), sa = Math.sin(a), wide = flat ? 0.75 : Math.max(0.75, len * 0.14), reach = len / 2 + 1, up = ca < 0 ? -1 : 1;
      const mx = x + (half ? ca * len * 0.2 : 0), my = y + (half ? sa * len * 0.2 : 0); // a point that is surely inside it
      const c0 = Math.max(0, Math.floor((x - reach) / px)), c1 = Math.min(cols - 1, Math.ceil((x + reach) / px));
      const l0 = Math.max(0, Math.floor(y - reach - top)), l1 = Math.min(lines - 1, Math.ceil(y + reach - top));
      for (let l = l0; l <= l1; l++) for (let c = c0; c <= c1; c++) {
        const dx = (c + 0.5) * px - x, dy = l + top + 0.5 - y, p = dx * ca + dy * sa, q = dy * ca - dx * sa, i = (l >> 1) * cols + c;
        const inside = (!half || p >= 0) && Math.abs(p) / (len / 2) + Math.abs(q) / wide <= 1;
        if ((!inside && (Math.floor(mx / px) !== c || Math.floor(my - top) !== l)) || (!front && (wFront[i + (top >> 1) * cols] === 2 || solid[i]))) continue;
        paint[l * cols + c] = colour + (q * up < 0 && !flat ? 1 : 0); glyph[i] = 32;
        if (front) { solid[i] = 1; veil[i] = 0; } // (a near leaf is in front of the glow of the arc)
      }
      const c = Math.floor(x / px), r = Math.floor(y - top) >> 1, i = r * cols + c;
      if (half || flat || len < 5 || c < 0 || c >= cols || r < 0 || r >= rows || (!front && (wFront[i + (top >> 1) * cols] === 2 || solid[i]))) return;
      glyph[i] = Math.abs(sa) < 0.38 ? DASH : Math.abs(ca) < 0.38 ? BAR : ca * sa > 0 ? BACK : SLASH; ink[i] = LEAF; bold[i] = 0; // a whole leaf has its midrib
    }
    function drawLeaves(s, front) {
      const e = smooth(T.click, T.land, s);
      for (const f of leaves) {
        if (f.near !== front) continue;
        const beat = f.rate * s + f.phase, gone = s - f.cut, flash = gone > 0 && gone < 0.2;
        let x, y, a = f.turn + 0.8 * Math.cos(beat), down = false;
        if (f.hero) {
          const calm = 1 - e * e;
          x = lerp(cx + S * 1.02, landX, smooth(T.cut - 1, T.land, s)) + f.swing * Math.sin(beat) * calm;
          y = slashY + S * 0.03 + f.fall * (Math.min(s, T.click) - T.cut) + 0.2 * f.swing * Math.sin(2 * beat) * calm;
          y = lerp(y, landLine + 0.5, e ** 1.5) + pan * 2 * e;
          a = lerp(a, 0.12, e * e);
          const close = smooth(S * 0.5, 0, f.lie - y), l0 = Math.floor(f.lie + 1.5 - top), rx = f.len * (0.22 + 0.3 * close); // its shadow gathers on the floor as it comes down
          if (close > 0) for (let l = l0; l <= l0 + 1 && l < lines; l++) for (let c = Math.max(0, Math.floor((x - rx) / px)); c <= Math.min(cols - 1, (x + rx) / px); c++) {
            const j = l * cols + c;
            if (l >= 0 && paint[j] >= FLOOR && paint[j] <= FLOOR + 6) paint[j] = Math.max(FLOOR, paint[j] - (close > 0.6 ? 2 : 1));
          }
        } else {
          const landed = (f.lie - f.y) / f.fall, now = Math.min(s, landed);
          x = f.x + f.swing * Math.sin(f.rate * now + f.phase); y = f.y + f.fall * now + 0.25 * f.swing * Math.sin(2 * (f.rate * now + f.phase));
          if (s >= landed) { a = f.turn * 0.2; down = true; }
        }
        const colour = LEAF + (down ? Math.max(0, f.tone - 1) : f.tone);
        if (gone <= 0) { drawLeaf(x, y, a, f.len, false, colour, front, down); continue; }
        const apart = f.len * (0.12 + 0.5 * (1 - Math.exp(-gone / 1.1))), twist = down ? 0 : f.spin * (1 - Math.exp(-gone / 1.6));
        if (flash) { // the cut itself: a level line of light through the leaf, white where it crosses it and blue at its ends
          const l = Math.floor(y - top), r = f.len * 0.7;
          if (l >= 0 && l < lines) for (let c = Math.max(0, Math.floor((x - r) / px)); c <= Math.min(cols - 1, (x + r) / px); c++) {
            const d = Math.abs((c + 0.5) * px - x) / r;
            paint[l * cols + c] = QI + (d < 0.45 ? 3 : d < 0.75 ? 2 : 1);
          }
        }
        if (f.hero) { // the half the camera follows; the other is left to fall on its own, and is soon out of the picture
          drawLeaf(x, y, a + Math.PI + twist * 0.6 * (1 - e), f.len, true, colour, front, false);
          drawLeaf(x + apart + S * 0.04 * gone, slashY + S * 0.03 + f.fall * 1.4 * gone + pan * 2 * e * 0.55, a - twist, f.len, true, colour, front, false);
        } else {
          drawLeaf(x - Math.cos(a) * apart * 0.4, y - Math.sin(a) * apart * 0.4 + (down ? 0 : f.fall * 0.25 * gone), a + Math.PI + twist * 0.6, f.len, true, colour, front, down);
          drawLeaf(x + Math.cos(a) * apart * 0.6, y + Math.sin(a) * apart * 0.6 - (down ? 0 : f.fall * 0.2 * gone), a - twist, f.len, true, colour, front, down);
        }
      }
    }

    // Mist: two sheets of noise sliding over each other, thickest at the level of his chest
    // and along the ground. It is laid over the forest in a few strengths, like cut paper.
    const PAD = Math.ceil(T.end * 2.1) + 3, MW = cols + PAD;
    const sheetA = new Float32Array(MW * WR), sheetB = new Float32Array(MW * WR), thick = new Float32Array(WR);
    for (let r = 0; r < WR; r++) {
      const y = r * 2 + 1;
      thick[r] = 1.15 * Math.exp(-(((y - slashY - S * 0.06) / (S * 0.36)) ** 2)) + 0.75 * Math.exp(-(((y - G - S * 0.02) / (S * 0.13)) ** 2)) + 0.3 * smooth(G, G + S * 0.5, y);
      for (let c = 0; c < MW; c++) {
        sheetA[r * MW + c] = noise((c * px) / (S * 0.55), y / (S * 0.13) + seed);
        sheetB[r * MW + c] = noise((c * px) / (S * 0.21) + 40, y / (S * 0.075) + 40 + seed);
      }
    }
    const lane = Math.max(0.9, S * 0.028); // half the height of the lane the cut leaves in the mist, in rows
    function mist(s, cam) {
      const a = s * 1.0, b = s * 2.05, ia = a | 0, ib = b | 0, fa = a - ia, fb = b - ib, open = s - T.cut;
      for (let r = 0; r < rows; r++) {
        const wr = r + cam, k = thick[wr], off = Math.abs(wr + 0.5 - slashY / 2);
        if (k < 0.05) continue;
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c, stem = wFront[wr * cols + c];
          if (solid[i] || stem === 2) continue;
          const ja = wr * MW + c + ia, jb = wr * MW + c + ib; // the slower sheet is behind the stalks at his distance, so they stand out of it
          let m = k * (0.42 + (stem ? 0.1 : 0.36) * lerp(sheetA[ja], sheetA[ja + 1], fa) + 0.22 * lerp(sheetB[jb], sheetB[jb + 1], fb));
          if (open > 0 && off < lane + 2.5) { // the mist parts along the line of the cut, from the sword outward, and banks up either side
            const wide = lane * smooth(0, 1.5, open - (0.5 * Math.abs(c * px - tipX)) / W);
            m = off < wide ? 0 : m + 0.22 * smooth(wide + 1.6, wide, off) * smooth(0, 0.3, wide);
          }
          const level = Math.min(5, Math.floor((m - 0.3) * 9));
          if (level > 0) wash[i] = MIST + level - 1;
          if (level > 1 && glyph[i] === 32 && hash(c + ib, wr * 7 + 1) < 0.03) { glyph[i] = level > 3 ? WAVE : DASH; ink[i] = AIR + 11; bold[i] = 0; } // wisps, carried along with the faster sheet
        }
      }
    }

    // The ending. A line of light runs out both ways from the leaf, and the picture comes
    // apart along it: everything above slides up and everything below slides down.
    const cutRow = Math.max(1, Math.min(rows - 1, Math.round(landLine / 2))), cutC = Math.floor(landX / px);
    function part(s) {
      for (let c = 0; c < cols; c++) {
        const since = s - T.part - (0.14 * Math.abs(c - cutC)) / Math.max(cutC, cols - cutC);
        if (since <= 0) continue;
        const k = Math.min(1, Math.max(0, s - T.part - 0.2) / (T.end - T.part - 0.25)) ** 2, up = Math.ceil(k * cutRow), down = Math.ceil(k * (rows - cutRow)); // the line runs out first, then the whole picture parts at once
        const move = (r, from, alive) => {
          const i = r * cols + c, j = from * cols + c;
          if (alive) { paint[i * 2 - c] = paint[j * 2 - c]; paint[i * 2 - c + cols] = paint[j * 2 - c + cols]; glyph[i] = glyph[j]; ink[i] = ink[j]; bold[i] = bold[j]; wash[i] = wash[j]; }
          else { paint[i * 2 - c] = paint[i * 2 - c + cols] = 0; glyph[i] = 32; wash[i] = 0; }
        };
        if (up) for (let r = 0; r < cutRow; r++) move(r, r + up, r + up < cutRow);
        if (down) for (let r = rows - 1; r >= cutRow; r--) move(r, r - down, r - down >= cutRow);
        const glow = QI + (since < 0.25 ? 3 : since < 0.5 ? 2 : 1); // the two edges of the cut
        if (cutRow - up > 0) { paint[((cutRow - up) * 2 - 1) * cols + c] = glow; glyph[(cutRow - up - 1) * cols + c] = 32; }
        if (down && cutRow + down < rows) { paint[(cutRow + down) * 2 * cols + c] = glow; glyph[(cutRow + down) * cols + c] = 32; }
      }
    }

    return {
      cols, rows, palette: PALETTE, glyph, ink, bold, paint, wash, veil,
      render(t) { // t: seconds since the film started
        wash.fill(0); veil.fill(0);
        if (t >= LENGTH) { glyph.fill(32); ink.fill(0); bold.fill(0); paint.fill(0); return this; } // over: an empty frame, so the page shows
        const s = t * SPEED; // where that is in the story
        const cam = Math.round(pan * smooth(T.click, T.land, s)); // the row of the forest at the top of the screen
        paint.set(wPaint.subarray(cam * 2 * cols, (cam + rows) * 2 * cols));
        glyph.set(wGlyph.subarray(cam * cols, (cam + rows) * cols));
        ink.set(wInk.subarray(cam * cols, (cam + rows) * cols));
        bold.set(wBold.subarray(cam * cols, (cam + rows) * cols));
        solid.fill(0); top = cam * 2;
        drawLeaves(s, false);
        if (!cam) trace(s);
        figure(s);
        if (!cam) arc(s);
        drawLeaves(s, true);
        glints(s);
        mist(s, cam);
        if (s > T.part) part(s);
        return this;
      },
    };
  }

  const film = { length: LENGTH, still: 1.3, createScene };
  return { play: (options) => AsciiStage.play(film, options), createScene };
})();
