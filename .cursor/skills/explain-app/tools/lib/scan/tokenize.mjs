// Tiny lexers: blank out comments (keeping offsets and newlines) and pull out string
// literals that start with "/" (used for http uses). Never throws.

const blank = (s) => s.replace(/[^\n]/g, " ");

// JS/TS/JSX/Vue/Svelte/Astro/Prisma/Go/Java-ish: // and /* */ comments, '"` strings, regex literals.
// Returns { code, strings }. `code` has the same length as `src`.
// strings: { value, pos, template } for literals whose text starts with "/".
// Template expressions inside a literal are written as \u0001.
export function scanJs(src) {
  const n = src.length;
  const pieces = [];
  const strings = [];
  let last = 0;
  let i = 0;
  let depth = 0;
  let prev = ""; // last significant char class for the regex-vs-divide guess
  const stack = []; // resume points for template literals interrupted by ${ }

  const flushTo = (end, replacement) => {
    pieces.push(src.slice(last, end));
    last = end;
    if (replacement != null) pieces.push(replacement);
  };

  // Scan template text starting at j. Returns the index to continue code scanning from.
  const scanTemplate = (j, tpl) => {
    while (j < n) {
      const ch = src[j];
      if (ch === "\\") {
        tpl.value += src[j + 1] ?? "";
        j += 2;
      } else if (ch === "`") {
        let v = tpl.value;
        // `${base}/api/x`: an expression, then a path
        if (v.charCodeAt(0) === 1 && v.charCodeAt(1) === 47) v = v.slice(1);
        if (v.charCodeAt(0) === 47) strings.push({ value: v, pos: tpl.pos, template: true });
        prev = '"';
        return j + 1;
      } else if (ch === "$" && src[j + 1] === "{") {
        tpl.value += "\u0001";
        stack.push({ depth, tpl });
        depth = 0;
        prev = "{";
        return j + 2;
      } else {
        tpl.value += ch;
        j++;
      }
    }
    return j;
  };

  while (i < n) {
    const c = src.charCodeAt(i);
    if (c === 47) {
      const d = src.charCodeAt(i + 1);
      if (d === 47) {
        let j = src.indexOf("\n", i);
        if (j < 0) j = n;
        flushTo(i, blank(src.slice(i, j)));
        last = j;
        i = j;
        continue;
      }
      if (d === 42) {
        let j = src.indexOf("*/", i + 2);
        j = j < 0 ? n : j + 2;
        flushTo(i, blank(src.slice(i, j)));
        last = j;
        i = j;
        continue;
      }
      if (prev === "" || "(,=:[!&|?{};+-*%~^".includes(prev)) {
        // regex literal?
        let j = i + 1;
        let inClass = false;
        let ok = false;
        while (j < n) {
          const ch = src[j];
          if (ch === "\n") break;
          if (ch === "\\") {
            j += 2;
            continue;
          }
          if (ch === "[") inClass = true;
          else if (ch === "]") inClass = false;
          else if (ch === "/" && !inClass) {
            ok = true;
            break;
          }
          j++;
        }
        if (ok) {
          j++;
          while (j < n && /[a-z]/.test(src[j])) j++;
          i = j;
          prev = ")";
          continue;
        }
      }
      prev = "/";
      i++;
      continue;
    }
    if (c === 34 || c === 39) {
      let j = i + 1;
      while (j < n) {
        const ch = src.charCodeAt(j);
        if (ch === 92) {
          j += 2;
          continue;
        }
        if (ch === c || ch === 10) break;
        j++;
      }
      const value = src.slice(i + 1, j);
      if (value.charCodeAt(0) === 47) strings.push({ value, pos: i, template: false });
      i = src.charCodeAt(j) === c ? j + 1 : j;
      prev = '"';
      continue;
    }
    if (c === 96) {
      i = scanTemplate(i + 1, { value: "", pos: i });
      continue;
    }
    if (c === 123) {
      depth++;
      prev = "{";
      i++;
      continue;
    }
    if (c === 125) {
      if (depth === 0 && stack.length) {
        const top = stack.pop();
        depth = top.depth;
        i = scanTemplate(i + 1, top.tpl);
        continue;
      }
      depth--;
      prev = "}";
      i++;
      continue;
    }
    if (c > 32) {
      if (c === 62 && src.charCodeAt(i - 1) === 61) prev = "="; // `=> /re/`
      else if ((c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || c === 36) prev = "a";
      else prev = src[i];
    }
    i++;
  }
  flushTo(n, null);
  return { code: pieces.join(""), strings };
}

// Python: drop # comments and triple-quoted strings (docstrings), keep ordinary strings.
export function stripPy(src) {
  const n = src.length;
  const pieces = [];
  let last = 0;
  let i = 0;
  while (i < n) {
    const c = src[i];
    if (c === "#") {
      let j = src.indexOf("\n", i);
      if (j < 0) j = n;
      pieces.push(src.slice(last, i), blank(src.slice(i, j)));
      last = i = j;
      continue;
    }
    if (c === '"' || c === "'") {
      if (src[i + 1] === c && src[i + 2] === c) {
        const close = c.repeat(3);
        let j = i + 3;
        for (;;) {
          const k = src.indexOf(close, j);
          if (k < 0) {
            j = n;
            break;
          }
          if (src[k - 1] === "\\") {
            j = k + 1;
            continue;
          }
          j = k + 3;
          break;
        }
        pieces.push(src.slice(last, i), blank(src.slice(i, j)));
        last = i = j;
        continue;
      }
      let j = i + 1;
      while (j < n) {
        const ch = src[j];
        if (ch === "\\") {
          j += 2;
          continue;
        }
        if (ch === c || ch === "\n") break;
        j++;
      }
      i = j + 1;
      continue;
    }
    i++;
  }
  pieces.push(src.slice(last));
  return pieces.join("");
}

// SQL: -- line comments and /* */ blocks.
export function stripSql(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/--[^\n]*/g, blank);
}

// Parse JSON with comments / trailing commas (tsconfig style). Returns null on failure.
export function parseJsonc(text) {
  try {
    const { code } = scanJs(text);
    return JSON.parse(code.replace(/,(\s*[}\]])/g, "$1"));
  } catch {
    return null;
  }
}
