import { detectPackageManager, output } from '@nx/devkit';
import { exec } from 'child_process';
import { gte } from 'semver';

export async function packageManagerInstall({
  dryRun,
  verbose,
  generatorOptions,
}: {
  dryRun?: boolean;
  verbose?: boolean;
  generatorOptions?: Record<string, unknown>;
}) {
  if (generatorOptions?.skipInstall) {
    if (verbose) {
      console.log('\nSkipped lockfile update because skipInstall was set.');
    }
    return [];
  }

  const packageManager = detectPackageManager();
  let installArgs = generatorOptions?.installArgs || '';

  output.logSingleLine(`Updating ${packageManager} lockfile`);

  let command: string;
  let env: object = {};
  let lockfilePath: string;
  switch (packageManager) {
    case 'yarn':
      const isBerry = await isYarnBerry();
      if (!isBerry) {
        // TODO: add support for yarn 1 or remove berry check
        throw new Error('Yarn 1 is not supported');
      }
      command = `yarn install --mode update-lockfile --skip-immutable-lockfile ${installArgs}`;
      lockfilePath = 'yarn.lock';
      if (generatorOptions?.installIgnoreScripts) {
        env = { YARN_ENABLE_SCRIPTS: 'false' };
      }
      break;
    case 'pnpm':
      if (generatorOptions?.installIgnoreScripts) {
        installArgs = `${installArgs} --ignore-scripts`.trim();
      }
      command = `pnpm install --lockfile-only ${installArgs}`;
      lockfilePath = 'pnpm-lock.yaml';
      break;
    default: // assume npm by default
      if (generatorOptions?.installIgnoreScripts) {
        installArgs = `${installArgs} --ignore-scripts`.trim();
      }
      command = `npm install --package-lock-only ${installArgs}`.trim();
      lockfilePath = 'package-lock.json';
      break;
  }

  if (verbose) {
    if (dryRun) {
      console.log(
        `Would update ${lockfilePath} with the following command, but --dry-run was set:`
      );
    } else {
      console.log(`Updating ${lockfilePath} with the following command:`);
    }
    console.log(command);
  }

  if (dryRun) {
    return [];
  }

  const result = await execInstall(command);

  return [lockfilePath];
}

async function isYarnBerry(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    exec('yarn --version', (error, stdout, stderr) => {
      if (error || stderr) {
        output.error({
          title: `Error checking yarn version`,
          bodyLines: [
            `Nx detected yarn as the package manager for this workspace, but was unable to determine its version.`,
            `Verify that 'yarn --version' succeeds when run from the workspace root.`,
          ],
        });
        return reject(error);
      }

      const version = stdout.trim();
      const isBerry = gte(version, '2.0.0');

      return resolve(isBerry);
    });
  });
}

async function execInstall(command: string, env: object = {}): Promise<string> {
  return await new Promise<string>((resolve, reject) =>
    exec(
      command,
      {
        env: {
          ...process.env,
          ...env,
        },
      },
      (error, stdout, stderr) => {
        if (error || stderr) {
          output.error({
            title: `Error updating lockfile with command '${command}'`,
            bodyLines: [
              `Verify that '${command}' succeeds when run from the workspace root.`,
              `To configure a string of arguments to be passed to this command, set the 'release.version.installArgs' property in nx.json.`,
              `To ignore install lifecycle scripts, set 'release.version.installIgnoreScripts' to true in nx.json.`,
              `To disable this step entirely, set 'release.version.skipInstall' to true in nx.json.`,
            ],
          });
          return reject(error);
        }

        return resolve(stdout.trim());
      }
    )
  );
}
