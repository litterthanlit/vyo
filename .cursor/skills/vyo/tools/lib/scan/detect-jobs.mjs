// Jobs: Vercel / Netlify crons, Inngest, Trigger.dev, node-cron, BullMQ, Celery / Dramatiq / Huey / APScheduler.
// A cron target is a job, never also an endpoint.
import { readSmall } from "./files.mjs";
import { callArgs, parseArgs, pyString } from "./pyutil.mjs";
import { jobName } from "./names.mjs";
import { normRoutePath } from "./routes.mjs";
import { basename, extname, pub, stripExt } from "./util.mjs";

export function detectJobs(ctx) {
  const { sources, facts, pkgIndex, allPaths, dir } = ctx;
  const addJob = (id, file, schedule, name) => {
    const pkg = file ? pub(pkgIndex.pkgOf(file)) : undefined;
    facts.add("job", `job:${id}`, { name: name || jobName(id), file, meta: { schedule: schedule || undefined, package: pkg } });
  };

  // vercel.json crons
  for (const p of allPaths) {
    if (basename(p) !== "vercel.json" || /(^|\/)(node_modules|\.[^/]+)\//.test(p)) continue;
    const text = readSmall(dir, p);
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    for (const c of (json && Array.isArray(json.crons) ? json.crons : [])) {
      if (!c || typeof c.path !== "string") continue;
      const path = normRoutePath(c.path);
      const ep = facts.get(`endpoint:${path}`);
      if (ep) {
        facts.delete(ep.id);
        facts.add("job", `job:${path}`, { name: jobName(path), files: ep.files, meta: { schedule: c.schedule, package: ep.meta.package } });
      } else {
        const pk = pkgIndex.pkgOfDir(p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
        facts.add("job", `job:${path}`, { name: jobName(path), meta: { schedule: c.schedule, package: pub(pk) } });
      }
    }
  }

  // netlify.toml scheduled functions
  for (const p of allPaths) {
    if (basename(p) !== "netlify.toml") continue;
    const text = readSmall(dir, p) || "";
    for (const m of text.matchAll(/\[functions\.(?:"([^"]+)"|([\w-]+))\]([^[]*)/g)) {
      const sm = /schedule\s*=\s*"([^"]+)"/.exec(m[3]);
      if (sm) addJob(m[1] || m[2], null, sm[1]);
    }
  }

  for (const [file, src] of sources) {
    const ext = extname(file);
    const code = src.code;
    let m;
    if (ext === ".py") {
      detectPyJobs(ctx, file, code, addJob);
      continue;
    }
    if (!/^\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/.test(ext)) continue;

    if (/\binngest\b/i.test(code) && /createFunction\s*\(/.test(code)) {
      for (m of code.matchAll(/createFunction\s*\(\s*\{([\s\S]{0,400}?)\}/g)) {
        const idm = /\bid\s*:\s*["'`]([^"'`]+)["'`]/.exec(m[1]);
        if (!idm) continue;
        const tail = code.slice(m.index, m.index + 700);
        const cm = /\bcron\s*:\s*["'`]([^"'`]+)["'`]/.exec(tail);
        addJob(idm[1], file, cm && cm[1]);
      }
    }
    if (/@trigger\.dev\//.test(code)) {
      for (m of code.matchAll(/\b(?:schedules\.task|schemaTask|task)\s*\(\s*\{\s*id\s*:\s*["'`]([^"'`]+)["'`](?=([\s\S]{0,300}))/g)) {
        const cm = /\bcron\s*:\s*["'`]([^"'`]+)["'`]/.exec(m[2]);
        addJob(m[1], file, cm && cm[1]);
      }
    }
    if (/\b(node-cron|node-schedule|croner|cron)\b/.test(code) && /from\s*["'](node-cron|node-schedule|croner|cron)["']|require\(\s*["'](node-cron|node-schedule|croner|cron)["']\)/.test(code)) {
      let i = 0;
      for (m of code.matchAll(/\b(?:cron|schedule|scheduleJob|Cron)\.?(?:schedule|scheduleJob)?\s*\(\s*["'`]([^"'`]+)["'`]/g)) {
        if (!/^[\d*/,\-?LW#@a-zA-Z ]+$/.test(m[1]) || !/[\d*@]/.test(m[1])) continue;
        i++;
        addJob(i === 1 ? stripExt(basename(file)) : `${stripExt(basename(file))}-${i}`, file, m[1]);
      }
    }
    if (/@nestjs\/schedule/.test(code)) {
      for (m of code.matchAll(/@(?:Cron|Interval|Timeout)\s*\(([^)]*)\)\s*(?:async\s+)?(\w+)\s*\(/g)) {
        const cm = /["'`]([^"'`]+)["'`]/.exec(m[1]);
        addJob(m[2], file, cm && cm[1]);
      }
    }
    if (/\bbull(mq)?\b/i.test(code) && /from\s*["'](bullmq|bull)["']|require\(\s*["'](bullmq|bull)["']\)/.test(code)) {
      for (m of code.matchAll(/new\s+Worker\s*(?:<[^>(]*>)?\(\s*["'`]([^"'`]+)["'`]/g)) addJob(m[1], file);
    }
    if (/netlify\/functions\//.test(file) || /export\s+const\s+config\s*=\s*\{[^}]*schedule/.test(code)) {
      const sm = /export\s+const\s+config\s*=\s*\{[^}]*schedule\s*:\s*["'`]([^"'`]+)["'`]/.exec(code);
      if (sm) addJob(stripExt(basename(file)), file, sm[1]);
    }
  }
}

function detectPyJobs(ctx, file, code, addJob) {
  let m;
  if (/\b(celery|dramatiq|huey|procrastinate|taskiq|arq)\b/.test(code)) {
    const re = /^[ \t]*@(?:(\w+)\.)?(task|shared_task|actor|periodic_task|db_periodic_task)\b[ \t]*(\([^\n]*)?\n(?:[ \t]*@[^\n]*\n)*[ \t]*(?:async[ \t]+)?def[ \t]+(\w+)/gm;
    while ((m = re.exec(code))) addJob(m[4], file, null);
  }
  if (/\bapscheduler\b/i.test(code)) {
    for (m of code.matchAll(/\.add_job\s*\(/g)) {
      const call = callArgs(code, m.index + m[0].length - 1);
      if (!call) continue;
      const { pos, kw } = parseArgs(call.text);
      const fn = (kw.func || pos[0] || "").replace(/^.*\./, "");
      if (!/^\w+$/.test(fn)) continue;
      const trig = pyString(pos[1], null) || pyString(kw.trigger, null);
      addJob(fn, file, trig);
    }
    for (m of code.matchAll(/^[ \t]*@\w+\.scheduled_job\s*\(([^\n]*)\)\s*\n[ \t]*(?:async[ \t]+)?def[ \t]+(\w+)/gm)) addJob(m[2], file, null);
  }
}
