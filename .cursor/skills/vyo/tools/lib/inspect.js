// Runs inside the rendered poster (page.evaluate). Measures only; lib/check.mjs judges the result.
() => {
  const sheet = document.querySelector(".sheet");
  const box = (r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height });
  const sr = box(sheet.getBoundingClientRect());
  const textRect = (el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return box(range.getBoundingClientRect());
  };
  const label = (el) => el.dataset.block || el.dataset.word || (el.className && String(el.className)) || el.tagName.toLowerCase();
  const visible = (el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0 && r.height > 0;
  };

  const texts = [];
  const boxes = [];
  for (const el of [sheet, ...sheet.querySelectorAll("*")]) {
    if (el.tagName === "SCRIPT" || el.closest("[data-halo]") || !visible(el)) continue;
    const cs = getComputedStyle(el);
    const where = el.closest("[data-block], [data-region]");
    const tagged = !!el.closest("[data-hot]");
    const ownText = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
    const name = where ? where.dataset.block || `region ${where.dataset.region}` : label(el);
    if (ownText) texts.push({ text: ownText.slice(0, 60), color: cs.color, hot: tagged, where: name });
    if (cs.backgroundColor !== "rgba(0, 0, 0, 0)") boxes.push({ color: cs.backgroundColor, hot: tagged, where: name });
  }

  const rows = [...sheet.querySelectorAll(".row")].map((el) => ({
    word: el.dataset.word,
    region: el.dataset.region,
    part: el.dataset.part,
    hot: el.dataset.hot !== undefined,
    text: el.textContent.replace(/\u00a0/g, " "),
    // A row set glyph by glyph in SVG has no box to overflow.
    scrollWidth: el instanceof SVGElement ? 0 : el.scrollWidth,
    clientWidth: el instanceof SVGElement ? 0 : el.clientWidth,
    rect: box(el.getBoundingClientRect()),
  }));

  const dots = [...sheet.querySelectorAll(".dots")].map((el) => ({ word: el.dataset.word, region: el.dataset.region, hot: el.dataset.hot !== undefined, rect: box(el.getBoundingClientRect()) }));

  const blocks = [...sheet.querySelectorAll("[data-block]")].map((el) => {
    const cs = getComputedStyle(el);
    const rect = textRect(el);
    return { name: el.dataset.block, role: el.dataset.role, text: el.innerText.replace(/\s+/g, " ").trim(), rect, lines: Math.round(rect.height / parseFloat(cs.lineHeight)), owner: el.dataset.owner || "figure" };
  });

  const figureHot = [...sheet.querySelectorAll("[data-hot]")]
    .filter((el) => !el.closest("[data-owner=render]"))
    .map((el) => el.dataset.word || el.textContent.replace(/ /g, " "));

  const faces = [...document.fonts].map((f) => ({ family: f.family.replace(/["']/g, ""), weight: String(f.weight), status: f.status }));

  const ctx = document.createElement("canvas").getContext("2d");
  const probe = (family) => {
    ctx.font = `700 40px ${family}, monospace`;
    const a = ctx.measureText("Hamburgefontsiv 0123").width;
    ctx.font = "700 40px monospace";
    return a !== ctx.measureText("Hamburgefontsiv 0123").width;
  };

  const hairline = sheet.querySelector("[data-footer]");
  const footerTop = hairline ? hairline.getBoundingClientRect().top : sr.bottom;
  const regions = (window.figure && window.figure.regions) || [];

  return { sheet: sr, footerTop, texts, boxes, rows, dots, blocks, regions, figureHot, faces, inter: probe('"Inter Display"') || probe("Inter"), drawn: window.drawn === true };
}
