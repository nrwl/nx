import { readNxJson, type Tree } from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { type NxRemixGeneratorSchema } from '../schema';
import { Linter } from '@nx/eslint';
import { RemixPluginOptions } from '../../../plugins/plugin';

export interface NormalizedSchema extends NxRemixGeneratorSchema {
  projectName: string;
  projectRoot: string;
  e2eProjectName: string;
  e2eProjectRoot: string;
  e2eWebServerAddress: string;
  e2eWebServerTarget: string;
  e2ePort: number;
  parsedTags: string[];
}

export async function normalizeOptions(
  tree: Tree,
  options: NxRemixGeneratorSchema
): Promise<NormalizedSchema> {
  const { projectName, projectRoot, projectNameAndRootFormat } =
    await determineProjectNameAndRootOptions(tree, {
      name: options.name,
      projectType: 'application',
      directory: options.directory,
      projectNameAndRootFormat: options.projectNameAndRootFormat,
      rootProject: options.rootProject,
      callingGenerator: '@nx/remix:application',
    });
  options.rootProject = projectRoot === '.';
  options.projectNameAndRootFormat = projectNameAndRootFormat;
  const nxJson = readNxJson(tree);
  const addPluginDefault =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;
  options.addPlugin ??= addPluginDefault;

  let e2eWebServerTarget = options.addPlugin ? 'dev' : 'serve';
  if (options.addPlugin) {
    if (nxJson.plugins) {
      for (const plugin of nxJson.plugins) {
        if (
          typeof plugin === 'object' &&
          plugin.plugin === '@nx/remix/plugin' &&
          (plugin.options as RemixPluginOptions).devTargetName
        ) {
          e2eWebServerTarget = (plugin.options as RemixPluginOptions)
            .devTargetName;
        }
      }
    }
  }

  let e2ePort = options.addPlugin ? 3000 : 4200;
  if (
    nxJson.targetDefaults?.[e2eWebServerTarget] &&
    (nxJson.targetDefaults?.[e2eWebServerTarget].options?.port ||
      nxJson.targetDefaults?.[e2eWebServerTarget].options?.env?.PORT)
  ) {
    e2ePort =
      nxJson.targetDefaults?.[e2eWebServerTarget].options?.port ||
      nxJson.targetDefaults?.[e2eWebServerTarget].options?.env?.PORT;
  }
  const e2eProjectName = options.rootProject ? 'e2e' : `${projectName}-e2e`;
  const e2eProjectRoot = options.rootProject ? 'e2e' : `${projectRoot}-e2e`;
  const e2eWebServerAddress = `http://localhost:${e2ePort}`;

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
    e2eWebServerAddress,
    e2eWebServerTarget,
    e2ePort,
    parsedTags,
  };
}
