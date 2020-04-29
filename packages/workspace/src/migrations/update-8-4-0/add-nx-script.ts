import { updateJsonInTree } from '../../utils/ast-utils';
import { chain } from '@angular-devkit/schematics';
import { formatFiles } from '@nrwl/workspace';

const addNxScript = updateJsonInTree('package.json', (json) => {
  if (json.scripts && !json.scripts.nx) {
    json.scripts.nx = 'nx';
  }
  return json;
});

export default function () {
  return chain([addNxScript, formatFiles()]);
}
