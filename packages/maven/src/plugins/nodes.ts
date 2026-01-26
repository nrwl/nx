import { CreateNodesResultV2, CreateNodesV2, hashArray } from '@nx/devkit';
import { dirname, relative } from 'path';
import { DEFAULT_OPTIONS, MavenPluginOptions } from './types';
import { runMavenAnalysis } from './maven-analyzer';
import {
  getCachePath,
  readMavenCache,
  writeMavenCache,
} from './maven-data-cache';
import { calculateHashesForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { hashObject } from 'nx/src/devkit-internals';

/**
 * Maven plugin that analyzes Maven projects and returns configurations
 */
export const createNodes: CreateNodesV2<MavenPluginOptions> = [
  '**/pom.xml',
  async (configFiles, options, context): Promise<CreateNodesResultV2> => {
    const opts: MavenPluginOptions = {
      ...DEFAULT_OPTIONS,
      ...options,
    };

    // Check for verbose logging from multiple sources
    const isVerbose = opts.verbose || process.env.NX_VERBOSE_LOGGING === 'true';

    if (isVerbose) {
      console.error(
        `Maven plugin running in verbose mode (NX_VERBOSE_LOGGING=${process.env.NX_VERBOSE_LOGGING})`
      );
    }

    // Only process if we have the root pom.xml in the workspace root
    const rootPomExists = configFiles.some((file) => file === 'pom.xml');
    if (!rootPomExists) {
      return [];
    }

    // Get cache path based on options
    const optionsHash = hashObject(opts);
    const cachePath = getCachePath(context.workspaceRoot, optionsHash);
    const mavenCache = readMavenCache(cachePath);

    // Calculate hashes for all pom.xml directories
    const projectRoots = configFiles.map((file) => dirname(file));
    const hashes = await calculateHashesForCreateNodes(
      projectRoots,
      opts,
      context
    );
    // Combine all hashes into a single hash for the cache key
    const hash = hashArray(hashes);

    try {
      // Try to get cached data first (skip cache if in verbose mode)
      let mavenData = isVerbose ? null : mavenCache[hash];

      // If no cached data or cache is stale, run fresh Maven analysis
      if (!mavenData) {
        mavenData = await runMavenAnalysis(context.workspaceRoot, {
          ...opts,
          verbose: isVerbose,
        });
        // Cache the results with the hash
        mavenCache[hash] = mavenData;
      }

      // Return createNodesResults (atomization now handled in Kotlin)
      return mavenData.createNodesResults.map(
        ([configFile, createNodesResult]) => {
          return [
            relative(context.workspaceRoot, configFile),
            createNodesResult,
          ];
        }
      );
    } finally {
      writeMavenCache(cachePath, mavenCache);
    }
  },
];
