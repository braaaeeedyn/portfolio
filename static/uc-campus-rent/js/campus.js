// A campus page, campus.html?c=<id>, from data/<id>.json. It reads top to bottom as a short story for someone new to
// the subject: the price, the trend and its forecast, whether the price is fair, who can afford it, what is being
// built, and what the campus's own housing openings did to rent. Each chapter shows only when its numbers exist.
// An id that isn't in data/summary.json gets a friendly page with links.
import { THEMES, bar, capShelf, change, count, countUp, drawTitle, el, footer, getJSON, mascot, money, month, onView, progress, reveals, share, withRetry } from "./common.js";
import { dogBeside } from "./dog.js";
import { rentChart } from "./rentchart.js";

const $ = (selector) => document.querySelector(selector);
const id = new URLSearchParams(location.search).get("c");
if (id in THEMES) document.documentElement.dataset.campus = id;

/** The last row of the series with a value for key, or null. */
const latest = (series, key) => series.findLast((r) => Number.isFinite(r[key])) ?? null;
const pct = (v) => `${Math.abs(v * 100).toFixed(1)}%`;
const fall = (iso) => (+iso.slice(5, 7) >= 9 ? +iso.slice(0, 4) : +iso.slice(0, 4) - 1);
const p = (...parts) => el("p", {}, ...parts);
const b = (text) => el("strong", {}, text);
const explain = (title, ...parts) => el("div", { class: "explain" }, el("h3", {}, title), p(...parts));

let shown = 0;
/** Unhides a chapter, numbers it and gives every second one the tinted background. Returns [section, heading nodes]. */
function open(name, kicker, title) {
  const section = $(`[data-ch="${name}"]`);
  shown += 1;
  section.classList.toggle("chapter--alt", shown % 2 === 0);
  section.hidden = false;
  return [section, [el("p", { class: "kicker" }, el("span", { class: "kicker__n" }, String(shown)), kicker), el("h2", {}, title)]];
}

function fill(section, text, viz) {
  section.querySelector("[data-text]").replaceChildren(...text.filter(Boolean));
  if (viz) section.querySelector("[data-viz]").replaceChildren(...viz.filter(Boolean));
}

function nav(summary) {
  $("[data-nav]").replaceChildren(
    ...summary.campuses.map((c) =>
      el("li", {}, el("a", { href: `campus.html?c=${encodeURIComponent(c.id)}`, "aria-current": c.id === id ? "page" : null }, // every campus by its place: "UC Irvine" is Irvine, and UCLA is Los Angeles
        c.name.startsWith("UC ") ? c.name.slice(3) : c.city)),
    ),
  );
}

// a pixel person, front on: K outline, H hair, S skin, Y eye, C shirt, P trousers
const PERSON = ["..KKKK..", ".KHHHHK.", ".KSSSSK.", ".KYSSYK.", ".KSSSSK.", "..KKKK..", ".KCCCCK.", "KSCCCCSK", "KKCCCCKK", ".KPPPPK.", ".KPKKPK.", ".KK..KK."];
const LOOKS = [
  ["#3b2a1a", "#f0c7a0"],
  ["#1b1b2a", "#c68a5a"],
  ["#c9772e", "#f6d7b8"],
  ["#e8c15a", "#8d5a3a"],
]; // hair, skin

/** The `i`th person splitting the rent, drawn small (the CSS enlarges it), in a shirt of one of the campus's colours. */
function person(i) {
  const theme = getComputedStyle(document.documentElement);
  const [hair, skin] = LOOKS[i % LOOKS.length];
  const pal = { K: "#1b1b2a", Y: "#1b1b2a", H: hair, S: skin, C: theme.getPropertyValue(i % 2 ? "--pop" : "--brand").trim(), P: "#3f3f4c" };
  const canvas = el("canvas", { width: PERSON[0].length, height: PERSON.length });
  const ctx = canvas.getContext("2d");
  PERSON.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === ".") return;
      ctx.fillStyle = pal[ch];
      ctx.fillRect(x, y, 1, 1);
    }),
  );
  return canvas;
}

function unknown(summary) {
  document.title = "No such campus | UC Campus Rent";
  $("[data-title]").textContent = "We don't have a page for that campus";
  $("[data-lede]").textContent = "UC Campus Rent follows eight University of California campuses, and this isn't one of them. Pick one, or go back home.";
  const links = [...summary.campuses.map((c) => [`campus.html?c=${encodeURIComponent(c.id)}`, c.name]), ["./", "Home"]];
  $(".intro").append(el("nav", { "aria-label": "All campuses" }, el("ul", { class: "links" }, ...links.map(([href, name]) => el("li", {}, el("a", { href }, name))))));
  footer(summary);
}

function hero(doc) {
  $("[data-eyebrow]").textContent = `${doc.city}, California`;
  $("[data-eyebrow]").hidden = false;
  $("[data-title]").textContent = doc.name;
  drawTitle($("[data-title]"));
  $("[data-lede]").textContent =
    `Thinking about living near ${doc.name}? This page walks you through what rent costs around campus, how that compares, ` +
    "who can afford it and where it's likely headed. You don't need to know anything about housing to follow along.";
  const r = latest(doc.series, "ring_median_rent");
  if (r) {
    countUp($("[data-hero-rent]"), r.ring_median_rent, money);
    $("[data-hero-sub]").textContent = `the typical rent near campus in ${month(r.month)}`;
    $("[data-hero]").hidden = false;
    $("[data-cue]").hidden = false;
  }
  if (THEMES[doc.campus]) {
    mascot($("[data-mascot]"), doc.campus, $("[data-cheer]"));
    capShelf($("[data-mascotbox]"), Object.keys(THEMES));
    $("[data-mascotbox]").hidden = false;
  }
}

function price(doc) {
  const r = latest(doc.series, "ring_median_rent");
  if (!r) return;
  const [section, head] = open("price", "The price", "What does it cost to live near campus?");
  const rented = doc.ring_zips.filter((z) => !doc.campus_only.includes(z));
  const yoy = Number.isFinite(r.ring_rent_yoy) ? r.ring_rent_yoy : null;
  const before = yoy === null ? null : r.ring_median_rent / (1 + yoy);
  const text = [
    ...head,
    p(
      "About ",
      b(`${money(r.ring_median_rent)} a month`),
      `. That was the typical rent in ${month(r.month)} across the ZIP codes around ${doc.name} where students rent: those about 3 miles (5 km) or less from campus, adjusted by hand to add student neighborhoods farther out and drop places where students don't rent. This site calls that area `,
      b("the ring"),
      `. ${r.zips_reporting} of the ring's ZIP codes had rent data that month.`,
    ),
    explain(
      "What “typical” means here",
      "It's a median. Line the ZIP codes up by rent, cheapest first, and take the one in the middle; half cost more, half cost less. One very expensive ZIP code can't drag a median upward the way it would an average. The rents come from Zillow, which tracks what landlords ask for in new listings.",
    ),
    explain(
      "Why you'd care",
      "This is the number to budget against. It blends studios with bigger places, so your own rent will land above or below it depending on what you're after, but it tells you what kind of market you're walking into.",
    ),
    yoy !== null &&
      explain(
        "Compared with a year ago",
        `Rent is ${yoy >= 0 ? "up" : "down"} ${pct(yoy)}, which works out to about ${money(Math.abs(r.ring_median_rent - before))} ${yoy >= 0 ? "more" : "less"} every month on a typical place. Landlords usually reset the price when a lease ends, so this is a preview of what a renewal letter might say.`,
      ),
  ];
  const top = Math.max(r.ring_median_rent, before ?? 0);
  const viz = [
    yoy !== null &&
      el(
        "div",
        { class: "panel" },
        el("span", { class: "panel__title" }, "One year of change"),
        el(
          "div",
          { class: "bars" },
          bar("A year earlier", money(before), (before / top) * 100, { kind: "bar--soft" }),
          bar(month(r.month), money(r.ring_median_rent), (r.ring_median_rent / top) * 100, { i: 1 }),
        ),
        el("span", { class: "pill" }, `${change(yoy)} in 12 months`),
      ),
    el(
      "div",
      { class: "panel" },
      el("span", { class: "panel__title" }, `The ring's ${doc.ring_zips.length} ZIP codes`),
      el(
        "ul",
        { class: "chips" },
        ...[...rented, ...doc.campus_only].map((z, i) => {
          const chip = el("li", { class: doc.campus_only.includes(z) ? "chip chip--quiet" : "chip" }, z);
          chip.style.setProperty("--i", i);
          return chip;
        }),
      ),
      doc.campus_only.length
        ? el("span", { class: "small" }, `The outlined ${doc.campus_only.length === 1 ? "one is" : "ones are"} the campus itself, where nobody lists apartments, so there's no rent to report.`)
        : null,
    ),
  ];
  fill(section, text, viz);
}

function trend(doc) {
  const first = doc.series.find((r) => Number.isFinite(r.ring_median_rent));
  if (!first) return;
  const [section, head] = open("trend", "The trend", "Where has rent been, and where is it heading?");
  dogBeside(
    section.querySelector("[data-text]"),
    doc.campus,
    [
      "Run your mouse or finger along the line in the chart below. Every month has its own number.",
      "Press the 2 years button to zoom in. Small moves that vanish over a decade show up once you're close.",
      doc.band
        ? "The forecast fan widens as it goes, because a guess about next month is safer than a guess about a year from now."
        : "This campus has no forecast yet, so the chart stops at the last month with real data.",
      "Compare the slope, not only the height. A steep stretch means rent was climbing fast in those months.",
    ],
  );
  const end = doc.band?.at(-1);
  fill(section, [
    ...head,
    p(`The line is that same typical rent, month by month, going back to ${month(first.month)}. Hover over it, tap it, or use your arrow keys to read off any month. The buttons zoom in on recent years.`),
    end &&
      explain(
        "Reading the forecast",
        `The coloured fan on the right is a forecast for the next 12 months. Nobody knows next year's rent, so the forecast gives a range instead of a single number: for a typical ZIP code in the ring, rent should land inside the fan about 8 times in 10. The line through its middle is the best single guess, which reaches ${money(end.p50)} by ${month(end.month)}.`,
      ),
    end &&
      explain(
        "Why you'd care",
        "A 12-month lease signed today comes up for renewal right where the fan ends. Its width tells you how much of a surprise to leave room for.",
      ),
  ]);

  const keys = [
    ["key-rent", "Typical rent near campus"],
    doc.band ? ["key-band", "Forecast range"] : null,
    doc.band ? ["key-guess", "Forecast best guess"] : null,
  ].filter(Boolean);
  $("[data-legend]").replaceChildren(...keys.map(([key, text]) => el("li", {}, el("i", { class: key, "aria-hidden": "true" }), text)));
  const note = $("[data-band-note]");
  note.classList.toggle("small", Boolean(doc.band));
  note.textContent = doc.band
    ? `For the detail-minded: the forecast was made with data through ${month(doc.band_origin)}. Each month, every ZIP code in the ring gets its own 10th, 50th and 90th percentile, and the fan shows the median of each across the ring.`
    : doc.band_reason;
  const head2 = ["Month", "Typical rent", "ZIP codes", "Year on year", "Forecast best guess", "Forecast range"];
  const ahead = [...(doc.band ?? [])].reverse().map((r) => [month(r.month), "", count(r.zips), "", money(r.p50), `${money(r.p10)} to ${money(r.p90)}`]);
  const seen = [...doc.series].reverse().map((r) => [month(r.month), money(r.ring_median_rent), count(r.zips_reporting), change(r.ring_rent_yoy), "", ""]);
  $("[data-table]").replaceChildren(
    el("thead", {}, el("tr", {}, ...head2.map((h) => el("th", { scope: "col" }, h)))),
    el("tbody", {}, ...[...ahead, ...seen].map(([month1, ...cells]) => el("tr", {}, el("th", { scope: "row" }, month1), ...cells.map((c) => el("td", {}, c))))),
  );

  const chart = rentChart($("[data-chart]"), doc);
  onView($("[data-chart]"), chart.play, 0.4);
  const range = $("[data-range]");
  range.addEventListener("click", (e) => {
    const button = e.target.closest("button");
    if (!button) return;
    for (const other of range.querySelectorAll("button")) other.setAttribute("aria-pressed", String(other === button));
    chart.setRange(button.dataset.months ? +button.dataset.months : null);
  });
  const toggle = $("[data-forecast]");
  toggle.hidden = !doc.band;
  toggle.addEventListener("click", () => {
    const on = toggle.getAttribute("aria-pressed") !== "true";
    toggle.setAttribute("aria-pressed", String(on));
    chart.setForecast(on);
  });
}

function fair(doc) {
  const r = latest(doc.series, "ring_median_rent");
  const hud = latest(doc.series, "rent_vs_fmr");
  const city = latest(doc.series, "rent_vs_city");
  if (!r || (!hud && !city)) return;
  const [section, head] = open("fair", "The comparison", "Is that a fair price?");
  const side = (v) => (v < 0 ? "below" : "above");
  const text = [
    ...head,
    p("A price means little by itself, so here it is next to two yardsticks."),
    hud &&
      explain(
        "HUD's fair market rent",
        `HUD is the federal housing department. Every year it publishes a fair market rent for each area: its estimate of what a modest two-bedroom costs with utilities included. Housing voucher programs use that figure to decide how much rent they'll cover. Near ${doc.name}, typical rent sits ${pct(hud.rent_vs_fmr)} ${side(hud.rent_vs_fmr)} HUD's ${money(hud.fmr_2br)}. One caution: our number covers every apartment size and HUD's covers two-bedrooms, so treat this as a rough check.`,
      ),
    city &&
      explain(
        `The rest of ${doc.city}`,
        `Apartment List estimates typical rent across all of ${doc.city} at ${money(city.city_rent_estimate)}. The ring comes in ${pct(city.rent_vs_city)} ${side(city.rent_vs_city)} that, ${city.rent_vs_city < 0 ? "so the blocks around campus are the cheaper end of town" : "so you pay extra to live close to campus"}.`,
      ),
  ];
  const rows = [
    ["Near campus", r.ring_median_rent, ""],
    hud ? ["HUD's fair market rent (2-bedroom)", hud.fmr_2br, "bar--pop"] : null,
    city ? [`All of ${doc.city}`, city.city_rent_estimate, "bar--soft"] : null,
  ].filter(Boolean);
  const top = Math.max(...rows.map(([, v]) => v));
  const viz = [
    el(
      "div",
      { class: "panel" },
      el("span", { class: "panel__title" }, "Monthly rent, side by side"),
      el("div", { class: "bars" }, ...rows.map(([label, v, kind], i) => bar(label, money(v), (v / top) * 100, { kind, i }))),
    ),
  ];
  fill(section, text, viz);
}

/** The try-it-yourself card: an income slider and a roommate count, against the 30% line. */
function tryIt(rent) {
  const income = el("input", { type: "range", id: "try-income", min: "1000", max: "15000", step: "100", value: "4000" });
  const out = el("output", { for: "try-income" });
  const mates = el(
    "div",
    { class: "seg", role: "group", "aria-label": "How many people split the rent" },
    ...[1, 2, 3, 4].map((k) => el("button", { type: "button", "data-k": k, "aria-pressed": String(k === 1) }, k === 1 ? "Just me" : `${k} people`)),
  );
  // the people in the flat: one pops in for each person splitting the rent, their share over their head
  const flat = el("div", { class: "flat", "aria-hidden": "true" });
  const meterFill = el("span", { class: "meter__fill" });
  const result = el("p", { class: "try__result", "aria-live": "polite" });
  const box = el(
    "div",
    { class: "panel try" },
    el("span", { class: "panel__title" }, "Try your own numbers"),
    el("label", { for: "try-income" }, "Your income before tax", out),
    income,
    el("div", { class: "try__row" }, el("span", {}, "Splitting the rent?"), mates),
    flat,
    el("div", { class: "meter" }, meterFill, el("span", { class: "meter__line" })),
    el("div", { class: "meter__cap" }, el("span", {}, "0%"), el("span", {}, "the line marks 30%"), el("span", {}, "100%")),
    result,
  );
  let k = 1;
  const update = () => {
    const mine = rent / k;
    const s = mine / +income.value;
    out.textContent = `${money(+income.value)} a month`;
    if (flat.children.length !== k) {
      flat.replaceChildren(...Array.from({ length: k }, (_, i) => el("span", { class: "flat__mate" }, el("b", {}, money(mine)), person(i), el("span", {}, i ? "Mate" : "You"))));
    }
    box.style.setProperty("--state", s <= 0.3 ? "var(--good)" : s <= 0.5 ? "var(--warn)" : "var(--bad)");
    meterFill.style.setProperty("--w", Math.min(100, s * 100).toFixed(1));
    result.replaceChildren(
      `Your share of the rent would be ${money(mine)}, or `,
      el("b", {}, `${Math.round(s * 100)}%`),
      " of your income. ",
      s <= 0.3 ? "That's inside the 30% rule." : `Getting down to 30% would take about ${money(mine / 0.3)} a month${k < 4 ? ", or another roommate" : ""}.`,
    );
  };
  income.addEventListener("input", update);
  mates.addEventListener("click", (e) => {
    const button = e.target.closest("button");
    if (!button) return;
    k = +button.dataset.k;
    for (const other of mates.querySelectorAll("button")) other.setAttribute("aria-pressed", String(other === button));
    update();
  });
  update();
  return box;
}

function afford(doc) {
  const r = latest(doc.series, "rent_to_income");
  const rent = latest(doc.series, "ring_median_rent");
  if (!r || !rent) return;
  const [section, head] = open("afford", "The budget", "Could a typical renter afford it?");
  const over = r.rent_to_income > 0.3;
  const text = [
    ...head,
    p("Typical rent near campus works out to ", b(share(r.rent_to_income)), " of what a typical renter household in the ring earns."),
    explain(
      "The 30% line",
      "Budget advice and federal housing policy share one rule of thumb: keep housing at or under 30% of your income. HUD calls a household above that line cost-burdened, because rent starts crowding out food, transport and savings.",
    ),
    explain(
      "Why you'd care",
      over
        ? `At ${share(r.rent_to_income)}, the typical renter here is already past the line. If you're planning a move, that's a hint to look at roommates, a smaller place, or a neighborhood a little farther out.`
        : `At ${share(r.rent_to_income)}, the typical renter here stays under the line, which is less common near a big campus than you might guess.`,
    ),
  ];
  const donut = el("div", { class: "panel donut" });
  donut.innerHTML =
    `<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false"><circle class="donut__track" cx="60" cy="60" r="50" pathLength="100"/>` +
    `<circle class="donut__fill" cx="60" cy="60" r="50" pathLength="100" style="--v:${Math.min(100, r.rent_to_income * 100).toFixed(1)}"/>` +
    `<circle class="donut__line" cx="60" cy="60" r="50" pathLength="100"/></svg>`;
  const value = el("span", { class: "donut__value" });
  countUp(value, r.rent_to_income, share);
  donut.append(el("div", {}, value, p("of a typical renter household's income goes to rent. The dark tick on the ring marks 30%.")));
  fill(section, text, [donut, tryIt(rent.ring_median_rent)]);
}

/** A row of little houses for n homes, one house per `per` homes. */
function houses(n, per, kind) {
  const box = el("div", { class: `houses ${kind}`, role: "img", "aria-label": `${count(n)} homes` });
  const k = n > 0 ? Math.max(1, Math.round(n / per)) : 0;
  for (let i = 0; i < k; i++) {
    const house = el("span", { class: "house" });
    house.style.setProperty("--i", i);
    box.append(house);
  }
  return box;
}

function supply(doc) {
  const permits = latest(doc.series, "units_permitted_ttm");
  const done = latest(doc.series, "units_completed_ttm");
  const students = latest(doc.series, "enrollment");
  if (!permits && !done && !students) return;
  const [section, head] = open("supply", "The supply", "Is more housing on the way?");
  const firstStudents = doc.series.find((r) => Number.isFinite(r.enrollment));
  const grew = students && firstStudents && fall(firstStudents.month) < fall(students.month) ? students.enrollment - firstStudents.enrollment : null;
  const text = [
    ...head,
    p("Rent is a tug of war between how many people want a place and how many places exist. Start with the places."),
    permits &&
      explain(
        "Homes permitted",
        `In the 12 months to ${month(permits.month)}, ${doc.city} issued permits for ${count(permits.units_permitted_ttm)} new ${permits.units_permitted_ttm === 1 ? "home" : "homes"}. A permit is permission to build, which makes it an early signal: the homes arrive later, sometimes years later, and a few never get built.`,
      ),
    done &&
      explain(
        "Homes finished",
        `${count(done.units_completed_ttm)} ${done.units_completed_ttm === 1 ? "home was" : "homes were"} reported complete in the 12 months to ${month(done.month)}. Those are the ones somebody can move into.${permits ? " The two counts come from different agencies and cover different months, so don't subtract one from the other." : ""}`,
      ),
    students &&
      explain(
        "And the people",
        `${doc.name} enrolled ${count(students.enrollment)} students in fall ${fall(students.month)}${grew ? `, ${count(Math.abs(grew))} ${grew > 0 ? "more" : "fewer"} than in fall ${fall(firstStudents.month)}` : ""}. Every one of them sleeps somewhere. When a campus grows faster than the housing around it, more people end up chasing the same apartments, and rent climbs.`,
      ),
  ];
  const most = Math.max(permits?.units_permitted_ttm ?? 0, done?.units_completed_ttm ?? 0);
  const per = [1, 2, 5, 10, 20, 50, 100, 200, 500].find((s) => most / s <= 160) ?? 1000;
  const figure = (n) => {
    const node = el("span", { class: "figure" });
    countUp(node, n, count);
    return node;
  };
  const viz = [
    (permits || done) &&
      el(
        "div",
        { class: "panel" },
        permits && el("span", { class: "panel__title" }, `Permitted in ${doc.city}, 12 months to ${month(permits.month)}`),
        permits && figure(permits.units_permitted_ttm),
        permits && houses(permits.units_permitted_ttm, per, ""),
        done && el("span", { class: "panel__title" }, `Finished in ${doc.city}, 12 months to ${month(done.month)}`),
        done && figure(done.units_completed_ttm),
        done && houses(done.units_completed_ttm, per, "houses--pop"),
        el("span", { class: "small" }, per === 1 ? "Each little house is one home." : `Each little house stands for ${per} homes.`),
      ),
    students && el("div", { class: "panel" }, el("span", { class: "panel__title" }, `Students enrolled, fall ${fall(students.month)}`), figure(students.enrollment)),
  ];
  fill(section, text, viz);
}

function opening(o) {
  const meta = [
    Number.isFinite(o.beds) ? `${count(o.beds)} beds` : "beds not published",
    o.opened ? `opened ${month(o.opened)}` : "not open yet",
    o.verified ? "confirmed" : "opening date and bed count still to be double-checked",
  ];
  const parts = [el("h3", {}, o.project), el("ul", { class: "chips" }, ...meta.map((m) => el("li", { class: "chip" }, m)))];
  if (!o.estimate) {
    // the pipeline's reason is written for the owner; say the common one in plain words and keep theirs underneath
    const plain = /no ACS release/.test(o.reason ?? "")
      ? "No result yet. To measure this opening the site needs Census data on nearby neighborhoods from before it opened, so it can find similar ZIP codes to compare against. That data hasn't been loaded yet."
      : "No result yet.";
    return el("li", { class: "opening" }, ...parts, p(plain), el("p", { class: "note" }, `Technical reason: ${o.reason}.`));
  }
  const { value, low, high } = o.estimate;
  const way = (v) => `${pct(v)} ${v < 0 ? "lower" : "higher"}`;
  const span = Math.max(0.02, Math.abs(low), Math.abs(high)) * 1.25;
  const at = (v) => (50 + (v / span) * 50).toFixed(1);
  const range = el(
    "div",
    { class: "range", role: "img", "aria-label": `The estimate, ${way(value)}, with a range from ${way(low)} to ${way(high)}` },
    el("span", { class: "range__axis" }),
    el("span", { class: "range__span" }),
    el("span", { class: "range__zero" }),
    el("span", { class: "range__mid" }),
  );
  range.style.setProperty("--lo", at(low));
  range.style.setProperty("--hi", at(high));
  range.style.setProperty("--at", at(value));
  range.style.setProperty("--zero", "50");
  const crossesZero = low < 0 && high > 0;
  const unsettled = /not robust|trend-robust: no detectable/.test(o.verdict);
  return el(
    "li",
    { class: "opening" },
    ...parts,
    el("p", { "data-estimate": "" }, "After it opened, rent near campus ran about ", b(way(value)), " than in the comparison neighborhoods."),
    range,
    p(
      `The dot is the estimate and the bar is its margin of error, from ${way(low)} to ${way(high)}. `,
      crossesZero ? "The bar crosses the “no change” mark, so the opening may have made no difference at all." : "The whole bar sits on one side of “no change”, which points to a real effect.",
    ),
    unsettled &&
      p("A stricter version of the test, one that accounts for where rent was already heading before the doors opened, found no clear effect. Treat this result as unsettled."),
    el("details", {}, el("summary", {}, "The statistician's version"), p(`Ring rent against the matched ZIP codes after the opening: ${o.verdict}.`)),
  );
}

function openings(doc) {
  const [section, head] = open("openings", "The experiment", "Does new student housing bring rent down?");
  dogBeside(
    section.querySelector("[data-text]"),
    doc.campus,
    [
      "Every result here is an estimate with a range around it. When the range runs from below zero to above it, the data can't tell a drop from a rise.",
      "Rent moves for lots of reasons at once. The look-alike ZIP codes show what would've happened anyway, so the gap between them and the ring is what the new building gets credit for.",
      "One building rarely moves a whole neighborhood's rent by much, so small or unclear results are normal here.",
    ],
  );
  fill(section, [
    ...head,
    p("When a university opens a residence hall, hundreds of students move out of nearby apartments at once. In theory that frees up apartments and cools rent for everyone else. Does it?"),
    explain(
      "How we check",
      "We compare the ring with similar ZIP codes elsewhere in the same metro area, before and after each opening. If rent in the ring drifts below its look-alikes once the building opens, the new beds probably helped. Economists call this a difference-in-differences.",
    ),
  ]);
  $("[data-openings]").replaceChildren(
    ...(doc.openings.length ? doc.openings.map(opening) : [el("li", { class: "opening" }, "No campus housing opening near this campus is in the study.")]),
  );
}

function render(doc) {
  document.title = `${doc.name}: rent around the campus | UC Campus Rent`;
  hero(doc);
  $("[data-story]").hidden = false;
  price(doc);
  trend(doc);
  fair(doc);
  afford(doc);
  supply(doc);
  openings(doc);
  footer(doc);
  reveals();
  progress();
}

withRetry($("[data-status]"), async () => {
  const summary = await getJSON("summary");
  nav(summary);
  if (!summary.campuses.some((c) => c.id === id)) return unknown(summary);
  render(await getJSON(id));
});
