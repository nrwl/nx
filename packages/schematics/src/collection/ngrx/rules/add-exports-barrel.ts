import * as ts from 'typescript';
import * as path from 'path';
import { Rule, Tree } from '@angular-devkit/schematics';

import { names } from '../../../utils/name-utils';
import { insert, addGlobal } from '../../../utils/ast-utils';
import { Schema } from '../schema';

/**
 * Add ngrx feature exports to the public barrel in the feature library
 */
export function addExportsToBarrel(options: Schema): Rule {
  return (host: Tree) => {
    if (!host.exists(options.module)) {
      throw new Error('Specified module does not exist');
    }

    // Only update the public barrel for feature libraries
    if (options.root != true) {
      const moduleDir = path.dirname(options.module);
      const indexFilePath = path.join(moduleDir, '../index.ts');
      const hasFacade = options.facade == true;

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
          ...(hasFacade
            ? addGlobal(
                indexSourceFile,
                indexFilePath,
                `export * from '${statePath}.facade';`
              )
            : []),
          ...addGlobal(
            indexSourceFile,
            indexFilePath,
            `export * from '${statePath}.reducer';`
          ),
          ...addGlobal(
            indexSourceFile,
            indexFilePath,
            `export * from '${statePath}.selectors';`
          )
        ]);
      }
    }

    return host;
  };
}
