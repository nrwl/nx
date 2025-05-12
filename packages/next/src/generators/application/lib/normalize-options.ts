import { joinPathFragments, readNxJson, Tree } from '@nx/devkit';
import {
  determineProjectNameAndRootOptions,
  ensureRootProjectName,
} from '@nx/devkit/src/generators/project-name-and-root-utils';
import { assertValidStyle } from '@nx/react/src/utils/assertion';
import { Schema } from '../schema';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';

export interface NormalizedSchema
  extends Omit<Schema, 'name' | 'useTsSolution'> {
  projectName: string;
  projectSimpleName: string;
  appProjectRoot: string;
  importPath: string;
  outputPath: string;
  e2eProjectName: string;
  e2eProjectRoot: string;
  parsedTags: string[];
  fileName: string;
  styledModule: null | string;
  isTsSolutionSetup: boolean;
  js?: boolean;
}

export async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  await ensureRootProjectName(options, 'application');
  const {
    projectName,
    names: projectNames,
    projectRoot: appProjectRoot,
    importPath,
  } = await determineProjectNameAndRootOptions(host, {
    name: options.name,
    projectType: 'application',
    directory: options.directory,
    rootProject: options.rootProject,
  });
  options.rootProject = appProjectRoot === '.';

  const nxJson = readNxJson(host);
  const addPlugin =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;

  options.addPlugin ??= addPlugin;

  const isTsSolutionSetup =
    options.useTsSolution || isUsingTsSolutionSetup(host);
  const appProjectName =
    !isTsSolutionSetup || options.name ? projectName : importPath;

  const e2eProjectName = options.rootProject ? 'e2e' : `${appProjectName}-e2e`;
  const e2eProjectRoot = options.rootProject ? 'e2e' : `${appProjectRoot}-e2e`;

  const outputPath = joinPathFragments(
    'dist',
    appProjectRoot,
    ...(options.rootProject ? [projectNames.projectFileName] : [])
  );

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const fileName = 'index';

  const appDir = options.appDir ?? true;
  const src = options.src ?? true;

  const styledModule = /^(css|scss|less|tailwind)$/.test(options.style)
    ? null
    : options.style;

  assertValidStyle(options.style);

  return {
    ...options,
    appDir,
    src,
    appProjectRoot,
    e2eProjectName,
    e2eProjectRoot,
    e2eTestRunner: options.e2eTestRunner || 'playwright',
    fileName,
    linter: options.linter || 'eslint',
    outputPath,
    parsedTags,
    projectName: appProjectName,
    projectSimpleName: projectNames.projectSimpleName,
    style: options.style || 'css',
    swc: options.swc ?? true,
    styledModule,
    unitTestRunner: options.unitTestRunner || 'jest',
    importPath,
    isTsSolutionSetup,
    useProjectJson: options.useProjectJson ?? !isTsSolutionSetup,
  };
}
