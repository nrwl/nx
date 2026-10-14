import { joinPathFragments, names, readNxJson, Tree } from '@nx/devkit';
import {
  determineProjectNameAndRootOptions,
  ensureRootProjectName,
} from '@nx/devkit/internal';
import { isUsingTsSolutionSetup, normalizeLinterOption } from '@nx/js/internal';
import { Schema } from '../schema';
import { NormalizedSchema } from './normalized-schema';

export async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  await ensureRootProjectName(options, 'application');
  const {
    projectName,
    projectRoot: appProjectRoot,
    importPath,
  } = await determineProjectNameAndRootOptions(host, {
    name: options.name,
    projectType: 'application',
    directory: options.directory,
    rootProject: options.rootProject,
  });
  options.rootProject = appProjectRoot === '.';

  options.e2eTestRunner = options.e2eTestRunner ?? 'jest';

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const nxJson = readNxJson(host);
  const addPlugin =
    options.addPlugin ??
    (process.env.NX_ADD_PLUGINS !== 'false' &&
      nxJson.useInferencePlugins !== false);

  const isUsingTsSolutionConfig = isUsingTsSolutionSetup(host);
  // Legacy workspaces resolve imports through tsconfig paths, which tsc does not
  // rewrite in emitted JS; rolldown bundles them instead. Fastify autoloads
  // plugins/ and routes/ from disk, so it needs unbundled output.
  options.bundler ??= isUsingTsSolutionConfig
    ? 'tsc'
    : options.framework === 'fastify'
      ? 'esbuild'
      : 'rolldown';
  if (options.bundler === 'tsc' && !isUsingTsSolutionConfig) {
    throw new Error(
      `The "tsc" bundler requires a TypeScript solution workspace (project references). This workspace uses tsconfig path aliases, which tsc does not rewrite in emitted JavaScript. Use "--bundler=rolldown" or "--bundler=esbuild" instead.`
    );
  }
  if (options.bundler === 'rolldown' && options.framework === 'fastify') {
    // The fastify template autoloads plugins/ and routes/ from disk at runtime,
    // which a single-file bundle does not emit.
    throw new Error(
      `The "rolldown" bundler does not support the "fastify" framework. Use "--bundler=tsc" or "--bundler=esbuild" instead.`
    );
  }
  const swcJest = options.swcJest ?? isUsingTsSolutionConfig;
  const serveRuntime = getServeRuntime(
    options,
    addPlugin,
    isUsingTsSolutionConfig
  );

  const appProjectName =
    !isUsingTsSolutionConfig || options.name ? projectName : importPath;
  const useProjectJson = options.useProjectJson ?? !isUsingTsSolutionConfig;

  return {
    ...options,
    addPlugin,
    name: appProjectName,
    frontendProject: options.frontendProject
      ? names(options.frontendProject).fileName
      : undefined,
    appProjectRoot,
    importPath,
    parsedTags,
    linter: await normalizeLinterOption(host, options.linter),
    // Jest loads the app's ESM sources as CommonJS.
    unitTestRunner:
      options.unitTestRunner ?? (serveRuntime === 'node' ? 'vitest' : 'jest'),
    rootProject: options.rootProject ?? false,
    port: options.port ?? 3000,
    buildTargetName: 'build',
    serveRuntime,
    outputPath: isUsingTsSolutionConfig
      ? joinPathFragments(appProjectRoot, 'dist')
      : joinPathFragments(
          'dist',
          options.rootProject ? appProjectName : appProjectRoot
        ),
    isUsingTsSolutionConfig,
    swcJest,
    useProjectJson,
  };
}

function getServeRuntime(
  options: Schema,
  addPlugin: boolean,
  isUsingTsSolutionConfig: boolean
): NormalizedSchema['serveRuntime'] {
  // Webpack apps keep the explicit @nx/js:node serve.
  if (!addPlugin || options.bundler === 'webpack') {
    return undefined;
  }
  // Node runs TypeScript natively but does not resolve tsconfig path aliases.
  // Its ESM sources import `./x.ts`, which only tsc and rolldown rewrite on build,
  // Jest loads ESM sources as CommonJS, so `--js` and jest apps stay CommonJS on tsx.
  return isUsingTsSolutionConfig &&
    (options.bundler === 'tsc' || options.bundler === 'rolldown') &&
    !options.js &&
    options.unitTestRunner !== 'jest'
    ? 'node'
    : 'tsx';
}
