import { classify } from '@angular-devkit/core/src/utils/strings';
import { SchematicContext, Tree } from '@angular-devkit/schematics';
import { getWorkspace } from '@nrwl/workspace';
import { getNewProjectName } from '@nrwl/workspace/src/generators/move/lib/utils';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Schema } from '../schema';

/**
 * Updates the Angular module name (including the spec file and index.ts)
 *
 * Again, if the user has deviated from the expected folder
 * structure, they are very much on their own.
 *
 * @param schema The options provided to the schematic
 */
export function updateModuleName(schema: Schema) {
  return (tree: Tree, _context: SchematicContext): Observable<Tree> => {
    return from(getWorkspace(tree)).pipe(
      map((workspace) => {
        const newProjectName = getNewProjectName(schema.destination);
        const project = workspace.projects.get(newProjectName);

        if (project.extensions['projectType'] === 'application') {
          // Expect the module to be something like 'app.module.ts' regardless of the folder name,
          // Therefore, nothing to do.
          return tree;
        }

        const moduleName = {
          from: classify(schema.projectName),
          to: classify(newProjectName),
        };

        const findModuleName = new RegExp(`\\b${moduleName.from}`, 'g');

        const moduleFile = {
          from: `${schema.projectName}.module`,
          to: `${newProjectName}.module`,
        };

        const replaceImport = new RegExp(moduleFile.from, 'g');

        const filesToChange = [
          {
            from: `${project.sourceRoot}/lib/${moduleFile.from}.ts`,
            to: `${project.sourceRoot}/lib/${moduleFile.to}.ts`,
          },
          {
            from: `${project.sourceRoot}/lib/${moduleFile.from}.spec.ts`,
            to: `${project.sourceRoot}/lib/${moduleFile.to}.spec.ts`,
          },
        ];

        // Update the module file and its spec file
        filesToChange.forEach((file) => {
          if (tree.exists(file.from)) {
            let content = tree.read(file.from).toString('utf-8');

            if (findModuleName.test(content)) {
              content = content.replace(findModuleName, moduleName.to);
            }

            if (replaceImport.test(content)) {
              content = content.replace(replaceImport, moduleFile.to);
            }

            tree.create(file.to, content);

            tree.delete(file.from);
          }
        });

        // Update any files which import the module
        for (const [name, definition] of workspace.projects.entries()) {
          if (name === newProjectName) {
            continue;
          }

          const projectDir = tree.getDir(definition.root);
          projectDir.visit((file) => {
            const contents = tree.read(file).toString('utf-8');
            if (!findModuleName.test(contents)) {
              return;
            }

            const updatedFile = tree
              .read(file)
              .toString()
              .replace(findModuleName, moduleName.to);
            tree.overwrite(file, updatedFile);
          });
        }

        // Update the index file
        const indexFile = `${project.sourceRoot}/index.ts`;
        if (tree.exists(indexFile)) {
          let content = tree.read(indexFile).toString('utf-8');
          content = content.replace(replaceImport, moduleFile.to);
          tree.overwrite(indexFile, content);
        }

        return tree;
      })
    );
  };
}
