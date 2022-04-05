import { formatFiles, Tree } from '@nrwl/devkit';
import { Schema } from './schema';
import applicationGenerator from '../application/application';
import { normalizeOptions } from '../application/lib/normalize-options';
import { addMFEFiles } from './lib/add-mfe';
import { updateMfeProject } from './lib/update-mfe-project';
import { mfeRemoteGenerator } from '../mfe-remote/mfe-remote';
import { updateMfeE2eProject } from './lib/update-mfe-e2e-project';

export async function mfeHostGenerator(host: Tree, schema: Schema) {
  const options = normalizeOptions(host, schema);

  const initTask = await applicationGenerator(host, {
    ...options,
    // The target use-case for MFE is loading remotes as child routes, thus always enable routing.
    routing: true,
  });

  addMFEFiles(host, options);
  updateMfeProject(host, options);
  updateMfeE2eProject(host, options);

  if (schema.remotes) {
    let remotePort = options.devServerPort + 1;
    for (const remote of schema.remotes) {
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

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return initTask;
}

export default mfeHostGenerator;
