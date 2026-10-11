// Tables: Prisma, Drizzle, Mongoose, TypeORM, Sequelize, Convex, SQLModel / SQLAlchemy / Django / Peewee, SQL migrations.
import { callArgs, parseArgs, blockAfter } from "./pyutil.mjs";
import { tableName } from "./names.mjs";
import { cmp, extname, pub } from "./util.mjs";

const SKIP_TABLES = /^(_prisma_migrations|__drizzle_migrations|drizzle_migrations|alembic_version|schema_migrations|django_migrations|knex_migrations(_lock)?|migrations|spatial_ref_sys|sqlite_sequence)$/i;

const normKey = (name) => name.toLowerCase().replace(/_/g, "");

export function detectTables(ctx) {
  const { sources, facts, pkgIndex } = ctx;
  const drizzleVars = new Map(); // file -> Map<var, tableId>
  const pyClasses = new Map(); // file -> Map<class, tableId>
  const sqlTables = []; // { name, file }
  const addTable = (name, file) => {
    if (!name || SKIP_TABLES.test(name)) return null;
    const id = "table:" + name;
    facts.add("table", id, { name: tableName(name), file, meta: { package: pub(pkgIndex.pkgOf(file)) } });
    return id;
  };
  const names = new Map(); // normKey -> id (first wins, models first)

  for (const [file, src] of sources) {
    const ext = extname(file);
    const code = src.code;
    let m;
    if (ext === ".prisma") {
      for (m of code.matchAll(/^\s*model\s+(\w+)\s*\{/gm)) addTable(m[1], file);
    } else if (ext === ".sql") {
      sqlTables.push(...sqlStatements(code, file));
    } else if (ext === ".py") {
      detectPyTables(ctx, file, code, addTable, pyClasses);
    } else if (/^\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/.test(ext)) {
      if (/\b(?:pg|mysql|sqlite|singlestore)Table\b|TableCreator\b/.test(code)) {
        const vars = new Map();
        const creators = [];
        for (m of code.matchAll(/\b(?:const|let)\s+(\w+)\s*=\s*(?:\w+\.)?(?:pg|mysql|sqlite|singlestore)TableCreator\b/g)) creators.push(m[1]);
        const callees = ["(?:\\w+\\.)?(?:pg|mysql|sqlite|singlestore)Table", ...creators.map((c) => c)];
        for (const callee of callees) {
          const re = new RegExp(`(?:\\b(?:const|let)\\s+(\\w+)\\s*=\\s*)?\\b${callee}\\s*(?:<[^>(]*>)?\\(\\s*(["'\`])([^"'\`]+)\\2`, "g");
          for (m of code.matchAll(re)) {
            const id = addTable(m[3], file);
            if (id && m[1]) vars.set(m[1], id);
          }
        }
        // `pgSchema("x").table("name", …)`
        for (m of code.matchAll(/\b(?:const|let)\s+(\w+)\s*=\s*(?:\w+)\.table\(\s*(["'`])([^"'`]+)\2/g)) {
          if (/pgSchema|mysqlSchema/.test(code)) {
            const id = addTable(m[3], file);
            if (id) vars.set(m[1], id);
          }
        }
        if (vars.size) drizzleVars.set(file, vars);
      }
      if (/\bmongoose\b/.test(code)) {
        for (m of code.matchAll(/\bmodel(?:<[^>(]*>)?\(\s*(["'`])(\w+)\1/g)) addTable(m[2], file);
      }
      if (/\btypeorm\b/.test(code)) {
        for (m of code.matchAll(/@Entity\s*\([^)]*\)\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+(\w+)/g)) addTable(m[1], file);
      }
      if (/\bsequelize\b/i.test(code)) {
        for (m of code.matchAll(/\bsequelize\.define\(\s*(["'`])(\w+)\1/g)) addTable(m[2], file);
        for (m of code.matchAll(/\bclass\s+(\w+)\s+extends\s+Model\b[\s\S]{0,4000}?\b\1\.init\(/g)) addTable(m[1], file);
      }
      if (/convex\/server/.test(code)) {
        for (m of code.matchAll(/\b(\w+)\s*:\s*defineTable\s*\(/g)) addTable(m[1], file);
      }
    }
  }

  // SQL: model names win; SQL-only tables count only when no model declares any table.
  const modelTables = facts.ofKind("table");
  for (const t of modelTables) names.set(normKey(t.id.slice(6)), t.id);
  const live = new Map(); // normKey -> { name, files:Set }
  for (const s of sqlTables) {
    if (s.drop) {
      live.delete(normKey(s.name));
      continue;
    }
    const k = normKey(s.name);
    if (!live.has(k)) live.set(k, { name: s.name, files: new Set() });
    live.get(k).files.add(s.file);
  }
  for (const [k, t] of [...live].sort((a, b) => cmp(a[0], b[0]))) {
    if (SKIP_TABLES.test(t.name)) continue;
    const existing = names.get(k);
    if (existing) facts.add("table", existing, { files: t.files });
    else if (modelTables.length === 0) {
      for (const file of [...t.files].sort(cmp)) addTable(t.name, file);
    }
  }

  dedupeCaseInsensitive(facts);
  dropSuperseded(facts);
  return { drizzleVars, pyClasses };
}

// "User" and "user" are one table; keep the capitalised spelling (the model's name) and merge the files.
function dedupeCaseInsensitive(facts) {
  const groups = new Map();
  for (const t of facts.ofKind("table")) {
    const k = t.id.slice(6).toLowerCase();
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(t);
  }
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => Number(/^[A-Z]/.test(b.id.slice(6))) - Number(/^[A-Z]/.test(a.id.slice(6))) || cmp(a.id, b.id));
    const [keep, ...rest] = list;
    for (const r of rest) {
      for (const f of r.files) keep.files.add(f);
      facts.delete(r.id);
    }
  }
}

// `Message` next to `Message_v2` is the old copy: keep the newest version only.
function dropSuperseded(facts) {
  const tables = facts.ofKind("table").map((t) => t.id.slice(6));
  const set = new Set(tables.map((n) => n.toLowerCase()));
  for (const n of tables) {
    const m = /^(.*)_v(\d+)$/i.exec(n);
    if (m && set.has(m[1].toLowerCase())) {
      const old = tables.find((x) => x.toLowerCase() === m[1].toLowerCase());
      const oldFact = facts.get("table:" + old);
      const newFact = facts.get("table:" + n);
      if (oldFact && newFact) {
        for (const f of oldFact.files) newFact.files.add(f);
        facts.delete("table:" + old);
      }
    }
  }
}

function sqlStatements(code, file) {
  const out = [];
  const re = /\b(?:create\s+(?:or\s+replace\s+)?(?:(?:global\s+|local\s+)?(?:temp|temporary)\s+|unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?|drop\s+table\s+(?:if\s+exists\s+)?)((?:[`"\[]?[\w$]+[`"\]]?\s*\.\s*)?)[`"\[]?([\w$]+)[`"\]]?/gi;
  let m;
  while ((m = re.exec(code))) {
    const drop = /^\s*drop/i.test(m[0]);
    out.push({ name: m[2], file, drop });
  }
  return out;
}

function detectPyTables(ctx, file, code, addTable, pyClasses) {
  if (!/\b(sqlmodel|sqlalchemy|flask_sqlalchemy|django|peewee|tortoise|mongoengine|beanie|odmantic)\b/.test(code)) return;
  const re = /^class[ \t]+(\w+)[ \t]*\(/gm;
  let m;
  while ((m = re.exec(code))) {
    const call = callArgs(code, m.index + m[0].length - 1);
    if (!call) continue;
    const { pos, kw } = parseArgs(call.text);
    const bases = pos.join(",");
    const body = blockAfter(code, m.index);
    let isTable = false;
    if (/\bSQLModel\b/.test(bases) || kw.table != null) {
      isTable = kw.table === "True";
    } else if (/\bsqlalchemy|flask_sqlalchemy\b/.test(code) && /(\bBase\b|DeclarativeBase|\bdb\.Model\b|\bModel\b|\w+Base\b)/.test(bases)) {
      isTable = /__tablename__|\bColumn\(|\bmapped_column\(|\bMapped\[/.test(body) && !/__abstract__\s*=\s*True/.test(body);
    } else if (/\bdjango\b/.test(code) && /\bmodels\.Model\b/.test(bases)) {
      isTable = !/abstract\s*=\s*True/.test(body);
    } else if (/\b(peewee|tortoise)\b/.test(code) && /\bModel\b/.test(bases)) {
      isTable = /Field\(/.test(body);
    } else if (/\b(mongoengine|beanie|odmantic)\b/.test(code) && /\b(Document|Model|EmbeddedDocument)\b/.test(bases)) {
      isTable = !/EmbeddedDocument/.test(bases);
    }
    if (!isTable) continue;
    const id = addTable(m[1], file);
    if (id) {
      if (!pyClasses.has(file)) pyClasses.set(file, new Map());
      pyClasses.get(file).set(m[1], id);
    }
  }
}
