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
  let originalEnv: string;

  beforeAll(() => {
    originalEnv = process.env.NX_ADD_PLUGINS;
    process.env.NX_ADD_PLUGINS = 'false';
    newProject({
      name: uniq('fileserver'),
      packages: ['@nx/web', '@nx/react', '@nx/angular'],
    });
  });

  afterAll(() => {
    process.env.NX_ADD_PLUGINS = originalEnv;
    cleanupProject();
  });

  it('should serve folder of files', async () => {
    const appName = uniq('app');
    const port = 4301;

    runCLI(`generate @nx/web:app ${appName} --no-interactive`);
    updateJson(join('apps', appName, 'project.json'), (config) => {
      config.targets['serve'].executor = '@nx/web:file-server';
      // Check that buildTarget can exclude project name (e.g. build vs proj:build).
      config.targets['serve'].options.buildTarget = 'build';
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

    runCLI(`generate @nx/web:app ${appName} --no-interactive`);
    // Used to copy index.html rather than the normal webpack build.
    updateFile(
      `copy-index.js`,
      `
      const fs = require('node:fs');
      const path = require('node:path');
      fs.mkdirSync(path.join(__dirname, 'dist/foobar'), { recursive: true });
      fs.copyFileSync(
        path.join(__dirname, 'apps/${appName}/src/index.html'),
        path.join(__dirname, 'dist/foobar/index.html')
      );
    `
    );
    updateJson(join('apps', appName, 'project.json'), (config) => {
      // Point to same path as output.path in webpack config.
      config.targets['build'] = {
        command: `node copy-index.js`,
        outputs: [`{workspaceRoot}/dist/foobar`],
      };
      config.targets['serve'].executor = '@nx/web:file-server';
      // Check that buildTarget can exclude project name (e.g. build vs proj:build).
      config.targets['serve'].options.buildTarget = 'build';
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

  it('should setup and serve static files from app', async () => {
    const ngAppName = uniq('ng-app');
    const reactAppName = uniq('react-app');

    runCLI(
      `generate @nx/angular:app ${ngAppName} --no-interactive --e2eTestRunner=none`
    );
    runCLI(
      `generate @nx/react:app ${reactAppName} --no-interactive --e2eTestRunner=none`
    );
    runCLI(
      `generate @nx/web:static-config --buildTarget=${ngAppName}:build --no-interactive`
    );
    runCLI(
      `generate @nx/web:static-config --buildTarget=${reactAppName}:build --targetName=custom-serve-static --no-interactive`
    );

    const port = 6200;

    const ngServe = await runCommandUntil(
      `serve-static ${ngAppName} --port=${port}`,
      (output) => {
        return output.indexOf(`localhost:${port}`) > -1;
      }
    );

    try {
      await promisifiedTreeKill(ngServe.pid, 'SIGKILL');
      await killPorts(port);
    } catch {
      // ignore
    }

    const reactServe = await runCommandUntil(
      `custom-serve-static ${reactAppName} --port=${port + 1}`,
      (output) => {
        return output.indexOf(`localhost:${port + 1}`) > -1;
      }
    );

    try {
      await promisifiedTreeKill(reactServe.pid, 'SIGKILL');
      await killPorts(port + 1);
    } catch {
      // ignore
    }
  }, 300_000);
});
