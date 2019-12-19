import { offsetFromRoot, readWorkspaceJson } from '@nrwl/workspace';
import { appRootPath } from '@nrwl/workspace/src/utils/app-root';
import next from 'next';
import * as path from 'path';
import TsConfigPathsPlugin from 'tsconfig-paths-webpack-plugin';
import { NextBuildBuilderOptions } from './src/builders/dev-server/dev-server.impl';

type NextServer = ReturnType<typeof next>;

/**
 * If a `customServerTarget` is specified, it's assumed to export a `StartServerFn` function.
 * Nx will call this function when dev-server command is run. This function should call
 * `nextApp.prepare()`, and then start an HTTP server on the given `settings.port`.
 */
export type StartServerFn = (
  nextApp: NextServer,
  settings: NextBuildBuilderOptions
) => Promise<void>;

/**
 * A Next.js configuration enhancer which must be used to ensure Next.js output is written to
 * the correct directory, and to ensure TypeScript sources are compiled when imported from other
 * packages in the workspace.
 *
 * @example
 *   // myapp/next.config.js
 *   const { withNx } = require('@nrwl/next');
 *   module.exports = withNx('myapp')({});
 */
const withNx = (projectName: string) => (nextConfig: any = {}) => {
  const projects = readWorkspaceJson().projects;
  const thisProject = projects[projectName];

  const distDir = path.join(
    offsetFromRoot(thisProject.root),
    thisProject.architect.build.options.outputPath
  );

  return {
    ...nextConfig,
    distDir,
    webpack: (config, options) => {
      config.resolve.plugins = [
        new TsConfigPathsPlugin({
          configFile: path.resolve(appRootPath, 'tsconfig.json'),
          extensions: config.resolve.extensions,
          mainFields: config.resolve.mainFields
        })
      ];
      const projectsSourceRoots = Object.values(projects).map((project: any) =>
        path.join(appRootPath, project.sourceRoot)
      );
      config.module.rules.push({
        test: /\.(tsx|ts)$/,
        include: projectsSourceRoots,
        use: [options.defaultLoaders.babel]
      });
      if (typeof nextConfig.webpack === 'function') {
        return nextConfig.webpack(config, options);
      }
      return config;
    }
  };
};

export { withNx };
