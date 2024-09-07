import { Linter } from 'eslint';
import {
  addBlockToFlatConfigExport,
  addImportToFlatConfig,
  createNodeList,
  generateFlatOverride,
  generateFlatPredefinedConfig,
  stringifyNodeList,
} from '../utils/flat-config/ast-utils';

/**
 * This configuration is intended to apply to all TypeScript source files.
 * See the eslint-plugin package for what is in the referenced shareable config.
 */
export const typeScriptOverride = {
  files: ['*.ts', '*.tsx'],
  extends: ['plugin:@nx/typescript'],
  /**
   * Having an empty rules object present makes it more obvious to the user where they would
   * extend things from if they needed to
   */
  rules: {},
};

/**
 * This configuration is intended to apply to all JavaScript source files.
 * See the eslint-plugin package for what is in the referenced shareable config.
 */
export const javaScriptOverride = {
  files: ['*.js', '*.jsx'],
  extends: ['plugin:@nx/javascript'],
  /**
   * Having an empty rules object present makes it more obvious to the user where they would
   * extend things from if they needed to
   */
  rules: {},
};

/**
 * This configuration is intended to apply to all "source code" (but not
 * markup like HTML, or other custom file types like GraphQL)
 */
const moduleBoundariesOverride = {
  files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
  rules: {
    '@nx/enforce-module-boundaries': [
      'error',
      {
        enforceBuildableLibDependency: true,
        allow: [],
        depConstraints: [{ sourceTag: '*', onlyDependOnLibsWithTags: ['*'] }],
      },
    ],
  } as Linter.RulesRecord,
};

/**
 * This configuration is intended to apply to all "source code" (but not
 * markup like HTML, or other custom file types like GraphQL)
 */
const jestOverride = {
  files: ['*.spec.ts', '*.spec.tsx', '*.spec.js', '*.spec.jsx'],
  env: {
    jest: true,
  },
  rules: {},
};

export const getGlobalEsLintConfiguration = (
  unitTestRunner?: string,
  rootProject?: boolean
): Linter.Config => {
  const config: Linter.Config = {
    root: true,
    ignorePatterns: rootProject ? ['!**/*'] : ['**/*'],
    plugins: ['@nx'],
    /**
     * We leverage ESLint's "overrides" capability so that we can set up a root config which will support
     * all permutations of Nx workspaces across all frameworks, libraries and tools.
     *
     * The key point is that we need entirely different ESLint config to apply to different types of files,
     * but we still want to share common config where possible.
     */
    overrides: [
      ...(rootProject ? [] : [moduleBoundariesOverride]),
      typeScriptOverride,
      javaScriptOverride,
      ...(unitTestRunner === 'jest' ? [jestOverride] : []),
    ],
  };
  return config;
};

export const getGlobalFlatEslintConfiguration = (
  rootProject?: boolean
): string => {
  const nodeList = createNodeList(new Map(), []);
  let content = stringifyNodeList(nodeList);
  content = addImportToFlatConfig(content, 'nx', '@nx/eslint-plugin');

  content = addBlockToFlatConfigExport(
    content,
    generateFlatPredefinedConfig('flat/base'),
    { insertAtTheEnd: false }
  );
  content = addBlockToFlatConfigExport(
    content,
    generateFlatPredefinedConfig('flat/typescript')
  );
  content = addBlockToFlatConfigExport(
    content,
    generateFlatPredefinedConfig('flat/javascript')
  );

  if (!rootProject) {
    content = addBlockToFlatConfigExport(
      content,
      generateFlatOverride(moduleBoundariesOverride)
    );
  }

  content = addBlockToFlatConfigExport(
    content,
    generateFlatOverride({
      files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
      rules: {},
    })
  );

  return content;
};
