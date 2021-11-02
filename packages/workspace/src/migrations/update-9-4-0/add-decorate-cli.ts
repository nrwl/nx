import { chain, SchematicContext, Tree } from '@angular-devkit/schematics';
import { formatFiles } from '../../utils/rules/format-files';
import { readFileSync } from 'fs';
import { updateJsonInTree } from '@nrwl/workspace';
import { join as pathJoin } from 'path';

const decorateAngularClI = (host: Tree, context: SchematicContext) => {
  if (host.exists('angular.json')) {
    const decorateCli = readFileSync(
      pathJoin(
        __dirname as any,
        '..',
        '..',
        'generators',
        'utils',
        'decorate-angular-cli.js__tmpl__'
      )
    ).toString();
    host.create('decorate-angular-cli.js', decorateCli);
    updateJsonInTree('package.json', (json) => {
      if (
        json.scripts &&
        json.scripts.postinstall &&
        !json.scripts.postinstall.includes('decorate-angular-cli.js')
      ) {
        // if exists, add execution of this script
        json.scripts.postinstall += ' && node ./decorate-angular-cli.js';
      } else {
        if (!json.scripts) json.scripts = {};
        // if doesn't exist, set to execute this script
        json.scripts.postinstall = 'node ./decorate-angular-cli.js';
      }
      if (json.scripts.ng) {
        json.scripts.ng = 'nx';
      }
      return json;
    })(host, context);
  }
};

export default function () {
  return chain([decorateAngularClI, formatFiles()]);
}
