import { join } from 'path';
import {
  offsetFromRoot,
  ProjectConfiguration,
  Tree,
  updateJson,
} from '@nrwl/devkit';

import { Schema } from '../schema';
import { getDestination } from './utils';

interface PartialEsLintrcOverride {
  parserOptions?: {
    project?: [string];
  };
}

interface PartialEsLintRcJson {
  extends: string;
  overrides?: PartialEsLintrcOverride[];
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
    eslintRcJson.extends = `${offset}.eslintrc.json`;

    eslintRcJson.overrides?.forEach((override) => {
      if (override.parserOptions?.project) {
        override.parserOptions.project = [`${destination}/tsconfig.*?.json`];
      }
    });

    return eslintRcJson;
  });
}
