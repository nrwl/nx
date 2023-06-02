import { assertValidStyle } from '@nx/react/src/utils/assertion';
import {
  extractLayoutDirectory,
  getWorkspaceLayout,
  joinPathFragments,
  names,
  Tree,
} from '@nx/devkit';
import { Linter } from '@nx/linter';

import { Schema } from '../schema';

export interface NormalizedSchema extends Schema {
  projectName: string;
  appProjectRoot: string;
  outputPath: string;
  e2eProjectName: string;
  e2eProjectRoot: string;
  parsedTags: string[];
  fileName: string;
  styledModule: null | string;
  js?: boolean;
}

export function normalizeOptions(
  host: Tree,
  options: Schema
): NormalizedSchema {
  const { layoutDirectory, projectDirectory } = extractLayoutDirectory(
    options.directory
  );
  const name = names(options.name).fileName;

  const appDirectory = projectDirectory
    ? `${names(projectDirectory).fileName}/${names(options.name).fileName}`
    : names(options.name).fileName;

  const appsDir = layoutDirectory ?? getWorkspaceLayout(host).appsDir;

  const appProjectName = appDirectory.replace(new RegExp('/', 'g'), '-');
  const e2eProjectName = options.rootProject ? 'e2e' : `${appProjectName}-e2e`;

  const appProjectRoot = options.rootProject
    ? '.'
    : joinPathFragments(appsDir, appDirectory);

  const e2eProjectRoot = options.rootProject
    ? '.'
    : joinPathFragments(appsDir, `${appDirectory}-e2e`);

  const outputPath = joinPathFragments(
    'dist',
    appProjectRoot,
    ...(options.rootProject ? [name] : [])
  );

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const fileName = 'index';

  const appDir = options.appDir ?? true;

  const styledModule = /^(css|scss|less|styl)$/.test(options.style)
    ? null
    : options.style;

  assertValidStyle(options.style);

  return {
    ...options,
    appDir,
    appProjectRoot,
    e2eProjectName,
    e2eProjectRoot,
    e2eTestRunner: options.e2eTestRunner || 'cypress',
    fileName,
    linter: options.linter || Linter.EsLint,
    name,
    outputPath,
    parsedTags,
    projectName: appProjectName,
    style: options.style || 'css',
    styledModule,
    unitTestRunner: options.unitTestRunner || 'jest',
  };
}
