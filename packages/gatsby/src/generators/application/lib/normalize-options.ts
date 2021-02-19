import { Schema } from '../schema';
import { projectRootDir, ProjectType, toFileName } from '@nrwl/workspace';
import { assertValidStyle } from '@nrwl/react';

export interface NormalizedSchema extends Schema {
  projectName: string;
  projectRoot: string;
  projectDirectory: string;
  parsedTags: string[];
  styledModule: null | string;
}

export function normalizeOptions(options: Schema): NormalizedSchema {
  const name = toFileName(options.name);
  const projectDirectory = options.directory
    ? `${toFileName(options.directory)}/${name}`
    : name;
  const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');
  const projectRoot = `${projectRootDir(
    ProjectType.Application
  )}/${projectDirectory}`;
  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const styledModule = /^(css|scss|less|styl)$/.test(options.style)
    ? null
    : options.style;

  assertValidStyle(options.style);

  return {
    ...options,
    name,
    unitTestRunner: options.unitTestRunner || 'jest',
    e2eTestRunner: options.e2eTestRunner || 'cypress',
    styledModule,
    projectName,
    projectRoot,
    projectDirectory,
    parsedTags,
  };
}
