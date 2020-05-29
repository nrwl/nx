import { updateJsonInTree } from '../../utils/ast-utils';
import { formatFiles } from '@nrwl/workspace';
import { chain } from '@angular-devkit/schematics';

const updateLint = updateJsonInTree('package.json', (json) => {
  if (
    json.scripts &&
    json.scripts.lint &&
    json.scripts.lint.indexOf('nx lint') > -1
  ) {
    json.scripts.lint = json.scripts.lint.replace(
      'nx lint',
      'nx workspace-lint'
    );
  }
  return json;
});

export default function () {
  return chain([updateLint, formatFiles()]);
}
