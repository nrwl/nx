import type { Tree } from '@nrwl/devkit';
import { formatFiles } from '@nrwl/devkit';
import { normalizeOptions, updateTsConfig } from './lib';
import type { WebWorkerGeneratorOptions } from './schema';

export async function webWorkerGenerator(
  tree: Tree,
  rawOptions: WebWorkerGeneratorOptions
): Promise<void> {
  const options = normalizeOptions(rawOptions);
  const { skipFormat, ...schematicOptions } = options;
  const { wrapAngularDevkitSchematic } = require('@nrwl/devkit/ngcli-adapter');
  const webWorkerSchematic = wrapAngularDevkitSchematic(
    '@schematics/angular',
    'web-worker'
  );
  await webWorkerSchematic(tree, schematicOptions);

  updateTsConfig(tree, options.project);

  if (!skipFormat) {
    await formatFiles(tree);
  }
}

export default webWorkerGenerator;
