// Compare two native builds against exactly the same file tree and patterns:
// node scripts/bench-native-hash-inventory.mjs before.node after.node [fixture.json]
// Optional fixture: { workspaceRoot, groups: string[][], sourceFiles?: FileData[],
//                     projectRoots?: string[], iterations?: number }.
// It is read-only; only the default synthetic fixture is created and removed.
// Both builds should use the same compiler, profile and dependencies.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])])
    );
  }
  return value;
}

function measure(binding, fixture) {
  const native = require(resolve(binding));
  const iterations = fixture.iterations ?? 6;
  assert(
    Number.isInteger(iterations) && iterations >= 2,
    'Use at least two iterations'
  );
  const nodes = {};
  const projectDependencies = {};
  const tasks = {};
  const dependencies = {};
  for (const [i, root] of (fixture.projectRoots ?? []).entries()) {
    const name = `scope${i}`;
    nodes[name] = { root, targets: {} };
    projectDependencies[name] = [];
  }
  fixture.groups.forEach((patterns, i) => {
    const name = `p${i}`;
    const id = `${name}:build`;
    nodes[name] = {
      root: `projects/${name}`,
      targets: {
        build: {
          executor: 'nx:run-commands',
          inputs: patterns.map((pattern) => ({
            fileset: `${pattern.startsWith('!') ? '!' : ''}{workspaceRoot}/${pattern.replace(/^!/, '')}`,
            includeIgnored: true,
          })),
        },
      },
    };
    projectDependencies[name] = [];
    tasks[id] = {
      id,
      target: { project: name, target: 'build' },
      projectRoot: nodes[name].root,
      outputs: [],
      overrides: {},
      cache: true,
    };
    dependencies[id] = [];
  });
  const ids = Object.keys(tasks);
  const graph = native.transferProjectGraph({
    nodes,
    dependencies: projectDependencies,
    externalNodes: {},
  });
  const files = native.testOnlyTransferFileMap({}, fixture.sourceFiles ?? []);
  const planner = new native.HashPlanner({}, graph);
  const hasher = new native.TaskHasher(
    fixture.workspaceRoot,
    graph,
    files.projectFiles,
    files.allWorkspaceFiles,
    Buffer.from('{}'),
    {},
    undefined,
    { selectivelyHashTsConfig: false },
    files.ignoredIndex
  );
  const plans = planner.getPlansReference(ids, {
    roots: ids,
    tasks,
    dependencies,
    continuousDependencies: {},
  });
  const envs = Object.fromEntries(ids.map((id) => [id, {}]));
  const run = (collect) =>
    hasher.hashPlans(plans, envs, fixture.workspaceRoot, collect);
  const times = {};
  const fingerprints = {};
  let inputCount;
  for (const collect of [false, true]) {
    const durations = [];
    for (let iteration = 0; iteration < iterations; iteration++) {
      const start = performance.now();
      const result = run(collect);
      durations.push(performance.now() - start);
      const fingerprint = createHash('sha256')
        .update(JSON.stringify(canonical(result)))
        .digest('hex');
      if (iteration)
        assert.equal(
          fingerprint,
          fingerprints[collect],
          'reused plans changed results'
        );
      fingerprints[collect] = fingerprint;
      if (collect)
        inputCount = Object.values(result).reduce(
          (sum, r) => sum + r.inputs.files.length,
          0
        );
    }
    times[collect ? 'withInputs' : 'hashOnly'] = {
      firstMs: durations[0],
      reusedMs: durations.slice(1),
      medianMs: durations.slice(1).sort((a, b) => a - b)[
        Math.floor((iterations - 1) / 2)
      ],
    };
  }
  return {
    tasks: ids.length,
    patterns: fixture.groups.reduce((count, group) => count + group.length, 0),
    negativePatterns: fixture.groups.flat().filter((p) => p.startsWith('!'))
      .length,
    sourceFiles: fixture.sourceFiles?.length ?? 0,
    inputCount,
    fingerprints,
    times,
  };
}

if (process.argv[2] === '--worker') {
  const fixture = JSON.parse(readFileSync(process.argv[4], 'utf8'));
  console.log(JSON.stringify(measure(process.argv[3], fixture)));
} else {
  const [before, after, suppliedFixture] = process.argv.slice(2);
  assert(before && after, 'Provide before.node and after.node paths');
  let temporary;
  try {
    let fixturePath = suppliedFixture;
    if (!fixturePath) {
      mkdirSync('tmp', { recursive: true });
      temporary = mkdtempSync(resolve('tmp/native-hash-bench-'));
      const workspaceRoot = join(temporary, 'workspace');
      const sourceFiles = [];
      const old = new Date(Date.now() - 60_000);
      const write = (file, content) => {
        const path = join(workspaceRoot, file);
        mkdirSync(resolve(path, '..'), { recursive: true });
        writeFileSync(path, content);
        utimesSync(path, old, old);
      };
      write('.gitignore', 'generated/\n');
      for (let dir = 0; dir < 128; dir++) {
        for (let file = 0; file < 64; file++) {
          write(
            `generated/group-${dir}/${file}.${file === 0 ? 'selected' : 'js'}`,
            `${dir}:${file}`
          );
        }
        const file = `src/${dir}.ts`;
        write(file, `source ${dir}`);
        sourceFiles.push({ file, hash: `source-snapshot-${dir}` });
      }
      const groups = Array.from({ length: 100 }, (_, i) => [
        'generated/**/*.selected',
        'src/**',
        `!generated/group-${i}/**`,
      ]);
      fixturePath = join(temporary, 'fixture.json');
      writeFileSync(
        fixturePath,
        JSON.stringify({ workspaceRoot, groups, sourceFiles })
      );
    }
    const execute = (binding) => {
      const child = spawnSync(
        process.execPath,
        [
          fileURLToPath(import.meta.url),
          '--worker',
          resolve(binding),
          resolve(fixturePath),
        ],
        { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
      );
      if (child.status !== 0) throw new Error(child.stderr || child.stdout);
      return JSON.parse(child.stdout);
    };
    const baseline = execute(before);
    const candidate = execute(after);
    assert.deepEqual(
      candidate.fingerprints,
      baseline.fingerprints,
      'hash/details/ordered inputs differ'
    );
    console.log(JSON.stringify({ parity: true, baseline, candidate }, null, 2));
  } finally {
    if (temporary) rmSync(temporary, { recursive: true, force: true });
  }
}
