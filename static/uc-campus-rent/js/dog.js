// The tip dogs: a small seated pixel-art dog in a baseball cap (the page's colours, the campus's short name on it, its
// ears through it) beside a speech bubble. Pet it (click or tap) and it barks the next tip. It wags its tail and
// blinks while it waits; now and then it scratches an ear, rolls onto its back and kicks, or yawns and gets sleepy,
// and left alone for a minute
// it lies down for a nap until it's petted. Each campus has its own breed: Berkeley a shiba, Irvine a corgi, Riverside a black-and-tan,
// San Diego a dalmatian, UCLA a husky, Davis a border collie, Merced a chocolate labrador, Santa Barbara a samoyed;
// the home page has a beagle. The dogs are drawn here, pixel by pixel (24×19), in the style of the owner's
// reference sheet (design/dog-reference/); the picture itself is not used by the site.
import { caps, el } from "./common.js";

const [W, H] = [24, 19];
const TICK_MS = 420; // one tail beat
// K outline, F fur, U muzzle, L chest, W paws, E/G left/right ear, P inner ear, Y eye, N nose, T tongue, A tail, B tail
// tip, C cap, V brim, M/O/S a breed's markings
const HEAD = [
  ".....KFFFFFFFFFFFFK.....",
  ".....KFFYFFFFFFYFFK.....",
  ".....KFFFUUNNUUFFFK.....",
  ".....KFFUUUTTUUUFFK.....",
  "......KFUUUUUUUUFK......",
  ".......KKUUUUUUKK.......",
];
const BODY = [
  ".......KFFLLLLFFK.......",
  "......KFFFLLLLFFFK......",
  ".....KFFFFLLLLFFFK......",
  "....KFFFFFFLLFFFFK......",
  "...KFFFFFKFFLLKFFK......",
  "...KFFFFFKFFKKKFFK......",
  "...KWWWWKKWWK.KWWK......",
  "...KKKKKKKKKK.KKKK......",
];
const BRIM = "....KVVVVVVVVVVVVVVK....";
// rows 0 to 4 (a floppy ear hangs to row 9): the cap, with the ears beside its crown; "." leaves what is under it
const EARS = {
  point: ["...KK...KKKKKKKK...KK...", "...KEK.KCCCCCCCCK.KGK...", "...KEEKKCCCCCCCCKKGGK...", "....KEPKCCCCCCCCKPGK....", BRIM],
  fold: ["........KKKKKKKK........", "....KKKKCCCCCCCCKKKK....", "....KEEKCCCCCCCCKGGK....", "....KKEKCCCCCCCCKGKK....", BRIM],
  flop: [
    "........KKKKKKKK........",
    ".......KCCCCCCCCK.......",
    ".......KCCCCCCCCK.......",
    "..KKK..KCCCCCCCCK..KKK..",
    ".KEEEKVVVVVVVVVVVVKGGGK.",
    ".KEEE..............GGGK.",
    ".KEEE..............GGGK.",
    ".KEEE..............GGGK.",
    ".KEEE..............GGGK.",
    "..KKK..............KKK..",
  ],
};
// the home page's beagle once every campus's cap is collected: a party hat in place of its cap (rows 0 to 4)
const PARTY = ["...........KK...........", "..........KVVK..........", ".........KCCCCK.........", "..KKK...KVVVVVVK...KKK..", ".KEEEKKKCCCCCCCCKKKGGGK."];
// from row 9, columns 0 to 5: the tail, and its other beat
const TAILS = {
  up: [
    [".KK...", "KBBK..", "KBBK..", "KAAAK.", ".KAAA.", "..KK.."],
    ["......", "KKK...", "KBBBK.", ".KBAAK", "..KAA.", "..KK.."],
  ],
  stub: [
    ["......", "......", "......", "......", ".KKK..", "KAAA..", ".KKK.."],
    ["......", "......", "......", ".KKK..", "KAAAK.", ".KKK.."],
  ],
  curl: [
    [".KKK..", "KAAAK.", "KAKAK.", "KBAAAK", ".KKAA.", "...K.."],
    ["KKK...", "KAAK..", "KAKAK.", "KBAAAK", ".KKAA.", "...K.."],
  ],
};
// scratching an ear: a hind leg comes up beside the head (from column 18), and its other beat
const SCRATCH = [
  [[5, "..KK."], [6, ".KWWK"], [7, ".KWWK"], [8, "..KFK"], [9, "..KFK"], [10, "..KFK"], [11, ".KFFK"], [12, "KFFK."]],
  [[4, "..KK."], [5, ".KWWK"], [6, ".KWWK"], [7, "..KFK"], [8, "..KFK"], [9, "..KFK"], [10, "..KFK"], [11, ".KFFK"], [12, "KFFK."]],
];
// asleep: the head (rows 0 to 10 of the seated dog) comes down NAP_DROP rows onto this, the body lying behind it
const NAP_DROP = 5;
const LYING = [
  [13, "...KKKK..........KKKK..."],
  [14, "..KFFFFFFFFFFFFFFFFFFK.."],
  [15, ".KFFFFFFFFFFFFFFFFFFFFK."],
  [16, ".KFFFFFFFFFFFFFFFFFFFFK."],
  [17, ".KWWWKFFFFFFFFFFFFKWWWK."],
  [18, ".KKKKKKKKKKKKKKKKKKKKKK."],
];
// on its back, seen from the head end: the belly and four paws in the air (rows 0 to 8), kicking on two beats; the
// head goes below them upside down, its cap on the ground
const ROLL = [
  [
    "........KK....KK........",
    ".......KWWK..KWWK.......",
    ".......KWWK..KWWK.......",
    "....KK.KFFKKKKFFK.KK....",
    "...KWWKKFFLLLLFFKKWWK...",
    "...KWWKFFLLLLLLFFKWWK...",
    "...KFFKFLLLLLLLLFKFFK...",
    "...KFFFFLLLLLLLLFFFFK...",
    "....KFFFLLLLLLLLFFFK....",
  ],
  [
    ".........KK..KK.........",
    "........KWWKKWWK........",
    "....KK..KWWKKWWK..KK....",
    "...KWWK.KFFKKFFK.KWWK...",
    "...KWWKKFFLLLLFFKKWWK...",
    "...KFFKFFLLLLLLFFKFFK...",
    "...KFFKFLLLLLLLLFKFFK...",
    "...KFFFFLLLLLLLLFFFFK...",
    "....KFFFLLLLLLLLFFFK....",
  ],
];
const YAWN = 4; // getting sleepy opens with a yawn this many tail beats long
const ACTS = { scratch: 6, roll: 10, sleepy: 18, nap: Infinity }; // how many tail beats each lasts
const NAP_AFTER = 143; // tail beats without a pet before it dozes off: a minute
const INK = "#1b1b2a";
const [WHITE, TAN, GREY, DARK] = ["#ffffff", "#c9772e", "#8b8b98", "#2a2a33"];
const BLAZE = [
  [5, 11, "UU"],
  [6, 11, "UU"],
];
const CHEEKS = [
  [7, 7, "UU"],
  [7, 15, "UU"],
  [8, 6, "UU"],
  [8, 16, "UU"],
];
// fur, then what differs from it: muzzle U, chest L, paws W, ears E (and G), tail A and its tip B, markings [row, column, letters]
const BREEDS = {
  berkeley: { ears: "point", tail: "curl", F: "#e08a3c", U: WHITE, L: WHITE, B: WHITE, marks: [...CHEEKS, [5, 8, "U"], [5, 15, "U"]] },
  irvine: { ears: "point", tail: "stub", F: "#f0a85a", U: WHITE, L: WHITE, W: WHITE, marks: BLAZE },
  riverside: { ears: "fold", tail: "up", F: "#565662", U: TAN, W: TAN, O: TAN, marks: [[5, 8, "O"], [5, 15, "O"], [11, 11, "OO"]] },
  san_diego: {
    ears: "flop",
    tail: "up",
    F: WHITE,
    E: DARK,
    S: DARK,
    marks: [[5, 13, "S"], [7, 6, "S"], [11, 8, "S"], [12, 8, "S"], [13, 7, "S"], [14, 6, "SS"], [15, 5, "S"], [13, 15, "S"], [15, 16, "S"]],
  },
  ucla: { ears: "point", tail: "curl", F: "#98a2b0", U: WHITE, L: WHITE, W: WHITE, B: WHITE, marks: [...BLAZE, ...CHEEKS, [6, 10, "U"], [6, 13, "U"]] },
  davis: { ears: "fold", tail: "up", F: "#3f3f4c", U: WHITE, L: WHITE, W: WHITE, B: WHITE, marks: BLAZE },
  merced: { ears: "flop", tail: "up", F: "#7a4a2a", E: "#5a3520", U: "#a87548" },
  santa_barbara: { ears: "point", tail: "curl", F: WHITE },
  home: {
    ears: "flop",
    tail: "up",
    F: WHITE,
    E: GREY,
    G: "#d98a3d",
    A: GREY,
    B: WHITE,
    M: GREY,
    O: "#d98a3d",
    marks: [
      [5, 6, "MMMMMUUOOOOO"],
      [6, 6, "MM"],
      [6, 9, "MMUUOO"],
      [6, 16, "OO"],
      [7, 6, "MMM"],
      [7, 15, "OOO"],
      [8, 6, "MM"],
      [8, 16, "OO"],
      [12, 7, "OOO"],
      [13, 6, "OOOO"],
      [14, 5, "OOOO"],
      [15, 4, "OOO"],
    ],
  },
};

/** The dog as rows of palette letters: the tail on beat 0 or 1, the eyes shut or not, barking or not, or in the
 *  middle of an act ("scratch", "roll", "sleepy" or "nap"; `yawn` is the start of getting sleepy). */
export function pixels(b, { beat = 0, blink = false, bark = false, yawn = false, party = false, act } = {}) {
  let rows = [".", ".", ".", ".", "."].map((dot) => dot.repeat(W)).concat(HEAD, BODY).map((r) => [...r]);
  const lay = (r, c, text) => [...text].forEach((ch, i) => ch !== "." && (rows[r][c + i] = ch));
  (b.marks ?? []).forEach(([r, c, text]) => lay(r, c, text));
  EARS[b.ears].forEach((text, r) => lay(r, 0, text));
  if (party) {
    for (let r = 0; r < 4; r++) rows[r].fill(".");
    PARTY.forEach((text, r) => lay(r, 0, text));
  }
  if (act === "nap" || act === "roll") {
    const head = rows.slice(0, 11).map((r) => r.join(""));
    rows = Array.from({ length: H }, () => [...".".repeat(W)]);
    if (act === "nap") {
      LYING.forEach(([r, text]) => lay(r, 0, text));
      head.forEach((text, r) => lay(r + NAP_DROP, 0, text));
    } else {
      ROLL[beat].forEach((text, r) => lay(r, 0, text));
      head.reverse().forEach((text, r) => lay(r + H - 11, 0, text));
    }
  } else {
    TAILS[b.tail][act === "sleepy" ? 0 : beat].forEach((text, i) => lay(9 + i, 0, text));
  }
  if (act === "scratch") SCRATCH[beat].forEach(([r, text]) => lay(r, 18, text));
  // eyes shut: a blink, a scratch, a nap, a yawn, and every other beat of getting sleepy
  if (blink || yawn || act === "scratch" || act === "nap" || (act === "sleepy" && beat)) rows = rows.map((r) => r.map((ch) => (ch === "Y" ? "F" : ch)));
  if (yawn) {
    lay(8, 9, "KKKKKK");
    lay(9, 9, "KTTTTK");
    lay(10, 10, "KKKK");
  }
  if (bark) {
    lay(8, 10, "KKKK");
    lay(9, 10, "KTTK");
  }
  return rows.map((r) => r.join(""));
}

function paint(canvas, b, colours, state, name) {
  const pal = { K: INK, Y: INK, N: INK, P: "#f6a5a5", T: "#ef7f95", ...colours, F: b.F };
  // a part without its own colour takes the fur's (the right ear the left's, the tail's tip the tail's)
  for (const [k, from] of ["UF", "LF", "WF", "EF", "GE", "AF", "BA"]) pal[k] = b[k] ?? pal[from];
  for (const k of "MOS") pal[k] = b[k];
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, W, H);
  pixels(b, state).forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === ".") return;
      ctx.fillStyle = pal[ch];
      ctx.fillRect(x, y, 1, 1);
    }),
  );
  canvas.dataset.frame = name;
}

const TAGS = {
  berkeley: "CAL",
  irvine: "UCI",
  riverside: "UCR",
  san_diego: "UCSD",
  ucla: "UCLA",
  davis: "UCD",
  merced: "UCM",
  santa_barbara: "UCSB",
};

/** The dog alone: its picture, the name on its cap and its z's, wagging and blinking and now and then doing an act.
 *  `colours` are its cap's two ({ C, V }). Returns { pet, act(name), bark() }. */
function pup(id, colours) {
  const b = BREEDS[id] ?? BREEDS.home;
  const party = !TAGS[id] && caps.all().length >= Object.keys(TAGS).length; // every cap collected: the beagle celebrates
  const canvas = el("canvas", { class: "dog__frame", width: W, height: H, "aria-hidden": "true" }); // small; the CSS enlarges it
  const pet = el(
    "span",
    { class: party ? "dog__pet is-party" : "dog__pet" },
    canvas,
    el("span", { class: "dog__tag" }, TAGS[id] ?? "UC"),
    el("span", { class: "dog__woof", "aria-hidden": "true" }, "Woof!"),
    el("span", { class: "dog__zzz", "aria-hidden": "true" }, el("i", {}, "z"), el("i", {}, "z"), el("i", {}, "Z")),
  );
  let [tick, barks, act, left, next, alone] = [0, 0, null, 0, 14 + Math.floor(Math.random() * 16), 0]; // several dogs on a page don't all act at once
  const start = (name) => ACTS[name] && ([act, left] = [name, ACTS[name]]);
  const show = (state, name) => paint(canvas, b, colours, { ...state, party }, name);
  const draw = () => {
    const beat = tick % 2;
    const doing = barks > 0 ? null : act;
    const yawn = doing === "sleepy" && left > ACTS.sleepy - YAWN;
    // the name on the cap follows the head, and the z's rise once it has yawned, and while it's asleep
    for (const name of ["roll", "nap"]) pet.classList.toggle(`is-${name}`, doing === name);
    pet.classList.toggle("is-sleepy", (doing === "sleepy" && !yawn) || doing === "nap");
    if (barks > 0) show({ beat, bark: barks % 2 === 0 }, "bark");
    else if (yawn) show({ act, yawn }, "yawn");
    else if (act) show({ beat: act === "sleepy" ? Math.floor(tick / 3) % 2 : beat, act }, act); // heavy eyelids are slow
    else if (tick % 9 === 8) show({ beat, blink: true }, "blink");
    else show({ beat }, beat ? "wag" : "idle");
  };
  draw();
  // it moves only for readers who haven't asked for less motion
  const moves = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (moves) {
    setInterval(() => {
      tick += 1;
      alone += 1;
      if (barks > 0) barks -= 1;
      else if (act && (left -= 1) <= 0) {
        // left alone for a minute, getting sleepy ends in a nap; otherwise it shakes awake
        if (act === "sleepy" && alone >= NAP_AFTER) start("nap");
        else [act, next] = [null, tick + 14 + Math.floor(Math.random() * 12)];
      } else if (!act && alone >= NAP_AFTER) start("sleepy");
      else if (!act && tick >= next) start(["scratch", "roll", "sleepy"][Math.floor(Math.random() * 3)]);
      if (pet.isConnected) draw();
    }, TICK_MS);
  }
  return {
    pet,
    act: (name) => moves && (start(name), draw()),
    bark() {
      if (moves) [barks, act, next, alone] = [4, null, tick + 14, 0]; // two barks, a tail beat each; it ends whatever it was doing
      draw();
    },
  };
}

const capColours = (node) => {
  const theme = getComputedStyle(node);
  return { C: theme.getPropertyValue("--brand").trim(), V: theme.getPropertyValue("--pop").trim() };
};

/** A dog and its speech bubble. `id` is a campus (or "home"). */
export function dog(id, tips) {
  const one = pup(id, capColours(document.documentElement));
  const text = el("span", { class: "dog__text" }, "Pet me for a tip.");
  const more = el("span", { class: "dog__more" });
  const button = el("button", { class: "dog", type: "button" }, one.pet, el("span", { class: "dog__bubble", "aria-live": "polite" }, text, more));
  let at = -1;
  button.addEventListener("dogact", (e) => one.act(e.detail)); // the tests (and anything else) can ask for an act by name
  button.addEventListener("click", () => {
    at = (at + 1) % tips.length;
    text.replaceChildren(el("b", {}, "Woof! "), tips[at]);
    // petting a campus's dog collects its cap, for the shelf by the page's header
    const got = TAGS[id] && caps.add(id) ? `You collected the ${TAGS[id]} cap: ${caps.all().length} of ${Object.keys(TAGS).length}. ` : "";
    more.textContent = got + (tips.length > 1 ? `Tip ${at + 1} of ${tips.length}. Pet again for the next.` : "");
    one.bark();
    button.classList.remove("is-bark");
    void button.offsetWidth; // restarts the hop
    button.classList.add("is-bark");
  });
  return button;
}

/** A dog for the home page's dog park: put into `link` (already on the page, carrying its campus's colours), where it
 *  does a trick when the pointer or the keyboard comes by. */
export function parkDog(link, id) {
  const one = pup(id, capColours(link));
  link.prepend(one.pet);
  const trick = () => one.act(Math.random() < 0.5 ? "roll" : "scratch");
  link.addEventListener("pointerenter", trick);
  link.addEventListener("focus", trick);
}

/** Puts a dog beside a block of text, in the room the text's line length leaves on wide screens. */
export function dogBeside(text, id, tips) {
  const head = el("div", { class: "chapter__head" });
  text.replaceWith(head);
  head.append(text, dog(id, tips));
}
