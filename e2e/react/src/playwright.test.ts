import {
  fileExists,
  killPorts,
  readFile,
  reservePort,
  runCLI,
  cleanupProject,
  newProject,
  tmpProjPath,
  uniq,
  updateFile,
  shouldRunPlaywrightTests,
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

  it('should execute e2e tests using playwright', async () => {
    if (await shouldRunPlaywrightTests()) {
      const result = runCLI(`e2e ${appName}-e2e --verbose`);
      expect(result).toContain(
        `Successfully ran target e2e for project ${appName}-e2e`
      );
    }
  });

  it('should run e2e tests against the local web server when CI is not set', async () => {
    if (!(await shouldRunPlaywrightTests())) {
      return;
    }
    const e2eProject = `${appName}-e2e`;
    const configPath = `${e2eProject}/playwright.config.mts`;
    const viteConfigPath = `${appName}/vite.config.mts`;
    const [, ciServerTarget, localServerTarget] =
      readFile(configPath).match(
        new RegExp(
          `isCI\\s*\\?\\s*'[^']* nx run ${appName}:([^']+)'\\s*:\\s*'[^']* nx run ${appName}:([^']+)'`
        )
      ) ?? [];
    expect(localServerTarget).toBeDefined();
    const port = await reservePort();
    let originalConfig = '';
    updateFile(configPath, (content) => {
      originalConfig = content;
      return content.replace(
        /const webServerAddress = [^;]*;/,
        `const webServerAddress = getReadyUrl('http://localhost:${port}');`
      );
    });
    let originalViteConfig = '';
    updateFile(viteConfigPath, (content) => {
      originalViteConfig = content;
      return content.replace(
        /server:\s*{[^}]*}/,
        `server: { port: ${port}, host: 'localhost' }`
      );
    });

    try {
      // runCLI sets CI, and an undefined value drops it from the child env.
      // Without CI and a TTY, an out-of-sync workspace fails the run.
      const result = runCLI(`e2e ${e2eProject} --skip-sync`, {
        env: { CI: undefined },
      });
      expect(result).toContain(
        `Successfully ran target e2e for project ${e2eProject}`
      );
      expect(result).toMatch(
        new RegExp(`nx run ${appName}:${localServerTarget}(?![\\w-])`)
      );
      expect(result).not.toContain(`nx run ${appName}:${ciServerTarget}`);
    } finally {
      updateFile(configPath, originalConfig);
      updateFile(viteConfigPath, originalViteConfig);
      await killPorts(port);
    }
  });

  it('lets Playwright reuse the server Nx waited for instead of starting its own', async () => {
    if (!(await shouldRunPlaywrightTests())) {
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
        /(url: (?:getReadyUrl\()?)(?:'http:\/\/[^']*'|webServerAddress)/,
        `$1'http://localhost:${port}'`
      );
    });
    // Delay the server so Playwright's own probe would miss unless the e2e
    // task waited for the readyWhen first; the delay would break command
    // inference on the webServer command, so it goes on the target instead. A
    // different command replaces the inferred target rather than merging into
    // it, so the target is spelled out, with its own readyWhen.
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
        readyWhen: { port },
      };
      return JSON.stringify(json, null, 2);
    });
    // Reset the daemon so the run sees the replaced target and the edited
    // config rather than what it cached at generation.
    runCLI('reset');

    try {
      // Playwright logs which of the two it did under this debug scope. The
      // atomized target is refused without Nx Cloud unless told otherwise.
      for (const target of ['e2e', 'e2e-ci']) {
        const result = runCLI(`run ${e2eProject}:${target}`, {
          env: {
            DEBUG: 'pw:webserver',
            NX_SKIP_ATOMIZER_VALIDATION: 'true',
            BASE_URL: `http://localhost:${port}`,
          },
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

    if (await shouldRunPlaywrightTests()) {
      const result = runCLI(`e2e ${appName}-e2e --verbose`);
      expect(result).toContain(
        `Successfully ran target e2e for project ${appName}-e2e`
      );
    }
  });
});
