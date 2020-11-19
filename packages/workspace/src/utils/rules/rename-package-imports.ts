import * as ts from 'typescript';
import { SchematicContext, Tree } from '@angular-devkit/schematics';
import { getWorkspace } from '@nrwl/workspace';
import {
  getFullProjectGraphFromHost,
  findNodes,
  insert,
  ReplaceChange,
} from '@nrwl/workspace/src/utils/ast-utils';

export interface PackageNameMapping {
  [packageName: string]: string;
}

const getProjectNamesWithDepsToRename = (
  packageNameMapping: PackageNameMapping,
  tree: Tree
) => {
  const packagesToRename = Object.entries(packageNameMapping);
  const projectGraph = getFullProjectGraphFromHost(tree);

  return Object.entries(projectGraph.dependencies)
    .filter(([, deps]) =>
      deps.some(
        (dep) =>
          dep.type === 'static' &&
          packagesToRename.some(
            ([packageName]) => packageName === dep.target.replace('npm:', '')
          )
      )
    )
    .map(([projectName]) => projectName);
};

/**
 * Updates all the imports found in the workspace
 *
 * @param packageNameMapping The packageNameMapping provided to the schematic
 */
export function renamePackageImports(packageNameMapping: PackageNameMapping) {
  return async (tree: Tree, _context: SchematicContext): Promise<void> => {
    const workspace = await getWorkspace(tree);

    const projectNamesThatImportAPackageToRename = getProjectNamesWithDepsToRename(
      packageNameMapping,
      tree
    );

    const projectsThatImportPackage = [...workspace.projects].filter(([name]) =>
      projectNamesThatImportAPackageToRename.includes(name)
    );

    projectsThatImportPackage
      .map(([, definition]) => tree.getDir(definition.root))
      .forEach((projectDir) => {
        projectDir.visit((file) => {
          // only look at .(j|t)s(x) files
          if (!/(j|t)sx?$/.test(file)) {
            return;
          }
          // if it doesn't contain at least 1 reference to the packages to be renamed bail out
          const contents = tree.read(file).toString('utf-8');
          if (
            !Object.keys(packageNameMapping).some((packageName) =>
              contents.includes(packageName)
            )
          ) {
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
        });
      });
  };
}
