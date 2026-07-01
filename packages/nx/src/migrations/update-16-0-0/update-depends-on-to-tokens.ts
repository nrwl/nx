import {
  getProjects,
  readNxJson,
  updateNxJson,
  updateProjectConfiguration,
} from '../../generators/utils/project-configuration';
import type { TargetConfiguration } from '../../config/workspace-json-project-json';
import { Tree } from '../../generators/tree';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import { targetDefaultConfigs } from '../utils/target-defaults';

export default async function (tree: Tree) {
  updateDependsOnAndInputsInsideNxJson(tree);

  const projectsConfigurations = getProjects(tree);
  for (const [projectName, projectConfiguration] of projectsConfigurations) {
    let projectChanged = false;
    for (const targetConfiguration of Object.values(
      projectConfiguration.targets ?? {}
    )) {
      // Don't use `||=` — it would short-circuit the rewrite once one target
      // has already changed, leaving later targets untouched.
      if (rewriteTokensInBlock(targetConfiguration)) {
        projectChanged = true;
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
  for (const defaults of Object.values(nxJson?.targetDefaults ?? {})) {
    // `nx repair` can't assume migration order, so a default may already be in
    // the filtered array shape; rewrite every config block of either form.
    for (const block of targetDefaultConfigs(defaults)) {
      // Don't use `||=` — it would short-circuit the rewrite once one block
      // has already changed, leaving later blocks untouched.
      if (rewriteTokensInBlock(block)) {
        nxJsonChanged = true;
      }
    }
  }
  if (nxJsonChanged) {
    updateNxJson(tree, nxJson);
  }
}

// Rewrite the legacy `projects: 'self' | 'dependencies'` tokens on a single
// dependsOn/inputs-carrying config block. Returns whether anything changed.
function rewriteTokensInBlock(block: TargetConfiguration): boolean {
  let changed = false;
  for (const dependency of block.dependsOn ?? []) {
    if (typeof dependency !== 'string') {
      if (dependency.projects === 'self' || dependency.projects === '{self}') {
        delete dependency.projects;
        changed = true;
      } else if (
        dependency.projects === 'dependencies' ||
        dependency.projects === '{dependencies}'
      ) {
        delete dependency.projects;
        dependency.dependencies = true;
        changed = true;
      }
    }
  }
  for (let i = 0; i < (block.inputs?.length ?? 0); i++) {
    const input = block.inputs[i];
    if (typeof input !== 'string') {
      if (
        'projects' in input &&
        (input.projects === 'self' || input.projects === '{self}')
      ) {
        delete input.projects;
        changed = true;
      } else if (
        'projects' in input &&
        (input.projects === 'dependencies' ||
          input.projects === '{dependencies}')
      ) {
        delete input.projects;
        block.inputs[i] = {
          ...input,
          dependencies: true,
        };
        changed = true;
      }
    }
  }
  return changed;
}
