import { getProjects, logger, normalizePath, Tree } from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { assertValidStyle } from '../../../utils/assertion';
import { NormalizedSchema, Schema } from '../schema';

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
    callingGenerator: '@nx/react:library',
  });

  const fileName = options.simpleName
    ? projectNames.projectSimpleName
    : projectNames.projectFileName;

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  let bundler = options.bundler ?? 'none';

  if (bundler === 'none') {
    if (options.publishable) {
      logger.warn(
        `Publishable libraries cannot be used with bundler: 'none'. Defaulting to 'rollup'.`
      );
      bundler = 'rollup';
    }
    if (options.buildable) {
      logger.warn(
        `Buildable libraries cannot be used with bundler: 'none'. Defaulting to 'rollup'.`
      );
      bundler = 'rollup';
    }
  }

  const normalized = {
    ...options,
    compiler: options.compiler ?? 'babel',
    bundler,
    fileName,
    routePath: `/${projectNames.projectSimpleName}`,
    name: projectName,
    projectRoot,
    parsedTags,
    importPath,
  } as NormalizedSchema;

  // Libraries with a bundler or is publishable must also be buildable.
  normalized.buildable = Boolean(
    normalized.bundler !== 'none' || options.buildable || options.publishable
  );

  normalized.inSourceTests === normalized.minimal || normalized.inSourceTests;

  if (options.appProject) {
    const appProjectConfig = getProjects(host).get(options.appProject);

    if (appProjectConfig.projectType !== 'application') {
      throw new Error(
        `appProject expected type of "application" but got "${appProjectConfig.projectType}"`
      );
    }

    try {
      normalized.appMain = appProjectConfig.targets.build.options.main;
      normalized.appSourceRoot = normalizePath(appProjectConfig.sourceRoot);
    } catch (e) {
      throw new Error(
        `Could not locate project main for ${options.appProject}`
      );
    }
  }

  assertValidStyle(normalized.style);

  return normalized;
}
