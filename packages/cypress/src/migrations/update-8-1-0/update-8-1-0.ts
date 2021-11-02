import {
  Rule,
  chain,
  SchematicContext,
  Tree,
} from '@angular-devkit/schematics';
import { formatFiles, updateJsonInTree } from '@nrwl/workspace';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';

function displayInformation(host: Tree, context: SchematicContext) {
  context.logger.info(
    stripIndents`Cypress has been updated to a version that improves network speed by 300%!

      Additionally, this resolves an issue where '@types/jquery' needed to be temporarily included in your 'package.json'.
      If you're not using '@types/jquery' in your project otherwise, you may now remove it from your 'devDependencies'.`
  );
}

export default function (): Rule {
  return chain([
    updateJsonInTree('package.json', (json) => {
      json.devDependencies = json.devDependencies || {};

      json.devDependencies = {
        ...json.devDependencies,
        cypress: '~3.3.1',
      };

      return json;
    }),
    displayInformation,
    formatFiles(),
  ]);
}
