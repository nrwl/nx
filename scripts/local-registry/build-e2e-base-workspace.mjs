// @ts-check
/**
 * PROTOTYPE: pre-build a bare e2e base workspace once, up front, so the atomized
 * `e2e-ci--*` tasks don't each pay the ~40s `create-nx-workspace` cold start.
 *
 * Runs as the `populate-e2e-base-workspace` task (sibling to
 * `populate-local-registry-storage`). Its output dir is declared as a cached Nx
 * output, so it is restored to every distributed agent the same way the verdaccio
 * storage is — which is what makes the template shareable across machines.
 *
 * The consumer side is `newProject()` in e2e/utils/create-project-utils.ts: when a
 * template exists for the package manager, it seeds the per-test workspace from it
 * instead of running create-nx-workspace. If the template is absent, newProject
 * falls back to its original lazy build — so this task is purely additive/safe.
 *
 * Scope (prototype): npm only. npm installs real files, so a copied tree is portable
 * across agents. pnpm symlinks into a store that wouldn't be restored, so it's left
 * to the existing lazy path for now.
 */
import { execSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const PACKAGE_MANAGERS = ['npm'];
const SCOPE = 'proj';
const listenAddress = 'localhost';
const port = process.env.NX_LOCAL_REGISTRY_PORT ?? '4873';
const registry = `http://${listenAddress}:${port}`;
const authToken = 'secretVerdaccioToken';
const outputRoot = resolve(process.cwd(), 'dist/local-registry/proj-backup');

await waitForRegistry();

// Point package managers at the local verdaccio, with a fresh cache (same policy as
// global-setup: avoid serving a stale `nx@X.Y.Z` that was republished with new bits).
process.env.npm_config_registry = registry;
process.env[`npm_config_//${listenAddress}:${port}/:_authToken`] = authToken;
const cacheDir = mkdtempSync(join(tmpdir(), 'nx-e2e-base-cache-'));
process.env.npm_config_cache = join(cacheDir, 'npm');
process.env.NX_SKIP_PROVENANCE_CHECK = 'true';
process.env.CI = 'true';
// The nx packages were just published to verdaccio (publish date = now). A user's
// ~/.npmrc `min-release-age` would filter them out as "too fresh" and fail to resolve
// create-nx-workspace. Bypass it (harmless in CI, where it isn't set).
process.env.npm_config_min_release_age = '0';

const version =
  process.env.PUBLISHED_VERSION ||
  execSync('npm view nx@latest version', { encoding: 'utf-8' }).trim();
console.log(
  `Building e2e base workspace(s) with create-nx-workspace@${version} -> ${outputRoot}`
);

for (const pm of PACKAGE_MANAGERS) {
  const work = mkdtempSync(join(tmpdir(), `nx-e2e-base-${pm}-`));
  // Mirror the essential flags runCreateWorkspace() uses for { preset: 'apps' }.
  const command = [
    `npx --yes create-nx-workspace@${version} ${SCOPE}`,
    `--preset=apps`,
    `--package-manager=${pm}`,
    `--no-interactive`,
    `--linter=eslint`,
    `--formatter=prettier`,
    `--nxCloud=skip`,
  ].join(' ');

  execSync(command, { cwd: work, stdio: 'inherit', env: process.env });

  const projDir = join(work, SCOPE);
  // Stop the daemon so the cached copy doesn't carry a live socket/pid.
  try {
    execSync('npx nx reset', { cwd: projDir, stdio: 'pipe', env: process.env });
  } catch {
    // best-effort; a missing daemon is fine
  }

  const dest = join(outputRoot, pm);
  rmSync(dest, { recursive: true, force: true });
  cpSync(projDir, dest, { recursive: true });
  rmSync(work, { recursive: true, force: true });
  console.log(`Wrote base workspace template: ${dest}`);
}

async function waitForRegistry() {
  for (;;) {
    try {
      const response = await fetch(registry);
      if (response.ok) {
        return;
      }
    } catch {
      // not up yet
    }
    console.log(`Waiting for local registry on ${registry}...`);
    await new Promise((res) => setTimeout(res, 250));
  }
}
