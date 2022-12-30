import { transpile, JsxEmit, ScriptTarget } from 'typescript';
import {
  forEach,
  Rule,
  when,
  chain,
  Tree,
  SchematicsException,
} from '@angular-devkit/schematics';
import { normalize } from '@angular-devkit/core';
import { updateJsonInTree } from '../ast-utils';

export function toJS(): Rule {
  return chain([
    forEach(
      when(
        (path) => path.endsWith('.ts') || path.endsWith('.tsx'),
        (entry) => {
          const original = entry.content.toString('utf-8');
          const result = transpile(original, {
            allowJs: true,
            jsx: JsxEmit.Preserve,
            target: ScriptTarget.ESNext,
          });
          return {
            content: Buffer.from(result, 'utf-8'),
            path: normalize(entry.path.replace(/\.tsx?$/, '.js')),
          };
        }
      )
    ),
  ]);
}

export function updateTsConfigsToJs(options: { projectRoot: string }): Rule {
  const paths = {
    tsConfig: normalize(`${options.projectRoot}/tsconfig.json`),
    tsConfigLib: normalize(`${options.projectRoot}/tsconfig.lib.json`),
    tsConfigApp: normalize(`${options.projectRoot}/tsconfig.app.json`),
  };

  const getProjectType = (tree: Tree) => {
    if (tree.exists(paths.tsConfigApp)) {
      return 'application';
    }
    if (tree.exists(paths.tsConfigLib)) {
      return 'library';
    }

    throw new SchematicsException(
      `project is missing tsconfig.lib.json or tsconfig.app.json`
    );
  };

  const getConfigFileForUpdate = (tree: Tree) => {
    const projectType = getProjectType(tree);
    if (projectType === 'library') {
      return paths.tsConfigLib;
    }
    if (projectType === 'application') {
      return paths.tsConfigApp;
    }
  };

  return chain([
    updateJsonInTree(paths.tsConfig, (json) => {
      if (json.compilerOptions) {
        json.compilerOptions.allowJs = true;
      } else {
        json.compilerOptions = { allowJs: true };
      }

      return json;
    }),
    (tree) => {
      const updateConfigPath = getConfigFileForUpdate(tree);

      return updateJsonInTree(updateConfigPath, (json) => {
        json.include = uniq([...json.include, '**/*.js']);
        json.exclude = uniq([...json.exclude, '**/*.spec.js']);

        return json;
      });
    },
  ]);
}

const uniq = <T extends string[]>(value: T) => [...new Set(value)] as T;

export function maybeJs(options: { js: boolean }, path: string): string {
  return options.js && (path.endsWith('.ts') || path.endsWith('.tsx'))
    ? path.replace(/\.tsx?$/, '.js')
    : path;
}
