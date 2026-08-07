import {
  determineProjectNameAndRootOptions,
  ensureRootProjectName,
} from '@nx/devkit/internal';
import {
  getProjects,
  logger,
  normalizePath,
  readNxJson,
  Tree,
} from '@nx/devkit';
import { NormalizedSchema, Schema } from '../schema';
import {
  normalizeLinterOption,
  getProjectSourceRoot,
  getProjectType,
  isUsingTsSolutionSetup,
} from '@nx/js/internal';

export async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  await ensureRootProjectName(options, 'library');
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
  });

  const fileName = projectNames.projectFileName;

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  let bundler = options.bundler ?? 'none';

  if (bundler === 'none') {
    if (options.publishable) {
      logger.warn(
        `Publishable libraries cannot be used with bundler: 'none'. Defaulting to 'vite'.`
      );
      bundler = 'vite';
    }
  }
  const nxJson = readNxJson(host);

  const addPlugin =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;

  const isUsingTsSolutionConfig = isUsingTsSolutionSetup(host);

  let appMain: string | undefined;
  let appSourceRoot: string | undefined;

  if (options.appProject) {
    const appProjectConfig = getProjects(host).get(options.appProject);
    const appProjectType = getProjectType(
      host,
      appProjectConfig.root,
      appProjectConfig.projectType
    );

    if (appProjectType !== 'application') {
      throw new Error(
        `appProject expected type of "application" but got "${appProjectType}"`
      );
    }

    const projectSourceRoot = getProjectSourceRoot(appProjectConfig, host);

    try {
      appMain = appProjectConfig.targets.build.options.main;
      appSourceRoot = normalizePath(projectSourceRoot);
    } catch (e) {
      throw new Error(
        `Could not locate project main for ${options.appProject}`
      );
    }
  }

  const normalized: NormalizedSchema = {
    addPlugin,
    ...options,
    projectName:
      isUsingTsSolutionConfig && !options.name ? importPath : projectName,
    // Libraries with a bundler or that are publishable must also be buildable.
    bundler: bundler !== 'none' || options.publishable ? 'vite' : 'none',
    fileName,
    routePath: `/${projectNames.projectFileName}`,
    name: projectName,
    projectRoot,
    parsedTags,
    importPath,
    isUsingTsSolutionConfig,
    useProjectJson: options.useProjectJson ?? !isUsingTsSolutionConfig,
    js: options.js ?? false,
    appMain,
    appSourceRoot,
    // Framework-specific ESLint shaping is guarded on `=== 'eslint'`, so an
    // unresolved `undefined` would create a bare config with none of it.
    linter: await normalizeLinterOption(host, options.linter),
  };

  return normalized;
}
