import { NormalizedSchema } from '@nrwl/react/src/generators/application/schema';
import { generateFiles, names } from '@nrwl/devkit';
import { join } from 'path';

export function addMFEFiles(host, options: NormalizedSchema) {
  const templateVariables = {
    ...names(options.name),
    ...options,
    tmpl: '',
    remotes: options.remotes.map((r) => names(r)),
  };

  // Module federation requires bootstrap code to be dynamically imported.
  // Renaming original entry file so we can use `import(./bootstrap)` in
  // new entry file.
  host.rename(
    join(options.appProjectRoot, 'src/main.tsx'),
    join(options.appProjectRoot, 'src/bootstrap.tsx')
  );

  // New entry file is created here.
  generateFiles(
    host,
    join(__dirname, `../files/mfe`),
    options.appProjectRoot,
    templateVariables
  );

  generateFiles(
    host,
    join(__dirname, `../files/common`),
    options.appProjectRoot,
    templateVariables
  );
}
