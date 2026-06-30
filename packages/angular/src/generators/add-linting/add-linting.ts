import { camelize, dasherize } from '@nx/devkit/internal';
import {
  formatFiles,
  joinPathFragments,
  runTasksInSerial,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { lintProjectGenerator } from '@nx/eslint';
import { assertSupportedAngularVersion } from '../../utils/assert-supported-angular-version';
import {
  javaScriptOverride,
  typeScriptOverride,
  addOverrideToLintConfig,
  addPredefinedConfigToFlatLintConfig,
  detectTypedLintingShape,
  findEslintFile,
  isEslintConfigSupported,
  isTypedLintingEnabled,
  replaceOverridesInLintConfig,
  useFlatConfig,
} from '@nx/eslint/internal';
import { addAngularEsLintDependencies } from './lib/add-angular-eslint-dependencies';
import { isBuildableLibraryProject } from './lib/buildable-project';
import type { AddLintingGeneratorSchema } from './schema';

export async function addLintingGenerator(
  tree: Tree,
  options: AddLintingGeneratorSchema
): Promise<GeneratorCallback> {
  assertSupportedAngularVersion(tree);
  const tasks: GeneratorCallback[] = [];
  const rootProject = options.projectRoot === '.' || options.projectRoot === '';
  const lintTask = await lintProjectGenerator(tree, {
    linter: 'eslint',
    project: options.projectName,
    tsConfigPaths: [
      joinPathFragments(options.projectRoot, 'tsconfig.app.json'),
    ],
    unitTestRunner: options.unitTestRunner,
    enableTypedLinting: isTypedLintingEnabled(options),
    skipFormat: true,
    rootProject: rootProject,
    addPlugin: options.addPlugin ?? false,
    addExplicitTargets: true,
    skipPackageJson: options.skipPackageJson,
  });
  tasks.push(lintTask);

  if (isEslintConfigSupported(tree)) {
    if (useFlatConfig(tree)) {
      addPredefinedConfigToFlatLintConfig(
        tree,
        options.projectRoot,
        'flat/angular',
        { checkBaseConfig: true }
      );
      addPredefinedConfigToFlatLintConfig(
        tree,
        options.projectRoot,
        'flat/angular-template',
        { checkBaseConfig: true }
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
    } else {
      // Legacy `.eslintrc` overrides are fully replaced below, which would drop
      // an existing `parserOptions.project`. Detect it first so we can carry it
      // over. (Flat configs keep typed linting via `lintProjectGenerator`, so
      // this is only needed on the legacy stack.)
      const eslintFile = findEslintFile(tree, options.projectRoot);
      const eslintFileContent = eslintFile
        ? tree.read(joinPathFragments(options.projectRoot, eslintFile), 'utf8')
        : null;
      const hasTypedLinting =
        !!eslintFileContent &&
        detectTypedLintingShape(eslintFileContent) !== null;
      replaceOverridesInLintConfig(tree, options.projectRoot, [
        ...(rootProject ? [typeScriptOverride, javaScriptOverride] : []),
        {
          files: ['*.ts'],
          // Legacy `.eslintrc` is on typescript-eslint v7, which only supports
          // `parserOptions.project` (no `projectService`).
          ...(hasTypedLinting
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
