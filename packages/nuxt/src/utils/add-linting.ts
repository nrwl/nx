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
  addOverrideToLintConfig,
  isEslintConfigSupported,
  lintConfigHasOverride,
  replaceOverridesInLintConfig,
  updateOverrideInLintConfig,
} from '@nx/eslint/src/generators/utils/eslint-file';
import { nuxtEslintConfigVersion } from './versions';
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
      // Merging base flat config with `@nuxt/eslint-config` results in merge error due to `@typescript-eslint` being registered twice.
      skipExtendedBaseConfig: true,
    });
    tasks.push(lintTask);

    editEslintConfigFiles(host, options.projectRoot);

    if (isEslintConfigSupported(host, options.projectRoot)) {
      const addExtendsTask = addExtendsToLintConfig(host, options.projectRoot, [
        '@nuxt/eslint-config',
      ]);
      tasks.push(addExtendsTask);
      addIgnoresToLintConfig(host, options.projectRoot, [
        '.nuxt/**',
        '.output/**',
        'node_modules',
      ]);
    }

    const installTask = addDependenciesToPackageJson(
      host,
      {},
      {
        '@nuxt/eslint-config': nuxtEslintConfigVersion,
      }
    );
    tasks.push(installTask);
  }
  return runTasksInSerial(...tasks);
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

  if (isEslintConfigSupported(tree, projectRoot)) {
    if (useFlatConfig(tree)) {
      addOverrideToLintConfig(
        tree,
        projectRoot,
        {
          rules: { 'vue/multi-word-component-names': 'off' },
        },
        { insertAtTheEnd: false }
      );
    } else {
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
            rules: { 'vue/multi-word-component-names': 'off' },
          },
        ]);
      }
    }
  }

  // Edit root config too
  if (!isEslintConfigSupported(tree)) {
    return;
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
