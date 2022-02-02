import type { Tree } from '@nrwl/devkit';
import type { NormalizedSchema } from './normalized-schema';

import { setupMfe } from '../../setup-mfe/setup-mfe';

export async function addMfe(host: Tree, options: NormalizedSchema) {
  await setupMfe(host, {
    appName: options.name,
    mfeType: options.mfeType,
    port: options.port,
    remotes: options.remotes,
    host: options.host,
    routing: options.routing,
    skipFormat: true,
    skipPackageJson: options.skipPackageJson,
  });
}
