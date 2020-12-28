import { Rule } from '@angular-devkit/schematics';
import { updateJsonInTree } from '@nrwl/workspace';

export default function update(): Rule {
  return updateJsonInTree('package.json', (json) => {
    if (json.scripts && json.scripts.update) {
      json.scripts.update = 'nx migrate latest';
    }
    return json;
  });
}
