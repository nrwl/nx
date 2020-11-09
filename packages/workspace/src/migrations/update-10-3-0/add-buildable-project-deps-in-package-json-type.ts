import { Rule, Tree } from '@angular-devkit/schematics';
import { getWorkspace, updateWorkspace } from '@nrwl/workspace';

export default function (): Rule {
  return async (host: Tree) => {
    const workspace = await getWorkspace(host);

    for (let [, projectTarget] of workspace.projects) {
      for (let [, buildTarget] of projectTarget.targets) {
        if (
          buildTarget.builder === '@nrwl/web:package' ||
          buildTarget.builder === '@nrwl/angular:package'
        ) {
          if (!buildTarget.options) {
            buildTarget.options = {};
          }

          buildTarget.options['buildableProjectDepsInPackageJsonType'] =
            'dependencies';
        }
      }
    }

    return updateWorkspace(workspace);
  };
}
