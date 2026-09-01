// @ts-check
/**
 * Pre-build bare e2e base workspaces once, up front, so the atomized `e2e-ci--*`
 * tasks don't each pay the ~40-70s `create-nx-workspace` cold start.
 *
 * Runs as the `populate-e2e-base-workspace` task (sibling to
 * `populate-local-registry-storage`). Its output dir is declared as a cached Nx
 * output, so it is restored to every distributed agent the same way the verdaccio
 * storage is — which is what makes the templates shareable across machines.
 *
 * The consumer side is `newProject()` in e2e/utils/create-project-utils.ts: when a
 * template exists for the selected package manager, it seeds the per-test workspace
 * from it instead of running create-nx-workspace. If the template is absent,
 * newProject falls back to its original lazy build.
 *
 * One template per package manager, built in parallel — the agents run pnpm
 * (.nx/workflows/agents.yaml) while the macOS job runs npm, so npm-only templates
 * would never engage on Linux. pnpm's node_modules symlinks into a store outside
 * the workspace; newProject already reinstalls after copying a pnpm workspace to
 * relink them, so the copied tree only has to be good enough for that reinstall.
 */
import { execSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Only the package manager the specs will actually select. Templates are ~177MB
// each, and every spec but a handful uses getSelectedPackageManager(); suites that
// pass an explicit packageManager just miss the template and take the fallback.
// SELECTED_PM is declared as an input on this task so the cache can't serve an
// npm-built template to a pnpm agent.
const PACKAGE_MANAGERS = [process.env.SELECTED_PM || 'npm'];
const SCOPE = 'proj';
const listenAddress = 'localhost';
const port = process.env.NX_LOCAL_REGISTRY_PORT ?? '4873';
const registry = `http://${listenAddress}:${port}`;
const authToken = 'secretVerdaccioToken';
const outputRoot = resolve(process.cwd(), 'dist/local-registry/proj-backup');

await waitForRegistry();

const version =
  process.env.PUBLISHED_VERSION ||
  execSync('npm view nx@latest version', {
    encoding: 'utf-8',
    env: registryEnv(mkdtempSync(join(tmpdir(), 'nx-e2e-base-probe-'))),
  }).trim();

console.log(
  `Building e2e base workspaces with create-nx-workspace@${version} -> ${outputRoot}`
);
console.log(`Package managers: ${PACKAGE_MANAGERS.join(', ')}`);

const results = await Promise.allSettled(
  PACKAGE_MANAGERS.map((pm) => buildTemplate(pm))
);

const failures = PACKAGE_MANAGERS.map((pm, i) => [pm, results[i]]).filter(
  ([, r]) => r.status === 'rejected'
);
for (const [pm, r] of failures) {
  console.error(`Failed to build the ${pm} base workspace:`, r.reason);
}
if (failures.length === PACKAGE_MANAGERS.length) {
  // Every template failed: the fallback path would silently absorb this and every
  // spec file would pay the cold start again, so fail loudly instead.
  process.exit(1);
}

/**
 * Point a package manager at the local verdaccio, with a cache dir of its own so
 * parallel builds don't contend over a shared one.
 * @param {string} cacheRoot
 */
function registryEnv(cacheRoot) {
  return {
    ...process.env,
    CI: 'true',
    NX_SKIP_PROVENANCE_CHECK: 'true',
    npm_config_registry: registry,
    [`npm_config_//${listenAddress}:${port}/:_authToken`]: authToken,
    npm_config_cache: join(cacheRoot, 'npm'),
    // The nx packages were just published to verdaccio (publish date = now). A
    // user's `min-release-age` would filter them out as "too fresh" and fail to
    // resolve create-nx-workspace. Harmless in CI, where it isn't set.
    npm_config_min_release_age: '0',
    // pnpm 11 reads pnpm_config_* rather than npm_config_*.
    pnpm_config_registry: registry,
    [`pnpm_config_//${listenAddress}:${port}/:_authToken`]: authToken,
    pnpm_config_minimum_release_age: '0',
  };
}

/** @param {string} pm */
async function buildTemplate(pm) {
  const work = mkdtempSync(join(tmpdir(), `nx-e2e-base-${pm}-`));
  const cacheRoot = mkdtempSync(join(tmpdir(), `nx-e2e-base-cache-${pm}-`));
  const env = registryEnv(cacheRoot);

  // Mirror the flags runCreateWorkspace() defaults to for { preset: 'apps' };
  // a template built with different flags would silently diverge from the
  // workspaces the fallback path produces.
  const command = [
    `npx --yes create-nx-workspace@${version} ${SCOPE}`,
    `--preset=apps`,
    `--package-manager=${pm}`,
    `--no-interactive`,
    `--linter=eslint`,
    `--formatter=oxfmt`,
    `--nxCloud=skip`,
  ].join(' ');

  try {
    execSync(command, { cwd: work, stdio: 'inherit', env });

    const projDir = join(work, SCOPE);
    // Stop the daemon so the cached copy doesn't carry a live socket/pid.
    try {
      execSync('npx nx reset', { cwd: projDir, stdio: 'pipe', env });
    } catch {
      // best-effort; a missing daemon is fine
    }

    const dest = join(outputRoot, pm);
    rmSync(dest, { recursive: true, force: true });
    // dereference: false keeps pnpm's relative node_modules symlinks intact.
    cpSync(projDir, dest, { recursive: true, dereference: false });
    console.log(`Wrote base workspace template: ${dest}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
    rmSync(cacheRoot, { recursive: true, force: true });
  }
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
