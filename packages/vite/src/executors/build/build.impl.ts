import {
  detectPackageManager,
  ExecutorContext,
  logger,
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
import { resolve } from 'path';
import { createAsyncIterable } from '@nx/devkit/src/utils/async-iterable';
import {
  createBuildableTsConfig,
  validateTypes,
} from '../../utils/executor-utils';
import { InlineConfig } from 'vite';

export async function* viteBuildExecutor(
  options: ViteBuildExecutorOptions,
  context: ExecutorContext
) {
  // Allows ESM to be required in CJS modules. Vite will be published as ESM in the future.
  const { mergeConfig, build, loadConfigFromFile } = await (Function(
    'return import("vite")'
  )() as Promise<typeof import('vite')>);
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;
  const viteConfigPath = normalizeViteConfigFilePath(
    projectRoot,
    options.configFile
  );
  const extraArgs = await getExtraArgs(options);

  const resolved = await loadConfigFromFile(
    {
      mode: extraArgs?.mode ?? 'production',
      command: 'build',
    },
    viteConfigPath
  );

  createBuildableTsConfig(projectRoot, options, context);

  const outDir = options.outputPath ?? resolved?.config?.build?.outDir;

  const buildConfig = mergeConfig(
    {
      configFile: viteConfigPath,
    },
    {
      build: {
        outDir,
        ...extraArgs,
      },
      ...extraArgs,
    }
  );

  if (!options.skipTypeCheck) {
    await validateTypes({
      workspaceRoot: context.root,
      projectRoot: projectRoot,
      tsconfig: getProjectTsConfigPath(projectRoot),
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
        For libraries, configure the project to use the '@nx/dependency-checks' ESLint rule instead (https://nx.dev/packages/eslint-plugin/documents/dependency-checks).`
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
        if ('result' in event) {
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

async function getExtraArgs(
  options: ViteBuildExecutorOptions
): Promise<InlineConfig> {
  // support passing extra args to vite cli
  const schema = await import('./schema.json');
  const extraArgs = {};
  for (const key of Object.keys(options)) {
    if (!schema.properties[key]) {
      extraArgs[key] = options[key];
    }
  }

  return extraArgs as InlineConfig;
}

export default viteBuildExecutor;
