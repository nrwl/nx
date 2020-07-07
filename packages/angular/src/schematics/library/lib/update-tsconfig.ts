import {
  chain,
  Rule,
  SchematicContext,
  Tree,
} from '@angular-devkit/schematics';
import { NxJson, readJsonInTree, updateJsonInTree } from '@nrwl/workspace';
import { libsDir } from '@nrwl/workspace/src/utils/ast-utils';
import { NormalizedSchema } from './normalized-schema';

export function updateTsConfig(options: NormalizedSchema): Rule {
  return chain([
    (host: Tree, context: SchematicContext) => {
      const nxJson = readJsonInTree<NxJson>(host, 'nx.json');
      return updateJsonInTree('tsconfig.base.json', (json) => {
        const c = json.compilerOptions;
        c.paths = c.paths || {};
        delete c.paths[options.name];
        c.paths[`@${nxJson.npmScope}/${options.projectDirectory}`] = [
          `${libsDir(host)}/${options.projectDirectory}/src/index.ts`,
        ];
        return json;
      })(host, context);
    },
  ]);
}
