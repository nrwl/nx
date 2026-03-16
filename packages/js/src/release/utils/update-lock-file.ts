import {
  detectPackageManager,
  getPackageManagerCommand,
  getPackageManagerVersion,
  isWorkspacesEnabled,
  output,
} from '@nx/devkit';
import { execSync } from 'child_process';
import { daemonClient } from 'nx/src/daemon/client/client';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { getLockFileName } from 'nx/src/plugins/js/lock-file/lock-file';
import { gte } from 'semver';

export async function updateLockFile(
  cwd: string,
  {
    dryRun,
    verbose,
    options,
  }: {
    dryRun?: boolean;
    verbose?: boolean;
    options?: {
      skipLockFileUpdate?: boolean;
      installArgs?: string;
      installIgnoreScripts?: boolean;
    };
  }
) {
  if (options?.skipLockFileUpdate) {
    if (verbose) {
      console.log(
        '\nSkipped lock file update because skipLockFileUpdate was set.'
      );
    }
    return [];
  }

  const packageManager = detectPackageManager(cwd);

  if (
    packageManager === 'yarn' &&
    !gte(getPackageManagerVersion(packageManager), '2.0.0')
  ) {
    // yarn classic does not store workspace data in the lock file, so we don't need to update it
    if (verbose) {
      console.log(
        '\nSkipped lock file update because it is not necessary for Yarn Classic.'
      );
    }
    return [];
  }

  const workspacesEnabled = isWorkspacesEnabled(packageManager, cwd);
  if (!workspacesEnabled) {
    if (verbose) {
      console.log(
        `\nSkipped lock file update because ${packageManager} workspaces are not enabled.`
      );
    }
    return [];
  }

  const isDaemonEnabled = daemonClient.enabled();
  if (!dryRun && isDaemonEnabled) {
    // if not in dry-run temporarily stop the daemon, as it will error if the lock file is updated
    await daemonClient.stop();
  }

  const packageManagerCommands = getPackageManagerCommand(packageManager);

  let installArgs = options?.installArgs || '';

  output.logSingleLine(`Updating ${packageManager} lock file`);

  let env: object = {};

  if (options?.installIgnoreScripts) {
    if (packageManager === 'yarn') {
      env = { YARN_ENABLE_SCRIPTS: 'false' };
    } else {
      // npm and pnpm use the same --ignore-scripts option
      installArgs = `${installArgs} --ignore-scripts`.trim();
    }
  }

  const lockFile = getLockFileName(packageManager);
  const command =
    `${packageManagerCommands.updateLockFile} ${installArgs}`.trim();

  if (verbose) {
    if (dryRun) {
      console.log(
        `Would update ${lockFile} with the following command, but --dry-run was set:`
      );
    } else {
      console.log(`Updating ${lockFile} with the following command:`);
    }
    console.log(command);
  }

  if (dryRun) {
    return [];
  }

  // Capture modified/untracked files before the lock file update so we can
  // detect everything the package-manager command touches on disk.
  const modifiedBefore = getGitModifiedFiles(cwd);

  execLockFileUpdate(command, cwd, env);

  // Capture again after the command to compute the delta.
  const modifiedAfter = getGitModifiedFiles(cwd);
  const newlyChanged = [...modifiedAfter].filter((f) => !modifiedBefore.has(f));

  // Always include the lock file itself even if git didn't pick it up
  // (e.g. it could be .gitignored in unusual setups).
  if (!newlyChanged.includes(lockFile)) {
    newlyChanged.push(lockFile);
  }

  if (verbose && newlyChanged.length > 1) {
    console.log(`\nDetected additional files changed during lock file update:`);
    newlyChanged
      .filter((f) => f !== lockFile)
      .forEach((f) => console.log(`  ${f}`));
  }

  if (isDaemonEnabled) {
    try {
      await daemonClient.startInBackground();
    } catch (e) {
      // If the daemon fails to start, we don't want to prevent the user from continuing, so we just log the error and move on
      if (verbose) {
        output.warn({
          title:
            'Unable to restart the Nx Daemon. It will be disabled until you run "nx reset"',
          bodyLines: [e.message],
        });
      }
    }
  }

  return newlyChanged;
}

/**
 * Returns the set of modified, added, and untracked file paths reported by git.
 * Used to detect all filesystem side-effects of the lock file update command.
 */
function getGitModifiedFiles(cwd: string): Set<string> {
  try {
    const result = execSync('git status --porcelain', {
      cwd,
      encoding: 'utf-8',
    }).trim();
    if (!result) {
      return new Set();
    }
    return new Set(
      result
        .split('\n')
        .filter((l) => l.trim().length > 0)
        .map((l) => l.substring(3))
    );
  } catch {
    // git may not be available or this may not be a git repo
    return new Set();
  }
}

function execLockFileUpdate(command: string, cwd: string, env: object): void {
  try {
    const LARGE_BUFFER = 1024 * 1000000;
    execSync(command, {
      cwd,
      maxBuffer: LARGE_BUFFER,
      env: {
        ...process.env,
        ...env,
      },
      windowsHide: false,
    });
  } catch (e) {
    output.error({
      title: `Error updating lock file with command '${command}'`,
      bodyLines: [
        `Verify that '${command}' succeeds when run from the workspace root.`,
        `To configure a string of arguments to be passed to this command, set the 'release.version.versionActionsOptions.installArgs' property in nx.json.`,
        `To ignore install lifecycle scripts, set 'release.version.versionActionsOptions.installIgnoreScripts' to true in nx.json.`,
        `To disable this step entirely, set 'release.version.versionActionsOptions.skipLockFileUpdate' to true in nx.json.`,
      ],
    });
    throw e;
  }
}
