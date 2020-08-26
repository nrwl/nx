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
  readJsonInTree,
  updateJsonInTree,
  updateWorkspace,
} from '@nrwl/workspace';
import { join } from 'path';

function removeRootDirInTsConfig() {
  return async (host: Tree, _: SchematicContext) => {
    const workspace = await getWorkspace(host, getWorkspacePath(host));

    const rules = [];

    for (const [, projectDefinition] of workspace.projects) {
      for (const [, buildTarget] of projectDefinition.targets) {
        if (buildTarget.builder !== '@nrwl/node:package') {
          continue;
        }
        const tsConfigPath = buildTarget.options.tsConfig as string;
        if (!host.exists(tsConfigPath)) {
          continue;
        }

        const tsConfig = readJsonInTree(host, tsConfigPath);
        if (
          tsConfig.compilerOptions.rootDir !== './' ||
          tsConfig.compilerOptions.rootDir !== '.'
        ) {
          buildTarget.options.srcRootForCompilationRoot = join(
            projectDefinition.root,
            tsConfig.compilerOptions.rootDir
          );
        }

        rules.push(
          updateJsonInTree(tsConfigPath, (json) => {
            delete json.compilerOptions.rootDir;
            return json;
          })
        );
      }
    }

    return chain([updateWorkspace(workspace), ...rules]);
  };
}

export default function update(): Rule {
  return chain([removeRootDirInTsConfig(), formatFiles()]);
}
