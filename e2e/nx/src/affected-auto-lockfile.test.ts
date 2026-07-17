import {
  cleanupProject,
  getPackageManagerCommand,
  newProject,
  packageManagerLockFile,
  readFile,
  runCLI,
  runCommand,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';

describe('nx affected -- projectsAffectedByDependencyUpdates (e2e)', () => {
  describe.each([['pnpm'], ['yarn'], ['npm'], ['bun']] as const)(
    'package manager %s',
    (packageManager) => {
      let libA: string;
      let libB: string;
      let baselineSha: string;

      const setMode = (value: 'all' | 'auto') => {
        updateJson('nx.json', (json) => {
          json.pluginsConfig ??= {};
          json.pluginsConfig['@nx/js'] ??= {};
          json.pluginsConfig['@nx/js'].projectsAffectedByDependencyUpdates =
            value;
          return json;
        });
      };

      beforeAll(() => {
        newProject({ packages: ['@nx/js'], packageManager });

        libA = uniq('lib-a');
        libB = uniq('lib-b');
        runCLI(
          `generate @nx/js:lib libs/${libA} --bundler=none --unitTestRunner=none`
        );
        // Yarn v4 requires the lockfile to be refreshed after a new workspace
        // package is created; without this, subsequent yarn operations fail
        // with "This package doesn't seem to be present in your lockfile".
        runCommand(getPackageManagerCommand({ packageManager }).install);
        runCLI(
          `generate @nx/js:lib libs/${libB} --bundler=none --unitTestRunner=none`
        );

        updateFile(
          `libs/${libA}/src/index.ts`,
          `import isOdd from 'is-odd';\nexport default isOdd;\n`
        );
        updateFile(
          `libs/${libB}/src/index.ts`,
          `import leftPad from 'left-pad';\nexport default leftPad;\n`
        );

        updateJson('package.json', (json) => {
          json.dependencies ??= {};
          json.dependencies['is-odd'] = '3.0.0';
          json.dependencies['left-pad'] = '1.3.0';
          return json;
        });

        runCommand(getPackageManagerCommand({ packageManager }).install);
        runCommand(`git add . && git commit -am "chore: baseline"`);
        baselineSha = runCommand(`git rev-parse HEAD`).trim();
      });

      afterAll(() => cleanupProject());

      describe('default "all" mode', () => {
        beforeAll(() => {
          runCommand(`git reset --hard ${baselineSha}`);
          setMode('all');
          runCommand(`git add nx.json && git commit -m "chore: set mode=all"`);

          updateJson('package.json', (json) => {
            json.dependencies['is-odd'] = '3.0.1';
            return json;
          });
          runCommand(getPackageManagerCommand({ packageManager }).install);
          runCommand(
            `git add . && git commit -am "chore: bump is-odd (all mode)"`
          );
        });

        it('marks every project affected when any lock-file entry changes', () => {
          const out = runCLI(
            `show projects --affected --base=HEAD~1 --head=HEAD`
          );
          expect(out).toContain(libA);
          expect(out).toContain(libB);
        });
      });

      describe('"auto" mode', () => {
        beforeAll(() => {
          runCommand(`git reset --hard ${baselineSha}`);
          setMode('auto');
          runCommand(`git add nx.json && git commit -m "chore: set mode=auto"`);
        });

        it('reports no affected projects when the lock file is unchanged', () => {
          const out = runCLI(
            `show projects --affected --base=HEAD --head=HEAD`
          );
          expect(out).not.toContain(libA);
          expect(out).not.toContain(libB);
        });

        const lockfileOnlyTest =
          packageManagerLockFile[packageManager] === 'bun.lockb' ? it.skip : it;

        lockfileOnlyTest(
          'marks only the dependent project affected when a single lockfile entry changes',
          () => {
            const lockFile = packageManagerLockFile[packageManager];
            const currentLockFile = readFile(lockFile);
            const updatedLockFile = currentLockFile.replace(
              /\b3\.0\.0\b/g,
              '3.0.1'
            );

            expect(updatedLockFile).not.toEqual(currentLockFile);

            updateFile(lockFile, updatedLockFile);
            runCommand(
              `git add ${lockFile} && git commit -m "chore: bump is-odd in lockfile (auto mode)"`
            );

            const out = runCLI(
              `show projects --affected --base=HEAD~1 --head=HEAD`
            );
            expect(out).toContain(libA);
            expect(out).not.toContain(libB);
          }
        );
      });
    }
  );
});
