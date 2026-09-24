import { ensurePackage, stripIndents, type Tree } from '@nx/devkit';
import { detectLinters } from '@nx/js/internal';
import { nxVersion } from './versions';

export async function ignoreVitestTempFiles(
  tree: Tree,
  projectRoot?: string | undefined
): Promise<void> {
  addVitestTempFilesToGitIgnore(tree);
  await ignoreVitestTempFilesInEslintConfig(tree, projectRoot);
}

export function addVitestTempFilesToGitIgnore(tree: Tree): void {
  const contents = tree.exists('.gitignore')
    ? tree.read('.gitignore', 'utf-8')
    : '';
  // Vitest 5 writes attachments, blob reports, failure screenshots and the
  // json/junit reporter output to `.vitest`.
  const additions = ['vitest.config.*.timestamp*', '.vitest'].filter(
    (entry) =>
      !new RegExp(
        `^${entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
        'm'
      ).test(contents)
  );
  if (!additions.length) {
    return;
  }

  // Plain concatenation rather than a template: `stripIndents` would rewrite
  // every existing line of the user's file.
  const separator = !contents || contents.endsWith('\n') ? '' : '\n';
  tree.write('.gitignore', `${contents}${separator}${additions.join('\n')}\n`);
}

async function ignoreVitestTempFilesInEslintConfig(
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

  addIgnoresToLintConfig(tree, directory, ['**/vitest.config.*.timestamp*']);
}
