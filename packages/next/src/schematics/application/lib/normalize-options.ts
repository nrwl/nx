import { normalize, Path } from '@angular-devkit/core';
import { Tree } from '@angular-devkit/schematics';
import { assertValidStyle } from '@nrwl/react';
import { toFileName } from '@nrwl/workspace';
import { Schema } from '../schema';
import { appsDir } from '@nrwl/workspace/src/utils/ast-utils';

export interface NormalizedSchema extends Schema {
  projectName: string;
  appProjectRoot: Path;
  e2eProjectName: string;
  e2eProjectRoot: Path;
  parsedTags: string[];
  fileName: string;
  styledModule: null | string;
}

export function normalizeOptions(
  host: Tree,
  options: Schema
): NormalizedSchema {
  const appDirectory = options.directory
    ? `${toFileName(options.directory)}/${toFileName(options.name)}`
    : toFileName(options.name);

  const appProjectName = appDirectory.replace(new RegExp('/', 'g'), '-');
  const e2eProjectName = `${appProjectName}-e2e`;

  const appProjectRoot = normalize(`${appsDir(host)}/${appDirectory}`);
  const e2eProjectRoot = normalize(`${appsDir(host)}/${appDirectory}-e2e`);

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const fileName = 'index';

  const styledModule = /^(css|scss|less|styl)$/.test(options.style)
    ? null
    : options.style;

  assertValidStyle(options.style);

  return {
    ...options,
    name: toFileName(options.name),
    projectName: appProjectName,
    appProjectRoot,
    e2eProjectRoot,
    e2eProjectName,
    parsedTags,
    fileName,
    styledModule,
  };
}
