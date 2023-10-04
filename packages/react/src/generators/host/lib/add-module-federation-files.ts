import { NormalizedSchema } from '../schema';
import { generateFiles, joinPathFragments, names } from '@nx/devkit';
import { join } from 'path';

export function addModuleFederationFiles(
  host,
  options: NormalizedSchema,
  defaultRemoteManifest: { name: string; port: number }[]
) {
  const templateVariables = {
    ...names(options.name),
    ...options,
    tmpl: '',
    remotes: defaultRemoteManifest.map(({ name, port }) => {
      return {
        ...names(name),
        port,
      };
    }),
  };

  // Module federation requires bootstrap code to be dynamically imported.
  // Renaming original entry file so we can use `import(./bootstrap)` in
  // new entry file.
  host.rename(
    join(options.appProjectRoot, 'src/main.tsx'),
    join(options.appProjectRoot, 'src/bootstrap.tsx')
  );

  generateFiles(
    host,
    join(__dirname, `../files/common`),
    options.appProjectRoot,
    templateVariables
  );

  const pathToModuleFederationFiles = options.typescriptConfiguration
    ? 'module-federation-ts'
    : 'module-federation';
  // New entry file is created here.
  generateFiles(
    host,
    join(__dirname, `../files/${pathToModuleFederationFiles}`),
    options.appProjectRoot,
    templateVariables
  );

  if (options.typescriptConfiguration) {
    const pathToWebpackConfig = joinPathFragments(
      options.appProjectRoot,
      'webpack.config.js'
    );
    const pathToWebpackProdConfig = joinPathFragments(
      options.appProjectRoot,
      'webpack.config.prod.js'
    );
    if (host.exists(pathToWebpackConfig)) {
      host.delete(pathToWebpackConfig);
    }
    if (host.exists(pathToWebpackProdConfig)) {
      host.delete(pathToWebpackProdConfig);
    }
  }
}
