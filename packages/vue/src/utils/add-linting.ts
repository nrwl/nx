import { Tree } from 'nx/src/generators/tree';
import { Linter, lintProjectGenerator } from '@nx/eslint';
import { joinPathFragments } from 'nx/src/utils/path';
import { addDependenciesToPackageJson, runTasksInSerial } from '@nx/devkit';
import { extraEslintDependencies } from './lint';
import {
  addExtendsToLintConfig,
  isEslintConfigSupported,
  lintConfigHasOverride,
  replaceOverridesInLintConfig,
  updateOverrideInLintConfig,
} from '@nx/eslint/src/generators/utils/eslint-file';
import type { Linter as EsLintLinter } from 'eslint';

export async function addLinting(
  host: Tree,
  options: {
    linter: Linter;
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

    addExtendsToLintConfig(host, options.projectRoot, [
      'plugin:vue/vue3-essential',
      'eslint:recommended',
      '@vue/eslint-config-typescript',
      '@vue/eslint-config-prettier/skip-formatting',
    ]);
    editEslintConfigFiles(host, options.projectRoot);

    let installTask = () => {};
    if (!options.skipPackageJson) {
      installTask = addDependenciesToPackageJson(
        host,
        extraEslintDependencies.dependencies,
        extraEslintDependencies.devDependencies
      );
    }

    return runTasksInSerial(lintTask, installTask);
  } else {
    return () => {};
  }
}

export function editEslintConfigFiles(tree: Tree, projectRoot: string) {
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
