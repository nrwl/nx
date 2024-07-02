/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { ProjectConfiguration } from '@nx/devkit';

type ProjectJsonConfiguration = Pick<
  ProjectConfiguration,
  | 'name'
  | 'root'
  | 'tags'
  | 'targets'
  | 'sourceRoot'
  | 'implicitDependencies'
  | 'release'
  | 'projectType'
>;

export function getProjectJsonDataFromProjectNodeData(
  projectData: ProjectConfiguration
): ProjectJsonConfiguration {
  const projectDataToCopy: ProjectJsonConfiguration = pick(
    [
      'name',
      'root',
      'tags',
      'targets',
      'sourceRoot',
      'implicitDependencies',
      'release',
      'projectType',
    ],
    projectData
  );
  projectDataToCopy.tags = projectDataToCopy?.tags?.filter(
    (tag) => !tag.startsWith('npm:')
  );
  return projectDataToCopy;
}

// https://github.com/pnpm/ramda/blob/50c6b57110b2f3631ed8633141f12012b7768d85/source/pick.js#L22
function pick<T extends Record<string, any>, N extends keyof T>(
  names: Array<N>,
  obj: T
): Pick<T, N> {
  var result: Partial<T> = {};
  var idx = 0;
  while (idx < names.length) {
    if (names[idx] in obj) {
      result[names[idx]] = obj[names[idx]];
    }
    idx += 1;
  }
  return result as Pick<T, N>;
}
