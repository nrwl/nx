import { formatFiles, Tree } from '@nrwl/devkit';

import applicationGenerator from '../application/application';
import { normalizeOptions } from '../application/lib/normalize-options';
import { updateModuleFederationProject } from '../../rules/update-module-federation-project';
import { addModuleFederationFiles } from './lib/add-module-federation-files';
import { updateModuleFederationE2eProject } from './lib/update-module-federation-e2e-project';
import { Schema } from './schema';
import remoteGenerator from '../remote/remote';

export async function hostGenerator(host: Tree, schema: Schema) {
  const options = normalizeOptions(host, schema);

  const initTask = await applicationGenerator(host, {
    ...options,
    // The target use-case is loading remotes as child routes, thus always enable routing.
    routing: true,
  });

  const remotesWithPorts: { name: string; port: number }[] = [];

  if (schema.remotes) {
    let remotePort = options.devServerPort + 1;
    for (const remote of schema.remotes) {
      remotesWithPorts.push({ name: remote, port: remotePort });
      await remoteGenerator(host, {
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

  addModuleFederationFiles(host, options, remotesWithPorts);
  updateModuleFederationProject(host, options);
  updateModuleFederationE2eProject(host, options);

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return initTask;
}

export default hostGenerator;
