import { transpile, JsxEmit, ScriptTarget } from 'typescript';
import {
  forEach,
  when,
  chain,
  CreateFileAction,
  Rule,
} from '@angular-devkit/schematics';
import { normalize } from '@angular-devkit/core';
import { updateJsonInTree } from '../ast-utils';

const uniq = <T extends string[]>(value: T) => [...new Set(value)] as T;

const changeFileExtensions: Rule = (tree, context) => {
  return forEach(
    when(
      (path) => path.endsWith('.ts') || path.endsWith('.tsx'),
      (entry) => {
        const path = normalize(entry.path.replace(/\.tsx?$/, '.js'));
        if (tree.exists(path)) {
          return null;
        }
        const original = entry.content.toString('utf-8');
        const result = transpile(original, {
          allowJs: true,
          jsx: JsxEmit.Preserve,
          target: ScriptTarget.ESNext,
        });
        return {
          content: Buffer.from(result, 'utf-8'),
          path,
        };
      }
    )
  )(tree, context);
};

const changeExtensionsInConfigFiles: Rule = (tree, context) => {
  const files = new Set(
    tree.actions
      .filter((action) => action.kind === 'c')
      .map((action: CreateFileAction) => ({
        path: action.path,
        content: action.content.toString(),
      }))
  );
  if (files.size === 0) {
    return tree;
  }

  [...files].forEach((file) => {
    try {
      // replace strings in single or double quotes that end with .ts or .tsx with .js
      tree.overwrite(
        file.path,
        file.content.replace(/(?<!\.d)\.tsx?(?=['"])/gi, '.js')
      );
    } catch (e) {
      context.logger.warn(
        `Error converting ${file.path} with --js flag: ${e.message}`
      );
    }
  });

  return tree;
};

const updateTsConfigsToJs = forEach(
  when(
    (path) =>
      path.endsWith('/tsconfig.json') ||
      path.endsWith('/tsconfig.lib.json') ||
      path.endsWith('/tsconfig.app.json'),
    ({ path, content }) => {
      const json = JSON.parse(content.toString('utf-8'));
      if (path.endsWith('/tsconfig.json')) {
        if (json.compilerOptions) {
          json.compilerOptions.allowJs = true;
        } else {
          json.compilerOptions = { allowJs: true };
        }
      }

      if (
        path.endsWith('/tsconfig.lib.json') ||
        path.endsWith('/tsconfig.app.json')
      ) {
        json.include = uniq([...json.include, '**/*.js']);
        json.exclude = uniq([...json.exclude, '**/*.spec.js']);
      }

      return {
        content: Buffer.from(JSON.stringify(json), 'utf-8'),
        path,
      };
    }
  )
);

export function toJS(): Rule {
  return chain([
    changeFileExtensions,
    changeExtensionsInConfigFiles,
    updateTsConfigsToJs,
  ]);
}
