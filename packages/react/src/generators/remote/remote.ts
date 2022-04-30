import { join } from 'path';
import { formatFiles, generateFiles, names, Tree } from '@nrwl/devkit';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';

import { normalizeOptions } from '../application/lib/normalize-options';
import applicationGenerator from '../application/application';
import { NormalizedSchema } from '../application/schema';
import { updateHostWithRemote } from './lib/update-host-with-remote';
import { updateModuleFederationProject } from '../../rules/update-module-federation-project';
import { Schema } from './schema';

export function addModuleFederationFiles(
  host: Tree,
  options: NormalizedSchema
) {
  const templateVariables = {
    ...names(options.name),
    ...options,
    tmpl: '',
  };

  generateFiles(
    host,
    join(__dirname, `./files/module-federation`),
    options.appProjectRoot,
    templateVariables
  );
}

export async function remoteGenerator(host: Tree, schema: Schema) {
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

  addModuleFederationFiles(host, options);
  updateModuleFederationProject(host, options);

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(initApp);
}

export default remoteGenerator;
