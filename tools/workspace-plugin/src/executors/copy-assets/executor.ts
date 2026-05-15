import { ExecutorContext, logger, workspaceRoot } from '@nx/devkit';
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
        includeIgnoredFiles?: boolean;
      }
  >;
  outputPath: string;
}

export async function copyAssetsExecutor(
  options: CopyAssetsExecutorOptions,
  context: ExecutorContext
): Promise<{ success: boolean }> {
  const projectName = context.projectName;
  const projectRoot =
    context.projectsConfigurations?.projects[projectName]?.root || projectName;

  let outputPath = options.outputPath;

  // Resolve output path relative to project root
  if (!path.isAbsolute(outputPath)) {
    outputPath = path.resolve(
      workspaceRoot,
      projectRoot,
      outputPath.startsWith(projectRoot)
        ? path.relative(projectRoot, outputPath)
        : outputPath
    );
  }

  // Ensure output directory exists
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }

  const projectDir = path.join(workspaceRoot, projectRoot);

  const assetHandler = new CopyAssetsHandler({
    projectDir,
    rootDir: workspaceRoot,
    outputDir: outputPath,
    assets: options.assets,
  });

  try {
    await assetHandler.processAllAssetsOnce();
  } catch (error) {
    logger.error(
      `Error processing assets: ${error instanceof Error ? error.message : error}`
    );
    return { success: false };
  }

  logger.info(`✓ Assets copied for ${projectName}`);
  return { success: true };
}

export default copyAssetsExecutor;
