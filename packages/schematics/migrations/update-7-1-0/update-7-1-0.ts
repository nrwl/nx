import {
  Rule,
  chain,
  SchematicContext,
  Tree
} from '@angular-devkit/schematics';
import { updateJsonInTree } from '@nrwl/workspace';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';

function displayInformation(host: Tree, context: SchematicContext) {
  context.logger.info(
    stripIndents`Prettier has been updated to 1.15.1 which has support for formatting html!
      Formatting of your code might change as you are working on each file.

      Optional: You may want to run "npm run format" as part of this update to reformat all files in your workspace.

      You can also opt out of formatting in files by adding them to the .prettierignore file in the root of your workspace.`
  );
}

function createPrettierIgnore(host: Tree, context: SchematicContext) {
  if (!host.exists('.prettierignore')) {
    host.create(
      '.prettierignore',
      '# Add files here to ignore them from prettier formatting\n'
    );
  }
}

export default function(): Rule {
  return chain([
    updateJsonInTree('package.json', json => {
      json.scripts = json.scripts || {};
      json.devDependencies = json.devDependencies || {};

      json.scripts = {
        ...json.scripts,
        affected: './node_modules/.bin/nx affected'
      };
      json.devDependencies = {
        ...json.devDependencies,
        prettier: '1.15.2'
      };

      return json;
    }),
    createPrettierIgnore,
    displayInformation
  ]);
}
