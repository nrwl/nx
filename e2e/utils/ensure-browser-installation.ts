import { execSync, spawnSync } from 'node:child_process';
import { homedir } from 'os';
import { join } from 'path';
import { FileLock } from 'nx/src/native';
import { tmpProjPath } from './create-project-utils';
import { e2eConsoleLogger } from './log-utils';
import { isVerbose } from './get-env-info';

// Locks that keep one user's `npx playwright install` runs from overlapping.
// With `--with-deps`, overlapping runs make `apt` fail on Linux. They live in
// the home directory so another user can't block or hold them.
// scripts/e2e-browser-install.mjs takes the same locks.
const LOCK_DIR = join(homedir(), '.cache', 'nx-e2e-locks');
const PLAYWRIGHT_LOCK_FILE = join(LOCK_DIR, 'playwright-install.lock');
// Cypress needs the same treatment: it unzips into one cache directory per user,
// and a second install clears that directory while the first is still unzipping
// into it.
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
  // Nothing runs Cypress unless e2e tests are enabled, so pulling the binary
  // here would download and unzip ~100MB that no test is going to use.
  if (process.env.NX_E2E_RUN_E2E !== 'true') {
    return;
  }

  // Only one process may unzip into the user's Cypress cache at a time,
  // for the same reason Playwright installs are serialized below.
  withInstallLock(CYPRESS_LOCK_FILE, 'Cypress', () => {
    // No-op when the binary is installed. `cypress run` smoke-tests it on first
    // use, so this skips `cypress verify`, which always reruns that test.
    // One pipe for both streams keeps the output in the order it was printed.
    const { status, signal, error, stdout } = spawnSync(
      'npx cypress install 2>&1',
      {
        shell: true,
        encoding: 'utf-8',
        cwd: tmpProjPath(),
        // Workspace installs skip the binary, so this call installs it from the
        // developer's source that global-setup.ts saved, or from the default.
        env: {
          ...process.env,
          CYPRESS_INSTALL_BINARY: process.env.NX_E2E_CYPRESS_INSTALL_BINARY,
        },
      }
    );
    // Cypress prints its binary source, which can be a URL with credentials.
    const output = redactUrlCredentials(stdout ?? '');
    if (status !== 0) {
      const reason = error?.message ?? `exit code ${status ?? signal}`;
      e2eConsoleLogger(`Failed to install Cypress (${reason}):`, output);
      throw new Error(`Failed to install Cypress (${reason}).`);
    }
    if (isVerbose()) {
      process.stdout.write(output);
    }
  });
}

function redactUrlCredentials(text: string) {
  return text
    .replace(/(https?:\/\/)[^\s/?#]*@/gi, '$1***@')
    .replace(/(https?:\/\/[^\s?#]*)\?[^\s#]*/gi, '$1?***');
}

export function ensurePlaywrightBrowsersInstallation() {
  withInstallLock(PLAYWRIGHT_LOCK_FILE, 'Playwright', () => {
    e2eConsoleLogger(
      `Process ${process.pid} acquired lock, installing Playwright browsers...`
    );

    // scripts/e2e-browser-install.mjs, a dependency of these specs, installs
    // the system packages first, but only when NX_E2E_RUN_E2E is 'true'. Both
    // skip full Chromium, since headless runs use its headless shell.
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
