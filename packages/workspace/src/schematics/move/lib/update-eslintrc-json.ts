import { join } from 'path';
import {
  offsetFromRoot,
  ProjectConfiguration,
  readJson,
  Tree,
  updateJson,
} from '@nrwl/devkit';

import { Schema } from '../schema';
import { getDestination } from './utils';

interface PartialEsLintRcJson {
  extends: string;
}

/**
 * Update the .eslintrc file of the project if it exists.
 *
 * @param schema The options provided to the schematic
 */
export function updateEslintrcJson(
  tree: Tree,
  schema: Schema,
  project: ProjectConfiguration
) {
  const destination = getDestination(tree, schema, project);
  const eslintRcPath = join(destination, '.eslintrc.json');

  if (!tree.exists(eslintRcPath)) {
    // no .eslintrc found. nothing to do
    return;
  }

  const offset = offsetFromRoot(destination);

  updateJson<PartialEsLintRcJson>(tree, eslintRcPath, (eslintRcJson) => {
    eslintRcJson.extends = offset + '.eslintrc.json';

    return eslintRcJson;
  });
}
