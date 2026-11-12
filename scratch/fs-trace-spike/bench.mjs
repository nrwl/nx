// Wall-clock overhead per backend. `strace` (ptrace) is included only as a yardstick.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const { traceSpawn } = createRequire(import.meta.url)('./fstrace.node');
const shimPath = path.join(
  here,
  '../../packages/nx/src/native/fstrace.linux.so'
);
const src = path.resolve(here, '../../packages/nx/src');
const RUNS = Number(process.env.RUNS ?? 5);

const workloads = {
  '200k open()+close() in a loop': `bin/openloop /etc/hostname 200000`,
  'grep -r over packages/nx/src': `grep -rc import ${src}`,
  'node: readFileSync every file in packages/nx/src': `node fixtures/readall.js ${src}`,
  '500 short-lived processes (exec-heavy)': `i=0; while [ $i -lt 500 ]; do /bin/true; i=$((i+1)); done`,
  'go build -a (compiler-style, multi-process)': `cd fixtures && CGO_ENABLED=0 go build -a -o /dev/null readfile.go`,
};

async function time(cmd, backend) {
  const wrapped =
    backend === 'strace'
      ? `strace -f -qq -e trace=open,openat,openat2,execve -o /dev/null sh -c '${cmd}'`
      : cmd;
  const samples = [];
  let last;
  for (let i = 0; i < RUNS; i++) {
    const t = process.hrtime.bigint();
    last = await traceSpawn('/bin/sh', ['-c', `${wrapped} >/dev/null 2>&1`], {
      backend: backend === 'strace' ? 'none' : backend,
      shimPath,
      cwd: here,
    });
    samples.push(Number(process.hrtime.bigint() - t) / 1e6);
    if (last.exitCode !== 0)
      throw new Error(`${cmd} [${backend}] exited ${last.exitCode}`);
  }
  samples.sort((a, b) => a - b);
  return { ms: samples[RUNS >> 1], events: last.events };
}

for (const [name, cmd] of Object.entries(workloads)) {
  const base = await time(cmd, 'none');
  const row = { none: `${base.ms.toFixed(0)} ms` };
  for (const backend of ['preload', 'seccomp', 'hybrid', 'strace']) {
    const r = await time(cmd, backend);
    const pct = ((r.ms / base.ms - 1) * 100).toFixed(1);
    row[backend] =
      `${r.ms.toFixed(0)} ms (+${pct}%)` + (r.events ? ` ${r.events} ev` : '');
  }
  console.log(name);
  console.table([row]);
}
