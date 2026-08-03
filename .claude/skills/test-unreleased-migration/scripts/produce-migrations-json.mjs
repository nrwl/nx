#!/usr/bin/env node
// Produce an executable `migrations.json` for testing UNRELEASED migrations (mode 2),
// without the `nx migrate <version>` generate phase (which needs a registry).
//
// Reads each nx package's authoring `migrations.json` (top-level `generators`, legacy
// `schematics`), keeps the entries whose version is in the `(from, to]` window, and emits
// them as the executable list `nx migrate --run-migrations` consumes:
//   { "migrations": [ { package, name, version, description?, implementation?, factory?, prompt?, documentation? } ] }
// The run phase resolves each generator from the installed collection by package+name, so
// package+name+version drive execution; implementation/factory/prompt/documentation are
// copied through so nx classifies prompt-only/hybrid migrations correctly and can surface
// their prompt/docs.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, isAbsolute, resolve } from 'node:path';
import { createRequire } from 'node:module';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) args[a.slice(2)] = argv[++i];
  }
  return args;
}

function fail(msg) {
  console.error(`produce-migrations-json: ${msg}`);
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
const packagesDir = args['packages-dir'];
const from = args.from;
const to = args.to;
const out = args.out;
if (!packagesDir || !from || !to || !out) {
  fail(
    'usage: --packages-dir <publisher-nx>/packages --from <version> --to <version> --out <migrations.json> [--packages @nx/a,@nx/b] [--target-manifest <repo>/package.json]'
  );
}

// semver resolved from the publisher repo's node_modules (same dependency the nx repo uses).
let semver;
try {
  semver = createRequire(resolve(packagesDir, 'noop.js'))('semver');
} catch {
  fail(
    'could not load `semver` from the publisher repo - run this from an installed nx checkout'
  );
}

// Optional filters: only these package names, and/or only packages the target depends on.
const onlyPackages = args.packages
  ? new Set(args.packages.split(',').map((s) => s.trim()))
  : null;

let targetDeps = null;
if (args['target-manifest']) {
  const m = JSON.parse(readFileSync(args['target-manifest'], 'utf8'));
  targetDeps = new Set([
    ...Object.keys(m.dependencies ?? {}),
    ...Object.keys(m.devDependencies ?? {}),
  ]);
}

function migrationsFileFor(pkgJson, pkgDir) {
  const cfg = pkgJson['nx-migrations'] ?? pkgJson['ng-update'];
  const rel = typeof cfg === 'string' ? cfg : cfg?.migrations;
  if (!rel) return null;
  const p = isAbsolute(rel) ? rel : join(pkgDir, rel);
  return existsSync(p) ? p : null;
}

const CARRY = [
  'description',
  'implementation',
  'factory',
  'prompt',
  'documentation',
];
const emitted = [];
let scanned = 0;

for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const pkgDir = join(packagesDir, entry.name);
  const pkgJsonPath = join(pkgDir, 'package.json');
  if (!existsSync(pkgJsonPath)) continue;

  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
  const pkgName = pkgJson.name;
  if (!pkgName) continue;
  if (onlyPackages && !onlyPackages.has(pkgName)) continue;
  if (targetDeps && !targetDeps.has(pkgName)) continue;

  const migFile = migrationsFileFor(pkgJson, pkgDir);
  if (!migFile) continue;
  scanned++;

  const mig = JSON.parse(readFileSync(migFile, 'utf8'));
  const generators = { ...mig.schematics, ...mig.generators };
  for (const [name, def] of Object.entries(generators)) {
    const version = def.version;
    if (!version || !semver.valid(version)) {
      if (version)
        console.error(
          `  skip ${pkgName}#${name}: invalid version "${version}"`
        );
      continue;
    }
    // An entry runs when installed < version <= target (prerelease-aware).
    if (!(semver.gt(version, from) && semver.lte(version, to))) continue;

    const record = { package: pkgName, name, version };
    for (const k of CARRY) if (def[k] != null) record[k] = def[k];
    emitted.push(record);
  }
}

// Run in ascending version order, matching how nx orders a generated list.
emitted.sort((a, b) => semver.compare(a.version, b.version));

writeFileSync(out, JSON.stringify({ migrations: emitted }, null, 2) + '\n');

console.error(
  `produce-migrations-json: ${emitted.length} migration(s) in (${from}, ${to}] across ${scanned} package(s) -> ${out}`
);
if (emitted.length === 0) {
  console.error(
    '  no unreleased migrations in the window - check --from/--to and that the publisher packages are built'
  );
}
