// Preload overhead on macOS, wall clock, median of RUNS.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const { traceSpawn } = createRequire(import.meta.url)('./fstrace.node');
const shimPath = path.join(here, 'target/release/libfstrace_shim.dylib');
const src = path.resolve(here, '../../packages/nx/src');
const RUNS = Number(process.env.RUNS ?? 7);
const workloads = {
  '200k open()+close()': ['bin/openloop', ['/etc/hosts', '200000']],
  'node readFileSync packages/nx/src': [
    process.execPath,
    ['fixtures/readall.js', src],
  ],
  'node startup (empty script)': [process.execPath, ['-e', '0']],
  'Go build-free read x1': [
    'bin/readfile-go',
    [path.join(here, 'fixtures/data/go.txt')],
  ],
};
async function time(cmd, args, backend) {
  const s = [];
  let last;
  for (let i = 0; i < RUNS; i++) {
    const t = process.hrtime.bigint();
    last = await traceSpawn(cmd, args, { backend, shimPath, cwd: here });
    s.push(Number(process.hrtime.bigint() - t) / 1e6);
  }
  s.sort((a, b) => a - b);
  return { ms: s[RUNS >> 1], events: last.events };
}
const rows = {};
for (const [name, [cmd, args]] of Object.entries(workloads)) {
  const base = await time(cmd, args, 'none');
  const pre = await time(cmd, args, 'preload');
  rows[name] = {
    none: `${base.ms.toFixed(1)} ms`,
    preload: `${pre.ms.toFixed(1)} ms`,
    overhead: `${((pre.ms / base.ms - 1) * 100).toFixed(0)}%`,
    events: pre.events,
  };
}
console.table(rows);
