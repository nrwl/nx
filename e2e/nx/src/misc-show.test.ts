import type { ProjectConfiguration } from '@nx/devkit';
import {
  cleanupProject,
  killProcessAndPorts,
  runCLI,
  runCommandUntil,
  uniq,
} from '@nx/e2e-utils';
import { setupMiscTests } from './misc-setup';

describe('Nx Commands - show', () => {
  beforeAll(() => setupMiscTests());

  afterAll(() => cleanupProject());

  it('should show the list of projects', async () => {
    const app1 = uniq('myapp');
    const app2 = uniq('myapp');
    expect(
      runCLI('show projects').replace(/.*nx show projects( --verbose)?\n/, '')
    ).toEqual('');

    runCLI(`generate @nx/web:app apps/${app1} --tags e2etag`);
    runCLI(`generate @nx/web:app apps/${app2}`);

    const s = runCLI('show projects').split('\n');

    expect(s.length).toEqual(5);
    expect(s).toContain(app1);
    expect(s).toContain(app2);
    expect(s).toContain(`${app1}-e2e`);
    expect(s).toContain(`${app2}-e2e`);

    const withTag = JSON.parse(runCLI('show projects -p tag:e2etag --json'));
    expect(withTag).toEqual([app1]);

    const withTargets = JSON.parse(
      runCLI('show projects --with-target e2e --json')
    );
    expect(withTargets).toEqual(
      expect.arrayContaining([`${app1}-e2e`, `${app2}-e2e`])
    );
    expect(withTargets.length).toEqual(2);
  });

  it('should show detailed project info', () => {
    const app = uniq('myapp');
    runCLI(
      `generate @nx/web:app apps/${app} --bundler=webpack --unitTestRunner=vitest --linter=eslint`
    );
    const project: ProjectConfiguration = JSON.parse(
      runCLI(`show project ${app} --json`)
    );
    expect(project.targets.build).toBeDefined();
    expect(project.targets.lint).toBeDefined();
  });

  it('should open project details view', async () => {
    const app = uniq('myapp');
    runCLI(`generate @nx/web:app apps/${app}`);
    let url: string;
    let port: number;
    const childProcess = await runCommandUntil(
      `show project ${app} --web --open=false`,
      (output) => {
        console.log(output);
        // output should contain 'Project graph started at http://127.0.0.1:{port}'
        if (output.includes('Project graph started at http://')) {
          const match = /https?:\/\/[\d.]+:(?<port>\d+)/.exec(output);
          if (match) {
            port = parseInt(match.groups.port);
            url = match[0];
            return true;
          }
        }
        return false;
      }
    );
    // Check that url is alive
    const response = await fetch(url);
    expect(response.status).toEqual(200);
    await killProcessAndPorts(childProcess.pid, port);
  }, 700000);

  it('should find alternative port when default port is occupied', async () => {
    const app = uniq('myapp');
    runCLI(`generate @nx/web:app apps/${app}`);

    const http = require('http');

    // Create a server that occupies the default port 4211
    const blockingServer = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('blocking server');
    });

    await new Promise<void>((resolve) => {
      blockingServer.listen(4211, '127.0.0.1', () => {
        console.log('Blocking server started on port 4211');
        resolve();
      });
    });

    let url: string;
    let port: number;
    let foundAlternativePort = false;

    try {
      const childProcess = await runCommandUntil(
        `show project ${app} --web --open=false`,
        (output) => {
          console.log(output);
          // Should find alternative port and show message about port being in use
          if (output.includes('Port 4211 was already in use, using port')) {
            foundAlternativePort = true;
          }
          // output should contain 'Project graph started at http://127.0.0.1:{port}'
          if (output.includes('Project graph started at http://')) {
            const match = /https?:\/\/[\d.]+:(?<port>\d+)/.exec(output);
            if (match) {
              port = parseInt(match.groups.port);
              url = match[0];
              return true;
            }
          }
          return false;
        }
      );

      // Verify that an alternative port was found
      expect(foundAlternativePort).toBe(true);
      expect(port).not.toBe(4211);
      expect(port).toBeGreaterThan(4211);

      // Check that url is alive
      const response = await fetch(url);
      expect(response.status).toEqual(200);

      await killProcessAndPorts(childProcess.pid, port);
    } finally {
      // Clean up the blocking server
      blockingServer.close();
    }
  }, 700000);
});
