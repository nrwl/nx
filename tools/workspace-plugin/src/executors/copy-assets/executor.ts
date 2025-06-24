import {
  ExecutorContext,
  logger,
  workspaceRoot,
  readJsonFile,
  createProjectGraphAsync,
} from '@nx/devkit';
import { CopyAssetsHandler } from '@nx/js/src/utils/assets/copy-assets-handler';
import * as path from 'path';
import * as fs from 'fs';

export interface CopyAssetsExecutorOptions {
  assets: Array<
    | string
    | {
        input: string;
        glob: string;
        output: string;
        ignore?: string[];
      }
  >;
  outputPath?: string;
  tsConfig?: string;
  watch?: boolean;
}

/**
 * Ensure the output directory exists
 */
function ensureOutputDir(outputPath: string) {
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
    logger.info(`Created output directory: ${outputPath}`);
  }
}

/**
 * Print asset details for debugging
 */
function printAssetDetails(assets: CopyAssetsExecutorOptions['assets']) {
  logger.info('Asset configuration:');
  assets.forEach((asset, index) => {
    if (typeof asset === 'string') {
      logger.info(`  ${index + 1}. "${asset}"`);
    } else {
      logger.info(
        `  ${index + 1}. Input: "${asset.input}", Glob: "${
          asset.glob
        }", Output: "${asset.output}"`
      );
      if (asset.ignore) {
        logger.info(`      Ignore: [${asset.ignore.join(', ')}]`);
      }
    }
  });
}

/**
 * Get output path from TypeScript config
 */
function getOutputPathFromTsConfig(tsConfigPath: string): string | null {
  try {
    const tsConfig = readJsonFile(tsConfigPath);
    const outDir = tsConfig.compilerOptions?.outDir;
    if (outDir) {
      // outDir in tsconfig is relative to the tsconfig file location
      const tsConfigDir = path.dirname(tsConfigPath);
      return path.resolve(tsConfigDir, outDir);
    }
  } catch (error) {
    logger.warn(`Could not read TypeScript config: ${error.message}`);
  }
  return null;
}

export async function copyAssetsExecutor(
  options: CopyAssetsExecutorOptions,
  context: ExecutorContext
): Promise<{ success: boolean }> {
  // Ensure project graph is created before proceeding
  // This is needed for CopyAssetsHandler which uses daemon client in watch mode
  try {
    await createProjectGraphAsync();
  } catch (error) {
    logger.error(`Failed to create project graph: ${error.message || error}`);
    throw error;
  }

  const projectName = context.projectName;
  const projectRoot = context.projectGraph.nodes[projectName].data.root;

  if (!options.assets || options.assets.length === 0) {
    logger.info(`No assets to copy for project: ${projectName}`);
    return { success: true };
  }

  // Determine output path
  let outputPath = options.outputPath;

  if (!outputPath && options.tsConfig) {
    // Try to get output path from tsConfig
    const tsConfigPath = path.isAbsolute(options.tsConfig)
      ? options.tsConfig
      : path.join(workspaceRoot, projectRoot, options.tsConfig);

    outputPath = getOutputPathFromTsConfig(tsConfigPath);

    if (outputPath) {
      logger.info(`Using output path from TypeScript config: ${outputPath}`);
    }
  }

  if (!outputPath) {
    logger.error(`No output path could be determined. Please provide either:
  1. An explicit 'outputPath' option (relative to project root)
  2. A 'tsConfig' option pointing to a TypeScript config file with compilerOptions.outDir
  
Example configuration:
  "copy-assets": {
    "executor": "@nx/workspace-plugin:copy-assets",
    "options": {
      "assets": [...],
      "outputPath": "../../dist/packages/${projectName}"
    }
  }
  
Or with TypeScript config:
  "copy-assets": {
    "executor": "@nx/workspace-plugin:copy-assets", 
    "options": {
      "assets": [...],
      "tsConfig": "tsconfig.lib.json"
    }
  }`);
    return { success: false };
  }

  // Output path is relative to project root, so resolve it
  if (!path.isAbsolute(outputPath)) {
    outputPath = path.resolve(workspaceRoot, projectRoot, outputPath);
  }

  logger.info(`Copying assets for project: ${projectName}`);
  logger.info(`Output directory: ${outputPath}`);
  logger.info(`Assets to copy: ${options.assets.length} entries`);

  if (options.watch) {
    logger.info('Watch mode enabled - will monitor for file changes...');
  }

  // Print asset details for debugging
  printAssetDetails(options.assets);

  // Ensure output directory exists
  ensureOutputDir(outputPath);

  // Copy the assets using Nx's CopyAssetsHandler
  const projectDir = path.join(workspaceRoot, projectRoot);
  logger.info(`Project root: ${projectDir}`);

  const assetHandler = new CopyAssetsHandler({
    projectDir: projectDir,
    rootDir: workspaceRoot,
    outputDir: outputPath,
    assets: options.assets,
  });

  try {
    // Process all assets once
    await assetHandler.processAllAssetsOnce();
    logger.info('Successfully copied all assets');

    if (options.watch) {
      logger.info('Watching for asset changes. Press Ctrl+C to stop.');

      // Start watching for changes
      const disposeWatchAssetChanges =
        await assetHandler.watchAndProcessOnAssetChange();

      // Setup termination handlers
      const handleTermination = async (exitCode: number) => {
        logger.info('Stopping asset watcher...');
        disposeWatchAssetChanges();
        process.exit(exitCode);
      };

      process.on('SIGINT', () => handleTermination(128 + 2));
      process.on('SIGTERM', () => handleTermination(128 + 15));

      // Keep the process alive
      return new Promise(() => {}); // Never resolves, keeps process alive
    }

    return { success: true };
  } catch (error) {
    logger.error(`Error processing assets: ${error.message || error}`);
    return { success: false };
  }
}

export default copyAssetsExecutor;
