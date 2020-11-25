import { Rule, Tree } from '@angular-devkit/schematics';
import { updateJsonInTree } from '@nrwl/workspace';
import * as path from 'path';
import { NormalizedSchema } from '../schema';

export function updateGeneratorJson(
  host: Tree,
  options: NormalizedSchema
): Rule {
  let generatorPath: string;
  if (host.exists(path.join(options.projectRoot, 'generators.json'))) {
    generatorPath = path.join(options.projectRoot, 'generators.json');
  } else {
    generatorPath = path.join(options.projectRoot, 'collection.json');
  }

  return updateJsonInTree(generatorPath, (json) => {
    let generators = json.generators ? json.generators : json.schematics;
    generators = generators || {};
    generators[options.name] = {
      factory: `./src/generators/${options.name}/generator`,
      schema: `./src/generators/${options.name}/schema.json`,
      description: options.description,
    };
    json.generators = generators;

    return json;
  });
}
