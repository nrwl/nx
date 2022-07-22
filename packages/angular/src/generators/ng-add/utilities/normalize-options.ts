import {
  detectWorkspaceScope,
  joinPathFragments,
  names,
  readJson,
  Tree,
} from '@nrwl/devkit';
import { GeneratorOptions } from '../schema';
import { WorkspaceProjects } from './types';

export function normalizeOptions(
  tree: Tree,
  options: GeneratorOptions,
  projects: WorkspaceProjects
): GeneratorOptions {
  let npmScope = options.npmScope;
  if (npmScope) {
    npmScope = names(npmScope).fileName;
  } else if (projects.libs.length > 0) {
    // try get the scope from any library that have one
    for (const lib of projects.libs) {
      const packageJsonPath = joinPathFragments(
        lib.config.root,
        'package.json'
      );
      if (!tree.exists(packageJsonPath)) {
        continue;
      }

      const { name } = readJson(
        tree,
        joinPathFragments(lib.config.root, 'package.json')
      );
      npmScope = detectWorkspaceScope(name);
      if (npmScope) {
        break;
      }
    }
  }

  // use the name (scope if exists) in the root package.json
  npmScope =
    npmScope || detectWorkspaceScope(readJson(tree, 'package.json').name);

  return { ...options, npmScope };
}
