#!/usr/bin/env node
// Produces the executable `migrations.json` that `nx migrate --run-migrations`
// and `--run-migration` consume, standing in for the `nx migrate <version>`
// generate phase, which cannot see an unreleased build because it resolves
// migration metadata from a registry.
//
// Collections are read from the TARGET workspace's own `node_modules`, not from
// the publisher's source tree. That is the published layout, so the `./dist/...`
// `implementation` and `prompt` paths resolve; the versions are the ones that
// will actually run; and a package the target does not install is simply absent
// instead of aborting the run when nx fails to resolve its collection.
//
// Three things the generate phase does are mirrored here, because the run phase
// assumes they already happened:
//   - keep only entries whose version falls in the `(from, to]` window
//   - drop entries whose `requires` gate is unmet (the run phase never rechecks)
//   - copy each `prompt` markdown into `tools/ai-migrations/<pkg>/<to>/` and
//     rewrite the entry to that path, which is where nx reads it from at run
//     time (it joins `prompt` to the workspace root, not to the package)

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { parseArgs } from 'node:util';
import semver from 'semver';

const AI_MIGRATIONS_DIR = 'tools/ai-migrations';

const USAGE = `usage: produce-migrations-json.mjs --target-root <repo> --from <version> --to <version>
                                   [--packages @nx/a,@nx/b] [--expect <package>:<name>] [--out <file>]

  --target-root  the target workspace whose node_modules holds the packages under test
  --from         the version the target sat at BEFORE the local build was delivered
  --to           the version the migrations target (their migrations.json entry versions)
  --packages     restrict to these packages (default: every installed nx package)
  --expect       fail unless this migration survives the window and its requires gate
  --out          output path (default: <target-root>/migrations.json)`;

function fail(msg) {
  console.error(`produce-migrations-json: ${msg}`);
  process.exit(1);
}

let parsed;
try {
  parsed = parseArgs({
    args: process.argv.slice(2),
    options: {
      'target-root': { type: 'string' },
      from: { type: 'string' },
      to: { type: 'string' },
      packages: { type: 'string' },
      expect: { type: 'string' },
      out: { type: 'string' },
    },
    strict: true,
  });
} catch (e) {
  fail(`${e.message}\n\n${USAGE}`);
}
const args = parsed.values;

for (const required of ['target-root', 'from', 'to']) {
  if (!args[required]) fail(`missing --${required}\n\n${USAGE}`);
}

const targetRoot = args['target-root'];
if (!existsSync(join(targetRoot, 'package.json'))) {
  fail(
    `--target-root "${targetRoot}" has no package.json; expected a workspace root`
  );
}
const modulesDir = join(targetRoot, 'node_modules');
if (!existsSync(modulesDir)) {
  fail(
    `"${modulesDir}" does not exist - install the target (and deliver the local build) before producing`
  );
}

for (const bound of ['from', 'to']) {
  if (!semver.valid(args[bound])) {
    fail(`--${bound} "${args[bound]}" is not a valid semver version`);
  }
}
const { from, to } = args;
if (semver.gt(from, to)) {
  fail(
    `--from ${from} is greater than --to ${to}; the window is empty by construction`
  );
}

const out = args.out ?? join(targetRoot, 'migrations.json');

// `clean` for a tagged version, `coerce` for a partial one like `23.1`.
const cleanSemver = (v) => semver.clean(v) ?? semver.coerce(v);

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    fail(`could not read JSON from "${path}": ${e.message}`);
  }
}

function installedPackageJsonPath(pkgName) {
  const p = join(modulesDir, ...pkgName.split('/'), 'package.json');
  return existsSync(p) ? p : null;
}

// Mirrors nx's `readNxMigrateConfig`: `nx-migrations` or the legacy `ng-update`,
// either a bare path or an object carrying one under `migrations`.
function migrationsFileFor(pkgJson, pkgDir) {
  const cfg = pkgJson['nx-migrations'] ?? pkgJson['ng-update'];
  const rel = typeof cfg === 'string' ? cfg : cfg?.migrations;
  if (!rel) return null;
  const p = join(pkgDir, rel);
  return existsSync(p) ? p : null;
}

// Every installed package under the nx scope, so the default run covers whatever
// the delivery step actually installed. `--packages` narrows it.
function discoverNxPackages() {
  const found = [];
  const push = (name) => {
    if (installedPackageJsonPath(name)) found.push(name);
  };
  push('nx');
  const scopeDir = join(modulesDir, '@nx');
  if (existsSync(scopeDir)) {
    // Not filtered on isDirectory(): pnpm installs each package as a symlink
    // into its virtual store, which readdir reports as a link, not a directory.
    for (const entry of readdirSync(scopeDir)) push(`@nx/${entry}`);
  }
  return found;
}

const packageNames = args.packages
  ? args.packages
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : discoverNxPackages();

if (packageNames.length === 0) {
  fail(
    `no nx packages found under "${modulesDir}" - deliver the local build before producing`
  );
}

const missing = packageNames.filter((p) => !installedPackageJsonPath(p));
if (missing.length) {
  fail(
    `not installed in the target: ${missing.join(', ')}. Deliver the local build first, or drop them from --packages.`
  );
}

// The versions this run is migrating TO. `requires` gates resolve against these
// before falling back to what is installed, the same two-tier lookup nx does
// against its planned package updates.
const plannedVersions = new Map(packageNames.map((name) => [name, to]));

function installedVersion(pkgName) {
  const p = installedPackageJsonPath(pkgName);
  return p ? readJson(p).version : null;
}

function requirementsMet(requires) {
  if (!requires || Object.keys(requires).length === 0) return true;
  return Object.entries(requires).every(([pkgName, range]) => {
    const planned = plannedVersions.get(pkgName);
    if (planned) {
      return semver.satisfies(cleanSemver(planned), range, {
        includePrerelease: true,
      });
    }
    const installed = installedVersion(pkgName);
    return (
      !!installed &&
      semver.satisfies(installed, range, { includePrerelease: true })
    );
  });
}

// Mirrors nx's `writePromptMigrationFiles`. The authoring `prompt` is relative to
// the package's migrations.json; at run time nx joins it to the WORKSPACE root,
// so the markdown has to be copied in and the entry repointed.
const promptDestinations = new Map();
const writtenPromptFiles = [];

function stagePrompt(pkgName, promptRelPath, migrationsDir) {
  const sourceKey = `${pkgName}::${promptRelPath}`;
  if (promptDestinations.has(sourceKey))
    return promptDestinations.get(sourceKey);

  const sourcePath = join(migrationsDir, promptRelPath);
  if (!existsSync(sourcePath)) {
    fail(
      `prompt file "${promptRelPath}" declared by ${pkgName} is missing at "${sourcePath}" - the delivered build is incomplete`
    );
  }
  const content = readFileSync(sourcePath, 'utf8');

  const baseName = posix.basename(promptRelPath);
  const ext = posix.extname(baseName);
  const stem = ext ? baseName.slice(0, -ext.length) : baseName;
  const destDir = posix.join(AI_MIGRATIONS_DIR, pkgName, to);

  // Same file reused by two migrations lands once; a name clash carrying
  // different content gets a numbered sibling.
  let chosen;
  for (let n = 0; ; n++) {
    const candidate = posix.join(
      destDir,
      n === 0 ? baseName : `${stem}-${n}${ext}`
    );
    const absolute = join(targetRoot, candidate);
    if (!existsSync(absolute)) {
      mkdirSync(dirname(absolute), { recursive: true });
      writeFileSync(absolute, content);
      writtenPromptFiles.push(candidate);
      chosen = candidate;
      break;
    }
    if (readFileSync(absolute, 'utf8') === content) {
      chosen = candidate;
      break;
    }
  }

  promptDestinations.set(sourceKey, chosen);
  return chosen;
}

const CARRY = ['description', 'implementation', 'factory', 'documentation'];
const emitted = [];
const pendingPrompts = [];
const gatedOut = [];
let collectionsRead = 0;

for (const pkgName of packageNames) {
  const pkgJsonPath = installedPackageJsonPath(pkgName);
  const pkgDir = dirname(pkgJsonPath);
  const migrationsFile = migrationsFileFor(readJson(pkgJsonPath), pkgDir);
  if (!migrationsFile) continue;
  collectionsRead++;

  const collection = readJson(migrationsFile);
  const migrationsDir = dirname(migrationsFile);
  // `generators` wins over the legacy `schematics`, matching how nx merges a
  // collection it reads back.
  const entries = { ...collection.schematics, ...collection.generators };

  for (const [name, def] of Object.entries(entries)) {
    const version = def.version && cleanSemver(def.version);
    if (!version) {
      console.error(
        `  skip ${pkgName}:${name}: unparseable version "${def.version}"`
      );
      continue;
    }
    if (!(semver.gt(version, from) && semver.lte(version, to))) continue;

    if (!def.implementation && !def.factory && !def.prompt) {
      fail(
        `${pkgName}:${name} has none of implementation, factory or prompt; nx rejects such entries`
      );
    }

    if (!requirementsMet(def.requires)) {
      gatedOut.push(`${pkgName}:${name}`);
      continue;
    }

    const record = { package: pkgName, name, version: def.version };
    for (const k of CARRY) if (def[k] != null) record[k] = def[k];
    if (def.prompt) {
      pendingPrompts.push({
        record,
        pkgName,
        promptRelPath: def.prompt,
        migrationsDir,
      });
    }
    emitted.push(record);
  }
}

// The run phase sorts the list itself, so this only makes the produced file
// deterministic and readable.
emitted.sort((a, b) =>
  semver.compare(cleanSemver(a.version), cleanSemver(b.version))
);

if (args.expect) {
  // Same resolution as nx's `--run-migration`: split on the first colon, or match
  // a bare name when it is unambiguous.
  const separator = args.expect.indexOf(':');
  const matches =
    separator === -1
      ? emitted.filter((m) => m.name === args.expect)
      : emitted.filter(
          (m) =>
            m.package === args.expect.slice(0, separator) &&
            m.name === args.expect.slice(separator + 1)
        );

  if (matches.length === 0) {
    const gateHint = gatedOut.includes(args.expect)
      ? ' Its `requires` gate is unmet in this target.'
      : ` Check that ${from} < its version <= ${to}.`;
    fail(
      `--expect "${args.expect}" is not in the produced list.${gateHint} Nothing was written to ${out}.`
    );
  }
  if (matches.length > 1) {
    fail(
      `--expect "${args.expect}" matched ${matches.length} migrations: ${matches
        .map((m) => `${m.package}:${m.name}`)
        .join(', ')}. Use the full <package>:<name> id.`
    );
  }
}

// Staged only once the list is final, so a failed `--expect` leaves the target clean. These files
// land untracked in a real repo, where `git checkout` would not take them back out.
for (const {
  record,
  pkgName,
  promptRelPath,
  migrationsDir,
} of pendingPrompts) {
  record.prompt = stagePrompt(pkgName, promptRelPath, migrationsDir);
}

writeFileSync(out, JSON.stringify({ migrations: emitted }, null, 2) + '\n');

console.error(
  `produce-migrations-json: ${emitted.length} migration(s) in (${from}, ${to}] from ${collectionsRead} collection(s) -> ${out}`
);
if (writtenPromptFiles.length) {
  console.error(
    `  staged ${writtenPromptFiles.length} prompt file(s) under ${AI_MIGRATIONS_DIR}/`
  );
}
if (gatedOut.length) {
  console.error(
    `  ${gatedOut.length} skipped by an unmet requires gate: ${gatedOut.join(', ')}`
  );
}
if (emitted.length === 0) {
  console.error(
    '  empty list - check --from/--to against the entry versions, and that the local build was delivered'
  );
}
