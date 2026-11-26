import {
  checkFilesExist,
  cleanupProject,
  newProject,
  readFile,
  runCLI,
  runCommand,
  tmpProjPath,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
import { installPrunedDist } from './js-executor-prune-lockfile-utils';

describe('js:prune-lockfile executor', () => {
  // `overrides` is resolution-time config already baked into the lockfile's
  // snapshots. A frozen install of the dist aborts with
  // ERR_PNPM_LOCKFILE_CONFIG_MISMATCH unless the prune drops it.
  describe('package manager pnpm (standalone pruned dist with root overrides)', () => {
    let scope: string;

    beforeAll(() => {
      scope = newProject({
        keepBackup: true,
        packages: ['@nx/node', '@nx/js', '@nx/eslint', '@nx/jest'],
        preset: 'ts',
        packageManager: 'pnpm',
      });
    });
    afterAll(() => {
      cleanupProject();
    });

    it('should strip incompatible config yet keep workspace-module deps installable', () => {
      const nodeapp = uniq('nodeapp');
      const nodelib = uniq('nodelib');

      runCLI(
        `generate @nx/node:app ${nodeapp} --linter=eslint --unitTestRunner=jest`
      );
      runCLI(
        `generate @nx/js:lib ${nodelib} --bundler=tsc --linter=eslint --unitTestRunner=jest`
      );

      // The lib pulls an npm dep so the dist must install it; the root override
      // targets that same dep so it lands in the workspace lockfile's config.
      // Write the override to both pnpm-workspace.yaml (read by pnpm >=10) and
      // package.json pnpm.overrides (read by pnpm <10, the corepack default in
      // CI temp dirs) so it lands whichever pnpm resolves the install.
      updateJson(`${nodelib}/package.json`, (json) => {
        json.dependencies = { ...json.dependencies, lodash: '^4.17.21' };
        return json;
      });
      updateFile(
        'pnpm-workspace.yaml',
        (content) => `${content}\noverrides:\n  lodash: 4.17.21\n`
      );
      updateJson('package.json', (json) => {
        json.pnpm = {
          ...json.pnpm,
          overrides: { ...json.pnpm?.overrides, lodash: '4.17.21' },
        };
        return json;
      });
      updateJson(`${nodeapp}/package.json`, (json) => {
        json.dependencies = {
          ...json.dependencies,
          [`@${scope}/${nodelib}`]: 'workspace:*',
        };
        json.nx.targets['prune-lockfile'] = {
          executor: '@nx/js:prune-lockfile',
          options: { buildTarget: 'build' },
        };
        json.nx.targets['copy-workspace-modules'] = {
          executor: '@nx/js:copy-workspace-modules',
          options: { buildTarget: 'build' },
        };
        return json;
      });
      runCommand(`pnpm install`);

      // Precondition: the override is recorded in the workspace lockfile, so the
      // assertions below exercise the strip rather than passing as a no-op.
      expect(readFile('pnpm-lock.yaml')).toContain('overrides:');

      runCLI(`build ${nodeapp}`);
      runCLI(`prune-lockfile ${nodeapp}`);
      runCLI(`copy-workspace-modules ${nodeapp}`);

      checkFilesExist(`${nodeapp}/dist/pnpm-lock.yaml`);
      // The dist always ships a pnpm-workspace.yaml so a cache replay or an
      // uncleaned output directory never leaves a stale copy in place; with no
      // install settings to carry it holds only an empty `packages` list.
      expect(readFile(`${nodeapp}/dist/pnpm-workspace.yaml`)).toEqual(
        'packages: []\n'
      );
      // The strip dropped the unsatisfiable config from the pruned lockfile.
      expect(readFile(`${nodeapp}/dist/pnpm-lock.yaml`)).not.toContain(
        'overrides:'
      );

      installPrunedDist('pnpm', tmpProjPath(`${nodeapp}/dist`), [
        {
          chain: [`@${scope}/${nodelib}`],
          deps: ['lodash'],
        },
      ]);
    });
  });

  // The webpack build ships the same deploy output through its asset pipeline
  // (an emit sink) instead of the prune-lockfile executor's file writes, so the
  // wiring is entirely different code. Regression for #36055: a root override
  // baked into the pruned lockfile made a standalone install fail with
  // ERR_PNPM_LOCKFILE_CONFIG_MISMATCH.
  describe('package manager pnpm (webpack emit sink)', () => {
    beforeAll(() => {
      newProject({
        keepBackup: true,
        packages: ['@nx/node', '@nx/js', '@nx/eslint', '@nx/jest'],
        preset: 'ts',
        packageManager: 'pnpm',
      });
    });
    afterAll(() => {
      cleanupProject();
    });

    it('should produce an installable dist from a generatePackageJson webpack build', () => {
      const nodeapp = uniq('nodeapp');

      runCLI(
        `generate @nx/node:app ${nodeapp} --bundler=webpack --linter=eslint --unitTestRunner=jest`
      );

      // The app pulls an npm dep so the dist must install it; the root override
      // targets that same dep so it lands in the workspace lockfile's config.
      // Write the override to both pnpm-workspace.yaml (read by pnpm >=10) and
      // package.json pnpm.overrides (read by pnpm <10, the corepack default in
      // CI temp dirs) so it lands whichever pnpm resolves the install.
      updateFile(
        'pnpm-workspace.yaml',
        (content) => `${content}\noverrides:\n  lodash: 4.17.21\n`
      );
      updateJson('package.json', (json) => {
        json.pnpm = {
          ...json.pnpm,
          overrides: { ...json.pnpm?.overrides, lodash: '4.17.21' },
        };
        return json;
      });
      updateJson(`${nodeapp}/package.json`, (json) => {
        json.dependencies = { ...json.dependencies, lodash: '^4.17.21' };
        return json;
      });
      // The build target is inferred by @nx/webpack/plugin, so the option must
      // be enabled in the config NxAppWebpackPlugin reads, not on the target.
      updateFile(`${nodeapp}/webpack.config.js`, (content) =>
        content.replace(
          'generatePackageJson: false',
          'generatePackageJson: true'
        )
      );
      runCommand(`pnpm install`);

      // Precondition: the override is recorded in the workspace lockfile, so the
      // assertions below exercise the strip rather than passing as a no-op.
      expect(readFile('pnpm-lock.yaml')).toContain('overrides:');

      runCLI(`build ${nodeapp}`);

      checkFilesExist(
        `${nodeapp}/dist/package.json`,
        `${nodeapp}/dist/pnpm-lock.yaml`,
        `${nodeapp}/dist/pnpm-workspace.yaml`
      );
      // The strip dropped the unsatisfiable config from the emitted lockfile.
      expect(readFile(`${nodeapp}/dist/pnpm-lock.yaml`)).not.toContain(
        'overrides:'
      );

      installPrunedDist('pnpm', tmpProjPath(`${nodeapp}/dist`), [
        { chain: [], deps: ['lodash'] },
      ]);
    });
  });

  // app -> lib-a (dependency) -> lib-b (lib-a's optionalDependency) -> lodash.
  // optionalDependencies install in production, so the pruned pnpm lockfile must
  // emit lib-b as a file: directory package and copy-workspace-modules must copy
  // it and rewrite lib-a's optional spec. Covers the optionalDependencies half of
  // the workspace-module deploy contract, alongside the dependencies case in
  // js-executor-prune-lockfile-utils.ts.
  describe('package manager pnpm (transitive optional workspace dep)', () => {
    let scope: string;

    beforeAll(() => {
      scope = newProject({
        keepBackup: true,
        packages: ['@nx/node', '@nx/js', '@nx/eslint', '@nx/jest'],
        preset: 'ts',
        packageManager: 'pnpm',
      });
    });
    afterAll(() => {
      cleanupProject();
    });

    it('should produce installable pruned output with an optional transitive workspace dep', () => {
      const nodeapp = uniq('nodeapp');
      const liba = uniq('liba');
      const libb = uniq('libb');

      runCLI(
        `generate @nx/node:app ${nodeapp} --linter=eslint --unitTestRunner=jest`
      );
      runCLI(
        `generate @nx/js:lib ${liba} --bundler=tsc --linter=eslint --unitTestRunner=jest`
      );
      runCLI(
        `generate @nx/js:lib ${libb} --bundler=tsc --linter=eslint --unitTestRunner=jest`
      );

      // lib-a reaches lib-b through optionalDependencies, not dependencies.
      updateJson(`${liba}/package.json`, (json) => {
        json.optionalDependencies = {
          ...json.optionalDependencies,
          [`@${scope}/${libb}`]: 'workspace:*',
        };
        return json;
      });
      updateJson(`${libb}/package.json`, (json) => {
        json.dependencies = { ...json.dependencies, lodash: '^4.17.21' };
        return json;
      });
      updateJson(`${nodeapp}/package.json`, (json) => {
        json.dependencies = {
          ...json.dependencies,
          [`@${scope}/${liba}`]: 'workspace:*',
        };
        json.nx.targets['prune-lockfile'] = {
          executor: '@nx/js:prune-lockfile',
          options: { buildTarget: 'build' },
        };
        json.nx.targets['copy-workspace-modules'] = {
          executor: '@nx/js:copy-workspace-modules',
          options: { buildTarget: 'build' },
        };
        return json;
      });
      runCommand(`pnpm install`);

      runCLI(`build ${nodeapp}`);
      runCLI(`prune-lockfile ${nodeapp}`);
      runCLI(`copy-workspace-modules ${nodeapp}`);

      installPrunedDist('pnpm', tmpProjPath(`${nodeapp}/dist`), [
        {
          chain: [`@${scope}/${liba}`, `@${scope}/${libb}`],
          deps: ['lodash'],
        },
      ]);
    });
  });

  // An app may list a workspace library under its OWN optionalDependencies. The
  // root importer must emit it as a file: directory package and copy-workspace-
  // modules must ship it, or pnpm install --frozen-lockfile fails on the
  // manifest/lockfile mismatch. Covers the app-level optional case (the
  // transitive optional case is covered above).
  describe('package manager pnpm (app-level optional workspace dep)', () => {
    let scope: string;

    beforeAll(() => {
      scope = newProject({
        keepBackup: true,
        packages: ['@nx/node', '@nx/js', '@nx/eslint', '@nx/jest'],
        preset: 'ts',
        packageManager: 'pnpm',
      });
    });
    afterAll(() => {
      cleanupProject();
    });

    it('should produce installable pruned output with an app-level optional workspace dep', () => {
      const nodeapp = uniq('nodeapp');
      const liba = uniq('liba');

      runCLI(
        `generate @nx/node:app ${nodeapp} --linter=eslint --unitTestRunner=jest`
      );
      runCLI(
        `generate @nx/js:lib ${liba} --bundler=tsc --linter=eslint --unitTestRunner=jest`
      );

      updateJson(`${liba}/package.json`, (json) => {
        json.dependencies = { ...json.dependencies, lodash: '^4.17.21' };
        return json;
      });
      // The app reaches liba through its own optionalDependencies.
      updateJson(`${nodeapp}/package.json`, (json) => {
        json.optionalDependencies = {
          ...json.optionalDependencies,
          [`@${scope}/${liba}`]: 'workspace:*',
        };
        json.nx.targets['prune-lockfile'] = {
          executor: '@nx/js:prune-lockfile',
          options: { buildTarget: 'build' },
        };
        json.nx.targets['copy-workspace-modules'] = {
          executor: '@nx/js:copy-workspace-modules',
          options: { buildTarget: 'build' },
        };
        return json;
      });
      runCommand(`pnpm install`);

      runCLI(`build ${nodeapp}`);
      runCLI(`prune-lockfile ${nodeapp}`);
      runCLI(`copy-workspace-modules ${nodeapp}`);

      installPrunedDist('pnpm', tmpProjPath(`${nodeapp}/dist`), [
        {
          chain: [`@${scope}/${liba}`],
          deps: ['lodash'],
        },
      ]);
    });
  });

  // An app may list a workspace library under its OWN devDependencies. pnpm
  // validates the whole manifest against the lockfile even under --prod, so the
  // root importer must emit it as a file: directory package under
  // devDependencies and copy-workspace-modules must ship it, or
  // pnpm install --frozen-lockfile fails on the manifest/lockfile mismatch.
  // Regression for #35425.
  describe('package manager pnpm (app-level dev workspace dep)', () => {
    let scope: string;

    beforeAll(() => {
      scope = newProject({
        keepBackup: true,
        packages: ['@nx/node', '@nx/js', '@nx/eslint', '@nx/jest'],
        preset: 'ts',
        packageManager: 'pnpm',
      });
    });
    afterAll(() => {
      cleanupProject();
    });

    it('should produce installable pruned output with an app-level dev workspace dep', () => {
      const nodeapp = uniq('nodeapp');
      const liba = uniq('liba');

      runCLI(
        `generate @nx/node:app ${nodeapp} --linter=eslint --unitTestRunner=jest`
      );
      runCLI(
        `generate @nx/js:lib ${liba} --bundler=tsc --linter=eslint --unitTestRunner=jest`
      );

      updateJson(`${liba}/package.json`, (json) => {
        json.dependencies = { ...json.dependencies, lodash: '^4.17.21' };
        return json;
      });
      // The app reaches liba through its own devDependencies.
      updateJson(`${nodeapp}/package.json`, (json) => {
        json.devDependencies = {
          ...json.devDependencies,
          [`@${scope}/${liba}`]: 'workspace:*',
        };
        json.nx.targets['prune-lockfile'] = {
          executor: '@nx/js:prune-lockfile',
          options: { buildTarget: 'build' },
        };
        json.nx.targets['copy-workspace-modules'] = {
          executor: '@nx/js:copy-workspace-modules',
          options: { buildTarget: 'build' },
        };
        return json;
      });
      runCommand(`pnpm install`);

      runCLI(`build ${nodeapp}`);
      runCLI(`prune-lockfile ${nodeapp}`);
      runCLI(`copy-workspace-modules ${nodeapp}`);

      installPrunedDist('pnpm', tmpProjPath(`${nodeapp}/dist`), [
        {
          chain: [`@${scope}/${liba}`],
          deps: ['lodash'],
        },
      ]);
    });
  });
});
