import { Rule, chain, externalSchematic } from '@angular-devkit/schematics';

import { updateJsonInTree } from '../../src/utils/ast-utils';

const addExtensionRecommendations = updateJsonInTree(
  '.vscode/extensions.json',
  (json: { recommendations?: string[] }) => {
    json.recommendations = json.recommendations || [];
    [
      'nrwl.angular-console',
      'angular.ng-template',
      'esbenp.prettier-vscode'
    ].forEach(extension => {
      if (!json.recommendations.includes(extension)) {
        json.recommendations.push(extension);
      }
    });

    return json;
  }
);

export default function(): Rule {
  return chain([addExtensionRecommendations]);
}
