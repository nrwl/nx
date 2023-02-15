import { Configuration } from '@rspack/core';
import { ModuleRule } from '@rspack/core/dist/config/module';
import * as path from 'path';
import { SharedConfigContext } from './model';

export interface WithWebOptions {
  style?: 'css' | 'scss' | 'less';
}

export function withWeb(opts: WithWebOptions = {}) {
  return function makeConfig(
    config: Configuration,
    { options, context }: SharedConfigContext
  ): Configuration {
    const isProd = process.env.NODE_ENV === 'production';

    const projectRoot = path.join(
      context.root,
      context.projectGraph.nodes[context.projectName].data.root
    );

    return {
      ...config,
      module: {
        ...config.module,
        rules: [
          ...(config.module.rules || []),
          {
            test: /\.css$/,
            type: 'css/module' as any,
          },
          // TODO(jack): uncomment once supported.
          // {
          //   test: /\.s[ac]ss$/,
          //   use: [{ builtinLoader: 'builtin:sass-loader' }],
          //   type: 'css',
          // },
          opts.style === 'less' && {
            test: /.less$/,
            use: [{ loader: require('@rspack/less-loader') }],
            type: 'css',
          },
        ].filter((a): a is ModuleRule => !!a),
      },
      builtins: {
        ...config.builtins,
        html: [
          ...(config.builtins.html || []),
          {
            template: options.indexHtml
              ? path.join(context.root, options.indexHtml)
              : path.join(projectRoot, 'src/index.html'),
          },
        ],
        define: {
          ...config.builtins.define,
          'process.env.NODE_ENV': isProd ? "'production'" : "'development'",
        },
      },
    };
  };
}
