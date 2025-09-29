import { join, basename, dirname, parse } from 'node:path';
import {
  CreateNodes,
  CreateNodesContext,
  createNodesFromFiles,
  CreateNodesV2,
  CreateDependencies,
  DependencyType,
  logger,
  RawProjectGraphDependency,
} from '@nx/devkit';
import { calculateHashesForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { hashObject } from 'nx/src/hasher/file-hasher';

// Import utilities
import {
  readTargetsCache,
  writeTargetsToCache,
  DotNetTargets,
} from '../utils/cache';
import { NativeDotNetClient } from '../utils/dotnet-cli';
import { inferProjectName } from '../utils/dotnet-project-parser';
import { buildDotNetTargets, NormalizedOptions } from '../utils/target-builder';
import {
  createProjectRootMappings,
  resolveReferenceToProject,
} from '../utils/dependency-detection';

export interface DotNetPluginOptions {
  buildTargetName?: string;
  testTargetName?: string;
  cleanTargetName?: string;
  restoreTargetName?: string;
  publishTargetName?: string;
  packTargetName?: string;
}

const dotnetProjectGlob = '**/*.{csproj,fsproj,vbproj}';

export const createNodesV2: CreateNodesV2<DotNetPluginOptions> = [
  dotnetProjectGlob,
  async (configFilePaths, options, context) => {
    const optionsHash = hashObject(options);
    const cachePath = join(
      workspaceDataDirectory,
      `dotnet-${optionsHash}.hash`
    );
    const targetsCache = readTargetsCache(cachePath);
    const normalizedOptions = normalizeOptions(options);

    // Group project files by their project root
    const projectRootToFiles = new Map<string, string[]>();
    for (const configFile of configFilePaths) {
      const projectRoot = dirname(configFile);
      if (!projectRootToFiles.has(projectRoot)) {
        projectRootToFiles.set(projectRoot, []);
      }
      projectRootToFiles.get(projectRoot)!.push(configFile);
    }

    const projectRoots = Array.from(projectRootToFiles.keys());

    // Calculate all hashes at once
    const hashes = await calculateHashesForCreateNodes(
      projectRoots,
      normalizedOptions,
      context
    );

    try {
      return await createNodesFromFiles(
        (projectRoot, options, context, idx) =>
          createNodesInternal(
            projectRoot,
            options,
            context,
            targetsCache,
            projectRootToFiles.get(projectRoot)!,
            hashes[idx]
          ),
        projectRoots,
        options,
        context
      );
    } finally {
      writeTargetsToCache(cachePath, targetsCache);
    }
  },
];

// Deprecated createNodes export for backward compatibility
export const createNodes: CreateNodes<DotNetPluginOptions> = [
  dotnetProjectGlob,
  async (configFilePath, options, context) => {
    logger.warn(
      '`createNodes` is deprecated. Please update your plugin to use `createNodesV2` instead.'
    );
    const projectRoot = dirname(configFilePath);
    const projectFiles = [configFilePath];

    const normalizedOptions = normalizeOptions(options);
    const optionsHash = hashObject(options);
    const cachePath = join(
      workspaceDataDirectory,
      `dotnet-${optionsHash}.hash`
    );
    const targetsCache = readTargetsCache(cachePath);

    const hash = await calculateHashesForCreateNodes(
      [projectRoot],
      normalizedOptions,
      context
    );

    try {
      return await createNodesInternal(
        projectRoot,
        options,
        context,
        targetsCache,
        projectFiles,
        hash[0]
      );
    } finally {
      writeTargetsToCache(cachePath, targetsCache);
    }
  },
];

async function createNodesInternal(
  projectRoot: string,
  options: DotNetPluginOptions,
  context: CreateNodesContext,
  targetsCache: Record<string, DotNetTargets>,
  projectFiles: string[],
  hash: string
) {
  // For .NET projects, we don't require package.json or project.json
  // The .csproj/.fsproj/.vbproj file itself indicates a valid project

  const normalizedOptions = normalizeOptions(options);

  targetsCache[hash] ??= await buildDotNetTargets(
    projectRoot,
    projectFiles,
    normalizedOptions,
    context
  );
  const { targets, metadata } = targetsCache[hash];

  // For project naming, use the directory name when multiple projects,
  // or the single project file name when only one
  const projectName =
    projectFiles.length === 1
      ? inferProjectName(projectFiles[0])
      : basename(projectRoot)
          .replace(/[^a-z0-9\-]/gi, '-')
          .toLowerCase();

  return {
    projects: {
      [projectRoot]: {
        name: projectName,
        root: projectRoot,
        targets,
        metadata,
      },
    },
  };
}

function normalizeOptions(options: DotNetPluginOptions): NormalizedOptions {
  return {
    buildTargetName: options?.buildTargetName ?? 'build',
    testTargetName: options?.testTargetName ?? 'test',
    cleanTargetName: options?.cleanTargetName ?? 'clean',
    restoreTargetName: options?.restoreTargetName ?? 'restore',
    publishTargetName: options?.publishTargetName ?? 'publish',
    packTargetName: options?.packTargetName ?? 'pack',
  };
}

export const createDependencies: CreateDependencies<
  DotNetPluginOptions
> = async (_, ctx) => {
  const dependencies: RawProjectGraphDependency[] = [];

  const rootMap = createProjectRootMappings(ctx.projects);

  // Use dotnet CLI for dependency detection
  const dotnetClient = new NativeDotNetClient(ctx.workspaceRoot);

  for (const [source] of Object.entries(ctx.projects)) {
    const files = ctx.filesToProcess.projectFileMap[source] || [];

    for (const file of files) {
      const { ext } = parse(file.file);
      if (['.csproj', '.fsproj', '.vbproj'].includes(ext)) {
        try {
          const references = await dotnetClient.getProjectReferencesAsync(
            join(ctx.workspaceRoot, file.file)
          );

          for (const reference of references) {
            const target = resolveReferenceToProject(
              reference,
              file.file,
              rootMap,
              ctx.workspaceRoot
            );
            if (target) {
              dependencies.push({
                source,
                target,
                type: DependencyType.static,
                sourceFile: file.file,
              });
            }
          }
        } catch (error) {
          logger.debug(
            `Failed to get dependencies for ${file.file}: ${error.message}`
          );
        }
      }
    }
  }

  return dependencies;
};
