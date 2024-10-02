import {
  cleanupProject,
  killPorts,
  newProject,
  promisifiedTreeKill,
  runCLI,
  runCommandUntil,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';
import { join } from 'path';

describe('file-server', () => {
  beforeAll(() => {
    newProject({ name: uniq('fileserver') });
  });

  afterAll(() => cleanupProject());

  it('should serve folder of files', async () => {
    const appName = uniq('app');
    const port = 4301;

    runCLI(`generate @nx/web:app apps/${appName} --no-interactive`);
    updateJson(join('apps', appName, 'project.json'), (config) => {
      config.targets['serve'] = {
        executor: '@nx/web:file-server',
        options: {
          buildTarget: 'build',
        },
      };
      return config;
    });

    const p = await runCommandUntil(
      `serve ${appName} --port=${port}`,
      (output) => {
        return output.indexOf(`localhost:${port}`) > -1;
      }
    );

    try {
      await promisifiedTreeKill(p.pid, 'SIGKILL');
      await killPorts(port);
    } catch {
      // ignore
    }
  }, 300_000);

  it('should read from directory from outputs if outputPath is not specified', async () => {
    const appName = uniq('app');
    const port = 4301;

    runCLI(`generate @nx/web:app apps/${appName} --no-interactive`);
    // Used to copy index.html rather than the normal webpack build.
    updateFile(
      `apps/${appName}/copy-index.js`,
      `
      const fs = require('node:fs');
      const path = require('node:path');
      fs.mkdirSync(path.join(__dirname, '../../dist/foobar'), { recursive: true });
      fs.copyFileSync(
        path.join(__dirname, './src/index.html'),
        path.join(__dirname, '../../dist/foobar/index.html')
      );
    `
    );
    updateJson(join('apps', appName, 'project.json'), (config) => {
      // Point to same path as output.path in webpack config.
      config.targets['build'] = {
        command: `node copy-index.js`,
        outputs: [`{workspaceRoot}/dist/foobar`],
        options: {
          cwd: '{projectRoot}',
        },
      };
      config.targets['serve'] = {
        executor: '@nx/web:file-server',
        options: {
          buildTarget: 'build',
        },
      };
      return config;
    });

    const p = await runCommandUntil(
      `serve ${appName} --port=${port}`,
      (output) => {
        return (
          output.indexOf(`localhost:${port}`) > -1 &&
          output.indexOf(`dist/foobar`) > -1
        );
      }
    );

    try {
      await promisifiedTreeKill(p.pid, 'SIGKILL');
      await killPorts(port);
    } catch {
      // ignore
    }
  }, 300_000);
});
