import type { Tree } from '@nrwl/devkit';
import { formatFiles } from '@nrwl/devkit';
import type { NestSchematic, NormalizedOptions } from './types';

export async function runNestSchematic(
  tree: Tree,
  schematic: NestSchematic,
  options: NormalizedOptions
): Promise<any> {
  const { skipFormat, ...schematicOptions } = options;

  const { wrapAngularDevkitSchematic } = require('@nrwl/devkit/ngcli-adapter');
  const nestSchematic = wrapAngularDevkitSchematic(
    '@nestjs/schematics',
    schematic
  );
  const result = await nestSchematic(tree, schematicOptions);

  if (!skipFormat) {
    await formatFiles(tree);
  }

  return result;
}
