import { chain, Rule, Tree } from '@angular-devkit/schematics';
import { offsetFromRoot } from '@nrwl/workspace';
import {
  getWorkspace,
  getWorkspacePath,
  updateJsonInTree,
} from '@nrwl/workspace';

function checkTsConfigPath(configPath: unknown): configPath is string {
  return typeof configPath === 'string';
}

async function updateTsConfigDists(host: Tree) {
  const updates: Rule[] = [];

  const workspace = await getWorkspace(host, getWorkspacePath(host));
  for (const [, projectDefinition] of workspace.projects) {
    for (const [, testTarget] of projectDefinition.targets) {
      if (testTarget.builder !== '@nrwl/node:package') {
        continue;
      }

      if (checkTsConfigPath(testTarget.options.tsConfig)) {
        updates.push(
          updateJsonInTree(testTarget.options.tsConfig, (json) => {
            delete json.compilerOptions?.rootDir;
            json.compilerOptions.outDir = `${offsetFromRoot(
              projectDefinition.root
            )}dist`;

            return json;
          })
        );
      }
    }
  }
  return chain(updates);
}

export default function update(): Rule {
  return chain([updateTsConfigDists]);
}
