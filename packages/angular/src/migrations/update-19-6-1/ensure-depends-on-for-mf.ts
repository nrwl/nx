import { formatFiles, readNxJson, type Tree, updateNxJson } from '@nx/devkit';
import {
  forEachExecutorOptions,
  upsertTargetDefault,
  findTargetDefault,
} from '@nx/devkit/internal';
import type { WebpackExecutorOptions } from '@nx/webpack';

export default async function (tree: Tree) {
  let usesModuleFederation = false;
  forEachExecutorOptions<WebpackExecutorOptions>(
    tree,
    '@nx/angular:webpack-browser',
    (options) => {
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

  const nxJson = readNxJson(tree) ?? {};
  const nxMFDevRemotesEnvVar = 'NX_MF_DEV_REMOTES';
  const webpackExecutor = '@nx/angular:webpack-browser';
  const defaultInputs = [
    ...(nxJson.namedInputs && 'production' in nxJson.namedInputs
      ? ['production', '^production']
      : ['default', '^default']),
    { env: nxMFDevRemotesEnvVar },
  ];

  const existing = findTargetDefault(nxJson.targetDefaults, {
    executor: webpackExecutor,
  });

  if (!existing) {
    upsertTargetDefault(tree, nxJson, {
      executor: webpackExecutor,
      cache: true,
      inputs: defaultInputs,
      dependsOn: ['^build'],
    });
  } else {
    const dependsOn = [...(existing.dependsOn ?? [])];
    if (!dependsOn.includes('^build')) dependsOn.push('^build');

    const inputs = [...(existing.inputs ?? [])];
    if (
      !inputs.find((i) =>
        typeof i === 'string' ? false : i['env'] === nxMFDevRemotesEnvVar
      )
    ) {
      inputs.push({ env: nxMFDevRemotesEnvVar });
    }

    upsertTargetDefault(tree, nxJson, {
      executor: webpackExecutor,
      ...(existing.cache !== undefined ? { cache: existing.cache } : {}),
      inputs,
      dependsOn,
    });
  }
  updateNxJson(tree, nxJson);
  await formatFiles(tree);
}
