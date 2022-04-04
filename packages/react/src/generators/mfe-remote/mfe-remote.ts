import { join } from 'path';
import { formatFiles, generateFiles, names, Tree } from '@nrwl/devkit';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';

import { Schema } from './schema';
import { normalizeOptions } from '../application/lib/normalize-options';
import applicationGenerator from '../application/application';
import { updateMfeProject } from '../mfe-host/lib/update-mfe-project';
import { NormalizedSchema } from '../application/schema';
import { updateHostWithRemote } from '../mfe-host/lib/update-host-with-remote';

export function addMfeFiles(host: Tree, options: NormalizedSchema) {
  const templateVariables = {
    ...names(options.name),
    ...options,
    tmpl: '',
  };

  generateFiles(
    host,
    join(__dirname, `./files/mfe`),
    options.appProjectRoot,
    templateVariables
  );
}

export async function mfeRemoteGenerator(host: Tree, schema: Schema) {
  const options = normalizeOptions(host, schema);
  const initApp = await applicationGenerator(host, options);

  // Module federation requires bootstrap code to be dynamically imported.
  // Renaming original entry file so we can use `import(./bootstrap)` in
  // new entry file.
  host.rename(
    join(options.appProjectRoot, 'src/main.tsx'),
    join(options.appProjectRoot, 'src/bootstrap.tsx')
  );

  addMfeFiles(host, options);
  updateMfeProject(host, options);
  if (schema.host) {
    updateHostWithRemote(host, options);
  } else {
    // Log that no host has been passed in so we will use the default project as the host (Only if through CLI)
    // Since Remotes can be generated from the Host Generator we should probably have some identifier to use
  }

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(initApp);
}
