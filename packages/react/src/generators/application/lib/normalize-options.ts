import { Tree, names, readNxJson } from '@nx/devkit';
import {
  determineProjectNameAndRootOptions,
  ensureRootProjectName,
} from '@nx/devkit/internal';
import {
  assertValidReactRouter,
  assertValidStyle,
} from '../../../utils/assertion';
import { NormalizedSchema, Schema } from '../schema';
import { normalizeLinterOption, isUsingTsSolutionSetup } from '@nx/js/internal';

export async function normalizeOptions<T extends Schema = Schema>(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema<T>> {
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

  const nxJson = readNxJson(host);
  const addPlugin =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;

  options.addPlugin ??= addPlugin;

  options.rootProject = appProjectRoot === '.';

  const isUsingTsSolutionConfig = isUsingTsSolutionSetup(host);
  const appProjectName =
    !isUsingTsSolutionConfig || options.name ? projectName : importPath;

  const e2eProjectName = options.rootProject ? 'e2e' : `${appProjectName}-e2e`;
  const e2eProjectRoot = options.rootProject ? 'e2e' : `${appProjectRoot}-e2e`;

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const fileName = 'app';

  assertValidStyle(options.style);
  assertValidReactRouter(options.useReactRouter, options.bundler);

  if (options.useReactRouter && !options.bundler) {
    options.bundler = 'vite';
  }
  options.useReactRouter = options.routing ? options.useReactRouter : false;

  const normalized: NormalizedSchema = {
    ...options,
    projectName: appProjectName,
    appProjectRoot,
    importPath,
    e2eProjectName,
    e2eProjectRoot,
    parsedTags,
    fileName,
    hasStyles: options.style !== 'none',
    names: names(projectNames.projectSimpleName),
    isUsingTsSolutionConfig,
    useProjectJson: options.useProjectJson ?? !isUsingTsSolutionConfig,
    routing: options.routing ?? false,
    useReactRouter: options.useReactRouter ?? false,
    strict: options.strict ?? true,
    classComponent: options.classComponent ?? false,
    compiler: options.compiler ?? 'babel',
    bundler: options.bundler ?? 'webpack',
    unitTestRunner: options.unitTestRunner ?? 'jest',
    e2eTestRunner: options.e2eTestRunner ?? 'playwright',
    inSourceTests: options.minimal || options.inSourceTests,
    // This generator's CLI option has always been `--port`; `devServerPort` is
    // programmatic-only back-compat, so there is no schema alias to lean on here.
    port: options.port ?? options.devServerPort,
    minimal: options.minimal ?? false,
    // Programmatic callers such as the host and remote generators leave this
    // unset; the guards downstream read an unresolved `undefined` as "not eslint"
    // and would half-configure the project.
    linter: await normalizeLinterOption(host, options.linter),
  };

  return normalized;
}
