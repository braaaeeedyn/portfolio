// The home page, from data/summary.json: a row per campus (its logo, its rent as a bar, priciest first) that opens
// its page, and the housing study's status. The list of terms is plain HTML.
import { dog, dogBeside, parkDog } from "./dog.js";
import { glideSelect } from "./glide.js";
import { THEMES, bar, capShelf, change, cheers, count, drawTitle, el, footer, getJSON, heroBackground, money, month, onView, progress, reveals, withRetry } from "./common.js";
heroBackground();
drawTitle(document.querySelector("h1"));

const href = (c) => `campus.html?c=${encodeURIComponent(c.id)}`;
const has = (c) => Number.isFinite(c.ring_median_rent);

function row(c, top, i) {
  const logo = THEMES[c.id]?.logo;
  const meta = has(c) ? [c.city, `${c.zips_reporting} ZIP codes`, c.band ? "12-month forecast" : null].filter(Boolean).join(" · ") : "Zillow has no ring ZIP for it yet";
  const yoy = Number.isFinite(c.ring_rent_yoy) ? `${change(c.ring_rent_yoy)} on a year before` : month(c.month);
  return el(
    "li",
    {},
    el(
      "a",
      { class: "row", href: href(c), "data-campus": c.id },
      logo && el("span", { class: "row__logo" }, el("img", { src: logo, alt: "" })),
      el("span", { class: "row__name" }, el("h3", {}, c.name), el("span", { class: "row__meta" }, meta)),
      has(c) ? bar(yoy, `${money(c.ring_median_rent)}/mo`, (c.ring_median_rent / top) * 100, { i }) : el("span", { class: "row__meta" }, "No rent yet"),
    ),
  );
}

/** The campuses, priciest first (those without a rent last), and the sentence about the gap between the ends. */
function campuses(all) {
  const ranked = [...all].sort((a, b) => (b.ring_median_rent ?? -1) - (a.ring_median_rent ?? -1));
  const priced = ranked.filter(has);
  const top = priced[0]?.ring_median_rent;
  const list = document.querySelector("[data-cards]");
  // the rows pop in one after another when the list comes into view; a ring in the row's campus colour slides to
  // the row under the pointer or the keyboard, and the arrow keys step through the rows
  const ring = el("li", { class: "rows__ring", "aria-hidden": "true" });
  const items = ranked.map((c, i) => {
    const li = row(c, top, i);
    li.style.setProperty("--i", i);
    const on = () => {
      ring.dataset.campus = c.id;
      ring.style.transform = `translateY(${li.offsetTop}px)`;
      ring.style.height = `${li.offsetHeight}px`;
      ring.classList.add("is-on");
    };
    li.addEventListener("pointerenter", on);
    li.addEventListener("focusin", on);
    return li;
  });
  const off = () => ring.classList.remove("is-on");
  list.addEventListener("pointerleave", off);
  list.addEventListener("focusout", off);
  list.addEventListener("keydown", (e) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    const at = items.findIndex((li) => li.contains(document.activeElement));
    if (!step || at < 0 || !items[at + step]) return;
    e.preventDefault();
    items[at + step].querySelector("a").focus();
  });
  list.replaceChildren(...items, ring);
  onView(list, () => list.classList.add("is-in"), 0.1);
  if (priced.length < 2) return;
  faceoff(priced);
  const low = priced.at(-1);
  const gap = top - low.ring_median_rent;
  document.querySelector("[data-compare-text]").textContent =
    `${priced[0].name} tops the list at ${money(top)} a month. ${low.name} sits at the other end, ${money(gap)} cheaper every month, ` +
    `which is ${money(gap * 12)} over a year.`;
}

/** Two campuses side by side: their rents as bars on one scale, and what the gap between them adds up to. */
function faceoff(priced) {
  const box = document.querySelector("[data-faceoff]");
  const [bars, text] = [box.querySelector("[data-faceoff-bars]"), box.querySelector("[data-faceoff-text]")];
  // each pick is a small menu with a gliding highlight; a campus's rent is the note on its row
  const options = priced.map((c) => ({ value: c.id, label: c.name, tag: money(c.ring_median_rent) }));
  const picker = (label, chosen) => {
    const select = glideSelect({ options, value: chosen.id, label, onChange: () => update() });
    return [select, el("div", { class: "faceoff__pick" }, el("span", {}, label), select.root)];
  };
  const [[a, first], [b, second]] = [picker("First campus", priced[0]), picker("Second campus", priced.at(-1))];
  box.querySelector("[data-faceoff-picks]").replaceChildren(first, el("span", { class: "faceoff__vs", "aria-hidden": "true" }, "vs"), second);
  function update() {
    const [x, y] = [a, b].map((select) => priced.find((c) => c.id === select.value));
    const top = Math.max(x.ring_median_rent, y.ring_median_rent);
    // each bar in its own campus's colour
    bars.replaceChildren(...[x, y].map((c, i) => el("div", { "data-campus": c.id }, bar(c.name, `${money(c.ring_median_rent)}/mo`, (c.ring_median_rent / top) * 100, { i }))));
    const [high, low] = x.ring_median_rent >= y.ring_median_rent ? [x, y] : [y, x];
    const gap = high.ring_median_rent - low.ring_median_rent;
    text.textContent =
      x === y
        ? "Pick two different campuses to compare them."
        : `${high.name} costs ${money(gap)} more a month than ${low.name}. That's ${money(gap * 12)} over a year and ${money(gap * 48)} over a four-year degree.`;
  }
  update();
  box.hidden = false;
}

const ordinal = (n) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`; // up to 8th

/** The dog park: every campus's dog, most-cheered first, each a link to its campus; and who leads the cheering. */
function park(all, shared) {
  const board = all.map((c) => ({ ...c, cheers: shared ? (shared[c.id] ?? 0) : cheers.get(c.id) })).sort((x, y) => y.cheers - x.cheers || x.name.localeCompare(y.name));
  const best = board[0].cheers;
  const leaders = board.filter((c) => c.cheers === best).map((c) => THEMES[c.id]?.fans ?? c.name);
  const times = `${count(best)} ${best === 1 ? "cheer" : "cheers"}`;
  document.querySelector("[data-rivalry]").textContent =
    (best === 0
      ? "No cheers yet. Open a campus and press its logo to put its dog on the board."
      : leaders.length === 1
        ? `The ${leaders[0]} lead with ${times}.`
        : `The ${leaders.slice(0, -1).join(", ")} and ${leaders.at(-1)} are tied at ${times}.`) + (shared ? "" : " This counts the cheers made in this browser: the shared count can't be reached.");
  const list = document.querySelector("[data-park-dogs]");
  list.replaceChildren();
  const links = board.map((c) => {
    // its place once anyone has cheered: one more than the campuses with more cheers, "Tied" where it's shared
    const place = 1 + board.filter((other) => other.cheers > c.cheers).length;
    const tied = board.filter((other) => other.cheers === c.cheers).length > 1;
    const link = el(
      "a",
      { class: "park__dog", href: href(c), "data-campus": c.id },
      el("span", { class: "park__name" }, c.name),
      best > 0 && el("span", { class: "park__rank" }, `${tied ? "Tied " : ""}${ordinal(place)}`),
      el("span", { class: "park__n" }, `${count(c.cheers)} ${c.cheers === 1 ? "cheer" : "cheers"}`),
    );
    list.append(el("li", { class: best > 0 && c.cheers === best ? "is-lead" : null }, link));
    return [link, c.id];
  });
  document.querySelector("[data-park]").hidden = false;
  for (const [link, id] of links) parkDog(link, id); // once it's on the page: the dog's cap takes the link's colours
}

function findings(f) {
  const text =
    f.status === "pending"
      ? `No opening has an estimate yet: the study needs more data first. Each campus page says what for each of the ${f.openings} openings.`
      : `${f.estimated} of the ${f.openings} campus housing openings have an estimate so far. Each campus page shows the result and how sure it is.`;
  document.querySelector("[data-findings-text]").textContent = text;
  document.querySelector("[data-findings]").hidden = false;
}

withRetry(document.querySelector("[data-status]"), async () => {
  const summary = await getJSON("summary");
  campuses(summary.campuses);
  park(summary.campuses);
  cheers.all().then((shared) => shared && park(summary.campuses, shared)); // the standings every visitor sees
  capShelf(document.querySelector(".top__in"), summary.campuses.map((c) => c.id));
  findings(summary.findings);
  footer(summary);
  reveals();
  progress();
  document.querySelector("[data-hero-dog]").replaceChildren(
    dog("home", [
      "New to rent data? Start anywhere. Each campus page explains its numbers as you scroll.",
      "Every number on this site comes from a public source. They're listed at the bottom of each page.",
    ]),
  );
  dogBeside(document.querySelector('[data-ch="pick"] .chapter__text'), "home", [
    "Click a row to open that campus.",
    "The bars share one scale, so a bar half as long means rent half as high.",
    "The percentage on each row compares this month's rent with the same month a year earlier.",
  ]);
  dogBeside(document.querySelector('[data-ch="findings"] .chapter__text'), "home", [
    "An opening without an estimate isn't a failure. It means the study doesn't have enough data to say anything yet, so it says nothing.",
    "Open any campus page and scroll to the last section to see its openings.",
  ]);
});
