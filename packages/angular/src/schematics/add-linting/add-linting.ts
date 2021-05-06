import { join, normalize } from '@angular-devkit/core';
import { chain, noop, Rule, Tree } from '@angular-devkit/schematics';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import {
  addLintFiles,
  getWorkspacePath,
  Linter,
  offsetFromRoot,
  updateJsonInTree,
} from '@nrwl/workspace';
import {
  createAngularEslintJson,
  createAngularProjectESLintLintTarget,
  extraEslintDependencies,
} from '../../utils/lint';
import { Schema } from './schema';

export default function addLinting(options: Schema): Rule {
  return chain([
    addLintFiles(options.projectRoot, options.linter, {
      onlyGlobal: options.linter === Linter.TsLint, // local lint files are added differently when tslint
      localConfig:
        options.linter === Linter.TsLint
          ? undefined
          : createAngularEslintJson(options.projectRoot, options.prefix),
      extraPackageDeps:
        options.linter === Linter.TsLint ? undefined : extraEslintDependencies,
    }),
    options.projectType === 'application' && options.linter === Linter.TsLint
      ? updateTsLintConfig(options)
      : noop(),
    options.projectType === 'library' && options.linter === Linter.TsLint
      ? updateJsonInTree(`${options.projectRoot}/tslint.json`, (json) => {
          return {
            ...json,
            extends: `${offsetFromRoot(options.projectRoot)}tslint.json`,
            linterOptions: {
              exclude: ['!**/*'],
            },
          };
        })
      : noop(),
    updateProject(options),
  ]);
}

function updateTsLintConfig(options: Schema): Rule {
  return chain([
    updateJsonInTree('tslint.json', (json) => {
      if (
        json.rulesDirectory &&
        json.rulesDirectory.indexOf('node_modules/codelyzer') === -1
      ) {
        json.rulesDirectory.push('node_modules/codelyzer');
        json.rules = {
          ...json.rules,

          'directive-selector': [true, 'attribute', 'app', 'camelCase'],
          'component-selector': [true, 'element', 'app', 'kebab-case'],
          'no-conflicting-lifecycle': true,
          'no-host-metadata-property': true,
          'no-input-rename': true,
          'no-inputs-metadata-property': true,
          'no-output-native': true,
          'no-output-on-prefix': true,
          'no-output-rename': true,
          'no-outputs-metadata-property': true,
          'template-banana-in-box': true,
          'template-no-negated-async': true,
          'use-lifecycle-interface': true,
          'use-pipe-transform-interface': true,
        };
      }
      return json;
    }),
    updateJsonInTree(`${options.projectRoot}/tslint.json`, (json) => {
      json.extends = `${offsetFromRoot(options.projectRoot)}tslint.json`;
      json.linterOptions = {
        exclude: ['!**/*'],
      };
      return json;
    }),
  ]);
}

function updateProject(options: Schema): Rule {
  return (host: Tree) => {
    return chain([
      updateJsonInTree(getWorkspacePath(host), (json) => {
        const project = json.projects[options.projectName];

        if (options.linter === Linter.TsLint) {
          project.architect.lint.options.exclude.push(
            '!' + join(normalize(options.projectRoot), '**/*')
          );

          if (options.projectType === 'application') {
            project.architect.lint.options.tsConfig = project.architect.lint.options.tsConfig.filter(
              (path) =>
                path !==
                  join(normalize(options.projectRoot), 'tsconfig.spec.json') &&
                path !==
                  join(normalize(options.projectRoot), 'e2e/tsconfig.json')
            );
          }

          if (options.projectType === 'library') {
            project.architect.lint.options.tsConfig = Array.from(
              new Set(project.architect.lint.options.tsConfig)
            );
          }
        }

        if (options.linter === Linter.EsLint) {
          project.architect.lint = createAngularProjectESLintLintTarget(
            options.projectRoot
          );
          host.delete(`${options.projectRoot}/tslint.json`);
        }

        json.projects[options.projectName] = project;
        return json;
      }),
    ]);
  };
}

export const addLintingGenerator = wrapAngularDevkitSchematic(
  '@nrwl/angular',
  'add-linting'
);
