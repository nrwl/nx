import type { Tree } from '@nx/devkit';
import { joinPathFragments, normalizePath } from '@nx/devkit';
import { basename, dirname } from 'path';

export type ModuleOptions = {
  directory: string;
  module?: string;
  moduleExt?: string;
  routingModuleExt?: string;
};

// Adapted from https://github.com/angular/angular-cli/blob/732aab5fa7e63618c89dfbbb6f78753f706d7014/packages/schematics/angular/utility/find-module.ts#L29
// to match the logic from the Angular CLI component schematic.
const MODULE_EXT = '.module.ts';
const ROUTING_MODULE_EXT = '-routing.module.ts';

export function findModuleFromOptions(
  tree: Tree,
  options: ModuleOptions,
  projectRoot: string
): string {
  const moduleExt = options.moduleExt || MODULE_EXT;
  const routingModuleExt = options.routingModuleExt || ROUTING_MODULE_EXT;

  if (!options.module) {
    return normalizePath(
      findModule(
        tree,
        options.directory,
        projectRoot,
        moduleExt,
        routingModuleExt
      )
    );
  } else {
    const modulePath = joinPathFragments(options.directory, options.module);
    const componentPath = options.directory;
    const moduleBaseName = basename(modulePath);

    const candidateSet = new Set<string>([options.directory]);

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
        moduleBaseName,
        `${moduleBaseName}.ts`,
        `${moduleBaseName}${moduleExt}`,
      ].map((x) => joinPathFragments(c, x));

      for (const sc of candidateFiles) {
        if (tree.isFile(sc) && tree.read(sc, 'utf-8').includes('@NgModule')) {
          return normalizePath(sc);
        }
      }
    }

    throw new Error(
      `Specified module '${options.module}' does not exist.\n` +
        `Looked in the following directories:\n    ${candidatesDirs.join(
          '\n    '
        )}`
    );
  }
}

function findModule(
  tree: Tree,
  generateDir: string,
  projectRoot: string,
  moduleExt = MODULE_EXT,
  routingModuleExt = ROUTING_MODULE_EXT
): string {
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
      throw new Error(
        "Found more than one candidate module to add the component to. Please specify which module the component should be added to by using the '--module' option."
      );
    }

    dir = dirname(dir);
  }

  throw new Error(
    "Could not find a candidate module to add the component to. Please specify which module the component should be added to by using the '--module' option, or pass '--standalone' to generate a standalone component."
  );
}
