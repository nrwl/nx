import { chmodSync } from 'fs';
import { GeneratorCallback, logger } from '@nrwl/devkit';

export function runChmod(
  file: string,
  mode: number | string
): GeneratorCallback {
  return () => {
    logger.info(`chmod ${mode} ${file}`);
    try {
      chmodSync(file, mode);
    } catch {
      throw new Error(`chmod failed for ${file}`);
    }
  };
}
