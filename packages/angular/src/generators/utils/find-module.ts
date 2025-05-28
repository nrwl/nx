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
  const candidatePaths: string[] = [];
  let pathToSearch = path;
  while (pathToSearch !== '.' && pathToSearch !== '/') {
    if (module) {
      const pathToModule = joinPathFragments(pathToSearch, module);
      if (tree.exists(pathToModule)) {
        candidatePaths.push(pathToModule);
        break;
      }
    } else {
      const potentialOptions = tree
        .children(pathToSearch)
        .filter((f) => f.endsWith('.module.ts') || f.endsWith('-module.ts'));
      if (potentialOptions.length > 0) {
        candidatePaths.push(
          ...potentialOptions.map((p) => joinPathFragments(pathToSearch, p))
        );
        break;
      }
    }
    pathToSearch = dirname(pathToSearch);
  }

  if (candidatePaths.length === 0) {
    throw new Error('Could not find a declaring module file.');
  }

  const modules = candidatePaths.filter((p) => {
    const moduleContents = tree.read(p, 'utf-8');
    return moduleContents.includes('@NgModule');
  });

  if (modules.length === 0) {
    throw new Error(
      candidatePaths.length === 1
        ? `Declaring module file (${candidatePaths[0]}) does not contain an @NgModule Declaration.`
        : `Declaring module files (${candidatePaths.join(
            ', '
          )}) do not contain an @NgModule Declaration.`
    );
  }

  if (modules.length > 1) {
    throw new Error(
      `More than one NgModule was found. Please provide the NgModule you wish to use.`
    );
  }

  return modules[0];
}

export function addToNgModule(
  tree: Tree,
  path: string,
  modulePath: string,
  name: string,
  className: string,
  fileName: string,
  ngModuleProperty: ngModuleDecoratorProperty,
  // TODO(leo): remove once all consumers are updated
  // // check if exported in the public api
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
