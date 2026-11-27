/*
 * The parting waves: an ASCII loading screen.
 *
 *   <script src="ascii-stage.js"></script>
 *   <script src="parting-waves.js"></script>
 *   <script>PartingWaves.play().then(showThePage);</script>
 *
 * A painting in deep indigo, violet, navy and black, with white and pale
 * lavender surf, deep blue robes and soft gold light. In the upper left the
 * rings of a vast celestial machine turn slowly, neighbours in opposite
 * directions. In front of them a colossal figure floats in the sky: deep blue
 * robes streaming left in long ribbons that ripple as if under water, a gold
 * halo behind a head whose face cannot be made out, and a very long staff held
 * across the body, its lower end glowing gold. Great swirls of surf and cloud
 * churn across the middle and the right, dark smoke billows above them, and on
 * the dark water below, among blue flowers, broken pillars and upright swords,
 * a small boat with a curled prow carries a few dark figures and one warm
 * light. The figure raises the staff, its tip brightening, and sweeps it over
 * in one arc to point at the waves. They split along a line ahead of the boat,
 * one half curling up toward the top and the other toward the right edge, and
 * a wide, calm channel lit soft gold-white opens between them. The camera
 * drifts right, and the boat glides into the light. Then the waves billow out
 * into lavender-white cloud that rolls over the frame from the top and the
 * right, around the boat and past it, and thins away to the page, the boat's
 * light last. Five seconds (LENGTH, below).
 *
 * The scene is set out in the source image's frame, in frame heights. The
 * camera only drifts sideways, so each thing is a flat layer at its own
 * distance that slides the less the farther off it is, and the water is a
 * layer to each row, the nearer the faster. The whole film is a pure function
 * of time: createScene().render(t) fills a grid of characters and the colours
 * behind them, and the stage (ascii-stage.js) paints that grid on a canvas.
 */
const PartingWaves = (() => {
  'use strict';
  const { code, clamp01, lerp, smooth, mulberry32, hash, noise } = AsciiStage;

  // The story's timeline, in the seconds of the user's description, with the
  // handover to the page after it.
  const T = {
    raise: 2.0,  // the figure starts to raise its staff, and the glow at the tip brightens
    sweep: 4.0,  // it sweeps the staff over in one arc
    part: 5.0,   // the tip points at the waves: they split, and the camera starts to drift right
    glide: 7.5,  // the boat glides into the lit channel
    hold: 9.5,   // it is in the middle of the channel, and the figure holds its pose
    billow: 9.9, // the waves billow out into cloud that rolls over the frame
    thin: 10.6,  // the cloud thins away to the page, the boat's light last
    end: 11.3,
  };
  // It is played faster than that. LENGTH is how many seconds the whole of it
  // takes on screen, and SPEED how many times faster than the story that is.
  const LENGTH = 5, SPEED = T.end / LENGTH;

  // The source image's frame, in frame heights: x across from its left edge,
  // y down from its top. It is 16:9. A wider screen sees more of the world to
  // either side; a narrower one keeps KEEP across its width (the raised staff,
  // the halo, the boat and the parting) and sees more sky above and more
  // water below.
  const WIDE = 16 / 9;
  const HZ = 0.765; // the horizon, where the waves stand on the water
  const KEEP = [0.3, 1.34];
  const DEG = Math.PI / 180;

  // The camera holds, then drifts right at an even pace. Drifting camX slides a
  // layer D boat-distances off camX / D to the left; the water is a layer to
  // each row, the nearer the faster.
  const D_RINGS = 6, D_SMOKE = 4, D_GIANT = 2.4, D_WAVES = 1.6;
  const DRIFT = 0.026; // frame heights a story second
  const camAt = (s) => { const w = Math.max(0, s - T.part), e = 0.4; return DRIFT * (w < e ? (w * w) / (2 * e) : w - e / 2); };
  const BILLOW = 0.012; // frame heights a second (on the screen) that the smoke's two layers creep opposite ways

  // The boat: the middle of its waterline (across, down) and its length. It
  // glides at GLIDE through the channel, then slows to the camera's pace.
  const BOAT = [0.755, 0.855, 0.23];
  const GLIDE = 0.11;
  function sailed(s) { // how far it has come by story time s
    const e = 0.35, w = s - T.glide, steady = T.hold - T.glide, k = 0.6;
    if (w <= 0) return 0;
    if (w < e) return (GLIDE * w * w) / (2 * e);
    if (w < steady) return GLIDE * (w - e / 2);
    const a = Math.min(k, w - steady);
    return GLIDE * (steady - e / 2) + GLIDE * a + ((DRIFT - GLIDE) * a * a) / (2 * k) + DRIFT * Math.max(0, w - steady - k);
  }

  // The staff, held at story time s: the hand (across, down), the way it
  // points from the hand to the glowing tip (degrees, y down: 90 is straight
  // down, 180 left, 270 up), and its length to the tip. On the way over the
  // top it swings through depth, so it looks shorter there (OVER), and the
  // hand comes down as it goes over, keeping the tip in the frame.
  const STAFF = 0.48, BUTT = 0.05, OVER = 0.21;
  const REST = [0.795, 0.18, 114], RAISED = [0.79, 0.17, 212], STRUCK = [0.82, 0.24, 395];
  const SHOULDER = [0.722, 0.322];
  function staffAt(s, out) {
    const k = s < T.sweep ? smooth(T.raise, T.sweep, s) : smooth(T.sweep, T.part, s), [p, q] = s < T.sweep ? [REST, RAISED] : [RAISED, STRUCK];
    const a = lerp(p[2], q[2], k) * DEG, up = Math.max(0, -Math.sin(a)), gx = lerp(p[0], q[0], k), gy = Math.max(lerp(p[1], q[1], k), OVER * up + 0.012);
    out[0] = gx; out[1] = gy; out[2] = a;
    out[3] = gx + STAFF * Math.cos(a); out[4] = gy + (up > 0 ? OVER : STAFF) * Math.sin(a); // the tip
    return out;
  }
  // How bright the tip glows: it brightens as the staff rises.
  const glowAt = (s) => 0.45 + 0.55 * smooth(T.raise, T.sweep, s) - 0.15 * smooth(T.part + 0.5, T.glide, s);

  // The split: a line from just ahead of the boat's prow up to the right. The
  // waves above it are pushed toward the top, those below it toward the right
  // edge, each most at the line and less farther off, so they pile up as they
  // part. U runs along the line, N across it toward the upper left.
  const P0 = [0.98, 0.8], SPLIT = 42 * DEG;
  const UX = Math.cos(SPLIT), UY = -Math.sin(SPLIT), NX = UY, NY = -UX;
  const UPW = [-0.25, -0.968], RIGHTW = [0.985, 0.17]; // which way each half goes
  const KUP = UPW[0] * NX + UPW[1] * NY, KRT = -(RIGHTW[0] * NX + RIGHTW[1] * NY); // how much of that is away from the line
  const M_UP = 0.15, M_RT = 0.17, L_UP = 0.55, L_RT = 0.5; // how far each half goes at the line, and how far from the line the push dies away
  // The tear starts where the staff points and runs both ways along the line.
  const A_Q = (() => { const o = staffAt(T.part + 1, [0, 0, 0, 0, 0]); return (o[3] - P0[0]) * UX + (o[4] - P0[1]) * UY; })();
  const openAt = (a, s) => smooth(0, 1, (s - T.part - Math.abs(a - A_Q) / 1.6) / 1.9);
  const lightAt = (a, d) => Math.exp(-(((a - 0.04) / 0.14) ** 2) - (d / 0.13) ** 2); // the channel's light, at the foot of the gap where it meets the water; higher up the gap is dark
  const lip = (a) => 0.022 * Math.sin(a * 15) + 0.012 * Math.sin(a * 37 + 1); // the parted edges are curled, not straight

  // Colours. Each ramp runs from shadow to light, turning in hue as it goes.
  // `swatch` adds a run of colours to INK and gives the index of the first.
  const INK = ['#000000'];
  const swatch = (...colours) => INK.push(...colours) - colours.length;
  const run = (n, ...stops) => Array.from({ length: n }, (_, i) => {
    const x = (i / (n - 1)) * (stops.length - 1), j = Math.min(stops.length - 2, x | 0);
    return '#' + stops[j].map((v, k) => Math.round(lerp(v, stops[j + 1][k], x - j)).toString(16).padStart(2, '0')).join('');
  });
  const NS = 14, NM = 14, NW = 16, NR = 12, NG = 8, NK = 3; // steps in each ramp
  const SKY = swatch(...run(NS, [2, 3, 8], [6, 8, 21], [12, 15, 37], [20, 24, 57], [32, 36, 82], [52, 54, 112], [84, 84, 150], [134, 132, 192], [198, 196, 232], [242, 241, 252])); // night sky and water: black, navy, indigo, to lavender where light lies on the water
  const MACH = swatch(...run(NM, [8, 6, 17], [19, 13, 36], [33, 23, 59], [51, 37, 85], [73, 55, 113], [102, 84, 146], [144, 128, 184], [194, 184, 224], [232, 227, 247])); // the machinery, the smoke and the stone: black-violet to a pale edge
  const SURF = swatch(...run(NW, [27, 24, 60], [50, 45, 98], [84, 77, 138], [124, 116, 177], [166, 159, 210], [203, 198, 234], [231, 228, 248], [250, 249, 255])); // the waves and the cloud: shadowed lavender to white
  const ROBE = swatch(...run(NR, [5, 8, 36], [10, 18, 78], [18, 33, 128], [31, 54, 176], [56, 86, 210], [98, 130, 232], [158, 182, 246])); // the robes and the flowers: deep blue
  const GOLD = swatch(...run(NG, [205, 154, 66], [230, 189, 100], [245, 216, 150], [252, 237, 200], [255, 250, 238])); // the light: soft gold to gold-white
  const SKIN = swatch('#b9adc9', '#d9d0e2', '#efe9f3'); // pale, cooled by the night: in shadow, half lit, lit
  const THIN = swatch(...Array.from({ length: 10 }, (_, i) => `rgba(234,230,247,${((i + 1) / 11).toFixed(3)})`)) - 1; // the cloud thinning away: THIN + 1, the faintest, to THIN + 10
  const RAMPS = [[SKY, NS], [MACH, NM], [SURF, NW], [ROBE, NR], [GOLD, NG], [SKIN, NK]];
  const [R_SKY, R_MACH, R_SURF, R_ROBE, R_GOLD, R_SKIN] = [0, 1, 2, 3, 4, 5];
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  const [BAR, SLASH, BACK, LOW, DASH, HIGH, TICK, COMMA, DOT, WAVE, STAR, PLUS, RING, AT, OPEN, SHUT, COLON] = code("|/\\_-'`,.~*+o@():");
  const fbm = (x, y) => 0.5 * noise(x, y) + 0.3 * noise(x * 2.1 + 7, y * 2.1 + 3) + 0.2 * noise(x * 4.3 + 1, y * 4.3 + 9);

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
    for (let c = Math.floor(lo); c < hi; c++) {
      const xa = Math.max(lo, c), xb = Math.min(hi, c + 1);
      if (xb - xa < 0.35) continue;
      const y = r0 + (dr * ((xa + xb) / 2 - c0)) / dc, r = Math.floor(y), f = y - r;
      if (slope > 0.6) put(c, r, rising ? SLASH : BACK);
      else if (slope > 0.2) put(c, r, f < 0.36 ? (rising ? HIGH : TICK) : f > 0.64 ? (rising ? COMMA : DOT) : DASH);
      else if (f < 0.3) put(c, r - 1, LOW);
      else put(c, r, f > 0.7 ? LOW : DASH);
    }
  }
  // A line through a cell at angle a (radians, y down), as one character.
  const across = (a) => { const k = ((a % Math.PI) + Math.PI) % Math.PI; return k < 0.39 || k > 2.75 ? DASH : k < 1.18 ? BACK : k < 1.96 ? BAR : SLASH; };

  // The machinery: wheels of rings, nearest last, each [hub across, down, the
  // radii of its rings from the outside in (each pair is the outer and inner
  // edge of a band; an odd last one is the hub), how fast it turns (radians a
  // second on the screen, + clockwise), teeth on its rim, spokes, small orbs
  // riding its outer band]. Neighbours turn opposite ways.
  const WHEELS = [
    [0.36, -0.02, [0.44, 0.425], -0.025, 0, 0, 2],                        // a vast thin ring over the top left
    [-0.22, 0.1, [0.3, 0.282, 0.2, 0.188], -0.04, 0, 7, 2],               // off the left edge, for wider screens
    [0.53, 0.42, [0.17, 0.152, 0.1, 0.09], -0.07, 44, 0, 0],              // a toothed ring behind the robes
    [0.2, 0.3, [0.25, 0.222, 0.16, 0.138, 0.045], 0.05, 64, 6, 3],        // the great wheel at the upper left, a planet at its hub
    [0.765, 0.125, [0.2, 0.183, 0.115, 0.1, 0.026], -0.07, 0, 8, 2],      // behind the figure's head, round the small glowing orb
    [0.62, -0.42, [0.3, 0.28, 0.2, 0.19], 0.04, 50, 5, 2],                // above, for tall screens
  ];
  const ORB = 4; // the wheel whose hub is the small glowing orb by the staff's upper end
  const LIGHTA = Math.atan2(0.25 - 0.3, 0.69 - 0.2); // the halo, seen from the great wheel: the rings are lit on that side

  // The surf and cloud, as the source image has it: a great swirl round a
  // dark eye in the middle right, rising up the right side to curl over the
  // top; another sweeping under the figure; and between them a bright band
  // of surf along the water behind the boat. Each [eye across, down, outer
  // radius, radius of the dark eye,
  // which way it winds (1 clockwise on the screen), how much light it catches,
  // the side the light falls on, and the arc it spans (degrees, y down)].
  const SWIRLS = [[1.12, 0.47, 0.37, 0.115, -1, 1, 115, -150, 145], [0.48, 0.44, 0.35, 0.2, 1, 0.95, 95, -15, 205], [0.86, 0.28, 0.48, 0.34, -1, 1, 90, 45, 135]];
  // Lesser curls, as the source image has them: [across, down, radius, light].
  // More are set along the rims of the swirls, and smaller ones on top of all.
  const CURLS = [
    [0.86, 0.21, 0.075, 1], [0.97, 0.13, 0.07, 1], [1.09, 0.11, 0.06, 0.95], [1.21, 0.15, 0.06, 0.9], [0.92, 0.31, 0.05, 0.85], // the puffs along the top
    [1.26, 0.26, 0.045, 0.9], [1.34, 0.31, 0.06, 0.95], [1.42, 0.39, 0.05, 0.9],                         // the right wave's crest, curling over
    [0.99, 0.47, 0.038, 0.7], [1.1, 0.56, 0.032, 0.75], [1.04, 0.39, 0.028, 0.65],                       // curls in the eye
    [0.56, 0.63, 0.065, 1], [0.71, 0.65, 0.055, 1], [0.08, 0.43, 0.075, 0.85], [0.02, 0.53, 0.065, 0.8], // under the figure and off to the left
    [1.56, 0.3, 0.075, 0.55], [1.63, 0.5, 0.085, 0.5], [1.51, 0.63, 0.065, 0.65], [1.72, 0.19, 0.065, 0.45], // darker, into the smoke on the right
  ];

  // The figure, in the frame: the halo [across, down, radius]; the hooded head
  // [across, down, half width, half height]; the robe, and its lit front; and
  // the ribbons, each [half width at the root, at the tail, how far a ripple
  // lifts it, then points from the root out along it]. They stream left.
  const HALO = [0.679, 0.257, 0.062];
  const HOOD = [0.672, 0.272, 0.026, 0.034];
  const BODY = [[0.638, 0.3], [0.69, 0.296], [0.74, 0.31], [0.76, 0.36], [0.752, 0.43], [0.772, 0.5], [0.795, 0.6], [0.745, 0.63], [0.67, 0.625], [0.6, 0.6], [0.618, 0.5], [0.625, 0.42], [0.628, 0.34]];
  const SHEEN = [[0.728, 0.33], [0.748, 0.355], [0.742, 0.43], [0.762, 0.51], [0.785, 0.596], [0.765, 0.603], [0.742, 0.52], [0.72, 0.43], [0.718, 0.35]];
  const RIBBONS = [
    [0.03, 0.008, 0.028, [0.64, 0.29], [0.6, 0.2], [0.54, 0.125], [0.46, 0.075], [0.38, 0.075], [0.31, 0.12], [0.26, 0.2]], // the veil, arcing up and over to the left
    [0.036, 0.01, 0.034, [0.645, 0.32], [0.56, 0.33], [0.46, 0.35], [0.36, 0.37], [0.26, 0.41], [0.16, 0.44], [0.06, 0.46], [-0.04, 0.5]],
    [0.03, 0.008, 0.034, [0.635, 0.44], [0.53, 0.47], [0.42, 0.5], [0.31, 0.52], [0.2, 0.55], [0.09, 0.56], [-0.01, 0.58]],
    [0.028, 0.008, 0.03, [0.62, 0.57], [0.5, 0.6], [0.38, 0.62], [0.27, 0.63], [0.16, 0.62], [0.06, 0.6]],
    [0.018, 0.006, 0.03, [0.65, 0.28], [0.58, 0.27], [0.5, 0.29], [0.41, 0.29], [0.32, 0.3], [0.23, 0.33]],
    [0.008, 0.004, 0.024, [0.69, 0.42], [0.58, 0.41], [0.47, 0.43], [0.36, 0.45], [0.26, 0.46], [0.16, 0.49]], // a thin sash
  ];
  // Each ribbon as a smooth curve through its points: [across, down, and the normal toward its upper edge].
  const PATH = 32;
  const PATHS = RIBBONS.map(([w0, w1, lift, ...pts]) => {
    const at = [];
    for (let k = 0; k <= PATH; k++) {
      const f = (k / PATH) * (pts.length - 1), j = Math.min(pts.length - 2, Math.floor(f)), u = f - j;
      const p0 = pts[Math.max(0, j - 1)], p1 = pts[j], p2 = pts[j + 1], p3 = pts[Math.min(pts.length - 1, j + 2)];
      const cr = (a, b, c, d) => 0.5 * (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (3 * b - a - 3 * c + d) * u * u * u);
      at.push([cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])]);
    }
    return { w0, w1, lift, at: at.map(([x, y], k) => {
      const a = at[Math.max(0, k - 1)], b = at[Math.min(PATH, k + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      return [x, y, dy / l, -dx / l];
    }) };
  });
  const inside = (poly, x, y) => {
    let yes = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) yes = !yes;
    }
    return yes;
  };

  // The boat, in its own units: u along it from the stern (-0.5) to the prow
  // (0.5), v up from the waterline in frame heights. The prow and the stern
  // curl up; three hooded passengers sit in it and a fourth, standing at the
  // front, holds up the warm light.
  const PROW = [[0.43, 0.034], [0.475, 0.06], [0.5, 0.095], [0.502, 0.122], [0.488, 0.132], [0.474, 0.12]];
  const STERN = [[-0.44, 0.034], [-0.48, 0.058], [-0.5, 0.085], [-0.492, 0.098], [-0.478, 0.092]];
  const gunwale = (u) => 0.026 + 0.034 * Math.abs(2 * u) ** 3;
  const FOLK = [[-0.24, 0.013, 0.032], [-0.1, 0.014, 0.038], [0.03, 0.012, 0.03]]; // [along, half width, height above the gunwale]
  const BEARER = 0.2, LAMP = [0.235, 0.088]; // where the one standing is, and the light held up

  // Ruins standing in the water: broken pillars [across, foot, top, half
  // width, lean (across per frame height up), distance], and swords blade
  // down [across, where the blade meets the water, how tall above it, lean,
  // distance]. They never move but for the camera's drift.
  const PILLARS = [[1.215, 0.79, 0.715, 0.013, 0, 1.4], [1.36, 0.792, 0.735, 0.011, 0.03, 1.4], [1.74, 0.785, 0.2, 0.034, -0.02, 1.3], [0.16, 0.95, 0.55, 0.06, 0.06, 0.6]];
  const SWORDS = [[0.14, 0.89, 0.11, -0.35, 0.7], [0.235, 0.865, 0.16, -0.04, 0.8], [0.3, 0.9, 0.13, 0.08, 0.65], [1.6, 0.845, 0.12, 0.05, 0.9], [1.75, 0.815, 0.11, -0.03, 1.1]];

  function createScene({ cols, rows, aspect = 2, seed = 1 }) {
    const rand = mulberry32(seed), R = (a, b) => a + (b - a) * rand();
    const H2 = rows * 2, N = cols * H2, cells = cols * rows;
    const glyph = new Uint8Array(cells), ink = new Uint8Array(cells), bold = new Uint8Array(cells), paint = new Uint8Array(N);

    // Fit the frame to the screen: FW columns and FH half rows to a frame height.
    const sq = aspect / 2, A = cols / (H2 * sq), keep = KEEP[1] - KEEP[0], fits = A >= keep;
    const FW = fits ? H2 * sq : cols / keep, FH = FW / sq;
    const mid = fits ? Math.max(KEEP[1] - A / 2, Math.min(WIDE / 2, KEEP[0] + A / 2)) : (KEEP[0] + KEEP[1]) / 2; // the frame's x at the middle of the screen
    const top = fits ? 0 : (H2 / FH - 1) * 0.42; // frame heights of sky above the frame
    const Xc = Float32Array.from({ length: cols }, (_, c) => mid + (c + 0.5 - cols / 2) / FW);
    const Yh = Float32Array.from({ length: H2 }, (_, h) => (h + 0.5) / FH - top);
    const colOf = (x) => cols / 2 + (x - mid) * FW, rowOf = (y) => (y + top) * FH; // a column, and a half row
    const hz = Math.max(0, Math.min(H2, Math.ceil(rowOf(HZ) - 0.5))); // the first half row below the horizon
    const lastCam = camAt(T.end);

    // The grain: a fixed threshold in each half cell for dithering between the
    // steps of a ramp, and a plain ordered one for the cloud thinning away.
    const thr = new Float32Array(N), order = new Float32Array(N);
    for (let h = 0, p = 0; h < H2; h++) for (let c = 0; c < cols; c++, p++) {
      order[p] = (BAYER[(h & 3) * 4 + (c & 3)] + 0.5) / 16;
      thr[p] = (order[p] + 0.7 * hash(c, h + 7)) % 1;
    }

    // Each frame: how light every half cell is and on which ramp, how warm the
    // light on it is, and what it is; and which cells the boat owns.
    const lum = new Float32Array(N), ramp = new Uint8Array(N), warm = new Float32Array(N), kind = new Uint8Array(N), own = new Uint8Array(cells);
    const K_SKY = 0, K_RING = 1, K_SMOKE = 2, K_WAVE = 3, K_LIGHT = 4, K_FIG = 5, K_WATER = 6, K_SOLID = 7;
    const lay = (p, r, l, k) => { ramp[p] = r; lum[p] = l; kind[p] = k; glyph[((p / cols) >> 1) * cols + (p % cols)] = 32; };
    const put = (c, r, g, colour, heavy = 0) => { if (c >= 0 && c < cols && r >= 0 && r < rows) { const i = r * cols + c; glyph[i] = g; ink[i] = colour; bold[i] = heavy; } };
    const tone = (r, l) => RAMPS[r][0] + Math.max(0, Math.min(RAMPS[r][1] - 1, Math.round(l * (RAMPS[r][1] - 1)))); // a glyph's colour

    // Fill a disc in the frame (as the screen now shows it), calling f(p, dx, dy) with the place in it from -1 to 1.
    function disc(x, y, rad, f) {
      const c0 = Math.max(0, Math.floor(colOf(x - rad))), c1 = Math.min(cols - 1, Math.ceil(colOf(x + rad)));
      const h0 = Math.max(0, Math.floor(rowOf(y - rad))), h1 = Math.min(H2 - 1, Math.ceil(rowOf(y + rad)));
      for (let h = h0; h <= h1; h++) for (let c = c0; c <= c1; c++) {
        const dx = (Xc[c] - x) / rad, dy = (Yh[h] - y) / rad;
        if (dx * dx + dy * dy <= 1) f(h * cols + c, dx, dy);
      }
    }
    // Fill a stroke from (x0, y0) to (x1, y1), w0 to w1 wide either side, calling f(p, along, across) with across from -1 to 1.
    function stroke(x0, y0, x1, y1, w0, w1, f) {
      const w = Math.max(w0, w1), dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1e-9, l = Math.sqrt(l2);
      const c0 = Math.max(0, Math.floor(colOf(Math.min(x0, x1) - w))), c1 = Math.min(cols - 1, Math.ceil(colOf(Math.max(x0, x1) + w)));
      const h0 = Math.max(0, Math.floor(rowOf(Math.min(y0, y1) - w))), h1 = Math.min(H2 - 1, Math.ceil(rowOf(Math.max(y0, y1) + w)));
      for (let h = h0; h <= h1; h++) for (let c = c0; c <= c1; c++) {
        const px = Xc[c] - x0, py = Yh[h] - y0, k = clamp01((px * dx + py * dy) / l2), side = (px * dy - py * dx) / l, half = lerp(w0, w1, k);
        const ox = px - dx * k, oy = py - dy * k;
        if (ox * ox + oy * oy <= half * half) f(h * cols + c, k, side / half);
      }
    }
    // A painted line one half cell thick, calling f(p, along) for each half cell on it.
    function rod(x0, y0, x1, y1, f) {
      const c0 = colOf(x0), h0 = rowOf(y0), c1 = colOf(x1), h1 = rowOf(y1), n = Math.max(1, Math.ceil(Math.max(Math.abs(c1 - c0), Math.abs(h1 - h0))));
      for (let k = 0; k <= n; k++) {
        const c = Math.floor(lerp(c0, c1, k / n)), h = Math.floor(lerp(h0, h1, k / n));
        if (c >= 0 && c < cols && h >= 0 && h < H2) f(h * cols + c, k / n);
      }
    }

    // The night sky: darkest overhead, a little paler toward the horizon.
    const skyL = new Float32Array(N);
    for (let h = 0, p = 0; h < H2; h++) for (let c = 0; c < cols; c++, p++) skyL[p] = 0.2 + 0.12 * clamp01((Yh[h] + 0.5) / (HZ + 0.5)) + 0.06 * (noise(Xc[c] * 4 + 11, Yh[h] * 6) - 0.5);
    const stars = []; // [column, row, phase], fixed in the far sky
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (hash(c, r + 333 * seed) < 0.012 && (2 * r + 1) / FH - top < HZ - 0.05) stars.push([c, r, hash(r, c + 9) * 6.28]);

    // The machinery, worked out once on its own layer (wider than the screen
    // by as far as the drift slides it): for each half cell, the nearest wheel
    // with something there, what part of it, and the angle and distance from
    // its hub, so that each frame only has to turn it.
    const RW = cols + Math.ceil((lastCam / D_RINGS) * FW) + 1, RH = Math.min(H2, hz);
    const rWho = new Int8Array(RW * RH).fill(-1), rPart = new Uint8Array(RW * RH), rAng = new Float32Array(RW * RH), rRad = new Float32Array(RW * RH);
    const BAND = 1, EDGE = 2, TOOTH = 3, SPOKE = 4, HUB = 5;
    const edgeW = 0.7 / FH; // a ring's edge is a line about a half cell thick
    const outer = WHEELS.map(([, , radii, , teeth]) => radii[0] + (teeth ? 0.012 : 0) + edgeW);
    for (let h = 0; h < RH; h++) for (let i = 0; i < RW; i++) {
      const x = Xc[0] + i / FW, y = Yh[h], q = h * RW + i;
      for (let w = WHEELS.length - 1; w >= 0; w--) {
        const wheel = WHEELS[w], cx = wheel[0], cy = wheel[1], r2 = (x - cx) ** 2 + (y - cy) ** 2;
        if (r2 > outer[w] * outer[w]) continue;
        const radii = wheel[2], teeth = wheel[4], spokes = wheel[5], r = Math.sqrt(r2);
        let part = 0;
        if (radii.length & 1 && r < radii[radii.length - 1]) part = HUB;
        else if (radii.some((e) => Math.abs(r - e) < edgeW)) part = EDGE;
        else if (r > radii[0]) part = teeth ? TOOTH : 0;
        else for (let j = 0; j + 1 < radii.length; j += 2) if (r < radii[j] && r > radii[j + 1]) part = BAND;
        if (!part && r < radii[0] && spokes) part = SPOKE;
        if (!part) continue;
        rWho[q] = w; rPart[q] = part; rAng[q] = Math.atan2(y - cy, x - cx); rRad[q] = r;
        break;
      }
    }

    // The smoke in the upper right, on its own layer: where it lies, and two
    // textures of it that creep opposite ways (PAD columns spare at each side),
    // so that their sum billows.
    const SW = cols + Math.ceil((lastCam / D_SMOKE) * FW) + 1, SH = Math.min(H2, hz);
    const PAD = Math.ceil(BILLOW * LENGTH * FW) + 1, SP = SW + 2 * PAD, sd = R(0, 50);
    const smM = new Float32Array(SW * SH), smA = new Float32Array(SP * SH), smB = new Float32Array(SP * SH);
    for (let h = 0; h < SH; h++) {
      const y = Yh[h];
      for (let i = 0; i < SP; i++) {
        const x = Xc[0] + (i - PAD) / FW, q = h * SP + i;
        if (x < 0.6) continue; // there is no smoke this far left, however far it creeps
        smA[q] = fbm(sd + x * 5.5, y * 7); smB[q] = fbm(sd + 30 + x * 4.5, 11 + y * 6);
        if (i < PAD || i >= PAD + SW) continue;
        const low = lerp(0.25, 0.65, smooth(1.3, 1.95, x)); // it reaches lower toward the right
        smM[h * SW + i - PAD] = Math.max(smooth(0.95, 1.4, x) * (1 - smooth(low, low + 0.22, y)), smooth(0.7, 1.05, x) * smooth(0.06, -0.1, y));
      }
    }

    // The surf and cloud, worked out once on their own layer: for each half
    // cell, which swirl or curl it belongs to, the angle and distance (as a
    // log) from that one's eye, how deep inside it is, and its light and
    // shade. Each frame then turns the bands of each and parts the waves.
    const forms = [];
    const form = (x, y, r, inner, sense, arms, twist, lit, side, from = 0, to = 360) => forms.push({ x, y, r, inner, sense, arms, twist, lit, side: side * DEG, from: from * DEG, span: (to - from) * DEG, ph: R(0, 6.28), p1: R(0, 6.28), p2: R(0, 6.28), spd: R(0.2, 0.36) });
    for (const [x, y, r, inner, sense, lit, side, from, to] of SWIRLS) {
      form(x, y, r, inner, sense, 2, 22, lit, side, from, to);
      for (let a = (from + R(10, 25)) * DEG; a < (to - 15) * DEG; a += R(0.45, 0.65)) { // billows along the upper part of its rim
        const bx = x + Math.cos(a) * r * 0.95, by = y + Math.sin(a) * r * 0.95;
        if (Math.sin(a) < 0.1) form(bx, by, r * R(0.11, 0.17), 0, rand() < 0.5 ? 1 : -1, 1, R(5, 7), lit * (0.75 + 0.25 * Math.cos(a - side * DEG)), 270);
      }
    }
    const rims = forms.length; // the curls so far sit on the swirls' rims; those after are free
    for (const [x, y, r, lit] of CURLS) form(x, y, r, 0, rand() < 0.5 ? 1 : -1, 1, R(4.5, 6.5), lit, 270);
    for (let x = 1.85 + R(0, 0.06); x < Xc[cols - 1] + lastCam / D_WAVES + 0.2; x += R(0.12, 0.2)) form(x, R(0.25, 0.68), R(0.06, 0.1), 0, rand() < 0.5 ? 1 : -1, 1, R(4.5, 6.5), R(0.4, 0.55), 270); // more beyond the right edge, dark in the smoke
    for (let x = -0.07 - R(0, 0.06); x > Xc[0] - 0.2; x -= R(0.12, 0.2)) form(x, R(0.45, 0.68), R(0.07, 0.11), 0, rand() < 0.5 ? 1 : -1, 1, R(4.5, 6.5), R(0.6, 0.75), 270); // and cloud beyond the left
    for (const k of forms.slice(rims)) if (k.r > 0.055) for (let j = 0; j < 2; j++) { // small curls on the tops of the free curls: the cauliflower edge of surf and cloud
      const a = R(-2.6, -0.5);
      form(k.x + Math.cos(a) * k.r * 0.85, k.y + Math.sin(a) * k.r * 0.85, k.r * R(0.3, 0.42), 0, -k.sense, 1, R(5, 7), Math.min(1, k.lit + 0.05), 270);
    }
    forms.forEach((K, k) => { K.id = k; K.kappa = Math.atan2(K.sense * K.twist, -K.arms); }); // a crest's direction, from the way out from the eye
    const WT = cols + Math.ceil((lastCam / D_WAVES) * FW) + 2, WH = hz;
    const wWho = new Int16Array(WT * WH).fill(-1), wAng = new Float32Array(WT * WH), wLog = new Float32Array(WT * WH), wDeep = new Float32Array(WT * WH), wShade = new Float32Array(WT * WH), wPh = new Float32Array(WT * WH);
    for (let h = 0; h < WH; h++) {
      const y = Yh[h], row = forms.filter((K) => Math.abs(y - K.y) <= K.r * 1.12); // only those that reach this row
      for (let i = 0; i < WT; i++) {
        const x = Xc[0] + i / FW, q = h * WT + i;
        let best = 0, next = 0, K = null, ang = 0, dist = 0;
        for (const F of row) {
          const dx = x - F.x, dy = y - F.y, d2 = dx * dx + dy * dy;
          if (d2 > F.r * F.r * 1.24) continue; // beyond even its widest edge
          const d = Math.sqrt(d2), a = Math.atan2(dy, dx), edge = F.r * (1 + 0.07 * Math.sin(3 * a + F.p1) + 0.04 * Math.sin(7 * a + F.p2));
          if (d >= edge) continue;
          if (F.inner) {
            if (d < F.inner * (1 + 0.12 * Math.sin(4 * a + F.p2))) continue; // the dark eye
            const ar = (((a - F.from) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), end = Math.min(0.7, F.span * 0.2); // how far round from where it starts
            if (ar > F.span || (F.span < 6.2 && Math.abs(2 * d - F.inner - edge) > (edge - F.inner) * Math.min(1, ar / end, (F.span - ar) / end))) continue; // an arc thins out at its ends
          }
          const v = 1 - d / edge;
          if (v > best) { next = best; best = v; K = F; ang = a; dist = d; } else if (v > next) next = v;
        }
        if (!K) continue;
        const rr = Math.min(1, dist / K.r), facing = Math.cos(ang - K.side);
        let shade;
        if (K.inner) { // the swirl: brightest on its lit side, dark round its eye, its bands wandering like brushstrokes
          const u = clamp01((dist - K.inner) / (K.r - K.inner));
          shade = 0.14 + 0.6 * K.lit * (0.5 + 0.5 * facing) ** 1.5 + 0.08 * Math.sin(Math.PI * u) - 0.14 * (1 - smooth(0, 0.3, u));
          wPh[q] = 2.6 * fbm(x * 6 + 21, y * 6);
        } else shade = 0.2 + 0.5 * K.lit * (0.5 + 0.5 * facing * rr) - 0.1 * smooth(0.35, 0.1, rr); // a curl: lit on top, darker at its eye
        wWho[q] = K.id; wAng[q] = ang; wLog[q] = Math.log(Math.max(1e-3, rr)); wDeep[q] = best;
        wShade[q] = shade - 0.2 * smooth(0.08, 0, best - next); // dark where two meet
      }
    }

    // The flowers on the water, the nearer the larger and the thicker: [across
    // (on the screen, before the drift), down, distance, radius, phase].
    const blooms = [];
    for (let h = hz; h < H2; h++) {
      const y = Yh[h], dz = y - HZ;
      if (dz < 0.012) continue;
      const D = Math.max(0.38, (BOAT[1] - HZ) / dz), cover = lerp(0.03, 0.75, smooth(1, 0.45, D)), size = 0.011 / D;
      const x0 = Xc[0] - size, x1 = Xc[cols - 1] + lastCam / D + size, n = (cover * (x1 - x0)) / (FH * Math.max(1.6 * size * size, 1 / (FW * FH))); // a flower too small to see still fills a half cell
      for (let k = Math.floor(n + rand()); k > 0; k--) blooms.push([R(x0, x1), y + R(-0.5, 0.5) / FH, D, size * R(0.6, 1.4), R(0, 6.28)]);
    }
    // The boat's course, tabulated so that the wake can find when it passed each place.
    const SAIL = Float32Array.from({ length: Math.ceil((T.end - T.glide) / 0.01) + 2 }, (_, k) => sailed(T.glide + k * 0.01));
    const passed = (d) => { // the story time at which the boat had come d
      let lo = 0, hi = SAIL.length - 1;
      if (d >= SAIL[hi]) return Infinity;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (SAIL[m] < d) lo = m; else hi = m; }
      return T.glide + (lo + (d - SAIL[lo]) / (SAIL[hi] - SAIL[lo] || 1)) * 0.01;
    };

    // Points of light drifting in the air: [across, down, distance, drift across and down a second, phase, gold].
    const motes = Array.from({ length: Math.round(14 + (cols * rows) / 600) }, () => [R(Xc[0] - 0.1, Xc[cols - 1] + 0.3), R(Math.max(Yh[0], -0.5), HZ - 0.04), R(1, 3), R(-0.012, 0.004), R(-0.02, -0.006), R(0, 6.28), rand() < 0.45]);
    // More ruins for a wider screen: pillars and swords beyond the source image's edges.
    const pillars = PILLARS.map((q) => q.slice()), swords = SWORDS.map((q) => q.slice());
    for (let x = -0.15 - R(0, 0.1); x > Xc[0] - 0.2; x -= R(0.45, 0.7)) pillars.push([x, R(0.8, 0.9), R(0.45, 0.62), R(0.025, 0.04), R(-0.05, 0.05), R(0.8, 1.4)]);
    for (let x = 2.0 + R(0, 0.1); x < Xc[cols - 1] + 0.4; x += R(0.4, 0.6)) pillars.push([x, R(0.78, 0.82), R(0.35, 0.6), R(0.02, 0.035), R(-0.05, 0.05), R(1.2, 2)]);
    for (let x = -0.02 - R(0, 0.05); x > Xc[0] - 0.1; x -= R(0.12, 0.3)) swords.push([x, R(0.85, 0.92), R(0.08, 0.14), R(-0.08, 0.08), R(0.6, 0.9)]);
    for (let x = 1.9 + R(0, 0.06); x < Xc[cols - 1] + 0.5; x += R(0.12, 0.3)) swords.push([x, R(0.81, 0.9), R(0.08, 0.13), R(-0.08, 0.08), R(0.7, 1.1)]);

    // ---- Each frame, back to front.

    function sky(t) {
      lum.set(skyL); ramp.fill(R_SKY); kind.fill(K_SKY);
      for (const [c, r, ph] of stars) put(c, r, Math.sin(t * 2.3 + ph) > 0.7 ? PLUS : DOT, tone(R_SURF, 0.8));
    }

    function rings(t, camX) {
      const o = Math.round((camX / D_RINGS) * FW);
      for (let h = 0; h < RH; h++) for (let c = 0; c < cols; c++) {
        const q = h * RW + c + o, w = rWho[q];
        if (w < 0) continue;
        const [, , radii, turn, teeth, spokes] = WHEELS[w], part = rPart[q], a = rAng[q] - turn * t, r = rRad[q];
        const lit = 0.5 + 0.5 * Math.cos(rAng[q] - LIGHTA);
        let l = -1;
        if (part === EDGE) l = 0.5 + 0.22 * lit;
        else if (part === BAND) { const k = (a * 36) / (2 * Math.PI); l = 0.25 + 0.12 * lit + (k - Math.floor(k) < 0.14 ? 0.12 : 0); }
        else if (part === TOOTH) { const k = (a * teeth) / (2 * Math.PI); if (k - Math.floor(k) < 0.5) l = 0.3 + 0.12 * lit; }
        else if (part === HUB) { const hr = radii[radii.length - 1], ux = Math.cos(rAng[q]) * (r / hr), uy = Math.sin(rAng[q]) * (r / hr); l = w === ORB ? 1 : 0.3 + 0.45 * clamp01(0.6 - 0.7 * ux - 0.7 * uy) * Math.sqrt(Math.max(0, 1 - ux * ux - uy * uy)); }
        else { const k = (a * spokes) / (2 * Math.PI), off = Math.abs(k - Math.round(k)) * ((2 * Math.PI) / spokes) * r; if (off < 0.55 / FW) l = 0.36 + 0.12 * lit; }
        if (l >= 0) lay(h * cols + c, R_MACH, l, K_RING);
      }
      for (const [w, [cx, cy, radii, turn, , , orbs]] of WHEELS.entries()) for (let j = 0; j < orbs; j++) { // orbs riding the outer band, turning with it
        const a = (j * 2 * Math.PI) / orbs + w + turn * t, rr = (radii[0] + radii[1]) / 2;
        disc(cx + Math.cos(a) * rr - camX / D_RINGS, cy + Math.sin(a) * rr, 0.016, (p, dx, dy) => lay(p, R_MACH, 0.45 + 0.4 * clamp01(-dx - dy), K_RING));
      }
      for (let r = 0; r < RH >> 1; r++) for (let c = 0; c < cols; c++) { // ticks on the bands and dashes along the edges, turning with them
        const q = (2 * r + 1) * RW + c + o, w = rWho[q];
        if (w < 0 || kind[2 * r * cols + c] !== K_RING || kind[(2 * r + 1) * cols + c] !== K_RING) continue;
        const a = rAng[q] - WHEELS[w][3] * t, part = rPart[q];
        if (part === BAND) { const k = (a * 36) / (2 * Math.PI); if (k - Math.floor(k) < 0.14) put(c, r, across(rAng[q]), tone(R_MACH, 0.75)); }
        else if (part === EDGE && hash(Math.floor((a * rRad[q] * FW) / 2.5), w) < 0.4) put(c, r, across(rAng[q] + Math.PI / 2), tone(R_MACH, 0.88));
      }
    }

    function smoke(t, camX) {
      const o = Math.round((camX / D_SMOKE) * FW), a = PAD - Math.round(BILLOW * t * FW), b = PAD + Math.round(0.7 * BILLOW * t * FW);
      for (let h = 0; h < SH; h++) for (let c = 0; c < cols; c++) {
        const i = c + o, m = smM[h * SW + i];
        if (m <= 0) continue;
        const qa = h * SP + i + a, v = m * (smA[qa] + smB[h * SP + i + b]) * 0.75;
        if (v < 0.34) continue;
        const rim = h > 1 ? clamp01((smA[qa] - smA[qa - 2 * SP]) * 7) : 0; // the top of a billow, where it thickens going down
        lay(h * cols + c, R_MACH, 0.03 + 0.3 * (1 - smooth(0.34, 0.5, v)) + 0.42 * rim, K_SMOKE); // black within, violet on its edges and the tops of its billows
      }
    }

    // The waves. Each half cell finds where its surf came from: unmoved, or,
    // once the waves part, pushed up or right from nearer the split; or it is
    // in the gap, lit by the channel's light near the water and dark higher
    // up. The bands of every swirl and curl turn slowly, faster at a parted lip.
    const cellK = new Int16Array(cells), cellA = new Float32Array(cells), cellB = new Float32Array(cells), cellG = new Float32Array(cells), cellD = new Float32Array(cells), cellL = new Float32Array(cells);
    function waves(s, t, camX) {
      const shift = camX / D_WAVES, parting = s > T.part;
      cellK.fill(-1);
      for (let h = 0; h < WH; h++) {
        const y = Yh[h];
        for (let c = 0; c < cols; c++) {
          const p = h * cols + c, x = Xc[c] + shift;
          let sx = x, sy = y, edge = 9, gap = -1, I = 0, op = 0;
          if (parting) {
            const a = (x - P0[0]) * UX + (y - P0[1]) * UY, d = (x - P0[0]) * NX + (y - P0[1]) * NY + lip(a);
            op = openAt(a, s);
            if (op > 0) {
              I = op * lightAt(a, d);
              const upper = d >= 0, M = (upper ? M_UP : M_RT) * op, reach = upper ? L_UP : L_RT, dd = upper ? d : -d, Mk = M * (upper ? KUP : KRT);
              if (dd < reach) {
                const ds = (dd - Mk) / (1 - Mk / reach); // how far from the line this surf was before it moved
                if (ds < 0) gap = dd / Mk; // in the gap: 0 at the split, 1 at the lip
                else {
                  const m = M * (1 - ds / reach), dir = upper ? UPW : RIGHTW;
                  sx = x - m * dir[0]; sy = y - m * dir[1]; edge = ds;
                  if (sy > HZ) gap = 2; // lifted clear of the water: a little of the light shows under it
                }
              }
            }
          }
          if (gap >= 0) {
            const li = gap > 1 ? 0.3 * I : I * (1 - 0.45 * gap * gap);
            if (li > 0.05) { lay(p, R_SURF, 0.25 + 0.73 * li, K_LIGHT); warm[p] = li * Math.max(0, 1 - gap) ** 2; }
            continue;
          }
          const i = Math.round((sx - Xc[0]) * FW), hh = Math.round((sy + top) * FH - 0.5);
          if (i < 0 || i >= WT || hh < 0 || hh >= WH) continue;
          const q = hh * WT + i, k = wWho[q];
          if (k < 0) continue;
          const K = forms[k], spin = t * K.spd + (op > 0 ? op * 2.4 * Math.max(0, 1 - edge / 0.25) : 0);
          const band = Math.cos(K.arms * (wAng[q] - K.sense * spin) + K.sense * K.twist * wLog[q] + K.ph + wPh[q]);
          let l = wShade[q] + (K.inner ? 0.13 : 0.15) * band;
          if (edge < 0.05) { const rim = (1 - edge / 0.05) ** 2; l += 0.3 * rim * (0.3 + I); warm[p] = 0.6 * rim * I; } // a parted lip, catching the channel's light
          lay(p, R_SURF, l, K_WAVE);
          if (h & 1) { const ci = (h >> 1) * cols + c; cellK[ci] = k; cellA[ci] = wAng[q]; cellB[ci] = band; cellG[ci] = wLog[q]; cellD[ci] = wDeep[q]; cellL[ci] = l; }
        }
      }
      const WR = WH >> 1;
      for (let r = 0; r < WR; r++) for (let c = 1; c < cols - 1; c++) { // crests drawn along the bands, one character thick; the eyes of the larger curls; spray off their tops
        const i = r * cols + c, k = cellK[i];
        if (k < 0 || kind[2 * r * cols + c] !== K_WAVE) continue;
        const K = forms[k], b = cellB[i], l = cellL[i];
        if (!K.inner && cellG[i] < -2.3 && K.r * FW > 7) { put(c, r, AT, tone(R_SURF, l + 0.15)); continue; }
        if (cellD[i] < 0.07 && Math.sin(cellA[i]) < -0.3 && hash(c, r + 51) < 0.15) { put(c, r, [HIGH, DOT, COMMA, TICK][(hash(r, c) * 4) | 0], tone(R_SURF, 1)); continue; }
        if (b < (K.inner ? 0.7 : 0.85) || l < 0.42 || K.r * FW < 6) continue;
        let g = across(cellA[i] + K.kappa);
        if (g === DASH) {
          if ((r > 0 && cellK[i - cols] === k && cellB[i - cols] > b) || (r + 1 < WR && cellK[i + cols] === k && cellB[i + cols] > b)) continue;
          g = WAVE;
        } else {
          if ((cellK[i - 1] === k && cellB[i - 1] > b) || (cellK[i + 1] === k && cellB[i + 1] > b)) continue;
          if (g === BAR) g = Math.cos(cellA[i]) > 0 ? SHUT : OPEN;
        }
        put(c, r, g, tone(R_SURF, l + 0.22));
      }
    }

    // The water: dark and calm, mirroring what stands above it, broken into
    // streaks by the ripples; once the waves part, a path of soft gold-white
    // light lies on it ahead of the boat. Then the flowers on it, near ones
    // larger, pushed aside by the boat's wake, and loose petals and ripples.
    const H0 = rowOf(HZ);
    function water(s, t, camX, boatX) {
      const lit = smooth(T.part + 0.3, T.glide - 0.5, s), chX = P0[0] - 0.03 - camX / D_WAVES; // the channel's light comes up as the waves part
      for (let h = hz; h < H2; h++) {
        const y = Yh[h], dz = Math.max(0, y - HZ), D = Math.max(0.38, (BOAT[1] - HZ) / Math.max(1e-3, dz));
        const mirror = Math.exp(-dz / 0.3), half = 0.08 + 0.8 * dz, glint = Math.exp(-dz / 0.1);
        for (let c = 0; c < cols; c++) {
          const p = h * cols + c, X = (Xc[c] - WIDE / 2) * D + WIDE / 2 + camX;
          const wob = Math.round(3 * (noise(X * 14, h * 0.9 + t * 0.7) - 0.5)), hm = Math.floor(2 * H0 - h - 1) + wob;
          let l = 0.15 + 0.04 * glint;
          if (hm >= 0 && hm < hz) l = Math.max(l, lum[hm * cols + c] * mirror * (0.5 + 0.5 * noise(X * 9, h * 1.3 + t * 0.5))); // the reflection, in streaks
          const ch = lit * Math.exp(-(((Xc[c] - chX) / half) ** 2)) * (0.45 + 0.55 * glint);
          l += (0.96 - l) * ch * 0.75;
          warm[p] = ch * glint;
          lay(p, R_SKY, Math.min(0.97, l), K_WATER);
        }
      }
      // the wake: two lines of ripples spreading back from the stern, where the boat has been
      const stern = BOAT[0] - BOAT[2] / 2, gone = sailed(s), by = BOAT[1];
      const wakeAt = (x, y) => { // how far out of the way of the wake a flower at (x, y) is pushed, in frame heights
        const X1 = x + camX, tau = s - passed(X1 - stern);
        if (gone <= 0 || X1 <= stern || X1 >= stern + gone || !(tau > 0 && tau < 1.4)) return 0;
        const far = by - 0.004 - 0.014 * tau, near = by + 0.006 + 0.03 * tau;
        return y > far && y < near ? (y - far < near - y ? far - y : near - y) : 0;
      };
      for (const [x0, y0, D, size, ph] of blooms) {
        const x = x0 - camX / D;
        let y = y0 + (0.004 / D) * Math.sin(t * 1.9 + ph); // bobbing
        if (x < Xc[0] - size || x > Xc[cols - 1] + size) continue;
        if (Math.abs(D - 1) < 0.5) y += wakeAt(x, y);
        const rx = size * FW, ry = size * 0.45 * FH, cc = colOf(x), hc = rowOf(y);
        const c0 = Math.max(0, Math.floor(cc - rx)), c1 = Math.min(cols - 1, Math.floor(cc + rx)), h0 = Math.max(hz, Math.floor(hc - ry)), h1 = Math.min(H2 - 1, Math.floor(hc + ry));
        for (let h = h0; h <= h1; h++) for (let c = c0; c <= c1; c++) {
          const u = (c + 0.5 - cc) / Math.max(0.5, rx), v = (h + 0.5 - hc) / Math.max(0.5, ry), q = u * u + v * v;
          if (q > 1) continue;
          const p = h * cols + c;
          lay(p, R_ROBE, 0.22 + 0.28 * (1 - q) + 0.35 * Math.max(0, lum[p] - 0.2) + 0.08 * Math.sin(ph * 5), K_WATER);
        }
        if (rx > 1.8 && hash(Math.round(x0 * 997), 3) < 0.3) put(Math.floor(cc), Math.floor(hc / 2), STAR, tone(R_ROBE, 1)); // the heart of a near one
      }
      for (let r = Math.ceil(hz / 2); r < rows; r++) { // loose petals, and ripples where the water is not lit
        const yc = (2 * r + 1) / FH - top, dz = yc - HZ;
        if (dz < 0.01) continue;
        const D = Math.max(0.38, (BOAT[1] - HZ) / dz);
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c, X = (Xc[c] - WIDE / 2) * D + WIDE / 2 + camX, lo = (2 * r + 1) * cols + c;
          if (glyph[i] !== 32 || kind[lo] !== K_WATER || ramp[lo] !== R_SKY) continue;
          const sx = Math.floor(X / 0.013), wx = Math.floor(X / 0.05);
          if (hash(sx, r + 77) < 0.045) put(c, r, [HIGH, COMMA, DOT][(hash(r, sx) * 3) | 0], tone(R_ROBE, 0.85));
          else if (warm[lo] < 0.2 && hash(wx, r + 13) < 0.05) put(c, r, hash(r, wx) < 0.6 ? WAVE : DASH, tone(R_SKY, Math.min(1, lum[lo] + 0.15)));
        }
      }
      if (gone > 0) { // ripples along the wake's two arms
        const c0 = Math.max(0, Math.floor(colOf(stern - camX))), c1 = Math.min(cols - 1, Math.ceil(colOf(boatX - BOAT[2] / 2)));
        for (let c = c0; c <= c1; c++) {
          const tau = s - passed(Xc[c] + camX - stern);
          if (!(tau > 0 && tau < 1.4)) continue;
          for (const y of [by - 0.004 - 0.014 * tau, by + 0.006 + 0.03 * tau]) {
            const r = Math.floor(rowOf(y) / 2);
            if (r >= 0 && r < rows && hash(c, r + Math.floor(t * 6)) < 1 - tau / 1.4) put(c, r, hash(c, r) < 0.5 ? WAVE : DASH, tone(R_SKY, 0.85));
          }
        }
      }
    }

    // Ruins: a broken pillar or a sword, as the screen shows it now.
    function pillar([x0, foot, crest, w, lean, D], camX) {
      const x = x0 - camX / D, h0 = Math.max(0, Math.floor(rowOf(crest - 0.03))), h1 = Math.min(H2 - 1, Math.ceil(rowOf(foot)));
      for (let h = h0; h <= h1; h++) {
        const y = Yh[h], mx = x + lean * (foot - y);
        if (y < crest - 0.03 || y > foot) continue;
        const c0 = Math.max(0, Math.floor(colOf(mx - w))), c1 = Math.min(cols - 1, Math.ceil(colOf(mx + w)));
        for (let c = c0; c <= c1; c++) {
          const u = (Xc[c] - mx) / w; // across it, -1 to 1
          if (Math.abs(u) > 1 || y < crest + 0.028 * Math.abs(Math.sin(u * 3.1 + x0 * 7))) continue; // its broken top
          lay(h * cols + c, R_MACH, 0.1 + 0.12 * smooth(-0.6, 0.9, u) + (u > 0.7 ? 0.14 : 0) + 0.04 * (hash(c, h) - 0.5), K_SOLID); // lit on its right, toward the waves
        }
      }
      if (w * FW >= 2.5) for (const f of [-0.45, 0.05, 0.5]) { // fluting down its face
        const r0 = Math.ceil(rowOf(crest + 0.05) / 2), r1 = Math.floor(rowOf(foot) / 2);
        for (let r = r0; r < r1; r++) {
          const y = (2 * r + 1) / FH - top, c = Math.floor(colOf(x + lean * (foot - y) + f * w));
          if (hash(c, r) < 0.7) put(c, r, BAR, tone(R_MACH, 0.32));
        }
      }
    }
    function sword([x0, foot, tall, lean, D], camX) {
      const x = x0 - camX / D, at = (up) => [x + lean * up, foot - up], [gx, gy] = at(tall * 0.68), [px, py] = at(tall);
      rod(x, foot, gx, gy, (p, k) => lay(p, R_MACH, 0.6 + 0.3 * k, K_SOLID)); // the blade, catching the light
      rod(gx, gy, px, py, (p) => lay(p, R_MACH, 0.2, K_SOLID)); // the grip
      const half = Math.max(1, Math.round(tall * 0.2 * FW)), cg = Math.floor(colOf(gx)), rg = Math.floor(rowOf(gy) / 2);
      for (let c = cg - half; c <= cg + half; c++) put(c, rg, c === cg ? PLUS : DASH, tone(R_MACH, 0.85), 1); // the guard
      put(Math.floor(colOf(px)), Math.floor(rowOf(py - 0.008) / 2), RING, tone(R_MACH, 0.85), 1); // the pommel
    }

    // The boat, rocking and bobbing: its hull and curled ends, the hooded
    // passengers, the one standing and the warm light held up, and their
    // dark reflection broken on the water.
    function boat(s, t, camX) {
      const bx = BOAT[0] + sailed(s) - camX, by = BOAT[1] + 0.003 * Math.sin(t * 2.1), tilt = 0.03 * Math.sin(t * 1.7 + 0.6), Lb = BOAT[2];
      const xy = (u, v) => [bx + u * Lb, by - v + u * Lb * tilt];
      const c0 = Math.max(0, Math.floor(colOf(bx - 0.56 * Lb))), c1 = Math.min(cols - 1, Math.ceil(colOf(bx + 0.56 * Lb)));
      const h0 = Math.max(0, Math.floor(rowOf(by - 0.15))), h1 = Math.min(H2 - 1, Math.ceil(rowOf(by + 0.03)));
      for (let h = h0; h <= h1; h++) for (let c = c0; c <= c1; c++) {
        const u = (Xc[c] - bx) / Lb, v = by - Yh[h] + (Xc[c] - bx) * tilt, p = h * cols + c, rim = gunwale(u);
        let l = -1;
        if (Math.abs(u) <= 0.5 && v >= -0.008 && v <= rim * (1 - 0.15 * (2 * u) ** 2)) l = rim - v < 1.1 / FH ? 0.6 : 0.08 + 0.05 * (1 - Math.abs(2 * u)); // the hull, its rim catching the light
        else if (Math.abs(u) < 0.44 && v < -0.008 && v > -0.03 && hash(c, Math.floor(h / 2 + t * 3)) < 0.75) l = Math.min(lum[p], 0.14); // its reflection
        for (const [fu, fw, fh] of FOLK) { // seated, hooded figures
          const dx = ((u - fu) * Lb) / fw, dy = (v - gunwale(fu) - fh * 0.42) / (fh * 0.58), head = Math.hypot((u - fu) * Lb, (v - gunwale(fu) - fh * 1.02) * 1.1) < fw * 0.62;
          if ((dx * dx + dy * dy < 1 && v > gunwale(fu) - 0.01) || head) l = 0.05;
        }
        if (Math.abs((u - BEARER) * Lb) < 0.0065 && v > gunwale(BEARER) - 0.01 && v < 0.07) l = 0.05; // the one standing
        if (Math.hypot((u - BEARER) * Lb, v - 0.077) < 0.0075) l = 0.05;
        if (l >= 0) lay(p, R_SKY, l, K_SOLID);
      }
      const pen = (colour) => (c, r, g) => put(c, r, g, colour, 1);
      const draw = (pts, colour) => { // a curled end: dark wood, its edge catching the light
        for (let k = 1; k < pts.length; k++) {
          const [a, b] = xy(...pts[k - 1]), [c, d] = xy(...pts[k]);
          stroke(a, b, c, d, 0.006, 0.005, (p) => lay(p, R_SKY, 0.08, K_SOLID));
          line(colOf(a), rowOf(b) / 2, colOf(c), rowOf(d) / 2, pen(colour));
        }
      };
      draw(PROW, tone(R_SKY, 0.65)); draw(STERN, tone(R_SKY, 0.6));
      const [ax, ay] = xy(BEARER, 0.066), [lx, ly] = xy(...LAMP);
      line(colOf(ax), rowOf(ay) / 2, colOf(lx), rowOf(ly) / 2, pen(tone(R_SKY, 0.12))); // the arm holding up the light
      const lc = Math.floor(colOf(lx)), lr = Math.floor(rowOf(ly) / 2);
      put(lc, lr, STAR, GOLD + NG - 1, 1);
      for (let r = Math.ceil(rowOf(by + 0.012) / 2); r < Math.min(rows, rowOf(by + 0.075) / 2); r++) if (hash(r, Math.floor(t * 5)) < 0.65) put(lc, r, r & 1 ? HIGH : COLON, GOLD + 3); // its light on the water
      for (let r = Math.max(0, Math.floor(h0 / 2)); r <= Math.min(rows - 1, Math.ceil(h1 / 2)); r++) for (let c = c0; c <= c1; c++) own[r * cols + c] = 1;
      return [lx, ly];
    }

    // The figure, on its own far layer: the halo, the ribbons, the robe, the
    // hooded head, the arm, and the staff with its glowing tip.
    const rbV = new Float32Array(N), rbU = new Float32Array(N), rbI = new Int8Array(N);
    const staff = [0, 0, 0, 0, 0], past = [0, 0, 0, 0, 0], marks = [];
    function figure(s, t, camX) {
      const g = camX / D_GIANT, pulse = 1 + 0.04 * Math.sin(t * 2.6);
      rbI.fill(-1);
      for (const [j, rb] of PATHS.entries()) { // the ribbons, a slow ripple running out along each to the left
        const pts = rb.at.map(([x, y, nx, ny], k) => { const u = k / PATH, off = rb.lift * u ** 1.1 * Math.sin(2 * Math.PI * (u * 1.6 - t * 0.3) + j * 1.7); return [x + nx * off - g, y + ny * off]; });
        for (let k = 0; k < PATH; k++) {
          const [x0, y0] = pts[k], [x1, y1] = pts[k + 1], u0 = k / PATH, u1 = (k + 1) / PATH;
          stroke(x0, y0, x1, y1, lerp(rb.w0, rb.w1, u0), lerp(rb.w0, rb.w1, u1), (p, f, v) => {
            if (rbI[p] === j && Math.abs(v) >= Math.abs(rbV[p])) return;
            rbI[p] = j; rbV[p] = v; rbU[p] = lerp(u0, u1, f);
          });
          if (rb.w0 >= 0.02 && k % 3 === 2 && hash(k, j + 5) > 0.4) { // folds along the middle of the wider ribbons
            let gl = across(Math.atan2(y1 - y0, x1 - x0));
            if (gl === DASH) gl = WAVE;
            marks.push([Math.floor(colOf((x0 + x1) / 2)), Math.floor(rowOf((y0 + y1) / 2) / 2), gl]);
          }
        }
      }
      for (let p = 0; p < N; p++) if (rbI[p] >= 0) {
        const v = rbV[p], u = rbU[p];
        lay(p, R_ROBE, 0.3 + 0.24 * (1 - v * v) + 0.12 * Math.max(0, v) - 0.1 * u + 0.08 * Math.sin(u * 23 - t * 1.4 + rbI[p] * 2) * (1 - Math.abs(v)), K_FIG);
      }
      disc(HALO[0] - g, HALO[1], HALO[2] * pulse, (p, dx, dy) => { const r = Math.hypot(dx, dy); lay(p, R_GOLD, r < 0.55 ? 1 : r < 0.85 ? 0.75 : 0.5, K_FIG); }); // the halo, round the head
      const c0 = Math.max(0, Math.floor(colOf(0.59 - g))), c1 = Math.min(cols - 1, Math.ceil(colOf(0.8 - g))), h0 = Math.max(0, Math.floor(rowOf(0.29))), h1 = Math.min(H2 - 1, Math.ceil(rowOf(0.64)));
      for (let h = h0; h <= h1; h++) for (let c = c0; c <= c1; c++) { // the robe, lit from the halo above, with folds running down and its front catching the light
        const x = Xc[c] + g, y = Yh[h], hem = 0.006 * Math.sin(x * 40 - t * 1.2) * smooth(0.5, 0.63, y);
        if (!inside(BODY, x, y + hem)) continue;
        const sheen = inside(SHEEN, x, y + hem);
        lay(h * cols + c, sheen ? R_SURF : R_ROBE, sheen ? 0.62 + 0.15 * smooth(0.6, 0.35, y) : 0.28 + 0.2 * smooth(0.62, 0.3, y) + 0.1 * Math.sin(x * 70 + y * 25 - t * 0.8), K_FIG);
      }
      disc(HOOD[0] - g, HOOD[1], HOOD[3], (p, dx, dy) => { // the hooded head, dark against the halo, its edge lit from behind: the face stays in shadow
        const x = (dx * HOOD[3]) / HOOD[2], q = x * x + dy * dy;
        if (q <= 1) lay(p, R_ROBE, q > 0.55 && x - dy > 0 ? 0.55 : 0.05, K_FIG);
      });
      staffAt(s, staff);
      const [gx, gy, a, tx, ty] = staff;
      stroke(SHOULDER[0] - g, SHOULDER[1], gx - g, gy, 0.024, 0.016, (p, f, v) => lay(p, R_ROBE, 0.34 + 0.14 * -v + 0.12 * f, K_FIG)); // the sleeve
      for (const [c, r, gl] of marks.splice(0)) if (r >= 0 && r < rows && c >= 0 && c < cols && kind[(2 * r + 1) * cols + c] === K_FIG && ramp[(2 * r + 1) * cols + c] === R_ROBE) put(c, r, gl, tone(R_ROBE, 0.95));
      // the staff, pale gold and brightest toward its glowing end; and while it sweeps, the arc its tip has just traced
      rod(gx - BUTT * Math.cos(a) - g, gy - BUTT * Math.sin(a), tx - g, ty, (p, k) => lay(p, R_GOLD, 0.35 + 0.5 * k * k, K_FIG));
      if (s > T.sweep && s < T.part + 0.15) {
        let px = tx - g, py = ty;
        for (let k = 1; k <= 14; k++) {
          const when = s - k * 0.03;
          if (when < T.sweep - 0.02) break;
          staffAt(when, past);
          const qx = past[3] - g, qy = past[4];
          line(colOf(px), rowOf(py) / 2, colOf(qx), rowOf(qy) / 2, (c, r, gl) => put(c, r, gl, GOLD + NG - 1 - Math.min(3, k >> 2), k < 6 ? 1 : 0));
          px = qx; py = qy;
        }
      }
      disc(gx - g, gy, 0.014, (p, dx, dy) => lay(p, R_SKIN, 0.75 - 0.3 * (dx + dy), K_FIG)); // the hand, round the staff
      disc(tx - g, ty, 0.011 * (1 + 0.5 * glowAt(s)), (p) => lay(p, R_GOLD, 1, K_FIG));
      put(Math.floor(colOf(tx - g)), Math.floor(rowOf(ty) / 2), STAR, GOLD + NG - 1, 1);
    }

    // Light: the halo, the staff's glowing tip, the small orb in the
    // machinery and the boat's lamp brighten what is round them within its own
    // colours, and turn only their middles gold.
    function glow(x, y, rad, lift, core) {
      disc(x, y, rad, (p, dx, dy) => { const q = dx * dx + dy * dy; lum[p] += (1 - lum[p]) * lift * Math.exp(-3 * q); if (q < core * core) warm[p] = Math.max(warm[p], 1 - q / (core * core)); });
    }
    function lights(s, t, camX, lamp) {
      const g = camX / D_GIANT, k = glowAt(s) * (1 + 0.08 * Math.sin(t * 3.1 + 1));
      glow(HALO[0] - g, HALO[1], HALO[2] * 2.4, 0.3, 0);
      glow(staff[3] - g, staff[4], 0.06 + 0.07 * k, 0.5 * k, 0.25 * k);
      glow(WHEELS[ORB][0] - camX / D_RINGS, WHEELS[ORB][1], 0.07, 0.4, 0);
      glow(lamp[0], lamp[1], 0.04, 0.45, 0.3);
    }

    // Light and shade into colours: each half cell takes the step of its ramp
    // its lightness falls on, dithered by the grain; where the light on it is
    // warm and bright, the gold ramp instead.
    function colour() {
      for (let p = 0; p < N; p++) {
        const l = lum[p], d = thr[p];
        if (warm[p] > 0.45 + 0.1 * d && l > 0.72) { paint[p] = GOLD + Math.min(NG - 1, 4 + Math.floor(((l - 0.72) / 0.28) * (NG - 5) + d)); continue; } // only the palest golds: the light is soft
        const [base, n] = RAMPS[ramp[p]];
        paint[p] = base + Math.max(0, Math.min(n - 1, Math.floor(l * (n - 1) + d)));
      }
    }

    function floating(t, camX) { // points of light in the air
      for (const [x, y, D, vx, vy, ph, gold] of motes) {
        const c = Math.floor(colOf(x + vx * t - camX / D)), h = Math.floor(rowOf(y + vy * t + 0.006 * Math.sin(t * 1.3 + ph))), r = h >> 1;
        if (c < 0 || c >= cols || h < 0 || h >= H2 || r >= rows || own[r * cols + c]) continue;
        const k = kind[h * cols + c];
        if (k !== K_SKY && k !== K_SMOKE && k !== K_RING && k !== K_WAVE && k !== K_LIGHT) continue;
        put(c, r, Math.sin(t * 3 + ph * 3) > 0.6 ? STAR : h & 1 ? DOT : HIGH, gold ? GOLD + 5 : SURF + NW - 1);
      }
    }

    // The handover. The parted waves billow out into lavender-white cloud
    // that rolls in from the top and from the right, over everything but a
    // pocket round the boat, which then closes; then the cloud thins away to
    // the page from the edges in, and the boat's light goes last.
    // The cloud's own texture, with room to drift left and down as it rolls
    // in, and a little more above, to find the tops of its billows.
    const VX = Math.ceil(0.1 * FW) + 1, VY = Math.ceil(0.06 * FH) + 1, LR = Math.max(1, Math.round(0.03 * FH)), VW = cols + VX;
    const veilN = new Float32Array(VW * (H2 + VY + LR));
    for (let h = 0, p = 0; h < H2 + VY + LR; h++) for (let i = 0; i < VW; i++, p++) veilN[p] = 0.65 * noise((i / FW) * 6 + 50, (h / FH) * 6) + 0.35 * noise((i / FW) * 13 + 9, (h / FH) * 13);
    function handover(s, t, lamp) {
      if (s < T.billow) return;
      const W = cols / FW, Ht = H2 / FH, come = smooth(T.billow, T.thin + 0.05, s), thin = (s - T.thin) / (T.end - 0.12 - T.thin);
      const reachT = come * (Ht + 0.35) - 0.12, reachR = come * (W * 0.85 + 0.35) - 0.12; // how far each front has come, in frame heights
      const pocket = BOAT[2] * 0.85 * (1 - smooth(T.thin - 0.45, T.thin, s)); // the clear space round the boat, closed before the cloud thins
      const roll = t * 0.9, go = clamp01((s - T.billow) / (T.end - T.billow)), ox = Math.round(go * (VX - 1)), oy = VY - 1 - Math.round(go * (VY - 1));
      for (let h = 0, p = 0; h < H2; h++) {
        const fromTop = (h + 0.5) / FH, fixed = (h + LR + VY - 1) * VW, moving = (h + LR + oy) * VW + ox;
        for (let c = 0; c < cols; c++, p++) {
          const fromRight = (cols - c - 0.5) / FW, n = veilN[fixed + c];
          const billowT = 0.07 * Math.abs(Math.sin((c / FW) * 9 + roll + n * 2)), billowR = 0.07 * Math.abs(Math.sin(fromTop * 9 - roll + n * 2));
          const into = Math.max(reachT - fromTop + billowT, reachR - fromRight + billowR); // how far inside the cloud, from its rolling edge
          if (into <= 0) continue;
          const x = Xc[c], y = Yh[h];
          if (pocket > 0 && Math.hypot(x - lamp[0] + 0.03, (y - lamp[1] - 0.06) * 1.7) < pocket * (0.85 + 0.25 * n)) continue;
          const i = (h >> 1) * cols + c;
          if (thin > 0) {
            const far = Math.min(1, Math.hypot(x - lamp[0], y - lamp[1]) / (0.9 * Math.max(W, Ht) / 2));
            const a = 1 - smooth(1 - far - 0.12 + 0.2 * (n - 0.5), 1.12 - far + 0.2 * (n - 0.5), thin * 1.25);
            if (a < 1) { const lv = Math.floor(a * 10 + order[p]); paint[p] = lv > 0 ? THIN + Math.min(10, lv) : 0; glyph[i] = 32; continue; }
          }
          const m = veilN[moving + c], rise = m - veilN[moving + c - LR * VW]; // rise: the texture thickening downward, the top of a billow
          const billows = 0.68 + 0.22 * smooth(0.32, 0.68, m) + Math.max(-0.1, Math.min(0.1, rise * 1.6)); // white on the billows' tops, lavender beneath them
          const l = lerp(0.86, billows, 1 - clamp01(thin * 1.6)) - 0.24 * Math.exp(-into / 0.03); // evening out to the thinning cloud's own pale tone; lavender in the rolling edge
          paint[p] = SURF + Math.max(0, Math.min(NW - 1, Math.floor(l * (NW - 1) + thr[p])));
          if (h & 1) { glyph[i] = into < 0.06 && hash(Math.floor(c / 3 + roll * 3), h) < 0.12 ? WAVE : 32; ink[i] = SURF + 8; }
        }
      }
      // The light, glowing through the cloud, and last of all on its own.
      const lc = Math.floor(colOf(lamp[0])), lr = Math.floor(rowOf(lamp[1]) / 2);
      if (lc >= 0 && lc < cols && lr >= 0 && lr < rows && s < T.end - 0.06) {
        const late = s > T.end - 0.22;
        put(lc, lr, late ? (s > T.end - 0.13 ? DOT : PLUS) : STAR, GOLD + NG - 1, late ? 0 : 1);
        if (!late) for (const dh of [0, 1]) { const p = (2 * lr + dh) * cols + lc; if (paint[p]) paint[p] = GOLD + 3; }
      }
    }

    return {
      cols, rows, palette: INK, glyph, ink, bold, paint,
      render(t) { // t: seconds since the animation started
        glyph.fill(32); ink.fill(0); bold.fill(0); paint.fill(0); warm.fill(0); own.fill(0);
        if (t >= LENGTH) return this; // over: nothing is left on the page
        const s = t * SPEED, camX = camAt(s); // s: where that is in the story
        sky(t); rings(t, camX); smoke(t, camX);
        waves(s, t, camX);
        water(s, t, camX, BOAT[0] + sailed(s) - camX);
        for (const q of pillars) if (q[5] > 1) pillar(q, camX);
        figure(s, t, camX);
        const lamp = boat(s, t, camX);
        for (const q of pillars) if (q[5] <= 1) pillar(q, camX);
        for (const q of swords) sword(q, camX);
        lights(s, t, camX, lamp);
        colour();
        floating(t, camX);
        handover(s, t, lamp);
        return this;
      },
    };
  }

  // Play it on the stage. Resolves when it has finished. `seed` changes the
  // details, not the layout: the curls along the rims of the waves and those
  // beyond the frame, the stars, the flowers' lie, the points of light and the
  // ruins off to the sides. `freezeAt` holds one moment (in seconds) on screen
  // instead of playing. Reduced motion holds the boat gliding into the open
  // channel.
  const film = { length: LENGTH, still: 8.4 / SPEED, createScene };
  return { play: (options) => AsciiStage.play(film, options), createScene };
})();
