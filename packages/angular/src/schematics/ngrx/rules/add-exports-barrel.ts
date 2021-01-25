import * as ts from 'typescript';
import * as path from 'path';
import { Rule, Tree } from '@angular-devkit/schematics';

import { insert, addGlobal } from '@nrwl/workspace';
import { Schema } from '../schema';
import { names } from '@nrwl/devkit';

/**
 * Add ngrx feature exports to the public barrel in the feature library
 */
export function addExportsToBarrel(options: Schema): Rule {
  return (host: Tree) => {
    if (!host.exists(options.module)) {
      throw new Error(
        `Specified module path (${options.module}) does not exist`
      );
    }

    // Only update the public barrel for feature libraries
    if (options.root != true) {
      const moduleDir = path.dirname(options.module);
      const indexFilePath = path.join(moduleDir, '../index.ts');
      const hasFacade = options.facade == true;
      const addModels = options.syntax === 'creators';
      const className = `${names(options.name).className}`;
      const exportBarrels = options.barrels === true;

      const buffer = host.read(indexFilePath);
      if (!!buffer) {
        // AST to 'index.ts' barrel for the public API
        const indexSource = buffer!.toString('utf-8');
        const indexSourceFile = ts.createSourceFile(
          indexFilePath,
          indexSource,
          ts.ScriptTarget.Latest,
          true
        );

        // Public API for the feature interfaces, selectors, and facade
        const { fileName } = names(options.name);
        const statePath = `./lib/${options.directory}/${fileName}`;

        insert(host, indexFilePath, [
          ...addGlobal(
            indexSourceFile,
            indexFilePath,
            exportBarrels
              ? `import * as ${className}Actions from '${statePath}.actions';`
              : `export * from '${statePath}.actions';`
          ),
          ...addGlobal(
            indexSourceFile,
            indexFilePath,
            exportBarrels
              ? `import * as ${className}Feature from '${statePath}.reducer';`
              : `export * from '${statePath}.reducer';`
          ),
          ...addGlobal(
            indexSourceFile,
            indexFilePath,
            exportBarrels
              ? `import * as ${className}Selectors from '${statePath}.selectors';`
              : `export * from '${statePath}.selectors';`
          ),
          ...(exportBarrels
            ? addGlobal(
                indexSourceFile,
                indexFilePath,
                `export { ${className}Actions, ${className}Feature, ${className}Selectors };`
              )
            : []),
          ...(addModels
            ? addGlobal(
                indexSourceFile,
                indexFilePath,
                `export * from '${statePath}.models';`
              )
            : []),
          ...(hasFacade
            ? addGlobal(
                indexSourceFile,
                indexFilePath,
                `export * from '${statePath}.facade';`
              )
            : []),
        ]);
      }
    }

    return host;
  };
}
