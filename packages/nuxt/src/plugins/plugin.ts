import {
  loadConfigFile,
  getNamedInputs,
  calculateHashesForCreateNodes,
  PluginCache,
} from '@nx/devkit/internal';
import {
  AggregateCreateNodesError,
  CreateDependencies,
  CreateNodesContext,
  createNodesFromFiles,
  CreateNodesResultArray,
  CreateNodes,
  detectPackageManager,
  getPackageManagerCommand,
  joinPathFragments,
  TargetConfiguration,
  workspaceRoot,
} from '@nx/devkit';
import { workspaceDataDirectory } from '@nx/devkit/internal';
import { getLockFileName } from '@nx/js';
import { dirname, isAbsolute, join, relative } from 'path';
import { readdirSync } from 'fs';
import { loadNuxtKitDynamicImport } from '../utils/executor-utils';
import { addBuildAndWatchDepsTargets } from '@nx/js/internal';

type NuxtTargets = Record<string, TargetConfiguration>;

const cachePath = join(workspaceDataDirectory, 'nuxt.hash');
const targetsCache = new PluginCache<NuxtTargets>(cachePath);

export interface NuxtPluginOptions {
  buildTargetName?: string;
  serveTargetName?: string;
  serveStaticTargetName?: string;
  buildStaticTargetName?: string;
  buildDepsTargetName?: string;
  watchDepsTargetName?: string;
}

export const createNodes: CreateNodes<NuxtPluginOptions> = [
  '**/nuxt.config.{js,ts,mjs,mts,cjs,cts}',
  async (files, options, context) => {
    const packageManager = detectPackageManager(context.workspaceRoot);
    const pmc = getPackageManagerCommand(packageManager);
    const lockFileName = getLockFileName(packageManager);
    const normalizedOptions = normalizeOptions(options);

    try {
      const { entries, preErrors } = await filterNuxtConfigs(files, context);

      const projectHashes = await calculateHashesForCreateNodes(
        entries.map((e) => e.projectRoot),
        normalizedOptions,
        context,
        entries.map(() => [lockFileName])
      );

      let results: CreateNodesResultArray = [];
      let nodeErrors: Array<[string | null, Error]> = [];
      try {
        results = await createNodesFromFiles(
          (configFile, _, ctx, idx) =>
            createNodesInternal(
              configFile,
              normalizedOptions,
              ctx,
              pmc,
              projectHashes[idx]
            ),
          entries.map((e) => e.configFile),
          options,
          context
        );
      } catch (e) {
        if (e instanceof AggregateCreateNodesError) {
          results = e.partialResults ?? [];
          nodeErrors = e.errors;
        } else {
          throw e;
        }
      }

      const allErrors = [...preErrors, ...nodeErrors];
      if (allErrors.length > 0) {
        throw new AggregateCreateNodesError(allErrors, results);
      }
      return results;
    } finally {
      targetsCache.writeToDisk();
    }
  },
];

export const createNodesV2 = createNodes;

async function createNodesInternal(
  configFilePath: string,
  options: NuxtPluginOptions,
  context: CreateNodesContext,
  pmc: ReturnType<typeof getPackageManagerCommand>,
  hash: string
) {
  const projectRoot = dirname(configFilePath);
  if (!targetsCache.has(hash)) {
    targetsCache.set(
      hash,
      await buildNuxtTargets(configFilePath, projectRoot, options, context, pmc)
    );
  }

  return {
    projects: {
      [projectRoot]: {
        root: projectRoot,
        targets: targetsCache.get(hash),
      },
    },
  };
}

async function buildNuxtTargets(
  configFilePath: string,
  projectRoot: string,
  options: NuxtPluginOptions,
  context: CreateNodesContext,
  pmc: ReturnType<typeof getPackageManagerCommand>
) {
  const nuxtConfig: {
    buildDir: string;
  } = await getInfoFromNuxtConfig(configFilePath, context, projectRoot);

  const { buildOutputs } = getOutputs(nuxtConfig, projectRoot);

  const namedInputs = getNamedInputs(projectRoot, context);

  const targets: Record<string, TargetConfiguration> = {};

  targets[options.buildTargetName] = buildTarget(
    options.buildTargetName,
    namedInputs,
    buildOutputs,
    projectRoot
  );

  targets[options.serveTargetName] = serveTarget(projectRoot);

  targets[options.serveStaticTargetName] = serveStaticTarget(options);

  targets[options.buildStaticTargetName] = buildStaticTarget(
    options.buildStaticTargetName,
    namedInputs,
    buildOutputs,
    projectRoot
  );

  addBuildAndWatchDepsTargets(
    context.workspaceRoot,
    projectRoot,
    targets,
    options,
    pmc
  );

  return targets;
}

function buildTarget(
  buildTargetName: string,
  namedInputs: {
    [inputName: string]: any[];
  },
  buildOutputs: string[],
  projectRoot: string
) {
  return {
    command: `nuxt build`,
    options: { cwd: projectRoot },
    cache: true,
    dependsOn: [`^${buildTargetName}`],
    inputs: [
      ...('production' in namedInputs
        ? ['production', '^production']
        : ['default', '^default']),

      {
        externalDependencies: ['nuxt'],
      },
    ],
    outputs: buildOutputs,
  };
}

function serveTarget(projectRoot: string) {
  const targetConfig: TargetConfiguration = {
    command: `nuxt dev`,
    options: {
      cwd: projectRoot,
    },
    continuous: true,
  };

  return targetConfig;
}

function serveStaticTarget(options: NuxtPluginOptions) {
  const targetConfig: TargetConfiguration = {
    dependsOn: [`${options.buildStaticTargetName}`],
    continuous: true,
    executor: '@nx/web:file-server',
    options: {
      buildTarget: `${options.buildStaticTargetName}`,
      staticFilePath: '{projectRoot}/dist',
      port: 4200,
      // Routes are found correctly with serve-static
      spa: false,
    },
  };

  return targetConfig;
}

function buildStaticTarget(
  buildStaticTargetName: string,
  namedInputs: {
    [inputName: string]: any[];
  },
  buildOutputs: string[],
  projectRoot: string
) {
  const targetConfig: TargetConfiguration = {
    command: `nuxt build --prerender`,
    options: { cwd: projectRoot },
    cache: true,
    dependsOn: [`^${buildStaticTargetName}`],
    inputs: [
      ...('production' in namedInputs
        ? ['production', '^production']
        : ['default', '^default']),

      {
        externalDependencies: ['nuxt'],
      },
    ],
    outputs: buildOutputs,
  };
  return targetConfig;
}

async function getInfoFromNuxtConfig(
  configFilePath: string,
  context: CreateNodesContext,
  projectRoot: string
): Promise<{
  buildDir: string;
}> {
  // Only `buildDir` is read below. Typing it to the full `@nuxt/schema`
  // `NuxtOptions` couples to one schema version, which clashes when
  // `loadNuxtConfig` returns the (possibly older) `@nuxt/schema` bundled by the
  // installed `@nuxt/kit`. Type just what we read so it holds across the
  // supported Nuxt 3.x–4.x range.
  let config: { buildDir?: string };
  if (process.env.NX_ISOLATE_PLUGINS !== 'false') {
    config = await (
      await loadNuxtKitDynamicImport()
    ).loadNuxtConfig({
      configFile: configFilePath,
    });
  } else {
    config = await loadConfigFile(join(context.workspaceRoot, configFilePath));
  }
  return {
    buildDir:
      config?.buildDir ??
      // Match .nuxt default build dir from '@nuxt/schema'
      // See: https://github.com/nuxt/nuxt/blob/871404ae5673425aeedde82f123ea58aa7c6facf/packages/schema/src/config/common.ts#L117-L119
      '.nuxt',
  };
}

function getOutputs(
  nuxtConfig: { buildDir: string },
  projectRoot: string
): {
  buildOutputs: string[];
} {
  const buildOutputPath = normalizeOutputPath(
    nuxtConfig?.buildDir,
    projectRoot
  );

  return {
    buildOutputs: [buildOutputPath, '{projectRoot}/.output'],
  };
}

function normalizeOutputPath(
  outputPath: string | undefined,
  projectRoot: string
): string {
  if (!outputPath) {
    if (projectRoot === '.') {
      return `{projectRoot}`;
    } else {
      return `{workspaceRoot}/{projectRoot}`;
    }
  } else {
    if (isAbsolute(outputPath)) {
      return `{workspaceRoot}/${relative(workspaceRoot, outputPath)}`;
    } else {
      if (outputPath.startsWith('..')) {
        return joinPathFragments('{workspaceRoot}', projectRoot, outputPath);
      } else {
        return joinPathFragments('{projectRoot}', outputPath);
      }
    }
  }
}

interface NuxtEntry {
  configFile: string;
  projectRoot: string;
}

async function filterNuxtConfigs(
  configFiles: readonly string[],
  context: CreateNodesContext
): Promise<{
  entries: NuxtEntry[];
  preErrors: Array<[string, Error]>;
}> {
  const preErrors: Array<[string, Error]> = [];
  const candidates = await Promise.all(
    configFiles.map(async (configFile): Promise<NuxtEntry | null> => {
      try {
        const projectRoot = dirname(configFile);
        const siblingFiles = readdirSync(
          join(context.workspaceRoot, projectRoot)
        );
        if (
          !siblingFiles.includes('package.json') &&
          !siblingFiles.includes('project.json')
        ) {
          return null;
        }
        return { configFile, projectRoot };
      } catch (e) {
        preErrors.push([configFile, e as Error]);
        return null;
      }
    })
  );
  return {
    entries: candidates.filter((c): c is NuxtEntry => c !== null),
    preErrors,
  };
}

function normalizeOptions(options: NuxtPluginOptions): NuxtPluginOptions {
  options ??= {};
  options.buildTargetName ??= 'build';
  options.serveTargetName ??= 'serve';
  options.serveStaticTargetName ??= 'serve-static';
  options.buildStaticTargetName ??= 'build-static';
  return options;
}
