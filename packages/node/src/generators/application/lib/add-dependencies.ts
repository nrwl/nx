import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  Tree,
} from '@nx/devkit';
import { esbuildVersion } from '@nx/js/internal';
import {
  expressVersions,
  fastifyVersions,
  koaVersions,
  nodeTypesVersions,
  nxVersion,
  tslibVersion,
} from '../../../utils/versions';
import { NormalizedSchema } from './normalized-schema';

export function addProjectDependencies(
  tree: Tree,
  options: NormalizedSchema
): {
  installTask: GeneratorCallback;
  frameworkDependencies: Record<string, string>;
} {
  const bundlers = {
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

  const frameworkDependencies = {
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
  const frameworkDevDependencies = {
    express: {
      '@types/express': exprPkgVersions.expressTypingsVersion,
    },
    koa: {
      '@types/koa': koaPkgVersions.koaTypingsVersion,
    },
    fastify: {},
  };

  const typesNodeVersion = nodeTypesVersions(tree).typesNodeVersion;

  return {
    installTask: addDependenciesToPackageJson(
      tree,
      {
        ...frameworkDependencies[options.framework],
        tslib: tslibVersion,
      },
      {
        ...frameworkDevDependencies[options.framework],
        ...bundlers[options.bundler],
        '@types/node': typesNodeVersion,
      },
      undefined,
      options.keepExistingVersions ?? true
    ),
    frameworkDependencies: frameworkDependencies[options.framework],
  };
}
