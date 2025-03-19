import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bench, beforeAll, describe } from 'vitest';

describe('large-incremental-repo', () => {
  const workspaceRoot = join(tmpdir(), 'nx-benchmark-large-incremental-repo');

  beforeAll(() => {
    rmSync(workspaceRoot, { recursive: true, force: true });
    execSync(
      `git clone https://github.com/vsavkin/large-monorepo ${workspaceRoot}`
    );
    execSync('npm i', { cwd: workspaceRoot });
    execSync('npx nx migrate latest', { cwd: workspaceRoot });
    execSync('npx nx migrate --run-migrations --if-exists', {
      cwd: workspaceRoot,
    });
  });

  describe('graph compute', () => {
    describe('cold', () => {
      bench(
        'daemon=false',
        () => {
          execSync('npx nx show projects', {
            cwd: workspaceRoot,
            env: {
              ...process.env,
              NX_DAEMON: 'false',
            },
          });
        },
        {
          setup: () => {
            execSync('npx nx reset', {
              cwd: workspaceRoot,
              env: {
                ...process.env,
                NX_DAEMON: 'false',
              },
            });
          },
        }
      );

      bench(
        'daemon=true',
        () => {
          execSync('npx nx show projects', {
            cwd: workspaceRoot,
            env: {
              ...process.env,
              NX_DAEMON: 'true',
            },
          });
        },
        {
          setup: () => {
            execSync('npx nx reset', {
              cwd: workspaceRoot,
              env: {
                ...process.env,
                NX_DAEMON: 'true',
              },
            });
          },
        }
      );
    });

    describe('warm', () => {
      /**
       * Warms up the graph cache and daemon
       */
      beforeAll(() => {
        execSync('npx nx show projects', {
          cwd: workspaceRoot,
          env: {
            ...process.env,
            NX_DAEMON: 'false',
          },
        });
        execSync('npx nx show projects', {
          cwd: workspaceRoot,
          env: {
            ...process.env,
            NX_DAEMON: 'true',
          },
        });
      }, 60_000); // 1 minute

      bench('daemon=false', () => {
        execSync('npx nx show projects', {
          cwd: workspaceRoot,
          env: {
            ...process.env,
            NX_DAEMON: 'false',
          },
        });
      });

      bench('daemon=true', () => {
        execSync('npx nx show projects', {
          cwd: workspaceRoot,
          env: {
            ...process.env,
            NX_DAEMON: 'true',
          },
        });
      });
    });
  });
});
