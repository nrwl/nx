import { type Tree } from '@nx/devkit';
import { versions as eslintVersions } from '@nx/eslint/internal';
import { Linter } from 'eslint';
import { coerce } from 'semver';
import {
  eslintPluginImportVersion,
  eslintPluginImportXVersion,
  eslintPluginReactVersion,
  eslintPluginReactHooksVersion,
  eslintPluginReactHooksV7Version,
  eslintPluginJsxA11yVersion,
} from './versions';

type EslintDependencies = {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

const eslintLegacyDependencies: EslintDependencies = {
  dependencies: {},
  devDependencies: {
    'eslint-plugin-import': eslintPluginImportVersion,
    'eslint-plugin-jsx-a11y': eslintPluginJsxA11yVersion,
    'eslint-plugin-react': eslintPluginReactVersion,
    'eslint-plugin-react-hooks': eslintPluginReactHooksVersion,
  },
};

const eslint10Dependencies: EslintDependencies = {
  dependencies: {},
  devDependencies: {
    'eslint-plugin-import-x': eslintPluginImportXVersion,
    'eslint-plugin-react-hooks': eslintPluginReactHooksV7Version,
  },
};

/**
 * @deprecated Use {@link getExtraEslintDependencies}, which resolves the plugin
 * set for the workspace's ESLint version. This static set targets ESLint v9 and
 * earlier; on ESLint v10 it installs plugins that have no v10 release.
 */
export const extraEslintDependencies: EslintDependencies =
  eslintLegacyDependencies;

/**
 * Resolves the React ESLint plugin set for the workspace's ESLint version.
 * ESLint v10 has no eslintrc API and no react/jsx-a11y/import release, so v10
 * workspaces swap to eslint-plugin-import-x and react-hooks v7. We read the
 * version from `@nx/eslint`'s resolver, the same one that installs ESLint, so
 * the plugin set stays in lockstep with the installed ESLint major.
 */
export function getExtraEslintDependencies(tree: Tree): EslintDependencies {
  const { eslintVersion } = eslintVersions(tree);
  const isLegacyEslint = (coerce(eslintVersion)?.major ?? 10) < 10;

  return isLegacyEslint ? eslintLegacyDependencies : eslint10Dependencies;
}

/**
 * @deprecated Use `addExtendsToLintConfig` from `@nx/eslint` instead.
 */
export const extendReactEslintJson = (
  json: Linter.LegacyConfig
): Linter.LegacyConfig => {
  const { extends: pluginExtends, ...config } = json;

  return {
    extends: ['plugin:@nx/react', ...(pluginExtends || [])],
    ...config,
  };
};
