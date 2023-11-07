import type { Tree } from '@nx/devkit';
import { isNgStandaloneApp } from '../../../utils/nx-devkit/ast-utils';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import type { Schema } from '../schema';

export function normalizeOptions(tree: Tree, options: Schema) {
  const isStandaloneApp = isNgStandaloneApp(tree, options.project);

  let hydration = options.hydration;
  if (hydration === undefined) {
    const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);
    hydration = angularMajorVersion >= 17;
  }

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
    hydration,
  };
}
