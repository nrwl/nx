import { Tree } from '@angular-devkit/schematics';
import { getProjectConfig, toFileName } from '@nrwl/workspace';
import { NormalizedSchema, Schema } from '../schema';

export function normalizeOptions(
  host: Tree,
  options: Schema
): NormalizedSchema {
  let name: string;
  if (options.name) {
    name = toFileName(options.name);
  } else {
    name = toFileName(`update-${options.version}`);
  }

  let description: string;
  if (options.description) {
    description = options.description;
  } else {
    description = name;
  }

  const { root: projectRoot, sourceRoot: projectSourceRoot } = getProjectConfig(
    host,
    options.project
  );

  const normalized: NormalizedSchema = {
    ...options,
    name,
    description,
    projectRoot,
    projectSourceRoot,
  };

  return normalized;
}
