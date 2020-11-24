import { Rule, Tree } from '@angular-devkit/schematics';
import { updateJsonInTree } from '@nrwl/workspace';
import * as path from 'path';
import { NormalizedSchema } from '../schema';

export function updateExecutorJson(
  host: Tree,
  options: NormalizedSchema
): Rule {
  let executorPath: string;
  if (host.exists(path.join(options.projectRoot, 'executors.json'))) {
    executorPath = path.join(options.projectRoot, 'executors.json');
  } else {
    executorPath = path.join(options.projectRoot, 'builders.json');
  }

  return updateJsonInTree(executorPath, (json) => {
    let executors = json.executors ? json.executors : json.builders;
    executors = executors || {};
    executors[options.name] = {
      implementation: `./src/executors/${options.name}/executor`,
      schema: `./src/executors/${options.name}/schema.json`,
      description: options.description,
    };
    json.executors = executors;

    return json;
  });
}
