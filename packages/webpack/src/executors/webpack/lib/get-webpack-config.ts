import type { Configuration } from 'webpack';
import { ExecutorContext } from '@nrwl/devkit';

import { NormalizedWebpackExecutorOptions } from '../schema';
import { withNx } from '../../../utils/with-nx';
import { withWeb } from '../../../utils/with-web';
import { composePlugins } from '@nrwl/webpack';

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
    options.target === 'node' ? withNx() : composePlugins(withNx(), withWeb());
  return configure(config, { options, context });
}
