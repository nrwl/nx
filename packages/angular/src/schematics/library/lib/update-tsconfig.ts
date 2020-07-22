import {
  chain,
  Rule,
  SchematicContext,
  SchematicsException,
  Tree,
} from '@angular-devkit/schematics';
import { updateJsonInTree } from '@nrwl/workspace';
import { NormalizedSchema } from './normalized-schema';

export function updateTsConfig(options: NormalizedSchema): Rule {
  return chain([
    (host: Tree, context: SchematicContext) => {
      return updateJsonInTree('tsconfig.base.json', (json) => {
        const c = json.compilerOptions;
        c.paths = c.paths || {};
        delete c.paths[options.name];

        if (c.paths[options.importPath]) {
          throw new SchematicsException(
            `You already have a library using the import path "${options.importPath}". Make sure to specify a unique one.`
          );
        }

        c.paths[options.importPath] = [
          `libs/${options.projectDirectory}/src/index.ts`,
        ];

        return json;
      })(host, context);
    },
  ]);
}
