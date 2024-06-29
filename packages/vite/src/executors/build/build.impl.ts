import {
  detectPackageManager,
  ExecutorContext,
  joinPathFragments,
  logger,
  offsetFromRoot,
  stripIndents,
  writeJsonFile,
} from '@nx/devkit';
import {
  getProjectTsConfigPath,
  normalizeViteConfigFilePath,
} from '../../utils/options-utils';
import { ViteBuildExecutorOptions } from './schema';
import {
  copyAssets,
  createLockFile,
  createPackageJson,
  getLockFileName,
} from '@nx/js';
import { existsSync, writeFileSync } from 'fs';
import { relative, resolve } from 'path';
import { createAsyncIterable } from '@nx/devkit/src/utils/async-iterable';
import {
  createBuildableTsConfig,
  loadViteDynamicImport,
  validateTypes,
} from '../../utils/executor-utils';

export async function* viteBuildExecutor(
  options: Record<string, any> & ViteBuildExecutorOptions,
  context: ExecutorContext
) {
  process.env.VITE_CJS_IGNORE_WARNING = 'true';
  // Allows ESM to be required in CJS modules. Vite will be published as ESM in the future.
  const { mergeConfig, build, loadConfigFromFile } =
    await loadViteDynamicImport();
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;
  const tsConfigForBuild = createBuildableTsConfig(
    projectRoot,
    options,
    context
  );

  const viteConfigPath = normalizeViteConfigFilePath(
    context.root,
    projectRoot,
    options.configFile
  );
  const root =
    projectRoot === '.'
      ? process.cwd()
      : relative(context.cwd, joinPathFragments(context.root, projectRoot));

  const { buildOptions, otherOptions } = await getBuildExtraArgs(options);

  const resolved = await loadConfigFromFile(
    {
      mode: otherOptions?.mode ?? 'production',
      command: 'build',
    },
    viteConfigPath
  );

  const outDir =
    joinPathFragments(offsetFromRoot(projectRoot), options.outputPath) ??
    resolved?.config?.build?.outDir;

  const buildConfig = mergeConfig(
    {
      // This should not be needed as it's going to be set in vite.config.ts
      // but leaving it here in case someone did not migrate correctly
      root: resolved.config.root ?? root,
      configFile: viteConfigPath,
    },
    {
      build: {
        outDir,
        ...buildOptions,
      },
      ...otherOptions,
    }
  );

  if (!options.skipTypeCheck) {
    await validateTypes({
      workspaceRoot: context.root,
      projectRoot: projectRoot,
      tsconfig: tsConfigForBuild,
    });
  }

  const watcherOrOutput = await build(buildConfig);

  const libraryPackageJson = resolve(projectRoot, 'package.json');
  const rootPackageJson = resolve(context.root, 'package.json');

  // Here, we want the outdir relative to the workspace root.
  // So, we calculate the relative path from the workspace root to the outdir.
  const outDirRelativeToWorkspaceRoot = outDir.replaceAll('../', '');
  const distPackageJson = resolve(
    outDirRelativeToWorkspaceRoot,
    'package.json'
  );

  // Generate a package.json if option has been set.
  if (options.generatePackageJson) {
    if (context.projectGraph.nodes[context.projectName].type !== 'app') {
      logger.warn(
        stripIndents`The project ${context.projectName} is using the 'generatePackageJson' option which is deprecated for library projects. It should only be used for applications.
        For libraries, configure the project to use the '@nx/dependency-checks' ESLint rule instead (https://nx.dev/nx-api/eslint-plugin/documents/dependency-checks).`
      );
    }

    const builtPackageJson = createPackageJson(
      context.projectName,
      context.projectGraph,
      {
        target: context.targetName,
        root: context.root,
        isProduction: !options.includeDevDependenciesInPackageJson, // By default we remove devDependencies since this is a production build.
      }
    );

    builtPackageJson.type = 'module';

    writeJsonFile(
      `${outDirRelativeToWorkspaceRoot}/package.json`,
      builtPackageJson
    );
    const packageManager = detectPackageManager(context.root);

    const lockFile = createLockFile(
      builtPackageJson,
      context.projectGraph,
      packageManager
    );
    writeFileSync(
      `${outDirRelativeToWorkspaceRoot}/${getLockFileName(packageManager)}`,
      lockFile,
      {
        encoding: 'utf-8',
      }
    );
  }
  // For buildable libs, copy package.json if it exists.
  else if (
    options.generatePackageJson !== false &&
    !existsSync(distPackageJson) &&
    existsSync(libraryPackageJson) &&
    rootPackageJson !== libraryPackageJson
  ) {
    await copyAssets(
      {
        outputPath: outDirRelativeToWorkspaceRoot,
        assets: [
          {
            input: projectRoot,
            output: '.',
            glob: 'package.json',
          },
        ],
      },
      context
    );
  }

  if ('on' in watcherOrOutput) {
    const iterable = createAsyncIterable<{ success: boolean }>(({ next }) => {
      let success = true;
      watcherOrOutput.on('event', (event) => {
        if (event.code === 'START') {
          success = true;
        } else if (event.code === 'ERROR') {
          success = false;
        } else if (event.code === 'END') {
          next({ success });
        }
        // result must be closed when present.
        // see https://rollupjs.org/guide/en/#rollupwatch
        if ('result' in event && event.result) {
          event.result.close();
        }
      });
    });
    yield* iterable;
  } else {
    const output = watcherOrOutput?.['output'] || watcherOrOutput?.[0]?.output;
    const fileName = output?.[0]?.fileName || 'main.cjs';
    const outfile = resolve(outDirRelativeToWorkspaceRoot, fileName);
    yield { success: true, outfile };
  }
}

export async function getBuildExtraArgs(
  options: ViteBuildExecutorOptions
): Promise<{
  // vite BuildOptions
  buildOptions: Record<string, unknown>;
  otherOptions: Record<string, any>;
}> {
  // support passing extra args to vite cli
  const schema = await import('./schema.json');
  const extraArgs = {};
  for (const key of Object.keys(options)) {
    if (!schema.properties[key]) {
      extraArgs[key] = options[key];
    }
  }

  const buildOptions = {};
  const buildSchemaKeys = [
    'target',
    'polyfillModulePreload',
    'modulePreload',
    'outDir',
    'assetsDir',
    'assetsInlineLimit',
    'cssCodeSplit',
    'cssTarget',
    'cssMinify',
    'sourcemap',
    'minify',
    'terserOptions',
    'rollupOptions',
    'commonjsOptions',
    'dynamicImportVarsOptions',
    'write',
    'emptyOutDir',
    'copyPublicDir',
    'manifest',
    'lib',
    'ssr',
    'ssrManifest',
    'ssrEmitAssets',
    'reportCompressedSize',
    'chunkSizeWarningLimit',
    'watch',
  ];
  const otherOptions = {};
  for (const key of Object.keys(extraArgs)) {
    if (buildSchemaKeys.includes(key)) {
      buildOptions[key] = extraArgs[key];
    } else {
      otherOptions[key] = extraArgs[key];
    }
  }

  buildOptions['watch'] = options.watch ?? undefined;

  return {
    buildOptions,
    otherOptions,
  };
}

export default viteBuildExecutor;
