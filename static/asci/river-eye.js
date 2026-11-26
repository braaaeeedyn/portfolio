/*
 * Eye in the river: an ASCII loading screen for the stage (ascii-stage.js).
 *
 *   <script src="ascii-stage.js"></script>
 *   <script src="river-eye.js"></script>
 *   <script>RiverEye.play().then(showThePage);</script>
 *
 * Seen from straight above, a clear river runs on a slant between two banks,
 * over sand and pebbles. An eye opens, a reflection lying on the water. A fish
 * darts through its pupil; the wake drags the reflection out of shape, twists
 * it and breaks it up. More fish follow, faster and more at a time: one, then
 * two or three, then a shoal from both ends that crosses where the eye was and
 * churns the spot. Rings spread from it, and they are what takes the picture
 * away: the page shows first in the troughs between them, and each ring that
 * passes leaves less than the last. The whole thing lasts five seconds
 * (LENGTH, below).
 *
 * The picture is worked out in full colour, one half cell at a time, in the
 * order the light meets things (the ground, the light on the bed, the
 * reflection, the fish, the shine of the surface) and then set in the nearest
 * colour of a short palette. Characters are laid on top for what moves and
 * what is fine. It is a pure function of time: createScene().render(t).
 */
const RiverEye = (() => {
  'use strict';
  const { code, clamp01, lerp, smooth, mulberry32, hash, noise } = AsciiStage;

  const LENGTH = 5; // seconds on screen

  // The story's timeline, in seconds at the pace it was written.
  const T = {
    appear: 0.95, // a closed eye begins to show on the water
    part: 1.5,    // its lids start to part
    open: 3.8,    // it is fully open
    strike: 4.85, // the first fish's nose reaches the pupil
    gone: 6.75,   // its wake has taken the last of the reflection
    single: 7.05, // a second fish passes the middle,
    group: 8.1,   // then two or three together,
    shoal: 9.4,   // then a shoal, crossing where the eye was
    clear: 11.75, // the page starts to show between the rings
    end: 13.5,
  };
  const DART = 2;  // how long the first fish is on screen, nose in to tail out
  const SHOAL = 8; // how many fish come at the end
  // It is played faster than that, SPEED times, to last LENGTH seconds on screen.
  const SPEED = T.end / LENGTH;

  // Each shore leaves its edge of the screen this far from the corner (as a share of the
  // width) and is this deep (as a share of the height) where it meets the side.
  const BANK = { from: 0.12, deep: 0.3 };
  const LAG = 1.2; // at the end, how much later the far corner starts to go than the middle of the rings
  const CHURN = 0.4; // how much the shoal adds to the rings, against the first fish's 1
  // The wakes of the fish that follow the first, against its 1: how much sooner they settle,
  // how far they spread, how hard they churn the water, and how much narrower the churned strip
  // is; and the age, on the first one's clock, when nothing of them is left to see. They are
  // quicker and smaller than the first one's, so the fish can still be seen among them.
  const FOLLOW = { quick: 2, spread: 0.6, stir: 0.4, narrow: 1.6, last: 3 };

  // Colours, as ramps from shadow to light. Each shifts in hue as it lightens:
  // the sand from olive umber to cream, the iris from ink blue to sea green.
  const RAMP = {
    sand: ['#3f3526', '#5a4a33', '#766043', '#917851', '#aa9062', '#c0a674', '#d3bb89', '#e3cfa1', '#efe0bb', '#f9f0d8'],
    slate: ['#3a403f', '#515a58', '#6b7672', '#88928b', '#a7afa3'],
    rust: ['#4c2e22', '#6a3f2b', '#885337', '#a56c46', '#bd8a5c'],
    moss: ['#343a26', '#4a5233', '#636c42', '#7f8756'],
    grass: ['#26331c', '#354723', '#485e2b', '#5f7835', '#7b9343', '#9aad5b'],
    bone: ['#a3a39a', '#bdbcb0', '#d4d1c4', '#e6e2d6', '#f3f1e9'],
    skin: ['#9a6d52', '#b88f70', '#d0ad8e', '#e2c7ab', '#efdcc6'],
    dark: ['#0b0d11', '#17130f', '#2a1e16', '#40301f'],
    iris: ['#0e2b31', '#15444c', '#1e6067', '#2c7e7d', '#459c90', '#6eb9a5', '#a3d7c0'],
    sage: ['#4e786c', '#76957f', '#9aa887'],
    fish: ['#15130f', '#221f17', '#342f22', '#4a4431', '#6a6245', '#8f8560'],
    white: ['#fffdf4', '#ffffff'],
  };
  const PALETTE = ['#000000'], AT = {}; // AT: where each ramp starts in the palette
  for (const name in RAMP) { AT[name] = PALETTE.length; PALETTE.push(...RAMP[name]); }
  const RGB = new Float32Array(PALETTE.length * 3);
  PALETTE.forEach((h, k) => { for (let j = 0; j < 3; j++) RGB[k * 3 + j] = parseInt(h.slice(1 + j * 2, 3 + j * 2), 16); });
  const shades = (name) => RGB.subarray(AT[name] * 3, (AT[name] + RAMP[name].length) * 3);
  const SAND = shades('sand'), GRASS = shades('grass'), BONE = shades('bone'), SKIN = shades('skin'), DARK = shades('dark'), IRIS = shades('iris'), FISH = shades('fish');

  // The colour a distance k along a ramp, between its steps.
  const tone = (ramp, k, out) => {
    const n = ramp.length / 3 - 1, x = k < 0 ? 0 : k > n ? n : k, i = Math.min(n - 1, x | 0), f = x - i;
    for (let j = 0; j < 3; j++) out[j] = ramp[i * 3 + j] + (ramp[i * 3 + 3 + j] - ramp[i * 3 + j]) * f;
    return out;
  };

  // The palette colour nearest to each 15-bit colour, found the first time that colour comes up.
  const NEAREST = new Uint8Array(32768);
  const match = (key) => {
    const r = ((key >> 10) << 3) + 4, g = (((key >> 5) & 31) << 3) + 4, b = ((key & 31) << 3) + 4;
    let best = 1, far = Infinity;
    for (let k = 1; k < PALETTE.length; k++) {
      const dr = r - RGB[k * 3], dg = g - RGB[k * 3 + 1], db = b - RGB[k * 3 + 2], d = 3 * dr * dr + 4 * dg * dg + 2 * db * db;
      if (d < far) { far = d; best = k; }
    }
    return (NEAREST[key] = best);
  };
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]; // an ordered dither
  const GRAIN = 0.4; // how many levels of colour it shifts a dot by, either way

  const [WAVE, DASH, BAR, SLASH, BACK, OPEN, SHUT, BEAD, BIG, STAR, DOT] = code('~-|/\\()oO*.');
  const SPECK = code(".,:'`"), TUFT = code('",;\'vw'); // grains of sand; grass, seen from above

  // One turn of a wave, in TURN steps.
  const TURN = 64;
  const COS = Float32Array.from({ length: TURN }, (_, k) => Math.cos((k / TURN) * 2 * Math.PI)), SIN = COS.map((_, k) => Math.sin((k / TURN) * 2 * Math.PI));

  // The eye, in its own units: half its width is 1, u runs from the inner corner (-1) to the
  // outer (1) and v downward. An arch is 0 at both corners and 1 at `peak` between them.
  const arch = (u, peak, power) => {
    if (u <= -1 || u >= 1) return 0;
    const k = ((u + 1) / 2) ** (Math.log(0.5) / Math.log((peak + 1) / 2));
    return (4 * k * (1 - k)) ** power;
  };
  const corners = (u) => lerp(0.05, -0.04, (u + 1) / 2);               // the line from one corner to the other
  const upperOpen = (u) => corners(u) - 0.43 * arch(u, -0.12, 0.72);   // the edge of the upper lid when the eye is open,
  const lowerOpen = (u) => corners(u) + 0.27 * arch(u, 0.14, 0.85);    // of the lower lid,
  const shut = (u) => corners(u) + 0.2 * arch(u, 0.05, 0.85);          // and where the two meet when it is shut
  const EYE = { u: 0.02, v: -0.075, r: 0.385, pupil: 0.39 };           // the iris: its middle, its radius, and the pupil's as a share of that

  function createScene({ cols, rows, aspect = 2, seed = 7 }) {
    const rand = mulberry32(seed), R = (a, b) => a + (b - a) * rand(), salt = (seed * 1009) | 0;
    const lines = rows * 2, cells = cols * rows, dots = cols * lines; // a dot is half a cell: one pixel of the paint
    const glyph = new Uint8Array(cells), ink = new Uint8Array(cells), bold = new Uint8Array(cells), paint = new Uint8Array(dots);

    // The world is measured in dots: a dot is `ax` wide and 1 tall. S is half the width of the
    // eye, and sizes the fish and their wakes too; U sizes the river's own things, its pebbles
    // and ripples. Both follow the screen, so the picture is the same on any grid.
    const ax = 2 / aspect, W = cols * ax, H = lines;
    const S = Math.min(W * 0.33, H * 0.3), U = 1.35 * S;
    const cx = W / 2, cy = H / 2 + S * 0.06;
    const px = cx + EYE.u * S, py = cy + EYE.v * S; // the middle of the pupil
    const lumps = (size, across) => Math.max(2, Math.round(across / (size * U)));
    const rgb = [0, 0, 0];

    // The river crosses the screen on a slant, from the upper left to the lower right. One
    // shore leaves the top edge near the left corner and meets the right edge part of the way
    // down; the other mirrors it. So the banks take the same share of any screen, wide or tall.
    const slant = Math.atan2(BANK.deep * H, (1 - BANK.from) * W);
    const fx = Math.cos(slant), fy = Math.sin(slant); // downstream
    const wide = H * fx * (0.5 - (BANK.deep * (0.5 - BANK.from)) / (1 - BANK.from)); // from the middle of the channel to either shore
    const downstream = (X, Y) => ((X - W / 2) * fx + (Y - H / 2) * fy) / U; // how far along the channel a point is, in U,
    const offMiddle = (X, Y) => (Y - H / 2) * fx - (X - W / 2) * fy;        // and how far across it, in dots: above 0 toward the lower bank
    const ashore = (X, Y) => { // how far up the bank, in dots; below 0, how far out in the water. The shores wander.
      const a = downstream(X, Y), b = offMiddle(X, Y), bank = b < 0 ? 0 : 1;
      return Math.abs(b) - wide - U * (0.22 * (noise(a / 1.3, salt + bank) - 0.5) + 0.07 * (noise(a / 0.33, salt + 2 + bank) - 0.5));
    };
    const inGrass = (X, Y) => ashore(X, Y) - U * (0.1 + 0.3 * noise(downstream(X, Y) / 0.8, salt + 4 + (offMiddle(X, Y) < 0 ? 0 : 1))); // above 0 where grass grows: the strand below it is wider in some places than others

    // Smooth noise that repeats across the screen, so a sheet of it can slide for ever:
    // lumps `sizeX` by `sizeY` (in U), with finer ones on top if it has a second octave.
    function sheet(sizeX, sizeY, salted, octaves = 2) {
      const out = new Float32Array(dots), whole = 2 - 2 ** (1 - octaves); // what the octaves add up to
      for (let octave = 0; octave < octaves; octave++) {
        const nx = lumps(sizeX, W) << octave, ny = lumps(sizeY, H) << octave, knots = new Float32Array(nx * ny);
        for (let k = 0; k < knots.length; k++) knots[k] = hash(k, salt + salted + octave * 77);
        for (let l = 0; l < lines; l++) {
          const ty = ((l + 0.5) / lines) * ny, y0 = ty | 0, y1 = (y0 + 1) % ny, v = smooth(0, 1, ty - y0);
          for (let c = 0; c < cols; c++) {
            const tx = ((c + 0.5) / cols) * nx, x0 = tx | 0, x1 = (x0 + 1) % nx, u = smooth(0, 1, tx - x0);
            out[l * cols + c] += lerp(lerp(knots[y0 * nx + x0], knots[y0 * nx + x1], u), lerp(knots[y1 * nx + x0], knots[y1 * nx + x1], u), v) / (whole * (1 << octave));
          }
        }
      }
      return out;
    }
    // Every dot whose middle lies in a box of the world.
    const over = (x0, y0, x1, y1, each) => {
      const c0 = Math.max(0, Math.floor(x0 / ax)), c1 = Math.min(cols - 1, Math.ceil(x1 / ax));
      for (let l = Math.max(0, Math.floor(y0)); l <= Math.min(lines - 1, Math.ceil(y1)); l++) {
        for (let c = c0; c <= c1; c++) each(l * cols + c, (c + 0.5) * ax, l + 0.5);
      }
    };

    // ---- The ground: the bed of the river and its banks, lit from the upper left. It does
    // not move.
    const bedR = new Uint8ClampedArray(dots), bedG = new Uint8ClampedArray(dots), bedB = new Uint8ClampedArray(dots);
    const bedGlyph = new Uint8Array(cells), bedInk = new Uint8Array(cells);
    const wet = new Float32Array(dots); // 0 on the banks, rising to 1 where the water is deep enough to ripple and shine
    const brink = [];                   // the cells the water's edge runs through
    {
      const patch = sheet(1.1, 1.1, 1), blade = sheet(0.22, 0.22, 2), land = new Float32Array(dots), turf = new Uint8Array(dots);
      const cast = 0.05 * U; // how far the grass throws its shadow, down and to the right
      for (let l = 0, i = 0; l < lines; l++) {
        for (let c = 0; c < cols; c++, i++) {
          const X = (c + 0.5) * ax, Y = l + 0.5, up = (land[i] = ashore(X, Y));
          wet[i] = smooth(0, 0.3 * U, -up);
          if (up < 0) { // under water: sand in low ridges across the current, paler in the shallows and darker in the channel
            const ridge = Math.sin(downstream(X, Y) * 30 + patch[i] * 9);
            tone(SAND, 3.4 + 1.4 * (patch[i] - 0.5) + 0.22 * ridge + 1.3 * (1 - wet[i]) - 0.5 * smooth(0.25 * U, 0.9 * wide, -up) + (up > -1.2 ? 2 : 0), rgb); // with a bright line at the very edge
          } else if (inGrass(X, Y) > 0) { // grass, lighter along the edge that faces the light
            turf[i] = 1;
            tone(GRASS, 1.1 + 2.6 * blade[i] + 0.9 * (hash(c + salt, l) - 0.5) + (inGrass(X - cast, Y - cast) > 0 ? 0 : 1.3), rgb);
          } else { // the strand: dark where it is wet, pale where it has dried, and shaded under the grass
            tone(SAND, lerp(2.5, 6.7, smooth(0.03 * U, 0.1 * U, up)) + 1.5 * (patch[i] - 0.5), rgb);
            if (inGrass(X - cast, Y - cast) > 0) { rgb[0] *= 0.7; rgb[1] *= 0.7; rgb[2] *= 0.74; }
          }
          bedR[i] = rgb[0]; bedG[i] = rgb[1]; bedB[i] = rgb[2];
        }
      }
      // Pebbles: none under the iris, and few under the rest of the eye, so that it reads
      // clearly; and only the big ones lie in the grass.
      const stones = [], want = Math.round(((W * H) / (U * U)) * 11);
      for (let tries = 0; tries < want * 8 && stones.length < want; tries++) {
        const x = R(0, W), y = R(0, H), far = Math.hypot((x - cx) / (1.3 * S), (y - cy) / (0.75 * S));
        const r = U * (0.035 + 0.12 * rand() ** 2.2), kind = rand(), base = rand(), turn = R(0, Math.PI), flat = R(0.6, 0.95), keep = rand();
        if (Math.hypot(x - px, y - py) < 0.55 * S + r || (far < 1 && keep > 0.3)) continue;
        if (r < 0.1 * U && inGrass(x, y) > -r) continue;
        if (stones.some((q) => Math.hypot(q.x - x, q.y - y) < (q.r + r) * 0.95)) continue;
        const name = kind < 0.36 ? 'slate' : kind < 0.58 ? 'rust' : kind < 0.72 ? 'moss' : kind < 0.86 ? 'bone' : 'sand';
        stones.push({ x, y, r, flat, cos: Math.cos(turn), sin: Math.sin(turn), name, base: name === 'sand' ? 5.2 + base * 1.6 : name === 'bone' ? 0.6 + base * 1.4 : 1.3 + base * 1.3 });
      }
      const inside = (q, X, Y) => { // under 1 inside the stone
        const dx = X - q.x, dy = Y - q.y, ex = (dx * q.cos + dy * q.sin) / q.r, ey = (dy * q.cos - dx * q.sin) / (q.r * q.flat);
        return ex * ex + ey * ey;
      };
      const owner = new Int16Array(dots).fill(-1);
      stones.forEach((q, id) => over(q.x - q.r, q.y - q.r, q.x + q.r, q.y + q.r, (i, X, Y) => { if (inside(q, X, Y) < 1) owner[i] = id; }));
      for (const q of stones) { // each throws a shadow on the ground, down and to the right
        const d = 0.025 * U + 0.3 * q.r;
        over(q.x - q.r, q.y - q.r, q.x + q.r + d, q.y + q.r + d, (i, X, Y) => {
          if (owner[i] !== -1 || inside(q, X - d, Y - d) >= 1) return;
          owner[i] = -2; bedR[i] *= 0.7; bedG[i] *= 0.7; bedB[i] *= 0.74;
        });
      }
      stones.forEach((q, id) => over(q.x - q.r, q.y - q.r, q.x + q.r, q.y + q.r, (i, X, Y) => {
        if (owner[i] !== id) return;
        const e = inside(q, X, Y), lit = -(X - q.x + (Y - q.y)) / (q.r * 1.4);
        tone(shades(q.name), Math.round(q.base + lit * 1.5 - (e > 0.62 && lit < 0.15 ? 0.8 : 0)), rgb); // flat steps of tone, with a dark rim on the far side
        bedR[i] = rgb[0]; bedG[i] = rgb[1]; bedB[i] = rgb[2];
      }));
      for (let i = 0; i < dots; i++) { // the water has a tan of its own, stronger where it is deeper
        const k = 0.38 * wet[i];
        bedR[i] += (SAND[6] - bedR[i]) * k; bedG[i] += (SAND[7] - bedG[i]) * k; bedB[i] += (SAND[8] - bedB[i]) * k;
      }
      for (let r = 0, i = 0; r < rows; r++) { // tufts in the grass, grains in the sand, and the line where the water meets the strand
        for (let c = 0; c < cols; c++, i++) {
          const top = r * 2 * cols + c, low = top + cols, h = hash(c + salt, r), pick = (h * 1e4) | 0;
          const sunk = land[top] < 0 || land[low] < 0, edge = Math.min(Math.abs(land[top]), Math.abs(land[low]));
          if (sunk && edge < 0.75) {
            const east = land[top + (c < cols - 1 ? 1 : 0)] - land[top - (c ? 1 : 0)], south = land[low] - land[top], steep = Math.abs(east) / ax, level = Math.abs(south) * 2;
            brink.push({ i, glyph: steep < 0.4 * level ? (pick & 1 ? WAVE : DASH) : level < 0.4 * steep ? BAR : east * south > 0 ? SLASH : BACK, phase: h });
          } else if (owner[top] === -1 && owner[low] === -1) {
            if (turf[top] && turf[low]) { if (h < 0.3) { bedGlyph[i] = TUFT[pick % TUFT.length]; bedInk[i] = AT.grass + (pick % 5 < 2 ? 0 : 5); } }
            else if (h < (sunk ? 0.03 : 0.07)) { bedGlyph[i] = SPECK[pick % SPECK.length]; bedInk[i] = AT.sand + (sunk ? (pick % 5 < 3 ? 1 : 6) : 3); }
          }
        }
      }
    }

    // ---- The surface. Two sheets of ripples slide over each other; what is kept of each is
    // its slope, as how far (in dots) it bends the view of what lies below.
    const slopes = (sizeX, sizeY, salted) => {
      const h = sheet(sizeX, sizeY, salted, 1), gx = new Float32Array(dots), gy = new Float32Array(dots);
      let sum = 0;
      for (let l = 0, i = 0; l < lines; l++) {
        for (let c = 0; c < cols; c++, i++) {
          gx[i] = (h[l * cols + (c + 1) % cols] - h[l * cols + (c + cols - 1) % cols]) / ax;
          gy[i] = h[((l + 1) % lines) * cols + c] - h[((l + lines - 1) % lines) * cols + c];
          sum += gx[i] * gx[i] + gy[i] * gy[i];
        }
      }
      const k = (0.02 * U) / Math.sqrt(sum / dots); // scaled to bend the view by a fiftieth of U on average
      for (let i = 0; i < dots; i++) { gx[i] *= k; gy[i] *= k; }
      return [gx, gy];
    };
    const [bendAx, bendAy] = slopes(0.62, 0.45, 3), [bendBx, bendBy] = slopes(0.42, 0.36, 4);

    // Light gathered by the ripples into a net of bright lines on the bed: the edges between
    // scattered points, bent out of true, repeating across the screen like the sheets.
    const web = new Float32Array(dots);
    {
      const nx = lumps(0.42, W), ny = lumps(0.42, H), qx = new Float32Array(nx * ny), qy = new Float32Array(nx * ny);
      const warpX = sheet(0.5, 0.5, 5), warpY = sheet(0.5, 0.5, 6), fine = sheet(0.6, 0.6, 7), weight = new Float32Array(nx * ny);
      for (let k = 0; k < nx * ny; k++) {
        qx[k] = ((k % nx) + 0.1 + 0.8 * hash(k, salt + 61)) * (W / nx);
        qy[k] = (((k / nx) | 0) + 0.1 + 0.8 * hash(k, salt + 62)) * (H / ny);
        weight[k] = 0.75 + 0.5 * hash(k, salt + 63); // a point with less weight takes more room, and the edge between two bows toward the heavier
      }
      const line = Math.max(1.1, 0.04 * U);
      for (let l = 0, i = 0; l < lines; l++) {
        for (let c = 0; c < cols; c++, i++) {
          const X = (c + 0.5) * ax + (warpX[i] - 0.5) * 0.6 * U, Y = l + 0.5 + (warpY[i] - 0.5) * 0.6 * U;
          const ci = Math.floor((X / W) * nx), cj = Math.floor((Y / H) * ny);
          let near = 1e9, next = 1e9;
          for (let dj = -1; dj <= 1; dj++) {
            for (let di = -1; di <= 1; di++) {
              const wi = (((ci + di) % nx) + nx) % nx, wj = (((cj + dj) % ny) + ny) % ny, k = wj * nx + wi;
              const d = Math.hypot(X - qx[k] - ((ci + di - wi) / nx) * W, Y - qy[k] - ((cj + dj - wj) / ny) * H) * weight[k];
              if (d < near) { next = near; near = d; } else if (d < next) next = d;
            }
          }
          const edge = next - near;
          web[i] = ((1 - smooth(0, line, edge)) + 0.3 * (1 - smooth(0, 4 * line, edge))) * smooth(0.2, 0.65, fine[i]); // brighter in some places than others
        }
      }
    }
    const rough = sheet(0.3, 0.3, 8); // for edges that should not be clean
    const swell = sheet(1, 1, 10, 1); // broad and smooth: where the rings are pushed out of round
    const speckle = Float32Array.from({ length: dots }, (_, i) => hash(i, salt + 9)); // the order in which the dots go at the end

    // Where a dot of a sheet is taken from once the sheet has slid, or the view been bent: a
    // table for columns and one for rows, with M dots to spare at each end.
    const M = 2 * Math.max(4, Math.ceil(U * 0.12)), reach = M / 2;
    const colAt = new Int32Array(cols + 2 * M), rowAt = new Int32Array(lines + 2 * M); // the ground stays put, and is held at its edges
    for (let k = 0; k < colAt.length; k++) colAt[k] = Math.max(0, Math.min(cols - 1, k - M));
    for (let k = 0; k < rowAt.length; k++) rowAt[k] = Math.max(0, Math.min(lines - 1, k - M)) * cols;
    const slid = () => ({ col: new Int32Array(cols + 2 * M), row: new Int32Array(lines + 2 * M) });
    const slide = (at, dx, dy) => { // a sheet that has drifted dx dots across and dy down comes round again
      for (let k = 0; k < at.col.length; k++) at.col[k] = (((k - M - dx) % cols) + cols) % cols;
      for (let k = 0; k < at.row.length; k++) at.row[k] = ((((k - M - dy) % lines) + lines) % lines) * cols;
    };
    // Slide a sheet to where it is after s seconds at `down` U a second along the channel and
    // `aside` across it, having started dx dots across and dy down.
    const drift = (at, down, aside, s, dx = 0, dy = 0) => slide(at, dx + Math.round(((down * fx - aside * fy) * U * s) / ax), dy + Math.round((down * fy + aside * fx) * U * s));
    const atA = slid(), atB = slid(), atFlow = slid(), atSlow = slid();
    const FLOW = 0.12; // the speed of the current, in U a second of the story

    // Wavelets riding the current: short runs of ~ that catch the light and lose it again.
    // Each keeps its place across the channel and goes round and round along it.
    const course = W * fx + H * fy + 12 * ax; // as far as the screen reaches along the channel, and a little more
    const wavelets = [];
    for (let k = 0, count = Math.round(((course * 2 * wide) / (U * U)) * 9); k < count; k++) {
      wavelets.push({ a: rand() * course, b: R(-1, 1) * wide, n: 2 + ((rand() * 3) | 0), pace: R(0.85, 1.15), beat: R(2.5, 5), phase: rand(), shade: rand() < 0.25 });
    }

    // ---- The eye. Its picture is drawn afresh each frame, lids and lashes where they are at
    // that moment, into a patch of dots of its own; the water then shows it bent.
    const ex0 = Math.floor((cx - 1.36 * S) / ax), ey0 = Math.floor(cy - 0.9 * S) & ~1;
    const EW = Math.ceil((cx + 1.36 * S) / ax) - ex0, EH = (Math.ceil(cy + 0.68 * S) - ey0 + 1) & ~1;
    const eR = new Uint8ClampedArray(EW * EH), eG = new Uint8ClampedArray(EW * EH), eB = new Uint8ClampedArray(EW * EH), eA = new Uint8ClampedArray(EW * EH);
    const ballR = new Uint8ClampedArray(EW * EH), ballG = new Uint8ClampedArray(EW * EH), ballB = new Uint8ClampedArray(EW * EH);
    const fade = new Float32Array(EW * EH); // the reflection thins away from the eye
    const openU = new Float32Array(EW), openL = new Float32Array(EW), shutV = new Float32Array(EW), crease = new Float32Array(EW), thick = new Float32Array(EW);
    const lidU = new Float32Array(EW), lidL = new Float32Array(EW);
    const uOf = (x) => ((x + ex0 + 0.5) * ax - cx) / S, vOf = (y) => (y + ey0 + 0.5 - cy) / S;
    const HAIR = Math.max(0.05, 2 / S), RIM = Math.max(HAIR * 0.45, 1 / S); // how thick the upper lid's dark edge is at its thickest, and the lower lid's: never less than a dot or two
    for (let x = 0; x < EW; x++) {
      const u = uOf(x);
      openU[x] = upperOpen(u); openL[x] = lowerOpen(u); shutV[x] = shut(u);
      crease[x] = openU[x] - 0.04 - 0.11 * arch(u, 0, 0.5);
      thick[x] = HAIR * (0.3 + 0.7 * arch(u, 0.25, 0.4)) * (u > -1 && u < 1.08 ? 1 : 0);
      if (u >= 1) { openU[x] = shutV[x] = corners(1) - 0.3 * (u - 1); openL[x] = openU[x]; thick[x] = HAIR * 0.55 * clamp01((1.08 - u) / 0.08); } // the line runs on a little past the outer corner
    }
    for (let y = 0; y < EH; y++) {
      for (let x = 0; x < EW; x++) {
        const u = uOf(x), v = vOf(y), j = y * EW + x;
        fade[j] = 1 - smooth(0.62, 1, Math.hypot(u / 1.34, (v + 0.11) / 0.78));
        const du = (u - EYE.u) / EYE.r, dv = (v - EYE.v) / EYE.r, r = Math.hypot(du, dv);
        if (Math.hypot(du + 0.2, dv + 0.22) < 0.17) tone(shades('white'), 1, rgb);            // the light in the pupil,
        else if (Math.hypot(du - 0.34, dv - 0.3) < 0.085) tone(IRIS, 6, rgb);                 // and a smaller one opposite it
        else if (r < EYE.pupil) tone(DARK, 0, rgb);
        else if (r < 1) { // the iris: a dark rim, a pale ring round the pupil, and fibres running out between them
          const k = (r - EYE.pupil) / (1 - EYE.pupil), turn = Math.atan2(dv, du);
          const fibre = hash(Math.floor((turn + 4) * 9), salt + 31) - 0.5;
          const ring = k < 0.14 ? 1.5 : k < 0.5 ? lerp(4.6, 3.8, (k - 0.14) / 0.36) : k < 0.82 ? lerp(3.4, 2.5, (k - 0.5) / 0.32) : 0.7;
          tone(IRIS, Math.round(ring + fibre * (k < 0.14 || k > 0.82 ? 0 : 1.5) + 0.8 * k * (du + dv) / (r + 0.01)), rgb); // lit from the upper left, it glows at the lower right
        } else if (u < -0.83) tone(SKIN, 1.6, rgb);                                             // the pink in the inner corner
        else tone(BONE, Math.round(4.3 - 2 * smooth(0.4, 1, Math.abs(u)) - 0.6 * smooth(0, 0.25, v - EYE.v)), rgb); // the white, greyer toward the corners
        ballR[j] = rgb[0]; ballG[j] = rgb[1]; ballB[j] = rgb[2];
      }
    }
    // Lashes, on the upper lid only: short fine ticks. Where each grows, how far it leans
    // outward, how long it is. A lash is a dot wide, so there are as many as leave a few dots
    // between one and the next.
    const lashes = [], many = Math.max(8, Math.min(24, Math.round((1.83 * S) / ax / 3.6)));
    for (let k = 0; k < many; k++) {
      const u = lerp(-0.8, 1.03, k / (many - 1)) + R(-0.012, 0.012), along = (u + 1) / 2;
      lashes.push({ u, lean: lerp(-0.4, 1.05, along ** 1.2), long: (0.085 + 0.045 * arch(Math.min(0.99, u), 0.45, 1)) * R(0.85, 1.15) });
    }

    // A hair from (u, v), reaching du across and dv down and curling as it goes: a line one dot
    // wide, with no dot that only fills a corner.
    const hairX = new Int32Array(256), hairY = new Int32Array(256);
    function hair(u0, v0, du, dv, shade, alpha) {
      const steps = Math.min(600, Math.ceil(Math.hypot(du, dv) * S * 3) + 2);
      let n = 0;
      for (let k = 0; k <= steps && n < 255; k++) {
        const f = k / steps, x = Math.floor((cx + (u0 + du * f) * S) / ax) - ex0, y = Math.floor(cy + (v0 + dv * (0.4 * f + 0.6 * f * f)) * S) - ey0;
        if (n && hairX[n - 1] === x && hairY[n - 1] === y) continue;
        if (n > 1 && Math.abs(hairX[n - 2] - x) <= 1 && Math.abs(hairY[n - 2] - y) <= 1) n--; // the last dot was a corner: drop it
        hairX[n] = x; hairY[n++] = y;
      }
      for (let k = 0; k < n; k++) {
        const x = hairX[k], y = hairY[k], j = y * EW + x;
        if (x < 0 || x >= EW || y < 0 || y >= EH) continue;
        eR[j] = DARK[shade * 3]; eG[j] = DARK[shade * 3 + 1]; eB[j] = DARK[shade * 3 + 2]; eA[j] = Math.max(eA[j], alpha * Math.min(1, fade[j] * 3));
      }
    }

    // Draw the eye as open as `o` (0 shut, 1 open).
    function drawEye(o) {
      const up = smooth(0, 1, o), down = o * o;
      for (let x = 0; x < EW; x++) { lidU[x] = lerp(shutV[x], openU[x], up); lidL[x] = lerp(shutV[x], openL[x], down); }
      for (let y = 0, j = 0; y < EH; y++) {
        const v = vOf(y);
        for (let x = 0; x < EW; x++, j++) {
          const f = fade[j], above = lidU[x] - v, below = v - lidL[x], near = Math.min(1, f * 3); // how far outside each lid's edge
          if (f <= 0) { eA[j] = 0; continue; }
          if (above < 0 && below < 0) { // between the lids: the eyeball, in the shadow of the upper one
            const shadow = 0.55 + 0.45 * smooth(0, 0.13, -above);
            eR[j] = ballR[j] * shadow; eG[j] = ballG[j] * shadow; eB[j] = ballB[j] * (shadow * 0.9 + 0.1); eA[j] = 215 * near;
          } else if (above >= 0 && above < thick[x]) { // the dark edge the lashes grow from
            eR[j] = DARK[3]; eG[j] = DARK[4]; eB[j] = DARK[5]; eA[j] = 240 * near;
          } else if (below >= 0 && below < RIM && thick[x] > 0) { // the lower lid's edge, fainter
            eR[j] = SKIN[0]; eG[j] = SKIN[1]; eB[j] = SKIN[2]; eA[j] = 215 * near * clamp01(1.5 - Math.abs(uOf(x) - 0.25));
          } else { // skin: only a pale haze of it shows, with the fold of the upper lid drawn in
            const fold = v - crease[x], line = above >= 0 && Math.abs(fold) < HAIR * 0.35 && thick[x] > 0;
            const k = line ? 0.4 : above >= 0 ? (fold > 0 ? 3.8 : 3) : below < 0.06 ? 3.9 : 3.2;
            eR[j] = SKIN[0] + (SKIN[12] - SKIN[0]) * k / 4; eG[j] = SKIN[1] + (SKIN[13] - SKIN[1]) * k / 4; eB[j] = SKIN[2] + (SKIN[14] - SKIN[2]) * k / 4;
            eA[j] = (line ? 190 * up : above >= 0 && fold > 0 ? 130 : 80) * f;
          }
        }
      }
      const lift = lerp(-0.8, 1, up); // lashes hang down over a shut eye and turn up as it opens
      for (const h of lashes) {
        const x = Math.max(0, Math.min(EW - 1, Math.floor((cx + h.u * S) / ax) - ex0));
        hair(h.u, lidU[x] + thick[x] * 0.5, h.lean * h.long, -lift * h.long, 1, 240);
      }
    }

    // ---- The fish. All are one shape at different sizes, each swimming a straight line at its
    // own speed. The first swims up the middle of the channel, against the current, through the
    // middle of the pupil; the rest come after it, faster and more at a time.
    const SETTLED = 6.5; // how old the first one's wake is, in seconds of the story, when there is nothing of it left to see
    const FL = 1.15 * S, FB = 0.72 * FL, FW = 0.125 * S, FIN = 0.17 * S, SWAY = 0.09 * S, BEAT = 11.5; // the first one's length, its body's, half its girth, its fins, and how its tail beats
    const girth = new Float32Array(Math.ceil(FL) + 2), fork = new Float32Array(girth.length), finTip = new Float32Array(girth.length), finRoot = new Float32Array(girth.length);
    for (let a = 0; a < girth.length; a++) {
      const q = a / FB, p = (q - 0.22) / 0.34, v = (q - 0.68) / 0.18; // along the body, along the fins at the shoulder, along the smaller pair behind
      if (q < 1) {
        girth[a] = FW * (q < 0.3 ? Math.sqrt(1 - ((0.3 - q) / 0.3) ** 3) : 1 - 0.86 * ((q - 0.3) / 0.7) ** 0.9); // a blunt head, tapering to the tail
        if (p > 0 && p < 1) { finTip[a] = girth[a] + p * FIN; finRoot[a] = girth[a] + (Math.max(0, p - 0.45) / 0.55) * FIN; } // swept back like wings
        if (v > 0 && v < 1) { finTip[a] = girth[a] + v * 0.4 * FIN; finRoot[a] = girth[a] + (Math.max(0, v - 0.45) / 0.55) * 0.4 * FIN; }
      } else { // the tail fin, spread and forked
        const k = (a - FB) / (FL - FB);
        girth[a] = FW * (0.14 + 1.25 * k ** 0.8); fork[a] = Math.max(0, (k - 0.5) / 0.5) * FW * 1.4;
      }
    }
    // What part of a fish is at `a` back from its nose and `b` across, measured as on the first,
    // when the flank on the `lit` side faces the light: 0 none, 1 its dark back, 2 the lit flank,
    // 3 the other, 4 a fin, 5 the tail, 6 an eye.
    const fishAt = (a, b, phase, lit) => {
      if (a < 0 || a >= FL) return 0;
      const k = a / FL, off = b - SWAY * k * k * Math.sin(k * 5.2 - phase), across = Math.abs(off), i = a | 0; // the body bends in a wave that runs back along it
      if (across >= girth[i]) return across < finTip[i] && across >= finRoot[i] ? 4 : 0;
      if (a >= FB) return across >= fork[i] ? 5 : 0;
      if (k > 0.07 && k < 0.115 && across > girth[i] * 0.5 && across < girth[i] * 0.88) return 6;
      return off * lit > girth[i] * 0.5 ? 2 : off * lit < -girth[i] * 0.55 ? 3 : 1;
    };
    const FISH_TONE = [0, 1, 3, 0, 2, 1, 5]; // which shade of the ramp each part is

    // How far a line from (x, y) running (dx, dy) goes before it leaves the screen.
    const toEdge = (x, y, dx, dy) => Math.min(dx > 0 ? (W - x) / dx : dx < 0 ? -x / dx : Infinity, dy > 0 ? (H - y) / dy : dy < 0 ? -y / dy : Infinity);
    // A fish whose nose passes its mark (x, y) at t0 of the story, heading (hx, hy), z times the
    // size of the first and swimming `swim` dots a second of the story, with a wake `like` the
    // first one's or a follower's; `behind` and `ahead` are how much of its path is on screen
    // either side of the mark. passed(f, a) is when its tail leaves the point `a` along its path
    // from the mark, and its wake begins there.
    const fishes = [];
    const fish = (x, y, hx, hy, z, swim, t0, like = FOLLOW) => fishes.push({ x, y, hx, hy, nx: -hy, ny: hx, z, swim, t0, ...like, long: FL * z, lit: Math.sign(hy - hx) || 1, behind: toEdge(x, y, -hx, -hy), ahead: toEdge(x, y, hx, hy) });
    const passed = (f, a) => f.t0 + (a + f.long) / f.swim;
    const hx = -fx, hy = -fy, nx = -hy, ny = hx; // the first fish's way along its path, and across it
    const behind = toEdge(px, py, -hx, -hy), ahead = toEdge(px, py, hx, hy);
    const swim = (behind + ahead + FL) / DART;
    fish(px, py, hx, hy, 1, swim, T.strike, { quick: 1, spread: 1, stir: 1, narrow: 1, last: SETTLED });
    const first = fishes[0];

    // ---- The wakes. A train of ripples leaves each fish's path on either side, like a boat's,
    // and the water it went through is left churned, all of it by how long ago the fish went
    // by. Whirls turn in the first one's wake, and rings spread from the pupil, where it broke
    // the reflection, for as long as the film lasts.
    const WAVE_LENGTH = 0.2 * S, LEAD = 2.7 * WAVE_LENGTH * 2, PACKET = Math.ceil(3.2 * WAVE_LENGTH * 2) + 2;
    const push = new Float32Array(PACKET), crest = new Float32Array(PACKET); // a train of three waves: its slope and its height, in half dots behind the front
    for (let k = 0; k < PACKET; k++) {
      const x = (k / 2) / WAVE_LENGTH - 2.7, body = Math.exp(-(((x + 0.75) / 1.1) ** 2));
      push[k] = -Math.sin(x * 2 * Math.PI) * body; crest[k] = Math.cos(x * 2 * Math.PI) * body;
    }
    const AGES = 300, PER = 20; // tables by age, in twentieths of a second of the story
    const wakeFront = new Float32Array(AGES), wakeSlope = new Float32Array(AGES), wakeRise = new Float32Array(AGES);
    const churnWide = new Float32Array(AGES), churnMight = new Float32Array(AGES), damage = new Float32Array(AGES), dragged = new Float32Array(AGES);
    for (let k = 0; k < AGES; k++) {
      const age = (k + 0.5) / PER, might = Math.min(1, age / 0.12) * Math.exp(-age / 1.8);
      wakeFront[k] = 0.9 * S * (1 - Math.exp(-age / 2.5));
      wakeSlope[k] = 0.04 * S * might; wakeRise[k] = 0.9 * might;
      churnWide[k] = 1 / (S * (0.1 + 0.3 * (1 - Math.exp(-age / 2))));
      churnMight[k] = 5 * Math.min(1, age / 0.2) * Math.exp(-age / 1.7);
      damage[k] = S * (0.05 + 0.42 * age + 0.14 * age * age);
      dragged[k] = 0.36 * S * (1 - Math.exp(-age / 0.3));
    }
    const BELL = Float32Array.from({ length: 65 }, (_, k) => Math.exp(-k / 8)); // exp(-x), for x up to 8, in eighths
    const RIPPLE = Math.max(4, 0.36 * S), RIPPLE_SPEED = 0.6 * S; // the rings: from one crest to the next, and how fast they spread, in dots a second of the story
    const WAVER = 0.5 * TURN; // how far the swell pushes the rings out of round, in turns of a ring's wave
    const ringTall = new Float32Array(Math.ceil(Math.hypot(W, H)) + 2), ringSteep = new Float32Array(ringTall.length); // by how far from their middle, in dots: how high the rings stand this frame, and how far they bend the view
    const ringX = (s) => px + 0.6 * FLOW * U * fx * Math.max(0, s - passed(first, 0)), ringY = (s) => py + 0.6 * FLOW * U * fy * Math.max(0, s - passed(first, 0)); // their middle rides downstream, more slowly than the current
    // How strongly rings are sent out at time t of the story: a burst where the first fish broke
    // the reflection, which settles but never quite dies, and a stronger one, kept up, once the
    // shoal is churning the spot. A ring keeps the strength it was sent out with as it spreads.
    const source = (t) => {
      const a = t - passed(first, 0);
      return a <= 0 ? 0 : Math.min(1, a / 0.3) * (0.45 + 0.55 * Math.exp(-a / 2.4)) + CHURN * smooth(T.shoal, T.shoal + 0.6, t);
    };
    const whirls = [[-0.5, 0.3], [0.04, -0.32], [0.55, 0.27]].map(([a, b], k) => ({
      x: px + (hx * a + nx * b) * S, y: py + (hy * a + ny * b) * S, t0: passed(first, a * S), spin: k % 2 ? 1 : -1,
      cos: new Float32Array(65), sin: new Float32Array(65), armCos: new Float32Array(65), armSin: new Float32Array(65), arm: new Float32Array(65), cx: 0, cy: 0, r2: 1, on: false,
    }));

    // The fish that follow, each faster than the first: one, in a lane toward a bank, going the
    // same way; then two or three together, in neighbouring lanes a moment apart, going with
    // the current; then a shoal from both ends at once, each crossing close to where the eye
    // was, on a slant that keeps it in the water.
    const school = mulberry32(seed * 7919 + 13), Z = (a, b) => a + (b - a) * school();
    const lane = (b) => [W / 2 - fy * b, H / 2 + fx * b]; // on the middle of the channel, moved b dots toward the lower bank
    {
      const [x, y] = lane((school() < 0.5 ? -0.4 : 0.4) * wide);
      fish(x, y, hx, hy, Z(0.75, 0.9), swim * Z(1.3, 1.45), T.single);
    }
    for (let k = 0, n = school() < 0.5 ? 2 : 3; k < n; k++) {
      const [x, y] = lane((lerp(-0.3, 0.3, k / (n - 1)) + Z(-0.06, 0.06)) * wide);
      fish(x, y, fx, fy, Z(0.6, 0.8), swim * Z(1.45, 1.7), T.group + k * 0.28 + Z(-0.06, 0.06));
    }
    for (let k = 0, dir = school() < 0.5 ? 1 : -1; k < SHOAL; k++, dir = -dir) {
      const t0 = T.shoal + k * 0.15 + Z(-0.05, 0.05), b = Z(-0.22, 0.22) * S, x = ringX(t0) - fy * b, y = ringY(t0) + fx * b;
      const room = Math.asin(clamp01((0.5 * wide - Math.abs(offMiddle(x, y))) / Math.max(toEdge(x, y, fx, fy), toEdge(x, y, -fx, -fy))));
      const turn = Math.max(-room, Math.min(room, Z(-0.14, 0.14))), along = Math.cos(turn) * dir, aside = Math.sin(turn) * dir;
      fish(x, y, fx * along - fy * aside, fy * along + fx * aside, Z(0.5, 0.75), swim * Z(1.6, 2.1), t0);
    }
    const bubbles = [];
    for (const f of fishes) {
      for (let k = 0, count = Math.round(((f.behind + f.ahead) / S) * (f === first ? 14 : 3)); k < count; k++) {
        const a = R(-f.behind, f.ahead), b = (rand() + rand() - 1) * 0.2 * S * f.z;
        bubbles.push({ x: f.x + f.hx * a + f.nx * b, y: f.y + f.hy * a + f.ny * b, t0: passed(f, a) + R(-0.2, 0.5), life: R(0.5, 2) / f.quick, kind: rand() });
      }
    }

    // ---- What a frame is worked out in.
    const gX = new Float32Array(dots), gY = new Float32Array(dots), rise = new Float32Array(dots); // the surface at each dot: its slope, and how far the wake lifts it
    const fR = new Uint8ClampedArray(dots), fG = new Uint8ClampedArray(dots), fB = new Uint8ClampedArray(dots); // the picture, in full colour
    const cover = new Uint8Array(dots); // how much of each dot the reflection hides
    const roil = new Int32Array(cols); // where, across the sheet of ripples, the churned water of each column takes its tumbling from
    const bend = (g) => (g > reach ? reach : g < -reach ? -reach : Math.round(g));

    // The surface: the two sheets of ripples, then everything the fish have done to it.
    function surface(s) {
      drift(atA, 0.16, 0.02, s); drift(atB, 0.07, -0.03, s);
      for (let l = 0, i = 0; l < lines; l++) {
        const ra = atA.row[l + M], rb = atB.row[l + M];
        for (let c = 0; c < cols; c++, i++) {
          const ka = ra + atA.col[c + M], kb = rb + atB.col[c + M], w = wet[i];
          gX[i] = (bendAx[ka] + bendBx[kb]) * w; gY[i] = (bendAy[ka] + bendBy[kb]) * w;
        }
      }
      rise.fill(0);
      for (let c = 0; c < cols; c++) roil[c] = atA.col[((c * 2 + 5) % cols) + M];
      for (const f of fishes) wake(f, s);
      rings(s);
      for (const w of whirls) whirl(w, s);
    }

    // Fish f's wake, worked out only in the band of water it can reach: from where the fish
    // came on screen to where its tail is now, and no further to either side than the oldest
    // part of it has spread.
    function wake(f, s) {
      const since = s - passed(f, 0), tail = f.swim * since, last = f.last / f.quick; // how long ago its tail left its mark, how far past the mark it is now, and how long its wake lasts
      if (tail < -f.behind || since - f.ahead / f.swim > last) return; // not on screen yet, or long since settled
      const aLo = Math.max(-f.behind, tail - last * f.swim) - 1, aHi = Math.min(f.ahead, tail) + 1, narrow = f.narrow, spread = f.spread, stir = f.stir * f.z;
      const old = Math.min(AGES - 1, ((since - aLo / f.swim) * f.quick * PER) | 0), side = f.z * Math.max(spread * wakeFront[old] + 0.1 * S + 2, 2 / (narrow * churnWide[old]));
      const { x: mx, y: my, hx: ux, hy: uy, nx: vx, ny: vy, z } = f, toZ = 1 / z, slow = (f.quick * PER) / f.swim; // slow: how much older the wake is a dot further back, in steps of the tables
      const ys = [my + uy * aLo - vy * side, my + uy * aLo + vy * side, my + uy * aHi - vy * side, my + uy * aHi + vy * side];
      const l0 = Math.max(0, Math.floor(Math.min(...ys))), l1 = Math.min(lines - 1, Math.ceil(Math.max(...ys)));
      for (let l = l0; l <= l1; l++) {
        const dy = l + 0.5 - my, rc = atB.row[((l * 2 + 7) % lines) + M];
        let lo = (aLo - dy * uy) / ux, hi = (aHi - dy * uy) / ux; // the stretch of this line within the band, from the fish's mark
        if (lo > hi) [lo, hi] = [hi, lo];
        if (Math.abs(vx) > 1e-4) {
          const p = (-side - dy * vy) / vx, q = (side - dy * vy) / vx;
          lo = Math.max(lo, Math.min(p, q)); hi = Math.min(hi, Math.max(p, q));
        } else if (Math.abs(dy * vy) > side) continue;
        const c0 = Math.max(0, Math.floor((mx + lo) / ax)), c1 = Math.min(cols - 1, Math.ceil((mx + hi) / ax)), dx0 = (c0 + 0.5) * ax - mx;
        let b = dx0 * vx + dy * vy, step = (since * f.quick * PER) - (dx0 * ux + dy * uy) * slow; // across the path, and the wake's age in steps of the tables, at the first dot of the stretch
        for (let c = c0, i = l * cols + c0; c <= c1; c++, i++, b += ax * vx, step -= ax * ux * slow) {
          const deep = wet[i];
          if (deep === 0 || step <= 0) continue;
          const k = step < AGES ? step | 0 : AGES - 1, out = (b < 0 ? -b : b) * toZ, n = ((out - spread * wakeFront[k]) * 2 + LEAD) | 0, e = out * narrow * churnWide[k], e2 = e * e * 8;
          let x = 0, y = 0;
          if (n >= 0 && n < PACKET) { const g = wakeSlope[k] * push[n] * (b < 0 ? -z : z); x = vx * g; y = vy * g; rise[i] += wakeRise[k] * crest[n] * z * deep; }
          if (e2 < 32) { const churn = churnMight[k] * BELL[e2 | 0] * stir, kc = rc + roil[c]; x += bendBx[kc] * churn; y += bendBy[kc] * churn; }
          gX[i] += x * deep; gY[i] += y * deep;
        }
      }
    }

    // The rings, out to the first of them. Each keeps the strength it was sent out with.
    function rings(s) {
      const since = s - passed(first, 0);
      if (since <= 0) return;
      const front = RIPPLE_SPEED * since, rx = ringX(s), ry = ringY(s), reach2 = Math.min(front, ringTall.length - 1) ** 2;
      for (let n = 0; n < ringTall.length && n < front + 1; n++) {
        const k = (source(s - n / RIPPLE_SPEED) * clamp01((front - n) / RIPPLE)) / Math.sqrt(1 + n / (0.8 * S));
        ringTall[n] = 0.95 * k; ringSteep[n] = (0.06 * S * k) / (n + 0.5);
      }
      for (let l = 0; l < lines; l++) {
        const dy = l + 0.5 - ry, room = reach2 - dy * dy;
        if (room <= 0) continue;
        const half = Math.sqrt(room), c1 = Math.min(cols - 1, Math.ceil((rx + half) / ax));
        for (let c = Math.max(0, Math.floor((rx - half) / ax)), i = l * cols + c; c <= c1; c++, i++) {
          const deep = wet[i], dx = (c + 0.5) * ax - rx, d2 = dx * dx + dy * dy;
          if (deep === 0 || d2 >= reach2) continue;
          const d = Math.sqrt(d2), n = d | 0, turn = ((d - front) * (TURN / RIPPLE) + (swell[i] - 0.5) * WAVER) & (TURN - 1), g = ringSteep[n] * SIN[turn] * deep;
          gX[i] -= dx * g; gY[i] -= dy * g; rise[i] += ringTall[n] * COS[turn] * deep;
        }
      }
    }

    // A whirl in the first fish's wake: it drifts with the current, and two arms wind round it.
    function whirl(w, s) {
      const age = s - w.t0, core = S * (0.26 + 0.2 * (1 - Math.exp(-age / 2))), turned = Math.min(1, age / 0.5) * Math.exp(-age / 2.4);
      w.on = age > 0 && age < SETTLED;
      if (!w.on) return;
      w.cx = w.x + FLOW * U * fx * age; w.cy = w.y + FLOW * U * fy * age; w.r2 = 16 / (core * core);
      for (let k = 0; k < 65; k++) {
        const far = Math.sqrt(k / 16), twist = 2.4 * (1 - Math.exp(-age / 1.1)) * w.spin * Math.exp(-k / 16), arm = w.spin * (2.6 * far - 1.3 * age);
        w.cos[k] = Math.cos(twist); w.sin[k] = Math.sin(twist); w.armCos[k] = Math.cos(arm); w.armSin[k] = Math.sin(arm);
        w.arm[k] = 0.85 * turned * (k / 16) * Math.exp(1 - k / 16); // strongest at the edge of the core, nothing at its middle
      }
      const r = 2 * core, c1 = Math.min(cols - 1, Math.ceil((w.cx + r) / ax)), l1 = Math.min(lines - 1, Math.ceil(w.cy + r));
      for (let l = Math.max(0, Math.floor(w.cy - r)); l <= l1; l++) {
        for (let c = Math.max(0, Math.floor((w.cx - r) / ax)), i = l * cols + c; c <= c1; c++, i++) {
          const deep = wet[i], wx = (c + 0.5) * ax - w.cx, wy = l + 0.5 - w.cy, w2 = wx * wx + wy * wy, n = (w2 * w.r2) | 0;
          if (deep === 0 || n >= 64) continue;
          const ex = wx * w.armCos[n] - wy * w.armSin[n], ey = wx * w.armSin[n] + wy * w.armCos[n];
          rise[i] += ((w.arm[n] * (ex * ex - ey * ey)) / (w2 + 1e-6)) * deep; // two arms, wound round the middle
        }
      }
    }

    // The ground: the banks as they are, the bed seen through the bent surface with the net
    // of light lying on it.
    function bed(s) {
      drift(atFlow, FLOW, 0, s);
      drift(atSlow, 0.7 * FLOW, 0.03, s, cols >> 1, (lines / 3) | 0);
      for (let l = 0, i = 0; l < lines; l++) {
        for (let c = 0; c < cols; c++, i++) {
          const deep = wet[i];
          if (deep === 0) { fR[i] = bedR[i]; fG[i] = bedG[i]; fB[i] = bedB[i]; continue; }
          const ox = bend(gX[i] / ax), oy = bend(gY[i]), k = rowAt[l + M + oy] + colAt[c + M + ox];
          const wx = bend((gX[i] * 4) / ax), wy = bend(gY[i] * 4); // the net sways much further than the bed seems to
          const glow = (web[atFlow.row[l + M + wy] + atFlow.col[c + M + wx]] + 0.5 * web[atSlow.row[l + M - wy] + atSlow.col[c + M - wx]]) * deep;
          fR[i] = bedR[k] * (1 + 0.34 * glow) + 22 * glow; fG[i] = bedG[k] * (1 + 0.34 * glow) + 19 * glow; fB[i] = bedB[k] * (1 + 0.3 * glow) + 9 * glow;
        }
      }
    }

    // The reflection: the eye's picture, looked up through the bent surface and, once the fish
    // has been through, through water that has been dragged, twisted and broken up.
    function reflect(s, see) {
      const since = s - passed(first, 0), struck = since + (1.4 * S) / swim > 0, margin = struck ? Math.ceil(0.5 * S) : M;
      const c0 = Math.max(0, ex0 - margin), c1 = Math.min(cols, ex0 + EW + margin), l0 = Math.max(0, ey0 - margin), l1 = Math.min(lines, ey0 + EH + margin);
      for (let l = l0; l < l1; l++) {
        const rr = atFlow.row[l + M];
        for (let c = c0; c < c1; c++) {
          const i = l * cols + c;
          let qx = (c + 0.5) * ax + gX[i] * 1.3, qy = l + 0.5 + gY[i] * 1.3, keep = see * wet[i];
          if (struck) {
            const a = (qx - px) * hx + (qy - py) * hy, b = (qx - px) * nx + (qy - py) * ny, age = since - a / swim;
            if (age > 0) {
              const k = age * PER < AGES ? (age * PER) | 0 : AGES - 1, deep = (damage[k] - (b < 0 ? -b : b)) / (0.7 * S); // how long ago the damage reached here
              if (deep > 0) {
                keep *= 1 - smooth(0.1, 1, deep + (rough[rr + atFlow.col[c + M]] - 0.5) * 0.8);
                if (keep < 0.02) continue;
              }
              const pull = dragged[k] * BELL[Math.min(64, ((b * b) / (0.03 * S * S)) * 8) | 0]; // dragged along behind the fish
              qx -= hx * pull; qy -= hy * pull;
            }
            for (let k = 0; k < whirls.length; k++) {
              const w = whirls[k];
              if (!w.on) continue;
              const dx = qx - w.cx, dy = qy - w.cy, n = ((dx * dx + dy * dy) * w.r2) | 0;
              if (n >= 64) continue;
              qx = w.cx + dx * w.cos[n] - dy * w.sin[n]; qy = w.cy + dx * w.sin[n] + dy * w.cos[n];
            }
          }
          const x = Math.floor(qx / ax) - ex0, y = Math.floor(qy) - ey0;
          if (x < 0 || x >= EW || y < 0 || y >= EH) continue;
          const j = y * EW + x, k = (eA[j] * keep) / 255;
          if (k <= 0) continue;
          fR[i] += (eR[j] - fR[i]) * k; fG[i] += (eG[j] - fG[i]) * k; fB[i] += (eB[j] - fB[i]) * k;
          cover[i] = k * 255;
        }
      }
    }

    // The fish, over everything, each with its shadow on the bed below and to the right of it.
    // Asked for their characters instead, it sets those: the scales on their bodies.
    function swimmer(s, characters) {
      for (const f of fishes) {
        const nose = f.swim * (s - f.t0);
        if (nose < -f.behind - 2 || nose > f.ahead + f.long + 2) continue;
        const fishX = f.x + f.hx * nose, fishY = f.y + f.hy * nose, phase = s * BEAT + f.t0 * 5, drop = 0.12 * S, toZ = 1 / f.z; // tails out of step with each other
        const mx = fishX - (f.hx * f.long) / 2, my = fishY - (f.hy * f.long) / 2, half = (FL / 2 + FIN + FW + drop) * f.z;
        const c0 = Math.max(0, Math.floor((mx - half) / ax)), c1 = Math.min(cols - 1, Math.ceil((mx + half) / ax));
        const l0 = Math.max(0, Math.floor(my - half)), l1 = Math.min(lines - 1, Math.ceil(my + half));
        const shadeA = drop * (f.hx + f.hy), shadeB = -drop * (f.nx + f.ny); // where the fish is that throws a shadow on a dot, in its own measure
        if (characters) {
          for (let r = l0 >> 1; r <= l1 >> 1; r++) {
            for (let c = c0; c <= c1; c++) {
              const X = (c + 0.5) * ax - fishX, Y = r * 2 + 1 - fishY, a = -(X * f.hx + Y * f.hy), part = fishAt(a * toZ, (X * f.nx + Y * f.ny) * toZ, phase, f.lit), i = r * cols + c;
              if (!part) continue;
              glyph[i] = 32; bold[i] = 0;
              if (part < 4 && (((a / ax) | 0) + r) % 2 === 0) { glyph[i] = SHUT; ink[i] = AT.fish + (part === 2 ? 5 : 3); } // scales, every other cell
            }
          }
          continue;
        }
        for (let l = l0; l <= l1; l++) {
          for (let c = c0; c <= c1; c++) {
            const X = (c + 0.5) * ax - fishX, Y = l + 0.5 - fishY, a = -(X * f.hx + Y * f.hy) * toZ, b = (X * f.nx + Y * f.ny) * toZ, part = fishAt(a, b, phase, f.lit), i = l * cols + c;
            if (part) { const k = FISH_TONE[part] * 3; fR[i] = FISH[k]; fG[i] = FISH[k + 1]; fB[i] = FISH[k + 2]; cover[i] = 255; }
            else if (fishAt(a + shadeA, b + shadeB, phase, f.lit)) { fR[i] *= 0.6; fG[i] *= 0.62; fB[i] *= 0.68; }
          }
        }
      }
    }

    // Set the picture in the palette, with the shine of the surface on it. At the end the
    // rings take it away: the page shows in the trough of each, a little more of every ring
    // that passes, sooner near their middle than far from it, until the crests go too.
    function set(s) {
      const gone = (s - T.clear) / (T.end - T.clear), rx = ringX(s), ry = ringY(s), front = RIPPLE_SPEED * (s - passed(first, 0));
      const far = Math.hypot(Math.max(rx, W - rx), Math.max(ry, H - ry));
      for (let l = 0, i = 0; l < lines; l++) {
        const Y = l + 0.5 - ry;
        for (let c = 0; c < cols; c++, i++) {
          const up = rise[i], grain = BAYER[((l & 3) << 2) | (c & 3)];
          let shine = ((gX[i] + gY[i]) / U) * 3.2 + (up > 0.22 ? (up - 0.22) * 1.2 : up < -0.3 ? (up + 0.3) * 0.5 : 0);
          if (gone > 0) {
            const X = (c + 0.5) * ax - rx, d = Math.sqrt(X * X + Y * Y), q = gone * (1 + LAG) - (LAG * d) / far; // how much of each ring has gone here
            if (q >= 1) continue;
            if (q > 0) {
              const turn = ((d - front) * (TURN / RIPPLE) + (swell[i] - 0.5) * WAVER) & (TURN - 1), crest = Math.abs(turn - TURN / 2) / (TURN / 2); // 0 at the bottom of a trough, 1 on a crest
              if (crest + 1 - 2 * q < speckle[i]) continue; // stippled: a few dots at the bottom of each trough at first, then more, up its sides
              shine += 0.15 * q * COS[turn]; // what is left of a ring is its crest, catching the light
            }
          }
          const d = (grain - 7.5) * GRAIN;
          let r = fR[i] + d, g = fG[i] + d, b = fB[i] + d;
          if (shine > 0) { const a = shine > 0.8 ? 0.8 : shine; r += (255 - r) * a; g += (250 - g) * a; b += (232 - b) * a; }
          else { const a = shine < -0.4 ? 0.6 : 1 + shine; r *= a; g *= a; b *= a; }
          const key = ((r < 0 ? 0 : r > 255 ? 255 : r) >> 3 << 10) | ((g < 0 ? 0 : g > 255 ? 255 : g) >> 3 << 5) | ((b < 0 ? 0 : b > 255 ? 255 : b) >> 3);
          paint[i] = NEAREST[key] || match(key);
        }
      }
    }

    // The characters: tufts and grains on the ground, the water's edge, wavelets riding the
    // current, the crests of the wakes and the rings, the bubbles, and the scales of the fish.
    function marks(s) {
      for (let i = 0; i < cells; i++) {
        const top = ((i / cols) | 0) * cols + i; // the dot that is the cell's upper half
        if (bedGlyph[i] && cover[top] < 70 && cover[top + cols] < 70) { glyph[i] = bedGlyph[i]; ink[i] = bedInk[i]; }
      }
      for (const q of brink) { // the edge laps: each stretch of it shows and goes
        const light = Math.sin(Math.PI * ((s / 3 + q.phase) % 1)) ** 2;
        if (light > 0.3) { glyph[q.i] = q.glyph; ink[q.i] = light > 0.75 ? AT.white : AT.sand + 9; }
      }
      for (const w of wavelets) {
        const light = Math.sin(Math.PI * ((s / w.beat + w.phase) % 1)) ** 2;
        if (!w.shade && light < 0.3) continue;
        const a = ((w.a + FLOW * U * w.pace * s) % course) - course / 2, r = Math.floor((H / 2 + a * fy + w.b * fx) / 2), c0 = Math.floor((W / 2 + a * fx - w.b * fy) / ax);
        if (r < 0 || r >= rows) continue;
        for (let c = Math.max(0, c0); c < Math.min(cols, c0 + w.n); c++) {
          const i = r * cols + c, top = r * 2 * cols + c;
          if (wet[top] < 0.5 || (w.shade && cover[top] > 70)) continue;
          glyph[i] = WAVE; ink[i] = w.shade ? AT.sand + 1 : light > 0.7 ? AT.white : AT.sand + 8; bold[i] = !w.shade && light > 0.7 ? 1 : 0;
        }
      }
      const high = (c, r) => (c < 0 || c >= cols || r < 0 || r >= rows ? 0 : Math.max(rise[r * 2 * cols + c], rise[(r * 2 + 1) * cols + c]));
      if (s > passed(first, -behind)) {
        for (let r = 0; r < rows; r++) { // a crest of the wake is drawn in the characters that lie along it
          for (let c = 0; c < cols; c++) {
            const h = high(c, r), i = r * cols + c;
            if (h < 0.45 || hash(c + salt, r + 7) < 0.4) continue;
            const flat = high(c - 2, r) + high(c + 2, r), steep = high(c, r - 1) + high(c, r + 1), fall = high(c - 2, r - 1) + high(c + 2, r + 1), climbs = high(c + 2, r - 1) + high(c - 2, r + 1);
            const most = Math.max(flat, steep, fall, climbs);
            if (most === flat) { if (h < high(c, r - 1) || h < high(c, r + 1)) continue; glyph[i] = WAVE; }
            else if (most === steep) { if (h < high(c - 1, r) || h < high(c + 1, r)) continue; glyph[i] = high(c + 2, r - 1) + high(c + 2, r + 1) > high(c - 2, r - 1) + high(c - 2, r + 1) ? OPEN : SHUT; }
            else glyph[i] = most === fall ? BACK : SLASH;
            ink[i] = AT.white; bold[i] = h > 0.8 ? 1 : 0;
          }
        }
      }
      for (const q of bubbles) {
        const age = s - q.t0;
        if (age <= 0 || age >= q.life) continue;
        const c = Math.floor((q.x + FLOW * U * fx * age) / ax), r = Math.floor((q.y + FLOW * U * fy * age) / 2), i = r * cols + c;
        if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
        const k = age / q.life;
        glyph[i] = k > 0.8 ? DOT : q.kind < 0.3 ? BIG : q.kind < 0.75 ? BEAD : STAR; ink[i] = AT.white + (k < 0.4 ? 1 : 0); bold[i] = k < 0.4 ? 1 : 0;
      }
      swimmer(s, true);
      if (s > T.clear) for (let i = 0; i < cells; i++) { // no character is left standing on the page
        const top = ((i / cols) | 0) * cols + i;
        if (!paint[top] || !paint[top + cols]) glyph[i] = 32;
      }
    }

    return {
      cols, rows, palette: PALETTE, glyph, ink, bold, paint,
      render(t) { // t: seconds since the film started
        glyph.fill(32); ink.fill(0); bold.fill(0); paint.fill(0);
        if (t >= LENGTH) return this; // over: an empty frame, so the page shows
        const s = t * SPEED, see = 0.9 * smooth(T.appear, T.part + 0.9, s) * (1 - smooth(T.gone - 0.8, T.gone, s));
        cover.fill(0);
        surface(s);
        bed(s);
        if (see > 0) { drawEye(smooth(T.part, T.open, s)); reflect(s, see); }
        swimmer(s, false);
        set(s);
        marks(s);
        return this;
      },
    };
  }

  const film = { length: LENGTH, still: 1.65, grid: [150, 60], createScene }; // still: the open eye, with the first fish darting at it
  return { play: (options) => AsciiStage.play(film, options), createScene };
})();
