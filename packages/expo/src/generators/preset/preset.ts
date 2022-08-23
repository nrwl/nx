import { convertNxGenerator, formatFiles, Tree } from '@nrwl/devkit';
import { setDefaultCollection } from '@nrwl/workspace/src/utilities/set-default-collection';
import expoApplicationGenerator from '../application/application';
import { PresetGeneratorSchema } from './schema';

export default async function expoPresetGenerator(
  tree: Tree,
  options: PresetGeneratorSchema
) {
  const appTask = await expoApplicationGenerator(tree, {
    ...options,
    name: options.appName || options.name,
  });

  setDefaultCollection(tree, '@nrwl/expo');

  await formatFiles(tree);

  return appTask;
}

export const expoPresetSchematic = convertNxGenerator(expoPresetGenerator);
