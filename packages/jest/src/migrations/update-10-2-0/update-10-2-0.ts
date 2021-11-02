import { chain, Rule, Tree } from '@angular-devkit/schematics';
import {
  formatFiles,
  getWorkspace,
  getWorkspacePath,
  updateWorkspace,
} from '@nrwl/workspace';

function removeDeprecatedJestBuilderOptions() {
  return async (host: Tree) => {
    const workspace = await getWorkspace(host, getWorkspacePath(host));

    for (const [, projectDefinition] of workspace.projects) {
      for (const [, testTarget] of projectDefinition.targets) {
        if (testTarget.builder !== '@nrwl/jest:jest') {
          continue;
        }

        const updatedOptions = { ...testTarget.options };
        delete updatedOptions.setupFile;
        delete updatedOptions.tsConfig;

        testTarget.options = updatedOptions;
      }
    }

    return updateWorkspace(workspace);
  };
}

export default function update(): Rule {
  return chain([removeDeprecatedJestBuilderOptions(), formatFiles()]);
}
