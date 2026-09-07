import { ensurePackage, stripIndents, type Tree } from '@nx/devkit';
import { detectLinters } from '@nx/js/internal';
import { nxVersion } from './versions';

export async function ignoreViteTempFiles(
  tree: Tree,
  projectRoot?: string | undefined
): Promise<void> {
  addViteTempFilesToGitIgnore(tree);
  await ignoreViteTempFilesInEslintConfig(tree, projectRoot);
}

export function addViteTempFilesToGitIgnore(tree: Tree): void {
  let gitIgnoreContents = tree.exists('.gitignore')
    ? tree.read('.gitignore', 'utf-8')
    : '';

  if (!/^vite\.config\.\*\.timestamp\*$/m.test(gitIgnoreContents)) {
    gitIgnoreContents = stripIndents`${gitIgnoreContents}
      vite.config.*.timestamp*`;
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

  addIgnoresToLintConfig(tree, directory, ['**/vite.config.*.timestamp*']);
}
