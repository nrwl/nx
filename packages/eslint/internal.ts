// Semi-private surface for first-party Nx packages.
//
// External plugins should NOT import from here — this entry is curated for
// internal consumers and may change without semver protection. Mirrors
// `@nx/devkit/internal`.

export {
  addExtendsToLintConfig,
  addIgnoresToLintConfig,
  addOverrideToLintConfig,
  addPluginsToLintConfig,
  addPredefinedConfigToFlatLintConfig,
  findEslintFile,
  isEslintConfigSupported,
  lintConfigHasOverride,
  replaceOverridesInLintConfig,
  updateOverrideInLintConfig,
  updateRelativePathsInConfig,
} from './src/generators/utils/eslint-file';

export { addImportToFlatConfig } from './src/generators/utils/flat-config/ast-utils';

export { useFlatConfig } from './src/utils/flat-config';

export {
  javaScriptOverride,
  typeScriptOverride,
} from './src/generators/init/global-eslint-config';

export { setupRootEsLint } from './src/generators/lint-project/setup-root-eslint';

export {
  getInstalledEslintVersion,
  getTypeScriptEslintVersionToInstall,
} from './src/utils/version-utils';

export { typescriptESLintVersion } from './src/utils/versions';

export type { Schema } from './src/executors/lint/schema';
