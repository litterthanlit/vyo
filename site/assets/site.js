(() => {
  "use strict";

  /* Load moment: reveal the hero once its lead print has decoded (or after a short cap). */
  const hero = document.querySelector(".hero");
  if (hero) {
    const lead = hero.querySelector(".p1 img");
    let done = false;
    const go = () => { if (!done) { done = true; requestAnimationFrame(() => hero.classList.add("loaded")); } };
    if (lead && !lead.complete) { lead.addEventListener("load", go, { once: true }); lead.addEventListener("error", go, { once: true }); }
    else go();
    setTimeout(go, 900);
  }

  /* Copy buttons: navigator.clipboard, falling back to a selected textarea + execCommand. */
  const fallbackCopy = (text) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (_) { ok = false; }
    ta.remove();
    return ok;
  };
  const selectCode = (btn) => {
    const code = btn.parentElement.querySelector("code");
    if (!code) return;
    const r = document.createRange();
    r.selectNodeContents(code);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
  };
  document.querySelectorAll(".copy[data-copy]").forEach((btn) => {
    const label = btn.querySelector(".copy-label");
    let t;
    btn.addEventListener("click", async () => {
      const text = btn.dataset.copy;
      let ok = false;
      try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); ok = true; } } catch (_) { ok = false; }
      if (!ok) ok = fallbackCopy(text);
      if (!ok) selectCode(btn);
      label.textContent = ok ? "Copied" : "Press ⌘C";
      btn.dataset.state = ok ? "done" : "";
      clearTimeout(t);
      t = setTimeout(() => { label.textContent = "Copy"; btn.dataset.state = ""; }, 1800);
    });
  });

  /* Filters by axis. */
  const chips = [...document.querySelectorAll(".chip[data-filter]")];
  const axes = [...document.querySelectorAll(".axis[data-axis]")];
  const setFilter = (f) => {
    chips.forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.filter === f)));
    axes.forEach((a) => { a.hidden = f !== "all" && a.dataset.axis !== f; });
  };
  chips.forEach((c) => c.addEventListener("click", () => setFilter(c.dataset.filter)));

  /* "Same render as" tiles: jump to the canonical tile, revealing its axis if filtered out. */
  document.querySelectorAll("a[data-ref]").forEach((a) => {
    a.addEventListener("click", (e) => {
      const target = document.getElementById(a.dataset.ref);
      if (!target) return;
      e.preventDefault();
      const axis = target.closest(".axis");
      if (axis && axis.hidden) setFilter("all");
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      const btn = target.querySelector(".shot");
      if (btn) btn.focus({ preventScroll: true });
      target.classList.remove("flash");
      void target.offsetWidth;
      target.classList.add("flash");
    });
  });

  /* Lightbox: <dialog> with showModal (native focus containment), Esc closes, arrows step, focus returns. */
  const lb = document.getElementById("lightbox");
  if (!lb || typeof lb.showModal !== "function") return;
  const img = document.getElementById("lb-img");
  const cap = document.getElementById("lb-cap");
  const count = document.getElementById("lb-count");
  let list = [];
  let idx = 0;
  let opener = null;

  const visibleShots = () => [...document.querySelectorAll(".axis:not([hidden]) .shot")];
  const show = (i) => {
    idx = (i + list.length) % list.length;
    const b = list[idx];
    img.removeAttribute("src");
    img.width = +b.dataset.w;
    img.height = +b.dataset.h;
    img.alt = b.dataset.alt || "";
    img.src = b.dataset.full;
    cap.textContent = b.dataset.caption;
    count.textContent = `${idx + 1} / ${list.length}`;
    const next = list[(idx + 1) % list.length];
    if (next) { const p = new Image(); p.src = next.dataset.full; }
  };
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".shot");
    if (!b) return;
    list = visibleShots();
    opener = b;
    show(list.indexOf(b));
    lb.showModal();
    lb.querySelector('[data-lb="close"]').focus();
  });
  lb.addEventListener("click", (e) => {
    const c = e.target.closest("[data-lb]");
    if (c) {
      const a = c.dataset.lb;
      if (a === "close") lb.close();
      else show(idx + (a === "next" ? 1 : -1));
      return;
    }
    if (e.target === lb || e.target.classList.contains("lb-in") || e.target.classList.contains("lb-fig")) lb.close();
  });
  lb.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); show(idx + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); show(idx - 1); }
  });
  lb.addEventListener("close", () => {
    img.removeAttribute("src");
    if (opener) opener.focus();
  });

  /* Star counts: one GitHub API read, cached for the session. On any failure the pills stay hidden and the buttons still link. */
  const stars = document.querySelectorAll("[data-star]");
  if (stars.length) {
    const KEY = "vyo-stars";
    const compact = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k" : String(n));
    const show = (n) => {
      stars.forEach((a) => {
        const pill = a.querySelector("[data-star-count]");
        pill.querySelector("[data-star-n]").textContent = compact(n);
        pill.setAttribute("data-ready", "");
        a.setAttribute("aria-label", "Star litterthanlit/vyo on GitHub, " + n + (n === 1 ? " star" : " stars"));
      });
    };
    const hide = () => stars.forEach((a) => a.querySelector("[data-star-count]").setAttribute("data-off", ""));
    let cached = null;
    try { const v = parseInt(sessionStorage.getItem(KEY), 10); if (v >= 0) cached = v; } catch (_) {}
    if (cached !== null) show(cached);
    else {
      fetch("https://api.github.com/repos/litterthanlit/vyo", { headers: { Accept: "application/vnd.github+json" } })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((d) => {
          const n = d && d.stargazers_count;
          if (!Number.isInteger(n) || n < 0) throw new Error("bad count");
          try { sessionStorage.setItem(KEY, String(n)); } catch (_) {}
          show(n);
        })
        .catch(hide);
    }
  }
})();
