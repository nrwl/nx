import { chain, SchematicContext, Tree } from '@angular-devkit/schematics';
import { updateJsonInTree } from '@nrwl/workspace';
import { formatFiles } from '@nrwl/workspace';

const udpateNgccPostinstallScript = (host: Tree, context: SchematicContext) => {
  updateJsonInTree('package.json', (json) => {
    if (
      json.scripts &&
      json.scripts.postinstall &&
      json.scripts.postinstall.includes('ngcc')
    ) {
      // if exists, add execution of this script
      json.scripts.postinstall = json.scripts.postinstall.replace(
        /(.*)(ngcc --properties es2015 browser module main --first-only --create-ivy-entry-points)(.*)/,
        '$1ngcc --properties es2015 browser module main$3'
      );
    }
    return json;
  })(host, context);
};

export default function () {
  return chain([udpateNgccPostinstallScript, formatFiles()]);
}
