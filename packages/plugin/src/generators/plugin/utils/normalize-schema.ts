import { Tree, extractLayoutDirectory, getWorkspaceLayout } from '@nx/devkit';
import {
  determineProjectNameAndRootOptions,
  ensureProjectName,
} from '@nx/devkit/src/generators/project-name-and-root-utils';
import { Schema } from '../schema';

export interface NormalizedSchema extends Schema {
  name: string;
  fileName: string;
  projectRoot: string;
  projectDirectory: string;
  parsedTags: string[];
  npmPackageName: string;
  bundler: 'swc' | 'tsc';
  publishable: boolean;
}

export async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  await ensureProjectName(host, options, 'application');
  const {
    projectName,
    projectRoot,
    importPath: npmPackageName,
  } = await determineProjectNameAndRootOptions(host, {
    name: options.name,
    projectType: 'library',
    directory: options.directory,
    importPath: options.importPath,
    rootProject: options.rootProject,
  });
  options.rootProject = projectRoot === '.';

  const projectDirectory = projectRoot;

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  return {
    ...options,
    bundler: options.compiler ?? 'tsc',
    fileName: projectName,
    name: projectName,
    projectRoot,
    projectDirectory,
    parsedTags,
    npmPackageName,
    publishable: options.publishable ?? false,
  };
}
