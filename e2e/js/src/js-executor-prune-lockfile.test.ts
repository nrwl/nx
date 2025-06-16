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
} from '@nx/e2e/utils';

describe('js:prune-lockfile executor', () => {
  describe.each([
    ['pnpm', 'pnpm-lock.yaml'],
    ['yarn', 'yarn.lock'],
    ['npm', 'package-lock.json'],
  ])('package manager %s', (packageManager, lockfile) => {
    let scope;
    let previousPackageManager: string;

    beforeAll(() => {
      previousPackageManager = process.env.SELECTED_PM;
      // Use pnpm to properly test workspace: protocol dependencies
      process.env.SELECTED_PM = packageManager;

      scope = newProject({
        packages: ['@nx/node', '@nx/js'],
        preset: 'ts',
      });
    });
    afterAll(() => {
      cleanupProject();
      process.env.SELECTED_PM = previousPackageManager;
    });

    it('should prune lockfile with workspace module -- pnpm', () => {
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
      console.log(tmpProjPath());
      runCommand(`${packageManager} install`);

      runCLI(`build ${nodeapp}`);
      runCLI(`prune-lockfile ${nodeapp}`);
      checkFilesExist(`${nodeapp}/dist/${lockfile}`);
    });
  });
});
