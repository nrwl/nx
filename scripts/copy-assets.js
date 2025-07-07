#!/usr/bin/env node

/**
 * Copy Assets Script
 *
 * This script uses Nx's copyasset handler functionality to copy assets
 * before the TypeScript build process. It can be run as a separate task
 * in project.json files across the workspace.
 *
 * Usage: node scripts/copy-assets.js <package-name> [options]
 *
 * Example:
 *   node scripts/copy-assets.js js
 *   node scripts/copy-assets.js js --watch
 *   node scripts/copy-assets.js js --task=build-base
 */

const {
  CopyAssetsHandler,
} = require('@nx/js/src/utils/assets/copy-assets-handler');
const {
  readJsonFile,
  workspaceRoot,
  createProjectGraphAsync,
} = require('@nx/devkit');
const path = require('path');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);
const packageName = args[0];
const isWatch = args.includes('--watch');
const taskName =
  args.find((arg) => arg.startsWith('--task='))?.split('=')[1] || 'build';

if (!packageName) {
  console.error('Error: Package name is required');
  console.error(
    'Usage: node scripts/copy-assets.js <package-name> [--watch] [--task=taskname]'
  );
  process.exit(1);
}

/**
 * Ensure the output directory exists
 */
function ensureOutputDir(outputPath) {
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
    console.log(`Created output directory: ${outputPath}`);
  }
}

/**
 * Print asset details for debugging
 */
function printAssetDetails(assets) {
  console.log('\nAsset configuration:');
  assets.forEach((asset, index) => {
    if (typeof asset === 'string') {
      console.log(`  ${index + 1}. "${asset}"`);
    } else {
      console.log(
        `  ${index + 1}. Input: "${asset.input}", Glob: "${
          asset.glob
        }", Output: "${asset.output}"`
      );
      if (asset.ignore) {
        console.log(`      Ignore: [${asset.ignore.join(', ')}]`);
      }
    }
  });
  console.log('');
}

async function main() {
  try {
    // Read the project.json file for the package
    const projectJsonPath = path.join(
      workspaceRoot,
      'packages',
      packageName,
      'project.json'
    );

    if (!fs.existsSync(projectJsonPath)) {
      console.error(`Error: Could not find project.json at ${projectJsonPath}`);
      process.exit(1);
    }

    const projectJson = readJsonFile(projectJsonPath);

    // Look for assets in the specified task or any other task that has assets
    let assets = null;
    let outputPath = null;
    let foundTaskName = null;

    // Check specified task first
    if (
      projectJson.targets?.[taskName]?.options?.assets ||
      projectJson.targets?.[taskName]?.assets
    ) {
      assets =
        projectJson.targets[taskName].options?.assets ||
        projectJson.targets[taskName].assets;
      outputPath =
        projectJson.targets[taskName].options?.outputPath ||
        projectJson.targets[taskName].outputPath;
      foundTaskName = taskName;
    }

    // If no assets in specified task, check other common tasks (build first, then build-base)
    if (!assets) {
      const commonTasks = ['build', 'build-base', 'compile'];
      for (const task of commonTasks) {
        if (
          projectJson.targets?.[task]?.options?.assets ||
          projectJson.targets?.[task]?.assets
        ) {
          console.log(`Found assets in task: ${task}`);
          assets =
            projectJson.targets[task].options?.assets ||
            projectJson.targets[task].assets;
          outputPath =
            projectJson.targets[task].options?.outputPath ||
            projectJson.targets[task].outputPath;
          foundTaskName = task;
          break;
        }
      }
    }

    // If still no assets, check all tasks
    if (!assets) {
      for (const [task, config] of Object.entries(projectJson.targets || {})) {
        if (config.options?.assets || config.assets) {
          console.log(`Found assets in task: ${task}`);
          assets = config.options?.assets || config.assets;
          outputPath = config.options?.outputPath || config.outputPath;
          foundTaskName = task;
          break;
        }
      }
    }

    if (!assets || assets.length === 0) {
      console.log(`No assets found for package: ${packageName}`);
      if (taskName !== 'build') {
        console.log(`Tried task: ${taskName}`);
      }
      console.log(
        'Available tasks with options:',
        Object.keys(projectJson.targets || {})
          .filter((t) => projectJson.targets[t].options)
          .join(', ')
      );
      return;
    }

    // Default output path if not specified - read from tsconfig.lib.json outDir
    if (!outputPath) {
      try {
        const tsconfigLibPath = path.join(
          workspaceRoot,
          'packages',
          packageName,
          'tsconfig.lib.json'
        );
        if (fs.existsSync(tsconfigLibPath)) {
          const tsconfigLib = readJsonFile(tsconfigLibPath);
          const outDir = tsconfigLib.compilerOptions?.outDir;
          if (outDir) {
            // outDir in tsconfig is relative to the tsconfig file location
            outputPath = path.resolve(
              path.join(workspaceRoot, 'packages', packageName),
              outDir
            );
            console.log(`Using outDir from tsconfig.lib.json: ${outDir}`);
          } else {
            outputPath = path.join(
              workspaceRoot,
              'dist',
              'packages',
              packageName
            );
          }
        } else {
          outputPath = path.join(
            workspaceRoot,
            'dist',
            'packages',
            packageName
          );
        }
      } catch (error) {
        console.warn(
          `Could not read tsconfig.lib.json, using default: ${error.message}`
        );
        outputPath = path.join(workspaceRoot, 'dist', 'packages', packageName);
      }
    }

    // Make output path absolute if it's relative
    if (!path.isAbsolute(outputPath)) {
      outputPath = path.join(workspaceRoot, outputPath);
    }

    console.log(`Copying assets for package: ${packageName}`);
    console.log(`Source task: ${foundTaskName}`);
    console.log(`Output directory: ${outputPath}`);
    console.log(`Assets to copy: ${assets.length} entries`);

    if (isWatch) {
      console.log('Watch mode enabled - will monitor for file changes...');
    }

    // Print asset details for debugging
    printAssetDetails(assets);

    // Ensure output directory exists
    ensureOutputDir(outputPath);

    // Copy the assets using Nx's CopyAssetsHandler (mimicking tsc executor behavior)
    const projectDir = path.join(workspaceRoot, 'packages', packageName);
    console.log(`Project root: ${projectDir}`);

    const assetHandler = new CopyAssetsHandler({
      projectDir: projectDir,
      rootDir: workspaceRoot,
      outputDir: outputPath,
      assets: assets,
    });

    try {
      // Process all assets once (like the tsc executor does)
      await assetHandler.processAllAssetsOnce();
      console.log('Successfully copied all assets');

      if (isWatch) {
        console.log('Watching for asset changes. Press Ctrl+C to stop.');

        // Start watching for changes (mimicking tsc executor watch setup)
        const disposeWatchAssetChanges =
          await assetHandler.watchAndProcessOnAssetChange();

        // Setup termination handlers like the tsc executor
        const handleTermination = async (exitCode) => {
          console.log('\nStopping asset watcher...');
          disposeWatchAssetChanges();
          process.exit(exitCode);
        };

        process.on('SIGINT', () => handleTermination(128 + 2));
        process.on('SIGTERM', () => handleTermination(128 + 15));

        // Keep the process alive
        return new Promise(() => {}); // Never resolves, keeps process alive
      }
    } catch (error) {
      console.error('Error processing assets:', error.message);
      process.exit(1);
    }
  } catch (error) {
    console.error('Error copying assets:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
  process.exit(1);
});

main();
