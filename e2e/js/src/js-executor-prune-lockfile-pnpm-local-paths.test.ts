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
  // Non-workspace local-path dependencies: a file: tarball, a file: directory,
  // and a link: directory vendored inside the workspace (under vendor/, outside
  // the pnpm workspace packages glob). The pruned output must ship each target
  // under local_path_modules/ (a single declared output so a cache replay keeps
  // it), rewrite the manifest specifiers and lockfile refs to resolve there, and
  // install under both frozen and non-frozen pnpm installs (a non-frozen install
  // re-resolves the manifest specifiers, which is why the rewrite exists).
  // pnpm-only: npm and yarn keep their loud root-lockfile fallback for these
  // shapes.
  describe('package manager pnpm (non-workspace local-path dependencies)', () => {
    let scope: string;

    beforeAll(() => {
      scope = newProject({
        packages: ['@nx/node', '@nx/js', '@nx/eslint', '@nx/jest'],
        preset: 'ts',
        packageManager: 'pnpm',
      });
    });
    afterAll(() => {
      cleanupProject();
    });

    it('should produce installable pruned output with direct file: and link: dependencies', () => {
      const nodeapp = uniq('nodeapp');

      runCLI(
        `generate @nx/node:app ${nodeapp} --linter=eslint --unitTestRunner=jest`
      );

      updateFile(
        'vendor/dir-dep/package.json',
        JSON.stringify({ name: 'dir-dep', version: '1.0.0', main: 'index.js' })
      );
      updateFile('vendor/dir-dep/index.js', `module.exports = 'dir-dep';`);
      // The linked package requires lodash. lodash is also a direct dep of the
      // app, so the link: closure validation passes and the re-homed target
      // resolves it from the deploy-root node_modules at runtime (link: ships
      // no dependency closure of its own).
      updateFile(
        'vendor/linked-lib/package.json',
        JSON.stringify({
          name: 'linked-lib',
          version: '1.0.0',
          main: 'index.js',
          dependencies: { lodash: '^4.17.21' },
        })
      );
      updateFile(
        'vendor/linked-lib/index.js',
        `module.exports = require('lodash').chunk([1, 2], 1);`
      );
      updateFile(
        'vendor/tarball-src/package.json',
        JSON.stringify({
          name: 'tarball-dep',
          version: '1.0.0',
          main: 'index.js',
        })
      );
      updateFile(
        'vendor/tarball-src/index.js',
        `module.exports = 'tarball-dep';`
      );
      runCommand('npm pack ./vendor/tarball-src --pack-destination ./vendor');

      updateJson(`${nodeapp}/package.json`, (json) => {
        json.dependencies = {
          ...json.dependencies,
          lodash: '^4.17.21',
          'dir-dep': 'file:../vendor/dir-dep',
          'linked-lib': 'link:../vendor/linked-lib',
          'tarball-dep': 'file:../vendor/tarball-dep-1.0.0.tgz',
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

      checkFilesExist(
        `${nodeapp}/dist/pnpm-lock.yaml`,
        `${nodeapp}/dist/local_path_modules/vendor/dir-dep/package.json`,
        `${nodeapp}/dist/local_path_modules/vendor/linked-lib/package.json`,
        `${nodeapp}/dist/local_path_modules/vendor/tarball-dep-1.0.0.tgz`
      );
      // The emitted manifest resolves each local path from its shipped location
      // under local_path_modules/ (a single declared prune-lockfile output).
      const prunedPackageJson = JSON.parse(
        readFile(`${nodeapp}/dist/package.json`)
      );
      expect(prunedPackageJson.dependencies['dir-dep']).toBe(
        'file:local_path_modules/vendor/dir-dep'
      );
      expect(prunedPackageJson.dependencies['linked-lib']).toBe(
        'link:local_path_modules/vendor/linked-lib'
      );
      expect(prunedPackageJson.dependencies['tarball-dep']).toBe(
        'file:local_path_modules/vendor/tarball-dep-1.0.0.tgz'
      );

      // Executing the linked package proves its lodash require resolves from
      // the deploy root; the file: deps prove their packed/copied installs.
      const requireLocalPathDeps = (installDir: string) => {
        runCommand(
          `node -e "require('dir-dep'); require('tarball-dep'); require('linked-lib');"`,
          { cwd: installDir, failOnError: true }
        );
      };
      installPrunedDist('pnpm', tmpProjPath(`${nodeapp}/dist`), [], {
        afterInstall: requireLocalPathDeps,
      });
      installPrunedDist('pnpm', tmpProjPath(`${nodeapp}/dist`), [], {
        frozen: false,
        afterInstall: requireLocalPathDeps,
      });
    });

    it('should produce installable pruned output with transitive file: and link: dependencies', () => {
      const nodeapp = uniq('nodeapp');
      const nodelib = uniq('nodelib');

      runCLI(
        `generate @nx/node:app ${nodeapp} --linter=eslint --unitTestRunner=jest`
      );
      runCLI(
        `generate @nx/js:lib ${nodelib} --bundler=tsc --linter=eslint --unitTestRunner=jest`
      );

      updateFile(
        'vendor/dir-dep-t/package.json',
        JSON.stringify({
          name: 'dir-dep-t',
          version: '1.0.0',
          main: 'index.js',
        })
      );
      updateFile('vendor/dir-dep-t/index.js', `module.exports = 'dir-dep-t';`);
      updateFile(
        'vendor/linked-lib-t/package.json',
        JSON.stringify({
          name: 'linked-lib-t',
          version: '1.0.0',
          main: 'index.js',
          dependencies: { lodash: '^4.17.21' },
        })
      );
      updateFile(
        'vendor/linked-lib-t/index.js',
        `module.exports = require('lodash').chunk([1, 2], 1);`
      );

      // The workspace lib reaches the vendored packages, so the copied module's
      // manifest and the lockfile snapshot refs both need the re-homed paths.
      updateJson(`${nodelib}/package.json`, (json) => {
        json.dependencies = {
          ...json.dependencies,
          'dir-dep-t': 'file:../vendor/dir-dep-t',
          'linked-lib-t': 'link:../vendor/linked-lib-t',
        };
        return json;
      });
      updateJson(`${nodeapp}/package.json`, (json) => {
        json.dependencies = {
          ...json.dependencies,
          lodash: '^4.17.21',
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

      runCLI(`build ${nodeapp}`);
      runCLI(`prune-lockfile ${nodeapp}`);
      runCLI(`copy-workspace-modules ${nodeapp}`);

      checkFilesExist(
        `${nodeapp}/dist/pnpm-lock.yaml`,
        `${nodeapp}/dist/workspace_modules/@${scope}/${nodelib}/package.json`,
        `${nodeapp}/dist/local_path_modules/vendor/dir-dep-t/package.json`,
        `${nodeapp}/dist/local_path_modules/vendor/linked-lib-t/package.json`
      );
      // The copied module's manifest keeps its vendored paths resolvable: pnpm
      // reads a file: spec relative to the package dir (up to the shipped
      // location under local_path_modules/) but a link: spec relative to the
      // install root.
      const copiedManifest = JSON.parse(
        readFile(
          `${nodeapp}/dist/workspace_modules/@${scope}/${nodelib}/package.json`
        )
      );
      expect(copiedManifest.dependencies['dir-dep-t']).toBe(
        'file:../../../local_path_modules/vendor/dir-dep-t'
      );
      expect(copiedManifest.dependencies['linked-lib-t']).toBe(
        'link:local_path_modules/vendor/linked-lib-t'
      );

      // Executing the linked target from its shipped location proves its
      // lodash require resolves from the deploy-root node_modules.
      const requireLinkedTarget = (installDir: string) => {
        runCommand(
          `node -e "require('./local_path_modules/vendor/linked-lib-t');"`,
          {
            cwd: installDir,
            failOnError: true,
          }
        );
      };
      installPrunedDist(
        'pnpm',
        tmpProjPath(`${nodeapp}/dist`),
        [
          {
            chain: [`@${scope}/${nodelib}`],
            deps: ['dir-dep-t', 'linked-lib-t'],
          },
        ],
        { afterInstall: requireLinkedTarget }
      );
      installPrunedDist(
        'pnpm',
        tmpProjPath(`${nodeapp}/dist`),
        [
          {
            chain: [`@${scope}/${nodelib}`],
            deps: ['dir-dep-t', 'linked-lib-t'],
          },
        ],
        { frozen: false, afterInstall: requireLinkedTarget }
      );
    });
  });
});
