import {
  formatFiles,
  GeneratorCallback,
  joinPathFragments,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { Linter, lintProjectGenerator } from '@nx/linter';
import { mapLintPattern } from '@nx/linter/src/generators/lint-project/lint-project';
import { addAngularEsLintDependencies } from './lib/add-angular-eslint-dependencies';
import type { AddLintingGeneratorSchema } from './schema';
import {
  findEslintFile,
  replaceOverridesInLintConfig,
} from '@nx/linter/src/generators/utils/eslint-file';
import { camelize, dasherize } from '@nx/devkit/src/utils/string-utils';

export async function addLintingGenerator(
  tree: Tree,
  options: AddLintingGeneratorSchema
): Promise<GeneratorCallback> {
  const tasks: GeneratorCallback[] = [];
  const rootProject = options.projectRoot === '.' || options.projectRoot === '';
  const lintTask = await lintProjectGenerator(tree, {
    linter: Linter.EsLint,
    project: options.projectName,
    tsConfigPaths: [
      joinPathFragments(options.projectRoot, 'tsconfig.app.json'),
    ],
    unitTestRunner: options.unitTestRunner,
    eslintFilePatterns: [
      mapLintPattern(options.projectRoot, 'ts', rootProject),
      mapLintPattern(options.projectRoot, 'html', rootProject),
    ],
    setParserOptionsProject: options.setParserOptionsProject,
    skipFormat: true,
    rootProject: rootProject,
  });
  tasks.push(lintTask);

  const eslintFile = findEslintFile(tree, options.projectRoot);
  // keep parser options if they exist
  const hasParserOptions = tree
    .read(joinPathFragments(options.projectRoot, eslintFile), 'utf8')
    .includes(`${options.projectRoot}/tsconfig.*?.json`);

  replaceOverridesInLintConfig(tree, options.projectRoot, [
    {
      files: ['*.ts'],
      ...(hasParserOptions
        ? {
            parserOptions: {
              project: [`${options.projectRoot}/tsconfig.*?.json`],
            },
          }
        : {}),
      extends: [
        'plugin:@nx/angular',
        'plugin:@angular-eslint/template/process-inline-templates',
      ],
      rules: {
        '@angular-eslint/directive-selector': [
          'error',
          {
            type: 'attribute',
            prefix: camelize(options.prefix),
            style: 'camelCase',
          },
        ],
        '@angular-eslint/component-selector': [
          'error',
          {
            type: 'element',
            prefix: dasherize(options.prefix),
            style: 'kebab-case',
          },
        ],
      },
    },
    {
      files: ['*.html'],
      extends: ['plugin:@nx/angular-template'],
      /**
       * Having an empty rules object present makes it more obvious to the user where they would
       * extend things from if they needed to
       */
      rules: {},
    },
  ]);

  if (!options.skipPackageJson) {
    const installTask = addAngularEsLintDependencies(tree);
    tasks.push(installTask);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default addLintingGenerator;
