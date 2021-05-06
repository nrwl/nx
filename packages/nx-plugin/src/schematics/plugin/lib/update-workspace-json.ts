import { JsonArray } from '@angular-devkit/core';
import { Rule } from '@angular-devkit/schematics';
import { updateWorkspace } from '@nrwl/workspace';
import { NormalizedSchema } from '../schema';

export function updateWorkspaceJson(options: NormalizedSchema): Rule {
  return updateWorkspace((workspace) => {
    const targets = workspace.projects.get(options.name).targets;
    const build = targets.get('build');
    if (build) {
      (build.options.assets as JsonArray).push(
        ...[
          {
            input: `./${options.projectRoot}/src`,
            glob: '**/*.!(ts)',
            output: './src',
          },
          {
            input: `./${options.projectRoot}`,
            glob: 'generators.json',
            output: '.',
          },
          {
            input: `./${options.projectRoot}`,
            glob: 'executors.json',
            output: '.',
          },
        ]
      );
    }
  });
}
