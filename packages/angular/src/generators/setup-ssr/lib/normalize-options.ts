import type { Tree } from '@nrwl/devkit';
import { readNxJson } from '@nrwl/devkit';
import type { Schema } from '../schema';

export function normalizeOptions(tree: Tree, options: Schema) {
  return {
    project: options.project ?? readNxJson(tree).defaultProject,
    appId: options.appId ?? 'serverApp',
    main: options.main ?? 'main.server.ts',
    serverFileName: options.serverFileName ?? 'server.ts',
    serverPort: options.serverPort ?? 4000,
    rootModuleFileName: options.rootModuleFileName ?? 'app.server.module.ts',
    rootModuleClassName: options.rootModuleClassName ?? 'AppServerModule',
    skipFormat: options.skipFormat ?? false,
  };
}
