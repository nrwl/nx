import {
  checkFilesExist,
  cleanupProject,
  newProject,
  runCLI,
  runCommand,
  tmpProjPath,
  uniq,
  updateJson,
} from '@nx/e2e-utils';
import { cpSync, existsSync, mkdtempSync, realpathSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, sep } from 'path';

const installCmd = {
  pnpm: 'pnpm install --frozen-lockfile',
  yarn: 'yarn install --frozen-lockfile',
  npm: 'npm ci',
  bun: 'bun install --frozen-lockfile',
} as const;

export type PackageManagerUnderTest = keyof typeof installCmd;

const noFrozenInstallCmd: Record<PackageManagerUnderTest, string> = {
  pnpm: 'pnpm install',
  yarn: 'yarn install',
  npm: 'npm install',
  bun: 'bun install',
};

// Copy the pruned dist to a fresh tmp dir outside the e2e workspace and run
// install there. This isolates the install from the surrounding workspace
// (pnpm-workspace.yaml, parent node_modules) so the assertion is really
// "the pruned dist is self-sufficient" — i.e. the actual deployment contract.
//
// `resolveChecks` asserts each copied workspace module's own npm deps actually
// resolve from the installed dist. A plain `pnpm install --frozen-lockfile`
// succeeds even when those deps are silently skipped, so the exit code alone
// isn't enough to prove the deployment works. Regression for #36066.
export function installPrunedDist(
  packageManager: PackageManagerUnderTest,
  distPath: string,
  resolveChecks: { chain: string[]; deps: string[] }[] = [],
  options: {
    frozen?: boolean;
    afterInstall?: (installDir: string) => void;
  } = {}
) {
  const { frozen = true, afterInstall } = options;
  const installDir = mkdtempSync(join(tmpdir(), 'prune-lockfile-install-'));
  try {
    cpSync(distPath, installDir, { recursive: true });
    // failOnError: true — runCommand silently swallows non-zero exits by
    // default (see e2e/utils/command-utils.ts), which would let a broken
    // pruned lockfile pass this assertion. We want a real failure.
    runCommand(
      frozen ? installCmd[packageManager] : noFrozenInstallCmd[packageManager],
      {
        cwd: installDir,
        failOnError: true,
      }
    );
    // realpath both sides: macOS tmpdir is a symlink and require.resolve
    // returns the canonical path, so a raw prefix check would mismatch.
    const realInstallDir = realpathSync(installDir);
    for (const { chain, deps } of resolveChecks) {
      const leaf = chain[chain.length - 1];
      // Every workspace module in the chain must be copied into the dist.
      for (const mod of chain) {
        expect(existsSync(join(installDir, 'workspace_modules', mod))).toBe(
          true
        );
      }
      // Walk the chain from the install root exactly as the deployed app does,
      // resolving each module from its parent's location. A workspace module
      // ships as a pnpm `file:` directory dependency whose own deps live in the
      // virtual store (reached via node_modules symlinks), not in the copied
      // source dir, so resolving a dep from the source dir would wrongly report
      // it missing.
      let moduleDir = installDir;
      for (const mod of chain) {
        try {
          moduleDir = dirname(
            require.resolve(`${mod}/package.json`, { paths: [moduleDir] })
          );
        } catch {
          throw new Error(
            `workspace module '${mod}' is not resolvable in the pruned dist`
          );
        }
      }
      for (const dep of deps) {
        // A throw means the dep never shipped; resolving outside the dist (a
        // global/NODE_PATH hit) is also a miss. Either way the dist isn't
        // self-sufficient.
        let resolved: string;
        try {
          resolved = realpathSync(require.resolve(dep, { paths: [moduleDir] }));
        } catch {
          throw new Error(
            `'${dep}' (dependency of ${leaf}) is missing from the pruned dist`
          );
        }
        expect(resolved.startsWith(realInstallDir + sep)).toBe(true);
      }
    }
    afterInstall?.(installDir);
  } finally {
    rmSync(installDir, { recursive: true, force: true });
  }
}

// Shared by the per-package-manager files so each one runs as its own e2e-ci task.
export function describePruneLockfileForPackageManager(
  packageManager: PackageManagerUnderTest,
  lockfile: string,
  // Set when the calling file creates more than one workspace.
  { keepBackup = false }: { keepBackup?: boolean } = {}
) {
  describe(`package manager ${packageManager}`, () => {
    let scope: string;

    beforeAll(() => {
      scope = newProject({
        keepBackup,
        packages: ['@nx/node', '@nx/js', '@nx/eslint', '@nx/jest'],
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

      // Give the lib an npm dep the app doesn't have, so we can assert it
      // gets installed in the pruned dist (the workspace module's own
      // production deps must ship with it).
      updateJson(`${nodelib}/package.json`, (json) => {
        json.dependencies = { ...json.dependencies, lodash: '^4.17.21' };
        return json;
      });
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
      installPrunedDist(packageManager, tmpProjPath(`${nodeapp}/dist`), [
        {
          chain: [`@${scope}/${nodelib}`],
          deps: ['lodash'],
        },
      ]);
    });

    // app -> lib-a -> lib-b with lib-b having an npm dep. The pruned lockfile
    // must include lib-b as a file: directory package and pull in its npm
    // deps; otherwise the dist install fails. Regression for #34655 (originally
    // hit on pnpm with `workspace:*`; this asserts the install contract on
    // every PM).
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

      // pnpm and Bun use workspace:* for sibling workspace refs; yarn classic
      // and npm don't support that protocol, so use file:../ for those.
      const ref = (name: string) =>
        packageManager === 'pnpm' || packageManager === 'bun'
          ? 'workspace:*'
          : `file:../${name}`;

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

      installPrunedDist(packageManager, tmpProjPath(`${nodeapp}/dist`), [
        {
          chain: [`@${scope}/${liba}`, `@${scope}/${libb}`],
          deps: ['lodash'],
        },
      ]);
    });
  });
}
