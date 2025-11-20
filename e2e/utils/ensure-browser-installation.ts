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

// Helper files to prevent multiple `npx playwright install` on the same machine.
// Doing so will cause `apt` to fail on Linux machines.
const LOCK_DIR = join(tmpdir(), 'nx-e2e-locks');
const PLAYWRIGHT_LOCK_FILE = join(LOCK_DIR, 'playwright-install.lock');
const PLAYWRIGHT_STATUS_FILE = join(LOCK_DIR, 'playwright-install.status');
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

function tryAcquireLock(lockFile: string, statusFile: string): boolean {
  ensureLockDir();
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
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_WAIT_MS) {
    // Check if lock is released
    if (!existsSync(lockFile)) {
      const status = readInstallStatus(statusFile);

      if (status?.status === 'success') {
        e2eConsoleLogger(
          `${toolName} browsers installed by process ${status.pid}`
        );
        return;
      }

      if (status?.status === 'failed') {
        const errorMsg = `${toolName} browser installation failed in process ${
          status.pid
        }: ${status.error || 'Unknown error'}`;
        e2eConsoleLogger(errorMsg);
        throw new Error(errorMsg);
      }
    }

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(
    `Timeout waiting for ${toolName} browser installation to complete`
  );
}

export function ensureCypressInstallation() {
  let cypressVerified = true;
  try {
    const r = execSync('npx cypress verify', {
      stdio: isVerbose() ? 'inherit' : 'pipe',
      encoding: 'utf-8',
      cwd: tmpProjPath(),
    });
    if (r.indexOf('Verified Cypress!') === -1) {
      cypressVerified = false;
    }
  } catch {
    cypressVerified = false;
  } finally {
    if (!cypressVerified) {
      e2eConsoleLogger('Cypress was not verified. Installing Cypress now.');
      execSync('npx cypress install', {
        stdio: isVerbose() ? 'inherit' : 'pipe',
        encoding: 'utf-8',
        cwd: tmpProjPath(),
      });
    }
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

    try {
      execSync(`npx playwright install ${playwrightInstallArgs}`, {
        stdio: isVerbose() ? 'inherit' : 'pipe',
        encoding: 'utf-8',
        cwd: tmpProjPath(),
      });

      const version = execSync('npx playwright --version').toString().trim();

      e2eConsoleLogger(
        `Playwright browsers ${version} installed successfully.`
      );

      releaseLock(PLAYWRIGHT_LOCK_FILE, PLAYWRIGHT_STATUS_FILE, true);
    } catch (error) {
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
    await waitForInstallation(
      PLAYWRIGHT_LOCK_FILE,
      PLAYWRIGHT_STATUS_FILE,
      'Playwright'
    );
  }
}
