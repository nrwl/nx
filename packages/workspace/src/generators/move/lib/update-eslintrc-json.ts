import { join, relative } from 'path';
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
  extends: string | string[];
  overrides?: PartialEsLintrcOverride[];
}

function offsetFilePath(
  project: ProjectConfiguration,
  pathToFile: string,
  offset: string
): string {
  if (!pathToFile.startsWith('..')) {
    // not a relative path
    return pathToFile;
  }
  const pathFromRoot = join(project.root, pathToFile);
  return join(offset, pathFromRoot);
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
    if (typeof eslintRcJson.extends === 'string') {
      eslintRcJson.extends = offsetFilePath(
        project,
        eslintRcJson.extends,
        offset
      );
    } else {
      eslintRcJson.extends = eslintRcJson.extends.map((extend: string) =>
        offsetFilePath(project, extend, offset)
      );
    }

    eslintRcJson.overrides?.forEach((o) => {
      if (o.parserOptions?.project) {
        o.parserOptions.project = [`${destination}/tsconfig.*?.json`];
      }
    });

    return eslintRcJson;
  });
}
