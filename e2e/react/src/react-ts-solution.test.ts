const { load } = require('@zkochan/js-yaml');
import {
  cleanupProject,
  runCLI,
  newProject,
  ensureCypressInstallation,
  uniq,
  readFile,
  readJson,
} from '@nx/e2e/utils';

describe('React typescript project references', () => {
  describe('PM = npm', () => {
    beforeAll(() => {
      newProject({
        packages: ['@nx/react'],
        packageManager: 'npm',
        workspaces: true,
      });
      ensureCypressInstallation();
    });

    afterAll(() => cleanupProject());
    it('None buildable libs using should be excluded from js/ts plugin', async () => {
      const appName = uniq('app');
      const libName = uniq('lib');

      runCLI(
        `generate @nx/react:app apps/${appName} --name=${appName} --useTsSolution=true --bundler=vite --no-interactive --skipFormat --linter=eslint --unitTestRunner=vitest`
      );
      runCLI(
        `generate @nx/react:lib ${libName} --bundler=none --no-interactive --unit-test-runner=vitest --skipFormat --linter=eslint`
      );

      const nxJson = readJson('nx.json');

      const jsTypescriptPlugin = nxJson.plugins.find(
        (plugin) => plugin.plugin === '@nx/js/typescript'
      );
      expect(jsTypescriptPlugin).toBeDefined();

      expect(jsTypescriptPlugin.exclude.includes(`${libName}/*`)).toBeTruthy();
    }, 250_000);

    it('Apps/libs using should be added to workspaces', async () => {
      const appName = uniq('app');
      const libName = uniq('lib');

      runCLI(
        `generate @nx/react:app apps/${appName} --name=${appName} --useTsSolution=true --bundler=vite --no-interactive --skipFormat --linter=eslint --unitTestRunner=vitest`
      );
      runCLI(
        `generate @nx/react:lib ${libName} --bundler=vite --no-interactive --unit-test-runner=vitest --skipFormat --linter=eslint`
      );

      const packageJson = readJson('package.json');
      expect(packageJson.workspaces).toContain(`apps/${appName}`);
      expect(packageJson.workspaces).toContain(`${libName}/*`);
    });
  });

  describe('PM = pnpm', () => {
    beforeAll(() => {
      newProject({
        packages: ['@nx/react'],
        packageManager: 'pnpm',
        workspaces: true,
      });

      ensureCypressInstallation();
    });

    afterAll(() => cleanupProject());

    it('None buildable libs using should be excluded from js/ts plugin', async () => {
      const appName = uniq('app');
      const libName = uniq('lib');

      runCLI(
        `generate @nx/react:app apps/${appName} --name=${appName} --useTsSolution=true --bundler=vite --no-interactive --skipFormat --linter=eslint --unitTestRunner=vitest`
      );
      runCLI(
        `generate @nx/react:lib ${libName} --bundler=none --no-interactive --unit-test-runner=vitest --skipFormat --linter=eslint`
      );

      const nxJson = readJson('nx.json');

      const jsTypescriptPlugin = nxJson.plugins.find(
        (plugin) => plugin.plugin === '@nx/js/typescript'
      );
      expect(jsTypescriptPlugin).toBeDefined();

      expect(jsTypescriptPlugin.exclude.includes(`${libName}/*`)).toBeTruthy();
    }, 250_000);

    it('PNPM Apps/libs using should be added to workspaces', async () => {
      const appName = uniq('app');
      const libName = uniq('lib');

      runCLI(
        `generate @nx/react:app apps/${appName} --name=${appName} --useTsSolution=true --bundler=vite --no-interactive --skipFormat --linter=eslint --unitTestRunner=vitest`
      );
      runCLI(
        `generate @nx/react:lib ${libName} --bundler=vite --no-interactive --unit-test-runner=vitest --skipFormat --linter=eslint`
      );

      const pnpmWorkspaceContent = readFile('pnpm-workspace.yaml');
      const pnmpWorkspaceYaml = load(pnpmWorkspaceContent);
      expect(pnmpWorkspaceYaml.packages).toContain(`apps/${appName}`);
      expect(pnmpWorkspaceYaml.packages).toContain(`${libName}/*`);
    });
  });
});
