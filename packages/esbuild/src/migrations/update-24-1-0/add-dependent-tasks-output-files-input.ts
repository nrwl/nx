import {
  formatFiles,
  getProjects,
  readNxJson,
  updateNxJson,
  updateProjectConfiguration,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import { updateTargetDefault } from '@nx/devkit/internal';

const ESBUILD_EXECUTOR = '@nx/esbuild:esbuild';

export default async function update(tree: Tree): Promise<void> {
  const nxJson = readNxJson(tree);
  if (nxJson?.targetDefaults) {
    let changed = false;
    updateTargetDefault(nxJson, { executor: ESBUILD_EXECUTOR }, (config) => {
      changed = addDependentTasksOutputFilesInput(config) || changed;
    });
    if (changed) {
      updateNxJson(tree, nxJson);
    }
  }

  for (const [name, project] of getProjects(tree)) {
    let changed = false;
    for (const target of Object.values(project.targets ?? {})) {
      if (target.executor === ESBUILD_EXECUTOR) {
        changed = addDependentTasksOutputFilesInput(target) || changed;
      }
    }
    if (changed) {
      updateProjectConfiguration(tree, name, project);
    }
  }

  await formatFiles(tree);
}

// Without `inputs` the target takes them from elsewhere, so there is no list
// to extend.
function addDependentTasksOutputFilesInput(
  config: Partial<TargetConfiguration>
): boolean {
  if (
    !Array.isArray(config.inputs) ||
    config.inputs.some(
      (input) =>
        typeof input === 'object' && 'dependentTasksOutputFiles' in input
    )
  ) {
    return false;
  }
  config.inputs.push({ dependentTasksOutputFiles: '**/*', transitive: true });
  return true;
}
