import type { Tree } from '@nrwl/devkit';
import { generateFiles, joinPathFragments, names } from '@nrwl/devkit';
import { dirname } from 'path';
import type { NgRxGeneratorOptions } from '../schema';

/**
 * Generate 'feature' scaffolding: actions, reducer, effects, interfaces, selectors, facade
 */
export function generateNgrxFilesFromTemplates(
  tree: Tree,
  options: NgRxGeneratorOptions
): void {
  const name = options.name;
  const moduleDir = dirname(options.module);
  const templatesDir =
    !options.syntax || options.syntax === 'creators'
      ? './files/creator-syntax'
      : './files/classes-syntax';
  const projectNames = names(name);

  generateFiles(
    tree,
    joinPathFragments(__dirname, '..', templatesDir),
    moduleDir,
    {
      ...options,
      tmpl: '',
      ...projectNames,
    }
  );

  if (!options.facade) {
    tree.delete(
      joinPathFragments(
        moduleDir,
        options.directory,
        `${projectNames.fileName}.facade.ts`
      )
    );
    tree.delete(
      joinPathFragments(
        moduleDir,
        options.directory,
        `${projectNames.fileName}.facade.spec.ts`
      )
    );
  }
}
