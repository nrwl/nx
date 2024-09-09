import { formatFiles, readNxJson, type Tree, updateNxJson } from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import type { WebpackExecutorOptions } from '@nx/webpack';

export default async function (tree: Tree) {
  let usesModuleFederation = false;
  forEachExecutorOptions<WebpackExecutorOptions>(
    tree,
    '@nx/webpack:webpack',
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
  if (
    !nxJson.targetDefaults ||
    !nxJson.targetDefaults?.['@nx/webpack:webpack']
  ) {
    nxJson.targetDefaults ??= {};
    nxJson.targetDefaults['@nx/webpack:webpack'] = {
      cache: true,
      inputs: ['production', '^production', { env: nxMFDevRemotesEnvVar }],
      dependsOn: ['^build'],
    };
  } else {
    nxJson.targetDefaults['@nx/webpack:webpack'].dependsOn ??= [];
    if (
      !nxJson.targetDefaults['@nx/webpack:webpack'].dependsOn.includes('^build')
    ) {
      nxJson.targetDefaults['@nx/webpack:webpack'].dependsOn.push('^build');
    }

    nxJson.targetDefaults['@nx/webpack:webpack'].inputs ??= [];
    if (
      !nxJson.targetDefaults['@nx/webpack:webpack'].inputs.find((i) =>
        typeof i === 'string' ? false : i['env'] === nxMFDevRemotesEnvVar
      )
    ) {
      nxJson.targetDefaults['@nx/webpack:webpack'].inputs.push({
        env: nxMFDevRemotesEnvVar,
      });
    }
  }
  updateNxJson(tree, nxJson);
  await formatFiles(tree);
}
