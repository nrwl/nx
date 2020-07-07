import { Rule } from '@angular-devkit/schematics';
import { updateJsonInTree } from '@nrwl/workspace';
import * as path from 'path';
import { NormalizedSchema } from '../schema';

export function updateBuildersJson(options: NormalizedSchema): Rule {
  return updateJsonInTree(
    path.join(options.projectRoot, 'builders.json'),
    (json) => {
      const builders = json.builders ? json.builders : {};
      builders[options.name] = {
        implementation: `./src/builders/${options.name}/builder`,
        schema: `./src/builders/${options.name}/schema.json`,
        description: options.description,
      };
      json.builders = builders;

      return json;
    }
  );
}
