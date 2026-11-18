// Runs a browser testing tool's install command for the version generated
// workspaces get (its Nx generator's range), before the e2e suites run. Holds
// the lock e2e/utils/ensure-browser-installation.ts takes for that tool.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Keyed by npm package name.
const TOOLS = {
  playwright: {
    name: 'Playwright',
    versionsFile: 'packages/playwright/src/utils/versions.ts',
    versionConstant: 'playwrightVersion',
    // Headless runs use Chromium's headless shell, so full Chromium is skipped.
    installArgs:
      process.env.PLAYWRIGHT_INSTALL_ARGS || '--with-deps --only-shell',
  },
};

const packageName = process.argv[2];
const tool = TOOLS[packageName];
if (!tool) {
  throw new Error(
    `Usage: node scripts/e2e-browser-install.mjs <${Object.keys(TOOLS).join('|')}>`
  );
}

// Matches the e2e-run check in e2e/utils/ensure-browser-installation.ts, which
// installs the system packages itself when this skips.
if (process.env.NX_E2E_RUN_E2E !== 'true') {
  console.log('Skipping: NX_E2E_RUN_E2E is not set to true.');
} else {
  const require = createRequire(import.meta.url);
  const { FileLock } = require('nx/src/native');
  const { maxSatisfying, satisfies } = require('semver');

  const repoRoot = fileURLToPath(new URL('..', import.meta.url));
  const versionsFile = new URL(`../${tool.versionsFile}`, import.meta.url);
  const range = readFileSync(versionsFile, 'utf-8').match(
    new RegExp(`\\b${tool.versionConstant} = '([^']+)'`)
  )?.[1];
  if (!range) {
    throw new Error(
      `No ${tool.versionConstant} found in ${versionsFile.pathname}.`
    );
  }
  // Verdaccio's uplink, which generated workspaces resolve through. The inherited
  // registry can point at a local one that is not running yet.
  const registry = 'https://registry.npmjs.org/';
  const { versions, 'dist-tags': distTags } = JSON.parse(
    execSync(
      `npm view --registry=${registry} ${packageName} versions dist-tags --json`,
      { encoding: 'utf-8' }
    )
  );
  // npm, pnpm and Yarn Classic install the `latest` tag when it satisfies the
  // range. dlx reuses its cached resolution of a range, so pass an exact version.
  const workspaceVersion = satisfies(distTags.latest, range)
    ? distTags.latest
    : maxSatisfying(versions, range);
  if (!workspaceVersion) {
    throw new Error(`No published ${tool.name} version satisfies ${range}.`);
  }

  const lock = new FileLock(
    join(homedir(), '.cache', 'nx-e2e-locks', `${packageName}-install.lock`)
  );
  if (!lock.tryLock()) {
    console.log(`Waiting for another ${tool.name} installation...`);
    lock.lock();
  }
  try {
    console.log(
      `Installing ${tool.name} ${workspaceVersion} for generated workspaces.`
    );
    // pnpm reads the .npmrc in cwd, so run from the repo root, not a shared temp
    // dir. --ignore-workspace skips the repo's pnpm-workspace.yaml (overrides),
    // which generated workspaces don't read either.
    execSync(
      `pnpm --ignore-workspace --registry=${registry} dlx ${packageName}@${workspaceVersion} install ${tool.installArgs}`,
      {
        stdio: 'inherit',
        cwd: repoRoot,
        env: {
          ...process.env,
          // Generated workspaces install with release-age gates off. The
          // uppercase name wins over an inherited lowercase one.
          PNPM_CONFIG_MINIMUM_RELEASE_AGE: '0',
          // dlx reuses a cached install of a version whatever overrides built
          // it, so use a cache only this script fills.
          PNPM_CONFIG_CACHE_DIR: join(
            repoRoot,
            'node_modules/.cache/e2e-browser-install'
          ),
        },
      }
    );
  } finally {
    lock.unlock();
  }
}
