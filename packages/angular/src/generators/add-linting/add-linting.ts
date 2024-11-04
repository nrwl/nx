import {
  formatFiles,
  joinPathFragments,
  runTasksInSerial,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { camelize, dasherize } from '@nx/devkit/src/utils/string-utils';
import { Linter, lintProjectGenerator } from '@nx/eslint';
import type * as eslint from 'eslint';
import {
  javaScriptOverride,
  typeScriptOverride,
} from '@nx/eslint/src/generators/init/global-eslint-config';
import {
  addOverrideToLintConfig,
  addPredefinedConfigToFlatLintConfig,
  findEslintFile,
  isEslintConfigSupported,
  replaceOverridesInLintConfig,
} from '@nx/eslint/src/generators/utils/eslint-file';
import { addAngularEsLintDependencies } from './lib/add-angular-eslint-dependencies';
import { isBuildableLibraryProject } from './lib/buildable-project';
import type { AddLintingGeneratorSchema } from './schema';
import { useFlatConfig } from '@nx/eslint/src/utils/flat-config';

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
    setParserOptionsProject: options.setParserOptionsProject,
    skipFormat: true,
    rootProject: rootProject,
    addPlugin: false,
    addExplicitTargets: true,
    skipPackageJson: options.skipPackageJson,
  });
  tasks.push(lintTask);

  if (isEslintConfigSupported(tree)) {
    const eslintFile = findEslintFile(tree, options.projectRoot);
    // keep parser options if they exist
    const hasParserOptions = tree
      .read(joinPathFragments(options.projectRoot, eslintFile), 'utf8')
      .includes(`${options.projectRoot}/tsconfig.*?.json`);

    if (useFlatConfig(tree)) {
      addPredefinedConfigToFlatLintConfig(
        tree,
        options.projectRoot,
        'flat/angular'
      );
      addPredefinedConfigToFlatLintConfig(
        tree,
        options.projectRoot,
        'flat/angular-template'
      );
      addOverrideToLintConfig(tree, options.projectRoot, {
        files: ['*.ts'],
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
      });
      addOverrideToLintConfig(tree, options.projectRoot, {
        files: ['*.html'],
        rules: {},
      });

      if (isBuildableLibraryProject(tree, options.projectName)) {
        addOverrideToLintConfig(tree, '', {
          files: ['*.json'],
          parser: 'jsonc-eslint-parser',
          rules: {
            '@nx/dependency-checks': [
              'error',
              {
                // With flat configs, we don't want to include imports in the eslint js/cjs/mjs files to be checked
                ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs}'],
              },
            ],
          },
        });
      }
    } else {
      replaceOverridesInLintConfig(tree, options.projectRoot, [
        ...(rootProject ? [typeScriptOverride, javaScriptOverride] : []),
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
        ...(isBuildableLibraryProject(tree, options.projectName)
          ? [
              {
                files: ['*.json'],
                parser: 'jsonc-eslint-parser',
                rules: {
                  '@nx/dependency-checks': [
                    'error',
                    {
                      // With flat configs, we don't want to include imports in the eslint js/cjs/mjs files to be checked
                      ignoredFiles: [
                        '{projectRoot}/eslint.config.{js,cjs,mjs}',
                      ],
                    },
                  ],
                },
              } as any,
            ]
          : []),
      ]);
    }
  }

  if (!options.skipPackageJson) {
    const installTask = addAngularEsLintDependencies(tree, options.projectName);
    tasks.push(installTask);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default addLintingGenerator;
