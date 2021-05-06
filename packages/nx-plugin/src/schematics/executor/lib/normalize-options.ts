import { Tree } from '@angular-devkit/schematics';
import { getProjectConfig, readNxJsonInTree } from '@nrwl/workspace';
import { NormalizedSchema, Schema } from '../schema';
import { names } from '@nrwl/devkit';

export function normalizeOptions(
  host: Tree,
  options: Schema
): NormalizedSchema {
  const nxJson = readNxJsonInTree(host);
  const { npmScope } = nxJson;
  const { fileName } = names(options.name);

  const { root: projectRoot, sourceRoot: projectSourceRoot } = getProjectConfig(
    host,
    options.project
  );

  let description: string;
  if (options.description) {
    description = options.description;
  } else {
    description = `${options.name} executor`;
  }

  return {
    ...options,
    fileName,
    description,
    projectRoot,
    projectSourceRoot,
    npmScope,
  };
}
