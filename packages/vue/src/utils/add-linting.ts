import { Tree } from 'nx/src/generators/tree';
import { Linter, LinterType, lintProjectGenerator } from '@nx/eslint';
import { joinPathFragments } from 'nx/src/utils/path';
import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  runTasksInSerial,
} from '@nx/devkit';
import { extraEslintDependencies } from './lint';
import {
  addExtendsToLintConfig,
  addOverrideToLintConfig,
  addPredefinedConfigToFlatLintConfig,
  isEslintConfigSupported,
  lintConfigHasOverride,
  replaceOverridesInLintConfig,
  updateOverrideInLintConfig,
} from '@nx/eslint/src/generators/utils/eslint-file';
import type { Linter as EsLintLinter } from 'eslint';
import { useFlatConfig } from '@nx/eslint/src/utils/flat-config';

export async function addLinting(
  host: Tree,
  options: {
    linter: Linter | LinterType;
    name: string;
    projectRoot: string;
    unitTestRunner?: 'vitest' | 'none';
    setParserOptionsProject?: boolean;
    skipPackageJson?: boolean;
    rootProject?: boolean;
    addPlugin?: boolean;
  },
  projectType: 'lib' | 'app'
) {
  if (options.linter === Linter.EsLint) {
    const tasks: GeneratorCallback[] = [];
    const lintTask = await lintProjectGenerator(host, {
      linter: options.linter,
      project: options.name,
      tsConfigPaths: [
        joinPathFragments(options.projectRoot, `tsconfig.${projectType}.json`),
      ],
      unitTestRunner: options.unitTestRunner,
      skipFormat: true,
      setParserOptionsProject: options.setParserOptionsProject,
      rootProject: options.rootProject,
      addPlugin: options.addPlugin,
    });
    tasks.push(lintTask);

    if (useFlatConfig(host)) {
    } else {
      const addExtendsTask = addExtendsToLintConfig(
        host,
        options.projectRoot,
        [
          'plugin:vue/vue3-essential',
          'eslint:recommended',
          '@vue/eslint-config-typescript',
          '@vue/eslint-config-prettier/skip-formatting',
        ].filter(Boolean)
      );
      tasks.push(addExtendsTask);
    }

    editEslintConfigFiles(host, options.projectRoot);

    if (!options.skipPackageJson) {
      const installTask = addDependenciesToPackageJson(
        host,
        extraEslintDependencies.dependencies,
        extraEslintDependencies.devDependencies
      );
      tasks.push(installTask);
    }

    return runTasksInSerial(...tasks);
  } else {
    return () => {};
  }
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
      addPredefinedConfigToFlatLintConfig(
        tree,
        projectRoot,
        'flat/recommended',
        'vue',
        'eslint-plugin-vue'
      );
      // This allows .vue files to be parsed
      addOverrideToLintConfig(
        tree,
        projectRoot,
        {
          files: ['**/*.vue'],
          languageOptions: {
            parserOptions: {
              parser: '@typescript-eslint/parser',
            },
          },
        } as unknown // languageOptions is not present on eslintrc override, but it is for flat config
      );
      // Add an empty rules object to users know how to add/override rules
      addOverrideToLintConfig(tree, projectRoot, {
        files: ['*.ts', '*.tsx', '*.js', '*.jsx', '*.vue'],
        rules: { 'vue/multi-word-component-names': 'off' },
      });
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
