// macOS coverage check for the preload (DYLD_INSERT_LIBRARIES) backend. Each case runs as
// its own traced spawn so a SIP strip in one case cannot hide another.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const { traceSpawn } = createRequire(import.meta.url)('./fstrace.node');
const shimPath = path.join(here, 'target/release/libfstrace_shim.dylib');
const d = (n) => path.join(here, 'fixtures/data', `${n}.txt`);
const node = process.execPath;
const js = (code) => [node, ['-e', code]];

const cases = {
  'dyn C (clang)': ['bin/openloop', [d('dyn'), '1'], 'dyn'],
  'Go binary': ['bin/readfile-go', [d('go')], 'go'],
  'node sync fs': [
    ...js(`require('fs').readFileSync(${JSON.stringify(d('node-sync'))})`),
    'node-sync',
  ],
  'node async fs': [
    ...js(
      `require('fs').promises.readFile(${JSON.stringify(d('node-async'))})`
    ),
    'node-async',
  ],
  'node -> spawn node (no shell)': [
    ...js(
      `require('child_process').execFileSync(process.execPath, ['-e', "require('fs').readFileSync(${JSON.stringify(JSON.stringify(d('node-child'))).slice(1, -1)})"])`
    ),
    'node-child',
  ],
  'node -> execSync node (via /bin/sh)': [
    ...js(
      `require('child_process').execSync(process.execPath + ' -e "require(\\'fs\\').readFileSync(\\'${d('node-shell')}\\')"')`
    ),
    'node-shell',
  ],
  'node -> execFile /bin/cat': [
    ...js(
      `require('child_process').execFileSync('/bin/cat', [${JSON.stringify(d('node-execfile'))}])`
    ),
    'node-execfile',
  ],
  '/bin/sh -c cat': [
    '/bin/sh',
    ['-c', `cat ${d('sh-cat')} >/dev/null`],
    'sh-cat',
  ],
  '/bin/sh -> sh -> cat': [
    '/bin/sh',
    ['-c', `sh -c "cat ${d('child-of-child')} >/dev/null"`],
    'child-of-child',
  ],
  'python3 (python.org framework)': [
    '/usr/local/bin/python3',
    ['-c', `open(${JSON.stringify(d('py'))}).read()`],
    'py',
  ],
  'python3 (/usr/bin, SIP)': [
    '/usr/bin/python3',
    ['-c', `open(${JSON.stringify(d('py-sip'))}).read()`],
    'py-sip',
  ],
};

const rows = {};
for (const [name, [cmd, args, file]] of Object.entries(cases)) {
  const r = await traceSpawn(cmd, args, {
    backend: 'preload',
    shimPath,
    cwd: here,
  });
  const reads = new Set(r.reads);
  rows[name] = {
    exit: r.exitCode,
    seen: reads.has(d(file)),
    events: r.events,
    unique: r.reads.length,
  };
}
console.table(rows);
