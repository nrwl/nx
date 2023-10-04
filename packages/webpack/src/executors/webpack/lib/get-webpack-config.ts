import type { Configuration } from 'webpack';
import { ExecutorContext } from '@nx/devkit';

import { NormalizedWebpackExecutorOptions } from '../schema';
import { withNx } from '../../../utils/with-nx';
import { withWeb } from '../../../utils/with-web';
import { composePluginsSync } from '../../../utils/config';

interface GetWebpackConfigOverrides {
  root: string;
  sourceRoot: string;
  configuration?: string;
}

/** @deprecated Use withNx, withWeb, or withReact */
// TODO(jack): Remove in Nx 16
export function getWebpackConfig(
  context: ExecutorContext,
  options: NormalizedWebpackExecutorOptions
): Configuration {
  const config: Configuration = {};
  const configure =
    options.target === 'web'
      ? composePluginsSync(withNx(), withWeb())
      : withNx();
  return configure(config, { options, context });
}
