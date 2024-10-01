import { execSync } from 'child_process';
import { existsSync } from 'node:fs';
import { platform } from 'os';
import { join } from 'path';
import * as chalk from 'chalk';
import { GeneratorCallback, logger } from '@nx/devkit';

const podInstallErrorMessage = `
Running ${chalk.bold('pod install')} failed, see above.
Do you have CocoaPods (https://cocoapods.org/) installed?

Check that your XCode path is correct:
${chalk.bold('sudo xcode-select --print-path')}

If the path is wrong, switch the path: (your path may be different)
${chalk.bold('sudo xcode-select --switch /Applications/Xcode.app')}
`;

/**
 * Run pod install on ios directory
 * @param iosDirectory ios directory that contains Podfile
 * @returns resolve with 0 if not error, reject with error otherwise
 */
export function runPodInstall(
  iosDirectory: string,
  install: boolean = true,
  options: {
    buildFolder?: string;
    repoUpdate?: boolean;
    deployment?: boolean;
    useBundler?: boolean;
  } = {
    buildFolder: './build',
    repoUpdate: false,
    deployment: false,
    useBundler: false,
  }
): GeneratorCallback {
  return () => {
    if (platform() !== 'darwin') {
      logger.info('Skipping `pod install` on non-darwin platform');
      return;
    }

    if (!install || !existsSync(join(iosDirectory, 'Podfile'))) {
      logger.info('Skipping `pod install`');
      return;
    }

    logger.info(`Running \`pod install\` from "${iosDirectory}"`);

    return podInstall(iosDirectory, options);
  };
}

export function podInstall(
  iosDirectory: string,
  options: {
    buildFolder?: string;
    repoUpdate?: boolean;
    deployment?: boolean;
    useBundler?: boolean;
  } = {
    buildFolder: './build',
    repoUpdate: false,
    deployment: false,
    useBundler: false,
  }
) {
  try {
    if (existsSync(join(iosDirectory, '.xcode.env'))) {
      execSync('touch .xcode.env', {
        cwd: iosDirectory,
        stdio: 'inherit',
        windowsHide: true,
      });
    }
    const podCommand = [
      options.useBundler ? 'bundle exec pod install' : 'pod install',
      options.repoUpdate ? '--repo-update' : '',
      options.deployment ? '--deployment' : '',
    ].join(' ');
    execSync(podCommand, {
      cwd: iosDirectory,
      stdio: 'inherit',
      windowsHide: true,
    });
  } catch (e) {
    logger.error(podInstallErrorMessage);
    throw e;
  }
}
