import { NxJson } from '@nrwl/workspace';
import { NormalizedSchema } from './normalize-options';
import { Tree, updateJson } from '@nrwl/devkit';

export function updateNxJson(host: Tree, options: NormalizedSchema) {
  updateJson<NxJson>(host, 'nx.json', (json) => {
    json.projects[options.projectName] = { tags: options.parsedTags };
    return json;
  });
}
