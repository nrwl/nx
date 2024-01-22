import { AssetGlob } from './assets';
import { CopyAssetsHandler, FileEvent } from './copy-assets-handler';
import { ExecutorContext } from '@nx/devkit';

export interface CopyAssetsOptions {
  outputPath: string;
  assets: (string | AssetGlob)[];
  watch?: boolean | WatchMode;
}

export interface CopyAssetsResult {
  success?: boolean;
  // Only when "watch: true"
  stop?: () => void;
}

export interface WatchMode {
  onCopy?: (events: FileEvent[]) => void;
}

export async function copyAssets(
  options: CopyAssetsOptions,
  context: ExecutorContext
): Promise<CopyAssetsResult> {
  const assetHandler = new CopyAssetsHandler({
    projectDir:
      context.projectsConfigurations.projects[context.projectName].root,
    rootDir: context.root,
    outputDir: options.outputPath,
    assets: options.assets,
    callback:
      typeof options?.watch === 'object' ? options.watch.onCopy : undefined,
  });
  const result: CopyAssetsResult = {
    success: true,
  };

  if (options.watch) {
    result.stop = await assetHandler.watchAndProcessOnAssetChange();
  }

  try {
    await assetHandler.processAllAssetsOnce();
  } catch {
    result.success = false;
  }

  return result;
}
