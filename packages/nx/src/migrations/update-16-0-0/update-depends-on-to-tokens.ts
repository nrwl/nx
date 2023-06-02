import {
  getProjects,
  readNxJson,
  updateNxJson,
  updateProjectConfiguration,
} from '../../generators/utils/project-configuration';
import { Tree } from '../../generators/tree';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';

export default async function (tree: Tree) {
  updateDependsOnAndInputsInsideNxJson(tree);

  const projectsConfigurations = getProjects(tree);
  for (const [projectName, projectConfiguration] of projectsConfigurations) {
    let projectChanged = false;
    for (const [targetName, targetConfiguration] of Object.entries(
      projectConfiguration.targets ?? {}
    )) {
      for (const dependency of targetConfiguration.dependsOn ?? []) {
        if (typeof dependency !== 'string') {
          if (
            dependency.projects === 'self' ||
            dependency.projects === '{self}'
          ) {
            delete dependency.projects;
            projectChanged = true;
          } else if (
            dependency.projects === 'dependencies' ||
            dependency.projects === '{dependencies}'
          ) {
            delete dependency.projects;
            dependency.dependencies = true;
            projectChanged = true;
          }
        }
      }
      for (let i = 0; i < targetConfiguration.inputs?.length ?? 0; i++) {
        const input = targetConfiguration.inputs[i];
        if (typeof input !== 'string') {
          if (
            'projects' in input &&
            (input.projects === 'self' || input.projects === '{self}')
          ) {
            delete input.projects;
            projectChanged = true;
          } else if (
            'projects' in input &&
            (input.projects === 'dependencies' ||
              input.projects === '{dependencies}')
          ) {
            delete input.projects;
            targetConfiguration.inputs[i] = {
              ...input,
              dependencies: true,
            };
            projectChanged = true;
          }
        }
      }
    }
    if (projectChanged) {
      updateProjectConfiguration(tree, projectName, projectConfiguration);
    }
  }

  await formatChangedFilesWithPrettierIfAvailable(tree);
}
function updateDependsOnAndInputsInsideNxJson(tree: Tree) {
  const nxJson = readNxJson(tree);
  let nxJsonChanged = false;
  for (const [target, defaults] of Object.entries(
    nxJson?.targetDefaults ?? {}
  )) {
    for (const dependency of defaults.dependsOn ?? []) {
      if (typeof dependency !== 'string') {
        if (
          dependency.projects === 'self' ||
          dependency.projects === '{self}'
        ) {
          delete dependency.projects;
          nxJsonChanged = true;
        } else if (
          dependency.projects === 'dependencies' ||
          dependency.projects === '{dependencies}'
        ) {
          delete dependency.projects;
          dependency.dependencies = true;
          nxJsonChanged = true;
        }
      }
    }
    for (let i = 0; i < defaults.inputs?.length ?? 0; i++) {
      const input = defaults.inputs[i];
      if (typeof input !== 'string') {
        if (
          'projects' in input &&
          (input.projects === 'self' || input.projects === '{self}')
        ) {
          delete input.projects;
          nxJsonChanged = true;
        } else if (
          'projects' in input &&
          (input.projects === 'dependencies' ||
            input.projects === '{dependencies}')
        ) {
          delete input.projects;
          defaults.inputs[i] = {
            ...input,
            dependencies: true,
          };
          nxJsonChanged = true;
        }
      }
    }
  }
  if (nxJsonChanged) {
    updateNxJson(tree, nxJson);
  }
}
