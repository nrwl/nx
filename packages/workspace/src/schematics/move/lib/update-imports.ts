import {
  SchematicContext,
  Tree,
  UpdateRecorder,
} from '@angular-devkit/schematics';
import {
  findNodes,
  getWorkspace,
  NxJson,
  readJsonInTree,
  serializeJson,
} from '@nrwl/workspace';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import * as ts from 'typescript';
import { Schema } from '../schema';
import { normalizeSlashes } from './utils';

/**
 * Updates all the imports in the workspace and modifies the tsconfig appropriately.
 *
 * @param schema The options provided to the schematic
 */
export function updateImports(schema: Schema) {
  return (tree: Tree, _context: SchematicContext): Observable<Tree> => {
    return from(getWorkspace(tree)).pipe(
      map((workspace) => {
        const nxJson = readJsonInTree<NxJson>(tree, 'nx.json');
        const libsDir = nxJson.workspaceLayout?.libsDir
          ? nxJson.workspaceLayout.libsDir
          : 'libs';
        const project = workspace.projects.get(schema.projectName);

        if (project.extensions['projectType'] === 'application') {
          // These shouldn't be imported anywhere?
          return tree;
        }

        // use the source root to find the from location
        // this attempts to account for libs that have been created with --importPath
        const tsConfigPath = 'tsconfig.base.json';
        let tsConfig: any;
        let fromPath: string;
        if (tree.exists(tsConfigPath)) {
          tsConfig = JSON.parse(tree.read(tsConfigPath).toString('utf-8'));
          fromPath = Object.keys(tsConfig.compilerOptions.paths).find((path) =>
            tsConfig.compilerOptions.paths[path].some((x) =>
              x.startsWith(project.sourceRoot)
            )
          );
        }

        const projectRef = {
          from:
            fromPath ||
            normalizeSlashes(
              `@${nxJson.npmScope}/${project.root.substr(libsDir.length + 1)}`
            ),
          to:
            schema.importPath ||
            normalizeSlashes(`@${nxJson.npmScope}/${schema.destination}`),
        };

        if (schema.updateImportPath) {
          const replaceProjectRef = new RegExp(projectRef.from, 'g');

          for (const [name, definition] of workspace.projects.entries()) {
            if (name === schema.projectName) {
              continue;
            }

            const projectDir = tree.getDir(definition.root);
            projectDir.visit((file) => {
              const contents = tree.read(file).toString('utf-8');
              if (!replaceProjectRef.test(contents)) {
                return;
              }

              updateImportPaths(
                tree,
                file,
                contents,
                projectRef.from,
                projectRef.to
              );
            });
          }
        }

        const projectRoot = {
          from: project.root.substr(libsDir.length + 1),
          to: schema.destination,
        };

        if (tsConfig) {
          const path = tsConfig.compilerOptions.paths[
            projectRef.from
          ] as string[];
          if (!path) {
            throw new Error(
              [
                `unable to find "${projectRef.from}" in`,
                `${tsConfigPath} compilerOptions.paths`,
              ].join(' ')
            );
          }
          const updatedPath = path.map((x) =>
            x.replace(new RegExp(projectRoot.from, 'g'), projectRoot.to)
          );

          if (schema.updateImportPath) {
            tsConfig.compilerOptions.paths[projectRef.to] = updatedPath;
            delete tsConfig.compilerOptions.paths[projectRef.from];
          } else {
            tsConfig.compilerOptions.paths[projectRef.from] = updatedPath;
          }

          tree.overwrite(tsConfigPath, serializeJson(tsConfig));
        }

        return tree;
      })
    );
  };
}

function updateImportPaths(
  tree: Tree,
  path: string,
  contents: string,
  from: string,
  to: string
) {
  const sourceFile = ts.createSourceFile(
    path,
    contents,
    ts.ScriptTarget.Latest,
    true
  );

  const recorder = tree.beginUpdate(path);

  // perform transformations on the various types of imports
  updateImportDeclarations(recorder, sourceFile, from, to);
  updateDynamicImports(recorder, sourceFile, from, to);

  tree.commitUpdate(recorder);
}

/**
 * Update the module specifiers on static imports
 */
function updateImportDeclarations(
  recorder: UpdateRecorder,
  sourceFile: ts.SourceFile,
  from: string,
  to: string
) {
  const importDecls = findNodes(
    sourceFile,
    ts.SyntaxKind.ImportDeclaration
  ) as ts.ImportDeclaration[];

  for (const { moduleSpecifier } of importDecls) {
    if (ts.isStringLiteral(moduleSpecifier)) {
      updateModuleSpecifier(recorder, moduleSpecifier, from, to);
    }
  }
}

/**
 * Update the module specifiers on dynamic imports and require statements
 */
function updateDynamicImports(
  recorder: UpdateRecorder,
  sourceFile: ts.SourceFile,
  from: string,
  to: string
) {
  const expressions = findNodes(
    sourceFile,
    ts.SyntaxKind.CallExpression
  ) as ts.CallExpression[];

  for (const { expression, arguments: args } of expressions) {
    const moduleSpecifier = args[0];

    // handle dynamic import statements
    if (
      expression.kind === ts.SyntaxKind.ImportKeyword &&
      moduleSpecifier &&
      ts.isStringLiteral(moduleSpecifier)
    ) {
      updateModuleSpecifier(recorder, moduleSpecifier, from, to);
    }

    // handle require statements
    if (
      ts.isIdentifier(expression) &&
      expression.text === 'require' &&
      moduleSpecifier &&
      ts.isStringLiteral(moduleSpecifier)
    ) {
      updateModuleSpecifier(recorder, moduleSpecifier, from, to);
    }
  }
}

/**
 * Replace the old module specifier with a the new path
 */
function updateModuleSpecifier(
  recorder: UpdateRecorder,
  moduleSpecifier: ts.StringLiteral,
  from: string,
  to: string
) {
  if (
    moduleSpecifier.text === from ||
    moduleSpecifier.text.startsWith(from + '/')
  ) {
    recorder.remove(
      moduleSpecifier.getStart() + 1,
      moduleSpecifier.text.length
    );

    // insert the new module specifier
    recorder.insertLeft(
      moduleSpecifier.getStart() + 1,
      moduleSpecifier.text.replace(new RegExp(from, 'g'), to)
    );
  }
}
