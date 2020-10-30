import { Rule, Tree } from '@angular-devkit/schematics';
import { updateJsonInTree } from '@nrwl/workspace';

export default function (): Rule {
  return (host: Tree) => {
    if (!host.exists('.vscode/extensions.json')) {
      return;
    }

    return updateJsonInTree('.vscode/extensions.json', (json) => {
      json.recommendations = json.recommendations || [];
      const extension = 'firsttris.vscode-jest-runner';
      if (!json.recommendations.includes(extension)) {
        json.recommendations.push(extension);
      }
      return json;
    });
  };
}
