import { ensureNodeModulesSymlink } from './ensure-node-modules-symlink';
import * as chalk from 'chalk';
import { GeneratorCallback, logger } from '@nx/devkit';

export function runSymlink(
  workspaceRoot: string,
  projectRoot: string
): GeneratorCallback {
  return () => {
    logger.info(`creating symlinks for ${chalk.bold(projectRoot)}`);
    try {
      ensureNodeModulesSymlink(workspaceRoot, projectRoot);
    } catch {
      throw new Error(
        `Failed to create symlinks for ${chalk.bold(projectRoot)}`
      );
    }
  };
}
