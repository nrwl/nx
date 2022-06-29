import {
  joinPathFragments,
  offsetFromRoot,
  ProjectConfiguration,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import { join } from 'path';
import { NormalizedSchema } from '../schema';

interface PartialEsLintrcOverride {
  parserOptions?: {
    project?: string[];
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
  return joinPathFragments(offset, pathFromRoot);
}

/**
 * Update the .eslintrc file of the project if it exists.
 *
 * @param schema The options provided to the schematic
 */
export function updateEslintrcJson(
  tree: Tree,
  schema: NormalizedSchema,
  project: ProjectConfiguration
) {
  const eslintRcPath = join(schema.relativeToRootDestination, '.eslintrc.json');

  if (!tree.exists(eslintRcPath)) {
    // no .eslintrc found. nothing to do
    return;
  }

  const offset = offsetFromRoot(schema.relativeToRootDestination);

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
        o.parserOptions.project = o.parserOptions.project.map((p) =>
          p.replace(project.root, schema.relativeToRootDestination)
        );
      }
    });

    return eslintRcJson;
  });
}
