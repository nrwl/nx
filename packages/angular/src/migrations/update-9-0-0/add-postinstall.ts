import { formatFiles, updateJsonInTree } from '@nrwl/workspace';
import { chain } from '@angular-devkit/schematics';

export default function () {
  return chain([
    updateJsonInTree('package.json', (json, context) => {
      json.scripts = json.scripts || {};
      const command =
        'ngcc --properties es2015 browser module main --first-only --create-ivy-entry-points';
      if (!json.scripts.postinstall) {
        json.scripts.postinstall = command;
      } else if (!json.scripts.postinstall.includes('ngcc')) {
        json.scripts.postinstall = `${json.scripts.postinstall} && ${command}`;
      }
      return json;
    }),
    formatFiles(),
  ]);
}
