#!/usr/bin/env node
// Temporary CI diagnostics for the e2e flake investigation. Never merge.
//
// Subcommands (all no-ops off Linux):
//   start                                  print the task fingerprint, ensure the agent sampler runs
//   daemon [spawnedAtMs]                   the agent-wide sampler, spawned detached by `start`
//   report <taskId> <startMs>              print the agent timeline for one task's window
//   forensics <id> <outFile> <cwd> <outputFile>   snapshot the agent right after a failed command
//
// Printed lines are `[pressure-probe] <json>`. The report prints timeline rows
// and census snapshots as `blob` lines: join the parts' `b64` in order, gunzip,
// and split on newlines for one JSON object per row or snapshot. Files live
// under /tmp only, so they never touch task inputs, outputs or git status.

import { execFileSync, spawn } from 'node:child_process';
import dns from 'node:dns';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const SCRIPT = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT), '../..');
const DIR = '/tmp/nx-pressure-probe';
const PIDFILE = path.join(DIR, 'sampler.pid');
const TIMELINE = path.join(DIR, 'timeline.ndjson');
const CENSUS = path.join(DIR, 'census.ndjson');
const EVENTS = path.join(DIR, 'events.ndjson');
const TASKS_DIR = path.join(DIR, 'tasks');
const ACTIVE_DIR = path.join(DIR, 'active');
const RUNNING_DIR = path.join(DIR, 'running');
const FORENSICS_DIR = path.join(DIR, 'forensics');
// Must match `logs.path` in .verdaccio/config.yml. It sits directly in /tmp
// because pino does not create missing directories.
const REGISTRY_LOG = '/tmp/nx-pressure-probe-verdaccio.log';
const PREFIX = '[pressure-probe] ';
const BLOB_PART_CHARS = 32 * 1024;
const TICK_MS = 5000;
const CENSUS_EVERY_TICKS = 2;
const NPM_PING_EVERY_TICKS = 6;
const MAX_LIFETIME_MS =
  Number(process.env.NX_PRESSURE_PROBE_MAX_LIFETIME_MS) || 5 * 3600 * 1000;
const IDLE_EXIT_MS =
  Number(process.env.NX_PRESSURE_PROBE_IDLE_EXIT_MS) || 10 * 60 * 1000;
const PING_TIMEOUT_MS = 4000;
const NPM_PING_TIMEOUT_MS = 10000;
const REGISTRY_ENTRY_EXPIRY_MS = 600000;
// Bounds the verdaccio log on the agent's disk; it takes about 1 KB per request.
// Truncation waits for a quiet log, since lines written during it are lost.
const REGISTRY_LOG_CAP_BYTES =
  Number(process.env.NX_PRESSURE_PROBE_REGISTRY_LOG_CAP_BYTES) ||
  256 * 1024 * 1024;
const REGISTRY_LOG_QUIET_MS = 2000;
const SLOW_COMMAND_SNAPSHOTS_S = [45, 90, 180, 300];
const SLOW_COMMAND_REPEAT_S = 120;
const REGISTRY_PORT = process.env.NX_LOCAL_REGISTRY_PORT ?? '4873';

const HOME = os.homedir();
const UID = typeof process.getuid === 'function' ? process.getuid() : null;

function print(kind, data) {
  process.stdout.write(`${PREFIX}${JSON.stringify({ kind, ...data })}\n`);
}

function readText(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

// Number(null) is 0, which would turn a missing counter file into a zero reading.
function readNumber(p) {
  const t = readText(p)?.trim();
  return t && /^-?\d+$/.test(t) ? Number(t) : null;
}

function readResult(p) {
  try {
    return { ok: true, text: fs.readFileSync(p, 'utf8') };
  } catch (e) {
    return { ok: false, code: e.code ?? String(e) };
  }
}

function appendLine(file, obj) {
  fs.appendFileSync(file, JSON.stringify(obj) + '\n');
}

function round(n, digits = 2) {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function keyValues(text) {
  const out = {};
  if (!text) return out;
  for (const line of text.split('\n')) {
    const [k, v] = line.trim().split(/\s+/);
    if (k && v !== undefined && /^-?\d+$/.test(v)) out[k] = Number(v);
  }
  return out;
}

function getconf(name, fallback) {
  try {
    const v = Number(
      execFileSync('getconf', [name], {
        encoding: 'utf8',
        timeout: 5000,
      }).trim()
    );
    return Number.isFinite(v) && v > 0 ? v : fallback;
  } catch {
    return fallback;
  }
}

function listDir(p) {
  try {
    return fs.readdirSync(p);
  } catch {
    return null;
  }
}

function processAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

// Same rules as redact() in e2e/utils/pressure-probe.ts.
function redact(s) {
  return s
    .replace(
      /((?:token|password|passwd|secret|auth|api[-_]?key|[-_]key|credential|signature)[\w-]*["']?\s*[=: ]\s*)(?:(?:bearer|basic|token)\s+)?(?:"[^"]*"|'[^']*'|[^\s"']+)/gi,
      '$1<redacted>'
    )
    .replace(/\beyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]+/g, '<redacted>')
    .replace(/\b(bearer|basic)\s+[\w.~+/=-]+/gi, '$1 <redacted>')
    .replace(/\/\/[^/\s:@]+:[^/\s@]+@/g, '//<redacted>@')
    .replace(
      /\b(?:npm_\w{36}|gh[opsur]_\w{36,}|github_pat_\w{20,})\b/g,
      '<redacted>'
    );
}

// A joined argv loses argument boundaries, so a bare secret flag hides the whole next argument.
const SECRET_FLAG_RE =
  /^-{1,2}[\w-]*(?:token|password|passwd|secret|auth|api[-_]?key|[-_]key|credential)[\w-]*$/i;
function shownCmdline(args) {
  return redact(
    args
      .map((a, i) =>
        i > 0 && SECRET_FLAG_RE.test(args[i - 1]) ? '<redacted>' : a
      )
      .join(' ')
  ).slice(0, 220);
}

function readJsonFiles(dir) {
  const out = [];
  for (const name of listDir(dir) ?? []) {
    if (!name.endsWith('.json')) continue;
    const text = readText(path.join(dir, name));
    if (!text) continue;
    try {
      out.push({ file: path.join(dir, name), ...JSON.parse(text) });
    } catch {}
  }
  return out;
}

// ---------------------------------------------------------------------------
// Mounts and cgroups

function unescapeMount(s) {
  return s.replace(/\\([0-7]{3})/g, (_, o) =>
    String.fromCharCode(parseInt(o, 8))
  );
}

function readMounts() {
  const mounts = [];
  for (const line of (readText('/proc/self/mountinfo') ?? '').split('\n')) {
    const parts = line.split(' ');
    const sep = parts.indexOf('-');
    if (sep < 0 || parts.length < sep + 3) continue;
    mounts.push({
      majMin: parts[2],
      root: unescapeMount(parts[3]),
      mountPoint: unescapeMount(parts[4]),
      opts: parts[5],
      fstype: parts[sep + 1],
      source: unescapeMount(parts[sep + 2]),
      superOpts: parts[sep + 3] ?? '',
    });
  }
  return mounts;
}

function nearestExisting(p) {
  let cur = path.resolve(p);
  while (true) {
    try {
      return { path: fs.realpathSync(cur), exists: cur === path.resolve(p) };
    } catch {
      const parent = path.dirname(cur);
      if (parent === cur) return { path: '/', exists: false };
      cur = parent;
    }
  }
}

function mountFor(mounts, realPath) {
  let best = null;
  for (const m of mounts) {
    const mp = m.mountPoint;
    const inside =
      mp === '/' || realPath === mp || realPath.startsWith(mp + '/');
    // A later entry on the same mount point shadows an earlier one.
    if (inside && (!best || mp.length >= best.mountPoint.length)) best = m;
  }
  return best;
}

function resolveCgroup(mounts) {
  const self = readText('/proc/self/cgroup') ?? '';
  const v2 = mounts.find((m) => m.fstype === 'cgroup2');
  const v2Mount = v2?.mountPoint ?? null;
  let v2Path = null;
  const v1Paths = {};
  for (const line of self.split('\n')) {
    const m = /^(\d+):([^:]*):(.*)$/.exec(line);
    if (!m) continue;
    if (m[1] === '0' && m[2] === '') v2Path = m[3];
    else for (const c of m[2].split(',')) v1Paths[c] = m[3];
  }
  if (v2Mount && v2Path !== null) {
    // /proc/self/cgroup is relative to the hierarchy root; the mount may expose a subtree.
    const underRoot = path.relative(v2.root ?? '/', v2Path);
    const candidates = underRoot.startsWith('..')
      ? [path.join(v2Mount, v2Path), v2Mount]
      : [path.join(v2Mount, underRoot), path.join(v2Mount, v2Path), v2Mount];
    for (const dir of candidates) {
      if (fs.existsSync(path.join(dir, 'cpu.stat')))
        return { version: 2, dir, self: self.trim() };
    }
  }
  const v1 = {};
  for (const m of mounts.filter((x) => x.fstype === 'cgroup')) {
    for (const c of m.superOpts.split(',')) {
      if (['cpu', 'cpuacct', 'memory'].includes(c)) {
        const rel = v1Paths[c] ?? '/';
        const candidates = [
          path.join(m.mountPoint, path.relative(m.root, rel)),
          m.mountPoint,
        ];
        v1[c] = candidates.find((d) => fs.existsSync(d)) ?? null;
      }
    }
  }
  if (Object.keys(v1).length) return { version: 1, v1, self: self.trim() };
  return { version: 0, self: self.trim() };
}

function pressurePaths(cg) {
  const host = {
    cpu: '/proc/pressure/cpu',
    io: '/proc/pressure/io',
    mem: '/proc/pressure/memory',
  };
  const cgroup =
    cg.version === 2
      ? {
          cpu: path.join(cg.dir, 'cpu.pressure'),
          io: path.join(cg.dir, 'io.pressure'),
          mem: path.join(cg.dir, 'memory.pressure'),
        }
      : null;
  return { host, cgroup };
}

function parsePressure(text) {
  if (!text) return null;
  const out = {};
  for (const line of text.split('\n')) {
    const m =
      /^(some|full)\s+avg10=[\d.]+\s+avg60=[\d.]+\s+avg300=[\d.]+\s+total=(\d+)/.exec(
        line.trim()
      );
    if (m) out[m[1]] = Number(m[2]);
  }
  return Object.keys(out).length ? out : null;
}

// ---------------------------------------------------------------------------
// Fingerprint, printed once at the start of each task

const ENV_VALUES = [
  'CI',
  'NX_DAEMON',
  'NX_BATCH_MODE',
  'NX_E2E_RUN_E2E',
  'NX_CI_EXECUTION_ENV',
  'NX_PARALLEL',
  'NX_TASK_TARGET_PROJECT',
  'NX_TASK_TARGET_TARGET',
  'NX_TASK_TARGET_CONFIGURATION',
  'NX_TASK_HASH',
  'NX_LOCAL_REGISTRY_PORT',
  'NX_CLOUD_USE_ULTRACACHE',
  'NODE_OPTIONS',
  'GRADLE_OPTS',
  'MAVEN_OPTS',
  'JAVA_TOOL_OPTIONS',
  'JAVA_HOME',
  'TMPDIR',
  'SELECTED_PM',
  'PLAYWRIGHT_INSTALL_ARGS',
  'CYPRESS_INSTALL_BINARY',
];

function fingerprint() {
  const mounts = readMounts();
  const cg = resolveCgroup(mounts);
  const pp = pressurePaths(cg);
  const psi = {};
  for (const [scope, files] of Object.entries({
    host: pp.host,
    cgroup: pp.cgroup ?? {},
  })) {
    for (const [res, file] of Object.entries(files)) {
      const r = readResult(file);
      psi[`${scope}.${res}`] = r.ok
        ? r.text.trim().replace(/\n/g, ' | ')
        : `unavailable:${r.code}`;
    }
  }
  const cgroupFiles = {};
  const readInto = (dir, names) => {
    for (const f of names) {
      const t = readText(path.join(dir, f));
      if (t !== null) cgroupFiles[f] = t.trim();
    }
  };
  if (cg.version === 2) {
    readInto(cg.dir, [
      'cpu.max',
      'cpu.weight',
      'cpuset.cpus.effective',
      'memory.max',
      'memory.high',
      'memory.swap.max',
      'io.max',
      'pids.max',
      'pids.current',
    ]);
  } else if (cg.version === 1) {
    if (cg.v1.cpu)
      readInto(cg.v1.cpu, [
        'cpu.cfs_quota_us',
        'cpu.cfs_period_us',
        'cpu.shares',
      ]);
    if (cg.v1.memory) readInto(cg.v1.memory, ['memory.limit_in_bytes']);
  }
  const watched = [
    '/',
    '/tmp',
    os.tmpdir(),
    HOME,
    path.join(HOME, '.m2'),
    path.join(HOME, '.m2/wrapper/dists'),
    path.join(HOME, '.gradle'),
    path.join(HOME, '.cache'),
    path.join(HOME, '.cache/ms-playwright'),
    path.join(HOME, '.cache/Cypress'),
    path.join(HOME, '.local/share/pnpm'),
    '/tmp/.pnpm-store',
    '/tmp/.nx',
    REPO_ROOT,
    process.cwd(),
  ];
  const paths = {};
  for (const p of watched) {
    const n = nearestExisting(p);
    const m = mountFor(mounts, n.path);
    let dev = null;
    try {
      dev = fs.statSync(n.path).dev;
    } catch {}
    paths[p] = {
      resolved: n.path,
      exists: n.exists,
      dev,
      mount: m
        ? {
            point: m.mountPoint,
            fstype: m.fstype,
            source: m.source,
            majMin: m.majMin,
            opts: m.opts,
          }
        : null,
    };
  }
  const same = (a, b) =>
    paths[a]?.dev !== null &&
    paths[a]?.dev !== undefined &&
    paths[a].dev === paths[b]?.dev;
  const blockDevices = {};
  for (const name of listDir('/sys/block') ?? []) {
    if (/^(loop|ram|zram)/.test(name)) continue;
    const q = `/sys/block/${name}/queue`;
    const sectors = readNumber(`/sys/block/${name}/size`);
    blockDevices[name] = {
      sizeGB: sectors === null ? null : round((sectors * 512) / 1e9, 1),
      rotational: readText(`${q}/rotational`)?.trim() ?? null,
      scheduler: readText(`${q}/scheduler`)?.trim() ?? null,
      nrRequests: readText(`${q}/nr_requests`)?.trim() ?? null,
      dev: readText(`/sys/block/${name}/dev`)?.trim() ?? null,
    };
  }
  const hostCpus = (readText('/proc/stat') ?? '')
    .split('\n')
    .filter((l) => /^cpu\d+ /.test(l)).length;
  const env = {};
  for (const k of ENV_VALUES)
    if (process.env[k] !== undefined) env[k] = redact(process.env[k]);
  const limits = {};
  for (const line of (readText('/proc/self/limits') ?? '').split('\n')) {
    const m = /^Max (open files|processes)\s+(\S+)\s+(\S+)/.exec(line);
    if (m) limits[m[1]] = { soft: m[2], hard: m[3] };
  }
  return {
    t: Date.now(),
    hostname: os.hostname(),
    pid: process.pid,
    node: process.version,
    kernel: os.release(),
    procVersion: readText('/proc/version')?.trim() ?? null,
    uptimeS: round(Number((readText('/proc/uptime') ?? '0').split(' ')[0]), 0),
    cpuModel: os.cpus()[0]?.model ?? null,
    osCpus: os.cpus().length,
    availableParallelism: os.availableParallelism?.() ?? null,
    hostCpus,
    memTotalGB: round(os.totalmem() / 1e9, 1),
    cgroup: {
      version: cg.version,
      dir: cg.dir ?? null,
      self: cg.self,
      files: cgroupFiles,
    },
    psi,
    paths,
    sameDevice: {
      'tmp~m2wrapper': same('/tmp', path.join(HOME, '.m2/wrapper/dists')),
      'tmpdir~m2wrapper': same(
        os.tmpdir(),
        path.join(HOME, '.m2/wrapper/dists')
      ),
      'tmp~home': same('/tmp', HOME),
      'tmp~pnpmstore': same('/tmp', '/tmp/.pnpm-store'),
      'tmp~repo': same('/tmp', REPO_ROOT),
    },
    blockDevices,
    limits,
    sysctl: {
      inotifyMaxUserWatches:
        readText('/proc/sys/fs/inotify/max_user_watches')?.trim() ?? null,
      inotifyMaxUserInstances:
        readText('/proc/sys/fs/inotify/max_user_instances')?.trim() ?? null,
      fileNr: readText('/proc/sys/fs/file-nr')?.trim() ?? null,
      somaxconn: readText('/proc/sys/net/core/somaxconn')?.trim() ?? null,
      pidMax: readText('/proc/sys/kernel/pid_max')?.trim() ?? null,
      dirtyRatio: readText('/proc/sys/vm/dirty_ratio')?.trim() ?? null,
      dirtyBackgroundRatio:
        readText('/proc/sys/vm/dirty_background_ratio')?.trim() ?? null,
      swappiness: readText('/proc/sys/vm/swappiness')?.trim() ?? null,
    },
    env,
    // Names only: values of other NX_* variables may be credentials.
    nxEnvNames: Object.keys(process.env)
      .filter((k) => /^NX_/.test(k))
      .sort(),
  };
}

// ---------------------------------------------------------------------------
// System counters

function readProcStat() {
  const text = readText('/proc/stat');
  if (!text) return null;
  const r = {};
  for (const line of text.split('\n')) {
    const f = line.trim().split(/\s+/);
    // user nice system idle iowait irq softirq steal; guest time is already in user.
    if (f[0] === 'cpu') r.cpu = f.slice(1, 9).map(Number);
    else if (f[0] === 'ctxt') r.ctxt = Number(f[1]);
    else if (f[0] === 'processes') r.forks = Number(f[1]);
    else if (f[0] === 'procs_running') r.running = Number(f[1]);
    else if (f[0] === 'procs_blocked') r.blocked = Number(f[1]);
    else if (f[0] === 'btime') r.btime = Number(f[1]);
  }
  return r;
}

function readDiskstats(allowed) {
  const out = {};
  for (const line of (readText('/proc/diskstats') ?? '').split('\n')) {
    const f = line.trim().split(/\s+/);
    if (f.length < 14 || !allowed.has(f[2])) continue;
    out[f[2]] = {
      reads: Number(f[3]),
      rsect: Number(f[5]),
      rms: Number(f[6]),
      writes: Number(f[7]),
      wsect: Number(f[9]),
      wms: Number(f[10]),
      inflight: Number(f[11]),
      ioms: Number(f[12]),
      wioms: Number(f[13]),
    };
  }
  return out;
}

function readNetDev() {
  const out = {};
  for (const line of (readText('/proc/net/dev') ?? '').split('\n').slice(2)) {
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const f = line
      .slice(idx + 1)
      .trim()
      .split(/\s+/)
      .map(Number);
    out[line.slice(0, idx).trim()] = { rx: f[0], tx: f[8] };
  }
  return out;
}

function readTcpCounters() {
  const out = {};
  const pairs = (file, section, keys) => {
    const lines = (readText(file) ?? '').split('\n');
    for (let i = 0; i + 1 < lines.length; i++) {
      const h = lines[i].split(/\s+/);
      const v = lines[i + 1].split(/\s+/);
      if (h[0] !== section || v[0] !== section) continue;
      for (const k of keys) {
        const j = h.indexOf(k);
        if (j > 0) out[k] = Number(v[j]);
      }
      return;
    }
  };
  pairs('/proc/net/netstat', 'TcpExt:', [
    'ListenOverflows',
    'ListenDrops',
    'TCPTimeouts',
    'TCPAbortOnTimeout',
  ]);
  pairs('/proc/net/snmp', 'Tcp:', [
    'RetransSegs',
    'AttemptFails',
    'EstabResets',
  ]);
  return out;
}

function readMeminfo() {
  const out = {};
  for (const line of (readText('/proc/meminfo') ?? '').split('\n')) {
    const m = /^(\w+):\s+(\d+)/.exec(line);
    if (m) out[m[1]] = Number(m[2]) * 1024;
  }
  return out;
}

function readCgroupCounters(cg) {
  if (cg.version === 2) {
    const cpu = keyValues(readText(path.join(cg.dir, 'cpu.stat')));
    const memStat = keyValues(readText(path.join(cg.dir, 'memory.stat')));
    const memEvents = keyValues(readText(path.join(cg.dir, 'memory.events')));
    const current = readNumber(path.join(cg.dir, 'memory.current'));
    const pids = readNumber(path.join(cg.dir, 'pids.current'));
    return {
      usageUs: cpu.usage_usec ?? null,
      throttledUs: cpu.throttled_usec ?? null,
      nrThrottled: cpu.nr_throttled ?? null,
      nrPeriods: cpu.nr_periods ?? null,
      memCurrent: Number.isFinite(current) ? current : null,
      memAnon: memStat.anon ?? null,
      memFile: memStat.file ?? null,
      memFileDirty: memStat.file_dirty ?? null,
      memFileWriteback: memStat.file_writeback ?? null,
      pgmajfault: memStat.pgmajfault ?? null,
      refaultFile:
        memStat.workingset_refault_file ?? memStat.workingset_refault ?? null,
      oomKill: memEvents.oom_kill ?? null,
      memHigh: memEvents.high ?? null,
      memMax: memEvents.max ?? null,
      pids: Number.isFinite(pids) ? pids : null,
    };
  }
  if (cg.version === 1) {
    const out = {};
    if (cg.v1.cpu) {
      const s = keyValues(readText(path.join(cg.v1.cpu, 'cpu.stat')));
      out.throttledUs =
        s.throttled_time !== undefined ? s.throttled_time / 1000 : null;
      out.nrThrottled = s.nr_throttled ?? null;
      out.nrPeriods = s.nr_periods ?? null;
    }
    const acct = cg.v1.cpuacct ?? cg.v1.cpu;
    if (acct) {
      const u = readNumber(path.join(acct, 'cpuacct.usage'));
      out.usageUs = Number.isFinite(u) ? u / 1000 : null;
    }
    if (cg.v1.memory) {
      const u = readNumber(path.join(cg.v1.memory, 'memory.usage_in_bytes'));
      out.memCurrent = Number.isFinite(u) ? u : null;
      out.pgmajfault =
        keyValues(readText(path.join(cg.v1.memory, 'memory.stat')))
          .pgmajfault ?? null;
    }
    return out;
  }
  return {};
}

function delta(cur, prev, key) {
  const a = cur?.[key];
  const b = prev?.[key];
  if (a === null || a === undefined || b === null || b === undefined)
    return null;
  return a - b;
}

function countE2eRoots() {
  try {
    return fs.readdirSync('/tmp').filter((n) => n.startsWith('nx-e2e-')).length;
  } catch {
    return null;
  }
}

function freeSpace(paths) {
  const out = {};
  const seen = new Set();
  for (const p of paths) {
    try {
      const st = fs.statSync(p);
      if (seen.has(st.dev)) continue;
      seen.add(st.dev);
      const s = fs.statfsSync(p);
      out[p] = {
        freeGB: round((s.bavail * s.bsize) / 1e9, 2),
        freeInodes: s.ffree,
      };
    } catch {}
  }
  return out;
}

function httpGet(url, timeoutMs) {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    const ms = () => round(Number(process.hrtime.bigint() - start) / 1e6, 1);
    let settled = false;
    const finish = (r) => {
      if (!settled) {
        settled = true;
        resolve(r);
      }
    };
    try {
      const lib = url.startsWith('https:') ? https : http;
      const req = lib.get(url, { agent: false, timeout: timeoutMs }, (res) => {
        res.resume();
        res.on('end', () => finish({ ms: ms(), status: res.statusCode }));
        res.on('error', (e) => finish({ ms: ms(), err: e.code ?? e.message }));
      });
      req.on('timeout', () => {
        finish({ ms: ms(), err: 'timeout' });
        req.destroy();
      });
      req.on('error', (e) => finish({ ms: ms(), err: e.code ?? e.message }));
    } catch (e) {
      finish({ err: String(e?.message ?? e) });
    }
  });
}

function dnsLookup(host, timeoutMs) {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    const timer = setTimeout(() => resolve({ err: 'timeout' }), timeoutMs);
    dns.lookup(host, (err) => {
      clearTimeout(timer);
      resolve(
        err
          ? { err: err.code }
          : { ms: round(Number(process.hrtime.bigint() - start) / 1e6, 1) }
      );
    });
  });
}

// ---------------------------------------------------------------------------
// Registry log aggregation over verdaccio's JSON log (.verdaccio/config.yml)
//
// Local requests log "requested" on arrival and then two response lines with
// the same method and url: one when the request closes, one at res.end. An
// aborted response never reaches res.end, so it leaves a single line and its
// entry expires. Lines carry no request id, so a response line is paired with
// the oldest open entry for its url. The sum of latencies over completions is
// exact under any pairing of concurrent same-url requests, so window means are
// exact; single latencies (max) are exact only when the pairing is unambiguous.
// Uplink metadata requests log "making request", "(streaming)" at headers and
// a final line with bytes or an error. Uplink tarball fetches log only their
// start, so they are counted, not timed.

function newLocalStats() {
  return {
    arr: 0,
    done: 0,
    sumMs: 0,
    maxMs: 0,
    unambMaxMs: 0,
    ambiguous: 0,
    st4: 0,
    st5: 0,
    outB: 0,
  };
}

class RegistryAggregator {
  constructor() {
    this.offset = 0;
    this.ino = null;
    this.partial = '';
    this.lastLineT = 0;
    this.procs = new Map();
    this.seenPids = new Set();
    this.localOpen = 0;
    this.upOpen = 0;
    this.events = [];
    this.countFrom = null;
    this.newWindow(null);
  }

  newWindow(t) {
    this.w = {
      from: t,
      tgz: newLocalStats(),
      meta: newLocalStats(),
      inflMax: this.localOpen,
      up: {
        arr: 0,
        done: 0,
        err: 0,
        sumMs: 0,
        maxMs: 0,
        ambiguous: 0,
        ttfbN: 0,
        ttfbSumMs: 0,
        ttfbMaxMs: 0,
        outB: 0,
        slow: [],
      },
      upInflMax: this.upOpen,
      upTgz: 0,
      warn: 0,
      conflict: 0,
      unmatched: 0,
      expired: 0,
      lines: 0,
      parseErr: 0,
    };
    this.warnings = new Map();
  }

  proc(pid) {
    let s = this.procs.get(pid);
    if (!s) {
      s = { local: new Map(), up: new Map() };
      this.procs.set(pid, s);
    }
    return s;
  }

  handle(o) {
    const t = o.time;
    if (typeof t !== 'number') return;
    if (this.countFrom !== null && t >= this.countFrom) {
      this.expire(this.countFrom);
      this.newWindow(this.countFrom);
      this.countFrom = null;
    }
    const pid = typeof o.pid === 'number' ? o.pid : 0;
    if (!this.seenPids.has(pid)) {
      this.seenPids.add(pid);
      this.events.push({ t, type: 'registry-process', pid });
    }
    const st = this.proc(pid);
    const msg = typeof o.msg === 'string' ? o.msg : '';
    if (o.level >= 40) {
      this.w.warn++;
      if (msg.includes('already present')) this.w.conflict++;
      const shown = redact(msg);
      const tpl = shown
        .replace(/'[^']*'/g, "'_'")
        .replace(/\d+/g, 'N')
        .slice(0, 200);
      const cur = this.warnings.get(tpl);
      if (cur) cur.n++;
      else this.warnings.set(tpl, { n: 1, first: shown.slice(0, 400), t });
      return;
    }
    if (
      o.sub === 'in' &&
      o.level === 30 &&
      o.req &&
      typeof o.req.url === 'string'
    ) {
      if (o.req.url === '/-/ping') return;
      const key = `${o.req.method} ${o.req.url}`;
      const q = st.local.get(key) ?? [];
      q.push({ t, state: 'open' });
      st.local.set(key, q);
      this.localOpen++;
      this.statsFor(o.req.url).arr++;
      if (this.localOpen > this.w.inflMax) this.w.inflMax = this.localOpen;
      return;
    }
    if (
      o.sub === 'in' &&
      o.level === 25 &&
      o.request &&
      typeof o.request.url === 'string' &&
      'status' in o
    ) {
      if (o.request.url === '/-/ping') return;
      const key = `${o.request.method} ${o.request.url}`;
      const q = st.local.get(key) ?? [];
      const oldest = (state) => q.find((e) => e.state === state);
      const newest = (state) => q.findLast((e) => e.state === state);
      const remove = (e) => {
        q.splice(q.indexOf(e), 1);
        if (q.length === 0) st.local.delete(key);
      };
      // Each request logs a line on req 'close', which Node fires once a GET is
      // read (status 200, nothing written yet), and one on res.end. An aborted
      // request logs only the first, so a completion goes to the newest request
      // past its close: a retry completes itself, the aborted one expires.
      const early = o.status === 200 && (o.bytes?.out ?? 0) === 0;
      const count = (state) => q.filter((x) => x.state === state).length;
      if (early && oldest('open')) {
        oldest('open').state = 'closed';
        return;
      }
      let e;
      let candidates;
      if ((candidates = count('closed'))) {
        e = newest('closed');
        remove(e);
      } else if (!early && (candidates = count('open'))) {
        // res.end before req 'close': done now, the close line follows.
        e = oldest('open');
        e.state = 'ended';
      } else if ((e = oldest('ended'))) {
        remove(e);
        return;
      } else {
        this.w.unmatched++;
        return;
      }
      const ambiguous = candidates > 1;
      this.localOpen--;
      const s = this.statsFor(o.request.url);
      const dur = t - e.t;
      s.done++;
      s.sumMs += dur;
      if (dur > s.maxMs) s.maxMs = dur;
      if (ambiguous) s.ambiguous++;
      else if (dur > s.unambMaxMs) s.unambMaxMs = dur;
      if (typeof o.status === 'number' && o.status >= 500) s.st5++;
      else if (typeof o.status === 'number' && o.status >= 400) s.st4++;
      s.outB += o.bytes?.out ?? 0;
      return;
    }
    if (
      o.level === 30 &&
      typeof o.uri === 'string' &&
      msg.startsWith('making request')
    ) {
      this.w.up.arr++;
      if (/\.tgz($|\?)/.test(o.uri)) {
        this.w.upTgz++;
        return;
      }
      const q = st.up.get(o.uri) ?? [];
      q.push({ t, ttfb: null });
      st.up.set(o.uri, q);
      this.upOpen++;
      if (this.upOpen > this.w.upInflMax) this.w.upInflMax = this.upOpen;
      return;
    }
    if (
      o.level === 25 &&
      o.sub === undefined &&
      o.request &&
      typeof o.request.url === 'string'
    ) {
      const url = o.request.url;
      const q = st.up.get(url);
      if (!q || q.length === 0) {
        this.w.unmatched++;
        return;
      }
      const u = this.w.up;
      if (msg.endsWith('(streaming)')) {
        const e = q.find((x) => x.ttfb === null);
        if (e) {
          e.ttfb = t - e.t;
          u.ttfbN++;
          u.ttfbSumMs += e.ttfb;
          if (e.ttfb > u.ttfbMaxMs) u.ttfbMaxMs = e.ttfb;
        }
        return;
      }
      const ambiguous = q.length > 1;
      const e = q.shift();
      if (q.length === 0) st.up.delete(url);
      this.upOpen--;
      const dur = t - e.t;
      u.done++;
      u.sumMs += dur;
      if (dur > u.maxMs) u.maxMs = dur;
      if (ambiguous) u.ambiguous++;
      const failed =
        o.status === 'ERR' ||
        o.error !== undefined ||
        o.err !== undefined ||
        (typeof o.status === 'number' && o.status >= 400);
      if (failed) u.err++;
      u.outB += o.bytes?.out ?? 0;
      u.slow.push([
        dur,
        redact(url.replace('https://registry.npmjs.org', '')),
        e.ttfb,
        o.status ?? null,
        ambiguous ? 1 : 0,
        failed ? redact(String(o.error ?? '')).slice(0, 80) : undefined,
      ]);
      if (u.slow.length > 30) {
        u.slow.sort((a, b) => b[0] - a[0]);
        u.slow.length = 5;
      }
    }
  }

  statsFor(url) {
    return url.includes('/-/') && /\.tgz($|\?)/.test(url)
      ? this.w.tgz
      : this.w.meta;
  }

  expire(now) {
    for (const [pid, st] of this.procs) {
      const gone = pid !== 0 && !processAlive(pid);
      for (const [map, kind] of [
        [st.local, 'local'],
        [st.up, 'up'],
      ]) {
        for (const [key, q] of map) {
          const kept = (e) => !gone && now - e.t < REGISTRY_ENTRY_EXPIRY_MS;
          const keep = q.filter(kept);
          if (keep.length === q.length) continue;
          // An ended entry already counted as done; it only awaited its late close.
          const dropped = q.filter(
            (e) => !kept(e) && e.state !== 'ended'
          ).length;
          this.w.expired += dropped;
          if (kind === 'local') this.localOpen -= dropped;
          else this.upOpen -= dropped;
          if (keep.length) map.set(key, keep);
          else map.delete(key);
        }
      }
      if (gone && st.local.size === 0 && st.up.size === 0)
        this.procs.delete(pid);
    }
  }

  readNew() {
    let st;
    try {
      st = fs.statSync(REGISTRY_LOG);
    } catch {
      return false;
    }
    if (this.ino !== null && (st.ino !== this.ino || st.size < this.offset)) {
      this.events.push({ t: Date.now(), type: 'registry-log-replaced' });
      this.offset = 0;
      this.partial = '';
      this.procs.clear();
      this.localOpen = 0;
      this.upOpen = 0;
    }
    this.ino = st.ino;
    if (st.size > this.offset) {
      const fd = fs.openSync(REGISTRY_LOG, 'r');
      try {
        const chunk = 4 * 1024 * 1024;
        while (this.offset < st.size) {
          const len = Math.min(chunk, st.size - this.offset);
          const buf = Buffer.alloc(len);
          const n = fs.readSync(fd, buf, 0, len, this.offset);
          if (n <= 0) break;
          this.offset += n;
          this.consume(buf.toString('utf8', 0, n));
        }
      } finally {
        fs.closeSync(fd);
      }
    }
    const quiet = Date.now() - this.lastLineT >= REGISTRY_LOG_QUIET_MS;
    if (
      this.offset >= REGISTRY_LOG_CAP_BYTES &&
      (quiet || this.offset >= 2 * REGISTRY_LOG_CAP_BYTES)
    )
      this.truncate();
    return true;
  }

  consume(text) {
    const lines = (this.partial + text).split('\n');
    this.partial = lines.pop();
    for (const line of lines) {
      if (!line) continue;
      this.w.lines++;
      let o;
      try {
        o = JSON.parse(line);
      } catch {
        this.w.parseErr++;
        continue;
      }
      if (typeof o.time === 'number' && o.time > this.lastLineT)
        this.lastLineT = o.time;
      this.handle(o);
    }
  }

  // Verdaccio appends (O_APPEND), so its next write lands at the new end. Open
  // requests are kept. A line written between the last read and the truncate is
  // lost and can mispair its request, hence the quiet-log wait in readNew.
  truncate() {
    let tail = '';
    try {
      const fd = fs.openSync(REGISTRY_LOG, 'r+');
      try {
        const size = fs.fstatSync(fd).size;
        const buf = Buffer.alloc(Math.max(0, size - this.offset));
        const n = buf.length
          ? fs.readSync(fd, buf, 0, buf.length, this.offset)
          : 0;
        fs.ftruncateSync(fd, 0);
        tail = buf.toString('utf8', 0, n);
      } finally {
        fs.closeSync(fd);
      }
    } catch {
      return;
    }
    this.events.push({
      t: Date.now(),
      type: 'registry-log-truncated',
      atBytes: this.offset + Buffer.byteLength(tail),
    });
    this.offset = 0;
    this.consume(tail);
  }

  // Lines already in the log when the sampler starts only rebuild open requests.
  // Older lines only rebuild pairing state. Counting starts at `since`, the
  // spawn time, so requests made while the sampler boots are kept.
  catchUp(since) {
    this.countFrom = since;
    this.readNew();
    if (this.countFrom !== null) {
      this.expire(Date.now());
      this.newWindow(Date.now());
      this.countFrom = null;
    }
    this.events = this.events.filter(
      (e) => e.type === 'registry-log-truncated' || e.t >= since
    );
  }

  poll(now) {
    const exists = this.readNew();
    this.expire(now);
    if (!exists) return null;
    const w = this.w;
    const local = (s) => ({
      arr: s.arr,
      done: s.done,
      meanMs: s.done ? Math.round(s.sumMs / s.done) : null,
      sumMs: s.sumMs,
      maxMs: s.maxMs,
      unambMaxMs: s.unambMaxMs,
      ambiguous: s.ambiguous,
      st4: s.st4,
      st5: s.st5,
      outMB: round(s.outB / 1e6, 2),
    });
    w.up.slow.sort((a, b) => b[0] - a[0]);
    const result = {
      tgz: local(w.tgz),
      meta: local(w.meta),
      inflMax: w.inflMax,
      inflNow: this.localOpen,
      up: {
        arr: w.up.arr,
        tgz: w.upTgz,
        done: w.up.done,
        err: w.up.err,
        meanMs: w.up.done ? Math.round(w.up.sumMs / w.up.done) : null,
        sumMs: w.up.sumMs,
        maxMs: w.up.maxMs,
        ambiguous: w.up.ambiguous,
        ttfbN: w.up.ttfbN,
        ttfbSumMs: w.up.ttfbSumMs,
        ttfbMaxMs: w.up.ttfbMaxMs,
        outMB: round(w.up.outB / 1e6, 2),
        inflMax: w.upInflMax,
        inflNow: this.upOpen,
        slow: w.up.slow.slice(0, 3),
      },
      warn: w.warn,
      conflict: w.conflict,
      unmatched: w.unmatched,
      expired: w.expired,
      lines: w.lines,
      parseErr: w.parseErr,
      pids: [...this.procs.keys()],
    };
    const warnings = [...this.warnings.entries()].map(([tpl, v]) => ({
      tpl,
      ...v,
    }));
    this.newWindow(now);
    return { result, warnings };
  }
}

// ---------------------------------------------------------------------------
// Process census

const CATEGORIES = [
  ['probe', (c) => c.includes('ci-pressure-probe/probe.mjs')],
  ['nx-daemon', (c) => c.includes('daemon/server/start')],
  ['nx-plugin-worker', (c) => c.includes('plugins/isolation/plugin-worker')],
  ['nx-cloud', (c) => /nx-cloud|nx_cloud|nxcloud/i.test(c)],
  ['verdaccio', (c) => c.includes('verdaccio')],
  [
    'jest',
    (c) => /(^|[/ ])jest(\.js)?( |$)|jest-worker|jest-cli|jest\/bin/.test(c),
  ],
  [
    'nx-cli',
    (c) =>
      /\/nx\/bin\/(nx|run-executor|post-install)|\/nx\/src\/tasks-runner\/|\/nx\/bin\/nx\.js/.test(
        c
      ),
  ],
  [
    'pnpm',
    (c, comm) =>
      comm === 'pnpm' ||
      /(^|\/)pnpm(\.c?js)?( |$)|pnpm\/bin\/pnpm|pnpm\/dist\/pnpm/.test(c),
  ],
  [
    'npm',
    (c) => /npm-cli\.js|(^|\/)npm( |$)|npx-cli\.js|(^|\/)npx( |$)/.test(c),
  ],
  [
    'yarn',
    (c) =>
      /(^|\/)yarn(\.c?js)?( |$)|yarn-\d[^ ]*\.cjs|\.yarn\/releases/.test(c),
  ],
  ['bun', (c, comm) => comm === 'bun'],
  ['gradle-daemon', (c) => c.includes('GradleDaemon')],
  [
    'gradle-other',
    (c) =>
      /GradleWrapperMain|org\.gradle\.|KotlinCompileDaemon|kotlin-daemon/.test(
        c
      ),
  ],
  [
    'maven',
    (c) =>
      /plexus-classworlds|org\.codehaus\.plexus\.classworlds|maven-wrapper|MavenWrapperMain/.test(
        c
      ),
  ],
  ['mvnw', (c) => /(^|\/)mvnw( |$)/.test(c)],
  ['java-other', (c, comm) => comm === 'java'],
  [
    'browser',
    (c, comm) =>
      /chrome|chromium|headless_shell|firefox|Cypress|msedge|electron|Xvfb/i.test(
        `${comm} ${c.slice(0, 300)}`
      ),
  ],
  [
    'build-native',
    (c, comm) =>
      [
        'cargo',
        'rustc',
        'cc',
        'cc1',
        'cc1plus',
        'ld',
        'clang',
        'ld.lld',
        'collect2',
        'as',
      ].includes(comm),
  ],
  ['git', (c, comm) => comm === 'git' || comm.startsWith('git-')],
  [
    'dotnet',
    (c, comm) => comm === 'dotnet' || /\bdotnet\b/.test(c.slice(0, 200)),
  ],
  [
    'docker',
    (c, comm) =>
      ['dockerd', 'containerd', 'containerd-shim', 'docker', 'runc'].includes(
        comm
      ),
  ],
  ['node-other', (c, comm) => comm === 'node' || comm.startsWith('node')],
  ['shell', (c, comm) => ['sh', 'bash', 'dash', 'zsh'].includes(comm)],
];

function classify(cmd, comm) {
  for (const [name, test] of CATEGORIES) if (test(cmd, comm)) return name;
  return 'other';
}

// The Nx task a process was started for. Only these two variables are read.
function taskFromEnviron(pid) {
  const env = readText(`/proc/${pid}/environ`);
  if (!env) return null;
  const get = (k) => {
    const i = env.startsWith(`${k}=`) ? 0 : env.indexOf(`\0${k}=`) + 1;
    if (i < 0 || (i === 0 && !env.startsWith(`${k}=`))) return null;
    const end = env.indexOf('\0', i);
    return env.slice(i + k.length + 1, end < 0 ? undefined : end);
  };
  const project = get('NX_TASK_TARGET_PROJECT');
  if (!project) return null;
  return `${project}:${get('NX_TASK_TARGET_TARGET') ?? '?'}`;
}

function e2eRootOf(cwd) {
  const m = /^(\/tmp\/nx-e2e-[^/]+)/.exec(cwd ?? '');
  return m ? m[1] : null;
}

class Census {
  constructor(clkTck, pageSize) {
    this.clkTck = clkTck;
    this.pageSize = pageSize;
    this.prev = new Map();
    this.meta = new Map();
    this.prevT = null;
    this.btimeMs = (readProcStat()?.btime ?? 0) * 1000;
    this.rootTasks = new Map();
    this.procs = new Map();
  }

  location(cwd) {
    if (!cwd) return 'unknown';
    const deleted = cwd.endsWith(' (deleted)');
    const p = deleted ? cwd.slice(0, -' (deleted)'.length) : cwd;
    let loc = 'other';
    if (e2eRootOf(p)) loc = 'e2e';
    else if (p === REPO_ROOT || p.startsWith(REPO_ROOT + '/')) loc = 'repo';
    return deleted ? `${loc}-deleted` : loc;
  }

  sample(now) {
    const pids = (listDir('/proc') ?? []).filter((n) => /^\d+$/.test(n));
    const dt = this.prevT === null ? null : (now - this.prevT) / 1000;
    const cur = new Map();
    const procs = new Map();
    let threads = 0;
    let newProcs = 0;
    const states = {};
    for (const pidStr of pids) {
      const statText = readText(`/proc/${pidStr}/stat`);
      if (!statText) continue;
      const pid = Number(pidStr);
      const close = statText.lastIndexOf(')');
      const comm = statText.slice(statText.indexOf('(') + 1, close);
      // Fields after the command name, starting at field 3 (state): index = field - 3.
      const f = statText.slice(close + 2).split(' ');
      const state = f[0];
      const ppid = Number(f[1]);
      const ticks = Number(f[11]) + Number(f[12]);
      const majflt = Number(f[9]);
      const nThreads = Number(f[17]);
      const startTicks = Number(f[19]);
      const rssBytes = Number(f[21]) * this.pageSize;
      threads += nThreads;
      states[state] = (states[state] ?? 0) + 1;
      const id = `${pid}:${startTicks}`;
      let meta = this.meta.get(id);
      if (!meta) {
        const args = (readText(`/proc/${pid}/cmdline`) ?? '')
          .split('\0')
          .filter(Boolean);
        const cmd = args.join(' ') || `[${comm}]`;
        const cat = classify(cmd, comm);
        meta = {
          cmd: args.length ? shownCmdline(args) : cmd,
          comm,
          cat,
          startMs: this.btimeMs + (startTicks / this.clkTck) * 1000,
          envTask: cat === 'probe' ? null : taskFromEnviron(pid),
        };
        this.meta.set(id, meta);
        newProcs++;
      }
      let cwd = null;
      try {
        cwd = fs.readlinkSync(`/proc/${pid}/cwd`);
      } catch {}
      const io = keyValues(
        (readText(`/proc/${pid}/io`) ?? '').replace(/:/g, '')
      );
      // Run-queue wait of the main thread: for node, the event loop thread.
      const sched = (readText(`/proc/${pid}/schedstat`) ?? '')
        .trim()
        .split(' ')
        .map(Number);
      const entry = {
        ticks,
        majflt,
        rd: io.read_bytes ?? null,
        wr: io.write_bytes ?? null,
        waitNs: Number.isFinite(sched[1]) ? sched[1] : null,
      };
      cur.set(id, entry);
      const before = this.prev.get(id);
      let d = null;
      if (dt !== null) {
        // A process that started during this interval used all its counters in it.
        const base =
          before ??
          (meta.startMs >= this.prevT - 1000
            ? { ticks: 0, majflt: 0, rd: 0, wr: 0, waitNs: 0 }
            : null);
        if (base) {
          d = {
            cpu: (ticks - base.ticks) / this.clkTck / dt,
            majflt: majflt - base.majflt,
            rdMB:
              entry.rd !== null && base.rd !== null
                ? (entry.rd - base.rd) / 1e6 / dt
                : null,
            wrMB:
              entry.wr !== null && base.wr !== null
                ? (entry.wr - base.wr) / 1e6 / dt
                : null,
            waitS:
              entry.waitNs !== null && base.waitNs !== null
                ? (entry.waitNs - base.waitNs) / 1e9 / dt
                : null,
          };
        }
      }
      procs.set(pid, {
        pid,
        ppid,
        comm,
        state,
        cat: meta.cat,
        cmd: meta.cmd,
        cwd,
        loc: this.location(cwd),
        envTask: meta.envTask,
        threads: nThreads,
        rssMB: rssBytes / 1e6,
        ageS: (now - meta.startMs) / 1000,
        d,
      });
    }
    for (const id of this.meta.keys()) if (!cur.has(id)) this.meta.delete(id);
    const exited = [...this.prev.keys()].filter((id) => !cur.has(id)).length;
    this.prev = cur;
    this.prevT = now;
    this.procs = procs;
    this.attributeTasks(procs);
    if (dt === null) return null;

    const cats = {};
    const tasks = {};
    for (const p of procs.values()) {
      const c = (cats[p.cat] ??= {
        n: 0,
        cpu: 0,
        waitS: 0,
        rssMB: 0,
        rdMB: 0,
        wrMB: 0,
        majflt: 0,
        e2e: 0,
        repo: 0,
        deleted: 0,
        D: 0,
      });
      c.n++;
      c.rssMB += p.rssMB;
      if (p.loc.startsWith('e2e')) c.e2e++;
      if (p.loc.startsWith('repo')) c.repo++;
      if (p.loc.endsWith('-deleted')) c.deleted++;
      if (p.state === 'D') c.D++;
      const tk = (tasks[p.task ?? '(none)'] ??= {
        n: 0,
        cpu: 0,
        rssMB: 0,
        rdMB: 0,
        wrMB: 0,
        waitS: 0,
      });
      tk.n++;
      tk.rssMB += p.rssMB;
      if (!p.d) continue;
      c.cpu += p.d.cpu;
      tk.cpu += p.d.cpu;
      c.majflt += p.d.majflt;
      for (const k of ['rdMB', 'wrMB', 'waitS']) {
        if (p.d[k] === null) continue;
        c[k] += p.d[k];
        tk[k] += p.d[k];
      }
    }
    const roundAll = (o) => {
      for (const v of Object.values(o))
        for (const k of Object.keys(v))
          if (!Number.isInteger(v[k])) v[k] = round(v[k], 2);
    };
    roundAll(cats);
    roundAll(tasks);
    const top = [...procs.values()]
      .filter((p) => p.d)
      .sort((a, b) => b.d.cpu - a.d.cpu)
      .slice(0, 8)
      .map((p) => procSummary(p));
    return {
      dtS: round(dt, 2),
      procs: procs.size,
      threads,
      newProcs,
      exited,
      states,
      cats,
      tasks,
      top,
      tcp: tcpStates(),
    };
  }

  // Each process belongs to the outermost Nx task among itself and its
  // ancestors: e2e workspaces run Nx tasks of their own, and the harness strips
  // NX_* variables from their commands. A reparented process (a daemon) falls
  // back to the task that owns its /tmp/nx-e2e-* directory.
  attributeTasks(procs) {
    const memo = new Map();
    const resolve = (pid, depth) => {
      if (memo.has(pid)) return memo.get(pid);
      const p = procs.get(pid);
      if (!p || depth > 64) return null;
      const above = p.ppid > 1 ? resolve(p.ppid, depth + 1) : null;
      const t = above ?? p.envTask ?? null;
      memo.set(pid, t);
      return t;
    };
    for (const p of procs.values()) {
      p.task = resolve(p.pid, 0);
      const root = e2eRootOf(p.cwd);
      if (p.task && root) this.rootTasks.set(root, p.task);
    }
    for (const p of procs.values()) {
      if (p.task) continue;
      const root = e2eRootOf(p.cwd);
      if (root && this.rootTasks.has(root)) p.task = this.rootTasks.get(root);
    }
    if (this.rootTasks.size > 500)
      this.rootTasks = new Map([...this.rootTasks].slice(-200));
  }
}

function procSummary(p) {
  return {
    pid: p.pid,
    ppid: p.ppid,
    st: p.state,
    cat: p.cat,
    task: p.task ?? null,
    loc: p.loc,
    cpu: p.d ? round(p.d.cpu, 2) : null,
    waitS: p.d && p.d.waitS !== null ? round(p.d.waitS, 2) : null,
    rssMB: round(p.rssMB, 0),
    thr: p.threads,
    ageS: round(p.ageS, 0),
    cmd: p.cmd,
  };
}

const TCP_STATES = {
  '01': 'estab',
  '02': 'synSent',
  '03': 'synRecv',
  '04': 'finWait1',
  '05': 'finWait2',
  '06': 'timeWait',
  '07': 'close',
  '08': 'closeWait',
  '09': 'lastAck',
  '0A': 'listen',
  '0B': 'closing',
};

function tcpStates() {
  const port = Number(REGISTRY_PORT)
    .toString(16)
    .toUpperCase()
    .padStart(4, '0');
  const all = {};
  const registry = {};
  for (const file of ['/proc/net/tcp', '/proc/net/tcp6']) {
    for (const line of (readText(file) ?? '').split('\n').slice(1)) {
      const f = line.trim().split(/\s+/);
      if (f.length < 4) continue;
      const state = TCP_STATES[f[3]] ?? f[3];
      all[state] = (all[state] ?? 0) + 1;
      if (f[1].split(':')[1] === port)
        registry[`server.${state}`] = (registry[`server.${state}`] ?? 0) + 1;
      else if (f[2].split(':')[1] === port)
        registry[`client.${state}`] = (registry[`client.${state}`] ?? 0) + 1;
    }
  }
  return { all, registry };
}

// Process tree of a command that has been running a while: what it waits on.
function commandSnapshot(census, marker) {
  const children = new Map();
  for (const p of census.procs.values()) {
    if (!children.has(p.ppid)) children.set(p.ppid, []);
    children.get(p.ppid).push(p.pid);
  }
  const picked = new Set();
  const queue = [...(children.get(marker.pid) ?? [])];
  while (queue.length && picked.size < 200) {
    const pid = queue.shift();
    if (picked.has(pid)) continue;
    picked.add(pid);
    queue.push(...(children.get(pid) ?? []));
  }
  const cwd =
    typeof marker.cwd === 'string' &&
    marker.cwd.length > 5 &&
    marker.cwd !== REPO_ROOT
      ? marker.cwd
      : null;
  if (cwd) {
    for (const p of census.procs.values()) {
      const pc = p.cwd?.replace(/ \(deleted\)$/, '');
      if (pc && (pc === cwd || pc.startsWith(cwd + '/'))) picked.add(p.pid);
    }
  }
  return [...picked]
    .map((pid) => census.procs.get(pid))
    .filter((p) => p && p.cat !== 'probe')
    .sort((a, b) => (b.d?.cpu ?? 0) - (a.d?.cpu ?? 0))
    .slice(0, 40)
    .map((p) => ({
      ...procSummary(p),
      wchan: readText(`/proc/${p.pid}/wchan`)?.trim() || null,
      cwd: p.cwd,
    }));
}

// ---------------------------------------------------------------------------
// Shared caches the flakes involve: native binary cache, Maven and Gradle wrappers

function watchState() {
  const state = {};
  if (UID !== null) {
    const root = `/tmp/.nx/${UID}/native-cache`;
    const versions = listDir(root);
    if (versions) {
      for (const v of versions) {
        try {
          const st = fs.statSync(path.join(root, v));
          state[`native-cache/${v}`] =
            `ino=${st.ino} n=${listDir(path.join(root, v))?.length ?? 'x'}`;
        } catch {}
      }
    } else state['native-cache'] = 'absent';
  }
  const mvnRoot = path.join(HOME, '.m2/wrapper/dists');
  for (const dist of listDir(mvnRoot) ?? []) {
    for (const hash of listDir(path.join(mvnRoot, dist)) ?? []) {
      const dir = path.join(mvnRoot, dist, hash);
      const entries = listDir(dir) ?? [];
      const complete =
        fs.existsSync(path.join(dir, 'bin/mvn')) ||
        entries.some((e) => fs.existsSync(path.join(dir, e, 'bin/mvn')));
      state[`m2/${dist}/${hash}`] = complete
        ? 'complete'
        : `incomplete:[${entries.slice(0, 6).join(',')}]`;
    }
  }
  const gradleRoot = path.join(HOME, '.gradle/wrapper/dists');
  for (const dist of listDir(gradleRoot) ?? []) {
    for (const hash of listDir(path.join(gradleRoot, dist)) ?? []) {
      const dir = path.join(gradleRoot, dist, hash);
      const entries = listDir(dir) ?? [];
      const flags = [];
      if (entries.some((e) => e.endsWith('.ok'))) flags.push('ok');
      if (entries.some((e) => e.endsWith('.lck'))) flags.push('lck');
      if (entries.some((e) => e.endsWith('.part'))) flags.push('part');
      if (entries.some((e) => e.endsWith('.zip'))) flags.push('zip');
      if (entries.some((e) => fs.existsSync(path.join(dir, e, 'bin/gradle'))))
        flags.push('bin');
      state[`gradle/${dist}/${hash}`] = flags.join('+') || 'empty';
    }
  }
  return state;
}

// ---------------------------------------------------------------------------
// Agent sampler

function samplerAlive() {
  const pid = Number(readText(PIDFILE));
  if (!processAlive(pid)) return null;
  const cmd = (readText(`/proc/${pid}/cmdline`) ?? '').split('\0').join(' ');
  return cmd.includes(SCRIPT) && cmd.includes(' daemon') ? pid : null;
}

function claimPidfile() {
  const tmp = `${PIDFILE}.${process.pid}`;
  fs.writeFileSync(tmp, String(process.pid));
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        fs.linkSync(tmp, PIDFILE);
        return true;
      } catch (e) {
        if (e.code !== 'EEXIST') throw e;
        if (samplerAlive()) return false;
        // The recorded sampler is gone. Remove the file only if it still names it.
        const stale = readText(PIDFILE);
        try {
          if (stale !== null && readText(PIDFILE) === stale && !samplerAlive())
            fs.unlinkSync(PIDFILE);
        } catch {}
      }
    }
    return false;
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {}
  }
}

// Markers whose process is gone mean a task killed before its teardown, or a
// test process that died mid-command. Both are recorded as events.
function liveMarkers(dir, type, now) {
  const live = [];
  for (const m of readJsonFiles(dir)) {
    if (processAlive(m.pid)) {
      live.push(m);
      continue;
    }
    try {
      fs.unlinkSync(m.file);
    } catch {}
    const { file, ...rest } = m;
    appendLine(EVENTS, { ...rest, t: now, type, markerT: m.t });
  }
  return live;
}

async function runDaemon() {
  for (const d of [TASKS_DIR, ACTIVE_DIR, RUNNING_DIR, FORENSICS_DIR])
    fs.mkdirSync(d, { recursive: true });
  if (!claimPidfile()) return;
  const startedAt = Date.now();
  const clkTck = getconf('CLK_TCK', 100);
  const pageSize = getconf('PAGESIZE', 4096);
  const mounts = readMounts();
  const cg = resolveCgroup(mounts);
  const pp = pressurePaths(cg);
  const blockNames = new Set(
    (listDir('/sys/block') ?? []).filter((n) => !/^(loop|ram|zram)/.test(n))
  );
  const census = new Census(clkTck, pageSize);
  const registry = new RegistryAggregator();
  registry.catchUp(Number(args[0]) || startedAt);
  appendLine(EVENTS, {
    t: startedAt,
    type: 'sampler-start',
    pid: process.pid,
    clkTck,
    pageSize,
    cgroupVersion: cg.version,
    cgroupDir: cg.dir ?? null,
    registryLogBytes: registry.offset,
  });

  let watched = watchState();
  appendLine(EVENTS, { t: startedAt, type: 'watch-initial', state: watched });
  let npmResult = null;
  let npmPending = false;
  let tick = 0;
  let lastActiveAt = Date.now();
  let selfPrev = process.cpuUsage();
  const snapState = new Map();
  let tickErrors = 0;

  const collect = () => {
    const s = {
      now: Date.now(),
      stat: readProcStat(),
      host: {},
      cg: {},
      cgc: readCgroupCounters(cg),
      disks: readDiskstats(blockNames),
      net: readNetDev(),
      tcp: readTcpCounters(),
      mem: readMeminfo(),
      load: Number((readText('/proc/loadavg') ?? '').split(' ')[0]),
      fileNr: Number((readText('/proc/sys/fs/file-nr') ?? '').split(/\s+/)[0]),
    };
    for (const [k, f] of Object.entries(pp.host))
      s.host[k] = parsePressure(readText(f));
    if (pp.cgroup)
      for (const [k, f] of Object.entries(pp.cgroup))
        s.cg[k] = parsePressure(readText(f));
    return s;
  };

  let prev = collect();
  census.sample(prev.now);

  while (Date.now() - startedAt < MAX_LIFETIME_MS) {
    const next = startedAt + (tick + 1) * TICK_MS;
    await new Promise((r) => setTimeout(r, Math.max(0, next - Date.now())));
    tick++;
    if (Number(readText(PIDFILE)) !== process.pid) {
      appendLine(EVENTS, {
        t: Date.now(),
        type: 'sampler-exit',
        reason: 'pidfile-taken',
      });
      return;
    }
    try {
      const pingP = httpGet(
        `http://localhost:${REGISTRY_PORT}/-/ping`,
        PING_TIMEOUT_MS
      );
      if (tick % NPM_PING_EVERY_TICKS === 0 && !npmPending) {
        npmPending = true;
        Promise.all([
          dnsLookup('registry.npmjs.org', NPM_PING_TIMEOUT_MS),
          httpGet('https://registry.npmjs.org/-/ping', NPM_PING_TIMEOUT_MS),
        ]).then(([d, p]) => {
          npmResult = {
            dnsMs: d.ms ?? null,
            dnsErr: d.err,
            ms: p.ms ?? null,
            status: p.status,
            err: p.err,
          };
          npmPending = false;
        });
      }
      const cur = collect();
      const dtMs = cur.now - prev.now;
      const row = { t: cur.now, tick, dtMs };

      if (cur.stat?.cpu && prev.stat?.cpu) {
        const d = cur.stat.cpu.map((v, i) => v - prev.stat.cpu[i]);
        const total = d.reduce((a, b) => a + b, 0);
        if (total > 0) {
          const pct = (i) => round((d[i] / total) * 100, 1);
          row.cpu = {
            usr: pct(0),
            nice: pct(1),
            sys: pct(2),
            idle: pct(3),
            iow: pct(4),
            irq: pct(5),
            sirq: pct(6),
            steal: pct(7),
          };
        }
        row.run = cur.stat.running;
        row.blk = cur.stat.blocked;
        row.ctxS = round(((cur.stat.ctxt - prev.stat.ctxt) / dtMs) * 1000, 0);
        row.forkS = round(
          ((cur.stat.forks - prev.stat.forks) / dtMs) * 1000,
          1
        );
      }
      row.load1 = cur.load;
      row.fileNr = Number.isFinite(cur.fileNr) ? cur.fileNr : null;

      // Percent of wall time in which some (or all) runnable tasks were stalled.
      const psiPct = (c, p) => {
        if (!c || !p) return null;
        const out = {};
        for (const k of ['some', 'full'])
          if (c[k] !== undefined && p[k] !== undefined)
            out[k] = round(((c[k] - p[k]) / (dtMs * 1000)) * 100, 1);
        return out;
      };
      row.psi = {};
      for (const k of ['cpu', 'io', 'mem'])
        row.psi[k] = psiPct(cur.host[k], prev.host[k]);
      if (pp.cgroup) {
        row.cgPsi = {};
        for (const k of ['cpu', 'io', 'mem'])
          row.cgPsi[k] = psiPct(cur.cg[k], prev.cg[k]);
      }

      const dUsage = delta(cur.cgc, prev.cgc, 'usageUs');
      const dThr = delta(cur.cgc, prev.cgc, 'throttledUs');
      const mb = (v) =>
        v === null || v === undefined ? null : round(v / 1e6, 0);
      row.cg = {
        cores: dUsage === null ? null : round(dUsage / (dtMs * 1000), 2),
        thrPct: dThr === null ? null : round((dThr / (dtMs * 1000)) * 100, 1),
        thrPeriods: delta(cur.cgc, prev.cgc, 'nrThrottled'),
        periods: delta(cur.cgc, prev.cgc, 'nrPeriods'),
        memMB: mb(cur.cgc.memCurrent),
        anonMB: mb(cur.cgc.memAnon),
        fileMB: mb(cur.cgc.memFile),
        dirtyMB: mb(cur.cgc.memFileDirty),
        wbMB: mb(cur.cgc.memFileWriteback),
        majflt: delta(cur.cgc, prev.cgc, 'pgmajfault'),
        refault: delta(cur.cgc, prev.cgc, 'refaultFile'),
        oomKill: delta(cur.cgc, prev.cgc, 'oomKill'),
        memHighEv: delta(cur.cgc, prev.cgc, 'memHigh'),
        memMaxEv: delta(cur.cgc, prev.cgc, 'memMax'),
        pids: cur.cgc.pids ?? null,
      };
      if (row.cg.oomKill > 0)
        appendLine(EVENTS, {
          t: cur.now,
          type: 'oom-kill',
          count: row.cg.oomKill,
        });

      row.mem = {
        availMB: mb(cur.mem.MemAvailable),
        cachedMB: mb(cur.mem.Cached),
        dirtyMB: mb(cur.mem.Dirty),
        wbMB: mb(cur.mem.Writeback),
        swapUsedMB:
          cur.mem.SwapTotal !== undefined
            ? mb(cur.mem.SwapTotal - cur.mem.SwapFree)
            : null,
      };

      row.disk = {};
      for (const [name, c] of Object.entries(cur.disks)) {
        const p = prev.disks[name];
        if (!p) continue;
        const ios = c.reads - p.reads + (c.writes - p.writes);
        const ioms = c.ioms - p.ioms;
        if (ios === 0 && ioms === 0) continue;
        const s = dtMs / 1000;
        row.disk[name] = {
          rMBs: round(((c.rsect - p.rsect) * 512) / 1e6 / s, 2),
          wMBs: round(((c.wsect - p.wsect) * 512) / 1e6 / s, 2),
          rS: round((c.reads - p.reads) / s, 1),
          wS: round((c.writes - p.writes) / s, 1),
          util: round((ioms / dtMs) * 100, 1),
          aqu: round((c.wioms - p.wioms) / dtMs, 2),
          awaitMs:
            ios > 0 ? round((c.rms - p.rms + (c.wms - p.wms)) / ios, 1) : null,
          inflight: c.inflight,
        };
      }

      row.net = {};
      for (const [name, c] of Object.entries(cur.net)) {
        const p = prev.net[name];
        if (!p || (c.rx === p.rx && c.tx === p.tx)) continue;
        const s = dtMs / 1000;
        row.net[name] = {
          rxMBs: round((c.rx - p.rx) / 1e6 / s, 2),
          txMBs: round((c.tx - p.tx) / 1e6 / s, 2),
        };
      }
      row.tcp = {};
      for (const k of Object.keys(cur.tcp)) {
        const d = cur.tcp[k] - (prev.tcp[k] ?? cur.tcp[k]);
        if (d) row.tcp[k] = d;
      }

      row.e2eRoots = countE2eRoots();
      const active = liveMarkers(ACTIVE_DIR, 'task-vanished', cur.now);
      row.active = active.length;
      if (active.length) lastActiveAt = cur.now;
      const running = liveMarkers(RUNNING_DIR, 'command-vanished', cur.now);
      row.running = running.length;

      if (tick % CENSUS_EVERY_TICKS === 0) {
        row.free = freeSpace(['/tmp', HOME, REPO_ROOT]);
        const c = census.sample(cur.now);
        if (c) {
          appendLine(CENSUS, {
            t: cur.now,
            activeTasks: active.map((m) => m.task),
            ...c,
          });
          for (const m of running) {
            const ageS = (cur.now - m.t0) / 1000;
            const s = snapState.get(m.id) ?? {
              next: 0,
              nearTimeout: false,
              lastAgeS: 0,
            };
            const due =
              s.next < SLOW_COMMAND_SNAPSHOTS_S.length
                ? ageS >= SLOW_COMMAND_SNAPSHOTS_S[s.next]
                : ageS >= s.lastAgeS + SLOW_COMMAND_REPEAT_S;
            const nearTimeout =
              !s.nearTimeout &&
              m.timeoutMs > 0 &&
              ageS * 1000 >= 0.85 * m.timeoutMs;
            if (!due && !nearTimeout) continue;
            if (due) {
              while (
                s.next < SLOW_COMMAND_SNAPSHOTS_S.length &&
                ageS >= SLOW_COMMAND_SNAPSHOTS_S[s.next]
              )
                s.next++;
            }
            if (nearTimeout) s.nearTimeout = true;
            s.lastAgeS = ageS;
            snapState.set(m.id, s);
            appendLine(EVENTS, {
              t: cur.now,
              type: 'slow-command',
              id: m.id,
              taskId: m.taskId,
              fn: m.fn,
              ageS: round(ageS, 0),
              nearTimeout,
              procs: commandSnapshot(census, m),
            });
          }
          const runningIds = new Set(running.map((m) => m.id));
          for (const id of snapState.keys())
            if (!runningIds.has(id)) snapState.delete(id);
        }
      }

      const reg = registry.poll(cur.now);
      for (const e of registry.events) appendLine(EVENTS, e);
      registry.events = [];
      if (reg) {
        row.reg = reg.result;
        if (reg.warnings.length)
          appendLine(EVENTS, {
            t: cur.now,
            type: 'registry-warnings',
            warnings: reg.warnings.slice(0, 20),
          });
      }

      const ping = await pingP;
      row.ping = ping.err
        ? { err: ping.err, ms: ping.ms ?? null }
        : { ms: ping.ms, status: ping.status };
      if (npmResult) {
        row.npm = npmResult;
        npmResult = null;
      }

      const changed = watchState();
      const changes = {};
      for (const k of new Set([
        ...Object.keys(watched),
        ...Object.keys(changed),
      ])) {
        if (watched[k] !== changed[k])
          changes[k] = { from: watched[k] ?? null, to: changed[k] ?? null };
      }
      if (Object.keys(changes).length)
        appendLine(EVENTS, { t: cur.now, type: 'watch-change', changes });
      watched = changed;

      const self = process.cpuUsage(selfPrev);
      selfPrev = process.cpuUsage();
      row.selfCpuMs = round((self.user + self.system) / 1000, 1);
      row.lagMs = Date.now() - cur.now;

      appendLine(TIMELINE, row);
      prev = cur;
    } catch (e) {
      if (tickErrors++ < 20)
        appendLine(EVENTS, {
          t: Date.now(),
          type: 'tick-error',
          tick,
          error: String(e?.stack ?? e).slice(0, 1500),
        });
    }
    if (Date.now() - lastActiveAt > IDLE_EXIT_MS) {
      appendLine(EVENTS, {
        t: Date.now(),
        type: 'sampler-exit',
        reason: 'idle',
      });
      break;
    }
  }
  if (Date.now() - startedAt >= MAX_LIFETIME_MS)
    appendLine(EVENTS, {
      t: Date.now(),
      type: 'sampler-exit',
      reason: 'max-lifetime',
    });
  try {
    if (Number(readText(PIDFILE)) === process.pid) fs.unlinkSync(PIDFILE);
  } catch {}
}

// ---------------------------------------------------------------------------
// Task-facing subcommands

function spawnSampler() {
  const env = { ...process.env };
  for (const k of Object.keys(env))
    if (k.startsWith('NX_TASK_') || k.startsWith('NX_PRESSURE_PROBE_TASK'))
      delete env[k];
  const child = spawn(
    process.execPath,
    [SCRIPT, 'daemon', String(Date.now())],
    {
      detached: true,
      stdio: 'ignore',
      cwd: '/',
      env,
    }
  );
  child.on('error', () => {});
  child.unref();
  return child.pid;
}

function start() {
  for (const d of [TASKS_DIR, ACTIVE_DIR, RUNNING_DIR, FORENSICS_DIR])
    fs.mkdirSync(d, { recursive: true });
  print('fingerprint', fingerprint());
  const alive = samplerAlive();
  print(
    'sampler',
    alive
      ? { status: 'running', pid: alive }
      : { status: 'spawned', pid: spawnSampler() }
  );
}

function readNdjson(file, from, to) {
  const out = [];
  for (const line of (readText(file) ?? '').split('\n')) {
    if (!line) continue;
    try {
      const o = JSON.parse(line);
      if (o.t >= from && o.t <= to) out.push(o);
    } catch {}
  }
  return out;
}

function stats(values) {
  const v = values
    .filter((x) => typeof x === 'number' && Number.isFinite(x))
    .sort((a, b) => a - b);
  if (!v.length) return null;
  const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
  return {
    n: v.length,
    avg: round(v.reduce((a, b) => a + b, 0) / v.length, 2),
    p50: q(0.5),
    p95: q(0.95),
    max: v[v.length - 1],
  };
}

function summarize(rows, census) {
  const pick = (f) => rows.map(f);
  const sum = (f) => rows.reduce((a, r) => a + (f(r) ?? 0), 0);
  const maxOf = (f) => Math.max(0, ...rows.map((r) => f(r) ?? 0));
  const busiestDisk = (r) =>
    Math.max(0, ...Object.values(r.disk ?? {}).map((d) => d.util ?? 0));
  const extNet = (r, key) =>
    Object.entries(r.net ?? {})
      .filter(([n]) => n !== 'lo')
      .reduce((a, [, v]) => a + (v[key] ?? 0), 0);
  const localMean = (k) => {
    const done = sum((r) => r.reg?.[k]?.done);
    return {
      arrivals: sum((r) => r.reg?.[k]?.arr),
      done,
      meanMs: done ? Math.round(sum((r) => r.reg?.[k]?.sumMs) / done) : null,
      maxMs: maxOf((r) => r.reg?.[k]?.unambMaxMs),
      ambiguous: sum((r) => r.reg?.[k]?.ambiguous),
      st4: sum((r) => r.reg?.[k]?.st4),
      st5: sum((r) => r.reg?.[k]?.st5),
    };
  };
  const upDone = sum((r) => r.reg?.up?.done);
  const ttfbN = sum((r) => r.reg?.up?.ttfbN);
  const catAgg = {};
  for (const c of census) {
    for (const [name, v] of Object.entries(c.cats ?? {})) {
      const a = (catAgg[name] ??= {
        cpu: [],
        waitS: [],
        n: [],
        D: [],
        deleted: [],
        rdMB: [],
        wrMB: [],
      });
      for (const k of Object.keys(a)) a[k].push(v[k]);
    }
  }
  const cats = {};
  for (const [name, a] of Object.entries(catAgg)) {
    cats[name] = {
      cpuAvg: stats(a.cpu)?.avg ?? null,
      cpuMax: stats(a.cpu)?.max ?? null,
      waitAvg: stats(a.waitS)?.avg ?? null,
      nMax: stats(a.n)?.max ?? null,
      dMax: stats(a.D)?.max ?? null,
      deletedMax: stats(a.deleted)?.max ?? null,
      rdAvg: stats(a.rdMB)?.avg ?? null,
      wrAvg: stats(a.wrMB)?.avg ?? null,
    };
  }
  // Average over all census samples in the window, counting absent tasks as 0.
  const taskAgg = {};
  for (const c of census)
    for (const [name, v] of Object.entries(c.tasks ?? {}))
      (taskAgg[name] ??= []).push(v.cpu);
  const tasks = Object.fromEntries(
    Object.entries(taskAgg)
      .map(([name, v]) => [
        name,
        {
          cpuAvg: round(v.reduce((a, b) => a + b, 0) / census.length, 2),
          samples: v.length,
        },
      ])
      .sort((a, b) => b[1].cpuAvg - a[1].cpuAvg)
      .slice(0, 15)
  );
  return {
    rows: rows.length,
    gaps: rows.filter((r, i) => i > 0 && r.t - rows[i - 1].t > 3 * TICK_MS)
      .length,
    hostBusyPct: stats(
      pick((r) => (r.cpu ? round(100 - r.cpu.idle - r.cpu.iow, 1) : null))
    ),
    iowaitPct: stats(pick((r) => r.cpu?.iow)),
    stealPct: stats(pick((r) => r.cpu?.steal)),
    psiCpuSome: stats(pick((r) => r.psi?.cpu?.some)),
    psiIoSome: stats(pick((r) => r.psi?.io?.some)),
    psiIoFull: stats(pick((r) => r.psi?.io?.full)),
    psiMemSome: stats(pick((r) => r.psi?.mem?.some)),
    cgPsiCpuSome: stats(pick((r) => r.cgPsi?.cpu?.some)),
    cgPsiIoSome: stats(pick((r) => r.cgPsi?.io?.some)),
    cgPsiMemSome: stats(pick((r) => r.cgPsi?.mem?.some)),
    cgCores: stats(pick((r) => r.cg?.cores)),
    cgThrottlePct: stats(pick((r) => r.cg?.thrPct)),
    cgMemMB: stats(pick((r) => r.cg?.memMB)),
    memAvailMB: stats(pick((r) => r.mem?.availMB)),
    dirtyMB: stats(pick((r) => r.mem?.dirtyMB)),
    diskUtil: stats(rows.map(busiestDisk)),
    netRxMBs: stats(rows.map((r) => extNet(r, 'rxMBs'))),
    loMBs: stats(pick((r) => r.net?.lo?.rxMBs ?? 0)),
    runQueue: stats(pick((r) => r.run)),
    blocked: stats(pick((r) => r.blk)),
    load1: stats(pick((r) => r.load1)),
    activeE2eTasks: stats(pick((r) => r.active)),
    runningCommands: stats(pick((r) => r.running)),
    e2eRoots: stats(pick((r) => r.e2eRoots)),
    pingMs: stats(pick((r) => r.ping?.ms)),
    pingErrors: rows.filter((r) => r.ping?.err).length,
    npmPingMs: stats(pick((r) => r.npm?.ms)),
    npmDnsMs: stats(pick((r) => r.npm?.dnsMs)),
    npmErrors: rows.filter((r) => r.npm?.err || r.npm?.dnsErr).length,
    tcp: {
      retrans: sum((r) => r.tcp?.RetransSegs),
      listenDrops: sum((r) => r.tcp?.ListenDrops),
      timeouts: sum((r) => r.tcp?.TCPTimeouts),
    },
    registry: {
      tarballs: localMean('tgz'),
      metadata: localMean('meta'),
      inflightMax: maxOf((r) => r.reg?.inflMax),
      uplinkRequests: sum((r) => r.reg?.up?.arr),
      uplinkTarballs: sum((r) => r.reg?.up?.tgz),
      uplinkMetaMeanMs: upDone
        ? Math.round(sum((r) => r.reg?.up?.sumMs) / upDone)
        : null,
      uplinkMetaMaxMs: maxOf((r) => r.reg?.up?.maxMs),
      uplinkTtfbMeanMs: ttfbN
        ? Math.round(sum((r) => r.reg?.up?.ttfbSumMs) / ttfbN)
        : null,
      uplinkInflightMax: maxOf((r) => r.reg?.up?.inflMax),
      uplinkErrors: sum((r) => r.reg?.up?.err),
      conflicts: sum((r) => r.reg?.conflict),
      warnings: sum((r) => r.reg?.warn),
      unmatched: sum((r) => r.reg?.unmatched),
      expired: sum((r) => r.reg?.expired),
      slowestUplink: rows
        .flatMap((r) => r.reg?.up?.slow ?? [])
        .sort((a, b) => b[0] - a[0])
        .slice(0, 10),
    },
    cats,
    tasks,
    selfCpuMs: round(
      sum((r) => r.selfCpuMs),
      0
    ),
    lagMsMax: maxOf((r) => r.lagMs),
  };
}

async function waitForFiles(files, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && files.some((f) => !fs.existsSync(f)))
    await new Promise((r) => setTimeout(r, 250));
}

async function report(taskId, startMs) {
  const from = Number(startMs) - TICK_MS;
  const commands = readNdjson(
    path.join(TASKS_DIR, `${taskId}.ndjson`),
    0,
    Infinity
  );
  const forensicsFiles = commands
    .filter((c) => c.forensics)
    .map((c) => path.join(FORENSICS_DIR, `${c.id}.ndjson`));
  await waitForFiles(forensicsFiles, 20000);
  const now = Date.now();
  const rows = readNdjson(TIMELINE, from, now);
  const census = readNdjson(CENSUS, from, now);
  const ids = new Set(commands.map((c) => c.id));
  const events = readNdjson(EVENTS, from, now).filter(
    (e) => e.type !== 'slow-command' || ids.has(e.id)
  );
  print('window', {
    taskId,
    task: `${process.env.NX_TASK_TARGET_PROJECT ?? '?'}:${process.env.NX_TASK_TARGET_TARGET ?? '?'}`,
    hostname: os.hostname(),
    from: Number(startMs),
    to: now,
    durationS: round((now - Number(startMs)) / 1000, 0),
    sampler: samplerAlive(),
    commands: commands.length,
    failedCommands: commands.filter((c) => c.outcome !== 'ok').length,
    summary: summarize(rows, census),
  });
  for (const c of commands) {
    const during = rows.filter((r) => r.t >= c.t0 && r.t <= c.t1 + TICK_MS);
    const cen = census.filter(
      (r) => r.t >= c.t0 && r.t <= c.t1 + CENSUS_EVERY_TICKS * TICK_MS
    );
    const s = during.length ? summarize(during, cen) : null;
    print('command', {
      ...c,
      durS: round((c.t1 - c.t0) / 1000, 1),
      during: s && {
        rows: s.rows,
        hostBusyAvg: s.hostBusyPct?.avg ?? null,
        stealAvg: s.stealPct?.avg ?? null,
        psiCpuAvg: s.psiCpuSome?.avg ?? null,
        psiIoAvg: s.psiIoSome?.avg ?? null,
        psiMemAvg: s.psiMemSome?.avg ?? null,
        cgThrottleAvg: s.cgThrottlePct?.avg ?? null,
        cgCoresAvg: s.cgCores?.avg ?? null,
        diskUtilMax: s.diskUtil?.max ?? null,
        activeE2eAvg: s.activeE2eTasks?.avg ?? null,
        runQueueAvg: s.runQueue?.avg ?? null,
        pingMax: s.pingMs?.max ?? null,
        registryTgzMeanMs: s.registry.tarballs.meanMs,
        registryMetaMeanMs: s.registry.metadata.meanMs,
        uplinkMetaMeanMs: s.registry.uplinkMetaMeanMs,
        topTasks: Object.fromEntries(Object.entries(s.tasks).slice(0, 6)),
        topCats: Object.fromEntries(
          Object.entries(s.cats)
            .sort((a, b) => (b[1].cpuAvg ?? 0) - (a[1].cpuAvg ?? 0))
            .slice(0, 6)
            .map(([k, v]) => [k, v.cpuAvg])
        ),
      },
    });
  }
  for (const f of forensicsFiles) {
    const text = readText(f);
    if (text) process.stdout.write(text.endsWith('\n') ? text : text + '\n');
    else print('forensics-missing', { file: f });
  }
  for (const e of events) print('event', e);
  printBlob('row', rows);
  printBlob('census', census);
}

// Rows and census are most of a report; gzip shrinks them about tenfold.
function printBlob(name, items) {
  const b64 = zlib
    .gzipSync(items.map((x) => JSON.stringify(x)).join('\n'))
    .toString('base64');
  const of = Math.max(1, Math.ceil(b64.length / BLOB_PART_CHARS));
  for (let part = 1; part <= of; part++)
    print('blob', {
      name,
      n: items.length,
      part,
      of,
      b64: b64.slice((part - 1) * BLOB_PART_CHARS, part * BLOB_PART_CHARS),
    });
}

// pnpm 12 prints `failed to import "<store file>" to "<target>": <error>` and
// wraps long paths onto indented lines, so whitespace inside a path is dropped.
const PNPM_IMPORT_RE =
  /failed to import "([^"]+)" to "([^"]+)"(?::([^\n]*(?:\n[ \t]+[^\n]*)?))?/g;

function statPath(p) {
  try {
    const st = fs.lstatSync(p);
    return {
      exists: true,
      ino: st.ino,
      nlink: st.nlink,
      size: st.size,
      mode: (st.mode & 0o7777).toString(8),
      mtimeAgeMs: Math.round(Date.now() - st.mtimeMs),
      ctimeAgeMs: Math.round(Date.now() - st.ctimeMs),
    };
  } catch (e) {
    return { exists: false, code: e.code };
  }
}

function forensics(id, outFile, cwd, outputFile) {
  const now = Date.now();
  const output = readText(outputFile) ?? '';
  const procsInWorkspace = [];
  const pnpm = [];
  for (const pid of listDir('/proc') ?? []) {
    if (!/^\d+$/.test(pid)) continue;
    let pcwd = null;
    try {
      pcwd = fs.readlinkSync(`/proc/${pid}/cwd`);
    } catch {}
    const args = (readText(`/proc/${pid}/cmdline`) ?? '')
      .split('\0')
      .filter(Boolean);
    const cmd = args.join(' ');
    const comm = (readText(`/proc/${pid}/comm`) ?? '').trim();
    const stat = readText(`/proc/${pid}/stat`) ?? '';
    const state = stat.slice(stat.lastIndexOf(')') + 2).split(' ')[0] || null;
    const info = {
      pid: Number(pid),
      st: state,
      cwd: pcwd,
      cmd: shownCmdline(args),
    };
    const pc = pcwd?.replace(/ \(deleted\)$/, '');
    if (cwd && pc && (pc === cwd || pc.startsWith(cwd + '/')))
      procsInWorkspace.push(info);
    if (classify(cmd, comm) === 'pnpm') pnpm.push(info);
  }
  // A failed import names a store file. Its state now, and the files a
  // concurrent writer leaves next to it, show what raced with the install.
  const seen = new Set();
  const pnpmImport = [];
  for (const m of output
    .replace(/\x1b\[[0-9;]*m/g, '')
    .matchAll(PNPM_IMPORT_RE)) {
    const file = m[1].replace(/\s+/g, '');
    if (seen.has(file) || pnpmImport.length >= 5) continue;
    seen.add(file);
    const target = m[2].replace(/\s+/g, '');
    const dir = path.dirname(file);
    const base = path.basename(file).replace(/-exec$/, '');
    const siblings = (listDir(dir) ?? [])
      .filter(
        (n) => n !== path.basename(file) && n.startsWith(base.slice(0, 20))
      )
      .slice(0, 20);
    pnpmImport.push({
      file,
      target,
      error: redact((m[3] ?? '').replace(/\s+/g, ' ').trim()),
      stat: statPath(file),
      targetStat: statPath(target),
      targetDirStat: statPath(path.dirname(target)),
      siblings: siblings.map((n) => ({
        name: n,
        stat: statPath(path.join(dir, n)),
      })),
    });
  }
  const timeline = readNdjson(TIMELINE, now - 30000, now);
  const census = readNdjson(CENSUS, now - 60000, now);
  const result = {
    id,
    t: now,
    cwd,
    latestRow: timeline[timeline.length - 1] ?? null,
    latestCensus: census[census.length - 1] ?? null,
    procsInWorkspace: procsInWorkspace.slice(0, 40),
    pnpmProcesses: pnpm.slice(0, 40),
    pnpmImport,
    watch: /bin\/mvn|mvnw|Maven|gradle/i.test(output)
      ? watchState()
      : undefined,
    events: readNdjson(EVENTS, now - 120000, now).filter(
      (e) => !['registry-warnings', 'slow-command'].includes(e.type)
    ),
  };
  const tmp = `${outFile}.tmp`;
  fs.writeFileSync(
    tmp,
    `${PREFIX}${JSON.stringify({ kind: 'failure', ...result })}\n`
  );
  fs.renameSync(tmp, outFile);
}

// ---------------------------------------------------------------------------

const [cmd, ...args] = process.argv.slice(2);
if (process.platform === 'linux') {
  try {
    if (cmd === 'start') start();
    else if (cmd === 'daemon') await runDaemon();
    else if (cmd === 'report') await report(args[0], args[1]);
    else if (cmd === 'forensics') forensics(args[0], args[1], args[2], args[3]);
    else print('probe-error', { error: `unknown subcommand ${cmd}` });
  } catch (e) {
    if (cmd === 'daemon') {
      try {
        appendLine(EVENTS, {
          t: Date.now(),
          type: 'sampler-crash',
          error: String(e?.stack ?? e).slice(0, 2000),
        });
      } catch {}
    } else if (cmd === 'forensics') {
      try {
        fs.writeFileSync(
          args[1],
          `${PREFIX}${JSON.stringify({ kind: 'forensics-error', id: args[0], error: String(e?.stack ?? e).slice(0, 2000) })}\n`
        );
      } catch {}
    } else {
      print('probe-error', {
        phase: cmd,
        error: String(e?.stack ?? e).slice(0, 2000),
      });
    }
  }
}
