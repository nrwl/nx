import { ensurePackage, readJson, stripIndents, type Tree } from '@nx/devkit';
import { nxVersion } from './versions';

export function ignoreViteTempFiles(
  tree: Tree,
  projectRoot?: string | undefined
): void {
  addViteTempFilesToGitIgnore(tree);
  ignoreViteTempFilesInEslintConfig(tree, projectRoot);
}

function addViteTempFilesToGitIgnore(tree: Tree): void {
  const viteTempFilesPattern = `vite.config.*.timestamp*`;
  const vitestTempFilesPattern = `vitest.config.*.timestamp*`;

  let gitIgnoreContents = tree.exists('.gitignore')
    ? tree.read('.gitignore', 'utf-8')
    : '';
  if (!gitIgnoreContents.includes(viteTempFilesPattern)) {
    gitIgnoreContents = stripIndents`${gitIgnoreContents}
        ${viteTempFilesPattern}`;
  }
  if (!gitIgnoreContents.includes(vitestTempFilesPattern)) {
    gitIgnoreContents = stripIndents`${gitIgnoreContents}
        ${vitestTempFilesPattern}`;
  }

  tree.write('.gitignore', gitIgnoreContents);
}

function ignoreViteTempFilesInEslintConfig(
  tree: Tree,
  projectRoot: string | undefined
): void {
  if (!isEslintInstalled(tree)) {
    return;
  }

  const viteTempFilesPattern = `**/vite.config.*.timestamp*`;
  const vitestTempFilesPattern = `**/vitest.config.*.timestamp*`;

  ensurePackage('@nx/eslint', nxVersion);
  const { addIgnoresToLintConfig, isEslintConfigSupported } =
    // nx-ignore-next-line
    require('@nx/eslint/src/generators/utils/eslint-file');
  if (!isEslintConfigSupported(tree)) {
    return;
  }

  const { useFlatConfig } =
    // nx-ignore-next-line
    require('@nx/eslint/src/utils/flat-config');
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
    viteTempFilesPattern,
    vitestTempFilesPattern,
  ]);
}

function isEslintInstalled(tree: Tree): boolean {
  try {
    // nx-ignore-next-line
    require('eslint');
    return true;
  } catch {}

  // it might not be installed yet, but it might be in the tree pending install
  const { devDependencies, dependencies } = tree.exists('package.json')
    ? readJson(tree, 'package.json')
    : {};

  return !!devDependencies?.['eslint'] || !!dependencies?.['eslint'];
}
