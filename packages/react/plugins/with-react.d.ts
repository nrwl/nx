import type { Configuration } from 'webpack';
import type { NxWebpackExecutionContext, WithWebOptions } from '@nx/webpack';
export interface WithReactOptions extends WithWebOptions {}
/**
 * @param {WithReactOptions} pluginOptions
 * @returns {NxWebpackPlugin}
 */
export declare function withReact(
  pluginOptions?: WithReactOptions
): (config: Configuration, context: NxWebpackExecutionContext) => Configuration;
//# sourceMappingURL=with-react.d.ts.map
