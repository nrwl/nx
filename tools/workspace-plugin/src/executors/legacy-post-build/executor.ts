import {
  ExecutorContext,
  logger,
  workspaceRoot,
  readJsonFile,
} from '@nx/devkit';
import { CopyAssetsHandler } from '@nx/js/src/utils/assets/copy-assets-handler';
import * as path from 'path';
import * as fs from 'fs';
import {
  readJsonFile as readJson,
  writeJsonFile,
} from 'nx/src/utils/fileutils';

export interface LegacyPostBuildExecutorOptions {
  // Asset copying options
  assets?: Array<
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

  // Package.json field options
  packageRoot?: string;
  addPackageJsonFields?: boolean;
  main?: string;
  types?: string;
}

/**
 * Ensure the output directory exists
 */
function ensureOutputDir(outputPath: string) {
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }
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

/**
 * Convert .ts extension to .js for compiled output references
 */
function convertTsToJs(filePath: string): string {
  if (filePath.endsWith('.ts')) {
    return filePath.replace(/\.ts$/, '.js');
  }
  return filePath;
}

/**
 * Add required package.json fields
 */
async function addPackageJsonFields(
  packageRoot: string,
  workspaceRoot: string,
  customMain?: string,
  customTypes?: string
): Promise<boolean> {
  const pkgPath = path.join(workspaceRoot, packageRoot, 'package.json');

  if (!fs.existsSync(pkgPath)) {
    return true;
  }

  const packageJson = readJson(pkgPath);
  let hasChanges = false;

  if (customMain) {
    packageJson.main = customMain;
    hasChanges = true;
  } else if (!packageJson.main) {
    packageJson.main = 'index.js';
    hasChanges = true;
  }

  if (customTypes) {
    packageJson.types = customTypes;
    hasChanges = true;
  } else if (!packageJson.types) {
    if (packageJson.typings) {
      packageJson.types = packageJson.typings;
      hasChanges = true;
    } else {
      packageJson.types = './src/index.d.ts';
      hasChanges = true;
    }
  }

  if (!packageJson.type) {
    packageJson.type = 'commonjs';
    hasChanges = true;
  }

  if (hasChanges) {
    writeJsonFile(pkgPath, packageJson);
  }

  return true;
}

export async function legacyPostBuildExecutor(
  options: LegacyPostBuildExecutorOptions,
  context: ExecutorContext
): Promise<{ success: boolean }> {
  const projectName = context.projectName;
  const projectRoot = context.projectGraph.nodes[projectName].data.root;

  // Step 1: Copy assets if specified
  if (options.assets && options.assets.length > 0) {
    // Determine output path
    let outputPath = options.outputPath;

    if (!outputPath && options.tsConfig) {
      // Try to get output path from tsConfig
      const tsConfigPath = path.isAbsolute(options.tsConfig)
        ? options.tsConfig
        : path.join(workspaceRoot, projectRoot, options.tsConfig);

      outputPath = getOutputPathFromTsConfig(tsConfigPath);
    }

    if (!outputPath) {
      logger.error(`No output path could be determined. Please provide either:
  1. An explicit 'outputPath' option (relative to project root)
  2. A 'tsConfig' option pointing to a TypeScript config file with compilerOptions.outDir
  
Example configuration:
  "legacy-post-build": {
    "executor": "@nx/workspace-plugin:legacy-post-build",
    "options": {
      "assets": [...],
      "outputPath": "../../dist/packages/${projectName}"
    }
  }
  
Or with TypeScript config:
  "legacy-post-build": {
    "executor": "@nx/workspace-plugin:legacy-post-build", 
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

    // Ensure output directory exists
    ensureOutputDir(outputPath);

    // Copy the assets using Nx's CopyAssetsHandler
    const projectDir = path.join(workspaceRoot, projectRoot);

    const assetHandler = new CopyAssetsHandler({
      projectDir: projectDir,
      rootDir: workspaceRoot,
      outputDir: outputPath,
      assets: options.assets,
    });

    try {
      // Process all assets once
      await assetHandler.processAllAssetsOnce();
    } catch (error) {
      logger.error(`Error processing assets: ${error.message || error}`);
      return { success: false };
    }
  }

  // Step 2: Add package.json fields if enabled (default is true)
  if (options.addPackageJsonFields !== false) {
    const packageRoot = options.packageRoot || `dist/packages/${projectName}`;
    const success = await addPackageJsonFields(
      packageRoot,
      context.root,
      options.main,
      options.types
    );
    if (!success) {
      return { success: false };
    }
  }

  logger.info(`✓ Legacy post-build completed for ${projectName}`);
  return { success: true };
}

export default legacyPostBuildExecutor;
