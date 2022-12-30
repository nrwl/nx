import type { Tree } from '@nrwl/devkit';
import { formatFiles } from '@nrwl/devkit';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import { normalizeOptions, updateTsConfig } from './lib';
import type { WebWorkerGeneratorOptions } from './schema';

export async function webWorkerGenerator(
  tree: Tree,
  rawOptions: WebWorkerGeneratorOptions
): Promise<void> {
  const options = normalizeOptions(rawOptions);
  const { skipFormat, ...schematicOptions } = options;
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
