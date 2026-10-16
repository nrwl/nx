import { addPlugin } from '@nx/devkit/internal';
import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  formatFiles,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { ensureTypescriptPlugin } from '@nx/js/internal';
import { createNodesV2 } from '../../plugins/plugin';
import {
  assertSupportedRolldownVersion,
  nxVersion,
  rolldownVersion,
} from '../../utils/versions';
import type { Schema } from './schema';

export async function rolldownInitGenerator(tree: Tree, schema: Schema) {
  assertSupportedRolldownVersion(tree);

  let task: GeneratorCallback = () => {};
  if (!schema.skipPackageJson) {
    task = addDependenciesToPackageJson(
      tree,
      {},
      { '@nx/rolldown': nxVersion, rolldown: rolldownVersion },
      undefined,
      schema.keepExistingVersions ?? true
    );
  }

  await addPlugin(
    tree,
    await createProjectGraphAsync(),
    '@nx/rolldown/plugin',
    createNodesV2,
    { buildTargetName: ['build', 'rolldown:build', 'rolldown-build'] },
    schema.updatePackageScripts
  );
  await ensureTypescriptPlugin(tree, schema.updatePackageScripts);

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return task;
}

export default rolldownInitGenerator;
