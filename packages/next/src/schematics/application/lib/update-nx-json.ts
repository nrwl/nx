import { Rule } from '@angular-devkit/schematics';
import { NxJson, updateJsonInTree } from '@nrwl/workspace';
import { NormalizedSchema } from './normalize-options';

export function updateNxJson(options: NormalizedSchema): Rule {
  return updateJsonInTree<NxJson>('nx.json', (json) => {
    json.projects[options.projectName] = { tags: options.parsedTags };
    return json;
  });
}
