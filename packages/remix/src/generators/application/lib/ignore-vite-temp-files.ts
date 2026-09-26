import { ensurePackage, stripIndents, type Tree } from '@nx/devkit';
import { detectLinters } from '@nx/js/internal';
import { nxVersion } from '../../../utils/versions';

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
  // Checked before `ensurePackage` so an Oxlint workspace does not install
  // `@nx/eslint` only for `isEslintConfigSupported` to send it straight back.
  if (!detectLinters(tree).includes('eslint')) {
    return;
  }

  ensurePackage('@nx/eslint', nxVersion);
  const {
    addIgnoresToLintConfig,
    isEslintConfigSupported,
  }: typeof import('@nx/eslint/internal') = require('@nx/eslint/internal');
  if (!isEslintConfigSupported(tree)) {
    return;
  }

  const {
    useFlatConfig,
  }: typeof import('@nx/eslint/internal') = require('@nx/eslint/internal');
  const isUsingFlatConfig = useFlatConfig(tree);
  if (!projectRoot && !isUsingFlatConfig) {
    // root eslintrc files ignore all files and the root eslintrc files add
    // back all the project files, so we only add the ignores to the project
    // eslintrc files
    return;
  }

  // for flat config, we update the root config file
  const directory = isUsingFlatConfig ? '' : (projectRoot ?? '');

  addIgnoresToLintConfig(tree, directory, [
    '**/vite.config.*.timestamp*',
    '**/vitest.config.*.timestamp*',
  ]);
}
