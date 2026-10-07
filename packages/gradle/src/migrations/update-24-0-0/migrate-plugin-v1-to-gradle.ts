import { formatFiles, readNxJson, type Tree, updateNxJson } from '@nx/devkit';
import { addNxProjectGraphPlugin } from '../../generators/init/gradle-project-graph-plugin-utils';

// `@nx/gradle` reads the project graph from this Gradle plugin, which v1 never applied.
const GRADLE_PROJECT_GRAPH_VERSION = '0.1.25';

export default async function update(tree: Tree) {
  const nxJson = readNxJson(tree);
  if (!nxJson?.plugins) {
    return { skipAgentic: true };
  }

  let changed = false;
  nxJson.plugins = nxJson.plugins.map((p) => {
    if (p === '@nx/gradle/plugin-v1') {
      changed = true;
      return '@nx/gradle';
    }
    if (typeof p === 'string' || p.plugin !== '@nx/gradle/plugin-v1') {
      return p;
    }
    changed = true;
    p.plugin = '@nx/gradle';
    const options = p.options as Record<string, unknown> | undefined;
    if (options?.ciTargetName !== undefined) {
      options.ciTestTargetName ??= options.ciTargetName;
      delete options.ciTargetName;
    }
    delete options?.includeSubprojectsTasks;
    return p;
  });

  if (!changed) {
    return { skipAgentic: true };
  }

  updateNxJson(tree, nxJson);
  await addNxProjectGraphPlugin(tree, GRADLE_PROJECT_GRAPH_VERSION);
  await formatFiles(tree);
}
