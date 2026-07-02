import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  newProject,
  readFile,
  runCLI,
  uniq,
  updateFile,
  updateJson,
  runCommand,
  tmpProjPath,
} from '@nx/e2e-utils';
import { cpSync, existsSync, mkdtempSync, realpathSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, sep } from 'path';

const installCmd = {
  pnpm: 'pnpm install --frozen-lockfile',
  yarn: 'yarn install --frozen-lockfile',
  npm: 'npm ci',
} as const;

// Copy the pruned dist to a fresh tmp dir outside the e2e workspace and run
// install there. This isolates the install from the surrounding workspace
// (pnpm-workspace.yaml, parent node_modules) so the assertion is really
// "the pruned dist is self-sufficient" — i.e. the actual deployment contract.
//
// `resolveChecks` asserts each copied workspace module's own npm deps actually
// resolve from the installed dist. A plain `pnpm install --frozen-lockfile`
// succeeds even when those deps are silently skipped, so the exit code alone
// isn't enough to prove the deployment works. Regression for #36066.
function installPrunedDist(
  packageManager: 'pnpm' | 'yarn' | 'npm',
  distPath: string,
  resolveChecks: { chain: string[]; deps: string[] }[] = []
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

        installPrunedDist(packageManager, tmpProjPath(`${nodeapp}/dist`), [
          {
            chain: [`@${scope}/${liba}`, `@${scope}/${libb}`],
            deps: ['lodash'],
          },
        ]);
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

  // Root pnpm `overrides` is config pnpm 11 reads only from pnpm-workspace.yaml
  // and records in the lockfile. The standalone pruned dist ships no
  // pnpm-workspace.yaml at all, so the pruned lockfile must drop `overrides` or
  // `pnpm install --frozen-lockfile` aborts with
  // ERR_PNPM_LOCKFILE_CONFIG_MISMATCH. Proves the config strip (#36055) and the
  // file: workspace-module deps (#36066) compose: deps still install, config is
  // gone.
  describe('package manager pnpm (standalone pruned dist with root overrides)', () => {
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
      // Workspace modules install as file: directory deps, no workspace file.
      checkFilesDoNotExist(`${nodeapp}/dist/pnpm-workspace.yaml`);
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

  // app -> lib-a (dependency) -> lib-b (lib-a's optionalDependency) -> lodash.
  // optionalDependencies install in production, so the pruned pnpm lockfile must
  // emit lib-b as a file: directory package and copy-workspace-modules must copy
  // it and rewrite lib-a's optional spec. Covers the optionalDependencies half of
  // the workspace-module deploy contract, alongside the dependencies case above.
  describe('package manager pnpm (transitive optional workspace dep)', () => {
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
