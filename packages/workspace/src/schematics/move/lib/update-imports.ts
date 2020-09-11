import { SchematicContext, Tree } from '@angular-devkit/schematics';
import {
  getWorkspace,
  NxJson,
  readJsonInTree,
  serializeJson,
} from '@nrwl/workspace';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
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

              const updatedFile = tree
                .read(file)
                .toString()
                .replace(replaceProjectRef, projectRef.to);
              tree.overwrite(file, updatedFile);
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
