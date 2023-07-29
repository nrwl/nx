import {
  extractLayoutDirectory,
  getProjects,
  getWorkspaceLayout,
  joinPathFragments,
  logger,
  names,
  normalizePath,
  Tree,
} from '@nx/devkit';
import { getImportPath } from '@nx/js/src/utils/get-import-path';

import { assertValidStyle } from '../../../utils/assertion';
import { NormalizedSchema, Schema } from '../schema';

export function normalizeOptions(
  host: Tree,
  options: Schema
): NormalizedSchema {
  const name = names(options.name).fileName;
  const { projectDirectory, layoutDirectory } = extractLayoutDirectory(
    options.directory
  );
  const fullProjectDirectory = projectDirectory
    ? `${names(projectDirectory).fileName}/${name}`
    : name;

  const projectName = fullProjectDirectory.replace(new RegExp('/', 'g'), '-');
  const fileName = options.simpleName ? name : projectName;
  const { libsDir: defaultLibsDir } = getWorkspaceLayout(host);
  const libsDir = layoutDirectory ?? defaultLibsDir;
  const projectRoot = joinPathFragments(libsDir, fullProjectDirectory);

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const importPath =
    options.importPath || getImportPath(host, fullProjectDirectory);

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
    routePath: `/${name}`,
    name: projectName,
    projectRoot,
    projectDirectory: fullProjectDirectory,
    parsedTags,
    importPath,
    libsDir,
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
