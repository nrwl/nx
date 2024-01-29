import { NormalizedSchema } from '../schema';
import {
  Tree,
  generateFiles,
  joinPathFragments,
  names,
  readProjectConfiguration,
} from '@nx/devkit';

export function addModuleFederationFiles(
  host: Tree,
  options: NormalizedSchema,
  defaultRemoteManifest: { name: string; port: number }[]
) {
  const templateVariables = {
    ...names(options.name),
    ...options,
    static: !options?.dynamic,
    tmpl: '',
    remotes: defaultRemoteManifest.map(({ name, port }) => {
      return {
        ...names(name),
        port,
      };
    }),
  };

  const projectConfig = readProjectConfiguration(host, options.name);
  const pathToMFManifest = joinPathFragments(
    projectConfig.sourceRoot,
    'assets/module-federation.manifest.json'
  );

  // Module federation requires bootstrap code to be dynamically imported.
  // Renaming original entry file so we can use `import(./bootstrap)` in
  // new entry file.
  host.rename(
    joinPathFragments(
      options.appProjectRoot,
      `src/main.${options.js ? 'js' : 'tsx'}`
    ),
    joinPathFragments(
      options.appProjectRoot,
      `src/bootstrap.${options.js ? 'js' : 'tsx'}`
    )
  );

  generateFiles(
    host,
    joinPathFragments(
      __dirname,
      `../files/${options.js ? 'common' : 'common-ts'}`
    ),
    options.appProjectRoot,
    templateVariables
  );

  const pathToModuleFederationFiles =
    options.typescriptConfiguration && !options.js
      ? 'module-federation-ts'
      : 'module-federation';
  // New entry file is created here.
  generateFiles(
    host,
    joinPathFragments(__dirname, `../files/${pathToModuleFederationFiles}`),
    options.appProjectRoot,
    templateVariables
  );

  function deleteFileIfExists(host, filePath) {
    if (host.exists(filePath)) {
      host.delete(filePath);
    }
  }

  function processWebpackConfig(options, host, fileName) {
    const pathToWebpackConfig = joinPathFragments(
      options.appProjectRoot,
      fileName
    );
    deleteFileIfExists(host, pathToWebpackConfig);
  }

  if (options.typescriptConfiguration) {
    processWebpackConfig(options, host, 'webpack.config.js');
    processWebpackConfig(options, host, 'webpack.config.prod.js');
  }

  if (options.dynamic) {
    processWebpackConfig(options, host, 'webpack.config.prod.js');
    processWebpackConfig(options, host, 'webpack.config.prod.ts');
    if (!host.exists(pathToMFManifest)) {
      host.write(pathToMFManifest, '{}');
    }
  }
}
