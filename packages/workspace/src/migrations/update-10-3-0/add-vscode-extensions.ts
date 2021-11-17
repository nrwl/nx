import { Rule, Tree } from '@angular-devkit/schematics';
import { serializeJson } from '@nrwl/devkit';
import { getWorkspace } from '@nrwl/workspace';

export default function (): Rule {
  return async (host: Tree) => {
    if (host.exists('.vscode/extensions.json')) {
      return;
    }

    const workspace = await getWorkspace(host);

    let needsAngularExtension = false;

    for (let [, project] of workspace.projects) {
      needsAngularExtension = Array.from(project.targets).some(
        ([, targetDefinition]) =>
          targetDefinition.builder.startsWith('@angular-devkit')
      );

      if (needsAngularExtension) break;
    }

    const extensions = [
      'nrwl.angular-console',
      'ms-vscode.vscode-typescript-tslint-plugin',
      'esbenp.prettier-vscode',
    ];

    if (needsAngularExtension) {
      extensions.push('angular.ng-template');
    }

    host.create(
      '.vscode/extensions.json',
      serializeJson({
        recommendations: extensions,
      })
    );
  };
}
