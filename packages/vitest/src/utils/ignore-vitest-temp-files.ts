import { ensurePackage, readJson, stripIndents, type Tree } from '@nx/devkit';
import { nxVersion } from './versions';

export async function ignoreVitestTempFiles(
  tree: Tree,
  projectRoot?: string | undefined
): Promise<void> {
  addVitestTempFilesToGitIgnore(tree);
  await ignoreVitestTempFilesInEslintConfig(tree, projectRoot);
}

export function addVitestTempFilesToGitIgnore(tree: Tree): void {
  let gitIgnoreContents = tree.exists('.gitignore')
    ? tree.read('.gitignore', 'utf-8')
    : '';
  if (!/^vitest\.config\.\*\.timestamp\*$/m.test(gitIgnoreContents)) {
    gitIgnoreContents = stripIndents`${gitIgnoreContents}
      vitest.config.*.timestamp*`;
  }

  tree.write('.gitignore', gitIgnoreContents);
}

async function ignoreVitestTempFilesInEslintConfig(
  tree: Tree,
  projectRoot: string | undefined
): Promise<void> {
  if (!isEslintInstalled(tree)) {
    return;
  }

  ensurePackage('@nx/eslint', nxVersion);
  // Use CommonJS `require` rather than a dynamic ESM `import`: `ensurePackage`
  // makes the on-demand-installed package available via `Module._initPaths`,
  // which `require()` honors but ESM resolution does not. Under nodenext, a
  // dynamic `import()` is preserved as a true ESM dynamic import, so it can't
  // see the temp install — generators that go down this path crash with
  // `Cannot find package '@nx/eslint'`.
  const {
    addIgnoresToLintConfig,
    isEslintConfigSupported,
    useFlatConfig,
  }: typeof import('@nx/eslint/internal') = require('@nx/eslint/internal');
  if (!isEslintConfigSupported(tree)) {
    return;
  }

  const isUsingFlatConfig = useFlatConfig(tree);
  if (!projectRoot && !isUsingFlatConfig) {
    // root eslintrc files ignore all files and the root eslintrc files add
    // back all the project files, so we only add the ignores to the project
    // eslintrc files
    return;
  }

  // for flat config, we update the root config file
  const directory = isUsingFlatConfig ? '' : (projectRoot ?? '');

  addIgnoresToLintConfig(tree, directory, ['**/vitest.config.*.timestamp*']);
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
