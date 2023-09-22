import { execSync } from 'child_process';
import { join } from 'path';
const globalDirs = require('global-dirs');

export function resolveEas(): string {
  try {
    execSync('eas --version');
  } catch {
    throw new Error(
      'EAS is not installed. Please run `npm install --global eas-cli` or `yarn global add eas-cli`.'
    );
  }

  let resolvedEasPath: string;
  try {
    resolvedEasPath = resolveGlobal('eas-cli/bin/run');
  } catch {
    resolvedEasPath = require.resolve('eas-cli/bin/run');
  }
  return resolvedEasPath;
}

function resolveGlobal(moduleId: string) {
  try {
    return require.resolve(join(globalDirs.yarn.packages, moduleId));
  } catch {
    return require.resolve(join(globalDirs.npm.packages, moduleId));
  }
}
