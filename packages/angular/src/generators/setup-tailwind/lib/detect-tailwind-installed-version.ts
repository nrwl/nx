import { readJson, Tree } from '@nx/devkit';
import { checkAndCleanWithSemver } from '@nx/devkit/src/utils/semver';
import { lt } from 'semver';

export function detectTailwindInstalledVersion(
  tree: Tree
): '2' | '3' | undefined {
  const { dependencies, devDependencies } = readJson(tree, 'package.json');
  const tailwindVersion =
    dependencies?.tailwindcss ?? devDependencies?.tailwindcss;

  if (!tailwindVersion) {
    return undefined;
  }

  const version = checkAndCleanWithSemver('tailwindcss', tailwindVersion);
  if (lt(version, '2.0.0')) {
    throw new Error(
      `The Tailwind CSS version "${tailwindVersion}" is not supported. Please upgrade to v2.0.0 or higher.`
    );
  }

  return lt(version, '3.0.0') ? '2' : '3';
}
