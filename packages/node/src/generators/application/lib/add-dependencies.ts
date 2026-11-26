import {
  addDependenciesToPackageJson,
  detectPackageManager,
  GeneratorCallback,
  Tree,
} from '@nx/devkit';
import { acknowledgeBuildScripts } from '@nx/devkit/internal';
import { esbuildVersion } from '@nx/js/internal';
import {
  expressVersions,
  fastifyVersions,
  koaVersions,
  nodeTypesVersions,
  nxVersion,
  tslibVersion,
  tsxVersion,
} from '../../../utils/versions';
import type { NodeJsFrameWorks } from '../schema';
import { NormalizedSchema } from './normalized-schema';

export function addProjectDependencies(
  tree: Tree,
  options: NormalizedSchema
): {
  installTask: GeneratorCallback;
  frameworkDependencies: Record<string, string> | undefined;
} {
  const bundlers: Partial<
    Record<NormalizedSchema['bundler'], Record<string, string>>
  > = {
    webpack: {
      '@nx/webpack': nxVersion,
    },
    esbuild: {
      '@nx/esbuild': nxVersion,
      esbuild: esbuildVersion,
    },
  };

  const exprPkgVersions = expressVersions(tree);
  const koaPkgVersions = koaVersions(tree);
  const fastifyPkgVersions = fastifyVersions(tree);

  const frameworkDependencies: Partial<
    Record<NodeJsFrameWorks, Record<string, string>>
  > = {
    express: {
      express: exprPkgVersions.expressVersion,
    },
    koa: {
      koa: koaPkgVersions.koaVersion,
    },
    fastify: {
      fastify: fastifyPkgVersions.fastifyVersion,
      'fastify-plugin': fastifyPkgVersions.fastifyPluginVersion,
      '@fastify/autoload': fastifyPkgVersions.fastifyAutoloadVersion,
      '@fastify/sensible': fastifyPkgVersions.fastifySensibleVersion,
    },
  };
  const frameworkDevDependencies: Partial<
    Record<NodeJsFrameWorks, Record<string, string>>
  > = {
    express: {
      '@types/express': exprPkgVersions.expressTypingsVersion,
    },
    koa: {
      '@types/koa': koaPkgVersions.koaTypingsVersion,
    },
    fastify: {},
  };

  if (options.bundler === 'esbuild') {
    // esbuild's install script only validates the prebuilt binary that ships as
    // an optional dependency.
    acknowledgeBuildScripts(tree, detectPackageManager(tree.root), {
      esbuild: false,
    });
  }

  const typesNodeVersion = nodeTypesVersions(tree).typesNodeVersion;
  const frameworkDeps =
    options.framework && frameworkDependencies[options.framework];
  const frameworkDevDeps =
    options.framework && frameworkDevDependencies[options.framework];

  return {
    installTask: addDependenciesToPackageJson(
      tree,
      {
        ...frameworkDeps,
        tslib: tslibVersion,
      },
      {
        ...frameworkDevDeps,
        ...bundlers[options.bundler],
        '@types/node': typesNodeVersion,
        ...(options.serveRuntime === 'tsx' && { tsx: tsxVersion }),
      },
      undefined,
      options.keepExistingVersions ?? true
    ),
    frameworkDependencies: frameworkDeps,
  };
}
