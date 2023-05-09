import type { Tree } from '@nx/devkit';
import { joinPathFragments, names } from '@nx/devkit';
import { NormalizedNgRxFeatureStoreGeneratorOptions } from './normalize-options';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';

import { addGlobal } from '@nx/js';

let tsModule: typeof import('typescript');

export function addExportsToBarrel(
  tree: Tree,
  options: NormalizedNgRxFeatureStoreGeneratorOptions
): void {
  const indexFilePath = joinPathFragments(
    options.parentDirectory,
    '..',
    'index.ts'
  );
  if (!tree.exists(indexFilePath)) {
    return;
  }

  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const indexSourceText = tree.read(indexFilePath, 'utf-8');
  let sourceFile = tsModule.createSourceFile(
    indexFilePath,
    indexSourceText,
    tsModule.ScriptTarget.Latest,
    true
  );

  // Public API for the feature interfaces, selectors, and facade
  const { className, fileName } = names(options.name);
  const statePath = `./lib/${options.directory}/${fileName}`;

  sourceFile = addGlobal(
    tree,
    sourceFile,
    indexFilePath,
    options.barrels
      ? `import * as ${className}Actions from '${statePath}.actions';`
      : `export * from '${statePath}.actions';`
  );
  sourceFile = addGlobal(
    tree,
    sourceFile,
    indexFilePath,
    options.barrels
      ? `import * as ${className}Feature from '${statePath}.reducer';`
      : `export * from '${statePath}.reducer';`
  );
  sourceFile = addGlobal(
    tree,
    sourceFile,
    indexFilePath,
    options.barrels
      ? `import * as ${className}Selectors from '${statePath}.selectors';`
      : `export * from '${statePath}.selectors';`
  );

  if (options.barrels) {
    sourceFile = addGlobal(
      tree,
      sourceFile,
      indexFilePath,
      `export { ${className}Actions, ${className}Feature, ${className}Selectors };`
    );
  }

  sourceFile = addGlobal(
    tree,
    sourceFile,
    indexFilePath,
    `export * from '${statePath}.models';`
  );

  if (options.facade) {
    sourceFile = addGlobal(
      tree,
      sourceFile,
      indexFilePath,
      `export * from '${statePath}.facade';`
    );
  }
}
