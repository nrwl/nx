import { Rule, SchematicContext, Tree } from '@angular-devkit/schematics';
import { Schema } from '../schema';
import { from, Observable } from 'rxjs';
import { getWorkspace } from '@nrwl/workspace';
import { map } from 'rxjs/operators';
import { join } from 'path';
import { offsetFromRoot } from '@nrwl/devkit';
import { getDestination } from '@nrwl/workspace/src/schematics/move/lib/utils';

interface PartialEsLintRcJson {
  extends: string;
}

/**
 * Update the .eslintrc file of the project if it exists.
 *
 * @param schema The options provided to the schematic
 */
export function updateEslintrcJson(schema: Schema): Rule {
  return (tree: Tree, _context: SchematicContext): Observable<Tree> => {
    return from(getWorkspace(tree)).pipe(
      map((workspace) => {
        const destination = getDestination(schema, workspace, tree);
        const eslintRcPath = join(destination, '.eslintrc.json');

        if (!tree.exists(eslintRcPath)) {
          // no .eslintrc found. nothing to do
          return tree;
        }

        const eslintRcJson = JSON.parse(
          tree.read(eslintRcPath).toString('utf-8')
        ) as PartialEsLintRcJson;

        const offset = offsetFromRoot(destination);

        eslintRcJson.extends = offset + '.eslintrc.json';

        tree.overwrite(eslintRcPath, JSON.stringify(eslintRcJson));

        return tree;
      })
    );
  };
}
