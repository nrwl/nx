import {
  detectPackageManager,
  getPackageManagerCommand,
  getPackageManagerVersion,
  output,
} from '@nx/devkit';
import { getLockFileName } from '@nx/js';
import { execSync } from 'child_process';
import { gte } from 'semver';

export function updateLockFile(
  cwd: string,
  {
    dryRun,
    verbose,
    generatorOptions,
  }: {
    dryRun?: boolean;
    verbose?: boolean;
    generatorOptions?: Record<string, unknown>;
  }
) {
  if (generatorOptions?.skipLockFileUpdate) {
    if (verbose) {
      console.log(
        '\nSkipped lock file update because skipLockFileUpdate was set.'
      );
    }
    return [];
  }

  const packageManager = detectPackageManager(cwd);
  const packageManagerCommands = getPackageManagerCommand(packageManager);

  let installArgs = generatorOptions?.installArgs || '';

  output.logSingleLine(`Updating ${packageManager} lock file`);

  let env: object = {};

  if (generatorOptions?.installIgnoreScripts) {
    if (
      packageManager === 'yarn' &&
      gte(getPackageManagerVersion(packageManager), '2.0.0')
    ) {
      env = { YARN_ENABLE_SCRIPTS: 'false' };
    } else {
      // npm, pnpm, and yarn classic all use the same --ignore-scripts option
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

  execLockFileUpdate(command, cwd, env);

  return [lockFile];
}

function execLockFileUpdate(
  command: string,
  cwd: string,
  env: object = {}
): void {
  try {
    execSync(command, {
      cwd,
      env: {
        ...process.env,
        ...env,
      },
    });
  } catch (e) {
    output.error({
      title: `Error updating lock file with command '${command}'`,
      bodyLines: [
        `Verify that '${command}' succeeds when run from the workspace root.`,
        `To configure a string of arguments to be passed to this command, set the 'release.version.generatorOptions.installArgs' property in nx.json.`,
        `To ignore install lifecycle scripts, set 'release.version.generatorOptions.installIgnoreScripts' to true in nx.json.`,
        `To disable this step entirely, set 'release.version.skipLockFileUpdate' to true in nx.json.`,
      ],
    });
    throw e;
  }
}
