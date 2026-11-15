// A pick-one-from-a-list control with a highlight that glides from row to row: a button showing the choice, and a
// small menu that pops open under it (or over it, where there's no room below). Written for this site in the manner
// of a React component the owner supplied (GlideSelect; see web/LICENSE-effects.txt), with the same keys: Enter,
// Space or an arrow opens it, the arrows, Home and End move, a letter jumps to the next name starting with it, Enter
// picks, Escape closes.
// ponytail: a row is picked with a click or tap; the original's press, drag and release in one stroke isn't here.
import { el } from "./common.js";

let made = 0;

/** options: [{ value, label, tag }] (tag is a short note at the row's right). Returns { root, value }. */
export function glideSelect({ options, value, label, onChange }) {
  const id = `glide-${(made += 1)}`;
  let selected = Math.max(0, options.findIndex((o) => o.value === value));
  let active = null;
  let hiding;
  const name = el("span", { class: "glide__label" });
  const trigger = el(
    "button",
    { type: "button", class: "glide__trigger", role: "combobox", "aria-haspopup": "listbox", "aria-expanded": "false", "aria-controls": `${id}-list`, "aria-label": label },
    name,
    el("span", { class: "glide__chevron", "aria-hidden": "true" }),
  );
  const pill = el("span", { class: "glide__pill", "aria-hidden": "true" });
  const rows = options.map((o, i) =>
    el(
      "div",
      { id: `${id}-${i}`, role: "option", class: "glide__option", "data-index": i },
      el("span", { class: "glide__name" }, o.label),
      o.tag && el("span", { class: "glide__tag" }, o.tag),
      el("span", { class: "glide__check", "aria-hidden": "true" }),
    ),
  );
  const list = el("div", { id: `${id}-list`, role: "listbox", "aria-label": label, class: "glide__list" }, pill, ...rows);
  const menu = el("div", { class: "glide__menu", hidden: "" }, list);
  const root = el("div", { class: "glide" }, trigger, menu);
  const isOpen = () => trigger.getAttribute("aria-expanded") === "true";

  const sync = () => {
    name.textContent = options[selected].label;
    rows.forEach((row, i) => row.setAttribute("aria-selected", String(i === selected)));
  };
  /** Moves the highlight to row `i` (null hides it); it glides unless `jump`, or it wasn't showing. */
  const setActive = (i, jump) => {
    active = i;
    list.toggleAttribute("data-live", i !== null);
    if (i === null) {
      pill.style.opacity = "0";
      trigger.removeAttribute("aria-activedescendant");
      return;
    }
    trigger.setAttribute("aria-activedescendant", rows[i].id);
    pill.style.transitionDuration = jump || pill.style.opacity !== "1" ? "0ms, 150ms" : "";
    pill.style.transform = `translateY(${rows[i].offsetTop}px)`;
    pill.style.height = `${rows[i].offsetHeight}px`;
    pill.style.opacity = "1";
  };
  const outside = (e) => !root.contains(e.target) && close();
  function close(instant) {
    if (!isOpen()) return;
    trigger.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", outside, true);
    setActive(null);
    menu.dataset.state = "closed";
    clearTimeout(hiding);
    if (instant) menu.hidden = true;
    else hiding = setTimeout(() => (menu.hidden = true), 140); // after it has popped shut
  }
  function open() {
    clearTimeout(hiding);
    menu.hidden = false;
    menu.dataset.state = "closed";
    const below = trigger.getBoundingClientRect().bottom + menu.offsetHeight + 6 <= innerHeight;
    menu.dataset.side = below ? "bottom" : "top";
    void menu.offsetHeight; // so it pops from its closed state
    menu.dataset.state = "open";
    trigger.setAttribute("aria-expanded", "true");
    document.addEventListener("pointerdown", outside, true);
    setActive(selected, true);
  }
  const pick = (i) => {
    const changed = i !== selected;
    selected = i;
    sync();
    close(true);
    trigger.focus({ preventScroll: true });
    if (!changed) return;
    name.classList.remove("is-swap");
    void name.offsetWidth; // restarts the new name's fade
    name.classList.add("is-swap");
    onChange?.(options[i].value);
  };

  trigger.addEventListener("click", () => (isOpen() ? close() : open()));
  trigger.addEventListener("keydown", (e) => {
    const k = e.key;
    if (!isOpen()) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(k)) {
        e.preventDefault();
        open();
      }
      return;
    }
    const at = active ?? selected;
    const go = (i) => {
      e.preventDefault();
      setActive(Math.min(rows.length - 1, Math.max(0, i)), true);
    };
    if (k === "ArrowDown" || k === "ArrowUp") go(active === null ? at : at + (k === "ArrowDown" ? 1 : -1));
    else if (k === "Home" || k === "End") go(k === "Home" ? 0 : rows.length - 1);
    else if (k === "Enter" || k === " ") {
      e.preventDefault();
      pick(at);
    } else if (k === "Escape" || k === "Tab") {
      if (k === "Escape") e.preventDefault();
      close(true);
    } else if (k.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      // the next name after this one that starts with the letter
      const order = rows.map((_, n) => (at + 1 + n) % rows.length);
      const hit = order.find((i) => options[i].label.toLowerCase().replace(/^uc /, "").startsWith(k.toLowerCase()) || options[i].label.toLowerCase().startsWith(k.toLowerCase()));
      if (hit !== undefined) go(hit);
    }
  });
  list.addEventListener("pointerover", (e) => {
    const row = e.target.closest("[data-index]");
    if (row && e.pointerType !== "touch" && +row.dataset.index !== active) setActive(+row.dataset.index);
  });
  list.addEventListener("mousedown", (e) => e.preventDefault()); // a press on a row leaves the focus on the button, so the menu stays for the click
  list.addEventListener("click", (e) => {
    const row = e.target.closest("[data-index]");
    if (row) pick(+row.dataset.index);
  });
  root.addEventListener("focusout", (e) => !root.contains(e.relatedTarget) && close(true));
  sync();
  return {
    root,
    get value() {
      return options[selected].value;
    },
  };
}
