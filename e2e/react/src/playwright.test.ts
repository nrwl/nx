import {
  createFile,
  fileExists,
  readFile,
  reservePort,
  runCLI,
  runE2ETests,
  cleanupProject,
  newProject,
  removeFile,
  tmpProjPath,
  uniq,
  updateFile,
} from '@nx/e2e-utils';

describe('React Playwright e2e tests', () => {
  let projectName;
  const appName = uniq('pw-react-app');
  const usedInAppLibName = uniq('pw-react-lib');

  beforeAll(async () => {
    projectName = newProject({
      name: uniq('pw-react'),
      packages: ['@nx/react', '@nx/vite', '@nx/playwright'],
    });
    runCLI(
      `generate @nx/react:app ${appName} --e2eTestRunner=playwright --bundler=vite --no-interactive`
    );
  });

  afterAll(() => cleanupProject());

  it('resolves the task dotenv env when baking the web server readiness gate', () => {
    const e2eProject = `${appName}-e2e`;
    const configPath = `${e2eProject}/playwright.config.mts`;
    const gateAddress = 'http://localhost:4301';

    // Write .env before editing the config: both writes trigger a graph
    // recompute, and this order guarantees the recompute the assertion reads
    // has seen the dotenv file regardless of how the watcher batches them.
    createFile(`${e2eProject}/.env`, `BASE_URL=${gateAddress}\n`);
    let originalConfig = '';
    updateFile(configPath, (content) => {
      originalConfig = content;
      return content.replace(/url: 'http:\/\/[^']*'/, 'url: baseURL');
    });

    try {
      const project = JSON.parse(runCLI(`show project ${e2eProject} --json`));
      const gateTarget = Object.keys(project.targets).find((t) =>
        t.endsWith('--wait-for-webserver')
      );
      expect(gateTarget).toBeDefined();
      expect(project.targets[gateTarget].options.servers[0].url).toBe(
        gateAddress
      );
    } finally {
      updateFile(configPath, originalConfig);
      removeFile(`${e2eProject}/.env`);
    }
  });

  it('re-resolves the readiness gate when the ambient env changes between runs', () => {
    const e2eProject = `${appName}-e2e`;
    const configPath = `${e2eProject}/playwright.config.mts`;

    let originalConfig = '';
    updateFile(configPath, (content) => {
      originalConfig = content;
      return content.replace(/url: 'http:\/\/[^']*'/, 'url: baseURL');
    });

    try {
      const showGateUrl = (env: Record<string, string>) => {
        const project = JSON.parse(
          runCLI(`show project ${e2eProject} --json`, { env })
        );
        const gateTarget = Object.keys(project.targets).find((t) =>
          t.endsWith('--wait-for-webserver')
        );
        expect(gateTarget).toBeDefined();
        return project.targets[gateTarget].options.servers[0].url;
      };

      // Sequential daemon clients with different ambient env: the second run
      // must not be served the first run's cached gate.
      expect(showGateUrl({ BASE_URL: 'http://localhost:4301' })).toBe(
        'http://localhost:4301'
      );
      expect(showGateUrl({ BASE_URL: 'http://localhost:4302' })).toBe(
        'http://localhost:4302'
      );
    } finally {
      updateFile(configPath, originalConfig);
    }
  });

  it('should execute e2e tests using playwright', async () => {
    if (await runE2ETests()) {
      const result = runCLI(`e2e ${appName}-e2e --verbose`);
      expect(result).toContain(
        `Successfully ran target e2e for project ${appName}-e2e`
      );
    }
  });

  it('lets Playwright reuse the server the readiness gate waited for instead of starting its own', async () => {
    if (!(await runE2ETests('playwright'))) {
      return;
    }
    const e2eProject = `${appName}-e2e`;
    const port = await reservePort();
    const [, serveTarget] =
      readFile(`${e2eProject}/playwright.config.mts`).match(
        new RegExp(`nx run ${appName}:(\\S+)'`)
      ) ?? [];
    expect(serveTarget).toBeDefined();
    let originalConfig = '';
    updateFile(`${e2eProject}/playwright.config.mts`, (content) => {
      originalConfig = content;
      return content.replace(
        /url: 'http:\/\/[^']*'/,
        `url: 'http://localhost:${port}'`
      );
    });
    // Delay the server so Playwright's own probe surely misses when nothing
    // waited for the server first; the argument would break command inference
    // on the webServer command, so it goes on the target instead. A different
    // command replaces the inferred target rather than merging into it, so
    // the target is spelled out.
    const projectConfig = fileExists(tmpProjPath(`${appName}/project.json`))
      ? `${appName}/project.json`
      : `${appName}/package.json`;
    let originalProjectConfig = '';
    updateFile(projectConfig, (content) => {
      originalProjectConfig = content;
      const json = JSON.parse(content);
      const targets = projectConfig.endsWith('package.json')
        ? ((json.nx ??= {}).targets ??= {})
        : (json.targets ??= {});
      targets[serveTarget] = {
        command: `node -e "setTimeout(() => {}, 5000)" && vite preview --port ${port}`,
        options: { cwd: appName },
        continuous: true,
      };
      return JSON.stringify(json, null, 2);
    });
    // Both the Playwright config and the target must be updated before Nx
    // infers the readiness gate. Reset the daemon to discard the old 4300
    // address that may still be cached from project generation.
    runCLI('reset');

    try {
      // Playwright logs which of the two it did under this debug scope. The
      // atomized target is refused without Nx Cloud unless told otherwise.
      for (const target of ['e2e', 'e2e-ci']) {
        const result = runCLI(`run ${e2eProject}:${target}`, {
          env: { DEBUG: 'pw:webserver', NX_SKIP_ATOMIZER_VALIDATION: 'true' },
          redirectStderr: true,
        });
        expect(result).toContain('WebServer is already available');
        expect(result).not.toContain('Starting WebServer process');
      }
    } finally {
      updateFile(projectConfig, originalProjectConfig);
      updateFile(`${e2eProject}/playwright.config.mts`, originalConfig);
    }
  });

  it('should execute e2e tests using playwright with a library used in the app', async () => {
    runCLI(
      `generate @nx/js:library ${usedInAppLibName} --unitTestRunner=none --importPath=@mylib --no-interactive`
    );

    updateFile(
      `${appName}-e2e/src/example.spec.ts`,
      `
    import { test, expect } from '@playwright/test';
    import * as mylib from '@mylib'

    test('has title', async ({ page }) => {
      await page.goto('/');

      // Expect h1 to contain a substring.
      expect(await page.locator('h1').innerText()).toContain('Welcome');
    });
    `
    );

    if (await runE2ETests()) {
      const result = runCLI(`e2e ${appName}-e2e --verbose`);
      expect(result).toContain(
        `Successfully ran target e2e for project ${appName}-e2e`
      );
    }
  });
});
