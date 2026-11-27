import {
  checkFilesExist,
  cleanupProject,
  newProject,
  readFile,
  runCLI,
  runCommand,
  tmpProjPath,
  uniq,
  updateJson,
} from '@nx/e2e-utils';
import {
  describePruneLockfileForPackageManager,
  installPrunedDist,
} from './js-executor-prune-lockfile-utils';

describe('js:prune-lockfile executor', () => {
  describePruneLockfileForPackageManager('npm', 'package-lock.json', {
    keepBackup: true,
  });

  // Plain semver workspace refs (e.g. "*" or "0.0.1") are an npm/yarn-classic
  // thing — pnpm requires the `workspace:` protocol — so this scenario stays
  // npm-only. The executor must recognize the sibling and rewrite the dep
  // to point at workspace_modules. Regression test for #33523.
  describe('package manager npm (plain semver workspace dependency)', () => {
    let scope: string;

    beforeAll(() => {
      scope = newProject({
        keepBackup: true,
        packages: ['@nx/node', '@nx/js'],
        preset: 'ts',
        packageManager: 'npm',
      });
    });
    afterAll(() => {
      cleanupProject();
    });

    it('should rewrite dependency to workspace_modules and install cleanly', () => {
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
          options: { buildTarget: 'build' },
        };
        json.nx.targets['copy-workspace-modules'] = {
          executor: '@nx/js:copy-workspace-modules',
          options: { buildTarget: 'build' },
        };
        return json;
      });
      runCommand(`npm install`);

      runCLI(`build ${nodeapp}`);
      runCLI(`prune-lockfile ${nodeapp}`);
      runCLI(`copy-workspace-modules ${nodeapp}`);

      checkFilesExist(`${nodeapp}/dist/package-lock.json`);
      const prunedPackageJson = JSON.parse(
        readFile(`${nodeapp}/dist/package.json`)
      );
      expect(prunedPackageJson.dependencies[`@${scope}/${nodelib}`]).toBe(
        `file:./workspace_modules/@${scope}/${nodelib}`
      );

      installPrunedDist('npm', tmpProjPath(`${nodeapp}/dist`));
    });
  });
});
