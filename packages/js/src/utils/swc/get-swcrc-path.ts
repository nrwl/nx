import { join } from 'path';
import { SwcExecutorOptions } from '../schema';

export function getSwcrcPath(
  options: SwcExecutorOptions,
  contextRoot: string,
  projectRoot: string,
  temp = false
) {
  let swcrcPath = options.swcrc ?? join(projectRoot, '.swcrc');

  if (temp) {
    swcrcPath = join('tmp', swcrcPath.replace('.swcrc', '.generated.swcrc'));
  }

  return join(contextRoot, swcrcPath);
}
