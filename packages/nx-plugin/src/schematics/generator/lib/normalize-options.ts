import { Tree } from '@angular-devkit/schematics';
import { getProjectConfig, readNxJsonInTree } from '@nrwl/workspace';
import { getFileTemplate } from '../../../utils/get-file-template';
import { NormalizedSchema, Schema } from '../schema';
import { names } from '@nrwl/devkit';

export function normalizeOptions(
  host: Tree,
  options: Schema
): NormalizedSchema {
  const nxJson = readNxJsonInTree(host);
  const npmScope = nxJson.npmScope;
  const fileName = names(options.name).fileName;

  const { root: projectRoot, sourceRoot: projectSourceRoot } = getProjectConfig(
    host,
    options.project
  );

  const npmPackageName = `@${npmScope}/${fileName}`;

  const fileTemplate = getFileTemplate();

  let description: string;
  if (options.description) {
    description = options.description;
  } else {
    description = `${options.name} generator`;
  }

  return {
    ...options,
    fileName,
    description,
    projectRoot,
    projectSourceRoot,
    npmScope,
    npmPackageName,
    fileTemplate,
  };
}
