import { normalize } from '@angular-devkit/core';
import { Tree } from '@angular-devkit/schematics';
import { readNxJsonInTree } from '@nrwl/workspace';
import { libsDir } from '@nrwl/workspace/src/utils/ast-utils';
import { getFileTemplate } from '../../../utils/get-file-template';
import { NormalizedSchema, Schema } from '../schema';
import { names } from '@nrwl/devkit';

export function normalizeOptions(
  host: Tree,
  options: Schema
): NormalizedSchema {
  const nxJson = readNxJsonInTree(host);
  const npmScope = nxJson.npmScope;
  const name = names(options.name).fileName;
  const projectDirectory = options.directory
    ? `${names(options.directory).fileName}/${name}`
    : name;

  const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');
  const fileName = projectName;
  const projectRoot = normalize(`${libsDir(host)}/${projectDirectory}`);

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];
  const npmPackageName = `@${npmScope}/${name}`;

  const fileTemplate = getFileTemplate();

  const normalized: NormalizedSchema = {
    ...options,
    fileName,
    npmScope,
    name: projectName,
    projectRoot,
    projectDirectory,
    parsedTags,
    npmPackageName,
    fileTemplate,
  };

  return normalized;
}
