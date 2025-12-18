import { Tree } from 'nx/src/generators/tree';
import type { Linter as EsLintLinter } from 'eslint';
import { Linter, LinterType, lintProjectGenerator } from '@nx/eslint';
import { joinPathFragments } from 'nx/src/utils/path';
import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  runTasksInSerial,
} from '@nx/devkit';
import {
  addExtendsToLintConfig,
  addIgnoresToLintConfig,
  findEslintFile,
  isEslintConfigSupported,
  lintConfigHasOverride,
  replaceOverridesInLintConfig,
  updateOverrideInLintConfig,
} from '@nx/eslint/src/generators/utils/eslint-file';
import {
  nuxtEslintConfigVersion,
  nuxtEslintConfigLegacyVersion,
} from './versions';
import { useFlatConfig } from '@nx/eslint/src/utils/flat-config';

export async function addLinting(
  host: Tree,
  options: {
    linter: Linter | LinterType;
    projectName: string;
    projectRoot: string;
    unitTestRunner?: 'vitest' | 'none';
    rootProject?: boolean;
  }
) {
  const tasks: GeneratorCallback[] = [];
  if (options.linter === 'eslint') {
    const lintTask = await lintProjectGenerator(host, {
      linter: options.linter,
      project: options.projectName,
      tsConfigPaths: [joinPathFragments(options.projectRoot, 'tsconfig.json')],
      unitTestRunner: options.unitTestRunner,
      skipFormat: true,
      rootProject: options.rootProject,
      addPlugin: true,
    });
    tasks.push(lintTask);

    const isFlatConfig = useFlatConfig(host);

    // Version-aware dependencies:
    // - Flat config (v4+): use @nuxt/eslint-config ^1.10.0 with createConfigForNuxt
    // - Legacy (.eslintrc.json): use @nuxt/eslint-config ~0.5.6 with extends
    const devDependencies: Record<string, string> = {
      '@nuxt/eslint-config': isFlatConfig
        ? nuxtEslintConfigVersion
        : nuxtEslintConfigLegacyVersion,
    };

    if (isEslintConfigSupported(host, options.projectRoot)) {
      if (isFlatConfig) {
        // For flat config: Generate eslint.config.mjs using createConfigForNuxt
        generateNuxtFlatEslintConfig(host, options.projectRoot);
      } else {
        // For legacy: Use extends with the old @nuxt/eslint-config
        editEslintConfigFiles(host, options.projectRoot);

        const addExtendsTask = addExtendsToLintConfig(
          host,
          options.projectRoot,
          ['@nuxt/eslint-config'],
          true
        );
        tasks.push(addExtendsTask);

        addIgnoresToLintConfig(host, options.projectRoot, [
          '.nuxt/**',
          '.output/**',
          'node_modules',
        ]);
      }
    }

    const installTask = addDependenciesToPackageJson(host, {}, devDependencies);
    tasks.push(installTask);
  }
  return runTasksInSerial(...tasks);
}

/**
 * Generates a flat ESLint config for Nuxt using createConfigForNuxt from @nuxt/eslint-config/flat.
 * This is the recommended approach for Nuxt v4+ and ESLint flat config.
 */
function generateNuxtFlatEslintConfig(tree: Tree, projectRoot: string) {
  const eslintFile = findEslintFile(tree, projectRoot);
  if (!eslintFile) return;

  const configPath = joinPathFragments(projectRoot, eslintFile);
  const isMjs = eslintFile.endsWith('.mjs');
  const isCjs = eslintFile.endsWith('.cjs');

  // Determine the relative path to root config
  const depth = projectRoot.split('/').filter(Boolean).length;
  const rootConfigRelativePath = depth > 0 ? '../'.repeat(depth) : './';
  let configContent: string;

  if (isCjs) {
    // CJS flat config
    configContent = `const { createConfigForNuxt } = require('@nuxt/eslint-config/flat');
${
  projectRoot !== '.'
    ? `const baseConfig = require('${rootConfigRelativePath}eslint.config.cjs');\n`
    : ''
}
module.exports = createConfigForNuxt({
  features: {
    typescript: true,
  },
})${projectRoot !== '.' ? `\n  .prepend(...baseConfig)` : ''}
  .append(
    {
      files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.vue'],
      rules: {},
    },
    {
      ignores: ['.nuxt/**', '.output/**', 'node_modules'],
    }
  );
`;
  } else {
    // ESM flat config (default)
    configContent = `import { createConfigForNuxt } from '@nuxt/eslint-config/flat';
${
  projectRoot !== '.'
    ? `import baseConfig from '${rootConfigRelativePath}eslint.config.${
        isMjs ? 'mjs' : 'js'
      }';\n`
    : ''
}
export default createConfigForNuxt({
  features: {
    typescript: true,
  },
})${projectRoot !== '.' ? `\n  .prepend(...baseConfig)` : ''}
  .append(
    {
      files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.vue'],
      rules: {},
    },
    {
      ignores: ['.nuxt/**', '.output/**', 'node_modules'],
    }
  );
`;
  }

  tree.write(configPath, configContent);
}

function editEslintConfigFiles(tree: Tree, projectRoot: string) {
  const hasVueFiles = (
    o: EsLintLinter.ConfigOverride<EsLintLinter.RulesRecord>
  ) =>
    o.files &&
    (Array.isArray(o.files)
      ? o.files.some((f) => f.endsWith('*.vue'))
      : o.files.endsWith('*.vue'));
  const addVueFiles = (
    o: EsLintLinter.ConfigOverride<EsLintLinter.RulesRecord>
  ) => {
    if (!o.files) {
      o.files = ['*.vue'];
    } else if (Array.isArray(o.files)) {
      o.files.push('*.vue');
    } else {
      o.files = [o.files, '*.vue'];
    }
  };
  if (
    lintConfigHasOverride(
      tree,
      projectRoot,
      (o) => o.parserOptions && !hasVueFiles(o),
      true
    )
  ) {
    updateOverrideInLintConfig(
      tree,
      projectRoot,
      (o) => !!o.parserOptions,
      (o) => {
        addVueFiles(o);
        return o;
      }
    );
  } else {
    replaceOverridesInLintConfig(tree, projectRoot, [
      {
        files: ['*.ts', '*.tsx', '*.js', '*.jsx', '*.vue'],
        rules: {},
      },
    ]);
  }

  if (
    lintConfigHasOverride(
      tree,
      '',
      (o) => o.rules?.['@nx/enforce-module-boundaries'] && !hasVueFiles(o),
      true
    )
  ) {
    updateOverrideInLintConfig(
      tree,
      '',
      (o) => !!o.rules?.['@nx/enforce-module-boundaries'],
      (o) => {
        addVueFiles(o);
        return o;
      }
    );
  }
}
