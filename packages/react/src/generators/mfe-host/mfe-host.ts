import { formatFiles, Tree } from '@nrwl/devkit';

import applicationGenerator from '../application/application';
import { normalizeOptions } from '../application/lib/normalize-options';
import { mfeRemoteGenerator } from '../mfe-remote/mfe-remote';
import { updateMfeProject } from '../../rules/update-mfe-project';
import { addMfeFiles } from './lib/add-mfe-files';
import { updateMfeE2eProject } from './lib/update-mfe-e2e-project';
import { Schema } from './schema';

export async function mfeHostGenerator(host: Tree, schema: Schema) {
  const options = normalizeOptions(host, schema);

  const initTask = await applicationGenerator(host, {
    ...options,
    // The target use-case for MFE is loading remotes as child routes, thus always enable routing.
    routing: true,
  });

  const remotesWithPorts: { name: string; port: number }[] = [];

  if (schema.remotes) {
    let remotePort = options.devServerPort + 1;
    for (const remote of schema.remotes) {
      remotesWithPorts.push({ name: remote, port: remotePort });
      await mfeRemoteGenerator(host, {
        name: remote,
        style: options.style,
        skipFormat: options.skipFormat,
        unitTestRunner: options.unitTestRunner,
        e2eTestRunner: options.e2eTestRunner,
        linter: options.linter,
        devServerPort: remotePort,
      });
      remotePort++;
    }
  }

  addMfeFiles(host, options, remotesWithPorts);
  updateMfeProject(host, options);
  updateMfeE2eProject(host, options);

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return initTask;
}

export default mfeHostGenerator;
