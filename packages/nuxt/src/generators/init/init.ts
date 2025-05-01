import { createProjectGraphAsync, GeneratorCallback, Tree } from '@nx/devkit';
import { addPlugin } from '@nx/devkit/src/utils/add-plugin';

import { createNodesV2 } from '../../plugins/plugin';
import { InitSchema } from './schema';
import { updateDependencies } from './lib/utils';

export async function nuxtInitGenerator(host: Tree, schema: InitSchema) {
  await addPlugin(
    host,
    await createProjectGraphAsync(),
    '@nx/nuxt/plugin',
    createNodesV2,
    {
      buildTargetName: ['build', 'nuxt:build', 'nuxt-build'],
      serveTargetName: ['serve', 'nuxt:serve', 'nuxt-serve'],
      buildDepsTargetName: ['build-deps', 'nuxt:build-deps', 'nuxt-build-deps'],
      watchDepsTargetName: ['watch-deps', 'nuxt:watch-deps', 'nuxt-watch-deps'],
    },
    schema.updatePackageScripts
  );

  let installTask: GeneratorCallback = () => {};
  if (!schema.skipPackageJson) {
    installTask = updateDependencies(host, schema);
  }

  return installTask;
}

export default nuxtInitGenerator;
