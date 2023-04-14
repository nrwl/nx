import type { Tree } from '@nx/devkit';
import { joinPathFragments } from '@nx/devkit';
import { dirname } from 'path';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { insertImport } from '@nx/js';
import {
  insertNgModuleProperty,
  ngModuleDecoratorProperty,
} from './insert-ngmodule-import';

let tsModule: typeof import('typescript');

export function findModule(tree: Tree, path: string, module?: string) {
  let modulePath = '';
  let pathToSearch = path;
  while (pathToSearch !== '.' && pathToSearch !== '/') {
    if (module) {
      const pathToModule = joinPathFragments(pathToSearch, module);
      if (tree.exists(pathToModule)) {
        modulePath = pathToModule;
        break;
      }
    } else {
      const potentialOptions = tree
        .children(pathToSearch)
        .filter((f) => f.endsWith('.module.ts'));
      if (potentialOptions.length > 1) {
        throw new Error(
          `More than one NgModule was found. Please provide the NgModule you wish to use.`
        );
      } else if (potentialOptions.length === 1) {
        modulePath = joinPathFragments(pathToSearch, potentialOptions[0]);
        break;
      }
    }
    pathToSearch = dirname(pathToSearch);
  }

  if (modulePath === '') {
    throw new Error('Could not find a declaring module file.');
  }

  const moduleContents = tree.read(modulePath, 'utf-8');
  if (!moduleContents.includes('@NgModule')) {
    throw new Error(
      `Declaring module file (${modulePath}) does not contain an @NgModule Declaration.`
    );
  }

  return modulePath;
}

export function addToNgModule(
  tree: Tree,
  path: string,
  modulePath: string,
  name: string,
  className: string,
  fileName: string,
  ngModuleProperty: ngModuleDecoratorProperty,
  isFlat = true,
  isExported = false
) {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  let relativePath = `${joinPathFragments(
    path.replace(dirname(modulePath), ''),
    !isFlat ? name : '',
    `${fileName}`
  )}`;
  relativePath = relativePath.startsWith('/')
    ? `.${relativePath}`
    : `./${relativePath}`;

  const moduleContents = tree.read(modulePath, 'utf-8');
  const source = tsModule.createSourceFile(
    modulePath,
    moduleContents,
    tsModule.ScriptTarget.Latest,
    true
  );

  insertImport(tree, source, modulePath, className, relativePath);
  insertNgModuleProperty(tree, modulePath, className, ngModuleProperty);
  if (isExported) {
    insertNgModuleProperty(tree, modulePath, className, 'exports');
  }
}
