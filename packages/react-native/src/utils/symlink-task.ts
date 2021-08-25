import { ensureNodeModulesSymlink } from './ensure-node-modules-symlink';
import * as chalk from 'chalk';
import { appRootPath } from '@nrwl/workspace/src/utils/app-root';
import { GeneratorCallback, logger } from '@nrwl/devkit';

export function runSymlink(projectRoot: string): GeneratorCallback {
  return () => {
    logger.info(`creating symlinks for ${chalk.bold(projectRoot)}`);
    try {
      ensureNodeModulesSymlink(appRootPath, projectRoot);
    } catch {
      throw new Error(
        `Failed to create symlinks for ${chalk.bold(projectRoot)}`
      );
    }
  };
}
