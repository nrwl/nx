// @ts-check
/**
 * Pre-build bare e2e base workspaces once, up front, so the atomized `e2e-ci--*`
 * tasks don't each pay the ~40-70s `create-nx-workspace` cold start.
 *
 * Runs as the `populate-e2e-base-workspace` task (sibling to
 * `populate-local-registry-storage`). Its output dir is declared as a cached Nx
 * output, so it is restored to every distributed agent the same way the verdaccio
 * storage is. This makes the templates shareable across machines.
 *
 * Each template is written as a tarball, not a directory. The eight installed
 * workspaces hold several hundred thousand files between them, and the cache's
 * artifact walk opens them all, which can exhaust the 256 descriptor limit macOS
 * runners default to (EMFILE). Eight files cost one descriptor each.
 *
 * The consumer side is `newProject()` in e2e/utils/create-project-utils.ts: it
 * looks for <package-manager>-<preset>.tar and extracts the per-test workspace from
 * it instead of running create-nx-workspace. A missing tarball is not an error;
 * newProject falls back to its original lazy build.
 *
 * Matrix entries are built concurrently. Any failed entry fails the task: the output
 * is cached, so a partial set would keep that combination on the lazy fallback on
 * every later cache hit.
 */
import { exec } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { packDirectory } from './tar-utils.mjs';

const execAsync = promisify(exec);

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

// Must resolve to exactly what the specs will install. getPublishedVersion() in
// e2e/utils/get-env-info.ts reads the built nx package; asking the registry for
// `nx@latest` instead returns npmjs' latest, because verdaccio merges upstream
// metadata into the proxied packument. That builds the template on one major and
// leaves the specs adding another on top of it, which strands @nx/js's link to
// @nx/devkit and fails every generator with "Cannot find module '@nx/devkit'".
const version =
  process.env.PUBLISHED_VERSION || readBuiltNxVersion() || 'latest';

console.log(
  `Building e2e base workspaces with create-nx-workspace@${version} -> ${outputRoot}`
);
console.log(
  `Package managers: ${PACKAGE_MANAGERS.join(', ')} | presets: ${PRESETS.join(', ')}`
);

// Corepack fetches a package manager the first time it is used. Do that once per
// manager before fanning out, so concurrent builds don't race on the same download.
for (const pm of PACKAGE_MANAGERS) {
  const cacheRoot = mkdtempSync(join(tmpdir(), `nx-e2e-base-warm-${pm}-`));
  try {
    // cwd must be outside the repo: corepack refuses a manager that does not
    // match the root package.json's packageManager field.
    await execAsync(`${pm} --version`, {
      cwd: cacheRoot,
      env: registryEnv(cacheRoot),
    });
  } catch (e) {
    console.warn(`Could not pre-warm ${pm}: ${e.message.split('\n')[0]}`);
  } finally {
    rmSync(cacheRoot, { recursive: true, force: true });
  }
}

// The declared output is `<pm>-<preset>.tar` and nothing else. Clear the directory
// so a template dropped from the matrix, or a tree left by an older build, can't be
// cached as part of it.
rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });

const combos = PACKAGE_MANAGERS.flatMap((pm) =>
  PRESETS.map((preset) => ({ pm, preset }))
);
const results = await Promise.allSettled(combos.map((c) => buildTemplate(c)));

const failures = combos
  .map((c, i) => [c, results[i]])
  .filter(([, r]) => r.status === 'rejected');
for (const [{ pm, preset }, r] of failures) {
  const { message, stdout, stderr } = r.reason ?? {};
  console.error(
    `Failed to build the ${pm}/${preset} base workspace: ${message}\n` +
      `${String(stdout ?? '').slice(-4000)}\n${String(stderr ?? '').slice(-4000)}`
  );
}
if (failures.length > 0) {
  process.exit(1);
}

/**
 * Drop the vars Nx sets for this task before handing the environment to
 * create-nx-workspace. NODE_PATH and NX_* point back at this repo, so a child nx
 * resolves @nx/devkit and nx to packages/*\/dist instead of the versions it just
 * installed from verdaccio. The template would then be built against unpublished
 * code. Mirrors getStrippedEnvironmentVariables() in e2e/utils/get-env-info.ts,
 * except that NX_ADD_PLUGINS is removed because shared templates always represent
 * the default plugin-inference mode. Legacy callers use the lazy fallback.
 */
function strippedEnv() {
  const allowed = new Set([
    'NX_ISOLATE_PLUGINS',
    'NX_VERBOSE_LOGGING',
    'NX_NATIVE_LOGGING',
    'NX_USE_LOCAL',
  ]);
  // create-nx-workspace swaps presets for GitHub templates when it detects an AI agent.
  const aiAgentVars = new Set([
    'CLAUDECODE',
    'CLAUDE_CODE',
    'OPENCODE',
    'GEMINI_CLI',
    'CURSOR_TRACE_ID',
    'COMPOSER_NO_INTERACTION',
    'REPL_ID',
    'VSCODE_AGENT',
    'CODEX_THREAD_ID',
    'COPILOT_CLI',
    'SUPERSET_AGENT_ID',
  ]);
  return Object.fromEntries(
    Object.entries(process.env).filter(([key]) => {
      if (
        key === 'NODE_PATH' ||
        key === 'JEST_WORKER_ID' ||
        key === 'GITHUB_STEP_SUMMARY'
      )
        return false;
      if (aiAgentVars.has(key)) return false;
      if (key.startsWith('NX_E2E_')) return true;
      return !key.startsWith('NX_') || allowed.has(key);
    })
  );
}

/**
 * Point a package manager at the local verdaccio, with a cache dir of its own so
 * parallel builds don't contend over a shared one.
 * @param {string} cacheRoot
 */
function registryEnv(cacheRoot) {
  return {
    ...strippedEnv(),
    CI: 'true',
    NX_SKIP_PROVENANCE_CHECK: 'true',
    npm_config_registry: registry,
    [`npm_config_//${listenAddress}:${port}/:_authToken`]: authToken,
    npm_config_cache: join(cacheRoot, 'npm'),
    // pnpm resolves an exact version from its own metadata cache without asking
    // the registry, so the global cache serves the previous run's nx@<major>
    // under the same version string. global-setup.ts gives the specs a per-run
    // cache for this reason (#36802); the template needs the same or it is built
    // from stale bits the specs will never install.
    pnpm_config_cache_dir: join(cacheRoot, 'pnpm'),
    // The nx packages were just published to verdaccio (publish date = now). A
    // user's `min-release-age` would filter them out as "too fresh" and fail to
    // resolve create-nx-workspace. Harmless in CI, where it isn't set.
    npm_config_min_release_age: '0',
    // pnpm 11 reads pnpm_config_* rather than npm_config_*.
    pnpm_config_registry: registry,
    [`pnpm_config_//${listenAddress}:${port}/:_authToken`]: authToken,
    pnpm_config_minimum_release_age: '0',
    // yarn and bun ignore the npm_config_ registry; mirrors global-setup.ts.
    YARN_REGISTRY: registry,
    YARN_NPM_REGISTRY_SERVER: registry,
    YARN_UNSAFE_HTTP_WHITELIST: listenAddress,
    YARN_CACHE_FOLDER: join(cacheRoot, 'yarn'),
    YARN_ENABLE_GLOBAL_CACHE: 'false',
    BUN_CONFIG_REGISTRY: registry,
    BUN_CONFIG_TOKEN: authToken,
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
    // Output is captured rather than inherited: concurrent builds would interleave.
    await execAsync(command, { cwd: work, env, maxBuffer: 64 * 1024 * 1024 });

    const projDir = join(work, SCOPE);
    // Stop the daemon so the cached copy doesn't carry a live socket/pid.
    try {
      await execAsync('npx nx reset', {
        cwd: projDir,
        env,
        maxBuffer: 64 * 1024 * 1024,
      });
    } catch {
      // best-effort; a missing daemon is fine
    }

    const dest = join(outputRoot, `${pm}-${preset}.tar`);
    rmSync(dest, { force: true });
    await packDirectory(projDir, dest);
    console.log(`Wrote base workspace template: ${dest}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
    rmSync(cacheRoot, { recursive: true, force: true });
  }
}

/** Mirrors getPublishedVersion() in e2e/utils/get-env-info.ts. */
function readBuiltNxVersion() {
  try {
    return JSON.parse(
      readFileSync(
        resolve(process.cwd(), 'dist/packages/nx/package.json'),
        'utf-8'
      )
    ).version;
  } catch {
    return undefined;
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
