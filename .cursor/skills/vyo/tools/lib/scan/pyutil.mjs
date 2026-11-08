// Python text helpers: balanced call parsing and literal extraction (works on stripPy output).

// code[open] === "(" -> { text, end } with the text between the parentheses.
export function callArgs(code, open) {
  const n = code.length;
  let depth = 0;
  for (let i = open; i < n; i++) {
    const c = code[i];
    if (c === '"' || c === "'") {
      for (i++; i < n; i++) {
        if (code[i] === "\\") i++;
        else if (code[i] === c || code[i] === "\n") break;
      }
    } else if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      depth--;
      if (depth === 0) return { text: code.slice(open + 1, i), end: i + 1 };
    }
  }
  return null;
}

// Split on top-level commas.
export function splitTop(text) {
  const parts = [];
  let depth = 0;
  let cur = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'") {
      let j = i + 1;
      for (; j < text.length; j++) {
        if (text[j] === "\\") j++;
        else if (text[j] === c || text[j] === "\n") break;
      }
      cur += text.slice(i, j + 1);
      i = j;
      continue;
    }
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
    if (c === "," && depth === 0) {
      parts.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

// positional args and keyword args of a call's argument text
export function parseArgs(text) {
  const pos = [];
  const kw = {};
  for (const part of splitTop(text)) {
    const m = /^([A-Za-z_]\w*)\s*=(?!=)\s*([\s\S]*)$/.exec(part);
    if (m) kw[m[1]] = m[2].trim();
    else pos.push(part);
  }
  return { pos, kw };
}

// "'/x'" -> "/x"; null when not a plain literal. consts resolves NAME / a.b.NAME.
export function pyString(expr, consts) {
  if (expr == null) return null;
  expr = expr.trim();
  let m = /^[rRuUbB]?(['"])((?:\\.|(?!\1)[^\\\n])*)\1$/.exec(expr);
  if (m) return m[2];
  m = /^[fF](['"])((?:\\.|(?!\1)[^\\\n])*)\1$/.exec(expr);
  if (m) {
    let ok = true;
    const v = m[2].replace(/\{([\w.]+)\}/g, (_, name) => {
      const c = constValue(name, consts);
      if (c == null) ok = false;
      return c ?? "";
    });
    return ok ? v : null;
  }
  m = /^([\w.]+)$/.exec(expr);
  if (m && consts) return constValue(m[1], consts);
  return null;
}

function constValue(name, consts) {
  const last = name.split(".").pop();
  const set = consts && consts.get(last);
  if (set && set.size === 1) return [...set][0];
  return null;
}

// Module-level / class-level UPPER_CASE string constants across all python sources.
export function collectConsts(sources) {
  const consts = new Map();
  const re = /^[ \t]*([A-Z][A-Z0-9_]*)[ \t]*(?::[ \t]*[^=\n]+?)?[ \t]*=[ \t]*(['"])([^'"\n]*)\2[ \t]*$/gm;
  for (const [file, src] of sources) {
    if (!file.endsWith(".py")) continue;
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(src.code))) {
      let s = consts.get(m[1]);
      if (!s) consts.set(m[1], (s = new Set()));
      s.add(m[3]);
    }
  }
  return consts;
}

// The block of lines belonging to a class/def starting at `idx` (header line start): up to the next line at indent 0.
export function blockAfter(code, idx) {
  const rest = code.slice(idx);
  const nl = rest.indexOf("\n");
  if (nl < 0) return rest;
  const body = rest.slice(nl + 1);
  const m = /^\S/m.exec(body);
  return body.slice(0, m ? m.index : body.length);
}
