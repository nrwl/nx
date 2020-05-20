import { chain, Rule } from '@angular-devkit/schematics';
import { formatFiles } from '@nrwl/workspace';
import { updateWorkspace } from '@nrwl/workspace/src/utils/workspace';

export default function update(): Rule {
  return chain([renameDevServerInWorkspace, formatFiles()]);
}

const renameDevServerInWorkspace = updateWorkspace((workspace) => {
  workspace.projects.forEach((project) => {
    project.targets.forEach((target) => {
      if (target.builder === '@nrwl/next:dev-server') {
        target.builder = '@nrwl/next:server';
      }
    });
  });
});
