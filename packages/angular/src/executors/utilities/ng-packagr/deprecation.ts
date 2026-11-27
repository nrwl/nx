import { logger, type Tree } from '@nx/devkit';
import { quoteShellArg } from '@nx/devkit/internal';
import { lt } from 'semver';
import { supportsLibraryBuilder } from '../../../generators/utils/version-utils';
import { getInstalledAngularVersionInfo } from '../angular-version-utils';

export function warnOnDeprecatedNgPackagrExecutor(
  executor: string,
  projectName: string,
  tree: Tree
): void {
  const installedAngularVersion = getInstalledAngularVersionInfo()?.version;
  if (
    !installedAngularVersion ||
    lt(installedAngularVersion, '22.3.0') ||
    !supportsLibraryBuilder(tree, {})
  ) {
    return;
  }

  const command = getConvertCommand(projectName);
  const run = command
    ? `Run \`${command}\``
    : 'Run the "@nx/angular:convert-to-library-executor" generator';
  logger.warn(
    `The "${executor}" executor is deprecated. Use the "@nx/angular:library" executor instead. ` +
      `${run} to convert the library, or to see why it can't be converted.`
  );
}

function getConvertCommand(projectName: string): string | null {
  // Double quotes don't stop cmd.exe from expanding `%` and, with delayed expansion, `!`,
  // or PowerShell from expanding `$` and backticks.
  if (process.platform === 'win32' && /[%!$`]/.test(projectName)) {
    return null;
  }
  try {
    return `nx g @nx/angular:convert-to-library-executor ${quoteShellArg(`--project=${projectName}`)}`;
  } catch {
    return null;
  }
}
