import { ensureNodeModulesSymlink } from './ensure-node-modules-symlink';
import * as chalk from 'chalk';
import { GeneratorCallback, logger } from '@nrwl/devkit';

export function runSymlink(
  worksapceRoot: string,
  projectRoot: string
): GeneratorCallback {
  return () => {
    logger.info(`creating symlinks for ${chalk.bold(projectRoot)}`);
    try {
      ensureNodeModulesSymlink(worksapceRoot, projectRoot);
    } catch {
      throw new Error(
        `Failed to create symlinks for ${chalk.bold(projectRoot)}`
      );
    }
  };
}
