import { GeneratorCallback, logger } from '@nx/devkit';
import { chmodSync, existsSync } from 'fs';
import { join } from 'path';

export function chmodAndroidGradlewFiles(androidFolder: string) {
  if (existsSync(join(androidFolder, 'gradlew'))) {
    chmodSync(join(androidFolder, 'gradlew'), 0o775);
  }
  if (existsSync(join(androidFolder, 'gradlew.bat'))) {
    chmodSync(join(androidFolder, 'gradlew.bat'), 0o775);
  }
}

export function chmodAndroidGradlewFilesTask(
  androidFolder: string
): GeneratorCallback {
  return () => {
    logger.info(`chmod android gradlew files under ${androidFolder}`);
    try {
      chmodAndroidGradlewFiles(androidFolder);
    } catch {
      throw new Error(`chmod failed gradlew file under ${androidFolder}`);
    }
  };
}
