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
import { cpSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const installCmd = {
  pnpm: 'pnpm install --frozen-lockfile',
  yarn: 'yarn install --frozen-lockfile',
  npm: 'npm ci',
} as const;

// Copy the pruned dist to a fresh tmp dir outside the e2e workspace and run
// install there. This isolates the install from the surrounding workspace
// (pnpm-workspace.yaml, parent node_modules) so the assertion is really
// "the pruned dist is self-sufficient" — i.e. the actual deployment contract.
function installPrunedDist(
  packageManager: 'pnpm' | 'yarn' | 'npm',
  distPath: string
) {
  const installDir = mkdtempSync(join(tmpdir(), 'prune-lockfile-install-'));
  try {
    cpSync(distPath, installDir, { recursive: true });
    // failOnError: true — runCommand silently swallows non-zero exits by
    // default (see e2e/utils/command-utils.ts), which would let a broken
    // pruned lockfile pass this assertion. We want a real failure.
    runCommand(installCmd[packageManager], {
      cwd: installDir,
      failOnError: true,
    });
  } finally {
    rmSync(installDir, { recursive: true, force: true });
  }
}

describe('js:prune-lockfile executor', () => {
  describe.each([
    ['pnpm', 'pnpm-lock.yaml'],
    ['yarn', 'yarn.lock'],
    ['npm', 'package-lock.json'],
  ])(
    'package manager %s',
    (packageManager: 'pnpm' | 'yarn' | 'npm', lockfile) => {
      let scope: string;

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

      it('should produce installable pruned output with a workspace module', () => {
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
            options: { buildTarget: 'build' },
          };
          json.nx.targets['copy-workspace-modules'] = {
            executor: '@nx/js:copy-workspace-modules',
            options: { buildTarget: 'build' },
          };
          return json;
        });
        runCommand(`${packageManager} install`);

        runCLI(`build ${nodeapp}`);
        runCLI(`prune-lockfile ${nodeapp}`);
        runCLI(`copy-workspace-modules ${nodeapp}`);

        checkFilesExist(`${nodeapp}/dist/${lockfile}`);
        installPrunedDist(packageManager, tmpProjPath(`${nodeapp}/dist`));
      });

      // app -> lib-a -> lib-b with lib-b having an npm dep. The pruned lockfile
      // must include lib-b as an importer and pull in its npm deps; otherwise
      // the dist install fails. Regression for #34655 (originally hit on pnpm
      // with `workspace:*`; this asserts the install contract on every PM).
      it('should produce installable pruned output with a transitive workspace dep', () => {
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

        // pnpm uses workspace:* for sibling workspace refs; yarn classic and
        // npm don't support that protocol, so use file:../ for those.
        const ref = (name: string) =>
          packageManager === 'pnpm' ? 'workspace:*' : `file:../${name}`;

        updateJson(`${liba}/package.json`, (json) => {
          json.dependencies = {
            ...json.dependencies,
            [`@${scope}/${libb}`]: ref(libb),
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
            [`@${scope}/${liba}`]: ref(liba),
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
        runCommand(`${packageManager} install`);

        runCLI(`build ${nodeapp}`);
        runCLI(`prune-lockfile ${nodeapp}`);
        runCLI(`copy-workspace-modules ${nodeapp}`);

        installPrunedDist(packageManager, tmpProjPath(`${nodeapp}/dist`));
      });
    }
  );

  // Plain semver workspace refs (e.g. "*" or "0.0.1") are an npm/yarn-classic
  // thing — pnpm requires the `workspace:` protocol — so this scenario stays
  // npm-only. The executor must recognize the sibling and rewrite the dep
  // to point at workspace_modules. Regression test for #33523.
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
