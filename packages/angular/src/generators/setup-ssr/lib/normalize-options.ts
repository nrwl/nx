import {
  joinPathFragments,
  readProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { isNgStandaloneApp } from '../../../utils/nx-devkit/ast-utils';
import type { NormalizedGeneratorOptions, Schema } from '../schema';

export async function normalizeOptions(
  tree: Tree,
  options: Schema
): Promise<NormalizedGeneratorOptions> {
  const { targets, root } = readProjectConfiguration(tree, options.project);
  const isUsingApplicationBuilder =
    targets.build.executor === '@angular-devkit/build-angular:application' ||
    targets.build.executor === '@angular/build:application' ||
    targets.build.executor === '@nx/angular:application';

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
    buildTargetTsConfigPath:
      targets.build.options?.tsConfig ??
      joinPathFragments(root, 'tsconfig.app.json'),
  };
}
