import { readProjectConfiguration, type Tree } from '@nx/devkit';
import { promptWhenInteractive } from '@nx/devkit/src/generators/prompt';
import { isNgStandaloneApp } from '../../../utils/nx-devkit/ast-utils';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import type { NormalizedGeneratorOptions, Schema } from '../schema';

export async function normalizeOptions(
  tree: Tree,
  options: Schema
): Promise<NormalizedGeneratorOptions> {
  const { targets } = readProjectConfiguration(tree, options.project);
  const isUsingApplicationBuilder =
    targets.build.executor === '@angular-devkit/build-angular:application' ||
    targets.build.executor === '@angular/build:application' ||
    targets.build.executor === '@nx/angular:application';

  if (options.serverRouting === undefined && isUsingApplicationBuilder) {
    const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);

    if (angularMajorVersion === 19) {
      options.serverRouting = await promptWhenInteractive<{
        serverRouting: boolean;
      }>(
        {
          type: 'confirm',
          name: 'serverRouting',
          message:
            'Would you like to use the Server Routing and App Engine APIs (Developer Preview) for this server application?',
          initial: false,
        },
        { serverRouting: false }
      ).then(({ serverRouting }) => serverRouting);
    } else {
      options.serverRouting = angularMajorVersion >= 20;
    }
  } else if (
    options.serverRouting !== undefined &&
    !isUsingApplicationBuilder
  ) {
    throw new Error(
      'Server routing APIs can only be added to a project using `application` builder.'
    );
  }

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
    serverRouting: options.serverRouting,
    isUsingApplicationBuilder,
  };
}
