import {
  formatFiles,
  logger,
  readJson,
  removeDependenciesFromPackageJson,
  visitNotIgnoredFiles,
  type Tree,
} from '@nx/devkit';

const PACKAGE = '@remix-run/eslint-config';

// Basenames of ESLint config files, eslintrc and flat including the Nx base
// variants, mirroring @nx/eslint's canonical lists. A reference to
// @remix-run/eslint-config in any of these means the workspace uses the preset,
// so the dependency must be kept.
const ESLINT_CONFIG_FILES = new Set([
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.yaml',
  '.eslintrc.yml',
  '.eslintrc.json',
  '.eslintrc.base.json',
  'eslint.config.js',
  'eslint.config.cjs',
  'eslint.config.mjs',
  'eslint.config.ts',
  'eslint.config.cts',
  'eslint.config.mts',
  'eslint.base.js',
  'eslint.base.ts',
  'eslint.base.config.js',
  'eslint.base.config.cjs',
  'eslint.base.config.mjs',
  'eslint.base.config.ts',
  'eslint.base.config.cts',
  'eslint.base.config.mts',
]);

/**
 * Removes the `@remix-run/eslint-config` dependency when no ESLint config
 * references it. Earlier Nx versions force-added this Remix-native preset to
 * generated workspaces (a behavior dropped in #26568), yet the generated lint
 * setup uses `@nx/eslint` flat config and never extends it. The preset peers
 * ESLint v8 only and has no v9-compatible release, so once ESLint v9 is the floor
 * the leftover dependency breaks installs. Workspaces that genuinely extend the
 * preset keep it.
 */
export default async function update(tree: Tree): Promise<void> {
  if (!isDeclared(tree) || isReferencedByEslintConfig(tree)) {
    return;
  }

  removeDependenciesFromPackageJson(tree, [PACKAGE], [PACKAGE]);
  logger.info(
    `Removed the unused "${PACKAGE}" dependency, which only supports ESLint v8.`
  );

  await formatFiles(tree);
}

function isDeclared(tree: Tree): boolean {
  if (!tree.exists('package.json')) {
    return false;
  }
  const { dependencies, devDependencies } = readJson(tree, 'package.json');
  return !!dependencies?.[PACKAGE] || !!devDependencies?.[PACKAGE];
}

function isReferencedByEslintConfig(tree: Tree): boolean {
  let referenced = false;
  visitNotIgnoredFiles(tree, '.', (filePath) => {
    if (referenced) {
      return;
    }
    const basename = filePath.split('/').pop() ?? '';
    if (!ESLINT_CONFIG_FILES.has(basename)) {
      return;
    }
    if (tree.read(filePath, 'utf-8')?.includes(PACKAGE)) {
      referenced = true;
    }
  });
  return referenced;
}
