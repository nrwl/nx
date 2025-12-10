import { installPackageToTmpAsync } from '../../devkit-internals';
import { homedir } from 'os';
import {
  canInstallNxConsole,
  installNxConsole,
  NxConsolePreferences,
} from '../../native';
import { serverLogger } from './logger';

// Module-level state - persists across invocations within daemon lifecycle
let latestNxTmpPath: string | null = null;
let cleanupFn: (() => void) | null = null;

const log = (...messageParts: unknown[]) => {
  serverLogger.log('[NX-CONSOLE]:', ...messageParts);
};

/**
 * Gets the Nx Console status (whether we should prompt the user to install).
 * Uses latest Nx version if available, falls back to local implementation.
 *
 * @returns boolean indicating whether we should prompt the user
 */
export async function getNxConsoleStatus({
  inner,
}: {
  inner?: boolean;
} = {}): Promise<boolean> {
  // Use local implementation if explicitly requested
  if (process.env.NX_USE_LOCAL === 'true' || inner === true) {
    log('Using local implementation (NX_USE_LOCAL=true or inner call)');
    return await getNxConsoleStatusImpl();
  }

  try {
    // If we don't have a tmp path yet, pull latest Nx
    if (latestNxTmpPath === null) {
      log('Pulling latest Nx (latest) to check console status...');
      const packageInstallResults = await installPackageToTmpAsync(
        'nx',
        'latest'
      );
      latestNxTmpPath = packageInstallResults.tempDir;
      cleanupFn = packageInstallResults.cleanup;
      log('Successfully pulled latest Nx to', latestNxTmpPath);
    } else {
      log('Reusing cached Nx installation from', latestNxTmpPath);
    }

    // Try to use the cached tmp path
    const modulePath = require.resolve(
      'nx/src/daemon/server/nx-console-operations.js',
      { paths: [latestNxTmpPath] }
    );

    const module = await import(modulePath);
    const result = await module.getNxConsoleStatus({ inner: true });
    log('Console status check completed, shouldPrompt:', result);
    return result;
  } catch (error) {
    // If tmp path failed (e.g., directory was deleted), fall back to local immediately
    log(
      'Failed to use latest Nx, falling back to local implementation. Error:',
      error.message
    );
    return await getNxConsoleStatusImpl();
  }
}

/**
 * Handles user preference submission and installs Nx Console if requested.
 * Uses latest Nx version if available, falls back to local implementation.
 *
 * @param preference - whether the user wants to install Nx Console
 * @returns object indicating whether installation succeeded
 */
export async function handleNxConsolePreferenceAndInstall({
  preference,
  inner,
}: {
  preference: boolean;
  inner?: boolean;
}): Promise<{ installed: boolean }> {
  log('Handling user preference:', preference);

  // Use local implementation if explicitly requested
  if (process.env.NX_USE_LOCAL === 'true' || inner === true) {
    log('Using local implementation (NX_USE_LOCAL=true or inner call)');
    return await handleNxConsolePreferenceAndInstallImpl(preference);
  }

  try {
    // If we don't have a tmp path yet, pull latest Nx
    if (latestNxTmpPath === null) {
      log('Pulling latest Nx (latest) to handle preference and install...');
      const packageInstallResults = await installPackageToTmpAsync(
        'nx',
        'latest'
      );
      latestNxTmpPath = packageInstallResults.tempDir;
      cleanupFn = packageInstallResults.cleanup;
      log('Successfully pulled latest Nx to', latestNxTmpPath);
    } else {
      log('Reusing cached Nx installation from', latestNxTmpPath);
    }

    // Try to use the cached tmp path
    const modulePath = require.resolve(
      'nx/src/daemon/server/nx-console-operations.js',
      { paths: [latestNxTmpPath] }
    );

    const module = await import(modulePath);
    const result = await module.handleNxConsolePreferenceAndInstall({
      preference,
      inner: true,
    });
    log(
      'Preference saved and installation',
      result.installed ? 'succeeded' : 'skipped/failed'
    );
    return result;
  } catch (error) {
    // If tmp path failed (e.g., directory was deleted), fall back to local immediately
    log(
      'Failed to use latest Nx, falling back to local implementation. Error:',
      error.message
    );
    return await handleNxConsolePreferenceAndInstallImpl(preference);
  }
}

/**
 * Clean up the latest Nx installation on daemon shutdown.
 */
export function cleanupLatestNxInstallation(): void {
  if (cleanupFn) {
    log('Cleaning up latest Nx installation from', latestNxTmpPath);
    cleanupFn();
  }
  latestNxTmpPath = null;
  cleanupFn = null;
}

export async function getNxConsoleStatusImpl(): Promise<boolean> {
  // If no cached preference, read from disk
  const preferences = new NxConsolePreferences(homedir());
  const preference = preferences.getAutoInstallPreference();

  const canInstallConsole = canInstallNxConsole();

  // If user previously opted in but extension is not installed,
  // they must have manually uninstalled it - respect that choice
  if (preference === true && canInstallConsole) {
    const preferences = new NxConsolePreferences(homedir());
    preferences.setAutoInstallPreference(false);
    return false; // Don't prompt
  }

  // Noop if can't install
  if (!canInstallConsole) {
    return false;
  }

  // Prompt if we can install and user hasn't answered yet
  return typeof preference !== 'boolean';
}

export async function handleNxConsolePreferenceAndInstallImpl(
  preference: boolean
): Promise<{ installed: boolean }> {
  const preferences = new NxConsolePreferences(homedir());
  preferences.setAutoInstallPreference(preference);

  let installed = false;
  if (preference) {
    installed = installNxConsole();
  }

  return { installed };
}
