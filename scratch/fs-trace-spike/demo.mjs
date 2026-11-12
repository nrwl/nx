// Coverage check: which backend sees which kind of reader?
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const { traceSpawn } = createRequire(import.meta.url)('./fstrace.node');
const shimPath = path.join(here, 'target/release/libfstrace_shim.so');
const d = (n) => path.join(here, 'fixtures/data', `${n}.txt`);

const script = `
  set -e
  bin/openloop ${d('dyn')} 1
  bin/openloop-static ${d('static')} 1
  bin/readfile-go ${d('go')}
  node -e "require('fs').readFileSync('fixtures/data/node-sync.txt')"
  node -e "require('fs').promises.readFile('fixtures/data/node-async.txt').then(()=>{})"
  cat fixtures/data/sh-cat.txt > /dev/null
  sh -c 'sh -c "cd fixtures && cat ./data/../data/child-of-child.txt >/dev/null"'
  python3 -c "open('fixtures/data/py.txt').read()"
  echo written > /tmp/fstrace-write-only.txt
`;
const cases = [
  'dyn',
  'static',
  'go',
  'node-sync',
  'node-async',
  'sh-cat',
  'child-of-child',
  'py',
];
const rows = {};
for (const backend of ['preload', 'seccomp', 'hybrid']) {
  const r = await traceSpawn('/bin/sh', ['-c', script], {
    backend,
    shimPath,
    cwd: here,
  });
  if (r.exitCode !== 0) throw new Error(`${backend} exited ${r.exitCode}`);
  const set = new Set(r.reads);
  for (const c of cases) (rows[c] ??= {})[backend] = set.has(d(c));
  (rows['(write-only file reported?)'] ??= {})[backend] = set.has(
    '/tmp/fstrace-write-only.txt'
  );
  (rows['(events / unique paths)'] ??= {})[backend] =
    `${r.events} / ${r.reads.length}`;
}
console.table(rows);
