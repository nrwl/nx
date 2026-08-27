// Preloaded into every node process an e2e command spawns (NODE_OPTIONS
// --require, see timeout-diagnostics.ts). On SIGUSR2 it writes whatever keeps
// this process's event loop alive to $NX_E2E_HANDLE_DUMP_DIR/<pid>.txt, so a
// task child that finished its work but never exited can name its culprit.
// Writes to a file, not stdio: by the time it is signalled the parent's pipe
// is usually gone.
const { writeFileSync } = require('fs');
const { join } = require('path');
const { inspect } = require('util');

const dir = process.env.NX_E2E_HANDLE_DUMP_DIR;
if (dir) {
  process.on('SIGUSR2', () => {
    const counts = {};
    for (const type of process.getActiveResourcesInfo()) {
      counts[type] = (counts[type] ?? 0) + 1;
    }
    const lines = [
      `pid=${process.pid} argv=${process.argv.join(' ')}`,
      `cwd=${process.cwd()}`,
      `active resources: ${inspect(counts)}`,
      'active handles:',
      ...process
        ._getActiveHandles()
        .map((h) => '  ' + inspect(h, { depth: 1, breakLength: 200 })),
      'active requests:',
      ...process
        ._getActiveRequests()
        .map((r) => '  ' + inspect(r, { depth: 1, breakLength: 200 })),
    ];
    try {
      writeFileSync(join(dir, `${process.pid}.txt`), lines.join('\n') + '\n');
    } catch {
      // nothing left to report to; the parent reads the file or nothing.
    }
  });
}
