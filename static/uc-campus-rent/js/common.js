// Shared by both pages: the bright theme (one colour set per campus), the data files loading with a retry, the number
// formats, the things that move when you reach or click them (the headline that draws itself, the logo button's
// celebration), and the footer's credit lines (each data file carries
// the lines of the sources it shows).
import { gradientAscii } from "./fx/gradient-ascii.js";
import { formatMonth, formatNumber } from "./util/chart.js";

const root = document.documentElement;
root.dataset.theme = "light"; // the site is bright on every system setting
root.classList.add("js");
const still = matchMedia("(prefers-reduced-motion: reduce)");

/** Each campus's logo (the button in its page's header, and its row on the home page), what the button cheers and what its students are called. The colours are in site.css under data-campus. */
export const THEMES = {
  berkeley: { logo: "img/berkeley.svg", cheer: "Go Bears", fans: "Bears" },
  irvine: { logo: "img/irvine.svg", cheer: "Zot, zot, zot", fans: "Anteaters" },
  riverside: { logo: "img/riverside.svg", cheer: "Go Highlanders", fans: "Highlanders" },
  san_diego: { logo: "img/san_diego.svg", cheer: "Go Tritons", fans: "Tritons" },
  ucla: { logo: "img/ucla.svg", cheer: "Go Bruins", fans: "Bruins" },
  davis: { logo: "img/davis.svg", cheer: "Go Ags", fans: "Aggies" },
  merced: { logo: "img/merced.svg", cheer: "Go Bobcats", fans: "Bobcats" },
  santa_barbara: { logo: "img/santa_barbara.svg", cheer: "Olé, Gauchos", fans: "Gauchos" },
};

// What this browser remembers (localStorage): the caps collected, and its own cheers, which the pages show only
// when the shared counter (`cheers.all`, below) can't be reached.
function recall(name, fallback) {
  try {
    return JSON.parse(localStorage.getItem(`uc-campus-rent:${name}`)) ?? fallback;
  } catch {
    return fallback; // storage is off (private mode), or holds something else
  }
}

function remember(name, value) {
  try {
    localStorage.setItem(`uc-campus-rent:${name}`, JSON.stringify(value));
  } catch {
    // as above: it lasts for this visit only
  }
}

export const cheers = {
  get: (id) => Number(recall(`cheers:${id}`, 0)) || 0,
  add(id) {
    const n = cheers.get(id) + 1;
    remember(`cheers:${id}`, n);
    return n;
  },
  /** Every campus's count, shared by all visitors ({id: n}), or null when the counter can't be reached. */
  all: () => counter(""),
  /** Adds one to `id`'s shared count; resolves like all(). */
  cheer: (id) => counter(`/${id}`, "POST"),
};

// The counter service on the VM (deploy/oracle/cheers.py): a cheer that goes there sends the campus's id and
// nothing about the visitor.
const CHEERS_API = "https://cheers.seismicsocal.duckdns.org/cheers";
const counter = (path, method = "GET") =>
  fetch(CHEERS_API + path, { method })
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null);

/** The caps collected by petting each campus's dog. */
export const caps = {
  all() {
    const got = recall("caps", []);
    return Array.isArray(got) ? got : [];
  },
  /** True when `id`'s cap is new. */
  add(id) {
    const got = caps.all();
    if (got.includes(id)) return false;
    remember("caps", [...got, id]);
    document.dispatchEvent(new CustomEvent("capcollected"));
    return true;
  },
};

/** The shelf of caps, one per campus in its colour, filled in as they're collected; appended to `host`. */
export function capShelf(host, ids) {
  const shelf = el("div", { class: "caps", role: "img", title: "Pet a campus's dog to collect its cap" });
  const fill = () => {
    const got = caps.all().filter((id) => ids.includes(id));
    shelf.setAttribute("aria-label", `Caps collected: ${got.length} of ${ids.length}`);
    shelf.replaceChildren(
      ...ids.map((id) => el("span", { class: got.includes(id) ? "cap is-got" : "cap", "data-campus": id })),
      el("span", { class: "caps__n" }, `${got.length}/${ids.length} caps`),
    );
  };
  fill();
  document.addEventListener("capcollected", fill);
  host.append(shelf);
}

/** An element with attributes and children (text or nodes; null and false are skipped). */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined && v !== false) node.setAttribute(k, v);
  node.append(...children.flat().filter((c) => c !== null && c !== undefined && c !== false));
  return node;
}

/** data/<name>.json, relative to the page, so the site works under any folder. */
export async function getJSON(name) {
  const res = await fetch(`data/${name}.json`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`data/${name}.json answered ${res.status}`);
  return res.json();
}

/** Runs load(); while it fails, `status` shows a message and a Retry button. Marks the page ready either way. */
export async function withRetry(status, load) {
  status.replaceChildren(el("p", { class: "note" }, "Loading the data…"));
  try {
    await load();
    status.replaceChildren();
  } catch (err) {
    console.error(err);
    const retry = el("button", { type: "button", class: "button" }, "Retry");
    retry.addEventListener("click", () => withRetry(status, load));
    status.replaceChildren(
      el("div", { class: "message message--error" }, el("p", {}, "The data didn't load. Check your connection, then try again."), retry),
    );
  }
  root.dataset.ready = "true";
}

export const money = (v) => (Number.isFinite(v) ? `$${formatNumber(v)}` : "–");
export const count = (v) => (Number.isFinite(v) ? formatNumber(v) : "–");
export const share = (v) => (Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : "–");
export const change = (v) => (Number.isFinite(v) ? `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v * 100).toFixed(1)}%` : "–");
export const month = (iso) => (iso ? formatMonth(iso) : "–");

/** Calls fn once, the first time `node` is on screen. */
export function onView(node, fn, threshold = 0.25) {
  const seen = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      seen.disconnect();
      fn();
    },
    { threshold },
  );
  seen.observe(node);
}

/** Everything marked .reveal under `scope` gets .is-in when it scrolls into view (the CSS does the movement). */
export function reveals(scope = document) {
  for (const node of scope.querySelectorAll(".reveal:not(.is-in)")) onView(node, () => node.classList.add("is-in"), 0.15);
}

/** The node shows format(to) at once; when it first comes into view it counts up to it. */
export function countUp(node, to, format) {
  node.textContent = format(to);
  if (still.matches || !Number.isFinite(to)) return;
  onView(node, () => {
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / 1100);
      node.textContent = format(to * (1 - (1 - t) ** 3));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/** The bar under the header that fills as you read down the page. */
export function progress() {
  const bar = document.querySelector("[data-progress]");
  if (!bar) return;
  const set = () => {
    const room = root.scrollHeight - innerHeight;
    bar.style.setProperty("--read", room > 0 ? Math.min(1, scrollY / room).toFixed(3) : "0");
  };
  addEventListener("scroll", set, { passive: true });
  addEventListener("resize", set);
  set();
}

const rand = (low, high) => low + Math.random() * (high - low);
const piece = (cls, vars, ...children) => {
  const node = el("span", { class: cls }, ...children);
  for (const [name, value] of Object.entries(vars)) node.style.setProperty(name, value);
  return node;
};

/** The celebration, over the whole screen for a few seconds: the cheer glowing in the middle, confetti in the campus
 *  colours falling from the top, and a small cannon in each bottom corner firing more of it up. */
function party(cheer) {
  document.querySelector(".party")?.remove();
  const falling = Array.from({ length: 56 }, () =>
    piece("party__fall", {
      "--x": `${rand(0, 100).toFixed(1)}vw`,
      "--drift": `${rand(-8, 8).toFixed(1)}vw`,
      "--spin": `${rand(-720, 720).toFixed(0)}deg`,
      "--delay": `${rand(0, 700).toFixed(0)}ms`,
      "--time": `${rand(1600, 2600).toFixed(0)}ms`,
    }),
  );
  const shots = ["left", "right"].flatMap((side) =>
    Array.from({ length: 26 }, () =>
      piece(
        `party__shot party__shot--${side}`,
        {
          "--dx": `${(side === "left" ? 1 : -1) * rand(6, 46)}vw`,
          "--up": `${rand(35, 82).toFixed(0)}vh`,
          "--spin": `${rand(-900, 900).toFixed(0)}deg`,
          "--delay": `${rand(240, 520).toFixed(0)}ms`,
          "--time": `${rand(1500, 2300).toFixed(0)}ms`,
        },
        el("i", {}),
      ),
    ),
  );
  const cannons = ["left", "right"].map((side) => el("span", { class: `party__cannon party__cannon--${side}` }));
  const box = el("div", { class: "party", "aria-hidden": "true" }, ...falling, ...shots, ...cannons, el("p", { class: "party__cheer" }, cheer));
  document.body.append(box);
  setTimeout(() => box.remove(), 3200);
}

/** The page's main heading draws itself: each word's outline is traced in the campus colour, then its fill sweeps in
 *  from the left. Each word is its own small picture, so the heading still wraps like text; screen readers get the
 *  plain words. Readers who ask for less motion keep the plain heading. */
export async function drawTitle(h1) {
  const text = h1.textContent.trim().replace(/\s+/g, " ");
  if (still.matches || !text) return;
  await document.fonts.ready; // a word's width is measured in the heading's real font
  const size = parseFloat(getComputedStyle(h1).fontSize);
  const words = text.split(" ").map((word, i) => {
    const probe = el("span", { style: "display:inline-block;white-space:nowrap" }, word);
    h1.append(probe);
    const width = probe.getBoundingClientRect().width / size;
    probe.remove();
    const holder = el("span", {});
    const id = `title-word-${i}`;
    holder.innerHTML = `<svg class="drawn" aria-hidden="true" focusable="false"><defs><text id="${id}" y="100%"></text></defs><use class="drawn__line" href="#${id}"/><use class="drawn__fill" href="#${id}"/></svg>`;
    const svg = holder.firstChild;
    svg.querySelector("text").textContent = word;
    svg.style.width = `${width.toFixed(3)}em`;
    svg.style.setProperty("--i", i);
    return svg;
  });
  h1.setAttribute("aria-label", text);
  h1.replaceChildren(...words.flatMap((svg, i) => (i ? [" ", svg] : [svg])));
}

/** One of the page's theme colours, by its custom property's name. */
const themeColour = (name) => getComputedStyle(root).getPropertyValue(name).trim();

/** The home page's moving hero background: a slow horizon drawn in text characters, in the page's own colours, on a
 *  layer behind the hero's words (the campus pages keep the plain hero). Where it can't run (a browser
 *  without WebGL2) the layer is taken away again and the hero keeps its plain circles. */
export function heroBackground() {
  const hero = document.querySelector(".hero");
  const host = el("div", { class: "hero__fx", "aria-hidden": "true" });
  hero.prepend(host);
  let running = false;
  try {
    running = Boolean(
      gradientAscii(host, {
        colors: ["--brand", "--tint2", "--tint", "--pop"].map(themeColour),
        lightMode: true,
        cellSize: 16,
        glyphOpacity: 0.4,
        gradientOpacity: 0.4,
        glow: 0.15,
        speed: 0.7,
        grain: 0.03,
      }),
    );
  } catch (err) {
    console.warn("the hero background didn't start:", err.message);
  }
  if (running) hero.classList.add("hero--fx");
  else host.remove();
}

/** The logo button: each click presses it, adds a cheer to the campus's tally (`cheers`, above) and sets off the
 *  celebration. */
export function mascot(button, id, tally) {
  const theme = THEMES[id];
  let n = cheers.get(id); // this browser's own tally, until the shared count answers
  let shared = false;
  let unanswered = 0; // cheers sent that the shared count may not include yet
  // one line under the logo: "Click to cheer along with 12 Gauchos" (before the first cheer, "for the Gauchos")
  const show = () =>
    tally.replaceChildren(
      ...(n
        ? ["Click to cheer along with ", el("b", { "data-cheers": "" }, formatNumber(n)), ` ${n === 1 ? theme.fans.slice(0, -1) : theme.fans}`]
        : [`Click to cheer for the ${theme.fans}`]),
    );
  const sync = (all) => {
    if (!Number.isFinite(all?.[id])) return;
    n = shared ? Math.max(n, all[id]) : all[id] + unanswered;
    shared = true;
    show();
  };
  show();
  cheers.all().then(sync);
  button.replaceChildren(el("img", { src: theme.logo, alt: "" }));
  button.addEventListener("click", () => {
    const mine = cheers.add(id);
    n = shared ? n + 1 : Math.max(n + 1, mine); // it still counts up where storage is off
    show();
    unanswered += 1;
    cheers.cheer(id).then((all) => {
      unanswered -= 1;
      sync(all);
    });
    button.classList.add("is-hit");
    setTimeout(() => button.classList.remove("is-hit"), 150);
    tally.classList.remove("is-bump");
    void tally.offsetWidth; // restarts the number's bump (the number is new each time; the class is on the line)
    tally.classList.add("is-bump");
    if (!still.matches) party(theme.cheer);
  });
}

/** A horizontal bar: its label, its value and a fill `width` percent wide that grows when it comes into view. */
export function bar(label, value, width, { kind = "", i = 0 } = {}) {
  const fill = el("span", { class: "bar__fill" });
  fill.style.setProperty("--w", Math.max(2, Math.min(100, width)).toFixed(1));
  fill.style.setProperty("--i", i);
  return el(
    "span",
    { class: `bar ${kind}` },
    el("span", { class: "bar__label" }, el("span", {}, label), el("b", {}, value)),
    el("span", { class: "bar__track" }, fill),
  );
}

/** The footer: the file's credit lines, and how fresh the data is. */
export function footer(doc) {
  const foot = document.querySelector("[data-foot]");
  foot.querySelector("[data-credits]").replaceChildren(...doc.credits.map((line) => el("li", {}, line)));
  const made = new Date(doc.generated_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
  foot.querySelector("[data-generated]").textContent = `Data through ${month(doc.latest_month)}. Updated ${made}.`;
  foot.hidden = false;
}
