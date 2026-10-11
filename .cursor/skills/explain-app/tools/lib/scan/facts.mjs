// Fact collector shared by all detectors.
import { cmp, pub } from "./util.mjs";

export class FactSet {
  constructor() {
    this.map = new Map();
  }

  // add("screen", "screen:/x", { name, file, files, meta:{ package, methods:[…], vendor:[…], schedule, tools } })
  add(kind, id, opts = {}) {
    let f = this.map.get(id);
    if (!f) {
      f = { id, kind, name: opts.name ?? "", files: new Set(), methods: new Set(), vendor: new Set(), meta: {} };
      this.map.set(id, f);
    }
    if (opts.name && !f.name) f.name = opts.name;
    if (opts.file) f.files.add(opts.file);
    for (const x of opts.files || []) f.files.add(x);
    const m = opts.meta || {};
    for (const x of m.methods || []) f.methods.add(x);
    for (const x of m.vendor || []) f.vendor.add(x);
    for (const k of ["schedule", "package", "tools"]) if (m[k] != null && f.meta[k] == null) f.meta[k] = m[k];
    return f;
  }

  get(id) {
    return this.map.get(id);
  }

  delete(id) {
    this.map.delete(id);
  }

  ofKind(kind) {
    return [...this.map.values()].filter((f) => f.kind === kind);
  }

  // Give colliding screen / endpoint ids from different packages a `#<package>` suffix.
  splitPackageCollisions(pkgOf) {
    for (const f of [...this.map.values()]) {
      if (f.kind !== "screen" && f.kind !== "endpoint") continue;
      const byPkg = new Map();
      for (const file of f.files) {
        const p = pkgOf(file);
        if (!byPkg.has(p)) byPkg.set(p, new Set());
        byPkg.get(p).add(file);
      }
      if (byPkg.size < 2) continue;
      this.map.delete(f.id);
      for (const [p, files] of [...byPkg].sort((a, b) => cmp(a[0], b[0]))) {
        const id = `${f.id}#${pub(p)}`;
        const g = this.add(f.kind, id, { name: f.name, files, meta: { ...f.meta, methods: [...f.methods], package: pub(p) } });
        g.meta.package = pub(p);
      }
    }
  }

  // Plain, sorted Fact objects (area facts are appended by the caller).
  toFacts() {
    const out = [];
    for (const f of this.map.values()) {
      const meta = {};
      if (f.methods.size) meta.methods = [...f.methods].sort(cmp);
      if (f.vendor.size) meta.vendor = [...f.vendor].sort(cmp);
      if (f.meta.schedule != null) meta.schedule = f.meta.schedule;
      if (f.meta.tools != null) meta.tools = f.meta.tools;
      if (f.meta.package != null) meta.package = f.meta.package;
      const fact = { id: f.id, kind: f.kind, name: f.name, files: [...f.files].sort(cmp) };
      if (Object.keys(meta).length) fact.meta = meta;
      out.push(fact);
    }
    return out;
  }
}

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

// Methods a Next-style route module exports.
export function exportedMethods(code) {
  const set = new Set();
  const M = "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS";
  let m;
  const re1 = new RegExp(`export\\s+(?:async\\s+)?function\\s+(${M})\\b`, "g");
  while ((m = re1.exec(code))) set.add(m[1]);
  const re2 = new RegExp(`export\\s+(?:const|let|var)\\s+(${M})\\b`, "g");
  while ((m = re2.exec(code))) set.add(m[1]);
  const re3 = /export\s+(?:const|let|var)\s*\{([^}]*)\}\s*=/g;
  while ((m = re3.exec(code))) for (const n of m[1].split(",")) if (HTTP_METHODS.includes(n.trim().split(/\s*:\s*/).pop())) set.add(n.trim().split(/\s*:\s*/).pop());
  const re4 = /export\s*\{([^}]*)\}/g;
  while ((m = re4.exec(code))) {
    for (const part of m[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop();
      if (HTTP_METHODS.includes(name)) set.add(name);
    }
  }
  return [...set];
}

// Methods a pages-router handler checks for.
export function inferMethods(code) {
  const set = new Set();
  const M = "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS";
  let m;
  const re1 = new RegExp(`\\b(?:req|request)\\.method\\s*[!=]==?\\s*['"](${M})['"]`, "gi");
  while ((m = re1.exec(code))) set.add(m[1].toUpperCase());
  const re2 = new RegExp(`case\\s+['"](${M})['"]`, "g");
  while ((m = re2.exec(code))) set.add(m[1]);
  return [...set];
}
