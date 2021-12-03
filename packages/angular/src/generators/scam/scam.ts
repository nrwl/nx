import type { Tree } from '@nrwl/devkit';
import type { Schema } from './schema';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import { formatFiles } from '@nrwl/devkit';
import { createScam } from './lib/create-module';

export async function scamGenerator(tree: Tree, schema: Schema) {
  const { inlineScam, ...options } = schema;
  const angularComponentSchematic = wrapAngularDevkitSchematic(
    '@schematics/angular',
    'component'
  );
  await angularComponentSchematic(tree, {
    ...options,
    skipImport: true,
    export: false,
  });

  createScam(tree, schema);

  await formatFiles(tree);
}

export default scamGenerator;
