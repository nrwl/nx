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
 * The consumer side is `newProject()` in e2e/utils/create-project-utils.ts: it
 * looks for <package-manager>/<preset> and seeds the per-test workspace from it
 * instead of running create-nx-workspace. A missing directory is not an error —
 * newProject falls back to its original lazy build.
 *
 * The whole package-manager × preset matrix is built in parallel so no call site
 * has to fall back. pnpm and yarn link node_modules into a store outside the
 * workspace; newProject already reinstalls after copying such a workspace to
 * relink it, so a copied tree only has to be good enough for that reinstall.
 */
import { execSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Every package manager newProject() can be asked for: most call sites take
// getSelectedPackageManager(), the rest either pin one or iterate all four
// (see affected-auto-lockfile.test.ts). Building the full matrix means no call
// site pays create-nx-workspace. Not keyed on SELECTED_PM -- the output is the
// same whatever the agent selects, so keying it would only split the cache.
const PACKAGE_MANAGERS = ['npm', 'pnpm', 'yarn', 'bun'];
// The only presets newProject() is ever given: of its 208 call sites, 183 use
// `apps` (nearly all by defaulting to it) and 25 use `ts`. The long-tail presets
// (react-standalone, nuxt, angular-*) only reach create-nx-workspace through
// runCreateWorkspace(), which the workspace-create suites use deliberately to
// exercise the real thing and which this template must not replace.
const PRESETS = ['apps', 'ts'];
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
console.log(
  `Package managers: ${PACKAGE_MANAGERS.join(', ')} | presets: ${PRESETS.join(', ')}`
);

const combos = PACKAGE_MANAGERS.flatMap((pm) =>
  PRESETS.map((preset) => ({ pm, preset }))
);
const results = await Promise.allSettled(combos.map((c) => buildTemplate(c)));

const failures = combos
  .map((c, i) => [c, results[i]])
  .filter(([, r]) => r.status === 'rejected');
for (const [{ pm, preset }, r] of failures) {
  console.error(
    `Failed to build the ${pm}/${preset} base workspace:`,
    r.reason
  );
}
if (failures.length === combos.length) {
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

/** @param {{ pm: string, preset: string }} combo */
async function buildTemplate({ pm, preset }) {
  const slug = `${pm}-${preset}`;
  const work = mkdtempSync(join(tmpdir(), `nx-e2e-base-${slug}-`));
  const cacheRoot = mkdtempSync(join(tmpdir(), `nx-e2e-base-cache-${slug}-`));
  const env = registryEnv(cacheRoot);

  // Mirror the flags runCreateWorkspace() defaults to for { preset: 'apps' };
  // a template built with different flags would silently diverge from the
  // workspaces the fallback path produces.
  const command = [
    `npx --yes create-nx-workspace@${version} ${SCOPE}`,
    `--preset=${preset}`,
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

    const dest = join(outputRoot, pm, preset);
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
