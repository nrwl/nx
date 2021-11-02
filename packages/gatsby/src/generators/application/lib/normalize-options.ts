import {
  getWorkspaceLayout,
  joinPathFragments,
  names,
  Tree,
} from '@nrwl/devkit';
import { Schema } from '../schema';
import { assertValidStyle } from '@nrwl/react';

export interface NormalizedSchema extends Schema {
  projectName: string;
  projectRoot: string;
  projectDirectory: string;
  parsedTags: string[];
  styledModule: null | string;
}

export function normalizeOptions(
  host: Tree,
  options: Schema
): NormalizedSchema {
  const name = names(options.name).fileName;
  const directoryName = options.directory
    ? names(options.directory).fileName
    : '';
  const projectDirectory = options.directory
    ? `${directoryName}/${name}`
    : name;
  const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');
  const { appsDir } = getWorkspaceLayout(host);
  const projectRoot = joinPathFragments(appsDir, projectDirectory);
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
