import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  joinPathFragments,
  Tree,
  updateJson,
} from '@nx/devkit';
import { esbuildVersion } from '@nx/js/src/utils/versions';
import {
  expressTypingsVersion,
  expressVersion,
  fastifyAutoloadVersion,
  fastifyPluginVersion,
  fastifySensibleVersion,
  fastifyVersion,
  koaTypingsVersion,
  koaVersion,
  nxVersion,
  tslibVersion,
  typesNodeVersion,
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

  const frameworkDependencies = {
    express: {
      express: expressVersion,
    },
    koa: {
      koa: koaVersion,
    },
    fastify: {
      fastify: fastifyVersion,
      'fastify-plugin': fastifyPluginVersion,
      '@fastify/autoload': fastifyAutoloadVersion,
      '@fastify/sensible': fastifySensibleVersion,
    },
  };
  const frameworkDevDependencies = {
    express: {
      '@types/express': expressTypingsVersion,
    },
    koa: {
      '@types/koa': koaTypingsVersion,
    },
    fastify: {},
  };

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
      }
    ),
    frameworkDependencies: frameworkDependencies[options.framework],
  };
}
