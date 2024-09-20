import {
  Tree,
  generateFiles,
  joinPathFragments,
  names,
  readProjectConfiguration,
} from '@nx/devkit';
import { maybeJs } from '../../../utils/maybe-js';
import { NormalizedSchema } from '../schema';

export function addModuleFederationFiles(
  host: Tree,
  options: NormalizedSchema,
  defaultRemoteManifest: { name: string; port: number }[]
) {
  const templateVariables = {
    ...names(options.projectName),
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

  const projectConfig = readProjectConfiguration(host, options.projectName);
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
      maybeJs(
        { js: options.js, useJsx: options.bundler === 'rspack' },
        'src/main.tsx'
      )
    ),
    joinPathFragments(
      options.appProjectRoot,
      maybeJs(
        { js: options.js, useJsx: options.bundler === 'rspack' },
        'src/bootstrap.tsx'
      )
    )
  );

  generateFiles(
    host,
    joinPathFragments(
      __dirname,
      `../files/${
        options.js
          ? options.bundler === 'rspack'
            ? 'rspack-common'
            : 'common'
          : 'common-ts'
      }`
    ),
    options.appProjectRoot,
    templateVariables
  );

  const pathToModuleFederationFiles = options.typescriptConfiguration
    ? `${
        options.bundler === 'rspack' ? 'rspack-' : 'webpack-'
      }module-federation-ts`
    : `${
        options.bundler === 'rspack' ? 'rspack-' : 'webpack-'
      }module-federation`;
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

  function processBundlerConfigFile(options, host, fileName) {
    const pathToBundlerConfig = joinPathFragments(
      options.appProjectRoot,
      fileName
    );
    deleteFileIfExists(host, pathToBundlerConfig);
  }

  if (options.typescriptConfiguration) {
    if (options.bundler === 'rspack') {
      processBundlerConfigFile(options, host, 'rspack.config.js');
      processBundlerConfigFile(options, host, 'rspack.config.prod.js');
    } else {
      processBundlerConfigFile(options, host, 'webpack.config.js');
      processBundlerConfigFile(options, host, 'webpack.config.prod.js');
    }
  }

  if (options.dynamic) {
    processBundlerConfigFile(options, host, 'webpack.config.prod.js');
    processBundlerConfigFile(options, host, 'webpack.config.prod.ts');
    processBundlerConfigFile(options, host, 'rspack.config.prod.js');
    processBundlerConfigFile(options, host, 'rspack.config.prod.ts');
    if (!host.exists(pathToMFManifest)) {
      host.write(
        pathToMFManifest,
        `{
        ${defaultRemoteManifest
          .map(({ name, port }) => `"${name}": "http://localhost:${port}"`)
          .join(',\n')}
          }`
      );
    }
  }
}
