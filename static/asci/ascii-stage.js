/*
 * The stage: plays an ASCII film on a canvas laid over the whole page, then
 * takes the canvas away to show the page underneath.
 *
 *   <script src="ascii-stage.js"></script>
 *   <script src="plum-blossom.js"></script>
 *   <script>PlumBlossom.play().then(showThePage);</script>
 *
 * A film is a moving picture as a pure function of time, set on a grid of
 * character cells:
 *
 *   { length,        how many seconds it lasts on screen
 *     still,         the moment to hold for a viewer who has asked for reduced motion
 *     grid,          [columns, rows] the type is sized to give at least (default [110, 44])
 *     createScene }  ({ cols, rows, aspect, ...options }) => a scene made for that grid;
 *                    `aspect` is how many times taller a cell is than it is wide
 *
 * scene.render(t), with t in seconds from the start, returns a frame:
 *
 *   { cols, rows,
 *     palette,   CSS colours. Everything below is an index into it, and 0 means nothing there
 *     glyph,     the character in each cell, as a char code (32, a space, is no character)
 *     ink,       the colour of that character
 *     bold,      1 where the character is set bold (optional)
 *     paint,     the colour behind each half of each cell: cols x (rows * 2), top halves on
 *                the even lines, so the half of cell (c, r) is at (r * 2 + half) * cols + c (optional)
 *     wash,      a colour laid over the whole cell, above the paint and under the character (optional)
 *     veil }     a colour laid over the whole cell and everything in it (optional)
 *
 * All but paint are cols x rows, row by row. Where a cell has nothing in it
 * the page shows through. The palette is read every frame, so a film may
 * change its colours as it goes, and a colour may be translucent.
 */
const AsciiStage = (() => {
  'use strict';

  const FONT = '"Cascadia Mono", "Cascadia Code", Consolas, "SF Mono", Menlo, "DejaVu Sans Mono", "Liberation Mono", monospace';
  const LEADING = 1.18;

  // What films are made with.
  const code = (s) => [...s].map((c) => c.charCodeAt(0));
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const lerp = (a, b, k) => a + (b - a) * k;
  const smooth = (a, b, x) => { const k = clamp01((x - a) / (b - a)); return k * k * (3 - 2 * k); };
  const mulberry32 = (a) => () => { // a random source that gives the same numbers for the same seed
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const hash = (x, y) => { // 0 to 1, fixed for each pair of whole numbers
    let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
  };
  const noise = (x, y) => { // 0 to 1, smooth in x and y
    const xi = Math.floor(x), yi = Math.floor(y), u = smooth(0, 1, x - xi), v = smooth(0, 1, y - yi);
    return lerp(lerp(hash(xi, yi), hash(xi + 1, yi), u), lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u), v);
  };

  // Play a film, then remove the canvas. Resolves when it has finished.
  // `freezeAt` holds one moment (in seconds) on screen instead of playing.
  // `signal`, an AbortSignal, ends the film early: when it aborts, the canvas
  // goes at once. Every other option is handed to the film's createScene.
  function play(film, { freezeAt = null, signal = null, ...options } = {}) {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:2147483647';
    (document.body || document.documentElement).appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const chars = Array.from({ length: 256 }, (_, i) => String.fromCharCode(i));
    const lists = Array.from({ length: 512 }, () => []); // cells by the colour of their character: regular weight, then bold
    let scene, cw, ch, half, font, baseline;

    function layout() {
      const dpr = window.devicePixelRatio || 1, [wide, high] = film.grid || [110, 44];
      const W = (canvas.width = Math.round(canvas.clientWidth * dpr)), H = (canvas.height = Math.round(canvas.clientHeight * dpr));
      ctx.font = `100px ${FONT}`;
      const advance = ctx.measureText('M').width / 100;
      // Type as large as still gives the film its rows and columns, within 8 to
      // 26px; a narrow phone goes below 8px rather than drop under 64 columns.
      const px = Math.min(26 * dpr, Math.max(Math.min(H / high / LEADING, W / wide / advance), Math.min(8 * dpr, W / 64 / advance)));
      cw = Math.max(1, Math.round(px * advance));
      ch = Math.max(1, Math.round(px * LEADING));
      half = Math.round(ch / 2); // whole pixels, so the two halves of a cell meet without a seam
      font = `${px}px ${FONT}`;
      ctx.font = font;
      const m = ctx.measureText('|');
      baseline = (ch + m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2;
      scene = film.createScene({ ...options, cols: Math.ceil(W / cw), rows: Math.ceil(H / ch), aspect: ch / cw });
    }

    // Lay down one layer of colour, as runs of one colour along each line.
    function fill(layer, palette, cols, lines, halves) {
      for (let l = 0; l < lines; l++) {
        const y = halves ? (l >> 1) * ch + (l & 1) * half : l * ch, tall = !halves ? ch : l & 1 ? ch - half : half;
        for (let c = 0, e; c < cols; c = e) {
          const k = layer[l * cols + c];
          for (e = c + 1; e < cols && layer[l * cols + e] === k; e++);
          if (k && palette[k]) { ctx.fillStyle = palette[k]; ctx.fillRect(c * cw, y, (e - c) * cw, tall); }
        }
      }
    }

    function draw(t) {
      const { cols, rows, palette, glyph, ink, bold, paint, wash, veil } = scene.render(t);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (paint) fill(paint, palette, cols, rows * 2, true);
      if (wash) fill(wash, palette, cols, rows, false);
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      for (const list of lists) list.length = 0;
      for (let i = 0; i < glyph.length; i++) if (glyph[i] > 32) lists[ink[i] + (bold && bold[i] ? 256 : 0)].push(i);
      for (let weight = 0; weight < 2; weight++) { // characters, one weight and colour at a time
        ctx.font = (weight ? 'bold ' : '') + font;
        for (let k = 1; k < 256; k++) {
          const list = lists[weight * 256 + k];
          if (!list.length || !palette[k]) continue;
          ctx.fillStyle = palette[k];
          for (const i of list) ctx.fillText(chars[glyph[i]], ((i % cols) + 0.5) * cw, ((i / cols) | 0) * ch + baseline);
        }
      }
      if (veil) fill(veil, palette, cols, rows, false);
    }

    return new Promise((resolve) => {
      let t = 0, before = 0, drawn = 0, raf = 0, done = false;
      const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const still = freezeAt ?? (calm ? film.still ?? film.length / 2 : null); // the one moment to hold, if there is one
      const finish = () => { done = true; cancelAnimationFrame(raf); removeEventListener('resize', onResize); signal?.removeEventListener('abort', finish); canvas.remove(); resolve(); };
      const safely = (job) => { try { job(); } catch (error) { console.error(error); finish(); } }; // a film that fails must not be left covering the page
      const onResize = () => safely(() => { layout(); draw(still ?? t); });
      addEventListener('resize', onResize);
      signal?.addEventListener('abort', finish);
      if (signal?.aborted) finish(); else onResize();
      if (done || freezeAt !== null) return;
      if (calm) { // reduced motion: one moment of the film, held still, then faded out
        canvas.style.transition = 'opacity .8s';
        setTimeout(() => { canvas.style.opacity = 0; setTimeout(finish, 800); }, 1800);
        return;
      }
      const frame = (now) => {
        t += Math.min((now - (before || now)) / 1000, 0.1); // a hidden tab pauses instead of skipping ahead
        before = now;
        if (t >= film.length) return finish();
        if (now - drawn > 12) { drawn = now; safely(() => draw(t)); } // about 60 frames a second
        if (!done) raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    });
  }

  return { play, code, clamp01, lerp, smooth, mulberry32, hash, noise };
})();
