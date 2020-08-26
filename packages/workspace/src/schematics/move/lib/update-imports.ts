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
import { ProjectType } from '@nrwl/workspace/src/utils/project-type';

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

        const projectRef = {
          from: normalizeSlashes(
            `@${nxJson.npmScope}/${project.root.substr(libsDir.length + 1)}`
          ),
          to: normalizeSlashes(`@${nxJson.npmScope}/${schema.destination}`),
        };

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

        const projectRoot = {
          from: project.root.substr(libsDir.length + 1),
          to: schema.destination,
        };

        const tsConfigPath = 'tsconfig.base.json';
        if (tree.exists(tsConfigPath)) {
          let contents = JSON.parse(tree.read(tsConfigPath).toString('utf-8'));
          const path = contents.compilerOptions.paths[
            projectRef.from
          ] as string[];

          contents.compilerOptions.paths[projectRef.to] = path.map((x) =>
            x.replace(new RegExp(projectRoot.from, 'g'), projectRoot.to)
          );
          delete contents.compilerOptions.paths[projectRef.from];

          tree.overwrite(tsConfigPath, serializeJson(contents));
        }

        return tree;
      })
    );
  };
}
