import {
  checkFilesExist,
  cleanupProject,
  newProject,
  readFile,
  runCLI,
  uniq,
  updateJson,
  runCommand,
  tmpProjPath,
} from '@nx/e2e-utils';

describe('js:prune-lockfile executor', () => {
  describe.each([
    ['pnpm', 'pnpm-lock.yaml'],
    ['yarn', 'yarn.lock'],
    ['npm', 'package-lock.json'],
  ])(
    'package manager %s',
    (packageManager: 'pnpm' | 'yarn' | 'npm', lockfile) => {
      let scope;

      beforeAll(() => {
        scope = newProject({
          packages: ['@nx/node', '@nx/js'],
          preset: 'ts',
          packageManager,
        });
      });
      afterAll(() => {
        cleanupProject();
      });

      it('should prune lockfile with workspace module', () => {
        const nodeapp = uniq('nodeapp');
        const nodelib = uniq('nodelib');

        runCLI(
          `generate @nx/node:app ${nodeapp} --linter=eslint --unitTestRunner=jest`
        );
        runCLI(
          `generate @nx/js:lib ${nodelib} --bundler=tsc --linter=eslint --unitTestRunner=jest`
        );

        updateJson(`${nodeapp}/package.json`, (json) => {
          json.dependencies = {
            ...json.dependencies,
            [`@${scope}/${nodelib}`]: `file:../${nodelib}`,
          };
          json.nx.targets['prune-lockfile'] = {
            executor: '@nx/js:prune-lockfile',
            options: {
              buildTarget: 'build',
            },
          };
          return json;
        });
        runCommand(`${packageManager} install`);

        runCLI(`build ${nodeapp}`);
        runCLI(`prune-lockfile ${nodeapp}`);
        checkFilesExist(`${nodeapp}/dist/${lockfile}`);
      });
    }
  );

  describe('package manager npm (plain semver workspace dependency)', () => {
    let scope: string;

    beforeAll(() => {
      scope = newProject({
        packages: ['@nx/node', '@nx/js'],
        preset: 'ts',
        packageManager: 'npm',
      });
    });
    afterAll(() => {
      cleanupProject();
    });

    // npm workspaces reference sibling packages with plain semver (e.g. "*" or
    // "0.0.1") rather than a `workspace:`/`file:`/`link:` protocol prefix. The
    // executor must still recognize these as workspace modules and rewrite
    // them to point at `workspace_modules`. Regression test for #33523.
    it('should rewrite dependency to workspace_modules when version is plain semver', () => {
      const nodeapp = uniq('nodeapp');
      const nodelib = uniq('nodelib');

      runCLI(
        `generate @nx/node:app ${nodeapp} --linter=eslint --unitTestRunner=jest`
      );
      runCLI(
        `generate @nx/js:lib ${nodelib} --bundler=tsc --linter=eslint --unitTestRunner=jest`
      );

      updateJson(`${nodeapp}/package.json`, (json) => {
        json.dependencies = {
          ...json.dependencies,
          [`@${scope}/${nodelib}`]: '*',
        };
        json.nx.targets['prune-lockfile'] = {
          executor: '@nx/js:prune-lockfile',
          options: {
            buildTarget: 'build',
          },
        };
        return json;
      });
      runCommand(`npm install`);

      runCLI(`build ${nodeapp}`);
      runCLI(`prune-lockfile ${nodeapp}`);

      checkFilesExist(`${nodeapp}/dist/package-lock.json`);
      const prunedPackageJson = JSON.parse(
        readFile(`${nodeapp}/dist/package.json`)
      );
      expect(prunedPackageJson.dependencies[`@${scope}/${nodelib}`]).toBe(
        `file:./workspace_modules/@${scope}/${nodelib}`
      );
    });
  });

  describe('package manager pnpm (transitive workspace dependency)', () => {
    let scope: string;

    beforeAll(() => {
      scope = newProject({
        packages: ['@nx/node', '@nx/js'],
        preset: 'ts',
        packageManager: 'pnpm',
      });
    });
    afterAll(() => {
      cleanupProject();
    });

    // When app -> lib-a -> lib-b, the pruned lockfile must include an importer
    // block for lib-b (the transitive workspace dep), include lib-b's npm deps
    // in the packages section, and rewrite lib-a's reference to lib-b from
    // `workspace:*` to `file:../lib-b` so it matches what copy-workspace-modules
    // writes to lib-a/package.json. Regression test for #34655.
    it('should include transitive workspace deps in pruned lockfile', () => {
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

      updateJson(`${liba}/package.json`, (json) => {
        json.dependencies = {
          ...json.dependencies,
          [`@${scope}/${libb}`]: 'workspace:*',
        };
        return json;
      });
      updateJson(`${libb}/package.json`, (json) => {
        json.dependencies = {
          ...json.dependencies,
          lodash: '^4.17.21',
        };
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

      const prunedLockfile = readFile(`${nodeapp}/dist/pnpm-lock.yaml`);

      // Both workspace packages get importer blocks (the bug was that the
      // transitive lib-b importer was missing).
      expect(prunedLockfile).toContain(`workspace_modules/@${scope}/${liba}:`);
      expect(prunedLockfile).toContain(`workspace_modules/@${scope}/${libb}:`);

      // lib-a's reference to lib-b uses the flat workspace_modules layout.
      // Without the rewrite the lockfile would still say `workspace:*`,
      // mismatching what copy-workspace-modules writes to lib-a/package.json
      // (`file:../lib-b`) and causing ERR_PNPM_OUTDATED_LOCKFILE.
      expect(prunedLockfile).toMatch(
        new RegExp(
          `'@${scope}\\/${libb}':\\s+specifier: file:\\.\\.\\/${libb}\\s+version: link:\\.\\.\\/${libb}`
        )
      );

      // lib-b's transitive npm dep (lodash) made it into the packages section.
      expect(prunedLockfile).toMatch(/lodash@4\.\d+\.\d+:/);
    });
  });
});
