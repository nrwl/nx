import { logger, type ExecutorContext } from '@nx/devkit';
import {
  FileLock,
  IS_WASM,
  isCI,
  quoteShellArg,
  runCommandsExecutor,
} from '@nx/devkit/internal';
import { spawnSync } from 'node:child_process';
import { accessSync, constants, existsSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import {
  installedPlaywrightIsBelow,
  installedPlaywrightVersion,
} from '../../utils/installed-playwright';
import type { Schema } from './schema';

// The first version whose `install-deps --dry-run` exits non-zero when a
// package is missing. Older versions print the apt command and exit 0.
const minPlaywrightVersionForDepsDryRun = '1.60.0';

const skipOnThisMachine =
  'To skip the install on this machine, set PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1.';

export async function installBrowsersExecutor(
  options: Schema,
  context: ExecutorContext
): Promise<{ success: boolean }> {
  const skipReason = getSkipReason();
  if (skipReason) {
    logger.info(`Skipping the Playwright browser install: ${skipReason}.`);
    return { success: true };
  }

  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;
  const projectPath = join(context.root, projectRoot);

  const browsersFolder = getBrowsersFolder(projectPath);
  if (browsersFolder && !canWriteFolder(browsersFolder)) {
    logger.info(
      `Skipping the Playwright browser install: ${browsersFolder} is not writable by this user.`
    );
    return { success: true };
  }

  const lock = IS_WASM ? null : openInstallLock();
  if (lock && !lock.tryLock()) {
    logger.info('Waiting for another Playwright browser install to finish...');
    do {
      await lock.wait();
    } while (!lock.tryLock());
  }

  try {
    const browsers = options.browsers ?? [];
    if (
      shouldInstallSystemPackages(options.withDeps) &&
      !(await installSystemPackages(
        browsers,
        options.withDeps === true,
        projectRoot,
        context
      ))
    ) {
      logger.error(
        `Installing the system packages for the Playwright browsers failed. To skip them, install them another way and set "installBrowsers": { "withDeps": false } in the @nx/playwright/plugin options in nx.json. ${skipOnThisMachine}`
      );
      return { success: false };
    }
    const success = await runPlaywright(
      ['install', ...browsers],
      projectRoot,
      context
    );
    if (!success) {
      logger.error(
        `The Playwright browser install failed. ${skipOnThisMachine} To stop inferring it, set "installBrowsers": false in the @nx/playwright/plugin options in nx.json.`
      );
    }
    return { success };
  } finally {
    lock?.unlock();
  }
}

export default installBrowsersExecutor;

// Installs take turns through this lock: a second apt run fails at once,
// Playwright doesn't lock its apt step, and its folder lock backs off. Linux
// uses /tmp whatever TMPDIR says, because apt's lock covers the whole host.
function openInstallLock(): FileLock | null {
  const lockFile = join(
    process.platform === 'linux' ? '/tmp' : tmpdir(),
    'nx-playwright-install.lock'
  );
  try {
    return new FileLock(lockFile);
  } catch (e) {
    logger.warn(
      `Installing the Playwright browsers without waiting for other installs: could not open ${lockFile}. ${
        e instanceof Error ? e.message : String(e)
      }`
    );
    return null;
  }
}

function getSkipReason(): string | null {
  if (readPlaywrightBooleanEnv('PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD')) {
    return 'PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD is set';
  }
  return null;
}

// Mirrors Playwright's `getFromENV`, which falls back to npm config variables.
function readPlaywrightEnv(name: string): string | undefined {
  return (
    process.env[name] ??
    process.env[`npm_config_${name.toLowerCase()}`] ??
    process.env[`npm_package_config_${name.toLowerCase()}`]
  );
}

// Mirrors Playwright's `getAsBooleanFromENV`.
function readPlaywrightBooleanEnv(name: string): boolean {
  const value = readPlaywrightEnv(name);
  return !!value && value !== 'false' && value !== '0';
}

/**
 * The folder Playwright installs the browsers into, resolved the way
 * Playwright's registry does. `null` when that folder sits inside the
 * installed package or the platform has no default folder.
 */
function getBrowsersFolder(projectPath: string): string | null {
  const configured = readPlaywrightEnv('PLAYWRIGHT_BROWSERS_PATH');
  if (configured === '0') {
    return null;
  }
  const folder = configured || getDefaultBrowsersFolder();
  if (!folder) {
    return null;
  }
  // The install runs from the project folder.
  return isAbsolute(folder)
    ? folder
    : resolve(readPlaywrightEnv('INIT_CWD') || projectPath, folder);
}

function getDefaultBrowsersFolder(): string | null {
  switch (process.platform) {
    case 'linux':
      return join(
        process.env.XDG_CACHE_HOME || join(homedir(), '.cache'),
        'ms-playwright'
      );
    case 'darwin':
      return join(homedir(), 'Library', 'Caches', 'ms-playwright');
    case 'win32':
      return join(
        process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'),
        'ms-playwright'
      );
    default:
      return null;
  }
}

// Playwright creates a missing folder, so the closest existing ancestor
// decides. Against a folder it can't write, Playwright retries its lock for
// about 10 minutes before failing.
function canWriteFolder(folder: string): boolean {
  let existing = folder;
  while (!existsSync(existing)) {
    const parent = dirname(existing);
    if (parent === existing) {
      return false;
    }
    existing = parent;
  }
  try {
    accessSync(existing, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function shouldInstallSystemPackages(withDeps: boolean | undefined): boolean {
  return withDeps ?? (process.platform === 'linux' && !!isCI());
}

// Playwright installs system packages only on Linux and Windows.
async function installSystemPackages(
  browsers: string[],
  withDepsSet: boolean,
  projectRoot: string,
  context: ExecutorContext
): Promise<boolean> {
  switch (process.platform) {
    case 'linux':
      return installLinuxSystemPackages(
        browsers,
        withDepsSet,
        projectRoot,
        context
      );
    case 'win32':
      return runPlaywright(['install-deps', ...browsers], projectRoot, context);
    default:
      return true;
  }
}

async function installLinuxSystemPackages(
  browsers: string[],
  withDepsSet: boolean,
  projectRoot: string,
  context: ExecutorContext
): Promise<boolean> {
  if (
    spawnSync('apt-get', ['--version'], {
      stdio: 'ignore',
      windowsHide: true,
    }).error
  ) {
    logger.info(
      'Skipping the Playwright system packages: Playwright installs them with apt-get, which this machine does not have.'
    );
    return true;
  }
  const version = installedPlaywrightVersion([
    join(context.root, projectRoot),
    context.root,
  ]);
  if (
    version !== null &&
    !installedPlaywrightIsBelow(version, minPlaywrightVersionForDepsDryRun)
  ) {
    // A dry run that passes means every package is already installed, so the
    // apt step and its root requirement are skipped.
    if (
      await runPlaywright(
        ['install-deps', '--dry-run', ...browsers],
        projectRoot,
        context,
        false
      )
    ) {
      return true;
    }
  } else if (!withDepsSet && !canRunAsRootWithoutPassword()) {
    // Without the dry run, apt would run on every install and fail on images
    // that already have the packages but give the user no root access.
    logger.info(
      'Skipping the Playwright system packages: this Playwright version cannot report which ones are missing, and this user cannot run apt-get as root without a password. To install them anyway, set "installBrowsers": { "withDeps": true } in the @nx/playwright/plugin options in nx.json.'
    );
    return true;
  }
  return runPlaywright(['install-deps', ...browsers], projectRoot, context);
}

// Playwright gets root for apt-get through sudo when it exists, and through
// `su root` otherwise, which asks for root's password.
function canRunAsRootWithoutPassword(): boolean {
  return (
    process.getuid?.() === 0 ||
    spawnSync('sudo', ['-n', 'true'], { stdio: 'ignore', windowsHide: true })
      .status === 0
  );
}

// Runs through run-commands from the project folder, like the e2e targets'
// `playwright test`, so both resolve the same `playwright` binary.
async function runPlaywright(
  args: string[],
  projectRoot: string,
  context: ExecutorContext,
  streamOutput = true
): Promise<boolean> {
  const { success } = await runCommandsExecutor(
    {
      command: ['playwright', ...args.map((arg) => quoteShellArg(arg))].join(
        ' '
      ),
      cwd: projectRoot,
      streamOutput,
      __unparsed__: [],
    },
    context
  );
  return success;
}
