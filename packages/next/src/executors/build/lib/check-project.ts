import { logger } from '@nx/devkit';
import { readdirSync } from 'node:fs';
import { join } from 'path';

export function checkPublicDirectory(root: string) {
  if (readdirSync(join(root, 'public')).length === 0) {
    logger.warn(
      'public directory cannot be empty. This may result in errors during the deployment. Consider adding a public/.gitkeep file'
    );
  }
}
