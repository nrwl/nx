import {
  chain,
  Rule,
  SchematicContext,
  Tree,
} from '@angular-devkit/schematics';
import {
  formatFiles,
  getWorkspace,
  getWorkspacePath,
  updateJsonInTree,
} from '@nrwl/workspace';

function removeRootDirInTsConfig() {
  return async (host: Tree, _: SchematicContext) => {
    const workspace = await getWorkspace(host, getWorkspacePath(host));

    const rules = [];

    for (const [, projectDefinition] of workspace.projects) {
      for (const [, testTarget] of projectDefinition.targets) {
        if (testTarget.builder !== '@nrwl/node:package') {
          continue;
        }
        const tsConfigPath = testTarget.options.tsConfig as string;
        if (!host.exists(tsConfigPath)) {
          continue;
        }

        rules.push(
          updateJsonInTree(tsConfigPath, (json) => {
            delete json.compilerOptions.rootDir;
            return json;
          })
        );
      }
    }

    return chain(rules);
  };
}

export default function update(): Rule {
  return chain([removeRootDirInTsConfig(), formatFiles()]);
}
