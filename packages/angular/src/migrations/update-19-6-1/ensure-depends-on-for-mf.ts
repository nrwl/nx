import { formatFiles, readNxJson, type Tree, updateNxJson } from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import type { WebpackExecutorOptions } from '@nx/webpack';

export default async function (tree: Tree) {
  let usesModuleFederation = false;
  forEachExecutorOptions<WebpackExecutorOptions>(
    tree,
    '@nx/angular:webpack-browser',
    (options, projectName, targetName) => {
      const webpackConfig: string = options.webpackConfig;
      if (!webpackConfig) {
        return;
      }

      const webpackContents = tree.read(webpackConfig, 'utf-8');
      if (
        ['withModuleFederation', 'withModuleFederationForSSR'].some((p) =>
          webpackContents.includes(p)
        )
      ) {
        usesModuleFederation = true;
      }
    }
  );

  if (!usesModuleFederation) {
    return;
  }

  const nxJson = readNxJson(tree);
  const nxMFDevRemotesEnvVar = 'NX_MF_DEV_REMOTES';
  const inputs = [
    ...(nxJson.namedInputs && 'production' in nxJson.namedInputs
      ? ['production', '^production']
      : ['default', '^default']),
    { env: nxMFDevRemotesEnvVar },
  ];
  if (
    !nxJson.targetDefaults ||
    !nxJson.targetDefaults?.['@nx/angular:webpack-browser']
  ) {
    nxJson.targetDefaults ??= {};
    nxJson.targetDefaults['@nx/angular:webpack-browser'] = {
      cache: true,
      inputs,
      dependsOn: ['^build'],
    };
  } else {
    nxJson.targetDefaults['@nx/angular:webpack-browser'].dependsOn ??= [];
    if (
      !nxJson.targetDefaults['@nx/angular:webpack-browser'].dependsOn.includes(
        '^build'
      )
    ) {
      nxJson.targetDefaults['@nx/angular:webpack-browser'].dependsOn.push(
        '^build'
      );
    }

    nxJson.targetDefaults['@nx/angular:webpack-browser'].inputs ??= [];
    if (
      !nxJson.targetDefaults['@nx/angular:webpack-browser'].inputs.find((i) =>
        typeof i === 'string' ? false : i['env'] === nxMFDevRemotesEnvVar
      )
    ) {
      nxJson.targetDefaults['@nx/angular:webpack-browser'].inputs.push({
        env: nxMFDevRemotesEnvVar,
      });
    }
  }
  updateNxJson(tree, nxJson);
  await formatFiles(tree);
}
