import { AssetGlob } from './assets';
import { CopyAssetsHandler, FileEvent } from './copy-assets-handler';
import { ExecutorContext, isDaemonEnabled, output } from '@nx/devkit';

export interface CopyAssetsOptions {
  outputPath: string;
  assets: (string | AssetGlob)[];
  watch?: boolean | WatchMode;
  includeIgnoredAssetFiles?: boolean;
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
    includeIgnoredFiles: options.includeIgnoredAssetFiles,
  });
  const result: CopyAssetsResult = {
    success: true,
  };

  if (!isDaemonEnabled() && options.watch) {
    output.warn({
      title:
        'Nx Daemon is not enabled. Assets will not be updated when they are changed.',
    });
  }

  if (isDaemonEnabled() && options.watch) {
    result.stop = await assetHandler.watchAndProcessOnAssetChange();
  }

  try {
    await assetHandler.processAllAssetsOnce();
  } catch {
    result.success = false;
  }

  return result;
}
