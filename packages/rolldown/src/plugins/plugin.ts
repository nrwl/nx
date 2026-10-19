import {
  calculateHashesForCreateNodes,
  getNamedInputs,
  hashObject,
  PluginCache,
  workspaceDataDirectory,
} from '@nx/devkit/internal';
import {
  type CreateNodes,
  type CreateNodesContext,
  createNodesFromFiles,
  detectPackageManager,
  getPackageManagerCommand,
  joinPathFragments,
  normalizePath,
  type TargetConfiguration,
} from '@nx/devkit';
import { getLockFileName } from '@nx/js';
import { TS_SOLUTION_SETUP_TSCONFIG_INPUT } from '@nx/js/internal';
import { existsSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { OutputOptions, RolldownOptions } from 'rolldown';

type ConfigExport = Awaited<
  ReturnType<typeof import('rolldown/config').loadConfig>
>;

export interface RolldownPluginOptions {
  buildTargetName?: string;
}

type RolldownTargets = Record<string, TargetConfiguration>;

const rolldownConfigGlob = '**/rolldown.config.{js,cjs,mjs,ts,cts,mts}';

export const createNodes: CreateNodes<RolldownPluginOptions> = [
  rolldownConfigGlob,
  async (configFilePaths, options, context) => {
    const normalizedOptions = normalizeOptions(options);
    const cachePath = join(
      workspaceDataDirectory,
      `rolldown-${hashObject(normalizedOptions)}.hash`
    );
    const targetsCache = new PluginCache<RolldownTargets>(cachePath);
    const packageManager = detectPackageManager(context.workspaceRoot);
    const pmc = getPackageManagerCommand(packageManager);
    const lockFileName = getLockFileName(packageManager);

    const configFiles = configFilePaths.filter((configFile) =>
      isProjectRoot(context.workspaceRoot, dirname(configFile))
    );

    try {
      const projectHashes = await calculateHashesForCreateNodes(
        configFiles.map((f) => dirname(f)),
        normalizedOptions,
        context,
        configFiles.map(() => [lockFileName])
      );

      return await createNodesFromFiles(
        async (configFile, _, ctx, idx) => {
          const projectRoot = dirname(configFile);
          const hash = projectHashes[idx];
          if (!targetsCache.has(hash)) {
            targetsCache.set(
              hash,
              await buildRolldownTargets(
                configFile,
                projectRoot,
                normalizedOptions,
                ctx,
                pmc
              )
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
        },
        configFiles,
        normalizedOptions,
        context
      );
    } finally {
      targetsCache.writeToDisk();
    }
  },
];

export const createNodesV2 = createNodes;

async function buildRolldownTargets(
  configFilePath: string,
  projectRoot: string,
  options: Required<RolldownPluginOptions>,
  context: CreateNodesContext,
  pmc: ReturnType<typeof getPackageManagerCommand>
): Promise<RolldownTargets> {
  const absoluteConfigPath = join(context.workspaceRoot, configFilePath);
  const configs = await loadRolldownConfig(absoluteConfigPath);
  const namedInputs = getNamedInputs(projectRoot, context);

  return {
    [options.buildTargetName]: {
      command: `rolldown -c ${basename(configFilePath)}`,
      options: { cwd: projectRoot },
      cache: true,
      dependsOn: [`^${options.buildTargetName}`],
      inputs: [
        ...('production' in namedInputs
          ? ['production', '^production']
          : ['default', '^default']),
        { externalDependencies: ['rolldown'] },
        TS_SOLUTION_SETUP_TSCONFIG_INPUT,
      ],
      outputs: getOutputs(configs, context.workspaceRoot, projectRoot),
      metadata: {
        technologies: ['rolldown'],
        description: 'Run Rolldown',
        help: {
          command: `${pmc.exec} rolldown --help`,
          example: {
            options: {
              sourcemap: true,
              watch: true,
            },
          },
        },
      },
    },
  };
}

async function loadRolldownConfig(
  absoluteConfigPath: string
): Promise<RolldownOptions[]> {
  // Prefer the workspace's rolldown so the config loads with the version that
  // will run it.
  let configModulePath: string;
  try {
    configModulePath = require.resolve('rolldown/config', {
      paths: [dirname(absoluteConfigPath)],
    });
  } catch {
    configModulePath = require.resolve('rolldown/config');
  }
  const { loadConfig } = (await import(
    pathToFileURL(configModulePath).href
  )) as typeof import('rolldown/config');

  // rolldown imports JS configs without cache busting, so a long-lived plugin
  // worker would keep returning the first version of an edited config.
  const configExport = /\.[cm]?js$/.test(absoluteConfigPath)
    ? await importFresh(absoluteConfigPath)
    : await loadConfig(absoluteConfigPath);
  const configs =
    typeof configExport === 'function' ? await configExport({}) : configExport;
  return Array.isArray(configs) ? configs : [configs];
}

async function importFresh(absolutePath: string): Promise<ConfigExport> {
  delete require.cache[absolutePath];
  return (
    await import(
      `${pathToFileURL(absolutePath).href}?nx-rolldown=${Date.now()}`
    )
  ).default;
}

function getOutputs(
  configs: RolldownOptions[],
  workspaceRoot: string,
  projectRoot: string
): string[] {
  const outputs = new Set<string>();
  for (const config of configs) {
    const outputOptions: OutputOptions[] = Array.isArray(config.output)
      ? config.output
      : [config.output ?? {}];
    for (const output of outputOptions) {
      // A single-file output is the file (plus sourcemap), not its directory,
      // which may hold sources.
      const paths = output.file
        ? [output.file, `${output.file}.map`]
        : [output.dir ?? 'dist'];
      for (const path of paths) {
        const workspaceRelative = isAbsolute(path)
          ? relative(workspaceRoot, path)
          : join(projectRoot, path);
        outputs.add(
          joinPathFragments('{workspaceRoot}', normalizePath(workspaceRelative))
        );
      }
    }
  }
  return Array.from(outputs);
}

function isProjectRoot(workspaceRoot: string, projectRoot: string): boolean {
  const absoluteRoot = join(workspaceRoot, projectRoot);
  return (
    existsSync(join(absoluteRoot, 'package.json')) ||
    existsSync(join(absoluteRoot, 'project.json'))
  );
}

function normalizeOptions(
  options: RolldownPluginOptions | undefined
): Required<RolldownPluginOptions> {
  return {
    buildTargetName: options?.buildTargetName ?? 'build',
  };
}
