import { join, basename, dirname, parse } from 'node:path';
import {
  createNodesFromFiles,
  CreateNodesV2,
  CreateDependencies,
  DependencyType,
  logger,
  RawProjectGraphDependency,
  CreateNodesContextV2,
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
import { verboseLog, verboseError } from '../utils/logger';

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

async function createNodesInternal(
  projectRoot: string,
  options: DotNetPluginOptions,
  context: CreateNodesContextV2,
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

  verboseLog('[dotnet] createDependencies: Starting dependency detection');
  verboseLog(`[dotnet] Workspace root: ${ctx.workspaceRoot}`);
  verboseLog(
    `[dotnet] Number of projects: ${Object.keys(ctx.projects).length}`
  );
  verboseLog(`[dotnet] Projects: ${Object.keys(ctx.projects).join(', ')}`);
  verboseLog(`[dotnet] Root map entries: ${Object.keys(rootMap).length}`);
  verboseLog(`[dotnet] Root map: ${JSON.stringify(rootMap, null, 2)}`);

  // Use dotnet CLI for dependency detection
  const dotnetClient = new NativeDotNetClient(ctx.workspaceRoot);

  for (const [source] of Object.entries(ctx.projects)) {
    const files = ctx.filesToProcess.projectFileMap[source] || [];
    verboseLog(
      `[dotnet] Processing project: ${source} (${files.length} files)`
    );

    for (const file of files) {
      const { ext } = parse(file.file);
      verboseLog(`[dotnet]   File: ${file.file} (ext: ${ext})`);
      if (['.csproj', '.fsproj', '.vbproj'].includes(ext)) {
        try {
          const fullPath = join(ctx.workspaceRoot, file.file);
          verboseLog(`[dotnet]   Getting references for: ${fullPath}`);
          const references = await dotnetClient.getProjectReferencesAsync(
            fullPath
          );
          verboseLog(
            `[dotnet]   Found ${references.length} references: ${JSON.stringify(
              references
            )}`
          );

          for (const reference of references) {
            verboseLog(`[dotnet]     Resolving reference: ${reference}`);
            const target = resolveReferenceToProject(
              reference,
              file.file,
              rootMap,
              ctx.workspaceRoot
            );
            verboseLog(`[dotnet]     Resolved to target: ${target}`);
            if (target) {
              dependencies.push({
                source,
                target,
                type: DependencyType.static,
                sourceFile: file.file,
              });
              verboseLog(
                `[dotnet]     ✓ Added dependency: ${source} -> ${target}`
              );
            } else {
              verboseLog(
                `[dotnet]     ✗ Could not resolve reference to project`
              );
            }
          }
        } catch (error) {
          verboseError(
            `[dotnet] Failed to get dependencies for ${file.file}: ${error.message}`
          );
          verboseError(`[dotnet] Error stack: ${error.stack}`);
        }
      }
    }
  }

  verboseLog(
    `[dotnet] createDependencies: Completed with ${dependencies.length} dependencies`
  );
  verboseLog(
    `[dotnet] Final dependencies: ${JSON.stringify(dependencies, null, 2)}`
  );

  return dependencies;
};
