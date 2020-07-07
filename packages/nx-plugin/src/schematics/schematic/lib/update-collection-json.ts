import { Rule } from '@angular-devkit/schematics';
import { updateJsonInTree } from '@nrwl/workspace';
import * as path from 'path';
import { NormalizedSchema } from '../schema';

export function updateCollectionJson(options: NormalizedSchema): Rule {
  return updateJsonInTree(
    path.join(options.projectRoot, 'collection.json'),
    (json) => {
      const schematics = json.schematics ? json.schematics : {};
      schematics[options.name] = {
        factory: `./src/schematics/${options.name}/schematic`,
        schema: `./src/schematics/${options.name}/schema.json`,
        description: options.description,
      };
      json.schematics = schematics;

      return json;
    }
  );
}
