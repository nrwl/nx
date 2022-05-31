import type { Tree } from '@nrwl/devkit';
import { joinPathFragments, normalizePath } from '@nrwl/devkit';
import { basename, dirname } from 'path';
import type { Schema } from '../schema';

// Adapted from https://github.com/angular/angular-cli/blob/main/packages/schematics/angular/utility/find-module.ts#L29
// to match the logic in the component schematic. It doesn't throw if it can't
// find a module since the schematic would have thrown before getting here.
const moduleExt = '.module.ts';
const routingModuleExt = '-routing.module.ts';

export function findModuleFromOptions(
  tree: Tree,
  options: Schema,
  projectRoot: string
): string | null {
  if (!options.module) {
    const pathToCheck = joinPathFragments(options.path, options.name);

    return normalizePath(findModule(tree, pathToCheck, projectRoot));
  } else {
    const modulePath = joinPathFragments(options.path, options.module);
    const componentPath = joinPathFragments(options.path, options.name);
    const moduleBaseName = basename(modulePath);

    const candidateSet = new Set<string>([options.path]);

    const projectRootParent = dirname(projectRoot);
    for (let dir = modulePath; dir !== projectRootParent; dir = dirname(dir)) {
      candidateSet.add(dir);
    }
    for (let dir = componentPath; dir !== projectRoot; dir = dirname(dir)) {
      candidateSet.add(dir);
    }

    const candidatesDirs = [...candidateSet].sort(
      (a, b) => b.length - a.length
    );
    for (const c of candidatesDirs) {
      const candidateFiles = [
        '',
        `${moduleBaseName}.ts`,
        `${moduleBaseName}${moduleExt}`,
      ].map((x) => joinPathFragments(c, x));

      for (const sc of candidateFiles) {
        if (tree.isFile(sc)) {
          return normalizePath(sc);
        }
      }
    }

    return null;
  }
}

function findModule(
  tree: Tree,
  generateDir: string,
  projectRoot: string
): string | null {
  let dir = generateDir;
  const projectRootParent = dirname(projectRoot);

  while (dir !== projectRootParent) {
    const allMatches = tree
      .children(dir)
      .map((path) => joinPathFragments(dir, path))
      .filter((path) => tree.isFile(path) && path.endsWith(moduleExt));
    const filteredMatches = allMatches.filter(
      (path) => !path.endsWith(routingModuleExt)
    );

    if (filteredMatches.length == 1) {
      return filteredMatches[0];
    } else if (filteredMatches.length > 1) {
      return null;
    }

    dir = dirname(dir);
  }

  return null;
}
