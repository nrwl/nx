import * as ts from 'typescript';
import {
  chain,
  SchematicContext,
  Tree,
  Rule,
} from '@angular-devkit/schematics';
import { getWorkspace } from '../workspace';
import { visitNotIgnoredFiles } from './visit-not-ignored-files';
import { findNodes, insert, ReplaceChange } from '../ast-utils';
import { normalize } from '@angular-devkit/core';

export interface PackageNameMapping {
  [packageName: string]: string;
}

/**
 * Updates all the imports found in the workspace
 *
 * @param packageNameMapping The packageNameMapping provided to the schematic
 */
export function renamePackageImports(
  packageNameMapping: PackageNameMapping
): Rule {
  return async (tree: Tree, _context: SchematicContext) => {
    const workspace = await getWorkspace(tree);

    const rules = [];
    workspace.projects.forEach((project) => {
      rules.push(
        visitNotIgnoredFiles((file) => {
          if (!/([jt])sx?$/.test(file)) {
            return;
          }

          const contents = tree.read(file).toString('utf-8');
          const fileIncludesPackageToRename = Object.keys(
            packageNameMapping
          ).some((packageName) => {
            return contents.includes(packageName);
          });

          if (!fileIncludesPackageToRename) {
            return;
          }

          const astSource = ts.createSourceFile(
            file,
            contents,
            ts.ScriptTarget.Latest,
            true
          );
          const changes = Object.entries(packageNameMapping)
            .map(([packageName, newPackageName]) => {
              const nodes = findNodes(
                astSource,
                ts.SyntaxKind.ImportDeclaration
              ) as ts.ImportDeclaration[];

              return nodes
                .filter((node) => {
                  return (
                    // remove quotes from module name
                    node.moduleSpecifier.getText().slice(1).slice(0, -1) ===
                    packageName
                  );
                })
                .map(
                  (node) =>
                    new ReplaceChange(
                      file,
                      node.moduleSpecifier.getStart(),
                      node.moduleSpecifier.getText(),
                      `'${newPackageName}'`
                    )
                );
            })
            // .flatMap()/.flat() is not available? So, here's a flat poly
            .reduce((acc, val) => acc.concat(val), []);

          // if the reference to packageName was in fact an import statement
          if (changes.length > 0) {
            // update the file in the tree
            insert(tree, file, changes);
          }
        }, normalize(project.root))
      );
    });

    return chain(rules);
  };
}
