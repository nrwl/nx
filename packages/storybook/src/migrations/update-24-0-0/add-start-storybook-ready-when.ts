import {
  formatFiles,
  getProjects,
  readNxJson,
  updateProjectConfiguration,
  type ProjectGraphProjectNode,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import {
  addReadyWhenSignalToTargets,
  mergeTargetConfigurations,
  readApplicableTargetDefaults,
} from '@nx/devkit/internal';
import { getStartStorybookReadyWhen } from '../../utils/dev-server-ready-check';

const startStorybookExecutor = '@storybook/angular:start-storybook';

export default async function update(tree: Tree) {
  const continuousSet = setContinuous(tree);
  const result = await addReadyWhenSignalToTargets(
    tree,
    [startStorybookExecutor],
    (target) => {
      // The builder reports no URL to signal, so a port check replaces it
      target.readyWhen = getStartStorybookReadyWhen();
    }
  );
  if (result && continuousSet) {
    await formatFiles(tree);
    return;
  }
  return result;
}

function setContinuous(tree: Tree): boolean {
  const targetDefaults = readNxJson(tree)?.targetDefaults;
  let changed = false;
  for (const [projectName, project] of getProjects(tree)) {
    const projectNode: ProjectGraphProjectNode = {
      name: projectName,
      type: 'lib',
      data: { root: project.root, tags: project.tags },
    };
    let projectChanged = false;
    for (const [targetName, target] of Object.entries(project.targets ?? {})) {
      if (
        target.executor !== startStorybookExecutor ||
        target.continuous !== undefined
      ) {
        continue;
      }
      const defaults = readApplicableTargetDefaults(
        targetName,
        target.executor,
        targetDefaults,
        projectName,
        projectNode
      );
      if (
        defaults?.continuous !== undefined ||
        isSmokeTest(mergeTargetConfigurations(target, defaults))
      ) {
        continue;
      }
      target.continuous = true;
      projectChanged = true;
    }
    if (projectChanged) {
      updateProjectConfiguration(tree, projectName, project);
      changed = true;
    }
  }
  return changed;
}

// `smokeTest` exits once Storybook starts, so the target is a check, not a server
function isSmokeTest(target: TargetConfiguration): boolean {
  return [target.options, ...Object.values(target.configurations ?? {})].some(
    (options) => options?.smokeTest === true
  );
}
