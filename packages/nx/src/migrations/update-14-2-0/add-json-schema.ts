import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import { ProjectConfiguration } from '../../config/workspace-json-project-json';
import type { Tree } from '../../generators/tree';
import { updateJson } from '../../generators/utils/json';
import {
  getProjects,
  getRelativeProjectJsonSchemaPath,
  updateProjectConfiguration,
} from '../../generators/utils/project-configuration';
import { logger } from '../../utils/logger';
import { join } from 'path';

export default async function (tree: Tree) {
  // update nx.json $schema
  const isNxJsonExist = tree.exists('nx.json');
  if (isNxJsonExist) {
    updateJson(tree, 'nx.json', (json) => {
      if (!json['$schema']) {
        json['$schema'] = './node_modules/nx/schemas/nx-schema.json';
      }
      return json;
    });
  }

  // update workspace.json $schema
  const isWorkspaceJsonExist = tree.exists('workspace.json');
  if (isWorkspaceJsonExist) {
    updateJson(tree, 'workspace.json', (json) => {
      if (!json['$schema']) {
        json['$schema'] = './node_modules/nx/schemas/workspace-schema.json';
      }
      return json;
    });
  }

  // update projects $schema
  for (const [projName, projConfig] of getProjects(tree)) {
    if (
      projConfig['$schema'] ||
      !tree.exists(join(projConfig.root, 'project.json'))
    )
      continue;

    try {
      const relativeProjectJsonSchemaPath = getRelativeProjectJsonSchemaPath(
        tree,
        projConfig
      );
      updateProjectConfiguration(tree, projName, {
        $schema: relativeProjectJsonSchemaPath,
        ...projConfig,
      } as ProjectConfiguration);
    } catch (e) {
      logger.warn(`Could not add schema for "${projName}": ${e.message}`);
    }
  }

  await formatChangedFilesWithPrettierIfAvailable(tree);
}
