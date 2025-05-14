import { Tree, updateJson } from '@nx/devkit';

import applicationGenerator from '../application/application';
import { PresetGeneratorSchema } from './schema';

export default async function (tree: Tree, options: PresetGeneratorSchema) {
  const appTask = applicationGenerator(tree, {
    ...options,
    directory: '.',
    // Since `--style` is not passed down to custom preset, we're using individual flags for now.
    style: options.sass
      ? 'scss'
      : options.less
      ? 'less'
      : options.stylus
      ? 'styl'
      : 'css',
  });

  updateJson(tree, 'package.json', (json) => {
    json.scripts ??= {};
    json.scripts.build ??= 'npx nx build';
    json.scripts.start ??= 'npx nx serve';
    json.scripts.lint ??= 'npx nx lint';
    json.scripts.test ??= 'npx nx test';
    json.scripts.e2e ??= 'npx nx e2e e2e';
    return json;
  });

  if (options.rootProject) {
    // Remove these folders so projects will be generated at the root.
    tree.delete('apps');
    tree.delete('libs');
  }

  return appTask;
}
