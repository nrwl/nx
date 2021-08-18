import { ProjectConfiguration, Tree, updateJson } from '@nrwl/devkit';
import { join } from 'path';
import { NormalizedSchema } from '../schema';

interface PartialEsLintrcOverride {
  parserOptions?: {
    project?: [string];
  };
}

interface PartialEsLintRcJson {
  extends: string | string[];
  overrides?: PartialEsLintrcOverride[];
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
  tree['recordedChanges'];
  const eslintRcPath = join(schema.relativeToRootDestination, '.eslintrc.json');
  if (!tree.exists(eslintRcPath)) {
    // no .eslintrc found. nothing to do
    return;
  }

  updateJson<PartialEsLintRcJson>(tree, eslintRcPath, (eslintRcJson) => {
    eslintRcJson.overrides?.forEach((o) => {
      if (o.parserOptions?.project) {
        o.parserOptions.project = [
          `${schema.relativeToRootDestination}/tsconfig.*?.json`,
        ];
      }
    });

    return eslintRcJson;
  });
}
