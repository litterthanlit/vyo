// Fact-id globs (CONTRACTS §3.1): a pattern matches a whole id. `*` = [^/]*, `**` = .*, leading `!` excludes.

const esc = (c) => c.replace(/[.+?^${}()|[\]\\]/g, "\\$&");

export function globToRegExp(pattern) {
  let re = "";
  for (let i = 0; i < pattern.length; ) {
    if (pattern[i] === "*" && pattern[i + 1] === "*") {
      re += ".*";
      i += 2;
    } else if (pattern[i] === "*") {
      re += "[^/]*";
      i++;
    } else {
      re += esc(pattern[i]);
      i++;
    }
  }
  return new RegExp("^" + re + "$", "s");
}

export function matchGlob(pattern, id) {
  return globToRegExp(pattern.startsWith("!") ? pattern.slice(1) : pattern).test(id);
}

// Apply patterns in order: positives add matches, `!` patterns remove them. Returns the selected ids.
export function selectIds(patterns, ids) {
  const sel = new Set();
  for (const p of patterns) {
    if (p.startsWith("!")) {
      const re = globToRegExp(p.slice(1));
      for (const id of [...sel]) if (re.test(id)) sel.delete(id);
    } else {
      const re = globToRegExp(p);
      for (const id of ids) if (re.test(id)) sel.add(id);
    }
  }
  return sel;
}
