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
  isTypedLintingEnabled,
  lintConfigHasOverride,
  replaceOverridesInLintConfig,
  updateOverrideInLintConfig,
  useFlatConfig,
} from '@nx/eslint/internal';
import {
  nuxtEslintConfigVersion,
  nuxtEslintConfigLegacyVersion,
} from './versions';

export async function addLinting(
  host: Tree,
  options: {
    linter: Linter | LinterType;
    projectName: string;
    projectRoot: string;
    unitTestRunner?: 'vitest' | 'none';
    rootProject?: boolean;
    enableTypedLinting?: boolean;
    /**
     * @deprecated Use `enableTypedLinting` instead. This option will be removed in Nx v24.
     */
    setParserOptionsProject?: boolean;
  }
) {
  const tasks: GeneratorCallback[] = [];
  if (options.linter === 'eslint') {
    const enableTypedLinting = isTypedLintingEnabled(options);
    const lintTask = await lintProjectGenerator(host, {
      linter: options.linter,
      project: options.projectName,
      tsConfigPaths: [joinPathFragments(options.projectRoot, 'tsconfig.json')],
      unitTestRunner: options.unitTestRunner,
      skipFormat: true,
      rootProject: options.rootProject,
      enableTypedLinting,
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
        // For flat config: Generate eslint.config.mjs using createConfigForNuxt.
        // Pass `enableTypedLinting` so the projectService block is inlined into
        // the template (the file's top-level export is a call expression chain,
        // not an array literal, so post-hoc AST insertion doesn't work).
        generateNuxtFlatEslintConfig(
          host,
          options.projectRoot,
          enableTypedLinting
        );
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

    const installTask = addDependenciesToPackageJson(
      host,
      {},
      devDependencies,
      undefined,
      true
    );
    tasks.push(installTask);
  }
  return runTasksInSerial(...tasks);
}

/**
 * Generates a flat ESLint config for Nuxt using createConfigForNuxt from @nuxt/eslint-config/flat.
 * This is the recommended approach for Nuxt v4+ and ESLint flat config.
 */
function generateNuxtFlatEslintConfig(
  tree: Tree,
  projectRoot: string,
  enableTypedLinting: boolean
) {
  const eslintFile = findEslintFile(tree, projectRoot);
  if (!eslintFile) return;

  const configPath = joinPathFragments(projectRoot, eslintFile);
  const isMjs = eslintFile.endsWith('.mjs');
  const isCjs = eslintFile.endsWith('.cjs');

  // Determine the relative path to root config
  const depth = projectRoot.split('/').filter(Boolean).length;
  const rootConfigRelativePath = depth > 0 ? '../'.repeat(depth) : './';
  let configContent: string;

  const typedLintingBlock = enableTypedLinting
    ? `
    {
      files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.vue'],
      languageOptions: {
        parserOptions: {
          projectService: true,
          // \`projectService\` conflicts with a \`parserOptions.project\` set by any config
          // merged into this one. Remove this once you know none of them set it.
          project: null,
          tsconfigRootDir: ${isCjs ? '__dirname' : 'import.meta.dirname'},
        },
      },
    },`
    : '';

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
  .append(${typedLintingBlock}
    {
      files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.vue'],
      rules: {
        'vue/multi-word-component-names': 'off',
      },
    },
    {
      ignores: ['.nuxt/**', '.output/**', 'node_modules', '**/*.d.ts', '**/*.vue.js'],
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
  .append(${typedLintingBlock}
    {
      files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.vue'],
      rules: {
        'vue/multi-word-component-names': 'off',
      },
    },
    {
      ignores: ['.nuxt/**', '.output/**', 'node_modules', '**/*.d.ts', '**/*.vue.js'],
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
