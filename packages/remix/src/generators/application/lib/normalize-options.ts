import { readNxJson, type Tree } from '@nx/devkit';
import {
  determineProjectNameAndRootOptions,
  ensureProjectName,
} from '@nx/devkit/src/generators/project-name-and-root-utils';
import { type NxRemixGeneratorSchema } from '../schema';
import { Linter } from '@nx/eslint';

export interface NormalizedSchema extends NxRemixGeneratorSchema {
  projectName: string;
  projectRoot: string;
  e2eProjectName: string;
  e2eProjectRoot: string;
  parsedTags: string[];
}

export async function normalizeOptions(
  tree: Tree,
  options: NxRemixGeneratorSchema
): Promise<NormalizedSchema> {
  await ensureProjectName(tree, options, 'application');
  const { projectName, projectRoot } = await determineProjectNameAndRootOptions(
    tree,
    {
      name: options.name,
      projectType: 'application',
      directory: options.directory,
      rootProject: options.rootProject,
    }
  );
  options.rootProject = projectRoot === '.';
  const nxJson = readNxJson(tree);
  const addPluginDefault =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;
  options.addPlugin ??= addPluginDefault;

  const e2eProjectName = options.rootProject ? 'e2e' : `${projectName}-e2e`;
  const e2eProjectRoot = options.rootProject ? 'e2e' : `${projectRoot}-e2e`;

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  return {
    ...options,
    linter: options.linter ?? Linter.EsLint,
    projectName,
    projectRoot,
    e2eProjectName,
    e2eProjectRoot,
    parsedTags,
  };
}
