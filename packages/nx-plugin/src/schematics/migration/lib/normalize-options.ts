import { Tree } from '@angular-devkit/schematics';
import { getProjectConfig } from '@nrwl/workspace';
import { NormalizedSchema, Schema } from '../schema';
import { names } from '@nrwl/devkit';

export function normalizeOptions(
  host: Tree,
  options: Schema
): NormalizedSchema {
  let name: string;
  if (options.name) {
    name = names(options.name).fileName;
  } else {
    name = names(`update-${options.version}`).fileName;
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
