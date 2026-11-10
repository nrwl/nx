// Installs Playwright browsers and system packages before the e2e suites run,
// holding the lock e2e/utils/ensure-browser-installation.ts takes. Two versions
// are installed: the root one, which some suites launch in-process, and the one
// the @nx/playwright generator's range resolves to, which generated workspaces use.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Matches the e2e-run check in e2e/utils/ensure-browser-installation.ts, which
// installs the system packages itself when this skips.
if (process.env.NX_E2E_RUN_E2E !== 'true') {
  console.log('Skipping: NX_E2E_RUN_E2E is not set to true.');
} else {
  const require = createRequire(import.meta.url);
  const { FileLock } = require('nx/src/native');
  const { maxSatisfying } = require('semver');

  const versionsFile = new URL(
    '../packages/playwright/src/utils/versions.ts',
    import.meta.url
  );
  const range = readFileSync(versionsFile, 'utf-8').match(
    /playwrightVersion = '([^']+)'/
  )?.[1];
  if (!range) {
    throw new Error(`No playwrightVersion found in ${versionsFile.pathname}.`);
  }
  // Verdaccio's uplink, which generated workspaces resolve through. The inherited
  // registry can point at a local one that is not running yet.
  const registry = 'https://registry.npmjs.org/';
  // npx runs the root install for any range it satisfies, so pass an exact version.
  const workspaceVersion = maxSatisfying(
    [].concat(
      JSON.parse(
        execSync(
          `npm view --registry=${registry} "playwright@${range}" version --json`,
          { encoding: 'utf-8' }
        )
      )
    ),
    range
  );
  if (!workspaceVersion) {
    throw new Error(`No published Playwright version satisfies ${range}.`);
  }

  const installArgs = process.env.PLAYWRIGHT_INSTALL_ARGS || '--with-deps';
  const lock = new FileLock(
    join(tmpdir(), 'nx-e2e-locks', 'playwright-install.lock')
  );
  if (!lock.tryLock()) {
    console.log('Waiting for another Playwright installation...');
    lock.lock();
  }
  try {
    execSync(`npx playwright install ${installArgs}`, { stdio: 'inherit' });
    console.log(
      `Installing Playwright ${workspaceVersion} for generated workspaces.`
    );
    execSync(
      `npx --registry=${registry} -y playwright@${workspaceVersion} install ${installArgs}`,
      { stdio: 'inherit' }
    );
  } finally {
    lock.unlock();
  }
}
