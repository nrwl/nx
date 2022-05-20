import { join } from 'path';
import { SwcExecutorOptions } from '../schema';

export function getSwcrcPath(
  options: SwcExecutorOptions,
  contextRoot: string,
  projectRoot: string
) {
  return options.swcrc
    ? join(contextRoot, options.swcrc)
    : join(contextRoot, projectRoot, '.lib.swcrc');
}
