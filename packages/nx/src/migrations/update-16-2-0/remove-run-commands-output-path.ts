import { joinPathFragments } from '../../utils/path';
import { NxJsonConfiguration } from '../../config/nx-json';
import { TargetConfiguration } from '../../config/workspace-json-project-json';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import { Tree } from '../../generators/tree';
import { updateJson } from '../../generators/utils/json';
import {
  getProjects,
  updateProjectConfiguration,
} from '../../generators/utils/project-configuration';

export default async function removeRunCommandsOutputPath(tree: Tree) {
  for (const [project, configuration] of getProjects(tree).entries()) {
    const targets = configuration.targets ?? {};
    let changed = false;
    for (const [, target] of Object.entries(targets)) {
      changed ||= updateTargetBlock(target);
    }
    if (changed) {
      updateProjectConfiguration(tree, project, configuration);
    }
  }
  if (tree.exists('nx.json')) {
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      for (const [, target] of Object.entries(json.targetDefaults ?? {})) {
        updateTargetBlock(target);
      }
      return json;
    });
  }
  await formatChangedFilesWithPrettierIfAvailable(tree);
}

function updateTargetBlock(target: TargetConfiguration): boolean {
  let changed = false;
  if (target.executor === 'nx:run-commands' && target.options?.outputPath) {
    changed = true;
    const outputs = new Set(target.outputs ?? []);
    outputs.delete('{options.outputPath}');
    const newOutputs = Array.isArray(target.options.outputPath)
      ? target.options.outputPath.map((p) =>
          joinPathFragments('{workspaceRoot}', p)
        )
      : [joinPathFragments('{workspaceRoot}', target.options.outputPath)];
    for (const outputPath of newOutputs) {
      outputs.add(outputPath);
    }
    delete target.options.outputPath;
    target.outputs = Array.from(outputs);
  }
  return changed;
}
