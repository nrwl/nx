import {
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
  readNxJson,
  type Tree,
} from '@nx/devkit';
import { join } from 'path';
import type { StorybookConfigurationSchema } from './schema';
import { storybookConfigurationGenerator } from '@nx/react';

export function remixStorybookConfiguration(
  tree: Tree,
  schema: StorybookConfigurationSchema
) {
  return remixStorybookConfigurationInternal(tree, {
    addPlugin: false,
    ...schema,
  });
}

export default async function remixStorybookConfigurationInternal(
  tree: Tree,
  schema: StorybookConfigurationSchema
) {
  const nxJson = readNxJson(tree);
  const addPluginDefault =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;
  schema.addPlugin ??= addPluginDefault;
  const { root } = readProjectConfiguration(tree, schema.project);

  if (!tree.exists(joinPathFragments(root, 'vite.config.ts'))) {
    generateFiles(tree, join(__dirname, 'files'), root, { tpl: '' });
  }

  const task = await storybookConfigurationGenerator(tree, schema);

  return task;
}
