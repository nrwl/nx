import 'dotenv/config';
import { ExecutorContext, writeJsonFile } from '@nx/devkit';
import { build, InlineConfig, mergeConfig } from 'vite';
import {
  getProjectTsConfigPath,
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
import { registerPaths, validateTypes } from '../../utils/executor-utils';

export async function* viteBuildExecutor(
  options: ViteBuildExecutorOptions,
  context: ExecutorContext
) {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;

  registerPaths(projectRoot, options, context);

  const normalizedOptions = normalizeOptions(options);

  const buildConfig = mergeConfig(
    getViteSharedConfig(normalizedOptions, false, context),
    {
      build: getViteBuildOptions(normalizedOptions, context),
    }
  );

  if (!options.skipTypeCheck) {
    await validateTypes({
      workspaceRoot: context.root,
      projectRoot: projectRoot,
      tsconfig: getProjectTsConfigPath(projectRoot),
    });
  }

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
