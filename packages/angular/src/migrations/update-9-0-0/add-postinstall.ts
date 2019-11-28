import { updateJsonInTree } from '@nrwl/workspace';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';

export default function() {
  return updateJsonInTree('package.json', (json, context) => {
    json.scripts = json.scripts || {};
    if (json.scripts.postinstall) {
      context.logger.warn(
        stripIndents`
            ---------------------------------------------------------------------------------------
            Angular Ivy requires you to run ngcc after every npm install.
            The easiest way to accomplish this is to update your postinstall script to invoke ngcc.
            ---------------------------------------------------------------------------------------
          `
      );
    } else {
      context.logger.info(
        stripIndents`A "postinstall" script has been added to package.json to run ngcc.`
      );
      json.scripts.postinstall =
        'ngcc --properties es2015 browser module main --first-only --create-ivy-entry-points';
    }
    return json;
  });
}
