import {
  Rule,
  chain,
  SchematicContext,
  Tree
} from '@angular-devkit/schematics';
import { updateJsonInTree } from '@nrwl/workspace';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import { addDepsToPackageJson } from '@nrwl/workspace/src/utils/ast-utils';

function displayInformation(host: Tree, context: SchematicContext) {
  context.logger.info(
    stripIndents`Prettier has been updated to 1.16.4 which has a lot of small improvements
      Formatting of your code might change as you are working on each file.
      Prettier will now format *.less files you can disable this by adding '*.less' to your .prettierignore

      Optional: You may want to run "npm run format" as part of this update to reformat all files in your workspace.

      You can also opt out of formatting in files by adding them to the .prettierignore file in the root of your workspace.`
  );
}

export default function(): Rule {
  return chain([
    addDepsToPackageJson(
      {},
      {
        prettier: '1.16.4'
      }
    ),
    displayInformation
  ]);
}
