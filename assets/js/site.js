// Image slots: each <figure class="slot" data-src="path/name"> tries name.webp, .png, .jpg, .jpeg, .gif
// in turn. Drop a screenshot with that base name into assets/img/slots/ and it appears automatically;
// until then the slot shows a labelled placeholder.
(function () {
  var EXTS = ["webp", "png", "jpg", "jpeg", "gif"];

  document.querySelectorAll(".slot[data-src]").forEach(function (slot) {
    var img = slot.querySelector("img");
    var base = slot.getAttribute("data-src");
    var i = 0;

    function next() {
      if (i >= EXTS.length) {
        slot.classList.add("is-empty");
        return;
      }
      img.src = base + "." + EXTS[i++];
    }

    img.addEventListener("load", function () { slot.classList.remove("is-empty"); });
    img.addEventListener("error", next);
    next();
  });
})();

// Failsafe: if anything below throws, drop the .js class so nothing stays hidden.
window.addEventListener("error", function () { document.documentElement.classList.remove("js"); });

// Scroll reveal + chart animation + LCD count-up. CSS only hides things when <html> has the .js
// class, so the page is fully readable without JavaScript or with reduced motion.
(function () {
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var targets = document.querySelectorAll(
    "main .panel, main .slot, main .fig, .pager a, .rail-btns, .info-box, .tip, " +
    ".role, .feat, .stat, .tile, .flow-step, .step, main .row, .bullet-rows .row");

  // stagger siblings inside the same grid so cards cascade in
  targets.forEach(function (el) {
    var sibs = Array.prototype.filter.call(el.parentNode.children, function (c) { return c.matches && c.matches(el.tagName); });
    var i = sibs.indexOf(el);
    el.style.setProperty("--d", Math.min(i, 8) * 70 + "ms");
  });

  function countUp(stat) {
    var v = stat.querySelector(".v");
    if (!v || v.dataset.done) return;
    var node = v.firstChild;
    if (!node || node.nodeType !== 3) return;
    var m = node.nodeValue.match(/^(-?)(\d+(?:\.(\d+))?)$/);
    if (!m) return;
    v.dataset.done = "1";
    var sign = m[1], target = parseFloat(m[2]), dec = m[3] ? m[3].length : 0;
    var t0 = null, dur = 1200;
    function step(t) {
      if (t0 === null) t0 = t;
      var p = Math.min(1, (t - t0) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      node.nodeValue = sign + (target * e).toFixed(dec);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  if (reduce || !("IntersectionObserver" in window)) {
    targets.forEach(function (el) { el.classList.add("in"); });
    return;
  }

  targets.forEach(function (el) { el.classList.add("reveal"); });
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var el = en.target;
      el.classList.add("in");
      if (el.classList.contains("stat")) countUp(el);
      // once revealed, drop the reveal transition so hover effects respond instantly
      setTimeout(function () { el.classList.remove("reveal"); }, 900 + (parseInt(el.style.getPropertyValue("--d"), 10) || 0));
      io.unobserve(el);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  targets.forEach(function (el) { io.observe(el); });
  // printing shows everything
  window.addEventListener("beforeprint", function () { targets.forEach(function (el) { el.classList.add("in"); el.classList.remove("reveal"); }); });
})();

// Mascot + pointer animations. Instead of one fixed animation, each one is picked at random:
//  - hovering / focusing a mascot (or the masthead avatar) plays a random "move", never the same twice in a row
//  - every pointer (glove, stick, lens) idles, and every few seconds plays a random one-off "trick"
//    on its own timer, so they never all move together
(function () {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var MOVES = ["hop-flip", "bounce", "shake", "spin", "squish", "peek", "tilt-wave", "jelly"];
  var TRICKS = {
    hand: ["spin", "wiggle", "boop", "double-tap", "flip"],
    scholar: ["boop", "spin", "wiggle", "flip"],
    explorer: ["spin", "wiggle", "boop"],
    wizard: ["spin", "wiggle", "boop", "flip"],
    arcade: ["flip", "boop", "wiggle", "spin"],
    detective: ["blink", "wiggle", "boop"],
    builder: ["wiggle", "boop", "spin"],
    pirate: ["boop", "wiggle", "flip"],
    berkeley: ["wiggle", "spin", "boop", "flip"],
    fairy: ["spin", "boop", "wiggle"],
    dj: ["boop", "wiggle", "flip"],
    referee: ["double-tap", "boop", "wiggle"],
    soldier: ["boop", "wiggle", "flip"],
    gamer: ["boop", "wiggle", "spin"],
    gardener: ["wiggle", "boop"]
  };

  function pick(list, last) {
    var choice;
    do { choice = list[Math.floor(Math.random() * list.length)]; } while (list.length > 1 && choice === last);
    return choice;
  }

  function play(el, cls) {
    el.classList.remove.apply(el.classList, Array.prototype.filter.call(el.classList, function (c) {
      return c.indexOf("move-") === 0 || c.indexOf("trick-") === 0;
    }));
    void el.offsetWidth; // restart the animation even if the same class comes back
    el.classList.add(cls);
    el.addEventListener("animationend", function done(e) {
      if (e.target !== el) return; // ignore animations ending on children
      el.classList.remove(cls);
      el.removeEventListener("animationend", done);
    });
  }

  // play a random move on a mascot (never the same twice in a row for that mascot)
  function move(target) {
    if (!target || target._busy) return;
    target._busy = true;
    target._lastMove = pick(MOVES, target._lastMove);
    play(target, "move-" + target._lastMove);
    setTimeout(function () { target._busy = false; }, 1200);
  }
  window.mascotMove = move; // used by the conversations below

  // random move on hover / focus
  function bindMoves(trigger, target) {
    function go() { move(target); }
    trigger.addEventListener("mouseenter", go);
    trigger.addEventListener("focus", go);
    trigger.addEventListener("click", go);
  }
  document.querySelectorAll(".tip-mascot").forEach(function (m) { bindMoves(m, m); });
  var avatarLink = document.querySelector(".avatar-link");
  if (avatarLink) bindMoves(avatarLink, avatarLink.querySelector(".avatar-wrap"));

  // random pointer tricks on independent timers
  document.querySelectorAll(".tip-hand-wrap").forEach(function (wrap) {
    var spin = wrap.querySelector(".tip-spin");
    var kind = Object.keys(TRICKS).filter(function (k) { return wrap.classList.contains(k); })[0] || "hand";
    var last = null;
    function schedule() {
      setTimeout(function () {
        if (!document.hidden) {
          last = pick(TRICKS[kind], last);
          play(spin, "trick-" + last);
        }
        schedule();
      }, 3500 + Math.random() * 5500);
    }
    schedule();
  });
})();

// Mascot conversations: when a .chat scrolls into view, each message shows "typing…" dots and then
// appears, one after another. The replay button runs it again. Reduced motion / no observer: all shown.
(function () {
  var chats = document.querySelectorAll(".chat");
  if (!chats.length) return;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) return;

  function play(chat) {
    var msgs = chat.querySelectorAll(".msg");
    var token = (chat._run = (chat._run || 0) + 1);
    msgs.forEach(function (m) {
      m.classList.remove("shown");
      var b = m.querySelector(".msg-bubble");
      if (b.dataset.text === undefined) b.dataset.text = b.innerHTML;
      b.innerHTML = b.dataset.text;
    });
    var t = 0;
    msgs.forEach(function (m) {
      var b = m.querySelector(".msg-bubble");
      var typingFor = Math.min(1400, 450 + b.dataset.text.length * 9);
      setTimeout(function () {
        if (chat._run !== token) return;
        b.innerHTML = "<span class='typing' aria-hidden='true'><i></i><i></i><i></i></span>";
        m.classList.add("shown");
        // the speaker does a random hover move as they start talking
        if (window.mascotMove) window.mascotMove(m.querySelector(".tip-mascot"));
      }, t);
      setTimeout(function () {
        if (chat._run !== token) return;
        b.innerHTML = b.dataset.text;
      }, t + typingFor);
      t += typingFor + 900;
    });
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      play(en.target);
      io.unobserve(en.target);
    });
  }, { threshold: 0.35 });

  chats.forEach(function (chat) {
    chat.classList.add("armed");
    io.observe(chat);
    var btn = chat.querySelector(".chat-replay");
    if (btn) btn.addEventListener("click", function () { play(chat); });
  });
})();

// Subnav groups: the "Projects" / "Internships" labels collapse their links. The state is a per-visitor
// convenience in localStorage; the <head> script applies it before first paint so nothing flashes open.
(function () {
  var root = document.documentElement;
  document.querySelectorAll(".subnav button.group[data-group]").forEach(function (btn) {
    var key = btn.getAttribute("data-group");
    var cls = "nav-closed-" + key;
    btn.setAttribute("aria-expanded", root.classList.contains(cls) ? "false" : "true");
    btn.addEventListener("click", function () {
      var closed = root.classList.toggle(cls);
      btn.setAttribute("aria-expanded", closed ? "false" : "true");
      try { localStorage.setItem("nav-" + key, closed ? "closed" : "open"); } catch (e) {}
    });
  });
})();

// Contact: copy the email address (mailto: does nothing on machines without a default mail app).
(function () {
  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var text = btn.getAttribute("data-copy");
      function done() { btn.textContent = "Copied!"; setTimeout(function () { btn.textContent = "Copy"; }, 1600); }
      function fallback() {
        var sel = window.getSelection(), addr = btn.parentNode.querySelector(".email-addr");
        if (!addr || !sel) return;
        var r = document.createRange(); r.selectNodeContents(addr); sel.removeAllRanges(); sel.addRange(r);
        try { if (document.execCommand("copy")) done(); } catch (e) {}
      }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
      else fallback();
    });
  });
})();
