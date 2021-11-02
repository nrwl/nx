import { updateWorkspace } from '../../utils/workspace';
import { join, JsonArray, normalize } from '@angular-devkit/core';
import { formatFiles } from '@nrwl/workspace';
import { chain } from '@angular-devkit/schematics';

const addExcludes = updateWorkspace((workspace) => {
  workspace.projects.forEach((project) => {
    project.targets.forEach((target) => {
      if (target.builder !== '@angular-devkit/build-angular:tslint') {
        return;
      }
      const exceptRootGlob = `!${join(normalize(project.root), '**/*')}`;

      if (!target.options.exclude) {
        target.options.exclude = [];
      }

      if (!(target.options.exclude as JsonArray).includes(exceptRootGlob)) {
        (target.options.exclude as JsonArray).push(exceptRootGlob);
      }
    });
  });
});

export default function () {
  return chain([addExcludes, formatFiles()]);
}
