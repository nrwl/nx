import type { Tree } from '@nrwl/devkit';
import type { NormalizedSchema } from './normalized-schema';

import { setupMf } from '../../setup-mf/setup-mf';

export async function addMf(host: Tree, options: NormalizedSchema) {
  await setupMf(host, {
    appName: options.name,
    mfType: options.mfType,
    port: options.port,
    remotes: options.remotes,
    host: options.host,
    routing: options.routing,
    skipFormat: true,
    skipPackageJson: options.skipPackageJson,
    e2eProjectName: options.e2eProjectName,
    federationType: options.federationType,
    prefix: options.prefix,
  });
}
