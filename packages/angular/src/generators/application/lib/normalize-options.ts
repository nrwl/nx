import { joinPathFragments, readNxJson, type Tree } from '@nx/devkit';
import {
  determineProjectNameAndRootOptions,
  ensureRootProjectName,
} from '@nx/devkit/src/generators/project-name-and-root-utils';
import { E2eTestRunner, UnitTestRunner } from '../../../utils/test-runners';
import type { Schema } from '../schema';
import type { NormalizedSchema } from './normalized-schema';

function arePluginsExplicitlyDisabled(host: Tree) {
  const { useInferencePlugins } = readNxJson(host);
  const addPluginEnvVar = process.env.NX_ADD_PLUGINS;
  return useInferencePlugins === false || addPluginEnvVar === 'false';
}

export async function normalizeOptions(
  host: Tree,
  options: Partial<Schema>,
  isRspack?: boolean
): Promise<NormalizedSchema> {
  await ensureRootProjectName(options as Schema, 'application');
  const { projectName: appProjectName, projectRoot: appProjectRoot } =
    await determineProjectNameAndRootOptions(host, {
      name: options.name,
      projectType: 'application',
      directory: options.directory,
      rootProject: options.rootProject,
    });
  options.rootProject = appProjectRoot === '.';

  const e2eProjectName = options.rootProject ? 'e2e' : `${appProjectName}-e2e`;
  const e2eProjectRoot = options.rootProject ? 'e2e' : `${appProjectRoot}-e2e`;

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const bundler = options.bundler ?? 'esbuild';

  const addPlugin =
    options.addPlugin ?? (!arePluginsExplicitlyDisabled(host) && isRspack);

  // Set defaults and then overwrite with user options
  return {
    addPlugin,
    style: 'css',
    routing: true,
    inlineStyle: false,
    inlineTemplate: false,
    skipTests: options.unitTestRunner === UnitTestRunner.None,
    skipFormat: false,
    e2eTestRunner: E2eTestRunner.Playwright,
    linter: 'eslint',
    strict: true,
    standalone: true,
    directory: appProjectRoot,
    ...options,
    prefix: options.prefix || 'app',
    name: appProjectName,
    appProjectRoot,
    appProjectSourceRoot: `${appProjectRoot}/src`,
    e2eProjectRoot,
    e2eProjectName,
    parsedTags,
    bundler,
    outputPath: joinPathFragments(
      'dist',
      !options.rootProject ? appProjectRoot : appProjectName
    ),
    ssr: options.ssr ?? false,
    unitTestRunner: options.unitTestRunner ?? UnitTestRunner.Jest,
  };
}
