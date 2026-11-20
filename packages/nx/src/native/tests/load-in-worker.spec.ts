import { spawnSync } from 'child_process';
import { join } from 'path';

describe('native index', () => {
  it('lets the process exit cleanly after loading only inside exiting workers', () => {
    const workerSource = `require(${JSON.stringify(
      join(__dirname, '../index.js')
    )})`;

    const result = spawnSync(
      process.execPath,
      [
        '--require',
        'ts-node/register',
        '-e',
        `
        const { Worker } = require('node:worker_threads');
        (async () => {
          for (let i = 0; i < 10; i++) {
            await new Promise((resolve, reject) => {
              const w = new Worker(${JSON.stringify(workerSource)}, { eval: true });
              w.on('exit', resolve);
              w.on('error', reject);
            });
          }
        })();
        `,
      ],
      {
        encoding: 'utf-8',
        windowsHide: true,
        env: {
          ...process.env,
          NX_SKIP_NATIVE_FILE_CACHE: 'true',
          TS_NODE_SKIP_PROJECT: 'true',
          TS_NODE_TRANSPILE_ONLY: 'true',
          TS_NODE_COMPILER_OPTIONS: JSON.stringify({
            module: 'commonjs',
            ignoreDeprecations: '6.0',
          }),
        },
      }
    );

    expect(result.stderr).toBe('');
    expect(result.signal).toBeNull();
    expect(result.status).toBe(0);
  });
});
