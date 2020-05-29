import { chain, Rule } from '@angular-devkit/schematics';
import { updateWorkspace } from '@nrwl/workspace/src/utils/workspace';
import { formatFiles } from '@nrwl/workspace';

const convertToArray = updateWorkspace((workspace) => {
  workspace.projects.forEach((project) => {
    project.targets.forEach((target) => {
      if (
        target.builder === '@nrwl/jest:jest' &&
        target.options &&
        target.options.testPathPattern
      ) {
        target.options.testPathPattern = [target.options.testPathPattern];
      }
    });
  });
});

export default function (): Rule {
  return chain([convertToArray, formatFiles()]);
}
