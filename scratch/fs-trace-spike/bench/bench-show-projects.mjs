#!/usr/bin/env node
// Times `nx show projects` in any workspace, once per nx variant, with the daemon on.
//
//   node bench-show-projects.mjs --workspace <dir> \
//     --variant baseline=installed \
//     --variant traced=<path to packages/nx | .tgz | npm:<version>> \
//     --variant untraced=<same source>,NX_PLUGIN_READ_TRACING=false \
//     [--runs 5] [--edit README.md] [--out results.json]
//
//   node bench-show-projects.mjs --workspace <dir> --restore
//
// Each variant is unpacked over the workspace's resolved `nx` directory, keeping its
// version number so plugins see the version they were installed with, and the original is
// put back afterwards. `npm:<version>` also swaps in that version's native binding package.
// A local build carries its own binding in dist/src/native, which nx loads first.
//
// Scenarios, each a fresh `nx show projects --json`:
//   cold     daemon stopped, workspace data removed: every plugin runs, nothing cached
//   restart  daemon stopped, workspace data kept: plugin and evaluation caches on disk
//   warm     daemon still running, after appending a marker to the --edit file (root
//            README.md by default), so the daemon recomputes the graph instead of
//            reusing the one in memory
//   restart2 daemon stopped again: what the first restart stored is there too
//
// The edited file is put back afterwards, or by --restore after an interrupted run.
import { execFileSync, spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';

const args = parseArgs(process.argv.slice(2));
const workspace = resolve(args.workspace ?? process.cwd());
const runs = Number(args.runs ?? 5);
const scratch = mkdtempSync(join(tmpdir(), 'nx-bench-'));
const backupSuffix = '.nx-bench-orig';

const nxDir = resolvePackageDir('nx', workspace);
const nativeName = nativePackageName();
const nativeDir = tryResolvePackageDir(nativeName, nxDir);
const installedVersion = readJson(join(nxDir, 'package.json')).version;
const editPath = resolve(workspace, args.edit ?? 'README.md');
// Outside the workspace, so the backup itself changes nothing a plugin lists.
const editBackup = join(
  tmpdir(),
  `nx-bench-${createHash('sha256').update(editPath).digest('hex').slice(0, 12)}.orig`
);
let edits = 0;

if (args.restore) {
  restoreAll();
  console.log('restored');
  process.exit(0);
}
for (const dir of [nxDir, nativeDir]) {
  if (dir && existsSync(dir + backupSuffix)) {
    fail(
      `${dir + backupSuffix} exists from an interrupted run. Pass --restore first.`
    );
  }
}
if (existsSync(editBackup)) {
  fail(
    `${editPath} was left edited by an interrupted run. Pass --restore first.`
  );
}
if (!args.install && !existsSync(editPath)) {
  fail(
    `${editPath} does not exist. Pass --edit <file> for the warm runs to edit.`
  );
}
if (args.install) {
  // Leaves one variant in place for poking at by hand. Undo with --restore.
  install(parseVariant(`manual=${args.install}`));
  console.log(`installed ${args.install} over ${nxDir}`);
  process.exit(0);
}

const variants = (args.variant ?? ['baseline=installed']).map(parseVariant);
const results = [];
let expectedProjects = null;

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopDaemon();
    restoreAll();
    rmSync(scratch, { recursive: true, force: true });
    process.exit(130);
  });
}

// Variants take turns within each run, so load on the machine falls on all of them alike.
try {
  // Untimed: warms the OS file cache, and packs each variant once.
  for (const variant of variants) {
    inVariant(variant, 'warm-up', (env) => {
      clearWorkspaceData(env);
      showProjects(env);
    });
  }
  for (let i = 0; i < runs; i++) {
    for (const variant of variants) {
      inVariant(variant, `run ${i + 1}/${runs}`, (env) => {
        clearWorkspaceData(env);
        record(variant, 'cold', i, env);
        stopDaemon(env);
        record(variant, 'restart', i, env);
        editWorkspaceFile();
        record(variant, 'warm', i, env);
        stopDaemon(env);
        record(variant, 'restart2', i, env);
        variant.evaluationEntries = countEntries(env, 'plugin-evaluations');
      });
    }
  }
} finally {
  restoreAll();
  rmSync(scratch, { recursive: true, force: true });
}

report();

/** Runs `fn` with the variant installed and no daemon running, then puts nx back. */
function inVariant(variant, label, fn) {
  console.error(`\n== ${label}: ${variant.label} (${variant.source})`);
  install(variant);
  const env = {
    ...process.env,
    NX_DAEMON: 'true',
    NX_TUI: 'false',
    NX_NO_CLOUD: 'true',
    // Otherwise every daemon start installs the latest nx into a temp dir for its AI
    // agents check, which competes with the plugins and leaks when the daemon stops.
    NX_USE_LOCAL: 'true',
    ...variant.env,
  };
  try {
    stopDaemon(env);
    fn(env);
  } finally {
    stopDaemon(env);
    restoreAll();
  }
}

function record(variant, scenario, run, env) {
  const { ms, projects } = showProjects(env);
  results.push({ variant: variant.label, scenario, run, ms });
  console.error(`  ${scenario.padEnd(8)} ${String(ms).padStart(6)} ms`);
  const key = JSON.stringify(projects);
  if (expectedProjects === null) {
    expectedProjects = key;
  } else if (key !== expectedProjects) {
    variant.mismatch = true;
    console.error(
      `  !! ${variant.label} ${scenario} returned a different project list`
    );
  }
}

function showProjects(env) {
  const start = process.hrtime.bigint();
  const out = runNx(['show', 'projects', '--json'], env);
  const ms = Number((process.hrtime.bigint() - start) / 1_000_000n);
  if (out.status !== 0) {
    fail(`nx show projects failed:\n${out.stderr}\n${out.stdout}`);
  }
  // A disabled daemon makes every later run compute in-process, which is not what is
  // being measured.
  const disabled = join(workspaceDataDir(env), 'd', 'disabled');
  if (existsSync(disabled)) {
    fail(`the daemon disabled itself: ${readFileSync(disabled, 'utf8')}`);
  }
  return { ms, projects: JSON.parse(out.stdout).sort() };
}

/** Stops the daemon and waits for it to exit, so the next run cannot reach a dying one. */
function stopDaemon(env = process.env) {
  let pid = null;
  try {
    pid = readJson(
      join(workspaceDataDir(env), 'd', 'server-process.json')
    ).processId;
  } catch {
    // Not running.
  }
  runNx(['daemon', '--stop'], env);
  const deadline = Date.now() + 30_000;
  while (pid && isAlive(pid)) {
    if (Date.now() > deadline) {
      console.error(`daemon ${pid} did not exit`);
      break;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
  }
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function runNx(nxArgs, env) {
  const bin = readJson(join(nxDir, 'package.json')).bin.nx;
  return spawnSync(process.execPath, [join(nxDir, bin), ...nxArgs], {
    cwd: workspace,
    env,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
}

function workspaceDataDir(env) {
  const dir =
    env.NX_WORKSPACE_DATA_DIRECTORY ||
    env.NX_PROJECT_GRAPH_CACHE_DIRECTORY ||
    join('.nx', 'workspace-data');
  return isAbsolute(dir) ? dir : join(workspace, dir);
}

function clearWorkspaceData(env) {
  rmSync(workspaceDataDir(env), { recursive: true, force: true });
}

function countEntries(env, sub) {
  try {
    return readdirSync(join(workspaceDataDir(env), sub)).length;
  } catch {
    return 0;
  }
}

// --- Installing variants

function parseVariant(spec) {
  const eq = spec.indexOf('=');
  if (eq < 1) fail(`--variant must be label=source[,ENV=value...]: ${spec}`);
  const [source, ...envPairs] = spec.slice(eq + 1).split(',');
  return {
    label: spec.slice(0, eq),
    source,
    env: Object.fromEntries(
      envPairs.map((p) => [
        p.slice(0, p.indexOf('=')),
        p.slice(p.indexOf('=') + 1),
      ])
    ),
  };
}

function install(variant) {
  if (variant.source === 'installed') return;
  variant.tarballs ??= tarballsFor(variant.source);
  overlay(nxDir, variant.tarballs.nx);
  if (variant.tarballs.native) overlay(nativeDir, variant.tarballs.native);
}

function tarballsFor(source) {
  if (source.startsWith('npm:')) {
    const version = source.slice(4);
    if (!nativeDir) fail(`${nativeName} is not installed next to nx`);
    return {
      nx: pack(`nx@${version}`),
      native: pack(`${nativeName}@${version}`),
    };
  }
  const path = resolve(source);
  return { nx: path.endsWith('.tgz') ? path : pack(path) };
}

/** Packs an npm spec or a package directory into a tarball under the scratch dir. */
function pack(spec) {
  const dest = mkdtempSync(join(scratch, 'pack-'));
  const file = execFileSync(
    'npm',
    ['pack', '--ignore-scripts', '--silent', '--pack-destination', dest, spec],
    { encoding: 'utf8', shell: process.platform === 'win32' }
  )
    .trim()
    .split('\n')
    .pop();
  return join(dest, file);
}

/**
 * Replaces a package's files with a tarball's, leaving its nested node_modules in place
 * so dependencies installed under it still resolve.
 */
function overlay(dir, tarball) {
  const backup = dir + backupSuffix;
  mkdirSync(backup);
  for (const entry of readdirSync(dir)) {
    if (entry !== 'node_modules')
      renameSync(join(dir, entry), join(backup, entry));
  }
  const unpacked = mkdtempSync(join(scratch, 'unpack-'));
  execFileSync('tar', ['-xzf', tarball, '-C', unpacked]);
  const root = join(unpacked, 'package');
  for (const entry of readdirSync(root)) {
    cpSync(join(root, entry), join(dir, entry), { recursive: true });
  }
  rmSync(unpacked, { recursive: true, force: true });
  const pkgPath = join(dir, 'package.json');
  const pkg = readJson(pkgPath);
  pkg.version = readJson(join(backup, 'package.json')).version;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
}

function restore(dir) {
  const backup = dir + backupSuffix;
  if (!existsSync(backup)) return;
  for (const entry of readdirSync(dir)) {
    if (entry !== 'node_modules')
      rmSync(join(dir, entry), { recursive: true, force: true });
  }
  for (const entry of readdirSync(backup)) {
    renameSync(join(backup, entry), join(dir, entry));
  }
  rmSync(backup, { recursive: true, force: true });
}

function restoreAll() {
  restore(nxDir);
  if (nativeDir) restore(nativeDir);
  if (existsSync(editBackup)) {
    writeFileSync(editPath, readFileSync(editBackup));
    rmSync(editBackup);
  }
}

/** Appends a unique marker to the edit file, keeping its original for restoreAll. */
function editWorkspaceFile() {
  if (!existsSync(editBackup)) {
    cpSync(editPath, editBackup);
  }
  const original = readFileSync(editBackup, 'utf8');
  writeFileSync(editPath, `${original}\n<!-- nx-bench edit ${++edits} -->\n`);
}

// --- Resolution

function resolvePackageDir(name, from) {
  const dir = tryResolvePackageDir(name, from);
  if (!dir) fail(`cannot resolve ${name} from ${from}`);
  return dir;
}

function tryResolvePackageDir(name, from) {
  try {
    const req = createRequire(join(from, 'noop.js'));
    return realpathSync(resolve(req.resolve(`${name}/package.json`), '..'));
  } catch {
    return null;
  }
}

function nativePackageName() {
  const { platform, arch } = process;
  if (platform === 'linux') {
    if (arch === 'arm') return '@nx/nx-linux-arm-gnueabihf';
    const musl = !process.report?.getReport().header.glibcVersionRuntime;
    return `@nx/nx-linux-${arch}-${musl ? 'musl' : 'gnu'}`;
  }
  if (platform === 'win32') return `@nx/nx-win32-${arch}-msvc`;
  return `@nx/nx-${platform}-${arch}`;
}

// --- Reporting

function report() {
  const scenarios = ['cold', 'restart', 'warm', 'restart2'];
  const rows = variants.map((v) => {
    const row = { variant: v.label };
    for (const s of scenarios) {
      const ms = results
        .filter((r) => r.variant === v.label && r.scenario === s)
        .map((r) => r.ms)
        .sort((a, b) => a - b);
      row[s] = ms.length
        ? `${median(ms)} (${ms[0]}-${ms[ms.length - 1]})`
        : '-';
    }
    row['eval entries'] = v.evaluationEntries;
    row['same projects'] = v.mismatch ? 'NO' : 'yes';
    return row;
  });
  console.log(
    `\nnx show projects, ms, median (min-max) of ${runs} runs. Installed nx ${installedVersion}.`
  );
  console.table(rows);
  if (args.out) {
    writeFileSync(
      args.out,
      JSON.stringify({ workspace, runs, variants, results }, null, 2)
    );
  }
}

function median(sorted) {
  const mid = sorted.length >> 1;
  return sorted.length % 2
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

// --- Plumbing

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    const value =
      argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    if (key === 'variant') (out.variant ??= []).push(value);
    else out[key] = value;
  }
  return out;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function fail(message) {
  console.error(message);
  try {
    stopDaemon();
    restoreAll();
  } catch {
    // Failed before the package directories were resolved, so nothing was swapped.
  }
  rmSync(scratch, { recursive: true, force: true });
  process.exit(1);
}
