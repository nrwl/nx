import { type Tree } from '@nx/devkit';
import { versions } from './versions';

export { getInstalledEslintVersion } from './versions';

export function getTypeScriptEslintVersionToInstall(tree: Tree): string {
  return versions(tree).typescriptESLintVersion;
}
