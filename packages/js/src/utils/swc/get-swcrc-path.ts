import { join } from 'path';
import { SwcExecutorOptions } from '../schema';

export function getSwcrcPath(
  options: SwcExecutorOptions,
  contextRoot: string,
  projectRoot: string
) {
  const swcrcPath = options.swcrc
    ? join(contextRoot, options.swcrc)
    : join(contextRoot, projectRoot, '.swcrc');

  const tmpSwcrcPath = join(
    contextRoot,
    projectRoot,
    'tmp',
    '.generated.swcrc'
  );

  return {
    swcrcPath,
    tmpSwcrcPath,
  };
}
