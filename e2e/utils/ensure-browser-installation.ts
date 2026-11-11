import { execSync } from 'node:child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { FileLock } from 'nx/src/native';
import { tmpProjPath } from './create-project-utils';
import { e2eConsoleLogger } from './log-utils';
import { isVerbose } from './get-env-info';

// Locks that keep `npx playwright install` runs on the same machine from
// overlapping. With `--with-deps`, overlapping runs make `apt` fail on Linux.
const LOCK_DIR = join(tmpdir(), 'nx-e2e-locks');
// scripts/playwright-install-e2e.mjs takes the same lock.
const PLAYWRIGHT_LOCK_FILE = join(LOCK_DIR, 'playwright-install.lock');
// Cypress needs the same treatment: it unzips into one cache directory shared by
// everything on the machine, and a second install clears that directory while the
// first is still unzipping into it.
const CYPRESS_LOCK_FILE = join(LOCK_DIR, 'cypress-install.lock');

/**
 * `fn` must stay synchronous: if it awaited, a second caller in the same process
 * would block the thread in `lock()` and the holder could never release it.
 */
function withInstallLock(lockFile: string, toolName: string, fn: () => void) {
  const lock = new FileLock(lockFile);
  if (!lock.tryLock()) {
    e2eConsoleLogger(
      `Process ${process.pid} waiting for another ${toolName} installation...`
    );
    lock.lock();
  }
  try {
    fn();
  } finally {
    lock.unlock();
  }
}

export async function ensureCypressInstallation() {
  // Nothing runs Cypress unless e2e tests are enabled, and the binary is not
  // fetched while workspaces install in that case, so pulling it here would
  // download and unzip ~100MB that no test is going to use.
  if (process.env.NX_E2E_RUN_E2E !== 'true') {
    return;
  }

  // Only one process on the machine may unzip into the Cypress cache at a time,
  // for the same reason Playwright installs are serialized below.
  withInstallLock(CYPRESS_LOCK_FILE, 'Cypress', () => {
    try {
      // No-op when the binary is installed. `cypress run` smoke-tests it on first
      // use, so this skips `cypress verify`, which always reruns that test.
      execSync('npx cypress install', {
        stdio: isVerbose() ? 'inherit' : 'pipe',
        encoding: 'utf-8',
        cwd: tmpProjPath(),
        // The binary is skipped while workspaces are installed, so this call
        // has to be allowed to fetch it.
        env: { ...process.env, CYPRESS_INSTALL_BINARY: undefined },
      });
    } catch (error) {
      e2eConsoleLogger('Failed to install Cypress:', error);
      throw error;
    }
  });
}

export function ensurePlaywrightBrowsersInstallation() {
  withInstallLock(PLAYWRIGHT_LOCK_FILE, 'Playwright', () => {
    e2eConsoleLogger(
      `Process ${process.pid} acquired lock, installing Playwright browsers...`
    );

    // scripts/playwright-install-e2e.mjs, a dependency of these specs, installs
    // the system packages first, but only when NX_E2E_RUN_E2E is 'true'. Both
    // install only Chromium's headless shell, which headless runs use.
    const playwrightInstallArgs =
      process.env.PLAYWRIGHT_INSTALL_ARGS ||
      (process.env.NX_E2E_RUN_E2E === 'true'
        ? '--only-shell'
        : '--with-deps --only-shell');

    try {
      execSync(`npx playwright install ${playwrightInstallArgs}`, {
        stdio: isVerbose() ? 'inherit' : 'pipe',
        encoding: 'utf-8',
        cwd: tmpProjPath(),
      });

      const version = execSync('npx playwright --version', {
        cwd: tmpProjPath(),
      })
        .toString()
        .trim();

      e2eConsoleLogger(
        `Playwright browsers ${version} installed successfully.`
      );
    } catch (error) {
      e2eConsoleLogger('Failed to install Playwright browsers:', error);
      throw error;
    }
  });
}
