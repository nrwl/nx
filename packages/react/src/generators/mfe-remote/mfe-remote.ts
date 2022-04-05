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

  if (schema.host) {
    updateHostWithRemote(host, schema.host, options.name);
  }

  // Module federation requires bootstrap code to be dynamically imported.
  // Renaming original entry file so we can use `import(./bootstrap)` in
  // new entry file.
  host.rename(
    join(options.appProjectRoot, 'src/main.tsx'),
    join(options.appProjectRoot, 'src/bootstrap.tsx')
  );

  addMfeFiles(host, options);
  updateMfeProject(host, options);

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(initApp);
}

export default mfeRemoteGenerator;
