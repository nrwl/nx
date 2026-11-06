import { execSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
  openSync,
  closeSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { tmpProjPath } from './create-project-utils';
import { e2eConsoleLogger } from './log-utils';
import { isVerbose } from './get-env-info';
import { probeCommandEnd, probeCommandStart } from './pressure-probe';

// Helper files to prevent multiple `npx playwright install` on the same machine.
// Doing so will cause `apt` to fail on Linux machines.
const LOCK_DIR = join(tmpdir(), 'nx-e2e-locks');
const PLAYWRIGHT_LOCK_FILE = join(LOCK_DIR, 'playwright-install.lock');
const PLAYWRIGHT_STATUS_FILE = join(LOCK_DIR, 'playwright-install.status');
// Cypress needs the same treatment: it unzips into one cache directory shared by
// everything on the machine, and a second install clears that directory while the
// first is still unzipping into it.
const CYPRESS_LOCK_FILE = join(LOCK_DIR, 'cypress-install.lock');
const CYPRESS_STATUS_FILE = join(LOCK_DIR, 'cypress-install.status');
const POLL_INTERVAL_MS = 5000;
const MAX_WAIT_MS = 5 * 60 * 1000;

interface InstallStatus {
  status: 'installing' | 'success' | 'failed';
  pid: number;
  timestamp: number;
  error?: string;
}

function ensureLockDir() {
  if (!existsSync(LOCK_DIR)) {
    mkdirSync(LOCK_DIR, { recursive: true });
  }
}

/**
 * A process that is killed mid-install leaves its lock behind, and every later
 * process would then wait out the full timeout for an install that is never
 * coming. Treat a lock as abandoned once its holder is gone.
 */
function isStaleLock(statusFile: string): boolean {
  const status = readInstallStatus(statusFile);
  if (!status) {
    return true;
  }
  if (status.status !== 'installing') {
    return true;
  }
  try {
    // Signal 0 checks that the process exists without touching it.
    process.kill(status.pid, 0);
    return false;
  } catch {
    return true;
  }
}

function tryAcquireLock(lockFile: string, statusFile: string): boolean {
  ensureLockDir();

  if (existsSync(lockFile) && isStaleLock(statusFile)) {
    e2eConsoleLogger('Reclaiming an abandoned browser installation lock.');
    try {
      unlinkSync(lockFile);
    } catch {
      // Another process got there first, which is just as good.
    }
  }

  try {
    // Atomic operation - fails if file exists
    const fd = openSync(lockFile, 'wx');
    closeSync(fd);

    const status: InstallStatus = {
      status: 'installing',
      pid: process.pid,
      timestamp: Date.now(),
    };
    writeFileSync(statusFile, JSON.stringify(status));

    return true;
  } catch (err) {
    if (err.code === 'EEXIST') {
      return false; // Lock already held
    }
    throw err; // Unexpected error
  }
}

function releaseLock(
  lockFile: string,
  statusFile: string,
  success: boolean,
  error?: string
) {
  try {
    const status: InstallStatus = {
      status: success ? 'success' : 'failed',
      pid: process.pid,
      timestamp: Date.now(),
      error: error,
    };
    writeFileSync(statusFile, JSON.stringify(status));
  } finally {
    try {
      unlinkSync(lockFile);
    } catch {
      // Best effort
    }
  }
}

function readInstallStatus(statusFile: string): InstallStatus | null {
  try {
    if (!existsSync(statusFile)) {
      return null;
    }
    const content = readFileSync(statusFile, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function waitForInstallation(
  lockFile: string,
  statusFile: string,
  toolName: string
): Promise<'installed' | 'abandoned'> {
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_WAIT_MS) {
    // Check if lock is released
    if (!existsSync(lockFile)) {
      const status = readInstallStatus(statusFile);

      if (status?.status === 'success') {
        e2eConsoleLogger(`${toolName} installed by process ${status.pid}`);
        return 'installed';
      }

      if (status?.status === 'failed') {
        const errorMsg = `${toolName} installation failed in process ${
          status.pid
        }: ${status.error || 'Unknown error'}`;
        e2eConsoleLogger(errorMsg);
        throw new Error(errorMsg);
      }
    } else if (isStaleLock(statusFile)) {
      // Whoever held the lock is gone, so waiting on them is pointless.
      return 'abandoned';
    }

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`Timeout waiting for ${toolName} installation to complete`);
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
  if (!tryAcquireLock(CYPRESS_LOCK_FILE, CYPRESS_STATUS_FILE)) {
    e2eConsoleLogger(
      `Process ${process.pid} waiting for Cypress installation...`
    );
    const waitProbe = probeCommandStart(
      'cypressWait',
      'wait for Cypress lock',
      tmpProjPath()
    );
    let outcome: Awaited<ReturnType<typeof waitForInstallation>>;
    try {
      outcome = await waitForInstallation(
        CYPRESS_LOCK_FILE,
        CYPRESS_STATUS_FILE,
        'Cypress'
      );
      probeCommandEnd(waitProbe);
    } catch (e) {
      probeCommandEnd(waitProbe, e, String(e?.message ?? e));
      throw e;
    }
    if (outcome === 'installed') {
      return;
    }
    // The lock was abandoned, so try once more to do the install here.
    if (!tryAcquireLock(CYPRESS_LOCK_FILE, CYPRESS_STATUS_FILE)) {
      return;
    }
  }

  try {
    let cypressVerified = true;
    const verifyProbe = probeCommandStart(
      'cypressVerify',
      'npx cypress verify',
      tmpProjPath()
    );
    try {
      const r = execSync('npx cypress verify', {
        stdio: isVerbose() ? 'inherit' : 'pipe',
        encoding: 'utf-8',
        cwd: tmpProjPath(),
      });
      probeCommandEnd(verifyProbe);
      if (r.indexOf('Verified Cypress!') === -1) {
        cypressVerified = false;
      }
    } catch (e) {
      probeCommandEnd(verifyProbe, e);
      cypressVerified = false;
    }

    if (!cypressVerified) {
      e2eConsoleLogger('Cypress was not verified. Installing Cypress now.');
      const installProbe = probeCommandStart(
        'cypressInstall',
        'npx cypress install',
        tmpProjPath()
      );
      try {
        execSync('npx cypress install', {
          stdio: isVerbose() ? 'inherit' : 'pipe',
          encoding: 'utf-8',
          cwd: tmpProjPath(),
          // The binary is skipped while workspaces are installed, so this call
          // has to be allowed to fetch it.
          env: { ...process.env, CYPRESS_INSTALL_BINARY: undefined },
        });
        probeCommandEnd(installProbe);
      } catch (e) {
        probeCommandEnd(installProbe, e, `${e?.stdout}\n\n${e?.stderr}`);
        throw e;
      }
    }

    releaseLock(CYPRESS_LOCK_FILE, CYPRESS_STATUS_FILE, true);
  } catch (error) {
    e2eConsoleLogger('Failed to install Cypress:', error);
    releaseLock(CYPRESS_LOCK_FILE, CYPRESS_STATUS_FILE, false, error.message);
    throw error;
  }
}

export async function ensurePlaywrightBrowsersInstallation() {
  // If lock is acquired, perform installation, otherwise it must in progress or already done
  if (tryAcquireLock(PLAYWRIGHT_LOCK_FILE, PLAYWRIGHT_STATUS_FILE)) {
    // We got the lock - we're responsible for installation
    e2eConsoleLogger(
      `Process ${process.pid} acquired lock, installing Playwright browsers...`
    );

    const playwrightInstallArgs =
      process.env.PLAYWRIGHT_INSTALL_ARGS || '--with-deps';

    const installProbe = probeCommandStart(
      'playwrightInstall',
      `npx playwright install ${playwrightInstallArgs}`,
      tmpProjPath()
    );
    try {
      execSync(`npx playwright install ${playwrightInstallArgs}`, {
        stdio: isVerbose() ? 'inherit' : 'pipe',
        encoding: 'utf-8',
        cwd: tmpProjPath(),
      });
      probeCommandEnd(installProbe);

      const version = execSync('npx playwright --version').toString().trim();

      e2eConsoleLogger(
        `Playwright browsers ${version} installed successfully.`
      );

      releaseLock(PLAYWRIGHT_LOCK_FILE, PLAYWRIGHT_STATUS_FILE, true);
    } catch (error) {
      probeCommandEnd(
        installProbe,
        error,
        `${error?.stdout}\n\n${error?.stderr}`
      );
      e2eConsoleLogger('Failed to install Playwright browsers:', error);
      releaseLock(
        PLAYWRIGHT_LOCK_FILE,
        PLAYWRIGHT_STATUS_FILE,
        false,
        error.message
      );
      throw error;
    }
  } else {
    e2eConsoleLogger(
      `Process ${process.pid} waiting for Playwright browser installation...`
    );
    const waitProbe = probeCommandStart(
      'playwrightWait',
      'wait for Playwright lock',
      tmpProjPath()
    );
    try {
      await waitForInstallation(
        PLAYWRIGHT_LOCK_FILE,
        PLAYWRIGHT_STATUS_FILE,
        'Playwright'
      );
      probeCommandEnd(waitProbe);
    } catch (e) {
      probeCommandEnd(waitProbe, e, String(e?.message ?? e));
      throw e;
    }
  }
}
