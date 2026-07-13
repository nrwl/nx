import {
  joinPathFragments,
  readNxJson,
  readProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { readTargetDefaultsForTarget } from '@nx/devkit/internal';
import { isNgStandaloneApp } from '../../../utils/nx-devkit/ast-utils';
import type { NormalizedGeneratorOptions, Schema } from '../schema';

export async function normalizeOptions(
  tree: Tree,
  options: Schema
): Promise<NormalizedGeneratorOptions> {
  const { targets, root } = readProjectConfiguration(tree, options.project);
  // readProjectConfiguration returns the raw config, so a build target that
  // inherits its executor from an nx.json targetDefaults entry reads as
  // undefined. Resolve it so the builder classification stays accurate.
  const buildTargetExecutor =
    targets.build.executor ??
    readTargetDefaultsForTarget('build', readNxJson(tree)?.targetDefaults)
      ?.executor;
  if (!buildTargetExecutor) {
    throw new Error(
      `The "build" target of the "${options.project}" project does not specify an executor. Please add an executor to the "build" target.`
    );
  }

  const isUsingApplicationBuilder =
    buildTargetExecutor === '@angular-devkit/build-angular:application' ||
    buildTargetExecutor === '@angular/build:application' ||
    buildTargetExecutor === '@nx/angular:application';
  const isUsingWebpackBuilder =
    buildTargetExecutor === '@nx/angular:webpack-browser';

  const isStandaloneApp = isNgStandaloneApp(tree, options.project);

  return {
    project: options.project,
    appId: options.appId ?? 'serverApp',
    main: options.main ?? 'main.server.ts',
    serverFileName: options.serverFileName ?? 'server.ts',
    serverPort: options.serverPort ?? 4000,
    rootModuleFileName: options.rootModuleFileName ?? 'app.server.module.ts',
    rootModuleClassName: options.rootModuleClassName ?? 'AppServerModule',
    skipFormat: options.skipFormat ?? false,
    standalone: options.standalone ?? isStandaloneApp,
    hydration: options.hydration ?? true,
    isUsingApplicationBuilder,
    isUsingWebpackBuilder,
    buildTargetExecutor,
    buildTargetTsConfigPath:
      targets.build.options?.tsConfig ??
      joinPathFragments(root, 'tsconfig.app.json'),
  };
}
