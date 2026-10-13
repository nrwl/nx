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
    unitTestRunner: options.unitTestRunner ?? 'jest',
    rootProject: options.rootProject ?? false,
    port: options.port ?? 3000,
    buildTargetName: 'build',
    serveRuntime: getServeRuntime(options, addPlugin, isUsingTsSolutionConfig),
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
  // Node runs TypeScript natively but resolves neither tsconfig path aliases nor
  // the extensionless relative imports and `__dirname` the fastify template uses.
  // Its ESM sources import `./x.ts`, which only tsc and rolldown rewrite on build,
  // and `--js` apps would make jest load CommonJS configs as ESM.
  return isUsingTsSolutionConfig &&
    (options.bundler === 'tsc' || options.bundler === 'rolldown') &&
    options.framework !== 'fastify' &&
    !options.js
    ? 'node'
    : 'tsx';
}
