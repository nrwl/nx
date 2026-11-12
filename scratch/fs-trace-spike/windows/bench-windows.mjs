// Overhead on Windows, wall clock, median of RUNS.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
// Built by scripts/build-fstrace-shim.mjs. Point FSTRACE_BIN at a copy when running
// from outside the repo.
const tracer = path.join(
  process.env.FSTRACE_BIN ??
    path.resolve(here, '../../../packages/nx/src/native'),
  `fstrace-${process.arch}.exe`
);
const RUNS = Number(process.env.RUNS ?? 7);
const node = `"${process.execPath}"`;
const log = path.join(here, 'bench.log');
const workloads = {
  '200k CreateFile+CloseHandle': `openloop-arm64.exe ${path.join(here, 'bench-windows.mjs')} 200000`,
  'node readFileSync packages/nx/src': `${node} readall.js ${path.join(here, 'src')}`,
  'node startup (empty script)': `${node} -e 0`,
  '50 short-lived processes (cmd loop)': `cmd /c "for /l %i in (1,1,50) do @openloop-arm64.exe bench-windows.mjs 1"`,
};
function time(mode, cmdline) {
  const s = [];
  let events = 0;
  for (let i = 0; i < RUNS; i++) {
    const t = process.hrtime.bigint();
    const r = spawnSync(tracer, [mode, log, cmdline], {
      cwd: here,
      stdio: 'ignore',
    });
    s.push(Number(process.hrtime.bigint() - t) / 1e6);
    if (r.status !== 0)
      throw new Error(`${cmdline} [${mode}] exited ${r.status}`);
  }
  if (mode === 'trace')
    events = spawnSync('cmd', ['/c', 'find', '/c', '/v', '""', log], {
      encoding: 'utf8',
    })
      .stdout.trim()
      .split(' ')
      .pop();
  s.sort((a, b) => a - b);
  return { ms: s[RUNS >> 1], events };
}
const rows = {};
for (const [name, cmd] of Object.entries(workloads)) {
  const base = time('none', cmd);
  const tr = time('trace', cmd);
  rows[name] = {
    none: `${base.ms.toFixed(1)} ms`,
    trace: `${tr.ms.toFixed(1)} ms`,
    overhead: `${((tr.ms / base.ms - 1) * 100).toFixed(0)}%`,
    events: tr.events,
  };
}
console.table(rows);
