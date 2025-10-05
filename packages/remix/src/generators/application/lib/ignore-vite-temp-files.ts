import { ensurePackage, readJson, stripIndents, type Tree } from '@nx/devkit';
import { getPackageVersion } from '../../../utils/versions';

export async function ignoreViteTempFiles(
  tree: Tree,
  projectRoot?: string | undefined
): Promise<void> {
  addViteTempFilesToGitIgnore(tree);
  await ignoreViteTempFilesInEslintConfig(tree, projectRoot);
}

function addViteTempFilesToGitIgnore(tree: Tree): void {
  let gitIgnoreContents = tree.exists('.gitignore')
    ? tree.read('.gitignore', 'utf-8')
    : '';

  if (!/^vite\.config\.\*\.timestamp\*$/m.test(gitIgnoreContents)) {
    gitIgnoreContents = stripIndents`${gitIgnoreContents}
      vite.config.*.timestamp*`;
  }
  if (!/^vitest\.config\.\*\.timestamp\*$/m.test(gitIgnoreContents)) {
    gitIgnoreContents = stripIndents`${gitIgnoreContents}
      vitest.config.*.timestamp*`;
  }

  tree.write('.gitignore', gitIgnoreContents);
}

async function ignoreViteTempFilesInEslintConfig(
  tree: Tree,
  projectRoot: string | undefined
): Promise<void> {
  if (!isEslintInstalled(tree)) {
    return;
  }

  ensurePackage('@nx/eslint', getPackageVersion(tree, 'nx'));
  const { addIgnoresToLintConfig, isEslintConfigSupported } = await import(
    '@nx/eslint/src/generators/utils/eslint-file'
  );
  if (!isEslintConfigSupported(tree)) {
    return;
  }

  const { useFlatConfig } = await import('@nx/eslint/src/utils/flat-config');
  const isUsingFlatConfig = useFlatConfig(tree);
  if (!projectRoot && !isUsingFlatConfig) {
    // root eslintrc files ignore all files and the root eslintrc files add
    // back all the project files, so we only add the ignores to the project
    // eslintrc files
    return;
  }

  // for flat config, we update the root config file
  const directory = isUsingFlatConfig ? '' : projectRoot ?? '';

  addIgnoresToLintConfig(tree, directory, [
    '**/vite.config.*.timestamp*',
    '**/vitest.config.*.timestamp*',
  ]);
}

export function isEslintInstalled(tree: Tree): boolean {
  try {
    require('eslint');
    return true;
  } catch {}

  // it might not be installed yet, but it might be in the tree pending install
  const { devDependencies, dependencies } = tree.exists('package.json')
    ? readJson(tree, 'package.json')
    : {};

  return !!devDependencies?.['eslint'] || !!dependencies?.['eslint'];
}
