import { Tree } from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { Schema } from '../schema';

export interface NormalizedSchema extends Schema {
  name: string;
  fileName: string;
  projectRoot: string;
  routePath: string;
  parsedTags: string[];
  appMain?: string;
  appSourceRoot?: string;
}

export async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  const {
    projectName,
    names: projectNames,
    projectRoot,
    importPath,
  } = await determineProjectNameAndRootOptions(host, {
    name: options.name,
    projectType: 'library',
    directory: options.directory,
    importPath: options.importPath,
    projectNameAndRootFormat: options.projectNameAndRootFormat,
    callingGenerator: '@nx/react-native:library',
  });

  options.addPlugin ??= process.env.NX_ADD_PLUGINS !== 'false';

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const normalized: NormalizedSchema = {
    ...options,
    fileName: projectName,
    routePath: `/${projectNames.projectSimpleName}`,
    name: projectName,
    projectRoot,
    parsedTags,
    importPath,
  };

  return normalized;
}
