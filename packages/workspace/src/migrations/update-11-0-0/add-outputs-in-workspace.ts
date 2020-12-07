import { chain, Rule } from '@angular-devkit/schematics';
import { updateWorkspaceInTree } from '@nrwl/workspace';

const addOutputs = () =>
  updateWorkspaceInTree((workspace) => {
    for (const [, project] of Object.entries<any>(workspace.projects)) {
      for (const [, target] of Object.entries<any>(project.architect || {})) {
        const builder = target?.builder;

        if (!builder || target.outputs) {
          continue; // Do not mess with already defined outputs from user
        }

        if (
          ['@nrwl/jest:jest', '@angular-devkit/build-angular:karma'].includes(
            builder
          )
        ) {
          target.outputs = [`coverage/${project.root}`];
        } else if (
          [
            '@angular-devkit/build-angular:browser',
            '@nrwl/next:build',
            '@nrwl/node:build',
            '@nrwl/node:package',
            '@nrwl/web:build',
            '@nrwl/web:package',
            '@nrwl/storybook:build',
          ].includes(builder)
        ) {
          target.outputs = ['{options.outputPath}'];
        }
      }
    }

    return workspace;
  });

export default function update(): Rule {
  return chain([addOutputs()]);
}
