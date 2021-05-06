import { JsonArray, JsonObject } from '@angular-devkit/core';
import { Rule } from '@angular-devkit/schematics';
import { updateWorkspace } from '@nrwl/workspace';
import { NormalizedSchema } from '../schema';

export function updateWorkspaceJson(options: NormalizedSchema): Rule {
  return updateWorkspace((workspace) => {
    const targets = workspace.projects.get(options.project).targets;
    const build = targets.get('build');
    if (
      build &&
      (build.options.assets as JsonArray).filter(
        (asset) => (asset as JsonObject).glob === 'migrations.json'
      ).length === 0
    ) {
      (build.options.assets as JsonArray).push(
        ...[
          {
            input: `./${options.projectRoot}`,
            glob: 'migrations.json',
            output: '.',
          },
        ]
      );
    }
  });
}
