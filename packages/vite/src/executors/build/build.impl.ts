import 'dotenv/config';
import { ExecutorContext, writeJsonFile } from '@nx/devkit';
import { build, InlineConfig, mergeConfig } from 'vite';
import {
  getViteBuildOptions,
  getViteSharedConfig,
} from '../../utils/options-utils';
import { ViteBuildExecutorOptions } from './schema';
import {
  copyAssets,
  createLockFile,
  createPackageJson,
  getLockFileName,
} from '@nx/js';
import { existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { createAsyncIterable } from '@nx/devkit/src/utils/async-iterable';
import { registerTsConfigPaths } from '@nx/js/src/internal';
import { calculateProjectDependencies, createTmpTsConfig } from '@nx/js/src/utils/buildable-libs-utils';

export async function* viteBuildExecutor(
  options: ViteBuildExecutorOptions,
  context: ExecutorContext
) {
  const metadata = context.projectsConfigurations.projects[context.projectName];
  const projectRoot = metadata.root;
  const tsConfig = resolve(projectRoot, 'tsconfig.json');
  options.buildLibsFromSource ??= true;

  if (!options.buildLibsFromSource) {
    const { dependencies } = calculateProjectDependencies(
      context.projectGraph,
      context.root,
      context.projectName,
      context.targetName,
      context.configurationName,
    );
    const tmpTsConfig = createTmpTsConfig(tsConfig, context.root, projectRoot, dependencies);

    registerTsConfigPaths(tmpTsConfig);
  } else {
    registerTsConfigPaths(tsConfig);
  }

  const normalizedOptions = normalizeOptions(options);

  const buildConfig = mergeConfig(
    getViteSharedConfig(normalizedOptions, false, context),
    {
      build: getViteBuildOptions(normalizedOptions, context),
    }
  );

  const watcherOrOutput = await runInstance(buildConfig);

  const libraryPackageJson = resolve(projectRoot, 'package.json');
  const rootPackageJson = resolve(context.root, 'package.json');
  const distPackageJson = resolve(normalizedOptions.outputPath, 'package.json');

  // Generate a package.json if option has been set.
  if (options.generatePackageJson) {
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

    writeJsonFile(`${options.outputPath}/package.json`, builtPackageJson);

    const lockFile = createLockFile(builtPackageJson);
    writeFileSync(`${options.outputPath}/${getLockFileName()}`, lockFile, {
      encoding: 'utf-8',
    });
  }
  // For buildable libs, copy package.json if it exists.
  else if (
    !existsSync(distPackageJson) &&
    existsSync(libraryPackageJson) &&
    rootPackageJson !== libraryPackageJson
  ) {
    await copyAssets(
      {
        outputPath: normalizedOptions.outputPath,
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
        if ('result' in event) {
          event.result.close();
        }
      });
    });
    yield* iterable;
  } else {
    const output = watcherOrOutput?.['output'] || watcherOrOutput?.[0]?.output;
    const fileName = output?.[0]?.fileName || 'main.cjs';
    const outfile = resolve(normalizedOptions.outputPath, fileName);
    yield { success: true, outfile };
  }
}

function runInstance(options: InlineConfig) {
  return build({
    ...options,
  });
}

function normalizeOptions(options: ViteBuildExecutorOptions) {
  const normalizedOptions = { ...options };

  // coerce watch to null or {} to match with Vite's watch config
  if (options.watch === false) {
    normalizedOptions.watch = null;
  } else if (options.watch === true) {
    normalizedOptions.watch = {};
  }

  return normalizedOptions;
}

export default viteBuildExecutor;
