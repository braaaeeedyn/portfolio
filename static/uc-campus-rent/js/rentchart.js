// The rent chart: an SVG of the ring's median rent and, when a forecast exists, a typical ring ZIP's 80% range with
// its median, fanning out from the last observed month. It redraws to its width whenever that changes
// (ResizeObserver: resizes and rotations). A tooltip shows a month's values on hover, on tap and with the arrow keys;
// focus starts at the latest month. The returned setRange() and setForecast() let the page's buttons zoom to the last
// few years and hide the forecast. The SVG is built as markup (the HTML parser gives it its namespace); every value
// in it is a number.
import { bandPath, linePath, monthIndex, niceTicks, scaleLinear, tickCount } from "./util/chart.js";
import { el, money, month } from "./common.js";

const LABEL_GAP = 48; // px between year labels at least

/** The chart's points in month order: observed {rent} and forecast {lo, mid, hi}. */
export function points(doc) {
  const seen = doc.series
    .filter((r) => Number.isFinite(r.ring_median_rent))
    .map((r) => ({ month: r.month, x: monthIndex(r.month), rent: r.ring_median_rent, zips: r.zips_reporting }));
  const ahead = (doc.band ?? []).map((b) => ({ month: b.month, x: monthIndex(b.month), lo: b.p10, mid: b.p50, hi: b.p90, zips: b.zips }));
  return [...seen, ...ahead];
}

export function rentChart(host, doc) {
  const all = points(doc);
  const box = host.querySelector("[data-svg]");
  const tip = host.querySelector("[data-tooltip]");
  const now = all.findLast((p) => "rent" in p);
  let months = null; // how far back to show; null is everything
  let forecast = true;
  let pts = all;
  let latest = 0;
  let M = { top: 24, right: 16, bottom: 32, left: 64 };
  let x = null;
  let y = null;
  let width = 0;
  let height = 0;
  let active = null;

  function draw() {
    width = Math.floor(box.clientWidth);
    pts = all.filter((p) => (months === null || !now || p.x >= now.x - months) && (forecast || "rent" in p));
    if (!width || !pts.length) return;
    latest = pts.findLastIndex((p) => "rent" in p);
    M = { top: 24, right: 16, bottom: 32, left: width < 480 ? 52 : 64 };
    height = Math.round(Math.min(420, Math.max(240, width * 0.42)));
    const values = pts.flatMap((p) => [p.rent, p.lo, p.hi]).filter(Number.isFinite);
    const ticks = niceTicks(Math.min(...values), Math.max(...values), tickCount(width));
    x = scaleLinear([pts[0].x, pts.at(-1).x], [M.left, width - M.right]);
    y = scaleLinear([ticks[0], ticks.at(-1)], [height - M.bottom, M.top]);
    const floor = height - M.bottom;
    const parts = ticks.map(
      (t) =>
        `<line class="chart__grid" x1="${M.left}" x2="${width - M.right}" y1="${y(t)}" y2="${y(t)}"/>` +
        `<text class="chart__tick" x="${M.left - 8}" y="${y(t)}" text-anchor="end" dominant-baseline="middle">${money(t)}</text>`,
    );
    const perYear = (12 * (width - M.left - M.right)) / Math.max(1, pts.at(-1).x - pts[0].x);
    const every = Math.max(1, Math.ceil(LABEL_GAP / perYear));
    for (let year = Math.ceil(pts[0].x / 12); year * 12 <= pts.at(-1).x; year += every) {
      parts.push(`<text class="chart__tick" x="${x(year * 12)}" y="${height - 8}" text-anchor="middle">${year}</text>`);
    }
    const seen = pts.filter((p) => "rent" in p);
    const ahead = pts.filter((p) => "mid" in p);
    if (seen.length > 1) {
      const line = seen.map((p) => `${x(p.x).toFixed(1)},${y(p.rent).toFixed(1)}`).join("L");
      parts.push(`<path class="chart__area" d="M${x(seen[0].x).toFixed(1)},${floor}L${line}L${x(seen.at(-1).x).toFixed(1)},${floor}Z"/>`);
    }
    if (ahead.length) {
      // the forecast starts at the last observed rent, so the fan opens from the line instead of floating beside it
      const fan = seen.length ? [{ x: seen.at(-1).x, lo: seen.at(-1).rent, mid: seen.at(-1).rent, hi: seen.at(-1).rent }, ...ahead] : ahead;
      parts.push(`<path class="chart__band" d="${bandPath(fan, x, y)}"/>`);
      parts.push(`<path class="chart__p50" d="${linePath(fan.map((p) => ({ x: p.x, y: p.mid })), x, y)}"/>`);
      const mid = (x(fan[0].x) + x(fan.at(-1).x)) / 2;
      parts.push(`<text class="chart__tick chart__flag" x="${mid}" y="${M.top - 10}" text-anchor="middle">Forecast</text>`);
    }
    parts.push(`<path class="chart__rent" pathLength="1" d="${linePath(seen.map((p) => ({ x: p.x, y: p.rent })), x, y)}"/>`);
    if (seen.length) parts.push(`<circle class="chart__now" cx="${x(seen.at(-1).x)}" cy="${y(seen.at(-1).rent)}" r="5"/>`);
    box.innerHTML =
      `<svg class="chart__svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true" ` +
      `focusable="false">${parts.join("")}<g data-guide></g></svg>`;
    if (active !== null) show(active);
  }

  function show(i) {
    if (!x) return;
    active = Math.max(0, Math.min(pts.length - 1, i));
    const p = pts[active];
    const px = x(p.x);
    const value = "rent" in p ? p.rent : p.mid;
    box.querySelector("[data-guide]").innerHTML =
      `<line class="chart__guide" x1="${px}" x2="${px}" y1="${M.top}" y2="${height - M.bottom}"/>` +
      `<circle class="chart__dot" cx="${px}" cy="${y(value)}" r="5"/>`;
    const lines =
      "rent" in p
        ? [`Typical rent ${money(p.rent)}`, `from ${p.zips} ZIP codes`]
        : [`Best guess ${money(p.mid)}`, `likely between ${money(p.lo)} and ${money(p.hi)}`];
    tip.replaceChildren(el("strong", {}, month(p.month)), ...lines.flatMap((line) => [el("br"), line]));
    tip.hidden = false;
    tip.style.left = `${Math.max(0, Math.min(width - tip.offsetWidth, px - tip.offsetWidth / 2))}px`;
    tip.style.top = y(value) < height / 2 ? `${height - M.bottom - tip.offsetHeight - 8}px` : "0px";
  }

  function hide() {
    active = null;
    tip.hidden = true;
    box.querySelector("[data-guide]")?.replaceChildren();
  }

  function nearest(clientX) {
    const at = clientX - box.getBoundingClientRect().left;
    let best = 0;
    pts.forEach((p, i) => {
      if (Math.abs(x(p.x) - at) < Math.abs(x(pts[best].x) - at)) best = i;
    });
    return best;
  }

  /** Plays the line drawing itself once (the CSS animates while the class is on). */
  function play() {
    host.classList.remove("chart--draw");
    void host.offsetWidth;
    host.classList.add("chart--draw");
    setTimeout(() => host.classList.remove("chart--draw"), 1900);
  }

  host.addEventListener("pointermove", (e) => x && show(nearest(e.clientX)));
  host.addEventListener("pointerdown", (e) => x && show(nearest(e.clientX)));
  host.addEventListener("pointerleave", (e) => e.pointerType === "mouse" && hide());
  host.addEventListener("focus", () => active === null && show(latest));
  host.addEventListener("blur", hide);
  host.addEventListener("keydown", (e) => {
    const moves = { ArrowLeft: (active ?? latest) - 1, ArrowRight: (active ?? latest) + 1, Home: 0, End: pts.length - 1 };
    if (e.key in moves) show(moves[e.key]);
    else if (e.key === "Escape") hide();
    else return;
    e.preventDefault();
  });
  draw(); // the first draw now, so withRetry marks the page ready only once the chart is there
  new ResizeObserver(() => requestAnimationFrame(draw)).observe(box);

  const redraw = () => {
    hide();
    draw();
    play();
  };
  return {
    play,
    setRange(m) {
      months = m;
      redraw();
    },
    setForecast(on) {
      forecast = on;
      redraw();
    },
  };
}
